#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""annotate-ui-diff.py — 把「效果图 vs 工程截图」的差异画成标注图。

每张标注图只标一类问题，版式为：
    标题条（界面名 + 问题类别 + 编号）
    区域内左右并排：左「效果图」/ 右「工程（实机）」
    区域下方：说明文字（自动换行）
    末尾：待确认 / 备注（可选）

标注框有两种颜色：绿框标效果图（正确做法），红框标工程（问题所在）。
marks 一律用原图（默认 1080x1920）绝对坐标，脚本内部换算。

用法:
    python annotate-ui-diff.py --spec ui-diff.json \
        --effect-dir "…/UI效果图" --game-dir "…/工程截图" --out-dir "…/标注"
    python annotate-ui-diff.py --spec ui-diff.json --only A1        # 只重出某一张
    python annotate-ui-diff.py --print-schema                      # 打印数据格式

依赖: Pillow（`python -m pip install pillow`），中文字体用系统里的微软雅黑 / 思源黑体。
"""
import argparse
import json
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit('✗ 缺少 Pillow：先跑 `python -m pip install pillow`')

# ---------------------------------------------------------------- 默认值

CAT_COLORS = {
    '多余元素': (214, 58, 54),
    '缺失元素': (226, 136, 26),
    '样式差异': (168, 68, 196),
    '布局差异': (30, 126, 216),
    '文案差异': (0, 152, 128),
    '状态差异': (108, 112, 128),
    '交互差异': (150, 90, 20),
}
GREEN = (0, 178, 96)     # 效果图一侧
RED = (236, 42, 42)      # 工程一侧

FONT_CANDIDATES_BOLD = [
    r'C:\Windows\Fonts\msyhbd.ttc',
    r'C:\Windows\Fonts\SourceHanSansCNBold.ttf',
    '/System/Library/Fonts/PingFang.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc',
]
FONT_CANDIDATES_REG = [
    r'C:\Windows\Fonts\msyh.ttc',
    r'C:\Windows\Fonts\SourceHanSansCNRegular.ttf',
    '/System/Library/Fonts/PingFang.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
]

SCHEMA = r"""
ui-diff.json 数据格式（一个数组，一项 = 一张标注图 = 一类问题）

[
  {
    "id": "A1",                                  // 页码，如 A1 / B2，便于和报告互相引用
    "file": "A1_圣物装配_多余元素_顶部资源栏.png",   // 输出文件名
    "panel": "圣物装配",                          // 界面名（标题条）
    "category": "多余元素",                       // 多余元素|缺失元素|样式差异|布局差异|文案差异|状态差异
    "effect": "圣物装配.png",                     // 效果图文件名（在 --effect-dir 里找）
    "game": "圣物装配.png",                       // 工程截图文件名（在 --game-dir 里找）
    "zoom": 1.0,                                 // 可选：默认缩放
    "regions": [
      {
        "crop": [0, 0, 1080, 200],               // [x, y, 宽, 高]，原图坐标
        "crop_effect": [0, 0, 1080, 200],        // 可选：左右两张图裁不同区域时用
        "crop_game":   [0, 10, 1080, 200],
        "effect": "另一张效果图.png",             // 可选：本区域改用别的图
        "game":   "另一张工程图.png",
        "zoom": 1.4,
        "marks_effect": [[612, 2, 428, 92, "多出资源栏"]],   // 绿框，原图坐标 + 标签
        "marks_game":   [[612, 10, 428, 92, "多出资源栏"]],   // 红框
        "caption": ["说明第一句", "说明第二句"]                // 换行写多条
      }
    ],
    "notes": ["可选：整张图的补充说明 / 待确认项"]
  }
]

