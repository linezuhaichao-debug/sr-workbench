/**
 * ESLint 扁平配置 —— 把「分层纪律」从自律改成**机器化的网**。
 *
 * 依据：设计 §6.1 四条纪律 + 工单 03 issue「依赖方向由 ESLint 规则机器化」+ ADR 0001
 * （源码拆成多模块 TypeScript；`legacy/check-sandbox.js` 那套"沙箱里跑一遍让运行时报未声明标识符"
 *   随哨兵切片测试一起删除 ⇒ **必须给出替代**）。
 *
 * ── 这张网管什么 ────────────────────────────────────────────────────────────
 *   1. `src/pure/**` **零依赖**：只能 import 同层 `./x.ts`；且 `languageOptions.globals = {}` +
 *      `no-undef: error` —— 一个全局都不给。
 *      ★ 这条是删掉 `legacy/check-sandbox.js` 的**直接替代**（静态抓自由变量/未声明标识符）。
 *        实锤：`src/pure/finalgdd.ts` 的 `dateOf` 就是这一类的真缺陷，本票修的就是它。
 *   2. `src/load/**` 只许 import `./`（同层）、`../pure/`、`../port/`。
 *   3. `src/actions/**` 同 load：只许 `./`、`../pure/`、`../port/`（指令层不许反向依赖 load/ui）。
 *   4. `src/ui/**`（规格里已定名，尚未拆分出来）：只许 `./` + `pure|port|load|actions` + React。
 *   5. `src/client.js`（浏览器半侧的**组合根**，工单 03 后续票才把它接回 pure/ 层）：允许摸
 *      remote / window / require（它就是组合根），但**开 `no-undef`** —— 它是今天真正在跑的源码。
 *
 * ── 怎么表达"只许 import 这几个" ─────────────────────────────────────────────
 *   `no-restricted-imports` 负责**点名的禁令**（React / 平台基座 / node 内置 / 反向跨层边）；
 *   `no-restricted-syntax` 里的 `ImportDeclaration:not([source.value=/…/])` 负责**白名单方向**
 *   （"只能 import 这几个"）。用白名单而不是黑名单，是因为黑名单总会漏掉下一个新层。
 *   ★ 正则里用 `[\x2f]` 代替 `/`：esquery 的 selector 正则字面量会在**第一个裸 `/`** 处收尾，
 *     写成 `\/` 也不行（实测 ESLint 9.39 会把转义斜杠当终止符）。
 *   ★ `no-restricted-imports` 的 `patterns.group` **不支持 `!` 取反**（实测 9.39.5：`["*", "!./*"]`
 *     会把 `./x.ts` 也判违规），所以不做成 group 白名单。
 *
 * ── 这张网**不管什么**（如实声明，别当全覆盖）────────────────────────────────
 *   · 不渲染 React 组件（没有渲染测试框架）⇒ **渲染期**的 ReferenceError / hooks 违规抓不到；
 *     真正的"白屏"防线是 `npm run build` + `npm run smoke`（在假 ModuleLoader 里真跑 apply 与 slot 生成器）。
 *   · 不做类型检查（本仓库没装 typescript）。`tsc --noEmit` 是更彻底的替代，留给后续票。
 *   · `legacy/**` 是历史归档，不 lint（唯一活用途是回查迁移前的实现）。
 */

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/** 平台基座模块（浏览器外壳播种的冻结模块表）—— 只有 ui 层与组合根才许碰。 */
const REACT_FAMILY = ["react", "react/*", "react-dom", "react-dom/*", "react/jsx-runtime"];
const DSH_PLATFORM = ["@deepseek-ai/*"];

/** 反向跨层边（`pure ← load ← actions ← ui`，从 X 层往回 import 上层即违规）。 */
const reverseEdges = (layers) => layers.flatMap((l) => [`../${l}/*`, `../${l}/**`]);

/**
 * 白名单式"只能 import 这些"：`ImportDeclaration` 的 source 不匹配 → 报错。
 * @param {string} allow - 不含裸 `/` 的正则源（用 `[\x2f]` 代表斜杠）
 */
const onlyImports = (allow, message) => ({
	selector: `ImportDeclaration:not([source.value=/${allow}/])`,
	message,
});

const PURE_ALLOW = "^\\.[\\x2f]"; // 只许 ./x.ts
const SIBLING_ALLOW = "^(\\.[\\x2f]|\\.\\.[\\x2f](pure|port)[\\x2f])"; // ./ 或 ../pure|port/
const UI_ALLOW = "^(\\.[\\x2f]|\\.\\.[\\x2f](pure|port|load|actions)[\\x2f]|react|react-dom|@deepseek-ai[\\x2f])";

