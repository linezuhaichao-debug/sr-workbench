// 离线验证：设计台账派生（设计 §7）
// 抽取 client.js 的真实代码段跑，不复制逻辑。
//
// 跑法： node test-ledger.js
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(SRC, "utf8");

// 抽取范围：PREFIXES … errText 之前（含 topicOf/isNoise/dateOf/parseFrontmatter/checkFinals/stageOfGate/buildLedger）
const start = src.indexOf("const PREFIXES = [");
const end = src.indexOf("function errText(r, fallback) {");
if (start < 0 || end < 0) { console.error("抽取失败"); process.exit(1); }
const block = src.slice(start, end);
const { topicOf, isNoise, buildLedger, stageOfGate } =
  new Function(block + "\nreturn { topicOf, isNoise, buildLedger, stageOfGate };")();

if (typeof buildLedger !== "function") { console.error("buildLedger 未定义"); process.exit(1); }

// ── 真实数据
//   ★ 2026-09-29：路径从旧的平铺目录改成 `features\<主题>\` —— 面板已经单轨（§9.1.4）。
//     这个测试的路径过期过一次，差点让"字段漏读"藏过去。
const WS = "D:\\TimeMachine\\GameDesignOS\\workspace";
const FEAT = path.join(WS, "features");
const TOPIC = "联盟悬赏";
const readText = (p) => { try { return fs.readFileSync(p, "utf8"); } catch (e) { return null; } };

/** 收一个功能目录下的决策记录 + 校准流水 + 交接 JSON（与面板 loadLedger 同构） */
function collect(featureDir) {
  const decisions = [], calibrations = [], handoffs = [];
  const ddir = path.join(featureDir, "decisions");
  for (const n of (fs.existsSync(ddir) ? fs.readdirSync(ddir) : [])) {
    if (!/^decision_.*\.json$/i.test(n)) continue;
    const t = readText(path.join(ddir, n));
    if (t) decisions.push({ name: n, text: t });
  }
  const edir = path.join(featureDir, "evidence");
  for (const n of (fs.existsSync(edir) ? fs.readdirSync(edir) : [])) {
    if (!/^calibration_.*\.jsonl$/i.test(n)) continue;
    const t = readText(path.join(edir, n));
    if (t) calibrations.push({ name: n, text: t });
  }
  // ★ 交接 JSON —— 头脑风暴结论的主要载体（2026-09-29 补：原先整个 analysis\ 没读）
  const an = path.join(featureDir, "analysis");
  for (const n of (fs.existsSync(an) ? fs.readdirSync(an) : [])) {
    if (!/^sr-gdd-handoff_.*\.json$/i.test(n)) continue;
    const t = readText(path.join(an, n));
    if (t) handoffs.push({ name: n, text: t });
  }
  return { decisions, calibrations, handoffs };
}

/** features\ 下所有功能 */
function allFeatures() {
  if (!fs.existsSync(FEAT)) return [];
  return fs.readdirSync(FEAT, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
}

const input = collect(path.join(FEAT, TOPIC));
console.log("═══ 输入（" + path.join("features", TOPIC) + "）═══");
console.log("  decisions    : " + input.decisions.length + " 份 —— " + input.decisions.map((d) => d.name).join("、"));
console.log("  calibrations : " + input.calibrations.length + " 份 —— " + input.calibrations.map((c) => c.name).join("、"));

const led = buildLedger(input);

console.log("\n═══ 统计 ═══");
console.log("  合计条目 : " + led.total);
console.log("  来源     : decision 汇总 " + led.stats.fromDecision + " 条 / jsonl 补录 " + led.stats.fromJsonl + " 条");
for (const s of led.stages) console.log("  " + s.name + " : " + s.count + " 条 / " + s.days.length + " 天");
if (led.notes.length) console.log("  注意     : " + led.notes.join("；"));

// ── 断言
let pass = 0, fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log("  \u2705 " + label); }
  else { fail++; console.log("  \u274c " + label + (extra ? "  → " + extra : "")); }
};
console.log("\n═══ 断言 ═══");
ok(led.total > 20, "台账条目数 > 20（真实数据应足够丰富）", "实际 " + led.total);
ok(led.stages[0].count >= 7, "阶段一 ≥ 7 条（round 1–7 应归到头脑风暴）", "实际 " + led.stages[0].count);
ok(led.stages[1].count >= 10, "阶段二 ≥ 10 条（round 8–19 + 决策结论）", "实际 " + led.stages[1].count);
// ★ 2026-09-29 用户澄清：台账只记"**拍板的设计结论**"，不记 agent 的技术改动清单。
//   下面两条是**回归断言** —— 如果将来又把 changes[] / post_gate_fix* 加回台账，它们会失败。
//   参照：0929 那次「就地改这条」产生了 C1–C12 共 12 条 changes，一旦展开，阶段三会从 1 条涨到 13 条。
ok(led.stages[2].count >= 1, "阶段三 ≥1 条（0929 那次改动的**结论**）", "实际 " + led.stages[2].count);
ok(led.stages[2].count <= 5, "阶段三**没有被展开**成逐条改动（changes 不进台账）", "实际 " + led.stages[2].count + " 条");
ok(led.total < 40, "台账总量克制 —— 只记结论，不记改动", "实际 " + led.total + " 条");

