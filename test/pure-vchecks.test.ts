/**
 * 工单 30 · 五条只读校验 V3 / V5 / V6 / V8 / V11（+ 与 V1 汇总的校验清单）
 *
 * ★ 全部跑**真实定稿** `features\联盟悬赏\gdd\联盟悬赏_20260923_定稿.md`：
 *   期望值逐条对齐 `30-v-checks-baseline.json`（那份基线是把六条检查在真实数据上跑过一遍的产物）。
 *   本套件刻意**不录制 fixture**——"真实定稿里 7 个假阳性"这类判据，合成样例永远测不出来。
 *
 * ★ "在真实定稿上人为制造每一类问题"用的也是**同一份真实正文的变异体**（只改那一行），
 *   所以"检查报得出来"这件事同样落在真实数据上，而不是玩具输入。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { VCHECK_SPECS, checkV11, gddChecklist, scanFinalChecks } from "../src/pure/vchecks.ts";
import { FINAL_GDD, readText, requireRealData } from "./paths.ts";

requireRealData();
const FINAL_TEXT = readText(FINAL_GDD);
const GDD_DIR = path.dirname(FINAL_GDD);

/** 正文按行切开（保留原始换行形态，行号与编辑器一致） */
function linesOfText(text: string): string[] {
	return text.split(/\r?\n/);
}

/** 真实定稿的变异体：只动指定的那一行，其余逐字不变 */
function mutate(fn: (lines: string[]) => void): string {
	const lines = linesOfText(FINAL_TEXT);
	fn(lines);
	return lines.join("\n");
}

/** gdd\ 下的定稿候选（文件名 + frontmatter 的 doc_type/status + mtime） */
function finalsInDir() {
	return fs.readdirSync(GDD_DIR).filter((n) => /_定稿\.md$/i.test(n)).map((n) => {
		const t = readText(path.join(GDD_DIR, n));
		const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(t);
		const fm: Record<string, string> = {};
		if (m) {
			for (const l of m[1].split(/\r?\n/)) {
				const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(l);
				if (kv) fm[kv[1]] = kv[2].trim();
			}
		}
		return { name: n, doc_type: fm.doc_type, status: fm.status, mtime: fs.statSync(path.join(GDD_DIR, n)).mtimeMs };
	});
}

/** gdd\ 下所有 `*_审查.md` */
function reviewsInDir() {
	return fs.readdirSync(GDD_DIR).filter((n) => /_审查\.md$/i.test(n))
		.map((n) => ({ name: n, mtime: fs.statSync(path.join(GDD_DIR, n)).mtimeMs }));
}

function currentFinal() {
	const actives = finalsInDir().filter((f) => f.status === "active").sort((a, b) => (a.name < b.name ? 1 : -1));
	return actives[0];
}

// ── V3 · §7 文本键重复 ────────────────────────────────────────────────────
test("V3 真实定稿：§7 共 48 个键，命中 1 个重复键 alli_boss_kill_count_label（L379/L389）", () => {
	const v3 = scanFinalChecks(FINAL_TEXT).V3;
	assert.equal(v3.keys, 48);
	assert.equal(v3.hit, true);
	assert.deepEqual(v3.dup, [{ key: "alli_boss_kill_count_label", lines: [379, 389] }]);
	assert.equal(v3.level, "error");
	// 行号必须回指真实原文（"定位到出问题的条目"就靠它）
	const lines = linesOfText(FINAL_TEXT);
	assert.ok(lines[378].includes("alli_boss_kill_count_label") && lines[378].includes("累计击杀次数"));
	assert.ok(lines[388].includes("alli_boss_kill_count_label") && lines[388].includes("击杀次数"));
});

test("V3 在真实定稿上人为制造第二处重复 → 报两个键、两处行号", () => {
	const text = mutate((lines) => {
		assert.ok(lines[387].includes("alli_boss_rank_my"), "第 388 行应正是 alli_boss_rank_my");
		lines[387] = lines[378];                 // 把 §7 里另一行改成与 L379 同一个键
	});
	const v3 = scanFinalChecks(text).V3;
	assert.equal(v3.hit, true);
	// 该键原本就在 L389 有一处（真实缺陷），这次又多一处 ⇒ 三处行号
	assert.deepEqual(v3.dup, [{ key: "alli_boss_kill_count_label", lines: [379, 388, 389] }]);
	assert.equal(v3.keys, 47, "少了一个不同的键（原 alli_boss_rank_my 被顶掉）");
});

