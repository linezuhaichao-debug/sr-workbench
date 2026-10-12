# -*- coding: utf-8 -*-
"""history_snapshot.py — 给产物存一份**历史版本**（sr 系列共用，随 sr-askme 分发）。

用户口径（2026-10-12）：
    **每次产物的修改都留下历史版本**，按 `<日期>_<序号>` 区分，例如 `A079-联盟讨伐_20261012_1.xlsx`。
    序号 = **当天该产物的第几份**，从 1 起。

规则与落点的唯一权威是 `../references/version-history.md` —— 本工具只实现它，不改口径。

它做什么:
    1. 读**目录实况**算出这一版的序号（不靠人记、也不用调用方传）；
    2. 把产物**复制**成 `<去最后一段扩展名>_<YYYYMMDD>_<N><扩展名>`（copy2，保留时间戳）；
    3. 打印新版本的路径（人看 / agent 与脚本捕获都方便；`--json` 给机器读）。

它不做什么:
    · 不删任何东西、不改原产物、不动原文件的 mtime；
    · 不追溯（老版本不回填）；
    · 产物不存在时不凭空造一版 —— "存一版"的前提是有原件；
    · 不给**历史版本本身**再开版本（`x_20261013_1.md` 再调用会被拒）。

用法:
    python history_snapshot.py "<产物绝对路径>" [--dir "<目标目录>"] [--dry-run] [--json out.json]
    python history_snapshot.py --selftest          # 全程临时目录，不碰你的文件

    · `--dir` 的典型用途：**config_root 里的既有表**改之前存一版 —— 版本要落**功能目录的 gdd\\**，
      不能落配置目录（那里多出来的文件会进导出/INDEX/引用扫描的视野）。
    · 改文档 / HTML / 图片：省略 `--dir`，版本就落在产物旁边（同桶平铺）。

返回码:
    0 = 已存（`--dry-run` 时表示"算得出来、没写盘"）
    2 = 拒绝（产物不存在 / 产物本身已是历史版本 / 没有扩展名 / 目标目录不存在）
    3 = 写失败（磁盘、权限）
"""
import argparse
import json
import re
import shutil
import sys
import tempfile
from datetime import datetime
from pathlib import Path

# 历史版本的尾部形状：`_<8 位日期>_<序号>`（判据与 `sr-workbench/src/pure/buckets.ts` 同口径）
VERSION_TAIL = re.compile(r"_\d{8}_\d+$")


def log(msg):
    print(msg, flush=True)


def _setup_stdout():
    """输出编码：**真人终端保持系统默认**（老 conhost 是 GBK），**被管道/重定向采集时用 UTF-8**。

    ★ 为什么要有这段（实测踩过两次）：Windows 控制台默认 GBK，一个 `✓` 就能让自检自己
      抛 UnicodeEncodeError；反过来，采集端（agent / CI / 现代终端）一律按 UTF-8 解码，
      GBK 字节过去就是一屏乱码。所以按"有没有 tty"分两种口径 —— 两边都能读。
    """
    try:
        if not sys.stdout.isatty():
            sys.stdout.reconfigure(encoding="utf-8")
    except Exception:  # noqa: BLE001 —— 老 Python / 特殊流：编不出来也不该让工具挂掉
        pass


def is_history_version(stem):
    """`x_20261013_1` → True（这本身已经是一份历史版本）。"""
    return bool(VERSION_TAIL.search(stem or ""))


def next_seq(out_dir, stem, day, ext):
    """扫目录里 `<stem>_<day>_<n><ext>` 的既有版本 → 下一个序号（从 1 起）。"""
    pat = re.compile(
        r"^" + re.escape(stem) + "_" + re.escape(day) + r"_(\d+)" + re.escape(ext) + r"$",
        re.IGNORECASE,
    )
    best = 0
    for child in out_dir.iterdir():
        if not child.is_file():
            continue
        m = pat.match(child.name)
        if m:
            best = max(best, int(m.group(1)))
    return best + 1


def plan_snapshot(src, out_dir=None, today=None):
    """算出版本落点（**不写盘**）。返回 `(ok, 说明, 目标路径)`。"""
    src = Path(src)
    if not src.is_file():
        return False, "产物不存在（没有原件可存）：%s" % src, None
    stem, ext = src.stem, src.suffix
    if is_history_version(stem):
        return False, "这本身已经是一份历史版本（%s）—— 不给版本再开版本。" % src.name, None
    if not ext:
        return False, "文件没有扩展名，认不出该保留什么后缀：%s" % src.name, None
    target_dir = Path(out_dir) if out_dir else src.parent
    if not target_dir.is_dir():
        return False, "目标目录不存在：%s" % target_dir, None
    day = today or datetime.now().strftime("%Y%m%d")
    n = next_seq(target_dir, stem, day, ext)
    return True, "", target_dir / ("%s_%s_%d%s" % (stem, day, n, ext))


def do_snapshot(src, out_dir=None, dry=False, today=None):
    """存一版。返回 `(code, 说明, 版本路径)`。"""
    ok, why, dest = plan_snapshot(src, out_dir, today)
    if not ok:
        return 2, why, None
    if dry:
        return 0, "（dry-run）将存为：%s" % dest, dest
    try:
        shutil.copy2(Path(src), dest)
    except OSError as e:
        return 3, "复制失败：%s（%s）" % (dest, e), None
    return 0, str(dest), dest


