/**
 * 「包内技能齐全」判据（替代原来的 `check:skills` 漂移门）。
 *
 * ── 为什么换判据（2026-10-09）──────────────────────────────────────────────
 *   旧机制：技能正文由磁盘 `.agents\skills` **构建期生成**进 `src/generated/skills.ts`，
 *   漂移门比对"入库产物 vs 磁盘"。技能改成随包分发之后，**源码就在仓库 `skills/`**，
 *   没有第二份可漂移 —— 于是判据换成"**发出去的那份齐不齐**"：
 *
 *   ① `skills/` 下恰好 11 个 `sr-*` 技能，每个都有能解析出 `name` 的 `SKILL.md` 与**非空正文**；
 *   ② 每个技能的兄弟资源都在（`references/` 之类的目录非空 —— references 才是技能的精华）；
 *   ③ **没有本机私有文件**（`*.local.json`）混进来；
 *   ④ 宿主半侧用**真实的 apply()** 真注册一遍：条数、模型可见条数、`resourceBase` 指向包内、
 *      并且**指到的那份文件真的读得到**（不是空指针）。
 *
 * 跑法：node tools/check-bundled-skills.mjs
 * 退出码：0 = 通过；1 = 失败
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { apply, loadBundledSkills, packageRootOf, skillsRootOf } from "../src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const ROOT = skillsRootOf(REPO);
const EXPECTED = 10;   // sr-config-heroskill 已改名 skill-hero-config 并搬出插件（不算 sr 系列）

const problems = [];
const ok = (s) => console.log("  ✓ " + s);

// ── ① 技能目录本身
if (!fs.existsSync(ROOT)) {
	console.error("✗ 技能根不存在：" + ROOT);
	process.exit(1);
}
const { skills, problems: loadProblems } = loadBundledSkills(ROOT);
console.log("技能根：" + ROOT);
if (loadProblems.length) problems.push(...loadProblems);

if (skills.length !== EXPECTED) problems.push(`技能数应为 ${EXPECTED}，实际 ${skills.length}`);
else ok(`${EXPECTED} 个 sr 技能，SKILL.md 全部解析得出 name 且正文非空`);

const modelVisible = skills.filter((s) => s.invocation.modelInvocable).length;
const bodyBytes = skills.reduce((a, s) => a + Buffer.byteLength(s.content, "utf8"), 0);
ok(`模型可见 ${modelVisible} · 用户专用 ${skills.length - modelVisible} · 正文 ${(bodyBytes / 1024).toFixed(1)} KB`);

// ── ② 兄弟资源 + ③ 私有文件
let resourceFiles = 0;
let privateFiles = [];
for (const s of skills) {
	let n = 0;
	const walk = (dir, rel) => {
		for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
			const p = path.join(dir, e.name);
			const r = rel ? rel + "/" + e.name : e.name;
			if (e.isDirectory()) { walk(p, r); continue; }
			if (/\.local\.json$/i.test(e.name)) { privateFiles.push(s.name + "/" + r); continue; }
			n++;
		}
	};
	walk(path.join(ROOT, s.name), "");
	resourceFiles += n;
	if (n <= 1) problems.push(`${s.name}：除 SKILL.md 外没有兄弟资源（references 才是技能的精华）—— 实际 ${n} 个文件`);

}
if (privateFiles.length) problems.push("包里混进了本机私有文件：" + privateFiles.join("、"));
else ok(`兄弟资源合计 ${resourceFiles} 个文件 · 无 *.local.json`);

// ── ③' 通用钉子：**git 跟踪的每个 skills/ 文件都必须在盘上**
//   2026-10-09 实测：一批文件在**工作树**里消失了（git 索引里还在），某次 `git add -A` 把删除记进了提交；
//   当时的判据只查"有没有兄弟资源"，结果只逮到两个只剩 SKILL.md 的技能，其余静默丢。
//   这条不点名任何文件：谁丢了都红。（不依赖 git 时跳过并如实说明。）
try {
	const tracked = execFileSync("git", ["-C", REPO, "ls-files", "skills/"], { encoding: "utf8" })
		.split("\n").map((x) => x.trim()).filter(Boolean);
	const missing = tracked.filter((rel) => !fs.existsSync(path.join(REPO, ...rel.split("/"))));
	if (missing.length) problems.push("git 跟踪但盘上不见了：" + missing.slice(0, 8).join("、") + (missing.length > 8 ? " 等 " + missing.length + " 个" : ""));
	else ok("git 跟踪的 " + tracked.length + " 个 skills/ 文件都在盘上");
} catch (e) {
	/**
	 * ★ 只放过"这台机器没有 git / 不是 git 仓库"两种情形。
	 *   其它错误（比如我自己写错、import 漏了）**照旧红** ——
	 *   判据最怕的就是"静默失效"：刚才那一版 catch 太宽，把 `execFileSync is not defined`
	 *   一起吞了，于是这条钉子形同不存在。
	 */
	const msg = String((e && e.message) || e);
	const noGit = /ENOENT|not a git repository|command not found/i.test(msg);
	if (!noGit) problems.push("git 对账没跑成（不许静默跳过）：" + msg.slice(0, 120));
	else console.log("  · 跳过 git 对账（这台机器没有 git 或不是仓库）");
}

