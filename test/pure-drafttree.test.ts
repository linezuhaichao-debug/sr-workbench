/**
 * 文档生成工作面的结构数据（工单 24 · `src/pure/drafttree.ts`）。
 *
 * 对着**真实成稿** `联盟悬赏_20260918.md`（39,495 B / 542 行）逐条数：
 *   §4 功能规则 L79–L180 · 10 个规则组 / 48 条规则
 *   §5 用户体验与界面流程 L181–L313 · 6 个组 / 23 条 UE（+13 行不可单独引用）
 * 行号与 `parseFinalGdd` 逐条一致 —— 因为这一层**就是**在用那份解析能力（工单 24 第 5 条）。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { draftDocOf, partKeyOfChapter } from "../src/pure/drafttree.ts";
import { parseFinalGdd } from "../src/pure/finalgdd.ts";
import { buildFinalTree } from "../src/pure/finaltree.ts";

const SR_ROOT = process.env.SR_WB_WORKSPACE || "D:\\TimeMachine\\GameDesignOS\\workspace";
const DRAFT = path.join(SR_ROOT, "features", "讨伐", "gdd", "联盟悬赏_20260918.md");   // ★ 2026-10-08：目录改名 `联盟悬赏` → `讨伐`
const DRAFT2 = path.join(SR_ROOT, "features", "诸神降临", "gdd", "诸神降临_20260915.md");

const read = (p: string) => {
	if (!fs.existsSync(p)) throw new Error("真实数据不在位（本套件刻意不录制 fixture）：" + p);
	return fs.readFileSync(p, "utf8");
};

test("真成稿：两大部分都定位到，章号 / 行号 / 组数 / 条目数逐条对得上", () => {
	const d = draftDocOf(read(DRAFT));
	assert.equal(d.complete, true, "两大部分都认出来了");
	assert.deepEqual(d.missingParts, []);
	assert.equal(d.title, "功能 GDD：联盟悬赏（联盟 BOSS）");
	assert.equal(d.lines, 542);

	// ── 序：功能规则 → 用户体验与界面流程（固定顺序，不按章号排）
	assert.deepEqual(d.parts.map((p) => p.key), ["rules", "ux"]);

	const rules = d.parts[0];
	assert.equal(rules.label, "功能规则");
	assert.equal(rules.no, "4");
	assert.equal(rules.title, "功能规则");
	assert.equal(rules.line, 79, "§4 起行 = L79");
	assert.equal(rules.endLine, 180, "§4 到 §5 之前一行（L180）");
	assert.equal(rules.groups, 10, "10 个规则组 R1–R10");
	assert.equal(rules.items, 48, "规则条数（组内表格行）48");
	assert.equal(rules.skipped, 0, "§4 的表格行全都是规则条目");

	const ux = d.parts[1];
	assert.equal(ux.label, "用户体验与界面流程");
	assert.equal(ux.no, "5");
	assert.equal(ux.line, 181, "§5 起行 = L181");
	assert.equal(ux.endLine, 313, "§5 到 §6 之前一行");
	assert.equal(ux.groups, 6, "6 个组（5.0 / UI-M1 / UI-M2 / UI-M3 / 5.4 / 5.5）");
	assert.equal(ux.items, 23, "UE 条目 23 条（UI-M1 11 + UI-M2 5 + UI-M3 7）");
	assert.equal(ux.skipped, 7, "7 行不可单独引用（§5.0 界面清单 3 + §5.5 交互规范 4）");

	// 计数与树同源（不是另算一份）
	assert.equal(d.counts.rules, rules.items);
	assert.equal(d.counts.ues, ux.items);
	assert.equal(d.counts.ruleGroups, 10);
	assert.equal(d.counts.uiGroups, 6);
	assert.equal(d.counts.chapters, 12);

	// ── 组的标识与行号（点在树上的 §4 R1 / §5 UI-M1）
	const tree = d.tree;
	const ch4 = tree.chapters.filter((c) => c.no === "4")[0];
	// 组标识的口径与 `finaltree.groupKey` 一致：有 `id`（`R1` / `UI-M1`）用 id，否则退回组号（`5.0`）
	const keys = (c: any) => c.groups.map((g: any) => g.id || g.no);
	assert.deepEqual(keys(ch4), ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"]);
	assert.equal(ch4.groups[0].line, 81, "`### R1 活动周期与开启` 在 L81");
	assert.equal(ch4.groups[5].line, 130, "`### R6 奖励` 在 L130");
	const ch5 = tree.chapters.filter((c) => c.no === "5")[0];
	assert.deepEqual(keys(ch5), ["5.0", "UI-M1", "UI-M2", "UI-M3", "5.4", "5.5"]);
	assert.equal(ch5.groups[1].line, 193, "`### 5.1 UI-M1 联盟悬赏主面板` 在 L193");

	// ── 与「复用的那份解析能力」逐条一致（工单 24：不另写一份解析）
	const doc = parseFinalGdd(read(DRAFT));
	const again = buildFinalTree(doc, null);
	assert.deepEqual(d.tree.counts, again.counts, "树完全等于 buildFinalTree(parseFinalGdd(text)) 的结论");
	assert.deepEqual(d.counts, {
		chapters: again.counts.chapters, groups: again.counts.groups,
		ruleGroups: 10, rules: 48, uiGroups: 6, ues: 23
	});
});

test("两大部分的判据是**章标题关键词**，章号是读出来的（换个章号照样认）", () => {
	// 把真成稿的两章标题章号改掉（`## 4.` → `## 7.`），标题文字一字不动：
	// 认出来的应该是 §7 / §8 而不是写死的 §4 / §5。
	const src = read(DRAFT);
	const text = src.replace("## 4. 功能规则", "## 7. 功能规则").replace("## 5. 用户体验与界面流程", "## 8. 用户体验与界面流程");
	assert.notEqual(text, src, "替换真的发生了");
	const d = draftDocOf(text);
	assert.equal(d.complete, true);
	assert.deepEqual(d.parts.map((p) => p.no), ["7", "8"], "章号跟着文档走，不写死 §4/§5");
	assert.equal(partKeyOfChapter(d, "7"), "rules");
	assert.equal(partKeyOfChapter(d, "8"), "ux");
	assert.equal(partKeyOfChapter(d, "4"), "", "原来的章号现在已经不是这两部分了");
	// 组数仍然对（组是从大纲来的，与章号词无关）
	assert.equal(d.parts[0].groups, 10);
	assert.equal(d.parts[1].groups, 6);
	// ⚠ 左树的**条目级**解析在 `finaltree` 里是按章号认词的（§4 规则组 / §5 UE / §6 字段行 / §7 键 / §10 AC）——
	//   章号一改，那一层就不认了（条目数会变 0）。所以这里只断言**部分级**元数据。
	//   这是"复用定稿那套解析能力"（工单 24 第 5 条）的固有边界：**两大部分的位置跟着文档走，
	//   条目级粒度仍按模板的章号**。面板上那条提示（认不出来就说认不出来）就是为这种情况准备的。
});

test("认不出来就说认不出来（不硬指一个章号）", () => {
	const d = draftDocOf(["# 功能 GDD：没有结果章", "", "## 1. 功能意图", "", "只有这一章。"].join("\n"));
	assert.equal(d.complete, false);
	assert.deepEqual(d.missingParts, ["功能规则", "用户体验与界面流程"]);
	assert.equal(d.parts.length, 0);
	assert.equal(d.counts.chapters, 1);
	// 空文本不崩
	const e = draftDocOf("");
	assert.equal(e.complete, false);
	assert.equal(e.lines, 0);
});

test("真实成稿的章清单带范围（点哪一章都能定位，part 归属也对）", () => {
	const d = draftDocOf(read(DRAFT));
	const byNo = (no: string) => d.chapters.filter((c) => c.no === no)[0];
	assert.equal(byNo("1").line, 13);
	assert.equal(byNo("1").endLine, 34, "§1 到 §2 之前一行");
	assert.equal(byNo("12").line, 436);
	assert.equal(byNo("12").endLine, 542, "最后一章到文末");
	assert.equal(byNo("4").part, "rules");
	assert.equal(byNo("5").part, "ux");
	assert.equal(byNo("6").part, "");
	assert.equal(partKeyOfChapter(d, "1"), "", "不在两大部分里的章没有归属");
	assert.equal(d.chapters.length, 12);
});

test("第二例：诸神降临的成稿（对照组，条数与联盟悬赏不同）", () => {
	if (!fs.existsSync(DRAFT2)) return;      // 第二例不在位就跳过（第一例仍是硬要求）
	const d = draftDocOf(read(DRAFT2));
	assert.equal(d.complete, true);
	assert.equal(d.parts[0].no, "4");
	assert.equal(d.parts[1].no, "5");
	assert.equal(d.parts[0].groups, 7, "R1–R7");
	assert.ok(d.parts[1].items > 0, "§5 里有 UE 条目");
	assert.ok(d.parts[0].line > 0 && d.parts[1].line > d.parts[0].line);
});
