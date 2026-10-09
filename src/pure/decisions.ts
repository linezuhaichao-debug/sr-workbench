/**
 * 决策记录 · **一个功能一个文件**的解析与格式定义（v5 口径）。
 *
 * ── 为什么只有一份文件 ─────────────────────────────────────────────────────
 * v4 及以前：每次 Human Gate 落一份 `decisions\decision_<主题>_<日期>.json`（16 个必填字段、
 * status 枚举、ID 正则）。结果是"决策"被拆成几十份 JSON，**只有审计能读，人读不了**；
 * 而且它只管 Human Gate —— 会话里那些"顺手定下来的事"根本没有地方落。
 *
 * v5：一个功能的**所有决策**（不管发生在哪个 skill、哪一步）都**追加**到同一个文件：
 *
 *     features\<主题>\decisions\决策记录.md
 *
 * 条目形式就是用户要的那两样东西：**时间（年月日时分秒）+ 决策内容**。
 *
 * ── 文件格式（唯一权威；skill / 预设 / 操作文档都引这一份）─────────────────
 *
 *     # 决策记录 · <主题>
 *
 *     <!-- 追加式账本：只在文件末尾追加，不修改、不删除已有条目。 -->
 *
 *     ## 2026-10-08 14:23:05
 *     **决策**：采用方案 A —— 联盟成员共享 BOSS 血量。
 *     **依据**：<为什么这么定>
 *     **影响**：<改了哪些东西 / 下游要注意什么>
 *
 *   · 条目头 = **二级标题 + 时间戳**（`YYYY-MM-DD HH:mm:ss`，本地时间）。
 *     时间戳也接受 `YYYYMMDDHHmmss` 紧凑写法与 `/` `.` 分隔 —— 解析器认得，写的时候用规范写法。
 *   · 标题后面可以跟 ` · <一句话标题>`（可读性用，解析器会取出来）。
 *   · 正文里 `**决策**：` 那一行是**决策内容**（必填）；依据 / 影响选填。
 *     正文是自由的 markdown —— 解析器只认时间戳那一行，正文一个字段都不强制。
 *   · 第一条条目的时间戳之前的内容算**文件前言**（面板原样显示）。
 *
 * ── 纪律（面板不改文件，但加载器要按它判定）────────────────────────────────
 *   · **追加**：新条目永远加在末尾；同一分钟也可以有多条（时间戳不是唯一键，序号才是）。
 *   · 不解析状态机、不要求 ID：决策就是"什么时候定了什么事"。
 *
 * 纯函数、零 IO、零时钟（`stampOf` 要调用方把 `Date` 传进来，测试才能逐字断言）。
 */

/** 决策文件在功能目录里的位置（**唯一出处**：面板、预设、skill、文档都引它）。 */
export const DECISIONS_DIR = "decisions";
export const DECISION_FILE = "决策记录.md";
/** 功能根下的相对路径（正斜杠，Windows 两种分隔符都认）。 */
export const DECISION_REL = DECISIONS_DIR + "/" + DECISION_FILE;

/**
 * 时间戳文法：`YYYY-MM-DD HH:mm:ss`（规范写法），也认 `/` `.` 分隔与 `T` 分隔、
 * 以及 `YYYYMMDDHHmmss` 紧凑写法（14 位数字，年月日时分秒连写）。
 * 分组恒为 年/月/日/时/分/秒。
 */
const STAMP_LOOSE = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})/;
const STAMP_COMPACT = /(?<!\d)(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?!\d)/;
/** 标题行（1~6 级都认：一级当文档标题，2 级及以上带时间戳的才是条目）。 */
const HEADING = /^(#{1,6})\s+(.*)$/;

const pad2 = (n: number) => (n < 10 ? "0" : "") + String(n);
const pad4 = (n: number) => String(n).padStart(4, "0");

/** 一个 `Date` → 规范时间戳 `YYYY-MM-DD HH:mm:ss`（**本地时间**；面板与 skill 都用这一份）。 */
export function stampOf(date: Date): string {
	const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date(0);
	return (
		pad4(d.getFullYear()) + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
		" " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds())
	);
}

/** 一串文本里有没有时间戳（标题是不是"条目头"的判据）。 */
export function hasStamp(text: unknown): boolean {
	const s = String(text == null ? "" : text);
	return STAMP_LOOSE.test(s) || STAMP_COMPACT.test(s);
}

