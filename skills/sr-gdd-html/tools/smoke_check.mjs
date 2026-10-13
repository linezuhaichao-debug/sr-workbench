#!/usr/bin/env node
/**
 * 定稿人读版 HTML 的视觉冒烟检查器（sr-gdd-html 可选工具）。
 *
 * 渲染是 am 干的，这里只回答"这一页真的打开了吗、还是不是单文件"：
 *   1) 无破图            —— 每张 <img> 都真的解码成功（naturalWidth > 0）
 *   2) 无横向溢出        —— 文档不出现横向滚动条
 *   3) 图片全部内嵌      —— 每张图的 src 都必须是 data:（承载红线：外发不能丢图）
 *   4) 无外部资源        —— 没有 <link> / 外链 <script> / http(s) 图片（离线可用）
 *   5) 面板与目录可用    —— 面板数 > 0；doc 模板的每个目录锚点都能命中节点
 *   6) 草稿源内嵌        —— #am-source 在（说明这页能 am patch 局部改，不必整页重渲）
 *   7) 界面图吸顶        —— 「图 + 正文」面板的图必须 sticky，并实测滚动后图还在视口里
 *      （规则再长也能对着图读；靠内置 am 自带的 CSS，不是后处理）
 *   8) 面板字母 ID 已清   —— am 自动分配的 A/B/C 要去掉：定稿标题自带 § 编号，两套叠着是噪音
 *   9) 左侧目录能自己滚   —— 目录比视口高时 sticky 留不住它（会跟着正文走、点不到下面的章节），
 *                           要给它视口高度上限 + 自己的滚动条；这里是滚到文档中部实测
 * 另外输出整页截图，供人目视复核——机器检查不替代眼睛。
 *
 * 依赖：Node.js ≥ 22（用到内置 WebSocket 与 fetch），本机已装 Chrome 或 Edge。无第三方包。
 *
 * 用法：
 *   node smoke_check.mjs --html 联盟讨伐_宣讲.html [--out smoke.png] [--width 1440] [--chrome <路径>]
 *
 * 退出码：0 = 全过；1 = 有失败项或环境不可用。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  // ★ 视口高默认 900：这是"目录会不会超高"的关键变量 —— 目录 35 个面板时约 1045px 高，
  //   在 1200px 视口里塞得下（测不出问题），在真实笔记本的 ~900px 视口里就超高、
  //   sticky 会失效。用大视口测等于**把要测的场景排除掉了**。
  const out = { html: null, out: null, width: 1440, height: 900, chrome: null, port: 9334 };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--html') out.html = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--width') out.width = Number(argv[++i]);
    else if (a === '--height') out.height = Number(argv[++i]);
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
  const result = {
    title: document.title,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    panels: document.querySelectorAll('.am-panel').length,
    tables: document.querySelectorAll('.am-table-wrap > table').length,
    diagrams: document.querySelectorAll('.am-diagram').length,
    images: [],
    brokenImages: [],
    externalImages: [],
    externalRefs: [],
    tocTotal: 0,
    tocBroken: [],
    hasSource: !!document.getElementById('am-source'),
    sourceChars: (document.getElementById('am-source') || {}).value ? document.getElementById('am-source').value.length : 0,
  };
  for (const img of document.images) {
    const src = img.currentSrc || img.src || '';
    const kind = src.startsWith('data:') ? 'data:' : (src.startsWith('http') ? 'EXTERNAL' : 'relative');
    const broken = !img.complete || img.naturalWidth === 0;
    result.images.push({ kind, broken, w: img.naturalWidth, h: img.naturalHeight, alt: img.alt || '' });
    if (broken) result.brokenImages.push(img.alt || src.slice(0, 60));
    if (kind !== 'data:') result.externalImages.push(kind + ' ' + (img.alt || src.slice(0, 60)));
  }
  for (const el of document.querySelectorAll('link[href], script[src], iframe[src], object[data], embed[src]')) {
    const url = el.getAttribute('href') || el.getAttribute('src') || el.getAttribute('data') || '';
    result.externalRefs.push(el.tagName.toLowerCase() + ' → ' + String(url).slice(0, 80));
  }
  const tocLinks = Array.from(document.querySelectorAll('.am-toc a[href^="#"]'));
  result.tocTotal = tocLinks.length;
  for (const a of tocLinks) {
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (!document.getElementById(id)) result.tocBroken.push(id);
  }
  /**
   * 面板字母 ID（am 自动分配的 A/B/C）——定稿标题里**已经带着自己的 § 编号**，
   * 两套编号叠着（如「G · §4.4 R4 战斗」）纯粹是噪音，应当已清掉。
   * ★ 目录那一处只能查文本：am 把它和标题拼成了**一个文本节点**，没有独立元素可查。
   */
  result.panelIdSpans = document.querySelectorAll('.am-panel-id').length;
  result.tocWithId = Array.from(document.querySelectorAll('.am-toc a')).filter((a) => /^[A-Z0-9]{1,3} · /.test((a.textContent || '').trim())).length;

  /**
   * 左侧目录能不能**自己滚**：定稿人读版动辄 20+ 个面板，目录本身就比视口高 ——
   * 而 sticky **留不住比视口高的元素**，它会跟着正文一起往下走，读者点不到下面的章节。
   * 这里滚到文档中部实测：目录还在视口里才算数（不是"写了 sticky"就算）。
   */
  result.tocBox = null;
  result.tocProbe = null;
  const tocEl = document.querySelector('.am-toc');
  if (tocEl) {
    const cs = getComputedStyle(tocEl);
    result.tocBox = {
      maxHeight: cs.maxHeight, overflowY: cs.overflowY,
      clientH: tocEl.clientHeight, scrollH: tocEl.scrollHeight,
    };
    const y0 = window.scrollY;
    window.scrollTo(0, Math.round(document.documentElement.scrollHeight * 0.5));
    const box = tocEl.getBoundingClientRect();
    result.tocProbe = { top: Math.round(box.top), inView: box.top >= -2 && box.top < window.innerHeight };
    window.scrollTo(0, y0);
  }

  // ── 界面图吸顶（内置 am 的版式：规则再长，图也留在视野里）────────────────
  const mdWithFigure = Array.from(document.querySelectorAll('.am-md'))
    .filter((md) => md.querySelector(':scope > .am-figure'));
  result.figurePanels = mdWithFigure.length;
  result.stickyFigures = mdWithFigure.filter((md) => getComputedStyle(md.querySelector(':scope > .am-figure')).position === 'sticky').length;
  result.stickyProbe = null;
  // 「吸顶可用行程」= 面板高 − 图高：这是图能粘住多久、规则能多滚多少的真实余量
  result.stickyRoom = mdWithFigure.map((md) => {
    const r = md.getBoundingClientRect();
    const f = md.querySelector(':scope > .am-figure').getBoundingClientRect();
    return { panel: Math.round(r.height), figure: Math.round(f.height), room: Math.round(r.height - f.height) };
  });
  result.vh = window.innerHeight;
  // 行程够长（>60px）就滚得动、测得准；滚进面板内部，图应当还在视口里
  const tall = mdWithFigure
    .filter((md, i) => result.stickyRoom[i].room > 60)
    .filter((md) => getComputedStyle(md.querySelector(':scope > .am-figure')).position === 'sticky')[0];
  if (tall) {
    const fig = tall.querySelector(':scope > .am-figure');
    const rect = tall.getBoundingClientRect();
    const vh = window.innerHeight;
    const y0 = window.scrollY;
    window.scrollTo(0, y0 + rect.top + Math.min(result.stickyRoom[mdWithFigure.indexOf(tall)].room, vh * 0.35));
    const after = fig.getBoundingClientRect();
    result.stickyProbe = { top: Math.round(after.top), inView: after.top > -2 && after.bottom < vh + 2 };
    // 没吸住时把祖先链带回来：sticky 失效几乎总是某个祖先的 overflow / display 干的
    if (!result.stickyProbe.inView) {
      result.stickyChain = [];
      for (let el = fig.parentElement; el && el !== document.documentElement; el = el.parentElement) {
        const cs = getComputedStyle(el);
        result.stickyChain.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0] +
          ' [overflow=' + cs.overflow + ' display=' + cs.display + ' position=' + cs.position + ']');
      }
    }
    window.scrollTo(0, y0);
  }
  return result;
})()`;

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.html) {
    console.log('用法: node smoke_check.mjs --html <定稿人读版HTML> [--out <截图png>] [--width 1440] [--height 900] [--chrome <浏览器路径>]');
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
      `--window-size=${args.width},${args.height}`,
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
    await sleep(600); // 给 base64 大图解码与页面脚本留一点时间

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
    console.log(`页面尺寸: ${r.scrollWidth} x ${r.scrollHeight}（视口宽 ${r.clientWidth}）`);
    console.log(`内容规模: ${r.panels} 面板 / ${r.tables} 表格 / ${r.diagrams} 图 / ${r.images.length} 图片`);
    console.log('');

    // 1 破图
    if (r.brokenImages.length) fails.push(`1) 有破图 ${r.brokenImages.length} 张：${r.brokenImages.join(' / ')}`);
    else console.log(`[OK]   1) 无破图（${r.images.length} 张全部解码成功）`);

    // 2 横向溢出
    if (r.scrollWidth > r.clientWidth + 1) fails.push(`2) 横向溢出：文档宽 ${r.scrollWidth} > 视口宽 ${r.clientWidth}`);
    else console.log('[OK]   2) 无横向溢出');

    // 3 承载红线：图片必须内嵌
    if (r.externalImages.length) {
      fails.push(`3) 承载红线：${r.externalImages.length} 张图不是 data: 内嵌 —— ${r.externalImages.join(' / ')}（外发会丢图）`);
    } else {
      console.log(`[OK]   3) 图片全部 data: base64 内嵌（${r.images.length} 张）`);
    }

    // 4 无外部资源
    if (r.externalRefs.length) {
      fails.push(`4) 存在外部资源引用，页面不再单文件自包含：${r.externalRefs.join(' / ')}`);
    } else {
      console.log('[OK]   4) 无外部资源引用（无 link / 外链 script / iframe）');
    }

    // 5 面板与目录
    if (r.panels === 0) fails.push('5) 一个 .am-panel 都没有 —— 草稿没有 ## 面板，渲染结果不是一页文档');
    else console.log(`[OK]   5) 面板 ${r.panels} 个`);
    if (r.tocBroken.length) fails.push(`5) 目录锚点失效：${r.tocBroken.join('、')}`);
    else if (r.tocTotal > 0) console.log(`[OK]   5) 目录 ${r.tocTotal} 个锚点逐个命中`);
    else warns.push('5) 页面没有目录（面板少于 3 个时 am 不出目录）—— 定稿人读版通常不止 3 个面板，请确认没漏节');

    // 6 草稿源内嵌
    if (r.hasSource) console.log(`[OK]   6) 草稿源已内嵌（#am-source，${r.sourceChars} 字符）—— 可用 am patch 局部改`);
    else warns.push('6) 页面里没有 #am-source —— 改一处只能整页重渲（多半是手写 HTML 而不是 am 渲染的产物）');

    // 7 界面图吸顶（图与规则并排、规则再长图也在视野里）
    const rooms7 = r.stickyRoom || [];
    const maxRoom7 = rooms7.length ? Math.max(...rooms7.map((x) => x.room)) : null;
    if (r.figurePanels === 0) {
      console.log('[--]   7) 本页没有「界面图 + 正文」的面板，图吸顶这项不适用');
    } else if (r.stickyFigures === 0) {
      fails.push(`7) ${r.figurePanels} 个「界面图 + 正文」面板的图**没有吸顶** —— 规则一长图就滚走了。` +
        '这页不是用**内置的 am** 渲染的（`resources/am/am.mjs` 被换回上游版了？）');
    } else if (rooms7.some((x) => x.figure > r.vh * 0.55)) {
      // 图没受视口高度约束 ⇒ 比右栏还高、吸顶在结构上不可能（补丁里的 max-height 没生效）
      const worst = rooms7.filter((x) => x.figure > r.vh * 0.55).map((x) => `${x.figure}px`).join('、');
      fails.push(`7) 界面图没有视口高度上限（${worst}，视口 ${r.vh}px）—— 图比右栏还高，sticky 没有可移动空间、滚起来照样走。` +
        '内置 am 的 max-height 没生效（`resources/am/am.mjs` 被换回上游版了？）');
    } else {
      const probe = r.stickyProbe;
      const room = rooms7[0];
      const roomText = room ? `（面板 ${room.panel}px / 图 ${room.figure}px ⇒ 吸顶可用行程 ${room.room}px）` : '';
      let tail;
      if (probe) tail = probe.inView ? `；实测滚进面板后图仍在视口（top ${probe.top}px）` : `；⚠ 滚动后图跑出了视口（top ${probe.top}px）`;
      else if (maxRoom7 !== null && maxRoom7 <= 0) tail = '；右栏比图短（一屏能看完），这个面板本来就不需要吸顶';
      else tail = '；行程不足 60px，未做滚动实测';
      const tone = (!probe && maxRoom7 !== null && maxRoom7 <= 0) ? '[--]  ' : '[OK]  ';
      console.log(`${tone} 7) 界面图吸顶：${r.stickyFigures}/${r.figurePanels} 个面板的图是 sticky${roomText}${tail}`);
      if (probe && !probe.inView) {
        fails.push(`7) 滚动实测：界面节里的图跑出了视口（top ${probe.top}px）—— sticky 没真正生效`);
        for (const line of r.stickyChain || []) console.log('       祖先链: ' + line);
      }
    }

    // 8 面板字母 ID 已清（am 的 A/B/C 与定稿标题自带的 § 编号是两套编号，叠着纯噪音）
    const idLeft = (r.panelIdSpans || 0) + (r.tocWithId || 0);
    if (idLeft > 0) {
      fails.push(`8) 面板字母 ID 还在（面板头部 ${r.panelIdSpans} 处 + 左侧目录 ${r.tocWithId} 处）——` +
        '它与定稿自带的 § 编号叠成两套编号。这页不是用**内置的 am** 渲染的（被换回上游版了？）');
    } else {
      console.log('[OK]   8) 面板字母 ID 已清（页面上只有定稿标题自带的 § 编号）');
    }

    // 9 左侧目录能自己滚（面板一多，目录比视口高时 sticky 留不住它 —— 读者点不到下面的章节）
    if (!r.tocBox) {
      console.log('[--]   9) 本页没有左侧目录（面板少于 3 个时 am 不出目录）');
    } else if (!r.tocProbe || !r.tocProbe.inView) {
      fails.push(`9) 左侧目录跟着正文滚走了（滚到文档中部时它在视口外，top ${r.tocProbe ? r.tocProbe.top : '?'}px）——` +
        '目录比视口高时 sticky 留不住它，读者点不到下面的章节。它需要自己的滚动条（内置 am 的 CSS 负责这条；被换回上游版了？）');
    } else {
      const b = r.tocBox;
      const canScroll = b.scrollH > b.clientH + 1;
      console.log(`[OK]   9) 左侧目录独立滚动：滚到文档中部时仍在视口（top ${r.tocProbe.top}px）` +
        `（可视高 ${b.clientH}px / 内容 ${b.scrollH}px${canScroll ? ' ⇒ 目录内部有自己的滚动条' : ' ⇒ 目录不长，无需内部滚动'}）`);
    }

    console.log('');
    console.log(`整页截图: ${outPath}`);

    for (const w of warns) console.log(`[WARN] ${w}`);
    if (fails.length) {
      console.log('');
      for (const f of fails) console.log(`[FAIL] ${f}`);
      console.log(`\n结论：冒烟不通过（${fails.length} 项失败 / ${warns.length} 项警告）——改草稿后重渲。`);
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
