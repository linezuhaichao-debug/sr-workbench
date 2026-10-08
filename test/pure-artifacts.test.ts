/**
 * 工单 12 · 功能详情的产物清单（按桶分组 / gdd 细分 / 三阶段 / 定稿有效性 / V 校验清单）
 *
 * ★ 本套件的核心断言就是工单 12 自己的验收句：
 *   **对真实功能，详情页列出的产物与磁盘实际一致（差异 0）**。
 *   做法：`loadFeatureDetail`（面板走的就是这条链）→ `artifacts.allPaths`，
 *   与 `node:fs` 的**同一时刻**磁盘实况逐条 diff —— 少一个（静默丢文件）或多一个（凭空造）都要红。
 *   每个真实功能**逐个**跑，不挑一个"看起来对"的。
 *
 * ★ 不录制 fixture：清单与基线都来自真实工作区（换机器用 SR_WB_WORKSPACE 覆盖）。
 * ★ 2026-10-08 之后的一次加固（`fixture-robustness-report.md`）：这里的条数**不再写死**。
 *   原先写死"讨伐 27 个文件"——那是一条**真数据快照**，用户把外部交付包按设计归位到
 *   `source\UE交付_<日期>\`（设计 §4.3.5）就会把它打红。现在改成与磁盘**同一时刻**重算的真值比，
 *   并额外要求"更深的层必须被如实报出来"（面板只列两层，这是它自己声明的口径）——
 *   严格性不降反升：现在是**逐条对名单**，不只是对数。
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { BUCKET_GROUPS, featureArtifacts, stageProgress } from "../src/pure/artifacts.ts";
import { mdSpecOf } from "../src/pure/mdspec.ts";
import { dateOf } from "../src/pure/topic.ts";
import { loadFeatureDetail, scanFeatureListing } from "../src/load/feature.ts";
import { FEATURES_ROOT, requireRealData, testPort } from "./paths.ts";
import {
	BUCKETS, BUCKET_MEANING, bucketCounts, bucketFiles, deepDirNotes, deepFiles, deepParentOf,
	dirNames, fileNames, rootFiles, shallowFiles, topicDirs,
} from "./reality.ts";

requireRealData();
const signal = new AbortController().signal;
const topics = topicDirs(FEATURES_ROOT);

/** `gdd\` 的细分判据只看文件名（独立写一遍，免得拿产品自己的判据证明产品自己） */
const FINAL_RE = /_定稿\.md$/i;
const REVIEW_RE = /_审查\.md$/i;

/**
 * ★ 前提（口径，不是真数据快照）：**目录即功能**（设计 §3.2）——功能有几个由磁盘决定。
 *   2026-10-08 身份迁移后每个功能目录都是完整的：六个标准桶 + 身份声明 `feature.json`。
 *   这里**不再写死"有 3 个功能"**（多一个新功能不该红），改断言"每个功能目录都完整"。
 */
test("真实工作区：每个功能目录都是完整的（六个标准桶 + feature.json 身份声明）", () => {
	assert.deepEqual(topics.slice().sort(), dirNames(FEATURES_ROOT).slice().sort());
	assert.ok(topics.length >= 1, "至少有一个功能：" + topics.join(" / "));
	for (const t of topics) {
		const root = path.join(FEATURES_ROOT, t);
		assert.deepEqual(dirNames(root).filter((d) => d.indexOf(".") !== 0 && BUCKETS.includes(d)).slice().sort(), BUCKETS.slice().sort(),
			t + "：六个标准桶都要建全（缺桶是真实缺陷）");
		assert.ok(rootFiles(root).includes("feature.json"), t + "：功能根上要有身份声明 `feature.json`");
	}
});

