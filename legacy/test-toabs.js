// 离线验证 toAbs：抽出真实实现跑各种输入
const fs = require("fs");
const SRC = "D:\\TimeMachine\\sr-workbench\\lib\\client.js";
const src = fs.readFileSync(SRC, "utf8");

const a = src.indexOf("function toAbs(cwd, rel) {");
const b = src.indexOf("function DecisionLedger(props) {");
if (a < 0 || b < 0 || b <= a) { console.error("抽取失败 a=" + a + " b=" + b); process.exit(1); }
// 注意：**不要**用正则剥注释——`p.replace(/\//g,"\\")` 里的 `\//` 会被误当成行注释起点。
// new Function 本来就认注释，直接传原文即可。
const toAbs = new Function(src.slice(a, b) + "\nreturn toAbs;")();

const CWD = "D:\\TimeMachine";
const cases = [
  // [说明, cwd, rel, 期望]
  ["绝对路径（正斜杠）不得重复前缀", CWD, "D:\\TimeMachine\\GameDesignOS\\workspace/proposals/联盟悬赏_20260923_定稿.md", "D:\\TimeMachine\\GameDesignOS\\workspace\\proposals\\联盟悬赏_20260923_定稿.md"],
  ["绝对路径（全反斜杠）保持", CWD, "D:\\TimeMachine\\GameDesignOS\\workspace\\proposals\\a.md", "D:\\TimeMachine\\GameDesignOS\\workspace\\proposals\\a.md"],
  ["相对路径用 cwd 前缀", CWD, "GameDesignOS/workspace/proposals/a.md", "D:\\TimeMachine\\GameDesignOS\\workspace\\proposals\\a.md"],
  ["cwd 带尾部分隔符", "D:\\TimeMachine\\", "GameDesignOS/a.md", "D:\\TimeMachine\\GameDesignOS\\a.md"],
  ["UNC 路径不上前缀", CWD, "\\\\server\\share\\a.md", "\\\\server\\share\\a.md"],
  ["驱动器根开始", CWD, "D:/TimeMachine/a.md", "D:\\TimeMachine\\a.md"],
  ["空串", CWD, "", ""],
];

let bad = 0;
for (const [name, cwd, rel, want] of cases) {
  const got = toAbs(cwd, rel);
  const ok = got === want;
  if (!ok) bad++;
  console.log((ok ? "✅ " : "❌ ") + name);
  console.log("     got  = " + JSON.stringify(got));
  if (!ok) console.log("     want = " + JSON.stringify(want));
}
console.log("\n" + (bad ? "★ " + bad + " 个用例不符" : "★ 全部通过（" + cases.length + " 个用例）"));

// 专门复现用户遇到的 bug
const bug = toAbs("D:\\TimeMachine", "D:\\TimeMachine\\GameDesignOS\\workspace/proposals/联盟悬赏_20260923_定稿.md");
console.log("\n复现用户报的那条：\n  " + bug);
console.log("  是否还有重复前缀: " + (bug.split("D:\\TimeMachine").length > 2));
