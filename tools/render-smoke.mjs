/**
 * 渲染冒烟：在**假 React** 里把面板真正跑起来一遍。
 *
 * ── 为什么要有这个脚本（它补的是 `build:safe` 补不上的那一格）────────────────
 * `smoke-client.mjs` 证明的是"能加载、形状对、注册调用对"——它的 React 是桩，**组件根本不渲染**。
 * 于是渲染期的崩（读一个 undefined 的属性、把对象直接塞进 children、条件分支走错）
 * **完全没有网**，而它的后果正是用户看到的那种"面板一片红/一片白"。
 *
 * 本脚本用一个**够用的迷你 React**（createElement + 按组件名喂状态的 useState + useMemo /
 * useCallback / useRef + 类组件 + 一次性递归执行整棵树）把组件树真的跑一遍，
 * 并断言屏幕上真出现了该出现的东西。
 *
 * ── 它测什么 / 不测什么（如实声明）────────────────────────────────────────────
 *   测：组件函数体内的每一行（属性访问、字符串拼接、条件分支）在**给定 props / state 下**跑得通；
 *       渲染出来的文本里有该有的字；整棵树里**没有把对象塞进 children**。
 *   不测：状态更新后的重渲染（`setState` 是空转的）、副作用（`useEffect` 不跑）——
 *       也就是"点一下按钮之后会怎样"不在这里。事件处理器体内的逻辑靠各自的纯函数用例。
 *
 * 跑法：`node tools/render-smoke.mjs`（默认跑 `lib/client.js`）
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const target = process.argv[2] ? path.resolve(process.argv[2]) : path.join(REPO, "lib", "client.js");

// ════════════════════════════════════════════════════════════════════════════
// 迷你 React
// ════════════════════════════════════════════════════════════════════════════

/** 按**组件名**喂状态：`{ Panel: [v0, v1, …], FeatureView: [...] }`；没喂就用 useState 的初始值。 */
let scripts = {};
let curName = "";
let curIdx = 0;

function createElement(type, props, ...children) {
	const p = Object.assign({}, props || {});
	if (children.length === 1) p.children = children[0];
	else if (children.length > 1) p.children = children;
	else if (!("children" in p)) p.children = undefined;
	return { $$kind: "element", type, props: p };
}

class Component {
	constructor(props) { this.props = props || {}; this.state = {}; }
	setState(next) {
		const patch = typeof next === "function" ? next(this.state) : next;
		this.state = Object.assign({}, this.state, patch);
	}
	render() { return this.props.children; }
}

const React = {
	createElement,
	cloneElement: (el, extra) => createElement(el.type, Object.assign({}, el.props, extra)),
	isValidElement: (v) => !!(v && v.$$kind === "element"),
	Children: {
		map: (c, f) => (Array.isArray(c) ? c.map((x, i) => f(x, i)) : c === undefined || c === null ? [] : [f(c, 0)]),
		toArray: (c) => (Array.isArray(c) ? c : c === undefined || c === null ? [] : [c])
	},
	createContext: (v) => ({ Provider: (p) => p.children, Consumer: () => null, _currentValue: v }),
	createRef: () => ({ current: null }),
	forwardRef: (f) => f,
	memo: (f) => f,
	lazy: (f) => f,
	Fragment: Symbol("Fragment"),
	StrictMode: Symbol("StrictMode"),
	Suspense: Symbol("Suspense"),
	Component,
	PureComponent: Component,
	startTransition: (f) => f(),
	useState(init) {
		const arr = scripts[curName];
		const v = arr && curIdx < arr.length ? arr[curIdx] : (typeof init === "function" ? init() : init);
		curIdx++;
		return [v, () => { /* 一次性渲染：setter 空转 */ }];
	},
	useReducer: (r, init) => [init, () => {}],
	useEffect() { /* 副作用要真事件循环，这里不跑 */ },
	useLayoutEffect() {},
	useInsertionEffect() {},
	useMemo(f) { return f(); },
	useCallback(f) { return f; },
	useRef(v) { return { current: v }; },
	useContext(c) { return c ? c._currentValue : undefined; },
	useImperativeHandle() {},
	useId: () => "id",
	useTransition: () => [false, (f) => f()],
	useDeferredValue: (v) => v,
	useSyncExternalStore: (_s, get) => get()
};

