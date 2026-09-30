/**
 * 自动刷新与版本指纹（工单 16）—— 纯函数用例。
 *
 * 这里断言的是**通道的真实形状**（0.2.0 实测，见 `src/pure/refresh.ts` 文件头）与它对面板的约束：
 *   · 帧的两种形状 + 认不出来时如实返回 null；
 *   · 订阅目标 = 逐个目录（`depth: 0` 的覆盖语义）+ 当前文件；
 *   · 一条变更 → 只重读受影响的那几个部件；
 *   · 目录目标**不按版本去重**（DSH 明文要求每次重列），文件目标按版本去重（自激防护）；
 *   · 指纹能变、能算、拿不到版本时如实为空；
 *   · 去抖合批的判据与 stat 核对的兜底。
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
	FLUSH_MAX_MS,
	FLUSH_QUIET_MS,
	MAX_TARGETS,
	RELOAD_PARTS,
	acceptFrame,
	fingerprintOf,
	freshnessOf,
	mergeApplied,
	parseFrame,
	planReload,
	shortDigest,
	shouldFlush,
	stalePaths,
	unionParts,
	watchPlan,
} from "../src/pure/refresh.ts";

const SR_ROOT = "D:\\TimeMachine\\GameDesignOS\\workspace";
const FEATURE = SR_ROOT + "\\features\\联盟悬赏";

// ── 一、帧 ────────────────────────────────────────────────────────────────
test("parseFrame：ready / change（有版本、absent 两种）原样收下；认不出来返回 null", () => {
	assert.deepEqual(parseFrame({ kind: "ready" }), { kind: "ready" });

	const f = parseFrame({
		kind: "change",
		change: { absolutePath: FEATURE + "\\gdd\\联盟悬赏_20260923_定稿.md", version: "dev:1:2:3:4" }
	});
	assert.equal(f && f.kind, "change");
	assert.equal((f as any).change.path, FEATURE + "\\gdd\\联盟悬赏_20260923_定稿.md");
	assert.equal((f as any).change.version, "dev:1:2:3:4");
	assert.equal((f as any).change.absent, false);

	const a = parseFrame({ kind: "change", change: { absolutePath: FEATURE + "\\gdd\\x.md", absent: true } });
	assert.equal((a as any).change.absent, true);
	assert.equal((a as any).change.version, "", "absent 帧没有 version —— 不能编一个");

	assert.equal(parseFrame(null), null);
	assert.equal(parseFrame({ kind: "change" }), null, "没有 change 对象 = 认不出来");
	assert.equal(parseFrame({ kind: "change", change: {} }), null, "没有 absolutePath = 认不出来");
	assert.equal(parseFrame({ kind: "wat" }), null);
});

// ── 二、订阅计划 ──────────────────────────────────────────────────────────
test("watchPlan：功能根 + 各桶 + 桶下面那一层 + 当前文件；逐个目录（depth 0 的覆盖面）", () => {
	const p = watchPlan({
		root: FEATURE,
		dirs: ["analysis", "gdd", "decisions", "evidence", "source", "delivery"],
		nested: ["gdd\\UI", "evidence\\frames"],
		file: FEATURE + "\\gdd\\联盟悬赏_20260923_定稿.md"
	});
	assert.deepEqual(p.dirs, [
		FEATURE,
		FEATURE + "\\analysis",
		FEATURE + "\\gdd",
		FEATURE + "\\decisions",
		FEATURE + "\\evidence",
		FEATURE + "\\source",
		FEATURE + "\\delivery",
		FEATURE + "\\gdd\\UI",
		FEATURE + "\\evidence\\frames"
	]);
	assert.equal(p.file, FEATURE + "\\gdd\\联盟悬赏_20260923_定稿.md");
	assert.equal(p.targets.length, 10, "根 + 6 桶 + 2 层子目录 + 当前文件");
	assert.deepEqual(p.dropped, []);
	assert.ok(p.targets.indexOf(FEATURE) >= 0, "**功能根必须订阅**（新桶出现要能看见）");
	assert.ok(p.targets.indexOf(FEATURE + "\\gdd") >= 0, "**gdd 桶必须订阅**（否则看不见定稿被改）");
});

test("watchPlan：超上限时如实报被丢掉的目标（不静默），且当前文件不会被丢", () => {
	const p = watchPlan({
		root: FEATURE,
		dirs: ["analysis", "gdd", "decisions"],
		nested: ["a", "b", "c"],
		file: FEATURE + "\\gdd\\x_定稿.md",
		max: 4
	});
	assert.equal(p.targets.length, 4);
	assert.deepEqual(p.targets, [FEATURE, FEATURE + "\\gdd\\x_定稿.md", FEATURE + "\\analysis", FEATURE + "\\gdd"]);
	assert.ok(p.dropped.length > 0, "被丢掉的目标要报出来");
	assert.equal(p.file, FEATURE + "\\gdd\\x_定稿.md", "当前文件优先级高于桶目录（它最便宜、且是自激防护的对象）");
});

test("watchPlan：去重与尾部分隔符（同一个目录写两种形状只订阅一次）", () => {
	const p = watchPlan({ root: FEATURE + "\\", dirs: ["gdd", "gdd\\", "GDD"], nested: [], file: "" });
	assert.deepEqual(p.targets, [FEATURE, FEATURE + "\\gdd"]);
	assert.equal(p.file, "");
	assert.equal(MAX_TARGETS >= 8, true, "真实功能（根 + 6 桶 + 子目录）要放得下");
});

// ── 三、一条变更 → 重读哪些部件 ────────────────────────────────────────────
test("planReload：按**桶**判定该重读什么（只重读受影响的那几处）", () => {
	const at = (rel: string) => planReload({ path: FEATURE + "\\" + rel }, { root: FEATURE, srWs: SR_ROOT });

	assert.deepEqual(at("analysis\\experience-report_联盟悬赏_20260915.md").parts, ["detail", "brain"]);
	assert.deepEqual(at("decisions\\decision_联盟悬赏_20260929.json").parts, ["detail", "ledger"]);
	// ★ 工单 24：`evidence\` 多挂 `draft`（读回回执 `readback_*` 在文档生成工作面里）
	assert.deepEqual(at("evidence\\calibration_联盟悬赏_r1.jsonl").parts, ["detail", "ledger", "draft"]);
	assert.deepEqual(at("evidence\\readback_A079_联盟悬赏_20261001.md").parts, ["detail", "ledger", "draft"]);
	// ★ 工单 24：`gdd\` 顶层多挂 `draft`（成稿与定稿 §6 都在这儿）
	assert.deepEqual(at("gdd\\联盟悬赏_20260923_定稿.md").parts, ["detail", "final", "ui", "draft"]);
	assert.deepEqual(at("gdd\\联盟悬赏_20260918.md").parts, ["detail", "final", "ui", "draft"], "成稿也是 gdd 顶层的文件");
	assert.deepEqual(at("gdd\\UI\\UI-M1 联盟悬赏主面板.png").parts, ["detail", "ui"], "gdd 的子目录只管界面图，不必重读定稿全文");
	assert.deepEqual(at("source\\录屏.mp4").parts, ["detail"]);
	assert.deepEqual(at("delivery\\包.zip").parts, ["detail"]);

	// 目录目标（帧里的路径就是被订阅的那个目录）走同一条判据
	assert.deepEqual(planReload({ path: FEATURE + "\\analysis" }, { root: FEATURE }).parts, ["detail", "brain"]);
	assert.deepEqual(planReload({ path: FEATURE + "\\gdd" }, { root: FEATURE }).parts, ["detail", "final", "ui", "draft"]);
	assert.deepEqual(planReload({ path: FEATURE + "\\evidence" }, { root: FEATURE }).parts, ["detail", "ledger", "draft"]);
	assert.deepEqual(planReload({ path: FEATURE }, { root: FEATURE }).parts, ["detail", "board"], "功能根自己变了 → 卡片也要重算");

	// 删除也是变更（absent 不改变部件判据，只改理由的措辞）
	const del = planReload({ path: FEATURE + "\\analysis\\old.md", absent: true }, { root: FEATURE });
	assert.deepEqual(del.parts, ["detail", "brain"]);
	assert.ok(del.reason.indexOf("已不在") >= 0);
});

test("planReload：别的功能 → 只看板；工作区外 → 忽略（不瞎读）", () => {
	const other = planReload({ path: SR_ROOT + "\\features\\神话宝库\\gdd\\x.md" }, { root: FEATURE, srWs: SR_ROOT });
	assert.deepEqual(other.parts, ["board"]);
	assert.ok(other.reason.indexOf("别的功能") >= 0);

	const outside = planReload({ path: "D:\\TimeMachine\\planner\\策划配置\\a.xlsx" }, { root: FEATURE, srWs: SR_ROOT });
	assert.deepEqual(outside.parts, []);
	assert.ok(outside.reason.indexOf("忽略") >= 0);

	assert.deepEqual(planReload({ path: FEATURE + "\\x" }, { root: "" }).parts, [], "拿不到功能根就不动");
	assert.deepEqual(planReload({ path: "" }, { root: FEATURE }).parts, []);
});

test("unionParts：一批变更 → 部件并集（顺序稳定，便于断言与显示）", () => {
	const plans = [
		planReload({ path: FEATURE + "\\analysis\\a.md" }, { root: FEATURE }),
		planReload({ path: FEATURE + "\\gdd\\b_定稿.md" }, { root: FEATURE }),
		planReload({ path: FEATURE + "\\analysis\\c.md" }, { root: FEATURE })
	];
	assert.deepEqual(unionParts(plans), ["detail", "brain", "final", "ui", "draft"]);
	assert.deepEqual(unionParts([]), []);
	// ★ 工单 24：新部件在**全集**里（手动刷新会重读它）+ 顺序稳定（`RELOAD_PARTS` 是唯一顺序出处）
	assert.deepEqual(RELOAD_PARTS, ["board", "detail", "ledger", "brain", "final", "ui", "draft"]);
	assert.ok(RELOAD_PARTS.indexOf("draft") >= 0, "文档生成工作面在“全部部件”里 —— 手动刷新不许漏它");
	// 单桶各自的并集（一条 analysis 帧不该牵到 draft；一条 gdd 帧要牵到）
	assert.deepEqual(unionParts([planReload({ path: FEATURE + "\\analysis\\a.md" }, { root: FEATURE })]), ["detail", "brain"]);
	assert.deepEqual(unionParts([planReload({ path: FEATURE + "\\gdd" }, { root: FEATURE })]), ["detail", "final", "ui", "draft"]);
});

// ── 四、自激防护 ──────────────────────────────────────────────────────────
test("acceptFrame：目录目标**永不按版本去重**（DSH 明文：子项内容变了目录版本可能不变）", () => {
	const dir = FEATURE + "\\gdd";
	const st = { applied: { ["d:\\x\\gdd"]: "" }, file: FEATURE + "\\gdd\\当前定稿.md" };
	const a = acceptFrame({ path: dir, version: "same-version" }, Object.assign({}, st, { applied: { ["d:\\x\\gdd"]: "same-version" } }));
	assert.equal(a.accept, true);
	assert.ok(a.reason.indexOf("目录目标") >= 0);
});

test("acceptFrame：文件目标按版本去重 —— 这就是自激防护（读完又收到同一版本 ⇒ 不重读）", () => {
	const file = FEATURE + "\\gdd\\联盟悬赏_20260923_定稿.md";
	const applied = { ["d:\\timemachine\\gamedesignos\\workspace\\features\\联盟悬赏\\gdd\\联盟悬赏_20260923_定稿.md"]: "dev:1:2:3:4" };

	const same = acceptFrame({ path: file, version: "dev:1:2:3:4" }, { applied: applied, file: file });
	assert.equal(same.accept, false);
	assert.ok(same.reason.indexOf("自激防护") >= 0, "理由里点明是自激防护：" + same.reason);

	const changed = acceptFrame({ path: file, version: "dev:1:2:3:9" }, { applied: applied, file: file });
	assert.equal(changed.accept, true);
	assert.ok(changed.reason.indexOf("版本变了") >= 0);

	const first = acceptFrame({ path: file, version: "v1" }, { applied: {}, file: file });
	assert.equal(first.accept, true, "第一次见到就该读");

	// 大小写与分隔符归一后再比
	const mixed = acceptFrame({ path: file.replace(/\\/g, "/").toLowerCase(), version: "dev:1:2:3:4" }, { applied: applied, file: file });
	assert.equal(mixed.accept, false, "路径归一后仍判为同一份内容");

	// 文件被删：本来就没有 ⇒ 不重读；读过的被删 ⇒ 重读（界面上要变成"没了"）
	assert.equal(acceptFrame({ path: file, absent: true }, { applied: {}, file: file }).accept, false);
	assert.equal(acceptFrame({ path: file, absent: true }, { applied: applied, file: file }).accept, true);

	// 没有文件目标时（不在定稿页签）一律当目录口径：不按版本拦
	assert.equal(acceptFrame({ path: file, version: "dev:1:2:3:4" }, { applied: applied, file: "" }).accept, true);
});

// ── 五、指纹 ──────────────────────────────────────────────────────────────
test("fingerprintOf：内容变了指纹就变；同一份内容稳定；一个都没有就是空串", () => {
	const a = { ["d:\\f\\a.md"]: "v1", ["d:\\f\\b.md"]: "v2" };
	const b = { ["d:\\f\\a.md"]: "v1", ["d:\\f\\b.md"]: "v3" };
	const a2 = { ["d:\\f\\b.md"]: "v2", ["d:\\f\\a.md"]: "v1" };

	const fa = fingerprintOf(a);
	assert.equal(fa.digest.length, 8);
	assert.equal(fa.known, 2);
	assert.equal(fa.digest, fingerprintOf(a2).digest, "与键序无关（先排序）");
	assert.notEqual(fa.digest, fingerprintOf(b).digest, "版本变了指纹必须变");
	assert.equal(fingerprintOf({}).digest, "", "拿不到版本时不编一个假指纹");
	assert.equal(fingerprintOf({}).known, 0);
	assert.equal(shortDigest(""), "——");
	assert.equal(shortDigest("abcd1234"), "abcd1234");
});

test("fingerprintOf：给了清单就只统计清单里的（换页签多读几个文件不会把指纹搅乱）", () => {
	const applied = { ["d:\\f\\a.md"]: "v1", ["d:\\f\\b.md"]: "v2", ["d:\\f\\c.md"]: "v3" };
	const onlyAB = fingerprintOf(applied, ["d:\\f\\a.md", "d:\\f\\b.md"]);
	assert.equal(onlyAB.known, 2);
	assert.equal(onlyAB.total, 2);
	assert.deepEqual(onlyAB.missing, []);
	assert.equal(fingerprintOf(applied, ["d:\\f\\a.md", "d:\\f\\b.md"]).digest, fingerprintOf({ ["d:\\f\\a.md"]: "v1", ["d:\\f\\b.md"]: "v2" }).digest);

	const withMissing = fingerprintOf(applied, ["d:\\f\\a.md", "d:\\f\\zz.md"]);
	assert.equal(withMissing.known, 1);
	assert.equal(withMissing.total, 2);
	assert.deepEqual(withMissing.missing, ["d:\\f\\zz.md"], "清单里有、但还没读到版本的文件要如实列出来");
});

// ── 六、新鲜度 ────────────────────────────────────────────────────────────
test("freshnessOf：已是最新 / 有 N 处新变化 / 通道不可用 / 未订阅", () => {
	const fresh = freshnessOf({ phase: "on", pending: 0, digest: "abcd1234" });
	assert.equal(fresh.state, "fresh");
	assert.ok(fresh.text.indexOf("已是最新") >= 0);

	const stale = freshnessOf({ phase: "on", pending: 3, digest: "abcd1234" });
	assert.equal(stale.state, "stale");
	assert.ok(stale.text.indexOf("有 3 处新变化") >= 0, "一眼能看出" + stale.text);

	const down = freshnessOf({ phase: "down", pending: 0, digest: "abcd1234", reason: "宿主不支持 watch" });
	assert.equal(down.state, "down");
	assert.ok(down.text.indexOf("不会") >= 0 && down.text.indexOf("刷新") >= 0, "降级时必须如实说" + down.text);

	const off = freshnessOf({ phase: "off" });
	assert.equal(off.state, "off");
	assert.equal(freshnessOf({ phase: "on", pending: 0, digest: "" }).state, "unknown", "还没读到内容时不假装最新");
	assert.equal(freshnessOf({}).pending, 0);
});

// ── 七、去抖合批 / stat 核对 ──────────────────────────────────────────────
test("shouldFlush：静默 300ms 落一次；一直写也有 1.5s 上限；空批不落", () => {
	const t0 = 1000000;
	assert.equal(shouldFlush({ firstAt: 0, lastAt: 0 }, t0), false, "空批不落");
	assert.equal(shouldFlush({ firstAt: t0, lastAt: t0 }, t0 + 100), false, "刚写完，再等等");
	assert.equal(shouldFlush({ firstAt: t0, lastAt: t0 }, t0 + FLUSH_QUIET_MS), true, "静默到点就落");
	assert.equal(shouldFlush({ firstAt: t0, lastAt: t0 + 900 }, t0 + 1000), false, "还在写（静默不够）");
	assert.equal(shouldFlush({ firstAt: t0, lastAt: t0 + 900 }, t0 + 1000, { quietMs: 300, maxWaitMs: 1200 }), false);
	assert.equal(shouldFlush({ firstAt: t0, lastAt: t0 + 1400 }, t0 + 1500), true, "但一直在写也不能无限等");
	assert.equal(shouldFlush({ firstAt: t0, lastAt: t0 + 1400 }, t0 + 1500, { maxWaitMs: FLUSH_MAX_MS }), true);
});

test("stalePaths：stat 核对（切回面板 / 轮询的底线）—— 只报与屏幕上不一致的", () => {
	const applied = { ["d:\\f\\a.md"]: "v1", ["d:\\f\\b.md"]: "v2" };
	assert.deepEqual(stalePaths(applied, { "d:\\f\\a.md": "v1", "d:\\f\\b.md": "v2" }), []);
	assert.deepEqual(stalePaths(applied, { "D:/f/a.md": "v9" }), ["D:/f/a.md"], "大小写/分隔符归一后仍能判出变化");
	assert.deepEqual(stalePaths(applied, { "d:\\f\\c.md": "v1" }), ["d:\\f\\c.md"], "没见过的文件也算（它以前没有）");
	assert.deepEqual(stalePaths(applied, null), []);
	assert.deepEqual(stalePaths(applied, { "d:\\f\\a.md": "" }), [], "空版本不当成变化");
	assert.deepEqual(stalePaths({}, {}), []);
});

test("mergeApplied：并进读到的版本（键归一、空版本丢掉、新值赢）", () => {
	const a = { ["d:\\f\\a.md"]: "v1" };
	const m = mergeApplied(a, { "D:/f/a.md": "v2", "d:\\f\\b.md": "v3", "d:\\f\\c.md": "" });
	assert.deepEqual(m, { ["d:\\f\\a.md"]: "v2", ["d:\\f\\b.md"]: "v3" });
	assert.deepEqual(mergeApplied(a, null), a);
	assert.deepEqual(mergeApplied(null, null), {});
});
