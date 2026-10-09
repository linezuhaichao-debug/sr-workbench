/**
 * 新建功能（v5 的机制核心）—— 在**真产物** `lib/client.js` 上跑。
 *
 * 为什么这一条必须有：`npm run smoke` 只证明"能加载、注册形状对"，**不碰组合根里的编排**；
 * 而"新建功能"恰恰是 v5 唯一会写盘的动作，它的顺序（目录 → 4 桶 → 工作区 → 会话 → 改名 → 权限 → 并入 store）
 * 一旦错位就会建出半个目录或落不下会话 —— 这类错只有真的跑一遍才看得见。
 *
 * 假的一层只有三样，其余全是真的：
 *   · 真 `apply()`、真组合根、真 `createFeature`（面板上〔建立〕按钮按下去调的就是它）；
 *   · 假 React（只够拿到面板组件与它的 props —— 本用例**不渲染界面**，渲染由 `npm run smoke:render` 管）；
 *   · 假 Remote（照宿主语义回话，并**逐条记日志**）。
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

/** 假 React：只要能 createElement 就够（我们要的是**组件被创建时的 props**）。 */
function makeReact() {
	const noop = () => void 0;
	const el = (type, props, ...children) => ({
		$$kind: "element", type,
		props: Object.assign({}, props || {}, { children: children.length === 1 ? children[0] : children })
	});
	return {
		createElement: el,
		cloneElement: (e) => e,
		isValidElement: (v) => !!(v && v.$$kind === "element"),
		Children: { map: (c, f) => (Array.isArray(c) ? c.map(f) : []), toArray: (c) => (Array.isArray(c) ? c : []) },
		createContext: (v) => ({ Provider: noop, Consumer: noop, _currentValue: v }),
		createRef: () => ({ current: null }),
		forwardRef: (f) => f, memo: (f) => f, lazy: (f) => f,
		Fragment: Symbol("Fragment"), StrictMode: Symbol("StrictMode"), Suspense: Symbol("Suspense"),
		Component: class { constructor(p) { this.props = p || {}; this.state = {}; } setState() {} render() { return this.props.children; } },
		PureComponent: class { constructor(p) { this.props = p || {}; this.state = {}; } setState() {} render() { return this.props.children; } },
		startTransition: (f) => f(),
		useState: (init) => [typeof init === "function" ? init() : init, noop],
		useReducer: (r, init) => [init, noop],
		useEffect: noop, useLayoutEffect: noop, useInsertionEffect: noop,
		useMemo: (f) => f(), useCallback: (f) => f,
		useRef: (v) => ({ current: v }),
		useContext: (c) => (c ? c._currentValue : void 0),
		useImperativeHandle: noop, useId: () => "id",
		useTransition: () => [false, (f) => f()],
		useDeferredValue: (v) => v,
		useSyncExternalStore: (_s, get) => get()
	};
}

/** 载入真产物，跑 apply，把 main 槽的组件与两条记录带回来。 */
function loadPlugin(remote, extras = {}) {
	const src = fs.readFileSync(BUNDLE, "utf8");
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
	new vm.Script(src, { filename: BUNDLE }).runInContext(sandbox, { timeout: 8000 });

	const React = makeReact();
	const mod = registrations[0].factory((id) => {
		if (id === "react") return React;
		if (id === "react/jsx-runtime") return { jsx: React.createElement, jsxs: React.createElement, Fragment: Symbol("Fragment") };
		throw new Error("用例里没预期的 require：" + id);
	});

	const injectCalls = [];
	const registered = [];
	const ctx = {
		slots: {
			inject: (name, fn) => { injectCalls.push({ name, fn }); return { dispose() {} }; },
			register: (options, component) => { registered.push({ options, component }); return { dispose() {} }; }
		},
		get: (name) => (extras.services || {})[name],
		effect: (fn) => { if (typeof fn === "function") fn(); },
		on() {},
		remote,
		logger: { info() {}, warn() {}, error() {}, debug() {} }
	};
	mod.apply(ctx, {});
	for (const call of injectCalls) if (typeof call.fn === "function") for (const _ of call.fn()) { /* register 已记录 */ }

	const main = registered.filter((r) => r.options.name === "main")[0];
	const panel = main.component({ useSessions: (s) => s({ ids: [], byId: {} }), useWorkspaces: (s) => s({ items: [] }) });
	// PanelBound 的产物是 <PanelErrorBoundary><Panel …/></PanelErrorBoundary>
	const inner = panel.props.children;
	return { mod, panelProps: inner.props, registered };
}

