/**
 * 定稿大纲树的**数据**（工单 13 的左边那棵树）—— 纯函数：`parseFinalGdd` 的结果 + `buildRefGraph` 的图
 * → 章 → 组 → 条目；每条能点的地方都带 **1-based 行号** 与 **条目引用**。
 *
 * ── 为什么树要单独成模块（而不是写在客户端的渲染函数里）────────────────────────
 *   ① 引用串就是引用图的键（`byRef` 的 key）——键拼错一个空格，查图就是空集、界面上还看不出为什么。
 *      所以键一律由 `refgraph.refOf` / `refgraph.fieldRowAt` 生成，**面板不自己拼字符串**。
 *   ② 「哪些行能单独引用、哪些不能」是**产品口径**，必须能被离线测试逐条比对
 *      （`test/pure-finaltree.test.ts` 对着 13-parse-oracle.md 数：§4 10 组 49 条 / §5 28 条 / §7 49 键 / §10 15 条）。
 *
 * ── 条目引用的粒度（CONTEXT.md，按章不同）────────────────────────────────────
 *   §4 到**规则组**（组内条目不单独编号，D1 纪律）⇒ 组内每一条都指向组引用 `§4 R6`，
 *     但**原文仍是点中的那一条**（`items[].line` 是该规则自己的行号）；
 *   §5 到**界面组 + 条目**（`§5 UI-M1 UE3`）· §6 到**行**（`§6 难度表.clearDropId`）·
 *   §7 到**键**（`§7 alli_boss_x`）· §10 到**条目**（`§10 AC8`）。
 *
 * ── 默认开合（工单 13 硬要求）─────────────────────────────────────────────
 *   **组级条目默认展开、章级条目默认收起** —— §7 有 49 个键，全展开会把树淹掉。
 *   这里给的是数据（`open` 字段），不是样式：渲染层照它给初始 state。
 *
 * ── 不可单独引用的行**不假装能点** ─────────────────────────────────────────
 *   `ref: ""` + `why`（原因），界面上显灰并把原因挂在 tooltip 上。真实定稿里这类行是：
 *   §2/§8/§9/§11 的表格行、§5.0 界面清单的 4 行、§6 的非字段行（中文字段/三列表）。
 *
 * ── 每条都带「现状原文」──────────────────────────────────────────────────
 *   `text` 是该行的 markdown 原文（章/组是标题行），`grain` 是这一类的粒度说明。
 *   定位卡上"行号会漂、原文不会"靠的就是这两个字段 —— 界面不自己回读文件、也不自己拼引用。
 */

import { fieldRowAt, refOf } from "./refgraph.ts";

/** 引用图的最小形状（只用到 `byRef`；不引 refgraph 的内部类型，免得两处类型各自漂移） */
type GraphLike = { byRef?: Map<string, { kind?: string; field?: string; table?: string; line?: number }> } | null | undefined;
/** `parseFinalGdd` 的大纲节点（只用到这几个字段） */
type Node = { no?: string; id?: string; title?: string; line?: number; idx?: number; rows?: Array<{ key: string; line: number; text?: string }>; children?: Node[] };
/** `parseFinalGdd` 的结果（只用到大纲与平铺块） */
type Doc = { outline?: Node[]; blocks?: Array<{ line?: number; text?: string }> } | null | undefined;

/** §5 的交互条目编号（`UE3` / `UE3a`） */
const UE_RE = /^UE\d+[a-z]?$/;
/** §10 的验收条目编号 */
const AC_RE = /^AC\d+$/;
/** §7 的多语言文本键（与 `buildRefGraph` 的词表同一个判据） */
const TEXTKEY_RE = /^[a-z][a-z0-9_]{3,}$/;

