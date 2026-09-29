// 离线验证：章节规范在真实产出文件上是否正确归类
const fs = require("fs");
const path = require("path");

const SRC = "D:\\TimeMachine\\sr-workbench\\lib\\client.js";
const src = fs.readFileSync(SRC, "utf8");

const a = src.indexOf("function parseMdSections(text) {");
const b = src.indexOf("function mdSpecOf(path) {");
if (a < 0 || b < 0 || b <= a) { console.error("抽取失败 a=" + a + " b=" + b); process.exit(1); }
// 不要用正则剥注释（会切断 /^\// 之类）
const block = src.slice(a, b);
const fns = new Function(block + "\nreturn { parseMdSections, classifyHeading, MD_SPECS };")();
const { parseMdSections, classifyHeading, MD_SPECS } = fns;

const W = "D:\\TimeMachine\\GameDesignOS\\workspace";
const FILES = [
  "analysis\\experience-report_神话宝库_20260915.md",
  "analysis\\replication-spec_神话宝库_20260915.md",
  "analysis\\concept-triage_联盟悬赏_20260918.md",
  "analysis\\feature-concept_联盟悬赏_20260918.md",
  "evidence\\神话宝库\\evidence-index_神话宝库_20260915.md",
  "proposals\\readback_A079_神话宝库_20260916.md",
];

const specOf = (p) => {
  const name = String(p).split(/[\\/]/).pop();
  for (const s of MD_SPECS) if (s.match.test(name)) return s;
  return null;
};

let totalUnknown = 0;
for (const rel of FILES) {
  const p = path.join(W, rel);
  const name = path.basename(p);
  const spec = specOf(p);
  if (!spec) { console.log("⚠ 无规范：" + name); continue; }
  const sections = parseMdSections(fs.readFileSync(p, "utf8"));
  const bucket = { top: [], body: [], fold: [], skip: [], unknown: [] };
  for (const s of sections) {
    const cls = classifyHeading(s.title, spec.sections);
    bucket[cls === null ? "unknown" : cls].push(s.title);
  }
  const bad = bucket.unknown.length;
  totalUnknown += bad;
  console.log("── " + name + "   （规范：" + spec.name + "，共 " + sections.length + " 节）");
  console.log("   置顶 " + bucket.top.length + "：" + (bucket.top.join(" / ") || "—"));
  console.log("   主体 " + bucket.body.length + "：" + (bucket.body.join(" / ") || "—"));
  console.log("   折叠 " + bucket.fold.length + "：" + (bucket.fold.join(" / ") || "—"));
  console.log("   省略 " + bucket.skip.length + "：" + (bucket.skip.join(" / ") || "—"));
  console.log("   " + (bad ? "❌ 未归类 " + bad + "：" + bucket.unknown.join(" / ") : "✅ 全部归类"));
  console.log("");
}
console.log("未归类章节合计：" + totalUnknown + (totalUnknown === 0 ? "  ✅ 规范覆盖了真实文件" : "  ← 它们会进「其他章节」，不会丢但说明规范有漏"));
