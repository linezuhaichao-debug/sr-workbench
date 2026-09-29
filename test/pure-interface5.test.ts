/**
 * 定稿 §5 界面章解析 + 产出规范章节归类（迁移自 legacy/test-parse5.js、legacy/test-mdspec.js）。
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { parseInterfaceSection } from "../src/pure/interface5.ts";
import { classifyHeading, MD_SPECS, mdSpecOf, parseMdSections } from "../src/pure/mdspec.ts";
import { FINAL_GDD, WORKSPACE, readText, requireRealData } from "./paths.ts";

requireRealData();
const text = readText(FINAL_GDD);
const iface = parseInterfaceSection(text);

test("真实定稿 §5：4 个界面（UI-M1..M4）、7 张图、28 条 UE", () => {
	assert.ok(iface, "应解析出 §5");
	assert.equal(iface.found, true);
	assert.equal(iface.uiRows.length, 4);
	assert.deepEqual(
		iface.uiRows.map((r) => r.id),
		["UI-M1", "UI-M2", "UI-M3", "UI-M4"],
	);
	assert.deepEqual(
		iface.uis.map((u) => u.id),
		["UI-M1", "UI-M2", "UI-M3", "UI-M4"],
	);
	assert.equal(
		iface.uis.reduce((n, u) => n + u.images.length, 0),
		7,
	);
	assert.equal(
		iface.uis.reduce((n, u) => n + u.ueCount, 0),
		28,
	);
	assert.equal(iface.uis[0].title, "联盟悬赏主面板");
	assert.deepEqual(iface.uis[0].images, ["UI/UI-M1 联盟悬赏主面板 · 常规难度.png", "UI/UI-M1 联盟悬赏主面板 · 终极难度态.png"]);
});

test("没有 §5 时如实返回 null（面板显示「定稿里没有 §5 界面章」）", () => {
	assert.equal(parseInterfaceSection("# 标题\n\n## 1. 概览\n"), null);
	assert.equal(parseInterfaceSection(""), null);
});

test("章节规范：真实产出文件的标题都能归类，未知章节不丢", () => {
	const files = [
		path.join(WORKSPACE, "features", "联盟悬赏", "analysis", "concept-triage_联盟悬赏_20260918.md"),
		path.join(WORKSPACE, "features", "联盟悬赏", "analysis", "feature-concept_联盟悬赏_20260918.md"),
		path.join(WORKSPACE, "features", "神话宝库", "analysis", "experience-report_神话宝库_20260915.md"),
		path.join(WORKSPACE, "features", "神话宝库", "analysis", "replication-spec_神话宝库_20260915.md"),
		path.join(WORKSPACE, "features", "神话宝库", "evidence", "evidence-index_神话宝库_20260915.md"),
		path.join(WORKSPACE, "features", "神话宝库", "evidence", "readback_A079_神话宝库_20260916.md"),
	];
	const sizes: number[] = [];
	for (const f of files) {
		const spec = mdSpecOf(f);
		assert.ok(spec, "应有章节规范：" + f);
		const sections = parseMdSections(readText(f));
		sizes.push(sections.length);
		assert.ok(sections.length > 0, "真实产出应有顶层章节：" + f);
		for (const s of sections) {
			const cls = classifyHeading(s.title, spec.sections);
			assert.ok(
				cls === null || ["top", "body", "fold", "skip"].includes(cls),
				"归类值非法：" + s.title + " → " + cls,
			);
		}
	}
	assert.deepEqual(sizes, [11, 11, 14, 7, 3, 4]);
	assert.equal(MD_SPECS.length, 6);
	assert.equal(mdSpecOf("unknown-thing.md"), null);
});

test("parseMdSections：`## ` 切章节、`###` 留在父节体内、`# ` 不进章节", () => {
	const sections = parseMdSections("# 文档标题\n\n## 一\n\n### 子节\n正文\n\n## 二\n尾巴");
	assert.deepEqual(sections.map((s) => s.title), ["一", "二"]);
	assert.ok(sections[0].body.includes("### 子节"));
	assert.ok(sections[0].body.includes("正文"));
	assert.equal(sections[1].body, "尾巴");
});
