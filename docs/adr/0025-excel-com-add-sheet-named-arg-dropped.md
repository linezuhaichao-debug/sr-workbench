# 0025 · 引擎 add_sheet 的命名参数被丢弃：新表页插到活动表之前，INDEX 会掉位

- 日期：2026-10-16
- 状态：**已接受**（本轮按规避手法执行：建页走同口径 COM 位置参数；**引擎补丁未做，待用户决定**）
- 相关：`skills/sr-config/tools/excel_com_edit.py` §`_apply_ops` 的 `add_sheet` 分支（`wb.Worksheets.Add(After=wb.Worksheets(wb.Worksheets.Count))`）
  · `skills/sr-askme/references/new_table.md`（「INDEX 按项目惯例排第一」+ 建表判据 A6「表页顺序 == 声明顺序」；该文已记录同一坑，写作"被当成 Before"）
  · 功能侧指针：`features\联盟讨伐\decisions\决策记录.md` 2026-10-16 两条（工作簿迁移 / 配置侧收尾）· `gdd\CS-20261016-002.yaml`

## 背景

给新建工作簿 `B023-RPG战斗引擎聚合表.xlsx` 补「配置说明」页时命中：该 op 调用的 `Worksheets.Add(After=…)`
在本机**中文版 Excel + pywin32 动态派发**下**命名参数不生效** —— 等价于无参 `Add()`，而 Excel 默认把新页插到**活动表之前**。

同一台机、同一天实测三次（临时副本，不进仓库）：

| 场景 | 调用 | 结果（表页顺序） |
| --- | --- | --- |
| B023 原状（2 页，活动表 = `INDEX`） | `Add(After=Worksheets(Count))` | `['配置说明', 'INDEX', '联盟boss强化表']` —— **INDEX 掉到第 2 位** |
| 3 页副本（活动表 = 最后新建的那页） | `Add(After=Worksheets(Count))` | 新页插到**活动表之前**（不是末位） |
| 2 页副本 | `Add(None, Worksheets(Count))`（位置参数） | 落在**末位** ✓（`Move(None, Worksheets(Count))` 同理） |

危害：`INDEX` 是导出 / 字段映射的入口页，项目惯例要求它排第一；`new_table.md` 的建表判据 A6 也是
「表页顺序 == 计划声明顺序，INDEX 第一」。用 `add_sheet` 建页会让索引页掉位，**而引擎自己的验收器看不出来** ——
`verify_table_edit.py` 的 V1 会把本次新增页从 `after.order` 中排除再比，顺序对了没有它不判。

## 决定与规避

1. **建页不走引擎 op**：用同口径 COM 步骤（`.tmp\sr-config\联盟讨伐\b023_add_sheet_com.py`）
   以**位置参数** `Worksheets.Add(None, Worksheets(Count))` 建**一个空页**、命名、`Save`、`Quit`；
   建页前字节备份、建页后**断言** `after_names[0] == "INDEX"` 且新页在末位，不符**不保存**。
2. **内容仍由引擎写**：`CS-20261016-002.plan.json`（12 格）走 `excel_com_edit.py`，
   零重算、保真、退出核对齐全。
3. **两段都验收**：建页事务用引擎验收器单跑（`--before <建页前备份> --after <文件> --plan <只含 add_sheet 的计划>`），
   内容事务由引擎自动验收。两条结论都写进 `gdd\CS-20261016-002_读回验收报告.md`。

## 纪律

- **给既有工作簿加页前先问两件事**：当前的**活动表是谁**（COM `ActiveSheet.Name`，或 `xl/workbook.xml` 的 `activeTab`）、**目标位次是第几**。不要假设 `After=` 生效。
- **顺序类判据要单独断言**：引擎验收器不覆盖"新增页的相对位置"，必须脚本断言（或读回 `sheetnames` 比对）。
- **`add_sheet` 的历史版本名派生自改前副本**（`<备份名>_<日期>_<序号>`，本轮实得
  `B023-RPG战斗引擎聚合表.backup.20261016-183710_20261016_1.xlsx`）—— 尾部满足历史版本识别判据、不进配置扫描，
  但名字里带 `.backup.<时间戳>`，读起来像备份；引用时要说清它是历史版本而非写入备份。

## 影响

- **本轮实例**：B023 表页顺序 = `INDEX → 联盟boss强化表 → 配置说明`（与 A079 形状一致：INDEX 第一、说明页末位），
  两段事务验收均 PASS；A079 为纯单元格写入，不受本缺陷影响。
- **风险未消除**：只要有人用 `excel_com_edit.py` 的 `add_sheet` op，就会再命中一次。
- **建议补丁（未做，待用户决定）**：
  ① `_apply_ops` 的 add_sheet 分支改 `wb.Worksheets.Add(None, wb.Worksheets(wb.Worksheets.Count))`；
  ② 写入后断言 `INDEX` 仍在首位，不符则 fail-closed（不保存）；
  ③ `new_table.md`「新表产出」里的位置参数提示与实际代码对齐（现在代码写的是命名参数）。