/** 一次性递归执行整棵树 → 文本。函数组件按组件名重置 hook 游标。 */
function renderToText(node, out = [], depth = 0) {
	if (depth > 60) throw new Error("渲染深度超过 60 层（多半是自引用）");
	if (node === null || node === undefined || node === false || node === true) return out;
	if (typeof node === "string" || typeof node === "number") { out.push(String(node)); return out; }
	if (Array.isArray(node)) { for (const n of node) renderToText(n, out, depth + 1); return out; }
	if (typeof node !== "object" || node.$$kind !== "element") {
		throw new Error("children 里出现了非元素对象（多半是忘了取值）：" + JSON.stringify(node).slice(0, 200));
	}
	let { type, props } = node;
	/**
	 * ★ 官方的 \`Button\` 是 \`forwardRef(...)\` 的结果、\`MarkdownText\` 是 \`memo(...)\` 的结果 ——
	 *   它们都是**对象**（\`{ $typeof: Symbol(react.forward_ref), render }\`），不是函数。
	 *   这里按 React 的真实形状解一层，免得"桩写成函数"把真机上的形状问题藏过去（真踩过）。
	 */
	if (type !== null && typeof type === "object" && typeof type.$$typeof === "symbol") {
		type = type.render || type.type;
	}
	if (typeof type === "function") {
		if (type.prototype && typeof type.prototype.render === "function") {
			return renderToText(new type(props).render(), out, depth + 1);
		}
		const prev = curName;
		curName = type.name || "anon";
		curIdx = 0;
		const rendered = type(props);
		curName = prev;
		return renderToText(rendered, out, depth + 1);
	}
	if (props && props.children !== undefined) renderToText(props.children, out, depth + 1);
	return out;
}

// ════════════════════════════════════════════════════════════════════════════
// 载入 bundle（与 smoke-client.mjs 同一条接缝）
// ════════════════════════════════════════════════════════════════════════════

