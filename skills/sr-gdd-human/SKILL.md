---
name: sr-gdd-human
description: 功能 GDD 成稿工作流——把入口产出（sr-concept 设计稿 / sr-analysis 复刻规格 / 旧案）落成**只有纯规则与设计**的成稿（不含任何配置内容），决策留痕在附录 A，供审核确认；它同时是 `/sr-config` 派生配置字段的唯一依据。当用户说"写成稿、写策划案、出 GDD、设计提案、功能文档、出人类可读版"时使用（出**正式版/定稿**走 sr-gdd-ai）。
---

# 功能 GDD 成稿工作流（SR-GDD-Human）

## 功能说明

**唯一输出：功能 GDD 成稿**（中间产物）。上游材料在这里第一次落成完整的功能 GDD：

- **结果章 §1–§12**（功能意图 / 玩家动词 / 核心循环 / 功能规则 / 界面流程 / 范围门 / 埋点 / 验证计划 / 验收标准 / 交接清单 / 数值待定项 / 已废弃口径）**只有纯规则与设计**——规则是什么、界面长什么样、怎么验收，按「撰写纪律」写，**不含任何配置内容**；
- **附录 A** 承载决策留痕（来源材料 / 概念种子 / 设计核 / 玩家承诺 / 假设台账 / 风险台账 / 待确认问题 / 未支持声明 / 治理引用），按台账格式填写，供审核确认与下游溯源。

**这份规则是配置表的唯一设计依据**：`/sr-config` 从 §4 的规则**派生**配置字段与记录——规则写不清，字段就落不了地。**定稿产出前，设计内容（规则与界面）的撰写地在这里**：定稿发现规则/界面/范围/验收的设计问题，按「修订路由」带清单退回这里定向修订。**定稿通过后本成稿归档废弃**——此后设计微调、字段对应调整、文本改动都走 `sr-gdd-fix`（改完的复审按 `../sr-askme/references/gdd-pipeline.md` §四 **分级**；直接编辑定稿属例外，**不走 fix 也就不触发那套复审**）。

与配置表、`sr-gdd-ai` 定稿的分工、章节对应、两道 Human Gate 与退回方式：**权威定义在 `../sr-askme/references/gdd-pipeline.md`**（第 0 步读入，本文件不复述）。一句话判据——成稿只有纯规则与设计（零配置指代）+ 全部决策留痕；配置字段由 `/sr-config` 从这些规则派生；定稿综合两侧整合并据定稿列出多语言文本条目。

形态基准：`resources/templates/feature-gdd-human.md`。新建成稿沿用模板顶部头部（`doc_type: draft_gdd` + `status: draft`）；定稿通过后按生命周期契约将成稿标为 `archived`。

## 使用方法

```
/sr-gdd-human <主题或材料路径>
```

或直接说人话，例如"把这份复刻规格整理成功能 GDD（人类可读版）"、"基于英雄改造v0.2.xlsx 出一份人类可读的成稿"。

## 无输入时的行为

裸调用纪律见 `../sr-askme/references/bare-invocation.md`。本 skill 收集：

1. **主题**：要写哪个功能的 GDD。
2. **上游材料**（有就给路径，没有就明说没有）：sr-concept 功能设计稿 / sr-analysis 复刻规格（或其 GDD 交接 JSON）/ 旧策划案 / 脑图 / 体验记录 / 界面参考截图 / 相关决议。材料薄不阻塞，最低输入是主题 + 能支撑规则粒度的描述；缺的取舍会以极简方式向用户确认（只问"选哪个"，不带证据论述）。

## 路径约定

