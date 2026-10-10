# -*- coding: utf-8 -*-
"""excel_com_edit.py — 经 **Excel COM** 改策划配置表（sr-config skill 附带）。

为什么必须走 COM（用户口径，2026-10-10）：
    openpyxl 这类直接改 XML 的写法会丢批注、丢格式、丢公式的缓存值（游戏/导出读的就是缓存值）。
    Excel 自己打开-改-存，批注/公式/格式/缓存值天然保留。于是本工具是**唯一的写入通道**。

本工具保证（与 verify_table_edit.py 的判据一一对应）:
    1. **只改计划里声明的单元格/区域** —— 引擎只会对声明引用调用 Range，绝不整表重写；
       计划里可带 `expect_before`，改前先核对原值，防错行/错列。
    2. **批注、公式、格式、缓存值全部保留** —— 独占 Excel 实例、关闭自动重算与"保存前重算"
       （默认零重算，别的单元格缓存值原样），宏安全级别拉到"禁止执行"（.xlsm 的 VBA 原样保留但不运行）。
       · 写进去的**公式格**只重算它自己（`Range.Calculate`），并且必须给出 `expect_cached`，
         本机算出来对不上就**不保存**（否则游戏读到的是旧缓存值）；
       · 改动格如果被别的公式引用，引擎会把那些"下游公式"列出来提醒你：零重算口径下它们的
         缓存值没刷新（要一起刷用 `--recalc`）。
    3. **改完保存并彻底退出 Excel** —— Save → Close → Quit → 释放 COM → 轮询本实例 PID 消失；
       仍活着只杀**本实例自己那个 PID**（绝不碰你自己开着的 Excel）。
    另有：保存**之前**一切检查都不通过就中止（目标文件一个字节都没动）；保存前在同目录做字节级备份；
    验收不过自动从备份恢复（`--no-restore` 可关）。

用法:
    python excel_com_edit.py --plan plan.json [--dry-run] [--no-restore] [--recalc]
                             [--json result.json] [--report verify_report.json]

写入计划 plan.json:
{
  "schema_version": 1,
  "change_set_id": "CS-20261010-001",
  "target_file": "D:\\...\\A016-联盟等级.xlsx",
  "recalc": false,
  "new_file": {"sheets": ["联盟里程碑"]},          // 仅新建表时给（目标文件不存在）
  "ops": [
    {"change_id": "CHG-001", "kind": "value",         "sheet": "联盟等级", "ref": "D11", "value": 12,
     "expect_before": 5},
    {"change_id": "CHG-002", "kind": "formula",        "sheet": "联盟等级", "ref": "E11",
     "formula": "=SUM(A11:C11)", "expect_cached": 36},
    {"change_id": "CHG-003", "kind": "value",          "sheet": "联盟等级", "ref": "F11", "value": "0012",
     "as_text": true},
    {"change_id": "CHG-004", "kind": "comment",        "sheet": "联盟等级", "ref": "B1",
     "value": "取值边界 1..99；空=不启用"},
    {"change_id": "CHG-005", "kind": "number_format",  "sheet": "联盟等级", "ref": "D6:D20", "value": "0.00"},
    {"change_id": "CHG-006", "kind": "add_sheet",      "sheet": "联盟里程碑"}
  ]
}

返回码: 0=写入且验收通过; 1=验收失败(已恢复/新文件保留为 .failed.); 2=拒绝写入或计划有问题(目标未动);
        3=写入过程异常或 Excel 未确认退出(已尽力恢复, 见输出)。
"""
import argparse
import gc
import json
import os
import shutil
import subprocess
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import verify_table_edit as V  # noqa: E402  （同目录，验收引擎）

XL_CALCULATION_MANUAL = -4135
XL_OPENXML_WORKBOOK = 51
XL_OPENXML_WORKBOOK_MACRO = 52
MSO_AUTOMATION_SECURITY_FORCE_DISABLE = 3

