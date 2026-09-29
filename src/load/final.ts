/**
 * 定稿相关加载器：定稿全文（§6.2 定稿工作面）· 定稿 §5（界面图）· 设计资产索引。
 *
 * ★ 一律收**绝对路径** —— 面板不自己拼路径，路径由调用方从功能目录算出来，
 *   所以目录结构怎么变都不用改这里。
 */

import { parseFinalGdd } from "../pure/finalgdd.ts";
import { parseInterfaceSection } from "../pure/interface5.ts";
import type { WorkspacePort } from "../port/types.ts";
import { readAllText } from "./read.ts";

/** 读定稿全文并解析结构（设计 §6.2 定稿工作面）。 */
export async function loadFinal(port: WorkspacePort, absPath: string, signal?: AbortSignal): Promise<any> {
	if (!absPath) return { empty: "这个功能还没有定稿。" };
	const text = await readAllText(port, absPath, signal, 6000);
	if (!text) return { error: "读不到定稿：" + absPath };
	const g = parseFinalGdd(text);
	g.path = absPath;
	g.dir = String(absPath).replace(/[\\/][^\\/]*$/, "");
	g.name = String(absPath).split(/[\\/]/).pop();
	return g;
}

/** 读定稿的 §5（界面图用）。收**绝对路径** —— 只有 `features\<主题>\gdd\` 一种结构。 */
export async function loadInterface(port: WorkspacePort, absPath: string, signal?: AbortSignal): Promise<any> {
	if (!absPath) return { empty: "本功能还没有定稿，界面图在定稿的 §5。" };
	const text = await readAllText(port, absPath, signal, 4000);
	if (!text) return { error: "读不到定稿：" + absPath };
	let parsed = null;
	try {
		parsed = parseInterfaceSection(text);
	} catch (e) {
		return { error: "解析 §5 失败：" + String((e && (e as Error).message) || e) };
	}
	if (!parsed) return { empty: "定稿里没有 §5 界面章。" };
	parsed.file = String(absPath).split(/[\\/]/).pop();
	return parsed;
}

/** 读资产索引（设计资产列表的数据源；由 scripts/refresh_asset_index.py 生成）。 */
export async function loadIndex(port: WorkspacePort, srWs: string, signal?: AbortSignal): Promise<any> {
	const text = await readAllText(port, srWs + "/design-asset-index.json", signal, 8000);
	if (!text) return { error: "读不到 design-asset-index.json。先点「刷新索引」让 agent 生成它。" };
	let j: any = null;
	try {
		j = JSON.parse(text);
	} catch (e) {
		return { error: "索引 JSON 解析失败：" + String((e && (e as Error).message) || e) };
	}
	if (!j || !Array.isArray(j.assets)) return { error: "索引结构不对：assets 不是数组。" };
	return {
		assets: j.assets, schemaVersion: j.schema_version, workspaceId: j.workspace_id,
		srWs: srWs,
	};
}
