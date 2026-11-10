---
name: sr-config
description: 将游戏策划规则转换为可追溯的配置数据契约——从成稿规则派生字段与记录，新建运行时表、增删改字段与记录、同步 INDEX 与配置说明/字段批注、生成新表测试数据、读回验收。**改表一律经 Excel COM**（只改指定单元格/区域 · 批注/公式/格式/缓存值保留 · 保存后彻底退出 Excel · openpyxl 只读不写）。当用户说"把这条规则落成配置表"、"给这张表加个字段"、"建一张新配置表"、"配置读回验收"时使用（配英雄技能表走 /skill-hero-config —— 那是**配套技能、不属于 sr 系列**；本 skill 管其余通用运行时表）。
---

# 策划配置数据契约（sr-config）

将用户确认的策划规则落实为可追溯、可确认、可读回验收的配置数据变更。

本 Skill 只验收最终配置数据：运行时表与五行表头、字段与记录、主键与索引、枚举、单位、codec、引用、`INDEX`、配置说明、字段批注和新表测试数据。

**改表必须调用 Excel COM（硬规则，用户口径 2026-10-10）**：写入一律经 `tools/excel_com_edit.py`（本机 Excel 自己打开-改-存-退），openpyxl 只能用于**读**（探查 / 读回 / 比对），**禁止写表**。三条硬要求：① 只改计划里声明的单元格/区域，别的格子一个都不动；② 批注、公式、格式、缓存值全部保留；③ 改完保存并**彻底退出 Excel**。不满足就不算改完（详见 [最小事务写入与验收](references/mutation_protocol.md)）。

## 按需读取