test("★ 验收：真实功能逐个对账 —— 面板会列出的产物 == 磁盘同一时刻的两层实际；更深的层如实报出来", async () => {
	for (const t of topics) {
		const root = path.join(FEATURES_ROOT, t);
		const d = await loadFeatureDetail(testPort(), { root: root, signal });
		const listed = (d.artifacts.allPaths as string[]).slice().sort();
		const shallow = shallowFiles(root);   // 面板**声明会列出来**的那两层
		const deep = deepFiles(root);         // 更深的层（面板不列，但必须被 `notes` 点名"未展开"）
		// ① 逐条相等：磁盘有、面板不列 ⇒ 静默丢；面板列、磁盘没有 ⇒ 凭空造
		const missing = shallow.filter((p) => !listed.includes(p));
		const extra = listed.filter((p) => !shallow.includes(p));
		assert.deepEqual(missing, [], t + " 两层内有文件没被列出（静默丢）：" + missing.join(" | "));
		assert.deepEqual(extra, [], t + " 列出了磁盘上不存在的文件：" + extra.join(" | "));
		assert.equal(listed.length, shallow.length, t + " 数量不一致");
		// ② 更深的层**不许静默丢**：报出来的说明要与磁盘逐条一致，且每一条深文件都有父目录被点名
		const notes = ((d.artifacts.notes as string[]) || []).slice().sort();
		const wantNotes = deepDirNotes(root).map((n) => "未展开更深一层：" + n).sort();
		assert.deepEqual(notes, wantNotes, t + "：未展开的层没有如实报出来（面板不许假装列全了）");
		for (const p of deep) {
			const parent = deepParentOf(p);
			assert.ok(notes.some((n) => n.indexOf("：" + parent + "（") > 0),
				t + "：有更深的文件没被任何说明覆盖：" + p + "（父目录 " + parent + " 没被点名）");
		}
		// ③ 报出来的那些目录必须真的存在、且"还有 N 个子目录"对得上（不是一句空话）
		for (const n of notes) {
			const rel = n.replace(/^未展开更深一层：/, "").replace(/（.*$/, "");
			assert.ok(dirNames(path.join(root, rel)).length > 0, t + "：报出来的 " + rel + " 里其实没有子目录");
		}
	}
});

/**
 * ★ **规格常量，不是真数据快照**：六个标准产物桶 → 含义（设计 §4.1）。
 *   改口径才该改这几行；真数据怎么变都不该动它。
 */
test("规格常量：六个标准桶 → 含义（与产品里的 BUCKET_GROUPS 对表）", () => {
	assert.deepEqual(BUCKET_GROUPS.map((g: any) => g.dir), BUCKETS);
	assert.deepEqual(BUCKET_GROUPS.map((g: any) => [g.dir, g.meaning]), BUCKETS.map((b) => [b, BUCKET_MEANING[b]]));
});

test("讨伐：桶分组（每个桶的条数 == 磁盘同一时刻该桶两层内的文件数）+ 空桶也显示", async () => {
	const root = path.join(FEATURES_ROOT, "讨伐");
	const d = await loadFeatureDetail(testPort(), { root: root, signal });
	const g = (k: string) => d.artifacts.groups.find((x: any) => x.key === k);
	// 六个标准桶按规格顺序在最前；后面跟「不是桶的目录」（如有）+ 功能根散文件组
	const otherDirs = dirNames(root).filter((x) => !BUCKETS.includes(x)).sort();
	assert.deepEqual(d.artifacts.groups.map((x: any) => x.key).slice(0, BUCKETS.length), BUCKETS);
	assert.deepEqual(d.artifacts.groups.map((x: any) => x.key).slice(BUCKETS.length), otherDirs.concat(["root"]),
		"非桶目录与功能根散文件都要如实成组（说不清装什么的先不要建，但建了就得列）");
	// ★ 每个桶的条数从磁盘重算（原写死 0/4/13/3/4/2）：桶归错一个就红，数据怎么变都不会误红
	for (const b of BUCKETS) {
		assert.equal(g(b).count, bucketFiles(root, b).length, b + " 桶的条数与磁盘实际不一致");
		assert.equal(g(b).files.length, g(b).count, b + " 桶的 count 与 files 长度要自洽");
	}
	assert.equal(d.artifacts.total, shallowFiles(root).length);
	assert.deepEqual(d.artifacts.counts, bucketCounts(root));
	// 空桶**也在**（不是"不存在"）：这是"一个文件都不许静默丢"的另一面
	for (const b of BUCKETS) if (g(b).count === 0) assert.deepEqual(g(b).files, [], b + " 是空桶 ⇒ 如实给 0 与空清单");
	// 含义标签（规格常量）
	assert.equal(g("source").meaningLabel, "进 · 原料");
	assert.equal(g("gdd").meaningLabel, "出 · 产物");
	assert.equal(g("evidence").meaningLabel, "过程留痕");
	assert.equal(g("root").meaningLabel, "未归桶（如实列出，不丢）");
});