// ── ④ 用真实 apply() 注册一遍，并核对 resourceBase 指到的文件真读得到
const registered = [];
const logs = [];
const fakeCtx = {
	skills: { register: (s) => { registered.push(s); return () => {}; } },
	logger: { info: (m) => logs.push(String(m)), warn: (m) => logs.push("WARN " + String(m)), error: () => {} }
};
apply(fakeCtx, undefined);

if (registered.length !== EXPECTED) problems.push(`apply() 注册了 ${registered.length} 条，应为 ${EXPECTED}`);
else ok(`apply() 真实注册 ${EXPECTED} 条`);
if (!logs.some((l) => l.indexOf("随包注册") >= 0)) problems.push("apply() 没打出那行 [sr-workbench] 随包注册 日志");

for (const s of registered) {
	const rb = s.resourceBase;
	if (!rb || rb.kind !== "directory") { problems.push(`${s.name}：resourceBase 不是包内目录`); continue; }
	if (path.resolve(rb.path).indexOf(path.resolve(ROOT)) !== 0) { problems.push(`${s.name}：resourceBase 指到了包外（${rb.path}）`); continue; }
	if (!fs.existsSync(path.join(rb.path, "SKILL.md"))) { problems.push(`${s.name}：resourceBase 目录里没有 SKILL.md`); continue; }
	// 真实性检查：正文必须与该文件一致（不是构建期抄来的副本）
	const onDisk = fs.readFileSync(path.join(rb.path, "SKILL.md"), "utf8");
	if (!onDisk.endsWith(s.content)) { problems.push(`${s.name}：注册的正文与包内 SKILL.md 不一致（正文应当就是文件正文）`); continue; }
}
if (problems.length === 0) ok(skills.length + " 条的 resourceBase 全指向包内目录，且正文与该目录下的 SKILL.md 逐字一致");

// ── ⑤ 缺东西时**不许**注册（宁缺勿假）：拿一个空的临时技能根跑真实 apply()，应当 0 条 + WARN
const empty = fs.mkdtempSync(path.join(process.env.TEMP || "/tmp", "srwb-noroot-"));
const emptyReg = [];
const emptyLogs = [];
apply({
	skills: { register: (s) => { emptyReg.push(s); return () => {}; } },
	logger: { info: (m) => emptyLogs.push(String(m)), warn: (m) => emptyLogs.push("WARN " + String(m)), error: () => {} }
}, { skillsRoot: empty });
fs.rmSync(empty, { recursive: true, force: true });
if (emptyReg.length !== 0) problems.push("技能根为空时必须 0 条注册，实际 " + emptyReg.length);
else if (!emptyLogs.some((l) => l.indexOf("WARN") === 0)) problems.push("技能根为空时应当打一条 WARN（说清一个都没注册 + 怎么查）");
else ok("技能根为空 ⇒ 0 条注册 + WARN 说清原因（宁缺勿假）");

console.log(JSON.stringify({
	技能根: ROOT,
	包根: packageRootOf("file:///" + path.join(ROOT, "..", "lib", "index.js").replace(/\\/g, "/")),
	技能数: skills.length, 模型可见: modelVisible, 正文字节: bodyBytes, 兄弟资源文件数: resourceFiles,
	问题: problems
}, null, 2));

if (problems.length) {
	console.error("\n✗ 包内技能判据未通过：\n - " + problems.join("\n - "));
	process.exit(1);
}
console.error("\n✓ 通过：包内技能齐全（正文 + 兄弟资源同源同包），且缺东西时不注册");