// ══════════════════════════════════════════════════════════════
// ★ 字段覆盖检查（2026-09-29 新增）
//   起因：靠它才发现台账**漏读了 5 类结论性字段** —— settled_choices（诸神降临的 T1–T7
//   七条拍板口径一条都没进台账）、gdd_draft_gate、handoff_gate、note、kill_signal。
//   规则：每个出现过的 decision_result 键，必须**显式归类**为「收」或「不收」，不许悬空。
console.log("\n═══ 字段覆盖检查（所有功能的 decision_result 键）═══");
{
  const READ = ["combination", "calibrations", "settled_choices", "gdd_draft_gate", "handoff_gate", "note", "kill_signal"];
  const SKIP = [
    "chosen",                 // 选项 ID（如 OPT-N1）—— 不是可读结论
    "changes",                // agent 的技术改动清单 → 审计面
    "post_gate_fixes", "post_gate_fix_20260929", "diagram_swap", "conditions_completed",
    "remaining_items", "open_items", "next_step", "next_steps",   // 执行/待办 → 不是结论
    "config_action", "impact_scan", "verification", "mode", "gate",
    "files", "report_path", "issue_cards_path", "evidence_index_path", "replication_spec_path",
    "sr_gdd_handoff_path", "gdd_path", "gdd_draft", "feature_concept", "handoff_json",
    "upstream", "knowledge_base_note"                          // 路径/元信息 → 引用，非结论
  ];
  const seen = {};
  for (const t of allFeatures()) {
    const inp = collect(path.join(FEAT, t));
    for (const d of inp.decisions) {
      let j = null;
      try { j = JSON.parse(d.text); } catch (e) { continue; }
      const r = (j && j.decision_result) || {};
      for (const k of Object.keys(r)) {
        if (!seen[k]) seen[k] = [];
        if (seen[k].indexOf(t) < 0) seen[k].push(t);
      }
    }
  }
  const keys = Object.keys(seen).sort();
  const unclassified = keys.filter((k) => READ.indexOf(k) < 0 && SKIP.indexOf(k) < 0);
  for (const k of keys) {
    const tag = READ.indexOf(k) >= 0 ? "收 " : (SKIP.indexOf(k) >= 0 ? "不收" : "⚠ 未分类");
    console.log("  [" + tag + "] " + k.padEnd(26) + "（" + seen[k].length + " 个功能）");
  }
  ok(unclassified.length === 0, "每个字段都被显式归类（收 / 不收），没有悬空字段",
    unclassified.length ? "未分类：" + unclassified.join("、") : "");
  ok(READ.every((k) => keys.indexOf(k) >= 0), "7 个『收』的字段都真实出现过（检查表没过期）",
    READ.filter((k) => keys.indexOf(k) < 0).join("、"));

  // ── 第二类源：交接 JSON（`analysis\sr-gdd-handoff_*.json`）
  //    2026-09-29 补：原先整个 `analysis\` 没读，`calibrated_facts` 七条口径全漏，
  //    头脑风暴阶段因此显得极空（联盟悬赏阶段一 10 条，神话宝库/诸神降临 0 条）。
  console.log("\n  ── 交接 JSON 的字段 ──");
  const READ_HO = ["chosen_nucleus", "calibrated_facts", "assumption_ledger"];
  const SKIP_HO = [
    "handoff_id", "created_at", "source_skill", "target_skill", "topic", "materials",
    "risk_register_ref", "config_prediction_ref", "open_questions_for_gdd", "next_step",
    "handoff_type", "gdd_target",                    // 元信息：交接类型 / 目标文件形态
    "numeric_discipline",                            // 数值纪律声明（元信息，不是结论）
    // ⚠️ **同名不同义** —— 这条最容易误收：
    //    handoff 里的 settled_choices 是 **agent 的推荐**（`status: recommended_pending_confirm`，
    //    配套 note 写明"用户在交接门未对 T1–T7 逐条回复，以上为复刻规格中的推荐项"），
    //    不是"人拍板的设计结论"。decision 里那份（已 accepted）才是。按判据 → **不收**。
    "settled_choices", "settled_choices_note",
    "transfer_boundary", "sample_boundary", "open_unknowns"   // sr-analysis 的分析产出（属素材）
  ];
  const seenHo = {};
  for (const t of allFeatures()) {
    for (const h of collect(path.join(FEAT, t)).handoffs) {
      let j = null;
      try { j = JSON.parse(h.text); } catch (e) { continue; }
      for (const k of Object.keys(j)) {
        if (!seenHo[k]) seenHo[k] = [];
        if (seenHo[k].indexOf(t) < 0) seenHo[k].push(t);
      }
    }
  }
  const hoKeys = Object.keys(seenHo).sort();
  for (const k of hoKeys) {
    const tag = READ_HO.indexOf(k) >= 0 ? "收 " : (SKIP_HO.indexOf(k) >= 0 ? "不收" : "⚠ 未分类");
    console.log("  [" + tag + "] " + k.padEnd(26) + "（" + seenHo[k].length + " 个功能）");
  }
  const hoUn = hoKeys.filter((k) => READ_HO.indexOf(k) < 0 && SKIP_HO.indexOf(k) < 0);
  ok(hoUn.length === 0, "交接 JSON 的字段也全部显式归类", hoUn.length ? "未分类：" + hoUn.join("、") : "");
  ok(hoKeys.indexOf("calibrated_facts") >= 0, "calibrated_facts 真实出现（检查表没过期）");
}

