/**
 * 引用图与影响范围（迁移自 legacy/test-refgraph.js）。
 * 跑真实定稿：词表 / 边数 / 逐条命中位置的行号都要能被人工回查。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { parseFinalGdd } from "../src/pure/finalgdd.ts";
import { EDGE_LABELS, buildRefGraph, edgeLabelOf, fieldRowAt, impactOf, refOf } from "../src/pure/refgraph.ts";
import { scanFinalChecks } from "../src/pure/vchecks.ts";
import { FINAL_GDD, readText, requireRealData } from "./paths.ts";

requireRealData();
const text = readText(FINAL_GDD);
const doc = parseFinalGdd(text);
const graph = buildRefGraph(doc);
const srcLines = text.split(/\r?\n/);

test("真实定稿的引用图规模（词表 ≈ §7键43 + UE27 + AC15 + R10 + UI-M4）", () => {
	assert.ok(graph.vocabSize >= 90, "词表 ≥ 90，实际 " + graph.vocabSize);
	assert.ok(graph.edgeCount > 150, "边数 > 150，实际 " + graph.edgeCount);
});

test("显式引用：AC1 的定义处与两处提到它的位置（真实行号）", () => {
	const e = graph.byRef.get("§10 AC1");
	assert.ok(e, "应有 §10 AC1 这个可引用实体");
	assert.equal(e.kind, "ac");
	assert.deepEqual(
		e.hits.map((h) => h.line),
		[456, 487],
	);
	assert.ok(srcLines[456 - 1].includes("| AC1 |"), "第 456 行应是 AC1 定义行");
	assert.ok(srcLines[487 - 1].includes("AC1–AC15"), "第 487 行应是 §11 提到 AC1–AC15 的那条");
});

test("界面归属：UI-M1 的 UE 条目都可被引用，且影响范围去掉自身", () => {
	const e = graph.byRef.get("§5 UI-M1 UE1");
	assert.ok(e, "应有 §5 UI-M1 UE1");
	assert.ok(e.hits.length >= 1);
	const self = e.hits[0].line;
	assert.ok(/UE1\b/.test(srcLines[self - 1]), "第 " + self + " 行应含 UE1");
	const others = impactOf(graph, "§5 UI-M1 UE1", self);
	assert.equal(others.some((h) => h.line === self), false, "影响范围里不该有自己那一行");
});

test("编号同族边：UE2 ↔ UE2a 互为同族（kind = family）", () => {
	const e = graph.byRef.get("§5 UI-M1 UE2");
	assert.ok(e);
	const fam = e.hits.filter((h) => h.kind === "family");
	assert.ok(fam.length >= 1, "UE2 应有一条同族边指向 UE2a");
	assert.ok(fam.every((h) => /UE2a/.test(h.where)), "同族边应指向 UE2a：" + JSON.stringify(fam));
});

test("impactOf 的边界：未知引用 / 空图返回空数组", () => {
	assert.deepEqual(impactOf(graph, "§99 不存在", null), []);
	assert.deepEqual(impactOf(null, "§10 AC1", null), []);
	assert.deepEqual(buildRefGraph(null).byRef.size, 0);
	assert.equal(buildRefGraph({}).vocabSize, 0);
});

// ── 工单 14 · ⑥ 契约关联（§4「配置字段」列 ↔ §6 声明的字段行）──────────────
//   期望值逐条对齐 `14-impact-oracle.md` 的 ⑥ 与「实测校准」两节。
//   口径：与 V6 **同一份取数、不同用途** —— V6 判"引用了但没声明"（单向报问题），
//   这里两个方向都连边（改了这个组/这个字段，会牵动哪些位置），命中一律带 kind = contract。

/** 真实定稿的变异体：只动指定的那一行，其余逐字不变 */
function mutate(fn: (lines: string[]) => void): string {
	const lines = text.split(/\r?\n/);
	fn(lines);
	return lines.join("\n");
}

/** 某个条目上的契约边（按行号 + 字段 + 引用来源行） */
function contractHits(ref: string) {
	const e = graph.byRef.get(ref);
	assert.ok(e, "应有 " + ref + " 这个可引用实体");
	return (e.hits as Array<{ line: number; field?: string; via?: number; kind?: string }>)
		.filter((h) => h.kind === "contract");
}

