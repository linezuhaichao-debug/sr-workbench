/**
 * ④ 三方映射 + ⑤ 线框图替换（工单 27）—— 回归网。
 *
 * ★ 对着**真实数据**跑（`test/paths.ts` 的口径：不录制 fixture）：
 *   · 交付包的三份原文件（`manifest.json` / `02_交互回写文档.md` / `03_图例索引.html`）
 *     从 `SR_WB_UE_PKG` 指的那个归档位读（默认 `features\讨伐\source\UE交付_20260928`）；
 *   · 当前有效定稿 = `test/paths.ts` 的 `FINAL_GDD`（真实那份定稿）；
 *   · 交付包还没归档时，需要包的那一组**跳过**并说明 —— 不静默变绿。
 *
 * ★ 本票的立场（对着真数据核出来的）：
 *   · ④ 的三条边（截图 ↔ 章节 ↔ 节点）**每一格都取自包里的原文**，没有任何一条是猜的；
 *   · ⑤ 的"替换前"是**定稿里现在真有什么**：`0923` 那份 §5 已经是 7 处 `<img>`（认不出 ASCII 占位），
 *     ASCII 占位在**成稿** `联盟悬赏_20260918.md` 与上一版定稿 `0921` 里 —— 用例把这两个事实都钉住。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { FEATURE_ROOT, FINAL_GDD, PREV_FINAL_GDD, readText } from "./paths.ts";
import { buildMap, parseLegendHtml, parseManifest } from "../src/pure/ueintake.ts";
import { buildSwapInstruction, buildSwapPlan, uiImagesOf } from "../src/pure/ueswap.ts";

/** 归档位（工单 27 的固定落点）；用环境变量可指向 `%TEMP%` 下的副本 */
const PKG_DIR = process.env.SR_WB_UE_PKG || path.join(FEATURE_ROOT, "source", "UE交付_20260928");
const MANIFEST = path.join(PKG_DIR, "manifest.json");
const DOC = path.join(PKG_DIR, "02_交互回写文档.md");
const LEGEND = path.join(PKG_DIR, "03_图例索引.html");
const SHOT_DIR = path.join(PKG_DIR, "截图");
/** 包里的 13 张截图（⑤ 的图源之一；逐一列出来，数目对不上就红） */
const SHOTS = fs.existsSync(SHOT_DIR)
	? fs.readdirSync(SHOT_DIR).filter((n) => /\.png$/i.test(n)).sort().map((n) => path.join(SHOT_DIR, n))
	: [];

const hasPkg = fs.existsSync(MANIFEST) && fs.existsSync(DOC);
const skip = hasPkg ? false : "交付包还没归档到 " + PKG_DIR + "（先按工单 26 的归档指令归位，或设 SR_WB_UE_PKG）";

const manifestText = hasPkg ? readText(MANIFEST) : "";
const docText = hasPkg ? readText(DOC) : "";
const legendText = fs.existsSync(LEGEND) ? readText(LEGEND) : "";
const finalText = readText(FINAL_GDD);
/** 成稿（§5 的 ASCII 占位在它里面；交付包入口的"现状原文"读的就是这一类文件） */
const DRAFT = path.join(FEATURE_ROOT, "gdd", "联盟悬赏_20260918.md");
const draftText = fs.existsSync(DRAFT) ? readText(DRAFT) : "";

const MANIFEST_TEXT_FAKE = JSON.stringify({
	delivery: "SR_x_交互交付物_20260928_1510",
	figma_source: { file: "L_x", page_id: "0:1", page_name: "Page 1" },
	rules: { figma_rule_node: { node_id: "78:480", rule_version: "R1" }, md_version: "v1.0" },
	text_ids_count: 0,
	screenshots: []
});

// ════════════════════════════════════════════════════════════════
// 一、解析件：manifest / 图例索引 / §5 现存的图
// ════════════════════════════════════════════════════════════════

