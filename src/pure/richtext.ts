/**
 * 行内富文本：把决策记录里的 **加粗** 拆成片段，供面板渲染成真粗体。
 *
 * 用户口径：「要渲染成粗体」——记录正文按 markdown 写，面板上原样显示星号很难读。
 * `看原文` 那一档仍然显示**原样文本**，所以这不算改写内容，只是显示层的解析。
 *
 * ★ 只认两种写法：`**x**` 与 `__x__`（不做斜体/链接/代码 —— 面板不解释更多语法，
 *   免得把"看起来像 markdown"的普通文字吃掉；`*x*` 这种单星号**不动**，
 *   因为配置表名里常出现单个星号，误吃会丢字）。
 */

export interface Run {
	text: string;
	bold: boolean;
}

/**
 * 拆行内片段。规则：
 *   · `**x**` / `__x__` ⇒ bold 片段（内容非空才算）；
 *   · 不闭合、内容为空（`****`）、跨行的 `**` ⇒ **原样保留**（宁可少渲染，不可丢字）。
 */
export function inlineRuns(text: unknown): Run[] {
	const s = String(text === null || text === undefined ? "" : text);
	if (s === "") return [];
	const out: Run[] = [];
	const re = /\*\*([^*\n]+)\*\*|__([^_\n]+)__/g;
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(s)) !== null) {
		const body = m[1] !== undefined ? m[1] : m[2];
		if (body === undefined || body.trim() === "") continue;   // 全空白不当加粗
		if (m.index > last) out.push({ text: s.slice(last, m.index), bold: false });
		out.push({ text: body, bold: true });
		last = m.index + m[0].length;
	}
	if (last < s.length) out.push({ text: s.slice(last), bold: false });
	return out;
}

/** 有没有真的需要渲染（没有加粗就省一层包装，少建节点）。 */
export function hasBold(text: unknown): boolean {
	return inlineRuns(text).some((r) => r.bold);
}
