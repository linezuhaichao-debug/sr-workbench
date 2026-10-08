/**
 * 外部输入合入 ①②③（工单 26）—— 回归网。
 *
 * ★ 对着**真实数据**跑（`test/paths.ts` 的口径：不录制 fixture）：
 *   · 交付包的两份原文件（`manifest.json` / `02_交互回写文档.md`）从 `SR_WB_UE_PKG` 指的那个
 *     归档位读（默认 `features\讨伐\source\UE交付_20260928`）；
 *   · 当前有效定稿 = `test/paths.ts` 的 `FINAL_GDD`（真实那份 488 行的定稿）。
 *   交付包还没归档（`SR_WB_UE_PKG` 不存在）时，**这一组用例跳过**并在日志里说明 —— 不静默变绿。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { FINAL_GDD, FEATURE_ROOT, FEATURE_TOPIC } from "./paths.ts";
import {
	archiveDirNameOf, archivePlan, asciiOfDraft, baselineState, buildArchiveInstruction,
	buildWireframeRequest, declaredBaselineOf, finalIndexOf, identify, parseManifest,
	revertWarning, ueIntakeRows, writebackRows
} from "../src/pure/ueintake.ts";

/** 归档位（本票的固定落点）；用环境变量可指向 `%TEMP%` 下的副本 */
const PKG_DIR = process.env.SR_WB_UE_PKG || path.join(FEATURE_ROOT, "source", "UE交付_20260928");
const ZIP_NAME = "SR_联盟讨伐_交互交付物_20260928_1510(1).zip";
const MANIFEST = path.join(PKG_DIR, "manifest.json");
const DOC = path.join(PKG_DIR, "02_交互回写文档.md");

const hasPkg = fs.existsSync(MANIFEST) && fs.existsSync(DOC);
const skip = hasPkg ? false : "交付包还没归档到 " + PKG_DIR + "（先按工单 26 的归档指令归位，或设 SR_WB_UE_PKG）";

const manifestText = hasPkg ? fs.readFileSync(MANIFEST, "utf8") : "";
const docText = hasPkg ? fs.readFileSync(DOC, "utf8") : "";
const finalText = fs.readFileSync(FINAL_GDD, "utf8");

/** 包内条目（真实包的那 19 条；面板解开后由列举给，这里逐字照抄用于回归） */
const ENTRIES = [
	"SR_联盟讨伐_交互交付物_20260928_1510/",
	"SR_联盟讨伐_交互交付物_20260928_1510/01_宣讲会交付.html",
	"SR_联盟讨伐_交互交付物_20260928_1510/02_交互回写文档.md",
	"SR_联盟讨伐_交互交付物_20260928_1510/03_图例索引.html",
	"SR_联盟讨伐_交互交付物_20260928_1510/manifest.json",
	"SR_联盟讨伐_交互交付物_20260928_1510/截图/01_活动界面_常规难度.png",
	"SR_联盟讨伐_交互交付物_20260928_1510/截图/13_难度说明弹窗.png"
];

/** 看板给的功能清单（真机三条，身份来自 feature.json） */
const FEATURES = [
	{ topic: "讨伐", name: "联盟讨伐", aliases: ["联盟悬赏", "讨伐"] },
	{ topic: "诸神降临", name: "诸神降临", aliases: ["神话宝库"] },
	{ topic: "英雄圣物", name: "英雄圣物", aliases: [] }
];

// ════════════════════════════════════════════════════════════════
// ① 包识别
// ════════════════════════════════════════════════════════════════

test("① 包识别：名称形状 + 包内结构 + manifest + 别名匹配，逐条给依据", { skip: skip }, () => {
	const r = identify({ zipFile: ZIP_NAME, entries: ENTRIES, manifest: manifestText, features: FEATURES });
	assert.equal(r.isDelivery, true, "真实交付包必须被认成 UE 交互交付包");
	assert.equal(r.topic, "联盟讨伐");
	assert.equal(r.date, "20260928");
	assert.equal(r.time, "1510");
	assert.equal(r.dupMark, "1", "`(1)` 是浏览器重复下载，要能认出来");
	assert.equal(r.canonical, "SR_联盟讨伐_交互交付物_20260928_1510.zip");
	assert.equal(r.feature.topic, "讨伐", "别名 `联盟悬赏` 命中 feat-001");
	const ids = r.evidence.map((e) => e.id);
	for (const need of ["name", "structure", "manifest", "feature"]) {
		assert.ok(ids.indexOf(need) >= 0, "依据缺了 " + need);
	}
});