/**
 * 从一行标题里取时间戳 → 规范写法（取不到返回空串）。
 * 宽松写法会被**归一**成规范写法 —— 面板上就不会出现两种时间格式。
 */
export function stampIn(text: unknown): string {
	const s = String(text == null ? "" : text);
	const m = STAMP_LOOSE.exec(s);
	if (m) {
		return pad4(+m[1]) + "-" + pad2(+m[2]) + "-" + pad2(+m[3]) + " " + pad2(+m[4]) + ":" + pad2(+m[5]) + ":" + pad2(+m[6]);
	}
	const c = STAMP_COMPACT.exec(s);
	if (c) {
		return c[1] + "-" + c[2] + "-" + c[3] + " " + c[4] + ":" + c[5] + ":" + c[6];
	}
	return "";
}

/** 一条决策记录。 */
export interface DecisionEntry {
	/** 1-based，文件里的第几条（**唯一键** —— 时间戳可能重复）。 */
	index: number;
	/** 规范时间戳 `YYYY-MM-DD HH:mm:ss`。 */
	at: string;
	/** 时间戳之后那句可选标题（`## <时间> · <标题>` 里 ` · ` 之后的部分）。 */
	title: string;
	/** 正文（不含标题行），原始 markdown，已去首尾空行。 */
	body: string;
	/** 条目第一行在文件里的行号（1-based）。 */
	line: number;
}

export interface DecisionLog {
	/** 文件读到了没有（false = 还没建，面板如实说"还没有决策记录"）。 */
	present: boolean;
	/** 一级标题（`# 决策记录 · <主题>`）；没有就空串。 */
	title: string;
	/** 第一条条目之前的内容（不含一级标题）—— 使用说明 / 前言，面板原样显示。 */
	preamble: string;
	/** 条目，**文件顺序**（最老的在最前；面板倒序显示是面板的事）。 */
	entries: DecisionEntry[];
	/** 解析容错：如实报出来（不静默吞）。 */
	issues: string[];
	/** 原始文本（面板"看原文"用）。 */
	text: string;
}

/**
 * 决策文件 → 结构化条目。
 *
 * 判定规则（只有这一份实现）：
 *   · 一个 `##`（及更深）标题里**带时间戳** ⇒ 它是条目头，开一条新条目；
 *   · 其它行归**当前条目**的正文（还没遇到任何条目头时归 `preamble`）；
 *   · `#` 一级标题单独取出当 `title`（不作为条目，也不进前言）。
 *
 * 容错（都进 `issues`，绝不静默）：
 *   · 时间戳之前的正文非空（除了 H1）⇒ 提示"成了前言"；
 *   · 时间戳之后又出现**不带时间戳的标题** ⇒ 提示"它被并进了上一条"（这多半是想开新条目却漏了时间）。
 */
