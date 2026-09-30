/**
 * 文档生成工作面 · **配置支线走到哪** + **这一阶段的动作指令**（工单 24 · `src/pure/draftstep.ts`）。
 *
 * 三组断言，全部对着**真实定稿**（`联盟悬赏_20260923_定稿.md`，active / 488 行）：
 *   ① §6 配置契约的读取（24 个字段行 / 3 个工作簿 / 1 行「待配表」缺口说明）
 *   ② 四步链路 → 「走到哪」的那一句话 + 依据（`gdd-pipeline.md` §一 的链路，逐条可核对）
 *   ③ 三个动作的三段式指令（**改哪儿 / 现状原文 / 影响范围**）+ 缺前提的 blocked/next
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
	DRAFT_ACTIONS_TABLE, buildDraftInstruction, configBranchState, parseConfigContract, readbacksOf
} from "../src/pure/draftstep.ts";

const SR_ROOT = process.env.SR_WB_WORKSPACE || "D:\\TimeMachine\\GameDesignOS\\workspace";
const FEATURE = path.join(SR_ROOT, "features", "联盟悬赏");
const FINAL = path.join(FEATURE, "gdd", "联盟悬赏_20260923_定稿.md");
const PREV_FINAL = path.join(FEATURE, "gdd", "联盟悬赏_20260921_定稿.md");
const DRAFT = path.join(FEATURE, "gdd", "联盟悬赏_20260918.md");

const read = (p: string) => {
	if (!fs.existsSync(p)) throw new Error("真实数据不在位（本套件刻意不录制 fixture）：" + p);
	return fs.readFileSync(p, "utf8");
};
/** 真配置目录里按主题挂上来的表名（与看板的 `configs` 同源；这里直接读目录，避免依赖看板） */
const CONFIG_FILES = fs.readdirSync("D:\\TimeMachine\\planner\\策划配置").filter((n) => /\.xlsx?m?$/i.test(n));

test("§6 配置契约：24 个字段行 / 3 个工作簿（章节引用）+ 1 行「待配表」缺口说明", () => {
	const c = parseConfigContract(read(FINAL));
	assert.equal(c.present, true);
	assert.equal(c.line, 305, "`## 6. 配置契约` 在 L305（真实定稿）");
	assert.deepEqual(c.workbooks, ["A079-联盟悬赏.xlsx", "A012-全局变量表.xlsx", "A006-掉落表.xlsx"]);
	assert.equal(c.fields.length, 24, "§6.1 3 + §6.2 12 + §6.3 6 + §6.4 4 …（去重后按行计 24）");
	assert.equal(c.pending.length, 0, "字段行里没有「待配表」");
	// ★ 真缺口在 §6.5 那张三列表里：它不是字段行（第二列是"记录"不是英文字段），但状态列写着「待配表」
	assert.equal(c.notedGaps.length, 1);
	assert.equal(c.notedGaps[0].line, 363);
	assert.equal(c.notedGaps[0].cn, "活动周期/排行过滤门槛/展示上限");
	assert.equal(c.notedGaps[0].group, "6.5 掉落引用与缺口（A006-掉落表.xlsx）");
	assert.ok(/待配表/.test(c.notedGaps[0].status));
	assert.equal(c.otherRows, 9, "§6.5 的 9 行都不是字段行（如实记账，不静默丢）");
	// 字段行的形状：中文字段 / 英文字段 / 组 / 行号 / 原文
	const one = c.fields.filter((r) => r.field === "clearDropId")[0];
	assert.ok(one, "难度表的 clearDropId 在字段行里");
	assert.equal(one.cn, "通关礼包掉落ID");
	assert.equal(one.group, "6.3 难度表（A079-联盟悬赏.xlsx，INDEX 输出 alliance_boss_level / AllianceBossLevel）");
	assert.ok(one.text.startsWith("| 通关礼包掉落ID |"), "原文逐字（现状原文：行号会漂，原文不会）");
	assert.ok(/引用缺口/.test(one.status), "状态列如实带出「引用缺口」");
	// 两份定稿的字段数一致（对照，不是重复实现）
	const prev = parseConfigContract(read(PREV_FINAL));
	assert.equal(prev.fields.length, 24);
	assert.equal(prev.line, 398, "上一份定稿的 §6 在 L398");
	assert.equal(prev.notedGaps.length, 1);
	// 没有 §6 的文本 → present=false（不编）
	const none = parseConfigContract("# 标题\n\n## 1. 功能意图\n\ntext\n");
	assert.equal(none.present, false);
	assert.deepEqual(none.workbooks, []);
	assert.equal(none.fields.length, 0);
});