test("① 包识别：不是交付包的 zip 不硬猜（依据不足就给下一步）", () => {
	const r = identify({ zipFile: "素材.zip", entries: [], manifest: null, features: FEATURES });
	assert.equal(r.isDelivery, false);
	assert.equal(r.feature.topic, "");
	assert.ok(r.need.length > 0, "要给出下一步");
});

test("① 包识别：撞名不静默挑一个", () => {
	const r = identify({
		zipFile: "SR_悬赏_交互交付物_20260928_1510.zip", entries: ENTRIES, manifest: manifestText,
		features: [
			{ topic: "A", name: "悬赏", aliases: [] },
			{ topic: "B", name: "B", aliases: ["悬赏"] }
		]
	});
	assert.equal(r.feature.topic, "");
	assert.equal(r.feature.candidates.length, 2);
	assert.ok(/不替你挑/.test(r.feature.need));
});

// ════════════════════════════════════════════════════════════════
// ② 基线校验（★）
// ════════════════════════════════════════════════════════════════

test("② 基线：从回写文档读出声明（`策划案基线：正式AI读版_联盟悬赏_v1.0（2026-09-23）`）", { skip: skip }, () => {
	const d = declaredBaselineOf(docText, "02_交互回写文档.md");
	assert.ok(d, "真实回写文档里有这一行");
	assert.equal(d.doc, "正式AI读版_联盟悬赏_v1.0");
	assert.equal(d.date, "20260923");
	assert.equal(d.line, 5, "实测在第 5 行");
	assert.equal(d.from, "02_交互回写文档.md");
});

test("② 基线：v1.0 声明 vs 台账里已发布的 v1.1 ⇒ **过期**，并把 block 写出来", { skip: skip }, () => {
	const d = declaredBaselineOf(docText, "02_交互回写文档.md");
	const r = baselineState({
		declared: d,
		final: { name: "联盟悬赏_20260923_定稿.md", path: "x", version: "1:2:3:1758600000000000000:4", from: "active", actives: ["联盟悬赏_20260923_定稿.md", "联盟悬赏_20260921_定稿.md"] },
		published: "v1.1",
		publishedAt: "2026-09-23 13:40",
		publishedNote: "WB-001（C1 §7 UE15a 改写 + **C2 §8 删除 alli_boss_ultimate_settle_hint**，键总数 44→43）",
		deliveredAt: "20260928"
	});
	assert.equal(r.state, "stale");
	assert.ok(/拦下/.test(r.block), "必须说清「拦下」的理由");
	assert.ok(/v1\.0/.test(r.text) && /v1\.1/.test(r.text));
	// 逐条依据：版本号 / 日期 / 家族 / 当前定稿 / V1 多 active
	const ids = r.evidence.map((e) => e.id);
	for (const need of ["declared", "current", "v1", "version", "date", "family"]) {
		assert.ok(ids.indexOf(need) >= 0, "依据缺了 " + need);
	}
});

test("② 基线：声明与已发布版本一致时不误报过期（声明点的是定稿的兄弟件也不算过期）", () => {
	const r = baselineState({
		declared: { text: "x", doc: "正式AI读版_联盟悬赏_v1.1", date: "20260923", line: 5, from: "02_交互回写文档.md" },
		final: { name: "联盟悬赏_20260923_定稿.md", path: "x", version: "1:2:3:1758600000000000000:4", from: "active" },
		published: "v1.1"
	});
	assert.equal(r.state, "fresh", "名字家族对不上但版本号+日期都对上 ⇒ 不许误报过期（实测踩过）");
	assert.equal(r.block, "");
});

