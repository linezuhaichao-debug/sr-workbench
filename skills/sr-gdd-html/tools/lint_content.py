#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""评审宣讲 content.json 校验器（sr-gdd-html 专用）。

在渲染之前跑，补上生成器不查的那一层：

  * 内容红线：确认编号（Q1/Q2…）、"拍板 / 已确认 / 跟推荐 / 用户原话"等过程措辞；
  * 承载红线：外链图片、`src=`/`href=` 注入、散装资源目录引用；
  * 注入安全：规则正文会被原样写进 HTML，除白名单标签外不得出现任何 `<...>`；
  * 结构完整性：字段、id/num 唯一性与格式、有图或有指路（不留空）、图片存在性；
  * 视觉风险（警告，不阻断）：文字墙、单节规则过多、流程步数越界。

用法：
    python lint_content.py --content content.json [--img-dir 截图] [--strict]

退出码：0 = 通过（可能有警告）；1 = 有 FAIL（含 --strict 下的 WARNING）。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------- 规则表

# 内容红线：(标签, 正则)。全部为 FAIL。
RED_LINES = [
    ("确认编号（Q1/Q2…）——过程性信息不进宣讲页", re.compile(r"(?<![A-Za-z0-9])Q\d+(?![A-Za-z0-9])")),
    ("过程措辞「拍板」", re.compile(r"拍板")),
    ("过程措辞「已确认」", re.compile(r"已确认")),
    ("过程措辞「跟推荐」", re.compile(r"跟推荐")),
    ("用户原话引用", re.compile(r"用户原话|用户说|用户要求原话")),
    ("Human Gate 选项词泄漏（approve/revise/reject）", re.compile(r"(?<![A-Za-z_])(approve|revise|reject)(?![A-Za-z_])")),
    ("证据/拍板编号（E001/T01/C1 式）", re.compile(r"(?<![A-Za-z0-9])(?:E\d{3}|T\d{2}|C\d+)(?![A-Za-z0-9])")),
]

# 承载红线：(标签, 正则)。FAIL。
CARRIER_FAIL = [
    ("内联 src=/href=（不得注入外部资源）", re.compile(r"(?i)\b(src|href)\s*=")),
    ("引用了散装资源目录", re.compile(r"(?i)\./assets/|/assets/|资产目录")),
    ("内联脚本/样式", re.compile(r"(?i)<\s*(script|style|iframe|link|object|embed)\b")),
    ("内联事件处理器", re.compile(r"(?i)\bon[a-z]+\s*=")),
]

# 明文外链：WARN（图片禁外链是 FAIL，但正文里贴一个文档链接只是提醒）。
EXTERNAL_LINK = re.compile(r"https?://")

# 规则正文允许出现的标签（生成器会把正文原样写进 HTML）。
ALLOWED_TAGS = {"b", "/b", "strong", "/strong", "i", "/i", "em", "/em", "br", "br/", "br /"}
TAG_RE = re.compile(r"<\s*/?\s*([A-Za-z][A-Za-z0-9]*)\s*/?\s*>")

ID_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*$")
NUM_RE = re.compile(r"^\d{2,}$")

RULE_TEXT_WARN = 240      # 单条规则正文超过即疑似文字墙
SECTION_RULES_WARN = 12   # 单节规则块过多，考虑拆节
STEPS_MIN, STEPS_MAX = 3, 12
STEPS_ADVISED = (4, 10)


def hits_of(pat: re.Pattern, text: str, limit: int = 3) -> list:
    """收集去重后的命中片段（最多 limit 个）——同一段文本里的多次违规都要看见。"""
    out: list = []
    for m in pat.finditer(text):
        got = m.group(0)
        if got not in out:
            out.append(got)
        if len(out) >= limit:
            break
    return out


def fmt_hits(hits: list) -> str:
    return "、".join(f"«{h}»" for h in hits)


