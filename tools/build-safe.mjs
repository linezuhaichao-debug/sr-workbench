/**
 * **安全的构建门** —— `lib/client.js` 会被用户**正在跑的** DSH 实例直接服务
 * （profile 里是 junction，`dsh-client-hmr` 每 500ms 轮询 mtime/size），
 * 所以"构建成功"不等于"可以留在仓库里"：**必须冒烟通过**才算。
 *
 * 这条规矩是一次真事故换来的（2026-09-29）：
 *   中途 rebuild 出的产物在真机上抛 `ReferenceError: async is not defined`，
 *   而 `lib/client.js` 是活文件 ⇒ 用户面板当场坏掉；而且**关了终端也还在坏**，
 *   因为坏产物已经躺进了 `lib/`。当时靠 `git checkout HEAD -- lib/client.js` 手工止血。
 *
 * 本脚本把止血动作自动化：
  *   ⓪ **技能快照漂移门**（工单 05）：`lib/index.js` 里内联着 11 个 sr 技能的正文，
 *      那是 `src/generated/skills.ts`（入库产物）的副本；**先**比对它与磁盘 `.agents\skills` 是否一致，
 *      不一致就立刻停（此步不写 lib/，所以最安全）。源目录不存在时跳过（分发场景）。
 *   ① 备份当前 `lib/client.js` 与 `lib/index.js`（存到系统临时目录，**不放进 `lib/`** ——
 *      `test/seam.test.ts` 断言 `lib/` 里只有 client.js 与 index.js）
 *   ② `npm run build`
 *   ③ 四道判据：`npm run smoke`（加载 + apply + slot 注册形状）、
 *      `npm run smoke:render`（★ v5：在迷你 React 里把组件树真跑一遍 —— smoke 的 React 是桩，不渲染）、
  *      `npm run check:react`、`npm run check:host-skills`（产物里真的注册了 11 条 sr 技能 —— 工单 05）
 *   ④ 任何一道不过 ⇒ **立刻用备份还原 `lib/`**，并以非 0 退出码结束（构建=失败，仓库保持可用态）
 *
 * 跑法：
 *   npm run build:safe      # 只做构建这一关
 *   npm run verify          # test → lint → build:safe（交付前该跑的那一条）
 *
 * ★ 它**不**做的事：不提交、不碰 git 索引；产物内容变了会如实打印字节数差异。
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(import.meta.dirname, "..");
/** 两个**入库产物**都要护住：client.js 被真机直服，index.js 里内联着随包技能正文（工单 05）。 */
const ARTIFACTS = ["client.js", "index.js"].map((n) => path.join(REPO, "lib", n));
const ARTIFACT = ARTIFACTS[0];

const log = (s) => console.log("[build:safe] " + s);
const die = (s) => {
	console.error("[build:safe] ✗ " + s);
	process.exit(1);
};

/** 跑一条 npm 脚本；返回退出码（输出直接透传给终端，不捕获 —— 便于人看原始输出）。 */
function run(script) {
	log("→ npm run " + script);
	const r = spawnSync("npm", ["run", script], { cwd: REPO, stdio: "inherit", shell: true });
	return r.status === null ? 1 : r.status;
}

// ── ⓪ 技能快照漂移门（早于 build：这一步只读，发现漂移时 lib/ 一个字节都没动）──────

// ── ① 备份（client.js + index.js 都备；任何一个判据不过就把 lib/ 还原成构建前的样子）──
let backupDir = null;
let backup = null;
const existing = ARTIFACTS.filter((p) => fs.existsSync(p));
if (existing.length > 0) {
	backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "srwb-build-"));
	backup = path.join(backupDir, "client.js.prev");
	for (const p of existing) fs.copyFileSync(p, path.join(backupDir, path.basename(p) + ".prev"));
	log(`已备份构建前的 ${existing.map((p) => "lib/" + path.basename(p) + "(" + fs.statSync(p).size + "B)").join(" + ")} → ${backupDir}`);
} else {
	log("lib/ 下没有产物（首次构建）—— 没有可还原的备份，判据失败时回退到 git HEAD");
}

