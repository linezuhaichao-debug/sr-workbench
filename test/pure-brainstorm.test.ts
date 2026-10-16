/**
 * 头脑风暴四入口的指令文本（工单 23）。
 *
 * ★ 这是**发给 agent 的上下文**：措辞变了就是行为变了，所以逐行钉住。
 * ★ 前置不满足时必须给 `blocked` **与** `next`（"缺前提不静默"是工单 23 第 4 条）。
 * ★ 工单 31（收口）：同一份模块里原来还并存着**老收件箱的四种方式**（`INTAKE_KINDS` +
 *   `buildInstruction`），本票把它们删了（只服务被砍掉的「设计资产」屏）⇒ 原来那两条
 *   "两套语义并存"的用例一并删除；这里剩下的全部是新四入口的断言，一条都没放宽。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { INTAKE } from "../src/pure/intake.ts";
import { humanNoteName, legacyDocName } from "../src/pure/analysisdoc.ts";

const FEATURE = "D:\\TimeMachine\\GameDesignOS\\workspace\\features\\联盟悬赏";
const B = (kind: string, input: any) => INTAKE.buildBrainstormInstruction(kind, Object.assign({ root: FEATURE, date: "20260930" }, input));

test("四入口：表里四个都在（这是模块里**唯一**的一套入口口径）", () => {
	assert.deepEqual(INTAKE.BRAINSTORM_KINDS.map((k: any) => k.id), ["analysis", "concept", "legacy", "humannote"]);
});

/**
 * ★ 2026-10-13 新口径：四入口**每发一次都另起一条新会话**（用户指令）—— 新会话没有上一轮的
 *   对话记忆，所以指令正文必须让它**先读盘上已有的东西**（决策记录 + analysis\ 既有产出）。
 *   判据盯正文：两处路径都得写全，且插在**第一行之后**（先说要干什么，再说动手前先读什么）。
 */
test("四入口都带「你是新开的一条会话 · 先读决策记录与既有产出」那段（每派一次活一条会话）", () => {
	const cases: Array<[string, any]> = [
		["analysis", { materials: [{ kind: "dir", path: "D:\\素材\\x" }] }],
		["concept", { note: "一句话创意" }],
		["legacy", { materials: [{ kind: "file", path: "D:\\旧案\\a.docx" }], name: "旧案" }],
		["humannote", { quote: "原话", author: "祖海潮" }]
	];
	for (const [kind, input] of cases) {
		const r = B(kind, input);
		assert.equal(r.blocked, "", kind + " 应当能发出指令：" + r.blocked);
		const lines = r.instruction.split("\n");
		assert.ok(lines[1].indexOf("★ 你是**这次派活新开的一条会话**") === 0, kind + " 的第二行该是「新开的会话」那段：" + lines[1]);
		assert.ok(r.instruction.includes(FEATURE + "\\decisions\\决策记录.md"), kind + " 要写明先读决策记录的绝对路径");
		assert.ok(r.instruction.includes(FEATURE + "\\analysis\\ 里已有的产出"), kind + " 要写明先看 analysis\\ 既有产出");
		assert.ok(r.instruction.includes("没有上一轮的对话记忆"), kind + " 要说清为什么必须读（新会话没有记忆）");
	}
});

test("竞品分析：跑 /sr-analysis + 素材 + 产出落 analysis\\", () => {
	const r = B("analysis", { materials: [{ kind: "dir", path: "D:\\素材\\竞品_联盟" }], note: "看它的奖池概率" });
	assert.equal(r.blocked, "");
	assert.ok(r.instruction.startsWith("【头脑风暴 · 竞品分析】请执行 `/sr-analysis`"), r.instruction);
	assert.ok(r.instruction.includes("1. 目录：D:\\素材\\竞品_联盟"));
	assert.ok(r.instruction.includes("分析目标：看它的奖池概率"));
	assert.ok(r.instruction.includes("功能主题（用于产出命名与归档）：竞品_联盟"));
	// ★ 产出落到**这个功能自己的** analysis\（不是工作区根的 inbox\）
	assert.ok(r.instruction.includes("产出落点：" + FEATURE + "\\analysis\\"), r.instruction);
	assert.ok(!r.instruction.includes("inbox"), "新入口不该再提收集箱");
	// 面板不重画流程：发起后交给 skill
	assert.ok(r.instruction.includes("阶段交给了 skill / 会话里的 AI：阶段交给了 skill，进度与提问都在那个会话里"));
});