- 建立规则、字段 schema、codec 或 `INDEX` 映射时，完整读取 [规则与 schema](references/rules_and_schema.md)。
- 生成 change set、风险或确认门时，完整读取 [change set 与确认](references/change_set.md)。
- 新建任何运行时表时，完整读取 [新表与配置测试数据](references/new_table.md)。
- 实际写入工作簿时，完整读取 [最小事务写入与验收](references/mutation_protocol.md)——写入计划格式、Excel COM 流程、验收判据（V1–V7，外加追加记录专用的 V1c / V5c）、已知归一化与重算口径都在那里。
- TimeMachine 项目任务读取 [TimeMachine profile](profiles/timemachine.md)；`config_root` 取自 `%USERPROFILE%\.dsh\sr-workbench\config.local.json` 的 `config_root` 字段（首次使用由 sr-askme 引导生成，并同步写成本目录 `profiles/timemachine.local.yaml`，含私有路径不入仓库；手工配置参照 `timemachine.local.example.yaml`）。**以 `config.local.json` 为准**，yaml 是该值的本机副本；两者不一致时按 `config.local.json` 回写 yaml。
- 涉及功能设计时读 `../sr-askme/references/gdd-pipeline.md`（成稿 / 配置表 / 定稿三份产出契约）：**字段与记录从 `sr-gdd-human` 成稿的规则派生**（规则 → 字段），成稿的规则是配置表的唯一设计依据。`<SR_WORKSPACE>`（定稿所在）同样取自 `%USERPROFILE%\.dsh\sr-workbench\config.local.json` 的 `sr_workspace` 字段。
- 决策记录：**只要定下了一件事就记**（选表 / 定字段 / 命名 / 改记录 / 放弃某个方案 / 更正之前的判断…，不只确认门那一次）。落点与格式见 `../sr-askme/references/decision-recording.md` —— 追加进**本功能**的 `decisions\决策记录.md`（一个功能只有一个决策文件）。
- 历史版本：**不用手跑** —— 改表的"改前那一版"由写入引擎在**验收通过之后**自动留成 `<原名>_<YYYYMMDD>_<序号>.<ext>`，落 `plan.json` 的 `history_dir`（既有表指向该功能的 `gdd\`）。口径见 `../sr-askme/references/version-history.md`。

## 附带工具

- [tools/probe_workbook.py](tools/probe_workbook.py)：工作簿标准探查（**只读**）。凡需要读取既有工作簿结构（表头、样本、`INDEX`、批注、结构特性），一律运行该脚本而不是临时手写 openpyxl 代码——脚本默认输出**全部单元格批注**，批注是项目字段契约（枚举含义、codec 规则、取值边界）的权威载体，只读 `cell.value` 会漏读契约；对零批注的运行时表它会显式告警。
- [tools/excel_com_edit.py](tools/excel_com_edit.py)：**唯一写入通道**——经 Excel COM 改表：独占实例、只写声明区域、批注/公式/格式/缓存值保真、写公式只重算该格、保存后彻底退出并核对本实例 PID 消失；预检不过或缓存值对不上就**不保存**（目标文件一个字节都没动），验收不过自动从备份恢复。用法见脚本头部注释；先跑 `--dry-run` 可以不写盘试一遍。
- [tools/verify_table_edit.py](tools/verify_table_edit.py)：**只改目标 + 保真**验收（只读，不写任何文件）。比对「改前备份 vs 改后文件」：结构 / 只改声明区域 / 缓存值 / 批注 / 格式 / VBA / 未覆盖部件。写入引擎会自动调用它，也可以单独对任一对文件跑。
- [tools/selftest_excel_com.py](tools/selftest_excel_com.py)：工具链自检（**不碰你的配置表**，全程在临时目录里）。一条命令跑完：新建表 → 改一格 → 越界检测 → 原值守卫 → 缓存值守卫 → dry-run → **追加记录（V1c/V5c 正例 + V1c/V5 两条负例）** → Excel 是否彻底退出。换机器、升级 Office、或怀疑工具坏了时先跑它；**11/11 通过**才算工具链可用。
- [tools/check_pattern_fields.py](tools/check_pattern_fields.py)：项目 profile「已验证模式」的字段级校验。建表/写字段前先跑它——全部通过则模式直接采用，有字段缺失则降级 `candidate` 并登记 `profile_conflict`。它取代对来源工作簿的哈希校验（配置表是活文档，以字段存在性为验证依据）。
- [tools/readback_report_template.md](tools/readback_report_template.md)：读回验收报告模板。验收报告必须逐条对照模板必达项填写 `pass|fail|not_applicable`，**禁止自拟另一套"全部通过"式清单替代模板**——`pass` 总数不能掩盖任何必达项缺失。

## 状态

- `DRAFT`：仍在收集事实、设计、等待确认或尚未写入。
- `PASS`：冻结的 change set 已写入，最终目标中的配置数据全部验收通过。
- `BLOCKED`：存在阻断项、写入失败或验收失败，目标文件保持写入前状态或已恢复。

`blocking_items` 必须清空后才能写入。`deferred_items` 可以保留，但必须排除在本次写入集合之外，且与写入项不存在依赖。只有 `PASS` 可以宣称任务完成。

## 1. 确定任务范围

选择一个或多个 `task_branches`：

- `create_workbook`：新建工作簿或在既有工作簿中新建运行时表；
- `schema_change`：增加、修改、移动或删除字段及其契约；
- `record_change`：按已确认主键增加、修改或删除记录。

记录目标文件、目标工作表、客户端/服务端范围、输入来源、预期交付物和明确排除项。用户只要求字段变更时，不扩展到记录变更。

当任务需要既有表证据时，按以下顺序确定 `config_root`：

1. 使用用户本次明确指定的目录；
2. 否则取 `%USERPROFILE%\.dsh\sr-workbench\config.local.json` 的 `config_root`（与 `profiles/timemachine.local.yaml` 同值；两者不一致时以 `config.local.json` 为准，并回写 yaml）；
3. 路径缺失、失效或不含 `.xlsx/.xlsm` 时询问用户，确认后同时更新 `config.local.json` 与 `timemachine.local.yaml`。

新建运行时表必须有有效 `config_root`，用于取得**真实引用 ID**（引用 ID 必须来自配置目录里已存在的记录）。

**新表的产出位置是 `<功能目录>\gdd\<表名>.xlsx`，不写进 `config_root`** —— 交付时明说「这张表还没进配置目录，需要你手动放过去」。落点表见 `../sr-askme/references/gdd-pipeline.md`（配置产物的落点）。仅整理规则或输出候选契约时可以没有目录，证据不足的内容保持候选或进入阻断项。

完成判据：每项用户意图均已归入分支，目标、非目标和必要的 `config_root` 均明确。

## 2. 建立证据与配置契约

证据范围是用户输入、用户提供的文档、目标工作簿、已确认 `config_root` 和用户明确要求读取的其他路径。代码消费方只有在用户明确提供或要求检查时才进入证据范围。

执行正向证据门：

1. 用户明确确认定义目标契约；
2. 当前目标工作簿定义变更前事实；
3. 用户提供的策划文档定义目标需求；
4. 项目 profile 只提供候选格式；按 profile 的字段级校验（`tools/check_pattern_fields.py`）通过时可作为已验证参考，字段缺失/改名时降级为 `candidate` 并登记 `profile_conflict`；
5. 无法解释且影响本次写入的冲突进入 `blocking_items`。

按照 [规则与 schema](references/rules_and_schema.md) 建立规则台账、字段 schema、结构化 codec、引用、约束和 `INDEX` 映射。每条规则至少关联一个契约目标，允许一条规则影响多个目标。规则来源以 `sr-gdd-human` 成稿 §4 为准：**从规则派生字段**，规则没写清或两条规则派生出互相冲突的字段时进 `blocking_items`（或回成稿澄清），不自行发明配置项。

探查既有工作簿时必须读取单元格批注（`cell.comment`），优先运行附带工具 `tools/probe_workbook.py`；批注中的枚举含义、格式与边界规则按来源类型 `existing_comment` 登记进规则台账，不得只读单元格值就下契约结论。

完成判据：所有输入规则均有来源、证据状态、处理状态和目标；所有纳入写入的配置项均能追溯到规则。

## 3. 生成草案并通过确认门

按照 [change set 与确认](references/change_set.md) 生成候选配置契约、配置说明、字段批注、change set、风险、`blocking_items` 和 `deferred_items`。每项写入使用稳定 `change_id`，审批绑定具体 change 及其哈希；change 内容变化时，对应旧审批失效。

需要明确确认的内容包括中高风险变更、新建运行时表契约，以及主键、索引、codec、引用和输出映射。低风险的非语义说明、批注或格式变更可以自动确认。

完成判据：写入集合已经冻结，`blocking_items` 为空，所有必要审批覆盖当前 change 哈希；其余事项明确排除为 `deferred_items`。

## 4. 为新运行时表生成测试数据

只要任务新建运行时表，就必须按 [新表与配置测试数据](references/new_table.md) 生成测试记录；既有表的字段或记录变更不自动补测试数据。

测试数据写入新表第 6 行起的运行时数据区并进入正常导出链路，用于程序自测和联调，不代表最终正式数值。它必须写入 change set 并标记 `fixture: true`。符合已确认 schema 的测试数据无需逐行再次确认；若测试数据要求改变 schema，则返回确认门。

完成判据：每张新增运行时表至少有一条合法测试记录，真实引用、唯一键和声明的 `fixture_coverage` 全部可验证。

## 5. 写入与读回

**产物落点**：change set（`CS-*.yaml`）与读回验收报告（`*_读回验收报告.md`）写在 **`<功能目录>\gdd\`**（不再写 `analysis\`）；新建的表也落那里；既有表在 `config_root` **就地更新**。

**产物历史版本**：改表**之前**的那一版会被留成历史版本（`<原名>_<YYYYMMDD>_<序号>.<ext>`，如 `A079-联盟讨伐_20261012_1.xlsx`）—— 为此 `plan.json` 要带 `history_dir`，**既有表指向该功能的 `gdd\`**。落点绝不放配置目录（那里多出来的工作簿会进扫描视野）。口径与命令见 [`../sr-askme/references/version-history.md`](../sr-askme/references/version-history.md)。

实际写入遵循 [最小事务写入与验收](references/mutation_protocol.md)：**改表一律经 Excel COM**（`tools/excel_com_edit.py`；openpyxl 禁止写表）。顺序是：冻结 change set → 生成写入计划 `plan.json`（每条 op 带 `change_id`、引用与本计划改动前的原值 `expect_before`）→ 引擎独占实例打开目标表、**只对声明引用写入**、写公式的格只重算它自己 → 备份 → 保存 → **彻底退出 Excel 并核对本实例 PID 消失** → 自动跑 `tools/verify_table_edit.py` 验收 → **验收通过后留一份产物历史版本**。验收不过就**从备份恢复**（新表保留为 `.failed.`）并置 `BLOCKED`，不得宣称完成。

三条硬要求必须逐条落到报告里：① 只改声明的单元格/区域（V2：全表差异集合 ⊆ 声明区域）；② 批注、公式、格式、缓存值全部保留（V3/V3b/V4/V5，`--recalc` 时缓存值变化必须逐格列出）；③ 保存并彻底退出 Excel（引擎退出核对：本实例 PID 消失 + 用户原有的 Excel 进程未受影响）。Excel 保存固有的归一化痕迹（打印设置默认值、色阶尾数、VBA 重新序列化）由 V1b/V5b/V6/V7 如实报 WARN；**追加记录**（`record_change`）另有两类 WARN —— **V1c**（行/列增长只在声明区域内）与 **V5c**（声明写入的空白格被 Excel 补默认样式）—— 同样要如实列条数，**不许当"全部通过"**，也不许抹掉。

配置目录扫描排除名称包含 `.backup.`、`.tmp.`、`.failed.` 的工作簿，以及**产物历史版本**（名字尾部是 `_<8 位日期>_<序号>`，如 `A079-联盟讨伐_20261012_1.xlsx`）；这些文件不能成为配置模式、引用或 `INDEX` 的证据来源。

验收报告必须按 [tools/readback_report_template.md](tools/readback_report_template.md) 逐条对照必达项（含「配置说明、字段批注写入项 100% 匹配」与三条硬要求），每项标注 `pass|fail|not_applicable`；不得以自拟检查项的通过总数替代模板必达项。引擎产出的 `*_验收报告.json` 是原始证据，必须与 md 报告一并交出。

**已有定稿时同步定稿**：若该功能已有定稿（`<功能目录>\gdd\AI读版策划案_<功能名>_正式版.md` —— **不带日期**，一个功能一个活定稿），改表完成后**顺手回写定稿**——只动涉及的行：§4 规则与字段的对应、§6 配置契约（该工作簿**表清单**里的那一行 + 该表的**字段行**；`状态` 在表级，字段表不带状态列）。这是**最小编辑**：不重跑整合、不过 Human Gate。没有定稿时跳过——成稿阶段由 `sr-gdd-ai` 首次整合时从配置表读回。

**改完当场给「改前 → 改后」对照**（**不等用户问**）：交付正文的第一块是这张表，不是一句「已写入并验收 PASS」。

| 位置 | 改前 | 改后 | 依据 |
| --- | --- | --- | --- |
| `圣物升星表!D6` | `expect_before` 的原值 | 读回值 | change_id / 用户拍板 |

- **位置写到单元格或主键**：`圣物升星表!D6`、`道具信息表 gid=67174582`；只写表名不算定位。
- **改前值取自 `plan.json` 的 `expect_before`**（预检已逐格命中），**改后值取自读回**——两边都不许凭记忆手打。
- 一次写入超过 10 格时按表分组，组末给统计（改值几格 / 改批注几条 / 追加记录几行）。
- **顺手做的一律单列**：批注措辞、编号归一化、备份清理这类不在 change set 里的动作，单列并说明为什么做。
- 这张表**不落盘**（落盘的是 change set、`plan.json`、读回验收报告），但**必须在用户开口问之前发出**——被问出来才给，算漏做。

完成判据：写入引擎的退出核对通过（本实例 Excel PID 消失、用户原有的 Excel 未受影响）、V1–V7 验收全部 pass（**追加记录时另含 V1c / V5c**；WARN 项已如实列条数）、最终目标中的所有 change 和测试数据均已 100% 读回验证、不存在计划外配置数据差异；**改动对照表已发出且与 `plan.json` 的 op 一一对上**（多条 op 合并成一行要注明合并了哪几条，**不许出现「plan 里有、表里没有」的 op**）；已有定稿时 §4 对应行与 §6 契约已同步；否则状态为 `BLOCKED`，不宣称完成。

## 最终交付

交付最终状态、目标文件或失败产物、规则台账、change set 与哈希、**写入计划（`plan.json`）与它派生自哪份 change set**、确认记录、配置 diff、测试数据清单、验收报告（`*_读回验收报告.md` + 引擎的 `*_验收报告.json`）、**Excel 退出核对结果（本实例 PID / 是否确认退出 / 用户原有实例是否受影响）**、阻断项、延期项和备份位置；已有定稿时另附同步的定稿路径与改动行。

落点与「还要你做什么」必须写在交付正文里（照 `../sr-askme/references/gdd-pipeline.md` 的落点表）：change set 与验收报告在 `<功能目录>\gdd\`；**新建的表只在功能目录，需你手动放进 `config_root` 才算上线**；改既有表的改动已经就地生效、备份在同目录。
