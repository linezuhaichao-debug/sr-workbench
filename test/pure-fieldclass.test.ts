/**
 * 工单 17 · 字段归类表 + 字段覆盖检查（悬空即报错）
 *
 * ★ 跑**真实决策记录 / 校准流水 / 交接 JSON**：
 *   `features\联盟悬赏\{decisions,evidence,analysis}\` —— 交付物 17-ledger-field-classification.md
 *   在真实数据上是「79 个不同键 · 悬空 0」，这里把它断言下来。
 * ★ 同时验证"上游新增字段时不会漏掉"：故意加一个未归类字段 ⇒ **error**（不是警告）。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
	FIELD_CLASSES, LEDGER_FIELD_CLASSIFICATION, checkFieldCoverage, classifyField, fieldKeysOf, normalizeFieldKey
} from "../src/pure/fieldclass.ts";
import { FEATURE_ROOT, readText, requireRealData } from "./paths.ts";

requireRealData();

/** 真实源：决策记录 + 校准 jsonl 的每一行 + 交接 JSON（与 loadLedger 读的三处一致） */
function realSources() {
	const out: Array<{ where: string; text: string }> = [];
	const ddir = path.join(FEATURE_ROOT, "decisions");
	for (const n of fs.readdirSync(ddir).filter((x) => /^decision_.*\.json$/i.test(x)).sort()) {
		out.push({ where: "decisions/" + n, text: readText(path.join(ddir, n)) });
	}
	const edir = path.join(FEATURE_ROOT, "evidence");
	for (const n of fs.readdirSync(edir).filter((x) => /^calibration_.*\.jsonl$/i.test(x)).sort()) {
		for (const line of readText(path.join(edir, n)).split(/\r?\n/)) {
			if (line.trim()) out.push({ where: "evidence/" + n, text: line });
		}
	}
	const adir = path.join(FEATURE_ROOT, "analysis");
	for (const n of fs.readdirSync(adir).filter((x) => /^sr-gdd-handoff_.*\.json$/i.test(x)).sort()) {
		out.push({ where: "analysis/" + n, text: readText(path.join(adir, n)) });
	}
	return out;
}

test("归类表本身：每行都归类为六值之一，容器不给 take，全表 85 行（含代码在读但本功能没有的键）", () => {
	const rows = Object.keys(LEDGER_FIELD_CLASSIFICATION);
	assert.equal(rows.length, 85);
	for (const k of rows) {
		const r = LEDGER_FIELD_CLASSIFICATION[k];
		assert.ok(FIELD_CLASSES.includes(r.klass), k + " 的归类非法：" + r.klass);
		assert.ok(typeof r.why === "string" && r.why.length >= 2, k + " 缺「为什么这么归」");
		assert.ok(typeof r.take === "string", k + " 缺「台账里取哪个字段」");
		if (r.klass === "container") assert.equal(r.take, "—", "容器只负责递归，不取字段：" + k);
	}
	const dist: Record<string, number> = {};
	for (const k of rows) dist[LEDGER_FIELD_CLASSIFICATION[k].klass] = (dist[LEDGER_FIELD_CLASSIFICATION[k].klass] || 0) + 1;
	assert.deepEqual(dist, { container: 6, collect: 34, exclude_agent: 19, exclude_meta: 22, exclude_proposal: 4 });
});

test("查表规则：精确 → 数组元素通配 → 父级通配；未归类返回 null（不是默认收）", () => {
	assert.equal(classifyField("title").klass, "collect");
	assert.equal(classifyField("decision_result.calibrations").klass, "collect");
	assert.equal(classifyField("options[].action").klass, "exclude_proposal");
	assert.equal(classifyField("options[] . action").klass, "exclude_proposal", "交付物表格里的排版空格要能吃掉");
	assert.equal(classifyField("decision_result.settled_choices.T3").klass, "collect", "父级通配：逐条拍板选择");
	assert.equal(classifyField("decision_result.changes").klass, "exclude_agent");
	assert.equal(classifyField("brand_new_field"), null);
	assert.equal(classifyField(""), null);
	assert.equal(normalizeFieldKey("options[].  action"), "options[].action");
});

