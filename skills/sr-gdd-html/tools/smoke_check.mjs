#!/usr/bin/env node
/**
 * 评审宣讲 HTML 视觉冒烟检查器（sr-gdd-html 可选工具）。
 *
 * 把模板末尾那份"轻量视觉冒烟清单"落成可执行的五项检查 + 整页截图：
 *   1) 无破图          —— 每张 <img> 都真的解码成功（naturalWidth > 0）
 *   2) 无横向溢出      —— 文档不出现横向滚动条
 *   3) 无文字墙        —— 单条规则正文过长时点名（阈值与 lint_content.py 保持一致）
 *   4) 无布局失衡      —— 长章节的左图必须处于 sticky（否则滚动时图先消失、右侧还剩多屏文字）
 *   5) 章节导航可用    —— 每个 .toc 锚点都能命中对应节点
 * 另外输出整页截图，供人目视复核——机器检查不替代眼睛。
 *
 * 依赖：Node.js ≥ 22（用到内置 WebSocket 与 fetch），本机已装 Chrome 或 Edge。无第三方包。
 *
 * 用法：
 *   node smoke_check.mjs --html 01_评审宣讲.html [--out smoke.png] [--width 1440] [--chrome <路径>]
 *
 * 退出码：0 = 五项全过；1 = 有失败项或环境不可用。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RULE_TEXT_WARN = 240;

function parseArgs(argv) {
  const out = { html: null, out: null, width: 1440, chrome: null, port: 9333 };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--html') out.html = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--width') out.width = Number(argv[++i]);
    else if (a === '--chrome') out.chrome = argv[++i];
    else if (a === '--port') out.port = Number(argv[++i]);
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

function findChrome(explicit) {
  const cands = [
    explicit,
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  return cands.find((p) => existsSync(p)) || null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch {
      /* 端口还没起来，继续等 */
    }
    await sleep(200);
  }
  throw new Error(`DevTools 端口 ${port} 在 ${timeoutMs}ms 内没起来`);
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  const waiters = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
    if (msg.id && pending.has(msg.id)) {
      const { resolve: res, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error)})`));
      else res(msg.result);
    } else if (msg.method) {
      for (let i = waiters.length - 1; i >= 0; i -= 1) {
        if (waiters[i].method === msg.method) {
          waiters[i].resolve(msg.params);
          waiters.splice(i, 1);
        }
      }
    }
  });
  return {
    send(method, params = {}) {
      const myId = (id += 1);
      ws.send(JSON.stringify({ id: myId, method, params }));
      return new Promise((res, reject) => pending.set(myId, { resolve: res, reject }));
    },
    once(method) {
      return new Promise((res) => waiters.push({ method, resolve: res }));
    },
  };
}

const PAGE_CHECKS = `(() => {
  const RULE_TEXT_WARN = ${RULE_TEXT_WARN};
  const result = {
    title: document.title,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    images: [],
    brokenImages: [],
    overflowImages: [],
    tocTotal: 0,
    tocBroken: [],
    sections: [],
    stickyMissing: [],
    longRules: [],
    textP: document.querySelectorAll('main p').length,
  };
  for (const img of document.images) {
    const src = img.currentSrc || img.src || '';
    const kind = src.startsWith('data:') ? 'data:' : (src.startsWith('http') ? 'EXTERNAL' : 'relative');
    const broken = !img.complete || img.naturalWidth === 0;
    result.images.push({ kind, broken, w: img.naturalWidth, h: img.naturalHeight, alt: img.alt || '' });
    if (broken) result.brokenImages.push(img.alt || src.slice(0, 60));
    if (kind !== 'data:') result.overflowImages.push(kind);
  }
  const tocLinks = Array.from(document.querySelectorAll('.toc a[href^="#"]'));
  result.tocTotal = tocLinks.length;
  for (const a of tocLinks) {
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (!document.getElementById(id)) result.tocBroken.push(id);
  }
  let idx = 0;
  for (const sec of document.querySelectorAll('main section')) {
    idx += 1;
    const h = sec.getBoundingClientRect().height;
    const shot = sec.querySelector('.shot, figure');
    const sticky = shot ? getComputedStyle(shot).position : null;
    const rules = Array.from(sec.querySelectorAll('.rules p, .rules div')).map((p) => (p.textContent || '').trim());
    const longOne = rules.filter((t) => t.length > RULE_TEXT_WARN).length;
    for (const t of rules) {
      if (t.length > RULE_TEXT_WARN) result.longRules.push({ section: idx, len: t.length, head: t.slice(0, 40) });
    }
    result.sections.push({ idx, height: Math.round(h), hasImage: !!shot, sticky, longRules: longOne });
    if (shot && h > 900 && sticky !== 'sticky') result.stickyMissing.push(idx);
  }
  return result;
})()`;

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.html) {
    console.log('用法: node smoke_check.mjs --html <宣讲HTML> [--out <截图png>] [--width 1440] [--chrome <浏览器路径>]');
    return args.help ? 0 : 1;
  }
  const html = resolve(args.html);
  if (!existsSync(html)) {
    console.log(`[FAIL] 找不到 HTML: ${html}`);
    return 1;
  }
  const chrome = findChrome(args.chrome);
  if (!chrome) {
    console.log('[FAIL] 未找到 Chrome/Edge；用 --chrome <路径> 或 CHROME_PATH 指定。');
    return 1;
  }

  // profile 放系统临时目录，不要污染被检查 HTML 所在的目录
  const userDir = join(tmpdir(), `sr-html-smoke-${process.pid}-${Date.now()}`);
  mkdirSync(userDir, { recursive: true });
  const child = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${args.port}`,
      `--user-data-dir=${userDir}`,
      `--window-size=${args.width},1200`,
      'about:blank',
    ],
    { stdio: 'ignore', detached: false },
  );

  let exitCode = 0;
  try {
    await waitForDevtools(args.port);
    const targets = await (await fetch(`http://127.0.0.1:${args.port}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('DevTools 没给出 page target');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    const { send, once } = cdp(ws);
    await send('Page.enable');
    await send('Runtime.enable');

    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: pathToFileURL(html).href });
    await loaded;
    await sleep(400); // 给 base64 大图解码留一点时间

    const evalRes = await send('Runtime.evaluate', { expression: PAGE_CHECKS, returnByValue: true });
    const r = evalRes.result.value;

    // 整页截图（供人目视复核；机器检查不替代眼睛）
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: args.width, height: Math.min(r.scrollHeight, 30000), scale: 1 },
    });
    const outPath = resolve(args.out || html.replace(/\.html?$/i, '') + '_smoke.png');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, Buffer.from(shot.data, 'base64'));

    const fails = [];
    const warns = [];

    console.log(`页面标题: ${r.title}`);
    console.log(`页面尺寸: ${r.scrollWidth} x ${r.scrollHeight}（视口宽 ${r.clientWidth}，${r.sections.length} 节 / ${r.images.length} 图）`);
    console.log('');

    // 1 破图
    if (r.brokenImages.length) fails.push(`1) 有破图 ${r.brokenImages.length} 张：${r.brokenImages.join(' / ')}`);
    else console.log(`[OK]   1) 无破图（${r.images.length} 张全部解码成功）`);

    // 2 横向溢出
    if (r.scrollWidth > r.clientWidth + 1) fails.push(`2) 横向溢出：文档宽 ${r.scrollWidth} > 视口宽 ${r.clientWidth}`);
    else console.log('[OK]   2) 无横向溢出');

    // 3 文字墙
    if (r.longRules.length) {
      fails.push(`3) 疑似文字墙 ${r.longRules.length} 处（阈值 ${RULE_TEXT_WARN} 字）：${r.longRules
        .map((x) => `第${x.section}节 ${x.len}字「${x.head}…」`)
        .join(' / ')}`);
    } else console.log(`[OK]   3) 无文字墙（规则块 ${r.textP} 条，均在阈值内）`);

    // 4 布局失衡
    if (r.stickyMissing.length) {
      warns.push(`4) 第 ${r.stickyMissing.join('、')} 节较高但没有 sticky 左图：滚动时图会先消失、右侧还剩多屏文字`);
      console.log(`[WARN] 4) ${r.stickyMissing.length} 个长章节的左图不是 sticky`);
    } else {
      const stickyCount = r.sections.filter((s) => s.sticky === 'sticky').length;
      console.log(`[OK]   4) 长章节左图吸顶正常（sticky 左图 ${stickyCount} 个）`);
    }
    if (r.images.length === 0) {
      warns.push('4) 全篇无截图：左栏全是占位框、右栏全是规则，双栏会呈"左空右满"的失衡版式——'
        + '交付前必须已与用户确认（补图，或明确接受纯文字版并在页脚标注）');
      console.log('[WARN] 4) 全篇无截图，左空右满的失衡风险无法靠吸顶缓解');
    }

    // 5 导航锚点
    if (r.tocBroken.length) fails.push(`5) 导航锚点失效：${r.tocBroken.join('、')}`);
    else console.log(`[OK]   5) 章节导航全部可用（${r.tocTotal} 个锚点，逐个命中）`);

    // 附带：承载红线（图片必须内嵌）
    if (r.overflowImages.length) fails.push(`承载红线：存在非 data: 内嵌图片（${r.overflowImages.join('、')}）——宣讲 HTML 必须单文件自包含`);
    else console.log('[OK]   承载：全部图片均为 data: base64 内嵌，无外链/散装目录');

    console.log('');
    console.log(`整页截图: ${outPath}`);

    for (const w of warns) console.log(`[WARN] ${w}`);
    if (fails.length) {
      console.log('');
      for (const f of fails) console.log(`[FAIL] ${f}`);
      console.log(`\n结论：冒烟不通过（${fails.length} 项失败 / ${warns.length} 项警告）——修 content.json 后重跑。`);
      exitCode = 1;
    } else {
      console.log(`\n结论：冒烟通过（0 失败 / ${warns.length} 警告）。截图仍需人目视复核一遍再交付。`);
    }
    ws.close();
  } catch (err) {
    console.log(`[FAIL] 检查过程出错: ${err.message}`);
    exitCode = 1;
  } finally {
    try {
      child.kill();
    } catch {
      /* 忽略 */
    }
    await sleep(300);
    try {
      rmSync(userDir, { recursive: true, force: true });
    } catch {
      /* 临时 profile 删不掉不影响结论 */
    }
  }
  return exitCode;
}

process.exit(await main());
