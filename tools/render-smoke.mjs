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

/**
 * 按**组件名**喂状态：`{ Panel: [v0, v1, …] }`；没喂（或喂到一半没了）就用 `useState` 的初值。
 *
 * ★ 8.1.0 起**不再有 `FeatureView: [...]`**：模块名（页签）由 Panel 的 `view.mod` 携带（受控），
 *   所以"切页签"这件事在这里是喂 `Panel` 的第 6 个值（`{ kind: "feature", topic, mod }`）。
 *   给少了还有第二个用处 —— 让 `useState` 走**惰性初值**（视图记忆就是这么被测到的，见 ②'）。
 */
let scripts = {};
let curName = "";
let curIdx = 0;
/**
 * 这一遍渲染里出现过的**宿主标签名**（`table` / `h2` / `strong`…）。
 * ★ 为什么要它：技能用法弹窗的口径是"**按 md 原样渲染**，尤其表格"—— 只断言"屏幕上有那些字"
 *   管不住排版（把 md 当纯文本吐出来，字也全在）。所以这里连**标签**一起收。
 */
let tags = [];

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
	if (typeof type === "string") tags.push(type);   // 宿主元素：记下标签名（断言"真渲染成了 <table>"用）
	if (props && props.children !== undefined) renderToText(props.children, out, depth + 1);
	return out;
}

// ════════════════════════════════════════════════════════════════════════════
// 载入 bundle（与 smoke-client.mjs 同一条接缝）
// ════════════════════════════════════════════════════════════════════════════

/**
 * **假 `localStorage`**：面板的三条缓存（索引会话 / 工作会话 / 视图记忆）都走它。
 *
 * ★ 为什么要有它（8.1.0）：视图记忆（"上次停在哪个功能 / 哪个模块"）是在**组合根**里读写的
 *   （`localStorage.getItem/setItem`），`PanelBound` 会把宿主的实现直接注入给 `Panel` ——
 *   所以从 slot props 那头喂不进去。给沙箱一个真能存取的 `localStorage`，被测的就是
 *   **真机那条路**：`localStorage → panelViewParse → 第一帧的 view`。
 *   `pass()` 每遍开头按脚本里的 `__viewCacheRaw` 预置（相当于"上次停在那儿"）。
 */
const fakeStorage = new Map();
const localStorageStub = {
	getItem: (k) => (fakeStorage.has(String(k)) ? fakeStorage.get(String(k)) : null),
	setItem: (k, v) => { fakeStorage.set(String(k), String(v)); },
	removeItem: (k) => { fakeStorage.delete(String(k)); },
	clear: () => { fakeStorage.clear(); },
	key: (i) => Array.from(fakeStorage.keys())[i] ?? null,
	get length() { return fakeStorage.size; }
};