test("⑥ 取数与 V6 同一口径：14 处引用 / 24 个声明 / 1 条整表形态 / 0 处引用未声明", () => {
	const v6 = scanFinalChecks(text).V6;
	assert.equal(graph.contract.refs, 14);
	assert.equal(graph.contract.decls, 24);
	assert.equal(graph.contract.rowRefs, 1);
	assert.equal(graph.contract.unmatched.length, 0);
	// 与 V6 的报数逐一对上（同一份取数 ⇒ 不该有偏差）
	assert.equal(graph.contract.refs, v6.refCount);
	assert.equal(graph.contract.decls, v6.declCount);
	assert.deepEqual(v6.refsWithoutDecl, [], "真实定稿上 V6 方向①是干净的 ⇒ 契约边也不该有未声明字段");
});

test("⑥ 契约关联：§4 R6 命中 §6 的 4 个字段行 L314/L342/L343/L352（via = L137–L140）", () => {
	assert.deepEqual(
		contractHits("§4 R6").map((h) => [h.line, h.field, h.via]),
		[
			[314, "alliBossChallengeReward", 137],
			[342, "clearDropId", 138],
			[343, "killDropId", 139],
			[352, "rewardDropId", 140],
		],
	);
	// 行号必须回指真实原文：命中的是 §6 的声明行、via 是 §4 R6 里写引用的那一行
	for (const h of contractHits("§4 R6")) {
		assert.ok(srcLines[h.line - 1].includes("`" + h.field + "`"), "L" + h.line + " 应是 §6 的字段声明行");
	}
	assert.ok(srcLines[136].includes("`A012-全局变量表.alliBossChallengeReward`"), "L137 应是挑战奖励那条引用");
	assert.ok(srcLines[139].includes("`A079-联盟悬赏.xlsx!联盟排行奖励表.rewardDropId`"), "L140 应是联盟排名奖励那条引用");
	// 每一条都能报出它属于哪一类边
	assert.equal(contractHits("§4 R6").every((h) => h.kind === "contract"), true);
});

test("⑥ 反向：§6 字段行能回到引用它的 §4 规则行（多处引用的都列出来）", () => {
	const clear = graph.byRef.get("§6 难度表.clearDropId");
	assert.ok(clear, "§6 的字段行要能被引用（键 = `§6 <表名>.<字段>`）");
	assert.equal(clear.kind, "field");
	assert.equal(clear.line, 342);
	assert.deepEqual(impactOf(graph, "§6 难度表.clearDropId", 342).map((h) => [h.line, h.where, h.kind]),
		[[138, "§4 R6 奖励", "contract"]]);
	// 一个字段被多处引用 ⇒ 全部列出（damageRate 在 §4 R5 里写了两遍；rewardDropId 被 R6/R8 各引一次）
	assert.deepEqual(graph.byRef.get("§6 难度表.damageRate").hits.map((h) => [h.line, h.where]),
		[[128, "§4 R5 折算计分"], [130, "§4 R5 折算计分"]]);
	assert.deepEqual(graph.byRef.get("§6 联盟排行奖励表.rewardDropId").hits.map((h) => [h.line, h.where]),
		[[140, "§4 R6 奖励"], [163, "§4 R8 联盟排名"]]);
	// §6 声明了、§4 没人引用 ⇒ 空集（如实返回，不硬凑；与 V6 方向②"不算问题"同口径）
	assert.deepEqual(graph.byRef.get("§6 BOSS表.recommendHero").hits, []);
	assert.deepEqual(impactOf(graph, "§6 联盟排行奖励表.rankIndex", 349), []);
});

