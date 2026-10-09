/**
 * 决策记录的**时间线分组**（纯函数，零 IO）。
 *
 * 用途：面板把决策记录按天分组显示（今天 / 昨天 / 本周 / 更早），
 * 每组一个组头、组内一条一条挂在左侧时间轴上 —— 而不是"一大片文字"。
 *
 * ★ 分组只按**日期**（本机时区，与时间戳的写法一致），不按时间差：
 *   「昨天 23:50」与「今天 00:10」差 20 分钟，但那是两天，分属两组才符合直觉。
 */

/** `YYYY-MM-DD`（解析不出来返回空串）。 */
export function dayKeyOf(stamp: unknown): string {
	const s = String(stamp === null || stamp === undefined ? "" : stamp).trim();
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
	return m === null ? "" : m[1] + "-" + m[2] + "-" + m[3];
}

/** 本机某天的 `YYYY-MM-DD`。 */
function localDayKey(d: Date): string {
	const p = (n: number) => (n < 10 ? "0" : "") + n;
	return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

/**
 * 一条记录属于哪一组：`today` / `yesterday` / `week` / `earlier`（时间戳读不出来的归 `unknown`）。
 * 「本周」按 7 天算（不做自然周 —— 自然周在不同地区定义不同，7 天更稳）。
 */
export function dayBucketOf(stamp: unknown, now?: Date): string {
	const key = dayKeyOf(stamp);
	if (key === "") return "unknown";
	const ref = now instanceof Date ? now : new Date();
	const today = localDayKey(ref);
	if (key === today) return "today";
	const y = new Date(ref.getTime());
	y.setDate(y.getDate() - 1);
	if (key === localDayKey(y)) return "yesterday";
	const w = new Date(ref.getTime());
	w.setDate(w.getDate() - 6);
	if (key >= localDayKey(w)) return "week";
	return "earlier";
}

/** 组名（界面显示）。 */
export const BUCKET_LABEL: Record<string, string> = {
	today: "今天",
	yesterday: "昨天",
	week: "本周",
	earlier: "更早",
	unknown: "读不出时间"
};

export interface TimelineGroup<T> {
	bucket: string;
	label: string;
	entries: T[];
}

/**
 * 按天分组，**保持入参顺序**（调用方已经按"最新在前"排好）。
 * 同一组内不会再拆 —— 组序 = 首次出现的顺序。
 */
export function groupTimeline<T extends { at?: unknown }>(entries: T[], now?: Date): Array<TimelineGroup<T>> {
	const out: Array<TimelineGroup<T>> = [];
	const of: Record<string, TimelineGroup<T>> = {};
	for (const e of entries || []) {
		const b = dayBucketOf(e && e.at, now);
		if (of[b] === undefined) {
			of[b] = { bucket: b, label: BUCKET_LABEL[b] || "更早", entries: [] };
			out.push(of[b]);
		}
		of[b].entries.push(e);
	}
	return out;
}
