# TimeMachine 配置 Profile

本 profile 只描述 TimeMachine 项目的五行表头、`INDEX` 和配置模式。通用流程与 schema 由 `SKILL.md`、`../references/rules_and_schema.md` 和 `../references/change_set.md` 定义。

本文内相对路径一律相对**本文件所在目录**（`profiles/`）解析。

## 本机目录

`config_root` 首选来源是 `../../sr-askme/config.local.json` 的 `config_root` 字段（首次配置由 sr-askme 引导生成，并同步写成本目录的 `timemachine.local.yaml`）。两者任一存在且 `config_root` 有效时直接采用并写入 change set（**两者不一致时以 `config.local.json` 为准**）；缺失、失效或目录中没有 `.xlsx/.xlsm` 时询问用户，确认后更新 `config.local.json` 与 `timemachine.local.yaml`。绝对路径只保存在本机配置，不写入本 profile。

配置目录扫描排除名称包含 `.backup.`、`.tmp.`、`.failed.` 的工作簿。

## 模式状态

配置工作簿是活文档（策划日常修改），**不以文件哈希作为验证前提**。模式的状态由**字段级证据**决定：

- `verified`：模式定义的字段（表!sheet!字段名清单）当前仍存在于 `config_root` 对应表头中——每次任务使用模式前，用附带工具 `../tools/check_pattern_fields.py` 校验；全部在则直接采用。
- `candidate`：校验发现字段缺失/改名，或模式本身缺少稳定来源；必须进入确认门，并登记 `profile_conflict`（记录哪个字段失效）。

状态不能静默升级。每个来源记录的 `source_root` 都指向逻辑键 `config_root`。验证状态是动态的——`check_pattern_fields.py` 本次通过即本次有效，不需要记录验证时间：字段清单本身就是契约，存在性校验取代了快照。

profile_conflict 记录：
- 2026-09-01：A009-领袖表.xlsx 外部修改导致哈希失配；字段清单复核全部仍在（INDEX 增加一个新 sheet，不影响既有模式），据此将验证依据从哈希改为字段级校验。
- 2026-09-14：B009-领袖装备表.xlsx 重构——`effect`/`xGameAttr` 由「装备强化表」移至「装备基础表」，并新增伴随字段 `effectValueClass`/`xGameAttrValueClass`（int，指向新增的「属性值类表」：`group`=属性值类 × `lv`=强化等级 → `value`）。`typed_value` 声明的 `B009!装备强化表.effect,xGameAttr` 因此校验失败、降级 `candidate`；来源表归属与「养成属性的两种配置形态」判定规则（见下）待确认后更新。旧版先例仍在 `策划配置_数值`/`策划配置zc`/`策划配置1.0` 的 `装备强化表` 中可见。

## 已验证模式

**使用方式（建新表时禁止全目录遍历）**：先按下表把需求映射到模式，再只探查模式声明的 `fields:` 所在表——需要引用 ID 就只探查对应引用目标表，需要先例就只探查模式来源表。全部模式合起来只涉及 7 个工作簿（A009/B009/B010/A028/A012/A006 及文本约定），`config_root` 其余 80+ 工作簿与建表无关，不读。

| 需求 | 直接用 |
| --- | --- |
| 单值枚举（品质/兵种/槽位…） | `scalar_enum` + 通用枚举表 |
| 外键引用（掉落/道具/英雄…） | `id_reference`（目标表见承载表约定） |
| 奖励串 `gid,level,count;` | `id_level_count` |
| 属性串 `attribute_gid,value;` | `typed_value` + 养成属性约定 |
| 抽取权重 | `weight_scalar` |
| 成长曲线（等级/星级×数值） | `growth_curve` |
| 解锁/门槛条件 | `condition_selector`（→A028 承载） |
| 全局开关/系数 | `key_value`（→A012 承载） |
| 奖励发放/随机产出 | A006 承载表约定 |
| 技能行 | `skill_row` |
| 有序 ID 列表 | `id_list` |

### `scalar_enum`

单值整数枚举。枚举含义只在目标字段和来源一致时复用，不跨字段套用。

```yaml
fields:
  - source_root: config_root
    workbook: A009-领袖表.xlsx
    sheet: 英雄基础表
    field_or_cell: quality,type
  - source_root: config_root
    workbook: B009-领袖装备表.xlsx
    sheet: 装备基础表
    field_or_cell: rank,pos
```

已知枚举与通用字段语义约定见下方「字段语义约定」；枚举含义只在目标字段和来源一致时复用，不跨字段套用。

### `id_reference`

单 ID 外键。契约必须声明目标工作簿、工作表、键字段和空值策略。典型目标：A006!掉落表.id（副本玩法奖励/随机奖励统一引用，见「通用承载表复用约定」）。

```yaml
fields:
  - source_root: config_root
    workbook: A009-领袖表.xlsx
    sheet: 英雄基础表
    field_or_cell: piecesGid
```

### `id_level_count`

单组格式为 `gid,level,count`；多组分隔符和尾分号只有在目标字段证据确认后启用。

