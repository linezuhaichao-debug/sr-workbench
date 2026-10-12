# -*- coding: utf-8 -*-
"""selftest_excel_com.py — 改表工具链自检（sr-config skill 附带，**不碰你的配置表**）。

在一份临时目录里：用写入引擎自己建一张新表（顺带验新建表路径）→ 改它一格 →
跑三条守卫与一次 dry-run → 追加记录（验 V1c/V5c 两条追加分支的正例与负例）→
核对 Excel 真的退出了。任何一步不符合预期就退出码非 0。

用法:
    python selftest_excel_com.py [--keep] [--json 结果.json]

前置：本机装了 Excel + pywin32（`pip install pywin32`）。
退出码: 0=全部通过；1=有用例失败；2=环境不满足（无 Excel / 无 pywin32）。
"""
import argparse
import glob
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
EDITOR = HERE / "excel_com_edit.py"
VERIFIER = HERE / "verify_table_edit.py"


def _setup_stdout():
    """输出编码：**真人终端保持系统默认**（老 conhost 是 GBK），**被管道/重定向采集时用 UTF-8**。

    ★ 为什么要有这段（2026-10-13 实测）：用例名里有 `⇒`，GBK 编不出来。终端里跑没事
      （Python 在 Windows 控制台直接写 UTF-16），但**被管道采集时**会抛 UnicodeEncodeError，
      自检自己崩在打印那一步 —— 而且**引擎那边也会一起崩**（它的 `✓` 同理），
      于是用例被误判成 FAIL、退出码看起来像"验收失败"。两边都得按"有没有 tty"分口径。
    """
    try:
        if not sys.stdout.isatty():
            sys.stdout.reconfigure(encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def excel_pids():
    try:
        out = subprocess.run(["tasklist", "/FI", "IMAGENAME eq EXCEL.EXE", "/NH", "/FO", "CSV"],
                             capture_output=True, text=True, timeout=30).stdout
    except Exception:  # noqa: BLE001
        return set()
    pids = set()
    for line in out.splitlines():
        parts = [p.strip().strip('"') for p in line.split('","')]
        if len(parts) >= 2 and parts[0].upper() == "EXCEL.EXE":
            try:
                pids.add(int(parts[1]))
            except ValueError:
                pass
    return pids


def run(argv):
    p = subprocess.run([sys.executable] + [str(a) for a in argv], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def write_plan(path, plan):
    Path(path).write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")
    return path


def main():
    _setup_stdout()
    ap = argparse.ArgumentParser(description="改表工具链自检（只动临时文件）")
    ap.add_argument("--keep", action="store_true", help="保留临时目录（排障用）")
    ap.add_argument("--json", dest="json_out")
    args = ap.parse_args()

    try:
        import pythoncom  # noqa: F401
        import win32com.client  # noqa: F401
    except ImportError as e:
        print("环境不满足：缺 pywin32（pip install pywin32）—— %s" % e)
        return 2
    try:
        import win32com.client as wc
        pythoncom = __import__("pythoncom")
        pythoncom.CoInitialize()
        app = wc.DispatchEx("Excel.Application")
        version = app.Version
        app.Quit()
        del app
        pythoncom.CoUninitialize()
        time.sleep(0.5)
    except Exception as e:  # noqa: BLE001
        print("环境不满足：起不了 Excel COM 实例（本机装 Excel 了吗？）—— %s" % e)
        return 2

    tmp = Path(tempfile.mkdtemp(prefix="sr-config-selftest-"))
    target = tmp / "自检表.xlsx"
    fixture_plan = write_plan(tmp / "plan-fixture.json", {
        "schema_version": 1, "change_set_id": "SELFTEST-FIXTURE", "target_file": str(target),
        "new_file": {"sheets": ["数据"]},
        "ops": [
            {"change_id": "F01", "kind": "value", "sheet": "数据", "ref": "B1", "value": "中文字段"},
            {"change_id": "F02", "kind": "value", "sheet": "数据", "ref": "C1", "value": "数量"},
            {"change_id": "F03", "kind": "value", "sheet": "数据", "ref": "D1", "value": "合计"},
            {"change_id": "F04", "kind": "value", "sheet": "数据", "ref": "B2", "value": "英文字段"},
            {"change_id": "F05", "kind": "value", "sheet": "数据", "ref": "C2", "value": "count"},
            {"change_id": "F06", "kind": "value", "sheet": "数据", "ref": "D2", "value": "total"},
            {"change_id": "F07", "kind": "value", "sheet": "数据", "ref": "B6", "value": 3},
            {"change_id": "F08", "kind": "value", "sheet": "数据", "ref": "C6", "value": 4},
            {"change_id": "F09", "kind": "value", "sheet": "数据", "ref": "E6", "value": "0012",
             "as_text": True},
            {"change_id": "F10", "kind": "comment", "sheet": "数据", "ref": "B1", "value": "主键：全表唯一"},
            {"change_id": "F11", "kind": "formula", "sheet": "数据", "ref": "D6",
             "formula": "=B6+C6", "expect_cached": 7},
        ],
    })
    edit_plan = write_plan(tmp / "plan-edit.json", {
        "schema_version": 1, "change_set_id": "SELFTEST-EDIT", "target_file": str(target),
        "ops": [
            {"change_id": "E01", "kind": "value", "sheet": "数据", "ref": "B6", "value": 10,
             "expect_before": 3},
            {"change_id": "E02", "kind": "comment", "sheet": "数据", "ref": "C1",
             "value": "数量：正整数"},
        ],
    })
    partial_plan = write_plan(tmp / "plan-partial.json", {
        "schema_version": 1, "change_set_id": "SELFTEST-PARTIAL", "target_file": str(target),
        "ops": [{"change_id": "E02", "kind": "comment", "sheet": "数据", "ref": "C1",
                 "value": "数量：正整数"}],
    })
    bad_before_plan = write_plan(tmp / "plan-badbefore.json", {
        "schema_version": 1, "change_set_id": "SELFTEST-BADBEFORE", "target_file": str(target),
        "ops": [{"change_id": "X01", "kind": "value", "sheet": "数据", "ref": "B6", "value": 99,
                 "expect_before": 123456}],
    })
    bad_cache_plan = write_plan(tmp / "plan-badcache.json", {
        "schema_version": 1, "change_set_id": "SELFTEST-BADCACHE", "target_file": str(target),
        "ops": [{"change_id": "X02", "kind": "formula", "sheet": "数据", "ref": "D6",
                 "formula": "=B6+C6+1", "expect_cached": 999}],
    })
    dry_plan = write_plan(tmp / "plan-dry.json", {
        "schema_version": 1, "change_set_id": "SELFTEST-DRY", "target_file": str(target),
        "ops": [{"change_id": "X03", "kind": "value", "sheet": "数据", "ref": "B6", "value": 11,
                 "expect_before": 10}],
    })
    # 追加记录（record_change）：往既有表末尾加行 —— 会同时触发 V1c（行增长）与 V5c（空白格补默认样式）
    append_plan = write_plan(tmp / "plan-append.json", {
        "schema_version": 1, "change_set_id": "SELFTEST-APPEND", "target_file": str(target),
        "ops": [
            {"change_id": "A01", "kind": "value", "sheet": "数据", "ref": "B7", "value": "新行1"},
            {"change_id": "A02", "kind": "value", "sheet": "数据", "ref": "C7", "value": 11},
            {"change_id": "A03", "kind": "value", "sheet": "数据", "ref": "B8", "value": "新行2"},
            {"change_id": "A04", "kind": "value", "sheet": "数据", "ref": "C8", "value": 12},
        ],
    })
    # 同一批追加，但**只声明第 7 行** —— 给 V1c 造负例：增长出的第 8 行落在声明区域外
    append_narrow_plan = write_plan(tmp / "plan-append-narrow.json", {
        "schema_version": 1, "change_set_id": "SELFTEST-APPEND-NARROW", "target_file": str(target),
        "ops": [{"change_id": "A01", "kind": "value", "sheet": "数据", "ref": "B7", "value": "新行1"}],
    })
    # 给 V5 造负例：声明过 B6 的数字格式变更（引擎自己会放行）…
    fmt_plan = write_plan(tmp / "plan-fmt.json", {
        "schema_version": 1, "change_set_id": "SELFTEST-FMT", "target_file": str(target),
        "ops": [{"change_id": "M01", "kind": "number_format", "sheet": "数据", "ref": "B6", "value": "0"}],
    })
    # …但拿一份**没声明数字格式**的窄计划去验收：既有格格式被改 ⇒ V5 必须判 fail
    fmt_narrow_plan = write_plan(tmp / "plan-fmt-narrow.json", {
        "schema_version": 1, "change_set_id": "SELFTEST-FMT-NARROW", "target_file": str(target),
        "ops": [{"change_id": "M02", "kind": "value", "sheet": "数据", "ref": "B6", "value": 10}],
    })

    cases = []

    def case(name, ok, detail):
        cases.append({"case": name, "ok": bool(ok), "detail": detail})
        print("[%s] %s —— %s" % ("PASS" if ok else "FAIL", name, detail))

    pids_before = excel_pids()

    # ① 新建表（走引擎的 new_file 路径）
    code, out = run([EDITOR, "--plan", fixture_plan, "--json", tmp / "r1.json"])
    case("①新建表：只写声明区域 + 声明批注 + 公式缓存值", code == 0 and "N4" in out,
         "exit=%d" % code)

    # ② 改一格 + 改一条批注
    code, out = run([EDITOR, "--plan", edit_plan, "--json", tmp / "r2.json"])
    case("②改表：只改目标 / 保真 / 保存并退出 Excel", code == 0 and "验收通过" in out,
         "exit=%d；%s" % (code, "Excel 退出核对：" + out.split("Excel 退出核对：")[-1].split("\n")[0]
                          if "Excel 退出核对：" in out else "未见到退出核对"))

    # ③ 越界检测：计划漏声明了一处改动 ⇒ 验收必须红
    backups = sorted(glob.glob(str(tmp / "自检表.backup.*.xlsx")))
    if not backups:
        case("③越界检测", False, "没找到备份文件（② 没产生备份？）")
    else:
        code, out = run([VERIFIER, "--before", backups[-1], "--after", target,
                         "--plan", partial_plan])
        ok = code == 1 and "content_outside" in out and "B6" in out
        case("③越界检测：漏声明的改动被判 fail 并逐格报出", ok, "exit=%d" % code)

    # ④ 原值守卫（expect_before 不符 ⇒ 拒写、文件一字节不动）
    h0 = sha256(target)
    code, out = run([EDITOR, "--plan", bad_before_plan])
    case("④原值守卫：expect_before 不符 ⇒ 拒写且文件未变",
         code == 2 and sha256(target) == h0 and "改前原值不符" in out, "exit=%d" % code)

    # ⑤ 缓存值守卫（写公式时期望值不符 ⇒ 不保存）
    h0 = sha256(target)
    code, out = run([EDITOR, "--plan", bad_cache_plan])
    case("⑤缓存值守卫：expect_cached 不符 ⇒ 不保存且文件未变",
         code == 2 and sha256(target) == h0 and "expect_cached" in out, "exit=%d" % code)

    # ⑥ dry-run（不写盘）
    h0 = sha256(target)
    code, out = run([EDITOR, "--plan", dry_plan, "--dry-run"])
    case("⑥dry-run：预检通过但不写盘", code == 0 and sha256(target) == h0, "exit=%d" % code)

    # ⑦ Excel 彻底退出（本次自检没留下任何 EXCEL.EXE）
    left = excel_pids() - pids_before
    case("⑦Excel 彻底退出：自检没留下 EXCEL.EXE", not left, "残留 %s" % (sorted(left) or "无"))

    # ⑧ 改后的表读回：值对了、文本型没被吃成数字、公式与**缓存值按零重算口径**都没动；
    #    并且引擎必须把"改动格的下游公式"报出来（零重算下它们的缓存值是旧的 —— 这正是要提醒的事）
    try:
        from openpyxl import load_workbook
        wb = load_workbook(target, data_only=False)
        wbv = load_workbook(target, data_only=True)
        b6 = wb["数据"]["B6"].value
        e6 = wb["数据"]["E6"].value
        d6f, d6v = wb["数据"]["D6"].value, wbv["数据"]["D6"].value
        downs = (json.loads((tmp / "r2.json").read_text(encoding="utf-8")).get("downstream_formulas") or [])
        dep = " ".join(str(d.get("dependents")) for d in downs)
        ok = (b6 == 10 and e6 == "0012" and str(d6f).replace(" ", "") == "=B6+C6" and d6v == 7
              and "D6" in dep.replace("$", ""))
        case("⑧改后读回：值/文本型/公式与缓存值（零重算）/下游公式提醒", ok,
             "B6=%r E6=%r D6=%r 缓存=%r（零重算下应仍为 7）· 下游公式提醒=%r" % (b6, e6, d6f, d6v, dep))
    except Exception as e:  # noqa: BLE001
        case("⑧改后读回", False, "openpyxl 读不动：%s" % e)

    # ⑨ 追加记录（正例）：往既有表末尾加两行 ⇒ V1c（行增长）与 V5c（空白格补默认样式）各报一条 WARN，
    #    V1 / V5 仍判 pass，整体验收通过（exit 0）
    code, out = run([EDITOR, "--plan", append_plan, "--json", tmp / "r9.json"])
    ok9 = (code == 0 and "[WARN] V1c" in out and "[WARN] V5c" in out
           and "[FAIL] V1 " not in out and "[FAIL] V5 " not in out and "验收通过" in out)
    case("⑨追加记录：行增长与新增默认样式报 WARN（V1c/V5c），V1/V5 仍 pass",
         ok9, "exit=%d；%s" % (code, [l.strip() for l in out.splitlines() if "V1c" in l or "V5c" in l][:2]))

    # ⑩ V1c 负例：同一批追加只声明第 7 行 ⇒ 第 8 行落在声明区域外，必须判 fail
    backups = sorted(glob.glob(str(tmp / "自检表.backup.*.xlsx")))
    if not backups:
        case("⑩V1c 负例", False, "没找到 ⑨ 产生的备份")
    else:
        code, out = run([VERIFIER, "--before", backups[-1], "--after", target,
                         "--plan", append_narrow_plan])
        ok10 = code == 1 and "V1c" in out and "不在声明区域内" in out
        case("⑩V1c 负例：增长越过声明区域 ⇒ 判 fail（不接受'多写了东西'）",
             ok10, "exit=%d" % code)

    # ⑪ V5 负例：既有格（B6）的数字格式被改、而验收计划没声明它 ⇒ V5 必须判 fail
    code, out = run([EDITOR, "--plan", fmt_plan, "--json", tmp / "r11.json"])
    backups = sorted(glob.glob(str(tmp / "自检表.backup.*.xlsx")))
    if code != 0 or not backups:
        case("⑪V5 负例", False, "声明数字格式的那次写入没成功（exit=%d）" % code)
    else:
        code2, out2 = run([VERIFIER, "--before", backups[-1], "--after", target,
                           "--plan", fmt_narrow_plan])
        ok11 = code2 == 1 and "V5" in out2 and "数字格式被改动" in out2
        case("⑪V5 负例：既有格格式被改而计划未声明 ⇒ 判 fail（V5c 不放过既有格）",
             ok11, "声明格式那次 exit=%d；窄计划验收 exit=%d" % (code, code2))

    failed = [c for c in cases if not c["ok"]]
    summary = {"excel_version": version, "tmpdir": str(tmp), "cases": cases,
               "passed": len(cases) - len(failed), "failed": len(failed)}
    if args.json_out:
        Path(args.json_out).write_text(json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    print("\n%d/%d 通过（Excel %s）" % (len(cases) - len(failed), len(cases), version))
    if not args.keep and not failed:
        shutil.rmtree(tmp, ignore_errors=True)
    else:
        print("临时目录: %s" % tmp)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
