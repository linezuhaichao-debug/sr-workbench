/**
 * **md 渲染器**（自绘那支）—— 把一份 markdown 渲染成面板里的元素树。
 *
 * ── 为什么是自己画 ────────────────────────────────────────────────────────
 *   用户口径：技能用法**直接读那份 md、按 md 格式渲染，尤其表格**。
 *   官方的 `MarkdownText` 在场时优先用它（那是宿主自己的 markdown 渲染，表格、代码、
 *   引用块都是它的事）；**拿不到就走这里** —— 宿主没给组件库时面板不能一片空白。
 *   两支的观感目标一致（同一套令牌、同一套字号），判据两种都要有网（见 tools/render-smoke.mjs）。
 *
 * ── 范围 ──────────────────────────────────────────────────────────────────
 *   分块与行内拆分全在 `src/pure/mdview.ts`（零依赖，有单测）；本文件只负责
 *   **块 → 元素** 的映射与样式。样式一律走 `./tokens.js`，不写裸数字/硬色。
 *
 * ── 表格（用户点名的重点）───────────────────────────────────────────────────
 *   `table-layout: auto` + `white-space: normal`：列宽跟着内容走，长单元格**换行**而不是
 *   把表撑出弹窗（外层再套一个 `overflow-x: auto`，窄面板下整表可横向滚）。
 */
import * as React from "react";

import { mdBlocks, mdRuns } from "../pure/mdview.ts";
import { ALIAS, FONT, GAP, LEADING, LINE, RADIUS, WEIGHT } from "./tokens.js";

const h = React.createElement;

/** 等宽字（与 client.js 里那支一致：面板里不重复定义字体栈的地方，只有这里和组合根）。 */
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** 行内片段 → 元素（加粗走 `<strong>`、行内代码走 `<code>`）。 */
function runs(text, keyPrefix) {
	return mdRuns(text).map((r, i) => {
		const key = keyPrefix + "-" + i;
		if (r.code) {
			return h("code", {
				key: key,
				style: {
					fontFamily: MONO, fontSize: "0.94em", background: ALIAS.panel2,
					border: LINE.hair + " solid " + ALIAS.line, borderRadius: RADIUS.chip,
					padding: "0 4px", whiteSpace: "normal"
				}
			}, r.text);
		}
		if (r.bold) return h("strong", { key: key, style: { fontWeight: WEIGHT.semibold, color: ALIAS.ink } }, r.text);
		return h("span", { key: key }, r.text);
	});
}

/** 标题：`#`~`######` 直接映到 `h1`~`h6`（"按 md 原样渲染"）。 */
function heading(b, key) {
	const lvl = Math.min(Math.max(Number(b.level) || 1, 1), 6);
	const size = lvl === 1 ? FONT.card : lvl === 2 ? FONT.title : FONT.body;
	const style = {
		fontSize: size, fontWeight: lvl <= 2 ? WEIGHT.bold : WEIGHT.semibold,
		color: lvl >= 4 ? ALIAS.muted : ALIAS.ink,
		lineHeight: LEADING.tight,
		margin: lvl === 1 ? "0 0 " + GAP.md : GAP.lg + " 0 " + GAP.sm
	};
	return h("h" + lvl, { key: key, style: style }, runs(b.text, key));
}

/** 表格：外层可横向滚，表格自身按内容定列宽，长单元格换行。 */
function table(b, key) {
	const cell = {
		border: LINE.hair + " solid " + ALIAS.line, padding: "5px 8px",
		whiteSpace: "normal", wordBreak: "break-word", verticalAlign: "top",
		lineHeight: LEADING.body, textAlign: "left"
	};
	const head = b.head && b.head.length
		? h("thead", { key: "h" }, h("tr", null, b.head.map((c, i) => h("th", {
			key: "h" + i,
			style: Object.assign({}, cell, { background: ALIAS.panel2, fontWeight: WEIGHT.semibold, color: ALIAS.ink })
		}, runs(c, key + "-h" + i)))))
		: null;
	const rows = (b.rows || []).map((row, ri) => h("tr", { key: "r" + ri },
		row.map((c, ci) => h("td", { key: "c" + ci, style: Object.assign({}, cell, { color: ALIAS.ink }) }, runs(c, key + "-r" + ri + "c" + ci)))));
	return h("div", { key: key, style: { overflowX: "auto", margin: "0 0 " + GAP.md } },
		h("table", {
			style: {
				tableLayout: "auto", borderCollapse: "collapse", width: "100%",
				fontSize: FONT.meta, color: ALIAS.ink
			}
		}, [head, h("tbody", { key: "b" }, rows)]));
}

/** 列表：一层子项（`subs`）渲成嵌套 `<ul>`；不再往下递归。 */
function list(b, key) {
	const items = (b.items || []).map((it, i) => h("li", { key: "i" + i, style: { marginBottom: GAP.xs } }, [
		h("span", { key: "t" }, runs(it.text, key + "-i" + i))
	].concat(it.subs && it.subs.length
		? [h("ul", { key: "s", style: { margin: GAP.xs + " 0 0", paddingLeft: GAP.lg } },
			it.subs.map((s, si) => h("li", { key: "s" + si }, runs(s, key + "-i" + i + "s" + si))))]
		: [])));
	return h(b.ordered ? "ol" : "ul", {
		key: key,
		style: { margin: "0 0 " + GAP.md, paddingLeft: "20px", fontSize: FONT.body, color: ALIAS.ink, lineHeight: LEADING.loose }
	}, items);
}

function block(b, i) {
	const key = "b" + i;
	if (b.kind === "heading") return heading(b, key);
	if (b.kind === "table") return table(b, key);
	if (b.kind === "list") return list(b, key);
	if (b.kind === "hr") return h("hr", { key: key, style: { border: 0, borderTop: LINE.hair + " solid " + ALIAS.line, margin: GAP.lg + " 0" } });
	if (b.kind === "quote") return h("blockquote", {
		key: key,
		style: {
			margin: "0 0 " + GAP.md, padding: GAP.xs + " 0 " + GAP.xs + " 10px",
			borderLeft: "3px solid " + ALIAS.line2, color: ALIAS.muted, fontSize: FONT.body, lineHeight: LEADING.loose
		}
	}, runs(b.text, key));
	if (b.kind === "code") return h("pre", {
		key: key,
		style: {
			margin: "0 0 " + GAP.md, padding: GAP.sm, background: ALIAS.panel2,
			border: LINE.hair + " solid " + ALIAS.line, borderRadius: RADIUS.control,
			overflowX: "auto", fontFamily: MONO, fontSize: FONT.meta, color: ALIAS.ink
		}
	}, h("code", null, b.text));
	return h("p", {
		key: key,
		style: { margin: "0 0 " + GAP.md, fontSize: FONT.body, color: ALIAS.ink, lineHeight: LEADING.loose, whiteSpace: "normal" }
	}, runs(b.text, key));
}

/** 入口：整份 md ⇒ 一个块级容器。 */
export function mdView(md) {
	return h("div", null, mdBlocks(md).map(block));
}
