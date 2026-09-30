/**
 * 索引会话选择（工单 32 · DSH 0.2.0 兼容）—— 纯函数用例。
 *
 * 覆盖的是**两种 store 形状**（0.1.5 的 `current` / 0.2.0 的 `retainedBy.mainView`）、
 * 标题认领、cwd 覆盖 sr 根这个硬条件，以及"绝不挑一条列不出 sr 根的会话"这条纪律。
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
	ARCHIVED_CACHED_NOTE,
	INDEX_TITLE,
	NO_ARCHIVE_INFO_NOTE,
	WORK_TITLE,
	archivedFromSnapshot,
	archivedIdSet,
	configPathCandidates,
	containsPath,
	featureTopicOf,
	indexCacheKey,
	indexTitleFor,
	isArchivedId,
	isIndexTitle,
	isWorkTitle,
	mergeRows,
	normPath,
	pickIndexSession,
	pickWorkSession,
	rowsFromList,
	rowsFromStore,
	samePath,
	titleOf,
	withoutArchived,
	workCacheDrop,
	workCacheGet,
	workCacheKey,
	workCachePut,
	workTitleFor,
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

test("mergeRows：先来的**空**字段由后来的补上（store 行没有 title 时不许把列表里的标题抹掉）", () => {
	// 真实形状：store 行的 title 要等 host 投影（SessionSummary.title 可能是 undefined），
	// 而 session/list 的标题在 projections.values.title 里 —— 两条是**同一条会话**。
	const store = [rowsFromStore({ ids: ["s1"], byId: { s1: { cwd: FEATURE, running: true, displayTitle: "联盟悬赏" } } })[0]];
	const list = rowsFromList({ items: [{ sessionId: "s1", cwd: FEATURE, projections: { values: { title: workTitleFor(FEATURE) } } }] });
	const m = mergeRows(store, list);
	assert.equal(m.length, 1);
	assert.equal(m[0].title, workTitleFor(FEATURE), "标题从列表那份补上");
	assert.equal(m[0].display, "联盟悬赏", "store 自己的展示名保留");
	assert.equal(m[0].running, true, "store 的 running 保留");
	assert.equal(m[0].cwd, FEATURE);
	// 合并之后，标题认领就能认出它（这正是"清掉缓存也不新建"的前提）
	const merged = pickWorkSession(m, FEATURE);
	assert.equal(merged && merged.id, "s1");
	assert.equal(merged && merged.source, "title");
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

// ════════════════════════════════════════════════════════════════════════════
// 工作会话（工单 15）：cwd = 功能根、标题认领、缓存、绝不抢用户的会话
// ════════════════════════════════════════════════════════════════════════════

const FEATURE = SR_ROOT + "\\features\\联盟悬赏";
const OTHER_FEATURE = SR_ROOT + "\\features\\神话宝库";

test("工作会话标题：带功能主题、与索引会话分得开", () => {
	assert.equal(featureTopicOf(FEATURE), "联盟悬赏");
	assert.equal(featureTopicOf(FEATURE + "\\"), "联盟悬赏", "尾部分隔符不算主题");
	assert.equal(featureTopicOf(""), "");
	assert.equal(workTitleFor(FEATURE), WORK_TITLE + "（联盟悬赏）");
	assert.equal(workTitleFor(""), WORK_TITLE);
	assert.equal(isWorkTitle(WORK_TITLE + "（联盟悬赏）"), true);
	assert.equal(isWorkTitle(WORK_TITLE), true);
	assert.equal(isWorkTitle("  " + WORK_TITLE), false, "前面有空格就不算（认领要严）");
	assert.equal(isWorkTitle(INDEX_TITLE), false, "索引会话不是工作会话");
	assert.equal(isWorkTitle(undefined), false);
	// 索引标题的认领不会把工作会话捞进来（两个前缀互不包含）
	assert.equal(isIndexTitle(workTitleFor(FEATURE)), false);
});

test("pickWorkSession：① 缓存命中（且 cwd 恰好是功能根）优先于标题", () => {
	const rows = [
		row({ id: "named", title: workTitleFor(FEATURE), cwd: FEATURE, updatedAt: 50 }),
		row({ id: "cached", title: "随便一条", cwd: FEATURE, updatedAt: 1 }),
	];
	const hit = pickWorkSession(rows, FEATURE, { cachedId: "cached" });
	assert.equal(hit && hit.id, "cached");
	assert.equal(hit && hit.source, "cache");
});

test("pickWorkSession：② 缓存丢了就按标题认回来（同 cwd 取最近更新的那条）", () => {
	const rows = [
		row({ id: "old", title: workTitleFor(FEATURE), cwd: FEATURE, updatedAt: 5 }),
		row({ id: "new", title: workTitleFor(FEATURE), cwd: FEATURE, updatedAt: 9 }),
	];
	const hit = pickWorkSession(rows, FEATURE);
	assert.equal(hit && hit.id, "new");
	assert.equal(hit && hit.source, "title");
});

test("pickWorkSession：③ **绝不**认用户的会话（cwd 对但标题不是我们起的）—— 用户故事 23", () => {
	const rows = [
		row({ id: "user", title: "我自己在联盟悬赏目录里的对话", cwd: FEATURE, updatedAt: 999, main: true }),
		row({ id: "other", title: workTitleFor(OTHER_FEATURE), cwd: OTHER_FEATURE, updatedAt: 100 }),
	];
	assert.equal(pickWorkSession(rows, FEATURE), null, "认了它 = 往用户的对话里插活");
	// 缓存里记的是"用户那条"也不认（缓存只是线索，仍要过标题这一关？不——缓存是我们自己写的凭据）
	assert.equal(pickWorkSession(rows, FEATURE, { cachedId: "user" })?.id, "user");
});

test("pickWorkSession：cwd 必须**恰好**是功能根（不是覆盖、不是别的功能）", () => {
	const rows = [
		row({ id: "root", title: workTitleFor(SR_ROOT), cwd: SR_ROOT, updatedAt: 9 }),
		row({ id: "other", title: workTitleFor(OTHER_FEATURE), cwd: OTHER_FEATURE, updatedAt: 9 }),
		row({ id: "sub", title: workTitleFor(FEATURE), cwd: FEATURE + "\\gdd", updatedAt: 9 }),
	];
	assert.equal(pickWorkSession(rows, FEATURE), null);
	assert.equal(pickWorkSession(rows, SR_ROOT)?.id, "root");
	// 路径写法不同（正斜杠 / 大小写）仍算同一个根
	const slash = [row({ id: "s", title: workTitleFor(FEATURE), cwd: FEATURE.replace(/\\/g, "/").toLowerCase(), updatedAt: 1 })];
	assert.equal(pickWorkSession(slash, FEATURE)?.id, "s");
});

test("pickWorkSession：空根 / 空候选 → null（调用方据此去建会话）", () => {
	assert.equal(pickWorkSession([row({ id: "a", cwd: FEATURE })], ""), null);
	assert.equal(pickWorkSession([], FEATURE), null);
	assert.equal(pickWorkSession([row({ id: "" })], FEATURE), null);
});

test("workCache：一个功能一条，坏 JSON 不抛，删掉只删自己那条", () => {
	assert.equal(workCacheKey(), "sr-wb.work.v1");
	assert.equal(workCacheGet(null, FEATURE), "", "没有缓存 → 空串");
	assert.equal(workCacheGet("{坏 json", FEATURE), "", "坏 JSON 当空表，不抛");

	let raw = workCachePut("", FEATURE, "sid-jjc");
	raw = workCachePut(raw, OTHER_FEATURE, "sid-other");
	assert.equal(workCacheGet(raw, FEATURE), "sid-jjc");
	assert.equal(workCacheGet(raw, OTHER_FEATURE), "sid-other");
	assert.equal(workCacheGet(raw, FEATURE.toUpperCase()), "sid-jjc", "Windows 大小写不敏感");
	assert.equal(workCacheGet(raw, FEATURE.replace(/\\/g, "/")), "sid-jjc", "分隔符不敏感");
	assert.equal(workCacheGet(raw, SR_ROOT), "", "别的路径没有条目");

	raw = workCacheDrop(raw, FEATURE);
	assert.equal(workCacheGet(raw, FEATURE), "");
	assert.equal(workCacheGet(raw, OTHER_FEATURE), "sid-other", "只删自己那条");
	// 空值不进表
	assert.equal(workCacheGet(workCachePut(raw, FEATURE, ""), FEATURE), "");
	assert.equal(workCacheGet(workCachePut(raw, "", "sid-x"), ""), "");
});

test("running：会话列表与 store 两种形状都收（忙碌要如实说一句）", () => {
	const fromList = rowsFromList({ items: [{ sessionId: "s1", cwd: FEATURE, running: true }, { sessionId: "s2", cwd: FEATURE }] });
	assert.deepEqual(fromList.map((r) => r.running), [true, false]);
	const fromStore = rowsFromStore({ ids: ["a"], byId: { a: { cwd: FEATURE, running: true } } });
	assert.equal(fromStore[0].running, true);
});

// ════════════════════════════════════════════════════════════════════════════
// 归档（2026-09-30 实测缺陷）：已归档的会话**侧边栏看不见** ⇒ 不许被认领
//   现象：面板认领了一条已归档会话 → 指令发进去了、会话日志有写入，
//         但侧边栏什么也没出现，用户判定"面板没反应，F5 都不出现"。
// ════════════════════════════════════════════════════════════════════════════

test("archivedFromSnapshot：唯一取值口径是快照的 archivedSessionIds；缺字段 = **拿不到**（不是空表）", () => {
	// 真实形状（dsh-api-workspace-controller 的 ClientWorkspaceModel.buildSnapshot）
	assert.deepEqual(
		archivedFromSnapshot({ items: [], archivedSessionIds: ["session-a", "session-b"], pinnedSessionIds: [] }),
		["session-a", "session-b"],
	);
	assert.deepEqual(archivedFromSnapshot({ archivedSessionIds: [] }), [], "明确的空集：一条都没归档");
	assert.deepEqual(archivedFromSnapshot({ archivedSessionIds: ["a", "", null, undefined] }), ["a"], "空值不进表");
	assert.equal(archivedFromSnapshot({ items: [] }), null, "没有这个字段 ⇒ 拿不到");
	assert.equal(archivedFromSnapshot(null), null);
	assert.equal(archivedFromSnapshot(undefined), null);
	assert.equal(archivedFromSnapshot({ archivedSessionIds: "session-a" }), null, "不是数组 ⇒ 拿不到");
});

test("archivedIdSet / isArchivedId / withoutArchived：拿不到归档集时**一律判否**（旧行为）", () => {
	assert.equal(archivedIdSet(["a"])?.has("a"), true);
	assert.equal(archivedIdSet(new Set(["a"]))?.has("a"), true, "Set 形状也收");
	assert.equal(archivedIdSet(null), null, "拿不到 = null（与空 Set 不同）");
	assert.equal(archivedIdSet("坏值"), null);

	assert.equal(isArchivedId(["a"], "a"), true);
	assert.equal(isArchivedId(["a"], "b"), false);
	assert.equal(isArchivedId(null, "a"), false, "拿不到 ⇒ 判否（降级不静默，由组合根说清）");
	assert.equal(isArchivedId(["a"], ""), false);
	assert.equal(isArchivedId(["a"], undefined), false);

	const rows = [row({ id: "a" }), row({ id: "b" })];
	assert.deepEqual(withoutArchived(rows, ["a"]).map((r) => r.id), ["b"]);
	assert.deepEqual(withoutArchived(rows, []).map((r) => r.id), ["a", "b"]);
	assert.deepEqual(withoutArchived(rows, null).map((r) => r.id), ["a", "b"], "拿不到 ⇒ 原样返回");
});

test("pickWorkSession：缓存里那条**已归档** ⇒ 不被选中（调用方据此去新建）", () => {
	const rows = [row({ id: "archived", title: workTitleFor(FEATURE), cwd: FEATURE, updatedAt: 99 })];
	// 不传归档集 = 旧行为（这就是缺陷现场）：缓存命中、被认领
	assert.equal(pickWorkSession(rows, FEATURE, { cachedId: "archived" })?.id, "archived");
	// 传了归档集：已归档的**不当可用** —— 它要被发指令，必须在界面上看得见
	assert.equal(pickWorkSession(rows, FEATURE, { cachedId: "archived", archived: ["archived"] }), null);
	assert.equal(pickWorkSession(rows, FEATURE, { archived: ["archived"] }), null, "标题认领也不许认它");
	// 归档集合是别的 id 时照旧命中（排除要精确，不能一刀切）
	assert.equal(pickWorkSession(rows, FEATURE, { cachedId: "archived", archived: ["别的一条"] })?.id, "archived");
	// 拿不到归档集 ⇒ 退回旧行为
	assert.equal(pickWorkSession(rows, FEATURE, { cachedId: "archived", archived: null })?.id, "archived");
});

test("pickWorkSession：同功能的旧条目被归档时，仍能认回**没被归档**的那条（不是一刀砍掉认领）", () => {
	const rows = [
		row({ id: "old", title: workTitleFor(FEATURE), cwd: FEATURE, updatedAt: 9 }),
		row({ id: "live", title: workTitleFor(FEATURE), cwd: FEATURE, updatedAt: 3 }),
	];
	const hit = pickWorkSession(rows, FEATURE, { archived: ["old"] });
	assert.equal(hit && hit.id, "live", "认最近更新的那条**可用的**");
	assert.equal(hit && hit.source, "title");
	// 缓存指到已归档那条时，也不会被它带偏
	assert.equal(pickWorkSession(rows, FEATURE, { cachedId: "old", archived: ["old"] })?.id, "live");
});

test("pickIndexSession：归档的会话从四条认领路径（缓存 / 标题 / cwd / 当前选中 / recent）里全部出局", () => {
	const rows = [
		row({ id: "cached", cwd: TM_ROOT, updatedAt: 1 }),
		row({ id: "named", title: INDEX_TITLE, cwd: SR_ROOT, updatedAt: 50 }),
		row({ id: "bycwd", cwd: SR_ROOT, updatedAt: 40 }),
		row({ id: "main", cwd: TM_ROOT, updatedAt: 30, main: true }),
	];
	const all = ["cached", "named", "bycwd", "main"];
	assert.equal(pickIndexSession(rows, SR_ROOT, { cachedId: "cached", archived: all }), null);
	assert.equal(pickIndexSession(rows, "", { cachedId: "cached", allowForeign: true, archived: all }), null);
	// 只归档一部分：缓存与标题出局后，退到 cwd 覆盖那条
	const hit = pickIndexSession(rows, SR_ROOT, { cachedId: "cached", archived: ["cached", "named"] });
	assert.equal(hit && hit.id, "bycwd");
	assert.equal(hit && hit.source, "cwd");
	// 向后兼容：不传 = 旧行为；拿不到（null）= 旧行为
	assert.equal(pickIndexSession(rows, SR_ROOT, { cachedId: "cached" })?.id, "cached");
	assert.equal(pickIndexSession(rows, SR_ROOT, { cachedId: "cached", archived: null })?.id, "cached");
});

test("归档的两句话就在纯层：拿不到要说「无法确认可见」，复用失败要说「归档 ≠ 删除」", () => {
	assert.ok(NO_ARCHIVE_INFO_NOTE.includes("取不到侧边栏的「已归档」集"));
	assert.ok(NO_ARCHIVE_INFO_NOTE.includes("无法确认目标会话在侧边栏可见"), "不许装成知道它在界面上可见");
	assert.ok(NO_ARCHIVE_INFO_NOTE.includes("取消归档"), "要给用户可执行的动作");
	assert.ok(ARCHIVED_CACHED_NOTE.includes("归档 ≠ 删除"));
	assert.ok(ARCHIVED_CACHED_NOTE.includes("不算可用"));
});