// ── ② 构建 ────────────────────────────────────────────────────────────────
if (run("build") !== 0) die("npm run build 失败（lib/ 未被替换，安全）");
for (const p of ARTIFACTS) if (!fs.existsSync(p)) die("npm run build 退出码 0，但 lib/" + path.basename(p) + " 没生成");

// ── ③ 四道产物判据 ────────────────────────────────────────────────────────
const smokeOk = run("smoke") === 0;
// ★ v5 新增：**渲染冒烟** —— 在迷你 React 里把组件树真跑一遍（smoke 的 React 是桩，不渲染）。
//   它补的正是"渲染期崩成一片红/一片白"那一格（见 tools/render-smoke.mjs 的文件头）。
const renderOk = run("smoke:render") === 0;
const reactOk = run("check:react") === 0;
// ⓪ 的漂移门管"入库快照 vs 磁盘"，这里管"产物里到底有没有那份快照"（构建后才有意义）
const hostOk = run("check:host-skills") === 0;
const bundledOk = run("check:bundled-skills") === 0;   // 包内技能齐全（正文 + 兄弟资源同源同包）
// ★ 技能用法数据（面板弹窗读的那一页）：路由注册得住、内容齐、出处可查、没有 webServer 也不炸
const teachingOk = run("check:teaching") === 0;

// ── ④ 不过就还原 ──────────────────────────────────────────────────────────
if (!smokeOk || !renderOk || !reactOk || !hostOk || !bundledOk || !teachingOk) {
	const which = [
		!smokeOk ? "smoke" : null,
		!renderOk ? "smoke:render" : null,
		!reactOk ? "check:react" : null,
		!hostOk ? "check:host-skills" : null,
	!bundledOk ? "check:bundled-skills" : null,
	!teachingOk ? "check:teaching" : null
	].filter(Boolean).join(" + ");
	console.error("");
	console.error("[build:safe] ✗ 产物未过判据（" + which + "）—— 正在还原 lib/ 下的产物，绝不让坏产物留在 lib/");
	let restored = true;
	if (backupDir) {
		for (const name of ["client.js", "index.js"]) {
			const prev = path.join(backupDir, name + ".prev");
			if (fs.existsSync(prev)) fs.copyFileSync(prev, path.join(REPO, "lib", name));
		}
		log("已用备份还原：" + ["client.js", "index.js"].map((n) => "lib/" + n + "(" + fs.statSync(path.join(REPO, "lib", n)).size + "B)").join(" + "));
	} else {
		const r = spawnSync("git", ["checkout", "HEAD", "--", "lib"], { cwd: REPO, stdio: "inherit", shell: true });
		restored = r.status === 0;
		if (restored) log("已用 git HEAD 的 lib/ 还原");
	}
	if (!restored) {
		console.error("[build:safe] !! 还原失败：请立刻手工处理 lib/client.js（真机在服务它）");
	}
	die("构建门未通过（源码改动仍在工作树里，未提交、未生效）");
}

// ── 成功：如实报产物差异 ──────────────────────────────────────────────────
const now = fs.statSync(ARTIFACT);
if (backup) {
	const same = Buffer.compare(fs.readFileSync(backup), fs.readFileSync(ARTIFACT)) === 0;
	const before = fs.statSync(backup).size;
	log(same ? `✓ 通过：lib/client.js 与构建前逐字节相同（${now.size} 字节）` : `✓ 通过：lib/client.js ${before} → ${now.size} 字节（内容有变化，记得 git add lib/）`);
	const indexNow = fs.statSync(path.join(REPO, "lib", "index.js"));
	const indexPrev = path.join(backupDir, "index.js.prev");
	const indexSame = fs.existsSync(indexPrev) && Buffer.compare(fs.readFileSync(indexPrev), fs.readFileSync(path.join(REPO, "lib", "index.js"))) === 0;
	log(indexSame ? `✓ 通过：lib/index.js 与构建前逐字节相同（${indexNow.size} 字节）` : `✓ 通过：lib/index.js ${fs.existsSync(indexPrev) ? fs.statSync(indexPrev).size + " → " : ""}${indexNow.size} 字节（内容有变化，记得 git add lib/）`);
} else {
	log(`✓ 通过：产物 ${now.size} 字节`);
}
