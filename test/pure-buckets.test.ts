/**
 * 目录契约（4 个桶）与 `gdd\` 内部细分的判据。
 *
 * 这一份钉住的是 v5 的**目录契约本身**：一个功能 = 一个目录，里面只有 4 个桶；
 * 面板的「最终产物」只有四类，其余如实进「其它」。
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
	BUCKET_LABEL, BUCKET_MEANING, BUCKETS, GDD_KIND_LABEL, gddKindOf, isBucket, outputGroupInfo, outputGroupOf
} from "../src/pure/buckets.ts";

test("4 个桶：名字、顺序、标签、含义都在", () => {
	assert.deepEqual(BUCKETS, ["evidence", "analysis", "gdd", "decisions"]);
	for (const b of BUCKETS) {
		assert.ok(BUCKET_MEANING[b] && BUCKET_MEANING[b].length > 4, "每个桶都要有一句「装什么」：" + b);
		assert.ok(BUCKET_LABEL[b], "每个桶都要有界面短标签：" + b);
	}
	// v4 的两个桶已经并入：source → evidence，delivery → gdd
	assert.equal(isBucket("source"), false);
	assert.equal(isBucket("delivery"), false);
	assert.equal(isBucket("Evidence"), true, "大小写不敏感（Windows 目录名如此）");
	assert.equal(isBucket("nope"), false);
});

test("gdd\\ 细分：五档 + 认不出来的进 others（一个都不丢）", () => {
	const cases: Array<[string, string]> = [
		["联盟讨伐_20260918.md", "draft"],
		["联盟讨伐_20260923_定稿.md", "final"],
		["联盟讨伐_20260921_定稿_审查.md", "review"],
		["联盟讨伐_20260921_审查.md", "review"],
		["联盟讨伐_20260924_修订点.md", "fixpoints"],
		["联盟讨伐_20260923_定稿.html", "finalHtml"],
		["联盟讨伐_20260923_定稿.htm", "finalHtml"],
		["联盟讨伐_宣讲_20260923.html", "speech"],
		["联盟讨伐_宣讲_20260923.content.json", "speechSrc"],
		["随便一个.html", "others"],
		["", "others"]
	];
	for (const [name, want] of cases) assert.equal(gddKindOf(name), want, name);
	assert.equal(GDD_KIND_LABEL.speech, "宣讲 HTML");
});

test("最终产物只有四类：头脑风暴的产物 / 成稿 / 定稿 / 宣讲 HTML；其余是其它", () => {
	assert.equal(outputGroupOf("analysis", "experience-report_x_20260915.md"), "brainstorm");
	assert.equal(outputGroupOf("analysis", "随便什么.bin"), "brainstorm", "analysis\\ 里的一切都算头脑风暴产物");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260918.md"), "draft");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260923_定稿.md"), "final");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_宣讲_20260923.html"), "speech");
	// 审查 / 修订点 / 定稿 HTML 派生件 / 界面图 → 其它（默认折叠，但不丢）
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260921_定稿_审查.md"), "other");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260924_修订点.md"), "other");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260923_定稿.html"), "other");
	assert.equal(outputGroupOf("evidence", "截图.png"), "other");
	assert.equal(outputGroupOf("decisions", "决策记录.md"), "other");
});

test("分类键 → 显示信息只有一处（界面不自己写标签）", () => {
	assert.equal(outputGroupInfo("brainstorm").label, "头脑风暴的产物");
	assert.equal(outputGroupInfo("draft").label, "成稿");
	assert.equal(outputGroupInfo("final").label, "定稿");
	assert.equal(outputGroupInfo("speech").label, "HTML 宣讲稿");
	assert.ok(outputGroupInfo("other").label.includes("其它"));
	assert.equal(outputGroupInfo("没这个键").label, "没这个键", "认不出来就原样返回，不编");
});
