// 离线验证：定稿有效性校验 V1（设计 §6.1 / §8）
// 做法与 test-topic.js 一致：从 client.js **抽取真实代码段**跑，不复制一份逻辑（防漂移）
//
// 跑法： node test-finalcheck.js
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(SRC, "utf8");

// ── 抽取：从 PREFIXES 到 errText 之前（含 topicOf/isNoise/dateOf/parseFrontmatter/checkFinals）
const start = src.indexOf("const PREFIXES = [");
const end = src.indexOf("function errText(r, fallback) {");
if (start < 0 || end < 0 || end <= start) {
  console.error("抽取失败：找不到 PREFIXES 或 errText 边界");
  process.exit(1);
}
const block = src.slice(start, end);
let checkFinals, parseFrontmatter, topicOf, isNoise, dateOf;
try {
  ({ checkFinals, parseFrontmatter, topicOf, isNoise, dateOf } =
    new Function(block + "\nreturn { checkFinals, parseFrontmatter, topicOf, isNoise, dateOf };")());
} catch (e) {
  console.error("抽取的代码段执行失败：" + e.message);
  process.exit(1);
}
if (typeof checkFinals !== "function") {
  console.error("checkFinals 未定义——抽取边界可能不对");
  process.exit(1);
}

// ── 断言工具
let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log("  \u2705 " + label); }
  else { fail++; console.log("  \u274c " + label + "\n     期望 " + e + "\n     实际 " + a); }
}
const codes = (r) => r.issues.map((i) => i.code);

// ══════════════════════════════════════════════════════════════
console.log("═══ 一、合成用例 ═══");

// 1. 两份 active（这是实测真实存在的场景）
{
  const r = checkFinals([
    { name: "联盟悬赏_20260923_定稿.md", doc_type: "final_gdd", status: "active" },
    { name: "联盟悬赏_20260921_定稿.md", doc_type: "final_gdd", status: "active" }
  ]);
  eq(r.actives.length, 2, "两份 active → actives = 2");
  eq(codes(r), ["V1"], "两份 active → 报 V1（error）");
  eq(r.issues[0].level, "error", "V1 级别 = error");
  eq(r.current, "联盟悬赏_20260923_定稿.md", "current 取日期最新那份");
  eq(r.currentFrom, "active", "判定依据 = active");
  eq(r.issues[0].files.length, 2, "V1 带出全部涉事文件");
}

// 2. 一份 active + 一份正确标 archived（正常的历史版本）
{
  const r = checkFinals([
    { name: "X_20260923_定稿.md", status: "active" },
    { name: "X_20260921_定稿.md", status: "archived" }
  ]);
  eq(codes(r), [], "active + archived → 无告警");
  eq(r.current, "X_20260923_定稿.md", "current 正确");
  eq(r.currentFrom, "active", "判定依据 = active");
}

// 3. 一份 active + 一份没标（既不是 active 也不是 archived）
{
  const r = checkFinals([
    { name: "X_20260923_定稿.md", status: "active" },
    { name: "X_20260921_定稿.md", status: "" }
  ]);
  eq(codes(r), ["V1c"], "active + 未标 → V1c（warn）");
  eq(r.issues[0].level, "warn", "V1c 级别 = warn");
}

// 4. 单份 pending（整合完成、待门，这是它的正常停留态）
{
  const r = checkFinals([{ name: "X_20260923_定稿.md", doc_type: "final_gdd", status: "pending" }]);
  eq(codes(r), [], "单份 pending → 无告警（这是正常停留态）");
  eq(r.currentFrom, "date", "无 active → 退回日期口径");
  eq(r.current, "X_20260923_定稿.md", "仍能给出 current");
}

// 5. 空输入
{
  const r = checkFinals([]);
  eq(r.current, null, "空输入 → current = null");
  eq(codes(r), [], "空输入 → 无告警");
  eq(r.all.length, 0, "空输入 → all 为空");
}

