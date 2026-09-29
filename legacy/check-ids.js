// 未声明标识符扫描：组件体里引用了既不在自己作用域、也不在 factory 顶层的名字 → 渲染期白屏。
//
// 为什么需要：2026-09-28 收件箱上线时白屏 —— `ReferenceError: notice is not defined`
//   at AssetsPanel。原因是在 AssetsPanel 里插了 `notice ? h(NoticeBar,…)`，
//   而 `notice` 只在外层 Panel 作用域里存在。**syntax-check 全绿、页面白屏**。
//   已有的 16 条检查都是模式匹配，抓不到"引用了未声明的名字"这一类。
//
// 跑法：node check-ids.js
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(FILE, "utf8");

/** 已知全局（浏览器 + DSH 外壳） */
const GLOBALS = new Set([
  "window", "document", "console", "navigator", "location", "origin", "fetch", "URL",
  "URLSearchParams", "Promise", "Object", "Array", "String", "Number", "Boolean", "Math",
  "JSON", "Date", "RegExp", "Error", "TypeError", "Map", "Set", "WeakMap", "Symbol",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame",
  "AbortController", "FileReader", "Blob", "File", "FormData", "btoa", "atob", "TextEncoder",
  "TextDecoder", "Uint8Array", "ArrayBuffer", "encodeURIComponent", "decodeURIComponent",
  "isNaN", "parseInt", "parseFloat", "undefined", "NaN", "Infinity", "globalThis",
  "structuredClone", "queueMicrotask", "React", "process", "require", "module", "exports"
]);

/** 语言关键字 + 字面量（避免误报） */
const KEYWORDS = new Set([
  "if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue",
  "return", "function", "class", "new", "delete", "typeof", "instanceof", "in", "of", "void",
  "this", "super", "null", "true", "false", "try", "catch", "finally", "throw", "yield",
  "async", "await", "const", "let", "var", "extends", "static", "get", "set", "import", "export"
]);

/** 去掉注释与字符串/模板内容（避免把中文提示当成标识符） */
function strip(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (c === "/" && n === "/") { while (i < text.length && text[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*") { i += 2; while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; i++;
      while (i < text.length) {
        if (text[i] === "\\") { i += 2; continue; }
        if (text[i] === q) { i++; break; }
        // 模板里的 ${...} 里是代码，保留它（否则会漏掉真实引用）
        if (q === "`" && text[i] === "$" && text[i + 1] === "{") {
          let depth = 1; i += 2; const start = i;
          while (i < text.length && depth > 0) {
            if (text[i] === "{") depth++;
            else if (text[i] === "}") depth--;
            i++;
          }
          out += " " + text.slice(start, i - 1) + " ";
          continue;
        }
        i++;
      }
      out += " ";
      continue;
    }
    out += c; i++;
  }
  return out;
}

/** 用大括号平衡取出从 open 位置起的块 */
function balanced(text, openIdx, open, close) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) { depth--; if (depth === 0) return { body: text.slice(openIdx, i + 1), end: i }; }
  }
  return { body: "", end: -1 };
}

/** 收一个块内所有"声明出来的名字"：var/let/const/function/class 名字 + 解构 + 参数 + 形参对象 */
function declaredNames(block) {
  const names = new Set();
  const add = (n) => { if (n && /^[A-Za-z_$][\w$]*$/.test(n)) names.add(n); };

  // const/let/var NAME =  /  function NAME(  /  class NAME
  for (const m of block.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of block.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of block.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  // 解构：const { a, b: c } = … / const [a, b] = …
  for (const m of block.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const t = part.split(":").pop().trim();
      add(t.replace(/=.*$/, "").trim());
    }
  }
  for (const m of block.matchAll(/\b(?:const|let|var)\s*\[([^\]]*)\]/g)) {
    for (const part of m[1].split(",")) add(part.replace(/=.*$/, "").trim());
  }
  // 函数参数（简版：所有 (...) => 与 function (...) —— 取标识符与解构键）
  for (const m of block.matchAll(/\(([^()]*)\)\s*=>/g)) for (const part of m[1].split(",")) {
    const t = part.split(":").pop().trim();
    add(t.replace(/=.*$/, "").replace(/[{}\[\].]/g, " ").trim().split(/\s+/)[0]);
    for (const k of part.replace(/[{}\[\]]/g, " ").split(/[,\s]+/)) add(k);
  }
  for (const m of block.matchAll(/function\s*\*?\s*[A-Za-z_$\w]*\s*\(([^()]*)\)/g)) for (const part of m[1].split(",")) {
    add(part.split(":").pop().trim().replace(/=.*$/, "").trim());
  }
  // catch (e) / for (const x of y)
  for (const m of block.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) add(m[1]);
  return names;
}