test("讨伐：gdd\\ 内部按文件名细分（判据只看文件名；逐份对表）", async () => {
	const root = path.join(FEATURES_ROOT, "讨伐");
	const gddDir = path.join(root, "gdd");
	const d = await loadFeatureDetail(testPort(), { root: root, signal });
	const gdd = d.artifacts.groups.find((x: any) => x.key === "gdd");
	const onDisk = fileNames(gddDir);
	// ① 磁盘上 gdd\ 里的每一份都进了清单（一份不多、一份不少）
	assert.deepEqual(gdd.files.filter((f: any) => !f.subdir).map((f: any) => f.name).sort(), onDisk);
	// ② **逐份对表**：把现状钉在文件名上（新增文件不打破它，改判据才打破）
	const KINDS: Record<string, string> = {
		"联盟悬赏_20260918.md": "draft",
		"联盟悬赏_20260921_定稿.md": "final",
		"联盟悬赏_20260923_定稿.md": "final",
		"联盟悬赏_20260921_审查.md": "review",
		"联盟悬赏_20260921_定稿_审查.md": "review",
		"联盟悬赏_20260923_定稿.html": "finalHtml",
	};
	const kindOf = (n: string) => (gdd.files.find((f: any) => f.name === n) || {}).kind;
	for (const [n, k] of Object.entries(KINDS)) {
		if (onDisk.includes(n)) assert.equal(kindOf(n), k, n + " 应归到 " + k + "（判据：只看文件名）");
	}
	assert.ok(onDisk.some((n) => FINAL_RE.test(n)), "前置：gdd\\ 里确实有定稿");
	assert.ok(onDisk.some((n) => REVIEW_RE.test(n)), "前置：gdd\\ 里确实有审查报告");
	// ③ 定稿排在最前（"现在能用吗"的答案先给），定稿之间按文件名日期倒序（最新在前）。
	//    这里用**独立写一遍的文件名判据**挑磁盘上的定稿，不拿产品自己的 `gddKindOf` 去证明产品自己。
	assert.equal(gdd.files[0].kind, "final");
	const finalsOnDisk = onDisk.filter((n) => FINAL_RE.test(n));
	const byDateDesc = finalsOnDisk.slice().sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : -1));
	const finals = gdd.files.filter((f: any) => f.kind === "final").map((f: any) => f.name);
	assert.deepEqual(finals, byDateDesc, "定稿清单 == 磁盘上的 `_定稿.md`，按文件名日期倒序（最新在前）");
	assert.deepEqual(finals.length, finalsOnDisk.length);
	// ④ 定稿 HTML 以前落进 others（面板上根本看不见）—— 现在有自己的一档
	const html = gdd.files.find((f: any) => /_定稿\.html?$/i.test(f.name));
	if (html) {
		assert.equal(html.kind, "finalHtml");
		assert.equal(html.kindLabel, "定稿 HTML");
		assert.equal(html.subdir, "");
	}
	// ⑤ gdd\UI 的图归在 gdd 桶里：条数 == 磁盘 gdd\UI 里的文件数；rel 带子目录（能直接拼绝对路径打开）
	assert.equal(gdd.files.filter((f: any) => f.kind === "ui").length, fileNames(path.join(gddDir, "UI")).length,
		"界面图条数 == 磁盘 `gdd\\UI` 里的文件数（提交新图不会误红）");
	const png = gdd.files.find((f: any) => f.kind === "ui");
	assert.ok(png, "前置：`gdd\\UI` 里有图");
	assert.equal(png.rel, "gdd/UI/" + png.name);
	assert.equal(png.subdir, "UI");
	assert.equal(png.kindLabel, "界面图");
	// ⑥ 每一份都要有能看懂的"档"与标签（新增文件也不许落到空）
	for (const f of gdd.files) {
		assert.ok(String(f.kind).length > 0 && String(f.kindLabel).length > 0, "每一份都要有档与标签：" + f.rel);
	}
	// ⑦ 分档计数自洽
	const counts: Record<string, number> = {};
	for (const f of gdd.files) counts[f.kind] = (counts[f.kind] || 0) + 1;
	assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), gdd.count);
});