CONTENT_KINDS = {"value", "formula"}


def log(msg):
    print(msg, flush=True)


# ── Excel 进程台账（只为"彻底退出"取证，绝不误伤用户自己开的 Excel） ──────────────

def _pid_alive(pid):
    if not pid:
        return False
    try:
        out = subprocess.run(["tasklist", "/FI", "PID eq %d" % pid, "/NH", "/FO", "CSV"],
                             capture_output=True, text=True, timeout=30).stdout
    except Exception:  # noqa: BLE001
        return False
    return ("%d" % pid) in out


def _excel_pids():
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


def _pid_of_hwnd(hwnd):
    try:
        import ctypes
        pid = ctypes.c_ulong()
        ctypes.windll.user32.GetWindowThreadProcessId(int(hwnd), ctypes.byref(pid))
        return int(pid.value) or None
    except Exception:  # noqa: BLE001
        return None


def _workbook_hwnd(wb):
    """工作簿窗口的句柄 → 本实例 Excel 的 PID（Visible=False 时 Application.Hwnd 可能为空）。"""
    for getter in (lambda: wb.Windows(1).Hwnd, lambda: wb.Application.Hwnd):
        try:
            h = getter()
            if h:
                return h
        except Exception:  # noqa: BLE001
            continue
    return None


def _new_excel_pid(before, tries=12):
    """比 before 多出来的那个 EXCEL.EXE 就是本工具的实例（你原有的一个都不碰）。"""
    for _ in range(tries):
        new = _excel_pids() - before
        if new:
            return sorted(new)[-1]
        time.sleep(0.4)
    return None


# ── 计划校验 ────────────────────────────────────────────────────────────────────

def load_and_check_plan(plan_path):
    plan, expect = V.load_plan(plan_path)          # 复用验收引擎的解析（口径只此一份）
    target = plan.get("target_file")
    if not isinstance(target, str) or not target.strip():
        raise ValueError("计划缺 target_file")
    plan["target_file"] = os.path.abspath(target)
    for op in plan["ops"]:
        if op.get("kind") == "add_sheet" and op.get("ref"):
            raise ValueError("add_sheet 不该带 ref")
    return plan, expect


# ── COM 小工具 ─────────────────────────────────────────────────────────────────

def _com_matrix(value, nrows, ncols):
    """把 COM 读回的值规范成 nrows×ncols 的二维列表。"""
    if nrows == 1 and ncols == 1:
        return [[value]]
    if isinstance(value, (list, tuple)):
        rows = list(value)
        if rows and not isinstance(rows[0], (list, tuple)):
            if nrows == 1:
                rows = [rows]
            elif ncols == 1:
                rows = [[v] for v in rows]
        return [[(r[i] if isinstance(r, (list, tuple)) and i < len(r) else None) for i in range(ncols)]
                for r in rows] + [[None] * ncols] * (nrows - len(rows))
    return [[value] * ncols for _ in range(nrows)]


def _finite(v):
    return V._finite(v)


def _preflight(wb, ops):
    """写之前把能查的全查掉：表在不在、形状对不对、原值是否符合 expect_before、新表名是否撞车。"""
    problems = []
    existing_sheets = set()
    for ws in wb.Worksheets:
        existing_sheets.add(ws.Name)
    for i, op in enumerate(ops, 1):
        where = "ops[%d](%s)" % (i, op.get("change_id") or op.get("kind"))
        kind = op["kind"]
        sheet = op["sheet"]
        if kind == "add_sheet":
            if sheet in existing_sheets:
                problems.append("%s：工作表 %r 已存在" % (where, sheet))
            existing_sheets.add(sheet)
            continue
        if sheet not in existing_sheets:
            problems.append("%s：工作表 %r 不存在" % (where, sheet))
            continue
        r1, c1, r2, c2, nrows, ncols = V.parse_ref(op["ref"])
        rng = wb.Worksheets(sheet).Range(op["ref"])
        if rng.Rows.Count != nrows or rng.Columns.Count != ncols:
            problems.append("%s：引用 %s 解析成 %dx%d，预期 %dx%d"
                            % (where, op["ref"], rng.Rows.Count, rng.Columns.Count, nrows, ncols))
            continue
        if op.get("expect_before") is not None:
            got = _com_matrix(rng.Value, nrows, ncols)
            want = V._flatten_matrix(op["expect_before"], nrows, ncols, where)
            for r in range(nrows):
                for c in range(ncols):
                    if _finite(want[r][c]) != _finite(got[r][c]):
                        problems.append("%s：%s!%s 改前原值不符（期望 %r，实际 %r）—— 可能错行错列，已中止"
                                        % (where, sheet, op["ref"], want[r][c], got[r][c]))
    return problems