class Report:
    def __init__(self) -> None:
        self.fails: list = []
        self.warns: list = []

    def fail(self, where: str, msg: str) -> None:
        self.fails.append(f"[FAIL] {where}: {msg}")

    def warn(self, where: str, msg: str) -> None:
        self.warns.append(f"[WARN] {where}: {msg}")

    def scan_text(self, where: str, text: str) -> None:
        """对一段将被写入 HTML 的文本做红线与注入扫描。"""
        for label, pat in RED_LINES:
            hits = hits_of(pat, text)
            if hits:
                self.fail(where, f"{label} —— 命中 {fmt_hits(hits)}")
        for label, pat in CARRIER_FAIL:
            hits = hits_of(pat, text)
            if hits:
                self.fail(where, f"{label} —— 命中 {fmt_hits(hits)}")
        for m in TAG_RE.finditer(text):
            if m.group(1).lower() not in ALLOWED_TAGS:
                self.fail(where, f"出现白名单外的标签 «{m.group(0)}»（正文只允许 <b>/<br>/<i> 这类轻量强调）")
        # 裸 '<' 没有被 TAG_RE 匹配到的，说明是写坏了的标签或未转义尖括号
        stripped = TAG_RE.sub("", text)
        if "<" in stripped or ">" in stripped:
            self.fail(where, "文本中存在未转义的尖括号，会被原样写入 HTML（需写成 &lt; / &gt;）")
        if EXTERNAL_LINK.search(text):
            self.warn(where, "文本含明文外链；图片一律内嵌，正文链接请确认不会离线失效")


def as_text(value) -> str:
    return value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)


def lint(data: dict, img_dir: Path | None) -> Report:
    rep = Report()

    # ---- 顶层字段
    for key in ("title", "sub", "steps", "sections"):
        if key not in data:
            rep.fail("content.json", f"缺少必需字段 {key}")
    if rep.fails:
        return rep

    rep.scan_text("title", as_text(data["title"]))
    rep.scan_text("sub", as_text(data["sub"]))
    if not isinstance(data["steps"], list) or not data["steps"]:
        rep.fail("steps", "必须是非空数组")
    else:
        for i, s in enumerate(data["steps"]):
            rep.scan_text(f"steps[{i}]", as_text(s))
        n = len(data["steps"])
        if not (STEPS_MIN <= n <= STEPS_MAX):
            rep.fail("steps", f"步数 {n} 越界（要求 {STEPS_MIN}–{STEPS_MAX} 步）")
        elif not (STEPS_ADVISED[0] <= n <= STEPS_ADVISED[1]):
            rep.warn("steps", f"步数 {n} 建议压到 {STEPS_ADVISED[0]}–{STEPS_ADVISED[1]} 步，胶囊太密会看不清")

    # ---- 章节
    sections = data["sections"]
    if not isinstance(sections, list) or not sections:
        rep.fail("sections", "必须是非空数组")
        return rep
    if len(sections) < 2:
        rep.warn("sections", f"只有 {len(sections)} 节；宣讲页通常 ≥2 节（逐界面节 + 收尾三节）")

    seen_ids, seen_nums, n_img = set(), set(), 0
    for idx, sec in enumerate(sections):
        where = f"sections[{idx}]"
        if not isinstance(sec, dict):
            rep.fail(where, "必须是对象")
            continue
        sid = as_text(sec.get("id", ""))
        where = f"sections[{idx}]({sid or '?'})"

        for key in ("id", "num", "title", "rules"):
            if key not in sec:
                rep.fail(where, f"缺少必需字段 {key}")
        sid = as_text(sec.get("id", ""))
        num = as_text(sec.get("num", ""))
        title = as_text(sec.get("title", ""))

        if not ID_RE.match(sid):
            rep.fail(where, f"id «{sid}» 不合法（须 ^[A-Za-z][A-Za-z0-9_-]*$，用作锚点）")
        elif sid in seen_ids:
            rep.fail(where, f"id «{sid}» 重复")
        else:
            seen_ids.add(sid)

        if not NUM_RE.match(num):
            rep.fail(where, f"num «{num}» 应为两位序号（如 01）")
        elif num in seen_nums:
            rep.fail(where, f"num «{num}» 重复")
        else:
            seen_nums.add(num)

        if not title.strip():
            rep.fail(where, "title 为空")
        else:
            rep.scan_text(f"{where}.title", title)
        if len(title) > 40:
            rep.warn(where, f"title 偏长（{len(title)} 字），节标题建议压到 40 字内")

        # 有图 or 指路，二者必居其一，不留空
        image = sec.get("image")
        guide = sec.get("guide")
        if image:
            n_img += 1
            if not isinstance(image, str) or not image.strip():
                rep.fail(where, "image 必须是非空文件名（无图请填 null 并给 guide）")
            elif img_dir is not None:
                p = Path(img_dir) / image
                if not p.is_file():
                    rep.fail(where, f"截图不存在：{p}")
        elif not (isinstance(guide, str) and guide.strip()):
            rep.fail(where, "既无 image 也无 guide —— 无图界面必须给指路占位，不留空")
        if guide:
            rep.scan_text(f"{where}.guide", as_text(guide))
        if sec.get("image_note"):
            rep.scan_text(f"{where}.image_note", as_text(sec["image_note"]))

        # 规则块
        rules = sec.get("rules")
        if not isinstance(rules, list) or not rules:
            rep.fail(where, "rules 必须是非空数组（一条 = 一个控件规则块）")
            continue
        for j, rule in enumerate(rules):
            rw = f"{where}.rules[{j}]"
            if not (isinstance(rule, (list, tuple)) and len(rule) == 2):
                rep.fail(rw, "每条规则必须是 [\"控件名\", \"规则正文\"] 两元组")
                continue
            label, text = rule
            if not (isinstance(label, str) and label.strip()):
                rep.fail(rw, "控件名（块标题）为空 —— 右栏必须是「控件名 + 规则」的块")
            else:
                rep.scan_text(f"{rw}.控件名", label)
                if len(label) > 24:
                    rep.warn(rw, f"控件名偏长（{len(label)} 字），小标题建议压到 24 字内")
            if not (isinstance(text, str) and text.strip()):
                rep.fail(rw, "规则正文为空")
                continue
            rep.scan_text(f"{rw}.正文", text)
            if len(text) > RULE_TEXT_WARN:
                rep.warn(rw, f"规则正文 {len(text)} 字，疑似文字墙（阈值 {RULE_TEXT_WARN}）——拆块或删枝节")
        if len(rules) > SECTION_RULES_WARN:
            rep.warn(where, f"单节 {len(rules)} 个规则块，考虑按状态拆节（每节应是「讲一个界面」的最小单元）")

    if n_img == 0:
        rep.warn("sections", "全篇无截图，左栏将全是占位框、右栏全是规则（左空右满的失衡版式）——"
                             "必须先向用户确认：补界面图后再出，还是明确接受纯文字版并在页脚标注；不得静默交付")
    return rep


