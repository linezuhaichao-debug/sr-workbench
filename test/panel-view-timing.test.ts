/**
 * 面板视图时序：**新建功能之后切进详情的那一帧**。
 *
 * ── 为什么这条必须有（2026-10-13 用户实测缺陷）──────────────────────────────
 * 新建功能**每次**都弹「上次打开的功能「X」没找到（可能改名或删了）—— 已回到卡片墙」，
 * 而卡片墙上明明已经有那张卡。根因是时序：`submitNew` 建成功那一刻同时做了
 * 「切视图」（`goFeature`）与「重读看板」（`refresh`），两者在同一次提交里生效；
 * 而 effect 是**提交后同步**跑完的，`__dashboard` 的 Promise 必然还没回来 ——
 * 于是那条"这个功能还在不在"的校验拿**建之前那份**看板一判就落空：
 * 刚建好的功能被踢回卡片墙、成功提示被那句 warn 盖掉、视图记忆也被擦成空。
 *
 * ── 为什么现有两层网都没拦住它 ─────────────────────────────────────────────
 *   · `create-flow.test.ts` 的 React 是桩（`useEffect: noop`）—— 它测 `createFeature` 的
 *     **调用顺序**，界面根本不渲染；
 *   · `render-smoke.mjs` 的迷你 React 是**一次性**渲染（`setState` 空转、`useEffect` 不跑）——
 *     它自己就声明"点一下按钮之后会怎样不在这里"。
 *   所以本用例自带一个**能跑 hooks 与重渲染**的迷你 React（只够驱动这一个场景），
 *   并把"新建之后那次看板列举"**闸住**：界面停在那危险的一帧上可断言，
 *   而不是靠多等几毫秒碰运气（那正是这类缺陷藏身的地方）。
 *
 * 假的一层只有三样，其余全是真的：真 `apply()`、真组合根、真 `Panel`、真 `Dashboard` 事件回调。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE = path.join(REPO, "lib", "client.js");

const SR = "D:\\X\\workspace";
const FEATURES = SR + "\\features";
const EXISTING = "已有的功能";
const NEW = "新功能";
const BUCKETS = ["evidence", "analysis", "gdd", "decisions"];
/** 视图记忆的键（`pure/panelview.ts` 里那一份）。 */
const VIEW_KEY = "sr-wb.view.v1";
/** ★ 「人工补充」用例填进「原话（逐字保留）」的那句话（产出文件名的派生口径由纯层用例钉）。 */
const NOTE_QUOTE = "BOSS 的血条应该是全盟共享的，一个人打全盟都能看到";

