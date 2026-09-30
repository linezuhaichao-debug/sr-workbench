/**
 * 文档生成工作面的**结构数据**（工单 24）—— 纯函数：`parseFinalGdd` 的结果 → 左树 + **两大部分**。
 *
 * ── 为什么是"复用定稿那套解析能力"而不是另写一份（工单 24 第 5 条）────────────
 *   成稿与定稿是**同一个模板**的两种形态（`sr-gdd-human/SKILL.md` §功能说明：
 *   「结果章 §1–§12」；`gdd-pipeline.md` §二的章节对应表就是成稿章 → 定稿章的一一对应）。
 *   所以章 / 组 / 条目 + 1-based 行号的解析**只有一份实现**：`finalgdd.parseFinalGdd`。
 *   本模块只做两件它不做的事：
 *     ① 把树**按模板语义分组**（章不引用 ⇒ 传 `graph = null`，`finaltree` 已经支持）；
 *     ② 标出**两大部分**（§4 功能规则 / §5 用户体验与界面流程）—— 它们是成稿里唯一被语言部分
 *        （"用户体验与界面流程"）与格式部分（11 个 `UI-M*` 组名）**双重证明**存在的两块。
 *
 * ── "两大部分"的口径出处（逐条引原文）──────────────────────────────────────
 *   · 工单 24 第 1 条：「能读成稿并按其**两大部分**定位：功能规则、用户体验与界面流程
 *     （这是后续两条支线的依据）」。
 *   · `gdd-pipeline.md` §一·三份产出的「内容」列，成稿那一格逐字列出：
 *     「功能意图、玩家动词、核心循环、**功能规则**、**界面流程**、范围门、埋点、验证计划、
 *       验收标准、交接清单、数值待定项；决策留痕在附录 A」；
 *     定稿那一格是「**功能规则**、**界面流程**、§6 配置契约、§7 多语言文本、…」。
 *   · `spec.md` 的 Y 形（工单 24 引用它）：「成稿 → 配置支线 / 线框图支线 → 合流 → 整合定稿 → 必经审查」，
 *     两条支线的**依据**正是 §4（配置支线：规则是配置字段的唯一设计依据）与 §5（界面支线：线框图替换）。
 *   · `gdd-pipeline.md` §二：#4 功能规则 → 定稿 #4；#5 用户体验与界面流程 → 定稿 #5（**一一对应、原样保留组号**）。
 *
 * ── 章号是**读出来的，不是写死的**──────────────────────────────────────────
 *   `locateParts` 按章标题里的关键词认这两部分，同时把行号算出来 —— 章号若变（模板加了新章），
 *   面板跟着变而不是硬指向 §4/§5。两条都没认出来时 `complete: false`，面板**如实说没认出来**。
 */

import { parseFinalGdd } from "./finalgdd.ts";
import { buildFinalTree } from "./finaltree.ts";

/** 两大部分的判据（标题关键词；与 `gdd-pipeline.md` 的章节名同源） */
const PARTS = [
	{ key: "rules", label: "功能规则", re: /功能规则/ },
	{ key: "ux", label: "用户体验与界面流程", re: /用户体验|界面流程/ }
];

export interface DraftPart {
	key: string;
	label: string;
	/** 章号（字符串，与 `parseFinalGdd` 的输出一致） */
	no: string;
	/** 章标题原文（去掉章号） */
	title: string;
	/** 1-based 行号（章标题那一行） */
	line: number;
	/** 章结束的下一行（下一章标题行 − 1；最后一章 = 全文行数） */
	endLine: number;
	idx: number;
	groups: number;
	/** 组级条目数（§4 = 规则条数；§5 = 组内 UE 条数） */
	items: number;
	/** 本章不可单独引用的行数（§5.0 界面清单那种） */
	skipped: number;
	/** 界面上"这一章是干什么的"一句话 */
	note: string;
}

