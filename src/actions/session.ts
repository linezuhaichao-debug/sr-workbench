/**
 * 指令层（actions）—— **唯一副作用出口**。
 *
 * 只有这里可以把 port 的指令侧五法叫出来（发指令 / 切权限 / 重命名会话 / 确保工作区 / 建会话）。
 * 组件层只吃 props，加载层只读；谁想"做点什么"，都得经过这里。
 *
 * ★ skill 不是宿主命令：`/sr-gdd-fix …` 当**普通提示词**发出去，由 host 端解析注入（开发笔记坑 9）。
 * ★ 会话必须带 workspaceId 建，否则落进左侧「未分组」（坑 8：workspaceId 与 cwd 互斥）。
 */

import { buildFixInstruction, type FixRequest } from "../pure/instruction.ts";
import type { CreateSessionRequest, RemoteOutcome, WorkspacePort } from "../port/types.ts";

/** 工作会话用的权限预设：`workspace-write` 只允许写会话工作区之下，而配置支线与 GTGenerator 都在功能文件夹之外。 */
export const WORK_SESSION_PERMISSION = "danger-full-access";

/** 把一条指令发给工作会话（唯一的"派活"出口）。 */
export function promptWorkSession(port: WorkspacePort, sessionId: string, text: string): Promise<RemoteOutcome> {
	return port.prompt(sessionId, text);
}

/** 切换会话权限预设。 */
export function setWorkSessionPermission(port: WorkspacePort, sessionId: string, presetName?: string): Promise<RemoteOutcome> {
	return port.setPermission(sessionId, presetName || WORK_SESSION_PERMISSION);
}

/** 给会话打可识别标题（工作会话按标题前缀认领；会话列表不暴露 agentPreset，只能靠标题）。 */
export function renameWorkSession(port: WorkspacePort, sessionId: string, title: string): Promise<RemoteOutcome> {
	return port.renameSession(sessionId, title);
}

/** 按路径查/建工作区（新建功能时一并创建「功能专属工作区」）。 */
export function ensureFeatureWorkspace(port: WorkspacePort, path: string): Promise<RemoteOutcome> {
	return port.ensureWorkspace(path);
}

/** 建工作会话。`workspaceId` 与 `cwd` 二选一，**不要同时给**。 */
export function createWorkSession(port: WorkspacePort, request: CreateSessionRequest): Promise<RemoteOutcome> {
	return port.createSession(request);
}

export interface FixSendResult {
	ok: boolean;
	sid?: string;
	/** 实际发出去的指令全文（回归网断言它） */
	sent?: string;
	note?: string;
	/** 原始 Remote 返回 —— 调用方按 `humanError()` 翻成人话（口径与迁移前一致） */
	outcome?: RemoteOutcome;
}

/**
 * 「就地改这条」：组装指令文本 → 发给工作会话。
 * 不判断影响范围是否"够全"——那是 agent 的事；这里只保证发出去的内容一个字不差。
 */
export async function sendFixInstruction(port: WorkspacePort, sessionId: string, request: FixRequest): Promise<FixSendResult> {
	const text = buildFixInstruction(request);
	const r = await promptWorkSession(port, sessionId, text);
	if (!r || r.ok !== true) {
		return { ok: false, note: (r && r.error && (r.error.message || r.error.code)) || "发送失败", outcome: r };
	}
	return { ok: true, sid: sessionId, sent: text, outcome: r };
}
