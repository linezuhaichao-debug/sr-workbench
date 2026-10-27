# ADR 0031 · sr-gtgenerator 的 CLI 补 Relic 主类型（TypeCategory 14）

- 状态：已采纳（2026-10-27）
- 影响面：`sr-workbench\skills\sr-gtgenerator\scripts\cli_anything\gtgenerator\core\model.py`

## 背景

GTGenerator.exe 在 2026-10-27 更新后已有 `Relic` 主类型（二进制里能找到该字符串），
但 skill 自带 CLI 是从 GUI 行为复刻的独立实现，它的 `MAIN_CATEGORIES` 只到
`("Misc", 13)` ⇒ `gtgenerator type create --main Relic` 直接报 `unknown main: Relic`，
CLI 与真实工具的类型表脱节，无法为新功能（英雄圣物）申请 GID。

## 决定

在 `core/model.py` 的 `MAIN_CATEGORIES` 末尾补一项 `("Relic", 14)`；
`SUB_CATEGORIES` 不加 `Relic` 键 —— 该主类型无子类，`session.py` 在 `sub` 传空时
按 0 处理，ID 编码为 `14 << 24 | 0 << 16 | seq`（与 `Soldier` / `Payment` / `Misc` 同形）。

## 理由

- ID 高位就是主类型号：`id = main << 24 | sub << 16 | sequence`（旧分组统计里
  `floor(id / 65536)` 得到 `main << 8 | sub`，容易误读成 `main << 16`，本次已按源码核对）。
- 空分组首号 = 2（`repo.next_sequence` 的 GUI 兼容行为），所以 Relic 首号是
  `234881026`（`0x0E000002`），与用户给的 `TypeCategory = 14` 一致。
- 只有改这张表才能让 CLI 生成合法 ID；`--force-id` 也只能在本组内指定序号，绕不过去。

## 后果

- CLI 现在能创建 / 查询 Relic 类型；本批 48 个圣物 gid 落在 `234881026–234881073`。
- 若将来 GUI 的 Relic 又加了子类（如 SLG / RPG），需要同步往 `SUB_CATEGORIES` 里补，
  否则 CLI 创建的 ID 子类字节恒为 0，与 GUI 分配不一致。
- 这是**工具侧**改动，记在本 ADR；圣物 gid 怎么落表、备注写什么，记在功能的
  `decisions\决策记录.md`。