export function parseDecisionLog(text: unknown): DecisionLog {
	const raw = String(text == null ? "" : text);
	const lines = raw.split(/\r?\n/);
	const entries: DecisionEntry[] = [];
	const issues: string[] = [];
	const preambleLines: string[] = [];
	let title = "";
	let cur: { at: string; title: string; line: number; body: string[] } | null = null;
	/** 已经离开前言、正在收条目的正文 */
	let sawEntry = false;

	const heading = (line: string) => HEADING.exec(String(line).replace(/\s+$/, ""));

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const no = i + 1;
		const hm = heading(line);
		if (hm) {
			// ① 一级标题 = 文档标题（`# 决策记录 · <主题>`），不是条目、也不进前言
			if (hm[1] === "#") {
				if (cur) cur.body.push(line);
				else if (title === "") title = String(hm[2]).trim();
				else preambleLines.push(line);
				continue;
			}
			const at = stampIn(hm[2]);
			if (at !== "") {
				if (cur) entries.push(finish(cur));
				// 标题：取 ` · ` / `·` 之后那段（`## 2026-10-08 14:23:05 · 采用方案 A`）
				const rest = hm[2].replace(/\s*·\s*/g, "\u0000");
				const segs = rest.split("\u0000");
				const head = segs.shift() || "";
				// 时间戳后面可能还跟着别的写法，去掉时间戳本身再取标题
				const tail = head.replace(STAMP_LOOSE, "").replace(STAMP_COMPACT, "").replace(/^[\s:：\-—·]+/, "").trim();
				const titleParts = [tail].concat(segs.map((s) => String(s).trim())).filter((s) => s !== "");
				cur = { at: at, title: titleParts.join(" · "), line: no, body: [] };
				sawEntry = true;
				continue;
			}
			// ② 不带时间戳的标题：并进当前条目（并如实提示）
			if (cur) {
				cur.body.push(line);
				issues.push(
					"第 " + no + " 行的标题「" + String(hm[2]).trim() + "」没有时间戳 —— 已并入上一条（第 " + cur.line +
					" 行）。要单开一条，请把标题写成 `## YYYY-MM-DD HH:mm:ss`。"
				);
			} else {
				preambleLines.push(line);
				issues.push("第 " + no + " 行的标题「" + String(hm[2]).trim() + "」没有时间戳，也不在任何条目里 —— 面板按前言显示。");
			}
			continue;
		}
		if (cur) cur.body.push(line);
		else preambleLines.push(line);
	}
	if (cur) entries.push(finish(cur));

	if (!sawEntry) {
		const hasText = raw.trim() !== "";
		if (hasText) issues.push("这份文件里还没有带时间戳的条目 —— 面板按原文显示；新条目请用 `## YYYY-MM-DD HH:mm:ss` 开头。");
	}

	return {
		present: raw.trim() !== "",
		title: title,
		preamble: trimBlank(preambleLines).join("\n"),
		entries: entries,
		issues: issues,
		text: raw
	};

	function finish(c: { at: string; title: string; line: number; body: string[] }): DecisionEntry {
		const body = trimBlank(c.body).join("\n");
		return { index: entries.length + 1, at: c.at, title: c.title, body: body, line: c.line };
	}
}

/** 去掉首尾空行（正文里的空行照留）。 */
function trimBlank(lines: string[]): string[] {
	let a = 0;
	let b = lines.length;
	while (a < b && String(lines[a]).trim() === "") a++;
	while (b > a && String(lines[b - 1]).trim() === "") b--;
	return lines.slice(a, b);
}

/** 决策内容的判据：正文里那行 `**决策**：…` / `决策：…`（取不到就退成正文第一行）。 */
export function decisionLineOf(body: unknown): string {
	const lines = String(body == null ? "" : body).split(/\r?\n/);
	for (const line of lines) {
		const m = /^\s*(?:\*\*)?\s*决策\s*(?:\*\*)?\s*[:：]\s*(.*)$/.exec(line);
		if (m) return m[1].trim();
	}
	for (const line of lines) if (line.trim() !== "") return line.trim();
	return "";
}

/** 面板上一行摘要用的"决策内容"（过长就截断，**不改变原文**）。 */
export function summaryOf(body: unknown, max?: number): string {
	const one = decisionLineOf(body).replace(/\s+/g, " ").trim();
	const cap = Math.max(20, Math.trunc(Number(max) || 160));
	return one.length > cap ? one.slice(0, cap) + "…" : one;
}

/** 时间戳 → 排序键（`YYYYMMDDHHmmss`；取不到返回空串，调用方按"最老"处理）。 */
export function sortKeyOf(at: unknown): string {
	return String(at == null ? "" : at).replace(/[-: ]/g, "");
}

/** 文件头（新建决策文件时写这一份；**唯一出处**）。 */
export function decisionHeader(topic: unknown): string {
	const t = String(topic == null ? "" : topic).trim() || "<主题>";
	return [
		"# 决策记录 · " + t,
		"",
		"<!-- 追加式账本：新条目一律写到文件末尾，不修改、不删除已有条目。",
		"     条目格式：`## YYYY-MM-DD HH:mm:ss` 开一条，正文写「决策 / 依据 / 影响」。",
		"     这个功能里的**所有决策**都记在这里，不管它发生在哪一步、哪个 skill。 -->",
		""
	].join("\n");
}

/** 一条条目的模板（预设 / skill / 面板的"复制格式"按钮都引它）。 */
export function decisionEntryTemplate(at: string, title?: string): string {
	const head = "## " + String(at || "YYYY-MM-DD HH:mm:ss") + (title ? " · " + String(title) : "");
	return [head, "**决策**：", "**依据**：", "**影响**：", ""].join("\n");
}
