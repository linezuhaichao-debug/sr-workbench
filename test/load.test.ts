/**
 * 加载器 —— **只吃 port**，产出视图模型（spec「测试接缝」+「Testing Decisions」的落点）。
 *
 * 这里全部走文件侧替身（`node:fs` 直读真实工作区），断言的是**视图模型**：
 * 看板算出这几个功能、这些状态、这些告警；定稿解析出这些章/组/条目与行号。
 * （迁移自 legacy/test-dashboard-v1.js：那份要"复刻 loadDashboardInner 的编排"才能离线跑。）
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { CONFIG_DIR, loadDashboard, SR_WS } from "../src/load/dashboard.ts";
import { loadFeatureDetail } from "../src/load/feature.ts";
import { loadFinal, loadInterface } from "../src/load/final.ts";
import { loadLedger } from "../src/load/ledger.ts";
import { readAllText, readHead } from "../src/load/read.ts";
import { ledgerOf } from "../src/pure/ledger.ts";
import { dateOf, isNoise } from "../src/pure/topic.ts";
import {
	FEATURES_ROOT, FEATURE_ROOT, FINAL_GDD, PLANNER_CONFIG_DIR, SKILLS_ROOT, SR_CONFIG, WORKSPACE,
	readText, requireRealData, testPort,
} from "./paths.ts";
import {
	bucketCounts, fileNames, namesMatching, shallowFiles, topicDirs,
} from "./reality.ts";

requireRealData();
const signal = new AbortController().signal;

/** 配置目录里的文件（与看板同一口径：排掉 Excel 的 `~$` 锁文件，其余一律照列） */
function configFilesOnDisk(): string[] {
	return fileNames(PLANNER_CONFIG_DIR).filter((n) => n.indexOf("~$") !== 0);
}

/** 磁盘上的功能主题（目录即功能；排除明显的噪音名 —— 与看板的 `isNoise` 同判据） */
function topicsOnDisk(): string[] {
	return topicDirs(FEATURES_ROOT).filter((t) => !isNoise(t));
}

/** 校准流水的条目数 = 那些 jsonl 里的非空行数（台账逐行读的口径） */
function calRowsOnDisk(names: string[]): number {
	let n = 0;
	for (const f of names) {
		for (const line of readText(path.join(FEATURE_ROOT, "evidence", f)).split(/\r?\n/)) if (line.trim()) n += 1;
	}
	return n;
}

/**
 * ★ 不变式（原先写死 3 / 92，那是**真数据快照**）：条数改成与**同一时刻重算的磁盘真值**比。
 *   用户按设计加一个功能、加一张配置表都不会误红；少列 / 多列一个照样红。
 */
test("看板：锚点是绝对路径，功能数与配置表数与磁盘同一时刻的实际一致", async () => {
	const port = testPort();
	const d = await loadDashboard(port, { cwd: "D:\\TimeMachine", configPath: SR_CONFIG, signal });

	assert.equal(d.srWs, WORKSPACE, "锚点应是 sr 配置里的绝对路径");
	assert.equal(d.configFile, SR_CONFIG);
	assert.equal(d.counts.features, topicsOnDisk().length, "功能数 == 磁盘 `features\\` 下的目录数");
	assert.equal(d.counts.configs, configFilesOnDisk().length, "配置表数 == 配置目录里的文件数（已排掉 `~$` 锁文件）");
	// 看板列出的功能与磁盘目录**集合相等**（顺序下面单独验排序口径）
	assert.deepEqual(d.features.map((f) => f.topic).slice().sort(), topicsOnDisk().slice().sort(),
		"看板列出的功能就是磁盘上的那些目录（多一个少一个都红）");
	// 排序口径：按"最新定稿日期"倒序（没有定稿的排后面；同为空不强求相对次序）
	const dates = d.features.map((f) => f.latestDate);
	for (let i = 0; i + 1 < dates.length; i++) {
		assert.ok(dates[i] >= dates[i + 1], "功能应按最新定稿日期倒序，实际 " + dates.join(" / "));
	}
	// 三个已知功能都还在（2026-10-08 身份迁移后的现状）。★ 新增功能不打破这条，改名才打破。
	for (const t of ["讨伐", "诸神降临", "英雄圣物"]) {
		assert.ok(d.features.some((f) => f.topic === t), "应有功能「" + t + "」");
	}
	assert.equal(d.pathNote, undefined, "读到 sr 配置就不该走相对路径兜底");
});