// ── V5 · 「待配表」计数 ───────────────────────────────────────────────────
test("V5 真实定稿：5 处（L87/L88/L161/L162/L363），标记次数也是 5", () => {
	const v5 = scanFinalChecks(FINAL_TEXT).V5;
	assert.equal(v5.hit, true);
	assert.equal(v5.count, 5);
	assert.equal(v5.occurrences, 5);
	assert.deepEqual(v5.hits.map((h) => h.line), [87, 88, 161, 162, 363]);
	assert.deepEqual(v5.hits.map((h) => h.chapter), [
		"4. 功能规则", "4. 功能规则", "4. 功能规则", "4. 功能规则", "6. 配置契约"
	]);
	assert.equal(v5.level, "info", "「待配表」是待办计数，不是缺陷 —— 告警条上按 info 显示");
});

test("V5 在真实定稿上人为补一条待配表 → 计数 6", () => {
	const text = mutate((lines) => {
		lines.splice(161, 0, "| 展示数量上限 | 取全服通用排行展示上限 | 待配表 |");
	});
	const v5 = scanFinalChecks(text).V5;
	assert.equal(v5.count, 6);
	assert.equal(v5.occurrences, 6);
	assert.deepEqual(v5.hits.map((h) => h.line), [87, 88, 161, 162, 163, 364]);
});

// ── V6 · §4 引用 ↔ §6 声明（**单向**）────────────────────────────────────
test("V6 真实定稿：§4 引用 14 处 / §6 声明 24 个字段；方向① = 0（干净）", () => {
	const v6 = scanFinalChecks(FINAL_TEXT).V6;
	assert.equal(v6.refCount, 14);
	assert.equal(v6.declCount, 24);
	assert.deepEqual(v6.refsWithoutDecl, []);
	assert.equal(v6.hit, false);
	assert.equal(v6.level, "error");
});

test("V6 方向②（§6 声明了、§4 没引用）真实数据 13 处 —— **不是问题**，不得报成告警", () => {
	const v6 = scanFinalChecks(FINAL_TEXT).V6;
	assert.equal(v6.declsWithoutRef.length, 13);
	assert.deepEqual(v6.declsWithoutRef.map((d) => d.field), [
		"Id", "bossName", "weakness", "recommendHero", "bossArt", "bg", "sence",
		"bossGid", "brithPlace", "monsterPlace", "rankIndex", "minRank", "maxRank"
	]);
	// 清单里**不能**出现 V6（真实定稿这一条是干净的）
	const cl = gddChecklist({ text: FINAL_TEXT, finals: finalsInDir(), reviews: reviewsInDir(), mtime: currentFinal().mtime });
	assert.equal(cl.issues.filter((i) => i.code === "V6").length, 0);
});

test("V6 在真实定稿上人为抹掉一个 §6 声明（rewardDropId）→ 方向① 报 2 处并给出行号", () => {
	const text = mutate((lines) => {
		assert.ok(lines[351].includes("`rewardDropId`"), "第 352 行应正是 §6.4 的 rewardDropId 声明");
		assert.ok(lines[139].includes("rewardDropId") && lines[162].includes("rewardDropId"), "§4 L140/L163 都引用了它");
		lines[351] = lines[351].replace("`rewardDropId`", "`rewardDropIdX`");
	});
	const v6 = scanFinalChecks(text).V6;
	assert.equal(v6.declCount, 24, "抹掉的是字段名，不是那一行");
	assert.equal(v6.hit, true);
	assert.deepEqual(v6.refsWithoutDecl.map((r) => ({ field: r.field, line: r.line })), [
		{ field: "rewardDropId", line: 140 }, { field: "rewardDropId", line: 163 }
	]);
	assert.equal(v6.declsWithoutRef.length, 14, "被改名的声明自己变成了「没被引用」的那一条");
	assert.ok(v6.declsWithoutRef.some((d) => d.field === "rewardDropIdX"));
});

// ── V8 · §5 编号重号 / 跳号 ──────────────────────────────────────────────
test("V8 真实定稿：34 处出现 / 20 个编号（UE1–UE20）/ §5 定义行 28 —— 无跳号、无重号", () => {
	const v8 = scanFinalChecks(FINAL_TEXT).V8;
	assert.equal(v8.total, 34);
	assert.equal(v8.unique, 20);
	assert.deepEqual(v8.range, [1, 20]);
	assert.equal(v8.definitions, 28);
	assert.equal(v8.references, 6, "§4/§10 与散文里的提及共 6 处");
	assert.deepEqual(v8.gaps, []);
	assert.deepEqual(v8.dup, []);
	assert.equal(v8.hit, false);
	assert.deepEqual(v8.undefinedRefs, []);
});

