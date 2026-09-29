// 收件箱纯逻辑回归：素材解析 / 主题派生 / 四种方式的指令组装
// 跑法：node test-intake.mjs
import assert from "assert";
import * as P from "./intake-parse.js";

let n = 0, bad = 0;
const t = (name, fn) => {
  n++;
  try { fn(); console.log("✅ " + name); }
  catch (e) { bad++; console.log("❌ " + name + "\n   " + String(e.message).split("\n")[0]); }
};

// ── 素材解析 ────────────────────────────────────────────────
t("目录路径（带尾分隔符）判为 dir", () => {
  assert.strictEqual(P.parseMaterial("E:\\LW记录\\V0.3旧案\\")[0].kind, "dir");
});
t("目录路径（无尾分隔符、无扩展名）判为 dir", () => {
  assert.strictEqual(P.parseMaterial("E:\\LW记录\\V0.3旧案")[0].kind, "dir");
});
t("盘符根判为 dir", () => {
  assert.strictEqual(P.parseMaterial("D:\\")[0].kind, "dir");
});
t("带扩展名的路径判为 file（磁盘根路径原样保留）", () => {
  const m = P.parseMaterial("E:\\LW记录\\体验报告.docx")[0];
  assert.strictEqual(m.kind, "file");
  assert.strictEqual(m.path, "E:\\LW记录\\体验报告.docx");
});
t("http(s) 链接判为 url", () => {
  assert.strictEqual(P.parseMaterial("https://www.bilibili.com/video/BV1xx")[0].kind, "url");
});
t("普通中文句子判为 text", () => {
  const m = P.parseMaterial("联盟榜同分时的排序口径")[0];
  assert.strictEqual(m.kind, "text");
  assert.strictEqual(m.text, "联盟榜同分时的排序口径");
});
t("空串 → 空数组", () => {
  assert.deepStrictEqual(P.parseMaterial("   "), []);
});
t("混合多行：路径逐行成项、散文合并为一段 text", () => {
  const ms = P.parseMaterials([
    "E:\\rec\\新手期首战.mp4",
    "这条录屏想确认钥匙到账的可见性",
    "D:\\docs\\V0.3旧案"
  ].join("\n"));
  assert.strictEqual(ms.length, 3);
  assert.strictEqual(ms[0].kind, "file");
  assert.strictEqual(ms[1].kind, "text");
  assert.strictEqual(ms[1].text, "这条录屏想确认钥匙到账的可见性");
  assert.strictEqual(ms[2].kind, "dir");
});
t("多行路径之间夹散文：散文不吞掉路径", () => {
  const ms = P.parseMaterials("A 计划\nE:\\a\\b.md\n第二行说明\nhttps://x.com/y");
  assert.deepStrictEqual(ms.map((m) => m.kind), ["text", "file", "text", "url"]);
});

// ── 主题派生 ────────────────────────────────────────────────
t("主题派生：去扩展名 + 去日期 + 去尾部噪音", () => {
  assert.strictEqual(P.deriveTopic([{ kind: "file", path: "E:\\a\\联盟悬赏_20260921_定稿.md" }]), "联盟悬赏");
});
t("主题派生：目录名原样（不剥日期）", () => {
  assert.strictEqual(P.deriveTopic([{ kind: "dir", path: "E:\\a\\V0.3旧案" }]), "V0.3旧案");
});
t("主题派生：无路径素材时退到文本首句", () => {
  assert.strictEqual(P.deriveTopic([{ kind: "text", text: "神话宝库" }]), "神话宝库");
});
t("主题派生：无素材 → 空串", () => {
  assert.strictEqual(P.deriveTopic([]), "");
});

// ── 文件名安全 ──────────────────────────────────────────────
t("safeName 替换非法字符并限长", () => {
  assert.strictEqual(P.safeName('联盟/榜:同分?"'), "联盟_榜_同分__");
  assert.strictEqual(P.safeName("x".repeat(80)).length, 60);
});

