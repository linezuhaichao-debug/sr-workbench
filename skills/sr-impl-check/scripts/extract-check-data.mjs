#!/usr/bin/env node
/**
 * extract-check-data.mjs — 从已生成的对照页里把数据取回来，存成 JSON。
 *
 * 为什么需要：页面是**自包含**的（数据内嵌在 `window.__CHECK_DATA__`），所以
 * 只有页面、没有 JSON 时，这条链路就断在"改不了、重渲染不了"。
 * 有了它，页面本身就是数据源：取回 → 改 → 重渲染，slug 不变则勾选照旧有效。
 *
 * 用法:
 *   node extract-check-data.mjs --from 页面.html --out check.json
 *   node extract-check-data.mjs --from 页面.html            # 打到 stdout
 *   node extract-check-data.mjs --from 页面.html --check    # 取回后按 schema 自检
 *
 * 退出码: 0 = 取回成功；1 = 页面里没有数据 / JSON 解析失败。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

function parseArgs(argv) {
  const out = { from: null, out: null, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from' || a === '-f') out.from = argv[++i];
    else if (a === '--out' || a === '-o') out.out = argv[++i];
    else if (a === '--check') out.check = true;
  }
  return out;
}

const MARK = 'window.__CHECK_DATA__ = ';
const args = parseArgs(process.argv.slice(2));
if (!args.from) {
  console.error('✗ 缺少 --from <页面 html>');
  process.exit(1);
}

let html;
try { html = readFileSync(resolve(args.from), 'utf8'); }
catch (e) { console.error('✗ 读不到页面：' + args.from); process.exit(1); }

const start = html.indexOf(MARK);
if (start < 0) {
  console.error('✗ 页面里没有 ' + MARK.trim() + '（不是 sr-impl-check 生成的页面？）');
  process.exit(1);
}

// 从 MARK 之后做括号配平（字符串里的括号要跳过）
let i = start + MARK.length;
while (html[i] === ' ' || html[i] === '\n' || html[i] === '\r') i++;
if (html[i] !== '{') {
  console.error('✗ 数据不是以 { 开头，页面格式不对');
  process.exit(1);
}
let depth = 0, end = -1, inStr = false, esc = false;
for (let j = i; j < html.length; j++) {
  const ch = html[j];
  if (inStr) {
    if (esc) esc = false;
    else if (ch === '\\') esc = true;
    else if (ch === '"') inStr = false;
    continue;
  }
  if (ch === '"') { inStr = true; continue; }
  if (ch === '{' || ch === '[') depth++;
  else if (ch === '}' || ch === ']') { depth--; if (depth === 0) { end = j + 1; break; } }
}

let data;
try { data = JSON.parse(html.slice(i, end)); }
catch (e) { console.error('✗ 内嵌 JSON 解析失败：' + e.message); process.exit(1); }

const issues = Array.isArray(data.issues) ? data.issues : [];
const cats = issues.reduce((m, it) => ((m[it.cat] = (m[it.cat] || 0) + 1), m), {});
const specRows = Object.values(data.spec || {}).reduce((n, v) => {
  const raw = Array.isArray(v) ? v[1] : (v && v.rows) || '';
  return n + String(raw).trim().split('\n').filter(Boolean).length;
}, 0);

console.error('— 取回 —');
console.error('  slug：' + (data.slug || '(无)'));
console.error('  问题条目：' + issues.length + '（' + Object.entries(cats).map(([k, v]) => k + ' ' + v).join(' / ') + '）');
console.error('  需求条目：' + specRows + ' 条');
console.error('  推荐存成：' + (data.slug || 'check') + '.json');

const json = JSON.stringify(data, null, 2);
if (args.out) {
  const p = resolve(args.out);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, json, 'utf8');
  console.error('✓ 已写出 ' + p);
  if (args.check) {
    console.error('  下一步：node <SKILL_DIR>/scripts/build-check-page.mjs --data "' + p + '" --check');
  }
} else {
  process.stdout.write(json);
}
