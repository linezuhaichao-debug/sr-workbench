/**
 * 加载器 —— **只吃 port**，产出视图模型（spec「测试接缝」+「Testing Decisions」的落点）。
 *
 * 这里全部走文件侧替身（`node:fs` 直读真实工作区），断言的是**视图模型**：
 * 看板算出这几个功能、这些状态、这些告警；定稿解析出这些章/组/条目与行号。
 * （迁移自 legacy/test-dashboard-v1.js：那份要"复刻 loadDashboardInner 的编排"才能离线跑。）
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { CONFIG_DIR, loadDashboard, SR_WS } from "../src/load/dashboard.ts";
import { loadFinal, loadIndex, loadInterface } from "../src/load/final.ts";
import { loadLedger } from "../src/load/ledger.ts";
import { readAllText, readHead } from "../src/load/read.ts";
import { FEATURE_ROOT, FINAL_GDD, SKILLS_ROOT, SR_CONFIG, WORKSPACE, requireRealData, testPort } from "./paths.ts";

requireRealData();
const signal = new AbortController().signal;

test("看板：真实工作区算出 4 个功能 + 92 张配置表，且锚点是绝对路径", async () => {
	const port = testPort();
	const d = await loadDashboard(port, { cwd: "D:\\TimeMachine", configPath: SR_CONFIG, signal });

	assert.equal(d.srWs, WORKSPACE, "锚点应是 sr 配置里的绝对路径");
	assert.equal(d.configFile, SR_CONFIG);
	assert.equal(d.counts.features, 4);
	assert.equal(d.counts.configs, 92);
	assert.deepEqual(
		d.features.map((f) => f.topic),
		["联盟悬赏", "诸神降临", "英雄圣物", "神话宝库"],
	);
	assert.equal(d.pathNote, undefined, "读到 sr 配置就不该走相对路径兜底");
});

test("看板：真实功能的阶段、定稿、告警（联盟悬赏 = active 定稿 + V1 两份 active）", async () => {
	const port = testPort();
	const d = await loadDashboard(port, { configPath: SR_CONFIG, signal });
	const f = d.features.find((x) => x.topic === "联盟悬赏");
	assert.ok(f, "应有联盟悬赏");
	// ★ `root` / `openPath` 是**混合分隔符**的绝对路径（`<绝对锚点>/features/<主题>`）——
	//   这是迁移前 client.js:1141 的原样行为（`srWs + "/features/" + t`），读文件时 Windows 两种分隔符都认，
	//   所以本票**不改产品行为**：断言里归一化后比较，并在此如实记下这个待清理的表述问题（留给后续票）。
	assert.equal(path.normalize(f.root), path.join(WORKSPACE, "features", "联盟悬赏"));
	assert.equal(f.latestFinal, "联盟悬赏_20260923_定稿.md");
	assert.equal(f.latestDate, "20260923");
	assert.equal(f.docType, "final_gdd");
	assert.equal(f.status, "active");
	assert.equal(f.finals, 2);
	assert.equal(f.historyCount, 1);
	assert.equal(path.normalize(f.openPath), FINAL_GDD);
	assert.deepEqual(f.stages, { concept: true, draft: true, config: true, final: true, review: true, speech: false });
	assert.deepEqual(f.finalCheck.issues.map((i) => i.code), ["V1"]);
	assert.equal(f.configs.length > 0, true, "联盟悬赏应挂到真实配置表");
	// 其余三个功能：没有定稿（目录存在就是功能）
	const others = d.features.filter((x) => x.topic !== "联盟悬赏");
	assert.ok(others.every((x) => x.latestFinal === null && x.finalCheck.current === null));
	assert.ok(d.legacyLeft > 0, "旧扁平层还剩文件（真实数据如此），只用于提示");
});

test("决策台账：真实功能根上的 4 份决策 + 8 行校准 + 1 份交接 JSON + 真实 schema", async () => {
	const port = testPort();
	const L = await loadLedger(port, { root: FEATURE_ROOT, skillsRoot: SKILLS_ROOT, signal });
	assert.equal(L.records.length, 4);
	assert.equal(L.schemaOk, true);
	assert.equal(L.schema.title, "SR Decision Object");
	assert.equal(L.calFiles.length, 2);
	assert.equal(L.calibration.length, 8);
	assert.equal(L.handoffs.length, 1);
	assert.equal(L.handoffs[0].name, "sr-gdd-handoff_联盟悬赏_20260918.json");
	// 记录按文件名倒序（决策台账的显示口径）
	assert.equal(L.records[0].file, "decision_联盟悬赏_20260929.json");
	assert.equal(L.records[0].issues.length, 0);
	assert.equal(L.records[1].issues.length, 3, "这份真实记录确实不合规（多出 schema 未声明字段）");
});

test("定稿：读真实定稿并附上路径/目录/文件名；缺文件给可读错误", async () => {
	const port = testPort();
	const g = await loadFinal(port, FINAL_GDD, signal);
	assert.equal(g.name, "联盟悬赏_20260923_定稿.md");
	assert.equal(g.dir, path.join(WORKSPACE, "features", "联盟悬赏", "gdd"));
	assert.equal(g.path, FINAL_GDD);
	assert.deepEqual(g.stats, { chapters: 11, groups: 28, rows: 214 });

	const missing = await loadFinal(port, path.join(FEATURE_ROOT, "gdd", "不存在.md"), signal);
	assert.match(missing.error, /读不到定稿/);
	assert.deepEqual(await loadFinal(port, "", signal), { empty: "这个功能还没有定稿。" });
});

test("界面图：读真实定稿的 §5（4 个界面 / 7 张图 / 28 条 UE）", async () => {
	const port = testPort();
	const r = await loadInterface(port, FINAL_GDD, signal);
	assert.equal(r.file, "联盟悬赏_20260923_定稿.md");
	assert.equal(r.uis.length, 4);
	assert.equal(
		r.uis.reduce((n, u) => n + u.images.length, 0),
		7,
	);
	assert.equal(
		r.uis.reduce((n, u) => n + u.ueCount, 0),
		28,
	);
	assert.deepEqual(await loadInterface(port, "", signal), { empty: "本功能还没有定稿，界面图在定稿的 §5。" });
});

test("设计资产索引：读真实的 design-asset-index.json", async () => {
	const port = testPort();
	const idx = await loadIndex(port, WORKSPACE, signal);
	assert.equal(idx.schemaVersion, "0.8.0");
	assert.equal(idx.assets.length, 41);
	assert.ok(idx.assets.every((a: any) => typeof a.path === "string"));
});

test("读原语：readHead 只读 14 行；readAllText 分页拼回全文；读不到给 null", async () => {
	const port = testPort();
	const head = await readHead(port, FINAL_GDD, signal);
	assert.ok(head && head.split(/\r?\n/).length === 14);
	assert.match(head, /doc_type: final_gdd/);

	const all = await readAllText(port, FINAL_GDD, signal, 6000);
	assert.ok(all && all.split(/\r?\n/).length > 400, "真实定稿应为数百行：实际 " + (all ? all.split(/\r?\n/).length : 0));

	assert.equal(await readAllText(port, path.join(FEATURE_ROOT, "nope.md"), signal), null);
	assert.equal(await readHead(port, path.join(FEATURE_ROOT, "nope.md"), signal), null);
});

test("缺 sr 配置时如实降级（退回相对路径并给出 pathNote，不假装读到）", async () => {
	const port = testPort();
	const d = await loadDashboard(port, { cwd: "D:\\X", configPath: path.join(WORKSPACE, "不存在-config.json"), signal });
	// ★ 原断言写的是 `d.srWs === undefined` —— 那是错的：迁移前的实现（src/client.js:1112-1117）在兜底分支里
	//   走的是同一条 loadDashboardInner，返回值**照样带** `srWs: SR_WS` / `configRoot: CONFIG_DIR`（相对路径）。
	//   "没读到绝对锚点"这件事由 `pathNote` + `configFile` 如实标注，而不是把它塞成 undefined。
	//   这里改成断言"锚点退回了相对路径"，这才是真行为，也让"读到了绝对路径"（上一条用例）能被区分开。
	assert.equal(d.srWs, SR_WS);
	assert.equal(d.configRoot, CONFIG_DIR);
	assert.match(d.pathNote, /未读到 sr 配置/);
	assert.equal(d.cwd, "D:\\X");
	assert.equal(d.configFile, "(未找到 sr 配置)");
	// 相对路径兜底仍然枚举（相对的是"会话工作区"，替身里没有 → 0 个功能、不抛）
	assert.deepEqual(d.counts.features, 0);
	assert.equal(SR_WS, "GameDesignOS/workspace");
});
