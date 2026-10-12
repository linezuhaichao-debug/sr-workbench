---
name: sr-concept
description: 创新功能设计工作流——一句话创意 → 设计核三角报告 → 用户拍板 → 完整功能设计 → 交接 sr-gdd-human 出成稿。当用户想新玩法/新功能/有新创意，或问"这个点子能不能做"（可行性评估）时使用。
---

# 创新功能设计工作流（SR-Concept）

## 功能说明

两段式流水线，中间由人判断：

1. **第一阶段 · 设计核三角报告**（concept seed + 玩家动词清单 + design nucleus options + 假设台账 + 外部证据状态）。这是默认产出，做完即停，交给用户看。
2. **第二阶段 · 完整功能设计**（仅用户在设计核门选定设计核后执行）。把选定设计核展开为可验证的功能设计（玩家承诺、核心循环、关键系统、scope gate、验证计划），与用户迭代优化后交接 sr-gdd-human 生成功能 GDD（主线先 human 后 ai，见 sr-askme 教学主线）。

方法论直接使用内嵌方法目录 `game-concept-architect`（**流程入口：`references/game-concept-architect/METHOD.md`**，内含强制顺序、默认工作流、资源加载指南、硬规则、各 mode 最低合格输出）。本 skill 只固化 SR 团队的项目语境、VOI 门、产出路径与 Human Gate。**本流程的范围**：只走上面这条两段式——第一阶段固定 `idea_triage`，第二阶段取 `full_design_brief` 的要素子集（必备章节见第 5 步）；`one_page_pitch` / `vertical_slice_plan` 两种输出模式不使用。

适用范围：默认为**本项目（文明之跃）内的新玩法/功能**——数值铁律、RPGBattleModule 双模式等项目约束直接生效。用户明确说是新游戏概念时按通用模式执行，项目约束全部标 `unknown`，交接 sr-gdd 时才注入项目语境。

不编造用户未提供的信息——缺失信息一律标 `assumption` / `unknown`（含置信度、影响等级、验证方式），由人决定补不补。不替用户选设计核。

**证据优先级**：`配置表 > 客户端代码 > 参考策划文档 > 推断`。用户提供的参考材料（旧案、竞品拆解、配置表、代码结论）相互冲突时，以高优先级来源为准，差异写入 Assumption Ledger 并标 `待确认：`。

## 使用方法

```
/sr-concept <一句话创意>
```

或直接说人话，例如"我想做一个时空回溯改战局的玩法"、"设计一个文明奇观争夺功能"、"这个点子能不能做：玩家互相派遣间谍偷科技"。

## 无输入时的行为

裸调用纪律见 `../sr-askme/references/bare-invocation.md`。本 skill 收集：

1. **创意**：一句话描述想做的玩法或功能。
2. **定位**：本项目（文明之跃）新功能/新玩法，还是通用概念（默认项目内）。
3. **已有材料**（有就给路径，没有就明说没有）：脑图、参考游戏笔记、旧草案、相关决议记录。

用户补齐后再从第 0 步开始。

## 路径约定

`<SR_WORKSPACE>` / `<SR_PROJECT>` 取自 `%USERPROFILE%\.dsh\sr-workbench\config.local.json`；字段缺失、为空或路径失效时运行 `/sr-askme` 补齐；成组安装见 `../sr-askme/SKILL.md` §四。

## 执行流程

### 第 0 步 · 载入项目语境

读 `../sr-askme/references/sr_project_context.md`，后续全程遵守其中的数值铁律与写作约束。项目内功能设计全部生效；通用概念模式仅写作约束生效，项目约束标 `unknown`。
完成判据：本次产出满足项目语境——新增设计数值按 `sr_project_context.md`「数值状态词」标"待配表"，引用已有配置才写 `表名.字段名`，不猜数；涉及战斗的设计标明 RPGBattleModule 模式归属（核对点：第 2 步「项目语境硬约束」）。

### 第 1 步 · 创意复述与定位

- 用一句话复述用户原始创意，确认理解一致。
- 确认定位：项目内新玩法/功能（默认）| 通用概念（无输入阶段已收集的，此处仅复述确认）。
- 记录 case visibility：`case_visibility` 默认 `private_user_work`，`output_destination` 默认 `private_notes`。
- 缺失信息会实质改变设计方向时才提澄清问题（如目标平台、参考游戏是灵感还是硬约束），**最多问三个**；用户要求继续就带着明确 assumptions 推进。

完成判据：复述获用户认可；定位与 case visibility 成文。

### 第 2 步 · 设计核三角报告（第一阶段）

