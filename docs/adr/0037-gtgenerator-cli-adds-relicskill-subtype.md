# ADR 0037 · sr-gtgenerator 的 CLI 补 RelicSkill 子类型（SkillType 10）

- 状态：已采纳（2026-11-17）
- 影响面：`sr-workbench\skills\sr-gtgenerator\scripts\cli_anything\gtgenerator\core\model.py`
- 关联：ADR 0031（同一张类型表上一次扩充，那次补的是 `Relic` 主类型）

## 背景

`GTGenerator.exe` 的 `ConfigManager.SkillType` 枚举有 10 个成员，`MineSkill = 9` 之后还有
`RelicSkill = 10`；但 skill 自带 CLI 是从 GUI 行为复刻的独立实现，`SUB_CATEGORIES["Skill"]`
只到 `("MineSkill", 9)` ⇒ `gtgenerator type create --main Skill --sub RelicSkill` 报
`unknown sub 'RelicSkill' for Skill`，无法为圣物技能申请 GID。

这是 ADR 0031「后果」节已预告的情形：*"若将来 GUI 的 Relic 又加了子类…需要同步往
`SUB_CATEGORIES` 里补，否则 CLI 创建的 ID 子类字节恒为 0，与 GUI 分配不一致。"*

## 决定

在 `core/model.py` 的 `SUB_CATEGORIES["Skill"]` 末尾补一项 `("RelicSkill", 10)`。

同时把 `RelicSkill` 补进 `SKILL.md`「流程 B1」的类型映射表（用户词 `RelicSkill` /
`圣物技能` → `--main Skill --sub RelicSkill`），否则操作员拿不到这条映射。

## 理由

- ID 规则是 `id = main << 24 | sub << 16 | sequence`；Skill 主类型号 6、RelicSkill 子类型号 10
  ⇒ 该组 ID 形如 `0x060A0000 | seq`（十进制前缀 `101318656`）。
- `RelicSkill = 10` 是**实测**的，不是按声明顺序推的：用 `.NET Assembly.LoadFrom` 反射读
  `GTGenerator.ConfigManager+SkillType` 的常量字段，得到 `SoilderSpecial=1 … MineSkill=9,
  RelicSkill=10`（exe SHA256 `CDD37EDF61941212309821BFC7C19D36AE92CD0B8B5EE50DF6EFC4C9434800BC`）。
  注意 exe 是 .NET Framework 4.6.1，**Windows PowerShell 5.1 才能加载**，`pwsh`（.NET 7+）
  会报 "Format of the executable (.exe) or library (.dll) is invalid"。
- 空分组首号仍是 2（`repo.next_sequence` 的 GUI 兼容行为，见 ADR 0031），所以该组首号是
  `101318658`（`0x060A0002`）。

## 后果

- CLI 现在能创建 / 查询 Skill/RelicSkill 类型；首单用途是圣物技能 144 个 GID
  （`101318658–101318801`，24 技能 × 6 级）。
- 若 GUI 再给 Skill 加子类（如 11 号），同样要同步这张表，否则 CLI 与该组对不上。
- 这是**工具侧**改动，记在本 ADR；圣物技能 GID 怎么分段、怎么命名、描述怎么写，记在功能的
  `decisions\决策记录.md`。