const src = fs.readFileSync(target, "utf8");
const registrations = [];
const sandbox = {
	window: { __ModuleLoader__: { load: (r) => registrations.push(r) }, location: { origin: "http://127.0.0.1:3080" } },
	localStorage: localStorageStub,
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
		// ★ 官方 markdown 渲染器：**只做形状**（真机上是宿主那份），收到的 props 记下来供断言 ——
		//   面板该把**整份 md 原文**交给它，而不是自己再排版一遍。
		MarkdownText: memo((props) => {
			(globalThis.__mdProps = globalThis.__mdProps || []).push(props);
			return createElement("div", null, "⟨官方 MarkdownText⟩ ", props.text);
		}),
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

/**
 * 面板会从 slot props 里拿到的那两个 hook + 打开文件的回调。
 * （视图记忆**不走这里** —— 它在组合根里读写 `localStorage`，见上面那个假 `localStorage`。）
 */
const slotProps = {
	useSessions: (sel) => sel({ ids: [], byId: {} }),
	useWorkspaces: (sel) => sel({ items: [] }),
	openFile: undefined
};

// ════════════════════════════════════════════════════════════════════════════
// 三遍渲染
// ════════════════════════════════════════════════════════════════════════════

const results = [];
/** 刚跑完那一遍出现过的标签（去重后）。`pass()` 会重置它。 */
let lastTags = [];
function pass(name, script, mustHave) {
	scripts = script;
	tags = [];
	// ★ 视图记忆：脚本给 `__viewCacheRaw` 就相当于"上次停在那儿"（写进假 localStorage 再渲染）
	fakeStorage.clear();
	if (typeof script.__viewCacheRaw === "string") fakeStorage.set("sr-wb.view.v1", script.__viewCacheRaw);
	const text = renderToText(mainEntry.component(slotProps)).join(" ");
	lastTags = tags.filter((t, i) => tags.indexOf(t) === i);
	const missing = mustHave.filter((s) => !text.includes(s));
	results.push({ pass: name, chars: text.length, missing: missing });
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
// ★ 头部那组按钮（T1）：〔刷新〕〔使用说明〕—— 卡片墙那遍一起盯住它们，免得哪天被顺手删掉/改回旧名
pass("卡片墙", {
	Panel: [INDEX, "idle", null, DASH, null, { kind: "cards" }, null, 0, false, false, "", false, null]
}, [
	"策划工作台", "功能 2",
	// 阶段步进器的文案（"头脑 3" 而不是 "头脑风暴 3"）+ 相对时间（形状由下面那条正则钉）
	"联盟讨伐", "已定稿", "头脑 3", "成稿 1", "定稿 2", "宣讲 1", "决策 2", "最近决策",
	"空功能", "缺桶", "桶没建全", "还没有决策",
	"刷新", "使用说明"
]);

// ── ②' 视图记忆：从工作会话切回工作台（面板**重挂载**）后，落回上次那个功能 ──────────
//   用户口径 2026-10-10：以前每次切回来都回到卡片墙，想进那个功能得重头点。
//   ★ 脚本**只喂前 5 个 useState**（idx / phase / notice / dash / wiz）⇒ `view` 走它自己的
//     **惰性初值**（真机上是 localStorage 的那条记忆）—— 不喂状态，看它自己恢复成什么。
//   ★ 只断言"恢复了那个功能"这一层：详情数据没喂（第 7 位起都是初值 null）
//     ⇒ 屏幕上是「正在读「联盟讨伐」…」，而不是卡片墙。
pass("视图记忆 · 切回来落回上次那个功能", {
	Panel: [INDEX, "idle", null, DASH, null],
	__viewCacheRaw: JSON.stringify({ topic: "联盟讨伐", mod: "decisions" })
}, ["正在读「联盟讨伐」…"]);

// 反面：记忆坏掉 / 没记过 ⇒ **老老实实从卡片墙开始**，绝不猜、也不卡在「正在读…」
const badMem = pass("视图记忆 · 坏记忆回卡片墙", {
	Panel: [INDEX, "idle", null, DASH, null],
	__viewCacheRaw: "{这不是 JSON"
}, ["策划工作台", "功能 2", "使用说明", "联盟讨伐"]);
if (badMem.includes("正在读")) {
	results.push({ pass: "视图记忆 · 坏记忆", missing: ["（坏记忆不该被当成一个功能去读）"] });
	console.error("✗ [视图记忆] 坏掉的记忆被当成了功能");
}

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
	// ★ 8.1.0 起模块名（`mod`）**由 Panel 的 view 携带**（受控）—— 不再是 `FeatureView` 自己的 useState。
	const realPanel = (mod) => [INDEX, "idle", null, DASH, null,
		{ kind: "feature", topic: real.topic, mod: mod || "brainstorm" }, real.detail, 0, false, false, "", false, null];
	pass("详情 · 真数据（" + real.topic + "）· 头脑风暴", { Panel: realPanel("") }, [
		real.topic, "头脑风暴", "决策记录", "最终产物",
		// ★ 「已有的分析结论」这个**标题**已按用户口径删掉（2026-10-09）—— 列表本体还在，断言改盯列表
	"四个入口", "竞品分析", "问答式访谈", "旧文档分析", "人工补充"
	]);
	// ★ 「这个功能的 4 个桶」整块已去掉；这里只该有五组产物（组头带桶名小字）。
	//   ★ 2026-10-13 口径：**过程留痕不在列表里**（变更集 / 读回验收报告 / 审查报告），
	//     只在页签底部报数 —— 所以下面既钉"报数那句话真出现"，又钉"留痕没被列成条目"。
	const realOut = pass("详情 · 真数据（" + real.topic + "）· 最终产物", { Panel: realPanel("outputs") }, [
		"最终产物", "头脑风暴的产物", "成稿", "定稿", "UE 界面稿", "宣讲稿", "配置表", "analysis\\", "gdd\\"
	]);
	const realTrace = real.detail.outputs.trace || { count: 0, files: [] };
	if (realTrace.count > 0) {
		const must = ["另有 " + realTrace.count + " 份", "过程留痕", "要看就点上面的〔打开路径〕"];
		const missing = must.filter((s) => !realOut.includes(s));
		if (missing.length) {
			results.push({ pass: "详情 · 真数据 · 留痕报数", missing: missing });
			console.error("✗ [最终产物] 留痕报数那句话没出现：" + missing.join("、"));
		}
		// ★ 反面钉子：留痕里的**每一份**都不许作为条目出现（真数据里就有这些文件）
		const leaked = realTrace.files.map((f) => f.name).filter((n) => realOut.includes(n));
		if (leaked.length) {
			results.push({ pass: "详情 · 真数据 · 留痕不该列出", missing: leaked });
			console.error("✗ [最终产物] 留痕被当成条目列出来了：" + leaked.join("、"));
		}
	}
}

// ── ③'' 技能用法弹窗：内容来自**构建期快照**（面板直接 import，不走网络）──────────
//   ★ 断言盯的是**真快照**（真 askme 素材）：技能改了忘了 gen:teaching，这里的字就会对不上，
//     与 check:teaching 那道门形成两道网。
//   ★ 8.0.0 起弹窗**按 md 原样渲染**（用户口径，尤其表格）⇒ 这里除了"字在不在"，
//     还要盯**排版真发生了**：自绘那臂必须真出 `<table>` / 标题 / `<strong>`；
//     官方那臂必须真把**整份 md 原文**交给 MarkdownText（而不是退回自绘或只给一段摘要）。
const teachText = pass("技能用法弹窗", {
	Panel: [INDEX, "idle", null, DASH, null, { kind: "cards" }, null, 0, false, false, "", false, null],
	Dashboard: [true]
}, [
	"使用说明",
	"SR 系列技能 · 使用说明", "主线", "从头脑风暴走到正式 UE 回写。", "头脑风暴", "/sr-analysis", "/sr-concept",
	"成稿", "/sr-gdd-human", "配置与线框图（可选）", "没有对应技能，人工做",
	"定稿", "/sr-gdd-ai", "正式 UE 回写",
	// ★ 小表**没有自己的标题**（用户口径：表头写成「其他技能」即可）⇒ 断言直接盯表头文字
	"其他技能", "skill 一览", "sr-concept", "一句话创意 → 设计核候选报告", "sr-gtgenerator", "gtypes.xml",
	"产出落在哪", "一个功能一个目录", "/sr-gdd-fix", "决策记录.md",
	"✕ 关闭", "知道了",
	"内容来源：包内 skills/sr-askme/references/使用说明.md"
]);
if (WITH_PRIM) {
	// 官方那臂：官方 MarkdownText 必须**真被用上**，而且拿到的是**整份 md 原文**
	if (!teachText.includes("⟨官方 MarkdownText⟩")) {
		results.push({ pass: "技能用法 · 官方臂", missing: ["（拿了 primitives 却没走官方 MarkdownText）"] });
		console.error("✗ [技能用法] 拿到了 primitives，但弹窗没用官方 MarkdownText");
	}
	const mdProps = globalThis.__mdProps || [];
	/**
	 * ★ 判据跟**快照本体逐字节比**，不写死某一行表头。
	 *   上一版这里写的是 `p.text.includes("| skill | 干什么 | 关键产出 |")` —— 用户把表头改成
	 *   `| **skill** | **干什么** | **关键产出** |`（给 `<th>` 本来就有的粗体又写了一遍）之后，
	 *   官方臂当场红，而东西是好的。判据该问的是"**整份 md 原文有没有原样交出去**"。
	 */
	const { TEACHING } = await import(new URL("../src/generated/teaching.js", import.meta.url).href);
	const handed = mdProps.filter((p) => p && typeof p.text === "string" && p.text === TEACHING.markdown);
	if (handed.length === 0) {
		results.push({ pass: "技能用法 · 官方臂", missing: ["（官方 MarkdownText 没收到那份 md 原文）"] });
		console.error("✗ [技能用法] 官方 MarkdownText 收到的不是那份 md 原文（收到 " + mdProps.length + " 次，" +
			"其中逐字节等于快照的有 " + handed.length + " 次）");
	}
} else {
	// 自绘那臂：md 必须真被**排版**出来（把 md 当纯文本吐出来也能让上面那些字全在 —— 这条才拦得住）
	const need = ["table", "thead", "tbody", "th", "td", "h1", "h2", "strong", "code", "ol", "ul", "li"];
	const lack = need.filter((t) => lastTags.indexOf(t) < 0);
	if (lack.length) {
		results.push({ pass: "技能用法 · 自绘臂", missing: ["（md 没被排版，缺标签：" + lack.join("、") + "）"] });
		console.error("✗ [技能用法] 自绘渲染里没有这些标签：" + lack.join("、") + "　实际：" + lastTags.join(","));
	}
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
		counts: { brainstorm: 1, draft: 1, final: 1, ue: 1, speech: 1, config: 1, other: 1, trace: 2 },
		groups: [
			{ key: "brainstorm", label: "头脑风暴的产物", note: "analysis\\ 里的全部内容", dynamic: "", dir: "analysis", count: 1, files: [{ name: "experience-report_x_20260915.md", rel: "analysis/experience-report_x_20260915.md", dir: "analysis", subdir: "", group: "brainstorm", kindLabel: "", note: "" }] },
			{ key: "draft", label: "成稿", note: "gdd\\<主题>.md", dynamic: "", dir: "gdd", count: 1, files: [{ name: "联盟讨伐_20260918.md", rel: "gdd/联盟讨伐_20260918.md", dir: "gdd", subdir: "", group: "draft", kindLabel: "", note: "" }] },
			{ key: "final", label: "定稿", note: "gdd\\*_定稿.md", dynamic: "现有 2 份，按文件名日期标最新的一份", dir: "gdd", count: 1, files: [{ name: "联盟讨伐_20260923_定稿.md", rel: "gdd/联盟讨伐_20260923_定稿.md", dir: "gdd", subdir: "", group: "final", kindLabel: "", note: "最新定稿" }] },
			// ★ UE 界面稿是 sr-gdd-UE 的产出（只出定稿 §5 的界面与交互规则）
			{ key: "ue", label: "UE 界面稿", note: "gdd\\<主题>_UE.html —— 给 UE/UI 同事看的界面与交互规则", dynamic: "", dir: "gdd", count: 1, files: [{ name: "联盟讨伐_UE.html", rel: "gdd/联盟讨伐_UE.html", dir: "gdd", subdir: "", group: "ue", kindLabel: "", note: "" }] },
			{ key: "speech", label: "宣讲稿", note: "gdd\\<主题>_宣讲.html —— 定稿的人读版网页", dynamic: "", dir: "gdd", count: 1, files: [{ name: "联盟讨伐_宣讲.html", rel: "gdd/联盟讨伐_宣讲.html", dir: "gdd", subdir: "", group: "speech", kindLabel: "", note: "" }] },
			// ★ 配置表这一类**只装表本体**（变更集是留痕，见下面的 trace）
			{ key: "config", label: "配置表", note: "配置这条线的交付物", dynamic: "", dir: "gdd", count: 1, files: [
				{ name: "联盟讨伐_配置表_20261009.xlsx", rel: "gdd/联盟讨伐_配置表_20261009.xlsx", dir: "gdd", subdir: "", group: "config", kindLabel: "", note: "" }
			] },
			// ★ 其它：真产物里认不出五类的（定稿 HTML 派生件 / 界面图…）—— 审查报告那种已经挪进留痕
			{ key: "other", label: "其它（不属上面几类）", note: "定稿 HTML 派生件 / 界面图 —— 如实列出，不丢", dynamic: "", dir: "gdd", count: 1, files: [{ name: "联盟讨伐_20260923_定稿.html", rel: "gdd/联盟讨伐_20260923_定稿.html", dir: "gdd", subdir: "", group: "other", kindLabel: "定稿 HTML", note: "" }] }
		],
		// ★ 过程留痕：不列出来，只在页签底部**报数**（用户口径 2026-10-13）
		trace: {
			count: 2, summary: "1 份变更集 · 1 份审查报告", allPaths: [],
			files: [
				{ name: "CS-20261009-001.yaml", rel: "gdd/CS-20261009-001.yaml", dir: "gdd", subdir: "", group: "trace", kindLabel: "", note: "" },
				{ name: "联盟讨伐_20260921_定稿_审查.md", rel: "gdd/联盟讨伐_20260921_定稿_审查.md", dir: "gdd", subdir: "", group: "trace", kindLabel: "", note: "" }
			]
		}
	},
	counts: { brainstorm: 1, draft: 1, final: 1, ue: 1, speech: 1, config: 1, other: 1, trace: 2, evidence: 1, decisions: 2, total: 6 }
};

