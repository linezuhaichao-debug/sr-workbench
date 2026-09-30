/**
 * 文档生成工作面加载器（工单 24 · `src/load/draft.ts`）—— 走 `WorkspacePort` 的
 * **文件侧替身（node:fs 直读真盘）**，对着真实功能目录跑。
 *
 * 覆盖：
 *   ① 真数据：联盟悬赏 → 成稿是 `联盟悬赏_20260918.md`（**文件名不带「成稿」后缀**，
 *      归类判据是 `gddKindOf`），两大部分 + 左树 + 配置支线一并读出来；
 *   ② 缺件如实报：没有成稿的功能（诸神降临只有成稿、没有定稿 → 配置支线停在「规则就绪」）；
 *   ③ 读不动的文件不静默：清单里点一份不存在的成稿，`notes` 里明说读不动。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadDraftWorkface } from "../src/load/draft.ts";
import { loadFeatureDetail } from "../src/load/feature.ts";
import { createFsPort } from "../src/port/fs.ts";

const SR_ROOT = process.env.SR_WB_WORKSPACE || "D:\\TimeMachine\\GameDesignOS\\workspace";
const FEATURE = path.join(SR_ROOT, "features", "联盟悬赏");
const FEATURE2 = path.join(SR_ROOT, "features", "诸神降临");
const CONFIG_DIR = "D:\\TimeMachine\\planner\\策划配置";

/** 走真加载链路：功能详情（产物清单）→ 文档生成工作面 */
async function load(topic: string) {
	const port = createFsPort({ roots: ["D:\\TimeMachine"] });
	const root = path.join(SR_ROOT, "features", topic);
	const detail = await loadFeatureDetail(port, { root: root });
	const gdd = detail.artifacts.groups.filter((g: any) => g.key === "gdd")[0];
	const ev = detail.artifacts.groups.filter((g: any) => g.key === "evidence")[0];
	const got = await loadDraftWorkface(port, {
		root: root,
		gddFiles: (gdd && gdd.files) || [],
		evidenceFiles: ((ev && ev.files) || []).map((f: any) => f.name),
		finalCheck: detail.finalCheck,
		configRoot: CONFIG_DIR
	});
	return { got, detail };
}

