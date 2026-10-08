/**
 * 定稿门（工单 25）—— **人话 + "能不能交程序"** 的回归网。
 *
 * 判据不在这里重算，所以用例的输入直接由**真判据**产出（`checkFinals` / `checkV11`），
 * 这样"判据 → 人话"这条翻译链与面板上跑的完全一致。
 *
 * 覆盖工单 25 的五条：
 *   · ① 多份同时标为可用（真实数据形状：联盟悬赏两份 `status: active`）
 *   · ② 旧定稿未归档（只一份 active 时独立出现）
 *   · ③ 没有任何可用定稿（没有任何定稿 / 有定稿但一份都不标可用）
 *   · 审查是**必经**一步：缺失 / 比定稿旧 / **看不到时间** 都不放行
 *   · 阻断级正文校验（V3 / V6）也不放行
 */

import assert from "node:assert/strict";
import test from "node:test";

import { checkFinals } from "../src/pure/finalgdd.ts";
import { finalGate, reviewGateOf } from "../src/pure/finalgate.ts";
import { checkV11 } from "../src/pure/vchecks.ts";

/** 真实时间（探针实测；epoch ms） */
const MS_0921 = Date.parse("2026-09-22T18:32:29+08:00");
const MS_0923 = 1790745427388;          // 联盟悬赏_20260923_定稿.md（探针输出逐字）
const MS_REVIEW_OLD = Date.parse("2026-09-21T16:51:38+08:00");
const MS_REVIEW_NEW = Date.parse("2026-10-01T09:00:00+08:00");

/** 跑一遍"判据 → 门"（与 `loadFeatureDetail` 里的编排同序） */
function gateOf(
	finals: Array<{ name: string; status?: unknown; mtime?: number }>,
	reviews: Array<{ name: string; mtime?: number }>,
	errors: Array<{ code?: string; msg?: string }> = []
) {
	const fc = checkFinals(finals);
	const reviewMs: Record<string, number> = {};
	for (const r of reviews) reviewMs[r.name] = Number(r.mtime) || 0;
	const cur = finals.filter((f) => f.name === fc.current)[0];
	const finalMs = Number((cur && cur.mtime) || 0);
	const v11 = checkV11({ final: fc.current ? { name: fc.current, mtime: finalMs } : null, reviews: reviews });
	return finalGate({ finalCheck: fc, v11: v11, finalMs: finalMs, reviewMs: reviewMs, errors: errors });
}

// ── ① 多份同时标为可用（真实数据：联盟悬赏 20260921 + 20260923 都 active）──────
test("① 多份同时标为可用 ⇒ 不放行；人话里同时说清「旧的那份没归档」", () => {
	const g = gateOf(
		[
			{ name: "联盟悬赏_20260923_定稿.md", status: "active", mtime: MS_0923 },
			{ name: "联盟悬赏_20260921_定稿.md", status: "active", mtime: MS_0921 }
		],
		[
			{ name: "联盟悬赏_20260921_审查.md", mtime: MS_REVIEW_OLD },
			{ name: "联盟悬赏_20260921_定稿_审查.md", mtime: MS_REVIEW_OLD }
		]
	);
	assert.equal(g.state, "blocked");
	assert.equal(g.canHandOff, false);
	assert.equal(g.current, "联盟悬赏_20260923_定稿.md", "按功能身份 + 文件名日期取最新那份");
	assert.equal(g.currentFrom, "active");
	assert.deepEqual(g.alarms.map((a) => a.code), ["V1", "V11"]);
	assert.match(g.alarms[0].say, /同时有 2 份定稿标着「可用」/);
	assert.match(g.alarms[0].say, /联盟悬赏_20260923_定稿\.md \/ 联盟悬赏_20260921_定稿\.md/, "按日期倒序列出（新的在前）");
	assert.match(g.alarms[0].say, /旧的那份没标「归档」/);
	assert.match(g.headline, /^先别交程序 —— 同时有 2 份定稿标着「可用」/);
	assert.match(g.next, /archived/);
	// 审查这一关也如实说（两份 20260921 的报告匹配不上 20260923 这份定稿）
	assert.equal(g.review.state, "missing");
	assert.match(g.review.say, /还差审查这一步/);
});

// ── ② 旧定稿未归档（只一份 active ⇒ V1c 独立出现）────────────────────────────
test("② 旧定稿没标归档 ⇒ 独立告警（人话）；其余关都过了就说可以交", () => {
	const g = gateOf(
		[
			{ name: "联盟悬赏_20260923_定稿.md", status: "active", mtime: MS_0923 },
			{ name: "联盟悬赏_20260921_定稿.md", status: "pending", mtime: MS_0921 }
		],
		[{ name: "联盟悬赏_20260923_审查.md", mtime: MS_REVIEW_NEW }]
	);
	assert.deepEqual(g.alarms.map((a) => a.code), ["V1c"]);
	assert.match(g.alarms[0].say, /旧定稿没标「归档」：联盟悬赏_20260921_定稿\.md/);
	assert.equal(g.review.state, "fresh");
	assert.equal(g.state, "ok");
	assert.equal(g.canHandOff, true);
	assert.match(g.headline, /^可以交程序 —— 联盟悬赏_20260923_定稿\.md$/);
	assert.equal(g.next, "");
	assert.match(g.say, /按 `status: active` \+ 文件名日期/);
});