export interface FinalTreeItem {
	/** 条目引用（= 引用图的键）。空串 = 这一行**不能单独引用**，见 `why` */
	ref: string;
	/** 1-based 行号（与编辑器一致，面板显示 `Lnnn`） */
	line: number;
	/** 树上显示的名字（§5 的 `UE3` / §7 的键 / §4 的规则名 / §6 的中文字段名） */
	label: string;
	/** 右侧补充（§6 的英文字段名） */
	sub?: string;
	/** **现状原文**（该行的 markdown 原文，逐字）—— 定位卡上要给人看的就是它（行号会漂，原文不会） */
	text: string;
	/** 这一类的引用粒度（人读懂的一句话，展示在定位卡上） */
	grain: string;
	/** 不能点的原因（空串 = 能点） */
	why?: string;
}

export interface FinalTreeGroup {
	/** 组号（§5 的 `5.1` / §6 的 `6.2`；§4 的 R 组为空串） */
	no: string;
	/** 组标识（`R1` / `UI-M1`；取不到时是空串，组引用退化成 `§6 6.2` 那种组号串） */
	id: string;
	title: string;
	line: number;
	/** 组标题行原文（`### R6 奖励`）—— 组级定位卡的「现状原文」 */
	text: string;
	/** 组级条目引用（`§4 R6` / `§5 UI-M1`）；**空串 = 引用图里没有这个组**（界面只定位、不假装有引用） */
	ref: string;
	/** 这一类的引用粒度说明 */
	grain: string;
	/** 正文里对应块的下标（点树 → 滚动到 `[data-blk]`） */
	idx: number;
	/** 默认是否展开（组级 = true） */
	open: boolean;
	items: FinalTreeItem[];
	/** 组内不可单独引用的行数（如 §6.5 的三列表） */
	skipped: number;
}

export interface FinalTreeChapter {
	no: string;
	title: string;
	line: number;
	/** 章标题行原文（`## 7. 多语言文本`） */
	text: string;
	/** 章不是引用图的实体 ⇒ 恒为空串（界面据此说明"改动按条落在组/条目上"） */
	ref: string;
	/** 这一类的引用粒度说明 */
	grain: string;
	idx: number;
	/** 默认是否展开（章级 = false） */
	open: boolean;
	/** 章级条目（§7 的键 / §10 的 AC） */
	items: FinalTreeItem[];
	groups: FinalTreeGroup[];
	skipped: number;
}

export interface FinalTree {
	chapters: FinalTreeChapter[];
	counts: { chapters: number; groups: number; items: number; skipped: number };
}

/** 组标识：有 `UI-M1` / `R1` 用它，否则退回组号 `5.0` / `6.2` */
function groupKey(gr: Node | null | undefined): string {
	return String((gr && gr.id) || (gr && gr.no) || "");
}

/** 块 idx → 它的**标题行原文**（`doc.blocks[i].text` 的第一行；取不到返回空串） */
function headingOf(blocks: Array<{ text?: string }> | undefined, idx: unknown): string {
	const i = Number(idx);
	if (!blocks || !Number.isFinite(i) || i < 0 || i >= blocks.length) return "";
	return String((blocks[i] && blocks[i].text) || "").split(/\r?\n/)[0].trim();
}

/** 引用粒度的说明（按章不同，与 CONTEXT.md 的规则逐字对应）—— 定位卡直接显示这句 */
function grainOf(no: string, isGroup: boolean, isField: boolean): string {
	if (isField || no === "6") return "§6 到行（表名 + 字段）";   // §6 的组也不是实体，引用落在行上
	if (no === "4") return isGroup ? "§4 到规则组" : "§4 到规则组（组内条目不单独编号）";
	if (no === "5") return isGroup ? "§5 到界面组" : "§5 到界面组 + 条目";
	if (no === "7") return "§7 到键";
	if (no === "10") return "§10 到条目";
	return isGroup ? "组级引用" : "章级引用";
}

/**
 * 章级表格行 → 条目：只有 §7 的文本键与 §10 的 AC 是**可引用实体**（与词表同一个判据）；
 * §2/§8/§9/§11 的表格行（玩家动词、范围门、埋点、交接）不在词表里 ⇒ 显灰。
 */
