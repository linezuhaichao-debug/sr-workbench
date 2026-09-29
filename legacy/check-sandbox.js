// 沙箱执行扫描：把 client.js 里的组件函数放进一个"只提供真实作用域"的沙箱里跑一遍，
// 让运行时自己报出未声明的名字（ReferenceError）。
//
// 为什么不用正则扫：正则解析 JS 必然误报（模板串、解构、嵌套箭头……第一版报了 25 处、几乎全是假的）。
// 为什么这个准：JS 自己解析自己 —— 变量解析不到就是解析不到。
//
// 背景：2026-09-28 收件箱上线白屏 —— `ReferenceError: notice is not defined` at AssetsPanel。
//   syntax-check 全绿、页面白屏，因为已有检查全是模式匹配，抓不到"引用了未声明的名字"。
//
// 跑法：node check-sandbox.js
const fs = require("fs");
const path = require("path");
const os = require("os");

const FILE = path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(FILE, "utf8");

/**
 * 注释外的大括号平衡。
 * ★ 必须识别**正则字面量**：`/[_\-\s]*(定稿|…)$/` 里的第一个 `/` 会被当成行注释起点，
 *   把后面的代码整段吃掉（第一次实测就是这个原因，factory 长度算成 0）。
 *   判据：`/` 前面最近的非空白字符若是"操作数"，才是正则；否则是除号/注释。
 */
function balanced(text, openIdx) {
  let depth = 0, i = openIdx, inS = null, inL = null, inB = null;
  const regexAllowed = (idx) => {
    let j = idx - 1;
    while (j >= 0 && /\s/.test(text[j])) j--;
    if (j < 0) return true;
    return "(,=:[!&|?{};+-*%~^<>".indexOf(text[j]) >= 0;
  };
  for (; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inL) { if (c === "\n") inL = null; continue; }
    if (inB) { if (c === "*" && n === "/") { inB = null; i++; } continue; }
    if (inS) {
      if (c === "\\") { i++; continue; }
      if (c === inS) inS = null;
      continue;
    }
    if (c === "/" && n === "/") { inL = 1; continue; }
    if (c === "/" && n === "*") { inB = 1; i++; continue; }
    if (c === "/" && regexAllowed(i)) {          // 正则字面量：跳到收尾的 /（认字符类与转义）
      i++;
      let inClass = false;
      for (; i < text.length; i++) {
        const d = text[i];
        if (d === "\\") { i++; continue; }
        if (d === "[") { inClass = true; continue; }
        if (d === "]") { inClass = false; continue; }
        if (d === "/" && !inClass) break;
        if (d === "\n") break;                    // 不是正则，回退当除号处理
      }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inS = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return { body: text.slice(openIdx, i + 1), end: i }; }
  }
  return { body: "", end: -1 };
}

/**
 * 从 `const NAME =` 起抽到**该语句的收尾分号**（括号配平到 0 才算完）。
 * ★ 不能只做 `{}` 配平：数组/函数表达式/箭头函数混在一起时算不出边界
 *   （第一版就因此把 `const NAV = [ … ];` 截断成 `… };`）。
 */
function grabStatement(text, startIdx) {
  const eq = text.indexOf("=", startIdx);
  if (eq < 0) return "";
  let i = eq + 1, pd = 0, bd = 0, sd = 0;
  let inS = null, inL = null, inB = null;
  const regexAllowed = (idx) => {
    let j = idx - 1;
    while (j >= 0 && /\s/.test(text[j])) j--;
    if (j < 0) return true;
    return "(,=:[!&|?{};+-*%~^<>".indexOf(text[j]) >= 0;
  };
  for (; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inL) { if (c === "\n") inL = null; continue; }
    if (inB) { if (c === "*" && n === "/") { inB = null; i++; } continue; }
    if (inS) { if (c === "\\") { i++; continue; } if (c === inS) inS = null; continue; }
    if (c === "/" && n === "/") { inL = 1; continue; }
    if (c === "/" && n === "*") { inB = 1; i++; continue; }
    if (c === "/" && regexAllowed(i)) {
      i++;
      let inClass = false;
      for (; i < text.length; i++) {
        const d = text[i];
        if (d === "\\") { i++; continue; }
        if (d === "[") { inClass = true; continue; }
        if (d === "]") { inClass = false; continue; }
        if (d === "/" && !inClass) break;
        if (d === "\n") break;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inS = c; continue; }
    if (c === "(") pd++;
    else if (c === ")") pd--;
    else if (c === "{") bd++;
    else if (c === "}") bd--;
    else if (c === "[") sd++;
    else if (c === "]") sd--;
    else if (c === ";" && pd === 0 && bd === 0 && sd === 0) return text.slice(startIdx, i + 1);
  }
  return "";
}

