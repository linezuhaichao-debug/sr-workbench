/**
 * **卡片墙的计数必须与详情页同源**（回归钉子）。
 *
 * ★ 真踩过（2026-10-09）：用户看到卡片写「有成稿 **2** 份」，而点进去只有 1 份。
 *   根因是 `loadDashboard` 自己数了一遍（`analysis` 桶文件数 + `gddKindOf`），
 *   把 `gdd\CS-20261009-001_读回验收报告.md`（无后缀的 `.md`）当成了成稿 ——
 *   而详情页走 `outputGroupOf`（配置表按内容认）只算 1 份。**判据两份 ⇒ 同一个东西两个数。**
 *
 * 这个用例对**每个真实功能**比一遍：卡片的 counts 必须等于详情页的 counts。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { loadDashboard } from "../src/load/dashboard.ts";
import { loadFeatureDetail } from "../src/load/feature.ts";
import { featureRoot, featureTopics, requireRealData, SR_CONFIG, testPort } from "./paths.ts";

test("卡片计数 == 详情计数（同一个判据，不许两个数）", async () => {
	requireRealData();
	const port = testPort();
	// ★ 锚点来自 sr 配置（`loadDashboard` 只认 `configPath`，没有 `srWs` 这个选项）
	const dash = await loadDashboard(port, { configPath: SR_CONFIG });
	assert.ok(dash.features.length > 0, "真实工作区至少要有一个功能，否则这条用例什么都没测");

	for (const card of dash.features) {
		const detail = await loadFeatureDetail(port, { root: featureRoot(card.topic) });
		for (const k of ["brainstorm", "draft", "final", "speech", "config", "other"]) {
			assert.equal(
				card.counts[k] || 0,
				detail.outputs.counts[k] || 0,
				card.topic + " 的「" + k + "」卡片说 " + (card.counts[k] || 0) + "、详情说 " + (detail.outputs.counts[k] || 0)
			);
		}
	}
});

test("真实工作区里，无后缀的 gdd .md 就是成稿；验收报告那种归配置表（拿真实文件钉一下）", async () => {
	requireRealData();
	const port = testPort();
	for (const topic of featureTopics()) {
		const d = await loadFeatureDetail(port, { root: featureRoot(topic) });
		const draft = d.outputs.groups.filter((g: any) => g.key === "draft")[0];
		for (const f of draft.files) {
			assert.equal(/_读回验收报告/.test(f.name), false, "验收报告不该算成稿：" + f.name);
			assert.equal(/^CS-/.test(f.name), false, "change set 不该算成稿：" + f.name);
		}
	}
});