test("② 基线：声明点名的是**另一份定稿** ⇒ 过期", () => {
	const r = baselineState({
		declared: { text: "x", doc: "联盟悬赏_20260921_定稿.md", date: "20260921", line: 5, from: "02_交互回写文档.md" },
		final: { name: "联盟悬赏_20260923_定稿.md", path: "x", version: "1:2:3:1758600000000000000:4", from: "active" },
		published: "v1.1"
	});
	assert.equal(r.state, "stale");
	assert.ok(/另一份定稿/.test(r.text));
});

test("② 基线：读不到声明 / 没有定稿 / 台账比不了 ⇒ 一律 unknown，绝不说「已是最新」", () => {
	assert.equal(baselineState({ declared: null, final: null }).state, "unknown");
	assert.equal(baselineState({ declared: { text: "x", doc: "a_v1.0", date: "", line: 1, from: "d" }, final: null }).state, "unknown");
	// 版本号比不了（台账看不到已发布版本）⇒ 只能说"对得上"，不许说"没问题"
	const noPub = baselineState({
		declared: { text: "x", doc: "a_v1.0", date: "20260923", line: 1, from: "d" },
		final: { name: "a_20260923_定稿.md", path: "x", version: "1:2:3:1758600000000000000:4", from: "active", actives: ["a_20260923_定稿.md"] }
	});
	assert.equal(noPub.state, "unknown");
	// 拿不到当前定稿的版本指纹 ⇒ 依据里要如实写"拿不到"（面板不许编"最新"）
	const noVer = baselineState({
		declared: { text: "x", doc: "a_v1.0", date: "20260923", line: 1, from: "d" },
		final: { name: "a_20260923_定稿.md", path: "x", version: "", from: "active" }, published: "v1.0"
	});
	assert.ok(noVer.evidence.some((e) => e.id === "fingerprint" && /\*\*拿不到\*\*/.test(e.value)),
		"指纹拿不到要如实标注");
});

// ════════════════════════════════════════════════════════════════
// ③ 回写清单
// ════════════════════════════════════════════════════════════════

test("③ 回写清单：逐条能定位回定稿（条目引用 + 行号）", { skip: skip }, () => {
	const idx = finalIndexOf(finalText);
	const rows = writebackRows(docText, idx, { docName: "02_交互回写文档.md" });
	// 真实回写清单：那张表 8 行。★ 交付物另有一段「不落入终稿的策划键」点了 12 个键，
	//   但**当前有效定稿里这 12 个键全都在**（实测：连 `alli_boss_remaining_count`/`clear_chest_name` 都在）
	//   ⇒ 那一段一条都不该单列成"已删"（这正是"交付物声称的"与"定稿里实际的"不一致 —— 基线问题的直接体现）。
	assert.equal(rows.length, 8, "实测 8 条表行（「不落入终稿」那 12 个键在定稿里都在，不该单列）");
	assert.ok(rows.some((r) => r.srcLine >= 163 && r.srcLine <= 170), "表行的出处行号落在 `02_交互回写文档.md` L163–L170");
	// 每条都要有出处行号
	for (const r of rows) assert.ok(r.srcLine > 0, "`" + r.target + "` 没记出处行号");
	// 逐条定位：至少这几条要点回条目引用 + 行号（行号对着真定稿）
	const all = rows.map((r) => r.lines.map((l) => l.ref + "@" + l.line).join(",")).join(" | ");
	assert.ok(/§5 UI-M1 UE5@217/.test(all), "UE5（排行榜）要定位到 §5 UI-M1 UE5 L217：" + all);
	assert.ok(/§5 UI-M3 UE17@263/.test(all), "UE17（结算伤害区）要定位到 §5 UI-M3 UE17 L263");
	assert.ok(/§5 UI-M1 UE2a@213/.test(all) && /§10 AC14@469/.test(all), "UE2a / AC14 两处都要定位到");
	// ★ 行号必须是**定义行**，不是"别的章里提到它的那一行"（实测踩过：UE14 曾被指到 §4 的 L160）
	assert.ok(/§5 UI-M2 UE14@241/.test(all), "UE14 要指到 §5 的定义行 L241（不是 §4 里那句「见 §5 UE12/UE14」的 L160）");
	for (const r of rows) for (const l of r.lines) assert.ok(l.line > 0 && l.ref.indexOf("§") === 0);
});

