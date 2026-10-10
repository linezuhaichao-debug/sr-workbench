/**
 * **极简 md 分块 / 行内拆分**（零依赖）—— 面板「技能用法」弹窗按 md 排版用的那一层。
 *
 * ── 支持什么（用户点名的范围）─────────────────────────────────────────────
 *   标题（`#`~`######`，界面上按层级收字号）· 有序/无序列表（**一层子项**）· **表格** ·
 *   加粗 · 行内代码 · 引用块 · 分隔线 · 围栏代码块。
 *   不做：链接、图片、HTML、表格对齐、任意深度的嵌套列表 —— 在这个界面上它们只会变成
 *   "把正文吃掉"的风险，而收益是零（面板正文里没有链接/图片）。
 *
 * ── 为什么不复用 `richtext.ts` ─────────────────────────────────────────────
 *   那个是给决策记录用的，**故意只认加粗**（配置表名里常出现单个星号，多吃一种语法就可能丢字）。
 *   这里的输入是技能的使用说明，需要行内代码。
 *
 * ── 底线：宁可少渲染，不可丢字 ─────────────────────────────────────────────
 *   认不出来的东西**原样保留**：没有分隔行的"表格"退回段落、闭合不上的 `**` 原样留着、
 *   围栏没闭合就吃到文件尾。判据在 `test/pure-mdview.test.ts`。
 */

/** 行内片段：普通文字 / 加粗 / 行内代码（三者互斥，加粗里可以套代码片段）。 */
export interface MdRun {
	text: string;
	bold: boolean;
	code: boolean;
}

/** 列表项：一层子项（`subs`）—— 再深的缩进并入最近的子项文字，不再往下递归。 */
export interface MdItem {
	text: string;
	subs: string[];
}

/** 块级模型。渲染器（`src/ui/mdview.js`）按 `kind` 一一对应成元素。 */
export type MdBlock =
	| { kind: "heading"; level: number; text: string }
	| { kind: "para"; text: string }
	| { kind: "list"; ordered: boolean; items: MdItem[] }
	| { kind: "table"; head: string[]; rows: string[][] }
	| { kind: "quote"; text: string }
	| { kind: "code"; text: string }
	| { kind: "hr" };

