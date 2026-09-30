/**
 * 指令层（actions）：**唯一副作用出口** + 指令文本构造的回归网（spec §6.4 / 用户故事 51）。
 *
 * 断言的是**发出去的那条指令文本**与随附的影响范围 —— 这是产品契约，不是实现细节。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildFixInstruction } from "../src/pure/instruction.ts";
import { parseFinalGdd } from "../src/pure/finalgdd.ts";
import { buildRefGraph, impactOf } from "../src/pure/refgraph.ts";
import {
	WORK_SESSION_PERMISSION,
	createWorkSession,
	ensureFeatureWorkspace,
	promptWorkSession,
	renameWorkSession,
	sendFixInstruction,
	setWorkSessionPermission,
} from "../src/actions/session.ts";
import { createFsPort } from "../src/port/fs.ts";
import {
	pickWorkSession,
	rowsFromList,
	workTitleFor
} from "../src/pure/sessionpick.ts";
import { FINAL_GDD, FEATURE_ROOT, readText, requireRealData } from "./paths.ts";

requireRealData();

test("指令文本：逐行断言（面板只说「改哪儿、改成什么、连带影响」）", () => {
	const text = buildFixInstruction({
		path: "D:\\W\\features\\联盟悬赏\\gdd\\联盟悬赏_20260923_定稿.md",
		ref: "§5 UI-M1 UE3",
		before: "| UE3 | 出刀按钮… |",
		intent: "改成「一键出刀」并加二次确认",
		impact: [
			{ line: 214, where: "§5 UI-M1 UE3" },
			{ line: 215, where: "§5 UI-M1 UE3a", kind: "family" },
		],
	});
	assert.equal(
		text,
		[
			"/sr-gdd-fix D:\\W\\features\\联盟悬赏\\gdd\\联盟悬赏_20260923_定稿.md",
			"改 §5 UI-M1 UE3。",
			"现状：| UE3 | 出刀按钮… |",
			"要改成：改成「一键出刀」并加二次确认",
			"连带影响（工作台按结构引用扫出，供参考；语义影响请按 D11 自行扫全）：",
			"  · L214 §5 UI-M1 UE3",
			"  · L215 [同族] §5 UI-M1 UE3a",
		].join("\n"),
	);
});

test("指令文本：没有影响范围就不带那一段；影响范围最多列 12 条", () => {
	const bare = buildFixInstruction({ path: "p", ref: "§10 AC1", before: "a", intent: "b" });
	assert.equal(bare.split("\n").length, 4);
	assert.equal(bare.includes("连带影响"), false);

	const many = buildFixInstruction({
		path: "p", ref: "r", before: "a", intent: "b",
		impact: Array.from({ length: 30 }, (_, i) => ({ line: i + 1, where: "w" + i })),
	});
	assert.equal(many.split("\n").length, 4 + 1 + 12);
});

test("真实定稿的影响范围能直接进指令（行号来自真实结构引用）", () => {
	const doc = parseFinalGdd(readText(FINAL_GDD));
	const graph = buildRefGraph(doc);
	const ref = "§10 AC1";
	const self = graph.byRef.get(ref)!.hits[0].line;
	const impact = impactOf(graph, ref, self);
	const text = buildFixInstruction({ path: FINAL_GDD, ref, before: "| AC1 | … |", intent: "加一条边界", impact });
	assert.ok(text.includes("/sr-gdd-fix " + FINAL_GDD));
	assert.ok(text.includes("  · L487 §11 交接清单"), "真实行号 487 应出现在指令里：\n" + text);
});

test("指令文本：真实定稿上 §4 R6 的契约关联边带 [契约] 标签（六类边的类别标记，工单 14）", () => {
	const doc = parseFinalGdd(readText(FINAL_GDD));
	const graph = buildRefGraph(doc);
	const text = buildFixInstruction({
		path: FINAL_GDD, ref: "§4 R6", before: "| 终结奖励 | … |", intent: "把终结奖励改成必得",
		impact: impactOf(graph, "§4 R6", 133),
	});
	// 新边（⑥ 契约关联）标出类别，并指向 §6 的那一行
	assert.ok(text.includes("  · L342 [契约] §6 难度表.clearDropId"), text);
	assert.ok(text.includes("  · L314 [契约] §6 全局变量.alliBossChallengeReward"), text);
	// 旧边（① 显式引用）照原样列，不加标签 —— 指令文本是产品契约，老行为一字不改
	assert.ok(text.includes("  · L430 §8 范围门"), text);
});

test("actions：五个方法都只经过端口（记录器替身），不真的发出", async () => {
	const port = createFsPort();
	const p = await promptWorkSession(port, "sid-1", "干活");
	await setWorkSessionPermission(port, "sid-1");
	await setWorkSessionPermission(port, "sid-1", "workspace-write");
	await renameWorkSession(port, "sid-1", "工作台 · 联盟悬赏");
	await ensureFeatureWorkspace(port, "D:\\W\\features\\联盟悬赏");
	await createWorkSession(port, { workspaceId: "ws-1", agentPreset: "sr-workbench" });

	assert.equal(p.ok, true);
	assert.deepEqual(
		port.recorder.calls.map((c) => c.method),
		["prompt", "setPermission", "setPermission", "renameSession", "ensureWorkspace", "createSession"],
	);
	assert.deepEqual(port.recorder.calls[1].args, ["sid-1", WORK_SESSION_PERMISSION]);
	assert.deepEqual(port.recorder.calls[2].args, ["sid-1", "workspace-write"]);
	assert.deepEqual(port.recorder.instructions(), ["干活"]);
});

test("sendFixInstruction：组装 + 发出，并把实际发出的全文回传（失败也不抛）", async () => {
	const port = createFsPort();
	const r = await sendFixInstruction(port, "sid-9", { path: "D:\\f.md", ref: "§4 R1", before: "旧", intent: "新" });
	assert.equal(r.ok, true);
	assert.equal(r.sid, "sid-9");
	assert.equal(r.sent, port.recorder.instructions()[0]);
	assert.equal(r.sent!.split("\n")[0], "/sr-gdd-fix D:\\f.md");

	// 发送失败 → ok:false 且带原始返回（调用方用 humanError 翻人话）
	const bad: any = {
		prompt: async () => ({ ok: false, error: { code: "gateway/bad-request", message: "会话不存在" } }),
	};
	const r2 = await sendFixInstruction(bad, "sid-x", { path: "p", ref: "r" });
	assert.equal(r2.ok, false);
	assert.equal(r2.note, "会话不存在");
	assert.equal(r2.outcome?.ok, false);
});

/**
 * 工单 15 的**记录器回归网**：面板上写"要改成什么"、按发送，实际落到记录器里的
 * 就是这一条 —— 目标会话（该功能的专属工作会话）+ 正文全文（三段 + 语义影响声明 + skill 名）。
 *
 * ★ 这段文本是产品契约：改一句措辞、换一个拼接顺序、少一段声明，这里就变红。
 */
