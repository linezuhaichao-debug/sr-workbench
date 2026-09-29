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
 *   ① 备份当前 `lib/client.js`（存到系统临时目录，**不放进 `lib/`** ——
 *      `test/seam.test.ts` 断言 `lib/` 里只有 client.js 与 index.js）
 *   ② `npm run build`
 *   ③ `npm run smoke`（加载 + apply + slot 注册形状，外加 check-no-react 判据）
 *   ④ 冒烟不过 ⇒ **立刻用备份还原 `lib/client.js`**，并以非 0 退出码结束（构建=失败，仓库保持可用态）
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
const ARTIFACT = path.join(REPO, "lib", "client.js");

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

// ── ① 备份 ────────────────────────────────────────────────────────────────
let backup = null;
if (fs.existsSync(ARTIFACT)) {
	backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "srwb-build-")), "client.js.prev");
	fs.copyFileSync(ARTIFACT, backup);
	const st = fs.statSync(ARTIFACT);
	log(`已备份构建前的 lib/client.js（${st.size} 字节）→ ${backup}`);
} else {
	log("lib/client.js 不存在（首次构建）—— 没有可还原的备份，smoke 失败时回退到 git HEAD");
}

// ── ② 构建 ────────────────────────────────────────────────────────────────
if (run("build") !== 0) die("npm run build 失败（lib/ 未被替换，安全）");
if (!fs.existsSync(ARTIFACT)) die("npm run build 退出码 0，但 lib/client.js 没生成");

// ── ③ 两道产物判据 ────────────────────────────────────────────────────────
const smokeOk = run("smoke") === 0;
const reactOk = run("check:react") === 0;

// ── ④ 不过就还原 ──────────────────────────────────────────────────────────
if (!smokeOk || !reactOk) {
	const which = [!smokeOk ? "smoke" : null, !reactOk ? "check:react" : null].filter(Boolean).join(" + ");
	console.error("");
	console.error("[build:safe] ✗ 产物未过判据（" + which + "）—— 正在还原 lib/client.js，绝不让坏产物留在 lib/");
	let restored = false;
	if (backup) {
		fs.copyFileSync(backup, ARTIFACT);
		restored = true;
		log("已用备份还原（" + fs.statSync(ARTIFACT).size + " 字节）");
	} else {
		const r = spawnSync("git", ["checkout", "HEAD", "--", "lib/client.js"], { cwd: REPO, stdio: "inherit", shell: true });
		restored = r.status === 0 && fs.existsSync(ARTIFACT);
		if (restored) log("已用 git HEAD 的 lib/client.js 还原");
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
	log(same ? `✓ 通过：产物与构建前逐字节相同（${now.size} 字节）` : `✓ 通过：产物 ${before} → ${now.size} 字节（内容有变化，记得 git add lib/）`);
} else {
	log(`✓ 通过：产物 ${now.size} 字节`);
}