const PURE_MSG = "pure 层零依赖：只能 import 同层的 `./x.ts`（不许 React / ctx / node 内置 / 其他层）";
const LOAD_MSG = "load 层只吃 port：只能 import `./`（同层）、`../pure/`、`../port/`";
const ACTIONS_MSG = "actions 层只发指令：只能 import `./`（同层）、`../pure/`、`../port/`";
const UI_MSG = "ui 层只吃 props：只能 import `./`（同层）、`../pure|port|load|actions/` 与 react 基座";

export default tseslint.config(
	{
		name: "sr-workbench/ignores",
		ignores: ["lib/**", "node_modules/**", "legacy/**", "docs/**"],
	},

	// ── 基线：所有被 lint 的文件都走同一个解析器 ─────────────────────────────
	{
		name: "sr-workbench/base",
		files: ["**/*.{js,mjs,cjs,ts,tsx}"],
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: "module",
			parser: tseslint.parser,
			parserOptions: { ecmaFeatures: { jsx: true } },
		},
		plugins: { "@typescript-eslint": tseslint.plugin },
		rules: {
			// "能解析"（= 语法能过）是最低要求 —— `legacy/syntax-check.js` 的第一段工作由它接管。
			"no-unreachable": "error",
			"no-dupe-keys": "error",
			"no-dupe-args": "error",
			"no-cond-assign": "error",
			"no-constant-condition": ["error", { checkLoops: false }],
			"no-fallthrough": "error",
			"no-sparse-arrays": "error",
			"no-unsafe-negation": "error",
			"valid-typeof": "error",
			"no-debugger": "error",
			"@typescript-eslint/no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_", caughtErrors: "none" }],
		},
	},

	// ── ① pure 层：零依赖 + 一个全局都不给 ──────────────────────────────────
	{
		name: "sr-workbench/pure",
		files: ["src/pure/**/*.{ts,tsx}"],
		languageOptions: {
			// ★ 关键：**空 globals**。ES 内置对象由 ecmaVersion 提供，不靠 globals 表。
			globals: {},
		},
		rules: {
			// ★ ADR 0001 删掉 check-sandbox.js 之后，"未声明标识符"的替代网
			"no-undef": "error",
			"no-restricted-imports": [
				"error",
				{
					paths: [
						...REACT_FAMILY.map((n) => ({ name: n, message: "pure 层不许碰 React（组件属于 ui 层）" })),
						...DSH_PLATFORM.map((n) => ({ name: n, message: "pure 层不许碰平台基座" })),
					],
					patterns: [
						{ group: reverseEdges(["pure", "port", "load", "actions", "ui", "host"]), message: PURE_MSG },
						{ group: ["node:*"], message: "pure 层不许用 node 内置" },
					],
				},
			],
			"no-restricted-globals": [
				"error",
				{ name: "window", message: "pure 层不许碰 window" },
				{ name: "document", message: "pure 层不许碰 document" },
				{ name: "ctx", message: "pure 层不许碰 cordis ctx" },
				{ name: "require", message: "pure 层不许 require" },
				{ name: "module", message: "pure 层不许碰 module" },
				{ name: "process", message: "pure 层不许碰 process" },
				{ name: "globalThis", message: "pure 层不许碰 globalThis" },
				{ name: "fetch", message: "pure 层不许发请求" },
				{ name: "localStorage", message: "pure 层不许碰 localStorage" },
			],
			"no-restricted-syntax": ["error", onlyImports(PURE_ALLOW, PURE_MSG)],
		},
	},

	// ── ② port 层：可以吃 node 内置，但不许反向依赖任何层、不许 React ─────────
	{
		name: "sr-workbench/port",
		files: ["src/port/**/*.{ts,tsx}"],
		languageOptions: { globals: { ...globals.node } },
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						...REACT_FAMILY.map((n) => ({ name: n, message: "port 层不许碰 React" })),
						...DSH_PLATFORM.map((n) => ({ name: n, message: "port 层不许直接 import 平台基座" })),
					],
					patterns: [
						{ group: reverseEdges(["pure", "load", "actions", "ui", "host"]), message: "port 是接缝本身，不许依赖上层" },
					],
				},
			],
			"no-undef": "error",
		},
	},

	// ── ③ load 层：只许 pure / port / 同层 ──────────────────────────────────
	{
		name: "sr-workbench/load",
		files: ["src/load/**/*.{ts,tsx}"],
		languageOptions: { globals: { ...globals.node } },
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						...REACT_FAMILY.map((n) => ({ name: n, message: "load 层不许碰 React" })),
						...DSH_PLATFORM.map((n) => ({ name: n, message: "load 层不许碰平台基座" })),
					],
					patterns: [
						{ group: reverseEdges(["load", "actions", "ui", "host"]), message: LOAD_MSG },
						{ group: ["node:*"], message: "load 层只吃 port：不直接碰 node 内置" },
					],
				},
			],
			"no-restricted-syntax": ["error", onlyImports(SIBLING_ALLOW, LOAD_MSG)],
			// load 层同样开 no-undef（同一类"自由变量"缺陷 —— 与 pure 层同一个理由）
			"no-undef": "error",
		},
	},

	// ── ④ actions 层：只许 pure / port / 同层 ───────────────────────────────
	{
		name: "sr-workbench/actions",
		files: ["src/actions/**/*.{ts,tsx}"],
		languageOptions: { globals: { ...globals.node } },
		rules: {
			"no-restricted-imports": [
				"error",
				{
					paths: [
						...REACT_FAMILY.map((n) => ({ name: n, message: "actions 层不许碰 React" })),
						...DSH_PLATFORM.map((n) => ({ name: n, message: "actions 层不许碰平台基座" })),
					],
					patterns: [
						{ group: reverseEdges(["actions", "ui", "host"]), message: ACTIONS_MSG },
						{ group: ["node:*"], message: "actions 层只发指令：不直接碰 node 内置" },
					],
				},
			],
			"no-restricted-syntax": ["error", onlyImports(SIBLING_ALLOW, ACTIONS_MSG)],
			"no-undef": "error",
		},
	},

	// ── ⑤ ui 层（规格里已定名，尚未拆分出来）：这里才允许 React ──────────────
	{
		name: "sr-workbench/ui",
		files: ["src/ui/**/*.{ts,tsx}"],
		languageOptions: { globals: { ...globals.browser } },
		rules: {
			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{ group: reverseEdges(["ui", "host"]), message: UI_MSG },
						{ group: ["node:*"], message: "ui 层不许碰 node 内置" },
					],
				},
			],
			"no-restricted-syntax": ["error", onlyImports(UI_ALLOW, UI_MSG)],
		},
	},

	// ── ⑥ 组合根 src/client.js：浏览器半侧，允许摸 remote / window / require ──
	{
		name: "sr-workbench/client-root",
		files: ["src/client.js"],
		languageOptions: {
			globals: { ...globals.browser, require: "readonly", module: "writable", process: "readonly" },
		},
		rules: {
			// 先套 js 推荐集，再用本仓库的口径覆盖（顺序要紧：后写的赢）
			...js.configs.recommended.rules,
			// ★ 组合根也开 no-undef：它就是今天真正在跑的产物源，引用未声明的名字 = 白屏。
			//   （当年 check-sandbox.js 抓的就是这一类；这里在静态阶段抓，不依赖"能不能渲染"。）
			"no-undef": "error",
			"no-restricted-imports": "off",
			"no-irregular-whitespace": ["error", { skipComments: true }],
			// 手写的组合根里"未被调用的保留分支"是常态，不当错误；未使用变量见 base（warn）。
			"no-unused-vars": "off",
			"no-empty": "off",
			"no-useless-escape": "off",
			"no-cond-assign": "off",
			"no-unreachable": "error",
		},
	},

	// ── ⑦ 测试与工具：不受分层约束（测试要能 import 任意层） ─────────────────
	{
		name: "sr-workbench/test-tools",
		files: ["test/**/*.{ts,tsx,js,mjs}", "tools/**/*.{js,mjs,cjs}", "eslint.config.js", "tsdown.config.ts"],
		languageOptions: { globals: { ...globals.node } },
		rules: {
			"no-restricted-imports": "off",
			"no-undef": "error",
			"no-irregular-whitespace": ["error", { skipComments: true }],
		},
	},

	// ── ⑧ 宿主半侧 src/index.js：node ESM，只有它没有"层"的约束 ─────────────
	{
		name: "sr-workbench/host-root",
		files: ["src/index.js"],
		languageOptions: { globals: { ...globals.node } },
		rules: { "no-undef": "error" },
	},

	// ── ⑨ 生成物 src/generated/**：构建期产出、入库、**不许手改**（改了就 `npm run gen:skills`）──
	{
		name: "sr-workbench/generated",
		// 只留一条网：万一有人手改出一个自由变量，这里能抓到；格式/风格不管（它由生成器决定）。
		files: ["src/generated/**/*.{ts,js}"],
		rules: { "no-undef": "error" },
	},
);
