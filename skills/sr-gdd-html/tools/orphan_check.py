#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""反向核对（orphan check，sr-gdd-html 专用）。

`cover_check.py` 只查**一个方向**：定稿有的，草稿有没有落点（`定稿 → 草稿`）。
这个脚本查**相反的方向**：草稿有的，当前定稿里有没有出处（`草稿 → 定稿`）。
两个方向合起来才是"**草稿是当前定稿的完全派生物**"这句话的可执行判据。

为什么必须要有它（2026-10-16 实例）：
    §5.1 一句版式描述在 11:33 从定稿里删掉了，而宣讲草稿是 11:10 从**还带它的定稿**
    渲染出来的 —— 其后两次重渲都只补"定稿 → 草稿"的锚点，没人回头查"草稿里有没有
    定稿已经删掉的东西"，这句一路带到第三次重渲才被用户肉眼发现。
    `cover_check.py` 当时报的是 **355/355 全命中**：它不回答这个方向的问题。

**核对的单位是"块"，不是"行"**：`flow` / `sequence` / `tree` 这些组件是把定稿里的
文字图**重画**过的（箭头、括号、节点名都会变），逐行比会得到一堆假阳性。所以：

  * 围栏代码块 —— 整块算一块（`flow` 的一串节点连起来比，公共子串才够长）；
  * 表格 —— 每行算一块（整行比，不只比首列）；
  * 其余 —— 连续非空行算一段；标题单独一块。

判据：块与定稿全文（同一套归一化之后）的**最长公共子串**。
  * 块长度 ≤ `--min-run`：要求**整块被定稿包含**；
  * 块更长：要求最长公共子串 ≥ `--min-run`（默认 12，校准依据见下）。
取 12 而不是更小，是因为真实 orphan 与定稿的公共子串可以长到 8 个字（实例那句靠
"今日剩余挑战次数"这 8 个字撑起来）；取更小就漏，取更大会把重画图的节点名误判。

**两档结论**（这是判据的适用范围，别混）：
  * **内容块**（散句 / 代码块 / 表格行）无出处 ⇒ **不通过**（退出码 1）。
    这正是"定稿删了内容、草稿还留着"的载体，也是本脚本存在的理由。
  * **结构块**（标题）无出处 ⇒ **只提示、不算失败**：面板怎么切、小节叫什么属编排层，
    `references/draft-format.md` 本来就允许按需切分面板。

**会跳过的**：frontmatter，以及第一个标题之前的导语 —— 那是骨架规定的页面元信息，
`orphan_check` 唯一允许"没有定稿出处"的地方。

用法：
    python orphan_check.py --gdd 定稿.md --draft 草稿.md
    python orphan_check.py --gdd 定稿.md --draft 草稿.md --min-run 14 --limit 80
    # sr-gdd-ue 的 content.json（按控件块重写、不能逐句比）：改成核硬事实
    python orphan_check.py --gdd 定稿.md --content content.json --section 5

退出码：0 = 无"无出处"项（可能有"疑改写"待人工确认）；1 = 有"无出处"项 / 输入不合法。

发现"无出处"只有两条路（见 SKILL.md 第 4 步）：
    ① 定稿确实删了它 ⇒ 从草稿删掉；
    ② 它不该被删 ⇒ 走 `/sr-gdd-fix` 把它补回定稿，再重渲 —— **不许让草稿自己留着**。

── `--content` 模式（给 sr-gdd-ue 用）────────────────────────────────────
`sr-gdd-ue` 的 `content.json` 把定稿 §5 的 UE 表**按控件归并重写**过（规范明写"UE 编号不进正文"、
"正文按展示/点击/反馈/异常组织"）⇒ 逐句比公共子串会满屏误报。所以这个模式改核**不该被改写的硬事实**：

  * 界面 ID（`UI-M1`）、反引号标识、引号内的 UI 文案、数字 + 单位（`3 次` / `300 秒` / `20%`）。

这些 token 是照抄的，删掉哪条规则、哪个界面，它们就会落在定稿之外 —— 这正是"定稿删了、稿子还留着"
的信号。只有 token 能判；**规则正文本身查不了**（它被重写过），工具会把这类字符串计入
"无法机械核对"，交给第 2 步人工核对——这一点如实写在这里，别指望它兜住。
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

