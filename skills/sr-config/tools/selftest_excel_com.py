# -*- coding: utf-8 -*-
"""selftest_excel_com.py — 改表工具链自检（sr-config skill 附带，**不碰你的配置表**）。

在一份临时目录里：用写入引擎自己建一张新表（顺带验新建表路径）→ 改它一格 →
跑三条守卫与一次 dry-run → 核对 Excel 真的退出了。任何一步不符合预期就退出码非 0。

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
