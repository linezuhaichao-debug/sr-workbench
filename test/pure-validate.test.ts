/**
 * 决策记录契约校验（迁移自 legacy/test-validate.js）。
 * 跑**真实 schema**（`.agents\skills\sr-askme\references\decision.schema.json`）
 * + **真实决策记录**（`features\联盟悬赏\decisions\decision_*.json`）。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateDecision } from "../src/pure/validate.ts";
import { FEATURE_ROOT, SKILLS_ROOT, readText, requireRealData } from "./paths.ts";

requireRealData();
const SCHEMA = path.join(SKILLS_ROOT, "sr-askme", "references", "decision.schema.json");
const schema = JSON.parse(readText(SCHEMA));

test("真实 schema 的形状（校验器读的就是这几个字段）", () => {
	assert.equal(schema.title, "SR Decision Object");
	assert.ok(Array.isArray(schema.required) && schema.required.length > 0);
	assert.ok(Array.isArray(schema.properties.decision_type.enum));
	assert.equal(typeof schema.properties.options.minItems, "number");
	assert.equal(schema.additionalProperties, false);
});

test("真实决策记录：逐条校验结果与实测一致（有的合规模板，有的多出字段）", () => {
	const dir = path.join(FEATURE_ROOT, "decisions");
	const files = fs.readdirSync(dir).filter((f) => /^decision_.*\.json$/i.test(f)).sort().reverse();
	// ★ 原先写死"联盟悬赏应有 4 份真实决策记录"（`files.length === 4`）——那是**真数据快照**：
	//   再走一次真人门就多一份记录，用例会红。要证明的**同一件事**是
	//   「真实决策记录**逐条**都被校验了，且结论与实测一致」，改成三件更有力的：
	//     ① 这 4 份已知基线记录**逐个点名**必须在位（历史记录不许消失；新增记录不打破它）；
	//     ② 磁盘上每一份都产出了结果（一个都不漏）；
	//     ③ 已知那几份的结论**逐份对表**（按名字，不再按位置）。
	const BASELINE = [
		"decision_联盟悬赏_20260918.json",
		"decision_联盟悬赏_20260921.json",
		"decision_联盟悬赏_20260921_定稿.json",
		"decision_联盟悬赏_20260929.json",
	];
	for (const n of BASELINE) assert.ok(files.includes(n), "真实决策记录应在位（历史记录不许消失）：" + n);
	assert.ok(files.length >= BASELINE.length, "真实决策记录至少这 4 份，实际 " + files.length);
	const got: Record<string, number> = {};
	for (const f of files) {
		const doc = JSON.parse(readText(path.join(dir, f)));
		got[f] = validateDecision(doc, schema).length;
	}
	assert.equal(Object.keys(got).length, files.length, "磁盘上每一份都要有校验结果（一个都不漏）");
	assert.deepEqual(
		BASELINE.map((n) => [n, got[n]]),
		[
			["decision_联盟悬赏_20260918.json", 0],
			["decision_联盟悬赏_20260921.json", 2],
			["decision_联盟悬赏_20260921_定稿.json", 3],
			["decision_联盟悬赏_20260929.json", 0],
		],
		"已知那几份的校验结论（不合规项数）与实测一致",
	);
});

test("校验规则：必填 / enum / const / pattern / minItems / 元素 pattern / additionalProperties", () => {
	const s = {
		required: ["decision_type", "title"],
		additionalProperties: false,
		properties: {
			decision_type: { enum: ["concept", "gdd_draft"] },
			title: { pattern: "^[^\\s].*" },
			schema_version: { const: "1.0" },
			options: { minItems: 2, items: { pattern: "^o[0-9]+$" } },
		},
	};
	const issues = validateDecision(
		{ decision_type: "nope", title: " leading", schema_version: "2.0", options: ["bad"], extra: 1 },
		s,
	);
	assert.deepEqual(
		issues.map((i) => i.field).sort(),
		["decision_type", "extra", "options", "options", "schema_version", "title"],
	);
	assert.equal(issues.find((i) => i.field === "options" && i.rule.startsWith("少于下限")).value, "1 条");
	// 缺必填
	assert.deepEqual(
		validateDecision({}, s).filter((i) => i.rule === "必填字段缺失").map((i) => i.field),
		["decision_type", "title"],
	);
	// 没有 schema 就不报（面板退化为"只列结构问题"）
	assert.deepEqual(validateDecision({ a: 1 }, null), []);
});