test("④ manifest：逐条截图台账（file / rule_section / source_frame / node_id）原样读出", { skip: skip }, () => {
	const m = parseManifest(manifestText);
	assert.ok(m, "真实 manifest 必须能解析");
	assert.equal(m.screenshots, 13, "真实包 13 张截图");
	assert.equal(m.shots.length, 13);
	assert.equal(m.figmaFile, "L_联盟讨伐");
	assert.equal(m.pageId, "0:1");
	assert.equal(m.pageName, "Page 1");
	assert.equal(m.ruleNode, "78:480", "Figma 规则节点（第一写入点）");
	const first = m.shots[0];
	assert.equal(first.file, "截图/01_活动界面_常规难度.png");
	assert.equal(first.section, "2.1");
	assert.equal(first.node, "59:619");
	for (const s of m.shots) {
		assert.match(s.node, /^\d+:\d+$/, "每一张都要有 Figma 节点号：" + s.file);
		assert.match(s.section, /^\d+(\.\d+)*[a-z]?$/, "每一张都要有交付物自己的节号：" + s.file);
	}
});

test("④ 图例索引：13 条 caption（标题 / 文件 / Frame 节点）原样读出", { skip: hasPkg && legendText ? false : "图例索引读不到" }, () => {
	const rows = parseLegendHtml(legendText);
	assert.equal(rows.length, 13, "图例索引里 13 张");
	assert.equal(rows[0].caption, "01 活动界面 · 常规难度");
	assert.equal(rows[0].file, "截图/01_活动界面_常规难度.png");
	assert.equal(rows[0].node, "59:619");
	// ★ 特写那种写法（`Frame 59:619（39:741/39:749）`）要能抠出**主节点**，且原样保留整串
	const crop = rows.filter((r) => r.file.indexOf("02_难度位") >= 0)[0];
	assert.ok(crop, "第 2 张（难度位与 info 特写）要在图例索引里");
	assert.equal(crop.node, "59:619");
	assert.equal(crop.frame, "59:619（39:741/39:749）", "整串要原样留着（那对特写节点是复核依据）");
	for (const r of rows) assert.match(r.node, /^\d+:\d+$/, "每一条都要有节点号：" + r.caption);
});

test("解析件：认不出来给空 / null，不猜", () => {
	assert.equal(parseManifest(""), null);
	assert.equal(parseManifest("{ 这不是 json"), null);
	assert.equal(parseManifest("[1,2]"), null);
	assert.deepEqual(parseLegendHtml("<html>没有 figcaption</html>"), []);
	const m = parseManifest(MANIFEST_TEXT_FAKE);
	assert.ok(m);
	assert.equal(m.shots.length, 0);
	assert.equal(m.ruleNode, "78:480");
});

test("⑤ §5 现存的图：只认 UI-M* 组**自己**名下的 `<img>`（别处提到不算）", () => {
	const imgs = uiImagesOf(finalText);
	assert.ok(imgs.length >= 7, "真实 0923 定稿 §5 里有 7 处 `<img>`（实测 " + imgs.length + "）");
	const ids = imgs.map((x) => x.id);
	for (const need of ["UI-M1", "UI-M2", "UI-M3", "UI-M4"]) assert.ok(ids.indexOf(need) >= 0, need + " 名下要有图");
	const m1 = imgs.filter((x) => x.id === "UI-M1");
	assert.equal(m1.length, 2, "UI-M1 有两张（常规难度 + 终极难度态）");
	assert.equal(m1[0].line, 199, "第一张 UI-M1 的图在 L199（1-based，与编辑器一致）");
	assert.equal(m1[0].src, "UI/UI-M1 联盟悬赏主面板 · 常规难度.png");
	assert.equal(m1[0].alt, "UI-M1 联盟悬赏主面板 · 常规难度");
	// 只有 §5.1–§5.4 那四个组；§5.0 界面清单 / §5.5 界面流程**不是**组的图
	for (const x of imgs) assert.match(x.no, /^5\.[1-4]$/, "不该从别的组里抠图：" + x.no + " " + x.src);
});

// ════════════════════════════════════════════════════════════════
// 二、④ 三方映射（13 张截图各自对到哪一节 / 哪一组 / 哪个节点）
// ════════════════════════════════════════════════════════════════