test("V8 判据修正的证据：按「出现次数」判重会得到 7 个假阳性（本实现不这么做）", () => {
	const naive = new Map<string, number>();
	for (const m of FINAL_TEXT.matchAll(/\bUE(\d+)([a-z]?)\b/g)) naive.set(m[1], (naive.get(m[1]) || 0) + 1);
	assert.equal(Array.from(naive.values()).filter((n) => n > 1).length, 7, "UE2/UE3/UE12/UE14/UE15/UE17/UE20 都出现多次");
	// 后缀族（UE3 与 UE3a 同族）在真实数据上有 6 个 —— 这是**正常**结构，不是重号
	assert.equal(scanFinalChecks(FINAL_TEXT).V8.families.length, 6);
	assert.equal(scanFinalChecks(FINAL_TEXT).V8.hit, false, "判据只看 §5 定义行 ⇒ 假阳性为 0");
});

test("V8 在真实定稿上人为制造重号（L264 的 UE17a 改成 UE17）→ 报重号", () => {
	const text = mutate((lines) => {
		assert.ok(lines[263].startsWith("| UE17a |"), "第 264 行应正是 UE17a 条目定义");
		lines[263] = lines[263].replace("| UE17a |", "| UE17 |");
	});
	const v8 = scanFinalChecks(text).V8;
	assert.equal(v8.hit, true);
	assert.deepEqual(v8.dup, [{ raw: "UE17", n: 17, lines: [263, 264] }]);
	assert.deepEqual(v8.gaps, []);
});

test("V8 在真实定稿上人为制造跳号（L221 的 UE9 改成 UE8a）→ 报缺 UE9", () => {
	const text = mutate((lines) => {
		assert.ok(lines[220].startsWith("| UE9 |"), "第 221 行应正是 UE9 条目定义");
		lines[220] = lines[220].replace("| UE9 |", "| UE8a |");
	});
	const v8 = scanFinalChecks(text).V8;
	assert.equal(v8.hit, true);
	assert.deepEqual(v8.gaps, [9]);
	assert.deepEqual(v8.dup, []);
});

test("V8 的提及不算定义：§4 里提到 UE3/UE12/UE14 不参与判重（真实数据）", () => {
	const lines = linesOfText(FINAL_TEXT);
	// §4 R6 L139 提到 UE3、§4 R8 L160 提到 UE12/UE14 —— 这些是提及，不是条目定义
	assert.ok(lines[138].startsWith("| 终结奖励 |") && lines[138].includes("UE3"));
	assert.ok(lines[159].startsWith("| 面板展示 |") && lines[159].includes("UE12") && lines[159].includes("UE14"));
	const v8 = scanFinalChecks(FINAL_TEXT).V8;
	// UE12 全文出现 3 次（L160/L233/L239）但**只定义一次**（§5.2 L239）
	const occurrencesOf12 = linesOfText(FINAL_TEXT).filter((l) => /\bUE12\b/.test(l)).length;
	assert.equal(occurrencesOf12, 3);
	assert.equal(v8.dup.length, 0);
	assert.equal(v8.families.some((f) => f.n === 12), false, "UE12 没有后缀兄弟，所以连族都算不上");
});

// ── V11 · 审查报告缺失 / 过旧 ────────────────────────────────────────────
test("V11 真实数据：当前有效定稿 20260923 没有逐字匹配的审查报告 → 命中", () => {
	const cur = currentFinal();
	assert.equal(cur.name, "联盟悬赏_20260923_定稿.md");
	const v11 = checkV11({ final: { name: cur.name, mtime: cur.mtime }, reviews: reviewsInDir() });
	assert.equal(v11.hit, true);
	assert.deepEqual(v11.match, []);
	assert.deepEqual(v11.reviewsInDir, ["联盟悬赏_20260921_定稿_审查.md", "联盟悬赏_20260921_审查.md"]);
	assert.equal(v11.level, "warn");
});