test("看板：真实功能的阶段、定稿、告警（讨伐 = active 定稿 + V1 两份 active）", async () => {
	const port = testPort();
	const d = await loadDashboard(port, { configPath: SR_CONFIG, signal });
	const f = d.features.find((x) => x.topic === "讨伐");
	assert.ok(f, "应有讨伐（原「联盟悬赏」，2026-10-08 改名）");
	// ★ `root` / `openPath` 是**混合分隔符**的绝对路径（`<绝对锚点>/features/<主题>`）——
	//   这是迁移前 client.js:1141 的原样行为（`srWs + "/features/" + t`），读文件时 Windows 两种分隔符都认，
	//   所以本票**不改产品行为**：断言里归一化后比较，并在此如实记下这个待清理的表述问题（留给后续票）。
	assert.equal(path.normalize(f.root), FEATURE_ROOT);
	// ★ 定稿那几个数**从磁盘同一时刻重算**（`gdd\` 里 `_定稿.md` 那一档，与 `gddKindOf` 同口径）——
	//   走 `/sr-gdd-fix` 留版本（多一份定稿）不会误红，看板把定稿认错才会红。
	const finalsOnDisk = namesMatching(path.join(FEATURE_ROOT, "gdd"), /_定稿\.md$/i);
	const byDate = finalsOnDisk.slice().sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : -1));
	assert.deepEqual(f.files.final, byDate, "看板列出的定稿 = 磁盘 `gdd\\` 里的 `_定稿.md`，且按文件名日期倒序");
	assert.equal(f.finals, finalsOnDisk.length);
	assert.equal(f.latestFinal, byDate[0] || null);
	assert.equal(f.latestDate, byDate[0] ? dateOf(byDate[0]) : "");
	assert.equal(f.historyCount, Math.max(0, finalsOnDisk.length - 1));
	assert.equal(path.normalize(f.openPath), path.join(FEATURE_ROOT, "gdd", byDate[0]));
	// 当前有效定稿的头部 —— 这份文件的名字本身就是坐标（`test/paths.ts` 的 `FINAL_GDD`）
	assert.equal(path.basename(FINAL_GDD), "联盟悬赏_20260923_定稿.md");
	assert.equal(f.docType, "final_gdd");
	assert.equal(f.status, "active");
	assert.ok(f.finals >= 1, "讨伐至少有一份定稿（`FINAL_GDD` 是它的一员）");
	assert.ok(f.files.final.includes(path.basename(FINAL_GDD)));
	// ★ 2026-10-08 改名后遗症（**真实缺口，如实钉在这里**）：看板的配置表匹配是**按主题名**做的
	//   （`configByTopic`），而配置表文件名里写的还是旧名「联盟悬赏」⇒ 改名成「讨伐」之后挂不上。
	//   本票不改产品行为（改名只改目录名，见 `identity-rename-merge-report.md` 的「还没做」第 3 条），
	//   所以这里断言的是**现状**：`config: false` 与 `configs.length === 0`。修法见报告「留后续」。
	assert.deepEqual(f.stages, { concept: true, draft: true, config: false, final: true, review: true, speech: false });
	assert.deepEqual(f.finalCheck.issues.map((i) => i.code), ["V1"]);
	assert.equal(f.configs.length, 0, "★ 改名后遗症：配置表名里是旧名「联盟悬赏」，按主题名匹配挂不上（已知缺口）");
	// 其余功能：看板**如实**报它们的定稿现状（没有定稿就给 null）—— 逐条与磁盘同一时刻重算的比
	const others = d.features.filter((x) => x.topic !== "讨伐");
	for (const o of others) {
		const its = namesMatching(path.join(path.normalize(o.root), "gdd"), /_定稿\.md$/i);
		const latest = its.slice().sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : -1))[0] || null;
		assert.equal(o.latestFinal, latest, o.topic + " 的「最终版」要等于磁盘上最新那份定稿（没有就给 null）");
		assert.equal(o.finals, its.length, o.topic + " 的定稿数要等于磁盘实际：" + its.join(" / "));
		assert.equal(o.finalCheck.current === null, its.length === 0,
			o.topic + "：盘上没有定稿就必须给 null（不假装有结论）");
	}
	assert.ok(d.legacyLeft > 0, "旧扁平层还剩文件（真实数据如此），只用于提示");
});

