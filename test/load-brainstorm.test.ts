/**
 * 头脑风暴工作面加载器 —— 走 `WorkspacePort` 的文件侧替身（`node:fs` 直读真盘）。
 *
 * 两条路一起测：
 *   ① **真实工作区数据**：真产物清单 + 真交接件的 `source_skill` → 四入口归类结果
 *      （条数**不写死**：与磁盘同一时刻的真值比）；
 *   ② **格式样例**：两种固定格式（§4.2）的解析 —— 样例在临时目录里**当场写出来**，
 *      不录 fixture（录下来的"正常"会掩盖真实数据的怪形状）。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadBrainstorm } from "../src/load/brainstorm.ts";
import { loadFeatureDetail } from "../src/load/feature.ts";
import { createFsPort } from "../src/port/fs.ts";
import { featureRoot, featureTopics, requireRealData, testPort } from "./paths.ts";

const LEGACY_FILE = "legacy-analysis_飞船装置_20260930.md";
const NOTE_FILE = "human-note_BOSS血量按联盟共享_20260921.md";
/** ★ 新口径（2026-10-13）下的产物：没有一级标题、没有边界 / 落点段 */
const NOTE_FILE2 = "human-note_血条应该全盟共享_20261013.md";

const LEGACY_TEXT = [
	"---",
	"doc_type: legacy_analysis",
	"topic: 飞船装置",
	"source: source/飞船装置_旧案.docx",
	"analyzed_at: 20260930",
	"---",
	"",
	"# 飞船装置（旧文档分析）",
	"",
	"## 仍然有效的结论",
	"- 装置槽位是 3 个。",
	"",
	"## 已废弃 / 不适用",
	"- 旧版按等级解锁 —— 已改成按章节进度解锁（理由：等级和进度脱钩了）。",
	"",
	"## 可复用条目（表格：旧文档位置 | 内容 | 去向）",
	"| 旧文档位置 | 内容 | 去向 |",
	"| --- | --- | --- |",
	"| 3.2 节 | 槽位 3 个 | §4 R1 |",
	"",
	"## 原文（转换后）",
	"（旧文档全文……）",
	""
].join("\n");

/**
 * ★ **旧格式样例（2026-10-13 之前产出的那些）**：带一级标题、带「边界」「落点」两段。
 *   留着它当**兼容用例** —— 面板去掉这两项输入之后，历史产物一样要读得出来，
 *   而且那两段既不能报"缺固定章节"，也不能被静默丢掉（它们进 `extra`）。
 */
const NOTE_TEXT = [
	"---",
	"doc_type: human_note",
	"topic: BOSS血量",
	"confidence: high",
	"date: 20260921",
	"author: 策划",
	"---",
	"",
	"# BOSS 血量按联盟共享",
	"",
	"> 原话：「BOSS 的血条应该是全盟共享的，一个人打全盟都能看到」",
	"",
	"## 结论",
	"血条展示按联盟聚合。",
	"",
	"## 边界",
	"- （待定）",
	"",
	"## 落点",
	"- §5 UI-M1 UE2 血条区",
	""
].join("\n");

/** ★ **新格式样例**：正文第一行就是 `> 原话：…`（无标题），固定段只有「结论」 */
const NOTE_TEXT2 = [
	"---",
	"doc_type: human_note",
	"topic: BOSS血量",
	"confidence: high",
	"date: 20261013",
	"author: 主策 祖海潮",
	"---",
	"",
	"> 原话：「血条应该全盟共享，一个人打全盟都能看到」",
	"",
	"## 结论",
	"血条展示按联盟聚合。",
	""
].join("\n");

/** 当场写出三份样例，返回目录（收尾删掉）。 */
function writeSamples(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "srwb-brainstorm-"));
	fs.mkdirSync(path.join(dir, "analysis"), { recursive: true });
	fs.writeFileSync(path.join(dir, "analysis", LEGACY_FILE), LEGACY_TEXT, "utf8");
	fs.writeFileSync(path.join(dir, "analysis", NOTE_FILE), NOTE_TEXT, "utf8");
	fs.writeFileSync(path.join(dir, "analysis", NOTE_FILE2), NOTE_TEXT2, "utf8");
	return dir;
}

