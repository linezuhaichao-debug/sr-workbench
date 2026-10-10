---
name: sr-askme
description: sr 系列 skill 的配置与使用教学：首次用 sr-* 时（config.local.json 缺失或字段为空）一次问清并固化 workspace、Unity 工程、策划配置目录等本机路径；也用于回答"sr 系列有哪些 skill、怎么用、流程是什么"。当用户说"/sr-askme"、"配置 sr 系列"、"sr 系列怎么用"时使用。
---

# SR-AskMe：sr 系列的配置与使用教学

本 skill 是 SR 团队工作流 skill（`sr-concept` / `sr-analysis` / `sr-gdd-human` / `sr-gdd-ai` / `sr-gdd-fix` / `sr-gdd-review` / `sr-gdd-html` / `sr-config` / `sr-gtgenerator`）的**共享基础设施**：**配置**与**教学**。它自己不产出策划内容。

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

## 二、使用教学

用户问"sr 系列怎么用"、"有哪些 skill"、"/sr-concept 是什么"时，先给下面这段主线，再按需展开 `references/teaching/` 下对应用卡。使用卡与各工作流 skill 一一对应（`sr-askme` 自身不设卡）。

### 推荐用法（教学时的固定口径）

**主线**：五个步骤，从头脑风暴走到正式 UE 回写：

