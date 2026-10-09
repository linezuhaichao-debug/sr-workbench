/** 决策正文「标签：内容」识别的判据（用户实测 bug 的防线）。 */
import assert from "node:assert/strict";
import test from "node:test";

import { BODY_LABELS, labelLineOf } from "../src/pure/labels.ts";
import { decisionEntryTemplate } from "../src/pure/decisions.ts";

test("标准写法：模板产出的三行都要认出来", () => {
	const tpl = decisionEntryTemplate("2026-10-09 16:07:29");
	const rows = tpl.split("\n").filter((l) => labelLineOf(l) !== null);
	assert.deepEqual(rows.map((l) => labelLineOf(l)!.label), ["决策", "依据", "影响"], "模板三行逐行可认：" + tpl);
});

test("写法飘了也要认（这就是丢标签的那个 bug）", () => {
	const cases: Array<[string, string]> = [
		["**影响**（DEF-002）：入口门槛在配置侧缺替", "影响"],
		["- 影响：入口门槛在配置侧缺替", "影响"],
		["* **依据**：一个 change set 只对应一个目标文件", "依据"],
		["__影响__：x", "影响"],
		["影响 [DEF-002]：x", "影响"],
		["影响:x", "影响"],
		["**影响** ：x", "影响"],
		["决策: 去掉战绩界面", "决策"]
	];
	for (const [line, want] of cases) {
		const got = labelLineOf(line);
		assert.ok(got !== null, "应当认出标签：" + line);
		assert.equal(got!.label, want);
	}
});

test("内容照原样带出来（标签与注释之外一个字不改）", () => {
	assert.equal(labelLineOf("**影响**（DEF-002）：入口门槛在配置侧缺替，需在 CS-002 落地后闭合")!.text,
		"入口门槛在配置侧缺替，需在 CS-002 落地后闭合");
	assert.equal(labelLineOf("决策：A028 另开 CS-20261009-002 补写")!.text, "A028 另开 CS-20261009-002 补写");
});

test("白名单之外不瞎猜：不是标签的行一律 null（当普通段落渲染）", () => {
	for (const line of [
		"副作用：入口门槛缺替",
		"note: something",
		"决策 A028 补写（少了冒号）",
		"",
		"    ",
		null
	]) {
		assert.equal(labelLineOf(line), null, "不该认成标签：" + JSON.stringify(line));
	}
	assert.equal(BODY_LABELS.indexOf("决策") >= 0, true);
	assert.equal(BODY_LABELS.length, 9, "标签白名单是 9 个（改了要同时想清楚文档与模板）");
});