# 与正向核对共用同一套归一化口径（同一个 tools/ 目录，随 skill 一起分发）
sys.path.insert(0, str(Path(__file__).resolve().parent))
from cover_check import LEAD_NUM_RE, norm as norm_base  # noqa: E402

FENCE_RE = re.compile(r"^\s*```")
HEAD_RE = re.compile(r"^\s*#{2,6}\s")
ROW_RE = re.compile(r"^\s*\|(.+)\|\s*$")
SEP_RE = re.compile(r"^[\s|:\-]+$")
BADGE_RE = re.compile(r"^(no|ok|warn)\s+")
# 组件语法与箭头：重画图与原文字图之间只有这些字面上的差别
ARROW_RE = re.compile(r"<?-{1,2}>|=+>|<->|→|←|↑|↓|⇒")
MARK_RE = re.compile(r"^\s*(?:[*\-+>]|\d+[.)])\s+")
# 归一化后仍会两边不一致的符号（cover_check 的噪声集里没有它们）
EXTRA_RE = re.compile(r"[「」『』《》〈〉→←↑↓⇒§…·]")

# ── `--content` 模式：核"不该被改写的硬事实"
TOKEN_RES = (
    re.compile(r"UI-[A-Za-z]\d+"),                       # 界面 ID
    re.compile(r"`([^`\n]+)`"),                           # 反引号标识
    re.compile(r"【([^】\n]{2,24})】"),                     # UI 文案（方头括号，本项目主力写法）
    re.compile(r"[「『]([^」』\n]{2,24})[」』]"),           # 引号文案（中文角括号）
    re.compile(r"[\u201c\"]([^\u201d\"\n]{2,24})[\u201d\"]"),  # 引号文案（弯/直引号）
    re.compile(r"\d+(?:\.\d+)?\s*(?:%|％|秒|次|天|级|点|倍)"),   # 数值 + 单位
)
# content.json 里属于页面编排、不该拿定稿核的键
CHROME_KEYS = {"kicker", "title", "sub", "footer", "image", "image_note", "id", "num"}
FILE_RE = re.compile(r"^[\w\-./\\]+\.(png|jpe?g|gif|webp|avif|svg)$", re.I)


def norm_block(text: str, kind: str = "") -> str:
    """块级归一化：先抹掉组件语法，再走 cover_check 那套噪声口径。

    标题要**先去面板号**（`## §4.1 R1 周期与开启` ⇒ `R1 周期与开启`）：
    面板号是宣讲稿的编排（定稿的 `### R1 …` 没有它），不去掉每个标题都会误判成无出处。
    """
    if kind == "标题":
        text = LEAD_NUM_RE.sub("", text.strip(), count=1)
    text = ARROW_RE.sub(" ", text)
    text = "\n".join(MARK_RE.sub("", ln) for ln in text.splitlines())
    return EXTRA_RE.sub("", norm_base(text))


def blocks(draft_text: str):
    """把草稿切成待核对的块 → (行号, 类型, 原文)。跳过 frontmatter 与首个标题前的导语。"""
    lines = draft_text.splitlines()
    out = []
    i = 0
    n = len(lines)

    # frontmatter
    if n and lines[0].strip() == "---":
        i = 1
        while i < n and lines[i].strip() != "---":
            i += 1
        i += 1
    # 首个标题之前的导语（骨架规定的元信息）
    while i < n and not HEAD_RE.match(lines[i]):
        i += 1

    while i < n:
        ln = lines[i]
        if FENCE_RE.match(ln):
            start = i
            i += 1
            body = []
            while i < n and not FENCE_RE.match(lines[i]):
                body.append(lines[i])
                i += 1
            i += 1
            out.append((start + 1, "代码块", "\n".join(body)))
            continue
        if not ln.strip():
            i += 1
            continue
        if HEAD_RE.match(ln):
            out.append((i + 1, "标题", ln.strip()))
            i += 1
            continue
        if ROW_RE.match(ln):
            # 表头行（下一行是分隔行）跳过；其余整行算一块
            if i + 1 < n and SEP_RE.match(lines[i + 1]) and "|" in lines[i + 1]:
                i += 1
                continue
            if SEP_RE.match(ln):
                i += 1
                continue
            cells = [c.strip() for c in ln.strip().strip("|").split("|")]
            if cells:
                cells[0] = BADGE_RE.sub("", cells[0])
            out.append((i + 1, "表格行", " ".join(cells)))
            i += 1
            continue
        para = [ln]
        i += 1
        while i < n and lines[i].strip() and not HEAD_RE.match(lines[i]) \
                and not FENCE_RE.match(lines[i]) and not ROW_RE.match(lines[i]):
            para.append(lines[i])
            i += 1
        out.append((i - len(para) + 1, "散句", "\n".join(para)))
    return out


