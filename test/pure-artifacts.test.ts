/**
 * 工单 12 · 功能详情的产物清单（按桶分组 / gdd 细分 / 三阶段 / 定稿有效性 / V 校验清单）
 *
 * ★ 本套件的核心断言就是工单 12 自己的验收句：
 *   **对真实功能，详情页列出的产物与磁盘实际一致（差异 0）**。
 *   做法：`loadFeatureDetail`（面板走的就是这条链）→ `artifacts.allPaths`，
 *   与 `node:fs` 的**递归列目录**逐条 diff —— 少一个（静默丢文件）或多一个（凭空造）都要红。
 *   四个真实功能**逐个**跑，不挑一个"看起来对"的。
 *
 * ★ 不录制 fixture：清单与基线都来自真实工作区（换机器用 SR_WB_WORKSPACE 覆盖）。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { featureArtifacts, stageProgress } from "../src/pure/artifacts.ts";
import { mdSpecOf } from "../src/pure/mdspec.ts";
import { loadFeatureDetail, scanFeatureListing } from "../src/load/feature.ts";
import { WORKSPACE, requireRealData, testPort } from "./paths.ts";

requireRealData();
const signal = new AbortController().signal;
const FEATURES_ROOT = path.join(WORKSPACE, "features");

/** 磁盘实况：递归列出功能目录下的**文件**（相对功能根，正斜杠） */
function diskFiles(root: string): string[] {
	const out: string[] = [];
	const walk = (dir: string) => {
		for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
			const abs = path.join(dir, d.name);
			if (d.isDirectory()) walk(abs);
			else out.push(path.relative(root, abs).split(path.sep).join("/"));
		}
	};
	walk(root);
	return out.sort();
}

const topics = fs.readdirSync(FEATURES_ROOT, { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name)
	.sort();

test("真实工作区有 4 个功能（断言的前提）", () => {
	assert.deepEqual(topics, ["诸神降临", "神话宝库", "英雄圣物", "联盟悬赏"].sort());
});

test("★ 验收：四个真实功能逐个 diff —— 面板会列出的产物 == 磁盘实际（差异 0）", async () => {
	const report: string[] = [];
	for (const t of topics) {
		const root = path.join(FEATURES_ROOT, t);
		const port = testPort();
		const d = await loadFeatureDetail(port, { root: root, signal });
		const listed = (d.artifacts.allPaths as string[]).slice().sort();
		const disk = diskFiles(root);
		const missing = disk.filter((p) => !listed.includes(p));   // 磁盘有、面板不列 ⇒ 静默丢
		const extra = listed.filter((p) => !disk.includes(p));     // 面板列、磁盘没有 ⇒ 凭空造
		report.push(t + "：面板 " + listed.length + " / 磁盘 " + disk.length);
		assert.deepEqual(missing, [], t + " 有文件没被列出（静默丢）：" + missing.join(" | "));
		assert.deepEqual(extra, [], t + " 列出了磁盘上不存在的文件：" + extra.join(" | "));
		assert.equal(listed.length, disk.length, t + " 数量不一致");
	}
	// 四个功能的文件数之和（对账用；数字变了要有人来看一眼为什么）
	// ★ 2026-09-30 漂移已看：联盟悬赏 24→25、神话宝库 38→39，各多一份
	//   `analysis\human-note_*_20260930.md`（真机上面板「人工补充」入口真的用了一次写出来的）。
	//   断言的口径**没变**（面板清单 == 磁盘实际），只是把数字对到今天的真实数据。
	assert.equal(
		report.join(" · "),
		"神话宝库：面板 39 / 磁盘 39 · 联盟悬赏：面板 25 / 磁盘 25 · 英雄圣物：面板 5 / 磁盘 5 · 诸神降临：面板 2 / 磁盘 2"
	);
});

test("联盟悬赏：桶分组与含义（进 0 · 出 19 · 过程留痕 6）", async () => {
	const d = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "联盟悬赏"), signal });
	const g = (k: string) => d.artifacts.groups.find((x: any) => x.key === k);
	assert.equal(d.artifacts.total, 25);
	assert.deepEqual(d.artifacts.counts, { in: 0, out: 19, trace: 6, other: 0 });
	// 六个标准桶都在（空桶也显示 —— source 是 0，要说出来而不是消失）
	assert.deepEqual(
		d.artifacts.groups.map((x: any) => x.key),
		["source", "analysis", "gdd", "delivery", "decisions", "evidence"]
	);
	assert.equal(g("source").count, 0);
	assert.equal(g("analysis").count, 4);       // ★ 2026-09-30 漂移：3 → 4（多一份人工补充产物）
	assert.equal(g("gdd").count, 13);          // 6 个文档 + 7 张 gdd\UI 图
	assert.equal(g("delivery").count, 2);
	assert.equal(g("decisions").count, 4);
	assert.equal(g("evidence").count, 2);
	// 含义标签
	assert.equal(g("source").meaningLabel, "进 · 原料");
	assert.equal(g("gdd").meaningLabel, "出 · 产物");
	assert.equal(g("evidence").meaningLabel, "过程留痕");
});

