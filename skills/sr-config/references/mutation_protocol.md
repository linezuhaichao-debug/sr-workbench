# 最小事务写入与配置数据验收（改表一律经 **Excel COM**）

> **用户口径（2026-10-10，硬规则）**：改策划配置表**必须调用 Excel COM**（本机 Excel 自己打开-改-存-退）。
> 三条硬要求，缺一条都算没改：
> ① **只改我要的单元格/区域**（别的格子一个都不许动）；
> ② **批注、公式、格式、缓存值全部保留**；
> ③ **改完保存并彻底退出 Excel**。
>
> `openpyxl` 在本 skill 里**只能读**（探查 / 读回 / 比对），**禁止用来写表**。

## 为什么必须这样（踩过的坑，别再踩）

用 openpyxl 写表 = 绕过 Excel 直接改 XML，实测会：丢单元格批注、丢条件格式与主题色/列宽区间、
**公式的缓存值根本不写**（游戏与导出读的就是缓存值，读出来是空 ⇒ 线上数据错）。
让 Excel 自己存则这四类天然保留。代价是慢（每表一次开/存/退；实测 23 表 14091 公式的重表约 10 秒）且要求本机装 Excel。

## 附带工具（本 skill 唯一的写入通道）

| 工具 | 作用 |
| --- | --- |
| `tools/excel_com_edit.py` | **写入引擎**：独占 Excel 实例 → 预检 → 只写声明区域 → 备份 → 保存 → 彻底退出 → 自动验收；不过则从备份恢复 |
| `tools/verify_table_edit.py` | **验收引擎**（只读，不写任何文件）：比对「改前备份 vs 改后文件」，判定只改目标 + 保真 + 缓存值 |
| `tools/probe_workbook.py` | 探查（只读）：表头、样本、**全部批注**、结构特性 |
| `tools/selftest_excel_com.py` | **自检**（不碰你的表，全程临时目录）：新建表 → 改一格 → 越界检测 → 原值/缓存值守卫 → dry-run → Excel 彻底退出。8/8 通过才算工具链可用 |

依赖：本机 Excel + `pywin32`（缺则 `pip install pywin32`）。想**不写盘先试**：加 `--dry-run`。
怀疑工具链坏了 / 换了机器 / 升级过 Office：先跑 `python tools/selftest_excel_com.py`。

## 写入计划 plan.json（每条 op 带 change_id，可逐条追到 change set）

```json
{
  "schema_version": 1,
  "change_set_id": "CS-20261010-001",
  "target_file": "D:\\...\\A016-联盟等级.xlsx",
  "recalc": false,
  "new_file": {"sheets": ["联盟里程碑"]},
  "ops": [
    {"change_id": "CHG-001", "kind": "value",        "sheet": "联盟等级", "ref": "D11",
     "value": 12, "expect_before": 5},
    {"change_id": "CHG-002", "kind": "formula",       "sheet": "联盟等级", "ref": "E11",
     "formula": "=SUM(A11:C11)", "expect_cached": 36},
    {"change_id": "CHG-003", "kind": "value",         "sheet": "联盟等级", "ref": "F11",
     "value": "0012", "as_text": true},
    {"change_id": "CHG-004", "kind": "comment",       "sheet": "联盟等级", "ref": "B1",
     "value": "取值边界 1..99；空=不启用"},
    {"change_id": "CHG-005", "kind": "number_format", "sheet": "联盟等级", "ref": "D6:D20",
     "value": "0.00"},
    {"change_id": "CHG-006", "kind": "add_sheet",     "sheet": "联盟里程碑"}
  ]
}
```

- `kind`：`value` · `formula` · `comment` · `number_format` · `add_sheet`。
- `ref`：`A1` 或 `A1:B2`；`value`/`formula` 可给二维矩阵，形状必须与区域一致（逐格比对预期）。
- `expect_before`（**强烈建议每条都写**）：改前原值逐格核对，防止错行错列 —— 实测救过一次把「市政厅」覆盖掉的手误。
- `expect_cached`（`kind=formula` **必填**）：这一格算出来应当等于什么。写公式只重算该格，对不上就**不保存**。
- `as_text: true`：按文本写（防 `"0012"` 被 Excel 吃成数字 12）；它等价于声明 `number_format: "@"`。
- `comment.value = null`：删除该格批注。
- 不要「顺手新建」：目标文件不存在时必须在 `new_file` 里显式声明要建哪些表。

## 写入流程