test("④ 三方映射：13 张逐行给出（截图 → 文档章节 → 设计节点 → 定稿 §5）", { skip: skip }, () => {
	const r = buildMap({ manifest: manifestText, legend: legendText, doc: docText, finalText: finalText, pkgDir: PKG_DIR });
	assert.equal(r.rows.length, 13, "13 张截图逐行");
	assert.equal(r.figma.ruleNode, "78:480");
	assert.equal(r.figma.file, "L_联盟讨伐");

	const byNo = (n: string) => r.rows.filter((x) => x.no === n)[0];
	// ① 章节那一格：节号来自 manifest，标题与行号来自回写文档里 `### <节号>` 那一行
	const r01 = byNo("01");
	assert.equal(r01.doc.section, "2.1");
	assert.equal(r01.doc.matched, true);
	assert.ok(r01.doc.line > 0, "要给出回写文档里的行号");
	assert.ok(r01.doc.title.length > 0);
	// ② 节点那一格：manifest 与图例索引两份对照
	assert.equal(r01.node.manifest, "59:619");
	assert.equal(r01.node.legend, "59:619");
	assert.equal(r01.node.agree, true);
	// ③ 定稿那一格：交付物认定的归属（按图引用所在**块头**推）→ §5 现状
	//   ★ 真实数据里第 1 张的块头是 `### 2.1 活动界面 · 布局总览（UI-M1，Figma 59:619）` ⇒ 归到 `§5 UI-M1`，
	//     而 §5 UI-M1 里那两张图（`UI-M1 … · 常规难度/终极难度态`）与交付的 `01_活动界面_常规难度.png`
	//     **文件名不同** ⇒ 如实报「不是同一张」，面板不判「像不像」。
	assert.deepEqual(r01.docs.map((d) => d.ref), ["§5 UI-M1"]);
	assert.ok(r01.docs[0].why.indexOf("归属依据") >= 0, "归属要给依据");
	assert.equal(r01.docs[0].has, false, "文件名不同 ⇒ 不是同一张");
	assert.equal(r01.status, "partial");
	assert.ok(r01.miss.indexOf("文件名都不同") >= 0, "缺什么要写清楚：" + r01.miss);
	assert.equal(r01.docs[0].images.length, 2, "§5 UI-M1 里现有那两张图要列出来（这是对照面）");
	for (const im of r01.docs[0].images) assert.match(im, /^UI\/UI-M1/, "现有图要是 §5 的相对路径：" + im);
	for (const row of r.rows) {
		assert.ok(row.evidence.length >= 2, "每一行至少两条逐格依据");
		assert.ok(["ok", "agree", "partial", "unmapped"].indexOf(row.status) >= 0);
	}
});

test("④ 对不上就如实说：把真实存在的三类缺口逐条钉住", { skip: skip }, () => {
	const r = buildMap({ manifest: manifestText, legend: legendText, doc: docText, finalText: finalText, pkgDir: PKG_DIR });
	const byNo = (n: string) => r.rows.filter((x) => x.no === n)[0];

	// ★ 缺口一：**交付物自己没写这一张属于哪个界面组**（`2.1a 难度位` 的块头没有 `UI-M*`）
	//   面板推不出 ⇒ 如实报，不猜（真实数据里 13 张有 9 张是这样）
	const r02 = byNo("02");
	assert.equal(r02.doc.matched, true, "章节那一格有");
	assert.equal(r02.docs.length, 0, "界面组那一格推不出");
	assert.equal(r02.status, "partial");
	assert.ok(r02.miss.indexOf("推不出") >= 0, "推不出要说出来：" + r02.miss);
	assert.ok(r02.evidence.join(" ").indexOf("都没点名 `UI-M*`") >= 0, "要写明依据（块头与条目行都没点名）");
	assert.equal(r02.node.manifest, "59:619");
	assert.equal(r02.node.legend, "59:619");
	assert.ok(r02.node.legendFrame.indexOf("39:741") >= 0, "图例索引里的特写节点要原样留着：" + r02.node.legendFrame);
	assert.equal(r02.node.frame, "活动界面（难度12+按钮/信息）", "manifest 的 source_frame 原样给出");

	// ★ 缺口二：块头点名了界面组，但 §5 里那个组的图与交付截图**文件名都不同**
	//   （真实案例：`2.1 活动界面` → §5 UI-M1 的图是状态帧 `UI-M1 … · 常规难度.png`）
	const r01 = byNo("01");
	assert.deepEqual(r01.docs.map((d) => d.ref), ["§5 UI-M1"]);
	assert.equal(r01.docs[0].has, false);
	assert.ok(r01.docs[0].images.length >= 1, "要对出 §5 里现有哪些图：" + r01.docs[0].images.join(","));

	// ★ 缺口三：第 13 张（R7 新增的 SCREEN6 `93:593`）在 §5 里**没有对应的界面组图**
	//   它的块头 `### 2.1e 难度说明弹窗（93:593）` 没点名 UI-M* ⇒ 同样如实标「推不出」
	const r13 = byNo("13");
	assert.equal(r13.doc.section, "2.1e");
	assert.equal(r13.doc.matched, true);
	assert.equal(r13.docs.length, 0);
	assert.equal(r13.status, "partial");
	assert.equal(r13.node.manifest, "93:593", "R7 新增的节点号要在");

	// 计数与摘要要把这几类摆出来
	assert.equal(r.counts.total, 13);
	assert.ok(r.counts.ok + r.counts.partial + r.counts.unmapped === 13);
	assert.ok(r.summary.indexOf("13 张截图") >= 0);
	// 三边齐全的（块头点名了 UI-M* 的那 4 张：01 / 03 / 04 / 06）
	const mapped = r.rows.filter((x) => x.docs.length > 0).map((x) => x.no).sort();
	assert.deepEqual(mapped, ["01", "03", "04", "06"], "能归到界面组的只有这 4 张（实测 " + mapped.join(",") + "）");
	assert.equal(r.counts.inFinal, 0, "这 4 张的文件名在 §5 里都对不上 ⇒ 一张也没就位（实测 0）");
});