// ════════════════════════════════════════════════════════════════
// ★ 已删条目那条死规矩（工单 26 第 4 条）
// ════════════════════════════════════════════════════════════════

test("★ 已删文本条目：`alli_boss_ultimate_settle_hint` 在回写清单里 ⇒ 提示「这会把它改回来」", { skip: skip }, () => {
	const idx = finalIndexOf(finalText);
	// 前提：当前定稿里**没有**这个键（WB-001-C2 已删）
	assert.equal(Object.prototype.hasOwnProperty.call(idx.keys, "alli_boss_ultimate_settle_hint"), false,
		"当前有效定稿的 §7 里不该还有这个键（WB-001-C2 删掉了它）");
	const rows = writebackRows(docText, idx, { docName: "02_交互回写文档.md" });
	const hit = rows.filter((r) => r.goneKeys.indexOf("alli_boss_ultimate_settle_hint") >= 0);
	assert.ok(hit.length >= 1, "回写清单里要点出这个键");
	const danger = rows.filter((r) => r.status === "danger" && r.goneKeys.indexOf("alli_boss_ultimate_settle_hint") >= 0);
	assert.ok(danger.length >= 1, "它必须是 danger 档（要删、而定稿里已经不在）");
	assert.ok(/这会把它改回来/.test(danger[0].warn), "危险句必须逐字包含「这会把它改回来」");
});

test("★ 已删条目：合成句把「基线过期」与「已删条目」绑成一句", { skip: skip }, () => {
	const idx = finalIndexOf(finalText);
	const rows = writebackRows(docText, idx, { docName: "02_交互回写文档.md" });
	const d = declaredBaselineOf(docText, "02_交互回写文档.md");
	const base = baselineState({
		declared: d, final: { name: "联盟悬赏_20260923_定稿.md", path: "x", version: "1:2:3:1758600000000000000:4", from: "active" },
		published: "v1.1", publishedAt: "2026-09-23 13:40"
	});
	const w = revertWarning(rows, base);
	assert.ok(/这会把它改回来|改回来/.test(w), "合成句必须出现：" + w);
	assert.ok(/alli_boss_ultimate_settle_hint/.test(w));
	assert.ok(/v1\.1/.test(w), "要把基线那件事也带上");
});

test("★ 已删条目：清单里没有这类条目时不许硬报（空串）", () => {
	const idx = finalIndexOf("# t\n\n## 7. 多语言文本\n\n| 键 | 文案 | 状态 |\n| --- | --- | --- |\n| kkkk_aaa | x | 新增 |\n");
	const rows = writebackRows("## 四、策划案回写清单\n\n| 策划案条目 | 回写动作 | 依据 |\n| --- | --- | --- |\n| kkkk_aaa | 文本改「y」 | C1 |\n", idx, {});
	assert.equal(rows.filter((r) => r.status === "danger").length, 0);
	assert.equal(revertWarning(rows, null), "");
});

test("★ 已删条目：`clear_chest_*` 这种**通配族**照写在定稿里的就不许报成「已删」", { skip: skip }, () => {
	const idx = finalIndexOf(finalText);
	// 定稿里有 4 个 `alli_boss_clear_chest_*`、7 个 `alli_boss_clear_preview_*`（实测）
	assert.ok(Object.keys(idx.keys).filter((k) => k.indexOf("alli_boss_clear_chest_") === 0).length >= 2, "定稿里有 clear_chest 那一族");
	const rows = writebackRows(docText, idx, { docName: "02_交互回写文档.md" });
	const wb = rows.filter((r) => /键表/.test(r.target))[0];
	assert.ok(wb, "「§8 键表」那一行要在");
	assert.equal(wb.status, "ok", "两族都还活着 ⇒ 不许报 danger（实测踩过：会变成假报警）");
	assert.equal(wb.goneKeys.indexOf("clear_chest"), -1);
	assert.equal(wb.goneKeys.indexOf("clear_preview"), -1);
	// 但**真被删掉**的那个键（在表里写着「删除键 X」）必须报出来
	assert.ok(rows.some((r) => r.status === "danger" && r.goneKeys.indexOf("alli_boss_ultimate_settle_hint") >= 0));
});