test("配置支线「走到哪」：真实数据的结论 + 四步 + 缺口逐条", () => {
	const draftHead = read(DRAFT).split("\n").slice(0, 6).join("\n");
	const finalHead = read(FINAL).split("\n").slice(0, 6).join("\n");
	const dStatus = /status:\s*(\S+)/.exec(draftHead);
	const fStatus = /status:\s*(\S+)/.exec(finalHead);
	assert.equal(dStatus[1], "archived", "真成稿：定稿通过后已归档（`gdd-pipeline.md` §一）");
	assert.equal(fStatus[1], "active");

	const b = configBranchState({
		draft: { exists: true, name: "联盟悬赏_20260918.md", status: dStatus[1], docType: "draft_gdd", line: 13, archived: true },
		final: { exists: true, name: "联盟悬赏_20260923_定稿.md", status: fStatus[1], docType: "final_gdd", line: 1 },
		contract: parseConfigContract(read(FINAL)),
		referencedMissing: [],
		readbacks: [],
		configFiles: CONFIG_FILES
	});
	assert.equal(b.stage, "missing-pending");
	assert.ok(/待配表/.test(b.label), "那句话里写明还有几处待配表：" + b.label);
	assert.ok(/1 处/.test(b.label), "真实数据：1 处 → " + b.label);
	assert.ok(/L363/.test(b.reason), "依据里给出缺口的行号：" + b.reason);
	assert.deepEqual(b.steps.map((s) => s.key), ["draft", "contract", "readback", "final"]);
	assert.deepEqual(b.steps.map((s) => s.done), [true, true, false, true], "读回验收那一步**没有回执** ⇒ done=false");
	assert.ok(b.steps[0].evidence.includes("archived"), "成稿那一步带出真实 status");
	assert.ok(b.steps[1].evidence.includes("24"), "配置表派生那一步带出字段数：" + b.steps[1].evidence);
	assert.ok(b.steps[3].evidence.includes("L305"), "整合定稿那一步带出 §6 行号：" + b.steps[3].evidence);

	const miss = b.missing.join("\n");
	assert.ok(miss.includes("待配表（缺口说明）：L363"), "缺口逐条列出：\n" + miss);
	assert.ok(miss.includes("没有读回验收回执"), "读回验收的缺失如实说：\n" + miss);
	// 「没有回执」不等于「没验收过」——不许把没看到写成没有
	assert.ok(miss.includes("不代表"), "措辞如实（不是「没验收过」）：\n" + miss);
});

