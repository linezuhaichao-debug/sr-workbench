/**
 * **面板视图记忆**（上次停在哪个功能 / 哪个模块）—— 纯函数用例。
 *
 * 背景：从工作会话切回工作台，面板会**重挂载** ⇒ 以前每次回到卡片墙、想接着看那个功能
 * 得重头点一遍（用户口径 2026-10-10）。判据就两条：
 *   ① 记得住记得准（功能 + 模块，序列化/解析往返一致）；
 *   ② **认不出来时绝不装**（坏 JSON / 形状不对 / 未知模块名 / 空 topic 一律当"没记过"
 *      ⇒ 界面回卡片墙）—— 这条比第一条重要：宁可回到卡片墙，也不能卡在「正在读「…」…」。
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
	PANEL_MODS,
	panelModOf,
	panelViewEmpty,
	panelViewKey,
	panelViewParse,
	panelViewSerialize
} from "../src/pure/panelview.ts";

test("键名与模块名单：键固定（改了等于所有人记忆作废），模块只有那三个", () => {
	assert.equal(panelViewKey(), "sr-wb.view.v1");
	assert.deepEqual([...PANEL_MODS], ["brainstorm", "decisions", "outputs"]);
	// 空记忆每次都是**新对象**（免得调用方改到共享常量）
	const a = panelViewEmpty();
	const b = panelViewEmpty();
	assert.deepEqual(a, { topic: "", mod: "" });
	assert.notEqual(a, b);
});

test("模块名认不认：只认那三个 id，其它一律空串", () => {
	for (const m of PANEL_MODS) assert.equal(panelModOf(m), m);
	assert.equal(panelModOf("outputs "), "", "带空格的怪值不认（老版本写坏过就算了）");
	assert.equal(panelModOf("Braindump"), "");
	assert.equal(panelModOf(""), "");
	assert.equal(panelModOf(null), "");
	assert.equal(panelModOf(7), "");
});

test("记住 / 读回：功能 + 模块往返一致", () => {
	const raw = panelViewSerialize("联盟讨伐", "decisions");
	assert.deepEqual(panelViewParse(raw), { topic: "联盟讨伐", mod: "decisions" });
	// 卡片墙：topic 为空 ⇒ 模块一并丢掉（不留半个记忆）
	assert.deepEqual(panelViewParse(panelViewSerialize("", "decisions")), { topic: "", mod: "" });
	// 未知模块名：topic 留住、模块落回空串（界面回默认模块，不是回卡片墙）
	assert.deepEqual(panelViewParse(panelViewSerialize("英雄圣物", "看板")), { topic: "英雄圣物", mod: "" });
	// 两边空白不算名字
	assert.equal(panelViewParse(panelViewSerialize("  联盟讨伐  ", "outputs")).topic, "联盟讨伐");
});

test("坏记忆一律当「没记过」：坏 JSON / 非对象 / 缺 topic / 类型不对，绝不抛", () => {
	for (const raw of [
		"{这不是 JSON", "", "null", "[]", "\"联盟讨伐\"", "7", "true",
		"{}", "{\"mod\":\"decisions\"}", "{\"topic\":\"\"}", "{\"topic\":\"   \"}",
		"{\"topic\":7,\"mod\":\"decisions\"}", "{\"topic\":null}"
	]) {
		assert.deepEqual(panelViewParse(raw), { topic: "", mod: "" }, "坏值 " + raw + " 该当没记过");
	}
	// 非字符串（localStorage 拿不到就是 null）同样当没记过
	for (const raw of [null, undefined, 42, {}, []]) {
		assert.deepEqual(panelViewParse(raw), { topic: "", mod: "" });
	}
});

test("模块沿用只有一条路：恢复时才带模块；从卡片墙点进功能一律回默认模块", () => {
	// 这条语义靠"记忆里只有一份 topic/mod + 进功能时显式给默认模块"保证 —— 这里钉住解析出来的形状，
	// 免得以后有人在记忆里再加一份"当前屏幕"，那正是两份状态互相漂移的起点。
	const mem = panelViewParse(JSON.stringify({ topic: "联盟讨伐", mod: "decisions" }));
	assert.deepEqual(mem, { topic: "联盟讨伐", mod: "decisions" });
	assert.equal(panelModOf(mem.mod), "decisions");
	// 记忆里那个模块名认不出来 ⇒ 空串（调用方回默认），但功能本身还认
	assert.deepEqual(panelViewParse(JSON.stringify({ topic: "联盟讨伐", mod: "看板" })), { topic: "联盟讨伐", mod: "" });
});