test("问答式访谈：跑 /sr-concept + 一句创意 + 有/没有材料都要说清", () => {
	const r = B("concept", { materials: [{ kind: "text", text: "联盟成员一起打 BOSS，血量全盟共享" }] });
	assert.equal(r.blocked, "");
	assert.ok(r.instruction.startsWith("【头脑风暴 · 问答式访谈】请执行 `/sr-concept`"));
	assert.ok(r.instruction.includes("创意：联盟成员一起打 BOSS，血量全盟共享"));
	assert.ok(r.instruction.includes("已有材料：没有。"));
	assert.ok(r.instruction.includes("定位：本项目（文明之跃）新功能/新玩法。"));
	assert.ok(r.instruction.includes("产出落点：" + FEATURE + "\\analysis\\"));

	const r2 = B("concept", { note: "一句话创意", materials: [{ kind: "file", path: "D:\\素材\\a.png" }] });
	assert.ok(r2.instruction.includes("已有材料（有就给路径）："));
	assert.ok(r2.instruction.includes("1. 文件：D:\\素材\\a.png"));
});

test("旧文档分析：原件进 evidence\\（v5 的 4 桶）、产出四段固定章节、身份信息指向原件", () => {
	const r = B("legacy", { materials: [{ kind: "file", path: "D:\\旧案\\飞船装置.docx" }], name: "飞船装置" });
	assert.equal(r.blocked, "");
	assert.ok(r.instruction.startsWith("【头脑风暴 · 旧文档分析】"));
	// ★ 原件进原料桶（工单 23 第 5 条）
	assert.ok(r.instruction.includes("1) 原件进原料桶：若它不在 " + FEATURE + "\\evidence\\ 下，先把原件（**保持原文件名**）放进 " + FEATURE + "\\evidence\\"), r.instruction);
	// 产出名与 frontmatter（来源指向原件）
	assert.ok(r.instruction.includes("2) 产出 " + FEATURE + "\\analysis\\" + legacyDocName("飞船装置", "20260930")), r.instruction);
	assert.ok(r.instruction.includes("doc_type: legacy_analysis"));
	assert.ok(r.instruction.includes("source: evidence/<原件文件名>"));
	assert.equal(/[\\/]source[\\/]/.test(r.instruction), false, "v5 起原件进 evidence\\，指令里不该再出现 source\\ 这个桶");
	assert.ok(r.instruction.includes("（`source:` 指向原件在 `evidence\\` 里的位置 —— 产出文档的身份信息必须指回原件。）"));
	// ★ 四段固定章节，标题逐字
	for (const h of ["## 仍然有效的结论", "## 已废弃 / 不适用", "## 可复用条目（表格：旧文档位置 | 内容 | 去向）", "## 原文（转换后）"]) {
		assert.ok(r.instruction.includes(h), "指令里缺这一段：" + h);
	}
	assert.ok(r.instruction.includes("4)「已废弃 / 不适用」的每一条**都要写理由**"));
	assert.ok(r.instruction.includes("某一节没有内容就写「（无）」，不要删掉这一节。"));
});