test("⑥ 端到端：§5 UI-M1 UE3 →（显式引用）§4 R6 →（契约关联）§6 的 4 个字段行", () => {
	// ① UE3 提到的地方里，落在 §4 R6 里的那一处 —— 这就是"提到 UE3 的规则组"
	const route = graph.byRef.get("§5 UI-M1 UE3").hits.find((h) => h.where.indexOf("R6") >= 0);
	assert.ok(route, "UE3 应有一处命中落在 §4 R6 里");
	assert.equal(route.line, 139);
	assert.equal(route.where, "§4 R6 奖励");
	// ② 从那个规则组按契约关联走一步，拿到的正是 oracle 的 4 个字段（行号也一一对上）
	assert.deepEqual(contractHits("§4 R6").map((h) => h.field), [
		"alliBossChallengeReward", "clearDropId", "killDropId", "rewardDropId",
	]);
	assert.deepEqual(impactOf(graph, "§4 R6", 133).filter((h) => h.kind === "contract").map((h) => h.line),
		[314, 342, 343, 352]);
});

test("⑥ 覆盖的两种写法：`表.字段` 与「`表` 全行（字段列表）」（真实数据各一例）", () => {
	// 写法①：`A079-联盟悬赏.xlsx!BOSS表.rotateIndex`（§4 R2 L98 → §6.2 L323）
	assert.deepEqual(graph.byRef.get("§6 BOSS表.rotateIndex").hits.map((h) => [h.line, h.where]),
		[[98, "§4 R2 BOSS 与难度推进"]]);
	// 写法②：L99 的「全行（bossName / weakness / … / bossGid 等）」⇒ 括号里 7 个字段全连上
	assert.ok(srcLines[98].includes("` 全行（"), "L99 应是整表 + 括号列举那一形态");
	assert.deepEqual(
		contractHits("§4 R2").filter((h) => h.via === 99).map((h) => h.field),
		["bossName", "weakness", "timeLimit", "bossArt", "bg", "sence", "bossGid"],
	);
	assert.deepEqual(contractHits("§4 R2").filter((h) => h.via === 99).map((h) => h.line),
		[322, 324, 326, 327, 328, 329, 330]);
});

test("⑥ 已知不覆盖的写法（宁可少判）：中文字段名 / 行号引用 / 裸反引号字段名 / §6 三列表", () => {
	// ① 中文字段名引用：§4 R2 L102 写的是 `…!难度表.终极难度`（第 21 行）—— 不是英文字段，不连边
	assert.ok(srcLines[101].includes("难度表.终极难度"));
	assert.equal(graph.byRef.has("§6 难度表.终极难度"), false);
	assert.equal(graph.byRef.get("§4 R2").hits.some((h) => h.line === 339), false,
		"§6.3 的「终极难度」行（列名无英文字段）不该被连上");
	// ② 行号引用：§4 R6 L141 的「`…!难度表` 第 21 行（clearDropId/killDropId 为空）」不算"引用字段"
	assert.ok(srcLines[140].includes("第 21 行"));
	assert.deepEqual(graph.byRef.get("§6 难度表.clearDropId").hits.map((h) => h.line), [138]);
	assert.deepEqual(graph.byRef.get("§6 难度表.killDropId").hits.map((h) => h.line), [139]);
	// ③ 裸反引号字段名（L99 细节列里的 `weakness`）不算 §4 配置字段列的引用 —— 变异体锁住
	const bare = buildRefGraph(parseFinalGdd(mutate((lines) => {
		assert.ok(lines[137].includes("`A079-联盟悬赏.xlsx!难度表.clearDropId`"), "第 138 行应是 clearDropId 那条引用");
		lines[137] = lines[137].replace("`A079-联盟悬赏.xlsx!难度表.clearDropId`（引用 A006 掉落表）", "`clearDropId`");
	})));
	assert.deepEqual(bare.byRef.get("§6 难度表.clearDropId")!.hits, [], "裸字段名不连边");
	assert.equal(bare.contract.refs, 13, "裸字段名连引用都不算 ⇒ 引用条数 14→13");
	assert.deepEqual(bare.contract.unmatched, [], "也不该被当成「引用了没声明」");
	// ④ 「全行（…）」形态一旦不成立（没有括号列举）⇒ 那 7 个字段整批断链，也不去猜
	const noRow = buildRefGraph(parseFinalGdd(mutate((lines) => { lines[98] = lines[98].replace("` 全行（", "` 全行："); })));
	assert.equal(noRow.contract.rowRefs, 0);
	assert.deepEqual(noRow.byRef.get("§6 BOSS表.bossName")!.hits, []);
	assert.deepEqual(noRow.byRef.get("§4 R2")!.hits.filter((h) => h.kind === "contract").map((h) => h.field),
		["rotateIndex", "bossLevel", "level"], "只剩三条 `表.字段` 引用");
	// ⑤ §6.5 的三列表不是字段声明表：声明数仍是 24（终局 1 条、活动周期 1 条都不会被算成字段声明）
	assert.equal(graph.contract.decls, 24);
});

