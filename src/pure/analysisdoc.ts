/**
 * 头脑风暴工作面（工单 23）· 四入口归类 + 两种新格式的解析
 *
 * 出处（逐条对着写的，不自己编）：
 *   · 设计 §4.1 —— 四种入口**没有先后**、四张并列的动作卡、产出全部落 `features\<主题>\analysis\`
 *   · 设计 §4.2.1 —— 旧文档分析 → `analysis\legacy-analysis_<名称>_<日期>.md`，
 *     **四段固定章节**（仍然有效 / 已废弃 / 可复用 / 原文（转换后）），frontmatter 的 `source:` 指向 `evidence\` 里的原件
 *   · 设计 §4.2.2 —— 人工补充 → `analysis\human-note_<标题>_<日期>.md`，
 *     正文固定保留 `> 原话：…` 一行，**面板上原话与结论并排显示**（一眼看出 AI 有没有改动结论）
 *   · 四种输入方式产出规范 v1 §七.3 —— 每个按钮的前置条件
 *
 * ★ 纯函数、零 IO：目录列举与读文件都在 `src/load/brainstorm.ts`，这里只做归类与解析。
 * ★ **四入口的那张表只有这一份**（`ENTRANCES`）：UI 的卡片、指令里的前置条件、"已有的分析结论"的归类
 *   都读它 —— 表里加一条，三处一起动，不会各说各的（`intake.ts` 直接 re-export 这一份）。
 * ★ 认不出来的东西**不丢**：旧文档分析里多出来的章节进 `extra`，人工补充里多出来的章节进 `extra`，
 *   面板把它们收进「其他章节」——这与 `mdspec` 的「未知章节不丢」是同一条纪律。
 */

import { parseFrontmatter } from "./frontmatter.ts";
import { mdSpecOf, parseMdSections } from "./mdspec.ts";

/** 四种并列入口 —— 顺序即面板上的顺序（设计 §4.1 的表，一行不多一行不少） */
const ENTRANCES = [
	{
		id: "analysis",
		label: "竞品分析",
		hint: "跑 /sr-analysis",
		needs: "截图 / 录屏 / PV / 商店页（目录、文件路径或链接）",
		prereq: "path",
		output: "analysis\\experience-report_*.md · issue-cards_*.json · replication-spec_*.md · sr-gdd-handoff_*.json · evidence\\",
		// 发起之后面板**不重画流程**（工单 23 第 2 条）—— 这句就是界面上要写的那句
		handoff: "阶段交给了 skill，进度与提问都在那个会话里（面板不重画流程）"
	},
	{
		id: "concept",
		label: "问答式访谈",
		hint: "跑 /sr-concept",
		needs: "一句创意（可附参考素材路径）",
		prereq: "seed",
		output: "analysis\\concept-triage_*.md → feature-concept_*.md → sr-gdd-handoff_*.json",
		handoff: "阶段交给了 skill，进度与提问都在那个会话里（面板不重画流程）"
	},
	{
		id: "legacy",
		label: "旧文档分析",
		hint: "AI 转换 + 分析",
		needs: "旧策划案 / 脑图 / 表格（目录或文件路径）",
		prereq: "path",
		output: "analysis\\legacy-analysis_<名称>_<日期>.md（四段固定章节）· 原件进 evidence\\",
		handoff: "阶段交给了会话里的 AI 转换 + 分析，进度与提问都在那个会话里（面板不重画流程）"
	},
	{
		id: "humannote",
		label: "人工补充",
		hint: "AI 只整理格式",
		needs: "标题 + 原话（想到什么写什么）",
		prereq: "title+quote",
		output: "analysis\\human-note_<标题>_<日期>.md（原话与结论并排）",
		handoff: "阶段交给了会话里的 AI 整理，进度与提问都在那个会话里（面板不重画流程）"
	}
];

/** 旧文档分析的四段固定章节（设计 §4.2.1）——顺序即面板上的顺序，`re` 认标题里的关键词 */
const LEGACY_SECTIONS = [
	{ key: "valid", label: "仍然有效的结论", re: /仍然有效/ },
	{ key: "dropped", label: "已废弃 / 不适用", re: /已废弃|不适用/ },
	{ key: "reuse", label: "可复用条目", re: /可复用/ },
	{ key: "raw", label: "原文（转换后）", re: /^原文/ }
];

/** 人工补充的固定正文（设计 §4.2.2）；`quote` 不在正文里 —— 它是独立的 `> 原话：…` 行 */
const NOTE_SECTIONS = [
	{ key: "conclusion", label: "结论", re: /^结论/ },
	{ key: "bounds", label: "边界", re: /^边界/ },
	{ key: "landing", label: "落点", re: /^落点/ }
];