test("决策台账：决策 / 校准 / 交接三类来源**逐条**与磁盘同一时刻的实际一致", async () => {
	const port = testPort();
	const L = await loadLedger(port, { root: FEATURE_ROOT, skillsRoot: SKILLS_ROOT, signal });
	// ★ 条数从磁盘重算（原写死 4 / 2 / 8 / 1），并要求**每一条都能在磁盘找到对应文件** ——
	//   走一次真人门多一份决策记录不会误红，台账丢掉一条才会红。
	const decNames = namesMatching(path.join(FEATURE_ROOT, "decisions"), /^decision_.*\.json$/i);
	const calNames = namesMatching(path.join(FEATURE_ROOT, "evidence"), /^calibration_.*\.jsonl$/i);
	const hoNames = namesMatching(path.join(FEATURE_ROOT, "analysis"), /^sr-gdd-handoff_.*\.json$/i);
	assert.equal(L.records.length, decNames.length, "决策记录条数 == 磁盘 `decisions\\` 里的 `decision_*.json` 数");
	for (const r of L.records) {
		assert.ok(decNames.includes(r.file), "台账里的每一条都要能在磁盘找到对应文件：" + r.file);
	}
	assert.equal(L.schemaOk, true);
	assert.equal(L.schema.title, "SR Decision Object");
	assert.equal(L.calFiles.length, calNames.length, "校准流水份数 == 磁盘 `evidence\\` 里的 `calibration_*.jsonl` 数");
	assert.equal(L.calibration.length, calRowsOnDisk(calNames), "校准条目数 == 那些 jsonl 里的非空行数");
	assert.equal(L.handoffs.length, hoNames.length, "交接 JSON 份数 == 磁盘 `analysis\\` 里的 `sr-gdd-handoff_*.json` 数");
	for (const h of L.handoffs) assert.ok(hoNames.includes(h.name), "交接 JSON 也要能在磁盘定位：" + h.name);
	// 记录按文件名倒序（决策台账的显示口径）—— 与磁盘上最大的那个名字比
	const newest = decNames.slice().sort().reverse()[0];
	assert.ok(fs.existsSync(path.join(FEATURE_ROOT, "decisions", newest)), "倒序第一条对应的文件真的在盘上");
	assert.equal(L.records[0].file, newest);
	assert.equal(L.records[0].issues.length, 0);
	assert.equal(L.records[1].issues.length, 3, "这份真实记录确实不合规（多出 schema 未声明字段）");
});

test("★ 工单 17 的能力进面板：真实功能的字段覆盖 —— 一个键都不悬空（决策页签显示的就是它）", async () => {
	const port = testPort();
	const L = await loadLedger(port, { root: FEATURE_ROOT, skillsRoot: SKILLS_ROOT, signal });
	// ★ 覆盖检查**不在加载层做**：它是派生期的事（`buildLedger` 组装台账时顺手跑，
	//   源就在那条链上），结论挂在 `fieldCheck`。面板的"决策"页签显示的就是它。
	const dl = ledgerOf(L)!;
	const cov = dl.fieldCheck!;
	assert.ok(cov, "设计台账派生必须带上 fieldCheck");
	// ★ 不写死 79 / 211：那是**真数据快照**（多一份决策记录就会变）。
	//   要证明的同一件事是「真实数据上的**每一个**键都已被归类表覆盖，一个都不悬空」——
	//   它由下面这几条证明，且对任意规模的真实数据都成立。
	assert.deepEqual(cov.dangling, [], "悬空 0：真实数据里没有一个键是归类表里没有的");
	assert.deepEqual(cov.pending, [], "待判定 0");
	assert.equal(cov.ok, true);
	assert.deepEqual(cov.issues, []);
	// 下界 + 自洽：覆盖检查真的扫到了那份真实数据（不是空跑），且逐条都能查到归类
	assert.ok(cov.distinct >= 79, "真实功能至少覆盖 79 个不同键（实测下界），实际 " + cov.distinct);
	assert.ok(cov.checked >= 211, "键实例数至少 211（实测下界），实际 " + cov.checked);
	assert.ok(cov.checked >= cov.distinct, "被检查的实例数不该少于不同键数");
	assert.ok(cov.keys.length === cov.distinct, "`keys` 就是那 " + cov.distinct + " 个不同键");
	// 报错时要能指回**哪个文件**里的哪个键（注入一个上游新字段）
	const doc = JSON.parse(JSON.stringify(L.records[3].doc));
	doc.decision_result.brand_new_field_from_upstream = "上游新增的一类决定";
	const cov2 = ledgerOf({
		records: L.records.slice(0, 3).concat([{ file: L.records[3].file, doc: doc, issues: [] }]),
		calibration: L.calibration, handoffs: L.handoffs,
	})!.fieldCheck!;
	assert.equal(cov2.ok, false);
	assert.deepEqual(cov2.dangling, [{ key: "decision_result.brand_new_field_from_upstream", where: "decisions/" + L.records[3].file }]);
	assert.equal(cov2.issues[0].level, "error");
	assert.ok(cov2.issues[0].msg.includes("fieldclass.ts"), "报错要指出该去哪儿补归类表");
});

