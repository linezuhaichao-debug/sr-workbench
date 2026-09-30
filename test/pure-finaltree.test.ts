/**
 * 定稿大纲树（工单 13 的左边那棵树）—— 跑**真实定稿**，逐条对齐 `13-parse-oracle.md`。
 *
 * 这份测试回答的是三件在面板上看不清、但必须对的事：
 *   ① 哪些行**能**被单独引用、引用串是什么（就是引用图的键）；
 *   ② 每条的行号（1-based，与编辑器一致）——oracle 是机械数出来的，对不上就是实现错；
 *   ③ 默认开合：**组级展开、章级收起**（§7 有 49 个键，全展开会淹没界面）。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { parseFinalGdd } from "../src/pure/finalgdd.ts";
import { buildFinalTree } from "../src/pure/finaltree.ts";
import { buildRefGraph } from "../src/pure/refgraph.ts";
import { FINAL_GDD, readText, requireRealData } from "./paths.ts";

requireRealData();
const text = readText(FINAL_GDD);
const doc = parseFinalGdd(text);
const graph = buildRefGraph(doc);
const tree = buildFinalTree(doc, graph);
const srcLines = text.split(/\r?\n/);

const ch = (no: string) => {
	const c = tree.chapters.find((x) => x.no === no);
	assert.ok(c, "应有 §" + no);
	return c!;
};

test("树的总量：11 章 / 28 组 / 165 个可引用条目 + 49 行不可单独引用（= 214 条目行）", () => {
	assert.deepEqual(tree.counts, { chapters: 11, groups: 28, items: 165, skipped: 49 });
	// 165 + 49 = 214 = parseFinalGdd 数出来的条目行数 ⇒ 没有行被无声吞掉
	assert.equal(tree.counts.items + tree.counts.skipped, doc.stats.rows);
});

test("章：11 个，起行与 13-parse-oracle 逐行一致；章本身不可单独引用（默认收起）", () => {
	assert.deepEqual(
		tree.chapters.map((c) => [c.no, c.line]),
		[["1", 13], ["2", 35], ["3", 48], ["4", 79], ["5", 184], ["6", 305], ["7", 368], ["8", 426], ["9", 438], ["10", 452], ["11", 474]],
	);
	for (const c of tree.chapters) {
		assert.equal(c.open, false, "§" + c.no + " 章级默认收起");
		assert.equal(c.ref, "", "§" + c.no + " 章不是引用图的实体");
		assert.ok(srcLines[c.line - 1].startsWith("## " + c.no + "."), "L" + c.line + " 应是章标题：" + srcLines[c.line - 1]);
	}
});

test("§4：10 组 / 49 条 —— 组标识、组行号、组内每一条的名字与行号（oracle 逐条）", () => {
	const c = ch("4");
	assert.deepEqual(
		c.groups.map((g) => [g.id, g.line]),
		[["R1", 83], ["R2", 94], ["R3", 106], ["R4", 114], ["R5", 124], ["R6", 133], ["R7", 144], ["R8", 154], ["R9", 165], ["R10", 175]],
	);
	const expect: Record<string, Array<[string, number]>> = {
		R1: [["周期", 87], ["结算与重开", 88], ["参与条件", 89], ["开启门槛", 90], ["入口", 91], ["每日出刀次数", 92]],
		R2: [["BOSS 轮换", 98], ["BOSS 信息", 99], ["独立血池", 100], ["难度推进", 101], ["终极难度", 102], ["BOSS 死亡判定", 103], ["终结判定", 104]],
		R3: [["每日配额", 110], ["作废", 111], ["耗尽", 112]],
		R4: [["战斗形式", 118], ["操作约束", 119], ["限时", 120], ["结算", 121], ["并发时序", 122]],
		R5: [["折算公式", 128], ["倍率作用边界", 129], ["终极难度计分", 130], ["溢出", 131]],
		R6: [["挑战奖励", 137], ["难度通关礼包", 138], ["终结奖励", 139], ["联盟排名奖励", 140], ["终极难度奖励边界", 141], ["领取形态", 142]],
		R7: [["统计范围", 148], ["排序", 149], ["面板展示", 150], ["奖励", 151], ["结算", 152]],
		R8: [["统计范围", 158], ["排序优先级", 159], ["面板展示", 160], ["展示过滤", 161], ["展示数量", 162], ["结算", 163]],
		R9: [["退盟", 169], ["入盟", 170], ["联盟解散", 171], ["中途合盟", 172], ["活动截止", 173]],
		R10: [["推送", 179], ["意图", 180]],
	};
	let n = 0;
	for (const g of c.groups) {
		const want = expect[g.id]!;
		assert.deepEqual(g.items.map((i) => [i.label, i.line]), want, "§4 " + g.id + " 的条目");
		n += g.items.length;
		// ★ §4 的粒度到**规则组**：组内每一条的引用都是组引用，原文是它自己那一行
		assert.equal(g.ref, "§4 " + g.id);
		assert.ok(g.items.every((i) => i.ref === "§4 " + g.id), "§4 " + g.id + " 组内条目的引用应是组引用");
		for (const it of g.items) {
			assert.equal(it.text, srcLines[it.line - 1].trim(), "L" + it.line + " 的现状原文要逐字对上");
		}
	}
	assert.equal(n, 49, "§4 规则条目合计 49 条");
});

test("§5：7 组 / 28 条 UE —— 组标识与行号（oracle 逐条），非 UE 的 8 行不假装能点", () => {
	const c = ch("5");
	assert.deepEqual(
		c.groups.map((g) => [g.id || g.no, g.line]),
		[["5.0", 186], ["UI-M1", 197], ["UI-M2", 223], ["UI-M3", 244], ["UI-M4", 268], ["5.5", 281], ["5.6", 294]],
	);
	const ue = (id: string) => c.groups.find((g) => g.id === id)!.items.map((i) => [i.label, i.line, i.ref]);
	assert.deepEqual(ue("UI-M1"), [
		["UE1", 211, "§5 UI-M1 UE1"], ["UE2", 212, "§5 UI-M1 UE2"], ["UE2a", 213, "§5 UI-M1 UE2a"],
		["UE3", 214, "§5 UI-M1 UE3"], ["UE3a", 215, "§5 UI-M1 UE3a"], ["UE4", 216, "§5 UI-M1 UE4"],
		["UE5", 217, "§5 UI-M1 UE5"], ["UE6", 218, "§5 UI-M1 UE6"], ["UE7", 219, "§5 UI-M1 UE7"],
		["UE8", 220, "§5 UI-M1 UE8"], ["UE9", 221, "§5 UI-M1 UE9"],
	]);
	assert.deepEqual(ue("UI-M2").map((x) => x[0]), ["UE10", "UE11", "UE12", "UE13", "UE14", "UE14a"]);
	assert.deepEqual(ue("UI-M2").map((x) => x[1]), [237, 238, 239, 240, 241, 242]);
	assert.deepEqual(ue("UI-M3").map((x) => x[0]), ["UE15", "UE15a", "UE16", "UE17", "UE17a", "UE18", "UE19"]);
	assert.deepEqual(ue("UI-M3").map((x) => x[1]), [260, 261, 262, 263, 264, 265, 266]);
	assert.deepEqual(ue("UI-M4").map((x) => [x[0], x[1]]), [["UE20", 276], ["UE20a", 277], ["UE20b", 278], ["UE20c", 279]]);
	assert.equal(c.groups.reduce((a, g) => a + g.items.length, 0), 28, "§5 UE 条目合计 28 条");
	// §5.0 的界面清单 4 行、§5.6 的规范 4 行：不是可引用实体（显灰）
	assert.equal(c.groups.find((g) => g.no === "5.0")!.skipped, 4);
	assert.equal(c.groups.find((g) => g.no === "5.6")!.skipped, 4);
});

test("§6：24 个字段行按行号回查成「§6 表名.字段」（§4/§5 之外唯一到行的引用）；§6.5 的三列表不算字段", () => {
	const c = ch("6");
	const fields = c.groups.flatMap((g) => g.items);
	assert.equal(fields.length, 24);
	assert.deepEqual(
		fields.map((i) => [i.ref, i.line]),
		[
			["§6 全局变量.alliBossDailyAttackCount", 313], ["§6 全局变量.alliBossChallengeReward", 314], ["§6 全局变量.alliBossLowBloodNotice", 315],
			["§6 BOSS表.Id", 321], ["§6 BOSS表.bossName", 322], ["§6 BOSS表.rotateIndex", 323], ["§6 BOSS表.weakness", 324],
			["§6 BOSS表.recommendHero", 325], ["§6 BOSS表.timeLimit", 326], ["§6 BOSS表.bossArt", 327], ["§6 BOSS表.bg", 328],
			["§6 BOSS表.sence", 329], ["§6 BOSS表.bossGid", 330], ["§6 BOSS表.brithPlace", 331], ["§6 BOSS表.monsterPlace", 332],
			["§6 难度表.level", 338], ["§6 难度表.bossLevel", 340], ["§6 难度表.damageRate", 341],
			["§6 难度表.clearDropId", 342], ["§6 难度表.killDropId", 343],
			["§6 联盟排行奖励表.rankIndex", 349], ["§6 联盟排行奖励表.minRank", 350],
			["§6 联盟排行奖励表.maxRank", 351], ["§6 联盟排行奖励表.rewardDropId", 352],
		],
	);
	assert.equal(c.groups.find((g) => g.no === "6.5")!.skipped, 7, "§6.5 掉落缺口表 7 行不是字段声明");
	assert.equal(c.groups.find((g) => g.no === "6.3")!.skipped, 1, "§6.3 的「终极难度」行列名无英文字段 ⇒ 不是字段行");
	for (const i of fields) assert.equal(i.text, srcLines[i.line - 1].trim(), "L" + i.line + " 的现状原文要逐字对上");
});

test("§7：49 个键（含**重复定义的那两行**都列出来）· §10：15 条 AC", () => {
	const c7 = ch("7");
	assert.equal(c7.items.length, 49);
	assert.deepEqual([c7.items[0].label, c7.items[0].line], ["alli_boss_panel_title", 374]);
	assert.deepEqual([c7.items[48].label, c7.items[48].line], ["alli_boss_difficulty_cleared_push", 422]);
	// 行号连续 374–422（oracle 的键表就是这 49 行）
	assert.deepEqual(c7.items.map((i) => i.line), Array.from({ length: 49 }, (_, i) => 374 + i));
	assert.ok(c7.items.every((i) => i.ref === "§7 " + i.label), "§7 的引用是「§7 键」");
	// V3 判定的重复键：两处都在树上（用户才能看见"改哪个"）
	assert.deepEqual(
		c7.items.filter((i) => i.label === "alli_boss_kill_count_label").map((i) => [i.line, i.ref]),
		[[379, "§7 alli_boss_kill_count_label"], [389, "§7 alli_boss_kill_count_label"]],
	);

	const c10 = ch("10");
	assert.equal(c10.items.length, 15);
	assert.deepEqual(c10.items.map((i) => [i.label, i.line, i.ref]), [
		["AC1", 456, "§10 AC1"], ["AC2", 457, "§10 AC2"], ["AC3", 458, "§10 AC3"], ["AC4", 459, "§10 AC4"],
		["AC5", 460, "§10 AC5"], ["AC6", 461, "§10 AC6"], ["AC7", 462, "§10 AC7"], ["AC8", 463, "§10 AC8"],
		["AC9", 464, "§10 AC9"], ["AC10", 465, "§10 AC10"], ["AC11", 466, "§10 AC11"], ["AC12", 467, "§10 AC12"],
		["AC13", 468, "§10 AC13"], ["AC14", 469, "§10 AC14"], ["AC15", 470, "§10 AC15"],
	]);
});

test("默认开合：**组级全部展开、章级全部收起**（§7 的 49 个键就是判据）", () => {
	for (const c of tree.chapters) {
		assert.equal(c.open, false, "§" + c.no + " 章级应默认收起");
		for (const g of c.groups) assert.equal(g.open, true, "§" + c.no + " " + (g.id || g.no) + " 组级应默认展开");
	}
});

test("树上每一个非空引用都能在引用图里查到（有事可查）；不可引用的行都带原因", () => {
	const all = tree.chapters.flatMap((c) => c.items.concat(c.groups.flatMap((g) => g.items)));
	for (const it of all) {
		if (it.ref) {
			assert.equal(graph.byRef.has(it.ref), true, "引用图里应有 " + it.ref);
			assert.equal(it.why, "", it.ref + " 不应带「不能点」的原因");
		} else {
			assert.ok(it.why && it.why.length > 0, "不可引用的行必须写明原因：" + it.label);
		}
	}
	// 真实定稿上"能点但图里查不到"的条目数 = 0
	assert.equal(all.filter((i) => i.why).length, 0);
});

test("组引用：§4/§5 的组是可引用实体（`§4 R6` / `§5 UI-M1`），§6 的组不是（§6 到行）", () => {
	assert.equal(ch("4").groups.find((g) => g.id === "R6")!.ref, "§4 R6");
	assert.equal(ch("5").groups.find((g) => g.id === "UI-M1")!.ref, "§5 UI-M1");
	for (const g of ch("6").groups) assert.equal(g.ref, "", "§6 的组不应有组引用：" + g.no);
	assert.equal(ch("6").groups[0].grain, "§6 到行（表名 + 字段）");
});

test("章/组的标题行原文（定位卡上的「现状原文」）；空输入不炸", () => {
	assert.equal(ch("7").text, "## 7. 多语言文本");
	assert.equal(ch("4").groups.find((g) => g.id === "R6")!.text, "### R6 奖励");
	const empty = buildFinalTree(null, null);
	assert.deepEqual(empty.counts, { chapters: 0, groups: 0, items: 0, skipped: 0 });
	assert.deepEqual(empty.chapters, []);
	// 没有图（graph 为空）时树照样建出来：§6 的 24 个字段行**回查不到键**（它们只能按行号问图），
	// 所以那 24 行退化成"不可单独引用"并写明原因 —— 其余 141 个条目照旧
	const noGraph = buildFinalTree(doc, null);
	assert.equal(noGraph.counts.items, 141);
	assert.equal(noGraph.counts.skipped, 49 + 24);
	assert.ok(noGraph.chapters[3].groups[0].items.every((i) => i.ref === "" && i.why));
});
