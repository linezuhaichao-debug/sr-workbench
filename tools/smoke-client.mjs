/**
 * 浏览器半侧 bundle 冒烟自检（换 junction 之前必须先过这一关）。
 *
 * 做什么：
 *   1. 语法自检（等价 `node --check`，这里用 `new vm.Script`）。
 *   2. 造一个**假 `window.__ModuleLoader__`**，执行 bundle —— 拿到它注册的 `{id, factory}`。
 *   3. 用**假 `require`**（React 桩 + primitives 桩）跑 factory，拿到 `exports`。
 *   4. 断言 `exports.apply` / `exports.inject` 的形状，并**实跑 `apply(假 ctx, config)`**。
 *   5. 逐个迭代 `ctx.slots.inject(name, gen)` 拿到的生成器，捕获真正的 `slots.register` 调用，
 *      从而核对面板 id / 侧边栏 label / order —— 这些是"产品行为"的可核对面。
 *   6. 把结果打成一段 JSON 打到 stdout（同一脚本可跑旧手写版与新构建版，**逐字段对比**）。
 *
 * 跑法：
 *   node tools/smoke-client.mjs                 # 默认跑 lib/client.js
 *   node tools/smoke-client.mjs <别的 client.js>  # 对旧手写版跑同一套断言
 *
 * ★ 局限（如实声明）：这是**假环境**。假 ctx 是普通对象，不是 cordis 的 Proxy，
 *   所以"未注入的服务访问即抛错"这条行为**测不到**；React 是桩，组件**不渲染**，
 *   所以 hooks 违规 / 渲染期 ReferenceError 也测不到。它只证明"能加载、形状对、注册调用对"。
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

const target = process.argv[2]
	? path.resolve(process.argv[2])
	: path.join(REPO, "lib", "client.js");

const result = {
	file: target,
	bytes: 0,
	syntax: "not-run",
	loaderId: null,
	loaderCalls: 0,
	exportsKeys: [],
	applyType: "n/a",
	inject: null,
	applyThrew: null,
	slots: [],
	primitivesAvailable: null,
	primitivesMissing: null,
};

const src = fs.readFileSync(target, "utf8");
result.bytes = Buffer.byteLength(src, "utf8");

// ── 1. 语法自检 ────────────────────────────────────────────────────────────
try {
	new vm.Script(src, { filename: target });
	result.syntax = "ok";
} catch (e) {
	result.syntax = "FAIL: " + String((e && e.message) || e);
	console.log(JSON.stringify(result, null, 2));
	process.exit(1);
}

// ── 2. 假 window.__ModuleLoader__ ─────────────────────────────────────────
const registrations = [];
const windowStub = {
	__ModuleLoader__: {
		load(reg) {
			registrations.push(reg);
		},
	},
	location: { origin: "http://127.0.0.1:3080" },
	document: undefined,
};

const sandbox = {
	window: windowStub,
	document: undefined,
	console,
	Symbol,
	Object,
	Array,
	String,
	Number,
	Boolean,
	Date,
	Math,
	JSON,
	Map,
	Set,
	WeakMap,
	WeakSet,
	Promise,
	RegExp,
	Error,
	TypeError,
	RangeError,
	URL,
	URLSearchParams,
	TextEncoder,
	TextDecoder,
	setTimeout,
	clearTimeout,
	setInterval,
	clearInterval,
	queueMicrotask,
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

try {
	vm.createContext(sandbox);
	new vm.Script(src, { filename: target }).runInContext(sandbox, { timeout: 5000 });
	result.loaderCalls = registrations.length;
	result.loaderId = registrations.length === 1 ? registrations[0].id : null;
} catch (e) {
	result.syntax = "runtime-load FAIL: " + String((e && e.message) || e);
	console.log(JSON.stringify(result, null, 2));
	process.exit(1);
}

if (registrations.length !== 1 || typeof registrations[0].factory !== "function") {
	result.syntax = "FAIL: __ModuleLoader__.load 调用形状不对";
	console.log(JSON.stringify(result, null, 2));
	process.exit(1);
}

// ── 3. 假 require：React 桩 + primitives 桩 ────────────────────────────────
function makeReactStub() {
	const noop = () => void 0;
	const react = {
		createElement: (type, props, ...children) => ({ $$typeof: "stub-element", type, props, children }),
		cloneElement: (el) => el,
		isValidElement: () => true,
		Children: { map: (c, f) => (Array.isArray(c) ? c.map(f) : []), toArray: (c) => (Array.isArray(c) ? c : []) },
		createContext: (v) => ({ Provider: noop, Consumer: noop, _currentValue: v }),
		createRef: () => ({ current: null }),
		forwardRef: (f) => f,
		memo: (f) => f,
		lazy: (f) => f,
		Fragment: Symbol("Fragment"),
		StrictMode: Symbol("StrictMode"),
		Suspense: Symbol("Suspense"),
		Component: class {},
		PureComponent: class {},
		startTransition: (f) => f(),
		useState: (init) => [typeof init === "function" ? init() : init, noop],
		useReducer: (r, init) => [init, noop],
		useEffect: noop,
		useLayoutEffect: noop,
		useInsertionEffect: noop,
		useMemo: (f) => f(),
		useCallback: (f) => f,
		useRef: (v) => ({ current: v }),
		useContext: (c) => (c ? c._currentValue : void 0),
		useImperativeHandle: noop,
		useId: () => "stub-id",
		useTransition: () => [false, (f) => f()],
		useDeferredValue: (v) => v,
		useSyncExternalStore: (_s, get) => get(),
	};
	return react;
}

const primitivesStub = { Button: () => null, Icon: () => null };

function runFactory({ withPrimitives }) {
	const calls = [];
	const requireStub = (id) => {
		calls.push(id);
		if (id === "react") return makeReactStub();
		if (id === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null, Fragment: Symbol("Fragment") };
		if (id === "@deepseek-ai/dsh-client-ui-primitives") {
			if (!withPrimitives) throw new Error("module not found: " + id);
			return primitivesStub;
		}
		throw new Error("unexpected require in smoke test: " + id);
	};
	const exports = registrations[0].factory(requireStub);
	return { exports, calls };
}

const { exports: modExports, calls: requireCalls } = runFactory({ withPrimitives: true });
result.exportsKeys = Object.keys(modExports).sort();
result.applyType = typeof modExports.apply;
result.inject = Array.isArray(modExports.inject) ? modExports.inject : null;

// 无 primitives 的那条降级分支也必须能加载
try {
	const { exports: e2 } = runFactory({ withPrimitives: false });
	result.primitivesAvailable = typeof modExports.apply;
	result.primitivesMissing = typeof e2.apply;
} catch (e) {
	result.primitivesMissing = "THREW: " + String((e && e.message) || e);
}

if (typeof modExports.apply !== "function") {
	console.log(JSON.stringify(result, null, 2));
	console.error("✗ exports.apply 不是函数");
	process.exit(1);
}

// ── 4. 假 ctx + 实跑 apply ────────────────────────────────────────────────
const injectCalls = [];
const registerCalls = [];
const fakeCtx = {
	slots: {
		inject(name, fn) {
			injectCalls.push({ name, fn });
			return { dispose() {} };
		},
		register(options, component) {
			const entry = { options, component, componentType: typeof component };
			registerCalls.push(entry);
			return { dispose() {} };
		},
	},
	get() {
		return void 0;
	},
	effect(fn) {
		if (typeof fn === "function") fn();
	},
	on() {},
	remote: {},
	logger: { info() {}, warn() {}, error() {}, debug() {} },
};

try {
	modExports.apply(fakeCtx, {});
	result.applyThrew = null;
} catch (e) {
	result.applyThrew = String((e && e.message) || e);
}

// ── 5. 迭代 inject 生成器，拿真正的 register 调用 ─────────────────────────
for (const call of injectCalls) {
	if (typeof call.fn !== "function") continue;
	try {
		for (const _ of call.fn()) { /* 注册副作用已经记在 registerCalls 里 */ }
	} catch (e) {
		result.slots.push({ inject: call.name, error: String((e && e.message) || e) });
	}
}

result.slots = registerCalls.map((r) => ({
	inject: injectCalls.find((c) => c.name === r.options.name)?.name ?? r.options.name,
	options: r.options,
	componentType: r.componentType,
}));

result.requireCalls = requireCalls;

console.log(JSON.stringify(result, null, 2));

const problems = [];
if (result.loaderCalls !== 1) problems.push("__ModuleLoader__.load 调用次数 != 1");
if (result.applyType !== "function") problems.push("exports.apply 不是函数");
if (!Array.isArray(result.inject)) problems.push("exports.inject 不是数组");
if (result.applyThrew) problems.push("apply 抛错：" + result.applyThrew);
if (result.slots.length === 0) problems.push("apply 没有注册任何 slot");
if (result.slots.some((s) => s.error)) problems.push("slot 生成器抛错");
if (result.primitivesMissing === "THREW" || String(result.primitivesMissing).startsWith("THREW")) {
	problems.push("primitives 缺失时插件挂了（应该降级而不是抛错）");
}

if (problems.length > 0) {
	console.error("\n✗ 冒烟未通过：\n - " + problems.join("\n - "));
	process.exit(1);
}
console.error("\n✓ 冒烟通过");
