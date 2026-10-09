# 最小事务写入与配置数据验收

本文件只在实际写入工作簿时读取。文件格式能力与保真由当前表格工具负责；本流程只保护源文件并验证最终配置数据。

## 写入

已有目标文件：

1. 在目标目录复制为 `<stem>.backup.<timestamp><ext>`；
2. 确认备份中的配置数据可读取；
3. 在目标目录创建 `<stem>.tmp.<uuid><ext>`；
4. 只向临时文件应用冻结的 change set；
5. 对临时文件执行配置数据读回验收；
6. 验收通过后替换目标文件；
7. 再次读取最终目标，确认配置数据与已验临时文件一致。

新建目标文件跳过备份，但仍使用同目录临时文件、读回、移动和最终复读。

临时文件验收失败时，将其保留为 `<stem>.failed.<timestamp><ext>`，目标文件保持写入前状态。替换或最终复读失败时状态为 `BLOCKED`；已有目标使用备份恢复后再次读取。

扫描 `config_root` 时排除名称包含 `.backup.`、`.tmp.`、`.failed.` 的 `.xlsx/.xlsm` 文件。这些文件不能作为配置模式、引用、测试 ID 或 `INDEX` 的证据来源。

## 配置数据验收

每项结果记录 `expected`、`actual`、`pass|fail` 和证据定位。`not_run` 视为失败。

验收报告必须逐条对照 [tools/readback_report_template.md](../tools/readback_report_template.md) 的必达项填写，每项标注 `pass|fail|not_applicable`；不得以自拟检查项的通过总数替代模板必达项——自拟清单未覆盖的必达项按 `fail` 计。

必须达到：

- 目标文件和写入范围内的工作表 100% 存在；
- change set 中的 change 100% 可读回；
- 变更字段的五行表头 100% 等于已确认 schema；
- 变更记录的键和 before/after 100% 匹配；
- 主键和索引唯一性检查 100% 通过；
- 必填值、枚举、单位、边界和空值规则 100% 通过；
- codec 字段逐值 `parse → validate → serialize → parse` 通过；
- 纳入范围的引用解析率 100%；
- `INDEX`、配置说明和字段批注的写入项 100% 匹配；
- 新表测试记录、主键、引用和 `fixture_coverage` 100% 匹配；
- `blocking_items` 中没有 open 项；
- 没有计划外配置数据差异。

已有文件比较源配置数据与最终配置数据，差异集合必须精确等于 change set。新建文件的最终配置数据必须精确等于 schema、changes、fixtures 和 output mappings 推导出的预期快照。

## 状态判定

- 全部验收通过：`PASS`；
- 尚未写入或仍等待确认：`DRAFT`；
- 任一验收失败、写入失败或存在 open blocker：`BLOCKED`。

`PASS` 可以保留 `deferred_items`，但报告必须证明它们不属于本次写入集合，且不影响已写入数据的正确性。
