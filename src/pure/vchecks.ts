/**
 * 定稿只读校验 V3 / V5 / V6 / V8 / V11（工单 30）+ 汇总「校验清单」接口
 *
 * 目标：**跑之前就把问题暴露**——这些检查全部只看定稿正文与文件名，不读配置表、不跑构建。
 * V1（同主题多份 active 定稿）已经由 `./finalgdd.ts` 的 `checkFinals` 实现，本模块**不重写它**，
 * 只把它的 issues 与这里五条汇总成同一张清单（面板告警条用）。
 *
 * ── 三条判据是**真实数据实测**出来的，别按直觉改（依据：30-v-checks-baseline.md）────────
 *   1. V6 是**单向**的：只有「§4 规则引用的配置字段、§6 没声明」算问题。
 *      反方向（§6 按整表声明了字段、§4 没引用）**不是问题**——真实定稿上它有 13 处，属正常。
 *      ⇒ 反方向只作为 `declsWithoutRef` 如实报数，**绝不生成 issue**。
 *   2. V8 必须区分「定义处」与「引用处」：`UE{n}` 在 §5 是**条目定义行**（表格第一列），
 *      在 §4/§10 与散文中只是提及；并且有 `{n}{字母}` 后缀族（`UE3` 与 `UE3a` 同族）。
 *      ⇒ **只有 §5 定义行判重号与跳号**。按"出现次数"判重会在真实定稿上得到 7 个假阳性
 *        （UE12/UE14 等只是被 §4 与散文反复提到）。
 *   3. V11 的判据 = 当前有效定稿**没有**逐字匹配的 `_审查.md`，或该审查报告比定稿旧。
 *
 * 纯函数、零 IO：定稿正文、定稿候选（文件名/frontmatter/时间）、审查报告清单都由调用方读进来。
 */

import { checkFinals } from "./finalgdd.ts";

/** 校验项的严重程度：error 阻断交付 · warn 交程序前应处理 · info 只报数、不判问题 */
type CheckLevel = "error" | "warn" | "info";

interface CheckIssue {
	code: string;
	level: CheckLevel;
	msg: string;
	/** 1-based 行号（能定位到出问题的条目）；无行号时为空数组 */
	lines: number[];
	/** 相关文件名（V1 / V11 这类按文件判的检查用） */
	files: string[];
}

interface CheckSpec {
	level: CheckLevel;
	title: string;
	/** 判据原文 —— 告警条上要能回答"这条凭什么算问题" */
	rule: string;
}

/**
 * 五条校验的规格表（**严重程度集中在这里**，改一处就够；不散在函数体里）。
 * 依据：30 的验收口径 —— 重复键 / 漏配 / 编号重号 = error；审查报告缺失或过旧 = warn（交程序前该补审）；
 * 「待配表」计数 = info（是**待办计数**，不是缺陷：真实定稿里 5 处都是"数值待配"的如实标注）。
 */
const VCHECK_SPECS: Record<string, CheckSpec> = {
	V3: {
		level: "error", title: "§7 多语言文本键重复",
		rule: "§7 表里同一个键出现两次 = 后一条覆盖前一条，文案与程序取到的值不一致"
	},
	V5: {
		level: "info", title: "「待配表」计数",
		rule: "统计正文里标了「待配表」的条目数——它们是数值待配的如实标注，不是缺陷，只在告警条上计数"
	},
	V6: {
		level: "error", title: "§4 引用的配置字段在 §6 没声明",
		rule: "§4 规则行的配置字段列引用了某个字段（`表.字段` 写法），§6 配置契约必须逐字声明它；反方向（§6 声明了但 §4 没引用）不算问题"
	},
	V8: {
		level: "error", title: "§5 交互条目编号重号 / 跳号",
		rule: "只在 §5 的条目定义行（表格第一列 = UE{n}）判：同一编号定义两次 = 重号；编号不连续 = 跳号；§4/§10 的提及与 {n}{字母} 后缀族都不算"
	},
	V11: {
		level: "warn", title: "审查报告缺失或比定稿旧",
		rule: "当前有效定稿应有逐字匹配的 `_审查.md`，且审查报告不得比定稿旧——否则这份定稿没被审过就当成了有效稿"
	}
};

/** 拆行（统一 CRLF / LF） */
function linesOf(text: unknown): string[] {
	return String(text == null ? "" : text).split(/\r?\n/);
}

