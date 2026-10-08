/**
 * 收件箱纯逻辑的**幸存部分**（迁移自 legacy/test-inline-intake.js —— 那份要"从 client.js 里按大括号平衡抽 IIFE"，
 * 现在 `src/pure/intake.ts` 是真模块，直接 import）。
 *
 * ★ 顺便钉住产品契约：素材解析与主题派生是**四入口共用的那一段**，措辞/口径变了就是行为变了。
 *
 * ★ 工单 31（收口）：这里原来还有三条用例 —— 「扩展名判定（isDoc / isTextExt / extOf）」、
 *   「safeName」、「四种输入方式的指令（buildInstruction 逐字）」，以及「INTAKE_KINDS 是四种」。
 *   它们测的是**老收件箱那一组**（`INTAKE_KINDS` + `buildInstruction` 及只被它们引用的
 *   `DOC_EXT` / `TEXT_EXT` / `extOf` / `isDoc` / `isTextExt` / `safeName`）；那一组只服务被砍掉的
 *   「设计资产」屏（设计 §3.4），随本票一起删除 ⇒ 针对已删实现的用例一并删除（不是放宽断言：
 *   幸存实现的行为一条断言都没动）。四入口的指令文本由 `test/pure-brainstorm.test.ts` 逐行钉住。
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

test("路径尾段 → 名字（主题派生的底座）", () => {
	assert.equal(INTAKE.baseName("D:\\a\\b\\c.md"), "c.md");
	assert.equal(INTAKE.baseName("D:/a/b/"), "b");
	assert.equal(INTAKE.baseName(""), "");
});

test("主题派生：从素材文件名去扩展名/日期/尾部噪音", () => {
	assert.equal(INTAKE.deriveTopic([{ kind: "file", path: "D:\\x\\联盟悬赏_20260921_定稿.md" }]), "联盟悬赏");
	// ★ 原断言对 **dir** 素材也期望"去日期/去尾部噪音"，那是错的：实现的这一支是
	//   `if (pick.kind === "dir") return n;` —— 目录名原样返回，不做任何清理
	//   （目录名通常就是**功能主题本身**，清理它反而会改错归档目录）。
	//   `readback_A079_神话宝库_20260916` 这种形态在真实数据里是**目录名**，派生结果就是它自己。
	assert.equal(INTAKE.deriveTopic([{ kind: "dir", path: "D:\\x\\readback_A079_神话宝库_20260916" }]), "readback_A079_神话宝库_20260916");
	// 而同样的名字当**文件**时，才会走清理（去日期前缀/编号/尾部噪音）
	assert.equal(INTAKE.deriveTopic([{ kind: "file", path: "D:\\x\\readback_A079_神话宝库_20260916.md" }]), "readback A079 神话宝库");
	assert.equal(INTAKE.deriveTopic([]), "");
});

test("素材清单的中文可读列表与「有没有路径素材」（四入口共用）", () => {
	assert.equal(INTAKE.describeMaterials([]), "（无）");
	assert.equal(
		INTAKE.describeMaterials([
			{ kind: "dir", path: "D:\\素材\\竞品_联盟" },
			{ kind: "url", path: "https://x.y/z" },
			{ kind: "text", text: "一段话" },
		]),
		"1. 目录：D:\\素材\\竞品_联盟\n2. 链接：https://x.y/z\n3. 文本：一段话",
	);
	assert.equal(INTAKE.hasPathMaterial([{ kind: "text", text: "一段话" }]), false);
	assert.equal(INTAKE.hasPathMaterial([{ kind: "file", path: "D:\\a.md" }]), true);
	assert.equal(INTAKE.hasPathMaterial([{ kind: "url", path: "https://x.y/z" }]), true);
});