坐标技巧：
- 先用大范围 crop 出一版，看图再收紧，不要凭感觉写死。
- 文字类问题用「整行横带」（x=0、宽=1080、高≈90）最稳，不用精确对位。
- 一屏多个同类问题放同一个 regions 里，不要另开一张图。
"""


def find_font(cands, override=None):
    if override and os.path.exists(override):
        return override
    for p in cands:
        if os.path.exists(p):
            return p
    return None


class Renderer:
    def __init__(self, effect_dir, game_dir, out_dir, font_bold=None, font_reg=None):
        self.effect_dir = effect_dir
        self.game_dir = game_dir
        self.out_dir = out_dir
        self.fb = find_font(FONT_CANDIDATES_BOLD, font_bold)
        self.fr = find_font(FONT_CANDIDATES_REG, font_reg) or self.fb
        if not self.fb:
            sys.exit('✗ 找不到中文字体：用 --font-bold / --font-reg 指定一个 .ttf/.ttc')
        self._cache = {}

    def F(self, bold, size):
        return ImageFont.truetype(self.fb if bold else self.fr, size)

    def load(self, which, name):
        key = (which, name)
        if key in self._cache:
            return self._cache[key]
        base = self.effect_dir if which == 'effect' else self.game_dir
        p = os.path.join(base, name)
        if not os.path.exists(p):
            raise FileNotFoundError(f'{"效果图" if which == "effect" else "工程截图"}找不到：{p}')
        im = Image.open(p).convert('RGB')
        if im.size != (1080, 1920):
            im = im.resize((1080, 1920), Image.LANCZOS)
        self._cache[key] = im
        return im

    @staticmethod
    def wrap(draw, text, fnt, maxw):
        lines, cur = [], ''
        for ch in text:
            if draw.textlength(cur + ch, font=fnt) > maxw and cur:
                lines.append(cur)
                cur = ch
            else:
                cur += ch
        if cur:
            lines.append(cur)
        return lines

    def crop(self, img, rect, zoom, marks, color, lw=6):
        ox, oy, w, h = rect
        c = img.crop((ox, oy, ox + w, oy + h)).convert('RGBA')
        d = ImageDraw.Draw(c)
        for (mx, my, mw, mh, label) in marks:
            x, y = mx - ox, my - oy
            d.rounded_rectangle([x, y, x + mw, y + mh], radius=12, outline=color + (255,), width=lw)
            if not label:
                continue
            f = self.F(True, 26)
            tb = d.textbbox((0, 0), label, font=f)
            tw, th = tb[2] - tb[0], tb[3] - tb[1]
            bx = max(0, min(x, w - tw - 20))
            by = y - th - 16
            below = by < 0
            if below:
                by = y + mh + 8
            d.line([(x + mw // 2, y - 3 if not below else y + mh + 3),
                    (x + mw // 2, (by + th + 12) if below else by - 3)],
                   fill=color + (255,), width=3)
            d.rounded_rectangle([bx, by, bx + tw + 18, by + th + 12], radius=7, fill=color + (255,))
            d.text((bx + 9, by + 3), label, font=f, fill=(255, 255, 255, 255))
        if zoom != 1:
            c = c.resize((max(1, int(w * zoom)), max(1, int(h * zoom))), Image.LANCZOS)
        return c

    def build(self, spec):
        panel, cat = spec['panel'], spec['category']
        color = CAT_COLORS.get(cat, (200, 60, 60))

        rendered = []
        for r in spec['regions']:
            z = r.get('zoom', spec.get('zoom', 1.0))
            efile = r.get('effect', spec['effect'])
            gfile = r.get('game', spec['game'])
            ecrop = r.get('crop_effect') or r.get('crop')
            gcrop = r.get('crop_game') or r.get('crop')
            e = self.crop(self.load('effect', efile), ecrop, z, r.get('marks_effect', []), GREEN)
            g = self.crop(self.load('game', gfile), gcrop, z, r.get('marks_game', []), RED)
            rendered.append((r, e, g))

        colw = max(max(e.width, g.width) for _, e, g in rendered)
        content_w = max(colw * 2 + 46, 1520)
        pad = 32
        total_w = content_w + pad * 2

        HEAD, LABEL_H, CAP_H, GAP = 152, 54, 46, 22
        cf = self.F(False, 31)
        tmp = ImageDraw.Draw(Image.new('RGB', (10, 10)))
        cap_lines, note_lines = {}, []
        for r, _e, _g in rendered:
            out = []
            for line in r.get('caption', []):
                out.extend(self.wrap(tmp, '· ' + line, cf, content_w - 20))
            cap_lines[id(r)] = out
        for n in spec.get('notes', []):
            note_lines.extend(self.wrap(tmp, n, cf, content_w - 60))

        body = sum(max(e.height, g.height) + LABEL_H + CAP_H * len(cap_lines[id(r)]) + GAP
                   for r, e, g in rendered)
        note_h = len(note_lines) * CAP_H + 34 if note_lines else 0
        total_h = HEAD + body + note_h + 24

        canvas = Image.new('RGBA', (total_w, total_h), (22, 25, 31, 255))
        d = ImageDraw.Draw(canvas)
        d.rectangle([0, 0, total_w, HEAD], fill=(14, 17, 22, 255))
        d.rectangle([0, 0, 14, HEAD], fill=color + (255,))
        d.text((40, 24), panel, font=self.F(True, 54), fill=(255, 255, 255, 255))
        tf = self.F(True, 34)
        tb = d.textbbox((0, 0), cat, font=tf)
        d.rounded_rectangle([44, 96, 44 + (tb[2] - tb[0]) + 36, 142], radius=10, fill=color + (255,))
        d.text((62, 103), cat, font=tf, fill=(255, 255, 255, 255))
        sid = spec.get('id', '')
        if sid:
            f2 = self.F(True, 42)
            b2 = d.textbbox((0, 0), sid, font=f2)
            d.text((total_w - 40 - (b2[2] - b2[0]), 26), sid, font=f2, fill=(140, 148, 162, 255))

        y = HEAD + 8
        lf = self.F(True, 34)
        for (r, e, g) in rendered:
            d.text((pad, y + 6), '效果图', font=lf, fill=(116, 208, 255, 255))
            d.text((pad + colw + 46, y + 6), '工程（实机）', font=lf, fill=(255, 172, 120, 255))
            y += LABEL_H
            canvas.alpha_composite(e, (pad, y))
            canvas.alpha_composite(g, (pad + colw + 46, y))
            h = max(e.height, g.height)
            d.line([(pad + colw + 20, y), (pad + colw + 20, y + h)], fill=(66, 72, 84, 255), width=3)
            y += h + 8
            for line in cap_lines[id(r)]:
                d.text((pad, y), line, font=cf, fill=(224, 229, 238, 255))
                y += CAP_H
            y += GAP

        if note_lines:
            d.rectangle([pad, y, total_w - pad, y + note_h - 18], fill=(36, 40, 50, 255))
            yy = y + 14
            for n in note_lines:
                d.text((pad + 18, yy), n, font=cf, fill=(198, 205, 218, 255))
                yy += CAP_H

        os.makedirs(os.path.dirname(spec['_out']) or '.', exist_ok=True)
        canvas.convert('RGB').save(spec['_out'], 'PNG')
        return spec['_out']


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument('--spec', help='标注数据 JSON')
    ap.add_argument('--effect-dir', help='效果图目录')
    ap.add_argument('--game-dir', help='工程截图目录')
    ap.add_argument('--out-dir', help='标注图输出目录')
    ap.add_argument('--only', help='只重出某个 id，例如 A1')
    ap.add_argument('--font-bold')
    ap.add_argument('--font-reg')
    ap.add_argument('--print-schema', action='store_true')
    a = ap.parse_args()

    if a.print_schema or not a.spec:
        print(SCHEMA)
        return

    for k in ('effect_dir', 'game_dir', 'out_dir'):
        if not getattr(a, k):
            sys.exit(f'✗ 缺少 --{k.replace("_", "-")}')

    with open(a.spec, encoding='utf-8') as f:
        specs = json.load(f)
    if isinstance(specs, dict):
        specs = specs.get('sheets', [])

    r = Renderer(a.effect_dir, a.game_dir, a.out_dir, a.font_bold, a.font_reg)
    n = 0
    for s in specs:
        if a.only and s.get('id') != a.only:
            continue
        s['_out'] = os.path.join(a.out_dir, s['file'])
        r.build(s)
        print('✓', s['file'])
        n += 1
    print(f'共 {n} 张')


if __name__ == '__main__':
    main()
