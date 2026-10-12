/**
 * 目录契约（4 个桶）与 `gdd\` 内部细分的判据。
 *
 * 这一份钉住的是 v5 的**目录契约本身**：一个功能 = 一个目录，里面只有 4 个桶；
 * 面板的「最终产物」只有四类，其余如实进「其它」。
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
	BUCKET_LABEL, BUCKET_MEANING, BUCKETS, currentNameOf, GDD_KIND_LABEL, gddKindOf, historyVersionOf, isBucket, outputGroupInfo, outputGroupOf,
	traceKindOf
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
		["联盟讨伐_成稿.md", "draft"],
		["英雄圣物_宣讲.html", "speech"],
		["联盟讨伐_宣讲_20260923.html", "speech"],
		["联盟讨伐_宣讲_20260923.content.json", "speechSrc"],
		["联盟讨伐_宣讲.content.json", "speechSrc"],
		["联盟讨伐_宣讲.md", "speechSrc"],
		["联盟讨伐_UE.html", "ue"],
		["联盟讨伐_UE.content.json", "ueSrc"],
		["随便一个.html", "others"],
		["", "others"]
	];
	for (const [name, want] of cases) assert.equal(gddKindOf(name), want, name);
	assert.equal(GDD_KIND_LABEL.speech, "宣讲 HTML");
	assert.equal(GDD_KIND_LABEL.ue, "UE 界面稿");
	// ★ 宣讲稿的草稿 md 必须拦在 `/\.md$/ → draft` 之前，否则一份草稿会被算成「成稿」
	assert.equal(gddKindOf("联盟讨伐_宣讲.md"), "speechSrc", "宣讲草稿不是成稿");
	assert.equal(gddKindOf("联盟讨伐_宣讲.md".replace("宣讲", "宣讲会")), "draft", "没有 `_宣讲.md` 结尾的普通 md 还是成稿");
});

test("最终产物五类 + 其它，**过程留痕单独一档**（不列进列表，只报数）", () => {
	assert.equal(outputGroupOf("analysis", "experience-report_x_20260915.md"), "brainstorm");
	assert.equal(outputGroupOf("analysis", "随便什么.bin"), "brainstorm", "analysis\\ 里的一切都算头脑风暴产物");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260918.md"), "draft");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260923_定稿.md"), "final");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_宣讲_20260923.html"), "speech");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_UE.html"), "ue");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_UE_20261013_1.html"), "ue", "历史版本跟当前版同一类");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_宣讲.md"), "other", "宣讲稿的草稿是源数据，不进产物类");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_配置表_20260923.xlsx"), "config");
	// ★ 过程留痕：变更集 / 审查报告 / 修订点清单 —— 它们**不进 any 产物类**（用户口径 2026-10-13）
	assert.equal(outputGroupOf("gdd", "CS-20261009-001.yaml"), "trace");
	assert.equal(outputGroupOf("gdd", "CS-20261009-001_读回验收报告.md"), "trace");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260921_定稿_审查.md"), "trace");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260924_修订点.md"), "trace");
	// 定稿 HTML 派生件 / 界面图 → 其它（默认折叠，但不丢）—— 它们是**产物**，不是留痕
	assert.equal(outputGroupOf("gdd", "联盟讨伐_20260923_定稿.html"), "other");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_宣讲_20260923.content.json"), "other");
	assert.equal(outputGroupOf("evidence", "截图.png"), "other");
	assert.equal(outputGroupOf("decisions", "决策记录.md"), "other");
});

test("历史版本判据：`_<8位日期>_<序号>` 结尾才算（原名里带日期但**没有序号**的不算）", () => {
	// 是历史版本
	assert.equal(historyVersionOf("A079-联盟讨伐_20261012_1.xlsx"), true);
	assert.equal(historyVersionOf("联盟讨伐_20261010_定稿_20261013_2.md"), true);
	assert.equal(historyVersionOf("联盟讨伐_宣讲_20260924_20261013_1.html"), true);
	assert.equal(historyVersionOf("x.content_20261013_1.json"), true, "多段扩展名：去干净再判");
	assert.equal(historyVersionOf("x_20261013_1.content.json"), true, "后缀插在更前面也认（两种写法都收）");
	// ★ **不是**历史版本：原名里带日期、但没有序号 —— 这条划错就会把正常产物全判成留痕
	assert.equal(historyVersionOf("联盟讨伐_20260918.md"), false, "成稿文件名里就有日期，那不是版本号");
	assert.equal(historyVersionOf("联盟讨伐_20261010_定稿.md"), false);
	assert.equal(historyVersionOf("联盟讨伐_宣讲_20260924.html"), false);
	assert.equal(historyVersionOf("experience-report_x_20260915.md"), false);
	assert.equal(historyVersionOf("CS-20261009-001.yaml"), false, "变更集的编号用 `-` 分隔，不是版本号");
	assert.equal(historyVersionOf("A079-联盟讨伐.xlsx"), false);
	assert.equal(historyVersionOf(""), false);
	assert.equal(historyVersionOf(null), false);
	// ★ 分类上：历史版本**先还原成当前版名**，跟当前版进**同一类**
	//   （用户口径 2026-10-12："我就是为了在最终产物里看历史版本才改这个的"）
	assert.equal(traceKindOf("联盟讨伐_定稿_20261012_1.md"), "", "历史版本**不是留痕**");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_定稿_20261012_1.md"), "final",
		"定稿的历史版本**进「定稿」那一类**（不是 trace、也不是成稿）");
	assert.equal(outputGroupOf("gdd", "A079-联盟讨伐_20261012_1.xlsx"), "config", "表的旧版进「配置表」");
	assert.equal(outputGroupOf("analysis", "experience-report_x_20260915_20261012_1.md"), "brainstorm");
	assert.equal(outputGroupOf("gdd", "联盟讨伐_宣讲_20260924_20261012_1.html"), "speech", "宣讲稿的旧版跟宣讲稿一类");
	// 还原成当前版名（分类就靠它）
	assert.equal(currentNameOf("联盟讨伐_定稿_20261012_1.md"), "联盟讨伐_定稿.md");
	assert.equal(currentNameOf("x.content_20261012_1.json"), "x.content.json", "多段扩展名原样保留");
	assert.equal(currentNameOf("联盟讨伐_定稿.md"), "联盟讨伐_定稿.md", "不是历史版本就原样返回");
});

test("分类键 → 显示信息只有一处（界面不自己写标签）", () => {
	assert.equal(outputGroupInfo("brainstorm").label, "头脑风暴的产物");
	assert.equal(outputGroupInfo("draft").label, "成稿");
	assert.equal(outputGroupInfo("final").label, "定稿");
	assert.equal(outputGroupInfo("ue").label, "UE 界面稿");
	assert.equal(outputGroupInfo("speech").label, "宣讲稿");
	assert.equal(outputGroupInfo("config").label, "配置表");
	assert.equal(outputGroupInfo("trace").label, "过程留痕", "留痕那一档的措辞也在这份定义里");
	assert.ok(outputGroupInfo("other").label.includes("其它"));
	assert.equal(outputGroupInfo("没这个键").label, "没这个键", "认不出来就原样返回，不编");
});