读 `references/game-concept-architect/METHOD.md`（**流程本体**：强制顺序、默认工作流、资源加载指南、硬规则）；撰写 Concept Seed Extraction 章节前加载 `references/game-concept-architect/references/concept-seed-extraction.zh-CN.md`，撰写 Design Nucleus Options 章节前加载 `references/game-concept-architect/references/design-nucleus-options.zh-CN.md`；输入涉及参考游戏或机制迁移时加读 `references/game-concept-architect/references/game-dissection-lens.zh-CN.md`。报告表格骨架用 `references/game-concept-architect/templates/idea-triage.md`。

按 `references/game-concept-architect/METHOD.md` §最低合格输出 的 `idea_triage` 口径撰写设计核三角报告（产出路径见文末产出规范表）：

- **Case Visibility**
- **Original Idea**：一句话复述
- **Concept Seed Extraction**：题材母体、玩法母体、情绪承诺、差异化种子、平台假设、商业化假设、受众假设、关键 unknown
- **Player Verb Inventory**：玩家直接动作、系统响应、脑内判断、80% 时间里玩家真正反复做什么
- **Design Nucleus Options**：2 到 4 个候选，每个写清玩家反复做什么取舍、改变什么行为/节奏/成长、依赖哪些 assumptions、最大风险和最小验证方式。**不得过早锁死单一设计核**
- **Action-Goal Alignment**：核心动词是否推进瞬时目标、局内目标和长期目标；是否存在脱离核心循环的目标或功能
- **Assumption Ledger**：每条标置信度、影响等级、验证方式；不得把 assumption 藏在确定语气里
- **External Evidence Status**：VOI 门判定（`not-run` / `evidence-needed` / `partial` / `verified` / `contradicted`）。不强制联网、不做泛搜；没有证据的市场判断不得写成事实
- **Recommended Next Step**

项目语境硬约束（项目内定位时）：

- 报告出现的数值一律标"待配表"，禁止猜数。
- 涉及战斗的设计注明 RPGBattleModule 确定性引擎两种模式（开放世界 / 独立战斗场景）的归属。

`game-concept-architect/METHOD.md` 的 §硬规则 全部生效（本步开头已读入）。

完成判据：报告章节齐全；每个 nucleus option 有风险与最小验证方式；所有 assumption 已入台账。

### 第 3 步 · 治理检查

按 `../sr-askme/references/governance-check.md` 做检查，在报告末尾附五条引用：

- `decision_ref`：本次创意探索要改变的产品/设计决策
- `voi_gate_ref`：哪些外部取证才会真正改变设计核选择或范围
- `assumption_review_ref`：要拦截的无支撑声明、过度自信解读、被藏起来的 assumption
- `human_gate_refs`：需要 owner 审批的玩家承诺、对外口径、范围与生产投入
- `candidate_learning_refs`：可复用的设计规则（在跨案例重复出现前保持 candidate 状态）

完成判据：五条引用全部填写，无占位符残留。

### 第 4 步 · Human Gate（设计核门）

向用户呈现选项并等待选择，不替用户做批准类决定：

```
pick_nucleus_<编号> / merge_nuclei / regenerate_options / request_external_evidence / stop
```
完成判据：用户已从上述选项中明确选择其一；选择前不执行任何后续步骤。

- `pick_nucleus_<编号>` = 用户选定设计核，进入第 5 步。这是两阶段之间唯一的入口，不得默认进入。
- `merge_nuclei` / `regenerate_options`：按用户指示回到第 2 步调整候选。
- `request_external_evidence`：列出最小验证动作，补证据后回到第 2 步。
- 选择后按 `../sr-askme/references/decision-recording.md` **追加一条决策记录**：`**决策**：` 写这次拍板（pick_nucleus_* / stop / merge_nuclei / regenerate_options / request_external_evidence）与选定的设计核；`**依据**` 写三角评估里哪一条支撑它；`**影响**` 写要展开 / 重做的部分。

### 第 5 步 · 完整功能设计（第二阶段，仅选定设计核后）

读方法目录 references：`player-promise-framework.zh-CN.md`、`core-loop-expansion.zh-CN.md`、`scope-gate.zh-CN.md`、`prototype-validation-gate.zh-CN.md`、`production-feasibility.zh-CN.md`；涉及品类或参考游戏时加读 `genre-fit-matrix.zh-CN.md`、`reference-game-boundary.zh-CN.md`。

产出功能设计稿（产出路径见产出规范表），必备章节：