def _apply_ops(wb, ops, recalc):
    """只对声明引用调用 Range；写公式的格**只重算它自己**（否则缓存值是旧的）。"""
    formula_ranges = []
    for i, op in enumerate(ops, 1):
        kind = op["kind"]
        sheet = op["sheet"]
        if kind == "add_sheet":
            ws = wb.Worksheets.Add(After=wb.Worksheets(wb.Worksheets.Count))
            ws.Name = sheet
            continue
        r1, c1, r2, c2, nrows, ncols = V.parse_ref(op["ref"])
        rng = wb.Worksheets(sheet).Range(op["ref"])
        if kind in CONTENT_KINDS:
            payload = op["value"] if kind == "value" else op["formula"]
            matrix = V._flatten_matrix(payload, nrows, ncols, "ops[%d]" % i)
            if op.get("as_text") and kind == "value":
                rng.NumberFormat = "@"
            if nrows == 1 and ncols == 1:
                if kind == "formula":
                    rng.Formula = matrix[0][0]
                else:
                    rng.Value = matrix[0][0]
            else:
                payload_tuple = tuple(tuple(row) for row in matrix)
                if kind == "formula":
                    rng.Formula = payload_tuple
                else:
                    rng.Value = payload_tuple
            if kind == "formula":
                formula_ranges.append((op, rng, nrows, ncols))
            if op.get("number_format") is not None and not op.get("as_text"):
                rng.NumberFormat = op["number_format"]
        elif kind == "number_format":
            rng.NumberFormat = op["value"]
        elif kind == "comment":
            text = op.get("value")
            rng.ClearComments()
            if text:
                rng.AddComment(text)
        else:
            raise ValueError("不受支持的 kind: %r" % kind)

    # 写进去的公式：只重算这几格（其余一律不动 ⇒ 别的缓存值原样）
    mismatches = []
    for op, rng, nrows, ncols in formula_ranges:
        try:
            rng.Calculate()
        except Exception as e:  # noqa: BLE001
            mismatches.append("%s!%s：本机 Excel 拒绝重算该格（%s）" % (op["sheet"], op["ref"], e))
        want = V._flatten_matrix(op["expect_cached"], nrows, ncols, "expect_cached")
        got = _com_matrix(rng.Value, nrows, ncols)
        for r in range(nrows):
            for c in range(ncols):
                if _finite(want[r][c]) != _finite(got[r][c]):
                    mismatches.append("%s!%s 的缓存值 %r ≠ expect_cached %r"
                                      % (op["sheet"], op["ref"], got[r][c], want[r][c]))
    if recalc:
        try:
            wb.Application.CalculateFull()
        except Exception:  # noqa: BLE001
            pass
    return mismatches


def _range_address(rng):
    """取 Range 的地址串。pywin32 下 `.Address` 可能是**属性**（直接给 str）也可能是方法（要吃参数）——
    实测（2026-10-10，Excel 16.0 动态 dispatch）它是属性；两种都认。"""
    a = getattr(rng, "Address", None)
    if a is None:
        return None
    if callable(a):
        try:
            return str(a(False, False))
        except Exception:  # noqa: BLE001
            try:
                return str(a())
            except Exception:  # noqa: BLE001
                return None
    return str(a)