test("★ 工单 12：功能详情的产物清单 + 三阶段 + 定稿有效性 + V 校验清单（真实数据）", async () => {
	const port = testPort();
	const d = await loadFeatureDetail(port, { root: FEATURE_ROOT, signal });
	assert.equal(path.normalize(d.root), FEATURE_ROOT);
	// ★ 产物条数**不写死**（原为 27，是真数据快照）：与**同一时刻**从磁盘按同一口径算出来的比。
	//   归档位 `source\UE交付_<日期>\`（设计 §4.3.5）一落盘、或 analysis\ 多一份人工补充产物，
	//   都不该让这条红；面板少列 / 多列一个文件才该红 —— 逐条对名单，不只是对数。
	assert.deepEqual(d.artifacts.allPaths.slice().sort(), shallowFiles(FEATURE_ROOT),
		"面板会列出的清单 == 磁盘上同一时刻的两层文件（逐条相等，不静默丢、不凭空造）");
	assert.equal(d.artifacts.total, shallowFiles(FEATURE_ROOT).length, "产物条数 == 磁盘实际（两层口径）");
	assert.deepEqual(d.artifacts.counts, bucketCounts(FEATURE_ROOT), "进 / 出 / 过程留痕 / 未归桶 的口径与磁盘实际一致");
	assert.deepEqual(d.stage.stages.map((s: any) => [s.label, s.done]), [
		["阶段一 · 头脑风暴", true], ["阶段二 · 文档生成", true], ["阶段三 · 定稿修订", true],
	]);
	// "现在能用吗"：两份 active 并存 ⇒ V1 error
	assert.equal(d.finalCheck.current, "联盟悬赏_20260923_定稿.md");
	assert.equal(d.finalCheck.actives.length, 2);
	assert.deepEqual(d.finalCheck.issues.map((i: any) => i.code), ["V1"]);
	// V 校验清单（工单 30 的能力首次进面板）
	assert.deepEqual(d.checklist.issues.map((i: any) => [i.code, i.level]), [
		["V1", "error"], ["V3", "error"], ["V11", "warn"], ["V5", "info"],
	]);
	// ★ 工单 25：**时间拿到了**（宿主 `stat` 的版本串第 4 段 = mtime 纳秒，实测见 src/pure/fsstamp.ts）
	assert.ok(d.notes.some((n: string) => /时间来源：宿主 `stat` 的版本串/.test(n)));
	assert.ok(d.checklist.checks.V11.finalTime > 0, "当前定稿的时间拿到了（V11 才能判新旧）");
	// ★ 工单 25 · **定稿门**：真实数据（两份 active + 没有对照的审查报告）⇒ 不能交程序
	assert.equal(d.gate.state, "blocked");
	assert.equal(d.gate.canHandOff, false);
	assert.equal(d.gate.current, "联盟悬赏_20260923_定稿.md");
	// 告警顺序 = 结构（①多份可用）→ 审查关（必经）→ 正文硬伤（V3 是真实数据里的重复键）
	assert.deepEqual(d.gate.alarms.map((a: any) => a.code), ["V1", "V11", "V3"]);
	assert.match(d.gate.alarms[0].say, /同时有 2 份定稿标着「可用」/);
	assert.match(d.gate.alarms[0].say, /旧的那份没标「归档」/);
	assert.equal(d.gate.review.state, "missing", "20260923 的定稿没有对照的审查报告（两份 20260921 的匹配不上）");
	assert.match(d.gate.headline, /^先别交程序 —— 同时有 2 份定稿标着「可用」/);
	// 没有定稿的功能不假装有结论；门给 none（"还没有定稿 —— 交不了程序"）
	const heroRoot = path.join(FEATURES_ROOT, "英雄圣物");
	const none = await loadFeatureDetail(testPort(), { root: heroRoot, signal });
	assert.equal(namesMatching(path.join(heroRoot, "gdd"), /_定稿\.md$/i).length, 0, "这个功能盘上确实没有定稿（前置）");
	assert.equal(none.finalCheck.current, null);
	assert.deepEqual(none.checklist.issues, []);
	assert.equal(none.gate.state, "none");
	assert.equal(none.gate.canHandOff, false);
	assert.match(none.gate.headline, /还没有定稿/);
	// ★ 产物条数同样从磁盘重算（原写死 6）
	assert.equal(none.artifacts.total, shallowFiles(heroRoot).length);
});

test("定稿：读真实定稿并附上路径/目录/文件名；缺文件给可读错误", async () => {
	const port = testPort();
	const g = await loadFinal(port, FINAL_GDD, signal);
	assert.equal(g.name, "联盟悬赏_20260923_定稿.md");
	assert.equal(g.dir, path.join(WORKSPACE, "features", "讨伐", "gdd"));
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

// ★ 工单 31：这里原来还有一条「设计资产索引：读真实的 design-asset-index.json」。
//   它测的 `loadIndex` 只服务被砍掉的「设计资产」屏，屏与加载器一起删了，用例随之删除。
//   （`design-asset-index.json` 本身还在工作区里 —— 那是工单 21 的搬运范围，本票不动它。）

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