/**
 * 一份"照宿主语义回话"的假 Remote，逐条记日志。
 *
 * ★ 目录列举要**像真的一样**：不存在的目录**列不出来**（回 `ok:false`），
 *   否则 `inspectFeatureDir` 会把"不存在"看成"存在且为空" —— 那正好绕过新建功能的判据。
 * `opts.dirs` 预置虚拟目录；测试可以随时改（模拟"会话里的 agent 把目录建出来了"）。
 * `opts.promptEffect` 在 `session.prompt` 时执行（模拟 agent 干活）。
 */
function makeRemote(opts = {}) {
	const log = [];
	const dirs = new Map();
	const key = (p) => String(p).replace(/[\\/]+$/, "").replace(/\//g, "\\").toLowerCase();
	const put = (p, entries) => dirs.set(key(p), entries);
	put(SR, [{ name: "features", type: "directory" }]);              // SR 根下已有 features\
	put(FEATURES, opts.features || [{ name: "已有的功能", type: "directory" }]);
	for (const [p, entries] of Object.entries(opts.dirs || {})) put(p, entries);

	const remote = {
		__log: log,
		__fs: { put, key, dirs, keys: () => [...dirs.keys()] },
		workspaceFiles: {
			async read(sid, p) {
				if (String(p).endsWith("config.local.json")) {
					return { ok: true, value: { text: JSON.stringify({ sr_workspace: SR, config_root: "D:\\X\\planner" }), lines: 1, eof: true, version: "v1", absolutePath: p } };
				}
				return { ok: false, error: { message: "没有这个文件：" + p } };
			},
			async list(sid, p) {
				log.push({ m: "list", p });
				const k = key(p);
				if (!dirs.has(k)) return { ok: false, error: { code: "workspace-file/unreadable", message: "cannot list " + p } };
				return { ok: true, value: { path: p, entries: dirs.get(k), truncated: false } };
			},
			async stat(sid, p) { return { ok: true, value: { absolutePath: p, version: "v1" } }; }
		},
		workspace: {
			async create(req) {
				log.push({ m: "workspace.create", path: req && req.path });
				return { ok: true, value: { workspace: { workspaceId: "ws-1", path: req && req.path }, created: true } };
			}
		},
		session: {
			async create(req) {
				log.push({ m: "session.create", req });
				return { ok: true, value: { sessionId: "sid-new" } };
			},
			async rename(req) {
				log.push({ m: "session.rename", req });
				return { ok: true, value: { sessionId: req.sessionId, title: req.title } };
			},
			async list() { return { ok: true, value: { items: [] } }; },
			async prompt(req) {
				log.push({ m: "session.prompt", req });
				if (typeof opts.promptEffect === "function") await opts.promptEffect(req, { put, key, dirs });
				return { ok: true, value: { queued: true } };
			},
			async openWorkspacePath() { return { ok: true, value: { opened: true } }; }
		},
		commands: {
			async execute(sid, line) { log.push({ m: "commands.execute", sid, line }); return { ok: true, value: { text: "preset danger-full-access" } }; }
		},
		permissionPresets: {
			async catalog() { return { ok: true, value: { options: [], defaultOptions: [], defaultPreset: "danger-full-access" } }; }
		}
	};
	return { remote, log };
}

/**
 * 假的宿主目录原语（`uiWorkspace`）。
 * `mode`：
 *   · `"browse"`（默认）—— 像 browse 后端那样真的建目录；
 *   · `"native"` —— 像 Windows 上的实情那样**只有 pick、没有 createDirectory**（服务上不挂这个方法）；
 *   · `"unavailable"` —— 挂了这个方法但一调就抛 `directory-picker/unavailable`。
 */
function makeUiWorkspace(mode = "browse") {
	const made = [];
	const dirs = new Set([SR.toLowerCase()]);
	const service = { openSession() {} };
	if (mode !== "native") {
		service.createDirectory = async (parent, name) => {
			if (mode === "unavailable") {
				const e = new Error('directory browse failed: directory-picker/unavailable: directoryPicker.createDirectory needs the browse capability; the composed picker serves "native"');
				e.code = "directory-picker/unavailable";
				throw e;
			}
			const full = String(parent).replace(/[\\/]+$/, "") + "\\" + name;
			const key = full.toLowerCase();
			if (dirs.has(key)) { const e = new Error("已存在：" + full); e.code = "directory-exists"; throw e; }
			dirs.add(key);
			made.push(full);
			return full;
		};
	}
	return { made, dirs, service };
}

/** 把"会话里的 agent 建出了这 5 个目录"喂给假 Remote 的虚拟文件系统。 */
function agentCreatedDirs(remote, topic) {
	const root = FEATURES + "\\" + topic;
	remote.__fs.put(FEATURES, [{ name: "已有的功能", type: "directory" }, { name: topic, type: "directory" }]);
	remote.__fs.put(root, ["evidence", "analysis", "gdd", "decisions"].map((n) => ({ name: n, type: "directory" })));
}

const WAIT = { tries: 3, delayMs: 5 };   // 用例里把轮询压到毫秒级

test("新建功能：顺序 = 目录 → 4 桶 → 工作区 → 会话（策划模式）→ 改名 → 并入 store", async () => {
	const { remote, log } = makeRemote();
	const uw = makeUiWorkspace();
	const { panelProps } = loadPlugin(remote, { services: { uiWorkspace: uw.service } });

	// 先解析锚点（`createFeature` 要用 `sr_workspace`）
	const idx = await panelProps.__index({ rows: [{ id: "boot", cwd: "D:\\X" }], wsPaths: ["D:\\X"], archived: null });
	assert.equal(idx.ok, true, "锚点解析应当成功：" + JSON.stringify(idx));
	assert.equal(idx.srWs, SR);

	const r = await panelProps.__createFeature("新功能", { wsPaths: [], sid: idx.sid, scaffoldWait: WAIT });
	assert.equal(r.ok, true, JSON.stringify(r));
	assert.equal(r.root, FEATURES + "\\新功能");

	// ① 建目录：features\ → 功能目录 → 4 个桶（顺序即创建顺序）
	assert.deepEqual(uw.made, [
		FEATURES,
		FEATURES + "\\新功能",
		FEATURES + "\\新功能\\evidence",
		FEATURES + "\\新功能\\analysis",
		FEATURES + "\\新功能\\gdd",
		FEATURES + "\\新功能\\decisions"
	]);

	// ② 专属工作区 + ③ 会话（预设必须是「策划模式」那一行：id = sr-workbench）
	//   ★ 日志里前面还会有条目：`__index` 那一步会为**索引会话**建一条（它的工作区是 SR 根）
	//     —— 所以这里按"路径 / 标题"挑，不按调用顺序挑。
	const wsCall = log.filter((x) => x.m === "workspace.create" && x.path === FEATURES + "\\新功能")[0];
	assert.ok(wsCall, "工作区要按**功能根**登记：" + JSON.stringify(log.filter((x) => x.m === "workspace.create")));
	const sCall = log.filter((x) => x.m === "session.create").pop();
	assert.ok(sCall, "要建工作会话");
	assert.equal(sCall.req.workspaceId, "ws-1");
	assert.equal(sCall.req.agentPreset, "sr-workbench");
	assert.equal("cwd" in sCall.req, false, "workspaceId 与 cwd 互斥 —— 不许同时给");

	// ④ 改名成可认领的标题（下次靠它认回来）
	const rn = log.filter((x) => x.m === "session.rename" && x.req.title === "策划工作台·工作（新功能）")[0];
	assert.ok(rn, "工作会话要改成可认领的标题：" + JSON.stringify(log.filter((x) => x.m === "session.rename")));

	// ⑤ 全程**没有发过任何指令**（v5 的新建是本地动作）
	assert.deepEqual(log.filter((x) => x.m === "session.prompt"), [], "新建功能不该发指令");
});

test("新建功能：目录已存在 ⇒ 拒绝，且**一个字节都不建**（连 features\\ 都不动）", async () => {
	const { remote } = makeRemote();
	const uw = makeUiWorkspace();
	const { panelProps } = loadPlugin(remote, { services: { uiWorkspace: uw.service } });
	const idx = await panelProps.__index({ rows: [{ id: "boot", cwd: "D:\\X" }], wsPaths: ["D:\\X"], archived: null });

	const r = await panelProps.__createFeature("已有的功能", { wsPaths: [], sid: idx.sid, scaffoldWait: WAIT });
	assert.equal(r.ok, false);
	assert.ok(String(r.message).includes("已经有这个目录"), r.message);
	assert.deepEqual(uw.made, [], "连 features\\ 都不该建（冲突在校验阶段就拦住了）");
});

test("新建功能：「策划模式」预设没挂上 ⇒ 退一步建**不带预设**的会话，并如实说清少了什么", async () => {
	// host 拒绝未知 preset 时的真实形状：`session.create` 回 ok:false
	const { remote, log } = makeRemote();
	const origCreate = remote.session.create;
	remote.session.create = async (req) => {
		if (req.agentPreset) return { ok: false, error: { code: "unknown-agent-preset", message: "unknown agent preset: " + req.agentPreset } };
		return origCreate(req);
	};
	const uw = makeUiWorkspace();
	const { panelProps } = loadPlugin(remote, { services: { uiWorkspace: uw.service } });
	const idx = await panelProps.__index({ rows: [{ id: "boot", cwd: "D:\\X" }], wsPaths: ["D:\\X"], archived: null });

	const r = await panelProps.__createFeature("新功能", { wsPaths: [], sid: idx.sid, scaffoldWait: WAIT });
	assert.equal(r.ok, true, "不该因为预设没挂上就整个失败：" + JSON.stringify(r));
	const made = log.filter((x) => x.m === "session.create");
	assert.equal(made.length >= 2, true, "应当先带预设试一次、再不带预设试一次：" + made.length);
	assert.equal(made[made.length - 1].req.agentPreset, undefined, "最后一次是不带预设的");
	const noteText = (r.notes || []).join(" ");
	assert.ok(noteText.includes("策划模式"), "要如实说是哪个预设没挂上：" + noteText);
	assert.ok(noteText.includes("dsh.profile.bundles"), "要给出可执行的下一步（怎么修）：" + noteText);
	assert.ok(noteText.includes("决策记录契约"), "要说清后果：这条会话没有决策记录契约");
});

test("新建功能：主题名不合法 ⇒ 拒绝，并给出人话 + 下一步", async () => {
	const { remote } = makeRemote();
	const uw = makeUiWorkspace();
	const { panelProps } = loadPlugin(remote, { services: { uiWorkspace: uw.service } });
	const idx = await panelProps.__index({ rows: [{ id: "boot", cwd: "D:\\X" }], wsPaths: ["D:\\X"], archived: null });

	for (const bad of ["a/b", "  前后空格  ", "CON", ""]) {
		const r = await panelProps.__createFeature(bad, { wsPaths: [], sid: idx.sid, scaffoldWait: WAIT });
		assert.equal(r.ok, false, JSON.stringify(bad));
		assert.ok(String(r.message).length > 0 && String(r.next).length > 0, "拒绝也要给人话与下一步：" + JSON.stringify(bad));
	}
	assert.deepEqual(uw.made, []);
});

// ════════════════════════════════════════════════════════════════════════════
// 建目录的三条路（2026-10-09 实测缺陷：Windows 上 createDirectory 根本不存在）
// ════════════════════════════════════════════════════════════════════════════

test("建目录·路②：本机只有 native（没有 createDirectory）⇒ 让索引会话跑 PowerShell，再回读核对", async () => {
	const { remote, log } = makeRemote({ promptEffect: async (_req, fsx) => agentCreatedDirs(remote, "新功能") });
	const uw = makeUiWorkspace("native");        // 只有 pick，没有 createDirectory
	const { panelProps } = loadPlugin(remote, { services: { uiWorkspace: uw.service } });
	const idx = await panelProps.__index({ rows: [{ id: "boot", cwd: "D:\\X" }], wsPaths: ["D:\\X"], archived: null });

	const r = await panelProps.__createFeature("新功能", { wsPaths: [], sid: idx.sid, scaffoldWait: WAIT });
	assert.equal(r.ok, true, JSON.stringify(r));
	assert.deepEqual(uw.made, [], "native 后端建不了目录，一个都不该由它建");

	// 发给索引会话的正文：逐字的建目录命令
	const sent = log.filter((x) => x.m === "session.prompt")[0];
	assert.ok(sent, "应当把建目录的指令发给会话");
	assert.equal(sent.req.sessionId, idx.sid, "发给面板自己的索引会话（cwd 覆盖 SR 工作区）");
	const text = sent.req.content[0].text;
	assert.ok(text.includes("只建目录"), "正文要说明只做这一件事");
	assert.ok(text.includes("New-Item -ItemType Directory -Force"), "要给逐字的命令");
	assert.ok(text.includes(FEATURES + "\\新功能\\decisions"), "5 个目录要逐个列全");
	assert.ok(text.includes("不要") && text.includes("写"), "要写清不许写文件");
	assert.ok(String(r.notes.join(" ")).includes("索引会话"), "要如实说目录是谁建的：" + r.notes.join(" "));

	// 目录齐了之后，工作区与会话照常建
	const wsCall = log.filter((x) => x.m === "workspace.create" && x.path === FEATURES + "\\新功能")[0];
	assert.ok(wsCall, "目录齐了要接着建专属工作区");
	assert.ok(log.some((x) => x.m === "session.rename" && String(x.req.title).includes("工作（新功能）")), "并给策划模式工作会话命名（认领凭据）");
});

test("建目录·路②：createDirectory 抛 directory-picker/unavailable ⇒ 同样退到会话", async () => {
	const { remote, log } = makeRemote({ promptEffect: async () => agentCreatedDirs(remote, "新功能") });
	const uw = makeUiWorkspace("unavailable");   // 挂着方法但一调就抛（真机上的报错原文）
	const { panelProps } = loadPlugin(remote, { services: { uiWorkspace: uw.service } });
	const idx = await panelProps.__index({ rows: [{ id: "boot", cwd: "D:\\X" }], wsPaths: ["D:\\X"], archived: null });

	const r = await panelProps.__createFeature("新功能", { wsPaths: [], sid: idx.sid, scaffoldWait: WAIT });
	assert.equal(r.ok, true, JSON.stringify(r));
	assert.ok(String(r.notes.join(" ")).includes("native"), "要如实说本机只有 native：" + r.notes.join(" "));
	assert.ok(log.some((x) => x.m === "session.prompt"), "要退到会话那条路");
	assert.deepEqual(uw.made, [], "抛了的那条路不该留下任何目录");
});

test("建目录·路③：会话没建出来 ⇒ 如实说「回读没核对上」+ 给逐字命令，且**不去建工作区/会话**", async () => {
	const { remote, log } = makeRemote();        // promptEffect 不干活：模拟 agent 没做成
	const uw = makeUiWorkspace("native");
	const { panelProps } = loadPlugin(remote, { services: { uiWorkspace: uw.service } });
	const idx = await panelProps.__index({ rows: [{ id: "boot", cwd: "D:\\X" }], wsPaths: ["D:\\X"], archived: null });

	const r = await panelProps.__createFeature("新功能", { wsPaths: [], sid: idx.sid, scaffoldWait: WAIT });
	assert.equal(r.ok, false);
	assert.ok(String(r.message).includes("回读没核对上"), r.message);
	assert.ok(String(r.next).includes("New-Item"), "下一步要给可直接复制的命令：" + r.next);
	assert.ok(String(r.next).includes("再点一次"), "要说清建完之后怎么办：" + r.next);
	assert.deepEqual(log.filter((x) => x.m === "workspace.create" && x.path === FEATURES + "\\新功能"), [], "目录没齐就不该建工作区");
	// ★ 索引会话自己也会建一条（那是读通道，早于建目录就存在）—— 这里只该有它一条
	assert.equal(log.filter((x) => x.m === "session.create").length, 1, "不该建功能的工作会话");
	assert.equal(log.filter((x) => x.m === "session.rename" && String(x.req.title).includes("工作（")).length, 0, "也不该给功能工作会话命名");
});

test("建目录·续做：目录已在且**只有桶、没有文件** ⇒ 不重复建目录，直接接着建工作区与会话", async () => {
	const topic = "半途而废";
	const root = FEATURES + "\\" + topic;
	const { remote, log } = makeRemote({
		features: [{ name: "已有的功能", type: "directory" }, { name: topic, type: "directory" }],
		dirs: { [root]: ["evidence", "analysis", "gdd", "decisions"].map((n) => ({ name: n, type: "directory" })) }
	});
	const uw = makeUiWorkspace("native");
	const { panelProps } = loadPlugin(remote, { services: { uiWorkspace: uw.service } });
	const idx = await panelProps.__index({ rows: [{ id: "boot", cwd: "D:\\X" }], wsPaths: ["D:\\X"], archived: null });

	const r = await panelProps.__createFeature(topic, { wsPaths: [], sid: idx.sid, scaffoldWait: WAIT });
	assert.equal(r.ok, true, JSON.stringify(r));
	assert.deepEqual(log.filter((x) => x.m === "session.prompt"), [], "目录已经在，不该再让人去建");
	assert.ok(log.some((x) => x.m === "workspace.create" && x.path === root), "要接着建专属工作区");
	assert.ok(String(r.notes.join(" ")).includes("只有桶"), "要如实说这是按现成目录接着做的：" + r.notes.join(" "));
});

test("建目录·不续做：目录已在但**里面有文件** ⇒ 照旧按重名拒绝（那是真功能）", async () => {
	const topic = "真功能";
	const root = FEATURES + "\\" + topic;
	const { remote } = makeRemote({
		features: [{ name: "已有的功能", type: "directory" }, { name: topic, type: "directory" }],
		dirs: { [root]: [{ name: "evidence", type: "directory" }, { name: "联盟讨伐_20260923_定稿.md", type: "file" }] }
	});
	const uw = makeUiWorkspace("native");
	const { panelProps } = loadPlugin(remote, { services: { uiWorkspace: uw.service } });
	const idx = await panelProps.__index({ rows: [{ id: "boot", cwd: "D:\\X" }], wsPaths: ["D:\\X"], archived: null });

	const r = await panelProps.__createFeature(topic, { wsPaths: [], sid: idx.sid, scaffoldWait: WAIT });
	assert.equal(r.ok, false);
	assert.ok(String(r.message).includes("已经有这个目录"), r.message);
});

test("头脑风暴：四入口的指令发给**本功能的工作会话**（新建一条、带上标题）", async () => {
	const { remote, log } = makeRemote();
	const uw = makeUiWorkspace();
	const { panelProps } = loadPlugin(remote, { services: { uiWorkspace: uw.service } });
	// 先解析锚点（`__index` 会顺手建一条**索引会话** —— 下面按调用语义挑，不按顺序挑）
	await panelProps.__index({ rows: [{ id: "boot", cwd: "D:\\X" }], wsPaths: ["D:\\X"], archived: null });

	const root = FEATURES + "\\新功能";
	const r = await panelProps.__sendBrainstorm(root, "【头脑风暴 · 竞品分析】…");
	assert.equal(r.ok, true, JSON.stringify(r));

	const made = log.filter((x) => x.m === "session.create")[0];
	assert.ok(made, "认不着就新建一条工作会话");
	assert.equal(made.req.agentPreset, "sr-workbench");
	const sent = log.filter((x) => x.m === "session.prompt")[0];
	assert.ok(sent && sent.req.sessionId === "sid-new", JSON.stringify(sent));
	assert.equal(sent.req.content[0].text, "【头脑风暴 · 竞品分析】…", "发出去的正文逐字就是面板上那段");
	assert.equal(sent.req.mode, "queue", "忙碌时排队而不是丢");
});

test("面板不写盘：整个组合根里没有一处写文件内容的调用", () => {
	const src = fs.readFileSync(BUNDLE, "utf8");
	for (const forbidden of ["writeFile", "appendFile", "workspaceFiles.write", "removeItem", "deleteFile", "rmdir", "unlink"]) {
		assert.equal(src.includes(forbidden), false, "产物里不该出现写/删文件的能力：" + forbidden);
	}
	// ★ 面板现在**一处写入都没有**：路径那行从〔复制〕改成〔打开路径〕之后，连剪贴板也不碰了
	assert.equal(src.includes("clipboard"), false, "面板不该碰剪贴板（路径行是「打开路径」，不是「复制」）");
	// 唯一的建目录能力来自宿主原语
	assert.ok(src.includes("createDirectory"), "建目录走 uiWorkspace.createDirectory");
});

test("界面不占位：整理建议类的提示不顶在界面上（用户口径）", () => {
	const src = fs.readFileSync(BUNDLE, "utf8");
	// ① 「侧边栏里有 N 条索引会话」那句整理建议已经删掉（面板照旧用最新那条，功能不受影响）
	//   ★ 断言要盯**代码**（`note.push(...)`）而不是关键词 —— 注释里解释"为什么删了"也会带那几个字
	assert.equal(src.includes('note.push("侧边栏里有 '), false, "不该再 push「侧边栏里有 N 条索引会话」");
	assert.equal(src.includes("（多半是并行刷新时各建了一条）"), false, "那句整理建议整体删掉，不留半句");
	// ② 决策记录的「条目格式」模板不再常驻（只在文件不存在 / 没有条目时渲染）
	assert.equal(src.includes("时间（年月日时分秒）+ 决策内容；只在文件末尾追加"), true, "模板文案还在（空文件时要用）");
	assert.equal(/h\(Card, \{ key: "f", title: "条目格式"/.test(src), false, "模板卡不该无条件渲染（要包在 showFormat 判断里）");
	assert.ok(src.includes("showFormat"), "要有 showFormat 这个条件");
	// ③ 「最终产物」卡片头与「这个功能的 4 个桶」两整块按用户口径删掉（断言盯代码，不盯注释）
	assert.equal(src.includes('title: "这个功能的 4 个桶"'), false, "「这个功能的 4 个桶」卡不该还在");
	assert.equal(src.includes('note: "只有四类：'), false, "「最终产物」卡片头那行说明不该还在");
	assert.equal(src.includes('title: "最终产物"'), false, "最终产物不再有卡片标题（页签已经写着）");
	// ④ 路径那行的按钮是「打开路径」
	assert.ok(src.includes('}, "打开路径")'), "路径行的按钮应当是「打开路径」");
	// ③ 故障类提示**不能**被一起删掉（那是"不假装知道"的底线）
	for (const keep of ["没读到 sr 配置", "会话列表读取失败", "没能把这条工作会话切到完全权限"]) {
		assert.ok(src.includes(keep), "故障类提示要留着：" + keep);
	}
});
