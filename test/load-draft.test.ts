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
import { dateOf } from "../src/pure/topic.ts";
import { createFsPort } from "../src/port/fs.ts";
import { fileNames } from "./reality.ts";
import { PLANNER_CONFIG_DIR } from "./paths.ts";

const SR_ROOT = process.env.SR_WB_WORKSPACE || "D:\\TimeMachine\\GameDesignOS\\workspace";
// ★ 2026-10-08 身份迁移：目录名 `联盟悬赏` → `讨伐`（文档名没变）
const FEATURE = path.join(SR_ROOT, "features", "讨伐");
const FEATURE2 = path.join(SR_ROOT, "features", "诸神降临");
const CONFIG_DIR = PLANNER_CONFIG_DIR;

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
		// ★ 工单 25：定稿门（合流 → 定稿 的落点）—— 判据在 detail 那一层，这里只搬
		gate: detail.gate,
		configRoot: CONFIG_DIR
	});
	return { got, detail };
}

test("真数据 · 联盟悬赏：成稿被认出来（不带「成稿」后缀），两大部分与配置支线一并读出", async () => {
	const { got, detail } = await load("讨伐");

	// ① 成稿：文件名不带「成稿」后缀，靠 `gddKindOf` 归类
	// ★ 成稿清单**不写死**（原为 `["联盟悬赏_20260918.md"]`）：与磁盘 `gdd\` 里
	//   "是 .md、但不是定稿 / 审查"的那些重算的比 —— 新写一份成稿不会误红。
	const draftsOnDisk = fileNames(path.join(FEATURE, "gdd"))
		.filter((n) => /\.md$/i.test(n) && !/_定稿\.md$/i.test(n) && !/_审查\.md$/i.test(n));
	const newestDraft = draftsOnDisk.slice().sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : -1))[0];
	assert.deepEqual(got.drafts.slice().sort(), draftsOnDisk.slice().sort(), "gdd\\ 里的成稿 == 磁盘上那些（判据是归类，不是文件名后缀）");
	assert.equal(got.name, newestDraft, "本屏读的是日期最新的那一份成稿");
	assert.ok(got.path.replace(/\//g, "\\").endsWith("features\\讨伐\\gdd\\" + newestDraft));
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
	// ★ 工单 25：定稿门原样搬过来了（同一份结论，界面直接念）
	assert.equal(got.gate, detail.gate);
	assert.equal(got.gate.state, "blocked");
	assert.match(got.gate.headline, /^先别交程序 —— 同时有 2 份定稿标着「可用」/);
	assert.equal(got.gate.review.state, "missing", "20260923 那份没有对照的审查报告");

	// ④ 配置支线：有 §6 字段、1 处待配表缺口、没有读回回执
	assert.equal(got.config.stage, "missing-pending");
	assert.equal(got.config.facts.contract.fields.length, 24);
	assert.equal(got.config.facts.contract.line, 305);
	assert.deepEqual(got.config.facts.contract.workbooks, ["A079-联盟悬赏.xlsx", "A012-全局变量表.xlsx", "A006-掉落表.xlsx"]);
	assert.deepEqual(got.config.facts.referencedMissing, [], "§6 引用的三个工作簿在配置目录里都存在同名文件（按真目录列举核，不靠看板的主题挂载）");
	assert.ok(got.configFiles.length >= 80, "配置目录真的列到了那些工作簿：" + got.configFiles.length + " 个");
	assert.ok(got.configFiles.indexOf("A079-联盟悬赏.xlsx") >= 0 && got.configFiles.indexOf("A006-掉落表.xlsx") >= 0, "A079 / A006 都在列举结果里");
	// ★ 读回验收的凭据：与磁盘 `evidence\` 同一时刻重算的比（原写死「一定是空」——
	//   跑一次 `/sr-config` 的读回验收就会多出 `readback_*`，那是**正确动作**，不该红）
	const readbacksOnDisk = fileNames(path.join(FEATURE, "evidence")).filter((n) => /^readback_/i.test(n));
	assert.deepEqual(got.evidence.map((x) => x.name).sort(), readbacksOnDisk.slice().sort(),
		"读回回执清单 == 磁盘 evidence\\ 里的 `readback_*`（有几份列几份，一份都没有就是空）");
	assert.ok(got.config.missing.some((m) => /L363/.test(m)), got.config.missing.join("\n"));
	// ★ 面板不重做 Excel：这一屏只报状态（存在性按真目录列举核，不解析工作簿、不改表）
	assert.equal(detail.finalCheck.current, "联盟悬赏_20260923_定稿.md");

	// ⑤ 没有读不动的文件；唯一的说明是"有两份定稿，读的是当前有效那一份"（如实交代读的是哪一版）
	assert.equal(got.notes.length, 1, got.notes.join("\n"));
	assert.ok(/2 份定稿/.test(got.notes[0]) && /当前有效/.test(got.notes[0]), got.notes[0]);

	// ⑥ 工单 24c：Y 形要的那几样真数据（人话状态 / 体量 / 日期 / §5 的 ASCII / gdd\UI 里的图）
	// ★ 体量与行数**不写死**（原为 38.6 / 39495 / 541）：与**同一时刻**从磁盘读回来的那份比。
	//   成稿被 `/sr-gdd-fix` 改一次就该跟着变（那是正确动作），算错了才该红。
	const draftAbs = path.join(FEATURE, "gdd", "联盟悬赏_20260918.md");
	const rawDraft = fs.readFileSync(draftAbs, "utf8");
	const diskBytes = fs.statSync(draftAbs).size;
	const diskLines = rawDraft.split(/\r?\n/).length;
	assert.ok(got.bytes === diskBytes || got.bytes === diskBytes - 1,
		"字节数按 UTF-8 算（浏览器半侧没有 Buffer，用的是 TextEncoder）：" + got.bytes +
		"（真文件 " + diskBytes + " 字节；读回来的文本少了末尾那个空行）");
	assert.equal(got.kb, Math.round(got.bytes / 1024 * 10) / 10, "「已就绪 · " + got.kb + " KB」就是字节数 / 1024 一位小数");
	assert.ok(got.lines === diskLines || got.lines === diskLines - 1,
		"成稿行数（1-based，与解析器一致）：" + got.lines + "（磁盘文件 " + diskLines + " 行）");
	assert.equal(got.date, "2026-09-18", "「成稿 · 2026-09-18」里的日期取自文件名（YYYYMMDD → YYYY-MM-DD）");
	// 支线 A 的人话（逐字；界面直接念它）
	assert.equal(got.story.config.label,
		"规则已派生成 3 张表（A079-联盟悬赏.xlsx · A012-全局变量表.xlsx · A006-掉落表.xlsx），字段都齐；还有 1 处「待配表」没填");
	assert.equal(got.configMis.stage, "missing-pending");
	assert.equal(got.configMis.gapCount, 1);
	assert.ok(got.story.config.label.indexOf("missing-pending") < 0, "人话里没有机器口径");
	// 支线 B 的人话 + ASCII 占位。★ 那两个数字**不写死**（原为 4 / 7）：界面上那句话里报的数
	//   必须就是真数据的数 —— 一条是成稿 §5 的 ASCII 占位数（提交界面图后会被真图替换，
	//   那是设计里的正确动作，不该红），一条是磁盘 `gdd\UI\` 里的图数。两条都逐条可定位。
	const uiOnDisk = fileNames(path.join(FEATURE, "gdd", "UI"));
	assert.equal(got.story.wire.label,
		"§5 里现在是 " + got.ascii.length + " 处 ASCII 占位；" + uiOnDisk.length + " 张界面图提交后可替换",
		"人话里的两个数字 = ASCII 占位实际条数 + 磁盘 gdd\\UI 里的图数（一个都不是编的）");
	for (const a of got.ascii) {
		assert.match(a.no, /^5\./, "ASCII 占位只该出现在 §5：" + JSON.stringify(a));
		assert.ok(a.line >= 1 && a.lines >= 1, "每一处占位都要指回成稿里的真实行号与行数：" + JSON.stringify(a));
	}
	// gdd\UI\ 里的界面图（支线 B 的唯一可靠输入）——条数同样与磁盘重算的比（原写死 7）
	assert.equal(got.uiImages.length, uiOnDisk.length, "真目录里现在就是这几张：" + got.uiImages.map((x) => x.name).join(" / "));
	assert.ok(got.uiImages.every((x) => x.rel.indexOf("gdd/UI/") === 0), "相对路径都是 gdd/UI/…");
	assert.ok(got.uiImages.every((x) => x.abs.indexOf("/gdd/UI/") > 0), "绝对路径由功能根派生");
	assert.deepEqual(got.uiImages.map((x) => x.name).sort(), uiOnDisk.slice().sort(), "列出来的就是磁盘上那几张，不多不少");
	assert.ok(got.uiImages.some((x) => x.name.indexOf("UI-M1 联盟悬赏主面板 · 常规难度.png") === 0), "UI-M1 的两张都在");
	assert.equal(got.uiWhy, "", "列得到就不该有「列不出来」的说明");
});

test("真数据 · 诸神降临：有成稿、没定稿 → 配置支线停在「规则就绪」（缺什么写什么）", async () => {
	if (!fs.existsSync(FEATURE2)) return;      // 第二例不在位就跳过
	const { got } = await load("诸神降临");
	assert.equal(got.name, "诸神降临_20260915.md");
	assert.equal(got.finalName, "", "这个功能还没有定稿");
	assert.equal(got.config.stage, "rules-ready");
	assert.ok(/规则就绪/.test(got.config.label), got.config.label);
	// ★ 2026-10-08 合并：`神话宝库` 并进 `诸神降临`，它的读回回执 `readback_A079_神话宝库_20260916.md`
	//   跟着进了同一个 `evidence\` ⇒ 第三步「读回验收」由 false 变 true（口径没变，是数据并过来了）。
	//   ★ 这里同样改成与磁盘重算的比：有没有 `readback_*` 由 evidence\ 决定，不由这条断言决定。
	const godsReadbacks = fileNames(path.join(FEATURE2, "evidence")).filter((n) => /^readback_/i.test(n));
	assert.deepEqual(got.config.steps.map((s) => s.done), [true, false, godsReadbacks.length > 0, false]);
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