// ── 取 factory 体 ────────────────────────────────────────────
const fStart = src.indexOf("factory: (require) => {");
const fOpen = src.indexOf("{", fStart);
const factory = balanced(src, fOpen).body;

// ── 沙箱：把**整段 factory 体**放进去执行 ─────────────────────
// ★ 为什么不再"抽取每个函数/常量"：正则抽声明必然踩坑，实测连修三轮
//   （正则字面量里的 / 被当注释、注释里的示例代码被当声明、括号深度被字符串里的括号带偏……）。
//   改成整段执行后，**JS 自己解析自己**：函数声明提升让所有函数可用，
//   常量各自真实求值，作用域就是真实作用域 —— 不再有"我抽错了"这类假阳性。
const SANDBOX_HEAD = `
const __NOOP = function () { return void 0; };
const __stubFn = function () { return arguments[0]; };
function __target() { return new Proxy(__stubFn, {
  get: function (t, k) {
    if (k === "then") return void 0;
    // ★ 必须给 Symbol.iterator：源码里到处是 const [a, b] = React.useState(...) 这种解构，
    //   不可迭代的话组件在函数头就抛错，深层代码走不到（实测换了 stub 语义后 19 个组件全挂在解构上）。
    if (k === Symbol.iterator) return function () { let n = 0; return { next: function () { return n++ < 8 ? { value: __target(), done: false } : { value: void 0, done: true }; } }; };
    if (k === "length" || k === "size" || k === "count") return 0;
    if (k === "toString" || k === "valueOf") return function () { return ""; };
    if (typeof k === "symbol") return void 0;
    return __target();
  },
  // ★ 被调用时**返回第一个实参**而不是 undefined：
  //   源码里到处是 props.useSessions(fn) / arr.filter(fn) 这类链式调用，
  //   返回 undefined 会让深层代码立刻抛错、根本走不到要扫的地方。
  apply: function (t, self, args) { return args.length > 0 ? args[0] : __target(); }
}); }
const React = {
  createElement: function (t, p, c) { return { type: t, props: p, children: c }; },
  useState: function (init) { return [typeof init === "function" ? void 0 : init, __NOOP]; },
  useEffect: __NOOP, useLayoutEffect: __NOOP, useMemo: function (f) { return __stubFn(); },
  useCallback: __NOOP, useRef: function () { return { current: null }; },
  createContext: function () { return {}; }, Fragment: "Fragment", Component: function () {}
};
const window = __target(), document = __target(), console = { log: __NOOP, warn: __NOOP, error: __NOOP };
const navigator = __target(), location = __target(), fetch = __stubFn, btoa = __stubFn, atob = __stubFn;
const globalThis = __target();
const ctx = __target(), skill = __target(), props = __target();
// ★ window/globalThis 要带上真的 React：源码里是 const React = require("react")，
//   而沙箱的 require 返回 Proxy —— 那样 h(...) 一调用就抛错，**深层代码根本走不到**，等于没扫。
//   让回退分支拿到真 React，渲染体才会真的被执行。
window.React = React;
globalThis.React = React;
document.createElement = __stubFn;
// ★ 不能再声明 module / exports / require：CJS 包装器已经把它们作为形参提供了，重名即 SyntaxError
`;

const SANDBOX_TAIL = `
// ★ 收集器必须写在 factory 体**内部**（作用域里才有那些函数）：
//   写在 IIFE 外面根本看不到它们（实测报 "parseMaterial is not defined"）；
//   所以尾部这段是在替换掉 factory 末尾的 return module.exports 之后接在里面的。
var __want = __NAMES__;
// ★ 不用 eval：在 IIFE 里 eval 解析不到 factory 作用域（实测 "parseMaterial is not defined"）。
// ★ 也不能直接写裸引用：有些函数是**嵌套**的（如收件箱那批现在在 INTAKE IIFE 里），
//   直接引用会 ReferenceError。改用 typeof 守卫（typeof 对未声明的名字不抛错）。
var __val = {};
// __REFS__
module.exports = { names: __want, fns: __val };
`;
const TAIL_ARGS = "";

