/**
 * `WorkspacePort` —— 整个规格**唯一的测试接缝**（spec「测试接缝：一个 WorkspacePort」）。
 *
 * 口径：
 *   · 文件侧四个方法是**只读**的，形状照抄 DSH 的 `remote.workspaceFiles` wire types
 *     （read / list / stat / changes），所以生产实现是薄适配，替换实现是直读 node:fs。
 *   · 指令侧五个方法是**唯一副作用出口**。上层（load / ui）不许直接碰 ctx.remote.*。
 *   · 端口之上全是纯函数：加载器只吃端口，产出视图模型，可对着真实工作区数据断言。
 *
 * 端口**绑定一个会话**（`read`/`list` 在 DSH 上都要 sessionId）：`createDshPort(ctx, sid)`。
 * 指令侧方法在签名里显式带 sessionId —— 因为它们的目标会话常常**不是**当前会话
 * （工作台把指令发给「该功能的工作会话」）。
 */

/** 读文本时的行窗口；行号 1-based（与 DSH `WorkspaceFileRange` 同义）。 */
export interface ReadRange {
	offset?: number;
	limit?: number;
}

/** 一页文本（DSH `WorkspaceFileText` 的子集 + `version` 供窄轮询核对）。 */
export interface ReadResult {
	/** 本页各行用 `\n` 连接，末行后不带终止符。 */
	text: string;
	/** 本页行数；`offset` 越过文件末行时为 0。 */
	lines: number;
	/** 本页是否含文件最后一行。 */
	eof: boolean;
	/** 不透明的新鲜度令牌（切回面板 / 核对是否过期用）。 */
	version: string;
	/** 文件在文件系统执行世界里的绝对路径（后端报告时给出）。 */
	absolutePath?: string;
}

/**
 * 目录项类型。
 * `unknown` 只在**兼容层**出现：旧的两条列举通道返回的形状带 `children`/`items`
 * 且可能没有 `type`/`kind`——那种项按"文件"处理（沿用迁移前的口径）。
 */
export type EntryType = "file" | "directory" | "other" | "unknown";

export interface DirEntry {
	name: string;
	type: EntryType;
	size?: number;
}

export interface ListResult {
	/** 被列举的目录（后端报告时给出）。 */
	path?: string;
	entries: DirEntry[];
	truncated: boolean;
}

export interface StatResult {
	absolutePath: string;
	version: string;
	bytes?: number;
}

/** `changes` 流的一帧：先 `ready`，之后是观测到的变更（照抄 DSH `WorkspaceFileWatchFrame`）。 */
export type ChangeEvent =
	| { kind: "ready" }
	| { kind: "change"; change: { absolutePath: string; version: string } | { absolutePath: string; absent: true } };

/** DSH Remote 调用的统一返回形状（调用失败**不抛**，而是回一个 `{ok:false}`）。 */
export type RemoteError = { code?: string; message?: string };
export type RemoteOutcome<T = unknown> =
	| { ok: true; value?: T; error?: undefined }
	| { ok: false; value?: undefined; error: RemoteError };

export interface CreateSessionRequest {
	/** 与 `cwd` **互斥**（host 明确拒绝两者同时给）。 */
	workspaceId?: string;
	cwd?: string;
	agentPreset?: string;
}

export interface WorkspacePort {
	// ── 文件侧：只读四法 ────────────────────────────────────────────────
	/** 读一页文本。失败**抛错**（`optional` 之类的容错留给加载器）。 */
	readText(path: string, range?: ReadRange, signal?: AbortSignal): Promise<ReadResult>;
	/** 列一层目录（两条通道都试）。失败抛错。 */
	listDir(path: string, signal?: AbortSignal): Promise<ListResult>;
	stat(path: string, signal?: AbortSignal): Promise<StatResult>;
	/** 变更订阅：先 `ready`，之后是观测到的变更帧。 */
	changes(signal?: AbortSignal): AsyncIterable<ChangeEvent>;

	// ── 指令侧：唯一副作用出口（五法） ──────────────────────────────────
	prompt(sessionId: string, text: string): Promise<RemoteOutcome>;
	setPermission(sessionId: string, presetName: string): Promise<RemoteOutcome>;
	renameSession(sessionId: string, title: string): Promise<RemoteOutcome>;
	ensureWorkspace(path: string): Promise<RemoteOutcome>;
	createSession(request: CreateSessionRequest): Promise<RemoteOutcome>;
}
