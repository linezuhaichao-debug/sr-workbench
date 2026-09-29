// 防漂移自查：client.js 里的内联 INTAKE 与 lib/intake-parse.js 必须是同一份逻辑。
// 为什么会有两份：DSH 的客户端加载器只服务 <pkg>/client.js（实测 /plugins/<pkg>/intake-parse.js → 404），
// 跨文件复用不成立，所以逻辑内联；ESM 那份保留给 node 离线回归（test-intake.mjs）。
// 跑法：node sync-intake.js
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "lib");
const SRC = path.join(DIR, "intake-parse.js");   // ESM 源（含 export 关键字，可被 node 直接跑）
const CLI = path.join(DIR, "client.js");         // 内联副本（浏览器实际执行的那份）

const FUNCS = [
  "parseMaterial", "parseMaterials", "baseName", "extOf", "isDoc", "isTextExt",
  "deriveTopic", "safeName", "describeMaterials", "hasPathMaterial", "buildInstruction"
];
const CONSTS = ["DOC_EXT", "TEXT_EXT", "INTAKE_KINDS"];

/** 取出一段大括号平衡的块（从 open 的位置开始，含首尾括号） */
function balanced(text, openIdx, open, close) {
  let depth = 0, i = openIdx;
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return text.slice(openIdx, i + 1); }
  }
  return "";
}

/** 抽一个具名函数的完整声明（含函数体） */
function grabFunction(text, name) {
  const re = new RegExp("(?:^|\\n)[ \\t]*(?:export[ \\t]+)?function[ \\t]+" + name + "[ \\t]*\\(");
  const m = re.exec(text);
  if (!m) return "";
  const open = text.indexOf("{", m.index);
  if (open < 0) return "";
  return balanced(text, open, "{", "}");
}

/** 抽一个 const 声明的完整初始化值（数组/对象） */
function grabConst(text, name) {
  const re = new RegExp("(?:^|\\n)[ \\t]*(?:export[ \\t]+)?const[ \\t]+" + name + "[ \\t]*=");
  const m = re.exec(text);
  if (!m) return "";
  const eq = text.indexOf("=", m.index);
  let i = eq + 1;
  while (i < text.length && /\s/.test(text[i])) i++;
  const open = text[i];
  const close = open === "[" ? "]" : open === "{" ? "}" : "";
  if (close === "") return "";
  return balanced(text, i, open, close);
}

/** 归一化：只比结构，不比空白、也不比注释（两份的说明文字本来就该各按各的语境写） */
function norm(s) {
  return String(s)
    .replace(/\/\*[\s\S]*?\*\//g, "")                 // 块注释
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")             // 行注释（避开 https:// 里的 //）
    .replace(/\s+/g, "");
}

const esm = fs.readFileSync(SRC, "utf8");
const cli = fs.readFileSync(CLI, "utf8");

// 只取 client.js 里 INTAKE 那个 IIFE，避免误匹配到别处同名函数
const iifeStart = cli.indexOf("const INTAKE = (function () {");
if (iifeStart < 0) { console.error("❌ client.js 里找不到内联的 INTAKE IIFE"); process.exit(1); }
const iifeOpen = cli.indexOf("{", cli.indexOf("(function ()", iifeStart));
const iife = balanced(cli, iifeOpen, "{", "}");

let bad = 0;
for (const name of FUNCS.concat(CONSTS)) {
  const a = CONSTS.indexOf(name) >= 0 ? grabConst(esm, name) : grabFunction(esm, name);
  const b = CONSTS.indexOf(name) >= 0 ? grabConst(iife, name) : grabFunction(iife, name);
  if (a === "" || b === "") {
    console.log("❌ " + name + "：在" + (a === "" ? "intake-parse.js" : "client.js") + " 里找不到");
    bad++;
    continue;
  }
  if (norm(a) !== norm(b)) {
    console.log("❌ " + name + "：两份实现不一致（改了一处、忘了另一处）");
    bad++;
    continue;
  }
  console.log("✅ " + name);
}

// 暴露面也要齐（内联那份返回的对象里不能漏方法）
const retIdx = iife.lastIndexOf("return {");
if (retIdx < 0) { console.log("❌ 找不到内联 INTAKE 的 return 对象"); bad++; }
else {
  const open = iife.indexOf("{", retIdx);
  const have = balanced(iife, open, "{", "}");
  const missing = FUNCS.concat(["INTAKE_KINDS"]).filter((n) => have.indexOf(n) < 0);
  if (missing.length > 0) { console.log("❌ 内联 INTAKE 返回对象缺：" + missing.join("、")); bad++; }
  else console.log("✅ 内联 INTAKE 的返回对象齐全（" + FUNCS.length + " 个方法 + INTAKE_KINDS）");
}

console.log(bad === 0 ? "\n★ 两份实现一致（无漂移）" : "\n★ 有 " + bad + " 处漂移，必须同步后再继续");
process.exit(bad === 0 ? 0 : 1);