def _dependents(wb, ops):
    """改动格被哪些公式引用（advisory）：零重算口径下这些公式的缓存值**不会**刷新。"""
    out = []
    for op in ops:
        if op["kind"] == "add_sheet":
            continue
        entry = {"touched": "%s!%s" % (op["sheet"], op["ref"]), "dependents": None}
        try:
            dep = wb.Worksheets(op["sheet"]).Range(op["ref"]).Dependents
            addr = _range_address(dep) if dep is not None else None
            entry["dependents"] = addr or "（无下游公式）"
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            # Excel 对"没有下游公式"的格会直接抛"未找到单元格。"—— 那是"无"，不是"查不到"
            if "未找到单元格" in msg or "No cells were found" in msg or "-2146827284" in msg:
                entry["dependents"] = "（无下游公式）"
            else:
                entry["dependents"] = "查不到（%s）" % msg[:120]
        out.append(entry)
    return out


# ── 主流程 ─────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="经 Excel COM 改表：只改目标 / 保真 / 保存并退出 Excel")
    ap.add_argument("--plan", required=True)
    ap.add_argument("--dry-run", action="store_true", help="只做预检与打开-关闭，不写不存")
    ap.add_argument("--no-restore", action="store_true", help="验收失败时不从备份恢复（默认恢复）")
    ap.add_argument("--recalc", action="store_true", help="显式声明允许重算（默认零重算，缓存值原样）")
    ap.add_argument("--json", dest="json_out", help="把结果 JSON 写到这里")
    ap.add_argument("--report", dest="verify_report", help="验收报告 JSON 落点（默认与计划同目录）")
    args = ap.parse_args()

    started = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    t0 = time.time()
    result = {"started_at": started, "plan": args.plan, "verdict": "unknown", "steps": [],
              "backup": None, "verify_report": None, "excel": {}, "errors": []}

    def finish(code):
        result["finished_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        result["elapsed_seconds"] = round(time.time() - t0, 1)
        result["exit_code"] = code
        if args.json_out:
            Path(args.json_out).write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
        return code

    # ── 计划
    try:
        plan, expect = load_and_check_plan(args.plan)
    except (ValueError, OSError, json.JSONDecodeError) as e:
        log("计划有问题，目标未动: %s" % e)
        result["errors"].append("plan: %s" % e)
        return finish(2)
    target = Path(plan["target_file"])
    recalc = bool(args.recalc or plan.get("recalc"))
    result["recalc"] = recalc
    result["change_set_id"] = plan.get("change_set_id")
    result["target_file"] = str(target)
    is_new = not target.exists()
    if is_new and not plan.get("new_file"):
        log("目标文件不存在，且计划里没有 new_file 声明 —— 拒绝顺手新建：%s" % target)
        result["errors"].append("target missing without new_file")
        return finish(2)
    if not is_new and not target.suffix.lower() in (".xlsx", ".xlsm"):
        log("目标不是 .xlsx/.xlsm：%s" % target)
        return finish(2)
    lock = target.parent / ("~$" + target.name)
    if lock.exists():
        log("目标像是正被 Excel 打开（存在锁文件 %s）—— 请先关掉那张表再改。" % lock.name)
        result["errors"].append("lockfile present")
        return finish(2)

    # ── 备份（字节级）：**就在保存之前**才做，前面任何一步中止都不碰目标文件
    backup = None

    def make_backup():
        nonlocal backup
        if is_new:
            return None
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = target.parent / ("%s.backup.%s%s" % (target.stem, stamp, target.suffix))
        shutil.copy2(target, backup)
        result["backup"] = str(backup)
        log("备份: %s" % backup.name)
        return backup

    # ── COM
    try:
        import pythoncom
        import win32com.client
    except ImportError as e:
        log("缺 pywin32（本工具靠 Excel COM 改表，缺它就无法保证批注/格式/缓存值）：pip install pywin32\n  %s" % e)
        result["errors"].append("pywin32 missing")
        return finish(2)

    others_before = _excel_pids()
    if others_before:
        log("注意：检测到你已开着 %d 个 Excel 进程（PID %s）—— 本工具用**独立实例**，绝不动它们。"
            % (len(others_before), ",".join(str(p) for p in sorted(others_before))))

    pythoncom.CoInitialize()
    app = None
    wb = None
    blank = None
    our_pid = None
    quit_ok = False
    aborted = None
    crash = None
    try:
        try:
            app = win32com.client.DispatchEx("Excel.Application")   # 独占实例：Quit 不会关掉你的 Excel
        except Exception as e:  # noqa: BLE001
            log("起不了 Excel COM 实例（本机装 Excel 了吗？）：%s" % e)
            result["errors"].append("excel com unavailable: %s" % e)
            return finish(2)

        app.Visible = False
        app.DisplayAlerts = False
        app.ScreenUpdating = False
        app.EnableEvents = False
        app.AskToUpdateLinks = False
        try:
            app.AutomationSecurity = MSO_AUTOMATION_SECURITY_FORCE_DISABLE   # .xlsm 宏：保留但不执行
        except Exception:  # noqa: BLE001
            pass
        # ★ 顺序有讲究：Application.Calculation 只有在**有工作簿打开时**才设得动，
        #   于是先起一张空白簿把"零重算"设好，**再**打开目标表 —— 否则目标表会在自动重算下被打开，
        #   那一刻缓存值就可能被刷新（这正是要避免的）。
        blank = app.Workbooks.Add()
        if not recalc:
            app.Calculation = XL_CALCULATION_MANUAL                          # 零重算
            try:
                app.CalculateBeforeSave = False                              # 保存也不重算 ⇒ 缓存值原样
            except Exception:  # noqa: BLE001
                log("警告：本机 Excel 不支持 CalculateBeforeSave —— 保存可能重算，验收会如实报出来")
        result["excel"] = {"others_before": sorted(others_before),
                           "instance": "DispatchEx(独占)", "visible": False,
                           "calculation": "manual(零重算)" if not recalc else "automatic(声明重算)",
                           "calculate_before_save": (not recalc)}

        if is_new:
            wb = blank                     # 新建表直接用这张空白簿
            blank = None
            sheets = (plan.get("new_file") or {}).get("sheets") or []
            if sheets:
                wb.Worksheets(1).Name = sheets[0]
                for name in sheets[1:]:
                    wb.Worksheets.Add(After=wb.Worksheets(wb.Worksheets.Count)).Name = name
            result["steps"].append({"step": "new_workbook", "sheets": sheets})
        else:
            try:
                wb = app.Workbooks.Open(Filename=str(target), UpdateLinks=0, ReadOnly=False,
                                        IgnoreReadOnlyRecommended=True, AddToMru=False)
            except Exception:  # noqa: BLE001 —— 个别 pywin32/Excel 组合不吃具名参数
                wb = app.Workbooks.Open(str(target), 0, False, None, None, None, True, None, None,
                                        None, None, None, False)
            try:
                blank.Close(SaveChanges=False)
            except Exception:  # noqa: BLE001
                pass
            blank = None
            if wb.ReadOnly:
                log("工作簿以只读方式打开了（文件被占用或权限不足）—— 拒绝写入。")
                result["errors"].append("workbook is read-only")
                return finish(2)
            result["steps"].append({"step": "open", "read_only": False})

        # 本实例的 PID：先问工作簿窗口（同进程），失败则用"新出现的 EXCEL.EXE"兜底
        our_pid = _pid_of_hwnd(_workbook_hwnd(wb)) or _new_excel_pid(others_before)
        result["excel"]["our_pid"] = our_pid

        problems = _preflight(wb, plan["ops"])
        result["preflight"] = problems
        if problems:
            log("预检未通过，目标未动：")
            for p in problems:
                log("  - " + p)
            result["errors"].extend(problems)
            try:
                wb.Close(SaveChanges=False)
            except Exception:  # noqa: BLE001
                pass
            return finish(2)
        log("预检通过：%d 条 op；声明区域 %d 格" % (len(plan["ops"]), len(expect["touched"])))

        if args.dry_run:
            log("--dry-run：不写、不存。")
            result["verdict"] = "dry_run"
            result["steps"].append({"step": "dry_run"})
        else:
            mismatches = _apply_ops(wb, plan["ops"], recalc)
            result["steps"].append({"step": "apply_ops", "count": len(plan["ops"])})
            result["formula_cache_mismatch"] = mismatches
            downs = _dependents(wb, plan["ops"])
            result["downstream_formulas"] = downs
            known = [d for d in downs if d["dependents"]
                     and not str(d["dependents"]).startswith(("查不到", "（无下游公式）"))]
            if known:
                log("提醒（零重算口径）：你改的格被这些公式引用，它们的缓存值**没有**刷新 ——")
                for d in known:
                    log("  - %s 被 %s 引用" % (d["touched"], d["dependents"]))
                log("  要一起刷新就用 --recalc；写进去的公式格不在此列（那几格已单独重算）。")
            if mismatches:
                aborted = ["公式格缓存值对不上 expect_cached（或本机 Excel 拒绝重算）"] + mismatches
                for m in mismatches:
                    log("  - %s" % m)
                log("⇒ **不保存**：目标文件一个字节都没动（Excel 只在保存时才落盘）。")
            else:
                make_backup()
                if is_new:
                    fmt = XL_OPENXML_WORKBOOK_MACRO if target.suffix.lower() == ".xlsm" else XL_OPENXML_WORKBOOK
                    wb.SaveAs(Filename=str(target), FileFormat=fmt)
                    result["steps"].append({"step": "save_as", "file_format": fmt})
                else:
                    wb.Save()
                    result["steps"].append({"step": "save"})
                log("已写入并保存：%s" % target.name)

    except Exception as e:  # noqa: BLE001 —— COM 侧任何意外都如实报出来，不把 traceback 丢给策划
        crash = "%s: %s" % (type(e).__name__, e)
        log("写入过程异常（尚未保存的步骤不会落盘）：%s" % crash)
        result["errors"].append("com: %s" % crash)
        result["verdict"] = "error"
    finally:
        # ── 彻底退出：Close → Quit → 释放 COM → 轮询 PID 消失
        try:
            if blank is not None:
                try:
                    blank.Close(SaveChanges=False)
                except Exception:  # noqa: BLE001
                    pass
            if wb is not None:
                try:
                    wb.Close(SaveChanges=False)
                except Exception:  # noqa: BLE001
                    pass
            if app is not None:
                try:
                    app.Quit()
                except Exception:  # noqa: BLE001
                    pass
        finally:
            blank = None
            wb = None
            app = None
            gc.collect()
            try:
                pythoncom.CoUninitialize()
            except Exception:  # noqa: BLE001
                pass
        deadline = time.time() + 20
        while our_pid and _pid_alive(our_pid) and time.time() < deadline:
            time.sleep(0.4)
        if our_pid and _pid_alive(our_pid):
            log("本实例 Excel(PID %d) 20 秒内没退 —— 只杀它自己（不动你别处的 Excel）" % our_pid)
            subprocess.run(["taskkill", "/PID", str(our_pid), "/F"], capture_output=True, text=True)
            time.sleep(0.5)
        still = _excel_pids()
        leftovers = still - others_before
        if our_pid:
            quit_ok = our_pid not in still
            extra = leftovers - {our_pid}
        else:
            # 没认出自己那个 PID 时，改为"有没有多出来的 EXCEL.EXE"（不认得就不敢乱杀）
            quit_ok = not leftovers
            extra = leftovers
        result["excel"].update({
            "quit_confirmed": quit_ok,
            "pids_after": sorted(still),
            "leftover_pids": sorted(leftovers),
            # 你原有的那些 Excel 进程一个都没少 ⇒ 本工具只碰了自己那一个实例
            "others_untouched": others_before.issubset(still),
        })
        log("Excel 退出核对：本实例 PID %s %s；当前 EXCEL.EXE = %s（你原有的 %s 未受影响）"
            % (our_pid, "已退出" if quit_ok else "**未确认退出**",
               sorted(still) or "无", sorted(others_before) or "无"))
        if not quit_ok:
            log("⚠ 还有 EXCEL.EXE 没退：%s —— 没确认是你自己开的话，请手动关掉，别在它占用表时继续改表。"
                % (sorted(extra) or sorted(leftovers)))

    if not quit_ok:
        log("Excel 没确认退出 ⇒ 状态 BLOCKED（表可能仍被占用，别继续下一步）")
        result["verdict"] = "blocked_excel_alive"
        result["errors"].append("excel instance still alive")
        return finish(3)

    if aborted:
        result["verdict"] = "aborted_before_save"
        result["errors"].extend(aborted)
        log("已中止，未保存：%s（目标文件保持原样，备份也没产生）" % aborted[0])
        return finish(2)

    if crash:
        return finish(3)

    if args.dry_run:
        return finish(0)

    report_path = Path(args.verify_report) if args.verify_report else \
        (Path(args.plan).parent / ("%s_验收报告.json" % target.stem))
    verdict = "fail"
    verify_error = None
    try:
        rep = V.check_new_file(target, args.plan, 40) if is_new else V.run(backup, target, args.plan, recalc, 40)
        verdict = rep["verdict"]
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
        for line in V.format_checks(rep["checks"], 40):
            log(line)
        for name, lines in (rep.get("diffs") or {}).items():
            if lines:
                log("  差异 %s（前 10 条）:" % name)
                for line in lines[:10]:
                    log("    - %s" % line)
    except Exception as e:  # noqa: BLE001 —— 验收器自己炸了也是 fail，不许静默
        import traceback
        verdict = "fail"
        verify_error = "%s: %s" % (type(e).__name__, e)
        log("验收器异常（按 fail 处理）: %s" % verify_error)
        log(traceback.format_exc())
    result["verify_report"] = str(report_path)
    log("验收报告: %s" % report_path)

    if verdict == "pass":
        result["verdict"] = "pass"
        log("✓ 验收通过：只改了声明区域，批注/公式/格式/缓存值保真，Excel 已退出")
        return finish(0)

    # ── 失败：恢复 / 留证
    log("✗ 验收未通过 —— 本次改动**不成立**")
    if verify_error:
        log("  验收器异常: %s" % verify_error)
        result["errors"].append("verifier: %s" % verify_error)
    if args.no_restore:
        result["verdict"] = "fail_no_restore"
        result["errors"].append("verification failed; --no-restore 生效，目标保持改动后状态")
        log("  --no-restore：目标保持改动后状态（自行决定回滚）")
        return finish(1)
    if is_new:
        art = target.parent / ("%s.failed.%s%s" % (target.stem, datetime.now().strftime("%Y%m%d-%H%M%S"), target.suffix))
        shutil.move(str(target), str(art))
        result["failed_artifact"] = str(art)
        log("  新文件验收不过，保留为: %s（目标位置已清空）" % art.name)
    else:
        shutil.copy2(backup, target)
        result["restored_from"] = str(backup)
        log("  已从备份恢复目标文件: %s" % backup.name)
    result["verdict"] = "fail_restored"
    return finish(1)


if __name__ == "__main__":
    sys.exit(main())
