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

import { traceArtifactOf } from "../src/pure/buckets.ts";
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
		// ★ `trace`（过程留痕）也在这里比 —— 卡片上不展示它，但计数仍是同一个判据算出来的
		for (const k of ["brainstorm", "draft", "final", "ue", "speech", "config", "other", "trace"]) {
			assert.equal(
				card.counts[k] || 0,
				detail.outputs.counts[k] || 0,
				card.topic + " 的「" + k + "」卡片说 " + (card.counts[k] || 0) + "、详情说 " + (detail.outputs.counts[k] || 0)
			);
		}
	}
});

test("真实工作区里，无后缀的 gdd .md 就是成稿；留痕不混进任何产物类（拿真实文件钉一下）", async () => {
	requireRealData();
	const port = testPort();
	for (const topic of featureTopics()) {
		const d = await loadFeatureDetail(port, { root: featureRoot(topic) });
		// ① 留痕**不许出现在任何产物类里**（原来只钉了"不许算成稿"，现在连"别的类也不许"）
		for (const g of d.outputs.groups as any[]) {
			for (const f of g.files as any[]) {
				assert.equal(/^CS-\d{8}-\d+\.ya?ml$/.test(f.name), false, "change set 不该进产物类（" + g.key + "）：" + f.name);
				assert.equal(/_读回验收报告/.test(f.name), false, "读回验收报告不该进产物类（" + g.key + "）：" + f.name);
				assert.equal(/_审查\.md$/.test(f.name), false, "审查报告不该进产物类（" + g.key + "）：" + f.name);
				assert.equal(/_修订点\.md$/.test(f.name), false, "修订点清单不该进产物类（" + g.key + "）：" + f.name);
				// ★ 历史版本**要**进产物类（2026-10-12 口径改：用户要在最终产物里看历史版本）——
				//   它归**它当前版所在**的那一类，所以这里不再禁止它（正向断言在 pure-buckets 里）
			}
		}
		// ② 反方向也要钉：留痕账里**只装留痕**（别把真产物误报成留痕，那是另一种错）
		for (const f of d.outputs.trace.files) {
			assert.ok(traceArtifactOf(f.name), "留痕账里只该有留痕：" + f.rel);
		}
		// ③ 留痕与产物**不许重叠**（同一份文件不能既列出又报数）
		const listed = new Set(d.outputs.allPaths);
		for (const p of d.outputs.trace.allPaths) assert.equal(listed.has(p), false, "同一份东西不能既列出又进留痕账：" + p);
	}
});
