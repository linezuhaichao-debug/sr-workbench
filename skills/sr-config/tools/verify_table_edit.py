# -*- coding: utf-8 -*-
"""verify_table_edit.py — 「只改我要的单元格 + 保真」验收工具（sr-config skill 附带）。

只读比对，**不写任何工作簿**（openpyxl 只用于读；写表一律走 Excel COM，见 excel_com_edit.py）。

用法:
    python verify_table_edit.py --before <改前.xlsx> --after <改后.xlsx> --plan plan.json
                               [--json report.json] [--recalc] [--max-examples 40]

验收判据（全部 pass 才算 pass；任一条 fail ⇒ 退出码 1）:
    V1 结构一致     工作表集合/顺序/可见性 · 合并区 · 行列尺寸(宽高/隐藏) · 冻结窗格 · 自动筛选
                    · 工作表保护 · 定义名 · 表对象 · 数据验证 · 条件格式 · 超链接 · 页面设置
    V2 内容只改目标  全表「公式串 + 值」差异集合 **⊆ 写入计划的声明区域**，且声明区域内逐格
                    等于计划预期；声明区域外零差异
    V3 缓存值保留    未声明的公式格：缓存值（Excel data_only 值）改后仍存在、逐格相同。
                    --recalc（显式声明重算）时改为：如实列出缓存值发生变化的公式格（不判 fail，但必须列全）
    V3b 写入公式的格  计划里 kind=formula 的格必须带 expect_cached（这一格算出来应当等于什么）；
                    缓存值不等于 expect_cached ⇒ fail（游戏/导出读的就是它）
    V4 批注一致      全表批注（格子 → 文本，剥掉 Excel 的"<作者>:"前缀）逐格相同，除计划显式声明的批注变更外
    V5 格式一致      字体/填充/边框/对齐/保护/数字格式逐格相同，除计划显式声明的数字格式变更外
    V6 VBA 保真      .xlsm 的 xl/vbaProject.bin **还在**且模块/流名集合一致（Excel 保存会重新序列化
                    它，所以字节级哈希不作为判据；大小/哈希差异如实报 WARN）
    V7 未覆盖部件    包内本工具不做语义比对的部件（图表/图片/切片器/自定义 XML 等）**如实列出**（WARN，不判 fail）

返回码: 0=pass; 1=fail; 2=输入/计划本身有问题。
"""
import argparse
import hashlib
import json
import re
import struct
import sys
import time
import zipfile
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter, column_index_from_string

REF_RE = re.compile(r"^\$?([A-Za-z]{1,3})\$?(\d{1,7})(?::\$?([A-Za-z]{1,3})\$?(\d{1,7}))?$")

CONTENT_KINDS = {"value", "formula"}
KNOWN_KINDS = CONTENT_KINDS | {"number_format", "comment", "add_sheet"}

# 包内本工具不做语义比对、只如实列出的部件（Excel 重写包时会重排这些部件，硬比会产生假红）
INFO_PART_PREFIXES = ("xl/charts/", "xl/drawings/", "xl/media/", "customXml/", "xl/slicers",
                      "xl/timelines", "xl/activeX", "xl/ctrlProps", "xl/embeddings")


# ── 基础 ────────────────────────────────────────────────────────────────────────

def parse_ref(ref):
    """A1 / A1:B2 / $A$1:$B$2 → (r1, c1, r2, c2, nrows, ncols)。"""
    m = REF_RE.match(str(ref).strip())
    if not m:
        raise ValueError("引用写法不对（要 A1 或 A1:B2 形式）: %r" % (ref,))
    c1 = column_index_from_string(m.group(1).upper())
    r1 = int(m.group(2))
    if m.group(3):
        c2 = column_index_from_string(m.group(3).upper())
        r2 = int(m.group(4))
    else:
        c2, r2 = c1, r1
    if r2 < r1:
        r1, r2 = r2, r1
    if c2 < c1:
        c1, c2 = c2, c1
    return r1, c1, r2, c2, r2 - r1 + 1, c2 - c1 + 1


def key_of(sheet, row, col):
    return "%s!%s%d" % (sheet, get_column_letter(col), row)


def _norm_comment(author, text):
    """剥掉 Excel 批注的"作者前缀"。

    Excel 把批注存成 `<作者>:\n<正文>`；作者另有一份（XML 的 author）。实测两种形态都要认：
      · author == 正文第一行的名字（我们自己 AddComment 写的新批注：作者 ZuHaiChao）；
      · XML author 是账号名、正文第一行是**创建时的显示名**（老表实测：author=CM217，正文以"王巍然:"开头）。
    计划里只写**正文**，前缀由这里剥掉；剥不掉也不算错 —— 验收会把实际文本逐字报出来。
    """
    t = (text or "").strip()
    a = (author or "").strip()
    if a and t.startswith(a + ":"):
        return t[len(a) + 1:].strip()
    m = re.match(r"^([^:\n]{1,24}):[ \t]*\n", t)
    if m:
        return t[m.end():].strip()
    return t


def _cell_formula(v):
    """单元格的公式串（普通公式 / 数组公式、数据表公式都算），不是公式返回 None。

    ★ 实测（2026-10-10，A001-城建表）：真实配置表里有**数组公式** —— openpyxl 把它们读成
    ArrayFormula 对象，`str()` 出来带内存地址（"<... object at 0x...>"），直接比会次次假红。
    数组公式取 `.text`（公式本体）；缓存值仍走 data_only 读法。
    """
    if isinstance(v, str) and v.startswith("="):
        return v
    text = getattr(v, "text", None)
    if isinstance(text, str) and text.startswith("="):
        return text
    return None


def _jsonify(v):
    if isinstance(v, (str, int, float, bool)) or v is None:
        return v
    return str(v)


def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ── VBA（.xlsm）部件指纹 ────────────────────────────────────────────────────────
# ★ 实测（2026-10-10，A020-伤兵转换率配置表.xlsm）：Excel 保存时会把 vbaProject.bin **重新序列化** ——
#   同大小(22016 B)、同流名集合、字节序不同。所以"逐字节一致"是**假红**；判据取
#   「部件还在 + 模块/流名集合一致」，字节差异如实报出来（WARN），让人自己判断。

