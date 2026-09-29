// 离线验证：产物分类（设计 §3.2 双轨 / §9.1.4）
//   验证两件事：
//   ① 旧结构（文件名前缀）—— sr-analysis / sr-concept 的**全部**产出都能被认出来
//      （修之前只认 concept-triage_ / feature-concept_ / sr-gdd-handoff_ 三种，其余静默丢弃）
//   ② 新结构（子目录）—— features\<主题>\ 的 7 个子目录都能归到正确的桶
//
// 跑法： node test-buckets.js
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(SRC, "utf8");
const a = src.indexOf("const PREFIXES = [");
const b = src.indexOf("function errText(r, fallback) {");
const { artifactBucket, topicOf, isNoise, BUCKET_FIELD, DIR_BUCKET } =
  new Function(src.slice(a, b) + "\nreturn { artifactBucket, topicOf, isNoise, BUCKET_FIELD, DIR_BUCKET };")();

let pass = 0, fail = 0;
const ok = (c, label, extra) => {
  if (c) { pass++; console.log("  \u2705 " + label); }
  else { fail++; console.log("  \u274c " + label + (extra ? "  → " + extra : "")); }
};

console.log("═══ ① 旧结构：文件名前缀 → 桶 ═══");
// 这些是 sr-analysis / sr-concept 的**全部**产出（产出规范实测）
const cases = [
  ["concept-triage_联盟悬赏_20260918.md", "analysis"],
  ["feature-concept_联盟悬赏_20260918.md", "analysis"],
  ["experience-report_神话宝库_20260915.md", "analysis"],   // ← 修之前被丢
  ["issue-cards_神话宝库_20260915.json", "analysis"],        // ← 修之前被丢
  ["replication-spec_神话宝库_20260915.md", "analysis"],     // ← 修之前被丢
  ["sr-gdd-handoff_联盟悬赏_20260918.json", "analysis"],
  ["evidence-index_神话宝库_20260915.md", "evidence"],
  ["calibration_联盟悬赏_20260921_归档.jsonl", "evidence"],
  ["decision_联盟悬赏_20260929.json", "decisions"],
  ["联盟悬赏_20260923_定稿.md", "final"],
  ["联盟悬赏_20260921_定稿_审查.md", "review"],
  ["联盟悬赏_20260918.md", "draft"],
  ["联盟悬赏_宣讲_20260923.html", "speech"],
  ["联盟悬赏_宣讲_20260923.content.json", "speechSrc"],
  ["write_CS-20260920-001.py", "others"]
];
let bad = 0;
for (const c of cases) {
  const got = artifactBucket(c[0]);
  if (got !== c[1]) { bad++; console.log("  \u274c " + c[0] + " → " + got + "（期望 " + c[1] + "）"); }
  else pass++;
}
if (!bad) console.log("  \u2705 " + cases.length + " 个真实文件名全部分类正确");

console.log("\n  关键回归：sr-analysis 的 6 种产出都进 analysis 桶");
{
  const six = ["concept-triage_", "feature-concept_", "experience-report_", "issue-cards_", "replication-spec_", "sr-gdd-handoff_"];
  const miss = six.filter((p) => artifactBucket(p + "x.md") !== "analysis");
  ok(miss.length === 0, "6 种前缀全部 → analysis", miss.join("、"));
}

console.log("\n═══ ② 新结构：子目录 → 桶 ═══");
// ★ 2026-09-29 定稿：`assets\` 取消（线框图跟定稿走 `gdd\UI\`）；
//   `source\` **保留** —— 放"所有发给 agent 的源文件"（截图 / 录屏 / 旧文档 / 外部交付包）
for (const sub of ["analysis", "gdd", "decisions", "evidence", "source", "delivery"]) {
  ok(!!DIR_BUCKET[sub], "子目录 " + sub + "\\ 有对应桶（" + DIR_BUCKET[sub] + "）");
}
ok(!DIR_BUCKET.assets, "assets\\ 已从 DIR_BUCKET 移除（线框图跟定稿走 gdd\\UI\\）");
ok(DIR_BUCKET.source === "source", "source\\ 保留 —— 喂给 agent 的源文件");
ok(DIR_BUCKET.evidence === "evidence", "evidence\\ 保留 —— 分析产出的证据（与 source 分属「进 / 出」两侧）");
ok(DIR_BUCKET.gdd === "gdd", "gdd\\ 单独成桶（里面还要再细分定稿/审查）");

console.log("\n═══ ③ 分桶后落到哪个字段 ═══");
{
  const rows = [
    ["analysis", "concept（沿用旧字段名，含义已扩为全部头脑风暴产物）"],
    ["evidence", "evidence"],
    ["decisions", "decisions"],
    ["final", "finals"], ["review", "reviews"], ["speech", "speeches"]
  ];
  for (const r of rows) {
    ok(BUCKET_FIELD[r[0]] === r[1].split("（")[0], r[0] + " → " + r[1]);
  }
  ok(!BUCKET_FIELD.speechSrc, "speechSrc 不进任何字段（派生件）");
  ok(!BUCKET_FIELD.others, "others 进计数，不占数组");
}

console.log("\n═══ ④ 真实 workspace 的效果对比 ═══");
const WS = "D:\\TimeMachine\\GameDesignOS\\workspace";
// ★ 只扫面板**实际会扫**的那些目录（loadDashboardInner：proposals / decisions / analysis / evidence）
//   否则会把 运行包_*\ 里的下游文件（正式AI读版_…、交付自检_…）也算成功能，得出假数据。
const ROOTS = ["proposals", "decisions", "analysis", "evidence"];
const all = [];
for (const r of ROOTS) {
  const d = path.join(WS, r);
  if (!fs.existsSync(d)) continue;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (!e.isDirectory()) all.push({ name: e.name, rel: r + "/" + e.name });
  }
}
const byTopic = new Map();
for (const f of all) {
  const t = topicOf(f.name);
  if (isNoise(t)) continue;
  const bucket = artifactBucket(f.name);
  if (bucket === "speechSrc") continue;
  const field = BUCKET_FIELD[bucket];
  if (!field) continue;
  if (!byTopic.has(t)) byTopic.set(t, { concept: [], finals: [], evidence: [], decisions: [], drafts: [], reviews: [], speeches: [] });
  byTopic.get(t)[field].push(f.name);
}
console.log("  功能            头脑风暴  定稿  证据  决策  成稿  审查  宣讲");
for (const kv of byTopic.entries()) {
  const v = kv[1];
  const n = (x) => String(x.length).padStart(4);
  console.log("  " + kv[0].padEnd(14) + n(v.concept) + n(v.finals) + n(v.evidence) + n(v.decisions) + n(v.drafts) + n(v.reviews) + n(v.speeches));
}
console.log("\n  （修之前：头脑风暴一列只统计 3 种前缀，且 evidence 整列不存在）");

console.log("\n" + "═".repeat(66));
console.log("断言：" + pass + " 通过 / " + fail + " 失败");
process.exit(fail ? 1 : 0);
