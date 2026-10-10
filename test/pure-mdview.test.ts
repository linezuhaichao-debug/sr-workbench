/**
 * md 渲染器的**解析层**判据（`src/pure/mdview.ts`）。
 *
 * 背景：技能用法弹窗从"按字段排版"改成"**按 md 原样渲染**"（用户口径：尤其表格），
 * 于是这一层成了新的关键路径 —— 解析错了，屏幕上就是排错的版（而不再是崩，崩反而好发现）。
 * 判据盯三件事：块切得对 · 行内拆得对 · **认不出来时原样保留**（宁可少渲染，不可丢字）。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { mdBlocks, mdRuns, mdTableCount } from "../src/pure/mdview.ts";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEACHING_MD = path.join(REPO, "skills", "sr-askme", "references", "使用说明.md");

test("标题：#~###### 按层级出，正文去空白", () => {
	const bs = mdBlocks("# 一级\n\n## 二级\n\n###### 六级\n");
	assert.deepEqual(bs.map((b) => b.kind), ["heading", "heading", "heading"]);
	assert.deepEqual(bs.map((b) => b.level), [1, 2, 6]);
	assert.equal(bs[0].text, "一级");
});

test("段落：软换行并成一个空格，遇到下一个块的开始就收尾", () => {
	const bs = mdBlocks("第一行\n第二行\n\n- 列表\n");
	assert.equal(bs.length, 2);
	assert.equal(bs[0].kind, "para");
	assert.equal(bs[0].text, "第一行 第二行");
	assert.equal(bs[1].kind, "list");
});

test("表格：表头 + 分隔行 + 数据行；没有分隔行就退回段落（不硬当表格）", () => {
	const bs = mdBlocks(["| skill | 干什么 |", "| --- | --- |", "| `a` | 甲 |", "| `b` | 乙 |"].join("\n"));
	assert.equal(bs.length, 1);
	assert.equal(bs[0].kind, "table");
	assert.deepEqual(bs[0].head, ["skill", "干什么"]);
	assert.deepEqual(bs[0].rows, [["`a`", "甲"], ["`b`", "乙"]]);
	assert.deepEqual(mdBlocks("| 只有一行 | 没有分隔行 |"), [{ kind: "para", text: "| 只有一行 | 没有分隔行 |" }]);
	assert.equal(mdTableCount(["| a | b |", "| --- | --- |", "| c | d |"].join("\n")), 1);
});

test("列表：有序 / 无序、一层子项、缩进续行；遇到空行收尾", () => {
	const ordered = mdBlocks(["1. **入口**：从这里开始", "   - 子项甲", "   - 子项乙", "2. **成稿**：下一步"].join("\n"));
	assert.equal(ordered.length, 1);
	assert.equal(ordered[0].kind, "list");
	assert.equal(ordered[0].ordered, true);
	assert.deepEqual(ordered[0].items.map((i) => i.text), ["**入口**：从这里开始", "**成稿**：下一步"]);
	assert.deepEqual(ordered[0].items[0].subs, ["子项甲", "子项乙"]);
	assert.deepEqual(ordered[0].items[1].subs, []);
	const bullet = mdBlocks("- 甲\n- 乙\n\n后面的段落");
	assert.equal(bullet[0].kind, "list");
	assert.equal(bullet[0].ordered, false);
	assert.equal(bullet[1].kind, "para");
});

test("引用块与分隔线", () => {
	const bs = mdBlocks("> 原话\n> 还有一行\n\n---\n");
	assert.deepEqual(bs, [{ kind: "quote", text: "原话 还有一行" }, { kind: "hr" }]);
});

test("行内：加粗、行内代码、**加粗里套代码**都认；不闭合的原样留着", () => {
	assert.deepEqual(mdRuns("普通"), [{ text: "普通", bold: false, code: false }]);
	assert.deepEqual(mdRuns("a **粗** b"), [
		{ text: "a ", bold: false, code: false },
		{ text: "粗", bold: true, code: false },
		{ text: " b", bold: false, code: false }
	]);
	assert.deepEqual(mdRuns("跑 `npm run build` 再回来"), [
		{ text: "跑 ", bold: false, code: false },
		{ text: "npm run build", bold: false, code: true },
		{ text: " 再回来", bold: false, code: false }
	]);
	// ★ 真数据里有这种写法：**主线定稿通过后状态为 `active`、成稿归档**
	const nested = mdRuns("**状态为 `active`、归档**");
	assert.deepEqual(nested, [
		{ text: "状态为 ", bold: true, code: false },
		{ text: "active", bold: true, code: true },
		{ text: "、归档", bold: true, code: false }
	]);
	// 不闭合 / 空内容 ⇒ 一个字都不许丢
	assert.deepEqual(mdRuns("**没闭合"), [{ text: "**没闭合", bold: false, code: false }]);
	assert.deepEqual(mdRuns("`也没闭合"), [{ text: "`也没闭合", bold: false, code: false }]);
	assert.deepEqual(mdRuns("a **** b"), [{ text: "a **** b", bold: false, code: false }]);
});

test("围栏代码块：吃到收尾围栏；没闭合就吃到文件尾（不丢字）", () => {
	const closed = mdBlocks("```\nconst a = 1;\n```\n\n后面");
	assert.deepEqual(closed[0], { kind: "code", text: "const a = 1;" });
	assert.equal(closed[1].kind, "para");
	assert.deepEqual(mdBlocks("```\n没收尾")[0], { kind: "code", text: "没收尾" });
});

test("真数据：sr-askme 的使用说明必须解析得出（这是弹窗的硬前提）", () => {
	const md = fs.readFileSync(TEACHING_MD, "utf8");
	const bs = mdBlocks(md);
	const tables = bs.filter((b) => b.kind === "table");
	assert.ok(tables.length >= 2, "表格至少 2 个，实际 " + tables.length);
	assert.equal(tables.length, mdTableCount(md), "解析出的表格数要与数出来的表格数一致");
	// 一行 `|` 都没剩下 —— 说明表格全被认出来了（退回段落的那些会以 `|` 开头）
	for (const b of bs) if (b.kind === "para") assert.equal(b.text.startsWith("|"), false, "有表格退回了段落：" + b.text.slice(0, 60));
	// 结构齐：一个一级标题 + 若干二级 + 一份带子项的有序列表（主线五步）
	assert.equal(bs.filter((b) => b.kind === "heading" && b.level === 1).length, 1, "只该有一个一级标题");
	assert.ok(bs.filter((b) => b.kind === "heading" && b.level === 2).length >= 4, "二级标题至少要 4 个");
	const mainline = bs.filter((b) => b.kind === "list" && b.ordered).pop();
	assert.ok(mainline, "少了一串有序列表（主线五步）");
	/**
	 * ★ 这里**不写死条数**：主线的步数（5 步 / 6 步 / 拆并）是**内容**的事，用户随时会改
	 *   （曾经写死 `=== 5`，用户一改 md 就红，而东西是好的 —— 与 `check:host-skills` 那个
	 *   写死 "120.9 KB" 同一个毛病）。这一层只保证：**有序列表 + 一层子项**能解析出来。
	 */
	assert.ok(mainline.items.length >= 4, "主线应当至少 4 步，实际 " + mainline.items.length);
	assert.ok(mainline.items.some((i) => i.subs.length >= 2), "至少要有一项带子项（解析器的一层子项能力）");
	// ★ skill 一览那张表：三列，第一列是技能名（面板上它就是那张"表"）
	const roster = tables.find((t) => t.head.join("|") === "skill|干什么|关键产出");
	assert.ok(roster, "找不到 skill 一览那张表");
	assert.ok(roster.rows.length >= 8, "skill 一览至少 8 行，实际 " + roster.rows.length);
});
