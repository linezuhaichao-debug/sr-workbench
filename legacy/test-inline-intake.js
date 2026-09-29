// 内联副本的**可执行**回归：把 client.js 里的 INTAKE IIFE 抽出来在 node 里跑一遍。
// 为什么需要：sync-intake.js 只证明两份文本一致，不证明**浏览器里执行的那份**行为正确。
// 跑法：node test-inline-intake.js
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const P = require("./intake-parse.js");

const CLI = path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(CLI, "utf8");

// ── 抽 IIFE（大括号平衡） ───────────────────────────────────
function balanced(text, openIdx, open, close) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return text.slice(openIdx, i + 1); }
  }
  return "";
}
const start = src.indexOf("const INTAKE = (function () {");
if (start < 0) { console.error("❌ 找不到内联 INTAKE"); process.exit(1); }
// ★ 从 `function` 起抽到 `}` 为止，再自己补上 ( ... )() ——
//   直接保留源码里的 `(function` 会拼出 `((function(){…})()` 这种双括号（第一次就栽在这）。
const fnIdx = src.indexOf("function ()", start);
const braceIdx = src.indexOf("{", fnIdx);
const body = balanced(src, braceIdx, "{", "}");
if (body === "") { console.error("❌ INTAKE IIFE 括号不平衡"); process.exit(1); }
const tail = src.slice(braceIdx + body.length, braceIdx + body.length + 10);
if (!/^\s*\)\s*\(\s*\)/.test(tail)) { console.error("❌ INTAKE IIFE 结尾不是 })()：实际是 " + JSON.stringify(tail)); process.exit(1); }
const iife = "(" + src.slice(fnIdx, braceIdx) + body + ")()";

// ── 在 node 里求值（IIFE 用的是浏览器里那套语法，这里同样能跑） ──
let inline;
try {
  inline = new Function("return (" + iife + ");")();
} catch (e) {
  console.error("❌ 内联 INTAKE 求值失败：" + e.message);
  process.exit(1);
}
console.log("✅ 内联 INTAKE 求值成功（" + Object.keys(inline).length + " 个导出）");

let n = 0, bad = 0;
const t = (name, fn) => {
  n++;
  try { fn(); console.log("✅ " + name); }
  catch (e) { bad++; console.log("❌ " + name + "\n   " + String(e.message).split("\n")[0]); }
};

// ── 与 ESM 源逐项对照（同一批输入 → 同一批输出） ─────────────
const CASES = [
  ["parseMaterial", ["E:\\a\\b.md"]],
  ["parseMaterial", ["https://x.com/y"]],
  ["parseMaterial", ["一句中文"]],
  ["parseMaterials", ["E:\\a\\b.md\n说明文字\nD:\\docs\\V0.3"]],
  ["baseName", ["D:\\x\\y\\z.docx"]],
  ["extOf", ["A.XLSM"]],
  ["isDoc", ["a.mp4"]],
  ["isTextExt", ["a.docx"]],
  ["deriveTopic", [[{ kind: "file", path: "E:\\a\\联盟悬赏_20260921_定稿.md" }]]],
  ["deriveTopic", [[{ kind: "text", text: "神话宝库" }]]],
  ["deriveTopic", [[]]],
  ["safeName", ['A/B:C*D?E"F<G>H|I']],
  ["describeMaterials", [[{ kind: "dir", path: "D:\\a" }, { kind: "url", path: "https://x" }, { kind: "text", text: "t" }]]],
  ["hasPathMaterial", [[{ kind: "text", text: "t" }]]],
  ["buildInstruction", ["analysis", { materials: [{ kind: "file", path: "E:\\a.mp4" }], note: "目标", srWs: "D:\\ws\\" }]],
  ["buildInstruction", ["analysis", { materials: [{ kind: "text", text: "t" }] }]],
  ["buildInstruction", ["concept", { materials: [{ kind: "text", text: "间谍偷科技" }], srWs: "D:\\ws" }]],
  ["buildInstruction", ["concept", { materials: [] }]],
  ["buildInstruction", ["import", { materials: [{ kind: "dir", path: "D:\\d" }, { kind: "file", path: "D:\\d\\a.docx" }], srWs: "D:/ws/" }]],
  ["buildInstruction", ["manual", { title: "标题", note: "正文", upstream: "x-1", srWs: "D:\\ws" }]],
  ["buildInstruction", ["manual", { title: "标题" }]],
  ["buildInstruction", ["nope", {}]]
];
for (const [fn, args] of CASES) {
  t("与 ESM 源一致：" + fn + "(" + JSON.stringify(args).slice(0, 70) + "…)", () => {
    assert.deepStrictEqual(inline[fn].apply(null, args), P[fn].apply(null, args));
  });
}

// ── 内联副本自己的行为断言（不依赖 ESM，防止两边一起错） ──────
t("四个按钮的 id 与标签齐全", () => {
  assert.deepStrictEqual(inline.INTAKE_KINDS.map((k) => k.id), ["analysis", "concept", "import", "manual"]);
  assert.strictEqual(inline.INTAKE_KINDS[0].label, "竞品分析");
});
t("方式1 指令里带的是 skill 的正规调用形式（不是 commands.execute）", () => {
  const r = inline.buildInstruction("analysis", { materials: [{ kind: "url", path: "https://x.com/v" }], srWs: "D:\\ws" });
  assert.ok(r.instruction.indexOf("/sr-analysis") >= 0);
  assert.ok(r.instruction.indexOf("https://x.com/v") >= 0);
});
t("方式3 指令落点是 inbox\\imported\\，且声明不改 skill", () => {
  const r = inline.buildInstruction("import", { materials: [{ kind: "dir", path: "D:\\d" }], srWs: "D:\\ws" });
  assert.ok(r.instruction.indexOf("D:\\ws\\inbox\\imported\\") >= 0);
  assert.ok(r.instruction.indexOf("不要改动任何 sr skill") >= 0);
});
t("方式4 落点是 inbox\\manual\\，frontmatter 有 source: human", () => {
  const r = inline.buildInstruction("manual", { title: "T", note: "B", srWs: "D:\\ws" });
  assert.ok(r.instruction.indexOf("D:\\ws\\inbox\\manual\\ 下新建 T.md") >= 0, "实际：" + r.instruction.split("\n")[0]);
  assert.ok(r.instruction.indexOf("source: human") >= 0);
});
t("srWs 为空时不抛错（由调用方先挡住）", () => {
  assert.doesNotThrow(() => inline.buildInstruction("import", { materials: [{ kind: "dir", path: "D:\\d" }] }));
});
t("ASCII 源码：内联块里没有非 ASCII 标识符（只有数据里的中文）", () => {
  // 只检查标识符位置：形如 const/function 后面跟的名字必须是 ASCII
  const ids = iife.match(/(?:const|let|var|function)\s+([^\s(=]+)/g) || [];
  const badIds = ids.filter((s) => /[^\x00-\x7F]/.test(s));
  assert.deepStrictEqual(badIds, []);
});

console.log("\n共 " + n + " 项，" + (bad === 0 ? "全部通过" : bad + " 项失败"));
process.exit(bad === 0 ? 0 : 1);
