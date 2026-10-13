#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""不漏信息校验器（sr-gdd-html 专用）。

本 skill 的存在理由就是"把定稿重排成宣讲稿，但一条信息都不许漏"。
这个脚本把"不许漏"变成可执行判据：**从定稿抽锚点，逐个查草稿里有没有落点**。

抽四类锚点（都是"定稿里的设计结论"的最小可核对单位）：

  * 章节标题（`### R1 升级条件`）            —— 章节不许整节丢
  * 表格每一行的**首列**（规则名 / 界面名 / 字段名 / 键名 / 范围层级…）
                                              —— 定稿本来就是表格为主的文档，
                                                 首列就是"这条结论叫什么"
  * 反引号里的标识（`表名.字段名`、文件名、枚举值）
                                              —— 配置指代与枚举不许漏
  * 编号（R1 / UE1 / AC1 / CS-YYYYMMDD-NNN）  —— 编号是回查定稿的锚

匹配口径：先归一化（去空白与标点、统一小写）再判**子串包含**；
不满足的退一步按**关键词覆盖率**判"部分命中"（≥ 0.6 算部分命中，需人工确认）。

用法：
    python cover_check.py --gdd 定稿.md --list                 # 第 2 步：只列基线锚点
    python cover_check.py --gdd 定稿.md --draft 草稿.md        # 第 3 步后：覆盖核对
    python cover_check.py --gdd 定稿.md --draft 草稿.md --limit 80

退出码：0 = 无"未命中"（可能有"部分命中"待人工确认）；1 = 有未命中 / 输入不合法。
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------- 抽取规则

HEAD_RE = re.compile(r"^(#{2,4})\s+(.+?)\s*$")
ROW_RE = re.compile(r"^\|(.+)\|\s*$")
SEP_RE = re.compile(r"^[\s|:\-]+$")
FENCE_RE = re.compile(r"^\s*```")
CODE_RE = re.compile(r"`([^`\n]+)`")
NUM_RE = re.compile(r"(?<![A-Za-z0-9])(R\d+|UE\d+|AC\d+|CS-\d{8}-\d+)(?![A-Za-z0-9])")

# 归一化：去掉所有分隔性标点与空白，统一小写
NOISE_RE = re.compile(r"[\s\u3000（）()【】\[\]{}：:，,。.、·\-—_/\\|｜“”\"'‘’!！?？;；+*#>]+")
# 开头的章节号（`§5.2 ` / `5.2 ` / `6.N `）
LEAD_NUM_RE = re.compile(r"^[§#\s]*[\d]+(?:\.[\dNn]+)*[\s.、:：]*")

# 明显不是"结论名"的首列值
SKIP_VALUES = {"", "-", "—", "－", "无", "待定", "待配表", "待确认", "n/a", "na", "tbd", "todo", "备注", "说明"}

MIN_LEN, MAX_LEN = 2, 40


def norm(s: str) -> str:
    return NOISE_RE.sub("", str(s).lower())


def clean(s: str) -> str:
    s = str(s).strip()
    s = re.sub(r"\*\*|__|`|\*", "", s)
    s = LEAD_NUM_RE.sub("", s.strip())
    return s.strip(" 　.。:：、-—")


def keywords(s: str) -> list:
    """把一段文本拆成关键词（中文按字组、英文/数字按词）——用于"部分命中"判定。"""
    out = []
    for chunk in re.split(r"[\s\u3000（）()【】\[\]{}：:，,。.、·\-—_/\\|｜]+", str(s)):
        chunk = chunk.strip()
        if not chunk:
            continue
        if re.fullmatch(r"[A-Za-z0-9_.]+", chunk):
            if len(chunk) >= 2:
                out.append(chunk.lower())
        elif len(chunk) >= 2:
            out.append(chunk)          # 中文词组整块算一个关键词
    return out


class Anchor:
    __slots__ = ("kind", "text", "key")

    def __init__(self, kind: str, text: str):
        self.kind = kind
        self.text = text
        self.key = norm(text)

    def __repr__(self) -> str:  # pragma: no cover - 调试用
        return f"<{self.kind}:{self.text}>"


def extract(gdd_text: str) -> list:
    """从定稿抽锚点（去重，按出现顺序）。"""
    anchors: list = []
    seen = set()

    def add(kind: str, raw: str) -> None:
        text = clean(raw)
        if not (MIN_LEN <= len(text) <= MAX_LEN):
            return
        if text.lower() in SKIP_VALUES:
            return
        key = norm(text)
        if len(key) < MIN_LEN or key in seen:
            return
        seen.add(key)
        anchors.append(Anchor(kind, text))

    in_fence = False
    lines = gdd_text.splitlines()
    for i, ln in enumerate(lines):
        if FENCE_RE.match(ln):
            in_fence = not in_fence
            continue
        if in_fence:
            continue

        m = HEAD_RE.match(ln)
        if m:
            add("标题", m.group(2))
            continue

        if ROW_RE.match(ln) and not SEP_RE.match(ln):
            # 表头行：下一行是分隔行 ⇒ 跳过（列名不是结论）
            if i + 1 < len(lines) and SEP_RE.match(lines[i + 1]) and "|" in lines[i + 1]:
                continue
            first = ln.strip().strip("|").split("|")[0]
            add("表格行", first)
            continue

    # 反引号标识与编号：全文扫（含表格内）
    for m in CODE_RE.finditer(gdd_text):
        token = m.group(1).strip()
        if len(token) < 3 or token.startswith(("http://", "https://")):
            continue
        add("标识", token)
    for m in NUM_RE.finditer(gdd_text):
        add("编号", m.group(1))

    return anchors