const LEGACY_PREFIX = /^legacy-analysis_/i;
const NOTE_PREFIX = /^human-note_/i;

/** 文件名 → 两种新格式之一（"" = 不是这两种格式） */
function analysisDocKind(name) {
	const base = String(name == null ? "" : name).split(/[\\/]/).pop() || "";
	if (LEGACY_PREFIX.test(base)) return "legacy";
	if (NOTE_PREFIX.test(base)) return "humannote";
	return "";
}

/** 文件名/标题 → 安全的文件名片段（产出文件名用；与 intake.safeName 同口径，但这边不依赖 intake） */
function nameSafe(p, limit) {
	const s = String(p == null ? "" : p)
		.replace(/[\\/:*?"<>|]/g, "_")
		.replace(/[\r\n\t]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	const cap = limit || 60;
	return s.length > cap ? s.slice(0, cap) : s;
}

/** 旧文档分析的产出文件名（**唯一出处**：指令里写的名字必须与读取侧认得的一致） */
function legacyDocName(name, date) {
	const bare = nameSafe(String(name == null ? "" : name).split(/[\\/]/).pop() || "", 60).replace(/\.[A-Za-z0-9]{1,8}$/, "");
	return "legacy-analysis_" + (bare || "旧文档") + "_" + String(date || "") + ".md";
}

/** 人工补充的产出文件名（**唯一出处**，同上） */
function humanNoteName(title, date) {
	return "human-note_" + (nameSafe(title, 60) || "补充") + "_" + String(date || "") + ".md";
}

/** 章节体（按 `re` 认标题）→ 固定段 + 认不出来的「其他章节」 */
function splitSections(text, specs) {
	const found = {};
	const extra = [];
	for (const s of parseMdSections(text)) {
		const hit = specs.filter((sp) => sp.re.test(s.title))[0];
		if (hit && !found[hit.key]) found[hit.key] = { key: hit.key, label: hit.label, title: s.title, body: s.body };
		else extra.push({ title: s.title, body: s.body });
	}
	const sections = specs.map((sp) => found[sp.key] || { key: sp.key, label: sp.label, title: "", body: "", present: false });
	for (const s of sections) if (s.present === undefined) s.present = !!s.title;
	return { sections: sections, extra: extra, missing: sections.filter((s) => !s.present).map((s) => s.label) };
}

/** md 表格 → 行（`| a | b | c |`；跳过分隔行） */
function mdTableRows(body) {
	const rows = [];
	for (const line of String(body || "").split(/\r?\n/)) {
		const t = line.trim();
		if (t.charAt(0) !== "|") continue;
		const cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
		if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) continue;
		rows.push(cells);
	}
	return rows;
}

/** 一级标题（`# xxx`）—— 文档标题，不进章节 */
function docTitle(text) {
	const m = /^#\s+(.+)$/m.exec(String(text || ""));
	return m ? m[1].trim() : "";
}

/**
 * `> 原话：「…」` 那一行 —— **逐字**取出来（这是"AI 有没有改动我的结论"的唯一凭据）。
 *
 * 认三种写法（都取整行原文）：`> 原话：「…」` / `> 原话：…` / `> 原话: "…"`。
 * @returns `{ raw, text, found }` · `raw` = 整行原文（含 `> 原话：`），`text` = 引导语之后的部分（逐字）
 */
function parseQuote(text) {
	const lines = String(text || "").split(/\r?\n/);
	for (const line of lines) {
		const m = /^>\s*原话\s*[:：]\s*(.*)$/.exec(line.trim());
		if (m) return { raw: line.trim(), text: m[1].trim(), found: true };
	}
	return { raw: "", text: "", found: false };
}

/**
 * 旧文档分析（设计 §4.2.1）→ 视图模型。
 *
 * @returns `{ name, kind, front, title, sections, reuse, extra, missing, raw }`
 *   · `sections` 恒有四段（`present:false` = 这一段缺了，面板**如实说缺**，不静默）
 *   · `reuse.rows` = 「可复用条目」表格的 `旧文档位置 | 内容 | 去向`
 *   · `raw` = 「原文（转换后）」的正文（追溯用）
 */
function parseLegacyAnalysis(text, name) {
	const body = String(text || "");
	const front = parseFrontmatter(body) || {};
	const split = splitSections(body, LEGACY_SECTIONS);
	const reuse = split.sections.filter((s) => s.key === "reuse")[0] || { body: "" };
	const rawSec = split.sections.filter((s) => s.key === "raw")[0] || { body: "" };
	return {
		name: String(name || ""),
		kind: "legacy",
		front: front,
		docType: String(front.doc_type || ""),
		topic: String(front.topic || ""),
		source: String(front.source || ""),
		analyzedAt: String(front.analyzed_at || ""),
		title: docTitle(body),
		sections: split.sections,
		reuse: { header: (mdTableRows(reuse.body)[0] || []), rows: mdTableRows(reuse.body).slice(1) },
		extra: split.extra,
		missing: split.missing,
		raw: String(rawSec.body || "")
	};
}

/**
 * 人工补充（设计 §4.2.2）→ 视图模型。
 *
 * @returns `{ name, kind, front, title, quote, conclusion, bounds, landing, sections, extra, missing }`
 *   · `quote` = `> 原话：…` 那一行（逐字）；`conclusion` = 「结论」段正文 —— 面板把这两个**并排**显示
 */
function parseHumanNote(text, name) {
	const body = String(text || "");
	const front = parseFrontmatter(body) || {};
	const split = splitSections(body, NOTE_SECTIONS);
	const body1 = (k) => {
		const s = split.sections.filter((x) => x.key === k)[0] || { body: "" };
		return String(s.body || "");
	};
	return {
		name: String(name || ""),
		kind: "humannote",
		front: front,
		docType: String(front.doc_type || ""),
		topic: String(front.topic || ""),
		confidence: String(front.confidence || ""),
		date: String(front.date || ""),
		author: String(front.author || ""),
		title: docTitle(body),
		quote: parseQuote(body),
		conclusion: body1("conclusion"),
		bounds: body1("bounds"),
		landing: body1("landing"),
		sections: split.sections,
		extra: split.extra,
		missing: split.missing
	};
}

/** 交接件 JSON 的来源 skill（`sr-analysis` / `sr-concept`）—— 只看这一处，不做别的推断 */
function sourceSkillOf(jsonText) {
	const m = /"source_skill"\s*:\s*"([^"]*)"/.exec(String(jsonText || ""));
	return m ? m[1] : "";
}