test("就地改这条（记录器）：指令发到**按标题认回的功能工作会话**，正文逐条可核对", async () => {
	const port = createFsPort();

	// 会话候选照真实形状（`session/list` 的 0.2.0 返回）：一条我们命名过的工作会话 + 一条用户的会话
	const rows = rowsFromList({
		items: [
			{ sessionId: "sid-user", cwd: FEATURE_ROOT, updatedAt: 900, projections: { values: { title: "我自己在联盟悬赏目录里的对话" } } },
			{ sessionId: "sid-work", cwd: FEATURE_ROOT, updatedAt: 500, projections: { values: { title: workTitleFor(FEATURE_ROOT) } } },
		],
	});
	const hit = pickWorkSession(rows, FEATURE_ROOT);
	assert.equal(hit?.id, "sid-work", "认的是我们命名过的那条，不是用户的对话");

	// 影响范围用**真实定稿**算（行号来自真实结构引用）
	const doc = parseFinalGdd(readText(FINAL_GDD));
	const graph = buildRefGraph(doc);
	const impact = impactOf(graph, "§5 UI-M1 UE3", 214);

	const r = await sendFixInstruction(port, hit!.id, {
		path: FINAL_GDD, ref: "§5 UI-M1 UE3",
		before: "| UE3 | 【难度通关奖励】以单个宝箱形式常驻展示；… |",
		intent: "改成两个宝箱入口", impact,
	});
	assert.equal(r.ok, true);

	// 目标会话：记录器里的 prompt 第一条，打的就是认回来的那条
	assert.equal(port.recorder.calls[0].method, "prompt");
	assert.equal(port.recorder.calls[0].args[0], "sid-work");

	const text = port.recorder.instructions()[0];
	const lines = text.split("\n");
	assert.equal(lines[0], "/sr-gdd-fix " + FINAL_GDD, "第一行是 skill + 定稿绝对路径（不是命令通道）");
	assert.equal(lines[1], "改 §5 UI-M1 UE3。", "第二段：条目引用（agent 不用再找）");
	assert.ok(lines[2].startsWith("现状：| UE3 |"), "第三段：现状原文（行号会漂、原文不会）");
	assert.equal(lines[3], "要改成：改成两个宝箱入口", "第四段：要改成什么（用户输的那句）");
	assert.equal(lines[4], "连带影响（工作台按结构引用扫出，供参考；语义影响请按 D11 自行扫全）：",
		"★ 明写「影响范围只按结构引用扫出，语义影响请自行扫全」（不许让 agent 以为已经查全）");
	assert.ok(lines.some((l) => l === "  · L139 §4 R6 奖励"), "连带影响里是真实行号：L139 §4 R6 奖励\n" + text);
	assert.ok(lines.some((l) => l === "  · L215 [同族] §5 UI-M1 UE3a"), "编号同族的边带 [同族] 标签\n" + text);
	assert.equal(lines.join("\n"), r.sent, "回传的全文 == 记录器收到的全文（面板上显示的就是发出去的）");
	assert.equal(r.sent!.includes("commands"), false, "正文里不含任何命令通道痕迹");
});
