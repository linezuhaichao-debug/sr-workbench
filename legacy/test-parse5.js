// 离线验证 §5 解析器：抽出真实 parseInterfaceSection，跑真实定稿
const fs = require("fs");
const SRC = "D:\\TimeMachine\\sr-workbench\\lib\\client.js";
const src = fs.readFileSync(SRC, "utf8");

const a = src.indexOf("function parseInterfaceSection(text) {");
const b = src.indexOf("/** 折叠起来的原始返回");
if (a < 0 || b < 0 || b <= a) { console.error("抽取失败 a=" + a + " b=" + b); process.exit(1); }
// 注意：不要用正则剥注释（会把 /^\// 之类切断）

/**
 * ★ 2026-09-28 修：新增的收件箱代码把 a..b 这段区间撑大了（结束标记被推后），
 *   片段里因此带进了需要模块级常量的 JSX —— 直接 eval 会 ReferenceError: C is not defined。
 *   解法：把这些常量**从源码里按名字精确抽出来**拼在前面（比 stub 更忠实：常量值也一起被验了）。
 */
function grabConst(text, name) {
  const re = new RegExp("(?:^|\\n)[ \\t]*const[ \\t]+" + name + "[ \\t]*=");
  const m = re.exec(text);
  if (!m) return "";
  const eq = text.indexOf("=", m.index);
  let i = eq + 1;
  while (i < text.length && /\s/.test(text[i])) i++;
  const open = text[i], close = open === "[" ? "]" : open === "{" ? "}" : "";
  if (close === "") return text.slice(m.index, text.indexOf("\n", i)).trim();
  let depth = 0;
  for (let k = i; k < text.length; k++) {
    if (text[k] === open) depth++;
    else if (text[k] === close) { depth--; if (depth === 0) return text.slice(m.index, k + 1).trim() + ";"; }
  }
  return "";
}
const NEEDED = ["C", "INLINE_TEXT_CAP", "ASSET_TYPE_LABEL", "REVIEW_TONE", "REVIEW_LABEL",
  "IMG_EXT", "MD_EXT", "JSON_EXT", "PRESTYLE", "MD_SPECS"];
const frag = src.slice(a, b);
// 片段自己已经声明过的名字不能再前置（否则 SyntaxError: Identifier 'x' has already been declared）
const declared = (name) => new RegExp("(?:^|[\\s;{}])const[ \\t]+" + name + "[ \\t]*=").test(frag);
const need = NEEDED.filter((n) => !declared(n));
const preamble = need.map((n) => grabConst(src, n)).filter((x) => x !== "").join("\n");
const missing = need.filter((n) => grabConst(src, n) === "");
if (missing.length > 0) { console.error("❌ 抽不到常量：" + missing.join("、")); process.exit(1); }
console.log("前置常量：" + (need.join("、") || "（无）") + "　片段内已自带：" + (NEEDED.filter(declared).join("、") || "（无）"));

const parseInterfaceSection = new Function(
  preamble + "\nconst contract = { INTAKE_KINDS: [], isTextExt: () => false, isDoc: () => false };\n" +
  frag + "\nreturn parseInterfaceSection;"
)();

const MD = "D:\\TimeMachine\\GameDesignOS\\workspace\\proposals\\联盟悬赏_20260923_定稿.md";
const text = fs.readFileSync(MD, "utf8");
const r = parseInterfaceSection(text);

if (!r) { console.error("❌ 没找到 §5"); process.exit(1); }

console.log("═══ §5.0 界面清单（" + r.uiRows.length + " 行）═══");
for (const u of r.uiRows) {
  console.log("  " + u.id + " | " + u.name);
  console.log("      进入：" + u.enter);
  console.log("      退出：" + u.exit);
}

console.log("\n═══ 边界声明（" + r.boundary.length + " 字）═══");
console.log("  " + r.boundary.slice(0, 150) + "…");

console.log("\n═══ 各 UI 小节（" + r.uis.length + " 个）═══");
for (const u of r.uis) {
  console.log("  " + u.id + " — " + u.title + "   UE 规则 " + u.ueCount + " 条，图 " + u.images.length + " 张");
  for (const im of u.images) console.log("      img: " + im);
}

// 断言
let bad = 0;
const expect = (cond, msg) => { console.log((cond ? "✅ " : "❌ ") + msg); if (!cond) bad++; };
console.log("\n═══ 断言 ═══");
expect(r.uiRows.length === 4, "§5.0 应解析出 4 行界面（实测 UI-M1..M4）");
expect(r.uiRows[0].id === "UI-M1", "第一行应是 UI-M1");
expect(r.uis.length === 4, "应解析出 4 个 UI 小节");
expect(r.uis.every((u) => u.images.length >= 1), "每个 UI 至少一张图");
const totalImgs = r.uis.reduce((n, u) => n + u.images.length, 0);
expect(totalImgs === 7, "图片引用总数应为 7（实测目录里正好 7 张 png），实际 " + totalImgs);
expect(r.uis.reduce((n, u) => n + u.ueCount, 0) > 10, "UE 规则总条数应 > 10");
expect(r.boundary.indexOf("边界") >= 0 || r.boundary.length > 20, "边界声明应非空");

// 图片文件是否真实存在
console.log("\n═══ 图片文件存在性 ═══");
const path = require("path");
const dir = path.dirname(MD);
for (const u of r.uis) for (const im of u.images) {
  const abs = path.join(dir, im);
  const ok = fs.existsSync(abs);
  if (!ok) bad++;
  console.log((ok ? "✅ " : "❌ ") + im);
}

console.log("\n" + (bad ? "★ " + bad + " 项不符" : "★ 全部通过"));
process.exit(bad ? 1 : 0);
