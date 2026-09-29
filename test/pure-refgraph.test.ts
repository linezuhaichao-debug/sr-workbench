/**
 * 引用图与影响范围（迁移自 legacy/test-refgraph.js）。
 * 跑真实定稿：词表 / 边数 / 逐条命中位置的行号都要能被人工回查。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { parseFinalGdd } from "../src/pure/finalgdd.ts";
import { buildRefGraph, impactOf } from "../src/pure/refgraph.ts";
import { FINAL_GDD, readText, requireRealData } from "./paths.ts";

requireRealData();
const text = readText(FINAL_GDD);
const doc = parseFinalGdd(text);
const graph = buildRefGraph(doc);
const srcLines = text.split(/\r?\n/);

test("真实定稿的引用图规模（词表 ≈ §7键43 + UE27 + AC15 + R10 + UI-M4）", () => {
	assert.ok(graph.vocabSize >= 90, "词表 ≥ 90，实际 " + graph.vocabSize);
	assert.ok(graph.edgeCount > 150, "边数 > 150，实际 " + graph.edgeCount);
});

test("显式引用：AC1 的定义处与两处提到它的位置（真实行号）", () => {
	const e = graph.byRef.get("§10 AC1");
	assert.ok(e, "应有 §10 AC1 这个可引用实体");
	assert.equal(e.kind, "ac");
	assert.deepEqual(
		e.hits.map((h) => h.line),
		[456, 487],
	);
	assert.ok(srcLines[456 - 1].includes("| AC1 |"), "第 456 行应是 AC1 定义行");
	assert.ok(srcLines[487 - 1].includes("AC1–AC15"), "第 487 行应是 §11 提到 AC1–AC15 的那条");
});

test("界面归属：UI-M1 的 UE 条目都可被引用，且影响范围去掉自身", () => {
	const e = graph.byRef.get("§5 UI-M1 UE1");
	assert.ok(e, "应有 §5 UI-M1 UE1");
	assert.ok(e.hits.length >= 1);
	const self = e.hits[0].line;
	assert.ok(/UE1\b/.test(srcLines[self - 1]), "第 " + self + " 行应含 UE1");
	const others = impactOf(graph, "§5 UI-M1 UE1", self);
	assert.equal(others.some((h) => h.line === self), false, "影响范围里不该有自己那一行");
});

test("编号同族边：UE2 ↔ UE2a 互为同族（kind = family）", () => {
	const e = graph.byRef.get("§5 UI-M1 UE2");
	assert.ok(e);
	const fam = e.hits.filter((h) => h.kind === "family");
	assert.ok(fam.length >= 1, "UE2 应有一条同族边指向 UE2a");
	assert.ok(fam.every((h) => /UE2a/.test(h.where)), "同族边应指向 UE2a：" + JSON.stringify(fam));
});

test("impactOf 的边界：未知引用 / 空图返回空数组", () => {
	assert.deepEqual(impactOf(graph, "§99 不存在", null), []);
	assert.deepEqual(impactOf(null, "§10 AC1", null), []);
	assert.deepEqual(buildRefGraph(null).byRef.size, 0);
	assert.equal(buildRefGraph({}).vocabSize, 0);
});
