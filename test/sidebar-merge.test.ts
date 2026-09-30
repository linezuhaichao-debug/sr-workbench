/**
 * 缺陷回归网 · 2026-09-30「面板建完新工作区 + 新会话，侧边栏要按 F5 才看得见」。
 *
 * ── 这条用例在**真产物** `lib/client.js` 上跑（就是 3080 服务的那一份）────────────
 *   假的一层只有三样，其余全是真的：真的 `apply()`、真的组合根、真的 `fixRunner`
 *   （面板上「发到工作会话」按钮按下去调的就是它）。
 *
 *   · 假 Remote（**全部记日志**）：照 host 的真实语义回话 ——
 *     `session.create({workspaceId})` 把会话挂在那个工作区下（cwd = 工作区 path）、
 *     `session.rename` 把标题写进 `projections.values.title`、
 *     `workspace.create({path})` **按路径幂等**（已存在返回当前视图，`sessionIds` 是**派生**的：
 *     cwd 等于该 path 的会话就属于它 —— 照 `dsh-workspace` 的 `sessionIds` getter）。
 *   · 假 store：**照抄官方那两处的语义**
 *       `workspaces.create` → `upsert(result.value.workspace)`（官方 client.js:51-55）
 *       `sessions.refresh`   → `session.list` 重拉基线并装进 store（官方 client.js:2603 refreshList）
 *     于是"补刀之后 store 里有什么"就是"侧边栏会看到什么"。
 *   · 假 React：只够模块初始化并直接取到面板组件产物的 props（本用例**不**渲染界面；
 *     渲染期的行为由 `outputs\.scratch\策划工作台\_15-render-fix.mjs` 那套跑）。
 *
 * ── 断言的就是缺陷本身 ──────────────────────────────────────────────────────
 *   ① 建完之后**确实触发了**官方那两刀（顺序：workspaces.create → sessions.refresh）；
 *   ② 两刀之后 store 里真的有了那个分组与那一行（= 不用 F5）；
 *   ③ 原来的功能路径没被改坏：只建一条会话、标题照旧、指令照发一次。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const REPO = path.resolve(import.meta.dirname, "..");
const TARGET = path.join(REPO, "lib", "client.js");

const SR_ROOT = "D:\\TimeMachine\\GameDesignOS\\workspace";
const FEATURE_ROOT = path.join(SR_ROOT, "features", "联盟悬赏");
const FINAL_ABS = path.join(FEATURE_ROOT, "gdd", "联盟悬赏_20260923_定稿.md");
const WORK_TITLE = "策划工作台·工作（联盟悬赏）";
const INDEX_TITLE = "策划工作台·索引";

/** 面板里 `DEFAULT_ROOT` 的同一份兜底根（浏览器半侧收不到插件 config，坑 7）。 */
const DEFAULT_ROOT = "D:\\TimeMachine";

// ── 假 React（只够模块初始化 + 直接取组件产物的 props）───────────────────────
class FakeComponent {
	props: Record<string, unknown>;
	state: Record<string, unknown> = {};
	constructor(props: Record<string, unknown> = {}) { this.props = props; }
	setState(patch: unknown): void {
		const next = typeof patch === "function" ? (patch as (s: unknown) => object)(this.state) : patch;
		Object.assign(this.state, next);
	}
	render(): unknown { return null; }
}

interface El { type: unknown; props: Record<string, unknown> }

const FakeReact = {
	createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): El => ({
		type: type,
		props: Object.assign({}, props || {}, { children: children.length === 1 ? children[0] : children })
	}),
	Component: FakeComponent,
	Fragment: Symbol("Fragment"),
	createContext: (v: unknown) => ({ Provider: (p: unknown) => p, _v: v }),
	useState: (init: unknown) => [typeof init === "function" ? (init as () => unknown)() : init, () => {}],
	useEffect: () => {},
	useLayoutEffect: () => {},
	useInsertionEffect: () => {},
	useReducer: (_r: unknown, init: unknown) => [init, () => {}],
	useMemo: (f: () => unknown) => f(),
	useCallback: (f: unknown) => f,
	useRef: (v: unknown) => ({ current: v }),
	useContext: (c: { _v?: unknown }) => (c ? c._v : void 0),
	useSyncExternalStore: (_s: unknown, g: () => unknown) => g(),
	useId: () => "id",
	useTransition: () => [false, (f: () => void) => f()],
	useDeferredValue: (v: unknown) => v,
	useImperativeHandle: () => {},
	cloneElement: (el: unknown) => el,
	isValidElement: () => true,
	Children: { map: (c: unknown, f: (x: unknown) => unknown) => (Array.isArray(c) ? c.map(f) : []), toArray: (c: unknown) => (Array.isArray(c) ? c : []) },
	memo: (f: unknown) => f,
	forwardRef: (f: unknown) => f
};

