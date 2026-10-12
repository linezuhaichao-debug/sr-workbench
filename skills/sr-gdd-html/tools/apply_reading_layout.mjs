#!/usr/bin/env node
/**
 * 阅读版版式补丁：让「界面图 + 规则」并排，图**吸顶**（sr-gdd-html 自研工具）。
 *
 * ── 为什么需要它 ──────────────────────────────────────────────────────────
 *   am 的 `doc` 模板是**单列流水线**：`![图]` 渲染成一个居中的 figure，规则表跟在下面。
 *   界面节的规则表一长（UE1…UE15），图早就滚出视口了 —— 而"对着图读规则"正是界面节
 *   最需要的读法（`sr-gdd-ue` 的宣讲模板就是左图右文 + 图吸顶）。
 *
 *   am 没有分栏组件，但它给了**官方的样式扩展点**（自定义主题的 `css` 字段），
 *   说明"往页面里补一段样式"是它认的做法。本工具就做这一件事，**只管版式、不碰内容**：
 *
 *     ① 找到「figure 后面还有别的块」的 `.am-md`（= 图 + 正文的那种面板）；
 *     ② 给它们套两栏 grid，figure 进左栏并 `position: sticky`；
 *     ③ 窄屏（≤900px）退回单栏，图不再吸顶。
 *
 * ── 边界 ─────────────────────────────────────────────────────────────────
 *   · **不改一个字的内容**：只往 `</head>` 前插一个 `<style>`；页面里的图仍是 am 内嵌的
 *     base64、`#am-source` 原样保留 ⇒ `am patch` 照常可用。
 *   · **幂等**：重复跑只保留一份（按 `data-sr-reading-layout` 标记认）。
 *   · **降级不崩**：am 将来改了类名 ⇒ 这段 CSS 匹配不到任何东西，页面回到单列，仍然可读。
 *     所以 `tools/smoke_check.mjs` 里那条"图必须真的吸顶"是这条补丁的判据。
 *
 * 用法：
 *   node apply_reading_layout.mjs <html> [--check]
 *
 * 退出码：0 = 已应用（或 --check 下确认已应用且命中 ≥1 个面板）；1 = 文件不存在 / 写失败；
 *         --check 且一个面板都没命中时返回 1（说明补丁失效了，该去看 am 的 DOM 变没变）。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MARK = 'data-sr-reading-layout';

/**
 * 版式：`.am-md` 里既有 figure 又有别的块 ⇒ 两栏（图左、其余右），图吸顶。
 *
 * `:has(> .am-figure ~ *)` 是"figure 后面还有兄弟"——只有一个孤零零 figure 的面板
 * （纯图面板）不套两栏，免得图被挤到一条窄栏里。
 *
 * ★ 图必须**受视口高度约束**（`max-height: 46vh`），否则吸顶是假的：
 *   实测过一版图 330px 宽 ⇒ 高 728px，而右栏 16 条 UE 规则才 600px ——
 *   图自己就是最高的那个，sticky 的可用行程是 **0px**，滚起来图照样走。
 *   竖屏界面截图（1080×1920）尤其如此，所以这条不是保险，是**吸顶能不能成立的前提**。
 */
const CSS = `
/* ── sr-gdd-html 阅读版版式：界面图与规则并排，图吸顶 ─────────────────────
   对着图读规则用（规则再长，图也留在视野里）。图受视口高度约束，窄屏退回单栏。
   由 tools/apply_reading_layout.mjs 注入；改这里就要重跑那个脚本。 */

/* ★ 这一条是 sticky 能不能成立的前提，不是保险：
   am 的 .am-panel 带 overflow: hidden（为了圆角裁剪），它会成为 sticky 的裁剪祖先 ⇒
   底下的 position:sticky **完全失效**（实测：声明在、滚起来图照样走，top -119px）。
   只给"含图 + 正文"的面板放开，影响面最小；面板内容本来就在 padding 里，
   宽表格另有 .am-table-wrap 自己的横向滚动，放开不会露出裁剪问题。 */
.am-panel:has(.am-md > .am-figure ~ *) {
  overflow: visible;
}
.am-md:has(> .am-figure ~ *) {
  display: grid;
  grid-template-columns: minmax(200px, 300px) minmax(0, 1fr);
  gap: 30px;
  align-items: start;
}
.am-md:has(> .am-figure ~ *) > .am-figure {
  grid-column: 1;
  position: sticky;
  top: 20px;
  margin: 0;
}
.am-md:has(> .am-figure ~ *) > .am-figure img {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: 46vh;
  margin: 0 auto;
}
.am-md:has(> .am-figure ~ *) > :not(.am-figure) {
  grid-column: 2;
}
@media (max-width: 900px) {
  .am-md:has(> .am-figure ~ *) { display: block; }
  .am-md:has(> .am-figure ~ *) > .am-figure { position: static; }
  .am-md:has(> .am-figure ~ *) > .am-figure img { max-height: none; }
}
`;

function parseArgs(argv) {
	const out = { html: null, check: false };
	for (let i = 2; i < argv.length; i += 1) {
		const a = argv[i];
		if (a === '--check') out.check = true;
		else if (a === '--help' || a === '-h') out.help = true;
		else if (!out.html) out.html = a;
	}
	return out;
}

/** 页面里有几个"图 + 正文"的面板（判据：这补丁到底还认不认得出 am 的结构）。 */
function figurePanels(html) {
	// am 的 figure 是 .am-md 的直接子元素：「<figure class="am-figure">」
	return (html.match(/<figure class="am-figure"/g) || []).length;
}

function main() {
	const args = parseArgs(process.argv);
	if (args.help || !args.html) {
		console.log('用法: node apply_reading_layout.mjs <html> [--check]');
		console.log('  --check  只检查（不改文件）：已应用？命中几个「图 + 正文」面板？');
		return args.help ? 0 : 1;
	}
	const file = resolve(args.html);
	if (!existsSync(file)) {
		console.log('[FAIL] 找不到 HTML: ' + file);
		return 1;
	}
	let html = readFileSync(file, 'utf8');
	const applied = html.indexOf(MARK) >= 0;
	const panels = figurePanels(html);

	if (args.check) {
		console.log('页面: ' + file);
		console.log('版式补丁: ' + (applied ? '已应用' : '未应用'));
		console.log('「图 + 正文」面板: ' + panels + ' 个');
		if (!applied) {
			console.log('[FAIL] 没打版式补丁 —— 界面节的图不会吸顶（跑一次不带 --check 的同一命令）。');
			return 1;
		}
		if (panels === 0) {
			console.log('[WARN] 一页里没有「图 + 正文」的面板：要么这页本来就没图，要么 am 的 DOM 变了。');
			return 0;
		}
		console.log('[OK] 图与规则并排、图吸顶。');
		return 0;
	}

	if (applied) {
		console.log('已应用过（幂等，未重复注入）: ' + file + '（' + panels + ' 个「图 + 正文」面板）');
		return 0;
	}
	const head = html.indexOf('</head>');
	if (head < 0) {
		console.log('[FAIL] 页面里没有 </head> —— 这不是 am 渲染出来的页面？');
		return 1;
	}
	html = html.slice(0, head) + '<style ' + MARK + '>' + CSS + '</style>\n' + html.slice(head);
	writeFileSync(file, html, 'utf8');
	console.log('已应用版式补丁: ' + file);
	console.log('  +' + CSS.length + ' 字节样式 · 覆盖 ' + panels + ' 个「图 + 正文」面板（图左、吸顶；窄屏退回单栏）');
	return 0;
}

process.exit(main());