/**
 * §5 里**一处 ASCII 占位图**（工单 24c：支线 B「线框图」的现状）。
 *
 * ── 为什么需要它（口径出处）────────────────────────────────────────────────
 *   `spec.md` 的 Y 形：界面支线要「把 §5 里的 ASCII 图 / 骨架图换成真实界面图」。
 *   所以"§5 里现在有几处 ASCII 占位、各在哪一行"是这条支线的**现状原文**——
 *   线框图提交后要替换的就是这些段落，替换指令必须能逐处点到（行号会漂、原文不会）。
 *
 * ── 认哪一段（保守判据，宁可少认）────────────────────────────────────────────
 *   `level === 3` 的块（`### 5.1 UI-M1 …` 这种）里含 ```text 围栏的段。
 *   真实成稿的 §5 正好是 5.1 / 5.2 / 5.3 的界面骨架 + 5.4 的界面流程，共 4 段。
 *   5.0 界面清单与 5.5 全局交互规范是**表格**，不是 ASCII 图 ⇒ 不算（数进去会把"几处"算虚）。
 */
export interface DraftAsciiBlock {
	/** 组号原文（`5.1` / `5.4`） */
	no: string;
	/** 组标识（`UI-M1`；没有就是空串，如 5.4 界面流程） */
	id: string;
	/** 组标题（`联盟悬赏主面板`） */
	title: string;
	/** 1-based 行号（那个 `###` 标题所在行） */
	line: number;
	/** 围栏里**非空且非围栏**的行数（"这一处占位画了多少行"）。**逐字用行数，不臆造"处"以外的单位** */
	lines: number;
}

export interface DraftDoc {
	title: string;
	/** 两大部分（恒两条：认出来的是 `no !== ""`） */
	parts: DraftPart[];
	/** §5 里的 ASCII 占位处（按行号升序；空数组 = §5 里没有 ASCII 占位了，如实报） */
	ascii: DraftAsciiBlock[];
	/** 两条都认出来了 */
	complete: boolean;
	/** 没认出来的话，缺哪一条 */
	missingParts: string[];
	/** 左树（`buildFinalTree(doc, null)` 的结论，原样给界面） */
	tree: ReturnType<typeof buildFinalTree>;
	/** 章的清单（点哪一章都能定位） */
	chapters: Array<{ no: string; title: string; line: number; endLine: number; idx: number; part: string }>;
	lines: number;
	counts: { chapters: number; groups: number; ruleGroups: number; rules: number; uiGroups: number; ues: number };
	doc: ReturnType<typeof parseFinalGdd>;
}