def main() -> int:
    ap = argparse.ArgumentParser(description="sr-gdd-html content.json 校验器")
    ap.add_argument("--content", required=True, help="content.json 路径")
    ap.add_argument("--img-dir", default=None, help="截图目录（给了就校验图片存在性）")
    ap.add_argument("--strict", action="store_true", help="把警告也当作失败")
    args = ap.parse_args()

    cpath = Path(args.content)
    if not cpath.is_file():
        print(f"[FAIL] content 不存在: {cpath}")
        return 1
    try:
        data = json.loads(cpath.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"[FAIL] content.json 不是合法 JSON: {exc}")
        return 1

    img_dir = Path(args.img_dir) if args.img_dir else None
    if img_dir is not None and not img_dir.is_dir():
        print(f"[FAIL] --img-dir 不存在或不是目录: {img_dir}")
        return 1

    rep = lint(data, img_dir)

    for line in rep.fails:
        print(line)
    for line in rep.warns:
        print(line)
    if not rep.fails and not rep.warns:
        print("[OK] 红线、承载、结构与图片检查全部通过（0 失败 / 0 警告）")
    else:
        n_sec = len(data.get("sections", []) or [])
        n_img = sum(1 for s in (data.get("sections") or []) if isinstance(s, dict) and s.get("image"))
        print(f"\n小结：{n_sec} 节 / {n_img} 图 / {len(rep.fails)} 失败 / {len(rep.warns)} 警告")

    if rep.fails or (args.strict and rep.warns):
        print("结论：不通过 —— 修 content.json 后重跑（不要手改生成的 HTML）。")
        return 1
    print("结论：通过 —— 可以进入渲染步骤。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
