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

import { currentNameOf, traceArtifactOf } from "../src/pure/buckets.ts";
import { loadDashboard, loadDashboardInner } from "../src/load/dashboard.ts";
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
			// ★ 2026-10-13 更正：判据必须与 `outputGroupOf` **同一个** —— 它先 `currentNameOf` 把历史
			//   版本还原成当前版名再分类，所以「留痕的历史版本」（`x_审查_20261013_2.md`）本来就该进
			//   这一账。这里原来拿**原始名**再问一次 `traceArtifactOf`，漏了还原那一步 ⇒ 磁盘上一出现
			//   留痕的历史版本就误报（实测 `圣物系统_20261013_审查_20261013_2.md`）。
			assert.ok(traceArtifactOf(currentNameOf(f.name)), "留痕账里只该有留痕：" + f.rel);
		}
		// ③ 留痕与产物**不许重叠**（同一份文件不能既列出又报数）
		const listed = new Set(d.outputs.allPaths);
		for (const p of d.outputs.trace.allPaths) assert.equal(listed.has(p), false, "同一份东西不能既列出又进留痕账：" + p);
	}
});

// ════════════════════════════════════════════════════════════════════════════
// 「列不出来」与「列出来是空的」必须分得清 —— 残留清理的安全阀吃的就是这个信号
//   （`note` 非空 = 这一轮的功能列表不可信；空数组 = 可信的空，见 pure/leftovers.ts）
// ════════════════════════════════════════════════════════════════════════════

/** 只回 `features\` 那一层的假 port（别的路径一律列不出来）。 */
function featuresOnlyPort(listing: { entries: Array<{ name: string; type: string }>; truncated?: boolean } | "throw") {
	return {
		async listDir(p: string) {
			if (!/[\\/]features$/i.test(String(p))) throw new Error("没有这个目录：" + p);
			if (listing === "throw") throw new Error("列不出来：" + p);
			// `port.listDir` 直接回 `ListResult`（`{ok,value}` 那层是 Remote 的形状，端口已经解包过）
			return { path: p, entries: listing.entries, truncated: listing.truncated === true };
		}
	};
}

test("features\\ 列举被截断 ⇒ 如实刹车（note 非空）；列得出来但是空的 ⇒ 那是**可信的空**", async () => {
	const SR = "D:\\X\\workspace";
	const one = { name: "联盟讨伐", type: "directory" };

	const cut = await loadDashboardInner(featuresOnlyPort({ entries: [one], truncated: true }) as any, SR);
	assert.equal(cut.features.length, 1, "截断时列到的那一个照样给出来");
	assert.ok(String(cut.note).includes("截断"), "但必须如实说这一轮可能不全：" + cut.note);

	const fine = await loadDashboardInner(featuresOnlyPort({ entries: [one], truncated: false }) as any, SR);
	assert.equal(String(fine.note), "", "正常列举不许留刹车信号");

	const empty = await loadDashboardInner(featuresOnlyPort({ entries: [] }) as any, SR);
	assert.equal(String(empty.note), "", "列得出来但是空的 —— 可信的空（用户口径：看板空 ≠ 看板坏了）");
	assert.equal(empty.features.length, 0);

	const gone = await loadDashboardInner(featuresOnlyPort("throw") as any, SR);
	assert.ok(String(gone.note).length > 0, "`features\\` 整个列不出来时要有 note（那是另一回事：还没建 / 读不到工作区）");
});