test("真实数据：79 个不同键 / 211 个键实例，悬空 0、待判定 0", () => {
	const cov = checkFieldCoverage({ sources: realSources() });
	assert.equal(cov.distinct, 79);
	assert.equal(cov.checked, 211);
	assert.deepEqual(cov.dangling, []);
	assert.deepEqual(cov.pending, []);
	assert.equal(cov.ok, true);
	assert.deepEqual(cov.issues, []);
	// 79 个不同键逐个查表后的归类分布（与交付物 17-classification 的统计一致：29+5+22+19+4 = 79）
	const dist: Record<string, number> = {};
	for (const k of cov.keys) {
		const r = classifyField(k);
		assert.ok(r, k + " 应已归类");
		dist[r.klass] = (dist[r.klass] || 0) + 1;
	}
	assert.deepEqual(dist, { collect: 29, container: 5, exclude_agent: 19, exclude_meta: 22, exclude_proposal: 4 });
	assert.equal(Object.values(dist).reduce((a, b) => a + b, 0), 79);
	// 三个"陷阱键"必须在表里且归类明确（同名不同义那几组，见 17-ledger-field-inventory.md §⑤）
	assert.ok(cov.keys.includes("next_step") && cov.keys.includes("decision_result.next_step"));
	assert.equal(classifyField("decision_result.chosen").klass, "collect");
	assert.equal(classifyField("chosen_nucleus").klass, "container");
	assert.ok(cov.keys.includes("options[].expected_benefit"), "候选的预期收益要如实出现并被归为「不收」");
});

test("悬空即报错：真实记录里人为加一个未归类字段 ⇒ error（不是警告）", () => {
	const sources = realSources();
	const decision = sources.find((s) => s.where.includes("decision_联盟悬赏_20260929")) as { where: string; text: string };
	const doc = JSON.parse(decision.text);
	doc.decision_result.brand_new_field = "上游新加的一类决定";     // ← 故意的：表里没有它
	doc.gate_owner = "ZuHaiChao";                                   // ← 顶层也来一个
	const cov = checkFieldCoverage({ sources: [{ where: decision.where, doc: doc }].concat(sources.filter((s) => s !== decision)) });
	assert.equal(cov.ok, false);
	assert.deepEqual(cov.dangling.map((d) => d.key).sort(), ["decision_result.brand_new_field", "gate_owner"]);
	assert.equal(cov.issues.length, 2);
	for (const it of cov.issues) {
		assert.equal(it.code, "V17");
		assert.equal(it.level, "error", "悬空是 error —— 上游新增字段时必须在表里补一行");
		assert.ok(it.msg.includes("未归类"));
		assert.ok(it.msg.includes("fieldclass.ts"), "报错要指出该去哪儿补");
	}
	assert.ok(cov.issues.some((i) => i.files[0] === decision.where));
	// 撤掉那个字段 → 立刻恢复干净（说明红的不是数据本身，是"未归类"这件事）
	delete doc.decision_result.brand_new_field;
	delete doc.gate_owner;
	assert.equal(checkFieldCoverage({ sources: [{ where: decision.where, doc: doc }] }).ok, true);
});

test("pending_user 与「表里没有」同样报错（视同尚未归类）", () => {
	const src = { where: "decisions/临时.json", doc: { title: "x", 待定字段: "y" } };
	LEDGER_FIELD_CLASSIFICATION["待定字段"] = { klass: "pending_user", why: "临时：待用户判定", take: "—" };
	try {
		const cov = checkFieldCoverage({ sources: [src] });
		assert.equal(cov.ok, false);
		assert.deepEqual(cov.dangling, []);
		assert.deepEqual(cov.pending.map((p) => p.key), ["待定字段"]);
		assert.equal(cov.issues[0].level, "error");
	} finally {
		delete LEDGER_FIELD_CLASSIFICATION["待定字段"];
	}
	assert.equal(checkFieldCoverage({ sources: [src] }).ok, false, "删掉临时归类后又变回悬空");
});

test("覆盖深度是**声明的**（顶层键 + 一级子键 + 顶层数组元素键）：再往下不算，别偷偷改深", () => {
	const decision = JSON.parse(readText(path.join(FEATURE_ROOT, "decisions", "decision_联盟悬赏_20260929.json")));
	const keys = fieldKeysOf(decision);
	assert.ok(keys.includes("decision_result"));
	assert.ok(keys.includes("decision_result.changes"), "一级子键");
	assert.ok(keys.includes("options[].option_id"), "顶层数组的元素键");
	// 已知盲区：嵌套数组（calibrations / changes）的**元素键**本轮不检查
	assert.equal(keys.includes("decision_result.calibrations[].round"), false);
	assert.equal(classifyField("decision_result.calibrations[].round"), null);
	// 该记录里所有被检查的键都必须已归类（这就是"悬空 0"的直接证据）
	const bad = keys.filter((k) => !classifyField(k));
	assert.deepEqual(bad, []);
	// 非对象输入不炸
	assert.deepEqual(fieldKeysOf(null), []);
	assert.deepEqual(fieldKeysOf("字符串"), []);
	assert.deepEqual(fieldKeysOf([1, 2]), []);
	assert.deepEqual(fieldKeysOf({ a: [1, 2], b: null }), ["a", "b"]);
});
