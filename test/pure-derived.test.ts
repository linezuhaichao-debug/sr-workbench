/**
 * 工单 28 · 派生物与过期检测（纯函数层）的回归网。
 *
 * 钉住四件事：
 *   ① 命名与分类（产物名 / 侧车名 / 交付桶里哪个文件是哪一类）；
 *   ② 侧车解析（缺失 / 空文件 / 坏 JSON / 不是对象 / 字段缺 —— 每种都要说得出原因）；
 *   ③ **过期判定**：指纹一致 = 最新、不一致 = 过期、基于另一份 = 过期、
 *      侧车缺 / 没记指纹 / 当前定稿没有 / 当前指纹拿不到 = **看不到依据**（绝不显示成"最新"）；
 *   ④ 指令组装：与 skill 口径一致（宣讲 → sr-gdd-html；AI 读版 → plan-doc-ai-version）、
 *      侧车 JSON 逐字嵌进去、缺前提时**不给指令**而给 blocked + next。
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	DERIVED_KINDS,
	DERIVED_PROVENANCE_SCHEMA,
	artifactNameOf,
	buildDerivedInstruction,
	derivedRows,
	judgeArtifact,
	kindOfDeliveryFile,
	parseProvenance,
	sidecarNameOf,
	shortVersion,
	stampText
} from "../src/pure/derived.ts";

/** 真实形状的版本串（`dev:ino:size:mtimeNs:ctimeNs`，第 4 段 = mtime 纳秒） */
const V1 = "1:2345:40935:1759300000000000000:1759300000000000000";
const V2 = "1:2345:40936:1759400000000000000:1759400000000000000";

function provText(over) {
	return JSON.stringify(Object.assign({
		schema: DERIVED_PROVENANCE_SCHEMA,
		kind: "speech",
		artifact: "讨伐_宣讲_20261008.html",
		tool: "sr-gdd-html",
		basedOn: "联盟悬赏_20260923_定稿.md",
		basedOnPath: "D:\\ws\\features\\讨伐\\gdd\\联盟悬赏_20260923_定稿.md",
		basedOnVersion: V1,
		generatedAt: "2026-10-08T15:00+08:00"
	}, over || {}), null, 2);
}

// ── ① 命名与分类 ─────────────────────────────────────────────────────────
test("derived: 产物名与侧车名（宣讲 / AI 读版）", () => {
	assert.equal(artifactNameOf("speech", "讨伐", "20261008"), "讨伐_宣讲_20261008.html");
	assert.equal(artifactNameOf("aiv", "讨伐", "20261008"), "正式AI读版_讨伐_20261008.md");
	assert.equal(artifactNameOf("speech", "讨伐", "2026-10-08"), "讨伐_宣讲_20261008.html", "带横线的日期也认");
	assert.equal(artifactNameOf("speech", "", ""), "<主题>_宣讲_<YYYYMMDD>.html", "缺字段给占位，不拼半个名字");
	assert.equal(artifactNameOf("nope", "讨伐", "20261008"), "");
	assert.equal(sidecarNameOf("讨伐_宣讲_20261008.html"), "讨伐_宣讲_20261008.provenance.json");
	assert.equal(sidecarNameOf("正式AI读版_讨伐_20261008.md"), "正式AI读版_讨伐_20261008.provenance.json");
	assert.equal(sidecarNameOf(""), "");
});

