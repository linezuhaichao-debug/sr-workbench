/**
 * 接缝的结构性断言（机器化那份"分层纪律"）：
 *
 *   · `src/pure/**` 零依赖：不 import 任何外部模块，不碰 window / document / ctx
 *   · `src/load/**` 只吃 port：不碰 ctx / remote.* / window，不写文件
 *   · `src/actions/**` 也只经过端口
 *   · `lib/client.js` 仍是**单个** bundle，还是 ModuleLoader 外壳，且不含 React 实现体
 *
 * ★ 这几条是给"以后"的护栏：ESLint 抓 import 与自由变量，这里抓"文本层面的越界"，
 *   两者叠加才等价于被删掉的 `check-sandbox.js`（它当年抓的是未声明标识符）。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
	for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, d.name);
		if (d.isDirectory()) walk(p, out);
		else if (/\.(tsx?|js)$/.test(d.name)) out.push(p);
	}
	return out;
}

/** 去掉行注释/块注释，避免注释里的示例代码造成假阳性 */
function codeLines(text: string): { no: number; line: string }[] {
	const out: { no: number; line: string }[] = [];
	let inBlock = false;
	text.split(/\r?\n/).forEach((line, i) => {
		let l = line;
		if (inBlock) {
			const end = l.indexOf("*/");
			if (end < 0) return;
			l = l.slice(end + 2);
			inBlock = false;
		}
		while (true) {
			const b = l.indexOf("/*");
			if (b < 0) break;
			const e = l.indexOf("*/", b + 2);
			if (e < 0) {
				l = l.slice(0, b);
				inBlock = true;
				break;
			}
			l = l.slice(0, b) + l.slice(e + 2);
		}
		const t = l.trim();
		if (t.startsWith("//") || t.startsWith("*")) return;
		out.push({ no: i + 1, line: l });
	});
	return out;
}

const forbidden = (files: string[], patterns: RegExp[]): string[] => {
	const hits: string[] = [];
	for (const f of files) {
		for (const { no, line } of codeLines(fs.readFileSync(f, "utf8"))) {
			for (const re of patterns) if (re.test(line)) hits.push(path.relative(ROOT, f) + ":" + no + "  " + line.trim().slice(0, 90));
		}
	}
	return hits;
};