test("真数据 · 联盟悬赏：成稿被认出来（不带「成稿」后缀），两大部分与配置支线一并读出", async () => {
	const { got, detail } = await load("联盟悬赏");

	// ① 成稿：文件名不带「成稿」后缀，靠 `gddKindOf` 归类
	assert.equal(got.name, "联盟悬赏_20260918.md");
	assert.ok(got.path.replace(/\//g, "\\").endsWith("features\\联盟悬赏\\gdd\\联盟悬赏_20260918.md"));
	assert.deepEqual(got.drafts, ["联盟悬赏_20260918.md"], "gdd\\ 里只有这一份成稿");
	assert.equal(got.head.doc_type, "draft_gdd");
	assert.equal(got.head.status, "archived", "定稿通过后成稿归档（真数据）");
	assert.equal(got.topic, "联盟悬赏");

	// ② 两大部分
	assert.equal(got.doc.complete, true);
	assert.deepEqual(got.doc.parts.map((p) => p.no), ["4", "5"]);
	assert.equal(got.doc.parts[0].line, 79);
	assert.equal(got.doc.parts[0].groups, 10);
	assert.equal(got.doc.parts[0].items, 48);
	assert.equal(got.doc.parts[1].line, 181);
	assert.equal(got.doc.parts[1].groups, 6);
	assert.equal(got.doc.parts[1].items, 23);
	assert.equal(got.doc.counts.chapters, 12);

	// ③ 定稿：当前有效那一份（`finalCheck` 是唯一来源）
	assert.equal(got.finalName, "联盟悬赏_20260923_定稿.md");
	assert.equal(got.finalHead.status, "active");

	// ④ 配置支线：真实结论 = 有 §6 字段、1 处待配表缺口、没有读回回执
	assert.equal(got.config.stage, "missing-pending");
	assert.equal(got.config.facts.contract.fields.length, 24);
	assert.equal(got.config.facts.contract.line, 305);
	assert.deepEqual(got.config.facts.contract.workbooks, ["A079-联盟悬赏.xlsx", "A012-全局变量表.xlsx", "A006-掉落表.xlsx"]);
	assert.deepEqual(got.config.facts.referencedMissing, [], "§6 引用的三个工作簿在配置目录里都存在同名文件（按真目录列举核，不靠看板的主题挂载）");
	assert.ok(got.configFiles.length >= 80, "配置目录真的列到了那些工作簿：" + got.configFiles.length + " 个");
	assert.ok(got.configFiles.indexOf("A079-联盟悬赏.xlsx") >= 0 && got.configFiles.indexOf("A006-掉落表.xlsx") >= 0, "A079 / A006 都在列举结果里");
	assert.deepEqual(got.evidence, [], "evidence\\ 里没有 readback_*");
	assert.ok(got.config.missing.some((m) => /L363/.test(m)), got.config.missing.join("\n"));
	// ★ 面板不重做 Excel：这一屏只报状态（存在性按真目录列举核，不解析工作簿、不改表）
	assert.equal(detail.finalCheck.current, "联盟悬赏_20260923_定稿.md");

	// ⑤ 没有读不动的文件；唯一的说明是"有两份定稿，读的是当前有效那一份"（如实交代读的是哪一版）
	assert.equal(got.notes.length, 1, got.notes.join("\n"));
	assert.ok(/2 份定稿/.test(got.notes[0]) && /当前有效/.test(got.notes[0]), got.notes[0]);
});

test("真数据 · 诸神降临：有成稿、没定稿 → 配置支线停在「规则就绪」（缺什么写什么）", async () => {
	if (!fs.existsSync(FEATURE2)) return;      // 第二例不在位就跳过
	const { got } = await load("诸神降临");
	assert.equal(got.name, "诸神降临_20260915.md");
	assert.equal(got.finalName, "", "这个功能还没有定稿");
	assert.equal(got.config.stage, "rules-ready");
	assert.ok(/规则就绪/.test(got.config.label), got.config.label);
	assert.deepEqual(got.config.steps.map((s) => s.done), [true, false, false, false]);
	assert.ok(got.config.missing.some((m) => /还没有定稿/.test(m)), got.config.missing.join("\n"));
	assert.equal(got.doc.complete, true, "成稿本身两大部分齐全");
	assert.equal(got.doc.parts[0].line > 0, true);
});

test("缺件如实报：清单里点一份不存在的成稿 → notes 明说读不动（不当成「没有」）", async () => {
	const port = createFsPort({ roots: ["D:\\TimeMachine"] });
	const got = await loadDraftWorkface(port, {
		root: FEATURE,
		gddFiles: [
			{ name: "联盟悬赏_20260918.md", rel: "gdd/联盟悬赏_20260918.md", kind: "draft" },
			{ name: "联盟悬赏_20269999.md", rel: "gdd/联盟悬赏_20269999.md", kind: "draft" }
		],
		evidenceFiles: [],
		finalCheck: null,
		configRoot: ""
	});
	// 日期最新的那一份在盘上不存在 → 读不动要说出来，而不是静默用旧的那份
	assert.equal(got.name, "联盟悬赏_20269999.md");
	assert.ok(got.notes.some((n) => /读不到开头/.test(n)) || got.notes.some((n) => /读不动正文/.test(n)), got.notes.join("\n"));
	assert.equal(got.doc, null, "正文读不到 ⇒ 两大部分为空（不拿旧数据顶上）");
	assert.equal(got.config.stage, "before-draft", "成稿读不到 ⇒ 配置支线报「还没开始」");
});

test("gdd\\ 里一份成稿都没有 → 两大部分为空，notes 指向第一个动作", async () => {
	const port = createFsPort({ roots: ["D:\\TimeMachine"] });
	const got = await loadDraftWorkface(port, {
		root: FEATURE,
		gddFiles: [{ name: "联盟悬赏_20260923_定稿.md", rel: "gdd/联盟悬赏_20260923_定稿.md", kind: "final" }],
		finalCheck: { current: "联盟悬赏_20260923_定稿.md", currentFrom: "active" },
		configRoot: CONFIG_DIR
	});
	assert.equal(got.name, "");
	assert.equal(got.doc, null);
	assert.deepEqual(got.drafts, []);
	assert.ok(got.notes.some((n) => /没有成稿/.test(n)), got.notes.join("\n"));
	// 配置支线按**下游实际**报：定稿有 §6 字段 ⇒ 字段已经派生出来了（哪怕成稿此刻不在盘上）；
	// "成稿不在"这件事由 `missing` 如实说出来，而不是把整条支线回退成"还没开始"
	assert.equal(got.config.stage, "missing-pending");
	assert.ok(got.config.missing.some((m) => /还没有定稿/.test(m)) === false, "有定稿就不该说没有定稿");
	assert.ok(got.config.facts.draft.exists === false);
	assert.equal(got.config.steps[0].done, false, "成稿那一步如实记 false");
	// 定稿仍然被读到（配置支线照样能报现状）
	assert.equal(got.config.facts.contract.fields.length, 24);
});

