/**
 * 头脑风暴工作面加载器（工单 23）—— 走 `WorkspacePort` 的**文件侧替身（node:fs 直读真盘）**。
 *
 * ★ 两条路一起测：
 *   ① **真实工作区数据**：`features\联盟悬赏` 的真产物清单（`loadFeatureDetail` 给）+ 真交接件的
 *      `source_skill` → 四入口归类结果；
 *   ② **格式样例**：`test/fixtures/analysis/` 里的两份新格式产物（§4.2 的两种新格式）→ 解析结果。
 * ★ 顺带钉住"出口判据那一句话是**搬**过来的，不是这一层重算的"（`notes` 只透传 `stage.note`）。
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { loadBrainstorm } from "../src/load/brainstorm.ts";
import { loadFeatureDetail } from "../src/load/feature.ts";
import { createFsPort } from "../src/port/fs.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, "fixtures");
const SR_ROOT = "D:\\TimeMachine\\GameDesignOS\\workspace";
const FEATURE = path.join(SR_ROOT, "features", "联盟悬赏");
const LEGACY_FILE = "legacy-analysis_飞船装置_20260930.md";
const NOTE_FILE = "human-note_BOSS血量按联盟共享_20260921.md";

test("真数据：联盟悬赏的分析产物按四入口归类（真文件名 + 真 source_skill）", async () => {
	const port = createFsPort({ roots: [SR_ROOT] });
	const detail = await loadFeatureDetail(port, { root: FEATURE });
	const analysis = detail.artifacts.groups.filter((g: any) => g.key === "analysis")[0];
	assert.ok(analysis && analysis.count >= 3, "联盟悬赏的 analysis 组应有产物");

	const got = await loadBrainstorm(port, { root: FEATURE, files: analysis.files, stage: detail.stage });
	assert.deepEqual(got.groups.entries.map((e: any) => e.id), ["analysis", "concept", "legacy", "humannote"]);
	// 真数据：concept-triage + feature-concept + handoff（它的 source_skill = sr-concept）
	assert.equal(got.groups.counts.concept, 3);
	assert.equal(got.groups.counts.legacy, 0);
	assert.equal(got.groups.counts.humannote, 0);
	assert.equal(got.groups.total, analysis.count);
	assert.deepEqual(got.legacy, []);
	assert.deepEqual(got.humannote, []);
	assert.deepEqual(got.unreadable, []);
	// 出口判据（analysis 非空）→ 那句提示不该出现
	assert.deepEqual(got.notes, []);
});

test("格式样例：两种新格式都解析出来（四段章节 / 原话逐字）", async () => {
	const port = createFsPort();
	const files = [
		{ name: LEGACY_FILE, rel: "analysis/" + LEGACY_FILE },
		{ name: NOTE_FILE, rel: "analysis/" + NOTE_FILE }
	];
	const got = await loadBrainstorm(port, {
		root: FIX,
		files: files,
		stage: { note: "source 里有 2 个源文件，但 analysis 还是空的 —— 建议先跑一次分析" }
	});
	assert.equal(got.legacy.length, 1);
	assert.equal(got.humannote.length, 1);
	assert.equal(got.legacy[0].rel, "analysis/" + LEGACY_FILE);
	assert.ok(got.legacy[0].abs.endsWith(LEGACY_FILE));
	assert.deepEqual(got.legacy[0].sections.map((s: any) => s.present), [true, true, true, true]);
	assert.equal(got.humannote[0].quote.text, "「BOSS 的血条应该是全盟共享的，一个人打全盟都能看到」");
	assert.equal(got.groups.counts.legacy, 1);
	assert.equal(got.groups.counts.humannote, 1);
	// ★ 出口判据是**搬运**的：这一层不重算
	assert.deepEqual(got.notes, ["source 里有 2 个源文件，但 analysis 还是空的 —— 建议先跑一次分析"]);
});

test("读不动的文件如实报出来（不当成「没有」）", async () => {
	const port = createFsPort();
	const got = await loadBrainstorm(port, {
		root: FIX,
		files: [
			{ name: LEGACY_FILE, rel: "analysis/" + LEGACY_FILE },
			{ name: "sr-gdd-handoff_不存在_20260930.json", rel: "analysis/sr-gdd-handoff_不存在_20260930.json" }
		]
	});
	assert.equal(got.legacy.length, 1);
	assert.equal(got.unreadable.length, 1);
	assert.equal(got.unreadable[0].name, "sr-gdd-handoff_不存在_20260930.json");
	assert.ok(got.unreadable[0].why.includes("source_skill"));
});