test("⑥ 同名字段出现在同一张表：不静默合并（第二个键退化成 `§6 <组号>.<字段>`），两条边都连", () => {
	// 真实定稿里没有同名字段；这里用变异体锁住退化路径（同表同名字段必须能被分辨）
	const g2 = buildRefGraph(parseFinalGdd(mutate((lines) => {
		assert.ok(lines[342].includes("`killDropId`"), "第 343 行应是 §6.3 的 killDropId 声明");
		lines.splice(343, 0, "| 重复声明 | `clearDropId` | int | 只为锁住同名字段的退化路径 | 已有 |");
	})));
	assert.equal(g2.contract.decls, 25);
	assert.deepEqual(
		g2.byRef.get("§4 R6")!.hits.filter((h) => h.kind === "contract" && h.field === "clearDropId").map((h) => [h.line, h.where]),
		[[342, "§6 难度表.clearDropId"], [344, "§6 6.3.clearDropId"]],
	);
	assert.equal(g2.byRef.has("§6 6.3.clearDropId"), true, "第二个同名字段行有自己的键，没被吞掉");
	assert.deepEqual(g2.byRef.get("§6 6.3.clearDropId")!.hits.map((h) => h.line), [138]);
});

test("⑥ 变异体：§4 引用了一个 §6 没声明的字段 ⇒ 如实进 unmatched，且只连得上的那些", () => {
	const g2 = buildRefGraph(parseFinalGdd(mutate((lines) => {
		lines[136] = lines[136].replace("`A012-全局变量表.alliBossChallengeReward`", "`A012-全局变量表.alliBossChallengeRewardX`");
	})));
	assert.deepEqual(g2.contract.unmatched, [{
		line: 137, field: "alliBossChallengeRewardX",
		ref: "A012-全局变量表.alliBossChallengeRewardX", form: "table.field",
	}]);
	assert.deepEqual(
		g2.byRef.get("§4 R6")!.hits.filter((h) => h.kind === "contract").map((h) => h.field),
		["clearDropId", "killDropId", "rewardDropId"],
	);
	assert.deepEqual(g2.byRef.get("§6 全局变量.alliBossChallengeReward")!.hits, [], "被改名的声明自己变成没人引用");
});

test("⑥ 降级与形态无关性：空图不炸、CRLF/LF 同解、没有 §4/§6 的定稿不编造契约边", () => {
	assert.deepEqual(buildRefGraph(null).contract, { refs: 0, decls: 0, rowRefs: 0, edges: 0, unmatched: [] });
	assert.deepEqual(buildRefGraph({}).contract, { refs: 0, decls: 0, rowRefs: 0, edges: 0, unmatched: [] });
	const tiny = buildRefGraph(parseFinalGdd("## 7. 多语言文本\n\n| alli_x | a | 新增 |\n"));
	assert.deepEqual(tiny.contract, { refs: 0, decls: 0, rowRefs: 0, edges: 0, unmatched: [] });

	const lf = buildRefGraph(parseFinalGdd(text.replace(/\r\n/g, "\n")));
	const crlf = buildRefGraph(parseFinalGdd(text.replace(/\r?\n/g, "\r\n")));
	assert.equal(lf.contract.edges, graph.contract.edges);
	assert.deepEqual(lf.byRef.get("§4 R6")!.hits.filter((h) => h.kind === "contract").map((h) => h.line), [314, 342, 343, 352]);
	assert.deepEqual(crlf.byRef.get("§4 R6")!.hits.filter((h) => h.kind === "contract").map((h) => h.line), [314, 342, 343, 352]);
});