// ── 方式 1 · 竞品分析 ───────────────────────────────────────
const A = P.buildInstruction("analysis", {
  materials: [{ kind: "file", path: "E:\\rec\\新手期首战.mp4" }],
  note: "确认钥匙到账的可见性",
  srWs: "D:\\TimeMachine\\GameDesignOS\\workspace"
});
t("方式1：指令含 /sr-analysis 与素材路径", () => {
  assert.ok(A.instruction.indexOf("/sr-analysis") >= 0);
  assert.ok(A.instruction.indexOf("E:\\rec\\新手期首战.mp4") >= 0);
  assert.ok(A.instruction.indexOf("确认钥匙到账的可见性") >= 0);
  assert.strictEqual(A.blocked, "");
});
t("方式1：只有纯文本（无路径/链接）时被前置挡住", () => {
  const r = P.buildInstruction("analysis", { materials: [{ kind: "text", text: "随便写点什么" }] });
  assert.ok(r.blocked.indexOf("竞品分析") >= 0);
  assert.strictEqual(r.instruction, "");
});

// ── 方式 2 · 问答式访谈 ─────────────────────────────────────
const C = P.buildInstruction("concept", {
  materials: [{ kind: "file", path: "D:\\ref\\参考游戏笔记.md" }],
  note: "玩家互相派遣间谍偷科技",
  srWs: "D:\\ws"
});
t("方式2：指令含 /sr-concept 与创意原文", () => {
  assert.ok(C.instruction.indexOf("/sr-concept") >= 0);
  assert.ok(C.instruction.indexOf("玩家互相派遣间谍偷科技") >= 0);
  assert.ok(C.instruction.indexOf("参考游戏笔记.md") >= 0);
  assert.ok(C.instruction.indexOf("没有。") < 0, "有路径素材时不应写「没有」");
});
t("方式2：无创意文本时被挡住", () => {
  const r = P.buildInstruction("concept", { materials: [] });
  assert.ok(r.blocked.indexOf("问答式访谈") >= 0);
});
t("方式2：无路径素材时明确写「已有材料：没有。」", () => {
  const r = P.buildInstruction("concept", { materials: [{ kind: "text", text: "文明奇观争夺" }] });
  assert.ok(r.instruction.indexOf("已有材料：没有。") >= 0);
});
t("方式2：创意取 note，纯文本兜底", () => {
  const r1 = P.buildInstruction("concept", { note: "间谍偷科技", materials: [{ kind: "text", text: "别的" }] });
  assert.ok(r1.instruction.indexOf("创意：间谍偷科技") >= 0);
  const r2 = P.buildInstruction("concept", { materials: [{ kind: "text", text: "文明奇观争夺" }] });
  assert.ok(r2.instruction.indexOf("创意：文明奇观争夺") >= 0);
});

// ── 方式 3 · 旧文档导入 ─────────────────────────────────────
const I = P.buildInstruction("import", {
  materials: [
    { kind: "dir", path: "D:\\docs\\V0.3旧案" },
    { kind: "file", path: "D:\\docs\\补充说明.docx" }
  ],
  note: "成稿时按章节对照",
  srWs: "D:\\TimeMachine/GameDesignOS/workspace/"
});
t("方式3：目录与文件分别交代落点", () => {
  assert.ok(I.instruction.indexOf("inbox\\imported\\") >= 0);
  assert.ok(I.instruction.indexOf("V0.3旧案") >= 0);
  assert.ok(I.instruction.indexOf("补充说明") >= 0);
});
t("方式3：srWs 反斜杠归一 + 去尾分隔符", () => {
  assert.ok(I.instruction.indexOf("D:\\TimeMachine\\GameDesignOS\\workspace\\inbox") >= 0);
  assert.ok(I.instruction.indexOf("D:\\TimeMachine/GameDesignOS") < 0, "不该残留正斜杠");
});
t("方式3：带 refresh_asset_index.py 与「基准路径」提示", () => {
  assert.ok(I.instruction.indexOf("python scripts/refresh_asset_index.py") >= 0);
  assert.ok(I.instruction.indexOf("不要依赖当前工作目录") >= 0);
});
t("方式3：声明只登记不提升、不改 skill", () => {
  assert.ok(I.instruction.indexOf("needs_review") >= 0);
  assert.ok(I.instruction.indexOf("不要改动任何 sr skill") >= 0);
});
t("方式3：只给纯文本时被挡住", () => {
  const r = P.buildInstruction("import", { materials: [{ kind: "text", text: "一段话" }] });
  assert.ok(r.blocked.indexOf("旧文档导入") >= 0);
});

