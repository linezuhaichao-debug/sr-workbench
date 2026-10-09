/**
 * 判据脚本：产物里**没有**打包进 React（以及其它平台基座模块），
 * 而那几处平台基座的 `require(...)` 还必须在、且**只在名单内**。
 *
 * 为什么用"特征串"而不是只比体积：
 *   体积是间接判据，改一行源码就变；特征串直接命中 React 实现体里独一无二的内部标识。
 *
 * ── 为什么 require 审计要**排除注释行**（2026-10-09 修）────────────────────────
 *   源码注释里写 `require("…")` 只是说明文字，不是依赖。原来扫全文，于是
 *   `src/ui/atoms.js` 文件头那句"外壳传进来的 `require("…")`"被判成名单外的依赖 —— 构建门误报。
 *   **判据要盯代码，不盯注释**（这条纪律本仓库踩过好几次）。
 *
 *   做法：先按行判断"这一行是不是注释行"（去空白后以星号开头，或以 `//`、`/*` 开头），是就跳过。
 *   ★ 为什么不写一个"完整剔注释"的扫描器：那要给 JS 做词法分析（正则字面量 vs 除法、模板串、
 *     带引号的正则……），本仓库真踩过 —— 一条 `/[\\/:*?"<>|]/` 里的引号就能让朴素扫描器失步。
 *     按行判断简单、可读、且**对本仓库的注释形态是准的**；代价是"行尾注释里写 require 规格串"
 *     不会被排除 —— 那种写法我们不写，真出现时这里的说明也够人判断。
 *
 * 跑法：node tools/check-no-react.mjs
 * 退出码：0 = 通过；1 = 失败
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.join(HERE, "..", "lib", "client.js");

const src = fs.readFileSync(CLIENT, "utf8");

/**
 * React 实现体里**只可能来自 React 源码**的标识（被 bundle 进来就一定会出现其中之一）。
 * 注意：这里刻意不写 `createElement` / `useState` 这类 API 名 —— 插件自己会调用它们，
 * 那样的名字在"只 require 不打包"的情况下也会出现，是假阳性。
 */
const REACT_IMPL_MARKERS = [
	"__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED",
	"react.element",                      // React 的 $$typeof 常量
	"react.portal",
	"react.provider",
	"react.context",
	"react-stack-bottom-frame",
	"Invalid hook call",
	"Revert to the dispatcher",
	"Minified React error",
	"react.development.js",
	"react.production.min.js",
	"react-jsx-runtime",
];

/** 同类：平台基座里的 UI 库（primitives）也不该被打进来。 */
const OTHER_BUNDLE_MARKERS = [
	"@deepseek-ai/dsh-client-ui-primitives/lib/",   // 打包后的路径注释
];

const hits = [];
for (const marker of [...REACT_IMPL_MARKERS, ...OTHER_BUNDLE_MARKERS]) {
	if (src.includes(marker)) hits.push(marker);
}

/** 名单内的平台模块（只许 require 这几个）。 */
const ALLOWED_REQUIRES = ["react", "react/jsx-runtime", "@deepseek-ai/dsh-client-ui-primitives"];

/** 这一行是不是注释行（去掉缩进后以注释符号开头）。 */
function isCommentLine(line) {
	const t = line.trimStart();
	return t.startsWith("*") || t.startsWith("//") || t.startsWith("/*") || t.startsWith("*/");
}

/** 产物里**真代码**的 require 规格串（注释行不算）。 */
const requireSpecifiers = [];
for (const line of src.split(/\r?\n/)) {
	if (isCommentLine(line)) continue;
	for (const m of line.matchAll(/require\((["'])([^"']+)\1\)/g)) {
		if (requireSpecifiers.indexOf(m[2]) < 0) requireSpecifiers.push(m[2]);
	}
}

const problems = [];
if (hits.length > 0) problems.push("产物里出现平台模块实现体特征串：" + hits.join(", "));
if (!requireSpecifiers.includes("react")) problems.push('产物里没有 require("react") —— React 没走平台模块表');
for (const spec of requireSpecifiers) {
	if (ALLOWED_REQUIRES.indexOf(spec) < 0) {
		problems.push(`产物里出现了名单外的 require(${JSON.stringify(spec)}) —— 检查 tsdown.config.ts 的 PLATFORM_EXTERNAL`);
	}
}

console.log(JSON.stringify({
	file: CLIENT,
	bytes: Buffer.byteLength(src, "utf8"),
	requireSpecifiers,
	allowed: ALLOWED_REQUIRES,
	implMarkerHits: hits,
}, null, 2));

if (problems.length > 0) {
	console.error("\n✗ React external 判据未通过：\n - " + problems.join("\n - "));
	process.exit(1);
}
console.error('\n✓ 通过：产物不含 React 实现体，平台引用只在名单内（' + requireSpecifiers.join(" · ") + "）");
