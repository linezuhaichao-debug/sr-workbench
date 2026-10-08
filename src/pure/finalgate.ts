/**
 * 定稿门（工单 25）—— 把"判据的输出"翻成**人话** + 一句"这份定稿能不能交程序"
 *
 * ── 它是翻译层，不是第二个判据层 ──────────────────────────────────────────────
 * 判据只有一份实现：
 *   · V1（多份 active / 旧稿未归档 / 无 active）→ `./finalgdd.ts` 的 `checkFinals`
 *   · V11（审查报告缺失 / 比定稿旧）→ `./vchecks.ts` 的 `checkV11`（工单 30）
 *   · V3 / V5 / V6 / V8 → `./vchecks.ts` 的 `scanFinalChecks`（经 `gddChecklist` 汇总）
 * 本模块**只做**三件事：
 *   ① 把上面那些机器口径翻成**人话**（面板上读得懂）；
 *   ② 明确"**没跑审查就不算可用**"（工单 25 第 2 条）—— 审查是**必经**一步；
 *   ③ 给一句结论：**能不能交程序**（工单 25 第 6 条的落点）。
 *
 * ── 一条硬口径：判不了 ≠ 有效 ────────────────────────────────────────────────
 * `checkV11` 在"拿不到时间"时（`mtime` 缺省 = 0）算不出 `stale`，于是它的 `hit` 会是 false
 * ——那是"没发现问题"，**不是"审过了"**。所以这一层单独看时间：
 *   匹配到的审查报告**任何一份时间未知** ⇒ 一律判 `unknown-time`（**不放行**），
 * 并在界面上如实写"面板看不到时间，无法判断新旧"。这一条是本票第 3 条的验收点。
 * （时间从哪来：`./fsstamp.ts` —— 宿主 `stat` 的版本串第 4 段是 mtime 纳秒，已实测。）
 *
 * ── 结论的判定顺序（固定，文档化）────────────────────────────────────────────
 *   ① 没有定稿（`none`）                     → 交不了
 *   ② 结构告警：多份「可用」/ 一份都没有      → 先别交（先决定哪一份是当前有效）
 *   ③ 审查关：缺失 / 比定稿旧 / 看不到时间    → 先别交（**必经**）
 *   ④ 阻断级正文校验（V3 / V6 这类 error）    → 先别交
 *   ⑤ 其余（warn / info）                    → 可以交，但清单在〔详情〕里
 * 顺序理由：②决定"哪一份才是当前有效"，不定下来谈审查没有意义；③是流程必经；
 * ④是正文级硬伤。三档都过了才说"可以交程序"。
 */

import { atText } from "./fsstamp.ts";

/** 面板上可读的一条告警（**人话**；`code` 只是背后那条判据的编号） */
export interface GateAlarm {
	code: string;
	level: "error" | "warn" | "info";
	say: string;
	files: string[];
}

/** 审查关的状态：`no-final` 没有定稿 / `missing` 没有对照的审查报告 /
 *  `stale` 报告比定稿旧 / `unknown-time` 看不到时间 / `fresh` 审过了 */
export type ReviewState = "no-final" | "missing" | "stale" | "unknown-time" | "fresh";

export interface ReviewGate {
	state: ReviewState;
	/** 人话一句 */
	say: string;
	/** 命中（逐字匹配）的审查报告文件名 */
	report: string;
	/** 这份报告的时间（人话；看不到为空串） */
	reportAt: string;
	/** 当前定稿的时间（人话；看不到为空串） */
	finalAt: string;
	/** 命中几份 */
	matched: number;
}

export interface FinalGate {
	/** ok = 可以交程序 · blocked = 先别交 · none = 还没有定稿 */
	state: "ok" | "blocked" | "none";
	/** 首屏那一行（人话、一句话；不带机器口径） */
	headline: string;
	/** 完整人话结论（详情页/门里念这一句） */
	say: string;
	/** 下一步（ok 时为空串） */
	next: string;
	/** 三种告警 + 阻断项（人话，逐条） */
	alarms: GateAlarm[];
	review: ReviewGate;
	current: string | null;
	/** `active` = 按 active 标记判定 · `date` = 没有 active，按文件名日期取最新 */
	currentFrom: string;
	canHandOff: boolean;
}

export interface FinalGateInput {
	/** `checkFinals` 的原样结论 */
	finalCheck?: {
		current?: string | null;
		currentFrom?: string;
		actives?: string[];
		pending?: string[];
		all?: Array<{ name: string }>;
		issues?: Array<{ code?: string; level?: string; msg?: string; files?: string[] }>;
	} | null;
	/** `checkV11` 的原样结论（`gddChecklist().checks.V11`） */
	v11?: { hit?: boolean; final?: string; match?: string[]; stale?: string[] } | null;
	/** 当前定稿的 mtime（epoch ms；0 = 面板看不到时间） */
	finalMs?: number;
	/** 逐份审查报告的 mtime（文件名 → epoch ms；缺省/0 = 看不到） */
	reviewMs?: Record<string, number>;
	/** 汇总清单里 **error 级**的问题（V3 / V6 这类）—— 它们也阻断"交程序" */
	errors?: Array<{ code?: string; msg?: string; files?: string[] }>;
}