// 6. 头部缺失（parseFrontmatter 返回 null → doc_type/status 都是 null）
{
  const r = checkFinals([{ name: "X_20260923_定稿.md", doc_type: null, status: null }]);
  eq(codes(r), ["V1b"], "头部缺失 → V1b（没有 active）");
}

// 7. 输入顺序打乱，仍要按日期定最新
{
  const r = checkFinals([
    { name: "X_20260921_定稿.md", status: "active" },
    { name: "X_20260923_定稿.md", status: "active" }
  ]);
  eq(r.current, "X_20260923_定稿.md", "输入乱序 → current 仍是日期最新");
  eq(r.actives[0], "X_20260923_定稿.md", "actives 也按日期倒序");
}

// 8. 三份 active（更严重的情况）
{
  const r = checkFinals([
    { name: "X_20260923_定稿.md", status: "active" },
    { name: "X_20260922_定稿.md", status: "active" },
    { name: "X_20260921_定稿.md", status: "active" }
  ]);
  eq(r.actives.length, 3, "三份 active → actives = 3");
  eq(codes(r), ["V1"], "三份 active → 仍只报一条 V1");
}

// ══════════════════════════════════════════════════════════════
console.log("\n═══ 二、真实数据（" + "D:\\TimeMachine\\GameDesignOS\\workspace" + "）═══");

const ROOT = "D:\\TimeMachine\\GameDesignOS\\workspace";
const PROP = path.join(ROOT, "proposals");
let finalNames = [];
try {
  finalNames = fs.readdirSync(PROP).filter((n) => /_定稿\.md$/i.test(n));
} catch (e) {
  console.log("  （读不到 proposals 目录，跳过：" + e.message + "）");
}

if (finalNames.length) {
  console.log("  发现 " + finalNames.length + " 份定稿：" + finalNames.join("、"));

  // 与面板同构的归组
  const byTopic = new Map();
  for (const n of finalNames) {
    const t = topicOf(n);
    if (isNoise(t)) { console.log("  [噪音主题，面板会忽略] " + n + " → " + JSON.stringify(t)); continue; }
    if (!byTopic.has(t)) byTopic.set(t, []);
    byTopic.get(t).push(n);
  }

  let v1Hit = 0;
  for (const [topic, names] of byTopic) {
    const heads = names.map((n) => {
      let txt = "";
      try { txt = fs.readFileSync(path.join(PROP, n), "utf8").slice(0, 2000); } catch (e) { /* 读不到就当头部缺失 */ }
      const h = parseFrontmatter(txt);
      return { name: n, doc_type: h && h.doc_type, status: h && h.status };
    });
    const r = checkFinals(heads);
    console.log("\n  【" + topic + "】" + heads.length + " 份定稿，current = " + r.current +
      "（依据：" + r.currentFrom + "）");
    for (const h of heads) {
      console.log("      " + (h.status === "active" ? "● " : "○ ") + h.name +
        "  doc_type=" + JSON.stringify(h.doc_type) + "  status=" + JSON.stringify(h.status));
    }
    if (!r.issues.length) console.log("      → 无告警");
    for (const i of r.issues) {
      console.log("      → [" + i.level.toUpperCase() + " " + i.code + "] " + i.msg);
      if (i.code === "V1") v1Hit++;
    }
  }

  console.log("\n  ── 结论 ──");
  if (v1Hit) {
    console.log("  \u2705 V1 命中 " + v1Hit + " 个功能——这正是设计 §8 预期要暴露的真实缺陷");
    pass++;
  } else {
    console.log("  \u26a0 V1 未命中（当前 workspace 没有多份 active 并存）");
  }
}

// ══════════════════════════════════════════════════════════════
console.log("\n═══════════════════════════════════");
console.log("合成用例：" + pass + " 通过 / " + fail + " 失败");
process.exit(fail ? 1 : 0);
