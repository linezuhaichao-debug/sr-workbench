/**
 * 残留判据（手工删掉功能之后该清哪些）—— 纯函数，含**安全阀**。
 *
 * 判据来源见 `src/pure/leftovers.ts` 的文件头。这一块踩过两次，两次都是「拿快照当判据」：
 *   · 第一次：视图校验拿旧看板误报「上次打开的功能没找到」；
 *   · 第二次：这里的清理拿旧看板判残留 ⇒ 把面板**自己刚建出来的**工作区登记删掉
 *     （用户原话「又新建了一个 测试用例，这次只创建出文件夹，工作区没创建」）。
 * 所以判据现在只认**磁盘事实**：那个功能目录还在不在。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { featureTopicOfPath, leftoverCandidates, leftoversOf, workTopicOfTitle, WORK_SESSION_TITLE } from "../src/pure/leftovers.ts";
import { workCacheDropMany } from "../src/pure/sessionpick.ts";

const SR = "D:\\X\\workspace";
const FEATURES = SR + "\\features";
const ORPHAN = { id: "s-gone", title: WORK_SESSION_TITLE + "联盟基础）", cwd: FEATURES + "\\联盟基础" };
const ORPHAN_WS = { workspaceId: "w-gone", path: FEATURES + "\\联盟基础" };

test("标题 → 主题：只认「策划工作台·工作（X）」这个形状", () => {
	assert.equal(workTopicOfTitle(WORK_SESSION_TITLE + "联盟基础）"), "联盟基础");
	assert.equal(workTopicOfTitle("  策划工作台·工作（联盟基础）  "), "联盟基础");
	assert.equal(workTopicOfTitle("策划工作台·工作"), "", "少了括注不算（那是旧形状/别的标题）");
	assert.equal(workTopicOfTitle("策划工作台·索引（workspace）"), "", "索引会话不是工作会话");
	assert.equal(workTopicOfTitle("我自己的会话"), "");
	assert.equal(workTopicOfTitle(""), "");
	assert.equal(workTopicOfTitle(null), "");
});

test("路径 → 主题：只认 `<SR 工作区>\\features\\<主题>` 的直接子目录", () => {
	assert.equal(featureTopicOfPath(SR, FEATURES + "\\联盟基础"), "联盟基础");
	assert.equal(featureTopicOfPath(SR, FEATURES + "\\联盟基础\\"), "联盟基础", "尾斜杠要吃掉");
	assert.equal(featureTopicOfPath(SR, (FEATURES + "\\联盟基础").replace(/\\/g, "/")), "联盟基础", "正斜杠也认");
	assert.equal(featureTopicOfPath(SR, FEATURES + "\\联盟基础\\gdd"), "", "桶里面不算功能根");
	assert.equal(featureTopicOfPath(SR, FEATURES), "", "features\\ 自己不是功能");
	assert.equal(featureTopicOfPath(SR, "D:\\X\\别的地方\\联盟基础"), "");
	assert.equal(featureTopicOfPath(SR, "D:\\X\\workspace2\\features\\联盟基础"), "", "同前缀不同目录不算（要按整段比）");
	assert.equal(featureTopicOfPath("", FEATURES + "\\联盟基础"), "");
});

test("判残留：形状对 **且** 目录确实不在磁盘上，两者缺一不可", () => {
	const r = leftoversOf({
		srWs: SR, archived: [],
		sessions: [
			ORPHAN,
			{ id: "live", title: WORK_SESSION_TITLE + "联盟讨伐）", cwd: FEATURES + "\\联盟讨伐" },
			{ id: "mine", title: "我自己建的会话", cwd: FEATURES + "\\联盟基础" },
			{ id: "outside", title: WORK_SESSION_TITLE + "别处的功能）", cwd: "D:\\X\\别的地方\\别处的功能" },
			{ id: "s-gone", title: WORK_SESSION_TITLE + "联盟基础）", cwd: FEATURES + "\\联盟基础" }   // 同 id 的第二条：去重
		],
		workspaces: [
			ORPHAN_WS,
			{ workspaceId: "w-live", path: FEATURES + "\\联盟讨伐" },
			{ id: "w-other", path: "D:\\TimeMachine" }
		],
		// 磁盘事实：只有「联盟基础」没了（「联盟讨伐」还在，别人的路径压根不参与形状筛选）
		gone: (t) => t === "联盟基础"
	});
	assert.equal(r.cleanable, true);
	assert.deepEqual(r.sessions.map((s) => s.id), ["s-gone"], "别人的会话不碰、还在的不判、同 id 去重");
	assert.deepEqual(r.workspaces.map((w) => w.id), ["w-gone"], "工作区 id 取 workspaceId 字段");
});

test("★ 目录还在 ⇒ **不是残留**（新建功能那一瞬就是这样：store 已有新工作区、看板还没跟上）", () => {
	// 这条是 2026-10-13「只创建出文件夹，工作区没创建」的钉子：
	// 判据若退化成"看板里没有就算残留"，这条必红。
	const fresh = "测试用例";
	const r = leftoversOf({
		srWs: SR, archived: [],
		sessions: [{ id: "s-new", title: WORK_SESSION_TITLE + fresh + "）", cwd: FEATURES + "\\" + fresh }],
		workspaces: [{ workspaceId: "w-new", path: FEATURES + "\\" + fresh }],
		gone: () => false                       // 目录**还在**（刚建出来）
	});
	assert.equal(r.cleanable, true, "形状是对的、归档集也拿到了，所以这一轮是可判的");
	assert.deepEqual(r.sessions, [], "目录还在 ⇒ 不是残留");
	assert.deepEqual(r.workspaces, [], "目录还在 ⇒ 不是残留");
});

test("没给「目录还在不在」的探测结果 ⇒ 一个都不判（安全默认）", () => {
	const r = leftoversOf({ srWs: SR, archived: [], sessions: [ORPHAN], workspaces: [ORPHAN_WS] });
	assert.equal(r.cleanable, true);
	assert.deepEqual(r.sessions, []);
	assert.deepEqual(r.workspaces, []);
});

test("候选：只按形状筛（**不看**目录在不在），供调用方拿去探测", () => {
	const c = leftoverCandidates({ srWs: SR, archived: [], sessions: [ORPHAN], workspaces: [ORPHAN_WS] });
	assert.equal(c.cleanable, true);
	assert.deepEqual(c.topics, ["联盟基础"], "主题去重后给调用方，用来问磁盘");
	assert.deepEqual(c.sessions.map((s) => s.id), ["s-gone"]);
	assert.deepEqual(c.workspaces.map((w) => w.id), ["w-gone"]);
});

test("安全阀：锚点不在 / 拿不到归档集 ⇒ 一个都不判", () => {
	const base = { srWs: SR, archived: [], sessions: [ORPHAN], workspaces: [ORPHAN_WS], gone: () => true };

	assert.equal(leftoversOf(Object.assign({}, base, { srWs: "" })).cleanable, false, "锚点不在不判");

	for (const arch of [null, undefined, "坏形状"]) {
		const r = leftoversOf(Object.assign({}, base, { archived: arch }));
		assert.equal(r.cleanable, false, "归档集拿不到时不许判：" + String(arch));
		assert.deepEqual(r.sessions, []);
		assert.ok(String(r.why).includes("已归档"), "要如实说清为什么：" + r.why);
	}
});

test("**已归档的会话不再判** —— 归档不让会话从列表里消失，不排除它就会每次重挂载再归档一遍", () => {
	// ★ 真踩过（用户原话「这什么玩意 怎么一直在」）：`remote.session.list` **不按归档过滤**。
	const r = leftoversOf({
		srWs: SR, archived: [ORPHAN.id], sessions: [ORPHAN], workspaces: [ORPHAN_WS], gone: () => true
	});
	assert.deepEqual(r.sessions, [], "归档过的就不是残留了");
	assert.deepEqual(r.workspaces.map((w) => w.id), ["w-gone"], "归档集只管会话：工作区没被移除过，仍然算残留");
});

test("workCacheDropMany：按「确认已经不在」的根丢条目；坏值归零，不静默失败", () => {
	const raw = JSON.stringify({
		"d:\\x\\workspace\\features\\联盟基础": "s1",
		"d:\\x\\workspace\\features\\联盟讨伐": "s2"
	});
	const next = workCacheDropMany(raw, [FEATURES + "\\联盟基础"]);
	assert.deepEqual(JSON.parse(next), { "d:\\x\\workspace\\features\\联盟讨伐": "s2" });

	assert.deepEqual(JSON.parse(workCacheDropMany(raw, [])), JSON.parse(raw), "没有要丢的，内容不变");
	assert.deepEqual(JSON.parse(workCacheDropMany("{坏 JSON", [])), {}, "坏值归一成空表（否则会被原样写回去，等于没清）");
});