/** 文件名里的日期（`联盟悬赏_20260921_定稿.md` → `2026-09-21`）；认不出给空串 */
function dateOfName(name: unknown): string {
	const m = /(\d{4})(\d{2})(\d{2})/.exec(String(name == null ? "" : name));
	return m ? m[1] + "-" + m[2] + "-" + m[3] : "";
}

/** `a / b`（把人话里的文件名列表拼起来；超过 3 个就截断，界面上不堆) */
function names(list: string[], max = 3): string {
	const xs = (list || []).map(String).filter((x) => x !== "");
	if (xs.length <= max) return xs.join(" / ");
	return xs.slice(0, max).join(" / ") + " 等 " + xs.length + " 份";
}

/**
 * 审查关（工单 25 第 2 / 第 3 条）。
 *
 * @param v11     - `checkV11` 的结论（逐字匹配规则在那边，本层不重写：`_审查.md` 且文件名以定稿名去 `_定稿.md` 后的前缀开头）
 * @param finalMs - 当前定稿的时间（0 = 看不到）
 * @param reviewMs - 审查报告的时间表（0/缺省 = 看不到）
 */
function reviewGateOf(input: FinalGateInput): ReviewGate {
	const fin = String((input.finalCheck && input.finalCheck.current) || "");
	const v11 = input.v11 || {};
	const match = (v11.match || []).map(String);
	const stale = (v11.stale || []).map(String);
	const finalMs = Number(input.finalMs) || 0;
	const msOf = (n: string) => Number((input.reviewMs || {})[n]) || 0;
	const finalAt = atText(finalMs);

	if (!fin) {
		return {
			state: "no-final", matched: 0, report: "", reportAt: "", finalAt: "",
			say: "还没有定稿，审查这一步还没到。"
		};
	}
	if (!match.length) {
		return {
			state: "missing", matched: 0, report: "", reportAt: "", finalAt: finalAt,
			say: "还差审查这一步：" + fin + " 没有对照的审查报告（`_审查.md`）—— 没跑审查，面板不把它算作可用。"
		};
	}
	// ★ 判不了就不放行：① 定稿的时间未知 ② 任何一份命中的报告时间未知 ⇒ 都不敢说"它审的是这一版"
	if (finalMs <= 0 || match.some((n) => msOf(n) <= 0)) {
		return {
			state: "unknown-time", matched: match.length, report: names(match), reportAt: "", finalAt: finalAt,
			say: "面板看不到时间，无法判断审查报告是不是比定稿旧（命中的审查报告 " + match.length + " 份：" + names(match) + "）—— 判不了就不当作有效。"
		};
	}
	if (match.length > stale.length) {
		// 最新那一份不早于定稿 ⇒ 审过了
		const newest = match.slice().sort((a, b) => msOf(b) - msOf(a))[0];
		return {
			state: "fresh", matched: match.length, report: newest, reportAt: atText(msOf(newest)), finalAt: finalAt,
			say: "审查报告比定稿新：" + newest + "（" + atText(msOf(newest)) + "）晚于定稿（" + finalAt + "）。"
		};
	}
	const newestStale = stale.slice().sort((a, b) => msOf(b) - msOf(a))[0] || match[0];
	return {
		state: "stale", matched: match.length, report: newestStale, reportAt: atText(msOf(newestStale)), finalAt: finalAt,
		say: "审查报告比定稿旧：" + names(stale) + "（" + atText(msOf(newestStale)) + "）早于定稿（" + finalAt + "）—— 这一版还没被审过。"
	};
}

/**
 * 定稿门：把 V1 / V11 / error 级校验翻成人话 + 一句"能不能交程序"。
 */