def _ole_stream_names(blob):
    """极简 CFB(OLE) 目录解析 —— 只取流/存储的名字集合（VBA 模块名、dir、PROJECT…）。
    不引三方依赖：头部 + FAT + 目录链足够，且结果确定。"""
    if len(blob) < 512 or blob[:8] != b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
        return None
    sector_size = 1 << struct.unpack_from("<H", blob, 30)[0]
    fat_count = struct.unpack_from("<I", blob, 44)[0]
    dir_start = struct.unpack_from("<I", blob, 48)[0]
    difat = [s for s in struct.unpack_from("<109I", blob, 76) if s < 0xFFFFFFFA][:fat_count]
    fat = []
    for s in difat:
        off = 512 + s * sector_size
        if off + sector_size > len(blob):
            break
        fat += list(struct.unpack_from("<%dI" % (sector_size // 4), blob, off))
    names, cur, guard = [], dir_start, 0
    while cur < 0xFFFFFFFA and guard < 4096:
        chunk = blob[512 + cur * sector_size: 512 + cur * sector_size + sector_size]
        if len(chunk) < 128:
            break
        for i in range(0, len(chunk), 128):
            entry = chunk[i:i + 128]
            if len(entry) < 128:
                break
            nlen = struct.unpack_from("<H", entry, 64)[0]
            if nlen >= 2 and entry[66] in (1, 2, 5):
                names.append(entry[:nlen - 2].decode("utf-16-le", "replace"))
        cur = fat[cur] if cur < len(fat) else 0xFFFFFFFE
        guard += 1
    return sorted(names)


def _vba_fingerprint(path):
    try:
        with zipfile.ZipFile(path) as z:
            parts = [n for n in z.namelist() if n.lower().endswith("vbaproject.bin")]
            if not parts:
                return {"exists": False}
            blob = z.read(parts[0])
    except Exception as e:  # noqa: BLE001
        return {"exists": None, "error": str(e)}
    return {"exists": True, "part": parts[0], "bytes": len(blob),
            "sha256": hashlib.sha256(blob).hexdigest(), "streams": _ole_stream_names(blob)}


# ── 写入计划 ────────────────────────────────────────────────────────────────────

def _flatten_matrix(payload, nrows, ncols, where):
    """标量 → 铺满；一维数组 → 单行；二维数组 → 校验形状。"""
    if isinstance(payload, (list, tuple)):
        rows = list(payload)
        if rows and not isinstance(rows[0], (list, tuple)):
            rows = [rows]
        out = []
        for r in rows:
            out.append([(_jsonify(v)) for v in (r if isinstance(r, (list, tuple)) else [r])])
        if len(out) != nrows or any(len(r) != ncols for r in out):
            raise ValueError("%s：矩阵形状 %dx%d ≠ 引用区域 %dx%d"
                             % (where, len(out), len(out[0]) if out else 0, nrows, ncols))
        return out
    return [[_jsonify(payload)] * ncols for _ in range(nrows)]


def load_plan(plan_path):
    """读写入计划 + 派生验收口径。返回 (plan, expect) 或抛 ValueError。

    expect = {
      "content": {key: ("value"|"formula", 预期值)},
      "number_format": {key: 格式串},
      "comment": {key: 文本 or None(删除)},
      "touched": {key},            # 声明区域（允许出现差异的格子全集）
      "sheets_touched": {表名},
    }
    """
    plan = json.loads(Path(plan_path).read_text(encoding="utf-8"))
    if not isinstance(plan, dict):
        raise ValueError("计划文件顶层必须是对象")
    ops = plan.get("ops")
    if not isinstance(ops, list) or not ops:
        raise ValueError("计划里 ops 为空 —— 没有要改的东西就不该调用写入引擎")

    expect = {"content": {}, "number_format": {}, "comment": {}, "cached": {}, "touched": set(),
              "sheets_touched": set(), "added_sheets": set()}
    for i, op in enumerate(ops, 1):
        where = "ops[%d]" % i
        if not isinstance(op, dict):
            raise ValueError("%s 必须是对象" % where)
        kind = op.get("kind")
        if kind not in KNOWN_KINDS:
            raise ValueError("%s 的 kind 不受支持: %r（可用 %s）"
                             % (where, kind, "/".join(sorted(KNOWN_KINDS))))
        sheet = op.get("sheet")
        if not isinstance(sheet, str) or not sheet.strip():
            raise ValueError("%s 缺 sheet" % where)
        sheet = sheet.strip()
        if kind == "add_sheet":
            expect["sheets_touched"].add(sheet)
            expect["added_sheets"].add(sheet)
            continue
        # `as_text: true` = 先按文本格式写，避免 "0012" 被 Excel 吃成数字。
        # 这条换算**只在 load_plan 里做一次**，写入引擎与验收引擎共用同一份口径。
        if op.get("as_text"):
            if kind != "value":
                raise ValueError("%s：as_text 只对 kind=value 有意义" % where)
            if op.get("number_format") not in (None, "@"):
                raise ValueError("%s：as_text 与 number_format=%r 冲突（as_text 已把格式定为 @）"
                                 % (where, op["number_format"]))
            op["number_format"] = "@"
        r1, c1, r2, c2, nrows, ncols = parse_ref(op.get("ref"))
        expect["sheets_touched"].add(sheet)
        cells = [(r, c) for r in range(r1, r2 + 1) for c in range(c1, c2 + 1)]
        keys = [key_of(sheet, r, c) for r, c in cells]
        expect["touched"].update(keys)

        if kind in CONTENT_KINDS:
            payload = op.get("value") if kind == "value" else op.get("formula")
            if payload is None:
                raise ValueError("%s：kind=%s 必须带 %s" % (where, kind, kind))
            matrix = _flatten_matrix(payload, nrows, ncols, where)
            for (r, c), v in zip(cells, [v for row in matrix for v in row]):
                if kind == "value" and isinstance(v, str) and v.startswith("="):
                    raise ValueError("%s：value 以 = 开头 —— 请改用 kind=formula（否则会写成公式）" % where)
                k = key_of(sheet, r, c)
                old = expect["content"].get(k)
                if old is not None and old != (kind, v):
                    raise ValueError("%s：同一格 %s 被两条 op 写入不同预期（%r vs %r）" % (where, k, old, (kind, v)))
                expect["content"][k] = (kind, v)
            if op.get("number_format") is not None:
                for k in keys:
                    expect["number_format"][k] = op["number_format"]
            # 写公式时**必须**给出 expect_cached（写公式只重算该格，缓存值就是游戏读到的值）
            if kind == "formula":
                if op.get("expect_cached") is None:
                    raise ValueError("%s：kind=formula 必须带 expect_cached（这一格算出来应当等于什么）—— "
                                     "否则无从证明游戏读到的缓存值是对的" % where)
                cm = _flatten_matrix(op["expect_cached"], nrows, ncols, where + ".expect_cached")
                for (r, c), v in zip(cells, [v for row in cm for v in row]):
                    expect["cached"][key_of(sheet, r, c)] = v
        elif kind == "number_format":
            fmt = op.get("value")
            if not isinstance(fmt, str) or not fmt:
                raise ValueError("%s：number_format 需要非空 value" % where)
            for k in keys:
                expect["number_format"][k] = fmt
        elif kind == "comment":
            text = op.get("value")
            if text is not None and not isinstance(text, str):
                raise ValueError("%s：comment 的 value 必须是字符串或 null（null=删除批注）" % where)
            for k in keys:
                expect["comment"][k] = text
    return plan, expect


# ── 快照（只读） ────────────────────────────────────────────────────────────────

def _color_key(c, loose=True):
    """颜色的可比较键。

    ★ 实测（2026-10-10，A001-城建表·23 表）：Excel 保存时会把主题色**色阶（tint）重算一遍** ——
    有的只差浮点尾数（0.599993896298105 → …048），有的差到 3e-5（0.799737540 → 0.799707022）。
    渲染上不可见（<1/255），不是格式变了 ⇒ 比对时取到 3 位小数（loose）；
    严格值（loose=False）另存一份，用于把这类"尾数差异"如实报成 WARN（V5b）而不是判 fail。
    """
    if c is None:
        return None
    tint = getattr(c, "tint", None)
    if isinstance(tint, float) and loose:
        tint = round(tint, 3)
    return (getattr(c, "type", None), getattr(c, "rgb", None), getattr(c, "indexed", None),
            getattr(c, "theme", None), tint, getattr(c, "auto", None))


def _font_key(f, loose=True):
    """字体的可比较键。loose=False 时额外带 family/charset —— 这两个是 Excel 会归一化的旧字段
    （实测：family None→3.0、charset 134→None），所以只在"严格值"里留着用于报 WARN。"""
    if f is None:
        return None
    base = (f.name, f.sz, f.b, f.i, f.u, f.strike, f.vertAlign, f.scheme, _color_key(f.color, loose))
    return base if loose else base + (f.family, f.charset)


def _fill_key(f, loose=True):
    if f is None:
        return None
    grad = getattr(f, "gradient", None)
    if grad is not None:
        stops = getattr(grad, "stop", []) or []
        return ("gradient", tuple(sorted((s.position, _color_key(s.color, loose)) for s in stops)))
    return (f.patternType, _color_key(f.fgColor, loose), _color_key(f.bgColor, loose))


def _side_key(s, loose=True):
    return None if s is None else (s.style, _color_key(s.color, loose))


def _border_key(b, loose=True):
    if b is None:
        return None
    return (_side_key(b.left, loose), _side_key(b.right, loose), _side_key(b.top, loose),
            _side_key(b.bottom, loose), _side_key(b.diagonal, loose), b.diagonalUp, b.diagonalDown, b.outline)


def _align_key(a):
    if a is None:
        return None
    return (a.horizontal, a.vertical, a.textRotation, a.wrapText, a.shrinkToFit, a.indent,
            a.relativeIndent, a.justifyLastLine, a.readingOrder)


def _prot_key(p):
    return None if p is None else (p.locked, p.hidden)


def _cf_rule_key(r):
    """条件格式规则的可比较键。

    ★ 实测（2026-10-10，A001-城建表）：Excel 保存时会把规则的 **dxfId 重新编号**（0,1 → 24,23），
    于是"比 dxfId"是假红。这里改比**解析出来的差异样式本身**（字体/填充/边框/数字格式），与索引无关。
    """
    dxf = getattr(r, "dxf", None)
    dxfkey = None
    if dxf is not None:
        numfmt = getattr(dxf, "numFmt", None)
        dxfkey = (_font_key(getattr(dxf, "font", None)), _fill_key(getattr(dxf, "fill", None)),
                  _border_key(getattr(dxf, "border", None)),
                  str(getattr(numfmt, "number_format", numfmt)) if numfmt is not None else None)
    return (r.type, r.operator, tuple(r.formula or ()), r.priority, r.text, r.stopIfTrue,
            len(r.formula or []) > 1, dxfkey)


def _obj_tuple(o, attrs):
    if o is None:
        return None
    return tuple(str(getattr(o, a, None)) for a in attrs)


_DIM_DEFAULT = (None, None, False, False, False, False, None, False)


def _dim_value(d):
    return (getattr(d, "width", None), getattr(d, "height", None), bool(getattr(d, "hidden", False)),
            bool(getattr(d, "customWidth", False)), bool(getattr(d, "customHeight", False)),
            bool(getattr(d, "bestFit", False)), getattr(d, "outlineLevel", None),
            bool(getattr(d, "collapsed", False)))


def _dims_map(dims, cap=20000):
    """把 DimensionHolder **展开成「每一个列/行 → 有效值」**。

    ★ 实测（2026-10-10，A001-城建表）：原表把列宽写成一条区间（min=5, max=16384, width=9），
    Excel 保存时会**按改动边界把它拆成两条**（5..5 与 6..16384）。条目对不上 ≠ 格式变了 ⇒
    按"每列的有效值"比较，多出来/少掉的空条目按默认值处理。
    """
    out = {}
    for d in (dims or {}).values():
        lo, hi = getattr(d, "min", None), getattr(d, "max", None)
        if lo is None or hi is None:
            continue
        hi = min(hi, lo + cap)
        val = _dim_value(d)
        for i in range(lo, hi + 1):
            out[i] = val
    return out


def _dims_diff(before_dims, after_dims, label):
    bad = []
    for i in sorted(set(before_dims) | set(after_dims)):
        b = before_dims.get(i, _DIM_DEFAULT)
        a = after_dims.get(i, _DIM_DEFAULT)
        if b != a:
            bad.append("%s %d 改前 %r → 改后 %r" % (label, i, b, a))
    return bad


# Excel 保存时会把"没写 pageSetup 元素"的表**显式写成默认值**（实测 2026-10-10：A030 的运行时表
# 由 5 个 None 变成 orientation=portrait / paperSize=9）。有效打印设置没变 ⇒ 按有效值比较，
# 这类序列化归一化如实报 WARN（V1b），不判 fail。
_PAGE_SETUP_ATTRS = ("orientation", "paperSize", "scale", "fitToWidth", "fitToHeight")
_XL_DEFAULT_PAGE_SETUP = ("portrait", "9", "100", "1", "1")


def _page_setup(ws):
    raw = _obj_tuple(ws.page_setup, _PAGE_SETUP_ATTRS)
    if raw is None:
        return None, None
    eff = tuple(_XL_DEFAULT_PAGE_SETUP[i] if v in (None, "None") else v for i, v in enumerate(raw))
    return eff, raw


def snapshot(path, want_styles=True):
    """把一个工作簿读成可比较的快照（只读，不修改文件）。"""
    t0 = time.time()
    wb = load_workbook(path, data_only=False, keep_links=True)
    wbv = load_workbook(path, data_only=True, keep_links=True)

    snap = {
        "order": list(wb.sheetnames),
        "defined_names": {k: str(getattr(v, "attr_text", v)) for k, v in (wb.defined_names or {}).items()},
        "sheets": {},
        "values": {}, "formulas": {}, "cached": {}, "comments": {}, "comments_raw": {},
        "styles": {}, "styles_strict": {},
        "cached_missing": [], "formula_cells": 0,
    }
    style_memo = {}

    for name in wb.sheetnames:
        ws = wb[name]
        wsv = wbv[name] if name in wbv.sheetnames else None
        max_row = max(ws.max_row or 1, 1)
        max_col = max(ws.max_column or 1, 1)

        info = {
            "state": ws.sheet_state,
            "freeze_panes": str(ws.freeze_panes) if ws.freeze_panes else None,
            "auto_filter": str(ws.auto_filter.ref) if getattr(ws.auto_filter, "ref", None) else None,
            "protection": _obj_tuple(ws.protection, ("sheet", "objects", "scenarios", "formatCells",
                                                     "insertRows", "deleteRows", "password", "algorithmName")),
            "merged": sorted(str(r) for r in (ws.merged_cells.ranges if ws.merged_cells else [])),
            "cols": _dims_map(ws.column_dimensions),
            "rows": _dims_map(ws.row_dimensions),
            "sheet_format": _obj_tuple(ws.sheet_format, ("defaultRowHeight", "defaultColWidth",
                                                         "baseColWidth", "customHeight")),
            "sheet_props": _obj_tuple(ws.sheet_properties, ("codeName", "filterMode", "tabColor")),
            "page_setup": _page_setup(ws)[0],
            "page_setup_raw": _page_setup(ws)[1],
            "print_options": _obj_tuple(ws.print_options, ("horizontalCentered", "verticalCentered",
                                                           "gridLines", "headings")),
            "views": [_obj_tuple(v, ("showGridLines", "zoomScale", "showRowColHeaders")) for v in (ws.views or [])],
            "data_validations": sorted(
                str(_obj_tuple(dv, ("type", "operator", "formula1", "formula2", "sqref", "allow_blank",
                                    "showErrorMessage", "errorTitle", "error", "promptTitle", "prompt")))
                for dv in (getattr(getattr(ws, "data_validations", None), "dataValidation", []) or [])),
            "conditional_formatting": sorted(
                str((str(cf.sqref), tuple(_cf_rule_key(r) for r in cf.rules)))
                for cf in (ws.conditional_formatting or [])),
            "tables": {k: str((v.name, v.ref, v.displayName)) for k, v in (getattr(ws, "tables", {}) or {}).items()},
            "hyperlinks": sorted(str(_obj_tuple(h, ("ref", "target", "location", "tooltip", "display")))
                                 for h in (getattr(ws, "_hyperlinks", []) or [])),
            "max_row": max_row, "max_col": max_col,
        }
        snap["sheets"][name] = info

        for row in ws.iter_rows(min_row=1, max_row=max_row, min_col=1, max_col=max_col):
            for cell in row:
                k = "%s!%s" % (name, cell.coordinate)
                v = cell.value
                fv = _cell_formula(v)
                if fv is not None:
                    snap["formulas"][k] = fv
                    snap["formula_cells"] += 1
                    if wsv is not None:
                        cv = wsv[cell.coordinate].value
                        if cv is None:
                            snap["cached_missing"].append(k)
                        else:
                            snap["cached"][k] = _jsonify(cv)
                elif v is not None:
                    snap["values"][k] = _jsonify(v)
                if cell.comment is not None and (cell.comment.text or "").strip():
                    # 比对用"剥掉作者前缀"的正文；原文另存一份，验收时逐字报出来
                    k = "%s!%s" % (name, cell.coordinate)
                    snap["comments_raw"][k] = cell.comment.text.strip()
                    snap["comments"][k] = _norm_comment(cell.comment.author, cell.comment.text)
                if want_styles and cell.has_style:
                    raw = tuple(cell._style) if getattr(cell, "_style", None) is not None else ()
                    sk = style_memo.get(raw)
                    if sk is None:
                        sk = ((_font_key(cell.font), _fill_key(cell.fill), _border_key(cell.border),
                               _align_key(cell.alignment), _prot_key(cell.protection)),
                              (_font_key(cell.font, False), _fill_key(cell.fill, False),
                               _border_key(cell.border, False), _align_key(cell.alignment),
                               _prot_key(cell.protection)))
                        style_memo[raw] = sk
                    snap["styles"][k] = (cell.number_format,) + sk[0]
                    snap["styles_strict"][k] = (cell.number_format,) + sk[1]

    snap["elapsed"] = round(time.time() - t0, 2)
    return snap


# ── 比对 ────────────────────────────────────────────────────────────────────────

def _finite(v):
    """规范化可比较值：整数值的 float → int；换行统一；富文本 → 纯文本。"""
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, str):
        return v.replace("\r\n", "\n")
    if v is None or isinstance(v, (int, bool)):
        return v
    return str(v)


def _formula_equal(a, b):
    if a == b:
        return True, False
    if str(a).upper().replace(" ", "") == str(b).upper().replace(" ", ""):
        return True, True
    return False, False


def _diff_keys(a, b, limit=None):
    keys = set(a) | set(b)
    out = [k for k in sorted(keys) if _finite(a.get(k)) != _finite(b.get(k))]
    return out[:limit] if limit else out


def compare(plan, expect, before, after, recalc, max_examples=40):
    checks = []
    diffs = {}

    def check(cid, title, bad, detail_pass, evidence=None):
        checks.append({"id": cid, "title": title, "result": "pass" if not bad else "fail",
                       "detail": detail_pass if not bad else ("%d 处不合判据" % len(bad)),
                       "evidence": evidence or {}})

    # ── V1 结构
    bad = []
    added = expect.get("added_sheets") or set()
    order_after = [s for s in after["order"] if s not in added]
    if before["order"] != order_after:
        bad.append("工作表集合/顺序变了: %r → %r" % (before["order"], after["order"]))
    if before["defined_names"] != after["defined_names"]:
        bad.append("定义名变了: %d 条差异" % len(_diff_keys(before["defined_names"], after["defined_names"])))
    for name, b in before["sheets"].items():
        a = after["sheets"].get(name)
        if a is None:
            bad.append("工作表不见了: %s" % name)
            continue
        for f in ("state", "freeze_panes", "auto_filter", "protection", "merged", "sheet_format",
                  "sheet_props", "page_setup", "print_options", "views", "data_validations",
                  "conditional_formatting", "tables", "hyperlinks", "max_row", "max_col"):
            if b.get(f) != a.get(f):
                bad.append("%s 的 %s 变了" % (name, f))
        bad += ["%s 的 %s" % (name, line) for line in
                _dims_diff(b.get("cols") or {}, a.get("cols") or {}, "列宽/列隐藏")]
        bad += ["%s 的 %s" % (name, line) for line in
                _dims_diff(b.get("rows") or {}, a.get("rows") or {}, "行高/行隐藏")]
    for name in after["sheets"]:
        if name not in before["sheets"] and name not in added:
            bad.append("多出来工作表: %s" % name)
    diffs["structure"] = bad[:max_examples]
    check("V1", "结构一致（表/合并/行列尺寸/冻结/筛选/保护/定义名/验证/条件格式/超链接）",
          bad, "工作表、合并区、行列尺寸、冻结、筛选、保护、定义名、表对象、数据验证、条件格式、超链接、页面设置逐项一致",
          {"sheets": len(before["sheets"])})

    # ── V1b 打印设置的"序列化归一化"（有效值没变，只是 Excel 把默认值写成了显式值）
    raw_only = []
    for name, b in before["sheets"].items():
        a = after["sheets"].get(name)
        if a and b.get("page_setup_raw") != a.get("page_setup_raw") and b.get("page_setup") == a.get("page_setup"):
            raw_only.append("%s：打印设置的有效值没变（%r → %r，Excel 把默认值写成了显式值）"
                            % (name, b.get("page_setup_raw"), a.get("page_setup_raw")))
    checks.append({"id": "V1b", "title": "打印设置：只允许「Excel 把默认值写成显式值」这类归一化",
                   "result": "warn" if raw_only else "pass",
                   "detail": ("%d 张表的打印设置被 Excel 写成显式默认值（无实际差异）" % len(raw_only))
                             if raw_only else "打印设置的有效值逐表一致，没有归一化痕迹",
                   "evidence": {"normalized": raw_only[:max_examples]}})

    # ── V2 内容只改目标
    touched = expect["touched"]
    outside, unexpected, normalized = [], [], []
    for kind_label, key_a, key_b in (("值", "values", "values"), ("公式", "formulas", "formulas")):
        for k in _diff_keys(before[key_a], after[key_b]):
            if k not in touched:
                outside.append("%s %s: %r → %r" % (kind_label, k, before[key_a].get(k), after[key_b].get(k)))
    for k, (want_kind, want) in sorted(expect["content"].items()):
        src = after["formulas"].get(k) if want_kind == "formula" else after["values"].get(k)
        if src is None:
            unexpected.append("%s 期望 %s=%r，实际没有该内容（空）" % (k, want_kind, want))
            continue
        if want_kind == "formula":
            ok, was_norm = _formula_equal(_finite(want), _finite(src))
            if ok and was_norm:
                normalized.append("%s 公式按去空格/大写后相等（原文 %r vs %r）" % (k, src, want))
        else:
            ok = _finite(want) == _finite(src)
        if not ok:
            unexpected.append("%s 期望 %s=%r，实际 %r" % (k, want_kind, want, src))
    for k in sorted(touched):
        if k not in expect["content"]:
            # 只声明批注/数字格式的格子：内容必须**完全没变**
            for label, ka, kb in (("值", "values", "values"), ("公式", "formulas", "formulas")):
                if _finite(before[ka].get(k)) != _finite(after[kb].get(k)):
                    unexpected.append("%s 只声明了批注/数字格式，但%s被改动: %r → %r"
                                      % (k, label, before[ka].get(k), after[kb].get(k)))
    bad = outside + unexpected
    diffs["content_outside"] = outside[:max_examples]
    diffs["content_unexpected"] = unexpected[:max_examples]
    diffs["content_normalized"] = normalized[:max_examples]
    check("V2", "只改目标（差异集合 ⊆ 声明区域，且逐格等于计划预期）", bad,
          "声明 %d 格；差异集合与计划预期精确一致，声明区域外零差异" % len(touched),
          {"planned_cells": len(touched), "planned_changes": len(expect["content"])})

    # ── V3 缓存值
    changed_cached = []
    for k in sorted(set(before["formulas"]) & set(after["formulas"])):
        if k in touched:
            continue
        if _finite(before["cached"].get(k)) != _finite(after["cached"].get(k)):
            changed_cached.append("%s: %r → %r" % (k, before["cached"].get(k), after["cached"].get(k)))
    lost_cached = [k for k in after["formulas"] if k not in after["cached"] and k in before["cached"]]
    missing_before = len([k for k in before["formulas"] if k not in before["cached"]])
    missing_after = len([k for k in after["formulas"] if k not in after["cached"]])
    detail = ("公式 %d 个；缓存值写入前后都存在，未改动的公式格缓存值逐格相同"
              "（无缓存值的公式格：改前 %d、改后 %d —— 本来就有的不算丢）"
              % (len(after["formulas"]), missing_before, missing_after))
    if recalc:
        bad = []
        detail = ("显式声明重算：缓存值发生变化的公式格 %d 个（如实列出，不判 fail）" % len(changed_cached))
        diffs["cached_changed_in_formula_cells"] = changed_cached[:max_examples]
        if lost_cached:
            bad = ["公式格缓存值丢失: %s" % ", ".join(lost_cached[:max_examples])]
    else:
        bad = changed_cached + (["公式格缓存值丢失: %s" % ", ".join(lost_cached[:max_examples])] if lost_cached else [])
    diffs["cached"] = changed_cached[:max_examples]
    check("V3", "缓存值保留（未声明的公式格缓存值逐格不变、不丢）", bad, detail,
          {"formula_cells": len(after["formulas"]), "cached_formula_cells": len(after["cached"]),
           "recalc": bool(recalc)})

    # ── V3b 声明写入的公式格：缓存值必须等于 expect_cached（游戏读的就是它）
    declared_f, bad_f = [], []
    for k in sorted(expect["cached"]):
        want = expect["cached"][k]
        got = after["cached"].get(k)
        declared_f.append("%s 公式 %r→%r；缓存 %r→%r（期望 %r）"
                          % (k, before["formulas"].get(k), after["formulas"].get(k),
                             before["cached"].get(k), got, want))
        if _finite(want) != _finite(got):
            bad_f.append("%s 缓存值 %r ≠ 期望 %r（写公式时只重算该格，对不上就是公式本身不对）"
                         % (k, got, want))
    diffs["declared_formula_cached"] = declared_f[:max_examples]
    checks.append({
        "id": "V3b", "title": "声明写入的公式格：缓存值等于 expect_cached",
        "result": ("not_applicable" if not expect["cached"] else ("fail" if bad_f else "pass")),
        "detail": ("本次没有写公式" if not expect["cached"]
                   else "声明 %d 个公式格，缓存值逐格核对（含改前/改后与公式原文）" % len(expect["cached"])),
        "evidence": {"mismatch": bad_f[:max_examples], "declared": declared_f[:max_examples]},
    })

    # ── V4 批注
    bad = []
    for k in _diff_keys(before["comments"], after["comments"]):
        if k in expect["comment"]:
            want = expect["comment"][k]
            got = after["comments"].get(k)
            if _finite(want) != _finite(got):
                bad.append("%s 期望批注 %r，实际 %r（文件里逐字是 %r）"
                           % (k, want, got, after["comments_raw"].get(k)))
        else:
            bad.append("%s 批注被改动: %r → %r" % (k, before["comments"].get(k), after["comments"].get(k)))
    for k, want in expect["comment"].items():
        got = after["comments"].get(k)
        if _finite(want) != _finite(got) and k not in before["comments"]:
            bad.append("%s 期望批注 %r，实际 %r（文件里逐字是 %r）"
                       % (k, want, got, after["comments_raw"].get(k)))
    diffs["comments"] = bad[:max_examples]
    check("V4", "批注一致（除计划声明的批注变更外逐格相同）", bad,
          "批注 %d 条；除声明变更外逐格相同（删除的按删除核对）" % len(after["comments"]),
          {"comments_before": len(before["comments"]), "comments_after": len(after["comments"]),
           "declared_comment_changes": len(expect["comment"])})

    # ── V5 格式
    bad = []
    for k in _diff_keys(before["styles"], after["styles"]):
        b = before["styles"].get(k)
        a = after["styles"].get(k)
        want_fmt = expect["number_format"].get(k)
        if b is None or a is None:
            # 一侧没格式：只有「声明过的数字格式变更」才放过（另一侧默认格式无从逐项比对）
            side = a or b
            if want_fmt is not None and side and side[0] == want_fmt:
                continue
            bad.append("%s %s" % (k, "新增了格式（改前无格式）" if b is None else "丢失了格式（改后有值无格式）"))
            continue
        if b[0] != a[0]:
            if want_fmt is not None and a[0] == want_fmt:
                pass  # 声明的数字格式变更
            else:
                bad.append("%s 数字格式被改动: %r → %r" % (k, b[0], a[0]))
        if b[1:] != a[1:]:
            bad.append("%s 字体/填充/边框/对齐/保护被改动" % k)
    diffs["styles"] = bad[:max_examples]
    check("V5", "格式一致（字体/填充/边框/对齐/保护/数字格式）", bad,
          "全表逐格格式指纹一致（%d 格有格式；数字格式仅声明的 %d 格变更）"
          % (len(after["styles"]), len(expect["number_format"])),
          {"styled_cells": len(after["styles"])})

    # ── V5b 只差「Excel 序列化尾数」的格子（色阶 tint / 字体 family-charset）：如实报 WARN，不判 fail
    labels = ("数字格式", "字体", "填充", "边框", "对齐", "保护")
    near, comps = [], {}
    for k in sorted(set(before["styles_strict"]) | set(after["styles_strict"])):
        bs = before["styles_strict"].get(k)
        as_ = after["styles_strict"].get(k)
        if bs == as_ or bs is None or as_ is None:
            continue
        if before["styles"].get(k) != after["styles"].get(k):
            continue                      # 可见属性确实不同 ⇒ 已在 V5 判 fail
        which = [labels[i] for i, (x, y) in enumerate(zip(bs, as_)) if x != y]
        for w in which:
            comps[w] = comps.get(w, 0) + 1
        near.append("%s：%s（Excel 重算尾数）" % (k, "、".join(which)))
    diffs["styles_normalized"] = near[:max_examples]
    checks.append({
        "id": "V5b", "title": "只差 Excel 保存时重算的尾数（色阶/字体 family·charset）",
        "result": "warn" if near else "pass",
        "detail": ("%d 格只差尾数（%s）—— 可见属性逐项一致，渲染上不可见"
                   % (len(near), "、".join("%s %d 格" % (k2, v2) for k2, v2 in sorted(comps.items()))))
                  if near else "没有任何格子只差尾数（格式指纹连尾数都一致）",
        "evidence": {"normalized_cells": near[:max_examples], "by_component": comps},
    })

    # ── V6/V7 包内部件
    b_vba = _vba_fingerprint(before["path"])
    a_vba = _vba_fingerprint(after["path"])
    if not b_vba.get("exists") and not a_vba.get("exists"):
        checks.append({"id": "V6", "title": "VBA 保真（.xlsm）", "result": "not_applicable",
                       "detail": "两份文件都没有 VBA 部件", "evidence": {}})
    else:
        bad6, notes6 = [], []
        if b_vba.get("exists") and not a_vba.get("exists"):
            bad6.append("VBA 部件丢了：改前有 %s，改后没有" % b_vba.get("part"))
        if a_vba.get("exists") and not b_vba.get("exists"):
            notes6.append("改前没有 VBA 部件，改后出现了 %s" % a_vba.get("part"))
        if b_vba.get("exists") and a_vba.get("exists"):
            if b_vba.get("streams") != a_vba.get("streams"):
                bad6.append("VBA 模块/流名集合变了：%r → %r" % (b_vba.get("streams"), a_vba.get("streams")))
            if b_vba.get("bytes") != a_vba.get("bytes"):
                notes6.append("VBA 部件大小变了：%d → %d 字节" % (b_vba.get("bytes"), a_vba.get("bytes")))
            if b_vba.get("sha256") != a_vba.get("sha256"):
                notes6.append("Excel 保存时重新序列化了 VBA 存储（字节序不同、大小与流名相同 ⇒ 模块与代码未被改动）")
        ev6 = {"part": a_vba.get("part"), "streams": a_vba.get("streams"),
               "bytes": {"before": b_vba.get("bytes"), "after": a_vba.get("bytes")},
               "sha256_prefix": {"before": (b_vba.get("sha256") or "")[:16], "after": (a_vba.get("sha256") or "")[:16]},
               "notes": notes6}
        checks.append({"id": "V6", "title": "VBA 保真（VBA 部件存在 · 模块/流名集合一致）",
                       "result": ("fail" if bad6 else ("warn" if notes6 else "pass")),
                       "detail": ("VBA 部件在，模块/流名 %d 项逐项一致" % len(a_vba.get("streams") or []))
                                 + ("；" + "；".join(notes6) if notes6 else ""),
                       "evidence": dict(ev6, **{"changed": bad6})})

    info_parts = []
    try:
        with zipfile.ZipFile(before["path"]) as z1, zipfile.ZipFile(after["path"]) as z2:
            s1 = {n: hashlib.sha256(z1.read(n)).hexdigest() for n in z1.namelist()
                  if n.startswith(INFO_PART_PREFIXES) and not n.endswith("/")}
            s2 = {n: hashlib.sha256(z2.read(n)).hexdigest() for n in z2.namelist()
                  if n.startswith(INFO_PART_PREFIXES) and not n.endswith("/")}
            for n in sorted(set(s1) | set(s2)):
                if s1.get(n) != s2.get(n):
                    info_parts.append(n)
    except Exception as e:  # noqa: BLE001 —— 如实报告，不静默
        info_parts.append("读取包内部件失败: %s" % e)
    checks.append({"id": "V7", "title": "未覆盖部件如实列出", "result": "warn" if info_parts else "pass",
                   "detail": ("以下部件本工具不做语义比对（Excel 重写包时可能重排；新增批注会新增批注用 VML，"
                              "批注本身由 V4 逐格核对）：%s" % ", ".join(info_parts[:max_examples]))
                             if info_parts else "包内无图表/图片/切片器等未覆盖部件",
                   "evidence": {"uncovered_parts": info_parts[:max_examples]}})

    verdict = "pass" if all(c["result"] in ("pass", "not_applicable", "warn") for c in checks) else "fail"
    return verdict, checks, diffs


def check_new_file(path, plan_path, max_examples=40):
    """新建表专用验收：没有"改前"可比，判据换成「最终 == 计划预期快照」。

    - 声明区域外不许有任何内容或批注（多出来就是计划外写入）；
    - 声明的内容格必须逐格等于计划预期；
    - 声明的批注必须逐格等于计划预期；
    - 公式格必须有缓存值（新表由 Excel 保存时写入；零重算模式下也可能为空 —— 如实报）。
    """
    plan, expect = load_plan(plan_path)
    snap = snapshot(path)
    snap["path"] = str(path)
    touched = expect["touched"]
    stray = sorted([k for k in list(snap["values"]) + list(snap["formulas"]) if k not in touched])
    missing, mismatch = [], []
    for k, (kind, want) in sorted(expect["content"].items()):
        got = snap["formulas"].get(k) if kind == "formula" else snap["values"].get(k)
        if got is None:
            missing.append("%s 期望 %s=%r，实际为空" % (k, kind, want))
        elif _finite(want) != _finite(got):
            mismatch.append("%s 期望 %r，实际 %r（公式/值口径 %s）" % (k, want, got, kind))
    stray_comments = sorted(k for k in snap["comments"] if k not in expect["comment"])
    comment_mismatch = ["%s 期望批注 %r，实际 %r" % (k, expect["comment"][k], snap["comments"].get(k))
                        for k in sorted(expect["comment"])
                        if _finite(expect["comment"][k]) != _finite(snap["comments"].get(k))]
    no_cache = sorted(snap["cached_missing"])
    checks = [
        {"id": "N1", "title": "声明区域外没有任何内容/批注（多出来的就是计划外写入）",
         "result": "pass" if not (stray or stray_comments) else "fail",
         "detail": "声明 %d 格；区域外内容 0 处、批注 0 处" % len(touched),
         "evidence": {"stray_content": stray[:max_examples], "stray_comments": stray_comments[:max_examples]}},
        {"id": "N2", "title": "声明的内容格逐格等于计划预期",
         "result": "pass" if not (missing or mismatch) else "fail",
         "detail": "声明内容 %d 格逐格核对" % len(expect["content"]),
         "evidence": {"missing": missing[:max_examples], "mismatch": mismatch[:max_examples]}},
        {"id": "N3", "title": "声明的批注逐格等于计划预期",
         "result": "pass" if not comment_mismatch else "fail",
         "detail": "声明批注 %d 格逐格核对" % len(expect["comment"]),
         "evidence": {"mismatch": comment_mismatch[:max_examples]}},
        {"id": "N4", "title": "公式格缓存值已写入（游戏/导出读的就是它）",
         "result": "pass" if not no_cache else "warn",
         "detail": "公式 %d 格，其中缓存值缺失 %d 格" % (len(snap["formulas"]), len(no_cache)),
         "evidence": {"formula_cells_without_cache": no_cache[:max_examples]}},
    ]
    verdict = "pass" if all(c["result"] in ("pass", "warn", "not_applicable") for c in checks) else "fail"
    diffs = {"stray_content": stray[:max_examples], "stray_comments": stray_comments[:max_examples],
             "missing": missing[:max_examples], "mismatch": mismatch[:max_examples],
             "comment_mismatch": comment_mismatch[:max_examples],
             "formula_cells_without_cache": no_cache[:max_examples]}
    return {
        "verdict": verdict,
        "mode": "new_file",
        "before": {"path": "(新建，无改前文件)", "sha256": None},
        "after": {"path": str(path), "sha256": sha256_file(path)},
        "plan": {"change_set_id": plan.get("change_set_id"), "ops": len(plan.get("ops") or [])},
        "checks": checks,
        "diffs": diffs,
        "counts": {"declared_cells": len(touched), "declared_changes": len(expect["content"]),
                   "declared_comment_changes": len(expect["comment"]),
                   "declared_number_format_changes": len(expect["number_format"])},
        "uncovered": ["新建表不做逐格格式比对（没有改前可比）——格式以计划声明的 number_format 为准",
                      "工作表级设置在新建时由 Excel 默认值决定"],
    }


def format_checks(checks, max_examples=40):
    """把 checks 打成给人看的一行行（写入引擎与 CLI 共用同一份措辞）。"""
    lines = []
    for c in checks:
        mark = {"pass": "PASS", "fail": "FAIL", "warn": "WARN", "not_applicable": "N/A "}[c["result"]]
        lines.append("[%s] %s %s" % (mark, c["id"], c["title"]))
        lines.append("       %s" % c["detail"])
        for key, value in (c.get("evidence") or {}).items():
            if isinstance(value, (list, tuple)):
                for line in list(value)[:max_examples]:
                    lines.append("       - %s" % line)
            elif value not in (None, "", {}, []):
                lines.append("       · %s = %s" % (key, value))
    return lines


# ── main ───────────────────────────────────────────────────────────────────────

def run(before_path, after_path, plan_path, recalc=False, max_examples=40):
    plan, expect = load_plan(plan_path)
    before = snapshot(before_path)
    after = snapshot(after_path)
    before["path"] = str(before_path)
    after["path"] = str(after_path)
    verdict, checks, diffs = compare(plan, expect, before, after, recalc, max_examples)
    report = {
        "verdict": verdict,
        "before": {"path": str(before_path), "sha256": sha256_file(before_path)},
        "after": {"path": str(after_path), "sha256": sha256_file(after_path)},
        "plan": {"change_set_id": plan.get("change_set_id"), "ops": len(plan.get("ops") or []),
                 "change_ids": sorted({o.get("change_id") for o in (plan.get("ops") or []) if o.get("change_id")}),
                 "recalc": bool(recalc)},
        "checks": checks,
        "diffs": diffs,
        "counts": {"declared_cells": len(expect["touched"]), "declared_changes": len(expect["content"]),
                   "declared_comment_changes": len(expect["comment"]),
                   "declared_number_format_changes": len(expect["number_format"])},
        "uncovered": ["行列级样式索引（ColumnDimension/RowDimension.style）不做比对：Excel 重写包时索引可能整体重排",
                      "使用范围之外的整列/整行格式（openpyxl 不可见）",
                      "字体 family/charset 与主题色 tint 尾数：Excel 保存会重算（判据取可见属性 + tint 3 位小数；此类差异单列 V5b WARN）",
                      "VBA 代码级逐字节比对（Excel 保存会重新序列化 vbaProject.bin；判据=部件存在 + 模块/流名集合一致，字节差异报 WARN）",
                      "V7 列出的包内部件不做语义比对"],
        "elapsed_seconds": {"before": before.get("elapsed"), "after": after.get("elapsed")},
    }
    return report


def main():
    ap = argparse.ArgumentParser(description="「只改目标 + 保真」验收（只读，不写表）")
    ap.add_argument("--before", required=True, help="改前文件（备份副本）")
    ap.add_argument("--after", required=True, help="改后文件")
    ap.add_argument("--plan", required=True, help="写入计划 plan.json")
    ap.add_argument("--json", dest="json_out", help="把完整报告写到这个路径")
    ap.add_argument("--recalc", action="store_true", help="显式声明本次允许重算（缓存值变化如实列出）")
    ap.add_argument("--max-examples", type=int, default=40)
    args = ap.parse_args()

    for p in (args.before, args.after, args.plan):
        if not Path(p).is_file():
            print("文件不存在: %s" % p, file=sys.stderr)
            return 2
    try:
        report = run(args.before, args.after, args.plan, args.recalc, args.max_examples)
    except ValueError as e:
        print("计划/输入有问题: %s" % e, file=sys.stderr)
        return 2

    for line in format_checks(report["checks"], args.max_examples):
        print(line)
    for name, lines in (report["diffs"] or {}).items():
        if not lines:
            continue
        print("\n差异明细 %s（前 %d 条）:" % (name, min(len(lines), args.max_examples)))
        for line in lines[: args.max_examples]:
            print("  - %s" % line)
    print("\n结论: %s  (声明 %d 格 / %d 处变更；before sha256 %s… after sha256 %s…)"
          % (report["verdict"].upper(), report["counts"]["declared_cells"],
             report["counts"]["declared_changes"],
             report["before"]["sha256"][:12], report["after"]["sha256"][:12]))

    if args.json_out:
        Path(args.json_out).write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
        print("完整报告: %s" % args.json_out)
    return 0 if report["verdict"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
