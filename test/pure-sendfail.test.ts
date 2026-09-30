/**
 * 发送失败 → 可读错误 + 下一步（工单 15 第 6 条："不许静默无反应"）。
 *
 * 断言的是**面板上会显示的那两句话的判定**：每一种真实失败都要落到一个明确的类别，
 * 并且**一定带下一步**（没有下一步的"失败"等于让用户干瞪眼）。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { explainSendFailure, isSessionGone } from "../src/pure/sendfail.ts";

const remote = (code: string, message = "") => ({ ok: false, error: { code: code, message: message } });

test("session/not-found：唯一的可自愈失败（会话没了 → 重建再发一次）", () => {
	assert.equal(isSessionGone(remote("session/not-found", "no such session")), true);
	assert.equal(isSessionGone("no entry at \"s-1\""), true, "旧版/网关只给人话时也要认得出来");
	assert.equal(isSessionGone("找不到目标（路径或会话可能已变）"), true, "面板此前的 humanError 口径");
	assert.equal(isSessionGone(remote("session/agent-busy", "busy")), false, "忙碌不是「不在」");
	assert.equal(isSessionGone(remote("workspace-file/not-found", "no entry at \"D:\\\\x.md\"")), false,
		"文件找不到不是会话没了 —— 重建会话解决不了它");

	const f = explainSendFailure(remote("session/not-found"));
	assert.equal(f.code, "gone");
	assert.ok(f.message.includes("不在了"), f.message);
	assert.ok(f.next.includes("重建"), f.next);
});

test("session/agent-busy：如实说忙碌，并说清「已排队、等它跑完」", () => {
	const f = explainSendFailure(remote("session/agent-busy", "agent is running"));
	assert.equal(f.code, "busy");
	assert.ok(f.message.includes("忙碌"), f.message);
	assert.ok(f.next.includes("排队"), f.next);
	assert.ok(f.next.includes("跳到那个会话"), f.next);
});

test("session/writer-held：被别的进程占着 → 关掉那个窗口再发", () => {
	const f = explainSendFailure(remote("session/writer-held", "writer held by another process"));
	assert.equal(f.code, "writer");
	assert.ok(f.next.includes("关掉"), f.next);
});

test("权限类：给的是「跑 /permission danger-full-access 再发」，不是一句空话", () => {
	for (const e of [remote("gateway/forbidden", "not permitted"), "沙箱不允许写该路径", remote("permission/denied", "")]) {
		const f = explainSendFailure(e);
		assert.equal(f.code, "perm", JSON.stringify(e));
		assert.ok(f.next.includes("/permission danger-full-access"), f.next);
	}
});

test("超时 / 通道不可用 / 其它：三类都有可执行的下一步", () => {
	const t = explainSendFailure(remote("gateway/internal", "request timed out"));
	assert.equal(t.code, "timeout");
	assert.ok(t.next.includes("再按一次"), t.next);

	const u = explainSendFailure("cannot get property \"session\" without inject");
	assert.equal(u.code, "unavailable");
	assert.ok(u.next.includes("F5"), u.next);

	const u2 = explainSendFailure(remote("gateway/bad-request", "session.create accepts workspaceId or cwd, not both"));
	assert.equal(u2.code, "unavailable");

	const o = explainSendFailure(remote("weird/code", "远端说了句没头没脑的话"));
	assert.equal(o.code, "other");
	assert.equal(o.message, "远端说了句没头没脑的话", "原文不许吞掉（排障全靠它）");
	assert.ok(o.next.length > 0, "任何失败都必须给下一步");

	const empty = explainSendFailure(null);
	assert.equal(empty.code, "other");
	assert.ok(empty.message.length > 0 && empty.next.length > 0);
});