1. **头脑风暴（四个入口）**：竞品分析 `/sr-analysis` · 问答式访谈 `/sr-concept` · 旧文档分析 · 人工补充——手里是什么材料就从哪个入口进，产出落 `analysis\`。
2. **成稿**：`/sr-gdd-human` 出**成稿**——只有纯规则与界面（零配置指代），全部决策留痕在附录 A，供你审核确认；**这一步期间可以反复改**。
3. **可选的两件事**（需要时才做；**不做也能直接进第 4 步**；两件都可以做、也可以只做一件）：
   - `□` 从成稿**生成配置表**：`/sr-config` 从成稿的规则**派生**配置表字段与记录（新表/加字段/改记录，带读回验收）；
   - `□` 把成稿里的 **ASCII 界面 UI 换成真实 UI**：**没有对应技能，人工做**；替换 UI 可能带来功能改动。
4. **输出定稿**：`/sr-gdd-ai` 把 **成稿 + 配置表**综合整合成**定稿**（功能规则、界面、配置契约、多语言文本、验收标准），并据定稿列出多语言文本条目；主线在定稿门之前**必经一道定稿审查**（`/sr-gdd-review` 出审查报告，随定稿一并呈门）。**定稿之后仍然可以改**——改走 `/sr-gdd-fix`（涉及配置表就调 `/sr-config` 改表并同步对应行）。**主线定稿通过后状态为 `active`、成稿归档**。直接调用只产出 `provisional` 工作版或 `blocked` 产物（不做审查）。
5. **正式 UE 回写**：把定稿真正落到工程里——**没有对应技能，人工做**。

**旁支（不在主线上，需要时单独用）**：宣讲网页 `/sr-gdd-html`（**用户调用型**，只能由人输入触发，agent 不会自动接手）；GT 工具配置多语言 `/sr-gtgenerator`；定稿审查 `/sr-gdd-review`（主线里由 `/sr-gdd-ai` 自动带上，改完定稿要复审时才单独用）。

**以上是推荐顺序；全部 skill 也都可以单独调用**（如直接 `/sr-gdd-ai 基于 旧策划案.xlsx 出功能 GDD`），但直接调用只产出 `provisional` 工作版（材料不足时 `blocked`），**不能替代主线 `active` 定稿**。

**术语**：**成稿** = `/sr-gdd-human` 的产出（只有纯规则；定稿通过后归档）；**配置表** = `/sr-config` 从成稿规则派生的运行时配置数据；**定稿** = `/sr-gdd-ai` 主线路径整合出的**最终交付物**，通过后是**唯一的活文档**。三者分工、章节对应、两道门与退回方式见 `references/gdd-pipeline.md`。

### skill 一览

| skill | 干什么 | 关键产出 |
| --- | --- | --- |
| `sr-concept` | 一句话创意 → 设计核候选报告 → 你拍板 → 完整功能设计 | 设计稿（`analysis\`） |
| `sr-analysis` | 录屏/截图/PV 素材 → 证据链分析报告 → 你判定 → 复刻规格 | 分析报告 / 复刻规格（`analysis\`） |
| `sr-gdd-human` | 把入口产出落成**成稿**：只有纯规则与设计，决策留痕在附录 A，供你审核 | 成稿（`gdd\`） |
| `sr-config` | 从成稿规则**派生**配置字段与记录，最小事务写入，读回验收 | 配置工作簿（`gdd\`） |
| `sr-gdd-ai` | 把成稿 + 配置表**整合成定稿**：程序可实现的粒度，含配置契约与多语言文本条目 | 定稿（`gdd\`） |
| `sr-gdd-fix` | 定稿通过后的**唯一改动入口**：影响面扫描 + 最小编辑 + 决策记录 | 定稿原地更新 |
| `sr-gdd-html` | 把定稿重排成评审会用的**单文件宣讲 HTML**（用户手动触发） | 宣讲稿（`gdd\`） |
| `sr-gtgenerator` | GID 类型与多语言文本的增删改、翻译合并、导出 string_zh_CN 等 | `gtypes.xml` / `normaltxt.xml` |

（触发词以各 skill 自己的 `description` 为准；`sr-gdd-review` 是主线里由 `/sr-gdd-ai` 自动带上的定稿审查，不出现在这张表里。）

**独立技能**（不在主线，需要时单独用）：`/sr-gtgenerator`、`/sr-gdd-review`（定稿审查，只读出报告）、`/sr-gdd-fix`（定稿之后的改动入口）。

### 产出落盘位置（**一个功能一个目录**，里面只有 4 个桶）

每个功能的工作全部落在 **`<功能目录>` = `<SR_WORKSPACE>\features\<主题>\`** 这一个目录里（从策划工作台进入的会话，工作目录**就是**它）。产物按"谁产生 / 给谁看"落进 4 个桶：

| 桶 | 装什么 | 典型产出 |
| --- | --- | --- |
| `evidence\` | **进来的原件 + 过程证据** | 竞品截图/录屏/PV · 旧文档原件 · 外部交付包 `UE交付_<日期>\` · 抽帧与证据包 · 校准流水 `calibration_<主题>.jsonl` |
| `analysis\` | **想出来的内容** | 设计核三角报告 · 功能设计稿 · 体验报告 · 问题卡 · 复刻规格 · 各类交接 JSON · 旧文档分析 · 人工补充 |
| `gdd\` | **写出来的正文与交付物** | 成稿 `<主题>_<日期>.md` · 定稿 `<主题>_<日期>_定稿.md` · 修订点清单 · 审查报告 `<主题>_<日期>_审查.md` · 评审宣讲 HTML（+ content.json） |
| `decisions\` | **定下来的事** | `决策记录.md` —— **一个功能只有一个决策文件**，所有决策按时间追加（见 `references/decision-recording.md`） |

★ 旧口径里的 `source\` 并入 `evidence\`、`delivery\` 并入 `gdd\`；工作区根下平铺的 `proposals\ analysis\ decisions\ evidence\` 是**历史结构**，新工作一律进功能目录。

### 数值铁律（各 skill 产出共同遵守）

完整约束见 `references/sr_project_context.md`（各 skill 第 0 步载入的同一份文件）；正文行内四类标注（`【推断】`、`待确认：`、`[真实]`、`[示例]`）见 `references/evidence-boundary.md`「轻量标注」——两处均不另存副本。

## 三、共享语境文件（供其它 sr-* skill 引用）

全系列**只此一份**，各 skill 按相对路径引用（`../sr-askme/references/<文件>`），不复制副本。

| 文件 | 内容 | 引用方（按各 skill 自身指针实测） |
| --- | --- | --- |
| `references/sr_project_context.md` | 项目语境：数值铁律、写作约束、受众默认 | sr-concept / sr-analysis / sr-gdd-human / sr-gdd-ai / sr-gdd-fix / sr-gdd-review / sr-gdd-html / sr-gtgenerator 第 0 步；sr-config 只取路径（`config_root`）与配置说明口径，不读本文；`skill-hero-config` 也不读 |
| `references/gdd-pipeline.md` | 成稿 / 配置表 / 定稿三份产出契约：分工、生命周期、章节对应、两道门、退回方式 | sr-gdd-human / sr-gdd-ai / sr-gdd-fix / sr-gdd-review 第 0 步；sr-config 按需（派生依据） |
| `references/gdd-writing-discipline.md` | GDD 撰写纪律（成稿 / 定稿共用；编号与判据的唯一出处，按 `适用` 列取用） | sr-gdd-human / sr-gdd-fix 第 0 步；sr-gdd-ai / sr-gdd-review 第 0 步（按适用列自查 / 作审查基准，不复制编号） |
| `references/evidence-boundary.md` | 证据边界：来源标签、Evidence Ledger、证据优先级、轻量标注、高风险断言 | sr-gdd-human 第 0 步（填附录 A 台账用全篇）；sr-gdd-ai / sr-gdd-fix / sr-gdd-review 第 0 步（只用「轻量标注」）；sr-concept / sr-analysis 未挂指针——其内嵌方法卡自带同类规则，按需自取 |
| `references/governance-check.md` | 治理检查五条规则 + 治理引用五条 | sr-concept 第 3 步 / sr-analysis 第 4 步；sr-gdd-human 写附录 A.9 时；sr-gdd-ai 仅直接调用路径（结论随决策记录留档，定稿不设治理引用节） |
| `references/decision-recording.md` | 决策记录写入规范：**一个功能只有一个决策文件** `decisions\决策记录.md`，条目 = 时间（年月日时分秒）+ 决策内容；什么时候写、怎么写、写完怎么说 | **10 个 sr-* skill 全部挂了指针**（在「按需读取」或第 0 步的共享语境清单里）；配套技能 `skill-hero-config` 也挂了 —— v5 起**不止 Human Gate**：只要定下了一件事就记 |
| `references/bare-invocation.md` | 裸调用行为：先说明需要什么输入再停下等用户 | sr-concept / sr-analysis / sr-gdd-human / sr-gdd-ai / sr-gdd-fix / sr-gdd-review / sr-gdd-html 的「无输入时的行为」节；config 系三个 skill 无此节 |
| `references/calibration-recording.md` | 校准记录：Gate 前用户迭代输入的实时留痕（触发时机、jsonl 格式、会话恢复） | sr-concept 第 5 步 / sr-analysis 第 6 步（设计稿与规格迭代循环）；sr-gdd-human 第 5 步 / sr-gdd-ai 第 6 步（门内 revise 循环）；无迭代循环的 skill 不写 |

本区文件缺失（未成组安装）时，各 skill 第 0 步读不到共享文件：向用户报告缺的是 sr-askme 的兄弟目录，并说明**整套 sr-* 技能随插件分发**（见 §四）。

## 四、安装形态

sr 系列**整套**随策划工作台插件分发（插件包内 `skills/`，正文与 `references/` 同源同包）—— 用户不需要单独安装技能；`config.local.json` 也不放技能目录（见 §一）。
