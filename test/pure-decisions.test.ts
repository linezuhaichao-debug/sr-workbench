/**
 * 决策记录（v5 的核心口径）—— 解析、时间戳、模板。
 *
 * 这一份钉住的是**用户直接要的那件事**：一个功能**只有一个**决策文件，
 * 条目形式 = **时间（年月日时分秒）+ 决策内容**。
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
	DECISION_FILE, DECISION_REL, decisionEntryTemplate, decisionHeader, decisionLineOf,
	hasStamp, parseDecisionLog, sortKeyOf, stampIn, stampOf, summaryOf
} from "../src/pure/decisions.ts";

const SAMPLE = [
	"# 决策记录 · 联盟讨伐",
	"",
	"<!-- 追加式账本 -->",
	"",
	"## 2026-10-08 14:23:05",
	"**决策**：采用方案 A —— 联盟成员共享 BOSS 血量。",
	"**依据**：上一轮访谈里三个人都提到「一个人打全盟看不到」。",
	"**影响**：§4 R2 的血量口径要改；配置表 BOSS 表要加一列。",
	"",
	"## 2026-10-08 16:02:11 · 定稿门",
	"**决策**：定稿通过，可以交程序。",
	"",
	"### 备注（不带时间戳的子标题）",
	"审查报告里有两条建议留到下一版。",
	""
].join("\n");

test("文件名与相对路径只有一处定义", () => {
	assert.equal(DECISION_FILE, "决策记录.md");
	assert.equal(DECISION_REL, "decisions/决策记录.md");
});

test("解析：条目 = 二级标题 + 时间戳；正文原样归属", () => {
	const log = parseDecisionLog(SAMPLE);
	assert.equal(log.present, true);
	assert.equal(log.title, "决策记录 · 联盟讨伐");
	assert.equal(log.entries.length, 2);

	assert.equal(log.entries[0].index, 1);
	assert.equal(log.entries[0].at, "2026-10-08 14:23:05");
	assert.equal(log.entries[0].title, "");
	assert.ok(log.entries[0].body.includes("采用方案 A"));
	assert.ok(log.entries[0].body.includes("**影响**：§4 R2"));

	assert.equal(log.entries[1].index, 2);
	assert.equal(log.entries[1].at, "2026-10-08 16:02:11");
	assert.equal(log.entries[1].title, "定稿门");
	// 不带时间戳的子标题并入上一条，并**如实提示**（不静默）
	assert.ok(log.entries[1].body.includes("### 备注（不带时间戳的子标题）"));
	assert.equal(log.issues.length, 1);
	assert.ok(log.issues[0].includes("没有时间戳"));
});

test("前言（第一条之前的说明）单独拿出来，不混进条目", () => {
	const log = parseDecisionLog(SAMPLE);
	assert.ok(log.preamble.includes("追加式账本"));
	assert.equal(log.preamble.includes("# 决策记录"), false, "一级标题是 title，不进前言");
});

test("空文件 / 没有条目：present 与 entries 都如实", () => {
	const empty = parseDecisionLog("");
	assert.equal(empty.present, false);
	assert.deepEqual(empty.entries, []);
	assert.deepEqual(empty.issues, [], "空文件不算错（文件还没建是正常状态）");

	const noEntry = parseDecisionLog("# 决策记录 · X\n\n还没有条目。\n");
	assert.equal(noEntry.present, true);
	assert.deepEqual(noEntry.entries, []);
	assert.equal(noEntry.issues.length, 1);
	assert.ok(noEntry.issues[0].includes("还没有带时间戳的条目"));
});

test("时间戳：规范写法 + 宽松写法都归一成 `YYYY-MM-DD HH:mm:ss`", () => {
	assert.equal(stampIn("## 2026-10-08 14:23:05"), "2026-10-08 14:23:05");
	assert.equal(stampIn("## 2026/10/8 9:05:07"), "2026-10-08 09:05:07");
	assert.equal(stampIn("## 2026.10.08 14:23:05 · 标题"), "2026-10-08 14:23:05");
	assert.equal(stampIn("## 20261008142305"), "2026-10-08 14:23:05");
	assert.equal(stampIn("## 没有时间的标题"), "");
	assert.equal(hasStamp("## 2026-10-08 14:23:05"), true);
	assert.equal(hasStamp("随便一句 2026-10-08"), false);
});

test("stampOf 是本地时间、补零、不受时区偏移影响", () => {
	assert.equal(stampOf(new Date(2026, 9, 8, 9, 5, 7)), "2026-10-08 09:05:07");
	assert.equal(stampOf(new Date(2026, 0, 1, 0, 0, 0)), "2026-01-01 00:00:00");
});

test("决策内容：取 `**决策**：…` 那一行；取不到就退成正文第一行", () => {
	assert.equal(decisionLineOf("**决策**：做 A。\n**依据**：因为 B。"), "做 A。");
	assert.equal(decisionLineOf("决策：做 A。"), "做 A。");
	assert.equal(decisionLineOf("没有标签的一段话。\n第二行"), "没有标签的一段话。");
	assert.equal(decisionLineOf(""), "");
	const long = "决".repeat(300);
	assert.ok(summaryOf("**决策**：" + long, 40).length <= 41, "摘要按上限截断（加一个省略号）");
});

test("排序键：`YYYYMMDDHHmmss`（取不到就是空串）", () => {
	assert.equal(sortKeyOf("2026-10-08 14:23:05"), "20261008142305");
	assert.equal(sortKeyOf(""), "");
});

test("模板：文件头与条目模板都是**能直接抄**的那一份", () => {
	const header = decisionHeader("联盟讨伐");
	assert.ok(header.startsWith("# 决策记录 · 联盟讨伐"));
	assert.ok(header.includes("追加式账本"));
	assert.ok(decisionHeader("").includes("# 决策记录 · <主题>"));

	const entry = decisionEntryTemplate("2026-10-08 14:23:05");
	assert.equal(entry.split("\n")[0], "## 2026-10-08 14:23:05");
	assert.ok(entry.includes("**决策**："));
	// 模板写出来的条目，解析器认得出（模板与解析器同一口径）
	const log = parseDecisionLog(entry);
	assert.equal(log.entries.length, 1);
	assert.equal(log.entries[0].at, "2026-10-08 14:23:05");
	assert.equal(decisionEntryTemplate("2026-10-08 14:23:05", "标题").split("\n")[0], "## 2026-10-08 14:23:05 · 标题");
});
