---
name: sr-analysis
description: 体验诊断 + 设计拆解复刻工作流——游戏素材（截图/录屏/PV/商店页/视频链接）→ 证据链分析报告 → 用户判定 → 复刻规格 → 交接 sr-gdd-human 出成稿。当用户分析游戏素材、体验复盘、拆解竞品/玩法，或想复刻某个功能时使用。
---

# 体验诊断与设计拆解工作流（SR-Analysis）

## 功能说明

两段式流水线，中间由人判断：

1. **第一阶段 · 证据链分析报告**（样本边界 + 证据索引 + 体验报告 + 问题卡 + 验证建议）。这是默认产出，做完即停，交给用户看。
2. **第二阶段 · 设计拆解与复刻规格**（仅用户在报告门选择"可参考、进入拆解"后执行）。把素材中的功能设计拆成可复刻的规格，与用户迭代优化后交接 sr-gdd-human 生成功能 GDD（主线先 human 后 ai，见 sr-askme 教学主线）。

方法论直接使用内嵌方法目录 `game-experience-analyzer`（**流程入口：`references/game-experience-analyzer/METHOD.md`**，内含五门、默认流程、证据规则、输出门）。本 skill 只固化 SR 团队的项目语境、VOI 门、产出路径与 Human Gate。ED 实验交接不属于本流程，不读取、不输出 ED handoff。

注意：METHOD.md 的拆解方法声明"不要把拆解当成竞品复刻清单"。本 skill 的第二阶段**显式放宽**该约束——复刻规格是本团队的正当产出，但迁移边界仍必须保留：题材、美术、IP、具体数值、运营节奏不得原样照搬成建议。

不编造未观察到的内容——素材里看不到的，标注 `unknown` / `unsupported_by_sample`，由人决定补不补素材。

## 使用方法

```
/sr-analysis <素材路径或链接>
```

或直接说人话，例如"分析一下这段新手期录屏"、"拆一下这个竞品的 PV"、"看看这个功能能不能复刻"。

## 无输入时的行为

裸调用纪律见 `../sr-askme/references/bare-invocation.md`。本 skill 收集：

1. **素材**：截图、录屏文件、PV/宣传片、商店页或视频链接（给路径或 URL）。
2. **分析目标**（有就说，没有就在第 1 步 VOI 门现场确认）：这次诊断要改变什么决策。

提示中给出示例：`/sr-analysis 分析 D:\recordings\新手期首战.mp4 的前期体验`。用户补齐后再从第 0 步开始。

## 路径约定

`<SR_WORKSPACE>` / `<SR_PROJECT>` 取自 `%USERPROFILE%\.dsh\sr-workbench\config.local.json`；字段缺失、为空或路径失效时运行 `/sr-askme` 补齐；成组安装见 `../sr-askme/SKILL.md` §四。

## 执行流程

### 第 0 步 · 载入项目语境

读 `../sr-askme/references/sr_project_context.md`，后续全程遵守其中的写作约束。
完成判据：本次产出满足写作约束——中文、术语与项目代码命名一致、区分 RPG 战斗与 SLG 战斗；数值按 `sr_project_context.md`「数值状态词」处理：素材或样本无法确定用 `unknown`，设计需要但未落表用"待配表"，不猜数。

### 第 1 步 · 声明决策（VOI 门）

不因为素材在手就分析。先向用户确认这次诊断要改变什么决策——问题优先级、修改方案、玩家承诺修订、下一个验证测试，还是"是否值得复刻该功能"。写明：

- 不做这次分析时的默认动作
- 样本能消除的不确定性
- 什么观察信号会改变动作
- 样本**不能**证明什么

额外的截图、时间戳、对比样本不会改变优先级或下一步动作时，停止取证。

注意：即使最终目标是复刻，第一阶段的决策声明也只到"是否值得复刻"为止；**复刻哪些部分、如何改造、放弃什么**属于第二阶段的取舍，不在此承诺。
完成判据：决策声明成文，用户认可分析目标。

### 第 2 步 · 样本边界门

读 `references/game-experience-analyzer/METHOD.md`（**流程本体**），按它的 Sample Scope Gate 输出四要素：`sample_boundary`、`supported_judgment_scope`、`unsupported_judgment_scope`、`key_unknowns`。用户要求越界判断时保留问题但标 `unsupported_by_sample`。
完成判据：四要素齐全，写在报告最前面。

### 第 3 步 · 证据与诊断

按 `references/game-experience-analyzer/METHOD.md` 的「默认流程」执行（证据索引 → 诊断包路由 → 品类路由 → 判断与验证计划）；证据规则与输出门以 `METHOD.md` 对应章节为准，流程中引用的卡与模板按 `METHOD.md`「按需读取」节加载。上游方法中的 ED 实验交接分支不适用于本流程。P0/P1 判断必须引用 `evidence_id`、严格区分观察与解释、低置信度判断标 `uncertain`。
完成判据：所有 P0/P1 问题卡与核心建议都有 `evidence_id`；无证据支撑的判断已标注。

### 第 4 步 · 治理检查

按 `../sr-askme/references/governance-check.md` 做检查，在报告末尾附五条引用：

