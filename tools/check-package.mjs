/**
 * **安装包验收**：`npm pack` 出来的 tgz → 解开 → 对**包里的产物**（不是源码树）跑门。
 *
 * ── 为什么必须对 tgz 跑 ──────────────────────────────────────────────────────
 * 源码树里 `lib/` 是对的，**不等于发出去的那个包是对的**：`files` 写漏一个文件、
 * `cordis.patch.yml` 没带上、私有文件被卷进去 —— 只有解开包才看得见。
 * 而同事拿到的就是这个 tgz，所以"能装"这句话必须由**这个包**来证明。
 *
 * 四关（任一条不过就非 0 退出）：
 *   ① **内容清单**：只该有运行期那 5 个文件；不含任何私有文件（`config.local.json`）；
 *      `version` / `dsh.bundle.patch` / `dsh.client.platform` 都对。
 *   ② **加载冒烟**：包里的 `lib/client.js` 在假 ModuleLoader 里真跑 `apply` + slot 注册。
 *   ③ **渲染冒烟**：包里的 `lib/client.js` 在迷你 React 里真跑组件树。
 *   ④ **宿主半侧自足**：包里的 `lib/index.js` 能被**独立 import**，且注册 11 个技能
 *      （正文合计 ~120.9 KB）；`cordis.patch.yml` 结构完好（预设行 / id / 策划模式 / 决策记录契约）。
 *
 * 跑法：`npm run pack:check`（自己 pack 到临时目录，跑完删掉；**不往仓库里写东西**）
 *      `node tools/check-package.mjs <已有的 tgz>`（对现成的包跑）
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

const problems = [];
const ok = (s) => console.log("  ✓ " + s);
const bad = (s, extra) => { problems.push(s + (extra ? "：" + extra : "")); console.log("  ✗ " + s + (extra ? "：" + extra : "")); };

// ── 拿到 tgz：给了路径就用它，没给就现 pack 一个到临时目录 ────────────────
let tgz = process.argv[2] ? path.resolve(process.argv[2]) : "";
let work = fs.mkdtempSync(path.join(os.tmpdir(), "srwb-pkg-"));
let tempTgz = "";
if (tgz === "") {
	console.log("→ npm pack（输出到临时目录）");
	const r = spawnSync("npm", ["pack", "--pack-destination", work], { cwd: REPO, encoding: "utf8", shell: true });
	if (r.status !== 0) { console.error("✗ npm pack 失败：\n" + (r.stderr || "") + (r.stdout || "")); process.exit(1); }
	const made = fs.readdirSync(work).filter((f) => f.endsWith(".tgz"));
	if (made.length !== 1) { console.error("✗ 临时目录里应只有一个 tgz，实际 " + made.length + " 个"); process.exit(1); }
	tgz = path.join(work, made[0]);
	tempTgz = tgz;
}
console.log("验收对象：" + tgz);

const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "srwb-unpack-"));
execFileSync("tar", ["-xzf", tgz, "-C", extractDir], { stdio: "inherit" });
const pkg = path.join(extractDir, "package");
if (!fs.existsSync(pkg)) { console.error("✗ 解开之后没有 package/ 目录（tgz 结构不对）"); process.exit(1); }

try {
	// ── ① 内容清单 ──────────────────────────────────────────────────────
	const files = [];
	(function walk(d) {
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, e.name);
			if (e.isDirectory()) walk(p);
			else files.push(path.relative(pkg, p).replace(/\\/g, "/"));
		}
	})(pkg);
	files.sort();
	console.log("\n① 包内容：" + files.join(" · "));
	for (const need of ["package.json", "cordis.patch.yml", "lib/index.js", "lib/client.js"]) {
		if (!files.includes(need)) bad("包里缺 " + need);
	}
	// ★ 只禁**真私有的**那份：`*.local.json`（本机路径）。`config.local.example.json` 是技能自带的字段样例，
	//   属于技能内容，必须随包走（6.0.0 起技能整套在包里）。
	if (files.some((f) => /\.local\.json$/.test(f))) bad("包里不该有本机私有文件（*.local.json）");
	if (files.some((f) => f.startsWith("src/") || f.startsWith("test/"))) bad("包里不该有 src/ 或 test/");

	/**
	 * ★ 6.0.0：技能**随包分发**（正文 + references 同源同包）——
	 *   所以"包里有没有 skills\\"是**功能性判据**，不是清单洁癖：
	 *   漏了它，同事装上就是"一个技能都没有"（宿主半侧扫不到技能根，只打一条 WARN）。
	 */
	const skillMd = files.filter((f) => /^skills\/sr-[^/]+\/SKILL\.md$/.test(f));
	const skillFiles = files.filter((f) => f.startsWith("skills/"));
	if (skillMd.length !== 10) bad("包里应当有 10 个 skills/sr-*/SKILL.md，实际 " + skillMd.length);
	else ok("包内技能：" + skillMd.length + " 个 SKILL.md · 技能文件合计 " + skillFiles.length + " 个");
	// 兄弟资源（references 等）必须在 —— 只有正文等于空壳，那正是旧设计的病
	const refFiles = files.filter((f) => /^skills\/sr-[^/]+\/(references|scripts|tools|resources|examples)\//.test(f));
	if (refFiles.length < 90) bad("包内技能兄弟资源过少（" + refFiles.length + " 个）—— references 才是技能的精华");
	if (files.some((f) => /\.local\.json$/.test(f))) bad("包里不该有本机私有文件（skills/**/*.local.json）");

	const nonSkill = files.filter((f) => !f.startsWith("skills/"));
	if (nonSkill.length !== 5) bad("非技能文件应为 5 个（README/cordis.patch.yml/lib 两个/package.json），实际 " + nonSkill.length);
	if (problems.length === 0) ok("顶层 5 个文件 + 包内技能齐全（无私有文件）");

	const pj = JSON.parse(fs.readFileSync(path.join(pkg, "package.json"), "utf8"));
	console.log("   name " + pj.name + " · version " + pj.version + " · private " + pj.private);
	if (pj.private !== true) bad("private 应为 true（交付走目录 / tgz，不发公共 npm）");
	if (!pj.dsh || !pj.dsh.bundle || pj.dsh.bundle.patch !== "./cordis.patch.yml") bad("dsh.bundle.patch 没指对");
	if (!pj.dsh || !pj.dsh.client || pj.dsh.client.platform !== "web") bad("dsh.client.platform 应为 web");
	if (!Array.isArray(pj.dsh?.client?.inject) || pj.dsh.client.inject.length === 0) bad("dsh.client.inject 应是非空数组");
	else if (!pj.dsh.client.inject.every((s) => typeof s === "string")) bad("dsh.client.inject 只该是字符串");

	// ── ★ 「装得上」的判据（2026-10-09 实测缺陷换来的）──────────────────
	//   bundle 进 `dsh.profile.bundles` 只是"把包放进名册"；**真正挂载插件的是 bundle patch 里
	//   插的那一行**。本包曾经只带预设行、没有挂载行 ⇒ 同事在桌面版装上、重启，侧边栏什么都没有。
	//   官方模板与社区 bundle（dsh-plugin / skill-explorer）的 patch 里都 insert 自己 —— 这条就是判据。
	const patchPath = path.join(pkg, "cordis.patch.yml");
	if (!fs.existsSync(patchPath)) bad("包里没有 cordis.patch.yml（bundle patch 没打进去）");
	else {
		const text = fs.readFileSync(patchPath, "utf8");
		const escaped = pj.name.replace(/[/.@]/g, "\\$&");
		if (!new RegExp("name:\\s*['\"]" + escaped + "['\"]").test(text)) {
			bad("bundle patch 里没有挂载自己那一行（name: '" + pj.name + "'）—— 装了也不会出现在侧边栏");
		} else if (!/- insert:/.test(text)) {
			bad("bundle patch 里没有 `- insert:` 段");
		} else {
			ok("★ bundle patch 自带挂载行（装上就能挂上，不靠 profile 手写）");
		}
		if (!text.includes("preset-sr-workbench")) bad("bundle patch 里没有「策划模式」预设行");
	}
	// exports 指的文件都得真在包里
	const exp = pj.exports || {};
	for (const [key, target] of [["." + "", exp["."] && exp["."].default], ["./client", exp["./client"] && exp["./client"].default]]) {
		if (typeof target !== "string") { bad("exports 缺 " + key); continue; }
		if (!files.includes(target.replace(/^\.\//, ""))) bad("exports " + key + " 指向包内不存在的文件", target);
	}

	// ── ②③ 对包里的 client.js 跑两道冒烟 ───────────────────────────────
	const run = (script, target, label) => {
		const r = spawnSync(process.execPath, [path.join(HERE, script), target], { encoding: "utf8" });
		if (r.status === 0) ok(label);
		else bad(label, String(r.stdout || "").slice(-200) + String(r.stderr || "").slice(-400));
	};
	run("smoke-client.mjs", path.join(pkg, "lib", "client.js"), "② 包里的 lib/client.js 过加载冒烟（假 ModuleLoader 真跑 apply + slot）");
	run("render-smoke.mjs", path.join(pkg, "lib", "client.js"), "③ 包里的 lib/client.js 过渲染冒烟（迷你 React 逐遍跑组件树）");

	// ── ④ 宿主半侧自足 + patch 结构 ────────────────────────────────────
	const host = await import("file:///" + path.join(pkg, "lib", "index.js").replace(/\\/g, "/"));
	if (typeof host.apply !== "function" || !Array.isArray(host.inject)) bad("lib/index.js 没导出 apply/inject");
	const registered = [];
	try {
		host.apply({ skills: { register: (s) => registered.push(s) }, logger: { info() {}, warn() {}, error() {} } }, {});
		if (registered.length !== 10) bad("宿主半侧应注册 10 条 sr 技能", String(registered.length));
		else {
			const bytes = registered.reduce((a, s) => a + Buffer.byteLength(s.content, "utf8"), 0);
			ok("④ 宿主半侧自足：独立 import 后注册 " + registered.length + " 条（模型可见 " +
				registered.filter((s) => s.invocation.modelInvocable).length + " 条 · 正文 " + (bytes / 1024).toFixed(1) + " KB · source=" + registered[0].source + "）");
		}
	} catch (e) {
		bad("跑 apply 抛错", String((e && e.message) || e));
	}
	const patchText = fs.readFileSync(path.join(pkg, "cordis.patch.yml"), "utf8");
	for (const must of ["preset-sr-workbench", "id: sr-workbench", "name: '策划模式'", "决策记录契约", "YYYY-MM-DD HH:mm:ss"]) {
		if (!patchText.includes(must)) bad("cordis.patch.yml 里缺「" + must + "」");
	}
	if (problems.length === 0) ok("   预设行与决策记录契约都在包里（id 仍是 sr-workbench —— 会话日志按它恢复）");
} finally {
	fs.rmSync(extractDir, { recursive: true, force: true });
	if (tempTgz) fs.rmSync(work, { recursive: true, force: true });
}

console.log("\n" + (problems.length
	? "✗ 安装包验收未通过：\n - " + problems.join("\n - ")
	: "✓ 安装包验收通过（内容清单 / 加载冒烟 / 渲染冒烟 / 宿主自足 + 预设）"));
process.exit(problems.length ? 1 : 0);