test("规范名标注用已接的 mdSpecOf（只作标注、不作过滤）", async () => {
	const d = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "诸神降临"), signal });
	const analysis = d.artifacts.groups.find((x: any) => x.key === "analysis");
	const byName = (n: string) => analysis.files.find((f: any) => f.name === n);
	assert.equal(byName("experience-report_神话宝库_20260915.md").spec, "体验报告");
	assert.equal(byName("replication-spec_神话宝库_20260915.md").spec, "复刻规格");
	// 认不出规范名的照样列出（spec 空串）—— 过滤就会变成"猜文件名"
	assert.equal(byName("sr-gdd-handoff_神话宝库_20260915.json").spec, "");
	// ★ 分析桶的条数从磁盘重算（原写死 5）；上面那条验收已经证明了"列出的 == 磁盘实际"
	assert.equal(analysis.count, fileNames(path.join(FEATURES_ROOT, "诸神降临", "analysis")).length,
		"analysis 桶条数 == 磁盘 `analysis\\` 里的文件数");
	// 实测：mdSpecOf 的六种规范没有一种匹配 gdd\ 的文件（所以 gdd 细分不能靠它，得用 gddKindOf）
	const lian = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "讨伐"), signal });
	const gdd = lian.artifacts.groups.find((x: any) => x.key === "gdd");
	assert.equal(gdd.files.every((f: any) => f.spec === ""), true, "gdd 里不该有规范名标注");
	assert.equal(mdSpecOf("联盟悬赏_20260923_定稿.md"), null, "mdSpecOf 认不出定稿名 —— 这是实测事实");
	// 空桶仍然显示（count 0），不是「不存在」——条数同样与磁盘重算的比
	const heroRoot = path.join(FEATURES_ROOT, "英雄圣物");
	const empty = await loadFeatureDetail(testPort(), { root: heroRoot, signal });
	const emptyGdd = empty.artifacts.groups.find((x: any) => x.key === "gdd");
	assert.ok(emptyGdd, "`gdd` 组必须在（哪怕一份都没有）——空桶也显示");
	assert.equal(emptyGdd.count, fileNames(path.join(heroRoot, "gdd")).length);
	assert.deepEqual(emptyGdd.files, []);
});

test("三阶段进度（设计 §4.2：有无分析产物 / 有无成稿 / 有无定稿）+ 出口判据提示", async () => {
	const d = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "讨伐"), signal });
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
	const d = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "讨伐"), signal });
	assert.equal(d.finalCheck.current, "联盟悬赏_20260923_定稿.md");
	assert.equal(d.finalCheck.currentFrom, "active");
	assert.deepEqual(d.finalCheck.actives, ["联盟悬赏_20260923_定稿.md", "联盟悬赏_20260921_定稿.md"]);
	assert.deepEqual(d.finalCheck.issues.map((i: any) => i.code), ["V1"]);
	const gdd = d.artifacts.groups.find((x: any) => x.key === "gdd");
	const noteOf = (n: string) => (gdd.files.find((f: any) => f.name === n) || {}).note;
	assert.match(noteOf("联盟悬赏_20260923_定稿.md"), /当前有效（active）/);
	assert.match(noteOf("联盟悬赏_20260921_定稿.md"), /也标 active/);
	// 其余两个功能：没有定稿（目录存在就是功能），不假装有
	const other = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "英雄圣物"), signal });
	assert.equal(other.finalCheck.current, null);
	assert.deepEqual(other.finalCheck.issues, []);
});

test("V 校验清单在详情里可见（V1/V3 error · V11 warn · V5 info，带行号）", async () => {
	const d = await loadFeatureDetail(testPort(), { root: path.join(FEATURES_ROOT, "讨伐"), signal });
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
	const listing = await scanFeatureListing(port, { root: path.join(FEATURES_ROOT, "讨伐"), signal });
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
