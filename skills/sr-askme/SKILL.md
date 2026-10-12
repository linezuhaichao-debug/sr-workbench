---
name: sr-askme
description: sr 系列 skill 的配置与使用教学：首次用 sr-* 时（config.local.json 缺失或字段为空）一次问清并固化 workspace、Unity 工程、策划配置目录等本机路径；也用于回答"sr 系列有哪些 skill、怎么用、流程是什么"。当用户说"/sr-askme"、"配置 sr 系列"、"sr 系列怎么用"时使用。
---

# SR-AskMe：sr 系列的配置与使用教学

本 skill 是 SR 团队工作流 skill（`sr-concept` / `sr-analysis` / `sr-gdd-human` / `sr-gdd-ai` / `sr-gdd-fix` / `sr-gdd-review` / `sr-gdd-ue` / `sr-gdd-html` / `sr-config` / `sr-gtgenerator`）的**共享基础设施**：**配置**与**教学**。它自己不产出策划内容。

## 一、本机配置（一处契约）

**位置**：`%USERPROFILE%\.dsh\sr-workbench\config.local.json`（本机私有，**不入库、不进技能目录** —— 技能随插件装在 `node_modules` 下，写那儿升级即丢）。字段与格式参照同目录的 `config.local.example.json`。

**谁写**：① 插件界面的**配置向导**（同事第一次用、你重装之后都走它；能填、也能回读验证）；② 本 skill（用户直接说"配置 sr 系列"，或任何 sr-* skill 发现配置缺失时）。

| 字段 | 占位符 | 谁读它 |
| --- | --- | --- |
| `sr_workspace` | `<SR_WORKSPACE>` | 全部 sr-* skill |
| `sr_project` | `<SR_PROJECT>` | 全部 sr-* skill 的数值铁律、sr-config 的配置说明 |
| `config_root` | — | sr-config |
| `gtgenerator_workdir` | — | sr-gtgenerator |
| `configured_at` | — | 提示信息 |

**引导口径**：把缺失/失效的字段**一次问完**（每项说明用途；路径一律由用户提供 —— 本机路径只有用户知道），写盘后**回读核对**。出现**字段缺失、为空、或路径失效**（`sr_project` 找不到）时，任何 sr-* skill 一律调 `/sr-askme`，**不自行猜路径**。

## 二、使用教学（正文在 `references/使用说明.md`）

用户问"sr 系列怎么用"、"有哪些 skill"、"/sr-concept 是什么"时：**读 `references/使用说明.md`，按原文讲** —— 不要在这里、也不要在记忆里另起一份（两份教学内容一定会漂移）。要更细的用法再展开 `references/teaching/` 下对应的使用卡（与各工作流 skill 一一对应；`sr-askme` 自身不设卡）。

★ 那份 md 同时是面板〔使用说明〕弹窗（2026-10-10 由〔技能用法〕改名）的正文：构建期由 `npm run gen:teaching` 快照进 `src/generated/teaching.js`，弹窗**按 md 原样渲染**；`npm run check:teaching` 盯住"快照 == 该 md 的字节"。

## 三、产出落盘位置（**一个功能一个目录**，里面只有 4 个桶）

