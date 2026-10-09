/**
 * 相对时间的判据（`src/pure/reltime.ts`）。
 *
 * 钉住三件事：**档位边界**与宿主一致、**未来时间戳夹到"刚刚"**、**解析不出来返回空串**。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { parseStamp, relTimeOf } from "../src/pure/reltime.ts";

const NOW = new Date(2026, 9, 9, 17, 0, 0);   // 2026-10-09 17:00:00（本地时间）

/**
 * 把 Date 写成**本地**时间戳（`YYYY-MM-DD HH:mm:ss`）。
 * ★ 不能用 `toISOString()` —— 那是 **UTC**，而 `parseStamp` 按**本地时间**解析，
 *   两者混用会凭空差出一个时区（这个用例第一版就是这么挂的）。
 */
function stampLocal(d: Date): string {
	const p = (n: number) => (n < 10 ? "0" : "") + n;
	return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " +
		p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}

test("解析：接受空格与 T 分隔、可省秒；其它一律 null", () => {
	assert.equal(typeof parseStamp("2026-10-09 16:00:00"), "number");
	assert.equal(typeof parseStamp("2026-10-09T16:00:00"), "number");
	assert.equal(typeof parseStamp("2026-10-09 16:00"), "number");
	assert.equal(parseStamp(""), null);
	assert.equal(parseStamp("  "), null);
	assert.equal(parseStamp(null), null);
	assert.equal(parseStamp(undefined), null);
	assert.equal(parseStamp("2026/10/09 16:00:00"), null);
	assert.equal(parseStamp("昨天 16:00"), null);
	assert.equal(parseStamp("2026-10-09"), null, "只有日期不算时间戳（决策记录里一定有秒）");
});

test("档位边界与宿主一致：1 分 / 1 时 / 1 天 / 30 天 / 365 天", () => {
	const at = (ms) => relTimeOf(stampLocal(new Date(NOW.getTime() - ms)), NOW);
	assert.equal(at(0), "刚刚");
	assert.equal(at(59 * 1000), "刚刚");
	assert.equal(at(60 * 1000), "1 分钟前");
	assert.equal(at(59 * 60 * 1000), "59 分钟前");
	assert.equal(at(60 * 60 * 1000), "1 小时前");
	assert.equal(at(23 * 60 * 60 * 1000), "23 小时前");
	assert.equal(at(24 * 60 * 60 * 1000), "1 天前");
	assert.equal(at(29 * 24 * 60 * 60 * 1000), "29 天前");
	assert.equal(at(30 * 24 * 60 * 60 * 1000), "1 个月前");
	assert.equal(at(364 * 24 * 60 * 60 * 1000), "12 个月前");
	assert.equal(at(365 * 24 * 60 * 60 * 1000), "1 年前");
});

test("真实形状的时间戳", () => {
	assert.equal(relTimeOf("2026-10-09 16:57:29", NOW), "2 分钟前");
	assert.equal(relTimeOf("2026-10-09 14:00:00", NOW), "3 小时前");
	assert.equal(relTimeOf("2026-10-08 09:00:00", NOW), "1 天前");
});

test("未来时间戳（时钟偏差）夹到「刚刚」，绝不显示负数", () => {
	const future = stampLocal(new Date(NOW.getTime() + 10 * 60 * 1000));
	assert.equal(relTimeOf(future, NOW), "刚刚");
	for (const bad of ["", null, undefined, "不是时间", "2026-13-45 99:99:99"]) {
		assert.equal(relTimeOf(bad as never, NOW), "", "解析不出来要返回空串：" + String(bad));
	}
});
