// 离线验证：定稿结构解析（设计 §6.2 大纲树 / §6.3 条目引用）
// 抽取 client.js 的真实代码段跑，不复制逻辑。
//
// 跑法： node test-finalgdd.js
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(SRC, "utf8");

const start = src.indexOf("const PREFIXES = [");
const end = src.indexOf("function errText(r, fallback) {");
if (start < 0 || end < 0) { console.error("抽取失败"); process.exit(1); }
const { parseFinalGdd } =
  new Function(src.slice(start, end) + "\nreturn { parseFinalGdd };")();
if (typeof parseFinalGdd !== "function") { console.error("parseFinalGdd 未定义"); process.exit(1); }

const FILE = "D:\\TimeMachine\\GameDesignOS\\workspace\\proposals\\联盟悬赏_20260923_定稿.md";
const text = fs.readFileSync(FILE, "utf8");
const srcLines = text.split(/\r?\n/);
const g = parseFinalGdd(text);

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log("  \u2705 " + label); }
  else { fail++; console.log("  \u274c " + label + (extra ? "  → " + extra : "")); }
};
const chOf = (no) => g.outline.find((c) => c.no === no);

console.log("═══ 概览 ═══");
console.log("  frontmatter : doc_type=" + JSON.stringify(g.meta.doc_type) + " status=" + JSON.stringify(g.meta.status));
console.log("  标题        : " + g.title);
console.log("  规模        : " + g.stats.chapters + " 章 / " + g.stats.groups + " 组 / " + g.stats.rows + " 条目行");
console.log("  块          : " + g.blocks.length + " 个（章 " + g.blocks.filter((b) => b.level === 2).length +
  " + 组 " + g.blocks.filter((b) => b.level === 3).length + "）");
console.log("  原文        : " + srcLines.length + " 行");

console.log("\n═══ 断言 ═══");
ok(g.meta.doc_type === "final_gdd", "frontmatter 解析出 doc_type=final_gdd");
ok(g.stats.chapters === 11, "恰好 11 章（§1–§11）", "实际 " + g.stats.chapters);
ok(g.outline.map((c) => c.no).join(",") === "1,2,3,4,5,6,7,8,9,10,11", "章号 1–11 连续无跳号");

// 块覆盖完整性：所有块的原文拼起来应覆盖正文绝大部分行
{
  const covered = new Set();
  for (const b of g.blocks) {
    const n = b.text.split(/\r?\n/).length;
    for (let i = 0; i < n; i++) covered.add(b.line + i);
  }
  // 正文行（去掉 frontmatter 4 行与首尾）
  let bodyLines = 0;
  for (let i = 5; i <= srcLines.length; i++) if (srcLines[i - 1].trim()) bodyLines++;
  const hit = Array.from(covered).filter((i) => i >= 5 && srcLines[i - 1] && srcLines[i - 1].trim()).length;
  ok(hit / bodyLines > 0.95, "分块覆盖 ≥95% 正文非空行（无内容丢失）",
    (hit + "/" + bodyLines + " = " + Math.round((hit / bodyLines) * 100) + "%"));
}

// §4 规则组
{
  const c4 = chOf("4");
  ok(c4 && c4.children.length === 10, "§4 有 10 个规则组（R1–R10）", "实际 " + (c4 ? c4.children.length : "-"));
  ok(c4 && c4.children.map((x) => x.id).join(",") === "R1,R2,R3,R4,R5,R6,R7,R8,R9,R10", "R 组号连续无跳号");
}

// §5 界面组
{
  const c5 = chOf("5");
  const ui = c5 ? c5.children.filter((x) => x.id && /^UI-M/.test(x.id)) : [];
  ok(ui.length === 4, "§5 识别出 4 个界面（UI-M1–M4）", "实际 " + ui.length);
  ok(ui[0] && ui[0].no === "5.1" && ui[0].id === "UI-M1", "§5.1 → UI-M1（组号 + id 都对）",
    ui[0] && (ui[0].no + " / " + ui[0].id));
  const m1 = ui[0];
  ok(m1 && m1.rows.length >= 9, "UI-M1 至少 9 条 UE 条目", "实际 " + (m1 ? m1.rows.length : "-"));
  ok(m1 && m1.rows[0].key === "UE1", "UI-M1 首条 = UE1", m1 && m1.rows[0].key);
  ok(m1 && m1.rows.some((r) => r.key === "UE2a"), "识别出字母后缀变体 UE2a（§6.6 编号纪律要用）");
  ok(m1 && !m1.rows.some((r) => r.key === "编号"), "表头『编号』没被当成条目");
  // 行号可用性：UE3 的行号必须指向正确的原文行
  const ue3 = m1 && m1.rows.find((r) => r.key === "UE3");
  ok(ue3 && /^\|\s*UE3\s*\|/.test(srcLines[ue3.line - 1] || ""),
    "UE3 的行号指向正确原文行（L" + (ue3 ? ue3.line : "?") + "）",
    JSON.stringify(String(ue3 ? srcLines[ue3.line - 1] : "").slice(0, 40)));
}

// 章级表格：§7 / §8 / §10
{
  const c7 = chOf("7"), c8 = chOf("8"), c10 = chOf("10");
  ok(c7 && c7.rows.length >= 40, "§7 识别出 ≥40 个文本键（章级表格）", "实际 " + (c7 ? c7.rows.length : "-"));
  ok(c8 && c8.rows.length === 5, "§8 范围门 5 行", "实际 " + (c8 ? c8.rows.length : "-"));
  ok(c10 && c10.rows[0] && c10.rows[0].key === "AC1", "§10 首条 = AC1");
  ok(c10 && c10.rows.length >= 15, "§10 识别出 ≥15 条验收标准", "实际 " + (c10 ? c10.rows.length : "-"));
  const names = (c7 ? c7.rows : []).map((r) => r.key);
  const dup = Array.from(new Set(names.filter((n, i) => names.indexOf(n) !== i)));
  ok(dup.length > 0, "§7 检出重复键（对应 §8 的 V3）—— " + dup.join("、"));
}

// 行号单调
{
  let mono = true, prev = 0;
  for (const b of g.blocks) { if (b.line <= prev) mono = false; prev = b.line; }
  ok(mono, "块的行号严格递增");
}
ok(!g.blocks.some((b) => /^```/.test(b.title)), "代码围栏内容没被误判成章");

// ══════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(72));
console.log("面板「定稿」页签左栏大纲会渲染成：");
console.log("═".repeat(72));
for (const c of g.outline) {
  console.log("\n§" + c.no + " " + c.title + "   (L" + c.line + ")");
  if (c.rows.length) console.log("    ·（章级表格 " + c.rows.length + " 条）");
  for (const gr of c.children) {
    const tag = gr.id ? "[" + gr.id + "]" : (gr.no ? "[" + gr.no + "]" : "[  ]");
    console.log("    " + tag + " " + gr.title + (gr.rows.length ? "  · " + gr.rows.length + " 条" : ""));
  }
}
console.log("\n" + "═".repeat(72));
console.log("断言：" + pass + " 通过 / " + fail + " 失败");
process.exit(fail ? 1 : 0);
