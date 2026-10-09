/** 技能用法解析的判据（T0）。 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { cardTitleOf, parseRoutes, parseStandalone, parseSteps, parseTeaching, sectionOf } from "../src/pure/teaching.ts";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASKME = path.join(REPO, "skills", "sr-askme");
const SKILL_MD = path.join(ASKME, "SKILL.md");
const CARDS_DIR = path.join(ASKME, "references", "teaching");

const readCards = () => fs.readdirSync(CARDS_DIR).filter((n) => n.endsWith(".md"))
	.map((n) => ({ rel: "references/teaching/" + n, text: fs.readFileSync(path.join(CARDS_DIR, n), "utf8") }));

test("取节：二级标题之间的正文，遇到同级标题就停", () => {
	const md = ["## A", "a1", "## B", "b1", "### b2", "b2x", "## C", "c1"].join("\n");
	assert.equal(sectionOf(md, "## B"), ["b1", "### b2", "b2x"].join("\n"));
	assert.equal(sectionOf(md, "## 没有这节"), "");
});

test("主线编号项：标题与正文分开，正文里保留子项", () => {
	const sec = [
		"**主线**：五个步骤：",
		"",
		"1. **入口**",
		"   - 一句话创意 → `/sr-concept`",
		"2. **成稿**：`/sr-gdd-human` 出成稿",
		"3. **落配置**：`/sr-config` 派生配置表"
	].join("\n");
	const steps = parseSteps(sec);
	assert.deepEqual(steps.map((s) => s.n), [1, 2, 3], "编号要留住");
	assert.deepEqual(steps.map((s) => s.title), ["入口", "成稿", "落配置"]);
	assert.ok(steps[0].text.includes("/sr-concept"), "第 1 项的子项要跟着它");
	assert.ok(steps[1].text.includes("/sr-gdd-human"));
	assert.equal(steps[1].text.includes("落配置"), false, "不许把下一项吃进来");
});

test("速查表：只取数据行，表头与分隔行不要", () => {
	const sec = ["| 你想做什么 | 用哪个 |", "| --- | --- |", "| \"我有个创意\" | `/sr-concept` |", "| \"加字段\" | `/sr-config` |"].join("\n");
	const routes = parseRoutes(sec);
	assert.deepEqual(routes.map((r) => r.skill), ["`/sr-concept`", "`/sr-config`"]);
	assert.equal(routes[0].want, "我有个创意", "两头引号去掉");
});

test("独立技能那一句照抄原文（面板直接显示）", () => {
	const sec = ["**独立技能**（不在主线，需要时单独用）：`/sr-gtgenerator`、`/sr-gdd-review`——各自做什么见下表。"].join("\n");
	assert.ok(parseStandalone(sec).indexOf("**独立技能**") === 0);
	assert.equal(parseStandalone("没有这句"), "");
});

test("教学卡标题：取第一个一级标题；没有就退回文件名", () => {
	assert.equal(cardTitleOf("# SR-Analysis 使用卡\n\n职责…", "sr-analysis"), "SR-Analysis 使用卡");
	assert.equal(cardTitleOf("没有标题", "sr-analysis"), "sr-analysis");
});

test("真数据：sr-askme 的教学素材必须解析得出来（这是本功能的硬前提）", () => {
	const model = parseTeaching({ skillMd: fs.readFileSync(SKILL_MD, "utf8"), cards: readCards() });
	assert.equal(model.ok, true, "解析不通过：" + model.problems.join("；"));
	assert.ok(model.steps.length >= 4, "主线步骤至少 4 步，实际 " + model.steps.length);
	assert.ok(model.routes.length >= 8, "速查表至少 8 行，实际 " + model.routes.length);
	assert.equal(model.rules.length, 2, "两个规则节都要在：" + model.rules.map((r) => r.title).join("、"));
	assert.ok(model.cards.length >= 8, "教学卡至少 8 张，实际 " + model.cards.length);
	// 主线里出现的技能名，必须能在速查表里找到（否则弹窗会出现"无出处的技能"）
	const routeText = model.routes.map((r) => r.skill).join(" ") + " " + model.standalone;
	for (const s of model.steps) {
		for (const m of s.text.matchAll(/`(\/sr-[a-z-]+)`/g)) {
			assert.ok(routeText.includes(m[1]), "主线提到的 " + m[1] + " 在速查表/独立技能里找不到出处");
		}
	}
});

test("解析不出来时如实报问题，不编内容", () => {
	const model = parseTeaching({ skillMd: "# 空文件", cards: [] });
	assert.equal(model.ok, false);
	assert.deepEqual(model.steps, []);
	assert.deepEqual(model.routes, []);
	assert.ok(model.problems.length >= 4, "四块都该报缺：" + model.problems.join("；"));
});