function finalGate(input: FinalGateInput): FinalGate {
	const inp = input || {};
	const fc = inp.finalCheck || null;
	const all = (fc && fc.all) || [];
	const actives = ((fc && fc.actives) || []).map(String);
	const current = (fc && fc.current) || null;
	const currentFrom = String((fc && fc.currentFrom) || "");
	const review = reviewGateOf(inp);
	const alarms: GateAlarm[] = [];

	// ── 三种情形的**人话**（判据来自 checkFinals 的 issues；这里只翻不必重算）──
	const issues = (fc && fc.issues) || [];
	for (const it of issues) {
		const code = String(it.code || "");
		const files = ((it.files as string[]) || []).map(String);
		if (code === "V1") {
			alarms.push({
				code: "V1", level: "error", files: files,
				say: "同时有 " + files.length + " 份定稿标着「可用」：" + names(files) +
					" —— 旧的那份没标「归档」，面板按文件名日期把 " + String(current || files[0]) + " 当当前有效的那一份。交程序之前得先定下来哪一份算数。"
			});
		} else if (code === "V1c") {
			alarms.push({
				code: "V1c", level: "warn", files: files,
				say: "旧定稿没标「归档」：" + names(files) + " —— 面板按文件名日期把它当历史版本，但文件自己没这么说。"
			});
		} else if (code === "V1b") {
			alarms.push({
				code: "V1b", level: "warn", files: files,
				say: "有 " + all.length + " 份定稿，但没有一份标着「可用」（`status: active`）—— 面板只能按文件名日期挑一份给你看。"
			});
		}
	}
	if (!all.length) {
		alarms.push({
			code: "V1b", level: "warn", files: [],
			say: "这个功能还没有定稿 —— 成稿有了也还没整合成能交程序的那一份。"
		});
	}

	// 审查关进告警（**必经**：缺失 / 比定稿旧 / 看不到时间都不放行）
	if (review.state === "missing" || review.state === "stale" || review.state === "unknown-time") {
		alarms.push({
			code: "V11", level: review.state === "unknown-time" ? "warn" : "warn",
			files: review.report ? review.report.split(" / ") : (current ? [current] : []),
			say: review.say
		});
	}

	// 阻断级正文校验（V3 / V6 这类；V1 已经在上面的三种情形里说过了）
	for (const e of (inp.errors || [])) {
		const code = String(e.code || "");
		if (code === "V1" || code === "V1b" || code === "V1c") continue;
		alarms.push({ code: code, level: "error", files: (e.files || []).map(String), say: String(e.msg || "") });
	}

	// ── 结论（顺序见文件头）──────────────────────────────────────────────────
	const structError = alarms.some((a) => a.level === "error" && (a.code === "V1" || a.code === "V1b"));
	/** ★ ③「没有任何可用定稿」：有定稿、但**一份都没标「可用」**（`active`）—— 也算结构性问题，不放行 */
	const noActive = all.length > 0 && !actives.length;
	const bodyError = alarms.filter((a) => a.level === "error" && !(a.code === "V1" || a.code === "V1b"));
	const none = !all.length;

	let state: FinalGate["state"] = "ok";
	let headline = "";
	let next = "";
	if (none) {
		state = "none";
		headline = "还没有定稿 —— 交不了程序（先跑一次「发起整合定稿」）";
		next = "在这个功能的「文档生成」里点〔发起整合定稿〕；跑完 sr-gdd-ai 再跑 sr-gdd-review，审查报告是**必经**的一步。";
	} else if (structError) {
		state = "blocked";
		headline = "先别交程序 —— 同时有 " + actives.length + " 份定稿标着「可用」（旧的那份没归档）";
		next = "先把旧的那份改成 `status: archived`（走 /sr-gdd-fix，或直接改头部字段）；面板随后只认日期最新的那一份。";
	} else if (noActive) {
		state = "blocked";
		headline = "先别交程序 —— 没有一份定稿标着「可用」";
		next = "让当前这份定稿的头部写上 `status: active`（sr-gdd-ai 整合完会写；手改也行）—— 面板只把标了「可用」的那份当当前有效。";
	} else if (review.state === "missing") {
		state = "blocked";
		headline = "先别交程序 —— 还差审查这一步";
		next = "在该功能的工作会话里跑一次 /sr-gdd-review（审查 `" + String(current) + "`）；审查报告落在 `gdd\\` 下、文件名带上这份定稿的前缀。";
	} else if (review.state === "stale") {
		state = "blocked";
		headline = "先别交程序 —— 审查报告比定稿旧";
		next = "重跑一次 /sr-gdd-review（让它审当前这一版）；报告的时间要比定稿新，面板才认。";
	} else if (review.state === "unknown-time") {
		state = "blocked";
		headline = "先别交程序 —— 面板看不到时间，判不了审查报告的新旧";
		next = "面板拿不到这两份文件的时间（宿主 `stat` 的版本串不是预期的形状）⇒ 判不了就不当有效。兜底：跑一次 /sr-gdd-review 出新报告；或让人把两份文件的修改时间告诉你。";
	} else if (bodyError.length) {
		state = "blocked";
		headline = "先别交程序 —— 还有 " + bodyError.length + " 条阻断级校验没过（" + Array.from(new Set(bodyError.map((a) => a.code))).join(" / ") + "）";
		next = "按〔详情〕里那条清单的行号改掉它们，再回这一屏。";
	} else {
		state = "ok";
		headline = "可以交程序 —— " + String(current);
		next = "";
	}

	const from = currentFrom === "date"
		? "没有一份标着「可用」，面板按文件名日期取的最新一份"
		: "按 `status: active` + 文件名日期（功能身份 = 目录，不靠猜文件名里的别的花样）";
	const say = none
		? headline
		: "当前有效：" + String(current) + "（" + from + "）。" +
			(state === "ok" ? "三道关都过了 —— 审查关：" + review.say : headline + "。");

	return {
		state: state, headline: headline, say: say, next: next,
		alarms: alarms, review: review,
		current: current, currentFrom: currentFrom,
		canHandOff: state === "ok"
	};
}

export { finalGate, reviewGateOf, dateOfName };