test("derived: 交付桶里的文件分类（真实文件名逐个过）", () => {
	assert.equal(kindOfDeliveryFile("联盟悬赏_宣讲_20260923.html"), "speech");
	assert.equal(kindOfDeliveryFile("联盟悬赏_宣讲_20260923.content.json"), "speechSrc");
	assert.equal(kindOfDeliveryFile("英雄圣物_宣讲_20260923_UIUE.html"), "speech");
	assert.equal(kindOfDeliveryFile("正式AI读版_联盟悬赏_v1.1.md"), "aiv");
	assert.equal(kindOfDeliveryFile("AI读版策划案_联盟悬赏_正式版.md"), "aiv");
	assert.equal(kindOfDeliveryFile("讨伐_宣讲_20261008.provenance.json"), "sidecar");
	assert.equal(kindOfDeliveryFile("历史归档说明_联盟悬赏.md"), "other");
	assert.equal(kindOfDeliveryFile("联盟悬赏_20260923_定稿.html"), "other", "定稿 HTML 属于 gdd\\，不在交付桶口径里");
	assert.equal(kindOfDeliveryFile(""), "other");
});

// ── ② 侧车解析 ───────────────────────────────────────────────────────────
test("derived: 侧车解析的六种情形（读不到 / 空 / 坏 / 不是对象 —— 分开说）", () => {
	const miss = parseProvenance(null);
	assert.equal(miss.ok, false);
	assert.match(miss.why, /侧车读不到/);

	const empty = parseProvenance("   ");
	assert.equal(empty.ok, false);
	assert.match(empty.why, /空文件/);

	const bad = parseProvenance("{ not json");
	assert.equal(bad.ok, false);
	assert.match(bad.why, /不是合法 JSON/);

	const arr = parseProvenance("[1,2]");
	assert.equal(arr.ok, false);
	assert.match(arr.why, /不是 JSON 对象/);

	const good = parseProvenance(provText());
	assert.equal(good.ok, true);
	assert.equal(good.data.basedOn, "联盟悬赏_20260923_定稿.md");
	assert.equal(good.data.basedOnVersion, V1);
	assert.equal(good.data.generatedAt, "2026-10-08T15:00+08:00");

	const noVer = parseProvenance(provText({ basedOnVersion: "" }));
	assert.equal(noVer.ok, true);
	assert.equal(noVer.data.basedOnVersion, "", "字段缺了也要如实读成空串（判定时再降级）");
});

// ── ③ 过期判定 ───────────────────────────────────────────────────────────
test("derived: 指纹一致 = 已是最新；不一致 = 已过期（定稿改过）", () => {
	const fin = { name: "联盟悬赏_20260923_定稿.md", path: "D:\\ws\\gdd\\联盟悬赏_20260923_定稿.md", version: V1, from: "active" };
	const fresh = judgeArtifact({ final: fin, prov: parseProvenance(provText()), artifact: "讨伐_宣讲_20261008.html" });
	assert.equal(fresh.state, "fresh");
	assert.match(fresh.text, /已是最新/);
	assert.match(fresh.text, /联盟悬赏_20260923_定稿\.md/);

	const stale = judgeArtifact({ final: Object.assign({}, fin, { version: V2 }), prov: parseProvenance(provText()), artifact: "讨伐_宣讲_20261008.html" });
	assert.equal(stale.state, "stale");
	assert.match(stale.text, /已过期 —— 定稿改过/);
	assert.equal(stale.recorded, V1);
	assert.equal(stale.current, V2);
});

test("derived: 基于的是**另一份**定稿 ⇒ 已过期（不是最新）", () => {
	const fin = { name: "联盟悬赏_20260921_定稿.md", version: V1, from: "active" };
	const v = judgeArtifact({ final: fin, prov: parseProvenance(provText()), artifact: "讨伐_宣讲_20261008.html" });
	assert.equal(v.state, "stale");
	assert.match(v.text, /它基于/);
	assert.match(v.text, /联盟悬赏_20260923_定稿\.md/);
});