// ── host 侧镜像（让假 Remote 的行为与真 host 一致）──────────────────────────
interface HostSession {
	sessionId: string;
	cwd: string;
	updatedAt: number;
	running: boolean;
	blank: boolean;
	projections: { kind: string; asOfSeq: number; values: { title?: string } };
}
interface HostWorkspace { workspaceId: string; path: string; title: string; createdAt: string; updatedAt: string }

function makeEnv() {
	const calls: string[] = [];
	const sessions: HostSession[] = [];
	const wsByPath = new Map<string, HostWorkspace>();
	let wsSeq = 0;
	let sesSeq = 0;

	const norm = (p: string) => path.resolve(String(p)).toLowerCase();

	/** 照 `dsh-workspace` 的 `WorkspaceEntity.sessionIds` getter：cwd 等于工作区 path 的会话就属于它 */
	const view = (w: HostWorkspace) => Object.assign({}, w, {
		sessionIds: sessions.filter((s) => norm(s.cwd) === norm(w.path)).map((s) => s.sessionId)
	});

	const remote = {
		workspaceFiles: {
			async read() { calls.push("workspaceFiles.read"); return { ok: false, error: { code: "workspace-file/not-found", message: "no entry" } }; },
			async list() { calls.push("workspaceFiles.list"); return { ok: false, error: { code: "workspace-file/not-found", message: "no entry" } }; }
		},
		session: {
			async list() {
				calls.push("session.list");
				return { ok: true, value: { items: sessions.map((s) => Object.assign({}, s, { projections: { kind: s.projections.kind, asOfSeq: s.projections.asOfSeq, values: Object.assign({}, s.projections.values) } })) } };
			},
			async create(req: { workspaceId?: string; cwd?: string; agentPreset?: string }) {
				calls.push("session.create " + JSON.stringify(req));
				sesSeq += 1;
				const id = "session-new-" + String(sesSeq).padStart(4, "0");
				// 照 host：给了 workspaceId 就用工作区自己的 path 当 cwd，并把会话挂在它下面
				const ws = req.workspaceId === void 0 ? void 0 : wsByPath.get(req.workspaceId);
				const cwd = ws !== void 0 ? ws.path : String(req.cwd || "");
				sessions.push({ sessionId: id, cwd: cwd, updatedAt: Date.now(), running: false, blank: true, projections: { kind: "sequenced", asOfSeq: 0, values: {} } });
				return { ok: true, value: { sessionId: id, agentPreset: req.agentPreset } };
			},
			async rename(req: { sessionId: string; title: string }) {
				calls.push("session.rename " + req.sessionId + " " + req.title);
				const row = sessions.find((s) => s.sessionId === req.sessionId);
				// 照 host：标题是**投影**（客户端 store 行上的 title 要等它下来）
				if (row !== void 0) row.projections = { kind: "sequenced", asOfSeq: 1, values: { title: req.title } };
				return { ok: true, value: { title: req.title, seq: 1 } };
			},
			async prompt(req: { sessionId: string }) {
				calls.push("session.prompt " + req.sessionId);
				return { ok: true, value: { accepted: true } };
			},
			async openWorkspacePath() { return { ok: true, value: true }; }
		},
		workspace: {
			async create(req: { path: string }) {
				calls.push("remote.workspace.create " + req.path);
				const hit = Array.from(wsByPath.values()).find((w) => norm(w.path) === norm(req.path));
				if (hit !== void 0) return { ok: true, value: { workspace: view(hit), created: false } };
				wsSeq += 1;
				const made: HostWorkspace = {
					workspaceId: "ws-" + String(wsSeq), path: req.path, title: path.basename(req.path),
					createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
				};
				wsByPath.set(made.workspaceId, made);
				return { ok: true, value: { workspace: view(made), created: true } };
			}
		},
		agentPresets: { async list() { return { ok: true, value: { presets: [] } }; } },
		commands: { async list() { return { ok: true, value: { commands: [] } }; }, async execute() { return { ok: true, value: {} }; } },
		directoryPicker: { async pick() { return { ok: true, value: null }; } },
		fileUploads: { async upload() { return { ok: true, value: { file: {} } }; } }
	};

	// ── 假 store：**照官方那两处的语义** ─────────────────────────────────────
	interface WsStoreItem { workspaceId: string; path: string; title: string; createdAt: string; updatedAt: string; sessionIds: string[] }
	const wsItems: WsStoreItem[] = [];
	const sesIds: string[] = [];
	const sesById: Record<string, unknown> = {};

	const workspacesService = {
		list: {
			getSnapshot: () => ({ items: wsItems.slice(), archivedSessionIds: [], pinnedSessionIds: [], phase: "ready", state: "idle" }),
			subscribe: () => () => {}
		},
		/** 官方 `WorkspaceController.create`（client.js:393）→ `ClientWorkspaceModel.create`（:51）→ `upsert`（:53/287） */
		async create(input: { path: string }) {
			calls.push("workspaces.create " + input.path);
			const r = await remote.workspace.create({ path: input.path });
			const w = r.value.workspace as WsStoreItem;
			const at = wsItems.findIndex((it) => it.workspaceId === w.workspaceId);
			if (at < 0) wsItems.unshift(w);
			else wsItems[at] = w;
			return w;
		}
	};

	const sessionsService = {
		list: { getSnapshot: () => ({ ids: sesIds.slice(), byId: sesById, phase: "ready", projectionsBySession: {} }), subscribe: () => () => {} },
		/** 官方 `ClientSessions.refresh`（client.js:3258）→ `SessionManager.refreshList`（:2603）：`session.list` 重拉基线 */
		async refresh() {
			calls.push("sessions.refresh");
			const r = await remote.session.list({});
			const items = r.value.items as HostSession[];
			sesIds.length = 0;
			for (const k of Object.keys(sesById)) delete sesById[k];
			for (const s of items) {
				sesIds.push(s.sessionId);
				sesById[s.sessionId] = {
					id: s.sessionId, cwd: s.cwd, blank: s.blank, running: s.running,
					retainedBy: {}, projections: s.projections
				};
			}
		}
	};

	const services: Record<string, unknown> = {
		workspaces: workspacesService,
		sessions: sessionsService,
		uiSession: {},
		uiWorkspace: { openSession: () => {} }
	};

	const registered: { options: Record<string, unknown>; component: unknown }[] = [];
	const injects: { name: string; fn: () => Iterable<unknown> }[] = [];
	const ctx = {
		remote: remote,
		get: (name: string) => services[name],
		effect: () => {},
		on: () => {},
		logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
		slots: {
			inject: (name: string, fn: () => Iterable<unknown>) => { injects.push({ name: name, fn: fn }); return { dispose: () => {} }; },
			register: (options: Record<string, unknown>, component: unknown) => { registered.push({ options: options, component: component }); return { dispose: () => {} }; }
		}
	};

	return {
		ctx: ctx, remote: remote, calls: calls, sessions: sessions, wsByPath: wsByPath,
		wsItems: wsItems, sesIds: sesIds, sesById: sesById,
		registered: registered, injects: injects
	};
}