test("配置支线：缺件时的结论（无成稿 / 有规则无定稿 / 有定稿无 §6 / §6 空）", () => {
	const noContract = parseConfigContract("");
	const facts = (over: any) => Object.assign({
		draft: { exists: false, name: "", status: "", docType: "", line: 0, archived: false },
		final: { exists: false, name: "", status: "", docType: "", line: 0 },
		contract: noContract, referencedMissing: [], readbacks: [], configFiles: []
	}, over);

	const a = configBranchState(facts({}));
	assert.equal(a.stage, "before-draft");
	assert.ok(/还没开始/.test(a.label));
	assert.ok(a.missing.some((m) => /还没有定稿/.test(m)));

	const b = configBranchState(facts({
		draft: { exists: true, name: "X_20260101.md", status: "draft", docType: "draft_gdd", line: 13, archived: false }
	}));
	assert.equal(b.stage, "rules-ready");
	assert.ok(/规则就绪/.test(b.label), b.label);
	assert.deepEqual(b.steps.map((s) => s.done), [true, false, false, false]);
	assert.ok(b.reason.includes("X_20260101.md"), "依据里点名是哪一份成稿：" + b.reason);

	const c = configBranchState(facts({
		draft: { exists: true, name: "X_20260101.md", status: "archived", docType: "draft_gdd", line: 13, archived: true },
		final: { exists: true, name: "X_20260102_定稿.md", status: "pending", docType: "final_gdd", line: 1 }
	}));
	assert.equal(c.stage, "integrating");
	assert.ok(/还没有 §6/.test(c.label), c.label);
	assert.ok(c.missing.some((m) => /没有 `## 6\. 配置契约`/.test(m)));

	const d = configBranchState(facts({
		final: { exists: true, name: "X_20260102_定稿.md", status: "active", docType: "final_gdd", line: 1 },
		contract: { present: true, line: 300, workbooks: [], fields: [], pending: [], notedGaps: [], otherRows: 4 }
	}));
	assert.equal(d.stage, "missing-nofields");
	assert.ok(/没有字段行/.test(d.label), d.label);
});

test("配置支线：字段行带「待配表」时算缺口；工作簿不在配置目录里时如实报", () => {
	const text = [
		"## 6. 配置契约", "",
		"> 来源工作簿：`A999-不存在表.xlsx`。", "",
		"### 6.1 全局变量（A012-全局变量表）", "",
		"| 中文字段 | 英文字段 | 数据结构 | 含义 | 状态 |",
		"| --- | --- | --- | --- | --- |",
		"| 已有字段 | `hasOne` | int | 说明 | 已有 |",
		"| 待配字段 | `toBeDone` | int | 说明 | 待配表 |",
		""
	].join("\n");
	const c = parseConfigContract(text);
	assert.equal(c.fields.length, 2);
	assert.deepEqual(c.pending.map((r) => r.field), ["toBeDone"]);
	assert.deepEqual(c.workbooks, ["A999-不存在表.xlsx"]);

	const b = configBranchState({
		draft: { exists: true, name: "X_20260101.md", status: "draft", docType: "draft_gdd", line: 13, archived: false },
		final: { exists: true, name: "X_20260102_定稿.md", status: "pending", docType: "final_gdd", line: 1 },
		contract: c, referencedMissing: ["A999-不存在表.xlsx"], readbacks: [{ name: "readback_A012_X_20260102.md", rel: "evidence/readback_A012_X_20260102.md", date: "20260102" }],
		configFiles: ["A012-全局变量表.xlsx"]
	});
	assert.equal(b.stage, "missing-pending");
	assert.ok(/1 处/.test(b.label), "只算 1 处（字段行的那个）：" + b.label);
	assert.ok(b.missing.some((m) => /待配表（字段行）：L10/.test(m)), b.missing.join("\n"));
	assert.ok(b.missing.some((m) => /没有同名文件：A999-不存在表\.xlsx/.test(m)), b.missing.join("\n"));
	assert.equal(b.steps.filter((s) => s.key === "readback")[0].done, true, "有回执 ⇒ 那一步 done");
});

test("读回回执：只按文件名认出 readback_*（真数据一份都没有）", () => {
	assert.deepEqual(readbacksOf([]), []);
	assert.deepEqual(readbacksOf(["经验包.md", "calibration_x.jsonl"]), []);
	const got = readbacksOf(["readback_A079_神话宝库_20260916.md", "readback_A006_别的_20260901.md"]);
	assert.deepEqual(got.map((r) => r.date), ["20260916", "20260901"], "新的在前");
	assert.equal(got[0].rel, "evidence/readback_A079_神话宝库_20260916.md");
	// 真实功能目录的 evidence\ 里没有回执（缺什么写什么）
	const ev = fs.readdirSync(path.join(FEATURE, "evidence"));
	assert.deepEqual(readbacksOf(ev), [], "联盟悬赏的 evidence\\ 里确实没有 readback_*：" + ev.join(" / "));
});

