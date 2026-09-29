/**
 * `WorkspacePort` 的生产实现 —— 薄薄一层适配，
 * 接在 DSH 的 `ctx.remote.workspaceFiles`（read / list / stat / changes）与
 * `ctx.remote.session` / `ctx.remote.commands` / `ctx.remote.workspace` 上。
 *
 * ★ Cordis 纪律（开发笔记坑 1 / 坑 2）：服务必须声明注入，**未注入的服务访问即同步抛错**。
 *   所以这里每个命名空间都经 `ns()` 取，取不到就给出"未注入"的可读错误；
 *   端口方法都是 `async`，同步抛错自动变成 rejected promise，上层不需要额外的 try/catch 包法。
 */

import type {
	ChangeEvent,
	CreateSessionRequest,
	DirEntry,
	EntryType,
	ListResult,
	ReadRange,
	ReadResult,
	RemoteOutcome,
	StatResult,
	WorkspacePort,
} from "./types.ts";

const msgOf = (e: unknown): string => String((e && (e as Error).message) || e);

/** 一条 Remote 调用失败时抛出的错误（把 `{ok:false,error}` 转成异常，供加载器统一处理）。 */
export class PortError extends Error {
	readonly code: string;
	constructor(what: string, error: { code?: string; message?: string } | undefined) {
		super(what + " 失败：" + ((error && (error.message || error.code)) || "返回失败"));
		this.name = "PortError";
		this.code = (error && error.code) || "";
	}
}

/** `{ok:true}` 就取 value，否则抛 `PortError`。 */
function unwrap<T>(what: string, result: { ok?: boolean; value?: T; error?: { code?: string; message?: string } } | undefined): T {
	if (result && result.ok === true) return result.value as T;
	throw new PortError(what, result && result.error);
}

/** 把一条列举通道的返回值归一成 `{entries, truncated}`（兼容 `entries` / `children` / `items` 三种形状）。 */
export function normalizeListing(value: unknown): ListResult {
	const v = (value || {}) as { path?: string; entries?: unknown[]; children?: unknown[]; items?: unknown[]; truncated?: boolean };
	const list = v.entries || v.children || v.items || [];
	const entries: DirEntry[] = [];
	for (const raw of list) {
		const x = (raw || {}) as { name?: unknown; type?: unknown; kind?: unknown; size?: unknown };
		const k = x.type || x.kind;
		const type: EntryType = k === "directory" ? "directory" : k === "file" ? "file" : k === undefined ? "unknown" : "other";
		if (typeof x.name === "string" && x.name.length > 0) {
			entries.push({ name: x.name, type, size: typeof x.size === "number" ? x.size : undefined });
		}
	}
	return { path: typeof v.path === "string" ? v.path : undefined, entries, truncated: !!v.truncated };
}

/**
 * 生产端口。
 * @param ctx - 插件上下文（`apply(ctx, config)` 的第一个参数）
 * @param sessionId - 端口绑定的会话 —— `read` / `list` 在 DSH 上都要它
 */
