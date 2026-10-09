/** 决策记录时间线分组（P2）的判据。 */
import assert from "node:assert/strict";
import test from "node:test";

import { BUCKET_LABEL, dayBucketOf, dayKeyOf, groupTimeline } from "../src/pure/timeline.ts";

const NOW = new Date(2026, 9, 9, 15, 30, 0);   // 本机时间 2026-10-09 15:30（月份从 0 数）

test("日期键：认 YYYY-MM-DD 前缀，读不出来给空串", () => {
	assert.equal(dayKeyOf("2026-10-09 15:30:00"), "2026-10-09");
	assert.equal(dayKeyOf("2026-10-09"), "2026-10-09");
	assert.equal(dayKeyOf("（没有时间戳）"), "");
	assert.equal(dayKeyOf(""), "");
	assert.equal(dayKeyOf(null), "");
});

test("分组只按日期：昨天 23:50 与今天 00:10 分属两组（不按时间差）", () => {
	assert.equal(dayBucketOf("2026-10-09 00:10:00", NOW), "today");
	assert.equal(dayBucketOf("2026-10-08 23:50:00", NOW), "yesterday", "只差 20 分钟，但那是昨天");
	assert.equal(dayBucketOf("2026-10-09 23:59:59", NOW), "today", "今天晚些时候也算今天");
});

test("本周按 7 天算；更早归 earlier；读不出时间单独一组", () => {
	assert.equal(dayBucketOf("2026-10-07 09:00:00", NOW), "week");
	assert.equal(dayBucketOf("2026-10-03 09:00:00", NOW), "week", "距今 6 天：还在本周");
	assert.equal(dayBucketOf("2026-10-02 09:00:00", NOW), "earlier", "距今 7 天：更早");
	assert.equal(dayBucketOf("2026-01-01 09:00:00", NOW), "earlier");
	assert.equal(dayBucketOf("随便写的", NOW), "unknown");
	assert.equal(BUCKET_LABEL.unknown, "读不出时间");
});

test("groupTimeline：保持入参顺序，同组连续，组内不拆", () => {
	const entries = [
		{ index: 5, at: "2026-10-09 15:00:00" },
		{ index: 4, at: "2026-10-09 09:00:00" },
		{ index: 3, at: "2026-10-08 20:00:00" },
		{ index: 2, at: "2026-10-06 11:00:00" },
		{ index: 1, at: "没有时间戳" }
	];
	const g = groupTimeline(entries, NOW);
	assert.deepEqual(g.map((x) => x.bucket), ["today", "yesterday", "week", "unknown"]);
	assert.deepEqual(g.map((x) => x.label), ["今天", "昨天", "本周", "读不出时间"]);
	assert.deepEqual(g[0].entries.map((e) => e.index), [5, 4], "同一天的按原顺序留着");
	assert.deepEqual(g[1].entries.map((e) => e.index), [3]);
	assert.equal(g.reduce((a, x) => a + x.entries.length, 0), entries.length, "一条都不丢");
});

test("groupTimeline：空表给空数组（界面据此显示空态）", () => {
	assert.deepEqual(groupTimeline([], NOW), []);
});