/** 文本 + 解析结果 → 两大部分的数据。`doc` 可传（复用一次解析），不传就现场解析。 */
export function draftDocOf(text: unknown, parsed?: ReturnType<typeof parseFinalGdd>): DraftDoc {
	const src = String(text == null ? "" : text);
	const doc = parsed || parseFinalGdd(src);
	const lines = src === "" ? 0 : src.split(/\r?\n/).length;
	const tree = buildFinalTree(doc, null);
	const outline = doc.outline || [];

	/** 章号 → 它的树节点（items/groups/skipped 都在树上，不重算） */
	const nodeOf = (no: string) => tree.chapters.filter((c) => c.no === no)[0] || null;
	/**
	 * 章节点 → 条目数 / 不可引用行数。
	 * ★ 章的 `skipped` 分两处记账：章级条目自己的（`c.skipped`）+ **组内的**（`g.skipped`）——
	 *   `finaltree` 里 §5.0 的界面清单是"组内不可引用"，不加起来就会算成 0（实测踩过）。
	 */
	const totalsOf = (n: any) => {
		if (!n) return { items: 0, skipped: 0 };
		let items = (n.items || []).length, skipped = Number(n.skipped) || 0;
		for (const g of (n.groups || [])) {
			items += (g.items || []).length;
			skipped += Number(g.skipped) || 0;
		}
		return { items: items, skipped: skipped };
	};

	const parts: DraftPart[] = [];
	const found: Record<string, boolean> = {};
	for (const c of outline) {
		const hit = PARTS.filter((p) => p.re.test(String(c.title || "")))[0];
		if (!hit || found[hit.key]) continue;
		found[hit.key] = true;
		const n = nodeOf(String(c.no));
		// 章的正文范围：下一个章标题行 − 1
		let endLine = lines;
		for (const o of outline) {
			const ol = Number(o.line) || 0;
			if (ol > Number(c.line)) { endLine = ol - 1; break; }
		}
		const tt = totalsOf(n);
		parts.push({
			key: hit.key, label: hit.label, no: String(c.no), title: String(c.title || ""),
			line: Number(c.line) || 0, endLine: endLine, idx: Number(c.idx) || 0,
			groups: (n && n.groups.length) || 0, items: tt.items, skipped: tt.skipped,
			note: hit.key === "rules"
				? "配置支线的依据：/sr-config 从这些规则**派生**配置字段与记录（规则没写清，字段就落不了地）"
				: "界面支线的依据：线框图 / 界面图替换与 §5 的界面组 + 条目（UI-M* / UE*）"
		});
	}
	// 面板上的顺序固定为「功能规则 → 用户体验与界面流程」（= PARTS 的顺序，不按章号排）
	const order = PARTS.map((p) => p.key);
	parts.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

	const partOf = (no: string) => (parts.filter((p) => p.no === no)[0] || { key: "" }).key;
	const chapters = outline.map((c) => {
		let endLine = lines;
		for (const o of outline) {
			const ol = Number(o.line) || 0;
			if (ol > Number(c.line)) { endLine = ol - 1; break; }
		}
		return { no: String(c.no), title: String(c.title || ""), line: Number(c.line) || 0, endLine: endLine, idx: Number(c.idx) || 0, part: partOf(String(c.no)) };
	});

	const rules = parts.filter((p) => p.key === "rules")[0];
	const ux = parts.filter((p) => p.key === "ux")[0];
	return {
		title: String(doc.title || ""),
		parts: parts,
		ascii: asciiOf(doc),
		complete: parts.length === PARTS.length,
		missingParts: PARTS.filter((p) => !found[p.key]).map((p) => p.label),
		tree: tree,
		chapters: chapters,
		lines: lines,
		counts: {
			chapters: tree.counts.chapters,
			groups: tree.counts.groups,
			ruleGroups: (rules && rules.groups) || 0,
			rules: (rules && rules.items) || 0,
			uiGroups: (ux && ux.groups) || 0,
			ues: (ux && ux.items) || 0
		},
		doc: doc
	};
}

/** 树上的组 → 它在**哪一部分**（界面据此在组行上标 §4 / §5 的归属；不在两大部分里的给空串） */
export function partKeyOfChapter(d: DraftDoc | null | undefined, no: unknown): string {
	const n = String(no == null ? "" : no);
	const hit = ((d && d.chapters) || []).filter((c) => c.no === n)[0];
	return hit ? hit.part : "";
}

/** ```text 围栏（ASCII 骨架图的既有写法；成稿 §5 的 5.1–5.4 都用它） */
const FENCE_TEXT_RE = /```text[^\n]*\n([\s\S]*?)```/g;

/**
 * `parseFinalGdd` 的块 → §5 里的 ASCII 占位处（**支线 B 的现状**）。
 *
 * 只认 `level === 3` 且**组号是 5.x** 的块；行数只数围栏内非空行（如实量"这一处占位画了多少行"）。
 * 一条都认不出来就返回空数组 —— 界面照实说"§5 里没有 ASCII 占位了"，**不假装还有**。
 */
export function asciiOf(doc: ReturnType<typeof parseFinalGdd> | null | undefined): DraftAsciiBlock[] {
	const blocks = ((doc && doc.blocks) || []) as any[];
	const out: DraftAsciiBlock[] = [];
	for (const b of blocks) {
		if (!b || Number(b.level) !== 3) continue;
		const no = String(b.no || "");
		if (!/^5\./.test(no)) continue;
		const text = String(b.text || "");
		FENCE_TEXT_RE.lastIndex = 0;
		let m;
		let lines = 0;
		while ((m = FENCE_TEXT_RE.exec(text)) !== null) {
			lines += (m[1] || "").split("\n").filter((x) => x.trim() !== "").length;
		}
		if (lines === 0) continue;
		out.push({
			no: no, id: String(b.id || ""), title: String(b.title || ""),
			line: Number(b.line) || 0, lines: lines
		});
	}
	return out.sort((a, b) => a.line - b.line);
}