每个功能的工作全部落在 **`<功能目录>` = `<SR_WORKSPACE>\features\<主题>\`** 这一个目录里（从策划工作台进入的会话，工作目录**就是**它）。产物按"谁产生 / 给谁看"落进 4 个桶：

| 桶 | 装什么 | 典型产出 |
| --- | --- | --- |
| `evidence\` | **进来的原件 + 过程证据** | 竞品截图/录屏/PV · 旧文档原件 · 外部交付包 `UE交付_<日期>\` · 抽帧与证据包 · 校准流水 `calibration_<主题>.jsonl` |
| `analysis\` | **想出来的内容** | 设计核三角报告 · 功能设计稿 · 体验报告 · 问题卡 · 复刻规格 · 各类交接 JSON · 旧文档分析 · 人工补充 |
| `gdd\` | **写出来的正文与交付物** | 成稿 `<主题>_成稿.md` · 定稿 `<主题>_定稿.md` · 修订点清单 · 审查报告 `<主题>_<日期>_审查.md` · **UE 界面稿 `<主题>_UE.html`（+ `.content.json`）** · 宣讲 HTML `<主题>_宣讲.html`（+ 草稿 `<主题>_宣讲.md`）（**一律不带日期** —— 日期只出现在历史版本后缀里，见 `references/version-history.md`） |
| `decisions\` | **定下来的事** | `决策记录.md` —— **一个功能只有一个决策文件**，所有决策按时间追加（见 `references/decision-recording.md`） |

★ 旧口径里的 `source\` 并入 `evidence\`、`delivery\` 并入 `gdd\`；工作区根下平铺的 `proposals\ analysis\ decisions\ evidence\` 是**历史结构**，新工作一律进功能目录。

★ 给人看的那份摘要（连同一句话的主线）在 `references/使用说明.md`；**纪律口径以本节为准**。

## 四、共享语境文件（供其它 sr-* skill 引用）

全系列**只此一份**，各 skill 按相对路径引用（`../sr-askme/references/<文件>`），不复制副本。

| 文件 | 内容 | 引用方（按各 skill 自身指针实测） |
| --- | --- | --- |
| `references/sr_project_context.md` | 项目语境：数值铁律、写作约束、受众默认 | sr-concept / sr-analysis / sr-gdd-human / sr-gdd-ai / sr-gdd-fix / sr-gdd-review / sr-gdd-ue / sr-gdd-html / sr-gtgenerator 第 0 步；sr-config 只取路径（`config_root`）与配置说明口径，不读本文；`skill-hero-config` 也不读 |
| `references/gdd-pipeline.md` | 成稿 / 配置表 / 定稿三份产出契约：分工、生命周期、章节对应、两道门、退回方式 | sr-gdd-human / sr-gdd-ai / sr-gdd-fix / sr-gdd-review 第 0 步；sr-config 按需（派生依据） |
| `references/gdd-writing-discipline.md` | GDD 撰写纪律（成稿 / 定稿共用；编号与判据的唯一出处，按 `适用` 列取用） | sr-gdd-human / sr-gdd-fix 第 0 步；sr-gdd-ai / sr-gdd-review 第 0 步（按适用列自查 / 作审查基准，不复制编号） |
| `references/evidence-boundary.md` | 证据边界：来源标签、Evidence Ledger、证据优先级、轻量标注、高风险断言 | sr-gdd-human 第 0 步（填附录 A 台账用全篇）；sr-gdd-ai / sr-gdd-fix / sr-gdd-review 第 0 步（只用「轻量标注」）；sr-concept / sr-analysis 未挂指针——其内嵌方法卡自带同类规则，按需自取 |
| `references/governance-check.md` | 治理检查五条规则 + 治理引用五条 | sr-concept 第 3 步 / sr-analysis 第 4 步；sr-gdd-human 写附录 A.9 时；sr-gdd-ai 仅直接调用路径（结论随决策记录留档，定稿不设治理引用节） |
| `references/decision-recording.md` | 决策记录写入规范：**一个功能只有一个决策文件** `decisions\决策记录.md`，条目 = 时间（年月日时分秒）+ 决策内容；什么时候写、怎么写、写完怎么说 | **10 个 sr-* skill 全部挂了指针**（在「按需读取」或第 0 步的共享语境清单里）；配套技能 `skill-hero-config` 也挂了 —— v5 起**不止 Human Gate**：只要定下了一件事就记 |
| `references/version-history.md` | **产物历史版本**：每次**改写已有产物之前**先存一版，命名 `<原名>_<YYYYMMDD>_<序号>.<ext>`；什么时候存、放哪、命令、与 `.backup.` 的区别 | 会改写产物的 skill：sr-concept / sr-analysis / sr-gdd-human / sr-gdd-ai / sr-gdd-fix / sr-gdd-review / sr-gdd-ue / sr-gdd-html / sr-gtgenerator 的「产出规范」节；**sr-config 不用手跑**（写入引擎自动留）；工具 `tools/history_snapshot.py` |
| `references/bare-invocation.md` | 裸调用行为：先说明需要什么输入再停下等用户 | sr-concept / sr-analysis / sr-gdd-human / sr-gdd-ai / sr-gdd-fix / sr-gdd-review / sr-gdd-ue / sr-gdd-html 的「无输入时的行为」节；config 系三个 skill 无此节 |
| `references/calibration-recording.md` | 校准记录：Gate 前用户迭代输入的实时留痕（触发时机、jsonl 格式、会话恢复） | sr-concept 第 5 步 / sr-analysis 第 6 步（设计稿与规格迭代循环）；sr-gdd-human 第 5 步 / sr-gdd-ai 第 6 步（门内 revise 循环）；无迭代循环的 skill 不写 |
| `references/使用说明.md` | **使用教学正文**（给人看的那份）：主线五步、旁支、skill 一览、术语、产出落盘摘要、两条共用规矩的指针 | sr-askme 自己（用户问用法时**按原文讲**）；面板〔使用说明〕弹窗（构建期快照，见 `tools/gen-teaching.mjs`）—— 其它 sr-* skill 不引用它 |

本区文件缺失（未成组安装）时，各 skill 第 0 步读不到共享文件：向用户报告缺的是 sr-askme 的兄弟目录，并说明**整套 sr-* 技能随插件分发**（见 §五）。

## 五、安装形态

sr 系列**整套**随策划工作台插件分发（插件包内 `skills/`，正文与 `references/` 同源同包）—— 用户不需要单独安装技能；`config.local.json` 也不放技能目录（见 §一）。