const RE_HEADING = /^(#{1,6})\s+(.*)$/;
const RE_HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const RE_QUOTE = /^\s*>\s?(.*)$/;
const RE_UL = /^(\s*)[-*+]\s+(.*)$/;
const RE_OL = /^(\s*)\d+[.)]\s+(.*)$/;
const RE_TABLE = /^\s*\|.*\|\s*$/;
const RE_TABLE_SEP = /^\s*\|[\s:|-]+\|\s*$/;
const RE_FENCE = /^\s*(```|~~~)/;

/**
 * 行内拆分：`**加粗**` 与 `` `行内代码` ``。
 * ★ 加粗里套行内代码（`**… `active` …**`）要认 —— 拆一层就够（本文件里真有这种写法，见主线第 4 步）。
 * ★ 空内容（`****`）、不闭合、跨行的标记**原样保留**。
 */
export function mdRuns(text: unknown, depth = 0): MdRun[] {
	const s = String(text === null || text === undefined ? "" : text);
	if (s === "") return [];
	const out: MdRun[] = [];
	const re = /\*\*([^*\n]+?)\*\*|`([^`\n]+?)`/g;
	let last = 0;
	let m: RegExpExecArray | null = re.exec(s);
	while (m !== null) {
		const isBold = m[1] !== undefined;
		const body = isBold ? m[1] : m[2];
		if (body === undefined || body.trim() === "") { m = re.exec(s); continue; }
		if (m.index > last) out.push({ text: s.slice(last, m.index), bold: false, code: false });
		if (isBold) {
			// 加粗：里面可能还套着行内代码 ⇒ 递归拆一层（depth 挡住无限递归）
			const inner = depth === 0 ? mdRuns(body, depth + 1) : [{ text: body, bold: false, code: false }];
			for (const r of inner) out.push({ text: r.text, bold: true, code: r.code });
		} else {
			out.push({ text: body, bold: false, code: true });
		}
		last = m.index + m[0].length;
		m = re.exec(s);
	}
	if (last < s.length) out.push({ text: s.slice(last), bold: false, code: false });
	return out;
}

/** 表格一行的单元格（首尾的 `|` 去掉；不做 `\|` 转义 —— 本仓库的 md 里没有）。 */
function cellsOf(line: string): string[] {
	return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/** 这一行是不是"另一个块的开始"（段落收集到这里就停）。 */
function startsBlock(line: string): boolean {
	return RE_HEADING.test(line) || RE_HR.test(line) || RE_TABLE.test(line) ||
		RE_QUOTE.test(line) || RE_UL.test(line) || RE_OL.test(line) || RE_FENCE.test(line);
}

/** 整份 md ⇒ 块数组。 */
export function mdBlocks(md: unknown): MdBlock[] {
	const lines = String(md === null || md === undefined ? "" : md).replace(/\r\n?/g, "\n").split("\n");
	const out: MdBlock[] = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		if (line.trim() === "") { i++; continue; }

		// 围栏代码块（吃到收尾围栏；没闭合就吃到文件尾 —— 不丢字）
		if (RE_FENCE.test(line)) {
			const body: string[] = [];
			i++;
			while (i < lines.length && !RE_FENCE.test(lines[i])) { body.push(lines[i]); i++; }
			if (i < lines.length) i++;
			out.push({ kind: "code", text: body.join("\n") });
			continue;
		}

		const h = RE_HEADING.exec(line);
		if (h) { out.push({ kind: "heading", level: h[1].length, text: h[2].trim() }); i++; continue; }

		if (RE_HR.test(line)) { out.push({ kind: "hr" }); i++; continue; }

		// 表格：连续 `|` 行；**必须有分隔行**才算表格，否则原样退回段落
		if (RE_TABLE.test(line)) {
			const raw: string[] = [];
			while (i < lines.length && RE_TABLE.test(lines[i])) { raw.push(lines[i]); i++; }
			const sep = raw.findIndex((l) => RE_TABLE_SEP.test(l));
			if (sep > 0) out.push({ kind: "table", head: cellsOf(raw[0]), rows: raw.slice(sep + 1).map(cellsOf) });
			else out.push({ kind: "para", text: raw.map((l) => l.trim()).join(" ") });
			continue;
		}

		// 引用块
		if (RE_QUOTE.test(line)) {
			const q: string[] = [];
			let m: RegExpExecArray | null = RE_QUOTE.exec(lines[i]);
			while (i < lines.length && m !== null) {
				q.push(m[1].trim());
				i++;
				m = i < lines.length ? RE_QUOTE.exec(lines[i]) : null;
			}
			out.push({ kind: "quote", text: q.join(" ") });
			continue;
		}

		// 列表（有序 / 无序；一层子项）
		const first = RE_UL.exec(line) || RE_OL.exec(line);
		if (first) {
			const ordered = RE_OL.test(line);
			const base = first[1].length;
			const items: MdItem[] = [];
			while (i < lines.length) {
				const l = lines[i];
				if (l.trim() === "") break;
				const m = RE_UL.exec(l) || RE_OL.exec(l);
				if (m) {
					if (m[1].length > base && items.length > 0) items[items.length - 1].subs.push(m[2].trim());
					else items.push({ text: m[2].trim(), subs: [] });
				} else if (/^\s{2,}\S/.test(l) && items.length > 0) {
					const it = items[items.length - 1];
					if (it.subs.length > 0) it.subs[it.subs.length - 1] += " " + l.trim();
					else it.text += " " + l.trim();
				} else break;
				i++;
			}
			out.push({ kind: "list", ordered: ordered, items: items });
			continue;
		}

		// 段落：一路吃到空行 / 下一个块的开始（软换行按 markdown 的规矩并成一个空格）
		const para: string[] = [];
		while (i < lines.length && lines[i].trim() !== "" && !startsBlock(lines[i])) { para.push(lines[i].trim()); i++; }
		if (para.length === 0) { para.push(lines[i].trim()); i++; }   // 保险：认不出来也要往前走，绝不死循环
		out.push({ kind: "para", text: para.join(" ") });
	}
	return out;
}

/** 表格个数（构建期判据用：这份 md 里的表格是弹窗的重点，数量不许悄悄掉下去）。 */
export function mdTableCount(md: unknown): number {
	const lines = String(md === null || md === undefined ? "" : md).replace(/\r\n?/g, "\n").split("\n");
	let n = 0;
	for (const l of lines) if (RE_TABLE_SEP.test(l)) n++;
	return n;
}
