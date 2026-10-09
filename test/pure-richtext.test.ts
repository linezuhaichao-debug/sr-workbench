/** 行内加粗解析的判据。 */
import assert from "node:assert/strict";
import test from "node:test";

import { hasBold, inlineRuns } from "../src/pure/richtext.ts";

test("拆 **加粗**：前后文都留着，粗体段单独成片", () => {
	assert.deepEqual(inlineRuns("**B008-副玩法技能表** 与 INDEX"), [
		{ text: "B008-副玩法技能表", bold: true },
		{ text: " 与 INDEX", bold: false }
	]);
});

test("`__x__` 也认（两种写法都在用）", () => {
	assert.deepEqual(inlineRuns("__A079__ 是唯一活配置"), [
		{ text: "A079", bold: true },
		{ text: " 是唯一活配置", bold: false }
	]);
});

test("一段里多处加粗：逐段拆开，顺序不变", () => {
	const r = inlineRuns("**成稿门 approve** —— 见 **§1–§12** 与附录");
	assert.deepEqual(r, [
		{ text: "成稿门 approve", bold: true },
		{ text: " —— 见 ", bold: false },
		{ text: "§1–§12", bold: true },
		{ text: " 与附录", bold: false }
	]);
});

test("不闭合 / 空内容 / 跨行：**原样保留**（宁可少渲染，不可丢字）", () => {
	assert.deepEqual(inlineRuns("**没闭合的加粗"), [{ text: "**没闭合的加粗", bold: false }]);
	assert.deepEqual(inlineRuns("****"), [{ text: "****", bold: false }]);
	assert.deepEqual(inlineRuns("**   **"), [{ text: "**   **", bold: false }], "全是空白不当加粗");
	assert.deepEqual(inlineRuns("上**下\n一**行"), [{ text: "上**下\n一**行", bold: false }], "跨行不吃");
});

test("单星号不动（配置表名里常有 *，误吃会丢字）", () => {
	assert.deepEqual(inlineRuns("*CS-20261009-001* 已批准"), [{ text: "*CS-20261009-001* 已批准", bold: false }]);
	assert.equal(hasBold("*x*"), false);
});

test("没有加粗时原样一片；空串给空数组", () => {
	assert.deepEqual(inlineRuns("就是普通一句话"), [{ text: "就是普通一句话", bold: false }]);
	assert.equal(hasBold("就是普通一句话"), false);
	assert.deepEqual(inlineRuns(""), []);
	assert.deepEqual(inlineRuns(null), []);
	assert.equal(hasBold("**有**"), true);
});

test("一个字都不吞：被吃掉的只有**成对的标记**，不闭合的原样留着", () => {
	// 成对标记被消费掉（这正是渲染的目的），但除了标记一个字都不少
	assert.equal(inlineRuns("**B008** 与 INDEX 的映射").map((r) => r.text).join(""), "B008 与 INDEX 的映射");
	assert.equal(inlineRuns("__A__ 和 **B** 和普通字").map((r) => r.text).join(""), "A 和 B 和普通字");
	// 不成对/不该吃的：原样出现，连星号都在
	assert.equal(inlineRuns("**没闭合").map((r) => r.text).join(""), "**没闭合");
	assert.equal(inlineRuns("*单星号* 与 **双星号**").map((r) => r.text).join(""), "*单星号* 与 双星号");
	assert.deepEqual(inlineRuns(""), []);
});