1. **冻结 change set** 并生成 `plan.json`（与 change set 同目录落 `<功能目录>\gdd\`）。
2. 目标表若正被 Excel 打开（同目录有 `~$<表名>` 锁文件、或打开后是只读）⇒ **拒写**，请用户先关掉那张表。
3. `python tools/excel_com_edit.py --plan plan.json`。引擎按这个顺序做：
   - 起**独占** Excel 实例（`DispatchEx`；**不挂到用户已开的 Excel 上**，宏安全=禁止执行，`AskToUpdateLinks=False`，`UpdateLinks=0`）；
   - **先关自动重算**（`Calculation=manual` + `CalculateBeforeSave=False`）**再**打开目标表 —— 顺序不能反，
     否则开表那一刻就可能被重算，缓存值就变了；
   - **预检**：工作表存在、引用形状、`expect_before` 逐格核对；任一不符 ⇒ 中止（此时**目标文件一个字节都没动**）；
   - **只对声明引用**调用 `Range` 写入；写公式的格只重算它自己，`expect_cached` 不符 ⇒ **不保存**；
   - 备份（同目录 `<表名>.backup.<时间戳>`）→ `Save` → `Close` → `Quit` → 释放 COM → 轮询**本实例 PID 消失**
     （20 秒没退只杀**它自己**那个 PID；用户自己开着的 Excel 一个都不碰）；
   - 自动跑验收（第 4 步）。
4. **验收**（`verify_table_edit.py`，只读）：见下节判据。验收器异常也按 `fail` 计（不许静默）。
5. 验收不过 ⇒ 引擎**从备份恢复**目标文件（新表保留为 `<表名>.failed.<时间戳>` 留证），状态 `BLOCKED`，不得宣称完成。
6. 读回验收报告（人看的 md）逐条照 [`tools/readback_report_template.md`](../tools/readback_report_template.md) 填，
   并把引擎产出的 `*_验收报告.json` 一并交出（那是机器可核对的原始证据）。
7. 落点：change set、`plan.json`、验收报告（json + md）都在 `<功能目录>\gdd\`；**既有表在 `config_root` 就地更新**。

新建运行时表走**同一个引擎**：`new_file.sheets` 声明要建的表 + 表头/批注/公式 op；验收换成 N1–N4（见下）。

## 验收判据（引擎自动跑；全部 pass 才算 pass）

| # | 判据 | 说明 |
| --- | --- | --- |
| V1 | **结构一致** | 工作表集合/顺序/可见性 · 合并区 · **每列的有效列宽/列隐藏** · 每行的行高/隐藏 · 冻结窗格 · 自动筛选 · 工作表保护 · 定义名 · 表对象 · 数据验证 · 条件格式 · 超链接 · 页面设置 |
| V2 | **只改目标** | 全表「公式串 + 值」差异集合 **⊆ 声明区域**，且声明区域内逐格等于计划预期；声明区域外零差异 |
| V3 | **缓存值保留** | 未声明的公式格：缓存值改后仍在、逐格不变（改前就没有缓存值的不算丢） |
| V3b | **写入公式的格** | 缓存值必须等于 `expect_cached`（游戏读的就是它） |
| V4 | **批注一致** | 全表批注逐格相同，除计划声明的变更外。批注的 `<作者>:` 前缀会被剥掉再比 |
| V5 | **格式一致** | 逐格字体/填充/边框/对齐/保护/数字格式相同（数字格式仅声明的可变） |
| V6 | **VBA 保真** | `.xlsm` 的 `vbaProject.bin` **还在**且模块/流名集合一致 |
| V7 | **未覆盖部件** | 图表/图片/切片器等如实列出 |

### 已知归一化：报 WARN，不是红灯（别当失败处理，但要如实写进报告）

实测（2026-10-10，A001-城建表 23 表 / A020 / A030）：

- **V1b**：Excel 会把"没写 `<pageSetup>`"的表**显式写成默认值**（`portrait` / A4）—— 有效打印设置没变。
- **V5b**：Excel 会**重算主题色色阶 tint 的尾数**（`0.599993896298105` → `…048`，有的差到 3e-5）与
  **字体 `family`/`charset`**（`None→3.0`、`134→None`）—— 可见属性逐项一致，渲染不可见。
  判据取"可见属性 + tint 3 位小数"，这类差异单列 V5b。
- **V6**：Excel 保存会**重新序列化** `vbaProject.bin`（同大小、同流名、字节序不同）—— 所以不逐字节比。
- **V7**：列宽区间会被 Excel 按改动边界拆开（`min=5,max=16384` → `5..5` + `6..16384`）—— 按"每列有效值"比，不算差异。

这些是"Excel 自己存"的固有痕迹（任何人在 Excel 里手改并存盘也一样），**不是本次改动造成的格式损失**；
报告里要原样列出 WARN 与条数，不要抹掉。

## 重算口径（默认零重算）

- **默认**：不重算。除你声明的格子外，任何单元格的公式串 + 缓存值 + 格式都不变。
- 引擎会把**改动格被哪些公式引用**列出来提醒：零重算下这些"下游公式"的缓存值**不会**刷新。
  数据上要一起刷，就在计划里写 `"recalc": true` 或加 `--recalc`（此时验收改为"如实列出缓存值变化的公式格"，不判 fail）。
- 写公式的格不受此限：**只重算它自己**（`Range.Calculate`），并必须用 `expect_cached` 明确期望值。

## 禁止事项

- ✗ 用 openpyxl / pandas / 直接改 XML 写表（会丢批注、格式、缓存值）。
- ✗ 全表重算（`CalculateFull`）当默认行为 —— 那是"缓存值全变了"，与口径相反。
- ✗ 用 `Workbooks.Open` 挂到用户已开的 Excel 实例上（`Quit` 会把用户的表关掉）。
- ✗ 杀掉不是本引擎启动的 `EXCEL.EXE`。
- ✗ 验收没过就宣称改完；也**不许**把 V1b/V5b/V6/V7 的 WARN 当成"全部通过"。
- ✗ 目标表被占用（锁文件/只读）时"先试一下"。