const src = fs.readFileSync(target, "utf8");
const registrations = [];
const sandbox = {
	window: { __ModuleLoader__: { load: (r) => registrations.push(r) }, location: { origin: "http://127.0.0.1:3080" } },
	console, Symbol, Object, Array, String, Number, Boolean, Date, Math, JSON, Map, Set, WeakMap, WeakSet,
	Promise, RegExp, Error, TypeError, RangeError, URL, URLSearchParams, TextEncoder, TextDecoder,
	setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
new vm.Script(src, { filename: target }).runInContext(sandbox, { timeout: 8000 });
if (registrations.length !== 1) throw new Error("bundle 没有注册 __ModuleLoader__ 条目");

/**
 * 假 primitives **桩**：只实现我们真会用的那几个，并给官方组件加一个可断言的类名标记。
 * 真机上是宿主模块表里那份（`require("@deepseek-ai/dsh-client-ui-primitives")`）；
 * 这里只证明"拿到它时面板走官方那条路"。
 */
function primitivesStub() {
	const MARK = "⟨官方按钮⟩";
	// ★ 形状照真件：Button 是 forwardRef 的**对象**，MarkdownText 是 memo 的**对象**，
	//   Tag 是普通函数 —— 三种形状都要能被面板的类型判据接受（这条判据写错过一次）。
	const fwd = (render) => ({ $$typeof: Symbol.for("react.forward_ref"), render: render });
	const memo = (render) => ({ $$typeof: Symbol.for("react.memo"), type: render, compare: null });
	const ico = (props) => createElement("svg", null, "⟨图标" + (props && props.size ? props.size : "") + "⟩");
	return {
		Button: fwd((props) => { (globalThis.__btnProps = globalThis.__btnProps || []).push(props); return createElement("button", { disabled: props.disabled }, MARK, props.icon || null, props.children); }),
		IconRefreshOutlineRegular: ico,
		IconPlusOutlineRegular: ico,
		Tag: (props) => createElement("span", null, props.children),
		MarkdownText: memo((props) => createElement("div", null, props.text)),
		SegmentedTabs: fwd((props) => createElement("div", null, (props.items || []).map((i) => i.label).join(" ")))
	};
}
const WITH_PRIM = process.env.SR_WB_PRIM === "1";
const mod = registrations[0].factory((id) => {
	if (id === "react") return React;
	if (id === "react/jsx-runtime") return { jsx: createElement, jsxs: createElement, Fragment: Symbol("Fragment") };
	if (id === "@deepseek-ai/dsh-client-ui-primitives") {
		if (WITH_PRIM) return primitivesStub();
		// 默认这条：模拟"宿主没给这个包"，逼面板走自绘回退
		throw new Error("模块表里没有 @deepseek-ai/dsh-client-ui-primitives（render-smoke 默认臂）");
	}
	throw new Error("render-smoke 里没预期的 require：" + id);
});

// ════════════════════════════════════════════════════════════════════════════
// 假 ctx：跑完 apply，把 main 槽的组件取出来
// ════════════════════════════════════════════════════════════════════════════

const injectCalls = [];
const registered = [];
const ctx = {
	slots: {
		inject: (name, fn) => { injectCalls.push({ name, fn }); return { dispose() {} }; },
		register: (options, component) => { registered.push({ options, component }); return { dispose() {} }; }
	},
	get: () => undefined,
	effect: (fn) => { if (typeof fn === "function") fn(); },
	on() {},
	remote: {},
	logger: { info() {}, warn() {}, error() {}, debug() {} }
};
mod.apply(ctx, {});
for (const call of injectCalls) {
	if (typeof call.fn === "function") for (const _ of call.fn()) { /* register 的副作用已记在 registered 里 */ }
}

const mainEntry = registered.filter((r) => r.options && r.options.name === "main")[0];
const sideEntry = registered.filter((r) => r.options && r.options.name === "sidebar.panellist")[0];
if (!mainEntry || typeof mainEntry.component !== "function") throw new Error("apply 没有注册 main 槽（或不是函数组件）");

/** 面板会从 slot props 里拿到的那两个 hook + 打开文件的回调。 */
const slotProps = {
	useSessions: (sel) => sel({ ids: [], byId: {} }),
	useWorkspaces: (sel) => sel({ items: [] }),
	openFile: undefined
};

// ════════════════════════════════════════════════════════════════════════════
// 三遍渲染
// ════════════════════════════════════════════════════════════════════════════

const results = [];
function pass(name, script, mustHave) {
	scripts = script;
	const text = renderToText(mainEntry.component(slotProps)).join(" ");
	const missing = mustHave.filter((s) => !text.includes(s));
	results.push({ pass: name, chars: text.length, missing });
	if (missing.length) {
		console.error("✗ [" + name + "] 渲染出来的字里缺：" + JSON.stringify(missing));
		console.error("  实际前 600 字：" + text.slice(0, 600));
	}
	// `SR_WB_DUMP=1 node tools/render-smoke.mjs` —— 把每一遍渲染的**全文**打出来（人工看措辞/排版用）
	if (process.env.SR_WB_DUMP) console.error("\n─── " + name + " ───\n" + text.replace(/ (?=[^\x00-\x7f])/g, "\n"));
	return text;
}

// ── ① 初始帧：还没解析出锚点（面板的第一帧）──────────────────────────────
pass("初始帧", {}, ["正在解析工作台锚点"]);

// ── ② 卡片墙 ────────────────────────────────────────────────────────────
const INDEX = { ok: true, sid: "s1", root: "D:\\X", srWs: "D:\\X", configFile: "D:\\X\\cfg.json", source: "cache", note: [] };
const DASH = {
	features: [
		{
			topic: "联盟讨伐", root: "D:\\X\\features\\联盟讨伐",
			counts: { brainstorm: 3, draft: 1, final: 2, speech: 1, decisions: 2, evidence: 1, other: 1 },
			lastDecisionAt: "2026-10-08 16:02:11", latestDate: "20260924", stage: "final",
			line: "已定稿 · 可以交程序", tone: "ok", missing: []
		},
		{
			topic: "空功能", root: "D:\\X\\features\\空功能",
			counts: { brainstorm: 0, draft: 0, final: 0, speech: 0, decisions: 0, evidence: 0, other: 0 },
			lastDecisionAt: "", latestDate: "", stage: "empty",
			line: "桶没建全：缺 decisions —— 补建这几个目录，或删掉这个功能目录重建", tone: "warn", missing: ["decisions"]
		}
	],
	counts: { features: 2 }
};
pass("卡片墙", {
	Panel: [INDEX, "idle", null, DASH, null, { kind: "cards" }, null, 0, false, false, "", false, null]
}, [
	"策划工作台", "功能 2",
	// 阶段步进器的文案（"头脑 3" 而不是 "头脑风暴 3"）+ 相对时间（形状由下面那条正则钉）
	"联盟讨伐", "已定稿", "头脑 3", "成稿 1", "定稿 2", "宣讲 1", "决策 2", "最近决策",
	"空功能", "缺桶", "桶没建全", "还没有决策"
]);

// ── ③ 功能详情：三块数据都用**真实工作区**喂进去 ──────────────────────────
async function realDetail() {
	try {
		const { loadFeatureDetail } = await import("../src/load/feature.ts");
		const { createFsPort } = await import("../src/port/fs.ts");
		const ws = process.env.SR_WB_WORKSPACE || "D:\\TimeMachine\\GameDesignOS\\workspace";
		const topics = fs.readdirSync(path.join(ws, "features"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
		if (!topics.length) return null;
		const root = path.join(ws, "features", topics[0]);
		return { topic: topics[0], detail: await loadFeatureDetail(createFsPort({ roots: [path.resolve(ws, "..", "..")] }), { root: root }) };
	} catch (e) {
		console.error("（真数据不可用，改用合成数据：" + String((e && e.message) || e) + "）");
		return null;
	}
}
const real = await realDetail();

// ★ 反面：决策记录里**不许出现 content-visibility 的占位空隙**（加过，用户实测能看到一大块空白）
const bundleSrc = fs.readFileSync(path.join("lib", "client.js"), "utf8");
if (/contentVisibility/.test(bundleSrc)) {
	console.error("✗ 产物里还有 contentVisibility —— 它会在条目中间留占位空隙，用户实测过");
	process.exit(1);
}

if (real) {
	// 真数据那两遍**只断言"渲染得出来、该在的字在"** —— 真数据里有什么内容是数据的事，
	// 不是这一层的判据（本仓库的测试纪律：条数不写死）。
	const realPanel = [INDEX, "idle", null, DASH, null, { kind: "feature", topic: real.topic }, real.detail, 0, false, false, "", false, null];
	pass("详情 · 真数据（" + real.topic + "）· 头脑风暴", { Panel: realPanel }, [
		real.topic, "头脑风暴", "决策记录", "最终产物",
		// ★ 「已有的分析结论」这个**标题**已按用户口径删掉（2026-10-09）—— 列表本体还在，断言改盯列表
	"四个入口", "竞品分析", "问答式访谈", "旧文档分析", "人工补充"
	]);
	// ★ 「这个功能的 4 个桶」整块已去掉；这里只该有五组产物（组头带桶名小字）
	//   搬完位置后：变更集与验收报告在 gdd\ 那一类里（这两条断言就是搬迁的实测证据）
	pass("详情 · 真数据（" + real.topic + "）· 最终产物", { Panel: realPanel, FeatureView: ["outputs"] }, [
		"最终产物", "头脑风暴的产物", "成稿", "定稿", "HTML 宣讲稿", "配置表", "analysis\\", "gdd\\",
		"CS-20261009-001.yaml", "CS-20261009-001_读回验收报告.md"
	]);
}

// ── ③' 配置向导：这台机器还没配好时，卡片墙位置必须出现向导 ────────────────
const WIZ_IDX = Object.assign({}, INDEX, { needConfig: true, cfgObj: { sr_workspace: "", sr_project: "" }, triedPaths: ["D:\\X\\.dsh\\sr-workbench\\config.local.json"], configFile: "" });
pass("配置向导（无配置）", { Panel: [WIZ_IDX, "idle", null, DASH, { values: {}, roots: [], triedPaths: ["D:\\X\\.dsh\\sr-workbench\\config.local.json"], saving: false }, { kind: "cards" }, null, 0, false, false, "", false, null] }, [
	"先配一下本机路径", "策划工作区", "Unity 工程", "策划配置目录", "GTGenerator 工作目录",
	"必填", "选择…", "保存并验证", "在会话里问答配置（/sr-askme）", "面板找过哪些路径",
	"%USERPROFILE%"
]);


// ── ④ 功能详情：合成数据（把每一条分支都走到）────────────────────────────
const TOPIC = "联盟讨伐";
const ROOT = "D:\\X\\features\\" + TOPIC;
const DETAIL = {
	root: ROOT, topic: TOPIC, missing: [], strangerDirs: ["source"], rootFiles: ["feature.json"],
	buckets: [
		{ key: "evidence", label: "证据", meaning: "原始件 + 过程证据", files: 1, subdirs: 0, absent: false },
		{ key: "analysis", label: "头脑风暴", meaning: "头脑风暴的内容", files: 1, subdirs: 0, absent: false },
		{ key: "gdd", label: "设计正文", meaning: "设计正文与交付物", files: 2, subdirs: 1, absent: false },
		{ key: "decisions", label: "决策记录", meaning: "决策记录", files: 1, subdirs: 0, absent: true }
	],
	brainstorm: {
		root: ROOT,
		groups: {
			entries: [
				{ id: "analysis", label: "竞品分析", count: 1, files: [{ name: "experience-report_x_20260915.md", rel: "analysis/experience-report_x_20260915.md", subdir: "" }] },
				{ id: "concept", label: "问答式访谈", count: 0, files: [] },
				{ id: "legacy", label: "旧文档分析", count: 0, files: [] },
				{ id: "humannote", label: "人工补充", count: 0, files: [] }
			],
			other: [{ name: "认不出来的.bin", rel: "analysis/认不出来的.bin", subdir: "" }],
			counts: { analysis: 1, other: 1 }, total: 2
		},
		legacy: [{ rel: "analysis/legacy-analysis_x_20260930.md", name: "legacy-analysis_x_20260930.md", missing: ["可复用条目"], extra: [{ title: "多出来的一节" }] }],
		humannote: [{ rel: "analysis/human-note_x_20260930.md", name: "human-note_x_20260930.md", quote: { raw: "> 原话：「血条全盟共享」", text: "「血条全盟共享」", found: true }, missing: [] }],
		unreadable: [{ name: "读不动的.md", why: "读不到正文" }],
		notes: ["顺带一句提示"]
	},
	decisions: {
		rel: "decisions/决策记录.md", abs: "D:\\X\\features\\" + TOPIC + "\\decisions\\决策记录.md", readError: "",
		log: {
			present: true, title: "决策记录 · " + TOPIC, preamble: "前言一段", text: "# 决策记录\n",
			issues: ["第 9 行的标题「备注」没有时间戳 —— 已并入上一条（第 5 行）。"],
			entries: [
				{ index: 1, at: "2026-10-08 14:23:05", title: "", line: 3, body: "**决策**：采用方案 A。\n**依据**：访谈里三个人都提到同一件事。\n**影响**：§4 R2 要改。\n- 附带一条列表项\n普通段落" },
				{ index: 2, at: "2026-10-08 16:02:11", title: "定稿门", line: 9, body: "**决策**：定稿通过。" }
			]
		}
	},
	outputs: {
		total: 6, allPaths: [],
		counts: { brainstorm: 1, draft: 1, final: 1, speech: 1, config: 1, other: 1 },
		groups: [
			{ key: "brainstorm", label: "头脑风暴的产物", note: "analysis\\ 里的全部内容", dynamic: "", dir: "analysis", count: 1, files: [{ name: "experience-report_x_20260915.md", rel: "analysis/experience-report_x_20260915.md", dir: "analysis", subdir: "", group: "brainstorm", kindLabel: "", note: "" }] },
			{ key: "draft", label: "成稿", note: "gdd\\<主题>_<日期>.md", dynamic: "", dir: "gdd", count: 1, files: [{ name: "联盟讨伐_20260918.md", rel: "gdd/联盟讨伐_20260918.md", dir: "gdd", subdir: "", group: "draft", kindLabel: "", note: "" }] },
			{ key: "final", label: "定稿", note: "gdd\\*_定稿.md", dynamic: "现有 2 份，按文件名日期标最新的一份", dir: "gdd", count: 1, files: [{ name: "联盟讨伐_20260923_定稿.md", rel: "gdd/联盟讨伐_20260923_定稿.md", dir: "gdd", subdir: "", group: "final", kindLabel: "", note: "最新定稿" }] },
			{ key: "speech", label: "HTML 宣讲稿", note: "gdd\\*_宣讲_<日期>.html", dynamic: "", dir: "gdd", count: 1, files: [{ name: "联盟讨伐_宣讲_20260924.html", rel: "gdd/联盟讨伐_宣讲_20260924.html", dir: "gdd", subdir: "", group: "speech", kindLabel: "", note: "" }] },
			// ★ 新分类：配置表（表本体 + change set 都能落进来）
			{ key: "config", label: "配置表", note: "配置这条线的交付物", dynamic: "", dir: "gdd · analysis", count: 2, files: [
				{ name: "联盟讨伐_配置表_20261009.xlsx", rel: "gdd/联盟讨伐_配置表_20261009.xlsx", dir: "gdd", subdir: "", group: "config", kindLabel: "", note: "" },
				{ name: "CS-20261009-001.yaml", rel: "analysis/CS-20261009-001.yaml", dir: "analysis", subdir: "", group: "config", kindLabel: "", note: "" }
			] },
			{ key: "other", label: "其它（不属上面五类）", note: "审查 / 修订点 / 定稿 HTML 派生件 —— 如实列出，不丢", dynamic: "", dir: "", count: 1, files: [{ name: "联盟讨伐_20260921_定稿_审查.md", rel: "gdd/联盟讨伐_20260921_定稿_审查.md", dir: "gdd", subdir: "", group: "other", kindLabel: "审查", note: "" }] }
		]
	},
	counts: { brainstorm: 1, draft: 1, final: 1, speech: 1, config: 2, other: 1, evidence: 1, decisions: 2, total: 6 }
};

const featureScript = {
	Panel: [INDEX, "idle", null, DASH, null, { kind: "feature", topic: TOPIC }, DETAIL, 0, false, false, "", false, null]
};

pass("详情 · 三块都在（合成）", featureScript, [
	TOPIC, "头脑风暴（2）", "决策记录（2）", "最终产物（6）",
	"四个入口", "竞品分析", "问答式访谈", "旧文档分析", "人工补充",
	"其他 / 来源未知（1）", "固定格式的两类产物", "原话：「血条全盟共享」", "读不动的文件",
	"顺带一句提示"
]);

pass("详情 · 决策记录（合成）", Object.assign({}, featureScript, { FeatureView: ["decisions"] }), [
	"这个功能的所有决策都记在同一个文件里", "共 2 条", "最近一条 2026-10-08 16:02:11",
	// ★ 有真实条目时**不再**显示「条目格式」模板（用户口径：不额外占位置）
	"全部决策", "2026-10-08 14:23:05", "第 1 条", "采用方案 A", "§4 R2 要改", "附带一条列表项",
	"2026-10-08 16:02:11", "定稿门", "没有时间戳"
]);

const outText = pass("详情 · 最终产物（合成）", Object.assign({}, featureScript, { FeatureView: ["outputs"] }), [
	"最终产物", "头脑风暴的产物", "成稿", "定稿", "HTML 宣讲稿", "最新定稿", "现有 2 份",
	"其它（不属上面四类）",
	"不是 4 个桶的目录（如实列出）：source", "功能根下的散文件：feature.json"
]);
// 反面：那一整块不该再出现
for (const gone of ["这个功能的 4 个桶", "只有四类", "evidence\\", "decisions\\"]) {
	if (outText.includes(gone)) { results.push({ pass: "最终产物 · 不该有", missing: [gone] }); console.error("✗ [最终产物] 还有该去掉的：" + gone); }
}

// 折叠区**默认是收起的**（收起时里面的字根本不渲染）——把 Fold 强制展开，走一遍展开分支
pass("详情 · 最终产物（展开「其它」）", Object.assign({}, featureScript, { FeatureView: ["outputs"], Fold: [true] }), [
	"其它（不属上面四类）", "审查", "联盟讨伐_20260921_定稿_审查.md"
]);

// ── ④' 决策记录：有真实条目时**不该**出现「条目格式」模板 ──────────────
const decisionText = pass("决策记录 · 无模板（合成）", Object.assign({}, featureScript, { FeatureView: ["decisions"] }), ["全部决策", "采用方案 A"]);
if (decisionText.includes("条目格式")) { results.push({ pass: "决策记录 · 无模板", missing: ["（不该有）条目格式"] }); console.error("✗ [决策记录] 有真实条目时还在显示「条目格式」模板"); }
// 没有条目时**要**出现（那是唯一需要它的场合）
const emptyLog = Object.assign({}, DETAIL, { decisions: { rel: "decisions/决策记录.md", abs: "D:\\X\\decisions\\决策记录.md", readError: "", log: { present: false, entries: [], issues: [], preamble: "", title: "", text: "" } } });
pass("决策记录 · 空文件要有模板（合成）", Object.assign({}, featureScript, { Panel: [INDEX, "idle", null, DASH, null, { kind: "feature", topic: TOPIC }, emptyLog, 0, false, false, "", false, null], FeatureView: ["decisions"] }), ["条目格式", "还没有决策记录"]);

// ── ⑤ 新建表单（开着、并且已经算好计划）────────────────────────────────
const plan = {
	ok: true, code: "", topic: "新功能", root: "D:\\X\\features\\新功能",
	buckets: ["evidence", "analysis", "gdd", "decisions"], message: "", next: ""
};
pass("新建功能表单", {
	Panel: [INDEX, "idle", null, DASH, null, { kind: "cards" }, null, 0, false, true, "新功能", false, plan]
}, ["新建功能", "将建立", "D:\\X\\features\\新功能", "evidence\\", "decisions\\"]);


// ════════════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// 两条路都要有网：官方组件在场 ⇒ 必须真用上；不在场 ⇒ 必须退回自绘
// ════════════════════════════════════════════════════════════════════════════
// ★ 要用**卡片墙那份 state 脚本**渲染才有按钮（初始帧只有一行「正在解析工作台锚点…」）
scripts = { Panel: [INDEX, "idle", null, DASH, null, { kind: "cards" }, null, 0, false, false, "", false, null] };
const dashboardText = renderToText(mainEntry.component(slotProps)).join(" ");

// ★ 「最近决策」后面必须是**相对时间**（刚刚 / N 分钟前 / N 小时前 / N 天前 / N 个月前 / N 年前）。
//   这条不能写成固定字符串（随当前时间变），所以钉"形状"—— 相对时间由 `pure/reltime.ts` 算（有单测）。
if (!/(最近决策 )(刚刚|\d+ (分钟|小时|天|个月|年)前)/.test(dashboardText)) {
	results.push({ pass: "卡片墙", missing: ["「最近决策」后面不是相对时间"] });
	console.error("✗ [卡片墙] 「最近决策」后面不是相对时间：" + dashboardText.slice(0, 160));
}

// ★ 反向钉子：四个入口卡上那句「没有先后，想走哪条走哪条 —— 指令发给…产出落 analysis\\」已删
if (dashboardText.includes("没有先后，想走哪条走哪条") || dashboardText.includes("产出落 analysis")) {
	results.push({ pass: "卡片墙", missing: ["（四个入口那句说明该删掉）"] });
	console.error("✗ [卡片墙] 四个入口的说明还在");
}

// ★ 反向钉子：那句副标题（「工作台只做三件事…」）已按用户口径删掉，不该再出现。
//   断言盯**渲染出来的字**，不盯源码 —— 源码注释里引用了这句话（说明为什么删），那是另一回事。
if (dashboardText.includes("只做三件事") || dashboardText.includes("不替你拍板")) {
	results.push({ pass: "卡片墙", missing: ["（那句副标题该删掉）"] });
	console.error("✗ [卡片墙] 副标题还在：" + dashboardText.slice(0, 160));
}

if (WITH_PRIM) {
	if (!dashboardText.includes("⟨图标14⟩")) {
		results.push({ pass: "官方组件臂", missing: ["（icon 槽位没用上官方图标）⟨图标14⟩"] });
		console.error("✗ [官方组件臂] 官方图标的 icon 槽位没被用上");
	}
	if (!dashboardText.includes("⟨官方按钮⟩")) {
		results.push({ pass: "官方组件臂", missing: ["（拿了 primitives 却没用官方 Button）⟨官方按钮⟩"] });
		console.error("✗ [官方组件臂] 拿到了 primitives，但渲染里没有官方组件标记");
	}
} else {
	if (dashboardText.includes("⟨官方按钮⟩")) {
		results.push({ pass: "自绘回退臂", missing: ["（没有 primitives 却出现了官方标记）"] });
		console.error("✗ [自绘回退臂] 没有 primitives，却渲染出了官方组件标记");
	}
}

// ★ 钉子：主按钮**必须是蓝填充**、次按钮**必须有看得见的描边**
//   （5.1.2 那次写成 var(--dsw-alias-brand-primary) —— 那支令牌等于宿主内部的主按钮色（近黑），
//     于是"改成蓝色"成了空操作，界面一点没变。断言盯**具体颜色**，不盯令牌名。）
if (WITH_PRIM) {
	const seen = globalThis.__btnProps || [];
	const prim = seen.filter((p) => p.variant === "primary");
	const sec = seen.filter((p) => p.variant === "outline");
	if (prim.length === 0) { results.push({ pass: "按钮配色", missing: ["（没有主按钮）"] }); }
	for (const p of prim) {
		const bg = p.style && p.style.background;
		// 主按钮的填充蓝（曾按"用户要黑色"改过一版，用户随后说明没让改 ⇒ 已撤回）
		if (bg !== "#1a73e8") {
			results.push({ pass: "按钮配色", missing: ["主按钮底色不是蓝：" + String(bg)] });
			console.error("✗ [按钮配色] 主按钮底色 = " + String(bg));
		}
	}
	if (sec.length === 0) results.push({ pass: "按钮配色", missing: ["（没有次按钮）"] });
	for (const p of sec) {
		const bd = p.style && p.style.border;
		if (!bd || !bd.includes("1px")) { results.push({ pass: "按钮配色", missing: ["次按钮没有 1px 描边：" + String(bd)] }); console.error("✗ [按钮配色] 次按钮描边 = " + String(bd)); }
	}
}

const bad = results.filter((r) => r.missing && r.missing.length);
console.log(JSON.stringify({
	file: target, bytes: Buffer.byteLength(src, "utf8"),
	臂: WITH_PRIM ? "官方 primitives（桩）" : "自绘回退（宿主没给包）",
	slots: registered.map((r) => r.options.name + ":" + (r.options.key || r.options.id || "")),
	渲染遍数: results.length,
	每遍字符数: results.map((r) => r.pass + "=" + r.chars),
	数据源: real ? "真实工作区（" + TOPIC + "）" : "合成数据",
	问题: bad
}, null, 2));
if (bad.length) { console.error("\n✗ 渲染冒烟未通过"); process.exit(1); }
console.error("\n✓ 渲染冒烟通过" + (sideEntry ? "（侧边栏入口也在）" : "") + " · " + (WITH_PRIM ? "官方组件臂" : "自绘回退臂"));

// ③ 默认臂跑完，自动用 SR_WB_PRIM=1 再跑一遍自己（两条路都覆盖）
if (!WITH_PRIM) {
	const { spawnSync } = await import("node:child_process");
	const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), target], {
		encoding: "utf8", env: Object.assign({}, process.env, { SR_WB_PRIM: "1" })
	});
	if (r.status !== 0) {
		console.error("\n✗ 官方组件臂失败：\n" + String(r.stdout || "").slice(-800) + String(r.stderr || "").slice(-800));
		process.exit(1);
	}
	console.error("✓ 官方组件臂通过（拿到 primitives 时走官方组件那条路）");
}
