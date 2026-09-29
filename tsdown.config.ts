/**
 * 构建配置 —— 照抄 DSH 官方客户端插件的产物形态。
 *
 * 事实来源（读 npx 检出里的官方包得出）：
 *   - `@deepseek-ai/dsh-client-ui-plan/lib/client.js` / `dsh-client-ui-goal/lib/client.js`
 *     开头都是 `window.__ModuleLoader__.load({ id, factory: (require) => { var module = { exports: {} }; … } })`，
 *     factory 内部是 **CJS 形态**的代码，平台模块走 `require("react")` —— 即 **external**。
 *   - 官方包的 `package.json` 脚本是 `tsdown` / `tsdown --watch`；
 *     但真正的 tsdown preset（`clientBundle`）在 DSH 仓库内的
 *     `packages/client/tsdown.client.ts`，**没有随包发布**
 *     （`dsh-client-ui-settings-plugins/README.md` 原文：
 *      "the `clientBundle` preset that emits it lives in `../../../packages/client/tsdown.client.ts`
 *       rather than a published package, so a plugin outside this repository has to reproduce that build itself"）。
 *     所以本文件就是"复刻"：rolldown/tsdown 打 CJS bundle → 用 renderChunk 套回 ModuleLoader 外壳。
 *
 * 本票（工单 02 · expand）不改任何产品行为：外壳与官方产物同形，正文是 `src/client.js` 原文。
 *
 * 【已知且刻意接受的构建期差异】（tsdown v0.23.0 / rolldown v1.2.11 实测）：
 *   rolldown 会对入口模块做**声明级 DCE 与内联**，且 `treeshake: false`（raw rolldown 与 tsdown 都试过）
 *   **拦不住**。实测差异只有两类，都不改变行为：
 *     1. 删掉**零调用点**的死函数 `errText()`（源码里只声明、从不引用）；
 *     2. 把从未重新赋值的只读 `const` 内联掉（`isDir` / `hay` / `d0` / `contractErr`）。
 *   证据与核对方法见 README「构建期差异」一节与交付报告。
 */

import { defineConfig } from "tsdown";

/** 必须与 package.json 的 name 一致 —— 否则运行期报 `bundle … loaded without registering "<id>"`。 */
const PKG_ID = "dsh-client-ui-sr-workbench";

/**
 * 平台基座模块表（浏览器外壳播种的冻结模块表）。
 * 一律 external：产物里**不含**它们的实现体，运行期由 factory 拿到的 `require` 解析。
 *
 * 判据：`tools/check-no-react.mjs` 在产物里搜 React 的实现体特征串，搜到就判失败。
 * 名单必须覆盖 `src/` 里所有 `import` / `require` 的平台模块，否则会被打进产物。
 */
const PLATFORM_EXTERNAL = [
	"react",
	"react/jsx-runtime",
	"react-dom",
	"react-dom/client",
	"@deepseek-ai/dsh-client-ui-primitives",
];

/** 外壳开头：与官方 `lib/client.js` 完全同形。 */
const SHELL_BANNER = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(PKG_ID)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
`;

/** 外壳结尾：把 chunk 的 `exports` 交给 ModuleLoader。 */
const SHELL_FOOTER = `
\t\treturn module.exports;
\t}
});
`;

/**
 * rolldown 对"有具名导出的 ESM 入口 + CJS 输出"会自动在 chunk 开头补一行
 * `Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });`，
 * 而外壳里已经有同一行（官方产物也只有这一行）。重复定义**同值同描述符**的属性在规范上允许
 * （ValidateAndApplyPropertyDescriptor：不可配置但所有字段 SameValue → 返回 true），
 * 但产物会多一行、看起来像"没对齐官方形态"，所以只在**开头精确匹配**时去掉它。
 */
const CHUNK_HEAD_DUPLICATE = /^Object\.defineProperty\(exports, Symbol\.toStringTag, \{ value: ['"]Module['"] \}\);\r?\n/;

/**
 * rolldown 会在 chunk 里插 `//#region <入口模块相对 outDir 的路径>`，而这个相对路径
 * **取决于你用哪条路径进仓库**（本机两条都存在，见 README「过渡 junction」）：
 *   - 真目录 `D:\TimeMachine\sr-workbench`                              → `//#region src/client.js`
 *   - junction `outputs\_dsh-panel-test\dsh-client-ui-sr-workbench`     → `//#region ../../../sr-workbench/src/client.js`
 * 实测：同一份源码、同一个入口，两种走法差 **22 字节** —— 而 `lib/client.js` 是**入库产物**
 * （`.gitattributes` 的注释正是"必须按字节稳定"），谁在 junction 里构建一次就平白多一个 diff。
 * 所以把入口的 region 注释归一成 `src/client.js`（真路径构建的形态，也是 HEAD 里那份的形态）。
 * 其它 region（如 `\0rolldown/runtime.js`）不含路径，保持原样。
 */
const CLIENT_REGION = /\/\/#region [^\n]*?src\/client\.js/g;

/** 把 CJS chunk 包进 ModuleLoader 外壳。 */
function wrapChunk(code) {
	let body = code;
	if (CHUNK_HEAD_DUPLICATE.test(body)) body = body.replace(CHUNK_HEAD_DUPLICATE, "");
	body = body.replace(CLIENT_REGION, "//#region src/client.js");
	return SHELL_BANNER + body + SHELL_FOOTER;
}

export default defineConfig([
	// ── ① host 半侧：Node ESM 入口（不套浏览器外壳）────────────────────────────
	{
		name: `${PKG_ID}/host`,
		entry: { index: "src/index.js" },
		outDir: "lib",
		format: ["esm"],
		platform: "node",
		dts: false,
		clean: false,
		sourcemap: false,
		// 产物必须正好叫 lib/index.js（exports["."] 指的就是它），不要 .mjs
		outExtensions: () => ({ js: ".js" }),
	},

	// ── ② 浏览器半侧：单个 lib/client.js（CJS + ModuleLoader 外壳）────────────
	{
		name: `${PKG_ID}/client`,
		entry: { client: "src/client.js" },
		outDir: "lib",
		format: ["cjs"],
		platform: "browser",
		deps: { neverBundle: PLATFORM_EXTERNAL },
		dts: false,
		clean: false,
		sourcemap: false,
		// 产物必须正好叫 lib/client.js（exports["./client"] 指的就是它），不要 .cjs
		outExtensions: () => ({ js: ".js" }),
		plugins: [
			{
				name: "dsh-client-bundle-shell",
				/**
				 * 把 CJS chunk 包进 `window.__ModuleLoader__.load({ id, factory })`。
				 * ★ 外壳写在 chunk **之前**：chunk 顶部的 `"use strict"`（若有）就不再是
				 *   directive prologue，factory 体与今天手写版一样跑在**非严格模式**。
				 */
				renderChunk(code) {
					return { code: wrapChunk(code), map: null };
				},
			},
		],
	},
]);
