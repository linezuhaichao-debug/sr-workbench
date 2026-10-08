/**
 * 主题派生 + 产物分类（迁移自 legacy/test-topic.js、legacy/test-buckets.js：那两份靠
 * "哨兵字符串切片 + new Function"从 client.js 里抽代码，现在改成直接 import）。
 *
 * 断言跑的是**真实文件名**：`features\**`、工作区根、`planner\策划配置` 的实际文件名。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { artifactBucket, BUCKET_FIELD, DIR_BUCKET, GDD_KIND_LABEL, gddKindOf } from "../src/pure/buckets.ts";
import { dateOf, isNoise, topicOf } from "../src/pure/topic.ts";
import { WORKSPACE, PLANNER_CONFIG_DIR, requireRealData } from "./paths.ts";

function namesIn(dir: string, out: string[], depth: number): void {
	let rows: fs.Dirent[] = [];
	try {
		rows = fs.readdirSync(dir, { withFileTypes: true });
	} catch (e) {
		return;
	}
	for (const d of rows) {
		if (d.isFile()) out.push(d.name);
		else if (depth > 0) namesIn(path.join(dir, d.name), out, depth - 1);
	}
}

function realNames(): string[] {
	const out: string[] = [];
	namesIn(path.join(WORKSPACE, "features"), out, 3);
	namesIn(WORKSPACE, out, 0);
	for (const d of ["proposals", "analysis", "decisions", "evidence", "inbox"]) namesIn(path.join(WORKSPACE, d), out, 0);
	namesIn(PLANNER_CONFIG_DIR, out, 0);
	return Array.from(new Set(out)).sort();
}

test("主题派生：同一功能的不同阶段/版本收敛到同一个键", () => {
	requireRealData();
	// 定稿 / 中文名 / 压缩包 / 前缀带编号 —— 全是真实出现过的文件名形态
	assert.equal(topicOf("联盟悬赏_20260923_定稿.md"), "联盟悬赏");
	assert.equal(topicOf("联盟悬赏_20260921_定稿_审查.md"), "联盟悬赏");
	assert.equal(topicOf("联盟悬赏（联盟boss）.txt"), "联盟悬赏");
	assert.equal(topicOf("联盟悬赏-md版本.rar"), "联盟悬赏");
	assert.equal(topicOf("readback_A079_神话宝库_20260916.md"), "神话宝库");
	assert.equal(topicOf("smoke_英雄圣物_20260923.png"), "英雄圣物");
	assert.equal(topicOf("A079-联盟悬赏.xlsx"), "联盟悬赏");
});

test("噪音主题不当作功能（脚本名 / 编号 / 过短）", () => {
	assert.equal(isNoise(topicOf("write_CS-20260920-001.py")), true);
	assert.equal(isNoise("A"), true);
	assert.equal(isNoise("1"), true);
	assert.equal(isNoise("联盟悬赏"), false);
});

test("dateOf 取文件名里的 8 位日期", () => {
	assert.equal(dateOf("联盟悬赏_20260923_定稿.md"), "20260923");
	assert.equal(dateOf("A079-联盟悬赏.xlsx"), "");
});

test("产物分类：旧结构（文件名前缀）与 gdd\\ 内部细分", () => {
	// sr-analysis / sr-concept 的**全部**产出都能被认出来（修之前只认三种，其余静默丢弃）
	const cases: [string, string][] = [
		["concept-triage_联盟悬赏_20260918.md", "analysis"],
		["feature-concept_联盟悬赏_20260918.md", "analysis"],
		["experience-report_神话宝库_20260915.md", "analysis"],
		["issue-cards_神话宝库_20260915.json", "analysis"],
		["replication-spec_神话宝库_20260915.md", "analysis"],
		["sr-gdd-handoff_联盟悬赏_20260918.json", "analysis"],
		["evidence-index_神话宝库_20260915.md", "evidence"],
		["calibration_联盟悬赏_20260921_归档.jsonl", "evidence"],
		["decision_联盟悬赏_20260929.json", "decisions"],
		["联盟悬赏_20260923_定稿.md", "final"],
		["联盟悬赏_20260921_定稿_审查.md", "review"],
		["联盟悬赏_20260918.md", "draft"],
		["联盟悬赏_宣讲_20260923.html", "speech"],
		["联盟悬赏_宣讲_20260923.content.json", "speechSrc"],
		// ★ 工单 12：定稿的**派生 HTML** 原来是 others（面板上根本看不见），现在有自己的一档
		["联盟悬赏_20260923_定稿.html", "finalHtml"],
		["write_CS-20260920-001.py", "others"],
	];
	for (const [name, want] of cases) assert.equal(artifactBucket(name), want, name);
	assert.equal(artifactBucket(""), "others");
});

test("gdd\\ 细分：gddKindOf 是唯一判据（artifactBucket 与它同源）", () => {
	// 工单 12 要求的五档：成稿 / 定稿 / 审查 / 修订点 / 定稿 HTML
	const cases: [string, string][] = [
		["联盟悬赏_20260918.md", "draft"],
		["联盟悬赏_20260923_定稿.md", "final"],
		["联盟悬赏_20260921_定稿_审查.md", "review"],
		["联盟悬赏_20260921_审查.md", "review"],
		["联盟悬赏_20260924_修订点.md", "fixpoints"],
		["联盟悬赏_20260923_定稿.html", "finalHtml"],
		["联盟悬赏_20260923_定稿.htm", "finalHtml"],
		["联盟悬赏_宣讲_20260923.html", "speech"],
		["联盟悬赏_宣讲_20260923.content.json", "speechSrc"],
		["随便一个.html", "others"],
		["", "others"],
	];
	for (const [name, want] of cases) assert.equal(gddKindOf(name), want, name);
	// 同源：revised points 在旧的"桶"口径里仍并入 drafts（BUCKET_FIELD.gdd = drafts）
	assert.equal(artifactBucket("联盟悬赏_20260924_修订点.md"), "gdd");
	assert.equal(GDD_KIND_LABEL.finalHtml, "定稿 HTML");
});

test("六个标准子目录 → 桶；桶 → byTopic 字段名", () => {
	// DIR_BUCKET 覆盖 analysis / gdd / decisions / evidence / source / delivery（"七个"是设计文档的旧说法，
	// 实现里 source 与 delivery 都是后补的桶，实际六项 —— 这里如实断言实现）
	assert.deepEqual(Object.keys(DIR_BUCKET).sort(), ["analysis", "decisions", "delivery", "evidence", "gdd", "source"]);
	assert.equal(BUCKET_FIELD.final, "finals");
	assert.equal(BUCKET_FIELD.analysis, "concept");
});

test("真实文件名清单：每个都能派生主题，且没有把配置表当成功能", () => {
	requireRealData();
	const names = realNames();
	assert.ok(names.length > 100, "真实文件名应超过 100 个，实际 " + names.length);
	const topics = new Map<string, string[]>();
	for (const n of names) {
		const t = topicOf(n);
		if (!t) continue;
		if (!topics.has(t)) topics.set(t, []);
		(topics.get(t) as string[]).push(n);
	}
	// 四个真实功能都在（功能 = 目录）
	for (const t of ["联盟悬赏", "神话宝库", "英雄圣物", "诸神降临"]) {
		assert.ok(topics.has(t), "应派生出来自真实文件名的主题：" + t);
	}
	// 配置表只作属性，不创建功能
	// ★ 原断言有两处错：① 正则 `/\.xlsm?$/i` = "xls" + 可选 m，**漏掉 .xlsx**（真表里 55 个是 .xlsx）；
	//   ② 阈值 >50 是猜的。
	// ★ 2026-10-08：Excel **打开着**工作簿时会在同目录留隐藏锁文件 `~$<原表名>.xlsm`（实测 165 字节）——
	//   它匹配表名正则却不是配置数据，会让这条计数随机 +1（用户当场就开着 `A002-货物道具表.xlsm`）。
	//   产品侧（`load/dashboard.ts`）同样排除了它；这里跟着排除。
	// ★ 2026-10-08 之后的加固：条数**不写死**（原为 84 / 29）—— 加一张配置表是**正确动作**，不该红。
	//   改成与**同一时刻**从配置目录重算的真值比（逐条对名单），少列 / 多列一个才红。
	const configTableNames = (list: string[]) => list.filter((n) => /\.xlsx?m?$/i.test(n) && n.indexOf("~$") !== 0);
	const configNames = configTableNames(names);
	const onDisk = configTableNames(fs.readdirSync(PLANNER_CONFIG_DIR));
	assert.ok(configNames.length >= 84, "策划配置根目录下的表文件数（实测下界 84），实际 " + configNames.length);
	assert.deepEqual(configNames.slice().sort(), onDisk.slice().sort(), "列举到的表文件 == 配置目录里同一时刻的那些");
	assert.equal(
		configNames.filter((n) => /\.xlsm$/i.test(n)).length,
		onDisk.filter((n) => /\.xlsm$/i.test(n)).length,
		"其中 .xlsm 的份数也要与磁盘一致",
	);
	assert.ok(configNames.every((n) => topicOf(n).length > 0));
});
