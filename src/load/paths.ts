/**
 * 锚点与契约文件：从 sr 本地配置读**绝对路径锚点**，以及决策记录 schema。
 *
 * ★ 不能硬编码相对路径让面板跟着"当前会话的工作区"走——切到别的工作区的会话时就会读不到。
 *   文件**读取**不受工作区限制（只有目录列举受限），所以这一步任何会话都能做。
 */

import type { WorkspacePort } from "../port/types.ts";
import { readAllText } from "./read.ts";

export interface SrPaths {
	srWs: string;
	configRoot: string;
	skillsRoot?: string;
	configFile: string;
}

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
					// 从配置路径反推 skills 根（形状：<X>/.agents/skills || <X>/.agents/skills/sr-askme/config.local.json）
					skillsRoot: p.replace(/[\\/]sr-askme[\\/]config\.local\.json$/i, ""),
					configFile: p,
				};
			}
		} catch (e) {
			/* 换下一个候选 */
		}
	}
	return { srWs: "", configRoot: "", configFile: "(未找到 sr 配置)" };
}

/** 读契约 schema（决策记录以它为准绳；读不到就退化为"只列结构问题"）。 */
export async function loadDecisionSchema(port: WorkspacePort, skillsRoot: string, signal?: AbortSignal): Promise<any> {
	const cands: string[] = [];
	if (skillsRoot) cands.push(skillsRoot + "/sr-askme/references/decision.schema.json");
	cands.push(".agents/skills/sr-askme/references/decision.schema.json");
	for (const p of cands) {
		const text = await readAllText(port, p, signal, 2000);
		if (!text) continue;
		try {
			return JSON.parse(text);
		} catch (e) {
			/* 换下一个 */
		}
	}
	return null;
}
