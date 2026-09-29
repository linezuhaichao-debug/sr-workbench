// 离线验证：直接抽取 client.js 的真实代码段跑，验证「功能去重 + 配置表只作属性」
const fs = require("fs");
const path = require("path");

const SRC = "D:\\TimeMachine\\sr-workbench\\lib\\client.js";
const src = fs.readFileSync(SRC, "utf8");

const start = src.indexOf("const PREFIXES = [");
const end = src.indexOf("// 二、数据加载");
if (start < 0 || end < 0) { console.error("抽取失败"); process.exit(1); }
let block = src.slice(start, end)
  .replace(/\/\/ ═+[\s\S]*?$/, "")
  .replace(/\/\*\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");
const { topicOf, isNoise, artifactBucket } = new Function(block + "\nreturn { topicOf, isNoise, artifactBucket };")();

const ROOT = "D:\\TimeMachine";
const D = {
  proposals: path.join(ROOT, "GameDesignOS\\workspace\\proposals"),
  decisions: path.join(ROOT, "GameDesignOS\\workspace\\decisions"),
  analysis: path.join(ROOT, "GameDesignOS\\workspace\\analysis"),
  configs: path.join(ROOT, "planner\\策划配置"),
};
const filesOf = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name); } catch { return []; } };
const p = filesOf(D.proposals), dec = filesOf(D.decisions), an = filesOf(D.analysis), cf = filesOf(D.configs);

// —— 与 client.js 同构的归组 ——
const byTopic = new Map();
const touch = (t) => {
  if (!byTopic.has(t)) byTopic.set(t, { topic: t, concept: 0, drafts: [], finals: [], reviews: [], speeches: 0, decisions: [], others: 0 });
  return byTopic.get(t);
};
const feed = (names, bucket) => {
  for (const n of names) {
    const t = topicOf(n);
    if (isNoise(t)) { console.log("  [噪音] " + n + " → " + JSON.stringify(t)); continue; }
    bucket(touch(t), n);
  }
};
feed(p, (f, n) => {
  if (/_定稿_审查\.md$/i.test(n) || /_审查\.md$/i.test(n)) f.reviews.push(n);
  else if (/_定稿\.md$/i.test(n)) f.finals.push(n);
  else if (/_宣讲_.*\.html$/i.test(n)) f.speeches += 1;
  else if (/_宣讲_.*\.content\.json$/i.test(n)) { }
  else f.drafts.push(n);
});
feed(dec, (f, n) => { if (/^decision_/.test(n)) f.decisions.push(n); });
feed(an, (f, n) => {
  // ★ 改用真实的 artifactBucket（设计 §3.2 双轨）—— 原先这里内联了旧正则，
  //   只认 3 种前缀，于是体验报告/问题卡/复刻规格被静默丢弃，测试也就跟着漏报。
  if (artifactBucket(n) === "analysis") f.concept += 1;
});

const configByTopic = new Map();
for (const n of cf) {
  if (!/\.xlsx?m?$/i.test(n)) continue;
  const t = topicOf(n);
  if (isNoise(t)) continue;
  if (!configByTopic.has(t)) configByTopic.set(t, []);
  configByTopic.get(t).push(n);
}

console.log("目录：proposals=" + p.length + " decisions=" + dec.length + " analysis=" + an.length + " configs=" + cf.length);

const rows = [...byTopic.values()]
  .map((f) => Object.assign({}, f, { configs: configByTopic.get(f.topic) || [] }))
  .filter((f) => f.finals.length > 0 || f.decisions.length > 0 || f.concept > 0 || f.speeches > 0)
  .sort((x, y) => (x.topic < y.topic ? -1 : 1));

console.log("\n══════ 派生出的功能（" + rows.length + " 个）══════");
for (const f of rows) {
  console.log("  " + f.topic);
  console.log("      定稿=" + f.finals.length + " 审查=" + f.reviews.length + " 宣讲=" + f.speeches +
    " 概念=" + f.concept + " 决策=" + f.decisions.length + " draft=" + f.drafts.length +
    " 配置表=" + f.configs.length + (f.configs.length ? " (" + f.configs.join(", ") + ")" : ""));
}

console.log("\n══════ 定稿归属（应各功能收敛）══════");
for (const f of rows.filter((x) => x.finals.length)) console.log("  " + f.topic + " → " + f.finals.join(" | "));

console.log("\n══════ 未被任何功能匹配的配置表数量（预期 88 左右，属正常）══════");
const used = new Set(rows.flatMap((f) => f.configs));
console.log("  " + (cf.filter((n) => /\.xlsx?m?$/i.test(n)).length - used.size) + " 张未挂到任何设计功能");