// ── ③ 没有任何可用定稿（诸神降临：有 1 份成稿、0 份定稿）──────────────────────
test("③ 没有任何可用定稿 ⇒ 交不了（没有定稿 / 有定稿但一份都不标可用）", () => {
	const none = gateOf([], [{ name: "诸神降临_20260915_审查.md", mtime: MS_REVIEW_OLD }]);
	assert.equal(none.state, "none");
	assert.equal(none.canHandOff, false);
	assert.equal(none.current, null);
	assert.deepEqual(none.alarms.map((a) => a.code), ["V1b"]);
	assert.match(none.headline, /还没有定稿 —— 交不了程序/);
	assert.match(none.review.say, /还没有定稿，审查这一步还没到/);

	const noActive = gateOf([{ name: "联盟悬赏_20260923_定稿.md", status: "pending", mtime: MS_0923 }], []);
	assert.equal(noActive.state, "blocked");
	assert.match(noActive.headline, /没有一份定稿标着「可用」/);
	assert.match(noActive.next, /status: active/);
	assert.match(noActive.say, /没有一份标着「可用」/);
});

// ── 审查关的四种状态（必经；判不了 = 不放行）────────────────────────────────
test("审查关：缺失 / 比定稿旧 / 看不到时间 ⇒ 都不放行；比定稿新才放行", () => {
	const fin = [{ name: "联盟悬赏_20260923_定稿.md", status: "active", mtime: MS_0923 }];
	const rep = "联盟悬赏_20260923_审查.md";

	const missing = gateOf(fin, []);
	assert.equal(missing.review.state, "missing");
	assert.match(missing.headline, /还差审查这一步/);
	assert.equal(missing.canHandOff, false);

	const stale = gateOf(fin, [{ name: rep, mtime: MS_REVIEW_OLD }]);
	assert.equal(stale.review.state, "stale");
	assert.match(stale.headline, /审查报告比定稿旧/);
	assert.match(stale.review.say, /比定稿旧/);
	assert.ok(stale.review.reportAt && stale.review.finalAt, "两边的时间都要给人话");
	assert.equal(stale.canHandOff, false);

	const noTime = gateOf(fin, [{ name: rep, mtime: 0 }]);
	assert.equal(noTime.review.state, "unknown-time");
	assert.match(noTime.headline, /看不到时间/);
	assert.match(noTime.review.say, /面板看不到时间，无法判断审查报告是不是比定稿旧/);
	assert.match(noTime.next, /兜底/);
	assert.equal(noTime.canHandOff, false, "★ 判不了就不当有效（绝不放行）");

	const fresh = gateOf(fin, [{ name: rep, mtime: MS_REVIEW_NEW }]);
	assert.equal(fresh.review.state, "fresh");
	assert.equal(fresh.canHandOff, true);
	assert.match(fresh.review.say, /审查报告比定稿新/);
});

test("定稿的时间拿不到（版本串解析失败）⇒ 同样不放行（判不了 ≠ 有效）", () => {
	const g = gateOf(
		[{ name: "联盟悬赏_20260923_定稿.md", status: "active", mtime: 0 }],
		[{ name: "联盟悬赏_20260923_审查.md", mtime: MS_REVIEW_NEW }]
	);
	assert.equal(g.review.state, "unknown-time");
	assert.equal(g.canHandOff, false);
	assert.match(g.headline, /看不到时间/);
});

test("阻断级正文校验（V3 / V6）也放行不了；V5 是 info、不影响结论", () => {
	const fin = [{ name: "联盟悬赏_20260923_定稿.md", status: "active", mtime: MS_0923 }];
	const rev = [{ name: "联盟悬赏_20260923_审查.md", mtime: MS_REVIEW_NEW }];
	const withV3 = gateOf(fin, rev, [{ code: "V3", msg: "§7 文本键重复定义 `alli_boss_kill_count_label`" }]);
	assert.equal(withV3.state, "blocked");
	assert.match(withV3.headline, /还有 1 条阻断级校验没过（V3）/);
	assert.equal(withV3.canHandOff, false);
	assert.equal(withV3.alarms.filter((a) => a.code === "V3")[0].level, "error");
	// 审查关过了、正文也干净 ⇒ ok
	assert.equal(gateOf(fin, rev).state, "ok");
});

// ── reviewGateOf 的直接口径（供面板在别处复用时用）──────────────────────────
test("reviewGateOf：没有定稿时不谈审查这一步", () => {
	const r = reviewGateOf({ finalCheck: { current: null }, v11: null });
	assert.equal(r.state, "no-final");
	assert.match(r.say, /还没有定稿/);
});