/**
 * 详情页那几遍的脚本。
 *
 * ★ 8.1.0 起**模块名在 Panel 的 view 里**（`mod`，受控）—— 不再靠喂 `FeatureView: ["outputs"]` 切页签。
 *   理由：模块名跟"上次打开的功能"是同一条记忆（`sr-wb.view.v1`），状态必须只有一处
 *   （见 `src/client.js` 里 `FeatureView` 的说明）；这里跟着真机一起改。
 */
const featureScript = (mod) => ({
	Panel: [INDEX, "idle", null, DASH, null,
		{ kind: "feature", topic: TOPIC, mod: mod || "brainstorm" }, DETAIL, 0, false, false, "", false, null]
});

pass("详情 · 三块都在（合成）", featureScript(""), [
	TOPIC, "头脑风暴（2）", "决策记录（2）", "最终产物（6）",
	"四个入口", "竞品分析", "问答式访谈", "旧文档分析", "人工补充",
	"其他 / 来源未知（1）", "固定格式的两类产物", "原话：「血条全盟共享」", "读不动的文件",
	"顺带一句提示"
]);

// ★ 页签由 `view.mod` 决定（`FeatureView` 里没有自己的 state 了）—— 这一遍同时是"受控之后
//   模块名真能落到界面"的判据（写成 `FeatureView: ["decisions"]` 已经不再管用了）
pass("详情 · 决策记录（合成）", featureScript("decisions"), [
	"这个功能的所有决策都记在同一个文件里", "共 2 条", "最近一条 2026-10-08 16:02:11",
	// ★ 有真实条目时**不再**显示「条目格式」模板（用户口径：不额外占位置）
	"全部决策", "2026-10-08 14:23:05", "第 1 条", "采用方案 A", "§4 R2 要改", "附带一条列表项",
	"2026-10-08 16:02:11", "定稿门", "没有时间戳"
]);