/**
 * 每行所属的章号与章标题：`## 4. 功能规则` → 章号 "4"、标题 "4. 功能规则"。
 * 只认 level-2 标题（`## `）：`### 5.1 …` 属于 §5 的行，不新开章。
 */
function chaptersOf(lines: string[]): { nos: string[]; titles: string[] } {
	const nos: string[] = [];
	const titles: string[] = [];
	let no = "";
	let title = "";
	for (let i = 0; i < lines.length; i++) {
		const m = /^##\s+(\d+)[.、]?\s*(.*)$/.exec(lines[i]);
		if (m) {
			no = m[1];
			title = lines[i].replace(/^#+\s*/, "").trim();
		}
		nos.push(no);
		titles.push(title);
	}
	return { nos: nos, titles: titles };
}

/** 出现次数（不用正则，避免把待配表当模式） */
function countOf(line: string, needle: string): number {
	let n = 0;
	let at = line.indexOf(needle);
	while (at >= 0) {
		n++;
		at = line.indexOf(needle, at + needle.length);
	}
	return n;
}

// ── V3 · §7 多语言文本键重复 ────────────────────────────────────────────────
/** §7 里"一个键定义一次"的行：`| alli_boss_panel_title | 联盟悬赏 | 新增 |` */
function checkV3(lines: string[], chaps: { nos: string[]; titles: string[] }) {
	const byKey = new Map<string, number[]>();
	for (let i = 0; i < lines.length; i++) {
		if (chaps.nos[i] !== "7") continue;
		const m = /^\|\s*([A-Za-z0-9_]+)\s*\|/.exec(lines[i]);
		if (!m) continue;
		const at = byKey.get(m[1]);
		if (at) at.push(i + 1);
		else byKey.set(m[1], [i + 1]);
	}
	const dup: Array<{ key: string; lines: number[] }> = [];
	for (const kv of byKey) if (kv[1].length > 1) dup.push({ key: kv[0], lines: kv[1] });
	return {
		code: "V3", level: VCHECK_SPECS.V3.level, title: VCHECK_SPECS.V3.title, rule: VCHECK_SPECS.V3.rule,
		hit: dup.length > 0,
		keys: byKey.size,     // §7 里有多少个不同的键（真实定稿 48）
		dup: dup
	};
}

// ── V5 · 「待配表」计数 ────────────────────────────────────────────────────
/** 正文里标了「待配表」的条目（含 `**待配表**——…` 这种强调写法）。count=行数、occurrences=标记次数。 */
function checkV5(lines: string[], chaps: { nos: string[]; titles: string[] }) {
	const MARK = "待配表";
	const hits: Array<{ line: number; chapter: string; text: string }> = [];
	let occurrences = 0;
	for (let i = 0; i < lines.length; i++) {
		const n = countOf(lines[i], MARK);
		if (!n) continue;
		occurrences += n;
		hits.push({ line: i + 1, chapter: chaps.titles[i], text: lines[i].trim() });
	}
	return {
		code: "V5", level: VCHECK_SPECS.V5.level, title: VCHECK_SPECS.V5.title, rule: VCHECK_SPECS.V5.rule,
		hit: hits.length > 0,
		count: hits.length, occurrences: occurrences, hits: hits
	};
}

// ── V6 · §4 引用的配置字段 ↔ §6 声明的字段（**单向**）────────────────────────
/**
 * §4 的配置字段引用：反引号里形如 `` `A012-全局变量表.alliBossDailyAttackCount` `` 的写法。
 * ★ 实测边界：正则在**反引号内容以标识符收尾**时才算引用 —— 这正好排掉三类噪音：
 *   `` `A079-联盟悬赏.xlsx!BOSS表` 全行（bossName / weakness / …）``（整表引用，逐字段无声明）
 *   `` `A028-功能开启表.xlsx!功能开启.id=536` ``（值引用，不是字段名）
 *   `` `A079-联盟悬赏.xlsx!难度表.终极难度` ``（中文字段名，不是英文字段）
 */
const REF_RE = /`([^`]*?[!.]\s*)([A-Za-z][A-Za-z0-9_]*)`/g;
/** §6 声明的字段：表里第 3 格（`| 中文字段 | 英文字段 | … |`）整格就是一个反引号字段名 */
const DECL_RE = /^`([A-Za-z][A-Za-z0-9_]*)`$/;

function refsIn4(line: string, no: number) {
	const out: Array<{ line: number; ref: string; field: string }> = [];
	REF_RE.lastIndex = 0;
	let m = REF_RE.exec(line);
	while (m) {
		out.push({ line: no, ref: m[0].slice(1, -1), field: m[2] });
		m = REF_RE.exec(line);
	}
	return out;
}

function checkV6(lines: string[], chaps: { nos: string[]; titles: string[] }) {
	const refs: Array<{ line: number; ref: string; field: string }> = [];
	const declared: Array<{ line: number; field: string }> = [];
	for (let i = 0; i < lines.length; i++) {
		if (chaps.nos[i] === "4") {
			for (const r of refsIn4(lines[i], i + 1)) refs.push(r);
			continue;
		}
		if (chaps.nos[i] !== "6") continue;
		const cells = lines[i].split("|").map((c) => c.trim());
		if (cells.length < 6) continue;                       // §6.5 那类三列表，不是字段声明表
		const m = DECL_RE.exec(cells[2] || "");
		if (m) declared.push({ line: i + 1, field: m[1] });
	}
	const declSet = new Set(declared.map((d) => d.field));
	const missing = refs.filter((r) => !declSet.has(r.field));
	const unref = declared.filter((d) => !refs.some((r) => r.field === d.field));
	return {
		code: "V6", level: VCHECK_SPECS.V6.level, title: VCHECK_SPECS.V6.title, rule: VCHECK_SPECS.V6.rule,
		// ★ hit 只看方向① —— 方向②（unref，真实数据 13 处）**不算问题**
		hit: missing.length > 0,
		refCount: refs.length, declCount: declared.length,
		refsWithoutDecl: missing, declsWithoutRef: unref
	};
}

// ── V8 · §5 交互条目编号重号 / 跳号 ────────────────────────────────────────
/** 定义行：§5 表格第一列就是编号，`| UE17a | …` */
const DEF_ROW_RE = /^\|\s*(UE\d+[a-z]?)\s*\|/;
/** 任何位置的编号出现（定义 + 提及），用于报数；**不参与判问题** */
const UE_RE = /\bUE(\d+)([a-z]?)\b/g;

function checkV8(lines: string[], chaps: { nos: string[]; titles: string[] }) {
	const occ: Array<{ line: number; raw: string; n: number; suffix: string; chapter: string; definition: boolean }> = [];
	for (let i = 0; i < lines.length; i++) {
		UE_RE.lastIndex = 0;
		let m = UE_RE.exec(lines[i]);
		while (m) {
			occ.push({
				line: i + 1, raw: m[0], n: Number(m[1]), suffix: m[2],
				chapter: chaps.nos[i], definition: false
			});
			m = UE_RE.exec(lines[i]);
		}
	}

	// 定义处 = §5 表格第一列；同一行里"正文又提了一次自己"不算第二次定义
	const defs: Array<{ raw: string; n: number; suffix: string; line: number }> = [];
	for (let i = 0; i < lines.length; i++) {
		if (chaps.nos[i] !== "5") continue;
		const m = DEF_ROW_RE.exec(lines[i]);
		if (!m) continue;
		const raw = m[1];
		const dm = /^UE(\d+)([a-z]?)$/.exec(raw) as RegExpExecArray;
		defs.push({ raw: raw, n: Number(dm[1]), suffix: dm[2], line: i + 1 });
		const first = occ.find((o) => o.line === i + 1 && o.raw === raw);
		if (first) first.definition = true;
	}

	const byRaw = new Map<string, number[]>();
	for (const d of defs) {
		const at = byRaw.get(d.raw);
		if (at) at.push(d.line);
		else byRaw.set(d.raw, [d.line]);
	}
	const dup: Array<{ raw: string; n: number; lines: number[] }> = [];
	for (const kv of byRaw) if (kv[1].length > 1) dup.push({ raw: kv[0], n: (defs.find((d) => d.raw === kv[0]) as { n: number }).n, lines: kv[1] });

	// 编号族：{n}{字母} 后缀并入同一个 n（`UE3` 与 `UE3a` 同族）
	const byN = new Map<number, string[]>();
	for (const d of defs) {
		const at = byN.get(d.n);
		if (at) { if (at.indexOf(d.raw) < 0) at.push(d.raw); }
		else byN.set(d.n, [d.raw]);
	}
	const nums = Array.from(byN.keys()).sort((a, b) => a - b);
	const gaps: number[] = [];
	for (let i = 1; i < nums.length; i++) {
		for (let g = nums[i - 1] + 1; g < nums[i]; g++) gaps.push(g);
	}
	const families = nums.filter((n) => (byN.get(n) as string[]).length > 1).map((n) => ({ n: n, raws: byN.get(n) as string[] }));
	// 只被提及、没被定义过的编号：**只报数，不判问题**（与 V6 方向②同口径）
	const undefinedRefs = Array.from(new Set(occ.filter((o) => !o.definition).map((o) => o.n)))
		.filter((n) => !byN.has(n)).sort((a, b) => a - b);

	return {
		code: "V8", level: VCHECK_SPECS.V8.level, title: VCHECK_SPECS.V8.title, rule: VCHECK_SPECS.V8.rule,
		hit: dup.length > 0 || gaps.length > 0,
		total: occ.length,                       // 全文出现次数（真实定稿 34）
		unique: nums.length,                     // 出现过的编号个数（真实定稿 20）
		range: nums.length ? [nums[0], nums[nums.length - 1]] : null,
		definitions: defs.length,                // §5 定义行数（真实定稿 28）
		references: occ.filter((o) => !o.definition).length,
		gaps: gaps, dup: dup, families: families, undefinedRefs: undefinedRefs
	};
}

// ── V11 · 审查报告是否比定稿旧 / 不存在 ────────────────────────────────────
function timeOf(v: unknown): number {
	if (v == null) return 0;
	if (typeof v === "number") return v;
	if (v instanceof Date) return v.getTime();
	const t = Date.parse(String(v));
	return isNaN(t) ? 0 : t;
}

interface ReviewFile { name: string; mtime?: unknown }

/**
 * @param input.final   当前有效定稿（`{name, mtime}`）—— name 是带 `_定稿.md` 的文件名
 * @param input.reviews `gdd\` 下所有 `*_审查.md`（`{name, mtime}`）
 */
function checkV11(input: { final?: { name?: string; mtime?: unknown } | null; reviews?: ReviewFile[] }) {
	const fin = (input && input.final) || {};
	const name = String(fin.name || "");
	// 没有当前定稿就无从判"审查报告够不够新"——如实返回 hit=false（不编造问题）
	if (!name) {
		return {
			code: "V11", level: VCHECK_SPECS.V11.level, title: VCHECK_SPECS.V11.title, rule: VCHECK_SPECS.V11.rule,
			hit: false, final: "", finalTime: 0, match: [], stale: [],
			reviewsInDir: ((input && input.reviews) || []).map((r) => r.name)
		};
	}
	const base = name.replace(/_定稿\.md$/i, "");                  // 联盟悬赏_20260923
	const all = (input && input.reviews) || [];
	const matched = all.filter((r) => /_审查\.md$/i.test(String(r.name)) && base && String(r.name).indexOf(base) === 0);
	const matchedSorted = matched.slice().sort((a, b) => timeOf(b.mtime) - timeOf(a.mtime));
	const newest = matchedSorted.length ? matchedSorted[0] : null;
	const stale = matched.filter((r) => timeOf(r.mtime) < timeOf(fin.mtime));
	const hit = !newest || stale.length === matched.length;
	return {
		code: "V11", level: VCHECK_SPECS.V11.level, title: VCHECK_SPECS.V11.title, rule: VCHECK_SPECS.V11.rule,
		hit: hit,
		final: name, finalTime: timeOf(fin.mtime),
		match: matched.map((r) => r.name),
		stale: stale.map((r) => r.name),
		reviewsInDir: all.map((r) => r.name)
	};
}

/** 五条检查一次跑完（输入一份定稿正文） */
function scanFinalChecks(text: unknown) {
	const lines = linesOf(text);
	const chaps = chaptersOf(lines);
	return { lines: lines.length, V3: checkV3(lines, chaps), V5: checkV5(lines, chaps), V6: checkV6(lines, chaps), V8: checkV8(lines, chaps) };
}

// ── 汇总：面板告警条要的那一张清单 ─────────────────────────────────────────
const LEVEL_RANK: Record<string, number> = { error: 0, warn: 1, info: 2 };

function issueOf(code: string, level: CheckLevel, msg: string, lines: number[], files: string[]): CheckIssue {
	return { code: code, level: level, msg: msg, lines: lines, files: files };
}

interface ChecklistInput {
	/** 当前有效定稿的正文 */
	text?: string;
	/** gdd\ 下的定稿候选（frontmatter 里的 doc_type / status + 文件名） */
	finals?: Array<{ name: string; doc_type?: unknown; status?: unknown }>;
	/** gdd\ 下的 `*_审查.md`（文件名 + mtime） */
	reviews?: ReviewFile[];
	/** 当前有效定稿的 mtime */
	mtime?: unknown;
}

/**
 * 把 V1（`./finalgdd.ts` 的 checkFinals）+ V3 / V5 / V6 / V8 / V11 汇成一张**校验清单**。
 *
 * 返回：
 *   · `issues`  —— 告警条直接渲染的扁平清单（按 error → warn → info、同级别按 code 排）
 *   · `checks`  —— 六条检查的完整结果（想展开看细节、想点行号定位就用它）
 *   · `counts`  —— 各严重程度条数（面板上的一行摘要）
 *   · `current` / `currentFrom` —— 当前有效定稿是谁、按什么判定（**不靠文件名猜**）
 *
 * ★ 为什么 V5 也进 issues：它是 info 级——告警条能区分严重程度，info 是"如实报数"那一档。
 * ★ V6 方向② / V8 的提及与后缀族 **不进 issues**（见文件头三条判据）。
 */
function gddChecklist(input: ChecklistInput) {
	const inp = input || {};
	const finals = (inp.finals || []).slice();
	const fc = checkFinals(finals);

	const checks: Record<string, unknown> = { V1: fc };
	const issues: CheckIssue[] = [];
	for (const it of (fc.issues || [])) {
		issues.push(issueOf(it.code, (it.level as CheckLevel) || "warn", String(it.msg || ""), [], (it.files as string[]) || []));
	}

	const scan = scanFinalChecks(inp.text || "");
	checks.V3 = scan.V3;
	checks.V5 = scan.V5;
	checks.V6 = scan.V6;
	checks.V8 = scan.V8;

	if (scan.V3.hit) {
		for (const d of scan.V3.dup) {
			issues.push(issueOf("V3", scan.V3.level, "§7 文本键重复定义 `" + d.key + "`（后一条会覆盖前一条）", d.lines, []));
		}
	}
	if (scan.V5.hit) {
		issues.push(issueOf("V5", scan.V5.level, "「待配表」标记 " + scan.V5.count + " 处（数值待配置，不是缺陷）", scan.V5.hits.map((h) => h.line), []));
	}
	if (scan.V6.hit) {
		for (const r of scan.V6.refsWithoutDecl) {
			issues.push(issueOf("V6", scan.V6.level, "§4 引用了配置字段 `" + r.field + "`（`" + r.ref + "`），但 §6 没有声明它", [r.line], []));
		}
	}
	if (scan.V8.hit) {
		for (const d of scan.V8.dup) {
			issues.push(issueOf("V8", scan.V8.level, "§5 条目编号重号 `" + d.raw + "`（同族 " + d.lines.length + " 次定义）", d.lines, []));
		}
		if (scan.V8.gaps.length) {
			issues.push(issueOf("V8", scan.V8.level, "§5 条目编号跳号：缺 " + scan.V8.gaps.map((g) => "UE" + g).join("、"), [], []));
		}
	}

	// V11 只在"知道当前定稿是谁"时判（没有定稿就无从谈起）
	const currentName = (fc.current as string) || null;
	const v11 = checkV11({ final: currentName ? { name: currentName, mtime: inp.mtime } : null, reviews: inp.reviews || [] });
	checks.V11 = v11;
	if (currentName && v11.hit) {
		const why = v11.match.length ? "审查报告比定稿旧（" + v11.stale.join("、") + "）" : "没有逐字匹配的审查报告";
		issues.push(issueOf("V11", v11.level, "当前有效定稿 `" + currentName + "` 未通过审查关：" + why, [], [currentName]));
	}

	issues.sort((a, b) => {
		const d = (LEVEL_RANK[a.level] || 0) - (LEVEL_RANK[b.level] || 0);
		return d !== 0 ? d : (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
	});
	const counts = { error: 0, warn: 0, info: 0 };
	for (const it of issues) counts[it.level] = (counts[it.level] || 0) + 1;

	return {
		current: currentName, currentFrom: fc.currentFrom,
		checks: checks, issues: issues, counts: counts
	};
}

/** 只跑"正文五条"（V3/V5/V6/V8），不做 V1/V11 的文件级判定 —— 单测与逐条排查用 */
export {
	VCHECK_SPECS, LEVEL_RANK,
	linesOf, chaptersOf,
	checkV3, checkV5, checkV6, checkV8, checkV11,
	scanFinalChecks, gddChecklist
};
export type { CheckLevel };