```yaml
fields:
  - source_root: config_root
    workbook: B009-领袖装备表.xlsx
    sheet: 装备精炼表
    field_or_cell: upgradeCost
```

### `typed_value`

格式为 `attribute_gid,value;`，组内逗号、组间分号。尾分号和数值边界以目标字段批注为准。直配生效型（A 型）字段值直接生效；占比成长型（B 型）字段的最终属性 = 总属性 × rate，两种形态的定义见「字段语义约定」。军团属性（effect 系）与副玩法属性（xgameAttr 系）是否成对新增属于契约选择，未确认时形成 blocker。

```yaml
fields:
  - source_root: config_root
    workbook: B009-领袖装备表.xlsx
    sheet: 装备强化表
    field_or_cell: effect,xGameAttr
  - source_root: config_root
    workbook: A009-领袖表.xlsx
    sheet: 英雄基础表
    field_or_cell: effectStarMax,xgameAttrStarMax
  - source_root: config_root
    workbook: B010-副玩法属性表.xlsx
    sheet: 领袖属性表
    field_or_cell: id
```

### `weight_scalar`

单字段整数权重，不是百分比，不包含条目 ID。总和规则读取目标表契约。

```yaml
fields:
  - source_root: config_root
    workbook: A009-领袖表.xlsx
    sheet: 英雄招募表
    field_or_cell: baseweight,upWeight,guaranteeWeight
```

### `growth_curve`

以 `starType + star` 为复合键的成长曲线。

```yaml
fields:
  - source_root: config_root
    workbook: A009-领袖表.xlsx
    sheet: 英雄升星表
    field_or_cell: starType,star,cost,effectRate,xgameAttrRate,powerRate
```

### `condition_selector`

格式为 `type,param1,param2,param3;`，第一段决定后续参数语义。

```yaml
fields:
  - source_root: config_root
    workbook: A028-功能开启表.xlsx
    sheet: 功能开启
    field_or_cell: section1
```

### `key_value`

`key` 是唯一字符串键；`value` 的 codec 按目标 key 的说明解析。

```yaml
fields:
  - source_root: config_root
    workbook: A012-全局变量表.xlsx
    sheet: 全局变量表
    field_or_cell: key,value
```

### `skill_row`

技能行包含 `gid,skill_slot,level,unlock,power,skill,descRule,skillType,effectParam,effects,xgameAttr`。字段大小写保持来源原样。

```yaml
fields:
  - source_root: config_root
    workbook: A009-领袖表.xlsx
    sheet: 英雄技能表
    field_or_cell: gid,skill_slot,level,unlock,power,skill,descRule,skillType,effectParam,effects,xgameAttr
```

### `id_list`

逗号分隔的有序 ID 列表；ID 来源和最大数量读取目标字段批注。

```yaml
fields:
  - source_root: config_root
    workbook: A009-领袖表.xlsx
    sheet: 英雄基础表
    field_or_cell: heroPos
```

## 通用承载表复用约定（A028 / A012 / A006）

TimeMachine 有三张"通用承载表"，**新功能出现同类配置需求时优先复用它们，不得在功能自己的工作簿里新增同语义字段**；是否适用在确认门声明，误用会形成 blocker：

### A028-功能开启表.xlsx（功能开关/解锁条件）

- 职责：任意系统功能的**开启门槛**统一登记处——等级/建筑/时代/完成某事件等通用任务条件（`condition_selector` 模式：`type,param1,param2,param3;`），含未激活表现（隐藏/置灰）、激活表现、未开启提示飘字。
- **适用判断**：新功能需要"达到某条件后开放/显示入口"（如 HUD 图标出现、功能入口解锁）→ 在 A028 **新增一行**（取未用 id，2026-08 已用 1–532 段），引用既有通用任务条件 gid；**禁止**在功能配置表里自建 `openLevel`/`unlockCondition` 之类字段。
- 引用链：A028 条件 gid → A011 任务.xlsm 的任务类型计数器体系（如 117833744/117899266 等 117xxx 段）。

### A012-全局变量表.xlsx（全局 KV 参数）

- 职责：**跨系统共享的单一数值/参数**（无主键关联、无期次/档位结构的散参数）。key 为 camelCase 字符串（389 个已用），value 为 table 字段，实测形态：单值（302）、逗号列表（28）、分号组（58）、空值（1），语义由同行备注/说明列解释。
- **适用判断**：新功能需要"一个可被多系统读取的全局开关或系数"（如全局冷却秒数、默认开关、阈值）→ 在 A012 **新增 key**；**禁止**新建一张只有几行的"xx全局表"或在功能表里塞全局参数。
- **不适用**：与记录结构强绑定的参数（每期/每档一行的字段）不进 A012——例如神话宝库的 pityN 因含跨期语义进的是 A079 宝库全局表；单一功能的局部参数也不进。

### A006-掉落表.xlsx（奖励/随机产出统一登记处）

