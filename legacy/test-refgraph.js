// 离线验证：引用图 / 影响范围（设计 §6.4.1）
// 抽取 client.js 的真实代码段跑，不复制逻辑。
//
// 跑法： node test-refgraph.js [定稿路径]
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(SRC, "utf8");
const a = src.indexOf("const PREFIXES = [");
const b = src.indexOf("function errText(r, fallback) {");
const { parseFinalGdd, buildRefGraph, impactOf } =
  new Function(src.slice(a, b) + "\nreturn { parseFinalGdd, buildRefGraph, impactOf };")();

const FILE = process.argv[2] ||
  "D:\\TimeMachine\\GameDesignOS\\workspace\\proposals\\联盟悬赏_20260923_定稿.md";
const text = fs.readFileSync(FILE, "utf8");
const g = parseFinalGdd(text);

console.log("引用图：" + path.basename(FILE));
const t0 = Date.now();
const graph = buildRefGraph(g);
const ms = Date.now() - t0;
console.log("  词表 " + graph.vocabSize + " 个可引用实体 · 边 " + graph.edgeCount + " 条 · 耗时 " + ms + "ms");

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log("  \u2705 " + label); }
  else { fail++; console.log("  \u274c " + label + (extra ? "  → " + extra : "")); }
};

console.log("\n═══ 断言 ═══");
// 词表预期：§7 文本键 43 + UE 27 + AC 15 + R 10 + UI-M 4 = 99
ok(graph.vocabSize >= 90, "词表 ≥90（≈ §7键43 + UE27 + AC15 + R10 + UI-M4）", "实际 " + graph.vocabSize);
ok(graph.edgeCount > 150, "边数 >150", "实际 " + graph.edgeCount);
ok(ms < 3000, "构建耗时 < 3s（打开面板时算一次）", ms + "ms");

/** 从解析结果里找条目的定义行（"自身"不能拿 hits[0] 猜） */
function findRow(ref) {
  const m = /^§(\d+)\s+(.*)$/.exec(ref);
  if (!m) return null;
  const ch = g.outline.find((c) => c.no === m[1]);
  if (!ch) return null;
  for (const gr of ch.children) {
    for (const r of gr.rows) {
      if (("§" + ch.no + " " + (gr.id || gr.no || "") + " " + r.key).trim() === ref) return r;
    }
  }
  for (const r of ch.rows) if (("§" + ch.no + " " + r.key) === ref) return r;
  return null;
}

// 逐个抽查：这些是设计 §6.4.1 举的例子，应该真的有引用
const probe = (ref, expectAtLeast, label) => {
  const e = graph.byRef.get(ref);
  const n = e ? e.hits.length : 0;
  ok(n >= expectAtLeast, label + " → " + n + " 处", n + " 处");
  return e;
};

console.log("\n  ── 抽查关键条目（§6.4.1 的示例）──");
const ue3 = probe("§5 UI-M1 UE3", 2, "§5 UI-M1 UE3（宝箱）");
probe("§5 UI-M1 UE2", 2, "§5 UI-M1 UE2（血条；含同族 UE2a）");
probe("§5 UI-M3 UE17", 1, "§5 UI-M3 UE17（结算伤害区）");
probe("§10 AC8", 1, "§10 AC8（奖励触达完整）");
probe("§4 R2", 3, "§4 R2（BOSS 与难度推进）");
probe("§5 UI-M1", 5, "§5 UI-M1（界面归属：它的 UE 都算）");

// 编号同族：UE3 的影响面里应该有 UE3a，且标为 family 边
{
  const e = ue3 || { hits: [] };
  const fam = e.hits.filter((h) => h.kind === "family");
  ok(fam.length >= 1, "UE3 有同族边（UE3 ↔ UE3a）", "family 边 " + fam.length + " 条");
  ok(fam.some((h) => /UE3a/.test(h.where)), "同族边指向 UE3a", fam.map((h) => h.where).join("、"));
}

// 显示 §6.4.1 里那张卡片的真实内容
console.log("\n" + "═".repeat(76));
console.log("面板「就地改这条」的影响范围卡会显示（以 UE3 为例）：");
console.log("═".repeat(76));
{
  const ref = "§5 UI-M1 UE3";
  const e = graph.byRef.get(ref);
  const row = findRow(ref);
  const selfLine = row ? row.line : -1;
  const imp = impactOf(graph, ref, selfLine);
  console.log("\n改 " + ref + " —— 这一条动了，全文还有 " + imp.length + " 处跟着动：\n");
  for (const h of imp) {
    const tag = h.kind === "family" ? "[同族] " : "";
    console.log("  ▸ L" + String(h.line).padEnd(4) + tag + h.where);
    console.log("        " + String(h.text || "").slice(0, 104).replace(/\|/g, "│"));
  }
  console.log("\n  （原文：L" + selfLine + "  " + String(row ? row.text : "").slice(0, 88) + "…）");
  ok(imp.length >= 2, "UE3 的影响范围卡有 ≥2 条（自身已正确排除）", imp.length + " 条");
  ok(!imp.some((h) => h.line === selfLine), "影响范围里不含自身行 L" + selfLine);
}

// 再抽三个多引用的看看
for (const ref of ["§5 UI-M1 UE2", "§4 R2", "§5 UI-M1 UE5", "§5 UI-M1 UE3a"]) {
  const e = graph.byRef.get(ref);
  if (!e) { console.log("\n" + ref + "：（词表里没有这个 ref）"); continue; }
  const row = findRow(ref);
  const imp = impactOf(graph, ref, row ? row.line : -1);
  console.log("\n" + ref + "：" + imp.length + " 处 → " +
    imp.slice(0, 7).map((h) => "L" + h.line + (h.kind === "family" ? "(同族)" : "")).join("  "));
}

console.log("\n" + "═".repeat(76));
console.log("断言：" + pass + " 通过 / " + fail + " 失败");
process.exit(fail ? 1 : 0);
