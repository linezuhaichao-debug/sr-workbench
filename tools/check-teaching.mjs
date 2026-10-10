/**
 * ── 技能用法数据的判据（"快照不许漂移"口径）────────────────────────────────
 *
 * 用户点破：这是**纯静态的使用说明** ⇒ 面板不再走 HTTP，改用构建期生成的快照
 * （`src/generated/teaching.js`）。8.0.0 起快照里只有**那份 md 的整份字节**（不再有解析结果），
 * 于是判据也简化成三件事 + 一条反向钉子：
 *
 *   ① **快照 == 现读那份 md 的字节**（逐字节比）—— 谁改了 md 忘了 `npm run gen:teaching`，这里就红；
 *   ② **那份 md 里至少 2 个表格**（表格是用户点名的重点，也是弹窗最容易瞎的地方）；
 *   ③ **教学正文只有一份**：SKILL.md 里不许再有主线/速查表那些正文，只许留指向 md 的指针；
 *   ④ **不需要网址**：产物里不许再有 `teaching.json` 那条 HTTP 路由，客户端也不许为它 fetch
 *      —— 那正是用户问的"为什么要网站地址"。
 *
 * ★ 判据只认"字节"与"在不在"，不认排版好看难看 —— 排版由 `tools/render-smoke.mjs` 在**假 React 里
 *   真渲染一遍**来盯（表格要真出 `<table>`、标题要真出标题、加粗要真出 `<strong>`）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { mdTableCount } from "../src/pure/mdview.ts";
import { TEACHING_REL, readTeachingMd, snapshotOf } from "./gen-teaching.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT = path.join(REPO, "src", "generated", "teaching.js");
const SKILL = path.join(REPO, "skills", "sr-askme", "SKILL.md");
const CLIENT = path.join(REPO, "lib", "client.js");
const HOST = path.join(REPO, "lib", "index.js");

/** SKILL.md 里**不该再有**的教学正文标志（有任何一个 ⇒ 正文被复制成了两份）。 */
const BODY_MARKERS = ["**主线**：五个步骤", "1. **头脑风暴（四个入口）**", "| skill | 干什么 | 关键产出 |"];

const problems = [];
const ok = (m) => console.log("  ✓ " + m);

// ① 快照存在、且与那份 md **逐字节**一致
let snap = null;
if (!fs.existsSync(SNAPSHOT)) {
	problems.push("没有快照 " + path.relative(REPO, SNAPSHOT) + "（跑 npm run gen:teaching）");
} else {
	snap = (await import("file:///" + SNAPSHOT.replace(/\\/g, "/"))).TEACHING;
	const fresh = snapshotOf();
	if (!snap || typeof snap.markdown !== "string") {
		problems.push("快照里没有 markdown 字段（形状应当是 { markdown, source }）");
	} else if (snap.markdown !== fresh.markdown) {
		problems.push("快照与 " + TEACHING_REL + " 的字节不一致 —— 改了技能就要跑 npm run gen:teaching（否则弹窗显示旧内容）");
	} else {
		ok("快照 == 包内 " + TEACHING_REL + " 的整份字节（" + Buffer.byteLength(fresh.markdown, "utf8") + " 字节，没漂移）");
	}
	if (snap && snap.source !== TEACHING_REL) problems.push("快照的 source 应当是 " + TEACHING_REL + "，实际 " + JSON.stringify(snap && snap.source));
}

// ② 表格 ≥2（用渲染器同一个解析器数，免得"判据数的"和"面板画的"不是一回事）
const md = readTeachingMd();
const tables = mdTableCount(md);
if (tables < 2) problems.push("使用说明.md 里应当至少 2 个表格（表格是弹窗的重点），实际 " + tables);
else ok("使用说明.md 里有 " + tables + " 个表格");

// ③ 教学正文只有一份：SKILL.md 只留指针
if (!fs.existsSync(SKILL)) {
	problems.push("找不到 skills/sr-askme/SKILL.md");
} else {
	const skill = fs.readFileSync(SKILL, "utf8");
	const hit = BODY_MARKERS.filter((m) => skill.includes(m));
	if (hit.length) problems.push("SKILL.md 里还有教学正文（正文只许有一份，在 " + TEACHING_REL + "）：" + hit.join("、"));
	if (!skill.includes("references/使用说明.md")) problems.push("SKILL.md 里没有指向 references/使用说明.md 的指针（用户问用法时该照着它讲）");
	if (!hit.length && skill.includes("references/使用说明.md")) ok("SKILL.md 只留指针、没有教学正文");
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
console.log("✓ 通过：技能用法（快照==md 字节 / 表格齐 / 正文只有一份 / 不需要网址）");
