# 0027 · 覆盖索引 `--init --previous <同一路径>` 会就地覆盖上一版索引，不留副本

- 日期：2026-10-19
- 状态：**已接受**（本轮按规避手法执行：用包内最后一份**归档**索引当 `--previous` 基准 + 在索引 `extensions` 里写清替代理由；**脚本补丁未做，待用户决定**）
- 相关：`skills/plan-doc-ai-version/scripts/prepare_localization_coverage.py`
  §`initialize_coverage()`（第 74–78 行读 `--previous`：`previous_path = resolve_inside(...)` → `previous_ref = {path, sha256: sha256_file(previous_path)}`；
  第 398 行直接 `write_text` 同一路径，全程**没有归档动作**）
  · 技能契约 `references/localization-coverage.md` §Machine Coverage Index（"writeback：`--mode affected_modules --previous <上一版覆盖状态JSON>`"）
  · 功能侧指针：`features\联盟讨伐\decisions\决策记录.md` 2026-10-19 条 · 运行包 `03_AI过程档案_策划通常无需处理\多语言覆盖状态_联盟讨伐.json` 的 `extensions.writeback_note.previous_index_transparency`

## 背景

写回入口的标准命令是「`--coverage <当前索引>` **加上** `--previous <上一版索引>`」。当上一版索引就是活动索引本身时（写回场景的常态），
两个参数指向**同一个文件**：`--init` 先读它、把行逐条复制进内存，随后**原路径重写**，上一版索引的字节就没了。

实测（WB-20261019-001，联盟讨伐）：

| 事实 | 证据 |
| --- | --- |
| `--init` 记录下来的上一版索引 = `多语言覆盖状态_联盟讨伐.json`，sha256 `c983ae74…` | 新索引 `key_reconciliation.previous_coverage.sha256` |
| `--init` 之后同一路径的 sha256 = `2d6086c1…`（已被重写） | `Get-FileHash` 实测 |
| 全包 338 个文件按 `c983ae74…` 搜索，**零命中** | `_find_prev_coverage.py`（逐文件 SHA256 扫描，>3MB 跳过，本包无此量级文件） |
| 该索引是**已激活事件**的多语言组件（WB-20261016-001 `components[localization]`，记录 sha `885c4550…`） | 写回事件 JSON |

危害：① 保留性（"accepted results are never lost"）——被激活事件引用过的索引字节不可复得；
② 对账失真——`previous_active_keys` 在 `--prepare` 时按**当前**文件重算，于是 57→59 的键集变化会被写成 59→59，`disappeared_keys` 恒为 0，看不出"其实没比过"。

## 决定与规避

1. **基准改指真实归档件**：把 `previous_coverage` 指向包内最后一份**归档**索引（键集完全相同：58 行 / 57 个不同键），
   并让 `--prepare` 按它重算 `previous_active_keys` → 得到正确的 57 → 59、`disappeared_keys = 0`。
2. **构造性对账声明**：上一版全部触点由 `--init` **逐字复制**进新索引，本轮只显式改 2 行、新增 2 行，
   因此"没有键消失"是构造性结论、不依赖那份被覆盖的文件；把这句话写进覆盖索引 `extensions.writeback_note.previous_index_transparency`。
3. **本轮不自行补脚本**（技能维护需按 `maintenance-governance.md` 的风险分级走），缺陷留档待用户决定。

## 纪律

- **调用 `--previous` 前先看它指向哪**：与 `--coverage` 同路径时，**先手工把该文件按 `多语言覆盖状态_<功能名>_<旧正式版sha8>.json` 归档一份**，
  再把归档件路径传给 `--previous`。
- **归档命名认正式版 SHA**，与本包既有 `版本归档\多语言覆盖状态_联盟讨伐_*.json` 一致；不要新造命名体系。
- 覆盖索引是"可重建的派生索引"，但**被激活事件绑定过的那一版**要按不可变产物对待。

## 影响

- **本轮实例**：联盟讨伐 WB-20261019-001 的覆盖索引 `previous_coverage` 指向
  `版本归档\多语言覆盖状态_联盟讨伐_d892a28f.json`；`previous_active_keys = 57`、`current_active_keys = 59`、`disappeared_keys = 0`（工具实跑输出）。
- **风险未消除**：下一个功能照标准命令调用时，同样会丢一份上一版索引；特别是"上一版索引刚被激活事件绑过"的情况。
- **建议补丁（未做，待用户决定）**：① `initialize_coverage()` 在重写前把 `previous_path` 归档到 `<过程档案>/版本归档/多语言覆盖状态_<功能名>_<旧 formal sha8>.json`（若同名已存在则 fail-closed）；
  ② 归档失败时 `--init` 直接阻断，而不是继续覆盖；③ `--prepare` 发现 `previous_coverage.path == coverage.path` 时给出显式 WARN（提示"这是自比，不是对账"）。