`<SR_WORKSPACE>` / `<SR_PROJECT>` 取自 `%USERPROFILE%\.dsh\sr-workbench\config.local.json`；字段缺失、为空或路径失效时运行 `/sr-askme` 补齐；成组安装见 `../sr-askme/SKILL.md` §四。**`<功能目录>` = `<SR_WORKSPACE>\features\<主题>\`** —— 一个功能的全部工作都在它里面；从策划工作台进来的会话，工作目录就是它。
GDD 进 `gdd\`、决策记录进 `decisions\决策记录.md`，与 `sr-gdd-ai` 一致。

## 撰写纪律（第 3、4 步的判据来源）

**见 `../sr-askme/references/gdd-writing-discipline.md`**（第 0 步读入；本 skill 按其「适用」列取成稿侧条目；同一套纪律也用于 `sr-gdd-fix` 改定稿）。本文件不复制条文、不引用编号——条目内容、判据与编号一律以该文件为准。

## 执行流程

### 第 0 步 · 载入项目语境与撰写纪律

读四份文件：`../sr-askme/references/sr_project_context.md`（项目语境与写作约束）、`../sr-askme/references/gdd-pipeline.md`（三份产出契约与退回方式）、`../sr-askme/references/gdd-writing-discipline.md`（撰写纪律，取成稿侧适用项）、`../sr-askme/references/evidence-boundary.md`（证据边界）。数值铁律在本 skill 下的执行方式即纪律文件中的数值条目（成稿侧变体）。
完成判据：语境已生效——数值按纪律文件成稿侧变体与 `sr_project_context.md`「数值状态词」写成机制表述（"每 N 次"式）与"（参考值 X，待定）"，结果章零配置指代（核对点：第 4 步自查）。

### 第 1 步 · 资产盘点

列出用户提供的与 workspace 已有的上游材料，盘点范围：入口产出（sr-concept 功能设计稿 / sr-analysis 复刻规格及其 GDD 交接 JSON `analysis\sr-gdd-handoff_*.json`）、旧策划案、脑图/提纲、体验记录/竞品笔记、界面/UE 草稿、本功能的决策记录（`decisions\决策记录.md`）、配置表（.xlsx）。只盘点信息充分性。

**上游含交接 JSON / 功能设计稿 / 复刻规格时**：其中已拍板的取舍直接作为本文档的既定口径（不重新问、不写拍板过程）；其"配置项预测"不进本成稿——`/sr-config` 从 §4 的规则派生出字段，本 skill 只在 §11 体现待定名称。
完成判据：材料清单（内部备忘）。

### 第 2 步 · 关键取舍确认（极简决议问答）

只对**会改变规则走向**的取舍问用户（VOI 门：不改变规则走向的缺失标"可选"，不阻塞、不追问），每条给候选 + 推荐 + 一句话理由，请用户拍板。只给结论，不展开论证——用户要的是结果文档。材料充分时跳过本步。缺材料时列最小缺失清单，由人决定补不补（按纪律文件证据条目）。
完成判据：关键取舍已获用户拍板（或有意识的默认选择已告知用户）。

### 第 3 步 · 撰写

以 `resources/templates/feature-gdd-human.md` 为章节骨架与形态基准撰写：结果章 §1–§12 在前，附录 A 在后。逐条执行「撰写纪律」的成稿侧适用项。附录 A.9 治理引用五条按 `../sr-askme/references/governance-check.md` 填写，不留占位符。
完成判据：模板每一节都有实质内容或显式标注；撰写纪律成稿侧适用项逐条满足；附录 A 各台账已填。

### 第 4 步 · 自查

通读全稿，按 `../sr-askme/references/gdd-writing-discipline.md` 的成稿侧适用项逐条核对并修正——每条的「判据」列就是核对标准（该文件是唯一出处，此处不复制）。另外核对两条本 skill 特有项：

- [ ] 结果章无来源标注、证据编号、拍板编号、配置契约散落
- [ ] 未定数值都集中在 §11

完成判据：清单全部通过；不过关则修订后复查。

### 第 5 步 · Human Gate

向用户呈现成稿并等待选择：

```
approve / approve_with_conditions / revise / reject
```

**呈门时必须逐项念主线的可选下一步**（`../sr-askme/references/使用说明.md` 主线第 3 步）：① **配置表** —— `/sr-config` 从 §4 规则派生字段与记录；② **线框图** —— 把 §5 的 ASCII 线框图换成真线框图（需人工出图或先挂 figma MCP；替换 UI 可能带来功能改动，故要落回 GDD）。两项都是**可选**，做不做由用户拍板；但"可选"不等于可以不提 —— **只提一项、或凭记忆组选项而漏掉另一项，都算本步没做完**。

成稿呈现后用户提出修订或拍板时（revise 循环及任何门内迭代）：每轮先按 `../sr-askme/references/calibration-recording.md` 实时追加一条校准记录，再修成稿、再呈门。

完成判据：用户已从上述选项中明确选择其一；**用户没表态之前不许替他写任何决策** —— 但用户每给一次拍板或纠偏，就按 `../sr-askme/references/decision-recording.md` 当场追加一条（门内迭代也各记一条）。

本门是**一次性**的：成稿审核通过 → `/sr-config` 派生配置 → `sr-gdd-ai` 整合出定稿 → 定稿通过后**本成稿归档废弃**，此后修改直接落定稿。

本 skill 不设 `request_missing_evidence` 选项——缺材料在第 2 步已问过。用户选择后按 `../sr-askme/references/decision-recording.md` **追加一条决策记录**：`**决策**：` 写这次拍板（approve / approve_with_conditions / revise / reject）与成稿结论，条件写在同一句里；`**影响**` 写成稿状态与要改的章节。门内的每一轮 revise 也各记一条（见 `calibration-recording.md`）。

## 产出规范

| 产出 | 路径（`<SR_WORKSPACE>\` 下） |
|------|------|
| 功能 GDD 成稿 | `<功能目录>\gdd\<主题>_成稿.md`（**不带日期**） |
| 修订点清单（仅被定稿退回时） | `<功能目录>\gdd\<主题>_<日期>_修订点.md` |
| 决策记录 | `<功能目录>\decisions\决策记录.md`（**追加**一条；格式见 `../sr-askme/references/decision-recording.md`） |
| **历史版本** | 改写已有产物**之前**留的那一版：产物同目录 `<原名>_<YYYYMMDD>_<序号>.<ext>`（口径与命令见 `../sr-askme/references/version-history.md`） |

日期格式 `YYYYMMDD`。目录不存在时创建。

## 上游依赖（只读，勿改）

- `resources/templates/feature-gdd-human.md`（本 skill 自有形态基准）
- 共享语境与决策规范不复制副本，从 `../sr-askme/references/` 读取（各文件谁读哪份见 `../sr-askme/SKILL.md` §三）。