const outText = pass("详情 · 最终产物（合成）", featureScript("outputs"), [
	"最终产物", "头脑风暴的产物", "成稿", "定稿", "UE 界面稿", "宣讲稿", "最新定稿", "现有 2 份",
	"其它（不属上面几类）",
	"不是 4 个桶的目录（如实列出）：source", "功能根下的散文件：feature.json",
	// ★ 留痕那一行（用户口径 2026-10-13）：**只报数、不列条目**
	"另有 2 份", "过程留痕", "1 份变更集 · 1 份审查报告", "要看就点上面的〔打开路径〕"
]);
// 反面：那一整块不该再出现
for (const gone of ["这个功能的 4 个桶", "只有四类", "evidence\\", "decisions\\"]) {
	if (outText.includes(gone)) { results.push({ pass: "最终产物 · 不该有", missing: [gone] }); console.error("✗ [最终产物] 还有该去掉的：" + gone); }
}
// ★ 反面钉子：留痕**不作为条目列出来**（合成数据里那两份就该只在报数那句话里出现）
for (const gone of ["CS-20261009-001.yaml", "联盟讨伐_20260921_定稿_审查.md"]) {
	if (outText.includes(gone)) { results.push({ pass: "最终产物 · 留痕不该列出", missing: [gone] }); console.error("✗ [最终产物] 留痕被当成条目列出来了：" + gone); }
}