test("V11 判据三分支：同名更新 → 过；同名更旧 → 命中；只有别的版本的审查 → 命中", () => {
	const cur = currentFinal();
	const newer = { name: "联盟悬赏_20260923_定稿_审查.md", mtime: cur.mtime + 60_000 };
	const older = { name: "联盟悬赏_20260923_定稿_审查.md", mtime: cur.mtime - 60_000 };
	assert.equal(checkV11({ final: { name: cur.name, mtime: cur.mtime }, reviews: [newer] }).hit, false);
	const stale = checkV11({ final: { name: cur.name, mtime: cur.mtime }, reviews: [older] });
	assert.equal(stale.hit, true);
	assert.deepEqual(stale.stale, [older.name]);
	// 别的版本的审查报告（真实 gdd\ 里就是这样）不算数
	const other = checkV11({ final: { name: cur.name, mtime: cur.mtime }, reviews: reviewsInDir() });
	assert.equal(other.hit, true);
	assert.deepEqual(other.match, []);
});

// ── 汇总：面板告警条要的那张清单 ─────────────────────────────────────────
test("校验清单（真实数据）：V1+V3+V11+V5 四条，V6/V8 不出告警；按 error→warn→info 排", () => {
	const cl = gddChecklist({ text: FINAL_TEXT, finals: finalsInDir(), reviews: reviewsInDir(), mtime: currentFinal().mtime });
	assert.equal(cl.current, "联盟悬赏_20260923_定稿.md");
	assert.equal(cl.currentFrom, "active");
	assert.deepEqual(cl.issues.map((i) => [i.level, i.code]), [
		["error", "V1"], ["error", "V3"], ["warn", "V11"], ["info", "V5"]
	]);
	assert.deepEqual(cl.counts, { error: 2, warn: 1, info: 1 });
	// 严重程度集中声明在 VCHECK_SPECS 里，清单与它一致
	assert.equal(VCHECK_SPECS.V3.level, "error");
	assert.equal(VCHECK_SPECS.V5.level, "info");
	assert.equal(VCHECK_SPECS.V6.level, "error");
	assert.equal(VCHECK_SPECS.V8.level, "warn", "2026-09-30 按用户口径从 error 降为 warn：跳号未必致命，重号才是");
	assert.equal(VCHECK_SPECS.V11.level, "warn");
	// 每条 issue 都要能回答"凭什么"与"去哪看"：rule 在 checks 里、行号在 issue 上
	assert.deepEqual(cl.issues[1].lines, [379, 389]);
	assert.deepEqual(cl.issues[3].lines, [87, 88, 161, 162, 363]);
	assert.ok(String((cl.checks.V6 as { rule: string }).rule).includes("反方向"));
});

test("清单接口的降级：没有定稿 / 空正文时不炸，且不编造问题", () => {
	const empty = gddChecklist({});
	assert.equal(empty.current, null);
	assert.deepEqual(empty.issues, []);
	assert.deepEqual(empty.counts, { error: 0, warn: 0, info: 0 });
	assert.deepEqual(empty.checks.V11.hit, false, "没有当前定稿就不判 V11");
	const scan = scanFinalChecks("");
	assert.equal(scan.V3.hit, false);
	assert.equal(scan.V5.count, 0);
	assert.equal(scan.V6.refCount, 0);
	assert.equal(scan.V8.total, 0);
	assert.equal(scanFinalChecks(undefined).V8.hit, false);
});

test("V1 仍由 finalgdd.checkFinals 负责（本模块不重写它）", () => {
	const cl = gddChecklist({ text: FINAL_TEXT, finals: finalsInDir(), reviews: reviewsInDir(), mtime: currentFinal().mtime });
	const v1 = cl.checks.V1 as { actives: string[]; issues: Array<{ code: string }> };
	assert.deepEqual(v1.actives, ["联盟悬赏_20260923_定稿.md", "联盟悬赏_20260921_定稿.md"]);
	assert.deepEqual(v1.issues.map((i) => i.code), ["V1"]);
	assert.equal(cl.issues[0].level, "error");
});

test("真实定稿的行号锚点不会被换行符形态影响（CRLF/LF 同解）", () => {
	const lf = FINAL_TEXT.replace(/\r\n/g, "\n");
	const crlf = FINAL_TEXT.replace(/\r?\n/g, "\r\n");
	const a = scanFinalChecks(lf), b = scanFinalChecks(crlf);
	assert.deepEqual(a.V3.dup, b.V3.dup);
	assert.deepEqual(a.V8.dup, b.V8.dup);
	assert.equal(a.V8.total, b.V8.total);
	assert.equal(a.V6.refCount, b.V6.refCount);
	assert.equal(a.V5.count, b.V5.count);
});
