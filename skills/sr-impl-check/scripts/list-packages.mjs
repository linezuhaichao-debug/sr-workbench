#!/usr/bin/env node
/**
 * list-packages.mjs — 列出需求库里可以直接做实现核查的包/版本，供 agent 让用户挑。
 *
 * 用法:
 *   node list-packages.mjs                       # 默认根目录
 *   node list-packages.mjs --root "D:\path\to\下游包"
 *   node list-packages.mjs --json                # 机器可读
 *
 * 根目录优先级: --root > 环境变量 REQ_PACKAGE_ROOT > 内置默认。
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const DEFAULT_ROOT = 'D:\\TimeMachine\\srrequirement\\下游包';
const DOC_EXT = /\.(md|markdown|html|htm)$/i;
const SKIP_DOC = /^(索引|README|START_HERE|包说明)\./i;
const DERIVED = /(核查对照|需求清单|实现核查|审核报告|审查报告|_核查)/;
const README = /^(README|START_HERE|按需资料|包说明|索引)/i;
const SPEC_HINT = /(AI读版|策划案|正式版|需求)/;
const VERSION_DIR = /^v\d+(\.\d+)*$/i;

function parseArgs(argv) {
  const out = { root: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') out.root = argv[++i];
    else if (argv[i] === '--json') out.json = true;
  }
  return out;
}

function walkCount(dir, filter, depth = 3) {
  if (!existsSync(dir) || depth < 0) return 0;
  let n = 0;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) n += walkCount(join(dir, ent.name), filter, depth - 1);
    else if (filter(ent.name)) n++;
  }
  return n;
}

function scan(root) {
  if (!existsSync(root)) return { root, error: '目录不存在', items: [] };
  const items = [];
  for (const ent of readdirSync(root, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const pkgDir = join(root, ent.name);
    const versions = readdirSync(pkgDir, { withFileTypes: true })
      .filter(v => v.isDirectory() && VERSION_DIR.test(v.name))
      .map(v => v.name)
      .sort();
    if (!versions.length) continue;
    for (const ver of versions) {
      const dir = join(pkgDir, ver);
      const docs = readdirSync(dir, { withFileTypes: true })
        .filter(d => d.isFile() && DOC_EXT.test(d.name) && !SKIP_DOC.test(d.name) && !DERIVED.test(d.name))
        .map(d => ({
          name: d.name,
          kind: README.test(d.name) ? 'readme' : (SPEC_HINT.test(d.name) ? 'spec' : 'other'),
          kb: Math.round(statSync(join(dir, d.name)).size / 1024),
          mtime: statSync(join(dir, d.name)).mtime.toISOString().slice(0, 10)
        }))
        .sort((a, b) => (a.kind === 'spec' ? 0 : 1) - (b.kind === 'spec' ? 0 : 1) || b.kb - a.kb);
      items.push({
        package: ent.name,
        version: ver,
        dir,
        docs,
        images: walkCount(dir, n => /\.(png|jpe?g|webp)$/i.test(n), 2)
      });
    }
  }
  return { root, error: null, items };
}

const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root || process.env.REQ_PACKAGE_ROOT || DEFAULT_ROOT);
const result = scan(root);

if (args.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('需求库：' + result.root);
  if (result.error) { console.log('✗ ' + result.error); process.exit(1); }
  if (!result.items.length) { console.log('（没有 vX.Y 版本目录）'); process.exit(0); }
  console.log('');
  result.items.forEach((it, i) => {
    console.log(`[${i + 1}] ${it.package} / ${it.version}   （图片 ${it.images} 张）`);
    console.log('    ' + it.dir);
    if (!it.docs.length) console.log('    ! 没有 md/html 需求文档，需人工确认');
    it.docs.forEach(d => {
      const tag = d.kind === 'spec' ? '[定稿?]' : d.kind === 'readme' ? '[说明] ' : '[其它] ';
      console.log(`    ${tag} ${d.name}  ${d.kb} KB  ${d.mtime}`);
    });
  });
  console.log('');
  console.log('挑一个「包 / 版本」，并确认其中哪份是定稿需求文档。');
}
