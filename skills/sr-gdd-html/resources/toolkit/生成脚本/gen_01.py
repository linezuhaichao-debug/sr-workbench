#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""宣讲 HTML 生成器（按 01_宣讲会模板.md 轻量模板）。

用法：
  python gen_01.py --content content.json --img-dir 截图 --out 01_宣讲会交付.html

content.json 结构（见 content_示例.json）：
{
  "kicker": "顶部小标（如 SR · 交互交付宣讲）",
  "title": "活动名",
  "sub": "一句话定位 + 术语（可含 <b>）",
  "steps": ["主流程步骤1", "步骤2", ...],          // 渲染为可换行胶囊
  "footer": "页脚（包名/版本/指引，可含 <br>）",
  "sections": [
    {
      "id": "hud", "num": "01", "title": "界面名 · 状态",
      "image": "01_xxx.png",                      // 截图目录内文件名；无图填 null 并给 guide
      "image_note": "图注第二行（可选，默认用文件名去后缀）",
      "guide": "无图时的指路文案（有 image 时忽略）",
      "rules": [["控件名", "规则文本"], ...]        // 一条=一个规则块；文本可含 <b>/<br>
    }
  ]
}

规则：只放最终规则，禁止确认编号/用户原话/过程性信息（模板红线）。
产出：单文件自包含 HTML（截图 base64 内嵌），生成后请按模板的轻量视觉冒烟清单自查。
"""
from __future__ import annotations

import argparse
import base64
import html as H
import json
import sys
from pathlib import Path

CSS = """:root{--bg:#f5f3ee;--paper:#fffdf9;--ink:#262b33;--muted:#7d8590;--navy:#1d3a5f;--amber:#b4711a;--line:#e7e2d8}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Microsoft YaHei","PingFang SC",sans-serif;line-height:1.85}
header{background:var(--navy);color:#f7f4ec;padding:56px 48px 44px}
header .wrap{max-width:1120px;margin:0 auto}
header .kicker{font-size:13px;letter-spacing:.35em;color:#cfd9e8;margin:0 0 14px}
header h1{font-size:34px;margin:0 0 14px;color:#fff}
header .sub{font-size:14.5px;color:#e8edf5;margin:0;max-width:860px;line-height:2}
header .steps{margin-top:26px;max-width:940px;display:flex;flex-wrap:wrap;gap:8px 6px;align-items:center}
header .step{font-size:12.5px;color:#e8edf5;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:4px 14px;white-space:nowrap}
header .arrow{color:#9db2cd;font-size:13px}
.toc{max-width:1120px;margin:36px auto 0;padding:0 24px;display:flex;flex-wrap:wrap;gap:10px}
.toc a{text-decoration:none;color:var(--navy);background:var(--paper);border:1px solid var(--line);border-radius:999px;padding:6px 16px 6px 10px;font-size:13px}
.toc a:hover{border-color:var(--amber)}
.toc .tn{display:inline-block;color:var(--amber);font-weight:700;margin-right:7px;font-size:12px}
main{max-width:1120px;margin:26px auto 80px;padding:0 24px}
section{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:48px 56px 52px;margin:40px 0}
.s-head{display:flex;align-items:baseline;gap:18px;border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:38px}
.s-num{font-size:40px;font-weight:800;color:var(--amber);line-height:1}
.s-head h3{margin:0;font-size:21px;color:var(--navy)}
.s-body{display:grid;grid-template-columns:minmax(280px,380px) 1fr;gap:88px;align-items:start}
.shot{margin:0;position:sticky;top:40px}
.shot img{width:100%;max-width:380px;display:block;border-radius:14px;border:1px solid var(--line);box-shadow:0 10px 28px rgba(38,43,51,.10)}
.shot figcaption{margin-top:16px;font-size:13px;text-align:center;line-height:1.7}
.shot figcaption span{display:block;font-size:11.5px;color:var(--muted)}
.noimg{border:2px dashed #d5cfc2;border-radius:14px;padding:56px 26px;text-align:center}
.noimg-t{font-size:15px;color:var(--muted)}
.noimg-d{font-size:12px;color:#a9a294;margin-top:12px;line-height:1.8}
.rules{min-width:0}
.rules strong{display:inline-block;margin-top:2px;color:var(--navy)}
.rules p{margin:0 0 26px;font-size:14px;color:#3a414b;line-height:1.95;max-width:640px}
.rules b{color:var(--ink)}
footer{padding:30px;text-align:center;font-size:12px;color:var(--muted)}
@media (max-width:900px){header{padding:44px 26px}section{padding:30px 24px 34px;margin:24px 0}.s-body{grid-template-columns:1fr;gap:34px}.shot{position:static}.shot img{margin:0 auto}}"""


def b64(path: Path) -> str:
    blob = path.read_bytes()
    suffix = path.suffix.lstrip(".").lower()
    suffix = "jpeg" if suffix == "jpg" else suffix
    return f"data:image/{suffix};base64," + base64.b64encode(blob).decode("ascii")


def render(data: dict, img_dir: Path) -> str:
    toc = "".join(
        f'<a href="#{s["id"]}"><span class="tn">{H.escape(s["num"])}</span>{H.escape(s["title"])}</a>'
        for s in data["sections"])
    steps_html = ('<span class="step">' + '</span><span class="arrow">→</span><span class="step">'
                  .join(H.escape(x) for x in data["steps"]) + "</span>")

    secs = []
    for s in data["sections"]:
        img = s.get("image")
        if img:
            path = img_dir / img
            if not path.is_file():
                raise SystemExit(f"[FAIL] 截图不存在: {path}")
            note = s.get("image_note") or Path(img).stem
            left = (f'<figure class="shot"><img src="{b64(path)}" alt="{H.escape(s["title"])}">'
                    f'<figcaption>{H.escape(s["title"])}<span>{H.escape(note)}</span></figcaption></figure>')
        else:
            left = (f'<div class="noimg"><div class="noimg-t">暂无参考图</div>'
                    f'<div class="noimg-d">{H.escape(s.get("guide", ""))}</div></div>')
        blocks = "".join(
            f'<p><strong>{H.escape(label)}</strong><br>{text}</p>'  # text 允许 <b>/<br>
            for label, text in s["rules"])
        secs.append(f"""<section id="{H.escape(s['id'])}">
<div class="s-head"><span class="s-num">{H.escape(s['num'])}</span><h3>{H.escape(s['title'])}</h3></div>
<div class="s-body">{left}<div class="rules">{blocks}</div></div>
</section>""")

    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{H.escape(data['title'])} · 交互交付宣讲</title>
<style>{CSS}</style></head><body>
<header><div class="wrap">
  <p class="kicker">{H.escape(data.get('kicker', '交互交付宣讲'))}</p>
  <h1>{H.escape(data['title'])}</h1>
  <p class="sub">{data['sub']}</p>
  <div class="steps">{steps_html}</div>
</div></header>
<nav class="toc">{toc}</nav>
<main>{''.join(secs)}</main>
<footer>{data.get('footer', '')}</footer>
</body></html>"""


def main() -> int:
    ap = argparse.ArgumentParser(description="宣讲 HTML 生成器（01_宣讲会模板）")
    ap.add_argument("--content", required=True, help="content.json 路径")
    ap.add_argument("--img-dir", required=True, help="截图目录（图片文件名与 content 一致）")
    ap.add_argument("--out", required=True, help="输出 HTML 路径")
    args = ap.parse_args()

    data = json.loads(Path(args.content).read_text(encoding="utf-8"))
    for key in ("title", "sub", "steps", "sections"):
        if key not in data:
            print(f"[FAIL] content.json 缺少字段: {key}")
            return 1
    for s in data["sections"]:
        for key in ("id", "num", "title", "rules"):
            if key not in s:
                print(f"[FAIL] 章节 {s.get('id', '?')} 缺少字段: {key}")
                return 1
        if not s.get("image") and not s.get("guide"):
            print(f"[FAIL] 章节 {s['id']} 既无 image 也无 guide（无图需指路占位，不留空）")
            return 1

    html = render(data, Path(args.img_dir))
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    n_img = sum(1 for s in data["sections"] if s.get("image"))
    print(f"生成完成: {out}（{out.stat().st_size // 1024}KB，{len(data['sections'])} 节 / {n_img} 图）")
    print("提醒：按 01_宣讲会模板.md 末尾的轻量视觉冒烟清单自查后再交付。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
