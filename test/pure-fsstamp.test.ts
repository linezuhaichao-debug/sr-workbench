/**
 * 版本串 → 时间（工单 25）。
 *
 * ★ 这一套的**意义**：V11 能不能判"审查报告比定稿旧"，全看这一层解析对不对。
 *   所以用例分两类：
 *     ① **真实数据**：拿磁盘上那份真定稿的 bigint stat 拼出与宿主同形的版本串，
 *        再断言解析出来的毫秒数**正好等于**文件的 mtimeNs —— 这条是"实测链"的回归网；
 *     ② **反例**：4 段 / 6 段 / 非数字 / 时间越界 / 空 —— 一律 `null` / `0`（**认不出来就不猜**）。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { MS_MAX, MS_MIN, atText, mtimeOf, stampOf } from "../src/pure/fsstamp.ts";
import { FINAL_GDD, requireRealData } from "./paths.ts";

/** 本地时区的 `YYYY-MM-DD HH:mm`（与 `atText` 同口径，但**在用例里独立写一遍**，不引用被测实现） */
function localText(ms: number): string {
	const d = new Date(ms);
	const p = (n: number) => (n < 10 ? "0" : "") + n;
	return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

test("真实数据：磁盘上那份定稿的版本串 → 毫秒数 == 文件的 mtimeNs（宿主同一形状）", () => {
	requireRealData();
	const ni = fs.statSync(FINAL_GDD, { bigint: true });
	// 与官方 `dsh-fs-local` 的 `versionOf(info)` 逐字同形：`dev:ino:size:mtimeNs:ctimeNs`
	const version = String(ni.dev) + ":" + String(ni.ino) + ":" + String(ni.size) + ":" + String(ni.mtimeNs) + ":" + String(ni.ctimeNs);
	const st = stampOf(version);
	assert.ok(st, "5 段十进制必须认出来：" + version);
	assert.equal(st!.ms, Number(ni.mtimeNs / 1000000n), "第 4 段（纳秒）→ 毫秒：与 node 的 bigint stat 一致");
	assert.equal(st!.ns, String(ni.mtimeNs));
	assert.equal(st!.size, String(ni.size));
	assert.equal(mtimeOf(version), st!.ms);
	assert.equal(atText(st!.ms), localText(Number(ni.mtimeNs / 1000000n)), "人类可读时间用本地时区，与 Date 同口径");
});

test("实测原文（_25-stat-evidence.txt 抄下来的真串）解析出的毫秒数逐字对得上", () => {
	// 联盟悬赏_20260923_定稿.md（探针输出：第 4 段 → 2026-09-30 13:17:07，epoch_ms = 1790745427388）
	const v = "3303700497:20829148276945773:40935:1790745427388225100:1790745427390224900";
	const st = stampOf(v);
	assert.ok(st);
	assert.equal(st!.ms, 1790745427388);
	assert.equal(st!.dev, "3303700497");
	assert.equal(st!.ino, "20829148276945773");
	assert.equal(st!.size, "40935");
	// 18 位以上的纳秒**不能用浮点除法**（超安全整数）—— 砍后 6 位必须精确
	assert.equal(stampOf("1:2:3:1790745427388225100:4")!.ms, 1790745427388);
	// 时间越界（1970 / 1999 / 2101）一律不认：宁可"看不到时间"，不要编一个错时间
	assert.equal(stampOf("1:2:3:0:4"), null);
	assert.equal(stampOf("1:2:3:" + (MS_MIN - 1) + "000000" + ":4"), null, "下界之下（1999 年）不认");
	assert.ok(stampOf("1:2:3:" + MS_MIN + "000000:4"), "下界（2000-01-01）本身是认的");
	assert.ok(stampOf("1:2:3:" + MS_MAX + "000000:4"), "上界本身是认的");
	assert.equal(stampOf("1:2:3:" + (MS_MAX + 1) + "000000:4"), null, "上界之上（2100 年之后）不认");
});

test("反例：段数不对 / 非数字 / 空 —— 一律 null（认不出来不猜）", () => {
	for (const bad of [
		"", "dev:1:2:3:4",                     // 4 段 + 非数字前缀（旧测试替身的形状）
		"3303700497:2251799813693374:39495:1789983263543798700",   // 4 段（缺 ctime）
		"1:2:3:4:5:6",                          // 6 段
		"a:1:2:3:4", "1:2:3:4:x", "-1:2:3:4:5",
		"1:2:3", "dev:absent", "unavailable", "3303700497:2251799813693374:39495:1789983263543798700:"
	]) {
		assert.equal(stampOf(bad), null, "不该认出：" + JSON.stringify(bad));
		assert.equal(mtimeOf(bad), 0, "认不出给 0（= 看不到时间），不是 1970");
	}
	assert.equal(stampOf(null), null);
	assert.equal(stampOf(undefined), null);
	assert.equal(mtimeOf(null), 0);
});

test("atText：拿到 0 / 非法值给空串（不编时间）", () => {
	assert.equal(atText(0), "");
	assert.equal(atText(undefined), "");
	assert.equal(atText(-5), "");
	assert.equal(atText("不是数字"), "");
	assert.equal(atText(NaN), "");
});