test("pure 层零依赖：不 import 外部模块，不碰 window / document / ctx / require", () => {
	const files = walk(path.join(SRC, "pure"));
	assert.ok(files.length >= 11, "pure 层应有 11 个以上模块，实际 " + files.length);
	for (const f of files) {
		for (const { no, line } of codeLines(fs.readFileSync(f, "utf8"))) {
			const m = /^\s*import\s+.*from\s+["']([^"']+)["']/.exec(line);
			if (m) assert.match(m[1], /^\.\/(?!.*\.\.\/)/, path.basename(f) + ":" + no + " pure 层只能 import 同层（" + m[1] + "）");
		}
	}
	const hits = forbidden(files, [/\bwindow\s*\./, /\bdocument\s*\./, /\bctx\b/, /\brequire\s*\(/, /"react/, /"@deepseek-ai/]);
	assert.deepEqual(hits, [], "pure 层不许出现这些：\n" + hits.join("\n"));
});

test("load 层只吃 port：不碰 ctx / remote / window / React", () => {
	const files = walk(path.join(SRC, "load"));
	assert.ok(files.length >= 4);
	const hits = forbidden(files, [/\bctx\b/, /\bremote\b/, /\bwindow\s*\./, /"react/, /\brequire\s*\(/]);
	assert.deepEqual(hits, [], "load 层不许出现这些：\n" + hits.join("\n"));
	// 加载器只 import pure 与 port（不许 import actions / ui / host）；
	// ★ 原断言写成 /^\.\.\/(pure|port)\// —— 把**同层互相 import**（load\dashboard.ts → ./paths.ts）
	//   也判成违规了，那是错的：同层 import 是层内组合，不构成跨层依赖，规格说的依赖方向只约束**跨层**边。
	//   所以这里改成"同层（./）或 pure/port（../pure|x/，即从 load\ 出来正好是 ../）"。
	for (const f of files) {
		for (const { no, line } of codeLines(fs.readFileSync(f, "utf8"))) {
			const m = /^\s*import\s+.*from\s+["']([^"']+)["']/.exec(line);
			if (m) assert.match(m[1], /^\.\/|^\.\.\/(pure|port)\//, path.basename(f) + ":" + no + " load 只许 import pure / port / 同层（" + m[1] + "）");
		}
	}
});

test("只有组合根（src/client.js）与生产端口碰 ctx.remote", () => {
	const hits: string[] = [];
	for (const f of walk(SRC)) {
		const rel = path.relative(SRC, f).replace(/\\/g, "/");
		// 组合根：浏览器半侧是手写的 src/client.js（纯函数与加载层都在它下面）
		if (rel === "client.js" || rel === "client.ts" || rel === "client.tsx" || rel === "port/dsh.ts") continue;
		for (const { no, line } of codeLines(fs.readFileSync(f, "utf8"))) {
			if (/\bremote\.[a-zA-Z]/.test(line)) hits.push(rel + ":" + no + "  " + line.trim().slice(0, 80));
		}
	}
	assert.deepEqual(hits, [], "除组合根与生产端口外，谁都不许直接摸 remote：\n" + hits.join("\n"));
});

test("构建产物仍是单个 bundle，且外壳/内容可核对", () => {
	const lib = path.join(ROOT, "lib");
	assert.ok(fs.existsSync(path.join(lib, "client.js")), "lib/client.js 必须在（入库产物）");
	const files = fs.readdirSync(lib);
	assert.deepEqual(files.sort(), ["client.js", "index.js"], "lib/ 只应有这两个文件（没有拆出来的 chunk）");

	const bundle = fs.readFileSync(path.join(lib, "client.js"), "utf8");
	assert.ok(bundle.startsWith('window.__ModuleLoader__.load({\n\tid: "dsh-client-ui-sr-workbench",'), "外壳必须与官方同形");
	assert.ok(bundle.trimEnd().endsWith("});"), "外壳必须闭合");
	assert.ok(bundle.includes("策划工作台"), "面板文案必须在产物里");
	assert.ok(bundle.includes('require("react")'), "React 走平台基座模块表");
	assert.equal(/\/\*!?\s*React v/.test(bundle), false, "产物里不许含 React 实现体");
	assert.equal(/^\s*import\s/m.test(bundle.split("\n").slice(0, 40).join("\n")), false, "产物不该是 ESM");
});

/**
 * 头部按钮：卡片墙与功能详情必须是**同一套**。
 *
 * 用户口径（2026-10-10）：① 卡片墙那个按钮〔技能用法〕改名〔使用说明〕；
 * ② 详情页的〔刷新〕也加刷新小图标、〔打开工作会话〕改名〔打开会话〕；
 * ③ 两处都要"正好两个按钮、字数一样（2 + 4）、高度一样"。
 * ★ 用户口径（2026-10-13）：详情页那个动作**换语义**了 ——〔打开会话〕→〔新建会话〕
 *   （通过工作台创建会话：建在功能工作区、开策划模式、受面板控制）。名字与旧名一起在这里钉住。
 *
 * 为什么这条断言盯**产物文本**而不是渲染冒烟：详情页那两个按钮只在 `sessionId` 非空时渲染，
 * 而渲染冒烟里那条会话是空的（`useSessions` 返回空表）⇒ 屏幕上看不到〔打开会话〕，
 * 那正是"改了却没人拦"的空档。这里的判据是"两处四个按钮都被同一个常量钉住高度"。
 * （2026-10-13 起那颗按钮**总是渲染**了，但这条"盯产物文本"的判据照旧有效、成本更低。）
 */
test("头部按钮：卡片墙与详情是同一套（名字 + 等高）", () => {
	const bundle = fs.readFileSync(path.join(ROOT, "lib", "client.js"), "utf8");
	/** 某个按钮文案的**每一处**前后各 300 字（转译后每属性一行，够覆盖整个 `Btn({…})` 调用）。 */
	const around = (label: string): string[] => {
		const key = 'label: "' + label + '"';
		const out: string[] = [];
		for (let i = bundle.indexOf(key); i >= 0; i = bundle.indexOf(key, i + 1)) {
			out.push(bundle.slice(Math.max(0, i - 300), i + 300));
		}
		assert.ok(out.length > 0, "产物里找不到按钮文案：" + label);
		return out;
	};

	// ① 文案：新名要在、旧名不许再当按钮文案（注释里提旧名是允许的 ⇒ 只认 `label:` 这个键）
	assert.ok(around("使用说明").length >= 1, "卡片墙头部该是〔使用说明〕");
	assert.equal(bundle.split('label: "技能用法"').length - 1, 0, "旧名〔技能用法〕不该再作按钮文案");
	assert.equal(bundle.split('label: "打开工作会话"').length - 1, 0, "旧名〔打开工作会话〕不该再作按钮文案");
	assert.equal(bundle.split('label: "打开会话"').length - 1, 0, "旧名〔打开会话〕不该再作按钮文案（动作已换成「新建会话」）");

	/**
	 * ★ 详情页那颗新按钮的文案是**条件式**（`creatingSession ? "新建中…" : "新建会话"`）——
	 *   `label: "…"` 这个键认不出它，所以单独取它前后各 300 字来钉：
	 *   两个文案都得在（一个是常态、一个是新建中的禁用态），几何仍是同一个常量。
	 */
	const newBtnAt = bundle.indexOf('"新建会话"');
	assert.ok(newBtnAt >= 0, "产物里找不到按钮文案：新建会话");
	const newBtn = bundle.slice(Math.max(0, newBtnAt - 300), newBtnAt + 300);
	assert.ok(newBtn.includes('"新建中…"'), "新建中的禁用文案该与〔新建会话〕在同一个按钮上");
	assert.ok(newBtn.includes("h: HEAD_BTN_H"), "〔新建会话〕没按 HEAD_BTN_H 钉几何");

	// ② 位置：〔刷新〕**恰好两处**（卡片墙 + 详情页），两处都带刷新小图标
	const refresh = around("刷新");
	assert.equal(refresh.length, 2, "〔刷新〕只该出现在卡片墙与详情页两处头部");
	for (const w of refresh) assert.ok(w.includes("IconRefreshOutlineRegular"), "头部〔刷新〕该带刷新小图标");

	// ③ 等高 + 对齐：三个头部按钮文案都得由同一个常量钉住几何 ——
	//    银弹是 `alignSelf: "center"`：官方 `.sm` 本来就是 28px，那 3px 差是**基线对齐**造成的
	//    （带 icon 的按钮基线取图标底边，比文字基线低）⇒ 不按行居中就是用户看到的那条"高度不一样"。
	assert.ok(bundle.includes('alignSelf: "center"'), "头部按钮没按行居中 —— 基线对齐会让带图标的与纯文字的那个差 3px");
	for (const label of ["刷新", "使用说明"]) {
		for (const w of around(label)) assert.ok(w.includes("h: HEAD_BTN_H"), "〔" + label + "〕没按 HEAD_BTN_H 钉几何");
	}
});
