/**
 * 发送失败 → **可读的错误 + 下一步**（工单 15 的第 6 条）。
 *
 * 为什么要有这个模块：面板的"手"只有一条通道（`session.prompt`）。通道挂了的时候，
 * 用户看到的最坏情形是**什么都没发生**（工单 15 明写"不许静默无反应"）。
 * 所以每一种失败都要回答两件事：**出了什么事**、**你现在该做什么**。
 *
 * 判定依据是 DSH 自己的错误码（逐个照 0.2.0 的 `.d.ts` 抄，不是猜的）：
 *   · `session/not-found`   —— `dsh-session`（agent 错误联合类型）
 *   · `session/agent-busy`  —— 同上（`{reason}`）
 *   · `session/writer-held` —— 同上（`{sessionId}`）
 *   · `gateway/internal` / `gateway/bad-request` / `workspace-file/*` —— typert 网关
 * 只有 `not-found` 是**可自愈**的（会话没了 → 重建一条再发一次）；其余都如实报给用户。
 *
 * ★ 纯函数：不碰 localStorage / ctx / Remote，逐条用例在 `test/pure-sendfail.test.ts`。
 */

/** 一次失败的可读说明。`code` 是**归一后的**类别，不是原样透传的远端码。 */
export interface SendFailure {
	/** `gone` 会话不在了 · `busy` 忙碌 · `writer` 被占用 · `perm` 权限 · `timeout` 超时 · `unavailable` 通道不可用 · `other` */
	code: "gone" | "busy" | "writer" | "perm" | "timeout" | "unavailable" | "other";
	/** 出什么事了（一句话，直接显示）。 */
	message: string;
	/** 你现在该做什么（可操作的一步）。 */
	next: string;
}

/** 把 `{ok:false,error:{code,message}}` / `Error` / 字符串统一成"码 + 人话"。 */
function parts(err: unknown): { code: string; message: string } {
	if (err === null || err === undefined) return { code: "", message: "" };
	if (typeof err === "string") return { code: "", message: err };
	const anyErr = err as { code?: unknown; message?: unknown; error?: { code?: unknown; message?: unknown } };
	const inner = anyErr.error || anyErr;
	const code = typeof inner.code === "string" ? inner.code : "";
	let message = "";
	if (typeof inner.message === "string") message = inner.message;
	else if (inner !== null && inner !== undefined) {
		try { message = JSON.stringify(inner); } catch (e) { message = String(inner); }
	}
	return { code: code, message: message };
}

/**
 * 会话是不是**已经不在了**（可自愈的那一类）。
 * 判据同时看码与人话：0.2.0 给 `session/not-found`，旧版/网关可能只给一句
 * `no such session` / `no entry` / `找不到目标`（面板此前的 `humanError` 就是这么认的）。
 * ★ `workspace-file/not-found` **不算**：那是"文件找不到"，重建会话也解决不了它。
 */
export function isSessionGone(err: unknown): boolean {
	const { code, message } = parts(err);
	const s = (code + " " + message).toLowerCase();
	if (/workspace-file\//.test(s)) return false;
	if (/not-found|not_found|no such session|session.*missing|no entry/.test(s)) return true;
	return /找不到目标|会话不存在|会话已不存在/.test(code + " " + message);
}

/** 失败 → 可读错误 + 下一步（面板直接显示这两句，不再自己写一份判断）。 */
export function explainSendFailure(err: unknown): SendFailure {
	const { code, message } = parts(err);
	const s = (code + " " + message).toLowerCase();

	if (isSessionGone(err)) {
		return {
			code: "gone",
			message: "这条工作会话已经不在了（被关掉、删掉，或换了机器）。",
			next: "面板已经就着重建了一条并重发一次；若仍失败，点「跳到那个会话」自己把指令再发一遍。",
		};
	}
	if (/agent-busy|session-busy|busy/.test(s)) {
		return {
			code: "busy",
			message: "那条工作会话正在跑别的活（忙碌）。",
			next: "指令走的是排队模式，等它跑完当前这一轮就会处理；点「跳到那个会话」能看着它跑。",
		};
	}
	if (/writer-held|writer_held|locked|占用/.test(s)) {
		return {
			code: "writer",
			message: "那条会话被另一个进程/窗口占着（writer-held）——现在谁都写不进去。",
			next: "把占用它的那个窗口或实例关掉，再按一次「发到工作会话」。",
		};
	}
	if (/permission|forbidden|unauthor|denied|not permitted|沙箱|权限/.test(s)) {
		return {
			code: "perm",
			message: "权限不够：这条会话的沙箱不让它写这个位置。",
			next: "在那个工作会话里跑一下 `/permission danger-full-access`，再按一次「发到工作会话」。",
		};
	}
	if (/timeout|timed out|超时/.test(s)) {
		return {
			code: "timeout",
			message: "对方没有响应（超时）。",
			next: "再按一次；连着超时说明实例忙，过一会儿再试。",
		};
	}
	if (/without inject|not available|unavailable|未注入|不可用|缺少|bad-request/.test(s)) {
		return {
			code: "unavailable",
			message: "发送通道不可用（面板缺注入的服务，或宿主拒绝了这次请求）。",
			next: "刷新一次页面（F5）再试；仍失败就点「跳到那个会话」手动发 —— 指令原文就在上面那段。",
		};
	}
	return {
		code: "other",
		message: message || "发送失败（远端没有给原因）。",
		next: "再按一次；仍失败就把这条错误连同上面的条目引用一起发给开发者。",
	};
}