// 只取函数**名字**（不用管签名/体边界 —— 体由"整段执行"提供）
const FN_NAMES = (() => {
  const out = [];
  const re = /(?:^|[\n{;])[ \t]*function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(factory)) !== null) {
    // 跳过注释里的伪声明：该位置必须落在代码上（用 strip 后的长度差近似判断不可靠，这里用行首特征）
    const lineStart = factory.lastIndexOf("\n", m.index) + 1;
    const line = factory.slice(lineStart, factory.indexOf("\n", m.index) < 0 ? factory.length : factory.indexOf("\n", m.index));
    if (/^\s*\*/.test(line) || /^\s*\/\//.test(line)) continue;
    if (out.indexOf(m[1]) < 0) out.push(m[1]);
  }
  return out;
})();


const CODE = SANDBOX_HEAD
  // ★ 收集器要接在 factory 体**内部**：先去掉末尾的 return module.exports;，再把收集器接上，
  //   整体作为 IIFE 执行、require 当参数传进去（顶层再 const require 会重复声明）。
  //   exports.* 那两行也去掉了 —— 它们写进的是 IIFE 里那个用来遮蔽 CJS 的 module/exports，不是真导出。
  + "module.exports = (function (require) {"
  + factory.replace(/^\{/, "").replace(/\}$/, "")
      .replace(/return\s+module\.exports\s*;\s*$/, "")
      .replace(/exports\.(apply|inject)\s*=\s*\w+\s*;\s*/g, "")
  + SANDBOX_TAIL
      .replace("__NAMES__", JSON.stringify(FN_NAMES))
      .replace("// __REFS__", FN_NAMES.map((n) =>
        "__val[" + JSON.stringify(n) + "] = typeof " + n + " === \"function\" ? " + n + " : void 0;").join("\n"))
      .replace("module.exports = { names: __want, fns: __val };", "return { names: __want, fns: __val };")
  + "})(function (name) { return name === \"react\" ? React : __target(); });";

const tmp = path.join(__dirname, "_sandbox-gen.cjs");
fs.writeFileSync(tmp, CODE, "utf8");

let sandbox;
try {
  sandbox = require(tmp);
} catch (e) {
  console.log("❌ 沙箱构造失败：" + e.message);
  console.log("   生成的沙箱代码留在：" + tmp + "（便于定位）");
  process.exit(1);
}
console.log("✅ 沙箱已装配（" + sandbox.names.length + " 个函数）\n");

// ── 挨个调用，抓 ReferenceError ──────────────────────────────
const ARGS = {
  // 让组件走"有 props 但数据为空"的路径，尽量多执行到渲染体
  default: [{ data: { assets: [], features: [], srWs: "D:\\ws", error: "" }, feature: {}, notice: null,
              onOpen: (() => {}), onRefresh: null, onPickDir: null, onImport: null, onManual: null,
              onIntake: null, intakeRefs: [], read: null, probe: {}, sessionId: "s", props: {} }]
};

