/**
 * 头脑风暴工作面 · 两种新格式的解析与四入口归类（工单 23，设计 §4.1 / §4.2）。
 *
 * ★ 两类断言：
 *   ① **格式样例**（`test/fixtures/analysis/`）—— 按 §4.2.1 / §4.2.2 逐字写的两份产物；
 *      旧文档分析那份的「原文（转换后）」取自工作区里**真有**的
 *      `inbox\imported\飞船装置\《飞船装置》功能文档.docx`（真段落，不是我编的）。
 *   ② **真实工作区数据** —— 真功能目录里的分析产物按四入口归类（真文件名 + 真 `source_skill`）。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
	ENTRANCES,
	analysisDocKind,
	entryOfAnalysis,
	groupAnalyses,
	humanNoteName,
	legacyDocName,
	parseHumanNote,
	parseLegacyAnalysis,
	parseQuote,
	sourceSkillOf
} from "../src/pure/analysisdoc.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, "fixtures", "analysis");
const LEGACY_FILE = "legacy-analysis_飞船装置_20260930.md";
const NOTE_FILE = "human-note_BOSS血量按联盟共享_20260921.md";
const readFixture = (n: string) => fs.readFileSync(path.join(FIX, n), "utf8");
const SR_ROOT = "D:\\TimeMachine\\GameDesignOS\\workspace";

test("四入口表：四个 id · 不分主次（顺序即设计 §4.1 的表）", () => {
	assert.deepEqual(ENTRANCES.map((e: any) => e.id), ["analysis", "concept", "legacy", "humannote"]);
	for (const e of ENTRANCES) {
		// 每张卡都必须说清"前置条件"与"跑什么/产出落哪"—— 工单 23 第 1 条
		assert.ok(e.needs && e.needs.length > 4, e.id + " 缺前置条件");
		assert.ok(e.output && e.output.length > 4, e.id + " 缺产出");
		assert.ok(e.hint && e.handoff, e.id + " 缺 hint / handoff");
	}
	// 两个 skill 入口要**明写跑哪个 skill**（工单 23 第 1 条）
	assert.equal(ENTRANCES[0].hint, "跑 /sr-analysis");
	assert.equal(ENTRANCES[1].hint, "跑 /sr-concept");
});

test("文件名规则：产出名的唯一出处（指令里写的名字 = 读取侧认得的名字）", () => {
	assert.equal(legacyDocName("D:\\旧案\\英雄改造v0.2.xlsx", "20260930"), "legacy-analysis_英雄改造v0.2_20260930.md");
	assert.equal(humanNoteName("BOSS 血量按联盟共享", "20260921"), "human-note_BOSS 血量按联盟共享_20260921.md");
	// 反过来：读取侧按前缀认得这两种格式
	assert.equal(analysisDocKind(legacyDocName("飞船装置", "20260930")), "legacy");
	assert.equal(analysisDocKind(humanNoteName("BOSS 血量按联盟共享", "20260921")), "humannote");
	assert.equal(analysisDocKind("D:/x/experience-report_神话宝库_20260915.md"), "");
});

test("旧文档分析：四段固定章节一个不少（用格式样例，原文段取自真 docx）", () => {
	const d = parseLegacyAnalysis(readFixture(LEGACY_FILE), LEGACY_FILE);
	assert.equal(d.kind, "legacy");
	assert.equal(d.docType, "legacy_analysis");
	assert.equal(d.topic, "飞船装置");
	// ★ 原件进原料桶、产出文档的身份信息指向原件（工单 23 第 5 条）
	assert.equal(d.source, "source/《飞船装置》功能文档.docx");
	assert.equal(d.analyzedAt, "20260930");
	assert.equal(d.title, "旧文档分析：飞船装置");
	assert.deepEqual(d.sections.map((s: any) => s.key), ["valid", "dropped", "reuse", "raw"]);
	assert.deepEqual(d.sections.map((s: any) => s.present), [true, true, true, true]);
	assert.deepEqual(d.missing, []);
	// 「已废弃」必须写理由（设计 §4.2.1 的三条纪律之一）
	assert.ok(/理由：/.test(d.sections[1].body), "已废弃段没有写理由");
	// 可复用条目是表格：旧文档位置 | 内容 | 去向
	assert.deepEqual(d.reuse.header, ["旧文档位置", "内容", "去向"]);
	assert.ok(d.reuse.rows.length >= 3, "可复用条目行数 " + d.reuse.rows.length);
	assert.equal(d.reuse.rows[0][0], "§7.1");
	// 原文在末尾、保留章节结构
	assert.ok(d.raw.includes("### 7.1 系统入口"), "原文段没保留章节结构");
	assert.ok(d.extra.length === 0, "样例里不该有未归类章节");
});

test("旧文档分析：缺段与多出来的章节都如实报（不静默丢）", () => {
	const text = "---\ndoc_type: legacy_analysis\ntopic: X\n---\n\n# 旧文档分析：X\n\n## 仍然有效的结论\n- a\n\n## 我自创的一节\n- b\n";
	const d = parseLegacyAnalysis(text, "legacy-analysis_X_20260930.md");
	assert.deepEqual(d.missing, ["已废弃 / 不适用", "可复用条目", "原文（转换后）"]);
	assert.equal(d.sections[0].present, true);
	assert.deepEqual(d.extra.map((x: any) => x.title), ["我自创的一节"]);
});

test("人工补充：原话逐字取出，且与结论分列（并排显示的数据形态）", () => {
	const d = parseHumanNote(readFixture(NOTE_FILE), NOTE_FILE);
	assert.equal(d.kind, "humannote");
	assert.equal(d.docType, "human_note");
	assert.equal(d.topic, "联盟悬赏");
	assert.equal(d.confidence, "high");
	assert.equal(d.date, "20260921");
	assert.equal(d.author, "祖海潮");
	assert.equal(d.title, "BOSS 血量按联盟共享");
	// ★ 原话逐字（含「」），一个字都不许被摘要替代
	assert.equal(d.quote.found, true);
	assert.equal(d.quote.raw, "> 原话：「BOSS 的血条应该是全盟共享的，一个人打全盟都能看到」");
	assert.equal(d.quote.text, "「BOSS 的血条应该是全盟共享的，一个人打全盟都能看到」");
	assert.ok(d.conclusion.includes("全盟共享同一条 BOSS 血条"));
	assert.ok(d.bounds.includes("仅在活动期间成立"));
	assert.ok(d.landing.includes("§5 UI-M1 UE2 血条区"));
	assert.deepEqual(d.missing, []);
	assert.deepEqual(d.extra, []);
});

test("原话那一行的三种写法都认（认不出就如实说没有）", () => {
	assert.deepEqual(parseQuote("> 原话：「甲」"), { raw: "> 原话：「甲」", text: "「甲」", found: true });
	assert.equal(parseQuote("> 原话：乙").text, "乙");
	assert.equal(parseQuote("> 原话: \"丙\"").text, "\"丙\"");
	assert.equal(parseQuote("## 结论\n没有原话").found, false);
});

test("一条分析产物属于哪个入口：文件名前缀 → md 规范名 → 交接件的 source_skill", () => {
	// ① 两种新格式按前缀
	assert.equal(entryOfAnalysis(LEGACY_FILE), "legacy");
	assert.equal(entryOfAnalysis(NOTE_FILE), "humannote");
	// ② mdspec 的六种规范名（真文件名）
	assert.equal(entryOfAnalysis("experience-report_神话宝库_20260915.md"), "analysis");
	assert.equal(entryOfAnalysis("issue-cards_神话宝库_20260915.json"), "analysis");
	assert.equal(entryOfAnalysis("replication-spec_神话宝库_20260915.md"), "analysis");
	assert.equal(entryOfAnalysis("evidence-index_神话宝库_20260915.md"), "analysis");
	assert.equal(entryOfAnalysis("concept-triage_联盟悬赏_20260918.md"), "concept");
	assert.equal(entryOfAnalysis("feature-concept_联盟悬赏_20260918.md"), "concept");
	// ③ 交接件两条路都产出过：看它自己的 source_skill，认不出就归「其他/来源未知」
	assert.equal(entryOfAnalysis("sr-gdd-handoff_联盟悬赏_20260918.json", "sr-concept"), "concept");
	assert.equal(entryOfAnalysis("sr-gdd-handoff_神话宝库_20260915.json", "sr-analysis"), "analysis");
	assert.equal(entryOfAnalysis("sr-gdd-handoff_X_20260918.json", ""), "other");
	// ④ 认不出来的一律进"其他"，不硬塞
	assert.equal(entryOfAnalysis("随便一份笔记.md"), "other");
});

test("sourceSkillOf：只读交接件里那一个字段（真文件）", () => {
	const p = path.join(SR_ROOT, "features", "讨伐", "analysis", "sr-gdd-handoff_联盟悬赏_20260918.json");   // ★ 2026-10-08：目录改名
	const head = fs.readFileSync(p, "utf8").split(/\r?\n/).slice(0, 14).join("\n");
	assert.equal(sourceSkillOf(head), "sr-concept");
	assert.equal(sourceSkillOf('{"a":1}'), "");
});

test("groupAnalyses：恒四组（空组也出现 = 这一路还没走过）", () => {
	const files = [
		{ name: "concept-triage_联盟悬赏_20260918.md" },
		{ name: "feature-concept_联盟悬赏_20260918.md" },
		{ name: "sr-gdd-handoff_联盟悬赏_20260918.json", skill: "sr-concept" },
		{ name: LEGACY_FILE },
		{ name: NOTE_FILE },
		{ name: "没规范的东西.md" }
	];
	const g = groupAnalyses(files);
	assert.deepEqual(g.entries.map((e: any) => e.id), ["analysis", "concept", "legacy", "humannote"]);
	assert.deepEqual(g.counts, { analysis: 0, concept: 3, legacy: 1, humannote: 1 });
	assert.equal(g.other.length, 1);
	assert.equal(g.total, 6);
});
