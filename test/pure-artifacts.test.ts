/**
 * 「最终产物」分组（纯函数）—— 五类（含**配置表**）+ 其它、排序、最新定稿标注、不丢文件。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { annotateFinals, featureArtifacts } from "../src/pure/artifacts.ts";
import { configArtifactOf, outputGroupOf } from "../src/pure/buckets.ts";

const LISTING = {
	analysis: {
		files: ["experience-report_联盟讨伐_20260915.md", "issue-cards_联盟讨伐_20260915.json"],
		nested: { 证据: ["frame-001.png"] }
	},
	gdd: {
		files: [
			"联盟讨伐_20260918.md",
			"联盟讨伐_20260923_定稿.md",
			"联盟讨伐_20260921_定稿.md",
			"联盟讨伐_20260923_定稿_审查.md",
			"联盟讨伐_宣讲_20260924.html",
			"联盟讨伐_宣讲_20260924.content.json"
		],
		nested: { UI: ["UI-M1.png"] }
	}
};

/** 配置表这条线的清单（口径：落 `gdd\`）。**故意也放一份在 `analysis\`** —— 那是落错桶的鲁棒性用例。 */
const CONFIG_LISTING = {
	analysis: {
		files: ["CS-20261009-001.yaml", "CS-20261009-001_读回验收报告.md"],
		nested: {}
	},
	gdd: {
		files: ["联盟讨伐_配置表_20261009.xlsx", "联盟讨伐_20261009_定稿.md"],
		nested: {}
	}
};

test("配置表：**按内容认** —— 落错桶也归配置表（不掉进头脑风暴），且不抢成稿/定稿", () => {
	// 认的三类
	assert.equal(outputGroupOf("gdd", "CS-20261009-001.yaml"), "config", "change set");
	assert.equal(outputGroupOf("analysis", "CS-20261009-001.yaml"), "config", "落错桶（写在 analysis\\）也归配置表，不许冒充分析结论");
	assert.equal(outputGroupOf("gdd", "CS-20261009-001_读回验收报告.md"), "config", "读回验收报告");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_配置表_20261009.xlsx"), "config", "运行时表本体");
	assert.equal(outputGroupOf("gdd", "旧表.xlsm"), "config");
	assert.equal(outputGroupOf("gdd", "导出.csv"), "config");
	// 不该被抢走的
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20261009_定稿.md"), "final", "定稿仍然是定稿");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260918.md"), "draft");
	assert.equal(outputGroupOf("analysis", "experience-report_x.md"), "brainstorm");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_宣讲_20260924.html"), "speech");
	// 判据本身：别把近似名字误判成配置表
	assert.equal(configArtifactOf("CS-2026.yaml"), false, "格式不完整的 CS 名不算");
	assert.equal(configArtifactOf("读回验收报告.md"), false, "缺前缀的不算（避免误伤普通 md）");
	assert.equal(configArtifactOf(""), false);
	assert.equal(configArtifactOf(null), false);
});

test("配置表成组：change set + 验收报告 + 表本体各就各位，且组头如实显示**实际目录**", () => {
	const a = featureArtifacts(CONFIG_LISTING);
	const cfg = a.groups.filter((g) => g.key === "config")[0];
	assert.ok(cfg, "要有 config 组");
	assert.equal(cfg.count, 3, "两张 yaml/md + 一张 xlsx");
	assert.deepEqual(cfg.files.map((f) => f.name).sort(), ["CS-20261009-001.yaml", "CS-20261009-001_读回验收报告.md", "联盟讨伐_配置表_20261009.xlsx"]);
	assert.equal(cfg.dir, "analysis · gdd", "跨目录时如实列全（这份用例故意落错一个）");
	assert.equal(a.counts.draft, 0, "这份清单里没有成稿（只有一份 _定稿.md）");
	assert.equal(a.counts.final, 1, "定稿仍算定稿组");
});

test("五类恒在（空组也出现，count=0）+ 其它兜底", () => {
	const a = featureArtifacts(LISTING);
	assert.deepEqual(a.groups.map((g) => g.key), ["brainstorm", "draft", "final", "speech", "config", "other"]);
	// 每类都带桶名（界面只显示这个短标签）与一个空的 dynamic
	assert.equal(a.groups[0].dir, "analysis", "有文件 ⇒ 显示**实际**位置");
	assert.equal(a.groups[1].dir, "gdd");
	// ★ 空组回退到**规范落点**（用户实测：空的「定稿」「HTML 宣讲稿」组头没有路径，看着像坏了）
	assert.equal(a.groups[4].dir, "gdd", "空组显示这一类该放哪里（规范落点），不是留空");
	assert.equal(a.groups[5].dir, "gdd", "other 这份清单里的文件都在 gdd（含嵌套 UI\\）");
	assert.ok(a.groups.every((g) => g.dynamic === ""), "没状况就不该有 dynamic");
	assert.deepEqual(a.counts, { brainstorm: 3, draft: 1, final: 2, speech: 1, config: 0, other: 3 });
	assert.equal(a.groups[4].dir, "gdd", "配置表规范落点是 gdd\\（空组也显示它）");
	assert.equal(a.total, 10, "面板列出的条目总数（一个都不丢）");
	assert.equal(a.allPaths.length, a.total);
	// 子目录里的文件带上了它的子目录
	const evidence = a.groups[0].files.filter((f) => f.name === "frame-001.png")[0];
	assert.equal(evidence.rel, "analysis/证据/frame-001.png");
	assert.equal(evidence.subdir, "证据");
});

test("绝不造条目：空列举 → 全是 0", () => {
	const a = featureArtifacts({});
	assert.deepEqual(a.counts, { brainstorm: 0, draft: 0, final: 0, speech: 0, config: 0, other: 0 });
	assert.equal(a.total, 0);
	assert.equal(a.allPaths.length, 0);
});

test("成稿 / 定稿按文件名日期倒序（新的在前）", () => {
	const a = featureArtifacts(LISTING);
	const finals = a.groups.filter((g) => g.key === "final")[0];
	assert.deepEqual(finals.files.map((f) => f.name), ["联盟讨伐_20260923_定稿.md", "联盟讨伐_20260921_定稿.md"]);
});

test("最新定稿标注只按**文件名日期**（面板不替定稿门背书），同日多份如实并列", () => {
	const a = featureArtifacts({
		gdd: { files: ["X_20260923_定稿.md", "X_20260921_定稿.md", "Y_20260923_定稿.md"] }
	});
	annotateFinals(a.groups);
	const g = a.groups.filter((x) => x.key === "final")[0];
	const noteOf = (n: string) => (g.files.filter((f) => f.name === n)[0] || {}).note;
	assert.equal(noteOf("X_20260921_定稿.md"), "历史版本");
	assert.ok(String(noteOf("X_20260923_定稿.md")).includes("最新"));
	assert.ok(String(g.dynamic).includes("现有 3 份"), "这一组的现状进 dynamic（界面上那行小字）");
	assert.ok(String(g.dynamic).includes("定稿门"), "措辞里要说清面板不替定稿门背书");
	assert.ok(String(g.note).includes("gdd"), "note 是永远成立的说明（收进 tooltip）：" + g.note);
	assert.equal(g.dir, "gdd", "定稿在 gdd 桶");
});

test("analysis\\ 里的一切都算头脑风暴产物（含子目录）", () => {
	const a = featureArtifacts({ analysis: { files: ["随便.bin"], nested: { sub: ["另一个.dat"] } } });
	assert.equal(a.counts.brainstorm, 2);
	assert.equal(a.counts.other, 0);
});