test("联盟悬赏：gdd\\ 内部按文件名细分（定稿 2 · 定稿HTML 1 · 审查 2 · 成稿 1 · 界面图 7）", async () => {
	const d = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "联盟悬赏"), signal });
	const gdd = d.artifacts.groups.find((x: any) => x.key === "gdd");
	const kinds: Record<string, number> = {};
	for (const f of gdd.files) kinds[f.kind] = (kinds[f.kind] || 0) + 1;
	assert.deepEqual(kinds, { final: 2, finalHtml: 1, review: 2, draft: 1, ui: 7 });
	// 定稿排在最前（"现在能用吗"的答案先给），且**最新的在前**
	assert.equal(gdd.files[0].kind, "final");
	assert.equal(gdd.files[0].name, "联盟悬赏_20260923_定稿.md");
	assert.equal(gdd.files[1].name, "联盟悬赏_20260921_定稿.md");
	// 定稿 HTML 以前落进 others（面板上根本看不见）—— 现在有自己的一档
	const html = gdd.files.find((f: any) => f.name === "联盟悬赏_20260923_定稿.html");
	assert.equal(html.kind, "finalHtml");
	assert.equal(html.kindLabel, "定稿 HTML");
	assert.equal(html.subdir, "");
	// gdd\UI 的图归在 gdd 桶里，但 rel 路径带子目录（能直接拼绝对路径打开）
	const png = gdd.files.find((f: any) => f.kind === "ui");
	assert.equal(png.rel, "gdd/UI/" + png.name);
	assert.equal(png.subdir, "UI");
});

test("规范名标注用已接的 mdSpecOf（只作标注、不作过滤）", async () => {
	const d = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "神话宝库"), signal });
	const analysis = d.artifacts.groups.find((x: any) => x.key === "analysis");
	const byName = (n: string) => analysis.files.find((f: any) => f.name === n);
	assert.equal(byName("experience-report_神话宝库_20260915.md").spec, "体验报告");
	assert.equal(byName("replication-spec_神话宝库_20260915.md").spec, "复刻规格");
	// 认不出规范名的照样列出（spec 空串）—— 过滤就会变成"猜文件名"
	assert.equal(byName("sr-gdd-handoff_神话宝库_20260915.json").spec, "");
	// ★ 2026-09-30 数据漂移：神话宝库也多了 1 份人工补充产物（真机上面板跑出来的）⇒ 4 → 5
	assert.equal(analysis.count, 5);
	// 实测：mdSpecOf 的六种规范没有一种匹配 gdd\ 的文件（所以 gdd 细分不能靠它，得用 gddKindOf）
	const lian = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "联盟悬赏"), signal });
	const gdd = lian.artifacts.groups.find((x: any) => x.key === "gdd");
	assert.equal(gdd.files.every((f: any) => f.spec === ""), true, "gdd 里不该有规范名标注");
	assert.equal(mdSpecOf("联盟悬赏_20260923_定稿.md"), null, "mdSpecOf 认不出定稿名 —— 这是实测事实");
	// 神话宝库没有 gdd\：空桶仍然显示（count 0），不是"不存在"
	const myth = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "神话宝库"), signal });
	assert.equal(myth.artifacts.groups.find((x: any) => x.key === "gdd").count, 0);
});

test("三阶段进度（设计 §4.2：有无分析产物 / 有无成稿 / 有无定稿）+ 出口判据提示", async () => {
	const d = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "联盟悬赏"), signal });
	assert.deepEqual(d.stage.stages.map((s: any) => s.label), ["阶段一 · 头脑风暴", "阶段二 · 文档生成", "阶段三 · 定稿修订"]);
	assert.deepEqual(d.stage.stages.map((s: any) => s.done), [true, true, true]);
	assert.equal(d.stage.done, 3);
	assert.equal(d.stage.note, "", "analysis 有产物 ⇒ 不该提示'先跑一次分析'");

	// 只存在于 source 的功能（合成输入）：阶段一未完成 + 出口判据提示
	const art = featureArtifacts({ rootFiles: [], dirs: { source: { files: ["a.png"] } } });
	const st = stageProgress(art);
	assert.deepEqual(st.stages.map((s: any) => s.done), [false, false, false]);
	assert.match(st.note, /source 里有 1 个源文件/);
});