test("④ 读不到 manifest ⇒ 不编节点号（整块降级）", () => {
	const r = buildMap({ manifest: null, legend: "", doc: "", finalText: finalText, pkgDir: "" });
	assert.equal(r.rows.length, 0);
	assert.equal(r.counts.total, 0);
	assert.ok(r.notes.join(" ").indexOf("读不到 `manifest.json`") >= 0);
});

// ════════════════════════════════════════════════════════════════
// 三、⑤ 换图计划：替换前后对照
// ════════════════════════════════════════════════════════════════

test("⑤ 真定稿（0923）：§5 的界面组已经是图 ⇒ **没有「要换的界面组 ASCII」**，4 个组与图源文件名都对不上", { skip: skip }, () => {
	const plan = buildSwapPlan({
		finalText: finalText, finalPath: FINAL_GDD, topic: "联盟悬赏",
		shots: SHOTS, uiDir: path.join(FEATURE_ROOT, "gdd", "UI"),
		present: SHOTS, draftText: finalText, stamp: "20261009"
	});
	assert.equal(plan.blocked, "", "前提齐全就不该 blocked");
	// ★ 实证：0923 的 §5 里只有 1 处 ASCII —— 是 `5.5 界面流程`（流程图，不是等真图的占位）
	assert.equal(plan.counts.ascii, 4, "定稿全文的 ```text 围栏 4 处（§3 三处循环图 + §5.5 界面流程，实测）");
	assert.equal(plan.counts.uiAscii, 0, "**界面组的** ASCII 占位 0 处 ⇒ 界面组已经全是图");
	assert.equal(plan.counts.flowAscii, 4, "那 4 处都不是界面组的（循环图 + 界面流程）");
	assert.equal(plan.counts.replace, 0, "没有要换的");
	assert.equal(plan.counts.keep, 0, "也没有「已就位」的（交付截图的文件名与 §5 里那 7 张都不同，见下）");
	assert.equal(plan.counts.unmatched, 4, "4 个界面组都报「对不上」");
	assert.ok(plan.summary.indexOf("界面组已经全是图引用") >= 0, "摘要：" + plan.summary);
	assert.ok(plan.notes.join(" ").indexOf("已经没有界面组的 ASCII 占位") >= 0, "如实标注：不假装还有东西要换");
	// 替换前后对照：before 是**现状原文 + 行号**，after 是**图 + 落点相对路径**（这一组算出了 after）
	const g1 = plan.groups.filter((g) => g.id === "UI-M1")[0];
	assert.ok(g1, "UI-M1 要在对照表里");
	assert.equal(g1.kind, "ui");
	assert.equal(g1.before.length, 2, "替换前：现在有两张图");
	assert.equal(g1.before[0].line, 199, "替换前：行号（1-based）");
	assert.equal(g1.before[0].src, "UI/UI-M1 联盟悬赏主面板 · 常规难度.png", "替换前：现状原文逐字");
	assert.equal(g1.action, "unmatched", "图源里没有这一组的图 ⇒ 如实报对不上（面板不替它挑）");
	assert.ok(g1.miss.length > 0);
	// 流程图那一档不算「要换成图的占位」
	const flow = plan.groups.filter((g) => g.no === "5.5")[0];
	assert.equal(flow.kind, "flow");
	assert.equal(flow.action, "keep", "流程图不换");
});

