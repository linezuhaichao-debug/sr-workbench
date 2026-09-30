/**
 * 「建完之后补哪几刀，才能让侧边栏立刻看得见」（缺陷修复 · 2026-09-30）。
 *
 * 断言的是**判定**：这次该不该调官方的 `workspaces.create` / `sessions.refresh`，
 * 以及两个官方客户端服务缺一个时**如实说什么**（不许装成"已经即时生效"）。
 * 真调用的接线由 `test/sidebar-merge.test.ts` 在真产物 `lib/client.js` 上验。
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
	NO_SESSIONS_SERVICE,
	NO_WORKSPACES_SERVICE,
	planSidebarSync,
	sidebarSyncNeeded
} from "../src/pure/storemerge.ts";

const FEATURE_ROOT = "D:\\TimeMachine\\GameDesignOS\\workspace\\features\\联盟悬赏";

test("两个官方服务都在：先解析工作区行，再重拉会话基线（顺序不能反）", () => {
	const plan = planSidebarSync({
		path: FEATURE_ROOT,
		services: { workspaces: true, sessions: true }
	});
	assert.deepEqual(plan.steps, ["workspaces.create", "sessions.refresh"],
		"先 workspaces.create（分组与它的 sessionIds 到位），再 sessions.refresh（会话行落进 store）");
	assert.equal(plan.resolvePath, FEATURE_ROOT);
	assert.equal(plan.refreshSessions, true);
	assert.deepEqual(plan.notes, [], "都做得到时不多说一句");
	assert.equal(sidebarSyncNeeded(plan), true);
});

test("没有工作区归属（cwd 兜底 / 未分组）：只重拉会话基线，不硬解析一个空路径", () => {
	const plan = planSidebarSync({ path: "", services: { workspaces: true, sessions: true } });
	assert.deepEqual(plan.steps, ["sessions.refresh"]);
	assert.equal(plan.resolvePath, "", "空路径不调 workspaces.create（那会拿一个空 path 去查工作区）");
	assert.deepEqual(plan.notes, [], "「未分组」不是降级，是这条路本来就落那儿 —— 不报怨");
});

test("取不到官方 workspaces 客户端服务：如实说「要刷新页面」，但仍然重拉会话基线", () => {
	const plan = planSidebarSync({ path: FEATURE_ROOT, services: { workspaces: false, sessions: true } });
	assert.deepEqual(plan.steps, ["sessions.refresh"]);
	assert.deepEqual(plan.notes, [NO_WORKSPACES_SERVICE]);
	assert.ok(plan.notes[0].includes("刷新页面"), plan.notes[0]);
});

test("取不到官方 sessions 客户端服务：如实说，但仍然把工作区行解析回来", () => {
	const plan = planSidebarSync({ path: FEATURE_ROOT, services: { workspaces: true, sessions: false } });
	assert.deepEqual(plan.steps, ["workspaces.create"]);
	assert.deepEqual(plan.notes, [NO_SESSIONS_SERVICE]);
	assert.ok(plan.notes[0].includes("刷新页面"), plan.notes[0]);
});

test("两个服务都取不到（老版本 / 插件降级）：一刀都不调，但两条都说清楚", () => {
	const plan = planSidebarSync({ path: FEATURE_ROOT, services: { workspaces: false, sessions: false } });
	assert.deepEqual(plan.steps, []);
	assert.equal(sidebarSyncNeeded(plan), false);
	assert.deepEqual(plan.notes, [NO_WORKSPACES_SERVICE, NO_SESSIONS_SERVICE]);
});

test("路径两边的空白不算路径（trim）；缺 services 字段一律当取不到", () => {
	const padded = planSidebarSync({ path: "  " + FEATURE_ROOT + "  ", services: { workspaces: true, sessions: true } });
	assert.equal(padded.resolvePath, FEATURE_ROOT, "解析用的是 trim 过的路径，但路径本身不改写");

	const missing = planSidebarSync({ path: FEATURE_ROOT, services: undefined as never });
	assert.deepEqual(missing.steps, []);
	assert.equal(missing.notes.length, 2, "字段缺失 = 取不到（不抛错、不猜）");
});