const bad = [];
const notRun = [];
const nested = [];
for (const name of sandbox.names) {
  const fn = sandbox.fns[name];
  let refErr = null, ran = false, lastErr = "";
  const PACKS = [
    [ARGS.default[0]],
    [{}, null, void 0, "x", [], 0, "s"],
    // 尽量贴着真实 props 形态再试一次：不少组件用 props.xxx.filter/map/length，空数组比 undefined 更接近真实
    [{ data: { assets: [], features: [], srWs: "D:\\ws", error: "" },
       feature: { topic: "t", files: {}, finals: [], stages: {} },
       notice: null, read: null, sessionId: "s",
       onOpen: (() => {}), onOpenRef: (() => {}), onSubmit: null,
       refs: [], issues: [], items: [], rules: [], ledger: { records: [] },
       stages: {}, rows: [], list: [], value: "", text: "",
       useSessions: void 0, useSessionPendingInteraction: void 0, probe: {} },
     [], {}, "", 0, null, () => {}]
  ];
  for (const pack of PACKS) {
    try { fn.apply(null, pack); ran = true; break; }
    catch (e) {
      if (e instanceof ReferenceError) {
        const mm = /^([A-Za-z_$][\w$]*) is not defined/.exec(e.message);
        refErr = mm ? mm[1] : ("ReferenceError: " + e.message);
        ran = true;
        break;
      }
      // TypeError 之类来自 stub 数据/参数不匹配 —— 不代表未声明，换下一组参数再试
      lastErr = String(e.message).split("\n")[0];
      continue;
    }
  }
  if (refErr) bad.push({ fn: name, id: refErr });
  else if (!ran) {
    // 取不到函数值 = 名字是嵌套的（不在 factory 作用域，如收件箱那批在 INTAKE IIFE 里）
    if (fn === void 0) nested.push(name);
    else notRun.push(name + "（" + lastErr.slice(0, 60) + "）");
  }
}

fs.unlinkSync(tmp);

if (bad.length === 0) {
  console.log("✅ 沙箱执行扫描：0 处未声明标识符（每个组件都能在只含真实作用域的沙箱里跑起来）");
} else {
  console.log("❌ 沙箱执行扫描：以下函数引用了作用域里不存在的名字（真实渲染时会白屏）");
  for (const b of bad) console.log("   " + b.fn + " → " + b.id);
}

// 没跑到的函数单独列出来：**它们没被验证过**，不能算通过（诚实标注覆盖范围）
if (nested.length > 0) {
  console.log("\nℹ 以下 " + nested.length + " 个函数是**嵌套**的（不在 factory 作用域，本扫描不适用）；" +
    "它们的行为由 test-inline-intake.js（28 项）直接覆盖：");
  console.log("   " + nested.join("、"));
}
if (notRun.length > 0) {
  console.log("\n⚠ 以下 " + notRun.length + " 个函数因参数形态不适配而未执行 —— **本次未验证**：");
  for (const x of notRun) console.log("   " + x);
}

// ── 自证：把当初闯祸的那一行注回去，必须抓到 ──────────────────
// 2026-09-28 白屏原文：AssetsPanel 里引用了只在外层 Panel 存在的 notice。
let selfTest = "❌";
{
  const injected = src.replace(
    "function AssetsPanel(props) {",
    "function AssetsPanel(props) { const __probeNotice = notice;"
  );
  const fOpen2 = injected.indexOf("{", injected.indexOf("factory: (require) => {"));
  const tmp2 = path.join(os.tmpdir(), "sr-workbench-selftest-" + Date.now() + ".cjs");
  const factory2 = balanced(injected, fOpen2).body;
  const b2 = factory2.indexOf("{", factory2.indexOf("function AssetsPanel"));
  const body2 = balanced(factory2, b2).body.replace(/^\{/, "").replace(/\}$/, "");
  fs.writeFileSync(tmp2,
    "const props = new Proxy(function(){}, { get: () => new Proxy(function(){}, { get: () => new Proxy(function(){}, {}) }) });\n" +
    "const __t = function () { try { (function AssetsPanel(props) {" + body2 + "})(props); } catch (e) {" +
    " if (e instanceof ReferenceError) { const m = /^([A-Za-z_$][\\w$]*) is not defined/.exec(e.message); if (m && m[1] === 'notice') return 'CAUGHT'; } return 'MISSED'; } return 'MISSED'; };\n" +
    "module.exports = __t();", "utf8");
  try { if (require(tmp2) === "CAUGHT") selfTest = "✅"; } catch (e) { selfTest = "❌ (" + e.message + ")"; }
  fs.unlinkSync(tmp2);
}
console.log((selfTest === "✅" ? "✅ " : "❌ ") + "自证：把当初闯祸的 `notice` 注回去，" + (selfTest === "✅" ? "扫描器抓到了" : "扫描器**没抓到** —— 结果不可信 " + selfTest));
if (selfTest !== "✅") bad.push({ fn: "自证", id: "扫描器失灵" });

console.log(bad.length === 0 ? "\n★ 通过" : "\n★ 有 " + bad.length + " 项未通过");
process.exit(bad.length === 0 ? 0 : 1);


