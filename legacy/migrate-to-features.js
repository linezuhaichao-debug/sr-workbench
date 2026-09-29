// 旧结构 → 新结构（features\<主题>\）迁移
//   ★ 只**复制**，不动旧文件（用户："旧结构只是不想马上删了丢素材"）。
//   ★ 分类规则直接复用 client.js 的真实函数（topicOf / artifactBucket），不另写一套。
//
//   node migrate-to-features.js            干跑：只打印计划
//   node migrate-to-features.js --apply    执行复制
const fs = require("fs");
const path = require("path");

const APPLY = process.argv.indexOf("--apply") >= 0;
const WS = "D:\\TimeMachine\\GameDesignOS\\workspace";
const CLIENT = path.join(__dirname, "..", "lib", "client.js");

const src = fs.readFileSync(CLIENT, "utf8");
const a = src.indexOf("const PREFIXES = [");
const b = src.indexOf("function errText(r, fallback) {");
const { topicOf, isNoise, artifactBucket, BUCKET_FIELD } =
  new Function(src.slice(a, b) + "\nreturn { topicOf, isNoise, artifactBucket, BUCKET_FIELD };")();

/** 桶 → 目标子目录（§9.1.2 方案乙） */
const BUCKET_DIR = {
  final: "gdd", review: "gdd", draft: "gdd", gdd: "gdd",
  analysis: "analysis",   // concept 桶 = 全部头脑风暴产物
  decisions: "decisions",
  evidence: "evidence",
  speech: "delivery"
};
const LEGACY_DIRS = ["proposals", "decisions", "analysis", "evidence"];

// ── ① 扫旧结构的文件
const plan = [];          // { topic, bucket, sub, from, to }
const dirPlan = [];       // 整目录搬（证据包 / UI 图）
for (const d of LEGACY_DIRS) {
  const abs = path.join(WS, d);
  if (!fs.existsSync(abs)) continue;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.isDirectory()) {
      // 子目录：`<主题>UI\` 跟定稿走（保相对引用）；`evidence\<主题>\` 是证据包，整搬
      const t = topicOf(e.name);
      if (isNoise(t)) continue;
      if (/UI$/i.test(e.name)) {
        dirPlan.push({ topic: t, sub: "gdd", name: e.name, from: path.join(abs, e.name),
          why: "定稿 §5 用相对路径引它，跟定稿同目录树才不断链" });
      } else if (d === "evidence") {
        // ★ 证据包**摊平**到 `features\<主题>\evidence\` —— 不再套第二层 `<主题>`
        //   （不要写 `evidence\神话宝库\`：外层已经是 `features\神话宝库\`，主题重复）
        dirPlan.push({ topic: e.name, sub: "evidence", name: e.name, flatten: true,
          from: path.join(abs, e.name), why: "证据包（摊平，不套第二层主题目录）" });
      }
      continue;
    }
    const t = topicOf(e.name);
    if (isNoise(t)) continue;
    const bucket = artifactBucket(e.name);
    let sub = BUCKET_DIR[bucket];
    // 两类 artifactBucket 不认、但必须跟着走的文件：
    if (bucket === "speechSrc") sub = "delivery";                    // 宣讲的可复跑源，跟 html 一起
    else if (!sub && /_定稿\.html$/i.test(e.name)) sub = "gdd";       // 定稿的自包含渲染
    if (!sub) continue;                                              // 其余 others 不迁
    plan.push({ topic: t, bucket, sub, from: path.join(abs, e.name), to: path.join(WS, "features", t, sub, e.name) });
  }
}

// ── ② 打印计划
const byTopic = new Map();
for (const p of plan) {
  if (!byTopic.has(p.topic)) byTopic.set(p.topic, []);
  byTopic.get(p.topic).push(p);
}
console.log("迁移计划：" + (APPLY ? "【执行】" : "【干跑，不动盘】"));
console.log("workspace: " + WS + "\n");
let files = 0, dirs = 0;
for (const kv of Array.from(byTopic.entries()).sort()) {
  const t = kv[0];
  console.log("features\\" + t + "\\");
  const bySub = new Map();
  for (const p of kv[1]) {
    if (!bySub.has(p.sub)) bySub.set(p.sub, []);
    bySub.get(p.sub).push(path.basename(p.from));
  }
  for (const dp of dirPlan.filter((x) => x.topic === t)) {
    if (!bySub.has(dp.sub)) bySub.set(dp.sub, []);
    bySub.get(dp.sub).push(dp.name + "\\（整目录）");
  }
  for (const sk of Array.from(bySub.entries()).sort()) {
    console.log("   " + sk[0] + "\\");
    for (const n of sk[1].sort()) console.log("        " + n);
  }
  files += kv[1].length;
  console.log("");
}
dirs = dirPlan.length;
console.log("合计：" + files + " 个文件 + " + dirs + " 个整目录");
console.log("未纳入（others / 派生件 / 噪音）：不迁 —— 它们会随旧结构一起删");

if (!APPLY) {
  console.log("\n（干跑结束。加 --apply 执行复制；旧文件保持不动）");
  process.exit(0);
}

// ── ③ 执行：建目录 + 复制
let copied = 0, skipped = 0;
const ensure = (p) => fs.mkdirSync(p, { recursive: true });
for (const p of plan) {
  ensure(path.dirname(p.to));
  if (fs.existsSync(p.to)) { skipped++; continue; }
  fs.copyFileSync(p.from, p.to);
  copied++;
}
for (const dp of dirPlan) {
  const base = path.join(WS, "features", dp.topic, dp.sub);
  ensure(base);
  if (dp.flatten) {
    // 摊平：把源目录的**内容**逐个搬进 base，不建同名子目录
    for (const it of fs.readdirSync(dp.from)) {
      const src2 = path.join(dp.from, it), dst2 = path.join(base, it);
      if (fs.existsSync(dst2)) { skipped++; continue; }
      fs.cpSync(src2, dst2, { recursive: true });
      copied++;
    }
    continue;
  }
  const dst = path.join(base, dp.name);
  if (fs.existsSync(dst)) { skipped++; continue; }
  fs.cpSync(dp.from, dst, { recursive: true });
  copied++;
}
console.log("\n已复制 " + copied + " 项，跳过（目标已存在）" + skipped + " 项");
console.log("旧文件**未改动** —— 确认无误后再手动删旧结构");