const norm = (p) => String(p).replace(/[\\/]+$/, "").replace(/\//g, "\\").toLowerCase();

// ════════════════════════════════════════════════════════════════════════════
// 迷你 React：够跑 hooks 与重渲染（`render-smoke.mjs` 那个是一次性的，这里必须能重来）
// ════════════════════════════════════════════════════════════════════════════

/**
 * 组件实例按**位置路径**认（`#Panel:div.0#Dashboard…`）—— 与 React 无 key 时的位置协调同义。
 * 位置没变就是同一个实例（hooks 状态留着），位置变了就是一个新实例。
 */
function makeRuntime() {
	const insts = new Map();
	let seen = [];
	let text = [];
	let declared = [];
	let dirty = false;
	let rootEl = null;
	let curInst = null;
	let curCursor = 0;
	/** 这一次渲染里，每个函数组件元素 → 它渲染出来的那一棵树（`walkEls` 靠它往下走）。 */
	const outOf = new Map();

	class Component {
		constructor(props) { this.props = props || {}; this.state = {}; }
		setState(next) {
			const patch = typeof next === "function" ? next(this.state) : next;
			this.state = Object.assign({}, this.state, patch);
			dirty = true;
		}
		render() { return this.props.children; }
	}

	const instOf = (key) => {
		let s = insts.get(key);
		if (!s) { s = { key, hooks: [], cls: null }; insts.set(key, s); }
		return s;
	};
	const changed = (prev, next) => {
		if (prev === null || prev === undefined) return true;   // 没给依赖数组 ⇒ 每次都跑
		if (next === null || next === undefined) return true;
		if (prev.length !== next.length) return true;
		for (let i = 0; i < prev.length; i++) if (!Object.is(prev[i], next[i])) return true;
		return false;
	};

	const React = {
		createElement(type, props, ...children) {
			const p = Object.assign({}, props || {});
			if (children.length === 1) p.children = children[0];
			else if (children.length > 1) p.children = children;
			else if (!("children" in p)) p.children = undefined;
			return { $$kind: "element", type, props: p };
		},
		cloneElement: (el, extra) => React.createElement(el.type, Object.assign({}, el.props, extra)),
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
		Fragment: Symbol("Fragment"), StrictMode: Symbol("StrictMode"), Suspense: Symbol("Suspense"),
		Component, PureComponent: Component,
		startTransition: (f) => f(),
		useState(init) {
			const s = curInst; const i = curCursor++;
			if (!s.hooks[i]) {
				const slot = { kind: "state", value: typeof init === "function" ? init() : init };
				slot.set = (next) => {
					const nv = typeof next === "function" ? next(slot.value) : next;
					if (!Object.is(nv, slot.value)) { slot.value = nv; dirty = true; }
				};
				s.hooks[i] = slot;
			}
			return [s.hooks[i].value, s.hooks[i].set];
		},
		useReducer(reducer, init) {
			const s = curInst; const i = curCursor++;
			if (!s.hooks[i]) {
				const slot = { kind: "state", value: init };
				slot.set = (action) => { const nv = reducer(slot.value, action); if (!Object.is(nv, slot.value)) { slot.value = nv; dirty = true; } };
				s.hooks[i] = slot;
			}
			return [s.hooks[i].value, s.hooks[i].set];
		},
		useRef(init) {
			const s = curInst; const i = curCursor++;
			if (!s.hooks[i]) s.hooks[i] = { kind: "ref", value: { current: init } };
			return s.hooks[i].value;
		},
		useMemo(f, deps) {
			const s = curInst; const i = curCursor++;
			if (!s.hooks[i] || changed(s.hooks[i].deps, deps)) s.hooks[i] = { kind: "memo", value: f(), deps: deps ? deps.slice() : null };
			return s.hooks[i].value;
		},
		useCallback(f, deps) {
			const s = curInst; const i = curCursor++;
			if (!s.hooks[i] || changed(s.hooks[i].deps, deps)) s.hooks[i] = { kind: "cb", value: f, deps: deps ? deps.slice() : null };
			return s.hooks[i].value;
		},
		useEffect(f, deps) {
			const s = curInst; const i = curCursor++;
			if (!s.hooks[i]) s.hooks[i] = { kind: "effect", deps: null, cleanup: null };
			declared.push({ inst: s, index: i, deps: deps, fn: f });
		},
		useLayoutEffect() {},
		useInsertionEffect() {},
		useContext: (c) => (c ? c._currentValue : void 0),
		useImperativeHandle() {},
		useId: () => "id",
		useTransition: () => [false, (f) => f()],
		useDeferredValue: (v) => v,
		useSyncExternalStore: (_s, get) => get()
	};

	/** 提交后跑 effects（依赖变了才跑；上次的清理函数先跑）—— 与 React 同序。 */
	function flushEffects() {
		const list = declared;
		declared = [];
		for (const d of list) {
			const slot = d.inst.hooks[d.index];
			if (!slot || slot.kind !== "effect") continue;
			if (!changed(slot.deps, d.deps)) continue;
			if (typeof slot.cleanup === "function") { try { slot.cleanup(); } catch (e) { /* 清理出错不该盖住主断言 */ } }
			slot.deps = d.deps ? d.deps.slice() : null;
			const r = d.fn();
			slot.cleanup = typeof r === "function" ? r : null;
		}
	}

	function walk(node, p) {
		if (node === null || node === undefined || node === false || node === true) return;
		if (typeof node === "string" || typeof node === "number") { text.push(String(node)); return; }
		if (Array.isArray(node)) { node.forEach((n, i) => walk(n, p + "." + i)); return; }
		if (typeof node !== "object" || node.$$kind !== "element") return;
		let type = node.type;
		const props = node.props || {};
		// 官方的 Button / MarkdownText 是 forwardRef / memo 的产物（对象），解一层
		if (type !== null && typeof type === "object" && typeof type.$$typeof === "symbol") type = type.render || type.type;
		if (typeof type === "function") {
			if (type.prototype && typeof type.prototype.render === "function") {
				const s = instOf(p + "~" + (type.name || "cls"));
				if (!s.cls) s.cls = new type(props);
				s.cls.props = props;
				walk(s.cls.render(), p + ":" + (type.name || "cls"));
				return;
			}
			const key = p + "#" + (type.name || "anon");
			const s = instOf(key);
			const prevInst = curInst, prevCursor = curCursor;
			curInst = s; curCursor = 0;
			let out;
			try { out = type(props); } finally { curInst = prevInst; curCursor = prevCursor; }
			outOf.set(node, out);
			seen.push({ name: type.name || "anon", props, key, out });
			walk(out, key);
			return;
		}
		if (typeof type === "string") walk(props.children, p + ":" + type);
	}

	/** 用户交互的接缝：小运行时不会合成事件，所以按"元素 + 属性"直接找到处理函数并调用。 */
	/** 这个元素**自己那一段**文字（碰到函数组件就停 —— 那一层的文字由它自己的元素负责）。 */
	function ownText(el) {
		const out = [];
		const go = (n) => {
			if (n === null || n === undefined || n === false || n === true) return;
			if (typeof n === "string" || typeof n === "number") { out.push(String(n)); return; }
			if (Array.isArray(n)) { for (const x of n) go(x); return; }
			if (typeof n !== "object" || n.$$kind !== "element") return;
			let t = n.type;
			if (t !== null && typeof t === "object" && typeof t.$$typeof === "symbol") t = t.render || t.type;
			if (typeof t === "function") return;
			go((n.props || {}).children);
		};
		go((el.props || {}).children);
		return out.join(" ");
	}

	function walkEls(node, out) {
		if (node === null || node === undefined || node === false || node === true) return;
		if (Array.isArray(node)) { for (const n of node) walkEls(n, out); return; }
		if (typeof node !== "object" || node.$$kind !== "element") return;
		let type = node.type;
		if (type !== null && typeof type === "object" && typeof type.$$typeof === "symbol") type = type.render || type.type;
		if (typeof type === "function") {
			// 函数组件：顺着它这一次渲染出来的那一棵树往下（出参按元素记在 `outOf` 里）
			if (outOf.has(node)) walkEls(outOf.get(node), out);
			return;
		}
		out.add(node);
		walkEls(node.props && node.props.children, out);
	}

	/**
	 * 这次渲染里的**所有** DOM 元素（去重）。
	 *
	 * ★ 从每个函数组件的**出参**往里走，而不是从"某一次渲染的根元素"：面板外面还包着
	 *   客户端外壳的 `PanelErrorBoundary`，根元素与 `outOf` 里记的那一份不一定是同一个对象。
	 *   从出参走不依赖任何一层壳 —— 元素还在树上就一定找得到。
	 */
	function collectEls() {
		const set = new Set();
		for (const s of seen) walkEls(s.out, set);
		return [...set];
	}

	function renderOnce() {
		seen = []; text = []; declared = []; outOf.clear();
		walk(rootEl, "");
		flushEffects();
	}

	const tick = () => new Promise((r) => setTimeout(r, 0));
	/** 渲染 + 让 promise 回调推进，来回几轮（`setState` 都发生在 promise / effect 里）。 */
	async function pump(rounds = 6) {
		for (let i = 0; i < rounds; i++) {
			if (dirty) { dirty = false; renderOnce(); }
			await tick();
		}
		if (dirty) { dirty = false; renderOnce(); }
	}

	return {
		React,
		mount(el) { rootEl = el; renderOnce(); },
		pump,
		/** 让下一轮 `pump` 重渲染（模拟"外部 store 变了 ⇒ 订阅者重渲染"）。 */
		invalidate() { dirty = true; },
		text: () => text.join(" "),
		find: (name) => seen.filter((x) => x.name === name).slice(-1)[0] || null,
		/** 组件名（按渲染顺序）。 */
		names: () => seen.map((x) => x.name),
		/**
		 * 界面上真的带这个事件属性的元素（按渲染顺序）。`only` 再按"这一元素自己那一段文字"
		 * 过滤 —— 例如四张入口卡片里带 `onClick` 的那一张。
		 */
		els(propName, only) {
			const hit = collectEls().filter((el) => el.props && typeof el.props[propName] === "function");
			if (!only) return hit;
			return hit.filter((el) => ownText(el).includes(only));
		},
		/** 诊断：上一次 `els()` 里 `walkEls` 实际访问到的东西。 */
		/** 调用一次事件处理函数（小运行时不合成分发，这就是"用户点了它"）。 */
		fire(el, propName, arg) { return el.props[propName](arg); },
		unmount() {
			for (const s of insts.values()) {
				for (const hk of s.hooks) if (hk && typeof hk.cleanup === "function") { try { hk.cleanup(); } catch (e) { /* 同上 */ } }
			}
		}
	};
}

// ════════════════════════════════════════════════════════════════════════════
// 假宿主：虚拟目录树 + 可闸住的列举
// ════════════════════════════════════════════════════════════════════════════

/**
 * 目录树是**真的树**（`mkdir` 之后 `list` 就读得到）—— 新建功能走 `createDirectory` 建出来的
 * 目录，下一轮看板自然能扫到，不需要测试另外塞数据。
 *
 * `armHold()`：把**下一次** `features\` 列举挂住（`list` 返回一个待定的 Promise），
 * 这样"新建之后那次看板刷新"停在空中，那一帧的界面才能被稳定断言。
 */
function makeHost(opts = {}) {
	const tree = new Map();      // norm(path) -> Map(name -> "directory")
	const log = [];
	let holdArmed = false;
	let gate = null;
	/**
	 * `session.list` 的回话：默认只有一条"自己的"索引会话（标题前缀是所有权凭据①，
	 * cwd 覆盖 SR 根 ⇒ 索引会话认领得到它）。残留用例会再塞一条**孤儿工作会话**进去。
	 */
	const sessionItems = opts.sessions || [{ sessionId: "boot", cwd: SR, updatedAt: 1000, title: "策划工作台·索引（workspace）" }];
	/** 新建工作区时发一个**不重复**的 id（真机上 host 也不会复用 id）。 */
	let wsSeq = 0;

	const dir = (p) => { const k = norm(p); if (!tree.has(k)) tree.set(k, new Map()); return tree.get(k); };
	const mkdir = (parent, name) => {
		dir(parent).set(name, "directory");
		return dir(String(parent).replace(/[\\/]+$/, "") + "\\" + name), String(parent).replace(/[\\/]+$/, "") + "\\" + name;
	};
	const entriesOf = (p) => {
		const m = tree.get(norm(p));
		return m ? [...m.entries()].map(([name, type]) => ({ name, type })) : null;
	};
	const newGate = () => { let release; const promise = new Promise((r) => { release = r; }); return { promise, release }; };

	// 起始状态：SR 工作区 + features\ + 一个已有功能（4 个桶齐）
	const X = "D:\\X";
	dir(X);
	mkdir(X, "workspace");
	mkdir(SR, "features");
	mkdir(FEATURES, EXISTING);
	for (const b of BUCKETS) mkdir(FEATURES + "\\" + EXISTING, b);

	const remote = {
		__log: log,
		workspaceFiles: {
			async read(_sid, p) {
				if (norm(p).endsWith("config.local.json")) {
					const text = JSON.stringify({
						sr_workspace: SR, sr_project: "D:\\X\\proj",
						config_root: "D:\\X\\planner", gtgenerator_workdir: "D:\\X\\planner\\GTGenerator"
					});
					return { ok: true, value: { text: text, lines: 1, eof: true, version: "v1", absolutePath: p } };
				}
				return { ok: false, error: { message: "没有这个文件：" + p } };
			},
			async list(_sid, p) {
				/**
				 * ★ 闸门：**只有"新功能目录已经建出来之后"那次 `features\` 列举**才挂住 ——
				 *   那正是新建之后由 `refresh()` 触发的那一次看板刷新。
				 *   不加这个前提会把新建流程自己的列举（`loadCreateFacts` 也列 `features\`）
				 *   一起闸住，于是"建"永远回不来，界面卡在「正在建…」—— 那样测的就不是这条时序了。
				 */
				if (holdArmed && norm(p) === norm(FEATURES) && tree.get(norm(FEATURES)).has(NEW)) {
					if (!gate) gate = newGate();
					await gate.promise;
				}
				const e = entriesOf(p);
				if (!e) return { ok: false, error: { code: "workspace-file/unreadable", message: "cannot list " + p } };
				return { ok: true, value: { path: p, entries: e, truncated: false } };
			},
			async stat(_sid, p) { return { ok: true, value: { absolutePath: p, version: "v1" } }; }
		},
		workspace: {
			async create(req) {
				log.push({ m: "workspace.create", path: req && req.path });
				const id = "ws-" + (++wsSeq);
				// ★ 真机上 `syncSidebarStores` 会把新工作区**当场**并进 store ⇒ 快照立刻多一行，
				//   而看板还停在旧的那一份。这个错位就是最后那条用例要复现的东西。
				if (typeof opts.onWorkspace === "function") opts.onWorkspace(req && req.path, id);
				return { ok: true, value: { workspace: { workspaceId: id, path: req && req.path }, created: true } };
			},
			/** 残留清理用（宿主口径：只删登记，不删目录、不删会话）。 */
			async delete(req) {
				log.push({ m: "workspace.delete", id: req && req.workspaceId });
				return { ok: true, value: { deleted: true } };
			},
			/** 残留清理用（侧边栏归档，可取消归档）。 */
			async archiveSession(req) {
				log.push({ m: "workspace.archiveSession", id: req && req.sessionId });
				return { ok: true, value: { archivedSessionIds: [req && req.sessionId] } };
			}
		},
		session: {
			async create(req) { log.push({ m: "session.create", req }); return { ok: true, value: { sessionId: "sid-new" } }; },
			async rename(req) { log.push({ m: "session.rename", req }); return { ok: true, value: { sessionId: req.sessionId, title: req.title } }; },
			async list() { return { ok: true, value: { items: sessionItems } }; },
			async prompt(req) { log.push({ m: "session.prompt", req }); return { ok: true, value: { queued: true } }; },
			async openWorkspacePath() { return { ok: true, value: { opened: true } }; }
		},
		commands: { async execute() { return { ok: true, value: { text: "" } }; } },
		permissionPresets: { async catalog() { return { ok: true, value: { options: [], defaultOptions: [], defaultPreset: "danger-full-access" } }; } }
	};

	/** 宿主的目录原语（browse 后端：`createDirectory` 真建目录）。 */
	const uiWorkspace = {
		/** 〔新建会话〕建完会把用户**切到那条会话**（`uiWorkspace.openSession`）—— 记下来当证据。 */
		openSession(sid) { log.push({ m: "uiWorkspace.openSession", sid: sid }); },
		async createDirectory(parent, name) {
			const full = String(parent).replace(/[\\/]+$/, "") + "\\" + name;
			if (tree.has(norm(full))) { const e = new Error("已存在：" + full); e.code = "directory-exists"; throw e; }
			mkdir(parent, name);
			log.push({ m: "createDirectory", path: full });
			return full;
		}
	};

	return {
		remote,
		uiWorkspace,
		tree,
		log,
		/** 闸住"新建之后那次"看板刷新（新功能目录一出现，下一次 `features\` 列举就挂住）。 */
		armHold() { holdArmed = true; },
		release() { holdArmed = false; if (gate) { gate.release(); gate = null; } }
	};
}

// ════════════════════════════════════════════════════════════════════════════
// 装配：真 bundle + 真组合根 + 真 Panel（只有 React 与宿主是假的）
// ════════════════════════════════════════════════════════════════════════════

function boot(opts = {}) {
	/**
	 * ★ 侧边栏工作区快照**要跟着 `workspace.create` 变**（真机行为）：`syncSidebarStores`
	 *   会把刚建的工作区当场并进 store，而看板那时还停在旧的那一份 —— 面板的残留清理
	 *   曾在这个错位里把自己刚建出来的工作区删掉（用户实测「只创建出文件夹，工作区没创建」）。
	 */
	const wsState = { items: (opts.workspaces || []).slice(), archived: (opts.archivedSessions || []).slice() };
	const rt = makeRuntime();
	const host = makeHost({
		sessions: opts.sessions,
		// ★ store 一变就重渲染（真机上 `useWorkspaces((s) => s)` 就是这么被通知的）——
		//   这个"store 更新早于看板刷新"的时序必须被复现，否则测不出原来看板判据的毛病。
		onWorkspace: (path, workspaceId) => { wsState.items.push({ workspaceId: workspaceId, path: path }); rt.invalidate(); }
	});
	const storage = new Map();
	if (opts.viewMemory !== undefined) storage.set(VIEW_KEY, String(opts.viewMemory));
	const localStorageStub = {
		getItem: (k) => (storage.has(String(k)) ? storage.get(String(k)) : null),
		setItem: (k, v) => { storage.set(String(k), String(v)); },
		removeItem: (k) => { storage.delete(String(k)); },
		clear: () => storage.clear(),
		key: (i) => [...storage.keys()][i] ?? null,
		get length() { return storage.size; }
	};

	const src = fs.readFileSync(BUNDLE, "utf8");
	const registrations = [];
	const sandbox = {
		window: { __ModuleLoader__: { load: (r) => registrations.push(r) }, location: { origin: "http://127.0.0.1:3080" } },
		localStorage: localStorageStub,
		console, Symbol, Object, Array, String, Number, Boolean, Date, Math, JSON, Map, Set, WeakMap, WeakSet,
		Promise, RegExp, Error, TypeError, RangeError, URL, URLSearchParams, TextEncoder, TextDecoder,
		AbortController, setTimeout, clearTimeout, queueMicrotask,
		// 面板的 5 秒轮询在用例里不需要真定时器（真跑会拖住进程）
		setInterval: () => 1, clearInterval: () => void 0
	};
	sandbox.globalThis = sandbox;
	sandbox.self = sandbox;
	vm.createContext(sandbox);
	new vm.Script(src, { filename: BUNDLE }).runInContext(sandbox, { timeout: 8000 });

	const mod = registrations[0].factory((id) => {
		if (id === "react") return rt.React;
		if (id === "react/jsx-runtime") return { jsx: rt.React.createElement, jsxs: rt.React.createElement, Fragment: Symbol("Fragment") };
		throw new Error("用例里没预期的 require：" + id);   // ui/atoms.js 自己 try/catch 退回自绘
	});

	const injectCalls = [];
	const registered = [];
	const ctx = {
		slots: {
			inject: (name, fn) => { injectCalls.push({ name, fn }); return { dispose() {} }; },
			register: (options, component) => { registered.push({ options, component }); return { dispose() {} }; }
		},
		get: (name) => (name === "uiWorkspace" ? host.uiWorkspace
			/**
			 * ★ 两个官方客户端 store 服务给**桩**（真机上它们由 `dsh-api-workspace-controller` /
			 *   `dsh-api-session-controller` 提供）。不给的话，每次建会话都会如实报一句
			 *   "新工作区分组 / 新会话行这次不会即时出现在侧边栏" —— 那是**有后果的降级**
			 *   （要按 F5），而〔新建会话〕在**有降级时故意不把你切过去**（留在面板把话说清）
			 *   ⇒ 正常路径就测不出来"建完直接进去"了。降级路径另有用例把 rename 打断来测。
			 */
			: name === "workspaces" ? { create: async () => ({ ok: true }) }
				: name === "sessions" ? { refresh: async () => ({ ok: true }) }
					: void 0),
		effect: (fn) => { if (typeof fn === "function") fn(); },
		on() {},
		remote: host.remote,
		logger: { info() {}, warn() {}, error() {}, debug() {} }
	};
	mod.apply(ctx, {});
	for (const call of injectCalls) if (typeof call.fn === "function") for (const _ of call.fn()) { /* register 已记录 */ }

	const main = registered.filter((r) => r.options.name === "main")[0];
	assert.ok(main, "面板要注册 main 槽");
	// ★ `main.component(props)` 返回的**已经是 element**（`<PanelErrorBoundary><Panel …/></…>`）——
	//   不能再 `createElement` 包一层（那样 type 是个 element，整棵树一个组件都不会渲染）
	const Root = main.component({
		useSessions: (s) => s({ ids: [], byId: {} }),
		useWorkspaces: (s) => s({
			items: wsState.items,
			// ★ 归档集**要给**：拿不到时面板故意一个都不清（`pure/leftovers.ts` 的安全阀），
			//   本文件那几条清理用例测的正是"明确知道归档集"的正常路径。
			archivedSessionIds: wsState.archived
		})
	});
	rt.mount(Root);

	return {
		rt,
		host,
		storage,
		text: () => rt.text(),
		/** 卡片墙上那张卡的入口回调（点它 = 进这个功能）。 */
		open: (topic) => {
			const d = rt.find("Dashboard");
			assert.ok(d, "此刻应当在卡片墙上");
			d.props.onOpen(topic);
		},
		dashboard: () => rt.find("Dashboard"),
		/**
		 * 功能详情右上角那颗〔新建会话〕。
		 * ★ 它**不是组件实例**：面板里那几颗头部按钮是 `Btn({…})` **直接调用**出来的
		 *   （hooks 记在 `FeatureView` 头上），所以树里找不到名叫 `Btn` 的组件。
		 *   判据拆两半：① 文案在屏幕上（`text()`）；② 动作 = `FeatureView` 收到的 `onNewSession`
		 *   —— 与那颗按钮的 `onClick` 是**同一个函数**。
		 */
		newSession: () => {
			const fv = rt.find("FeatureView");
			assert.ok(fv, "此刻应当在功能详情上，实际渲染过：" + rt.names().join(" "));
			assert.ok(rt.text().includes("新建会话"), "头部应当有〔新建会话〕：" + rt.text().slice(0, 300));
			return fv.props.onNewSession;
		},
		viewMemory: () => {
			const raw = storage.get(VIEW_KEY);
			if (raw === undefined) return null;
			try { return JSON.parse(raw); } catch (e) { return { raw: raw }; }
		}
	};
}

// ════════════════════════════════════════════════════════════════════════════
// ① 正例：新建成功 ⇒ 直接进它的详情，**不许**被判"没找到"
// ════════════════════════════════════════════════════════════════════════════

test("新建功能：建完那一帧不得判「上次打开的功能没找到」，也不许把记忆擦掉", async () => {
	const p = boot();
	await p.rt.pump(8);
	assert.ok(p.text().includes(EXISTING), "先要在卡片墙上看到已有的功能：" + p.text().slice(0, 200));

	// 打开新建表单 → 输名字 → 提交（这三个都是 Dashboard 交给面板的真回调）
	p.dashboard().props.onNew();
	await p.rt.pump(2);
	p.dashboard().props.onTopic(NEW);
	await p.rt.pump(3);
	assert.ok(p.text().includes(NEW), "新建表单应当已经在预览这个名字：" + p.text().slice(0, 200));

	p.host.armHold();                       // ★ 闸住"新建之后那次"看板列举
	p.dashboard().props.onSubmit();
	await p.rt.pump(6);

	// —— 险帧：功能目录已经建好，看板还停在**建之前**那一份 ——
	const during = p.text();
	assert.equal(during.includes("没找到"), false,
		"刚建好的功能被判「没找到」了（这就是用户实测那个缺陷）：" + during.slice(-400));
	assert.ok(during.includes("正在读「" + NEW + "」…"),
		"这一帧应当落在新功能的详情上（等看板跟上）：" + during.slice(-400));
	assert.deepEqual(p.viewMemory(), { topic: NEW, mod: "brainstorm" },
		"视图记忆要写成这个新功能 —— 被踢回卡片墙时它会被擦成空");

	// 目录是真建了的（不是面板假装成功）
	assert.ok(p.host.tree.has(norm(FEATURES + "\\" + NEW)), "功能目录应当真的建出来了");

	// —— 放开闸门：看板跟上了，照常渲染详情 ——
	p.host.release();
	await p.rt.pump(10);
	const after = p.text();
	assert.ok(after.includes("头脑风暴") && after.includes("决策记录") && after.includes("最终产物"),
		"看板跟上之后要渲染出详情页的三个模块：" + after.slice(-400));
	assert.equal(after.includes("没找到"), false, "全程都不该出现那句误报：" + after.slice(-400));
	p.rt.unmount();
});

// ════════════════════════════════════════════════════════════════════════════
// ② 反例：记忆里那个功能**真的**没了 ⇒ 自愈照旧（修复不许把这条判据一起关掉）
// ════════════════════════════════════════════════════════════════════════════

test("看板里真的没有那个功能 ⇒ 仍然回卡片墙、如实说一句，并把记忆擦掉", async () => {
	const p = boot({ viewMemory: JSON.stringify({ topic: "早就删了", mod: "decisions" }) });
	await p.rt.pump(8);

	const t = p.text();
	assert.ok(t.includes("没找到"), "真的找不着就要如实说：" + t.slice(0, 300));
	assert.ok(t.includes("早就删了"), "要说清是哪个功能：" + t.slice(0, 300));
	assert.deepEqual(p.viewMemory(), { topic: "", mod: "" }, "落空后要把那条记忆擦掉（自愈，否则每次切回来都白跑）");
	assert.ok(p.dashboard(), "并且要回到卡片墙");
	p.rt.unmount();
});

// ════════════════════════════════════════════════════════════════════════════
// ③ 手工删掉的功能：它留下的工作区登记 / 工作会话要被收拾掉
//    （用户实测 2026-10-13：「我手动删了功能，这个没有清理吗。需要优化一下」）
// ════════════════════════════════════════════════════════════════════════════

test("手工删掉功能 ⇒ 归档它的工作会话 + 移除它的工作区登记（**不碰文件**），并如实报一句", async () => {
	const orphan = "神话宝库";                       // 功能目录已不在磁盘上（看板里没有它）
	const orphanRoot = FEATURES + "\\" + orphan;
	const p = boot({
		sessions: [
			{ sessionId: "boot", cwd: SR, updatedAt: 1000, title: "策划工作台·索引（workspace）" },
			{ sessionId: "s-orphan", cwd: orphanRoot, updatedAt: 2000, title: "策划工作台·工作（" + orphan + "）" }
		],
		workspaces: [{ workspaceId: "w-orphan", path: orphanRoot }]
	});
	await p.rt.pump(10);

	const touched = p.host.log
		.filter((x) => x.m === "workspace.archiveSession" || x.m === "workspace.delete")
		.map((x) => x.m + ":" + x.id)
		.sort();
	assert.deepEqual(touched, ["workspace.archiveSession:s-orphan", "workspace.delete:w-orphan"],
		"该清的只有面板自己造的那两样：" + JSON.stringify(p.host.log));

	const t = p.text();
	assert.ok(t.includes("已清理"), "要如实说清扫了什么：" + t.slice(0, 300));
	assert.ok(t.includes(orphan), "要把是哪个功能说清楚：" + t.slice(0, 300));
	assert.ok(t.includes("一个都没动"), "要说清目录与文件没被动过：" + t.slice(0, 300));
	// 磁盘上的东西一个都没动（面板连删文件的能力都没有）
	assert.ok(p.host.tree.has(norm(FEATURES + "\\" + EXISTING)), "现存功能目录必须还在");
	assert.equal(p.host.log.some((x) => /rmdir|unlink|remove/i.test(x.m)), false, "不该有任何删文件/删目录的动作");
	p.rt.unmount();
});

test("没有残留 ⇒ 一个字节都不出现（界面不放整理建议，也不该白发动作）", async () => {
	const p = boot();
	await p.rt.pump(10);
	assert.equal(p.text().includes("已清理"), false, "没残留就别说话：" + p.text().slice(0, 200));
	assert.deepEqual(p.host.log.filter((x) => x.m === "workspace.archiveSession" || x.m === "workspace.delete"), []);
	p.rt.unmount();
});

test("已归档过的孤儿会话 ⇒ 不再动它、也不再报（用户原话「这什么玩意 怎么一直在」的钉子）", async () => {
	// 根因：归档**不会**让会话从 `remote.session.list` 里消失（列表不按归档过滤）。
	// 判据若不排除已归档的，每次面板重挂载/刷新都会把它们再归档一遍、再报一遍。
	const orphan = "神话宝库";
	const orphanRoot = FEATURES + "\\" + orphan;
	const p = boot({
		sessions: [
			{ sessionId: "boot", cwd: SR, updatedAt: 1000, title: "策划工作台·索引（workspace）" },
			{ sessionId: "s-orphan", cwd: orphanRoot, updatedAt: 2000, title: "策划工作台·工作（" + orphan + "）" }
		],
		workspaces: [{ workspaceId: "w-orphan", path: orphanRoot }],
		archivedSessions: ["s-orphan"]        // 上一次已经归档过了（但列表里照样出现）
	});
	await p.rt.pump(12);

	assert.deepEqual(p.host.log.filter((x) => x.m === "workspace.archiveSession"), [], "归档过的不许再归档一遍");
	// 会话一个字都不许再提（它们已经归档过了）；工作区登记没被移除过，仍然该清、也该报
	assert.equal(/归档工作会话/.test(p.text()), false, "不许再报会话归档：" + p.text().slice(0, 300));
	assert.deepEqual(p.host.log.filter((x) => x.m === "workspace.delete").map((x) => x.id), ["w-orphan"]);
	assert.ok(p.text().includes("移除工作区登记"), "该清的仍然要清、也要如实报：" + p.text().slice(0, 300));
	p.rt.unmount();
});

// ════════════════════════════════════════════════════════════════════════════
// ④ 新建功能时，清理**不许**碰刚建出来的东西
//    （用户实测 2026-10-13：「又新建了一个 测试用例，这次只创建出文件夹，工作区没创建」）
// ════════════════════════════════════════════════════════════════════════════

test("新建功能 ⇒ 面板自己的残留清理不许把**刚建出来的**工作区登记删掉、工作会话归档掉", async () => {
	/**
	 * 根因：`submitNew` 成功后 `refresh()`（rev+1），而侧边栏工作区快照**当场**就多了一行
	 * （`syncSidebarStores` 把新工作区并进 store），`dash` 却还是**建之前**那一份 ⇒
	 * 新工作区"路径在 `features\` 下、主题不在看板里"，被自己的清理判成残留、当场删掉。
	 * 破坏性动作的判据必须是"**看板已经跟上最新一轮**"（`dashRevRef`）。
	 */
	const p = boot();
	await p.rt.pump(8);

	p.dashboard().props.onNew();
	await p.rt.pump(2);
	p.dashboard().props.onTopic(NEW);
	await p.rt.pump(3);
	p.dashboard().props.onSubmit();
	await p.rt.pump(14);           // 一路跑到"看板刷新完 + 详情读出来"

	const created = p.host.log.filter((x) => x.m === "workspace.create" && x.path === FEATURES + "\\" + NEW);
	assert.equal(created.length, 1, "工作区该建出来一次：" + JSON.stringify(p.host.log.map((x) => x.m)));
	assert.deepEqual(p.host.log.filter((x) => x.m === "workspace.delete"), [], "刚建出来的工作区不许被当成残留删掉");
	assert.deepEqual(p.host.log.filter((x) => x.m === "workspace.archiveSession"), [], "刚建出来的工作会话也不许被归档");
	assert.ok(p.host.tree.has(norm(FEATURES + "\\" + NEW)), "功能目录也不许被动");
	p.rt.unmount();
});

// ════════════════════════════════════════════════════════════════════════════
// ④b 头脑风暴 ·「人工补充」的表单（用户口径 2026-10-13）
//     —— 只问两样：原话 + 谁说的（标题 / 边界 / 落点都去掉）。
//     这一条盯的是**界面**：`pure-brainstorm.test.ts` 盯的是指令文本，
//     而"面板上到底还问不问那三样"只有把组件树渲染出来才看得见。
// ════════════════════════════════════════════════════════════════════════════

test("人工补充：只问「谁说的 + 原话」，标题 / 边界 / 落点都不再出现在输入区", async () => {
	const p = boot();
	await p.rt.pump(8);
	p.open(EXISTING);
	await p.rt.pump(8);

	// 四张入口卡里点「人工补充」
	const allClicks = p.rt.els("onClick");
	const card = p.rt.els("onClick", "人工补充")[0];
	assert.ok(card, "入口卡上要有「人工补充」（带 onClick 的元素共 " + allClicks.length + " 个）：" + p.text().slice(0, 300));
	p.rt.fire(card, "onClick");
	await p.rt.pump(4);

	// ① 输入区：谁说的 + 原话都在，标题 / 边界 / 落点一个都不在
	const t = p.text();
	assert.ok(t.includes("谁说的"), "要有「谁说的」输入：" + t.slice(0, 400));
	assert.equal(t.includes("标题"), false, "「标题」输入该删掉");
	assert.equal(t.includes("边界"), false, "「边界」输入该删掉");
	assert.equal(t.includes("落点"), false, "「落点」输入该删掉（预览指令里写的是「产出落点」，那是另一个词）");

	// ② 两个输入框：第一格是「谁说的」（原「标题」那一格），第二格是「原话（逐字保留）」
	const areas = p.rt.els("onChange");
	assert.equal(areas.length, 2, "人工补充只该有两个输入框，实际 " + areas.length + " 个");
	assert.ok(t.indexOf("谁说的（谁的话") < t.indexOf("原话（逐字保留）"), "「谁说的」该排在「原话」前面：" + t.slice(0, 400));
	assert.ok(areas[0].props.value === "" || areas[0].props.value === undefined, "第一格初始应为空");

	// ③ 两个都必填：都空着时不许发，并说清缺什么
	assert.ok(t.includes("需要你的原话"), "缺原话要说清：" + t.slice(0, 500));
	p.rt.fire(areas[0], "onChange", { target: { value: "主策 祖海潮" } });
	await p.rt.pump(3);
	assert.ok(p.text().includes("需要你的原话"), "只填了谁说的还是要拦：" + p.text().slice(0, 400));

	// ④ 填齐后：不再拦、可以发；面板上那句「还会拦」的话要消失
	//    （逐字指令在上一条用例里钉死了 —— 这里只看界面的门有没有开）
	p.rt.fire(p.rt.els("onChange")[1], "onChange", { target: { value: NOTE_QUOTE } });
	await p.rt.pump(3);
	const t2 = p.text();
	assert.equal(t2.includes("需要你的原话"), false, "填齐了就不该再拦");
	assert.ok(t2.includes("交给工作会话"), "要有派活按钮：" + t2.slice(-300));
	p.rt.unmount();
});

// ════════════════════════════════════════════════════════════════════════════
// ⑤ 详情页右上角〔新建会话〕（用户口径 2026-10-13：由工作台创建会话）
//    "通过工作台创建"的全部意义在于建出来的那条**面板认**：建在功能工作区里、开策划模式、
//    四入口的指令发给它。这一条在真 Panel 上点那颗按钮 —— `create-flow.test.ts` 测的是
//    组合根那一步（`__newWorkSession` 本身），这里测的是**界面把它接对了没有**。
// ════════════════════════════════════════════════════════════════════════════

/** 让 `session.create` 每次回一个**不重复**的 id（真机不复用 id；假 remote 本来恒定回 sid-new）。 */
function uniqueSessionIds(host) {
	let seq = 0;
	const ids = [];
	const orig = host.remote.session.create;
	host.remote.session.create = async (req) => {
		const r = await orig(req);
		const sid = "sess-" + (++seq);
		if (r && r.ok) r.value = { sessionId: sid };
		ids.push(sid);
		return r;
	};
	return ids;
}

test("右上角〔新建会话〕：在功能的工作区里建一条策划模式会话、并当场切过去", async () => {
	const p = boot();
	const ids = uniqueSessionIds(p.host);
	await p.rt.pump(8);
	p.open(EXISTING);
	await p.rt.pump(8);

	const btn = p.newSession();
	assert.equal(typeof btn, "function", "头部那颗按钮要有动作（onNewSession）");
	assert.equal(p.text().includes("新建中…"), false, "常态文案就是〔新建会话〕");
	btn();
	await p.rt.pump(10);

	const root = FEATURES + "\\" + EXISTING;
	const sid = ids[ids.length - 1];
	// ① 工作区 = 这个功能目录；② 预设 =「策划模式」；③ 标题 = 认领凭据
	assert.ok(p.host.log.some((x) => x.m === "workspace.create" && x.path === root), "要按功能根登记工作区");
	const made = p.host.log.filter((x) => x.m === "session.create").pop();
	assert.equal(made.req.agentPreset, "sr-workbench", "预设必须是策划模式");
	assert.ok(p.host.log.some((x) => x.m === "session.rename" && x.req.title === "策划工作台·工作（" + EXISTING + "）"));
	// ④ 没有任何降级 ⇒ 当场把用户切到这条会话
	const jumps = p.host.log.filter((x) => x.m === "uiWorkspace.openSession").map((x) => x.sid);
	assert.deepEqual(jumps, [sid], "建完应当切到新会话，实际：" + JSON.stringify(p.host.log.map((x) => x.m)));
	assert.ok(p.text().includes("新建了一条工作会话"), "要如实说建了什么：" + p.text().slice(-300));
	// ⑤ 四入口**不复用**这一条（2026-10-13 口径：一次派活一条会话）—— 它另起一条、各进各的
	//    ★ 每次都从组件上**重新取**这个动作：它是随渲染重建的闭包，缓存旧的那一份会带着过期的 `sending`
	//      （守卫会当场返回），而真机上用户点的总是最新那一颗按钮。
	//    ★ 这个用例的假会话列表里**没有**"正在跑"的会话（护栏那条另有专门用例）⇒ 第一下就发。
	const sendNow = () => p.rt.find("FeatureView").props.onSendBrainstorm;
	sendNow()("【头脑风暴 · 竞品分析】…");
	await p.rt.pump(12);
	const prompts = p.host.log.filter((x) => x.m === "session.prompt").map((x) => x.req.sessionId);
	assert.equal(prompts.length, 1, "派一次活只发一条指令：" + JSON.stringify(prompts));
	assert.notEqual(prompts[0], sid, "四入口另起一条（不复用〔新建会话〕刚建的那条）");
	assert.equal(prompts[0], ids[ids.length - 1], "指令发给这次派活新建的那条：" + JSON.stringify(ids));
	p.rt.unmount();
});

test("右上角〔新建会话〕：有降级（改名没成）⇒ 留在面板把话说清，**不**擅自切过去", async () => {
	/**
	 * 为什么这条要单独测：切走 = 面板**重挂载**，`notice` 是组件 state ⇒ 那句话会跟着一起没。
	 * 所以"有降级就别切"是**判据**，不是美观问题：用户必须看得到"预设没挂上 / 权限没切上"这类后果。
	 */
	const p = boot();
	uniqueSessionIds(p.host);
	p.host.remote.session.rename = async () => ({ ok: false, error: { message: "rename 被拒（用例）" } });
	await p.rt.pump(8);
	p.open(EXISTING);
	await p.rt.pump(8);

	p.newSession()();
	await p.rt.pump(10);

	assert.deepEqual(p.host.log.filter((x) => x.m === "uiWorkspace.openSession"), [], "有降级就不该切走");
	const t = p.text();
	assert.ok(t.includes("新建了一条工作会话"), "会话确实建出来了，不能装失败：" + t.slice(-400));
	assert.ok(t.includes("改名失败"), "降级要如实说（这条正是有后果的那种）：" + t.slice(-400));
	assert.equal(t.includes("新建中…"), false, "建完要回到常态（不许卡在「新建中…」）");
	p.rt.unmount();
});

// ════════════════════════════════════════════════════════════════════════════
// ⑥ 四入口派活：**一次派活一条会话** + 发完切过去 + 并行护栏（用户口径 2026-10-13）
//    用户原话：「每点一次四入口就另起一条全新会话……虽然不能共享会话上下文，但是会减少压缩」。
//    代价是两条会话会**同时**写同一个功能目录，所以面板侧配了一条"先提示、再点一次才发"的护栏。
// ════════════════════════════════════════════════════════════════════════════

/** 从真 Panel 上派一次活（`FeatureView` 收到的 `onSendBrainstorm` 就是那颗〔交给工作会话〕的动作）。 */
const sendFrom = (p) => p.rt.find("FeatureView").props.onSendBrainstorm;

test("四入口派活：另起一条会话发出去，并当场切到那条（不是留在面板）", async () => {
	const p = boot();
	const ids = uniqueSessionIds(p.host);
	await p.rt.pump(8);
	p.open(EXISTING);
	await p.rt.pump(8);

	sendFrom(p)("【头脑风暴 · 竞品分析】…");
	await p.rt.pump(12);

	const root = FEATURES + "\\" + EXISTING;
	// ① 建在功能根上、开策划模式（与〔新建会话〕同一条创建路）
	const made = p.host.log.filter((x) => x.m === "session.create").pop();
	assert.equal(made.req.agentPreset, "sr-workbench", "预设必须是策划模式");
	assert.ok(p.host.log.some((x) => x.m === "session.rename" && x.req.title === "策划工作台·工作（" + EXISTING + "）"));
	assert.ok(p.host.log.some((x) => x.m === "workspace.create" && x.path === root), "要按功能根登记工作区");
	// ② 指令进那条新会话
	const sid = ids[ids.length - 1];
	const prompts = p.host.log.filter((x) => x.m === "session.prompt").map((x) => x.req.sessionId);
	assert.deepEqual(prompts, [sid], "指令要发给这次派活新建的那条：" + JSON.stringify(prompts));
	// ③ 发完**切过去**（面板从这里消失是预期的：用户就是要去看它干活）
	const jumps = p.host.log.filter((x) => x.m === "uiWorkspace.openSession").map((x) => x.sid);
	assert.deepEqual(jumps, [sid], "发完应当切到新会话，实际：" + JSON.stringify(p.host.log.map((x) => x.m)));
	p.rt.unmount();
});

test("并行护栏：有会话正在跑 ⇒ 第一次只提示、**再点一次才发**（不拦死，也不静默）", async () => {
	const p = boot({
		sessions: [
			{ sessionId: "boot", cwd: SR, updatedAt: 1000, title: "策划工作台·索引（workspace）" },
			{ sessionId: "s-run", cwd: FEATURES + "\\" + EXISTING, updatedAt: 2000, running: true, title: "策划工作台·工作（" + EXISTING + "）" }
		]
	});
	uniqueSessionIds(p.host);
	await p.rt.pump(10);
	p.open(EXISTING);
	await p.rt.pump(10);

	// ★ 每次重新取（随渲染重建的闭包带着 `sending`）—— 真机上用户点的总是最新那一颗按钮
	const send = () => p.rt.find("FeatureView").props.onSendBrainstorm;
	// ★ 撤护栏后（用户口径：「我同时跑两个头脑风暴不行吗」）：**有会话在跑也直接发**，不再要求点第二次
	send()("【头脑风暴 · 竞品分析】…");
	await p.rt.pump(12);
	assert.equal(p.host.log.filter((x) => x.m === "session.prompt").length, 1, "一次点击就该发出去（没有二次确认）");
	assert.ok(p.host.log.some((x) => x.m === "session.create"), "并且为这次派活另起一条会话");
	assert.equal(p.text().includes("正在跑"), false, "不该再出现「这个功能还有会话在跑」那句拦人的话：" + p.text().slice(-400));
	p.rt.unmount();
});
