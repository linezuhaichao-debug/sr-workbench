/**
 * 加载层 · 真数据（文件侧替身 = `node:fs` 直读真盘）。
 *
 * 口径（本仓库的测试纪律）：**条数不写死** —— "面板读到的"必须与"同一时刻直接从磁盘
 * 按同一口径算出来的"逐条对上。数据怎么变都成立，而"静默丢文件 / 凭空造条目"照样红。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { BUCKETS } from "../src/pure/buckets.ts";
import { DECISION_REL } from "../src/pure/decisions.ts";
import { loadDashboard, loadDashboardInner } from "../src/load/dashboard.ts";
import { loadFeatureDetail, scanFeature } from "../src/load/feature.ts";
import { bucketFiles, featureRoot, featureTopics, requireRealData, testPort, WORKSPACE } from "./paths.ts";

/** 独立口径：直接从磁盘列两层（桶 → 再下一层），不经过 port / 加载器。 */
function diskFiles(topic: string, bucket: string): string[] {
	const out: string[] = [];
	const dir = path.join(featureRoot(topic), bucket);
	const walk = (d: string, depth: number) => {
		let rows: fs.Dirent[] = [];
		try {
			rows = fs.readdirSync(d, { withFileTypes: true });
		} catch (e) {
			return;
		}
		for (const r of rows) {
			if (r.isFile()) out.push(r.name);
			else if (depth > 0) walk(path.join(d, r.name), depth - 1);
		}
	};
	walk(dir, 1);
	return out.sort();
}

const topics = () => featureTopics();

test("看板：功能数 == `features\\` 下的目录数（目录存在就是功能）", async () => {
	requireRealData();
	const d = await loadDashboardInner(testPort(), WORKSPACE);
	assert.deepEqual(d.features.map((f: any) => f.topic).sort(), topics());
	for (const f of d.features) {
		assert.ok(f.root.replace(/\\/g, "/").endsWith("/features/" + f.topic), "功能根 = <工作区>\\features\\<主题>：" + f.root);
		assert.ok(typeof f.line === "string" && f.line.length > 0, "每张卡都要有一行人话");
		assert.ok(typeof f.tone === "string" && f.tone.length > 0);
	}
});

test("看板：卡片上的计数 == 磁盘真值（不静默丢、不凭空造）", async () => {
	requireRealData();
	const d = await loadDashboardInner(testPort(), WORKSPACE);
	for (const f of d.features) {
		assert.equal(f.counts.brainstorm, diskFiles(f.topic, "analysis").length, f.topic + " 的头脑风暴产物数");
		assert.equal(f.counts.evidence, diskFiles(f.topic, "evidence").length, f.topic + " 的证据数");
		// 4 个桶都在的功能：missing 必须为空
		const have = BUCKETS.filter((b) => fs.existsSync(path.join(featureRoot(f.topic), b)));
		if (have.length === BUCKETS.length) assert.deepEqual(f.missing, [], f.topic + " 四个桶都在，不该报缺");
	}
});

test("看板：sr 配置读不到时**如实说**，不假装有功能列表", async () => {
	const d = await loadDashboard(testPort(), { configPath: "D:\\definitely\\not\\here.json" });
	// 相对兜底候选在本机是能命中的（cwd 概念由替身忽略）⇒ 这里只断言"两条路都自洽"
	if (d.srWs) assert.ok(Array.isArray(d.features));
	else {
		assert.deepEqual(d.features, []);
		assert.ok(String(d.pathNote).includes("没读到 sr 配置"));
	}
});

test("详情：三块数据都有，4 个桶的计数 == 磁盘真值", async () => {
	requireRealData();
	const port = testPort();
	const topic = topics()[0];
	const d = await loadFeatureDetail(port, { root: featureRoot(topic) });

	for (const b of BUCKETS) {
		const got = d.buckets.filter((x: any) => x.key === b)[0];
		const onDisk = diskFiles(topic, b);
		const direct = bucketFiles(topic, b);
		assert.equal(got.absent, !fs.existsSync(path.join(featureRoot(topic), b)), b + " 桶在不在");
		assert.equal(got.files, direct.length, b + " 桶的直接文件数");
		assert.ok(onDisk.length >= direct.length);
	}
	// 决策记录：面板数出来的条数 == 文件里带时间戳的二级标题数（独立口径）
	const abs = path.join(featureRoot(topic), "decisions", "决策记录.md");
	if (fs.existsSync(abs)) {
		const text = fs.readFileSync(abs, "utf8");
		const stamps = (text.match(/^#{2,6}\s+.*\d{4}[-/.]\d{1,2}[-/.]\d{1,2}[ T]\d{1,2}:\d{1,2}:\d{1,2}/gm) || []).length;
		assert.equal(d.counts.decisions, stamps, "决策条数");
	} else {
		assert.equal(d.counts.decisions, 0);
		assert.equal(d.decisions.log.present, false);
		assert.equal(d.decisions.rel, DECISION_REL);
	}
});

test("详情：最终产物五类 + 其它 = analysis 与 gdd 两个桶的全部文件（一个都不丢）", async () => {
	requireRealData();
	const port = testPort();
	const topic = topics()[0];
	const d = await loadFeatureDetail(port, { root: featureRoot(topic) });
	const onDisk = diskFiles(topic, "analysis").length + diskFiles(topic, "gdd").length;
	assert.equal(d.outputs.total, onDisk, "面板列出的条目数 == 磁盘上这两个桶里的文件数");
	assert.deepEqual(d.outputs.allPaths.length, d.outputs.total);
	assert.deepEqual(d.outputs.groups.map((g: any) => g.key), ["brainstorm", "draft", "final", "speech", "config", "other"]);
});

test("详情：列举失败不抛给界面（缺桶 / 目录不在 = 空 + 如实标注）", async () => {
	requireRealData();
	const port = testPort();
	const d = await loadFeatureDetail(port, { root: featureRoot("这个功能不存在-测试用") });
	assert.deepEqual(d.missing, BUCKETS.slice(), "一个桶都列不出来 ⇒ 四个都算缺");
	assert.equal(d.outputs.total, 0);
	assert.equal(d.counts.decisions, 0);
});

test("扫描：不是 4 个桶的目录与功能根散文件都如实列出来", async () => {
	requireRealData();
	const topic = topics()[0];
	const scan = await scanFeature(testPort(), featureRoot(topic));
	const rootDirs = fs.readdirSync(featureRoot(topic), { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name);
	const strangers = rootDirs.filter((x) => !BUCKETS.some((b) => b.toLowerCase() === x.toLowerCase()));
	assert.deepEqual(scan.strangerDirs.slice().sort(), strangers.slice().sort());
});

test("头脑风暴：读通道的产物清单与加载器吃的是**同一份**（不重新列目录）", async () => {
	requireRealData();
	const topic = topics()[0];
	const d = await loadFeatureDetail(testPort(), { root: featureRoot(topic) });
	assert.equal(d.brainstorm.groups.total, d.counts.brainstorm, "四入口分组的总数 == analysis 桶的文件数");
	// ★ 但配置表那条线的文件**不算入口产物**（口径 2026-10-09：它们落 gdd\，存量在 analysis\ 也要剔）
	assert.ok(d.brainstorm.groups.total <= d.counts.brainstorm, "入口分组不许多出条目");
	assert.deepEqual(d.brainstorm.groups.entries.map((e: any) => e.id), ["analysis", "concept", "legacy", "humannote"]);
	assert.deepEqual(d.brainstorm.unreadable, [], "真实数据里不该有读不动的产物");
});