// ── 方式 4 · 人工补充 ───────────────────────────────────────
const M = P.buildInstruction("manual", {
  materials: [],
  title: "联盟榜同分时的排序口径",
  note: "同分时按到达时间排序",
  upstream: "analysis-0007",
  srWs: "D:\\ws"
});
t("方式4：写 inbox\\manual\\ 且带 frontmatter", () => {
  assert.ok(M.instruction.indexOf("inbox\\manual\\") >= 0);
  assert.ok(M.instruction.indexOf("联盟榜同分时的排序口径.md") >= 0);
  assert.ok(M.instruction.indexOf("source: human") >= 0);
  assert.ok(M.instruction.indexOf("upstream_asset: analysis-0007") >= 0);
});
t("方式4：无标题时用主题兜底", () => {
  const r = P.buildInstruction("manual", {
    materials: [{ kind: "file", path: "D:\\a\\神话宝库_20260915.md" }], note: "正文"
  });
  assert.ok(r.instruction.indexOf("神话宝库.md") >= 0);
});
t("方式4：缺正文被挡住", () => {
  const r = P.buildInstruction("manual", { title: "标题" });
  assert.ok(r.blocked.indexOf("正文") >= 0);
});
t("方式4：标题里的非法字符被清洗（不会拼出非法路径）", () => {
  const r = P.buildInstruction("manual", { title: 'A/B:C*D?E"F<G>H|I', note: "x" });
  assert.ok(r.instruction.indexOf("A_B_C_D_E_F_G_H_I.md") >= 0);
});

// ── 元数据与分类 ────────────────────────────────────────────
t("INTAKE_KINDS 恰好四种，且 id 齐全", () => {
  assert.deepStrictEqual(P.INTAKE_KINDS.map((k) => k.id), ["analysis", "concept", "import", "manual"]);
});
t("文档类 / 文本类扩展名判定", () => {
  assert.strictEqual(P.isDoc("a.md"), true);
  assert.strictEqual(P.isDoc("a.xlsm"), true);
  assert.strictEqual(P.isDoc("a.mp4"), false);
  assert.strictEqual(P.isDoc("无扩展名"), false);
  assert.strictEqual(P.isTextExt("a.md"), true);
  assert.strictEqual(P.isTextExt("a.json"), true);
  assert.strictEqual(P.isTextExt("a.docx"), false);
});
t("未知方式返回 blocked 而不是抛错", () => {
  assert.ok(P.buildInstruction("nope", {}).blocked.indexOf("未知的输入方式") >= 0);
});
t("对 undefined 入参不抛错", () => {
  assert.doesNotThrow(() => P.buildInstruction("manual", void 0));
  assert.doesNotThrow(() => P.deriveTopic(void 0));
  assert.doesNotThrow(() => P.parseMaterials(void 0));
  assert.doesNotThrow(() => P.describeMaterials(void 0));
  assert.doesNotThrow(() => P.hasPathMaterial(void 0));
});

console.log("\n共 " + n + " 项，" + (bad === 0 ? "全部通过" : bad + " 项失败"));
process.exit(bad === 0 ? 0 : 1);
