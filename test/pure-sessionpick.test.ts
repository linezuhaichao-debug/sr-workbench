/**
 * 索引会话选择（工单 32 · DSH 0.2.0 兼容）—— 纯函数用例。
 *
 * 覆盖的是**两种 store 形状**（0.1.5 的 `current` / 0.2.0 的 `retainedBy.mainView`）、
 * 标题认领、cwd 覆盖 sr 根这个硬条件，以及"绝不挑一条列不出 sr 根的会话"这条纪律。
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
	INDEX_TITLE,
	configPathCandidates,
	containsPath,
	indexCacheKey,
	indexTitleFor,
	isIndexTitle,
	mergeRows,
	normPath,
	pickIndexSession,
	rowsFromList,
	rowsFromStore,
	samePath,
	titleOf,
} from "../src/pure/sessionpick.ts";
import type { SessionRow } from "../src/pure/sessionpick.ts";

const SR_ROOT = "D:\\TimeMachine\\GameDesignOS\\workspace";
const TM_ROOT = "D:\\TimeMachine";

const row = (o: Partial<SessionRow>): SessionRow => Object.assign({ id: "s" }, o);

test("normPath / samePath / containsPath：Windows 口径与「前缀陷阱」", () => {
	assert.equal(normPath("D:/TimeMachine/"), "d:\\timemachine");
	assert.equal(normPath(""), "");
	assert.equal(normPath(undefined), "");
	assert.equal(samePath("D:\\TimeMachine", "d:/timemachine/"), true);
	assert.equal(samePath("", ""), false, "空值一律判否（否则谁都算同一条）");

	assert.equal(containsPath(TM_ROOT, SR_ROOT), true, "祖先目录覆盖子目录");
	assert.equal(containsPath(SR_ROOT, SR_ROOT), true, "自己覆盖自己");
	assert.equal(containsPath(SR_ROOT, TM_ROOT), false, "子目录不覆盖祖先");
	assert.equal(containsPath("D:\\TimeMachine", "D:\\TimeMachine2\\x"), false, "前缀陷阱：不许 startsWith");
	assert.equal(containsPath("", SR_ROOT), false);
	assert.equal(containsPath(TM_ROOT, ""), false);
});

test("rowsFromStore：0.2.0 形状（ids/byId + retainedBy.mainView）能推出「当前选中」", () => {
	const state = {
		phase: "ready",
		ids: ["a", "b"],
		byId: {
			a: { id: "a", title: "联盟悬赏设计", displayTitle: "联盟悬赏设计", cwd: SR_ROOT, updatedAt: 10, blank: false, retainedBy: { mainView: 1 } },
			b: { id: "b", displayTitle: "sr-workbench", cwd: "D:\\TimeMachine\\sr-workbench", updatedAt: 99, blank: true, retainedBy: {} },
		},
	};
	const rows = rowsFromStore(state);
	assert.equal(rows.length, 2);
	assert.equal(rows[0].id, "a");
	assert.equal(rows[0].main, true, "0.2.0 用 mainView 计数表达当前选中");
	assert.equal(rows[0].display, "联盟悬赏设计");
	assert.equal(rows[1].main, false);
});

test("rowsFromStore：0.1.5 形状（current + byId，缺 ids）照样认得出当前选中", () => {
	const rows = rowsFromStore({ current: "x", byId: { x: { cwd: TM_ROOT, updatedAt: 5 } } });
	assert.deepEqual(rows.map((r) => [r.id, r.main]), [["x", true]]);
});

test("rowsFromStore：只有 current、byId 为空时也给出一条（不许因此判成「没有会话」）", () => {
	const rows = rowsFromStore({ current: "only", byId: {} });
	assert.equal(rows.length, 1);
	assert.equal(rows[0].id, "only");
	assert.equal(rows[0].main, true);
});

test("rowsFromStore：空快照 → 空数组（不是抛错）", () => {
	assert.deepEqual(rowsFromStore(null), []);
	assert.deepEqual(rowsFromStore(undefined), []);
	assert.deepEqual(rowsFromStore({}), []);
});

test("rowsFromList：0.2.0 的标题在 projections.values.title 里", () => {
	const rows = rowsFromList({
		items: [
			{ sessionId: "s1", cwd: SR_ROOT, updatedAt: 3, projections: { kind: "sequenced", asOfSeq: 9, values: { title: INDEX_TITLE + "（workspace）" } } },
			{ sessionId: "s2", cwd: TM_ROOT, updatedAt: 8 },
			{ sessionId: "", cwd: "x" },
			null,
		],
	});
	assert.equal(rows.length, 2, "空 id 的行要丢掉");
	assert.equal(rows[0].title, INDEX_TITLE + "（workspace）");
	assert.equal(rows[1].title, undefined);
	assert.equal(rows[1].cwd, TM_ROOT);
});

test("mergeRows：同 id 先来的赢（store 那份带着 main / displayTitle）", () => {
	const a = [row({ id: "s1", main: true, display: "来自 store" })];
	const b = [row({ id: "s1", title: "来自列表" }), row({ id: "s2" })];
	const m = mergeRows(a, b);
	assert.deepEqual(m.map((r) => r.id), ["s1", "s2"]);
	assert.equal(m[0].main, true);
	assert.equal(m[0].display, "来自 store");
});

test("pickIndexSession：① 标题认领优先，cwd 与 sr 根相等者先于祖先目录", () => {
	const rows = [
		row({ id: "parent", title: INDEX_TITLE, cwd: TM_ROOT, updatedAt: 100 }),
		row({ id: "exact", title: INDEX_TITLE + "（workspace）", cwd: SR_ROOT, updatedAt: 1 }),
		row({ id: "other", title: "随便一条", cwd: SR_ROOT, updatedAt: 999 }),
	];
	const hit = pickIndexSession(rows, SR_ROOT);
	assert.equal(hit && hit.id, "exact");
	assert.equal(hit && hit.source, "title");
});

test("pickIndexSession：标题认领里「没有任何一条覆盖 sr 根」时退到 cwd 覆盖的那条", () => {
	const rows = [
		row({ id: "stale", title: INDEX_TITLE, cwd: "E:\\别的仓库" }),
		row({ id: "ok", title: "用户自己的会话", cwd: SR_ROOT, updatedAt: 2 }),
	];
	const hit = pickIndexSession(rows, SR_ROOT);
	assert.equal(hit && hit.id, "ok");
	assert.equal(hit && hit.source, "cwd");
});

test("pickIndexSession：② 缓存命中（且覆盖 sr 根）时优先于标题与 cwd", () => {
	const rows = [
		row({ id: "named", title: INDEX_TITLE, cwd: SR_ROOT, updatedAt: 50 }),
		row({ id: "cached", title: "普通会话", cwd: TM_ROOT, updatedAt: 1 }),
	];
	const hit = pickIndexSession(rows, SR_ROOT, { cachedId: "cached" });
	assert.equal(hit && hit.id, "cached");
	assert.equal(hit && hit.source, "cache");
});

test("pickIndexSession：缓存那条**不覆盖** sr 根时不许认（否则一定列不出目录）", () => {
	const rows = [
		row({ id: "cached", cwd: "E:\\别的仓库" }),
		row({ id: "ok", cwd: SR_ROOT, updatedAt: 3 }),
	];
	const hit = pickIndexSession(rows, SR_ROOT, { cachedId: "cached" });
	assert.equal(hit && hit.id, "ok");
	assert.equal(hit && hit.source, "cwd");
});

test("pickIndexSession：③ 给了 sr 根时**绝不**退回「最近更新的一条」（会静默 0 个功能）", () => {
	const rows = [row({ id: "foreign", cwd: "E:\\别的仓库", updatedAt: 999 })];
	assert.equal(pickIndexSession(rows, SR_ROOT), null);
	// 只在"还不知道 sr 根"时才允许 foreign（那时只需要一条能读文件的会话）
	const loose = pickIndexSession(rows, "", { allowForeign: true });
	assert.equal(loose && loose.id, "foreign");
	assert.equal(loose && loose.source, "recent");
});

test("pickIndexSession：④ 没给 sr 根时按「当前选中 → 最近更新」落", () => {
	const rows = [
		row({ id: "old", cwd: TM_ROOT, updatedAt: 1 }),
		row({ id: "now", cwd: TM_ROOT, updatedAt: 2, main: true }),
	];
	assert.equal(pickIndexSession(rows, "", { allowForeign: true })?.id, "now");
	assert.equal(pickIndexSession(rows, "", { allowForeign: true })?.source, "main");

	const noMain = [row({ id: "a", updatedAt: 1 }), row({ id: "b", updatedAt: 7 })];
	assert.equal(pickIndexSession(noMain, "", { allowForeign: true })?.id, "b");
});

test("pickIndexSession：空候选 → null（调用方据此去建会话）", () => {
	assert.equal(pickIndexSession([], SR_ROOT, { allowForeign: true }), null);
	assert.equal(pickIndexSession([row({ id: "" })], SR_ROOT), null);
});

test("isIndexTitle / titleOf / indexTitleFor：前缀认领与展示名退让", () => {
	assert.equal(isIndexTitle(INDEX_TITLE), true);
	assert.equal(isIndexTitle(INDEX_TITLE + "（workspace）"), true);
	assert.equal(isIndexTitle("  " + INDEX_TITLE), false, "前面有空格就不算（认领要严）");
	assert.equal(isIndexTitle(undefined), false);
	assert.equal(titleOf(row({ title: "T", display: "D" })), "T");
	assert.equal(titleOf(row({ display: "D" })), "D");
	assert.equal(titleOf(row({})), "");
	assert.equal(titleOf(null), "");
	assert.equal(indexTitleFor(SR_ROOT), INDEX_TITLE + "（workspace）");
	assert.equal(indexTitleFor(""), INDEX_TITLE);
	assert.equal(indexTitleFor("D:\\a\\b\\"), INDEX_TITLE + "（b）");
});

test("configPathCandidates：每个根一条**绝对**候选，去重，末尾兜一条相对候选", () => {
	const c = configPathCandidates([TM_ROOT, TM_ROOT + "\\", SR_ROOT, "", null, undefined]);
	assert.deepEqual(c, [
		TM_ROOT + "\\.agents\\skills\\sr-askme\\config.local.json",
		SR_ROOT + "\\.agents\\skills\\sr-askme\\config.local.json",
		".agents/skills/sr-askme/config.local.json",
	]);
	// 大小写不同视为同一条（Windows）
	const c2 = configPathCandidates(["D:\\TimeMachine", "d:/timemachine"]);
	assert.equal(c2.length, 2, "第一条绝对 + 末尾相对");
	assert.equal(indexCacheKey(), "sr-wb.index.v1");
});