test("⑤ 逐组判定：keep / replace / unmatched 三档都由文件名对出来", { skip: skip }, () => {
	// ① unmatched（真数据）：图源是交付包那 13 张，与 §5 现有 7 张图**文件名都不同** ⇒ 四组都报对不上
	const real = buildSwapPlan({
		finalText: finalText, finalPath: FINAL_GDD, shots: SHOTS, present: SHOTS, draftText: finalText, stamp: "20261009"
	});
	assert.equal(real.groups.filter((g) => g.kind === "ui").length, 4);
	for (const g of real.groups.filter((x) => x.kind === "ui")) assert.equal(g.action, "unmatched", g.id + " 该报对不上");

	// ② keep：把**现状那张图自己**当图源（文件名一致） ⇒ 判 keep（幂等，不重复换）
	const same = [
		path.join(FEATURE_ROOT, "gdd", "UI", "UI-M1 联盟悬赏主面板 · 常规难度.png"),
		path.join(FEATURE_ROOT, "gdd", "UI", "UI-M1 联盟悬赏主面板 · 终极难度态.png")
	];
	const keep = buildSwapPlan({
		finalText: finalText, finalPath: FINAL_GDD, shots: same, present: same, draftText: finalText, stamp: "20261009"
	});
	const kg = keep.groups.filter((g) => g.id === "UI-M1")[0];
	assert.equal(kg.after.length, 2, "两张图都配到了同名图源");
	assert.equal(kg.action, "keep", "两张图名与现状都一致 ⇒ keep（幂等，不重复换）");
	assert.equal(keep.counts.keep, 1);

	// ③ replace：图源里是"这一组的新版图"（文件名带 `UI-M1`，与现状不同名）⇒ 算出 after
	const other = path.join("C:\\tmp\\交付_另一套", "UI-M1 主面板（新版）.png");
	const rep = buildSwapPlan({
		finalText: finalText, finalPath: FINAL_GDD, shots: [other], present: [other],
		uiDir: path.join(FEATURE_ROOT, "gdd", "UI"), stamp: "20261009"
	});
	const g1 = rep.groups.filter((g) => g.id === "UI-M1")[0];
	assert.equal(g1.action, "replace", "文件名带 `UI-M1` ⇒ 是这一组的新版图，判 replace");
	assert.equal(g1.after[0].file, "UI-M1 主面板（新版）.png");
	assert.ok(g1.after[0].rel.indexOf("\\gdd\\UI\\UI-M1 主面板（新版）.png") > 0, "落点要在功能目录内的 gdd\\UI：" + g1.after[0].rel);

	// ④ unmatched：图源里**没有**能顶上的那一组 ⇒ 如实报，不挑一张
	const only = path.join("C:\\tmp\\交付_另一套", "UI-M2 排行榜（新版）.png");
	const un = buildSwapPlan({
		finalText: finalText, finalPath: FINAL_GDD, shots: [only], present: [only], draftText: finalText, stamp: "20261009"
	});
	const gm1 = un.groups.filter((g) => g.id === "UI-M1")[0];
	assert.equal(gm1.action, "unmatched");
	assert.ok(gm1.miss.indexOf("没有") >= 0, "对不上要说清缺什么：" + gm1.miss);
	assert.ok(un.notes.join(" ").indexOf("对不上") >= 0);
});