type Env = ReturnType<typeof makeEnv>;

/** 在假 ModuleLoader 里跑真产物，返回注册到 `main` 槽的那个组件（= `PanelBound`）。 */
function runBundle(env: Env): (props: Record<string, unknown>) => El {
	const src = fs.readFileSync(TARGET, "utf8");
	const loaded: { factory: (req: (id: string) => unknown) => { apply: (ctx: unknown, config: unknown) => void } }[] = [];
	const sandbox = {
		window: { __ModuleLoader__: { load: (r: never) => loaded.push(r) }, location: { origin: "http://127.0.0.1:3080" } },
		console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },
		setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval,
		queueMicrotask: queueMicrotask,
		URL: URL, URLSearchParams: URLSearchParams, TextEncoder: TextEncoder, TextDecoder: TextDecoder,
		AbortController: AbortController,
		Promise: Promise, JSON: JSON, Math: Math, Date: Date, Object: Object, Array: Array, String: String,
		Number: Number, Boolean: Boolean, Symbol: Symbol, Map: Map, Set: Set, WeakMap: WeakMap, WeakSet: WeakSet,
		RegExp: RegExp, Error: Error, TypeError: TypeError, RangeError: RangeError
		// ★ 刻意**不给** localStorage / navigator：面板对它们全都有 typeof 兜底（无缓存也能用）
	};
	Object.assign(sandbox, { globalThis: sandbox, self: sandbox });
	vm.createContext(sandbox);
	new vm.Script(src, { filename: TARGET }).runInContext(sandbox, { timeout: 10000 });
	assert.equal(loaded.length, 1, "__ModuleLoader__.load 应该只被调用一次");
	const mod = loaded[0].factory((id: string) => {
		if (id === "react") return FakeReact;
		if (id === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null, Fragment: Symbol("Fragment") };
		throw new Error("unexpected require: " + id);
	});
	mod.apply(env.ctx, {});
	for (const call of env.injects) for (const _ of call.fn()) { /* 注册已记录 */ }
	const main = env.registered.find((r) => r.options.name === "main");
	assert.ok(main !== void 0, "必须注册到 main 槽");
	return main.component as (props: Record<string, unknown>) => El;
}