# ---------------------------------------------------------------- 核对

# 纯 ASCII 的锚点（英文键名 / 文件名 / `表名.字段名` 的英文段）：**必须整体出现**，不许拆词降级。
# 实测的理由：`alliance_boss_need_alliance` 这种键名被拆成 alliance / boss / need 之后，
# 只要前缀在草稿别处出现过就会被判成"部分命中"——那是**假阴性**，会把漏掉的键名藏起来。
ASCII_KEY_RE = re.compile(r"^[a-z0-9_.\-]+$")


def coverage(anchor: Anchor, draft_norm: str, draft_kw: set) -> str:
    """返回 'hit' / 'partial' / 'miss'。"""
    if anchor.key and anchor.key in draft_norm:
        return "hit"
    if ASCII_KEY_RE.match(anchor.key or ""):
        return "miss"
    kws = keywords(anchor.text)
    if not kws:
        return "miss"
    got = sum(1 for k in kws if k in draft_kw or k in draft_norm)
    if got == len(kws):
        return "hit"
    if got / len(kws) >= 0.6:
        return "partial"
    return "miss"


def main() -> int:
    # Windows 控制台默认按本地代码页输出，中文在 UTF-8 终端（DSH 会话）里会乱码；统一成 UTF-8。
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    ap = argparse.ArgumentParser(description="sr-gdd-html 不漏信息校验器")
    ap.add_argument("--gdd", required=True, help="源定稿 md 路径")
    ap.add_argument("--draft", default=None, help="草稿 md 路径（给了就做覆盖核对）")
    ap.add_argument("--list", action="store_true", help="只列基线锚点（第 2 步盘点用）")
    ap.add_argument("--limit", type=int, default=40, help="每类最多列出多少条（默认 40）")
    args = ap.parse_args()

    gpath = Path(args.gdd)
    if not gpath.is_file():
        print(f"[FAIL] 定稿不存在: {gpath}")
        return 1
    gdd = gpath.read_text(encoding="utf-8", errors="replace")
    anchors = extract(gdd)

    kinds: dict = {}
    for a in anchors:
        kinds[a.kind] = kinds.get(a.kind, 0) + 1
    summary = " · ".join(f"{k} {v}" for k, v in kinds.items())
    print(f"定稿：{gpath}")
    print(f"基线锚点 {len(anchors)} 个（{summary}）")

    if args.list or not args.draft:
        if not args.list:
            print("\n（未给 --draft：只做盘点，不做核对）")
        for kind in ("标题", "表格行", "标识", "编号"):
            group = [a for a in anchors if a.kind == kind]
            if not group:
                continue
            print(f"\n── {kind}（{len(group)}）")
            for a in group[: args.limit]:
                print(f"  · {a.text}")
            if len(group) > args.limit:
                print(f"  …（还有 {len(group) - args.limit} 条，用 --limit 调大）")
        return 0

    dpath = Path(args.draft)
    if not dpath.is_file():
        print(f"[FAIL] 草稿不存在: {dpath}")
        return 1
    draft = dpath.read_text(encoding="utf-8", errors="replace")
    draft_norm = norm(draft)
    draft_kw = set(keywords(draft))

    hits, partial, miss = [], [], []
    for a in anchors:
        r = coverage(a, draft_norm, draft_kw)
        (hits if r == "hit" else partial if r == "partial" else miss).append(a)

    print(f"草稿：{dpath}")
    print(f"命中 {len(hits)} · 部分命中 {len(partial)} · 未命中 {len(miss)}")

    if partial:
        print(f"\n[部分命中 {len(partial)}] —— 关键词没全对上，人工确认是不是换了个说法：")
        for a in partial[: args.limit]:
            print(f"  - [{a.kind}] {a.text}")
        if len(partial) > args.limit:
            print(f"  …（还有 {len(partial) - args.limit} 条）")

    if miss:
        print(f"\n[未命中 {len(miss)}] —— 定稿里有、草稿里找不到落点：")
        for a in miss[: args.limit]:
            print(f"  - [{a.kind}] {a.text}")
        if len(miss) > args.limit:
            print(f"  …（还有 {len(miss) - args.limit} 条）")

    if miss:
        print("\n结论：不通过 —— 每一条未命中都要处置：补进草稿，或在交付说明里写明为什么可以不出现。")
        return 1

    if partial:
        print("\n结论：通过（无未命中）—— 但上面每一条「部分命中」都要人工确认一遍再交付。")
        return 0

    print("\n结论：通过 —— 定稿锚点在草稿里全部有落点。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