test("⑥ 不破坏旧五类边：oracle「实测校准」的三个锚点逐行不变（新边只在 kind=contract 上加）", () => {
	// §5 UI-M1 UE3 → L139（§4 R6 显式引用）+ L215[family]（UE3a）
	assert.deepEqual(
		graph.byRef.get("§5 UI-M1 UE3").hits.filter((h) => h.kind !== "contract").map((h) => [h.line, h.kind || null]),
		[[139, null], [214, null], [215, "family"]],
	);
	assert.deepEqual(impactOf(graph, "§5 UI-M1 UE3", 214).map((h) => h.line), [139, 215]);
	// §5 UI-M1 UE3a → 同族边双向
	assert.deepEqual(
		graph.byRef.get("§5 UI-M1 UE3a").hits.filter((h) => h.kind !== "contract").map((h) => [h.line, h.kind || null]),
		[[215, null], [279, null], [214, "family"]],
	);
	// §5 UI-M4 → 7 处，含 L463（AC8 的验收关联）
	assert.deepEqual(graph.byRef.get("§5 UI-M4").hits.map((h) => h.line), [193, 214, 215, 268, 270, 289, 463]);
	// §4 R1 → 6 处旧边（含 L430 §8 范围门、L480 §11 交接清单）；新增的只有 1 条契约边
	assert.deepEqual(graph.byRef.get("§4 R1").hits.filter((h) => h.kind !== "contract").map((h) => h.line), [83, 110, 161, 363, 430, 480]);
	assert.deepEqual(contractHits("§4 R1").map((h) => [h.line, h.field, h.via]), [[313, "alliBossDailyAttackCount", 92]]);
	// §7 键（重复定义的那一处可见）与 §10 AC8（别处没人写 AC8 ⇒ 空集）
	assert.deepEqual(graph.byRef.get("§7 alli_boss_kill_count_label").hits.map((h) => h.line), [379, 389]);
	assert.deepEqual(impactOf(graph, "§10 AC8", 463), []);
	// 词表没被契约边改动（§6 字段行只进 byRef、不进词表 ⇒ 老条目的命中集合不受影响）
	assert.equal(graph.vocabSize, 105);
});

// ── 工单 14 接线：把六类边**叫给人听**（`edgeLabelOf`）· 条目引用的构造口径（`refOf`）──────
//   面板上每一条影响都要标明"属于哪一类边"，用户才能判断"这条算不算数"。
//   标签由结构推、**不改 hits**（旧五类边的输出仍然一字不变，见上一个用例）。

/** 某个引用在面板上会显示成什么（行号 + 标签 + 定位串），口径与定位卡一致 */
function shown(ref: string, selfLine: number | null) {
	return impactOf(graph, ref, selfLine).map((h) => [h.line, edgeLabelOf(graph, ref, h), h.where]);
}

test("六类边在真实定稿上**全都出现**（面板图例里的六个标签都有实例）", () => {
	const seen: Record<string, number> = {};
	for (const kv of graph.byRef) {
		for (const h of kv[1].hits) {
			const lab = edgeLabelOf(graph, kv[0], h);
			seen[lab] = (seen[lab] || 0) + 1;
		}
	}
	assert.deepEqual(Object.keys(seen).sort(), [...EDGE_LABELS].sort(), "六个标签都要有实例：" + JSON.stringify(seen));
	for (const k of EDGE_LABELS) assert.ok(seen[k] > 0, k + " 至少要出现一次");
});