/** `PanelBound` 的产物 = `h(PanelErrorBoundary, null, h(Panel, {…真实接线…}))` —— 取里层的 props */
function panelPropsOf(Component: (props: Record<string, unknown>) => El): Record<string, unknown> {
	const tree = Component({});
	const inner = tree.props.children as El;
	assert.ok(inner && inner.props && typeof inner.props.__fix === "function", "面板必须拿到 __fix（发到工作会话的入口）");
	assert.ok(typeof inner.props.__resolve === "function", "面板必须拿到 __resolve（索引会话）");
	return inner.props;
}

test("功能工作会话：建完之后补调官方两刀 → 新工作区分组 + 新会话行**当场**进 store（不用 F5）", async () => {
	const env = makeEnv();
	const props = panelPropsOf(runBundle(env));

	// 起步态：侧边栏该什么都没有（这正是用户报告里"当时看不见"的状态）
	assert.deepEqual(env.wsItems, [], "起步：workspaces store 里没有这个工作区");
	assert.deepEqual(env.sesIds, [], "起步：sessions store 里没有这条会话");

	const res = await (props.__fix as (srWs: string, req: unknown, extra: unknown) => Promise<Record<string, unknown>>)(
		SR_ROOT,
		{
			path: FINAL_ABS, ref: "§5 UI-M1 UE3",
			before: "| UE3 | 出刀按钮… |", intent: "改成「一键出刀」并加二次确认", impact: []
		},
		{ root: FEATURE_ROOT }
	);
	assert.equal(res.ok, true, "发送本身照旧成功：" + JSON.stringify(res.message || ""));
	const sid = String(res.sid || "");
	assert.ok(sid.startsWith("session-new-"), "拿到新建的会话 id：" + sid);

	// ① 确实触发了官方那两刀，且顺序对（先工作区行、再会话基线）
	const createAt = env.calls.findIndex((c) => c.startsWith("session.create "));
	const resolveAt = env.calls.findIndex((c) => c === "workspaces.create " + FEATURE_ROOT);
	const refreshAt = env.calls.findIndex((c) => c === "sessions.refresh");
	assert.ok(createAt >= 0, "建了会话：" + JSON.stringify(env.calls));
	assert.ok(resolveAt > createAt, "建完会话之后**补调了官方 `workspaces.create({path: 功能根})`：" + JSON.stringify(env.calls));
	assert.ok(refreshAt > resolveAt, "再补调官方 `sessions.refresh()`（重拉会话基线）：" + JSON.stringify(env.calls));

	// ② store 里真的有了分组与那一行（= 侧边栏当场就能渲染出来）
	const group = env.wsItems.find((w) => path.resolve(w.path).toLowerCase() === path.resolve(FEATURE_ROOT).toLowerCase());
	assert.ok(group !== void 0, "workspaces store 里出现了「联盟悬赏」这个工作区分组：" + JSON.stringify(env.wsItems));
	assert.ok(group.sessionIds.includes(sid), "分组认领了这条新会话（不会落进「未分组」）：" + JSON.stringify(group.sessionIds));
	assert.ok(env.sesIds.includes(sid), "sessions store 里出现了这一行：" + JSON.stringify(env.sesIds));
	const row = env.sesById[sid] as { projections?: { values?: { title?: string } } };
	assert.equal(row.projections?.values?.title, WORK_TITLE,
		"行上的标题（投影）也下来了 —— 侧边栏显示的就是它：" + JSON.stringify(row.projections));

	// ③ 原路径没坏：只为这个功能建一条会话、标题照旧、指令只发一次
	assert.equal(env.calls.filter((c) => c.startsWith("session.create ")).length, 1, "只建一条会话");
	assert.ok(env.calls.some((c) => c.startsWith("session.rename ") && c.includes(WORK_TITLE)), "照旧打可识别标题「" + WORK_TITLE + "」");
	assert.equal(env.calls.filter((c) => c.startsWith("session.prompt ")).length, 1, "指令只发一次");
	assert.ok(env.calls.some((c) => c === "session.create " + JSON.stringify({ workspaceId: "ws-1", agentPreset: "sr-workbench" })),
		"session.create 仍然只带 workspaceId + agentPreset（不给 cwd，坑 8）：" + JSON.stringify(env.calls.filter((c) => c.startsWith("session.create"))));

	// 记录器原文（"建完之后到底触发了哪些调用"的逐条证据，`npm test` 输出里能直接看到）
	console.log("【记录器】按下「发到工作会话」之后，实际调到的顺序：\n  " + env.calls.join("\n  "));
});

