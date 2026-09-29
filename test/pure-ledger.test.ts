/**
 * 设计台账派生（迁移自 legacy/test-ledger.js）。
 * 跑真实数据：4 份决策记录 + 2 份校准 jsonl + 1 份交接 JSON，来自
 * `features\联盟悬赏\{decisions,evidence,analysis}\`。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildLedger, ledgerOf, stageOfDecision, stageOfGate } from "../src/pure/ledger.ts";
import { FEATURE_ROOT, readText, requireRealData } from "./paths.ts";

requireRealData();

/** 与 loadLedger 同构地收真实数据（这里直读 fs，避免依赖加载层） */
function collect() {
	const decisions: { name: string; text: string; doc: any }[] = [];
	const ddir = path.join(FEATURE_ROOT, "decisions");
	for (const n of fs.readdirSync(ddir).filter((x) => /^decision_.*\.json$/i.test(x)).sort().reverse()) {
		const text = readText(path.join(ddir, n));
		let doc = null;
		try {
			doc = JSON.parse(text);
		} catch (e) {
			doc = null;
		}
		decisions.push({ name: n, text, doc });
	}
	const calibrations: { name: string; text: string; rows: any[] }[] = [];
	const edir = path.join(FEATURE_ROOT, "evidence");
	for (const n of fs.readdirSync(edir).filter((x) => /^calibration_.*\.jsonl$/i.test(x))) {
		const text = readText(path.join(edir, n));
		const rows: any[] = [];
		for (const line of text.split(/\r?\n/)) {
			const s = line.trim();
			if (!s) continue;
			try {
				rows.push(JSON.parse(s));
			} catch (e) {
				/* 跳过坏行 */
			}
		}
		calibrations.push({ name: n, text, rows });
	}
	const handoffs: { name: string; text: string }[] = [];
	const adir = path.join(FEATURE_ROOT, "analysis");
	for (const n of fs.readdirSync(adir).filter((x) => /^sr-gdd-handoff_.*\.json$/i.test(x))) {
		handoffs.push({ name: n, text: readText(path.join(adir, n)) });
	}
	return { decisions, calibrations, handoffs };
}

const data = collect();

test("真实数据：台账按三阶段派生，条目总数与阶段分布可核对", () => {
	const led = buildLedger({
		decisions: data.decisions.map((d) => ({ name: d.name, doc: d.doc })),
		calibrations: data.calibrations.map((c) => ({ name: c.name, rows: c.rows })),
		handoffs: data.handoffs,
	});
	assert.deepEqual(led.stages.map((s) => s.name), ["阶段一 · 头脑风暴", "阶段二 · 文档生成", "阶段三 · 定稿修订"]);
	assert.deepEqual(led.stages.map((s) => s.count), [19, 14, 1]);
	assert.equal(led.total, 34);
	// 来源校验：两个源都不能少（决策汇总 + 校准流水补录）
	assert.equal(led.stats.fromDecision + led.stats.fromJsonl, led.total);
	assert.ok(led.stats.fromJsonl >= 1, "校准 jsonl 应补上决策记录漏汇总的轮次");
});

test("真实台账内容：来自交接 JSON 的设计核与已确认口径（原句进台账，不加前缀）", () => {
	const led = buildLedger({ handoffs: data.handoffs });
	assert.equal(led.stages[0].count >= 6, true, "交接 JSON 应贡献头脑风暴期条目，实际 " + led.stages[0].count);
	const flat = led.stages.flatMap((s) => s.days.flatMap((d) => d.items));
	const nucleus = flat.find((i) => i.text.startsWith("设计核："));
	assert.ok(nucleus, "应有「设计核：…」条目");
	assert.ok(nucleus.text.includes("出刀时机经济学"), "真实设计核原句应进台账：" + nucleus.text);
	assert.equal(nucleus.date, "20260918");
	assert.ok(flat.some((i) => i.text.includes("每周循环")), "应含活动周期这条已确认口径");
});

test("校准流水补录的轮次：同 round 以决策汇总为准（不重复计）", () => {
	const fromDoc = buildLedger({ calibrations: data.calibrations.map((c) => ({ name: c.name, rows: c.rows })) });
	const fromText = buildLedger({ calibrations: data.calibrations.map((c) => ({ name: c.name, text: c.text })) });
	const a = fromDoc.stages.flatMap((s) => s.days.flatMap((d) => d.items));
	const b = fromText.stages.flatMap((s) => s.days.flatMap((d) => d.items));
	assert.ok(a.length > 0, "校准 jsonl 应产出条目");
	// rows（已 parse）与 text（原文）两条路径结果必须一致
	assert.deepEqual(a, b);
	const rounds = a.map((i) => i.round);
	assert.equal(new Set(rounds).size, rounds.length, "同一 round 不应重复进台账");
});

test("阶段判定：门名与 decision_type 都按真实取值归阶段", () => {
	assert.equal(stageOfGate("设计核交接门"), 1);
	assert.equal(stageOfGate("gdd-fix 修订门"), 3);
	assert.equal(stageOfGate("成稿门"), 2);
	assert.equal(stageOfGate(""), 2);
	// sr-analysis 的两道门（validation / scope_gate）归阶段一 —— 实测原实现错归阶段二
	assert.equal(stageOfDecision("validation"), 1);
	assert.equal(stageOfDecision("scope_gate"), 1);
	assert.equal(stageOfDecision("gdd_draft"), 2);
});

test("ledgerOf：从 loadLedger 的产物派生（含 error / null 降级）", () => {
	const L = {
		records: data.decisions.map((d) => ({ file: d.name, doc: d.doc })),
		calibration: data.calibrations.flatMap((c) => c.rows.map((r) => ({ file: c.name, row: r }))),
		handoffs: data.handoffs,
	};
	const led = ledgerOf(L);
	assert.equal(led.total, 34);
	assert.equal(ledgerOf(null), null);
	assert.deepEqual(ledgerOf({ records: [], error: "读台账失败：x" }).stages, []);
	assert.equal(ledgerOf({ records: [], error: "读台账失败：x" }).error, "读台账失败：x");
});