test("三个动作：表只有一份、顺序是一条链（不是并列四入口）", () => {
	assert.deepEqual(DRAFT_ACTIONS_TABLE.map((a) => a.id), ["create", "revise", "integrate"]);
	assert.equal(DRAFT_ACTIONS_TABLE[0].hint, "跑 /sr-gdd-human");
	assert.equal(DRAFT_ACTIONS_TABLE[2].hint, "跑 /sr-gdd-ai");
	for (const a of DRAFT_ACTIONS_TABLE) {
		assert.ok(a.label && a.needs && a.output && a.handoff, a.id + " 的四个字段都要有");
	}
	assert.ok(DRAFT_ACTIONS_TABLE[2].output.includes("_定稿.md"), "整合定稿的产出落点写清");
	assert.ok(/draft_gdd/.test(DRAFT_ACTIONS_TABLE[0].output), "写成稿的头部字段写清");
});

test("指令 · 写成稿：三段式 + 纯规则口径 + 落点由功能根派生", () => {
	const got = buildDraftInstruction({
		action: "create", root: "D:\\ws\\features\\联盟悬赏", topic: "联盟悬赏",
		date: "20261001", intent: "把 sr-analysis 的复刻规格落成成稿",
		materials: ["D:\\ws\\features\\联盟悬赏\\analysis\\replication-spec_联盟悬赏_20260918.md"]
	});
	assert.equal(got.blocked, "");
	const L = got.instruction.split("\n");
	assert.ok(L[0].indexOf("/sr-gdd-human") >= 0, "第一段：改哪儿（跑哪个 skill）→ " + L[0]);
	assert.equal(L[1], "主题：联盟悬赏");
	assert.ok(L[2].startsWith("要写成什么"), "意图那一行：" + L[2]);
	assert.ok(got.instruction.includes("D:\\ws\\features\\联盟悬赏\\gdd\\联盟悬赏_20261001.md"), "产出落点由功能根派生：" + got.instruction);
	assert.ok(got.instruction.includes("doc_type: draft_gdd"), "头部字段写进指令");
	assert.ok(got.instruction.includes("**结果章只有纯规则与设计**"), "纯规则口径逐字写进指令");
	assert.ok(got.instruction.includes("不出现字段名、表名"), "零配置指代逐字写进指令");
	assert.ok(got.instruction.includes("配置项预测"), "上游交接 JSON 的配置预测不进成稿");
	assert.ok(got.instruction.includes("replication-spec_联盟悬赏_20260918.md"), "材料路径进指令");
	assert.ok(/有决策门就停下来等我拍板/.test(got.instruction), "收尾那句纪律在");
});