export function createDshPort(ctx: any, sessionId: string): WorkspacePort {
	/** 安全取一个 remote 命名空间（未注入 → 可读错误，而不是 `cannot get property … without inject`） */
	const ns = (name: string): any => {
		let remote: any;
		try {
			remote = ctx && ctx.remote;
		} catch (e) {
			throw new Error("访问 ctx.remote 抛错：" + msgOf(e));
		}
		let value: any;
		try {
			value = remote && remote[name];
		} catch (e) {
			throw new Error("remote." + name + " 未声明注入：" + msgOf(e));
		}
		return value;
	};

	/** 把「同步抛错 / rejected / `{ok:false}`」统一收成 `RemoteOutcome`（旧 probe.* 的同款口径） */
	const outcome = <T>(what: string, fn: () => Promise<T> | T): Promise<RemoteOutcome<T>> => {
		let p: Promise<T>;
		try {
			p = Promise.resolve(fn());
		} catch (e) {
			return Promise.resolve({ ok: false, error: { message: "同步抛错 " + msgOf(e) } });
		}
		return p.then(
			(r: any) => ({ ok: !!(r && r.ok), value: r && r.value, error: r && r.error }) as RemoteOutcome<T>,
			(e: unknown) => ({ ok: false, error: { message: msgOf(e) } }) as RemoteOutcome<T>,
		);
	};

	return {
		// ── 文件侧 ──────────────────────────────────────────────────────
		async readText(path: string, range?: ReadRange, signal?: AbortSignal): Promise<ReadResult> {
			const wf = ns("workspaceFiles");
			if (!wf || typeof wf.read !== "function") throw new Error("remote.workspaceFiles.read 不可用");
			return unwrap("读文件 " + path, await wf.read(sessionId, path, range, signal));
		},

		/**
		 * 目录列举：两条通道都试（开发笔记坑 3）。
		 *   ① `workspaceFiles.list(sessionId, path)` —— 会话端口，**仅当该目录在会话工作区内**才可列
		 *   ② `workspace.list(path)` —— 工作区无关端口（若部署提供）
		 */
		async listDir(path: string, signal?: AbortSignal): Promise<ListResult> {
			const wf = ns("workspaceFiles");
			if (wf && typeof wf.list === "function") {
				try {
					const r = await wf.list(sessionId, path, signal);
					if (r && r.ok === true) return normalizeListing(r.value);
				} catch (e) {
					/* 落到通道② */
				}
			}
			const ws = ns("workspace");
			if (ws && typeof ws.list === "function") {
				try {
					const r = await ws.list(path, signal);
					if (r && r.ok === true) return normalizeListing(r.value);
				} catch (e) {
					/* 继续 */
				}
			}
			throw new Error("无法列举目录：" + path);
		},

		async stat(path: string, signal?: AbortSignal): Promise<StatResult> {
			const wf = ns("workspaceFiles");
			if (!wf || typeof wf.stat !== "function") throw new Error("remote.workspaceFiles.stat 不可用");
			return unwrap("stat " + path, await wf.stat(sessionId, path, signal));
		},

		changes(signal?: AbortSignal): AsyncIterable<ChangeEvent> {
			const wf = ns("workspaceFiles");
			if (!wf || typeof wf.changes !== "function") throw new Error("remote.workspaceFiles.changes 不可用");
			// DSH 的帧形状是 `{kind:'ready'} | {kind:'change', change}` —— 与端口一致，直接转发
			return wf.changes(sessionId, signal) as AsyncIterable<ChangeEvent>;
		},

		// ── 指令侧（唯一副作用出口） ────────────────────────────────────
		/**
		 * 发一条指令。★ skill **不是**宿主命令：`/sr-gdd-fix …` 是**普通提示词**，
		 * 由 host 端解析 `/name` 并注入 skill 指令（开发笔记坑 9）。
		 * ★ 不挂 file block：上传件的 attachmentId 没有宿主路径，agent 读不到内容（坑 12）。
		 */
		prompt(sessionId: string, text: string): Promise<RemoteOutcome> {
			return outcome("session.prompt", () =>
				ns("session").prompt({
					requestId: "wb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
					sessionId: sessionId,
					mode: "queue",
					content: [{ type: "text", text: text }],
				}),
			);
		},

		/** 切权限预设（预设名如 `danger-full-access`；`workspace-write` 只允许写会话工作区之下）。 */
		setPermission(sessionId: string, presetName: string): Promise<RemoteOutcome> {
			return outcome("commands.execute /permission", () => ns("commands").execute(sessionId, "/permission " + presetName, []));
		},

		/** 给会话打可识别标题（工作会话按标题前缀认领，见 spec「三层会话」）。 */
		renameSession(sessionId: string, title: string): Promise<RemoteOutcome> {
			return outcome("session.rename", () => ns("session").rename({ sessionId: sessionId, title: title }));
		},

		/** 按路径查/建工作区（已存在时 `created:false` 并给出 workspaceId）。 */
		ensureWorkspace(path: string): Promise<RemoteOutcome> {
			return outcome("workspace.create", () => ns("workspace").create({ path: path }));
		},

		/**
		 * 建会话。★ host 明确拒绝同时给 `workspaceId` 与 `cwd`
		 * （"session.create accepts workspaceId or cwd, not both"）——给了 workspaceId 就用工作区自己的 path。
		 */
		createSession(request: CreateSessionRequest): Promise<RemoteOutcome> {
			return outcome("session.create", () => {
				const req = request.workspaceId
					? { workspaceId: request.workspaceId, agentPreset: request.agentPreset }
					: { cwd: request.cwd || void 0, agentPreset: request.agentPreset };
				return ns("session").create(req);
			});
		},
	};
}