test("⑤ 成稿侧的 ASCII 占位：认得出、按组对上（真数据：0918 成稿 §5 里 4 处）", { skip: draftText ? false : "成稿读不到" }, () => {
	const plan = buildSwapPlan({
		finalText: finalText, finalPath: FINAL_GDD, topic: "联盟悬赏",
		shots: SHOTS, uiDir: path.join(FEATURE_ROOT, "gdd", "UI"),
		present: SHOTS, draftText: draftText, stamp: "20261009"
	});
	assert.equal(plan.counts.ascii, 4, "counts 报的是**定稿**全文的 4 处围栏（现状口径，不受成稿影响）");
	assert.equal(plan.counts.uiAscii, 0, "定稿的界面组已经全是图 ⇒ uiAscii = 0（**不拿成稿的处数说定稿的现状**）");
	assert.equal(plan.blocks.length, 4, "`blocks`（**成稿**的现状原文）里 4 处 ASCII 占位（实证）");
	assert.equal(plan.blocks.filter((b) => b.id).length, 3, "其中 3 处是界面组（5.1 / 5.2 / 5.3）—— 这才是线框图要换的那些");
	const nos = plan.blocks.map((b) => b.no + " " + b.id).sort();
	assert.deepEqual(nos, ["5.1 UI-M1", "5.2 UI-M2", "5.3 UI-M3", "5.4 "].sort(), "4 处分别是哪几组");
	assert.equal(plan.blocks[0].line, 193, "第一处的行号（组头那一行）");
	assert.ok(plan.blocks[0].lines > 5, "要如实量出「这一处占位画了多少行」");
});

test("⑤ 上一版定稿（0921）的 §5 还是 ASCII —— 那才是「要换成图」的形态", { skip: fs.existsSync(PREV_FINAL_GDD) ? false : "上一版定稿不在位" }, () => {
	const prev = readText(PREV_FINAL_GDD);
	assert.equal(uiImagesOf(prev).length, 0, "0921 那一版 §5 里**还没有**图（是 ASCII）");
	const plan = buildSwapPlan({
		finalText: prev, finalPath: PREV_FINAL_GDD, topic: "联盟悬赏",
		shots: SHOTS, uiDir: path.join(FEATURE_ROOT, "gdd", "UI"),
		present: SHOTS, draftText: prev, stamp: "20261009"
	});
	// ★ 0921 §5 里的 ASCII 围栏：5.1 / 5.2 / 5.3 / 5.4 四处界面骨架 + 5.5 界面流程 = 5 处
	assert.equal(plan.counts.ascii, 11, "0921 那一版全文 11 处 ```text 围栏（§3 三处 + §5 八处，实测）");
	assert.equal(plan.counts.uiAscii, 4, "其中 4 个界面组名下有 ASCII 骨架（5.1 / 5.2 / 5.3 / 5.4 —— 5.3 那一段画了 4 个围栏，按组只算一处）");
	// 图源是交付包那 13 张：`UI-M1` 这种组号在交付截图的文件名里不存在 ⇒ 4 个组都还得你指图
	const ui = plan.groups.filter((g) => g.kind === "ui");
	assert.equal(ui.length, 4);
	for (const g of ui) {
		assert.equal(g.before.length, 0, g.id + "：替换前**没有图**（是 ASCII）");
		assert.ok(g.action === "unmatched" || g.action === "replace", g.id + " 要给出处置：" + g.action);
	}
});

// ════════════════════════════════════════════════════════════════
// 四、⑤ 替换指令：备份 / 落点 / 贴回 / 回滚 / 结构复核
// ════════════════════════════════════════════════════════════════

