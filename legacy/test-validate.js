// 离线验证 A4 的契约校验器：抽出真实 validateDecision，跑真实的 schema + 决策文件
const fs = require("fs");
const path = require("path");

const SRC = "D:\\TimeMachine\\sr-workbench\\lib\\client.js";
const src = fs.readFileSync(SRC, "utf8");

// 抽 validateDecision（从「按 schema 校验一条决策记录」到「读某功能的决策记录」）
const a = src.indexOf("function validateDecision(doc, schema) {");
const b = src.indexOf("/** 读某功能的决策记录");
if (a < 0 || b < 0) { console.error("抽取失败"); process.exit(1); }
const block = src.slice(a, b).replace(/\/\/.*$/gm, "");
const validateDecision = new Function(block + "\nreturn validateDecision;")();

const ROOT = "D:\\TimeMachine";
const SCHEMA = path.join(ROOT, ".agents\\skills\\sr-askme\\references\\decision.schema.json");
const DECDIR = path.join(ROOT, "GameDesignOS\\workspace\\decisions");

const schema = JSON.parse(fs.readFileSync(SCHEMA, "utf8"));
console.log("schema：" + schema.title);
console.log("  required " + (schema.required || []).length + " 项");
console.log("  decision_type 合法值 " + schema.properties.decision_type.enum.length + " 个");
console.log("  options.minItems = " + schema.properties.options.minItems);
console.log("  additionalProperties = " + schema.additionalProperties);
console.log("");

const files = fs.readdirSync(DECDIR).filter((f) => /^decision_.*\.json$/i.test(f)).sort();
let badCount = 0;
for (const f of files) {
  const doc = JSON.parse(fs.readFileSync(path.join(DECDIR, f), "utf8"));
  const issues = validateDecision(doc, schema);
  const flag = issues.length ? "✗ 不合规 " + issues.length + " 处" : "✓ 合规";
  if (issues.length) badCount++;
  console.log(f + "   " + flag);
  for (const it of issues) console.log("      · " + it.field + " = " + it.value + "   → " + it.rule);
}
console.log("\n合计：" + files.length + " 条，" + badCount + " 条不合规");