/**
 * 一条分析产物属于哪个入口（设计 §4.1 的产出表 + 产出规范 v1 §五）。
 *
 * 判据顺序（**不猜**）：文件名前缀（两种新格式）→ md 规范名（`mdspec` 的六种）
 * → 交接件看它自己的 `source_skill` 字段（认不出就归「其他/来源未知」，不硬塞进某一路）。
 */
function entryOfAnalysis(name, sourceSkill) {
	const base = String(name == null ? "" : name).split(/[\\/]/).pop() || "";
	const k = analysisDocKind(base);
	if (k) return k;
	if (/^issue-cards_/i.test(base)) return "analysis";
	const spec = mdSpecOf(base);
	if (spec) {
		const n = String(spec.name || "");
		if (n === "体验报告" || n === "复刻规格" || n === "证据索引") return "analysis";
		if (n === "设计核三角报告" || n === "功能设计稿") return "concept";
	}
	if (/^sr-gdd-handoff_/i.test(base)) {
		const s = String(sourceSkill || "");
		if (s === "sr-analysis") return "analysis";
		if (s === "sr-concept") return "concept";
		return "other";
	}
	return "other";
}

/**
 * 分析产物清单 → 按四入口分组的「已有的分析结论」。
 *
 * @param files `[{ name, rel, subdir?, skill? }]`（`skill` = 交接件 JSON 里读到的 `source_skill`）
 * @returns `{ entries, other, counts }` —— `entries` 恒有四组（空组也如实出现：0 条 = "这一路还没走过"）
 */
function groupAnalyses(files) {
	const list = Array.isArray(files) ? files : [];
	const entries = ENTRANCES.map((e) => ({ id: e.id, label: e.label, count: 0, files: [] }));
	const other = [];
	for (const f of list) {
		const id = entryOfAnalysis(f && f.name, f && f.skill);
		const g = entries.filter((e) => e.id === id)[0];
		if (g) {
			g.files.push(f);
			g.count++;
		} else {
			other.push(f);
		}
	}
	const counts = {};
	for (const e of entries) counts[e.id] = e.count;
	return { entries: entries, other: other, counts: counts, total: list.length };
}

/** 入口 id → 入口定义（面板/指令共用） */
function entranceOf(id) {
	return ENTRANCES.filter((e) => e.id === id)[0] || null;
}

export {
	ENTRANCES, LEGACY_SECTIONS, NOTE_SECTIONS,
	analysisDocKind, nameSafe, legacyDocName, humanNoteName,
	splitSections, mdTableRows, docTitle, parseQuote,
	parseLegacyAnalysis, parseHumanNote, sourceSkillOf,
	entryOfAnalysis, groupAnalyses, entranceOf
};
