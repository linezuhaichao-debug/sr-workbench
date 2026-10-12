/**
 * 「最终产物」分组（纯函数）—— 五类（含**配置表**）+ 其它 + **过程留痕只报数**、排序、最新定稿标注、不丢文件。
 *
 * ★ 2026-10-13 口径：**过程留痕不算产物**（用户口径）—— 产物历史版本 / 变更集 / 读回验收报告 /
 *   审查报告 / 修订点清单不上列表，只在页签底部报数。纪律不变：`total + trace.count` 等于两个桶的全部文件。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { annotateCurrent, featureArtifacts } from "../src/pure/artifacts.ts";
import { configArtifactOf, outputGroupOf, traceArtifactOf, traceKindOf } from "../src/pure/buckets.ts";

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

test("配置表这一类**只装表本体**；变更集与验收报告是留痕、不进任何产物类（落错桶也不冒充分析结论）", () => {
	// 表本体 → 「配置表」这一类
	assert.equal(outputGroupOf("gdd", "联盟讨伐_配置表_20261009.xlsx"), "config", "运行时表本体");
	assert.equal(outputGroupOf("gdd", "旧表.xlsm"), "config");
	assert.equal(outputGroupOf("gdd", "导出.csv"), "config");
	// ★ 留痕：**先拦**（不管落在哪个桶）—— 它们不是"这个功能产出的东西"
	assert.equal(outputGroupOf("gdd", "CS-20261009-001.yaml"), "trace", "change set 是留痕，不是产物");
	assert.equal(outputGroupOf("analysis", "CS-20261009-001.yaml"), "trace", "落错桶（写在 analysis\\）也还是留痕，不许冒充分析结论");
	assert.equal(outputGroupOf("gdd", "CS-20261009-001_读回验收报告.md"), "trace", "读回验收报告");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260923_定稿_审查.md"), "trace", "审查报告");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260924_修订点.md"), "trace", "修订点清单");
	// 不该被抢走的
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20261009_定稿.md"), "final", "定稿仍然是定稿");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260918.md"), "draft");
	assert.equal(outputGroupOf("analysis", "experience-report_x.md"), "brainstorm");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_宣讲_20260924.html"), "speech");
	// 判据本身：别把近似名字误判
	assert.equal(configArtifactOf("CS-2026.yaml"), false, "格式不完整的 CS 名不算");
	assert.equal(configArtifactOf("读回验收报告.md"), false, "缺前缀的不算（避免误伤普通 md）");
	assert.equal(configArtifactOf(""), false);
	assert.equal(configArtifactOf(null), false);
	assert.equal(traceArtifactOf("联盟讨伐_配置表_20261009.xlsx"), false, "表本体是交付物，不是留痕");
	assert.equal(traceArtifactOf("联盟讨伐_宣讲_20260924.content.json"), false, "宣讲源数据是产物这条线上的");
	assert.equal(traceArtifactOf("随便_审查报告.md"), false, "只认 `_审查.md` 后缀，别误伤普通名字");
	assert.equal(traceKindOf("CS-20261009-001.yaml"), "changeset");
	assert.equal(traceKindOf("联盟讨伐_20260924_修订点.md"), "fixpoints");
	assert.equal(traceKindOf("随便.md"), "");
	assert.equal(traceArtifactOf(""), false);
	assert.equal(traceArtifactOf(null), false);
});

test("产物历史版本**进它当前版那一类**（用户口径：要在最终产物里看到历史版本）", () => {
	// 口径见 skills/sr-askme/references/version-history.md
	const a = featureArtifacts({
		gdd: {
			files: [
				"A079-联盟讨伐.xlsx",
				"A079-联盟讨伐_20261012_1.xlsx",
				"A079-联盟讨伐_20261012_2.xlsx",
				"联盟讨伐_定稿.md",
				"联盟讨伐_定稿_20261012_1.md"
			]
		}
	});
	const cfg = a.groups.filter((g) => g.key === "config")[0];
	assert.equal(cfg.count, 3, "「配置表」= 当前表 + 两份旧版");
	assert.deepEqual(
		cfg.files.map((f) => f.name),
		["A079-联盟讨伐.xlsx", "A079-联盟讨伐_20261012_2.xlsx", "A079-联盟讨伐_20261012_1.xlsx"],
		"★ 当前版排第一，历史版本按版本号**倒序**跟在后面"
	);
	const fin = a.groups.filter((g) => g.key === "final")[0];
	assert.equal(fin.count, 2, "「定稿」= 当前定稿 + 一份旧版");
	assert.deepEqual(fin.files.map((f) => f.name), ["联盟讨伐_定稿.md", "联盟讨伐_定稿_20261012_1.md"]);
	assert.equal(fin.files[0].isHistory, false);
	assert.equal(fin.files[1].isHistory, true);
	assert.equal(a.counts.draft, 0, "定稿的旧版**不是成稿**");
	assert.equal(a.trace.count, 0, "★ 历史版本**不是留痕**（不进底部报数）");
	assert.equal(a.total, 5, "五份全在列表里（一个都不丢）");
	// 标注：当前 / 历史版本
	annotateCurrent(a.groups);
	assert.equal(fin.files[0].note, "〔当前〕");
	assert.equal(fin.files[1].note, "〔历史版本〕");
	assert.equal(fin.dynamic, "", "★ 不再写那行小字（用户反馈看不懂；组头件数 + 标签已经说清了）");
	assert.equal(cfg.files[0].note, "〔当前〕");
});

test("留痕只认四类（历史版本已移出），报数按固定顺序", () => {
	const a = featureArtifacts({
		gdd: {
			files: [
				"X_修订点.md",
				"X_审查.md",
				"CS-20261009-002.yaml",
				"CS-20261009-001_读回验收报告.md",
				"X_定稿_20261012_1.md",
				"X_定稿.md"
			]
		}
	});
	assert.equal(a.trace.count, 4, "变更集 / 读回验收报告 / 审查报告 / 修订点");
	assert.equal(a.trace.summary, "1 份变更集 · 1 份读回验收报告 · 1 份审查报告 · 1 份修订点清单");
	assert.equal(a.total, 2, "定稿（当前 + 历史版本）都在列表里");
});

test("配置表成组：表本体在类里、变更集与验收报告进留痕账（一个都不丢）", () => {
	const a = featureArtifacts(CONFIG_LISTING);
	const cfg = a.groups.filter((g) => g.key === "config")[0];
	assert.ok(cfg, "要有 config 组");
	assert.equal(cfg.count, 1, "这一类现在**只装表本体**");
	assert.deepEqual(cfg.files.map((f) => f.name), ["联盟讨伐_配置表_20261009.xlsx"]);
	assert.equal(cfg.dir, "gdd", "表本体在 gdd");
	assert.equal(a.counts.draft, 0, "这份清单里没有成稿（只有一份 _定稿.md）");
	assert.equal(a.counts.final, 1, "定稿仍算定稿组");
	// ★ 留痕那一笔账：两份（其中一份故意落在 analysis\\）
	assert.equal(a.trace.count, 2);
	assert.equal(a.trace.summary, "1 份变更集 · 1 份读回验收报告");
	assert.deepEqual(a.trace.allPaths.slice().sort(), ["analysis/CS-20261009-001.yaml", "analysis/CS-20261009-001_读回验收报告.md"]);
	assert.equal(a.total, 2, "列出来的是 表本体 + 定稿");
	assert.equal(a.total + a.trace.count, 4, "列出的 + 留痕 == 清单里的全部文件");
});

test("五类恒在（空组也出现，count=0）+ 其它兜底 + 留痕**不成组**", () => {
	const a = featureArtifacts(LISTING);
	assert.deepEqual(a.groups.map((g) => g.key), ["brainstorm", "draft", "final", "ue", "speech", "config", "other"]);
	assert.equal(a.groups.filter((g) => g.key === "trace").length, 0, "留痕**不在列表里**（用户口径：工作台不显示它）");
	// 每类都带桶名（界面只显示这个短标签）与一个空的 dynamic；★ 按 key 取，别按数组下标（加一类就全错位）
	const grp = (k: string) => a.groups.filter((x) => x.key === k)[0];
	assert.equal(grp("brainstorm").dir, "analysis", "有文件 ⇒ 显示**实际**位置");
	assert.equal(grp("draft").dir, "gdd");
	// ★ 空组回退到**规范落点**（用户实测：空的「定稿」「HTML 宣讲稿」组头没有路径，看着像坏了）
	assert.equal(grp("ue").dir, "gdd", "空组显示这一类该放哪里（规范落点），不是留空");
	assert.equal(grp("config").dir, "gdd", "配置表规范落点是 gdd\\（空组也显示它）");
	assert.equal(grp("other").dir, "gdd", "other 这份清单里的文件都在 gdd（含嵌套 UI\\）");
	assert.ok(a.groups.every((g) => g.dynamic === ""), "没状况就不该有 dynamic");
	assert.deepEqual(a.counts, { brainstorm: 3, draft: 1, final: 2, ue: 0, speech: 1, config: 0, other: 2, trace: 1 });
	assert.equal(a.total, 9, "面板列出的条目总数（不含留痕）");
	assert.equal(a.allPaths.length, a.total);
	assert.equal(a.trace.count, 1, "这份清单里的留痕是那份审查报告");
	assert.equal(a.trace.summary, "1 份审查报告");
	assert.equal(a.total + a.trace.count, 10, "★ 列出的 + 留痕 == 清单里的全部文件（一个都不丢）");
	// 子目录里的文件带上了它的子目录
	const evidence = a.groups[0].files.filter((f) => f.name === "frame-001.png")[0];
	assert.equal(evidence.rel, "analysis/证据/frame-001.png");
	assert.equal(evidence.subdir, "证据");
});

test("绝不造条目：空列举 → 全是 0（留痕账也是空）", () => {
	const a = featureArtifacts({});
	assert.deepEqual(a.counts, { brainstorm: 0, draft: 0, final: 0, ue: 0, speech: 0, config: 0, other: 0, trace: 0 });
	assert.equal(a.total, 0);
	assert.equal(a.allPaths.length, 0);
	assert.equal(a.trace.count, 0);
	assert.equal(a.trace.summary, "", "没留痕就没有那句话（界面一个字节都不出）");
	assert.deepEqual(a.trace.allPaths, []);
});

test("成稿 / 定稿按文件名日期倒序（新的在前）", () => {
	const a = featureArtifacts(LISTING);
	const finals = a.groups.filter((g) => g.key === "final")[0];
	assert.deepEqual(finals.files.map((f) => f.name), ["联盟讨伐_20260923_定稿.md", "联盟讨伐_20260921_定稿.md"]);
});

test("带历史版本的组：当前版排第一、标〔当前〕，旧版跟后面标〔历史版本〕；没有旧版的组一个注都不加", () => {
	const a = featureArtifacts({
		gdd: {
			files: [
				"X_定稿.md",
				"X_定稿_20260921_1.md",
				"X_定稿_20260923_1.md",
				"X_宣讲_20260924.html"
			]
		}
	});
	annotateCurrent(a.groups);
	const fin = a.groups.filter((x) => x.key === "final")[0];
	assert.deepEqual(
		fin.files.map((f) => f.name),
		["X_定稿.md", "X_定稿_20260923_1.md", "X_定稿_20260921_1.md"],
		"当前版第一，历史版本按版本号倒序"
	);
	assert.deepEqual(fin.files.map((f) => f.note), ["〔当前〕", "〔历史版本〕", "〔历史版本〕"]);
	assert.equal(fin.dynamic, "", "★ 不再写那行小字（用户反馈看不懂；组头件数 + 标签已经说清了）");
	assert.ok(String(fin.note).includes("gdd"), "note 是永远成立的说明（收进 tooltip）：" + fin.note);
	assert.equal(fin.dir, "gdd", "定稿在 gdd 桶");
	const sp = a.groups.filter((x) => x.key === "speech")[0];
	assert.equal(sp.files[0].note, "", "这一组没有历史版本 ⇒ 不加注（满屏「当前」是噪音）");
	assert.equal(sp.dynamic, "");
});

test("analysis\\ 里的一切都算头脑风暴产物（含子目录）", () => {
	const a = featureArtifacts({ analysis: { files: ["随便.bin"], nested: { sub: ["另一个.dat"] } } });
	assert.equal(a.counts.brainstorm, 2);
	assert.equal(a.counts.other, 0);
});

test("UE 界面稿自成一类（sr-gdd-UE 的产出），它的源数据与宣讲草稿都进「其它」——一个都不丢", () => {
	const a = featureArtifacts({
		gdd: { files: ["X_UE.html", "X_UE.content.json", "X_UE_20261013_1.html", "X_宣讲.html", "X_宣讲.md"] }
	});
	const ue = a.groups.filter((g) => g.key === "ue")[0];
	assert.equal(ue.label, "UE 界面稿");
	assert.deepEqual(ue.files.map((f) => f.name), ["X_UE.html", "X_UE_20261013_1.html"], "当前版第一，历史版本跟上");
	assert.equal(a.counts.ue, 2);
	assert.equal(a.counts.speech, 1, "宣讲稿只算 html（`_宣讲.md` 是它的草稿，不进这一类）");
	assert.equal(a.counts.other, 2, "UE 源数据 + 宣讲草稿都进「其它」，如实列出");
	assert.equal(a.total, 5, "五份文件全在列表里");
	assert.equal(a.total + a.trace.count, 5, "列出的 + 留痕 == 清单里的全部文件");
});