test("③ 回写清单：认不出那张表就给空数组（不猜）", () => {
	assert.deepEqual(writebackRows("没有表的一段话", finalIndexOf(""), {}), []);
	assert.deepEqual(writebackRows("", finalIndexOf(""), {}), []);
});

// ════════════════════════════════════════════════════════════════
// 归档位
// ════════════════════════════════════════════════════════════════

test("归档位：`features\\<主题>\\source\\UE交付_<日期>\\`，未归位时给指令且**不带外层包名那一层**", () => {
	const plan = archivePlan({ root: "D:\\ws\\features\\讨伐", zipFile: ZIP_NAME, date: "20260928", present: [] });
	assert.equal(plan.name, "UE交付_20260928");
	assert.equal(plan.dir, "D:\\ws\\features\\讨伐\\source\\UE交付_20260928");
	assert.equal(plan.archived, false);
	const b = buildArchiveInstruction({ plan: plan, zipAtWs: "D:\\TimeMachine\\GameDesignOS\\workspace\\" + ZIP_NAME, entries: 19 });
	assert.equal(b.blocked, "");
	assert.ok(b.instruction.indexOf(plan.dir) >= 0);
	assert.ok(/不要带外层包名那一层/.test(b.instruction));
	assert.ok(/manifest\.json/.test(b.instruction) && /截图/.test(b.instruction));
	// 缺前提不静默
	assert.ok(buildArchiveInstruction({ plan: plan, zipAtWs: "" }).blocked.length > 0);
	assert.ok(buildArchiveInstruction({ plan: archivePlan({ root: "" }), zipAtWs: "D:\\a.zip" }).blocked.length > 0);
});

test("归档位：已经在里面了就说已经在（不再发归档指令的必要）", () => {
	const plan = archivePlan({ root: "D:\\ws\\features\\讨伐", zipFile: ZIP_NAME, date: "20260928", present: ["manifest.json", "02_交互回写文档.md"] });
	assert.equal(plan.archived, true);
	assert.equal(archiveDirNameOf("20260928"), "UE交付_20260928");
	assert.equal(archiveDirNameOf(""), "UE交付_<日期>");
});

// ════════════════════════════════════════════════════════════════
// ⑤ 的共用能力（工单 26 第 5 条）
// ════════════════════════════════════════════════════════════════

test("★ 线框图替换：两个入口共用同一处组装（`buildWireframeRequest` → `draftstep`）", () => {
	const ascii = [{ no: "5.1", id: "UI-M1", title: "主面板", line: 10, lines: 12 }];
	const manual = buildWireframeRequest({
		root: "D:\\ws\\features\\讨伐", topic: "讨伐", draftPath: "D:\\ws\\features\\讨伐\\gdd\\联盟悬赏_20260918.md",
		where: "§5 UI-M1", images: ["D:\\ws\\features\\讨伐\\gdd\\UI\\a.png"], ascii: ascii
	});
	const fromPkg = buildWireframeRequest({
		root: "D:\\ws\\features\\讨伐", topic: "讨伐", draftPath: "D:\\ws\\features\\讨伐\\gdd\\联盟悬赏_20260918.md",
		where: "§5 UI-M1",
		images: ["D:\\ws\\features\\讨伐\\source\\UE交付_20260928\\截图\\01_活动界面_常规难度.png"], ascii: ascii
	});
	// 同一处组装：结构逐句相同，只有"要换成什么（图路径）"这一处不同
	assert.equal(manual.instruction.split("\n").length, fromPkg.instruction.split("\n").length);
	assert.ok(/【文档生成 · 线框图】/.test(manual.instruction));
	assert.ok(/L10/.test(manual.instruction), "ASCII 现状原文要带行号");
	assert.ok(fromPkg.instruction.indexOf("截图\\01_活动界面_常规难度.png") >= 0, "交付包入口的图源是包里的截图");
	// 没有图 ⇒ 同一句 blocked（两个入口共用同一条缺前提判定）
	assert.ok(buildWireframeRequest({ root: "D:\\ws", topic: "x", images: [] }).blocked.length > 0);
	// 成稿全文 → ASCII 现状（不另写解析）
	const a2 = asciiOfDraft(fs.readFileSync(path.join(FEATURE_ROOT, "gdd", "联盟悬赏_20260918.md"), "utf8"));
	assert.ok(a2.length >= 1, "真实成稿 §5 里有 ASCII 占位（实测 4 处，这里至少 1）");
	assert.ok(a2.every((x) => /^5\./.test(x.no) && x.line > 0));
});