- 职责：所有系统的**奖励发放与随机产出**统一走掉落表（直接掉落包/随机包/独立随机包三种掉落类型，见 A006!配置说明）。
- **适用判断（优先规则）**：①**副本玩法的奖励**（排行/挑战/波次/通关等）②**任何需要随机的奖励** → 一律配置**掉落表 id**（int 引用，字段名建议 `reward`/`dropId`，中文带"id"），在 A006 新增掉落行承接；**不得内联 `gid,level,count;` 串**。已实证的正例：A057!竞技场 winReward/loseReward=99001/99002（精确命中 A006"竞技场-胜利/失败"）；A011!章节表 dropId=30001。需逐步收敛的反例（存量）：A051!地牢排行奖励、A072!困兽之斗 rewards 目前是内联串。
- **不适用**：固定数额的付费内容（A043 充值/礼包 rewards 按支付体系惯例仍用内联串）；资源补充包类道具本体（A002 道具信息表 valueList）。

- 判定顺序：功能门槛类 → 先查 A028；全局散参数类 → 先查 A012 既有 key（避免同义 key 重复）；**副本玩法奖励/随机奖励 → 一律走 A006 掉落 id**；三者都不匹配再设计新字段，并在确认门给出"为何不能复用"的理由。

## 字段语义约定

TimeMachine 养成类（英雄/领袖成长线）表中，成对出现的两个属性列表字段按**语义角色**区分。`effect`/`xgameAttr` 只是建议命名——实际字段名存在变体（如 `effects`、`xGameAttr`、`effectRate`），判定依据是作用域与服务器记录归属，不是字段名；设计新表或新字段时必须遵循，字段批注与配置说明须写明归属：

| 语义角色 | 建议命名（可有变体） | 作用域 | 服务器是否记录 | 说明 |
| --- | --- | --- | --- | --- |
| 全局属性 | `effect` 系（变体：`effects`、`effectRate`…） | SLG 属性 + 全体英雄的副玩法属性 | **服务器记录** | 军团/全局生效值，参与服务端结算与校验；形态为 `typed_value`（`attribute_gid,value;`） |
| 单英雄副玩法属性 | `xgameAttr` 系（变体：`xGameAttr`、`xgameAttrRate`…） | 单个英雄的副玩法属性 | **服务器不记录** | 服务器不持久化、不校验，但 **RPG 战斗引擎会读取使用**（单英雄副玩法战斗结算）；并非纯展示字段，配置错误会直接影响副玩法战斗表现；形态同为 `typed_value` |

### 通用枚举

以下枚举在整个配置体系中语义一致，配置或校验时直接按此对照（来源见 `scalar_enum` 模式）；**含义仅在目标字段与来源字段同义时复用**——字段名可以不同（如品质 `quality` 与装备品阶 `rank` 同用一套色阶），但出现同一数值表达不同含义时不得套用：

| 枚举 | 取值 | 来源（已验证） |
| --- | --- | --- |
| 品质 / 装备品阶 | `1=灰, 2=绿, 3=蓝, 4=紫, 5=橙, 6=红` | A009!英雄基础表.quality、B009!装备基础表.rank |
| 英雄兵种 | `1=步兵, 2=骑兵, 3=弓兵` | A009!英雄基础表.type |
| 装备槽位 | `1=头, 2=甲, 3=手, 4=脚` | B009!装备基础表.pos |

### 养成属性的两种配置形态（新表设计时二选一，须在确认门声明）

| 形态 | 结构 | 生效方式 | 实例（已验证） |
| --- | --- | --- | --- |
| A 直配生效型 | 只配两个属性列表字段，**无伴生字段** | 字段值即最终属性，直接生效，**不乘 rate** | B009-领袖装备表.xlsx 装备强化表 `effect/xGameAttr`（`attribute_gid,value;` 直接入值） |
| B 占比成长型 | 属性总表字段（`effectLevelMax`/`effectStarMax`、`xgameAttrLevelMax`/`xgameAttrStarMax`）+ 成长占比字段（`effectRate`/`xgameAttrRate`，万分比） | 最终属性 = 对应总属性 × 当前等级/星级占比 | A009-领袖表.xlsx 英雄升级表 `effectRate/xgameAttrRate/powerRate`、英雄升星表 `effectStarMax/xgameAttrStarMax` |

- **`xgameAttr` 系的消费方**：服务器虽不记录（不持久化、不校验），但 RPG 战斗引擎会读取使用——该字段进入导出链路后参与副玩法战斗结算，不能当作"可随意留空/乱配的纯展示字段"；空值与取值边界按目标字段批注校验。
- 判定目标字段属于哪种形态：读取目标表字段批注与相邻列——同表存在 rate 列即 B 型，不存在即 A 型；无法判定时形成 blocker，不得假设。
- 现存字段名变体（2026-08-27 验证）：`effects`（英雄技能表）、`xGameAttr`（装备强化表，大写 G）——拼写与大小写以来源原样为准，跨表复用时不得静默改写。
- 二者是否成对新增属于契约选择：只加其一合法，但必须在确认门声明；未确认时形成 blocker。
- 若目标字段的既有批注与上表冲突，以目标批注为准并登记 `profile_conflict`。
