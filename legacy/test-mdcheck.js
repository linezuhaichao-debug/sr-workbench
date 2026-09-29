// 定稿文本体检：找出可能让 markdown 渲染器崩溃的结构
//   ① 代码围栏配对（``` 个数为奇数）
//   ② 行内反引号配对（去掉 ``` 后剩下奇数个 `）
//   ③ 同一张表里列数不一致
//   ④ 残留的 HTML 标签（除 <img>，它会走单独渲染）
//
// 跑法： node test-mdcheck.js [定稿路径]
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "lib", "client.js");
const src = fs.readFileSync(SRC, "utf8");
const a = src.indexOf("const PREFIXES = [");
const b = src.indexOf("function errText(r, fallback) {");
const { parseFinalGdd } = new Function(src.slice(a, b) + "\nreturn { parseFinalGdd };")();

const FILE = process.argv[2] ||
  "D:\\TimeMachine\\GameDesignOS\\workspace\\proposals\\联盟悬赏_20260923_定稿.md";
const text = fs.readFileSync(FILE, "utf8");
const g = parseFinalGdd(text);

console.log("体检对象：" + path.basename(FILE));
console.log("结构：" + g.stats.chapters + " 章 / " + g.stats.groups + " 组 / " + g.blocks.length + " 块\n");

const rows = (t) => t.split(/\r?\n/).filter((l) => /^\s*\|.*\|\s*$/.test(l));

let bad = 0;
const flag = (blk, msg) => {
  bad++;
  console.log("  ⚠ L" + blk.line + "  §" + blk.no + (blk.id ? " " + blk.id : "") + "  " + blk.title);
  console.log("      " + msg);
};

for (const blk of g.blocks) {
  const t = blk.text;

  // ① 围栏
  const fences = (t.match(/^\s*(```|~~~)/gm) || []).length;
  if (fences % 2 !== 0) flag(blk, "代码围栏奇数个（" + fences + "）—— 未闭合");

  // ② 行内反引号（剔除围栏标记后计数）
  const noFence = t.replace(/^\s*(```|~~~).*$/gm, "");
  const ticks = (noFence.match(/`/g) || []).length;
  if (ticks % 2 !== 0) flag(blk, "行内反引号奇数个（" + ticks + "）—— 有未闭合的行内代码");

  // ③ 表格列数
  const tr = rows(t);
  if (tr.length > 1) {
    let first = null, mismatch = false, at = 0;
    for (let i = 0; i < tr.length; i++) {
      const n = tr[i].trim().replace(/^\|/, "").replace(/\|$/, "").split("|").length;
      if (first === null) first = n;
      else if (n !== first && !/^[\s|:-]+$/.test(tr[i])) { mismatch = true; at = i; break; }
    }
    if (mismatch) flag(blk, "表格列数不一致：首行 " + first + " 列，第 " + (at + 1) + " 行不同 → " + tr[at].slice(0, 70));
  }

  // ④ 残留 HTML（<img> 已单独渲染，其余标签要留意）
  const html = t.match(/<(?!!--)[a-zA-Z][^>]*>/g) || [];
  const other = html.filter((h) => !/^<img\b/i.test(h));
  if (other.length) flag(blk, "残留 HTML 标签（" + other.length + " 个）：" + other.slice(0, 4).join(" "));
}

console.log(bad
  ? "\n共 " + bad + " 处可疑结构 —— 上面列出的块最可能是渲染崩溃的原因"
  : "✅ 全部 " + g.blocks.length + " 块通过：围栏配对 / 行内反引号配对 / 表格列数一致 / 无残留 HTML");

// 附：整份文件的 <img> 清单（它们走单独渲染，不进 markdown）
{
  const imgs = text.match(/<img\s+[^>]*?src\s*=\s*["']([^"']+)["'][^>]*?\/?>/gi) || [];
  console.log("\n<img> 共 " + imgs.length + " 个（已改为单独渲染，不进 markdown 解析）：");
  for (const im of imgs) {
    const s = /src\s*=\s*["']([^"']+)["']/i.exec(im);
    const v = s ? s[1] : "";
    console.log("   " + (/\s/.test(v) ? "⚠ 路径含空格 → " : "            ") + v);
  }
}

// 附：含围栏代码块的块（这些块以前会让 markdown 渲染器崩，现已走 CodeBlock）
{
  const withCode = g.blocks.filter((b) => /^[ \t]*(`{3,}|~{3,})/m.test(b.text));
  console.log("\n含围栏代码块的块共 " + withCode.length + " 个（已改为 CodeBlock 单独渲染）：");
  for (const b of withCode) {
    const n = (b.text.match(/^[ \t]*(`{3,}|~{3,})/gm) || []).length;
    const l = b.level === 2 ? ("§" + b.no) : ("§" + (b.chNo || "?") + " " + (b.id || b.no || ""));
    console.log("   " + (l + "  " + b.title).padEnd(46) + " L" + b.line + "  围栏 " + n + " 个");
  }
}
process.exit(bad ? 1 : 0);
