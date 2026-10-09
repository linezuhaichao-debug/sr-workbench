/**
 * 锚点：从 sr 本地配置读**绝对路径锚点**（`sr_workspace` / `config_root`）。
 *
 * ★ 不能硬编码相对路径让面板跟着"当前会话的工作区"走 —— 切到别的工作区的会话时就读不到。
 *   文件**读取**不受工作区限制（只有目录列举受限），所以这一步任何会话都能做。
 * ★ v5 起这里**不再有** `decision.schema.json`（决策记录改成一个 markdown 账本，
 *   格式权威在 `../pure/decisions.ts` 的文件头与操作文档，不在 schema 文件里）。
 */

import type { WorkspacePort } from "../port/types.ts";
import { readAllText } from "./read.ts";

export interface SrPaths {
	srWs: string;
	configRoot: string;
	skillsRoot?: string;
	configFile: string;
}

/**
 * 读 `config.local.json`。候选顺序：显式配置路径 → 相对当前工作区的默认位置。
 * 都读不到时 `srWs` 为空串 + `configFile` 说清楚试过哪儿（**不假装读到了**）。
 */
export async function loadSrPaths(port: WorkspacePort, configPath: string, signal?: AbortSignal): Promise<SrPaths> {
	const cands: string[] = [];
	if (configPath) cands.push(configPath);
	cands.push(".agents/skills/sr-askme/config.local.json");
	for (const p of cands) {
		const text = await readAllText(port, p, signal, 200);
		if (!text) continue;
		try {
			const cfg = JSON.parse(text);
			if (cfg && cfg.sr_workspace) {
				return {
					srWs: String(cfg.sr_workspace).replace(/[\\/]+$/, ""),
					configRoot: String(cfg.config_root || "").replace(/[\\/]+$/, ""),
					// 从配置路径反推 skills 根（形状：<X>/.agents/skills/sr-askme/config.local.json）
					skillsRoot: p.replace(/[\\/]sr-askme[\\/]config\.local\.json$/i, ""),
					configFile: p
				};
			}
		} catch (e) {
			/* 换下一个候选 */
		}
	}
	return { srWs: "", configRoot: "", configFile: "(未找到 sr 配置)" };
}