- `decision_ref`：本次素材证据要改变的产品/设计决策
- `voi_gate_ref`：哪些额外取证才会真正改变优先级
- `assumption_review_ref`：要拦截的无支撑声明、弱证据、过度自信解读
- `human_gate_refs`：需要 owner 审批的承诺、对外口径、范围变更、生产投入
- `candidate_learning_refs`：可复用的诊断规则（在跨样本重复出现前保持 candidate 状态）

完成判据：五条引用全部填写，无占位符残留。

### 第 5 步 · Human Gate（报告门）

向用户呈现选项并等待选择，不替用户做批准类决定：

```
accept_diagnosis / enter_dissection / request_more_evidence / revise_player_promise / stop
```
完成判据：用户已从上述选项中明确选择其一；选择前不进入拆解、不输出交接。

- `accept_diagnosis`：用户认可诊断结论，第一阶段收尾，流程结束（不进入拆解）。
- `enter_dissection` = 用户看完报告，判定该功能**可参考、值得拆解复刻**，进入第 6 步。这是两阶段之间唯一的入口，不得默认进入。
- `request_more_evidence`：列出最小补充素材清单，用户补齐后回到第 2 步。
- `revise_player_promise`：把报告中的玩家承诺修订项带回给承诺产出方（sr-concept 案例或人工），本流程结束。
- 选择后按 `../sr-askme/references/decision-recording.md` **追加一条决策记录**：`**决策**：` 写这次拍板（accept_diagnosis / stop / request_more_evidence / revise_player_promise / enter_dissection）与它改了什么；`**依据**` 写证据链里的哪一条支撑这个判断；`**影响**` 写要改的产出与下游。

### 第 6 步 · 设计拆解与复刻规格（仅 enter_dissection 后）

进入方法目录的游戏拆解诊断：读 `references/game-experience-analyzer/references/game-dissection-diagnosis.zh-CN.md`，以 `transfer_mechanic` 为拆解目标执行（玩家动词、动作-目标对齐、不确定性来源、系统动态、内容流、迁移边界），不使用 `early_experience` 默认模式。

产出**复刻规格**（产出路径见文末产出规范表），必备章节：

- **功能规则候选**：每条绑定 `evidence_id`，并按项目语境显式标注 已验证事实 / 推断 / unknown
- **UI 结构与交互流程**：界面层级、操作序列、反馈节奏
- **数值表现**：素材中观察到的数值；观察不到的一律标 `unknown` 或"待配表"，遵守数值铁律，禁止猜数
- **推断配置项**：复刻需要的配置字段清单，标"待配表"
- **迁移边界**：可迁移的结构 vs 依赖题材/美术/IP/具体数值/运营节奏、不可照搬的部分
- **待裁决取舍清单**：复刻/改造/放弃三分类中需要用户拍板的条目（每条给候选方案 + 推荐 + 理由）

规格初稿出来后与用户迭代优化取舍，直到用户认可。迭代期间用户每轮拍板/纠偏，先按 `../sr-askme/references/calibration-recording.md` 实时追加一条校准记录，再继续修改规格。
完成判据：复刻规格六章节齐全；每条规则有 `evidence_id` 或显式标注；待裁决取舍已获用户逐条拍板。

### 第 7 步 · Human Gate（交接门）

向用户呈现选项并等待选择：

```
route_to_gdd / revise_spec / stop
```
完成判据：用户已从上述选项中明确选择其一；选择前不生成交接材料。

- `route_to_gdd`：输出 GDD 交接 JSON（产出路径见产出规范表），交接目标为 `sr-gdd-human`，内容为材料清单：复刻规格路径、证据索引路径、样本边界、迁移边界、已拍板取舍、遗留 unknown 与置信度。sr-gdd-human 第 1 步资产盘点可直接从 `<功能目录>\analysis\` 拾取这些材料。
- 决策记录按 `../sr-askme/references/decision-recording.md` 追加：`**决策**：` 写这次拍板（route_to_gdd / stop / revise_spec）与复刻规格的结论。

## 产出规范

| 产出 | 路径（`<SR_WORKSPACE>\` 下） |
|------|------|
| 证据包（source-boundary、evidence-index、时间戳账本） | `evidence\<主题>\` |
| 体验报告 | `analysis\experience-report_<主题>_<日期>.md` |
| 问题卡 | `analysis\issue-cards_<主题>_<日期>.json` |
| 复刻规格（仅 enter_dissection 后） | `analysis\replication-spec_<主题>_<日期>.md` |
| GDD 交接（仅 route_to_gdd 时，交接目标 sr-gdd-human） | `analysis\sr-gdd-handoff_<主题>_<日期>.json` |
| 决策记录 | `<功能目录>\decisions\决策记录.md`（追加；格式见 `../sr-askme/references/decision-recording.md`） |
| **历史版本** | 改写已有产物**之前**留的那一版：产物同目录 `<原名>_<YYYYMMDD>_<序号>.<ext>`（口径与命令见 `../sr-askme/references/version-history.md`） |

目录不存在时直接创建。日期格式 `YYYYMMDD`。

## 内嵌资源

- `references/game-experience-analyzer/METHOD.md`（**流程本体、唯一事实源**：五门核心方法、默认流程、输入源与边界、证据规则、输出门、按需读取）
- `references/game-experience-analyzer/`（同目录 13 个 references/ 与 14 个 templates/ **全部随包**）
- 共享语境与决策规范不复制副本，从 `../sr-askme/references/` 读取。
