#!/usr/bin/env node
/**
 * 吸顶版式补丁：让界面节的左图**真的吸得住**（sr-gdd-ue 自研工具）。
 *
 * ── 它只做一件事 ─────────────────────────────────────────────────────────
 *   「左图右文」的双栏与 `position: sticky` 是工具包自带的 `gen_01.py` 提供的，本补丁**不动它们**，
 *   只补上让吸顶真正成立的那一条：**给图一个视口高度上限**。
 *
 * ── 为什么必须有这一条（实测，不是推断）────────────────────────────────────
 *   竖屏界面截图（1080×1920）按栏宽 380px 显示 ⇒ 高 **675px**。而界面节的右栏规则
 *   要超过 675px 才谈得上"图留在视野里"（约 18–20 条 UE 规则）。
 *   实测示例页的两个有图截面：**吸顶可用行程 = 双栏行高 − 图高 = 0px** ——
 *   图自己就是最高的那个元素，sticky 没有可移动空间 ⇒ 滚起来图照样走，
 *   "左图吸顶"只是个写在 CSS 里、从不发生的声明。
 *
 *   给了上限之后：图最高 46vh（视口 1200px 时 552px、宽约 310px），右栏只要比它高就吸得住。
 *   ★ 规则本来就没图高的截面（右栏很短的），吸不吸都无所谓 —— 那种截面一屏能看完，不需要吸。
 *
 * ── 边界 ─────────────────────────────────────────────────────────────────
 *   · 只往 `</head>` 前插一个 `<style>`，**不改内容**；截图仍是生成器内嵌的 base64。
 *   · **幂等**：重复跑只保留一份（按 `data-sr-sticky-layout` 标记认）。
 *   · 窄屏（≤900px）双栏本就退回单列，这里把高度上限一并取消。
 *   · 工具包升级换了类名 ⇒ 这段匹配不到 `.shot img`，页面回到"图按栏宽显示"的老样子，
 *     仍然可读。判据是 `tools/smoke_check.mjs` 第 4 项（含吸顶行程与滚动实测）。
 *
 * 用法：
 *   node apply_sticky_layout.mjs <html> [--check]
 *
 * 退出码：0 = 已应用（或 --check 下确认已应用）；1 = 文件不存在 / 写失败；
 *         --check 且页面里没有 `.shot` 时返回 1（说明生成器结构变了）。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MARK = 'data-sr-sticky-layout';

const CSS = `
/* ── sr-gdd-ue 吸顶版式补丁：给左图一个视口高度上限 ───────────────────────
   没有它，竖屏界面图（约 675px 高）比右栏规则还高，sticky 的可用行程是 0，
   "左图吸顶"就只是一句从不发生的声明。由 tools/apply_sticky_layout.mjs 注入。 */
.shot img {
  width: auto;
  max-width: 100%;
  max-height: 46vh;
  margin: 0 auto;
}
@media (max-width: 900px) {
  .shot img { width: 100%; max-height: none; }
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

/** 页面里有几张界面图（判据：这补丁还认不认得出生成器的结构）。 */
function shots(html) {
	return (html.match(/<figure class="shot"/g) || []).length;
}

function main() {
	const args = parseArgs(process.argv);
	if (args.help || !args.html) {
		console.log('用法: node apply_sticky_layout.mjs <html> [--check]');
		console.log('  --check  只检查（不改文件）：已应用？页面里几张界面图？');
		return args.help ? 0 : 1;
	}
	const file = resolve(args.html);
	if (!existsSync(file)) {
		console.log('[FAIL] 找不到 HTML: ' + file);
		return 1;
	}
	let html = readFileSync(file, 'utf8');
	const applied = html.indexOf(MARK) >= 0;
	const n = shots(html);

	if (args.check) {
		console.log('页面: ' + file);
		console.log('吸顶补丁: ' + (applied ? '已应用' : '未应用'));
		console.log('界面图: ' + n + ' 张');
		if (!applied) {
			console.log('[FAIL] 没打吸顶补丁 —— 左图会比右栏还高、吸不住（跑一次不带 --check 的同一命令）。');
			return 1;
		}
		if (n === 0) {
			console.log('[WARN] 这一页没有界面图：要么本来就没图，要么生成器把 figure.shot 的类名改了。');
			return 0;
		}
		console.log('[OK] 左图有视口高度上限，吸顶在结构上成立。');
		return 0;
	}

	if (applied) {
		console.log('已应用过（幂等，未重复注入）: ' + file + '（' + n + ' 张界面图）');
		return 0;
	}
	const head = html.indexOf('</head>');
	if (head < 0) {
		console.log('[FAIL] 页面里没有 </head> —— 这不是 gen_01.py 生成的页面？');
		return 1;
	}
	html = html.slice(0, head) + '<style ' + MARK + '>' + CSS + '</style>\n' + html.slice(head);
	writeFileSync(file, html, 'utf8');
	console.log('已应用吸顶补丁: ' + file);
	console.log('  +' + CSS.length + ' 字节样式 · ' + n + ' 张界面图加上 46vh 高度上限（窄屏自动取消）');
	return 0;
}

process.exit(main());