// ══════════════════════════════════════════════════════════════
// ★ 逐功能核对：诸神降临的 settled_choices 必须出现（2026-09-29 漏项回归）
console.log("\n═══ 逐功能台账规模 ═══");
{
  const empties = [];
  for (const t of allFeatures()) {
    const inp = collect(path.join(FEAT, t));
    const L = buildLedger(inp);
    console.log("  " + t.padEnd(8) + " 条目 " + String(L.total).padStart(3) +
      "  （阶段 " + L.stages.map((s) => s.count).join(" / ") + "）" +
      (L.total === 0 ? "   ← 无任何决策记录" : ""));
    if (L.total === 0) empties.push(t);
  }
  // ★ 台账**允许为空**（新功能 / 还没拍板过），但必须**报出来**，不能静默。
  //   实测：英雄圣物就是空的 —— 它做完了头脑风暴、还出了 4 份宣讲 HTML，
  //   却**一份 decision 记录都没有**。这不是台账的 bug，是**留痕的缺口**；
  //   台账把它暴露了出来 —— "过程可追溯"的前提是过程先被记录下来。
  console.log("  空台账：" + (empties.length ? empties.join("、") + "（没有 decision 记录，值得看一眼是不是漏留痕了）" : "无"));

  // 单独验证那条漏项
  const zs = buildLedger(collect(path.join(FEAT, "诸神降临")));
  const txt = zs.stages.flatMap((s) => s.days.flatMap((d) => d.items.map((i) => i.text))).join(" ｜ ");
  ok(/命名「诸神降临」/.test(txt), "诸神降临的 settled_choices（T1 命名）已进台账");
  ok(/钥匙永久保留/.test(txt), "诸神降临的 settled_choices（T7）已进台账");
}

ok(led.stats.fromJsonl >= 1, "jsonl 补录 ≥1 条（decision 汇总确实会漏）", "实际 " + led.stats.fromJsonl);
// 精确：实测 round 12–17、19 在 decision 汇总里，**唯独 18 漏了**，只在 jsonl 里。
// 所以"round 18 那次改回"能否出现在台账，就是 jsonl 兜底是否生效的判据。
{
  const allText = led.stages.flatMap((s) => s.days.flatMap((d) => d.items.map((i) => i.text))).join(" ");
  ok(/改回/.test(allText), "round 18 的『改回』记录出现在台账里（jsonl 兜底生效）");
}

// 阶段判定抽查
ok(stageOfGate("设计核门") === 1, "gate『设计核门』→ 阶段一");
ok(stageOfGate("交接门/设计稿迭代") === 1, "gate『交接门/设计稿迭代』→ 阶段一");
ok(stageOfGate("成稿门") === 2, "gate『成稿门』→ 阶段二");
ok(stageOfGate("定稿门") === 2, "gate『定稿门』→ 阶段二（首次定稿属于文档生成）");
ok(stageOfGate("修订门") === 3, "gate『修订门』→ 阶段三");

// 排序：阶段内按时间升序
let orderOk = true;
for (const s of led.stages) {
  const ts = s.days.flatMap((d) => d.items.map((i) => String(i.ts)));
  for (let i = 1; i < ts.length; i++) if (ts[i] && ts[i - 1] && ts[i] < ts[i - 1]) orderOk = false;
}
ok(orderOk, "阶段内条目按时间升序");

// 不掺记录 ID（§7.2 规则 4）
const joined = led.stages.flatMap((s) => s.days.flatMap((d) => d.items.map((i) => i.text))).join(" ");
ok(!/OPT-/.test(joined), "台账正文不含门选项 ID（OPT-*）");
ok(!/DEC-\d{8}/.test(joined), "台账正文不含决策记录 ID（DEC-*）");

// ══════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(64));
console.log("以下就是面板「设计台账」页签会渲染的内容：");
console.log("═".repeat(64));
for (const s of led.stages) {
  if (!s.count) continue;
  console.log("\n## " + s.name + "   （" + s.count + " 条）");
  for (const d of s.days) {
    const shown = d.date ? d.date.slice(0, 4) + "-" + d.date.slice(4, 6) + "-" + d.date.slice(6, 8) : "（无日期）";
    console.log("\n### " + shown);
    for (const it of d.items) {
      const t = it.text.length > 96 ? it.text.slice(0, 96) + "…" : it.text;
      console.log("  - " + t);
    }
  }
}

console.log("\n" + "═".repeat(64));
console.log("断言：" + pass + " 通过 / " + fail + " 失败");
process.exit(fail ? 1 : 0);
