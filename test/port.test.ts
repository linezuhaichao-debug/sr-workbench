/**
 * `WorkspacePort` 的两个实现（spec「测试接缝」逐条验收）。
 *
 *   · 文件侧替身 = node:fs 直读**真实工作区**（这里用真实文件验证分页/列举/stat 口径）
 *   · 指令侧替身 = 记录器（记下指令文本与参数，**不真的发出**）
 *   · 生产实现 = 接在 ctx.remote.* 上（用假 ctx 验证映射与容错）
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PortError, createDshPort, normalizeListing } from "../src/port/dsh.ts";
import { createFsPort, createRecorder } from "../src/port/fs.ts";
import { FINAL_GDD, WORKSPACE_ROOT_FOR_SESSION, requireRealData, testPort } from "./paths.ts";

requireRealData();

test("文件侧替身：分页口径照 DSH（1-based、结尾 \\n 只终止最后一行）", async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "srwb-"));
	const f = path.join(dir, "t.txt");
	fs.writeFileSync(f, "a\nb\nc\n", "utf8");
	const port = createFsPort();

	const all = await port.readText(f);
	assert.equal(all.lines, 3);
	assert.equal(all.text, "a\nb\nc");
	assert.equal(all.eof, true);
	assert.ok(all.version.length > 0);

	const page = await port.readText(f, { offset: 2, limit: 1 });
	assert.equal(page.text, "b");
	assert.equal(page.lines, 1);
	assert.equal(page.eof, false);

	const past = await port.readText(f, { offset: 99, limit: 10 });
	assert.equal(past.lines, 0);
	assert.equal(past.text, "");
	assert.equal(past.eof, true);

	const empty = path.join(dir, "e.txt");
	fs.writeFileSync(empty, "", "utf8");
	assert.deepEqual([(await port.readText(empty)).lines, (await port.readText(empty)).eof], [0, true]);

	// 读不到 → 抛错（容错留给加载器）
	await assert.rejects(() => port.readText(path.join(dir, "nope.txt")), /读文件失败/);
	fs.rmSync(dir, { recursive: true, force: true });
});

test("文件侧替身：列举限定在工作区内（照 DSH outside-workspace 口径）", async () => {
	const port = testPort({ roots: [WORKSPACE_ROOT_FOR_SESSION] });
	const inside = await port.listDir(path.join(WORKSPACE_ROOT_FOR_SESSION, "GameDesignOS", "workspace", "features"));
	// ★ 2026-10-08：功能目录改名 `联盟悬赏` → `讨伐`
	assert.ok(inside.entries.some((e) => e.name === "讨伐" && e.type === "directory"));
	await assert.rejects(() => port.listDir("C:\\Windows"), /替身工作区之外/);
});

test("文件侧替身：stat / changes(ready)", async () => {
	const port = testPort();
	const st = await port.stat(FINAL_GDD);
	assert.equal(st.absolutePath, FINAL_GDD);
	assert.ok((st.bytes || 0) > 10000, "真实定稿应有几万字节");
	assert.ok(st.version.includes(":"));
	const frames = [];
	for await (const frame of port.changes(new AbortController().signal)) {
		frames.push(frame);
		break;
	}
	assert.deepEqual(frames, [{ kind: "ready" }]);
});

test("指令侧替身：记录器记下参数，不真的发出", async () => {
	const recorder = createRecorder();
	const port = createFsPort({ recorder });
	const out = await port.prompt("sid-1", "改 §5 UI-M1 UE3。");
	assert.equal(out.ok, true);
	await port.setPermission("sid-1", "danger-full-access");
	await port.renameSession("sid-1", "工作台 · 联盟悬赏");
	await port.ensureWorkspace("D:\\X\\features\\联盟悬赏");
	await port.createSession({ workspaceId: "ws-1", agentPreset: "sr-workbench" });

	assert.deepEqual(
		recorder.calls.map((c) => c.method),
		["prompt", "setPermission", "renameSession", "ensureWorkspace", "createSession"],
	);
	assert.deepEqual(recorder.instructions(), ["改 §5 UI-M1 UE3。"]);
	assert.deepEqual(recorder.calls[1].args, ["sid-1", "danger-full-access"]);
	assert.deepEqual(recorder.calls[4].args, [{ workspaceId: "ws-1", agentPreset: "sr-workbench" }]);
	recorder.clear();
	assert.equal(recorder.calls.length, 0);
});

test("生产实现：映射到 ctx.remote.*（假 ctx），并归一化三种列举形状", async () => {
	const calls: string[] = [];
	const ctx = {
		remote: {
			workspaceFiles: {
				read: async (sid: string, p: string, range: any) => ({ ok: true, value: { text: "X", lines: 1, eof: true, version: "v", sid, p, range } }),
				list: async () => ({ ok: true, value: { children: [{ name: "a.md", kind: "file" }, { name: "sub", kind: "directory" }, { name: "odd" }] } }),
				stat: async () => ({ ok: true, value: { absolutePath: "D:\\x", version: "v2", bytes: 3 } }),
				changes: async function* () {
					yield { kind: "ready" };
				},
			},
			session: {
				prompt: async (req: any) => {
					calls.push("prompt:" + req.sessionId + ":" + req.content[0].text + ":" + req.mode + ":" + (req.requestId.startsWith("wb-") ? "rid" : "BAD"));
					return { ok: true, value: { accepted: true } };
				},
				rename: async (req: any) => {
					calls.push("rename:" + req.sessionId + ":" + req.title);
					return { ok: true, value: { title: req.title, seq: 1 } };
				},
				create: async (req: any) => {
					calls.push("create:" + JSON.stringify(req));
					return { ok: true, value: { sessionId: "sid-new" } };
				},
			},
			commands: {
				execute: async (sid: string, line: string) => {
					calls.push("exec:" + sid + ":" + line);
					return { ok: true, value: undefined };
				},
			},
			workspace: {
				list: async () => ({ ok: true, value: { items: [{ name: "b.md", type: "file" }] } }),
				create: async (req: any) => {
					calls.push("ws:" + req.path);
					return { ok: true, value: { created: false, workspace: { workspaceId: "ws-1", title: "T" } } };
				},
			},
		},
	};
	const port = createDshPort(ctx, "sid-A");

	const r = await port.readText("D:\\x\\a.md", { offset: 1, limit: 5 });
	assert.equal(r.text, "X");
	const listing = await port.listDir("D:\\x");
	assert.deepEqual(listing.entries, [
		{ name: "a.md", type: "file", size: undefined },
		{ name: "sub", type: "directory", size: undefined },
		{ name: "odd", type: "unknown", size: undefined },
	]);
	assert.equal((await port.stat("D:\\x")).version, "v2");

	assert.equal((await port.prompt("sid-B", "干活")).ok, true);
	assert.equal((await port.setPermission("sid-B", "danger-full-access")).ok, true);
	assert.equal((await port.renameSession("sid-B", "标题")).ok, true);
	assert.equal((await port.ensureWorkspace("D:\\W")).ok, true);
	assert.equal((await port.createSession({ workspaceId: "ws-1", agentPreset: "p" })).ok, true);
	await port.createSession({ cwd: "D:\\C" });
	// ★ 原断言写的是 `'create:{"cwd":"D:\\C","agentPreset":undefined}'` —— 这串**永远不可能出现**：
	//   记录器里是 `JSON.stringify(req)`，而 JSON.stringify 按规范**丢掉值为 undefined 的键**
	//   （实现仍然照 client.js:5058 把 `agentPreset: request.agentPreset` 放进请求对象，宿主视同"没给"）。
	//   所以真行为就是 `{"cwd":"D:\\C"}`（JSON 里反斜杠要转义，源码字面量因此写成 4 个反斜杠）：
	//   不给 workspaceId 时走 cwd，且请求正文里不带 agentPreset 键。
	assert.deepEqual(calls, [
		"prompt:sid-B:干活:queue:rid",
		"exec:sid-B:/permission danger-full-access",
		"rename:sid-B:标题",
		"ws:D:\\W",
		'create:{"workspaceId":"ws-1","agentPreset":"p"}',
		'create:{"cwd":"D:\\\\C"}',
	]);
});

test("生产实现：读失败抛 PortError（带 code），未注入的服务给可读错误", async () => {
	const ctx = {
		remote: {
			workspaceFiles: {
				list: async () => ({ ok: false, error: { code: "workspace-file/outside-workspace", message: "outside" } }),
				read: async () => ({ ok: false, error: { code: "workspace-file/not-found", message: "no entry" } }),
			},
		},
	};
	const port = createDshPort(ctx, "sid");
	await assert.rejects(() => port.readText("D:\\x"), (e: any) => e instanceof PortError && e.code === "workspace-file/not-found");
	// 两条列举通道都不通 → 抛"无法列举目录"
	await assert.rejects(() => port.listDir("D:\\x"), /无法列举目录/);

	// ctx 上没有 session 服务 → 可读错误（Cordis 的 inject 抛错被接住，不让插件崩）
	const bare = createDshPort({ remote: {} }, "sid");
	const out = await bare.prompt("sid", "x");
	assert.equal(out.ok, false);
	assert.ok((out.error?.message || "").length > 0);
	assert.throws(() => bare.changes(new AbortController().signal), /read|changes|不可用|未声明/);
});

test("normalizeListing 覆盖 entries / children / items 三种形状（兼容层只减不增）", () => {
	assert.deepEqual(normalizeListing({ entries: [{ name: "a", type: "file" }] }).entries, [{ name: "a", type: "file", size: undefined }]);
	assert.deepEqual(normalizeListing({ items: [{ name: "b", kind: "directory" }] }).entries, [{ name: "b", type: "directory", size: undefined }]);
	assert.deepEqual(normalizeListing({ children: [] }).entries, []);
	assert.deepEqual(normalizeListing(null).entries, []);
	// 名字为空的项丢掉；truncated 透传
	assert.equal(normalizeListing({ entries: [{ name: "" }], truncated: true }).entries.length, 0);
	assert.equal(normalizeListing({ entries: [], truncated: true }).truncated, true);
});
