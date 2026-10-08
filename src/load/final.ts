/**
 * 定稿相关加载器：定稿全文（§6.2 定稿工作面）· 定稿 §5（界面图）。
 *
 * ★ 一律收**绝对路径** —— 面板不自己拼路径，路径由调用方从功能目录算出来，
 *   所以目录结构怎么变都不用改这里。
 *
 * ★ 工单 31：这里原来还有 `loadIndex`（读 `<srWs>/design-asset-index.json` 的资产索引）。
 *   它服务的是被砍掉的「设计资产」屏（设计 §3.4：B1/B2/B3 + `design-asset-index.json` 一并砍掉，
 *   职能并入头脑风暴四入口与定稿的「线框图替换」）；屏与面板侧的内联副本一起删掉之后，
 *   这个加载器在**生产代码里引用清零**（只剩它自己的测试），于是同批删除。
 *   工作区里的 `design-asset-index.json` 与 `.backup` **原样留在原处**（那是工单 21 的搬运范围）。
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
