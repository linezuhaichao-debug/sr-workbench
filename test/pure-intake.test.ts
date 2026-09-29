/**
 * 收件箱纯逻辑（迁移自 legacy/test-inline-intake.js —— 那份要"从 client.js 里按大括号平衡抽 IIFE"，
 * 现在 `src/pure/intake.ts` 是真模块，直接 import）。
 *
 * ★ 顺便钉住产品契约：四种输入方式的指令文本是**发给 agent 的上下文**，措辞变了就是行为变了。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { INTAKE } from "../src/pure/intake.ts";

test("素材解析：绝对路径 / 目录 / URL / 纯文本", () => {
	assert.deepEqual(INTAKE.parseMaterial(""), []);
	assert.deepEqual(INTAKE.parseMaterial("  D:\\a\\b\\c.md  "), [{ kind: "file", path: "D:\\a\\b\\c.md" }]);
	assert.deepEqual(INTAKE.parseMaterial("D:\\a\\b\\"), [{ kind: "dir", path: "D:\\a\\b" }]);
	// ★ 原断言写的是 `parseMaterial("E:")` → `{kind:"dir"}`，那是错的：绝对路径的判据是
	//   `isWinAbs` = `/^[A-Za-z]:[\\/]/`（**必须带分隔符**），`"E:"` 光是盘符不算路径 → 归 text。
	//   实现里那条 `/^[A-Za-z]:$/`（裸盘符当目录）只有走完 isWinAbs 才够得着，即输入是 `"E:\\"`（尾分隔符被剥成 `"E:"`）。
	//   这里按真行为断言，并把那条可达形态一起钉住（否则它会变成一段没人走的死代码）。
	assert.deepEqual(INTAKE.parseMaterial("E:"), [{ kind: "text", text: "E:" }]);
	assert.deepEqual(INTAKE.parseMaterial("E:\\"), [{ kind: "dir", path: "E:" }]);
	assert.deepEqual(INTAKE.parseMaterial("https://example.com/x"), [{ kind: "url", path: "https://example.com/x" }]);
	assert.deepEqual(INTAKE.parseMaterial("就是一段话"), [{ kind: "text", text: "就是一段话" }]);
});

test("多行素材：路径/URL 逐行成项，其余并为 text", () => {
	assert.deepEqual(INTAKE.parseMaterials("第一段\nD:\\a\\b.md\nhttps://x.y/z\n第二段\n\n第三段"), [
		{ kind: "text", text: "第一段" },
		{ kind: "file", path: "D:\\a\\b.md" },
		{ kind: "url", path: "https://x.y/z" },
		{ kind: "text", text: "第二段\n\n第三段" },
	]);
});

test("扩展名判定（导入时只复制文档）", () => {
	assert.deepEqual(["a.MD", "a.png", "a.xlsx", "a.docx"].map((n) => INTAKE.isDoc(n)), [true, false, true, true]);
	assert.deepEqual(["a.md", "a.png", "a.json", "a.log"].map((n) => INTAKE.isTextExt(n)), [true, false, true, true]);
	assert.equal(INTAKE.extOf("a.content.json"), "json");
	assert.equal(INTAKE.baseName("D:\\a\\b\\c.md"), "c.md");
});

test("主题派生：从素材文件名去扩展名/日期/尾部噪音", () => {
	assert.equal(INTAKE.deriveTopic([{ kind: "file", path: "D:\\x\\联盟悬赏_20260921_定稿.md" }]), "联盟悬赏");
	// ★ 原断言对 **dir** 素材也期望"去日期/去尾部噪音"，那是错的：实现的这一支是
	//   `if (pick.kind === "dir") return n;` —— 目录名原样返回，不做任何清理
	//   （client.js:132 同款；目录名通常就是**功能主题本身**，清理它反而会改错归档目录）。
	//   `readback_A079_神话宝库_20260916` 这种形态在真实数据里是**目录名**，派生结果就是它自己。
	assert.equal(INTAKE.deriveTopic([{ kind: "dir", path: "D:\\x\\readback_A079_神话宝库_20260916" }]), "readback_A079_神话宝库_20260916");
	// 而同样的名字当**文件**时，才会走清理（去日期前缀/编号/尾部噪音）
	assert.equal(INTAKE.deriveTopic([{ kind: "file", path: "D:\\x\\readback_A079_神话宝库_20260916.md" }]), "readback A079 神话宝库");
	assert.equal(INTAKE.deriveTopic([]), "");
});

test("safeName：去掉非法字符并限长", () => {
	assert.equal(INTAKE.safeName("有 / 非法 : 字符 * 的标题", 60), "有 _ 非法 _ 字符 _ 的标题");
	assert.equal(INTAKE.safeName("a".repeat(80), 60).length, 60);
});

test("四种输入方式的指令：逐字断言（这是发给 agent 的上下文契约）", () => {
	const SR = "D:\\TimeMachine\\GameDesignOS\\workspace";
	const a = INTAKE.buildInstruction("analysis", { materials: [{ kind: "dir", path: "D:\\素材\\竞品_联盟" }], srWs: SR });
	assert.equal(a.blocked, "");
	assert.ok(a.instruction.startsWith("【输入方式 1 · 竞品分析】请执行 `/sr-analysis`"));
	assert.ok(a.instruction.includes("1. 目录：D:\\素材\\竞品_联盟"));
	assert.ok(a.instruction.includes("功能主题（用于产出命名与归档）：竞品_联盟"));

	const c = INTAKE.buildInstruction("concept", { materials: [{ kind: "text", text: "一句话创意" }], note: "备注", title: "联盟悬赏", srWs: "D:\\WS" });
	assert.equal(c.blocked, "");
	assert.ok(c.instruction.includes("【输入方式 2 · 问答式访谈】"));
	// ★ 原断言写的是 `c.instruction.includes("D:\\WS\\inbox")` —— 错的：方式 2「问答式访谈」**不落盘**，
	//   它只是把创意交给 `/sr-concept`（落盘按 sr skill 自己的产出规范做）。
	//   指令里出现收集箱路径的只有方式 3（inbox\imported\）与方式 4（inbox\manual\，下面那串逐字断言钉住了）。
	assert.ok(!c.instruction.includes("inbox"), "方式 2 不该出现收集箱路径：" + c.instruction);
	// 主题来自**创意文本**（title 只对方式 4 有意义）——这是"产出命名与归档"的真口径
	assert.ok(c.instruction.includes("功能主题（用于产出命名与归档）：一句话创意"));
	assert.ok(c.instruction.includes("定位：本项目（文明之跃）新功能/新玩法。"));

	const m = INTAKE.buildInstruction("manual", { note: "正文", title: "标题", upstream: "D:\\up\\a.md", srWs: "D:\\WS" });
	assert.equal(m.blocked, "");
	assert.equal(
		m.instruction,
		"【输入方式 4 · 人工补充】在 D:\\WS\\inbox\\manual\\ 下新建 标题.md，内容如下：\n" +
			"---\ntitle: 标题\nsource: human\nupstream_asset: D:\\up\\a.md\n---\n\n正文\n\n" +
			"然后运行 `python scripts/refresh_asset_index.py` 重新生成索引，并报告新增条目。\n" +
			"注意：不要改动任何 sr skill；只登记为 inbox / needs_review，不提升为正式资产。",
	);

	// 前置条件不满足时**不发出**，而是 blocker
	assert.equal(INTAKE.buildInstruction("manual", { note: "", title: "", srWs: "D:\\WS" }).blocked, "「人工补充」需要一个标题。");
	assert.equal(INTAKE.buildInstruction("manual", { note: "", title: "标题", srWs: "D:\\WS" }).blocked, "「人工补充」需要正文。");
	assert.equal(INTAKE.buildInstruction("unknown", { srWs: "D:\\WS" }).blocked, "未知的输入方式：unknown");
});

test("INTAKE_KINDS 是四种（UI 与测试共用一份口径）", () => {
	assert.deepEqual(
		INTAKE.INTAKE_KINDS.map((k: any) => k.id),
		["analysis", "concept", "import", "manual"],
	);
});