test("真数据：分析产物按四入口归类，总数 == analysis 桶里的文件数", async () => {
	requireRealData();
	const topic = featureTopics()[0];
	const port = testPort();
	const detail = await loadFeatureDetail(port, { root: featureRoot(topic) });
	assert.ok(detail.counts.brainstorm >= 0);

	const got = await loadBrainstorm(port, {
		root: featureRoot(topic),
		files: detail.outputs.groups.filter((g: any) => g.key === "brainstorm")[0].files
			.map((f: any) => ({ name: f.name, rel: f.rel, subdir: f.subdir }))
	});
	assert.deepEqual(got.groups.entries.map((e: any) => e.id), ["analysis", "concept", "legacy", "humannote"]);
	assert.equal(got.groups.total, detail.counts.brainstorm);
	assert.deepEqual(got.unreadable, [], "真实数据里不该有读不动的产物");
	// 每一件产物都必须落进某一个入口（或如实进 other），一件都不许消失
	const sum = got.groups.entries.reduce((n: number, e: any) => n + e.count, 0) + got.groups.other.length;
	assert.equal(sum, got.groups.total);
});

test("格式样例：两种固定格式都解析出来（四段章节 / 原话逐字）", async () => {
	const dir = writeSamples();
	try {
		const port = createFsPort({ roots: [dir] });
		const files = [
			{ name: LEGACY_FILE, rel: "analysis/" + LEGACY_FILE },
			{ name: NOTE_FILE, rel: "analysis/" + NOTE_FILE },
			{ name: NOTE_FILE2, rel: "analysis/" + NOTE_FILE2 }
		];
		const got = await loadBrainstorm(port, {
			root: dir, files: files,
			stage: { note: "source 里有 2 个源文件，但 analysis 还是空的 —— 建议先跑一次分析" }
		});
		assert.equal(got.legacy.length, 1);
		assert.equal(got.humannote.length, 2);
		assert.equal(got.legacy[0].rel, "analysis/" + LEGACY_FILE);
		assert.ok(got.legacy[0].abs.endsWith(LEGACY_FILE));
		assert.deepEqual(got.legacy[0].sections.map((s: any) => s.present), [true, true, true, true]);
		assert.equal(got.legacy[0].source, "source/飞船装置_旧案.docx");
		assert.equal(got.legacy[0].reuse.rows.length, 1);
		assert.equal(got.groups.counts.legacy, 1);
		assert.equal(got.groups.counts.humannote, 2);

		const byName = (n: string) => got.humannote.filter((h: any) => h.name === n)[0];

		// ★ 新格式：正文没有一级标题；固定段只有「结论」，它一定在
		const fresh = byName(NOTE_FILE2);
		assert.equal(fresh.title, "", "新产物没有标题 —— 这是用户口径要的结果");
		assert.equal(fresh.author, "主策 祖海潮", "谁说的要读得出来（frontmatter 的 author）");
		assert.deepEqual(fresh.sections.map((s: any) => s.key), ["conclusion"]);
		assert.deepEqual(fresh.missing, [], "边界 / 落点已不是固定段，不该被记成缺章节");
		assert.equal(fresh.quote.text, "「血条应该全盟共享，一个人打全盟都能看到」");
		assert.equal(fresh.conclusion.trim(), "血条展示按联盟聚合。");

		// ★ 旧格式（历史产物）：标题照读；「边界」「落点」进 extra —— 认不出来也不许丢
		const old = byName(NOTE_FILE);
		assert.equal(old.title, "BOSS 血量按联盟共享");
		assert.equal(old.quote.text, "「BOSS 的血条应该是全盟共享的，一个人打全盟都能看到」");
		assert.deepEqual(old.extra.map((s: any) => s.title), ["边界", "落点"]);
		assert.deepEqual(old.missing, []);

		// ★ 出口判据是**搬运**的：这一层不重算
		assert.deepEqual(got.notes, ["source 里有 2 个源文件，但 analysis 还是空的 —— 建议先跑一次分析"]);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("读不动的文件如实报出来（不当成「没有」）", async () => {
	const dir = writeSamples();
	try {
		const port = createFsPort({ roots: [dir] });
		const got = await loadBrainstorm(port, {
			root: dir,
			files: [
				{ name: LEGACY_FILE, rel: "analysis/" + LEGACY_FILE },
				{ name: "sr-gdd-handoff_不存在_20260930.json", rel: "analysis/sr-gdd-handoff_不存在_20260930.json" }
			]
		});
		assert.equal(got.legacy.length, 1);
		assert.equal(got.unreadable.length, 1);
		assert.equal(got.unreadable[0].name, "sr-gdd-handoff_不存在_20260930.json");
		assert.ok(got.unreadable[0].why.includes("source_skill"));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