test("指令 · 改成稿：三段式 = 改哪儿 / 现状原文 / 要改成什么（+ 配置支线现状）", () => {
	const before = "| 终结奖励 | 击杀 BOSS（打出终结一击）的玩家获得… | `A079-联盟悬赏.xlsx!难度表.killDropId` |";
	const got = buildDraftInstruction({
		action: "revise", root: "D:\\ws\\features\\联盟悬赏", topic: "联盟悬赏", date: "20261001",
		draftPath: "D:\\ws\\features\\联盟悬赏\\gdd\\联盟悬赏_20260918.md",
		where: "§4 R6 奖励", before: before, intent: "终结奖励与通关奖励合并为一个宝箱入口",
		configLabel: "配置表已派生，还有 1 处「待配表」缺口没闭",
		configMissing: ["待配表（缺口说明）：L363 6.5 掉落引用与缺口（A006-掉落表.xlsx） · 活动周期/排行过滤门槛/展示上限"]
	});
	assert.equal(got.blocked, "");
	const L = got.instruction.split("\n");
	assert.equal(L[0], "/sr-gdd-human D:\\ws\\features\\联盟悬赏\\gdd\\联盟悬赏_20260918.md", "第一段：改哪儿（文件）");
	assert.equal(L[1], "改 §4 R6 奖励。", "第二段：改哪儿（条目引用）");
	assert.equal(L[2], "现状：" + before, "第三段：现状原文（逐字）");
	assert.equal(L[3], "要改成：终结奖励与通关奖励合并为一个宝箱入口");
	assert.ok(got.instruction.includes("表格行，请按表格口径整行替换"), "表格行的处置说明");
	assert.ok(got.instruction.includes("配置表已派生，还有 1 处"), "配置支线的现状进了指令");
	assert.ok(got.instruction.includes("/sr-config"), "改规则时交代配置字段的重新派生归谁");
	assert.ok(got.instruction.includes("只报**结构引用**扫得出的那部分"), "面板不越界（语义影响留给 skill）");
	// 缺前提：不给现状、不给条目引用、不给意图 —— 三种都 blocked + next，且**不发**
	const noWhere = buildDraftInstruction({ action: "revise", root: "D:\\ws\\f", draftPath: "D:\\ws\\f\\gdd\\a.md" });
	assert.equal(noWhere.instruction, "");
	assert.ok(noWhere.blocked.includes("改哪儿"));
	assert.ok(noWhere.next.length > 0);
	const noIntent = buildDraftInstruction({ action: "revise", root: "D:\\ws\\f", draftPath: "D:\\ws\\f\\gdd\\a.md", where: "§4 R6", before: "x" });
	assert.equal(noIntent.instruction, "");
	assert.ok(noIntent.blocked.includes("要改成什么"));
	const noDraft = buildDraftInstruction({ action: "revise", root: "D:\\ws\\f", where: "§4 R6", before: "x", intent: "y" });
	assert.equal(noDraft.instruction, "");
	assert.ok(noDraft.blocked.includes("成稿的路径"));
	assert.ok(noDraft.next.includes("先走「写成稿」"));
});

test("指令 · 发起整合定稿：带上 §6/§7 的整合要求与配置侧缺口", () => {
	const got = buildDraftInstruction({
		action: "integrate", root: "D:\\ws\\features\\联盟悬赏", topic: "联盟悬赏", date: "20261001",
		draftPath: "D:\\ws\\features\\联盟悬赏\\gdd\\联盟悬赏_20260918.md",
		configLabel: "配置表已派生，还有 1 处「待配表」缺口没闭",
		configMissing: ["待配表（缺口说明）：L363 …"]
	});
	assert.equal(got.blocked, "");
	assert.ok(got.instruction.indexOf("/sr-gdd-ai") >= 0, "第一段：跑 /sr-gdd-ai");
	assert.ok(got.instruction.includes("配置支线走到哪"), "第三段：配置支线的现状");
	assert.ok(got.instruction.includes("待配表（缺口说明）：L363"), "缺口逐条带上");
	assert.ok(got.instruction.includes("§4 保留成稿的规则与组号"), "章节对应要求（§4）");
	assert.ok(got.instruction.includes("新增 §6 配置契约"), "§6 整合要求");
	assert.ok(got.instruction.includes("新增 §7 多语言文本"), "§7 整合要求");
	assert.ok(got.instruction.includes("不进定稿"), "§8 / §12 不进定稿");
	assert.ok(got.instruction.includes("status: pending"), "产出头部字段");
	assert.ok(got.instruction.includes("/sr-gdd-review"), "第 5 步的必经审查");
	assert.ok(got.instruction.includes("审查是质量意见，不是通过凭证"), "审查的定位逐字");
});

test("指令：未知动作 / 拿不到功能根 —— 都不发指令并给下一步", () => {
	const bad = buildDraftInstruction({ action: "nope", root: "D:\\ws\\f" });
	assert.equal(bad.instruction, "");
	assert.ok(bad.blocked.includes("未知的文档生成动作"));
	assert.ok(bad.next.includes("写成稿"));
	const noRoot = buildDraftInstruction({ action: "create", topic: "X" });
	assert.equal(noRoot.instruction, "");
	assert.ok(noRoot.blocked.includes("功能目录"));
	assert.ok(noRoot.next.includes("文档生成"));
});
