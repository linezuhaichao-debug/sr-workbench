#!/usr/bin/env node
/**
 * build-check-page.mjs — 把「问题 ↔ 需求」对照数据渲染成单文件 HTML 台账。
 *
 * 用法:
 *   node build-check-page.mjs --data check.json --out 圣物系统_核查对照_v1.0.html
 *   node build-check-page.mjs --data check.json --check        # 只校验，不写文件
 *   node build-check-page.mjs --print-schema                   # 打印数据格式与样例
 *   node build-check-page.mjs --help
 *
 * 退出码: 0 = 成功（可能有 warning）；1 = 数据不合法或渲染失败。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, '../assets/page-template.html');
const CATS = ['missing', 'wrong', 'bug', 'unknown', 'pass'];
const CAT_LABEL = { missing: '未实现', wrong: '实现错误', bug: 'Bug', unknown: '不确定', pass: '已通过' };

function parseArgs(argv) {
  const out = { data: null, out: null, check: false, schema: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--data') out.data = argv[++i];
    else if (a === '--out' || a === '-o') out.out = argv[++i];
    else if (a === '--check') out.check = true;
    else if (a === '--print-schema') out.schema = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (!out.data && !a.startsWith('-')) out.data = a;
    else if (!out.out && !a.startsWith('-')) out.out = a;
  }
  return out;
}

const SCHEMA = `
数据格式（一个 JSON 文件；除 issues / spec 外都可省）

{
  "slug": "relic-check",                     // 必填：localStorage 键前缀，也用于文件名建议
  "title": "圣物系统 v1.0 实现核查",           // 页面主标题
  "titleEm": "实现核查",                      // 可选：标题后缀加重点色
  "lede": "**结论**一句话。左栏结论，右栏需求原文。",  // 支持 **加粗** 与 \`代码\`
  "meta": { "需求包": "圣物系统 / v1.0", "工程": "PlanetRoot 客户端", "日期": "2026-11-19" },
  "issues": [
    {
      "id": "2.1",                          // 必填，与报告编号一致（1.1 / 2.3 / 3.4 / 4.2 / P1）
      "cat": "wrong",                       // 必填：missing | wrong | bug | unknown | pass
      "sev": "高",                          // 高 | 中 | 低 | —
      "title": "一句话结论",
      "where": "文件:行号 或 证据位置",       // 必填，等宽字体展示
      "now": "代码现在怎么做的",
      "why": "影响 / 违反了什么",
      "reqs": [ ["M3-3", "定稿原文（可截取关键句）"] ],   // 必填，1 条以上
      "check": "怎么算通过（可执行、可观察）"             // 必填
    }
  ],
  "spec": {
    "A": ["功能规则（§4 R1–R12）", "R1-1|入口①：装备页两个槽位本身是入口\\nR1-2|…"],
    "B": ["界面与交互（§5）", "M1-1|…"]
  },
  "footer": ["口径说明一", "口径说明二"]
}

要点：
- issues 的 reqs 里每个编号都应能在 spec 里找到；找不到会给出 warning（通常说明清单漏了条目）。
- pass 类条目同样带 reqs，用于说明"这条需求已核对通过"。
- spec 的每节是 [节标题, 行文本]，行文本一行一条 "编号|标题"，用 \\n 分隔。
`;

function fail(msg) {
  console.error('✗ ' + msg);
  process.exit(1);
}

function validate(data) {
  const errors = [];
  const warnings = [];
  if (!data || typeof data !== 'object') return { errors: ['数据不是对象'], warnings };
  if (!Array.isArray(data.issues) || data.issues.length === 0) errors.push('issues 缺失或为空');
  if (!data.spec || typeof data.spec !== 'object' || Object.keys(data.spec).length === 0) {
    warnings.push('spec 为空：右栏只能显示需求编号，没有原文与清单视图');
  }

  const seenIssue = new Set();
  const issueCats = {};
  (data.issues || []).forEach((it, i) => {
    const at = `issues[${i}]${it && it.id ? '(' + it.id + ')' : ''}`;
    if (!it || typeof it !== 'object') { errors.push(at + ' 不是对象'); return; }
    if (!it.id) errors.push(at + ' 缺少 id');
    else if (seenIssue.has(it.id)) errors.push(at + ' id 重复');
    else seenIssue.add(it.id);
    if (!CATS.includes(it.cat)) errors.push(at + ` cat 非法：${it.cat}（应为 ${CATS.join('/')}）`);
    else issueCats[it.cat] = (issueCats[it.cat] || 0) + 1;
    ['title', 'where', 'now', 'check'].forEach(k => {
      if (!it[k] || String(it[k]).trim() === '') errors.push(at + ` 缺少 ${k}`);
    });
    if (!Array.isArray(it.reqs) || it.reqs.length === 0) {
      if (it.cat !== 'pass') errors.push(at + ' reqs 缺失：问题必须绑定需求');
      else warnings.push(at + ' pass 条目没有 reqs，无法证明"对哪条需求通过"');
    } else {
      it.reqs.forEach((r, j) => {
        if (!Array.isArray(r) || r.length < 2 || !r[0] || !r[1]) errors.push(`${at} reqs[${j}] 应为 ["编号","原文"]`);
      });
    }
  });

  const specIds = new Set();
  Object.entries(data.spec || {}).forEach(([key, val]) => {
    const isPair = Array.isArray(val) && val.length >= 2;
    const raw = isPair ? val[1] : (val && val.rows);
    if (!isPair && !raw) { errors.push(`spec.${key} 应为 ["节标题","条目文本"]`); return; }
    String(raw).trim().split('\n').filter(Boolean).forEach(line => {
      const i = line.indexOf('|');
      const id = (i < 0 ? line : line.slice(0, i)).trim();
      if (!id) return;
      if (specIds.has(id)) warnings.push(`spec 编号重复：${id}`);
      specIds.add(id);
      if (i < 0) warnings.push(`spec 条目缺少 "|" 描述：${id}`);
    });
  });

  const referenced = new Set();
  (data.issues || []).forEach(it => (it && it.reqs || []).forEach(r => r && r[0] && referenced.add(r[0])));
  referenced.forEach(rid => {
    if (!specIds.has(rid)) warnings.push(`需求编号在清单里找不到：${rid}`);
  });
  const unused = [...specIds].filter(id => !referenced.has(id));

  return { errors, warnings, issueCats, specCount: specIds.size, referencedCount: referenced.size, unusedCount: unused.length };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(SCHEMA); return; }
  if (args.schema) { console.log(SCHEMA); return; }
  if (!args.data) fail('缺少 --data <json>（用 --print-schema 看数据格式）');

  let raw;
  try { raw = readFileSync(resolve(args.data), 'utf8'); }
  catch (e) { fail('读不到数据文件：' + args.data); }

  let data;
  try { data = JSON.parse(raw); }
  catch (e) { fail('JSON 解析失败：' + e.message); }

  const { errors, warnings, issueCats = {}, specCount = 0, referencedCount = 0, unusedCount = 0 } = validate(data);

  console.log('— 数据自检 —');
  console.log('  问题条目：' + (data.issues || []).length + '（' +
    CATS.filter(c => issueCats[c]).map(c => `${CAT_LABEL[c]} ${issueCats[c]}`).join(' / ') + '）');
  console.log('  需求条目：' + specCount + ' 条，被引用 ' + referencedCount + ' 条，未被引用 ' + unusedCount + ' 条');
  warnings.forEach(w => console.log('  ! ' + w));
  errors.forEach(e => console.log('  ✗ ' + e));
  if (errors.length) fail(`数据有 ${errors.length} 处硬错误，未生成页面`);
  if (args.check) { console.log('✓ 校验通过（--check 不写文件）'); return; }

  if (!args.out) fail('缺少 --out <html>');

  let tpl;
  try { tpl = readFileSync(TEMPLATE, 'utf8'); }
  catch (e) { fail('模板缺失：' + TEMPLATE); }
  if (!tpl.includes('__DATA__')) fail('模板里没有 __DATA__ 占位符，模板被改坏了');

  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  const html = tpl.replace('__DATA__', () => json);

  const outPath = resolve(args.out);
  try {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, 'utf8');
  } catch (e) { fail('写文件失败：' + e.message); }

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  console.log('✓ 已生成 ' + outPath + '（' + kb + ' KB，单文件、离线可开）');
  if (warnings.length) console.log('  ' + warnings.length + ' 条 warning：建议补齐后再交付。');
}

main();