test("定稿有效性在详情里（V1 两份 active 并存）+ 清单条目被标上'当前有效/未归档'", async () => {
	const d = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "联盟悬赏"), signal });
	assert.equal(d.finalCheck.current, "联盟悬赏_20260923_定稿.md");
	assert.equal(d.finalCheck.currentFrom, "active");
	assert.deepEqual(d.finalCheck.actives, ["联盟悬赏_20260923_定稿.md", "联盟悬赏_20260921_定稿.md"]);
	assert.deepEqual(d.finalCheck.issues.map((i: any) => i.code), ["V1"]);
	const gdd = d.artifacts.groups.find((x: any) => x.key === "gdd");
	const noteOf = (n: string) => (gdd.files.find((f: any) => f.name === n) || {}).note;
	assert.match(noteOf("联盟悬赏_20260923_定稿.md"), /当前有效（active）/);
	assert.match(noteOf("联盟悬赏_20260921_定稿.md"), /也标 active/);
	// 其余三个功能：没有定稿（目录存在就是功能），不假装有
	const other = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "英雄圣物"), signal });
	assert.equal(other.finalCheck.current, null);
	assert.deepEqual(other.finalCheck.issues, []);
});

test("V 校验清单在详情里可见（V1/V3 error · V11 warn · V5 info，带行号）", async () => {
	const d = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "联盟悬赏"), signal });
	const cl = d.checklist;
	assert.equal(cl.current, "联盟悬赏_20260923_定稿.md");
	assert.deepEqual(cl.issues.map((i: any) => [i.code, i.level]), [
		["V1", "error"], ["V3", "error"], ["V11", "warn"], ["V5", "info"]
	]);
	assert.deepEqual(cl.counts, { error: 2, warn: 1, info: 1 });
	// V3 的行号必须指回真实原文（L379 / L389）
	const v3 = cl.issues.find((i: any) => i.code === "V3");
	assert.deepEqual(v3.lines, [379, 389]);
	assert.match(v3.msg, /alli_boss_kill_count_label/);
	// V5 是 info（待办计数，不是缺陷），5 处行号如实给出
	const v5 = cl.issues.find((i: any) => i.code === "V5");
	assert.deepEqual(v5.lines, [87, 88, 161, 162, 363]);
	// V6 / V8 在真实定稿上是干净的 ⇒ 不出现在清单里（正常现象）
	assert.equal(cl.issues.some((i: any) => i.code === "V6" || i.code === "V8"), false);
	// ★ 工单 25：V11 不再是"降级"——**时间拿到了**（宿主 `stat` 的版本串第 4 段 = mtime 纳秒）
	assert.ok(d.checklist.checks.V11.finalTime > 0, "当前定稿的时间拿到了（V11 才能判新旧）");
	assert.ok(
		d.notes.some((n: string) => /时间来源：宿主 `stat` 的版本串/.test(n)),
		"应如实写明时间是从哪来的（版本串第 4 段）"
	);
	assert.ok(!d.notes.some((n: string) => /看不到时间/.test(n)), "拿到时间时不该说看不到");
});

test("不是桶的目录与功能根散文件都进「未归桶」—— 一个文件都不许静默丢", async () => {
	const port = testPort();
	const listing = await scanFeatureListing(port, { root: path.join(FEATURES_ROOT, "联盟悬赏"), signal });
	// 合成：加一个非桶目录与一个功能根散文件，再跑一遍纯函数
	const art = featureArtifacts({
		rootFiles: ["设计台账.md"],
		dirs: Object.assign({}, listing.dirs, { notes: { files: ["随手记.txt"] } }),
		deepDirs: ["evidence/frames（还有 1 个子目录）"]
	});
	const keys = art.groups.map((g: any) => g.key);
	assert.deepEqual(keys.slice(-2), ["notes", "root"]);
	const notesG = art.groups.find((g: any) => g.key === "notes");
	assert.equal(notesG.meaning, "other");
	assert.equal(notesG.files[0].rel, "notes/随手记.txt");
	const rootG = art.groups.find((g: any) => g.key === "root");
	assert.equal(rootG.files[0].rel, "设计台账.md", "功能根散文件的 rel 不带前缀");
	// 更深的层没展开 ⇒ 如实报出来，不假装列全了
	assert.deepEqual(art.notes, ["未展开更深一层：evidence/frames（还有 1 个子目录）"]);
	// allPaths 覆盖全部组（这就是对账用的那份清单）
	assert.ok(art.allPaths.includes("notes/随手记.txt") && art.allPaths.includes("设计台账.md"));
	assert.equal(art.allPaths.length, art.total);
});
