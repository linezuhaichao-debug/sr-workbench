// 离线预览：面板「风险提示条」在真实 workspace 上会显示什么文字
// 目的：在打开浏览器之前，先确认 数据层 → checkFinals → RiskBar 聚合 这条链是通的
//
// 抽取策略与 test-finalcheck.js 一致（跑 client.js 的真实代码段，不复制逻辑）；
// 唯一复刻的是 loadDashboardInner 里"读目录→归组→读头部"的编排，以及 RiskBar 的聚合，
// 因为这两处依赖 React/remote，无法离线执行。复刻部分在下方用 ⚠ 标注。
//
// 跑法： node test-dashboard-v1.js
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(SRC, "utf8");

const start = src.indexOf("const PREFIXES = [");
const end = src.indexOf("function errText(r, fallback) {");
if (start < 0 || end < 0) { console.error("抽取失败"); process.exit(1); }
const block = src.slice(start, end);
const { topicOf, isNoise, dateOf, parseFrontmatter, checkFinals } =
  new Function(block + "\nreturn { topicOf, isNoise, dateOf, parseFrontmatter, checkFinals };")();

const ROOT = "D:\\TimeMachine\\GameDesignOS\\workspace";
const PROP = path.join(ROOT, "proposals");

// ⚠ 复刻 loadDashboardInner 的编排（真实实现走 remote.read，这里走 fs）
function buildFeatures() {
  let names = [];
  try { names = fs.readdirSync(PROP); } catch (e) { return { error: e.message }; }

  const finalsByTopic = new Map();   // 与面板同构：只按 _定稿.md 归组
  for (const n of names) {
    if (!/_定稿\.md$/i.test(n)) continue;
    const t = topicOf(n);
    if (isNoise(t)) continue;
    if (!finalsByTopic.has(t)) finalsByTopic.set(t, []);
    finalsByTopic.get(t).push(n);
  }

  const features = [];
  for (const [topic, list] of finalsByTopic) {
    list.sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : -1));      // finals 按日期倒序（面板同款）
    // ⚠ 复刻：面板对【每一份】定稿读一次头部（readHead = 读前 14 行）
    const finalHeads = list.map((n) => {
      let txt = "";
      try { txt = fs.readFileSync(path.join(PROP, n), "utf8").split(/\r?\n/).slice(0, 14).join("\n"); }
      catch (e) { /* 读不到 → 头部缺失 */ }
      const h = parseFrontmatter(txt);
      return { name: n, doc_type: h ? h.doc_type : null, status: h ? h.status : null };
    });
    const finalCheck = checkFinals(finalHeads);
    const head = finalHeads.length ? finalHeads[0] : null;
    features.push({
      topic: topic,
      docType: head ? head.doc_type : null,
      status: head ? head.status : null,
      finalCheck: finalCheck,
      latestFinal: list[0] || null,
      historyCount: Math.max(0, list.length - 1)
    });
  }
  return { features: features };
}