def ref_text(gdd_text: str, section) -> str:
    """参考文本：整份定稿，或只取某个顶级章节（`--section 5` = `## 5. …` 到下一个 `## `）。"""
    if not section:
        return gdd_text
    head = re.compile(r"^##\s*%s\s*[.、]?" % re.escape(str(section)))
    out, on = [], False
    for ln in gdd_text.splitlines():
        if re.match(r"^##\s", ln):
            if on:
                break
            on = bool(head.match(ln))
        if on:
            out.append(ln)
    return "\n".join(out)


def json_strings(obj, path="", out=None):
    """把 JSON 里所有字符串摊平 → [(json 路径, 字段名, 值)]。"""
    if out is None:
        out = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            json_strings(v, "%s.%s" % (path, k), out)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            json_strings(v, "%s[%d]" % (path, i), out)
    elif isinstance(obj, str):
        key = re.split(r"[.\[]", path)[-1] if path else ""
        out.append((path, key, obj))
    return out


def hard_tokens(s: str):
    """抽出"不该被改写"的硬事实：界面 ID / 反引号标识 / 引号文案 / 数值＋单位。"""
    toks = []
    for rx in TOKEN_RES:
        for m in rx.finditer(s):
            toks.append((m.group(1) if m.groups() else m.group(0)).strip())
    return [t for t in toks if t]


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    ap = argparse.ArgumentParser(description="sr-gdd-html 反向核对（草稿 → 定稿）")
    ap.add_argument("--gdd", required=True, help="源定稿 md 路径")
    ap.add_argument("--draft", default=None, help="草稿 md 路径（与 --content 二选一）")
    ap.add_argument("--content", default=None, help="content.json 路径（sr-gdd-ue 用；核硬事实）")
    ap.add_argument("--section", default=None,
                    help="只拿定稿的某个顶级章节当参考（如 5 = 只认 §5，兼查「只出 §5」边界）")
    ap.add_argument("--min-run", type=int, default=12, help="最长公共子串下限（默认 12）")
    ap.add_argument("--ratio", type=float, default=0.5,
                    help="块长度 × 该比例 = 「疑改写」下限（默认 0.5；不影响退出码）")
    ap.add_argument("--limit", type=int, default=60, help="最多列多少条（默认 60）")
    args = ap.parse_args()

    gpath = Path(args.gdd)
    if not gpath.is_file():
        print(f"[FAIL] 定稿不存在: {gpath}")
        return 1
    if bool(args.draft) == bool(args.content):
        print("[FAIL] --draft 与 --content 必须且只能给一个")
        return 1
    gdd_raw = gpath.read_text(encoding="utf-8", errors="replace")

    if args.content:
        cpath = Path(args.content)
        if not cpath.is_file():
            print(f"[FAIL] content.json 不存在: {cpath}")
            return 1
        try:
            data = json.loads(cpath.read_text(encoding="utf-8", errors="replace"))
        except Exception as exc:                       # noqa: BLE001
            print(f"[FAIL] content.json 解析失败: {exc}")
            return 1

        gdd_norm = norm_block(ref_text(gdd_raw, args.section))
        scope = f"§{args.section}" if args.section else "整份定稿"
        missing, unchecked, checked = [], 0, 0
        for path, key, val in json_strings(data):
            if key in CHROME_KEYS or FILE_RE.match(val.strip()):
                continue
            if len(norm_block(val)) < 3:
                continue
            checked += 1
            toks = hard_tokens(val)
            if not toks:
                unchecked += 1
                continue
            bad = [t for t in toks if norm_block(t) not in gdd_norm]
            if bad:
                missing.append((path, val, bad))

        print(f"定稿：{gpath}（参考范围：{scope}）")
        print(f"content.json：{cpath}")
        print(f"核对 {checked} 条字符串 · 带硬事实 {checked - unchecked} · 无法机械核对 {unchecked}"
              f"（规则正文按控件块重写，靠第 2 步人工核对）")
        print(f"无出处（内容）{len(missing)}")

        if missing:
            print(f"\n[无出处·内容 {len(missing)}] —— 硬事实在{scope}里找不到：")
            for path, val, bad in missing[: args.limit]:
                print(f"  - {path}")
                print(f"      查不到：{'、'.join(bad)}")
                print(f"      原文：{' '.join(val.split())[:130]}")
            if len(missing) > args.limit:
                print(f"  …（还有 {len(missing) - args.limit} 条）")
            print(f"\n结论：不通过 —— 每条都要处置：① 定稿确实删了它 ⇒ 从 content.json 删掉；"
                  f"② 它不该被删 ⇒ 走 /sr-gdd-fix 补回定稿再重抽。")
            return 1

        print("\n结论：通过 —— content.json 里的硬事实都能在当前定稿里找到出处。")
        return 0

    draft = Path(args.draft).read_text(encoding="utf-8", errors="replace")
    gdd_norm = norm_block(ref_text(gdd_raw, args.section))

    missing, struct, weak = [], [], []
    total = 0
    for lineno, kind, raw in blocks(draft):
        key = norm_block(raw, kind)
        if len(key) < 4:
            continue
        total += 1
        bucket = struct if kind == "标题" else missing
        if len(key) <= args.min_run:
            if key in gdd_norm:
                continue
            bucket.append((lineno, kind, raw, len(key), key))
            continue
        m = difflib.SequenceMatcher(None, key, gdd_norm, autojunk=False) \
            .find_longest_match(0, len(key), 0, len(gdd_norm))
        if m.size < args.min_run:
            bucket.append((lineno, kind, raw, m.size, key[m.a:m.a + m.size]))
        elif m.size < len(key) * args.ratio:
            weak.append((lineno, kind, raw, m.size, len(key)))

    print(f"定稿：{gpath}")
    print(f"草稿：{args.draft}")
    print(f"核对 {total} 块（散句 / 代码块 / 表格行 / 标题）· 最长公共子串下限 {args.min_run} 字")
    print(f"无出处（内容）{len(missing)} · 无出处（结构，只提示）{len(struct)} · 疑改写 {len(weak)}")

    if struct:
        print(f"\n[无出处·结构 {len(struct)}] —— 标题层，属编排；看一眼是不是漏了定稿的小节名：")
        for lineno, kind, raw, size, frag in struct[: args.limit]:
            print(f"  - L{lineno} [{kind}] 公共子串 {size} 字「{frag}」  {' '.join(raw.split())[:90]}")

    if missing:
        print(f"\n[无出处·内容 {len(missing)}] —— 草稿有、当前定稿里找不到出处：")
        for lineno, kind, raw, size, frag in missing[: args.limit]:
            head = " ".join(raw.split())
            print(f"  - L{lineno} [{kind}] 公共子串 {size} 字"
                  + (f"「{frag}」" if frag else ""))
            print(f"      {head[:150]}")
        if len(missing) > args.limit:
            print(f"  …（还有 {len(missing) - args.limit} 条）")

    if weak:
        print(f"\n[疑改写 {len(weak)}] —— 对得上、但重合度偏低，人工确认是不是换了个说法：")
        for lineno, kind, raw, size, length in weak[: args.limit]:
            head = " ".join(raw.split())
            print(f"  - L{lineno} [{kind}] 公共子串 {size}/{length} 字")
            print(f"      {head[:150]}")
        if len(weak) > args.limit:
            print(f"  …（还有 {len(weak) - args.limit} 条）")

    if missing:
        print("\n结论：不通过 —— 每条「无出处·内容」都要处置：① 定稿确实删了它 ⇒ 从草稿删掉；"
              "② 它不该被删 ⇒ 走 /sr-gdd-fix 补回定稿再重渲。")
        return 1

    if weak or struct:
        print("\n结论：通过（无「无出处·内容」）—— 上面每条「疑改写」与「结构」人工确认一遍再交付。")
        return 0

    print("\n结论：通过 —— 草稿每一块都能在当前定稿里找到出处。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
