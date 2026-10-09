/**
 * 相对时间（`3 分钟前`）：**纯函数**，判据可测。
 *
 * ── 为什么不用宿主 primitives 的 `relativeTime` ──────────────────────────────
 *   它返回的是 `{ unit: "minutes", n: 3 }` —— **结构化结果，还要调用方自己做本地化**
 *   （中文/英文词形得自己写）。既然词形总得自己写，那不如整支自己写：纯函数、
 *   同一个 `now` 进来结果一样，能进单测。
 *
 * ★ 单位档位与宿主那份**保持一致**（now / minutes / hours / days / months / years，
 *   阈值 1 分 / 1 时 / 1 天 / 30 天 / 365 天）—— 免得同一个时间在面板与宿主里说法不同。
 *
 * ── 判据（都会在 `test/pure-reltime.test.ts` 里钉住）────────────────────────
 *   · 未来时间戳（时钟偏差）**夹到"刚刚"**，不显示"负 3 分钟前"；
 *   · 解析不出来的时间戳返回空串 —— 界面据此**不显示**这一行，而不是显示一句假话。
 */

/** 宿主那套阈值（毫秒）。 */
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** 解析 `YYYY-MM-DD HH:mm:ss`（也接受 `YYYY-MM-DDTHH:mm:ss`），失败返回 `null`。 */
export function parseStamp(stamp: unknown): number | null {
	const s = String(stamp === null || stamp === undefined ? "" : stamp).trim();
	if (s === "") return null;
	const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
	if (!m) return null;
	const [y, mo, da, h, mi, se] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || "0")];
	// 决策记录里的时间戳是**本机时间**写下来的 ⇒ 按本地时间构造
	const d = new Date(y, mo - 1, da, h, mi, se);
	if (isNaN(d.getTime())) return null;
	/**
	 * ★ **回读比对**：`new Date` 对越界分量会自行进位（`2026-13-45 99:99:99` 会变成 2027 年 2 月），
	 *   所以"能构造出 Date"不等于"这个时间戳合法"。逐分量比一遍，不合法就返回 null ——
	 *   界面据此**不显示**这一行，而不是编一个假时间出来。
	 */
	if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da ||
		d.getHours() !== h || d.getMinutes() !== mi || d.getSeconds() !== se) {
		return null;
	}
	return d.getTime();
}

/**
 * `3 分钟前` / `2 小时前` / `5 天前` / `3 个月前` / `2 年前` / `刚刚`。
 * @param stamp 决策记录里的时间戳（`YYYY-MM-DD HH:mm:ss`）。
 * @param now 参照时刻（默认现在；用例里传固定值）。
 * @returns 人话；**解析不出来就返回空串**（界面据此不显示，不编）。
 */
export function relTimeOf(stamp: unknown, now?: Date): string {
	const at = parseStamp(stamp);
	if (at === null) return "";
	const ref = now instanceof Date ? now.getTime() : Date.now();
	const diff = Math.max(0, ref - at);   // 时钟偏差 ⇒ 夹到"刚刚"
	if (diff < MIN) return "刚刚";
	if (diff < HOUR) return Math.floor(diff / MIN) + " 分钟前";
	if (diff < DAY) return Math.floor(diff / HOUR) + " 小时前";
	if (diff < MONTH) return Math.floor(diff / DAY) + " 天前";
	if (diff < YEAR) return Math.floor(diff / MONTH) + " 个月前";
	return Math.floor(diff / YEAR) + " 年前";
}
