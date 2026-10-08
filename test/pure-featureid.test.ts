/**
 * 功能身份声明（`feature.json`）—— 形状、解析、`feature_id` 生成规则。
 *
 * 权威：`spec.md:131-137`（只放身份不放进度）· `ADR 0002`（id 终身不变、目录名只是标签）。
 * 这里钉的是**本票定的 id 规则**与**优雅退化**（真实数据 4 个功能现在都没有身份声明）。
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
	FEATURE_ID_RE,
	compactDate,
	dashedDate,
	featureIdNote,
	featureIdOf,
	identityClash,
	identityJsonText,
	identityLabel,
	identityOf,
	nameKey,
	namesOf,
	nextFeatureId,
	parseIdentity,
	parseIdentityValue
} from "../src/pure/featureid.ts";

test("id 形状：feat-<yyyymmdd>-<序号>，序号不足 3 位左补 0", () => {
	assert.ok(FEATURE_ID_RE.test("feat-20261008-001"));
	assert.ok(FEATURE_ID_RE.test("feat-20261008-1000"), "超过 999 自动变 4 位");
	assert.ok(!FEATURE_ID_RE.test("20261008-001"), "缺前缀不算");
	assert.ok(!FEATURE_ID_RE.test("feat-2026108-001"), "日期必须 8 位");
	assert.ok(!FEATURE_ID_RE.test("feat-20261008-01"), "序号至少 3 位");
	assert.ok(!FEATURE_ID_RE.test("feat-20261008-001-1"), "多一段不算");
	assert.equal(featureIdOf("20261008", 1), "feat-20261008-001");
	assert.equal(featureIdOf("20261008", 12), "feat-20261008-012");
	assert.equal(featureIdOf("20261008", 123), "feat-20261008-123");
	assert.equal(featureIdOf("20261008", 1234), "feat-20261008-1234");
	// ASCII + 不含主题名（**与目录名解耦**：改名不会让 id 过期）
	assert.ok(/^[a-z0-9-]+$/.test(featureIdOf("20261008", 7)));
	assert.equal(identityJsonText("feat-20261008-001", "诸神降临", "2026-10-08").indexOf("诸神降临") >= 0, true,
		"主题名只进 name，不进 id");
});

test("日期写法：id 用 YYYYMMDD（本地日期），created 用 YYYY-MM-DD", () => {
	const d = new Date(2026, 9, 8, 23, 30, 0);   // 本地时间 2026-10-08 23:30
	assert.equal(compactDate(d), "20261008");
	assert.equal(dashedDate(d), "2026-10-08");
});

test("冲突处理：同一天取最大序号 +1；别的日期段互不干扰；撞号顺延", () => {
	assert.equal(nextFeatureId([], "20261008"), "feat-20261008-001");
	assert.equal(nextFeatureId(["feat-20261008-001"], "20261008"), "feat-20261008-002");
	assert.equal(nextFeatureId(["feat-20261008-001", "feat-20261008-007"], "20261008"), "feat-20261008-008");
	assert.equal(nextFeatureId(["feat-20261007-009"], "20261008"), "feat-20261008-001", "别的日期段的号不算数");
	// 撞号：008 已被占（例如迁移带进来的），顺延到 009
	assert.equal(nextFeatureId(["feat-20261008-007", "feat-20261008-008"], "20261008"), "feat-20261008-009");
	// 大小写/空白都不算新号（Windows 目录名与 id 都不敏感大小写）
	assert.equal(nextFeatureId(["FEAT-20261008-003 "], "20261008"), "feat-20261008-004");
	// 脏数据不影响判断
	assert.equal(nextFeatureId([null, "", "x-1", undefined], "20261008"), "feat-20261008-001");
});

test("身份声明：逐字文本是 6 行 JSON（缩进 2 空格 + 末尾换行），键名与 spec 一致", () => {
	const t = identityJsonText("feat-20261008-001", "联盟讨伐", "2026-10-08");
	assert.equal(t,
		"{\n" +
		"  \"feature_id\": \"feat-20261008-001\",\n" +
		"  \"name\": \"联盟讨伐\",\n" +
		"  \"aliases\": [],\n" +
		"  \"created\": \"2026-10-08\"\n" +
		"}\n");
	assert.deepEqual(Object.keys(parseIdentity(t)), ["feature_id", "name", "aliases", "created"]);
	// 别名（改名是正常业务：神话宝库 → 诸神降临）
	const merged = identityJsonText("feat-20260930-002", "诸神降临", "2026-09-30", ["神话宝库"]);
	assert.deepEqual(parseIdentity(merged).aliases, ["神话宝库"]);
});

test("解析：坏输入一律 null（不猜、不补）", () => {
	assert.equal(parseIdentity(null), null);
	assert.equal(parseIdentity(""), null);
	assert.equal(parseIdentity("{"), null, "半截 JSON");
	assert.equal(parseIdentity('{"feature_id":"x"}'), null, "缺 name");
	assert.equal(parseIdentity('{"name":"x"}'), null, "缺 feature_id");
	assert.equal(parseIdentityValue({ feature_id: "  ", name: "x" }), null, "空白 id 不算");
	assert.equal(parseIdentityValue(null), null);
	// BOM 要吃得下（Windows 上很常见）
	assert.equal(parseIdentity("\uFEFF" + identityJsonText("feat-20261008-001", "甲", "2026-10-08")).name, "甲");
});

test("★ 优雅退化：没有 feature.json 的目录按目录名认功能，并如实标注（不假装有 id、不报错）", () => {
	const v = identityOf(null, "英雄圣物");
	assert.equal(v.present, false);
	assert.equal(v.reason, "missing");
	assert.equal(v.name, "英雄圣物", "按目录名认功能");
	assert.equal(v.feature_id, "", "**不编**一个 id");
	assert.equal(v.note, "没有身份声明（按目录名认功能）");
	assert.equal(identityLabel(v), "没有身份声明（按目录名认功能）");

	const broken = identityOf("{ 这不是 json", "英雄圣物");
	assert.equal(broken.present, false);
	assert.equal(broken.reason, "unreadable");
	assert.match(broken.note, /按目录名认功能/);

	const badId = identityOf('{"feature_id":"英雄圣物-1","name":"英雄圣物","aliases":[]}', "英雄圣物");
	assert.equal(badId.present, false);
	assert.equal(badId.reason, "bad-id");
	assert.match(badId.note, /形状不对/);

	const ok = identityOf(identityJsonText("feat-20261008-001", "诸神降临", "2026-10-08", ["神话宝库"]), "神话宝库");
	assert.equal(ok.present, true);
	assert.equal(identityLabel(ok), "身份 feat-20261008-001");
	assert.deepEqual(namesOf(ok), ["诸神降临", "神话宝库"]);
});

test("「已存在同标识」：名字或别名撞上就是同一个身份（大小写不敏感）", () => {
	const holders = [
		{ topic: "神话宝库", identity: identityOf(identityJsonText("feat-20260930-002", "诸神降临", "2026-09-30", ["神话宝库"]), "神话宝库") },
		{ topic: "英雄圣物", identity: identityOf(null, "英雄圣物") }
	];
	assert.equal(identityClash(holders, "诸神降临").topic, "神话宝库", "身份名撞上");
	assert.equal(identityClash(holders, "神话宝库").topic, "神话宝库", "别名撞上（旧名也能找到这个功能）");
	assert.equal(identityClash(holders, " 诸神降临 ").topic, "神话宝库", "首尾空白不算差别");
	assert.equal(identityClash(holders, "英雄圣物"), null, "**没有身份声明的功能不参与**（不假装它有身份）");
	assert.equal(identityClash(holders, "新功能"), null);
	assert.equal(nameKey("  AbC "), "abc");
});

test("id 规则那句话（表单上预览的就是它）", () => {
	assert.match(featureIdNote("feat-20261008-001"), /feat-20261008-001/);
	assert.match(featureIdNote("feat-20261008-001"), /终身不变/);
});
