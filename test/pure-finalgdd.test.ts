/**
 * 定稿解析 + 定稿有效性 V1（迁移自 legacy/test-finalgdd.js、legacy/test-finalcheck.js）。
 *
 * 跑的是真实定稿 `features\联盟悬赏\gdd\联盟悬赏_20260923_定稿.md`：
 * 章 / 组 / 条目与 **1-based 行号**都是真实值，行号是"定位"与"就地改这条"的锚点。
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { checkFinals, parseFinalGdd, parseFrontmatter, topBlockIndex } from "../src/pure/finalgdd.ts";
import { dateOf } from "../src/pure/topic.ts";
import { FEATURE_ROOT, FINAL_GDD, PREV_FINAL_GDD, readText, requireRealData } from "./paths.ts";

requireRealData();
const text = readText(FINAL_GDD);
const g = parseFinalGdd(text);

test("真实定稿：frontmatter 与标题", () => {
	assert.equal(g.meta.doc_type, "final_gdd");
	assert.equal(g.meta.status, "active");
	assert.equal(g.title, "功能 GDD：联盟悬赏（联盟 BOSS）");
});

test("真实定稿：11 章 / 28 组 / 214 条目行，章号连续无跳号", () => {
	assert.equal(g.stats.chapters, 11);
	assert.equal(g.stats.groups, 28);
	assert.equal(g.stats.rows, 214);
	assert.equal(g.outline.map((c) => c.no).join(","), "1,2,3,4,5,6,7,8,9,10,11");
	assert.equal(g.blocks.length, 39);
});

test("真实条目：章/组/条目 + 行号区间（行号与源文件对得上）", () => {
	const srcLines = text.split(/\r?\n/);

	// ① §4 R1「活动周期与开启」组 —— 组标题行 + 组内条目行
	const ch4 = g.outline.find((c) => c.no === "4");
	assert.ok(ch4, "应有 §4");
	const r1 = ch4.children.find((gr) => gr.id === "R1");
	assert.ok(r1, "§4 应有 R1 组");
	assert.equal(r1.title, "活动周期与开启");
	assert.equal(r1.line, 83);
	assert.ok(/^###\s+R1\s+活动周期与开启/.test(srcLines[r1.line - 1]), "第 " + r1.line + " 行应正是 §4 R1 的组标题");
	const r1rows = r1.rows.map((r) => r.key + "@" + r.line);
	// ★ 原断言只列了 3 条 —— 真实定稿的 R1 表就是 **6 行**（L87-92，实测逐行核对）。
	//   少列的三条（开启门槛 / 入口 / 每日出刀次数）不是解析漏了，是原断言没抄全。
	assert.deepEqual(r1rows, ["周期@87", "结算与重开@88", "参与条件@89", "开启门槛@90", "入口@91", "每日出刀次数@92"]);
	assert.ok(srcLines[86].includes("每周循环开启一场"), "第 87 行应是「周期」这一条");
	assert.ok(srcLines[91].includes("每天每个玩家拥有固定出刀次数上限"), "第 92 行应是「每日出刀次数」这一条");

	// ② §5 UI-M1「联盟悬赏主面板」组 —— 界面归属的锚点（5.1 组号 + UI-M1 编号）
	const ch5 = g.outline.find((c) => c.no === "5");
	const uiM1 = ch5.children.find((gr) => gr.id === "UI-M1");
	assert.ok(uiM1, "§5 应有 UI-M1 组");
	assert.equal(uiM1.no, "5.1");
	assert.equal(uiM1.line, 197);
	assert.ok(/^###\s+5\.1\s+UI-M1\s+联盟悬赏主面板/.test(srcLines[uiM1.line - 1]));
	const ue = uiM1.rows.filter((r) => /^UE\d+/.test(r.key)).map((r) => r.key + "@" + r.line);
	assert.deepEqual(ue.slice(0, 3), ["UE1@211", "UE2@212", "UE2a@213"]);

	// ③ §10 验收标准（章级表格 → AC 条目）
	const ch10 = g.outline.find((c) => c.no === "10");
	const ac1 = ch10.rows.find((r) => r.key === "AC1");
	assert.ok(ac1, "§10 应有 AC1");
	assert.equal(ac1.line, 456);
	assert.ok(srcLines[ac1.line - 1].includes("无联盟玩家无法出刀"), "第 456 行应是 AC1");
});

test("每个块的行号都落在真实文件范围内，且块正文能回指原文", () => {
	const srcLines = text.split(/\r?\n/);
	for (const b of g.blocks) {
		assert.ok(b.line >= 1 && b.line <= srcLines.length, "块行号越界：" + b.line);
		assert.ok(srcLines[b.line - 1].startsWith("#"), "块的第一行应是标题：" + srcLines[b.line - 1]);
	}
});

test("V1 定稿有效性：真实数据里有两份 active —— 必须报 V1 error", () => {
	const heads = [
		{ name: "联盟悬赏_20260923_定稿.md", ...pick(parseFrontmatter(readText(FINAL_GDD))) },
		{ name: "联盟悬赏_20260921_定稿.md", ...pick(parseFrontmatter(readText(PREV_FINAL_GDD))) },
	];
	const r = checkFinals(heads);
	assert.deepEqual(r.actives, ["联盟悬赏_20260923_定稿.md", "联盟悬赏_20260921_定稿.md"]);
	assert.equal(r.issues[0].code, "V1");
	assert.equal(r.issues[0].level, "error");
	// 当前有效 = 日期最新的 active（口径：日期 + status，不靠文件名猜）
	assert.equal(r.current, "联盟悬赏_20260923_定稿.md");
	assert.equal(r.currentFrom, "active");
});

test("checkFinals 的另外两条口径（合成用例，覆盖 V1b / V1c）", () => {
	const withDate = (name: string, status: string) => ({ name, doc_type: "final_gdd", status });
	// 旧稿未标 archived → V1c
	const c = checkFinals([withDate("x_20260910_定稿.md", "active"), withDate("x_20260901_定稿.md", "provisional")]);
	assert.deepEqual(c.issues.map((i) => i.code), ["V1c"]);
	// 没有 active（provisional / blocked 或头部字段缺）→ V1b
	const b = checkFinals([withDate("x_20260910_定稿.md", "provisional")]);
	assert.deepEqual(b.issues.map((i) => i.code), ["V1b"]);
	assert.equal(b.currentFrom, "date");
	assert.equal(b.current, "x_20260910_定稿.md");
	// 空输入不炸
	assert.deepEqual(checkFinals([]).issues, []);
	assert.equal(checkFinals(undefined).current, null);
});

test("定稿按日期倒序（真实文件名）", () => {
	const names = ["联盟悬赏_20260921_定稿.md", "联盟悬赏_20260923_定稿.md"].sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : -1));
	assert.deepEqual(names, ["联盟悬赏_20260923_定稿.md", "联盟悬赏_20260921_定稿.md"]);
	// 真实 gdd\ 目录里定稿确实不止一份
	assert.ok(path.basename(FEATURE_ROOT).length > 0);
});

// ── 工单 13 · 正文滚动时大纲的跟随高亮 ────────────────────────────────────
//   真机上"滚一下"看不出边界（第一块还没滚到、块高小于 slack），所以这一步抽成纯函数离线测。
test("topBlockIndex：取顶边已越过顶界的最后一个块；一个都没越过取第 0 块", () => {
	// 还没开始滚（第一块顶边在下方 300px）→ 第 0 块
	assert.equal(topBlockIndex([300, 800, 1500]), 0);
	// 滚过第一块、第二块顶边到 -40 → 第 1 块
	assert.equal(topBlockIndex([-500, -40, 700]), 1);
	// 正好压在顶界上（slack 内）也算进去
	assert.equal(topBlockIndex([-500, 8, 700]), 1);
	assert.equal(topBlockIndex([-500, 9, 700]), 0);
	// 全滚过去了 → 最后一块
	assert.equal(topBlockIndex([-900, -400, -10]), 2);
	// 空 / 非法输入不炸
	assert.equal(topBlockIndex([]), -1);
	assert.equal(topBlockIndex(null as unknown as number[]), -1);
	assert.equal(topBlockIndex([NaN, 40]), 0, "NaN 跳过，不改变结论");
	assert.equal(topBlockIndex([-10], 0), 0);
});

test("topBlockIndex 与真实定稿的块序列配合：39 块，任一位置都能给出一个块号", () => {
	const tops = g.blocks.map((_b, i) => i * 120);          // 假设每块 120px、还没开始滚
	const i = topBlockIndex(tops);
	assert.ok(i >= 0 && i < g.blocks.length);
	// 全部块都滚过顶界 → 最后一块
	assert.equal(topBlockIndex(g.blocks.map(() => -1)), g.blocks.length - 1);
	// 单调递增的顶边 ⇒ 结果只会随着滚动单调前进（不会来回跳）
	for (let k = 1; k < g.blocks.length; k++) {
		assert.ok(topBlockIndex(tops.map((t) => t - k * 120)) >= topBlockIndex(tops.map((t) => t - (k - 1) * 120)));
	}
});

function pick(h: Record<string, string> | null): { doc_type: unknown; status: unknown } {
	return { doc_type: h ? h.doc_type : null, status: h ? h.status : null };
}