// ⚠ 复刻 RiskBar 的聚合（真实实现是 React 组件，此处只取文案部分）
function riskBarText(features, hasPendingQuestion) {
  const noFinal = features.filter((f) => !f.latestFinal).length;
  const multi = features.filter((f) => f.historyCount > 0).length;
  const waiting = hasPendingQuestion ? features.slice(0, 0) : [];   // 离线无法探测会话，按"无待拍板"处理
  const hasIssue = (f, code) => !!(f.finalCheck && f.finalCheck.issues.some((i) => i.code === code));
  const dupActive = features.filter((f) => f.finalCheck && f.finalCheck.actives.length > 1);
  const noActive = features.filter((f) => hasIssue(f, "V1b"));
  const unarchived = features.filter((f) => hasIssue(f, "V1c"));
  const items = [];
  if (dupActive.length) items.push("\u26d4 " + dupActive.length + " 个功能有多份 active 定稿：" +
    dupActive.map((f) => f.topic + "\uff08" + f.finalCheck.actives.length + " 份\uff09").join("\u3001"));
  if (waiting.length) items.push("\u26a0 " + waiting.length + " 个功能在等你拍板");
  if (noActive.length) items.push(noActive.length + " 个功能没有 active 定稿");
  if (unarchived.length) items.push(unarchived.length + " 个功能的旧定稿未标 archived");
  if (noFinal) items.push("\u5c1a\u672a\u51fa\u5b9a\u7a3f " + noFinal + " \u4e2a");
  if (multi) items.push("\u6709\u5386\u53f2\u7248\u672c\u7684 " + multi + " \u4e2a\uff08\u4ee5\u6700\u65b0\u4e3a\u6700\u7ec8\u7248\uff09");
  if (!items.length) items.push("\u672a\u53d1\u73b0\u5f85\u529e\u98ce\u9669");
  const bad = dupActive.length > 0;
  return { text: items.join(" \u00b7 "), tone: bad ? "bad(红)" : (items.length && waiting.length) ? "warn(橙)" : "ok(绿)" };
}

// ══════════════════════════════════════════════════════════════
console.log("\u2550\u2550\u2550 \u6570\u636e\u5c42 \u2550\u2550\u2550");
const d = buildFeatures();
if (d.error) { console.error("\u8bfb\u76ee\u5f55\u5931\u8d25\uff1a" + d.error); process.exit(1); }
console.log("  \u547d\u4e2d\u529f\u80fd " + d.features.length + " \u4e2a\uff1a");
for (const f of d.features) {
  const fc = f.finalCheck;
  console.log("\n  \u3010" + f.topic + "\u3011");
  console.log("     \u5b9a\u7a3f\u4efd\u6570 " + fc.all.length + "\uff0ccurrent = " + fc.current + "\uff08\u4f9d\u636e\uff1a" + fc.currentFrom + "\uff09");
  console.log("     actives = [" + fc.actives.join(", ") + "]");
  const fcc = { docType: f.docType, status: f.status, historyCount: f.historyCount, latestFinal: f.latestFinal };
  console.log("     \u9762\u677f\u5934\u90e8\u5b57\u6bb5\uff1adocType=" + JSON.stringify(fcc.docType) + " status=" + JSON.stringify(fcc.status));
  if (!fc.issues.length) console.log("     issues\uff1a\u65e0");
  for (const i of fc.issues) console.log("     issues\uff1a[" + i.level + " " + i.code + "] " + i.msg);
}

console.log("\n\u2550\u2550\u2550 \u6e32\u67d3\u5c42\uff08\u98ce\u9669\u63d0\u793a\u6761\uff09\u2550\u2550\u2550");
const r = riskBarText(d.features, false);
console.log("  \u8272\u8c03\uff1a" + r.tone);
console.log("  \u6587\u6848\uff1a" + r.text);

console.log("\n\u2550\u2550\u2550 \u9884\u671f\u6548\u679c\u2550\u2550\u2550");
const expectRed = d.features.some((f) => f.finalCheck.actives.length > 1);
const gotRed = r.tone.startsWith("bad");
console.log(expectRed
  ? (gotRed ? "  \u2705 \u5b58\u5728\u591a\u4efd active \u5b9a\u7a3f \u2192 \u63d0\u793a\u6761\u5e94\u4e3a\u7ea2\u8272\u4e14\u6587\u6848\u542b\u201c\u591a\u4efd active\u201d \u2014\u2014 \u7b26\u5408\u9884\u671f" : "  \u274c \u9884\u671f\u7ea2\u8272\u4f46\u5f97\u5230 " + r.tone)
  : (gotRed ? "  \u274c \u4e0d\u5e94\u4e3a\u7ea2\u8272" : "  \u2705 \u65e0\u591a\u4efd active \u2192 \u63d0\u793a\u6761\u4e0d\u4e3a\u7ea2\u8272"));
process.exit(expectRed === gotRed ? 0 : 1);