test("derived: 四种「看不到依据」—— 一律 unknown，绝不显示成最新", () => {
	const fin = { name: "联盟悬赏_20260923_定稿.md", version: V1, from: "active" };

	const noSidecar = judgeArtifact({ final: fin, prov: parseProvenance(null), artifact: "a.html" });
	assert.equal(noSidecar.state, "unknown");
	assert.match(noSidecar.text, /面板看不到依据/);
	assert.match(noSidecar.text, /不默认它是最新的/);

	const noVer = judgeArtifact({ final: fin, prov: parseProvenance(provText({ basedOnVersion: "" })), artifact: "a.html" });
	assert.equal(noVer.state, "unknown");
	assert.match(noVer.text, /没记 `basedOnVersion`/);

	const noFinal = judgeArtifact({ final: null, prov: parseProvenance(provText()), artifact: "a.html" });
	assert.equal(noFinal.state, "unknown");
	assert.match(noFinal.text, /没有可派生的定稿/);

	const noFp = judgeArtifact({ final: { name: "x_定稿.md", version: "", from: "date" }, prov: parseProvenance(provText()), artifact: "a.html" });
	assert.equal(noFp.state, "unknown");
	assert.match(noFp.text, /拿不到当前定稿的版本指纹/);

	// 宿主给的版本串形状变了（工单 25 同一条纪律：认不出来就判不了，不拿半个串去比）
	const weirdFp = judgeArtifact({ final: { name: "x_定稿.md", version: "dev:absent", from: "date" }, prov: parseProvenance(provText()), artifact: "a.html" });
	assert.equal(weirdFp.state, "unknown");
	assert.match(weirdFp.text, /拿不到当前定稿的版本指纹/);

	// 侧车里记的指纹被手改过 ⇒ 同样不接受为比对依据
	const badRec = judgeArtifact({
		final: fin, prov: parseProvenance(provText({ basedOnVersion: "2026-10-08 手写的" })), artifact: "a.html"
	});
	assert.equal(badRec.state, "unknown");
	assert.match(badRec.text, /不是宿主版本串的形状/);
});