function chapterItemOf(no: string, row: { key: string; line: number; text?: string }): FinalTreeItem | null {
	if (no === "7" && TEXTKEY_RE.test(row.key)) {
		return { ref: refOf("7", "", row.key), line: row.line, label: row.key, text: String(row.text || ""), grain: grainOf("7", false, false), why: "" };
	}
	if (AC_RE.test(row.key)) {
		// AC 的引用串跟着**它所在的章**走，不写死 §10 —— 章号变了这里跟着变
		return { ref: refOf(no, "", row.key), line: row.line, label: row.key, text: String(row.text || ""), grain: grainOf(no, false, false), why: "" };
	}
	return null;
}

/**
 * 建树。`doc` = `parseFinalGdd` 的结果；`graph` = `buildRefGraph(doc)` 的结果（可空）。
 * 不做 IO、不改输入。
 */
function buildFinalTree(doc: Doc, graph?: GraphLike): FinalTree {
	const outline = (doc && doc.outline) || [];
	const blocks = (doc && doc.blocks) || [];
	const known = (ref: string) => !!(graph && graph.byRef && ref && graph.byRef.has(ref));
	const chapters: FinalTreeChapter[] = [];
	let nGroups = 0, nItems = 0, nSkipped = 0;

	for (const c of outline) {
		const ch: FinalTreeChapter = {
			no: String(c.no || ""), title: String(c.title || ""), line: Number(c.line) || 0,
			text: headingOf(blocks, c.idx), ref: "", grain: "章不是引用图的实体",
			idx: Number(c.idx) || 0, open: false, items: [], groups: [], skipped: 0
		};

		// ── 章级条目（§7 键 / §10 AC）—— 默认收起（§7 有 49 个键）
		for (const r of (c.rows || [])) {
			const it = chapterItemOf(ch.no, r);
			if (!it) { ch.skipped++; continue; }
			if (!known(it.ref)) it.why = "引用图里没有这个键（面板显示不了它的影响范围）";
			ch.items.push(it);
			nItems++;
		}

		// ── 组 → 条目
		for (const gr of (c.children || [])) {
			const gid = groupKey(gr);
			const gref = refOf(ch.no, gid, "");
			const g: FinalTreeGroup = {
				no: String(gr.no || ""), id: String(gr.id || ""), title: String(gr.title || ""),
				line: Number(gr.line) || 0, text: headingOf(blocks, gr.idx),
				ref: known(gref) ? gref : "", grain: grainOf(ch.no, true, false),
				idx: Number(gr.idx) || 0,
				open: true,                    // ★ 组级条目默认展开
				items: [], skipped: 0
			};
			for (const r of (gr.rows || [])) {
				const line = Number(r.line) || 0;
				const raw = String(r.text || "");
				if (ch.no === "4") {
					// §4：粒度到**规则组** —— 组内每一条的引用都是组引用，行号与原文是这一条自己的
					g.items.push({
						ref: known(gref) ? gref : "", line: line, label: String(r.key || ""), text: raw,
						grain: grainOf("4", false, false),
						why: known(gref) ? "" : "§4 的引用粒度到规则组，但引用图里没有这个组"
					});
					nItems++;
				} else if (ch.no === "5") {
					if (UE_RE.test(String(r.key || ""))) {
						g.items.push({
							ref: refOf(ch.no, gid, r.key), line: line, label: String(r.key), text: raw,
							grain: grainOf("5", false, false), why: ""
						});
						nItems++;
					} else { g.skipped++; nSkipped++; }
				} else if (ch.no === "6") {
					const f = fieldRowAt(graph, line);
					if (f) {
						g.items.push({
							ref: f.ref, line: line, label: String(r.key || ""), sub: f.field, text: raw,
							grain: grainOf("6", false, true), why: ""
						});
						nItems++;
					} else { g.skipped++; nSkipped++; }
				} else { g.skipped++; nSkipped++; }
			}
			ch.groups.push(g);
			nGroups++;
		}

		nSkipped += ch.skipped;
		chapters.push(ch);
	}

	return {
		chapters: chapters,
		counts: { chapters: chapters.length, groups: nGroups, items: nItems, skipped: nSkipped }
	};
}

export { buildFinalTree, groupKey, grainOf, headingOf, TEXTKEY_RE, UE_RE, AC_RE };