test("人工补充：只问原话 + 谁说的；产出无标题、文件名由原话派生、只整理格式", () => {
	const quote = "BOSS 的血条应该是全盟共享的，一个人打全盟都能看到";
	const r = B("humannote", { quote: quote, author: "祖海潮" });
	assert.equal(r.blocked, "");
	assert.ok(r.instruction.startsWith("【头脑风暴 · 人工补充】把我的原话整理成 " + FEATURE + "\\analysis\\" + humanNoteName(quote, "20260930")), r.instruction);
	assert.ok(r.instruction.includes("（**只整理格式，不许改动结论**）"));
	// ★ 谁说的：指令里给一次，产出 frontmatter 的 author 逐字照抄
	assert.ok(r.instruction.includes("谁说的（照抄进 frontmatter 的 `author:` —— 它是这条结论的来源）：祖海潮"), r.instruction);
	assert.ok(r.instruction.includes("author: 祖海潮"));
	assert.ok(!r.instruction.includes("<谁说的>"), "作者是必填项，产出格式里不该再有占位符");
	// ★ 原话逐字出现两次：一次当输入、一次当产出格式里的那一行
	assert.equal(r.instruction.split("「" + quote + "」").length - 1, 2, r.instruction);
	assert.ok(r.instruction.includes("> 原话：「" + quote + "」"));
	assert.ok(r.instruction.includes("doc_type: human_note") && r.instruction.includes("confidence: high"));
	assert.ok(r.instruction.includes("## 结论"));
	// ★ 标题去掉：产出格式里没有 `# <标题>` 那一行，也没有「标题：」这一段输入
	assert.ok(!/^#\s/m.test(r.instruction), "产出格式里不该再有文档一级标题：" + r.instruction);
	assert.ok(!r.instruction.includes("标题："), "面板已不问标题（原话就是结论，也是文件名的来源）");
	// ★ 边界 / 落点由 AI 自己判断（面板不问、产出里也不再固定要求这两段）
	assert.ok(r.instruction.includes("2) `> 原话：…` 那一行**逐字保留**；它与「结论」在面板上是**并排显示**的"));
	assert.ok(r.instruction.includes("4) 边界与落点**由你自己判断**"));
	assert.ok(!r.instruction.includes("边界（我给的，照抄进「边界」）"));
	assert.ok(!r.instruction.includes("落点（我给的，照抄进「落点」）"));
	assert.ok(!r.instruction.includes("## 边界") && !r.instruction.includes("## 落点"));
});

test("缺前提：每条都给可读提示 + 下一步（不静默、不发出去）", () => {
	const cases: Array<[string, any, string]> = [
		["analysis", { materials: [{ kind: "text", text: "只有一段话" }] }, "「竞品分析」需要一份素材"],
		["concept", { materials: [] }, "「问答式访谈」需要一句创意"],
		["legacy", { materials: [{ kind: "text", text: "一段话" }] }, "「旧文档分析」需要旧文档的路径"],
		["humannote", { author: "祖海潮" }, "「人工补充」需要你的原话"],
		["humannote", { quote: "有原话但没写谁说的" }, "「人工补充」需要写清这句话是谁说的"]
	];
	for (const [kind, input, want] of cases) {
		const r = B(kind, input);
		assert.equal(r.instruction, "", kind + " 缺前提时不该有指令");
		assert.ok(r.blocked.indexOf(want) === 0, kind + " blocked = " + r.blocked);
		assert.ok(r.next && r.next.length > 8, kind + " 缺「下一步」");
	}
	// 拿不到功能目录 → 也不猜、不发
	const noRoot = INTAKE.buildBrainstormInstruction("humannote", { quote: "q", author: "我", root: "", date: "20260930" });
	assert.ok(noRoot.blocked.includes("拿不到这个功能的功能目录"));
	assert.ok(noRoot.next.includes("功能详情 › 头脑风暴"));

	const unknown = B("nope", {});
	assert.ok(unknown.blocked.includes("未知的头脑风暴入口：nope"));
	assert.ok(unknown.next.includes("竞品分析 / 问答式访谈 / 旧文档分析 / 人工补充"));
});
// ★ 工单 31：这里原来还有一条「老收件箱的四种方式一字未动（同一份模块里两套语义不许互相污染）」
//   —— 老收件箱那一组（`buildInstruction` / `INTAKE_KINDS`）已随本票删除，那条用例随之删除。