- **Player Promise**：一句话承诺、首次接触承诺、重复游玩承诺
- **Core Loop**：行动、选择、风险、反馈、奖励、成长或新约束
- **Key Systems**：每个系统必须答出四问——服务哪个核心循环、改变什么玩家行为、创造什么反馈、如何被验证；答不出的系统不得加入
- **Uncertainty Calibration**：不确定性来源（人/隐藏信息/身体技能/脑力技能/随机性）、玩家能否解释失败原因、随机性是否覆盖玩家努力。另给**放置检查**结论——随机是否落在玩家可接受的位置、失败是否可解释、是否降低分析瘫痪、是否匹配受众（各判 pass / weak / fail），以及**验证指标**：失败可解释率、坏运气后重试意愿、单次决策耗时、公平感评分
- **Scope Gate**：MVP 必须有、后续版本应该有、建议砍掉的危险设计
- **Production Feasibility**：项目内定位时落到引擎与工具链约束（C# 确定性 sim / Lua 热更边界、`LuaConfigs` 与 `RPG_Configs` 配表管线、移动端性能预算）；内容产能能否持续
- **Validation Plan**：最小可玩原型、第一轮测试目标、最危险假设、通过标准、失败标准、下一步投入条件。**没有通过/失败标准不得建议继续投入**。另列**测试后回写清单**——本轮结果要回写哪些台账（假设台账、风险台账、功能优先级、下一轮范围门）
- **Assumption Ledger**：更新版，标注第一阶段哪些 assumption 已被设计决策消化
- **Risk Register**：本设计的主要风险，类型按内部功能文档枚举（生产/数值/体验/经济/技术/UI/文档），每条给触发信号与缓解动作（验证 / 降 scope / 替代方案 / 砍掉 / 暂缓，判据见 `../sr-askme/references/evidence-boundary.md`「风险处置动作」）
- **配置项预测**：本设计涉及的新配置表与字段清单，全部标"待配表"——为 sr-config 建表与 sr-gdd-ai 配置契约章节备料

设计稿初稿出来后与用户迭代优化，直到用户认可。迭代期间用户每轮拍板/纠偏，先按 `../sr-askme/references/calibration-recording.md` 实时追加一条校准记录，再继续修改设计稿。
完成判据：章节齐全；每个 key system 答出四问；uncertainty calibration 有放置检查结论与验证指标；validation plan 有通过/失败标准与测试后回写清单；risk register 每条有触发信号与缓解动作；数值全部"待配表"或标注 `配表名.字段名`。

### 第 6 步 · Human Gate（交接门）

向用户呈现选项并等待选择：

```
route_to_gdd / revise_concept / stop
```
完成判据：用户已从上述选项中明确选择其一；选择前不生成交接材料、不执行后续步骤。

- `route_to_gdd`：输出 GDD 交接 JSON（产出路径见产出规范表），交接目标为 `sr-gdd-human`（主线成稿步），内容为材料清单：功能设计稿路径、设计核三角报告路径、已拍板设计核与关键取舍、假设台账、风险台账、配置项预测、遗留 unknown 与置信度。sr-gdd-human 第 1 步资产盘点可直接从 `<功能目录>\analysis\` 拾取这些材料。
- 决策记录按 `../sr-askme/references/decision-recording.md` 追加：`**决策**：` 写这次拍板（route_to_gdd / stop / revise_concept）与功能设计稿的结论。

## 产出规范

| 产出 | 路径（`<SR_WORKSPACE>\` 下） |
|------|------|
| 设计核三角报告 | `analysis\concept-triage_<主题>_<日期>.md` |
| 功能设计稿（仅选定设计核后） | `analysis\feature-concept_<主题>_<日期>.md` |
| GDD 交接（仅 route_to_gdd 时） | `analysis\sr-gdd-handoff_<主题>_<日期>.json` |
| 决策记录 | `<功能目录>\decisions\决策记录.md`（追加；格式见 `../sr-askme/references/decision-recording.md`） |
| **历史版本** | 改写已有产物**之前**留的那一版：产物同目录 `<原名>_<YYYYMMDD>_<序号>.<ext>`（口径与命令见 `../sr-askme/references/version-history.md`） |

目录不存在时直接创建。日期格式 `YYYYMMDD`。

## 内嵌资源

- `references/game-concept-architect/METHOD.md`（**流程本体、唯一事实源**：强制顺序、默认工作流、资源加载指南、硬规则、各 mode 最低合格输出）
- `references/game-concept-architect/`（14 个 references/ 全部随包；templates/ 仅 `idea-triage.md`）
- 共享语境与决策规范不复制副本，从 `../sr-askme/references/` 读取。
