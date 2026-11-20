#!/usr/bin/env node
/**
 * extract-check-data.mjs — 从已生成的对照页里取回 window.__CHECK_DATA__，方便增量改一条再重渲染。
 *
 * 用法:
 *   node extract-check-data.mjs --from "…/圣物系统_核查对照_v1.0.html" --out check.json
 *   node extract-check-data.mjs --from page.html            # 直接打印到 stdout
 *
 * 退出码: 0 = 成功；1 = 找不到数据或写文件失败。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const argv = process.argv.slice(2);
let from = null, out = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--from') from = argv[++i];
  else if (a === '--out' || a === '-o') out = argv[++i];
  else if (!from && !a.startsWith('-')) from = a;
  else if (!out && !a.startsWith('-')) out = a;
}
if (!from) {
  console.error('✗ 缺少 --from <页面.html>');
  process.exit(1);
}

let html;
try { html = readFileSync(resolve(from), 'utf8'); }
catch { console.error('✗ 读不到文件：' + from); process.exit(1); }

const m = html.match(/window\.__CHECK_DATA__\s*=\s*([\s\S]*?);\s*<\/script>/);
if (!m) {
  console.error('✗ 这个页面里没有 window.__CHECK_DATA__，可能不是本工具生成的，或数据已被移除。');
  process.exit(1);
}

let data;
try { data = JSON.parse(m[1].replace(/<\\\//g, '</')); }
catch (e) { console.error('✗ 数据不是合法 JSON：' + e.message); process.exit(1); }

// 内嵌图会以 data URI 形式回来；还原成原路径无法从 data URI 反推，先提示一下。
const embedded = (data.issues || []).reduce(
  (n, it) => n + (Array.isArray(it.shots) ? it.shots.filter(s => s && /^data:/.test(s.src || '')).length : 0), 0);

const json = JSON.stringify(data, null, 2);
if (!out) { console.log(json); }
else {
  try {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(resolve(out), json, 'utf8');
    console.log('✓ 已写出 ' + resolve(out));
  } catch (e) { console.error('✗ 写文件失败：' + e.message); process.exit(1); }
}
if (embedded) {
  console.log(`  ! 有 ${embedded} 张标注图是以 data URI 存回的，改完重渲染会继续用它；` +
    `想换图请把对应 shots[].src 改成文件路径。`);
}