# ── 自检（全程临时目录，不碰真实文件） ────────────────────────────────────────────

def selftest():
    cases = []

    def case(name, ok, extra=""):
        cases.append((name, bool(ok), extra))

    with tempfile.TemporaryDirectory(prefix="sr-histsnap-") as tmp:
        d = Path(tmp)

        src = d / "A079-联盟讨伐.xlsx"
        src.write_bytes(b"v1")

        code, msg, p1 = do_snapshot(src, today="20261013")
        case("1) 第一版 → _20261013_1", code == 0 and p1 is not None and p1.name == "A079-联盟讨伐_20261013_1.xlsx", msg)

        code, msg, p2 = do_snapshot(src, today="20261013")
        case("2) 再存一版 → _20261013_2（序号递增）", code == 0 and p2 is not None and p2.name == "A079-联盟讨伐_20261013_2.xlsx", msg)

        case("3) 旧版本没被覆盖、内容与原件一致", p1.exists() and p1.read_bytes() == b"v1")

        code, msg, p3 = do_snapshot(src, today="20261014")
        case("4) 隔天序号从 1 重新起", code == 0 and p3 is not None and p3.name == "A079-联盟讨伐_20261014_1.xlsx", msg)

        (d / "B-表_20261013_7.xlsx").write_bytes(b"x")
        b = d / "B-表.xlsx"
        b.write_bytes(b"v1")
        code, msg, p4 = do_snapshot(b, today="20261013")
        case("5) 序号按目录实况算（已有 _7 → 下一个 _8）", p4 is not None and p4.name == "B-表_20261013_8.xlsx", msg)

        c = d / "x.content.json"
        c.write_bytes(b"{}")
        code, msg, p5 = do_snapshot(c, today="20261013")
        case("6) 多段扩展名只挪最后一段（x.content.json → x.content_20261013_1.json）",
             p5 is not None and p5.name == "x.content_20261013_1.json", msg)

        code, msg, _ = do_snapshot(p1, today="20261013")
        case("7) 不给历史版本再开版本（拒绝）", code == 2, msg)

        code, msg, _ = do_snapshot(d / "没有这个.xlsx", today="20261013")
        case("8) 产物不存在 → 拒绝", code == 2, msg)

        before = sorted(x.name for x in d.iterdir())
        code, msg, p6 = do_snapshot(src, dry=True, today="20261013")
        after = sorted(x.name for x in d.iterdir())
        case("9) --dry-run 一个文件都不写", code == 0 and before == after and p6 is not None, msg)

        sub = d / "gdd"
        sub.mkdir()
        code, msg, p7 = do_snapshot(src, out_dir=sub, today="20261013")
        case("10) --dir 换落点（既有表 → 功能目录 gdd\\）", p7 is not None and p7.parent == sub, msg)

        code, msg, _ = do_snapshot(src, out_dir=d / "没有这个目录", today="20261013")
        case("11) 目标目录不存在 → 拒绝", code == 2, msg)

        code, msg, p8 = do_snapshot(src, out_dir=sub, today="20261014")
        case("12) 换落点后序号在新目录里另算（gdd\\ 里是 _1）",
             p8 is not None and p8.name == "A079-联盟讨伐_20261014_1.xlsx", msg)

    npass = sum(1 for _, ok, _ in cases if ok)
    for name, ok, extra in cases:
        # ★ 只用中文 + ASCII 编号：`✓` `⑪` 这类符号 GBK 编不出来（实测踩过），
        #   别为了好看让自检自己崩掉。
        log("%s %s%s" % ("[ok]  " if ok else "[FAIL]", name, ("   " + extra) if (extra and not ok) else ""))
    log("自检：%d/%d %s" % (npass, len(cases), "通过" if npass == len(cases) else "不通过"))
    return 0 if npass == len(cases) else 1


# ── 主流程 ─────────────────────────────────────────────────────────────────────

def main():
    _setup_stdout()
    ap = argparse.ArgumentParser(description="给产物存一份历史版本：<名>_<YYYYMMDD>_<序号>.<ext>")
    ap.add_argument("path", nargs="?", help="产物路径（存的是它**当前**的样子）")
    ap.add_argument("--dir", dest="out_dir", help="版本落点（默认＝产物所在目录）")
    ap.add_argument("--dry-run", action="store_true", help="只算序号、只打印名字，不复制")
    ap.add_argument("--json", dest="json_out", help="把结果写成 JSON（给机器读）")
    ap.add_argument("--selftest", action="store_true", help="自检（全程临时目录，不碰你的文件）")
    args = ap.parse_args()

    if args.selftest:
        return selftest()
    if not args.path:
        ap.print_help()
        return 2

    code, msg, dest = do_snapshot(args.path, args.out_dir, args.dry_run)
    if code == 0:
        if args.dry_run:
            log(msg)
        else:
            log("已存历史版本：%s" % dest)
            log("  原件未改动：%s" % Path(args.path))
    else:
        log("没存：%s" % msg)

    if args.json_out:
        Path(args.json_out).write_text(
            json.dumps(
                {
                    "ok": code == 0,
                    "code": code,
                    "message": msg,
                    "source": str(Path(args.path)),
                    "version": str(dest) if dest else None,
                    "dry_run": bool(args.dry_run),
                },
                ensure_ascii=False,
                indent=1,
            ),
            encoding="utf-8",
        )
    return code


if __name__ == "__main__":
    sys.exit(main())
