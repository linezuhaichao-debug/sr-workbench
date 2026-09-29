/**
 * 判据脚本：产物里**没有**打包进 React（以及其它平台基座模块），
 * 而那唯一的平台基座 `require("react")` 还必须在。
 *
 * 为什么用"特征串"而不是只比体积：
 *   体积是间接判据，改一行源码就变；特征串直接命中 React 实现体里独一无二的内部标识。
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

/** 反向判据：平台模块必须仍然走 external 的 require。 */
const requires = [...src.matchAll(/require\((["'])([^"']+)\1\)/g)].map((m) => m[2]);
const uniqueRequires = [...new Set(requires)];

const problems = [];
if (hits.length > 0) problems.push("产物里出现平台模块实现体特征串：" + hits.join(", "));
if (!uniqueRequires.includes("react")) problems.push('产物里没有 require("react") —— React 没走平台模块表');
for (const spec of uniqueRequires) {
	if (!["react", "react/jsx-runtime", "@deepseek-ai/dsh-client-ui-primitives"].includes(spec)) {
		problems.push(`产物里出现了名单外的 require(${JSON.stringify(spec)}) —— 检查 tsdown.config.ts 的 PLATFORM_EXTERNAL`);
	}
}

console.log(JSON.stringify({
	file: CLIENT,
	bytes: Buffer.byteLength(src, "utf8"),
	requireSpecifiers: uniqueRequires,
	implMarkerHits: hits,
}, null, 2));

if (problems.length > 0) {
	console.error("\n✗ React external 判据未通过：\n - " + problems.join("\n - "));
	process.exit(1);
}
console.error('\n✓ 通过：产物不含 React 实现体，只有 require("react") 这一处平台引用');
