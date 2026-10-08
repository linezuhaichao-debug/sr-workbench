/**
 * 加载层的读原语 —— **只吃 port**，只收绝对路径；不写任何东西。
 *
 * ★ 分页读整文本：`read` 在 DSH 上按行分页（`maxLines` 默认 5000），所以要循环到 `eof`。
 * ★ 目录列举的容错口径与迁移前**逐字一致**：
 *   `optional = true` 时"列不出来"就是空数组（功能目录缺 buckets 是常态），
 *   否则抛错——由调用方决定要不要降级。
 */

import type { ListResult, WorkspacePort } from "../port/types.ts";

/** 目录列举返回值 → 文件名（只取文件） */
export function fileNamesOf(listing: ListResult | undefined): string[] {
	const e = (listing && listing.entries) || [];
	return e
		.filter((x) => x.type === "file" || x.type === "unknown")
		.map((x) => x.name)
		.filter((n) => typeof n === "string" && n.length > 0);
}

/** 目录列举返回值 → 子目录名（与 fileNamesOf 互补） */
export function dirNamesOf(listing: ListResult | undefined): string[] {
	const e = (listing && listing.entries) || [];
	return e
		.filter((x) => x.type === "directory")
		.map((x) => x.name)
		.filter((n) => typeof n === "string" && n.length > 0);
}

/** 列一层目录（只取文件）。`optional` 时列不出来返回 `[]`。 */
export async function listFiles(port: WorkspacePort, absPath: string, signal: AbortSignal | undefined, optional: boolean): Promise<string[]> {
	try {
		return fileNamesOf(await port.listDir(absPath, signal));
	} catch (e) {
		if (optional) return [];
		throw new Error("无法列举目录：" + absPath);
	}
}

/** 列一层目录（只取子目录）。`optional` 时列不出来返回 `[]`。 */
export async function listDirs(port: WorkspacePort, absPath: string, signal: AbortSignal | undefined, optional: boolean): Promise<string[]> {
	try {
		return dirNamesOf(await port.listDir(absPath, signal));
	} catch (e) {
		if (optional) return [];
		throw new Error("无法列举目录：" + absPath);
	}
}

/** 只读文件开头 14 行（读 frontmatter 够用）。读不到返回 `null`。 */
export async function readHead(port: WorkspacePort, path: string, signal?: AbortSignal): Promise<string | null> {
	try {
		const r = await port.readText(path, { offset: 1, limit: 14 }, signal);
		return r.text;
	} catch (e) {
		return null;
	}
}

/**
 * 读一份**身份声明**（`features\<主题>\feature.json`）。
 * ★ 窗口给到 60 行：写出来只有 6 行，但**别名多的功能**（合并/多次改名）行数会长，
 *   14 行那种 frontmatter 窗口会把 JSON 截断成"读不出来"（假缺件）。读不到返回 `null`。
 */
export async function readIdentityText(port: WorkspacePort, root: string, signal?: AbortSignal): Promise<string | null> {
	try {
		const r = await port.readText(String(root).replace(/[\\/]+$/, "") + "/feature.json", { offset: 1, limit: 60 }, signal);
		return r && typeof r.text === "string" ? r.text : null;
	} catch (e) {
		return null;
	}
}

/** 分页读完整文本（读了半截就失败时，返回已经读到的部分，口径与迁移前一致）。 */
export async function readAllText(
	port: WorkspacePort,
	path: string,
	signal: AbortSignal | undefined,
	capLines?: number,
): Promise<string | null> {
	const cap = capLines || 20000;
	let offset = 1;
	const out: string[] = [];
	let guard = 0;
	while (guard++ < 40) {
		let r;
		try {
			r = await port.readText(path, { offset: offset, limit: 2000 }, signal);
		} catch (e) {
			return out.length ? out.join("\n") : null;
		}
		out.push(r.text);
		if (r.eof || r.lines === 0) break;
		offset += r.lines;
		if (offset > cap) break;
	}
	return out.join("\n");
}