/** 块里所有"被使用到的"标识符（排除属性访问、排除对象字面量的键） */
function usedNames(block) {
  const out = [];
  const re = /([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    const name = m[1];
    const before = block.slice(Math.max(0, m.index - 24), m.index);
    const after = block.slice(m.index + name.length, m.index + name.length + 24);
    // 属性访问 a.name / ?.name → 跳过
    if (/[.?]\s*$/.test(before)) continue;
    // 对象字面量的键 { name: … } → 跳过（值部分会被后续匹配到）
    if (/^\s*:/.test(after) && !/^\s*::/.test(after)) continue;
    // 标签 / 三元里的冒号右侧不算（保守起见不特殊处理）
    if (KEYWORDS.has(name)) continue;
    out.push({ name: name, index: m.index });
  }
  return out;
}

// ── 取 factory 与顶层声明 ───────────────────────────────────
const fStart = src.indexOf("factory: (require) => {");
const fOpen = src.indexOf("{", fStart);
const factory = balanced(src, fOpen, "{", "}").body;
const factoryClean = strip(factory);
const topLevel = declaredNames(factoryClean);

// —— 顶层声明收集不完整（正则简版），再加一层：源码里任何 `名字 =` 赋值目标也算已声明
for (const m of factoryClean.matchAll(/(?:^|[\s;{}(,])([A-Za-z_$][\w$]*)\s*=(?!=)/g)) topLevel.add(m[1]);
// h / React 等来自 factory 外的名字
for (const g of GLOBALS) topLevel.add(g);
topLevel.add("h");

// ── 逐个「看起来像组件/handler」的具名函数做检查 ──────────────
const FN_RE = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
let m, bad = 0, checked = 0;
const reports = [];
while ((m = FN_RE.exec(factory)) !== null) {
  const name = m[1];
  const braceIdx = factory.indexOf("{", FN_RE.lastIndex);
  if (braceIdx < 0) continue;
  const body = balanced(factory, braceIdx, "{", "}").body;
  if (body === "") continue;
  const clean = strip(body);
  const local = declaredNames(clean);
  // 该函数自己的名字（递归调用）也算可见
  local.add(name);
  const unknown = new Map();
  for (const u of usedNames(clean)) {
    if (local.has(u.name) || topLevel.has(u.name)) continue;
    if (!unknown.has(u.name)) unknown.set(u.name, u.index);
  }
  if (unknown.size > 0) {
    checked++;
    // 行号：把 body 内偏移换算回文件行
    const absStart = fOpen + braceIdx;
    const lineOf = (off) => src.slice(0, absStart + off).split("\n").length;
    const items = [...unknown.entries()].map(([n, off]) => n + " (≈L" + lineOf(off) + ")");
    // 只报"看起来像变量"的（纯大写常量名也报——正是 notice/C 这类）
    reports.push({ fn: name, items: items });
  }
}

if (reports.length === 0) {
  console.log("✅ 未声明标识符扫描：0 处（所有具名函数里引用的名字都能在自身或 factory 顶层找到）");
} else {
  bad = reports.length;
  console.log("❌ 未声明标识符扫描：以下函数引用了找不到声明的名字（渲染期会白屏）");
  for (const r of reports) console.log("   " + r.fn + " → " + r.items.join("、"));
}

// ── 自证：故意注入一个未声明的名字，扫描必须抓到 ──────────────
const probe = factory.replace("function ArtifactList(props) {", "function ArtifactList(props) { const __probe = __definitely_undeclared_name;");
let selfTestOk = false;
{
  const b2 = probe.indexOf("{", probe.indexOf("function ArtifactList"));
  const body2 = balanced(probe, b2, "{", "}").body;
  const clean2 = strip(body2);
  const local2 = declaredNames(clean2); local2.add("ArtifactList");
  selfTestOk = usedNames(clean2).some((u) => u.name === "__definitely_undeclared_name" && !local2.has(u.name) && !topLevel.has(u.name));
}
console.log((selfTestOk ? "✅ " : "❌ ") + "自证：注入的未声明名字能被扫到" + (selfTestOk ? "" : "（扫描器本身失灵，结果不可信）"));
if (!selfTestOk) bad++;

console.log(bad === 0 ? "\n★ 通过" : "\n★ 有 " + bad + " 项未通过");
process.exit(bad === 0 ? 0 : 1);