// ════════════════════════════════════════════════════════════════
// 整块视图模型（降级要如实）
// ════════════════════════════════════════════════════════════════

test("整块：读不到回写文档时 ③ 为空、② 判 unknown，且如实标注", () => {
	const r = ueIntakeRows({
		zipFile: ZIP_NAME, entries: ENTRIES, manifest: manifestText, doc: null, docName: "02_交互回写文档.md",
		finalText: finalText, final: { name: "联盟悬赏_20260923_定稿.md", path: "x", version: "1:2:3:1758600000000000000:4", from: "active" },
		features: FEATURES, root: "D:\\ws\\features\\讨伐", present: [], zipAtWs: "D:\\TimeMachine\\GameDesignOS\\workspace\\" + ZIP_NAME
	});
	assert.equal(r.rows.length, 0);
	assert.equal(r.baseline.state, "unknown");
	assert.ok(r.notes.some((n) => /读不到 `02_交互回写文档\.md`/.test(n)), "要如实说读不到");
	assert.equal(r.archive.archived, false);
});

test("整块：真实包 + 真实定稿 ⇒ ①②③ 都有结论，revertWarning 非空", { skip: skip }, () => {	const r = ueIntakeRows({
		zipFile: ZIP_NAME, entries: ENTRIES, manifest: manifestText, doc: docText, docName: "02_交互回写文档.md",
		finalText: finalText,
		final: {
			name: "联盟悬赏_20260923_定稿.md", path: path.join(FEATURE_ROOT, "gdd", "联盟悬赏_20260923_定稿.md"),
			version: "1:2:3:1758600000000000000:4", from: "active",
			actives: ["联盟悬赏_20260923_定稿.md", "联盟悬赏_20260921_定稿.md"]
		},
		features: FEATURES, root: FEATURE_ROOT,
		published: "v1.1", publishedAt: "2026-09-23 13:40",
		present: ["manifest.json", "02_交互回写文档.md", ZIP_NAME],
		zipAtWs: "D:\\TimeMachine\\GameDesignOS\\workspace\\" + ZIP_NAME,
		draftText: fs.readFileSync(path.join(FEATURE_ROOT, "gdd", "联盟悬赏_20260918.md"), "utf8"),
		draftPath: path.join(FEATURE_ROOT, "gdd", "联盟悬赏_20260918.md"),
		compact: "20261008"
	});
	assert.equal(r.identify.isDelivery, true);
	assert.equal(r.identify.feature.topic, "讨伐");
	assert.equal(r.baseline.state, "stale");
	assert.ok(r.counts.total >= 7);
	assert.ok(r.counts.danger >= 1, "真实数据里必然有已删条目");	assert.ok(r.revertWarning.length > 0);
	assert.equal(r.archive.archived, true);
	assert.ok(r.wireframe.instruction.indexOf("截图") >= 0, "⑤ 的图源是包里的截图（绝对路径落在归档位下）");
	// 那两个键名要点到（真实案例）
	assert.ok(r.rows.some((x) => x.goneKeys.indexOf("alli_boss_ultimate_settle_hint") >= 0));
});

test("manifest 解析：认不出来给 null（不猜）", { skip: skip }, () => {
	assert.equal(parseManifest(null), null);
	assert.equal(parseManifest(""), null);
	assert.equal(parseManifest("{ 不是 json"), null);
	assert.equal(parseManifest("[]"), null);
	const m = parseManifest(manifestText);
	assert.equal(m.textIds, 43);
	assert.equal(m.screenshots, 13);
	assert.equal(m.shotPaths[0], "截图/01_活动界面_常规难度.png");
	assert.equal(m.project, "SR");
	assert.equal(m.goal, "正式交付");
	assert.ok(FEATURE_TOPIC.length > 0);
});
