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

// ── 工单 17：字段覆盖检查（悬空即报错）接在派生结果上 ──────────────────────
test("真实数据：覆盖检查随台账一起派生 —— 79 个键全已归类，悬空 0，notes 里没有未归类告警", () => {
	const led = buildLedger({
		decisions: data.decisions.map((d) => ({ name: d.name, doc: d.doc })),
		calibrations: data.calibrations.map((c) => ({ name: c.name, rows: c.rows })),
		handoffs: data.handoffs,
	});
	assert.equal(led.fieldCheck.distinct, 79);
	assert.deepEqual(led.fieldCheck.dangling, []);
	assert.equal(led.fieldCheck.ok, true);
	assert.deepEqual(led.fieldCheck.issues, []);
	assert.deepEqual(led.notes, []);
	// 同一条路径（ledgerOf）也要带上覆盖结论
	const led2 = ledgerOf({
		records: data.decisions.map((d) => ({ file: d.name, doc: d.doc })),
		calibration: data.calibrations.flatMap((c) => c.rows.map((r) => ({ file: c.name, row: r }))),
		handoffs: data.handoffs,
	});
	assert.equal(led2.fieldCheck.distinct, 79);
	assert.equal(led2.fieldCheck.ok, true);
});

test("上游新增未归类字段：台账不静默吞掉它 —— fieldCheck 报 error 且 notes 里点出是哪个键", () => {
	const d0 = JSON.parse(JSON.stringify(data.decisions[0].doc));
	d0.decision_result.brand_new_field = "上游新加的一类决定";
	const led = buildLedger({ decisions: [{ name: data.decisions[0].name, doc: d0 }] });
	assert.equal(led.fieldCheck.ok, false);
	assert.equal(led.fieldCheck.issues[0].level, "error");
	assert.deepEqual(led.fieldCheck.dangling.map((x) => x.key), ["decision_result.brand_new_field"]);
	assert.ok(led.notes.some((n) => n.includes("未归类字段") && n.includes("decision_result.brand_new_field")));
	// 台账条目本身照常派生（检查是**附加结论**，不改变叙述内容）
	assert.ok(led.total > 0);
});

// ── 工单 17：去重按轮次 · 汇总优先 · 流水补漏 ─────────────────────────────
test("真实数据：汇总（decision）已含 round 12–17、19，jsonl 只补它漏掉的 round 18", () => {
	const led = buildLedger({
		decisions: data.decisions.map((d) => ({ name: d.name, doc: d.doc })),
		calibrations: data.calibrations.map((c) => ({ name: c.name, rows: c.rows })),
		handoffs: data.handoffs,
	});
	assert.equal(led.stats.fromJsonl, 1, "真实数据上流水**确实**补了 1 条（round 18 只在 jsonl 里）");
	const flat = led.stages.flatMap((s) => s.days.flatMap((d) => d.items));
	const r18 = flat.filter((i) => i.round === 18);
	assert.equal(r18.length, 1);
	assert.ok(r18[0].text.includes("UI 提示文本改回"), "补录的是 jsonl 里的用户原话：" + r18[0].text);
	// 汇总里已有的轮次不许被流水覆盖成两份
	const r12 = flat.filter((i) => i.round === 12);
	assert.equal(r12.length, 1);
	assert.ok(r12[0].text.includes("奖励结构改动"), "同 round 以汇总为准");
});

test("人为构造「汇总漏了某轮」：从 decision 里删掉 round 15 → jsonl 把它原句补进台账", () => {
	// ① 造一份"汇总漏了第 15 轮"的决策记录（其余逐字来自真实记录）
	const doc = JSON.parse(JSON.stringify(data.decisions.find((d) => d.name === "decision_联盟悬赏_20260921.json").doc));
	const before = doc.decision_result.calibrations.map((c) => c.round);
	assert.ok(before.includes(15), "真实汇总里本来有第 15 轮：" + before.join(","));
	doc.decision_result.calibrations = doc.decision_result.calibrations.filter((c) => c.round !== 15);
	assert.equal(doc.decision_result.calibrations.some((c) => c.round === 15), false);

	// ② 只喂这一份 decision + 真实校准流水
	const led = buildLedger({
		decisions: [{ name: "decision_联盟悬赏_20260921.json", doc: doc }],
		calibrations: data.calibrations.map((c) => ({ name: c.name, rows: c.rows })),
	});
	const flat = led.stages.flatMap((s) => s.days.flatMap((d) => d.items));
	const r15 = flat.filter((i) => i.round === 15);
	assert.equal(r15.length, 1, "被汇总漏掉的那一轮必须由流水补上，且只有一条");
	assert.ok(r15[0].text.includes("剩余次数移到出刀按钮上方"), "补录用的是 jsonl 里的原句：" + r15[0].text);
	assert.equal(r15[0].src, "calibration_联盟悬赏_20260921_定稿_归档.jsonl");
	// 汇总漏了两轮（人为删掉的 15 + 本来就漏的 18）→ 流水补两条，其余一概不重复
	assert.equal(led.stats.fromJsonl, 2);
	// ③ 没被漏掉的轮次仍然只出现一次（流水不重复录入）
	const roundsAll = flat.filter((i) => i.round !== undefined).map((i) => i.round);
	assert.equal(new Set(roundsAll).size, roundsAll.length, "同一 round 不得重复进台账");
	assert.equal(roundsAll.includes(18), true, "别的漏轮（18）也仍然补得进来");
	// ④ 补漏的那一条按它自己的 gate 归阶段（成稿门 → 阶段二）
	assert.equal(r15[0].stage, 2);
});