test("六类边逐条对齐 14-impact-oracle：① 显式引用 / ② 同族 / ③ 界面归属 / ④ 验收 / ⑤ 文本 / ⑥ 契约", () => {
	// 锚点 A · §5 UI-M1 UE3：L139（§4 R6 显式引用）+ L215[同族]（UE3a 同族）
	assert.deepEqual(shown("§5 UI-M1 UE3", 214), [
		[139, "引用", "§4 R6 奖励"],
		[215, "同族", "§5 UI-M1 UE3a"],
	]);
	// ③ 界面归属：§5 UI-M1 的 12 处里，本组行 + §5.0 清单行判归属，§5.5 流程与 §4 判显式引用
	assert.deepEqual(shown("§5 UI-M1", null), [
		[139, "引用", "§4 R6 奖励"],
		[190, "归属", "§5 5.0 界面清单总览"],
		[197, "归属", "§5 UI-M1 联盟悬赏主面板"],
		[199, "归属", "§5 UI-M1 联盟悬赏主面板"],
		[205, "归属", "§5 UI-M1 联盟悬赏主面板"],
		[284, "引用", "§5 5.5 界面流程"],
		[285, "引用", "§5 5.5 界面流程"],
		[286, "引用", "§5 5.5 界面流程"],
		[287, "引用", "§5 5.5 界面流程"],
		[289, "引用", "§5 5.5 界面流程"],
		[290, "引用", "§5 5.5 界面流程"],
		[291, "引用", "§5 5.5 界面流程"],
	]);
	// ④ 验收关联：§5 UI-M4 → 7 处含 L463（AC8）—— 真数据上唯一命中的一处验收边
	const m4 = shown("§5 UI-M4", null);
	assert.equal(m4.length, 7);
	assert.deepEqual(m4.filter((x) => x[1] === "验收"), [[463, "验收", "§10 验收标准"]]);
	// ⑤ 文本关联：§7 键的命中（重复定义的另一处）
	assert.deepEqual(shown("§7 alli_boss_kill_count_label", 379), [[389, "文本", "§7 多语言文本"]]);
	// ⑥ 契约关联（正向）：§4 R6 → §6 的 4 个字段行；组的标题行标「引用」不误判
	assert.deepEqual(shown("§4 R6", null).filter((x) => x[1] === "契约"), [
		[314, "契约", "§6 全局变量.alliBossChallengeReward"],
		[342, "契约", "§6 难度表.clearDropId"],
		[343, "契约", "§6 难度表.killDropId"],
		[352, "契约", "§6 联盟排行奖励表.rewardDropId"],
	]);
	// ⑥ 契约关联（反向）：§6 的字段行 → 引用它的 §4 行
	assert.deepEqual(shown("§6 难度表.clearDropId", null), [[138, "契约", "§4 R6 奖励"]]);
	// 同一处命中多类时按最具体的那一类报一次（⑥ 契约不会被 ① 引用覆盖）
	assert.equal(shown("§4 R1", null).filter((x) => x[1] === "契约").length, 1);
});

test("refOf：条目引用的构造口径与图里的键**同源**（面板不自己拼字符串）", () => {
	assert.equal(refOf("4", "R6", ""), "§4 R6");
	assert.equal(refOf("5", "UI-M1", "UE3"), "§5 UI-M1 UE3");
	assert.equal(refOf("7", "", "alli_boss_kill_count_label"), "§7 alli_boss_kill_count_label");
	assert.equal(refOf("10", "", "AC8"), "§10 AC8");
	// 拼出来的串必须真的能在图里查到（拼错一个空格就会空集）
	for (const ref of ["§4 R6", "§5 UI-M1 UE3", "§7 alli_boss_kill_count_label", "§10 AC8"]) {
		assert.equal(graph.byRef.has(ref), true, ref);
	}
	// 章级表格：没有组标识时不留双空格
	assert.equal(refOf("5", "5.0", "UI-M1"), "§5 5.0 UI-M1");
	assert.equal(refOf("1", "", "一句话功能"), "§1 一句话功能");
	assert.equal(refOf(null, null, null), "§");
});

test("fieldRowAt：§6 字段行按**行号**回查键（声明行不在 rows 里，面板只能这么问图）", () => {
	assert.deepEqual(fieldRowAt(graph, 342), { ref: "§6 难度表.clearDropId", field: "clearDropId", table: "难度表" });
	assert.deepEqual(fieldRowAt(graph, 313), { ref: "§6 全局变量.alliBossDailyAttackCount", field: "alliBossDailyAttackCount", table: "全局变量" });
	// §6.5 的缺口表 / §6.3 的「终极难度」行都不是字段声明
	assert.equal(fieldRowAt(graph, 358), null);
	assert.equal(fieldRowAt(graph, 339), null);
	// 空图不炸
	assert.equal(fieldRowAt(null, 342), null);
	assert.equal(fieldRowAt({}, 342), null);
});