test("⑤ 替换指令：先备份 + 落点（功能目录内）+ 改完贴回 + 回滚口径 + 结构复核（一条都不能少）", { skip: skip }, () => {
	const plan = buildSwapPlan({
		finalText: finalText, finalPath: FINAL_GDD, topic: "联盟悬赏",
		shots: SHOTS, uiDir: path.join(FEATURE_ROOT, "gdd", "UI"),
		present: SHOTS, draftText: draftText, stamp: "20261009"
	});
	const built = buildSwapInstruction(plan);
	assert.equal(built.blocked, "");
	const t = built.instruction;
	// ① 目标 = 当前有效定稿（改真定稿，不是成稿）
	assert.ok(t.indexOf("【工单 27 · ⑤ 线框图替换】") === 0);
	assert.ok(t.indexOf(FINAL_GDD) >= 0, "要写清目标定稿的绝对路径");
	// ② 先备份（逐字的备份路径 + "第一步就做"）
	assert.ok(t.indexOf("先备份原定稿") >= 0, "必须有「先备份」这一条");
	assert.ok(t.indexOf(plan.backup.path) >= 0, "备份路径要逐字给出：" + plan.backup.path);
	assert.ok(plan.backup.path.indexOf(".bak-工单27-20261009") > 0, "备份落点形状：同目录 + 同扩展名");
	assert.ok(t.indexOf("别只留 diff") >= 0);
	// ③ 现状原文（替换前）+ 要换成什么（替换后）
	assert.ok(t.indexOf("现状原文（**替换前**") >= 0);
	assert.ok(t.indexOf("要换成什么（**替换后**") >= 0);
	assert.ok(t.indexOf("UI-M1 联盟悬赏主面板 · 常规难度.png") >= 0, "现状原文要逐字带上现在那一张");
	// ④ 图落到功能目录内
	assert.ok(t.indexOf("\\gdd\\UI") >= 0, "落点要在功能目录内的 gdd\\UI");
	assert.ok(t.indexOf("图跟着定稿走") >= 0);
	// ⑤ 只改 §5、不许动编号
	assert.ok(t.indexOf("只改 §5") >= 0);
	assert.ok(t.indexOf("不许顺手改编号") >= 0);
	// ⑥ 改完把改动贴回来
	assert.ok(t.indexOf("改完把改动贴回来") >= 0);
	assert.ok(t.indexOf("原行号") >= 0 && t.indexOf("新行号") >= 0);
	// ⑦ 结构复核
	assert.ok(t.indexOf("结构复核") >= 0);
	assert.ok(t.indexOf("界面组数") >= 0);
	// ⑧ 回滚口径
	assert.ok(t.indexOf("回滚口径") >= 0);
	assert.ok(t.indexOf("覆盖") >= 0 && t.indexOf("status: active") >= 0);
	// ⑨ 面板不写盘
	assert.ok(t.indexOf("面板**不写盘**") >= 0);
});

test("⑤ 缺前提不静默：没定稿 / 没图源 ⇒ blocked + next，且**不发指令**", () => {
	const noFinal = buildSwapInstruction(buildSwapPlan({ finalText: "", finalPath: "", shots: [], stamp: "20261009" }));
	assert.ok(noFinal.blocked.length > 0);
	assert.equal(noFinal.instruction, "");
	assert.ok(noFinal.next.length > 0);

	const noSrc = buildSwapPlan({ finalText: finalText, finalPath: FINAL_GDD, shots: [], manual: [], stamp: "20261009" });
	assert.ok(noSrc.blocked.indexOf("图源") >= 0, "没有图源要说清缺的是图源：" + noSrc.blocked);
	assert.equal(buildSwapInstruction(noSrc).instruction, "");
});

test("⑤ 手动入口与交付包入口**共用同一张图源表**（同一支组装吃两种输入）", () => {
	const manualPath = "D:\\某处\\我手挑的图\\UI-M1 主面板.png";
	const a = buildSwapPlan({ finalText: finalText, finalPath: FINAL_GDD, shots: [], manual: [manualPath], present: [manualPath], stamp: "20261009" });
	assert.equal(a.counts.sources, 1);
	assert.equal(a.sources[0].note, "手动提交");
	const b = buildSwapPlan({ finalText: finalText, finalPath: FINAL_GDD, shots: [manualPath], manual: [], present: [manualPath], stamp: "20261009" });
	assert.equal(b.counts.sources, 1);
	assert.equal(b.sources[0].note, "交付包的 `截图\\`");
	// 同一条路径**两边都给**时只算一份（不重复换）
	const c = buildSwapPlan({ finalText: finalText, finalPath: FINAL_GDD, shots: [manualPath], manual: [manualPath], present: [manualPath], stamp: "20261009" });
	assert.equal(c.counts.sources, 1);
	assert.equal(c.groups.filter((g) => g.id === "UI-M1")[0].action, a.groups.filter((g) => g.id === "UI-M1")[0].action);
});

test("⑤ 图源在盘上找不到 ⇒ 如实报（不拿不存在的图去换）", () => {
	const ghost = "D:\\根本不存在的目录\\UI-M1 幽灵图.png";
	const p = buildSwapPlan({
		finalText: finalText, finalPath: FINAL_GDD, shots: [ghost],
		present: ["D:\\真的\\别的图.png"], stamp: "20261009"
	});
	assert.equal(p.sources[0].exists, false);
	assert.equal(p.counts.missingSources, 1);
	assert.ok(p.blocked.indexOf("找不到") >= 0, "全部缺失 ⇒ blocked：" + p.blocked);
	assert.ok(p.summary.indexOf("盘上找不到") >= 0);
});
