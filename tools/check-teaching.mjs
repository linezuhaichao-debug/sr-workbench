/**
 * ── 技能用法数据的判据（"快照不许漂移"口径）────────────────────────────────
 *
 * 用户点破：这是**纯静态的使用说明** ⇒ 面板不再走 HTTP，改用构建期生成的快照
 * （`src/generated/teaching.js`）。于是判据变成四件事：
 *
 *   ① **快照 == 现读技能文件的解析结果**（逐字段比）—— 谁改了技能忘了 `npm run gen:teaching`，这里就红；
 *   ② **内容齐**：主线 ≥4 步、速查 ≥8 行、规则 2 节、教学卡 ≥8 张、无 problems；
 *   ③ **主线提到的技能必须有出处**（速查表 / 独立技能那句 / 教学卡），否则弹窗会给出无效调用；
 *   ④ **不需要网址**：产物里不许再有 `teaching.json` 那条 HTTP 路由，客户端也不许为它 fetch
 *      —— 那正是用户问的"为什么要网站地址"。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseFromSkills } from "./gen-teaching.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT = path.join(REPO, "src", "generated", "teaching.js");
const CLIENT = path.join(REPO, "lib", "client.js");
const HOST = path.join(REPO, "lib", "index.js");

const problems = [];
const ok = (m) => console.log("  ✓ " + m);

// ① 快照存在、且与现读一致
if (!fs.existsSync(SNAPSHOT)) {
	problems.push("没有快照 " + path.relative(REPO, SNAPSHOT) + "（跑 npm run gen:teaching）");
} else {
	const fresh = parseFromSkills();
	const snap = (await import("file:///" + SNAPSHOT.replace(/\\/g, "/"))).TEACHING;
	if (JSON.stringify(fresh) !== JSON.stringify(snap)) {
		problems.push("快照与技能文件不一致 —— 改了 skills/sr-askme 就要跑 npm run gen:teaching（否则弹窗显示旧内容）");
	} else {
		ok("快照与现读技能文件逐字段一致（来源唯一，没漂移）");
	}

	// ② 内容齐
	if (!snap.ok) problems.push("快照 ok=false：" + (snap.problems || []).join("；"));
	if ((snap.steps || []).length < 4) problems.push("主线步骤应当 ≥4，实际 " + (snap.steps || []).length);
	if ((snap.routes || []).length < 8) problems.push("速查表应当 ≥8 行，实际 " + (snap.routes || []).length);
	if ((snap.rules || []).length !== 2) problems.push("规则节应当 2 个（产出落盘 + 数值铁律），实际 " + (snap.rules || []).length);
	if ((snap.cards || []).length < 8) problems.push("教学卡应当 ≥8 张，实际 " + (snap.cards || []).length);
	if ((snap.problems || []).length) problems.push("解析有问题：" + snap.problems.join("；"));
	if (problems.length === 0) {
		ok(`内容齐：主线 ${snap.steps.length} 步 · 速查 ${snap.routes.length} 行 · 规则 ${snap.rules.length} 节 · 教学卡 ${snap.cards.length} 张`);
	}

	// ③ 出处可查
	const source = (snap.routes || []).map((r) => r.skill).join(" ") + " " + (snap.standalone || "") + " " +
		(snap.cards || []).map((c) => "/" + c.id).join(" ");
	const mentioned = new Set();
	for (const s of snap.steps || []) for (const m of String(s.text).matchAll(/`(\/sr-[a-z-]+)`/g)) mentioned.add(m[1]);
	const orphan = [...mentioned].filter((x) => source.indexOf(x) < 0);
	if (orphan.length) problems.push("主线提到但没有出处的技能：" + orphan.join("、"));
	else ok("主线提到的 " + mentioned.size + " 个技能都有出处");
}

// ④ 不再需要网址
if (fs.existsSync(HOST) && fs.readFileSync(HOST, "utf8").includes("teaching.json")) {
	problems.push("宿主产物里还有 teaching.json 那条 HTTP 路由 —— 静态说明不该要网址（应当已删）");
} else ok("宿主产物里没有 teaching.json 路由（这条路不需要网络）");
if (fs.existsSync(CLIENT) && fs.readFileSync(CLIENT, "utf8").includes("sr-workbench/teaching.json")) {
	problems.push("客户端产物里还在 fetch teaching.json —— 应当直接 import 快照");
} else ok("客户端产物里没有 teaching.json 的 fetch（直接读快照）");

if (problems.length) {
	console.error("\n✗ 技能用法判据未通过：");
	for (const p of problems) console.error(" - " + p);
	process.exit(1);
}
console.log("✓ 通过：技能用法（快照与技能一致 / 内容齐 / 出处可查 / 不需要网址）");
