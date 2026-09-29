// 插件自查：① node --check 全文件语法 ② 抽取 factory 体语法 ③ hooks/残留静态检查
const fs = require("fs");
const { execFileSync } = require("child_process");

const FILE = "D:\\TimeMachine\\sr-workbench\\lib\\client.js";
const src = fs.readFileSync(FILE, "utf8");
let failed = false;

// ① 全文件语法（最准，直接给行号）—— 不要只靠抽取片段，那样会掩盖真实错误位置
try {
  execFileSync(process.execPath, ["--check", FILE], { stdio: "pipe" });
  console.log("✅ 全文件语法通过（node --check）");
} catch (e) {
  failed = true;
  console.error("❌ 全文件语法错误：");
  console.error(String(e.stderr || e.message).split("\n").slice(0, 8).join("\n"));
}

// ② factory 体语法
const startMark = "factory: (require) => {";
const i = src.indexOf(startMark);
const endMark = "return module.exports;";
const j = src.lastIndexOf(endMark);
if (i < 0 || j < 0) { console.error("❌ 找不到 factory 边界"); failed = true; }
else {
  let k = j + endMark.length;
  while (k < src.length && src[k] !== "}") k++;
  try {
    new Function("require", src.slice(i + startMark.length, k));
    console.log("✅ factory 体语法通过");
  } catch (e) { failed = true; console.error("❌ factory 体语法错误：" + e.message); }
}

// ③ 静态检查
const checks = [
  ["条件 useSessions（hooks 违规）", /useSessions\s*&&\s*sessionId\s*\?/, false],
  ["FeatureCard 被当函数调用", /FeatureCard\(f,/, false],
  ["openWorkspacePath 缺 signal", /openWorkspacePath\(\{\s*path:[^}]*\}\s*\)/, false],
  ["decision_result 显示原文 JSON", /JSON\.stringify\(d\.decision_result/, false],
  ["ctx.config（config 不是服务，必用 apply 第 2 参）", /\bctx\.config\b/, false],
  ["整卡可点（应只在底部文件链接上）", /onClick: clickable \?/, false],
  ["打开路径统一走 toAbs（防绝对路径被 cwd 重复前缀）", /const abs = toAbs\(cwd, rel\)/, true],
  ["打开步骤统一包超时（防某步永久挂起在“正在打开”）", /withTimeout\(name, steps\[i\]\[1\]\)/, true],
  ["remote.session 已声明注入（未注入会同步抛错）", /const inject = \[[^\]]*"remote\.session"/, true],
  ["产品界面里不得出现开发按钮（agentPresets.list / commands.execute 字样）", /① agentPresets\.list|④ commands\.execute/, false],
  ["字符串与 React 元素直接相加（会渲染成 [object Object]）", /"\s*\+\s*h\(/, false],
  ["skill 用 commands.execute（skill 不是宿主命令，会静默无事发生）", /probe\.exec\(/, false],
  ["session.create 同时给 workspaceId 与 cwd（host 会拒绝）", /session\.create\(\{[\s\S]{0,60}workspaceId:[\s\S]{0,60}cwd:/, false],
  ["hook 被条件调用（数量会随渲染变化 → 白屏）", /&&\s*\w+\s*\?\s*use[A-Z]/, false],
  ["答案批次缺 id/selected（PendingQuestion.answer 的形状）", /answer\(\{\s*answers:\s*\[\s*\{\s*selected/, false],
];
for (const [name, re, want] of checks) {
  const hit = re.test(src);
  const ok = hit === want;
  if (!ok) failed = true;
  console.log((ok ? "✅ " : "❌ ") + (want ? "存在：" : "已消除：") + name);
}

console.log(failed ? "\n★ 有未通过项" : "\n★ 全部通过");
process.exit(failed ? 1 : 0);