// 折叠区**默认是收起的**（收起时里面的字根本不渲染）——把 Fold 强制展开，走一遍展开分支
pass("详情 · 最终产物（展开「其它」）", Object.assign(featureScript("outputs"), { Fold: [true] }), [
	"其它（不属上面几类）", "定稿 HTML", "联盟讨伐_20260923_定稿.html"
]);

// ── ④' 决策记录：有真实条目时**不该**出现「条目格式」模板 ──────────────
const decisionText = pass("决策记录 · 无模板（合成）", featureScript("decisions"), ["全部决策", "采用方案 A"]);
if (decisionText.includes("条目格式")) { results.push({ pass: "决策记录 · 无模板", missing: ["（不该有）条目格式"] }); console.error("✗ [决策记录] 有真实条目时还在显示「条目格式」模板"); }
// 没有条目时**要**出现（那是唯一需要它的场合）
const emptyLog = Object.assign({}, DETAIL, { decisions: { rel: "decisions/决策记录.md", abs: "D:\\X\\decisions\\决策记录.md", readError: "", log: { present: false, entries: [], issues: [], preamble: "", title: "", text: "" } } });
pass("决策记录 · 空文件要有模板（合成）", Object.assign(featureScript("decisions"), { Panel: [INDEX, "idle", null, DASH, null, { kind: "feature", topic: TOPIC, mod: "decisions" }, emptyLog, 0, false, false, "", false, null] }), ["条目格式", "还没有决策记录"]);

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