test("索引会话：同一条路也补两刀（新工作区 + 新会话都当场进 store）", async () => {
	const env = makeEnv();
	const props = panelPropsOf(runBundle(env));

	const got = await (props.__resolve as (opts: unknown) => Promise<Record<string, unknown>>)({});
	assert.equal(got.ok, true, "索引会话解析成功（没有真实会话可认领 → 新建）：" + JSON.stringify(got.error || ""));
	const sid = String(got.sid || "");
	assert.ok(sid.startsWith("session-new-"), "拿到新建的索引会话 id：" + sid);
	assert.equal(got.source, "created");

	assert.ok(env.calls.includes("workspaces.create " + DEFAULT_ROOT),
		"补调了 `workspaces.create({path: D:\\TimeMachine})`：" + JSON.stringify(env.calls));
	assert.ok(env.calls.includes("sessions.refresh"), "补调了 `sessions.refresh()`：" + JSON.stringify(env.calls));

	const group = env.wsItems.find((w) => path.resolve(w.path).toLowerCase() === path.resolve(DEFAULT_ROOT).toLowerCase());
	assert.ok(group !== void 0 && group.sessionIds.includes(sid), "索引工作区分组当场认领了它：" + JSON.stringify(env.wsItems));
	const row = env.sesById[sid] as { projections?: { values?: { title?: string } } };
	assert.equal(row.projections?.values?.title, INDEX_TITLE + "（timemachine）",
		"行标题 = 「" + INDEX_TITLE + "（<根目录名>）」：" + JSON.stringify(row.projections));
});

test("取不到官方客户端服务时：如实说「要刷新页面」，不装成已经即时生效", async () => {
	const env = makeEnv();
	const props = panelPropsOf(runBundle(env));
	// 模拟降级：把两个官方服务从 ctx 拿掉（老版本 / 服务没被提供）
	const services = (env.ctx as { get: (n: string) => unknown });
	services.get = () => void 0;

	const res = await (props.__fix as (srWs: string, req: unknown, extra: unknown) => Promise<Record<string, unknown>>)(
		SR_ROOT,
		{ path: FINAL_ABS, ref: "§10 AC1", before: "a", intent: "b", impact: [] },
		{ root: FEATURE_ROOT }
	);
	assert.equal(res.ok, true, "指令照旧发出去（降级不影响干活）");
	const note = String(res.note || "");
	assert.ok(note.includes("刷新页面"), "如实说清这次要刷新页面才看得见：" + note);
	assert.ok(!env.calls.includes("sessions.refresh") && !env.calls.includes("workspaces.create " + FEATURE_ROOT),
		"服务取不到就不硬调：" + JSON.stringify(env.calls));
});
