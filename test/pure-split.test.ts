/**
 * 渲染器支持不稳的两种结构：围栏代码块 + HTML `<img>`（迁移自 legacy/test-mdcheck.js 的关切）。
 *
 * ★ 这两条断言正是"测试要跑真实数据"的样板：真实定稿里有 **4 段 fenced code**（info 都是 text）
 *   与 **7 个 `<img src>`**（相对定稿目录、**含空格与中点号**），两者若不单独切出来，
 *   通用 markdown 渲染器会报 `Cannot read properties of undefined (reading 'code')`。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { parseFinalGdd } from "../src/pure/finalgdd.ts";
import { splitImgs, splitSpecial } from "../src/pure/split.ts";
import { FINAL_GDD, readText, requireRealData } from "./paths.ts";

requireRealData();
const text = readText(FINAL_GDD);

test("真实定稿：4 段 fenced code + 7 个 <img>，各被单独切出", () => {
	const parts = splitSpecial(text);
	const code = parts.filter((p) => p.t === "code");
	const imgs = parts.filter((p) => p.t === "img");
	assert.equal(code.length, 4, "应有 4 段围栏代码");
	assert.equal(imgs.length, 7, "应有 7 个 HTML img");
	assert.ok(code.every((c) => c.lang === "text"), "四段代码的 info 都是 text");
	assert.equal(parts.every((p) => ["md", "code", "img"].includes(p.t)), true);
});

test("真实图片路径：相对定稿目录、含空格与中点号，原样保留", () => {
	const imgs = splitSpecial(text).filter((p) => p.t === "img");
	assert.deepEqual(
		imgs.map((p) => p.v),
		[
			"UI/UI-M1 联盟悬赏主面板 · 常规难度.png",
			"UI/UI-M1 联盟悬赏主面板 · 终极难度态.png",
			"UI/UI-M2 排行榜弹窗 · 个人排名.png",
			"UI/UI-M2 排行榜弹窗 · 联盟排名.png",
			"UI/UI-M3 出刀战斗 · 结算面板.png",
			"UI/UI-M3 出刀战斗 · 战斗统计数据面板.png",
			"UI/UI-M4 通关奖励预览弹窗.png",
		],
	);
});

test("切分不丢内容：md 段与原文逐字对得上（去掉被抽走的片段后完全一致）", () => {
	const parts = splitSpecial(text);
	const rejoined = parts
		.filter((p) => p.t === "md")
		.map((p) => p.v)
		.join("");
	// 被抽走的部分一定不在 md 段里
	assert.equal(rejoined.includes("UI-M1 联盟悬赏主面板 · 常规难度.png"), false);
	assert.equal(rejoined.includes("```text"), false);
	assert.ok(rejoined.length > 0 && rejoined.length < text.length);
});

test("边界：空串 / 只有图片 / 未闭合围栏", () => {
	assert.deepEqual(splitSpecial(""), [{ t: "md", v: "" }]);
	assert.deepEqual(splitImgs("<img src='a.png'><img src=\"b.png\" alt=\"B\">"), [
		{ t: "img", v: "a.png", alt: "" },
		{ t: "img", v: "b.png", alt: "B" },
	]);
	// 未闭合的围栏不当代码块（整段还是 md）
	const parts = splitSpecial("前置\n```text\n没闭合\n");
	assert.equal(parts.filter((p) => p.t === "code").length, 0);
});

test("综合：定稿 parse 出来的每个块都可以单独切分（面板按块渲染）", () => {
	const doc = parseFinalGdd(text);
	let code = 0;
	let img = 0;
	for (const b of doc.blocks) {
		for (const p of splitSpecial(b.text)) {
			if (p.t === "code") code++;
			if (p.t === "img") img++;
		}
	}
	assert.equal(code, 4);
	assert.equal(img, 7);
});