test("derived: 版本指纹 → 人话时间（认不出来不编时间）", () => {
	assert.match(stampText(V1), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
	assert.equal(stampText("dev:1:2:3"), "", "形状不对 ⇒ 不给时间");
	assert.equal(stampText(""), "");
	assert.equal(shortVersion(V1), stampText(V1) + " · …000000");
	assert.equal(shortVersion(""), "——");
	assert.equal(shortVersion("dev:1:2:3"), "dev:1:2:3");
});

// ── ④ 行视图 + 指令组装 ──────────────────────────────────────────────────
test("derived: 真数据（讨伐）—— 既有宣讲 HTML 没侧车 ⇒ 看不到依据；AI 读版还没有", () => {
	const rows = derivedRows({
		files: ["历史归档说明_联盟悬赏.md", "联盟悬赏_宣讲_20260923.content.json", "联盟悬赏_宣讲_20260923.html"],
		sidecars: {},
		final: { name: "联盟悬赏_20260923_定稿.md", path: "D:\\ws\\gdd\\联盟悬赏_20260923_定稿.md", version: V1, from: "active" },
		root: "D:\\ws\\features\\讨伐",
		topic: "讨伐",
		compact: "20261008",
		skillsRoot: "D:\\TimeMachine\\.agents\\skills",
		uiDir: "D:\\ws\\features\\讨伐\\gdd\\UI",
		uiCount: 7,
		gddFinalHtml: ["联盟悬赏_20260923_定稿.html"]
	});
	const speech = rows.kinds.filter((k) => k.kind === "speech")[0];
	const aiv = rows.kinds.filter((k) => k.kind === "aiv")[0];
	assert.equal(speech.state, "unknown");
	assert.equal(speech.artifacts.length, 1);
	assert.equal(speech.artifacts[0].sidecar, "联盟悬赏_宣讲_20260923.provenance.json");
	assert.equal(speech.artifacts[0].sidecarFound, false);
	assert.equal(speech.button, "重新生成宣讲 HTML");
	assert.equal(aiv.state, "none", "没有 AI 读版 ⇒ 是「还没有」这个结论，不是「最新」");
	assert.equal(aiv.button, "出 AI 读版");
	assert.equal(rows.counts.noSidecar, 1);
	assert.equal(rows.counts.other, 1);
	assert.ok(rows.notes.some((n) => /没有 provenance 侧车/.test(n)));
	assert.ok(rows.notes.some((n) => /`gdd\\` 里另有 1 份/.test(n)));
	assert.ok(rows.notes.some((n) => /不参与设计流程/.test(n)), "台账纪律那句话必须在场");
});

test("derived: 没有定稿（诸神降临/英雄圣物那种）⇒ 结论是「没有可派生的定稿」，且两个动作都不发", () => {
	const rows = derivedRows({
		files: ["神话宝库_宣讲_20260916.content.json", "神话宝库_宣讲_20260916.html"],
		sidecars: {}, final: null, root: "D:\\ws\\features\\诸神降临", topic: "诸神降临", compact: "20261008"
	});
	for (const k of rows.kinds) {
		// 有产物的那一类 = `unknown`（看不到依据）；没有产物的那一类 = `none`（还没有）——
		// 两种都**不许**说成"已是最新"，且都必须**不发指令**。
		if (k.artifacts.length) assert.equal(k.state, "unknown", k.kind + " 有产物但没有定稿 ⇒ 看不到依据");
		else assert.equal(k.state, "none", k.kind + " 没有产物 ⇒ 还没有");
		assert.equal(k.instruction, "", "没有源定稿 ⇒ 不给指令");
		assert.match(k.blocked, /没有可派生的定稿/);
		assert.match(k.next, /发起整合定稿/);
	}
	assert.equal(rows.current.name, "");
	assert.ok(rows.notes.some((n) => /没有可派生的定稿/.test(n)));
});

test("derived: 指纹一致时行视图就是「已是最新」，并且指令里嵌的侧车 JSON 逐字可解析", () => {
	const sc = "讨伐_宣讲_20261008.provenance.json";
	const rows = derivedRows({
		files: ["讨伐_宣讲_20261008.html", sc, "讨伐_宣讲_20261008.content.json"],
		sidecars: { [sc]: provText({ artifact: "讨伐_宣讲_20261008.html" }) },
		final: { name: "联盟悬赏_20260923_定稿.md", path: "D:\\ws\\gdd\\联盟悬赏_20260923_定稿.md", version: V1, from: "active" },
		root: "D:\\ws\\features\\讨伐", topic: "讨伐", compact: "20261008"
	});
	const speech = rows.kinds.filter((k) => k.kind === "speech")[0];
	assert.equal(speech.state, "fresh");
	assert.match(speech.text, /已是最新/);
	assert.equal(speech.artifacts[0].srcName, "讨伐_宣讲_20261008.content.json", "宣讲的可复跑源认出来了");
	assert.equal(rows.counts.sidecar, 1);
	assert.equal(rows.counts.noSidecar, 0);

	const ins = buildDerivedInstruction({
		root: "D:\\ws\\features\\讨伐", topic: "讨伐", compact: "20261008", kindId: "speech",
		finalName: "联盟悬赏_20260923_定稿.md", finalPath: "D:\\ws\\gdd\\联盟悬赏_20260923_定稿.md",
		finalVersion: V1, finalFrom: "active", skillsRoot: "D:\\TimeMachine\\.agents\\skills",
		uiDir: "D:\\ws\\features\\讨伐\\gdd\\UI", uiCount: 7
	});
	assert.equal(ins.blocked, "");
	assert.equal(ins.artifact, "讨伐_宣讲_20261008.html");
	assert.equal(ins.sidecar, "讨伐_宣讲_20261008.provenance.json");
	// 指令里逐字带着侧车 JSON（缩进两格）
	for (const line of ins.sidecarJson.split("\n")) assert.ok(ins.instruction.indexOf("  " + line) >= 0, "侧车 JSON 每一行都在指令里：" + line);
	const back = parseProvenance(ins.sidecarJson);
	assert.equal(back.ok, true);
	assert.equal(back.data.basedOnVersion, V1, "指纹是面板算好的那一串，agent 不许改");
	assert.equal(back.data.artifact, "讨伐_宣讲_20261008.html");
	assert.equal(back.data.generatedAt, "", "生成时间留给 agent 填");
	// skill / 落点 / 纪律
	assert.match(ins.instruction, /`\/sr-gdd-html`/);
	assert.match(ins.instruction, /sr-gdd-html\\SKILL\.md/);
	assert.match(ins.instruction, /D:\\ws\\features\\讨伐\\delivery\\讨伐_宣讲_20261008\.html/);
	assert.match(ins.instruction, /不要写决策记录/);
	assert.match(ins.instruction, /不要追加校准记录/);
	assert.match(ins.instruction, /不要动设计台账/);
});

test("derived: AI 读版那份指令按 plan-doc-ai-version，且**不**替技能扩展范围", () => {
	const ins = buildDerivedInstruction({
		root: "D:\\ws\\features\\讨伐", topic: "讨伐", compact: "20261008", kindId: "aiv",
		finalName: "联盟悬赏_20260923_定稿.md", finalPath: "D:\\ws\\gdd\\联盟悬赏_20260923_定稿.md",
		finalVersion: V1, finalFrom: "active", skillsRoot: "D:\\TimeMachine\\.agents\\skills"
	});
	assert.equal(ins.blocked, "");
	assert.equal(ins.artifact, "正式AI读版_讨伐_20261008.md");
	assert.match(ins.instruction, /`\/plan-doc-ai-version`/);
	assert.match(ins.instruction, /正式AI读版_讨伐_20261008\.md/);
	assert.match(ins.instruction, /运行包目录体系/);
	assert.match(ins.instruction, /停下来告诉我/);
	assert.match(ins.instruction, /不要写决策记录/);
});

test("derived: 缺前提时不发指令（拿不到功能根 / 没有定稿 / 拿不到指纹）", () => {
	const noRoot = buildDerivedInstruction({ kindId: "speech", topic: "讨伐", compact: "20261008" });
	assert.equal(noRoot.instruction, "");
	assert.match(noRoot.blocked, /拿不到这个功能的功能目录/);

	const noFinal = buildDerivedInstruction({ root: "D:\\ws\\features\\讨伐", kindId: "speech", topic: "讨伐", compact: "20261008" });
	assert.equal(noFinal.instruction, "");
	assert.match(noFinal.blocked, /没有可派生的定稿/);

	const noFp = buildDerivedInstruction({
		root: "D:\\ws\\features\\讨伐", kindId: "speech", topic: "讨伐", compact: "20261008",
		finalName: "x_定稿.md", finalPath: "D:\\ws\\gdd\\x_定稿.md", finalVersion: ""
	});
	assert.equal(noFp.instruction, "");
	assert.match(noFp.blocked, /拿不到当前定稿的版本指纹/);

	const badKind = buildDerivedInstruction({ root: "D:\\ws", kindId: "nope" });
	assert.equal(badKind.instruction, "");
	assert.match(badKind.blocked, /未知的派生物类别/);
});

test("derived: 两个类别的 skill 口径（规格 §3.3 + 本机技能）不漂移", () => {
	assert.equal(DERIVED_KINDS.length, 2);
	const speech = DERIVED_KINDS.filter((k) => k.id === "speech")[0];
	const aiv = DERIVED_KINDS.filter((k) => k.id === "aiv")[0];
	assert.equal(speech.tool, "sr-gdd-html");
	assert.equal(speech.dir, "sr-gdd-html");
	assert.equal(aiv.tool, "plan-doc-ai-version");
	assert.equal(aiv.dir, "plan-doc-ai-version");
	assert.equal(DERIVED_PROVENANCE_SCHEMA, "sr-workbench/derived-provenance@1");
});
