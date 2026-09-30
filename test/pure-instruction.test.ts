/**
 * 三段式指令文本（工单 14 的定位卡 + 工单 15 的发送**共用同一段**）。
 *
 * ★ 为什么要逐行断言：这段文字是**产品契约**的一部分 —— 用户按下「发到工作会话」之后，
 *   工作会话收到的就是它。定位卡上先给人看的那段与发出去的这段**必须逐字相同**
 *   （面板不再自己拼一份，`client.js` 的 `fixRunner` 也改成调这个函数）。
 * ★ 六类边的标签：`family` → `[同族]`、`contract` → `[契约]`；其余五类边的命中是
 *   "全文提到它的位置"、不带 kind（指令里也就不加标签），逐字保持原样。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildFixInstruction } from "../src/pure/instruction.ts";

test("完整三段式：改哪儿 / 现状原文 / 影响范围（逐行文本）", () => {
	const text = buildFixInstruction({
		path: "D:\\TimeMachine\\GameDesignOS\\workspace\\features\\联盟悬赏\\gdd\\联盟悬赏_20260923_定稿.md",
		ref: "§5 UI-M1 UE3",
		before: "| UE3 | 【难度通关奖励】以单个宝箱形式常驻展示；… |",
		intent: "改成两个宝箱入口",
		impact: [
			{ line: 139, where: "§4 R6 奖励" },
			{ line: 215, where: "§5 UI-M1 UE3a", kind: "family" },
		],
	});
	assert.deepEqual(text.split("\n"), [
		"/sr-gdd-fix D:\\TimeMachine\\GameDesignOS\\workspace\\features\\联盟悬赏\\gdd\\联盟悬赏_20260923_定稿.md",
		"改 §5 UI-M1 UE3。",
		"现状：| UE3 | 【难度通关奖励】以单个宝箱形式常驻展示；… |",
		"要改成：改成两个宝箱入口",
		"连带影响（工作台按结构引用扫出，供参考；语义影响请按 D11 自行扫全）：",
		"  · L139 §4 R6 奖励",
		"  · L215 [同族] §5 UI-M1 UE3a",
	]);
});

test("第⑥类契约边在指令里带 `[契约]` 标记（面板上也是这个字）", () => {
	const text = buildFixInstruction({
		path: "D:\\x\\定稿.md", ref: "§4 R6", before: "### R6 奖励", intent: "拆成两组",
		impact: [
			{ line: 314, where: "§6 全局变量.alliBossChallengeReward", kind: "contract" },
			{ line: 342, where: "§6 难度表.clearDropId", kind: "contract" },
			{ line: 430, where: "§8 范围门" },
		],
	});
	assert.ok(text.includes("  · L314 [契约] §6 全局变量.alliBossChallengeReward"), text);
	assert.ok(text.includes("  · L342 [契约] §6 难度表.clearDropId"), text);
	// 不带 kind 的命中保持原样（一个空格，不加标签）
	assert.ok(text.includes("  · L430 §8 范围门"), text);
});

test("边界：没有影响范围就不出那一段；空 intent / 空 before 不炸", () => {
	const bare = buildFixInstruction({ path: "p", ref: "§10 AC8", before: "", intent: "" });
	assert.deepEqual(bare.split("\n"), ["/sr-gdd-fix p", "改 §10 AC8。", "现状：", "要改成："]);
	assert.equal(bare.includes("连带影响"), false);
	// impact 传空数组 = 同"没有"
	assert.equal(buildFixInstruction({ path: "p", ref: "r", impact: [] }).includes("连带影响"), false);
	// 缺字段也不抛
	assert.equal(typeof buildFixInstruction({}), "string");
	assert.equal(buildFixInstruction({ path: "p", ref: "r" }).split("\n").length, 4);
});

test("影响范围最多列 12 行（发出去的指令不因为长得离谱而没人看）", () => {
	const many = Array.from({ length: 30 }, (_, i) => ({ line: i + 1, where: "§4 R1 活动周期与开启" }));
	const text = buildFixInstruction({ path: "p", ref: "§4 R1", impact: many });
	assert.equal(text.split("\n").filter((l) => l.startsWith("  · ")).length, 12);
});
