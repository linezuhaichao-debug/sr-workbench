/**
 * `WorkspacePort` 的**测试替身**：文件侧直接用 `node:fs` 读**真实工作区**
 * （不录制 fixture —— 录制件会把"真实文件里的怪形状"一起录成"正常"）；
 * 指令侧 = **记录器**：记下收到的指令文本与参数，不真的发出。
 *
 * ★ 分页口径照 DSH（`WorkspaceFileText`）：行号 1-based，末行由结尾的 `\n` 终止
 *   （即 `"a\nb\n"` 是 2 行，不是 3 行）。
 * ★ 列举口径照 DSH：目录列举**限定在工作区内**。`roots` 就是替身的工作区根；
 *   不给 `roots` = 不设限（离线跑整台机器的数据用）。
 */

import fs from "node:fs";
import path from "node:path";

import type { DirEntry, ListResult, ReadRange, ReadResult, RemoteOutcome, StatResult, WorkspacePort } from "./types.ts";

/** 一次指令侧调用的留痕。 */
export interface RecordedCall {
	method: "prompt" | "execCommand" | "renameSession" | "ensureWorkspace" | "createSession";
	args: unknown[];
}

export interface Recorder {
	readonly calls: RecordedCall[];
	/** 只记 `prompt` 的指令文本（指令协议回归网最常用的一条）。 */
	instructions(): string[];
	clear(): void;
}

export function createRecorder(): Recorder {
	const calls: RecordedCall[] = [];
	return {
		calls,
		instructions: () => calls.filter((c) => c.method === "prompt").map((c) => String(c.args[1])),
		clear: () => {
			calls.length = 0;
		}
	};
}

export interface FsPortOptions {
	/** 允许列举的工作区根（绝对路径）。为空 = 不设限。 */
	roots?: string[];
	/** 指令侧记录器；不传就内部建一个（`port.recorder` 始终可用）。 */
	recorder?: Recorder;
	/** `createSession` 要返回的 sessionId（测试要拿到一条可用的会话 id）。 */
	sessionId?: string;
}

export type FsPort = WorkspacePort & { readonly recorder: Recorder };

/** 一次读文本的分页（与 DSH 的 maxLines 默认口径一致）。 */
const MAX_LINES = 5000;

function page(text: string, range?: ReadRange, absolutePath?: string, version?: string): ReadResult {
	const all = text.split(/\r?\n/);
	// 结尾的 `\n` 只终止最后一行，不新起一个空行
	if (all.length > 0 && all[all.length - 1] === "") all.pop();
	const offset = Math.max(1, Math.trunc(Number(range && range.offset) || 1));
	const limit = Math.min(MAX_LINES, Math.max(1, Math.trunc(Number(range && range.limit) || MAX_LINES)));
	const slice = all.slice(offset - 1, offset - 1 + limit);
	const consumed = offset - 1 + slice.length;
	return {
		text: slice.join("\n"),
		lines: slice.length,
		eof: consumed >= all.length,
		version: version === undefined ? "" : version,
		absolutePath
	};
}

const within = (roots: string[] | undefined, target: string): boolean => {
	if (!roots || roots.length === 0) return true;
	const t = path.resolve(target).toLowerCase();
	return roots.some((r) => {
		const root = path.resolve(r).toLowerCase();
		return t === root || t.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
	});
};

/**
 * 建一个文件侧直读 `node:fs`、指令侧只记录不发出的端口替身。
 *
 * @param options.roots - 允许列举的工作区根；不在其中 → 列举失败（照 DSH「outside-workspace」口径）
 */
export function createFsPort(options: FsPortOptions = {}): FsPort {
	const recorder = options.recorder || createRecorder();
	const roots = options.roots;
	/** 版本串照实测的宿主形状：`dev:ino:size:mtimeNs:ctimeNs`（面板只把它当**不透明**串比对）。 */
	const versionOf = (p: string): string => {
		const st = fs.statSync(p, { bigint: true });
		return String(st.dev) + ":" + String(st.ino) + ":" + String(st.size) + ":" + String(st.mtimeNs) + ":" + String(st.ctimeNs);
	};

	const record = (method: RecordedCall["method"], args: unknown[]): RemoteOutcome => {
		recorder.calls.push({ method, args });
		return { ok: true, value: { recorded: true } };
	};

	return {
		recorder,

		async readText(p: string, range?: ReadRange): Promise<ReadResult> {
			const abs = path.resolve(String(p));
			let text: string;
			try {
				text = fs.readFileSync(abs, "utf8");
			} catch (e) {
				throw new Error("读文件失败：" + abs + " · " + String((e && (e as Error).message) || e));
			}
			return page(text, range, abs, versionOf(abs));
		},

		async listDir(p: string): Promise<ListResult> {
			const abs = path.resolve(String(p));
			if (!within(roots, abs)) throw new Error("目录在替身工作区之外：" + abs);
			let rows: fs.Dirent[];
			try {
				rows = fs.readdirSync(abs, { withFileTypes: true });
			} catch (e) {
				throw new Error("列举目录失败：" + abs + " · " + String((e && (e as Error).message) || e));
			}
			const entries: DirEntry[] = rows
				.map((d) => {
					const type = d.isDirectory() ? "directory" : "file";
					let size: number | undefined;
					if (type === "file") {
						try {
							size = fs.statSync(path.join(abs, d.name)).size;
						} catch (e) {
							size = undefined;
						}
					}
					return { name: d.name, type: type as DirEntry["type"], size } as DirEntry;
				})
				// 后端给的是"稳定的名字序"，这里照做
				.sort((a, b) => (a.name < b.name ? -1 : 1));
			return { path: abs, entries, truncated: false };
		},

		async stat(p: string): Promise<StatResult> {
			const abs = path.resolve(String(p));
			return { absolutePath: abs, version: versionOf(abs), bytes: Number(fs.statSync(abs, { bigint: true }).size) };
		},

		// ── 指令侧：只记录，不发出 ────────────────────────────────────
		async prompt(sessionId: string, text: string): Promise<RemoteOutcome> {
			return record("prompt", [sessionId, text]);
		},
		async execCommand(sessionId: string, line: string): Promise<RemoteOutcome> {
			return record("execCommand", [sessionId, line]);
		},
		async renameSession(sessionId: string, title: string): Promise<RemoteOutcome> {
			return record("renameSession", [sessionId, title]);
		},
		async ensureWorkspace(p: string): Promise<RemoteOutcome> {
			return record("ensureWorkspace", [p]);
		},
		async createSession(request: unknown): Promise<RemoteOutcome> {
			recorder.calls.push({ method: "createSession", args: [request] });
			return { ok: true, value: { sessionId: options.sessionId || "sid-fake" } };
		}
	};
}
