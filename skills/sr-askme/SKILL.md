---
name: sr-askme
description: sr 系列 skill 的配置引导与使用教学：首次用 sr-* 时（config.local.json 缺失或字段为空）一次问清并固化 workspace、Unity 工程、策划配置目录等本机路径；也用于回答"sr 系列有哪些 skill、怎么用、流程是什么"。当用户说"/sr-askme"、"配置 sr 系列"、"sr 系列怎么用"时使用。
---

# SR-AskMe：sr 系列配置引导与使用教学

本 skill 是 SR 团队工作流 skill（sr-concept / sr-analysis / sr-gdd-human / sr-gdd-ai / sr-gdd-fix / sr-gdd-review / sr-gdd-html / sr-config / sr-gtgenerator —— **共 10 个**）的**共享基础设施**，承担两件事：

1. **首次配置引导**：问清并固化本机路径，写 `config.local.json`；
2. **使用教学**：给出主线讲解，按需展开 `references/teaching/` 下的使用卡。

它同时是**共享语境宿主**：其余 sr-* skill 第 0 步读本 skill `references/` 下的共享文件（清单见 §三）。

## 一、首次配置引导（核心流程）

**触发**：任何 sr-* skill 执行时，第 0 步先检查本目录 `config.local.json`。字段齐全、且 `sr_project` 指向的工程目录存在时**直接采用、不再询问**；出现下列任一情况则走下面的引导——**字段缺失、字段为空、路径失效**（`sr_project` 找不到，或 `sr_workspace` 不存在且创建失败）。各 skill 遇到这三种情况一律调 `/sr-askme`，不自行猜路径。用户直接说"/sr-askme"或"配置 sr 系列"时也进入本流程。

**配置文件**：本目录下 `config.local.json`（含本机私有路径，不入仓库；参照同目录 `config.local.example.json` 创建；安装/镜像更新不覆盖它）。

### 引导步骤

1. **读 schema**：读 `config.local.example.json`，拿到字段、必填标记与格式。必需字段是 `sr_workspace` 与 `sr_project`（`config_root` 仅 `/sr-config` 需要，`gtgenerator_workdir` 可选）。
2. **一次问完**：把缺失或失效的字段一次列给用户，每项说明用途，**路径一律由用户提供**（本机路径只有用户知道）：
   - `sr_workspace`：策划工作区根（下挂 `features\<主题>\`，每个功能里再分 `evidence\ analysis\ gdd\ decisions\` 四个桶，自动创建）；
   - `sr_project`：Unity 工程根目录（含 `Assets/`，配表与文本表所在）；
   - `config_root`：策划配置 `.xlsx/.xlsm` 根目录（仅 sr-config 使用）；
   - `gtgenerator_workdir`：GTGenerator 工作目录（含 `gtypes.xml`/`normaltxt.xml`；仅 sr-gtgenerator 使用，可选——用户不用该 skill 就留空，留空后由 sr-gtgenerator 首次使用时补齐）。
3. **写入并固化**：写本目录 `config.local.json`（JSON，路径用原生分隔符，`configured_at` 填当天 `YYYYMMDD`），并同步生成 `../sr-config/profiles/timemachine.local.yaml`（按同目录 `timemachine.local.example.yaml` 的四行结构，填 `config_root` 与 `verified_at`）。**`config_root` 以 `config.local.json` 为准**，yaml 是 sr-config 的本机副本，两者不一致时按 `config.local.json` 回写。写完后告知用户："已固化，下次不再询问。改路径直接编辑这两个文件，或删掉后重新运行 /sr-askme。"

完成判据：两份文件均已写入、必需字段齐全，且改法已告知用户。

★ 这一步也是**决策**（工作区根、工程根、配置根这些口径定下来了）：如果这次引导是**在某个功能的工作会话里**为这个功能做的，按 `references/decision-recording.md` 追加一条到该功能的 `decisions\决策记录.md`（不在功能会话里就跳过 —— 那是全局配置，不属于任何功能）。

### 字段消费方

| 字段 | 占位符 | 谁读它 |
| --- | --- | --- |
| `sr_workspace` | `<SR_WORKSPACE>` | 全部 sr-* skill |
| `sr_project` | `<SR_PROJECT>` | 全部 sr-* skill 的数值铁律、sr-config 的配置说明 |
| `config_root` | — | sr-config |
| `gtgenerator_workdir` | — | sr-gtgenerator |
| `configured_at` | — | 提示信息 |

## 二、使用教学

用户问"sr 系列怎么用"、"有哪些 skill"、"/sr-concept 是什么"时，先给下面这段文字主线，再按需展开 `references/teaching/` 下对应用卡（结构图留给使用卡）。使用卡与各工作流 skill 目录一一对应（`sr-askme` 自身不设卡）。**使用卡只写四件事——职责、什么时候用、怎么用（示例）、产出在哪**；执行步骤、门与选项、内部脚本与命令归各 skill 的 `SKILL.md`。

### 推荐用法（教学时的固定口径）

**主线**：五个步骤，从头脑风暴走到正式 UE 回写：

1. **头脑风暴（四个入口）**：竞品分析 `/sr-analysis` · 问答式访谈 `/sr-concept` · 旧文档分析 · 人工补充——手里是什么材料就从哪个入口进，产出落 `analysis\`。
2. **成稿**：`/sr-gdd-human` 出**成稿**——只有纯规则与界面（零配置指代），全部决策留痕在附录 A，供你审核确认；**这一步期间可以反复改**。
3. **可选的两件事**（需要时才做；**不做也能直接进第 4 步**；两件都可以做、也可以只做一件）：
   - `□` 从成稿**生成配置表**：`/sr-config` 从成稿的规则**派生**配置表字段与记录（新表/加字段/改记录，带读回验收）；
   - `□` 把成稿里的 **ASCII 界面 UI 换成真实 UI**：**没有对应技能，人工做**；替换 UI 可能带来功能改动。
4. **输出定稿**：`/sr-gdd-ai` 把 **成稿 + 配置表**综合整合成**定稿**（功能规则、界面、配置契约、多语言文本、验收标准），并据定稿列出多语言文本条目；主线在定稿门之前**必经一道定稿审查**（`/sr-gdd-review` 出审查报告，随定稿一并呈门）。**定稿之后仍然可以改**——改走 `/sr-gdd-fix`（涉及配置表就调 `/sr-config` 改表并同步对应行）。**主线定稿通过后状态为 `active`、成稿归档**。直接调用只产出 `provisional` 工作版或 `blocked` 产物（不做审查）。
5. **正式 UE 回写**：把定稿真正落到工程里——**没有对应技能，人工做**。

**旁支（不在主线上，需要时单独用）**：宣讲网页 `/sr-gdd-html` 把**定稿**出成评审会用的单文件 HTML（投屏可直接讲；它是**用户调用型**技能——只能由人输入 `/sr-gdd-html` 触发，agent 不会自动接手）；GT 工具配置多语言 `/sr-gtgenerator`；定稿审查 `/sr-gdd-review`（主线里由 `/sr-gdd-ai` 自动带上，改完定稿要复审时才单独用）。

主线之外可随时单独跑**定稿审查**：`/sr-gdd-review` 对定稿做只读审查（结构、撰写纪律、配置契约、整合一致性），出审查报告；修复转 `/sr-gdd-fix`。主线路径已在 `/sr-gdd-ai` 内置这道审查，单独调用适合改定稿（`/sr-gdd-fix`）之后复审。

以上是推荐顺序，**全部 skill 也都可以单独调用**——比如直接 `/sr-gdd-ai 基于 旧策划案.xlsx 出功能 GDD`；这种直接调用只产出 `provisional` 工作版（材料不足时为 `blocked`），不能替代主线 `active` 定稿。

**独立技能**（不在主线，需要时单独用）：`/sr-gtgenerator`、`/sr-gdd-review`（定稿审查，只读出报告）、`/sr-gdd-fix`（定稿之后的改动入口）——各自做什么见下表。

**术语约定（全系列统一）**：**成稿** = `/sr-gdd-human` 的产出，**只有纯规则**的设计文档（不含任何配置内容），决策留痕在附录 A，**定稿通过后即归档废弃**；**配置表** = `/sr-config` 从成稿规则**派生**出的运行时配置数据；**定稿** = `/sr-gdd-ai` 主线路径的产出，综合成稿与配置表**整合**，主线通过后状态为 `active`、并据定稿列出多语言文本条目的**最终交付物**——**定稿之后它是唯一的活文档**，设计微调、字段对应调整、文本改动都直接改它；直接调用的同名文件只是 `provisional` 工作版或 `blocked` 产物。设计稿、复刻规格是入口产出，两者都不是 GDD。GDD 类产物的**顶部头部**带两字段：`doc_type`（`draft_gdd` 成稿 / `final_gdd` 定稿，管身份）+ `status`（生命周期，按 doc_type 分组取值：成稿 `draft → archived`；定稿主线 `pending → active → archived`、直接调用 `provisional` / `blocked`）——定义见 `references/gdd-pipeline.md` §一·补。**三者分工、章节对应、两道门与退回方式见 `references/gdd-pipeline.md`**（相关 skill 第 0 步一并读入）。

### 速查表（触发词以各 skill 自己的 description 为准）

| 你想做什么 | 用哪个 |
| --- | --- |
| "我有个创意 / 想个新玩法 / 这个点子能不能做" | `/sr-concept` |
| "分析这段录屏 / 拆一下这个竞品 / 能不能复刻" | `/sr-analysis` |
| "写策划案 / 出 GDD / 整理成功能文档"（主线成稿步，过程留痕+可读结果） | `/sr-gdd-human` |
| "整合定稿 / 出正式版 GDD / 交给程序的策划案" | `/sr-gdd-ai` |
| "改定稿 / 修订定稿 / 调一下定稿里的某处" | `/sr-gdd-fix` |
| "审查定稿 / 检查策划案 / 这稿能不能交程序" | `/sr-gdd-review` |
| "把定稿出成评审会用的 HTML / 做成宣讲页"（用户调用型，需手动输入） | `/sr-gdd-html` |
| "把这条规则落成配置表 / 加字段 / 建新表" | `/sr-config` |
| "配英雄技能 / 把技能设计落到配置表"（用户调用型，需手动输入） | `/skill-hero-config`（**配套技能，不属于 sr 系列**，随工作区技能目录走、不在插件里） |
| "新增/改 GID / 改多语言文案 / 导出 string_zh_CN / 翻译合并" | `/sr-gtgenerator` |

### 产出落盘位置（**一个功能一个目录**，里面只有 4 个桶）

每个功能的工作全部落在 **`<功能目录>` = `<SR_WORKSPACE>\features\<主题>\`** 这一个目录里
（从策划工作台进入的会话，工作目录**就是**它）。下面表格与各 skill 里的 `<功能目录>` 指的都是它。

产物按"谁产生 / 给谁看"落进 4 个桶：

| 桶 | 装什么 | 典型产出 |
| --- | --- | --- |
| `evidence\` | **进来的原件 + 过程证据** | 竞品截图/录屏/PV · 旧文档原件 · 外部交付包 `UE交付_<日期>\` · 抽帧与证据包 · 校准流水 `calibration_<主题>.jsonl` |
| `analysis\` | **想出来的内容** | 设计核三角报告 · 功能设计稿 · 体验报告 · 问题卡 · 复刻规格 · 各类交接 JSON · 旧文档分析 · 人工补充 |
| `gdd\` | **写出来的正文与交付物** | 成稿 `<主题>_<日期>.md` · 定稿 `<主题>_<日期>_定稿.md` · 修订点清单 · 审查报告 `<主题>_<日期>_审查.md` · 评审宣讲 HTML（+ content.json） |
| `decisions\` | **定下来的事** | `决策记录.md` —— **一个功能只有一个决策文件**，所有决策按时间追加（见 `references/decision-recording.md`） |

★ 旧口径里的 `source\` 并入 `evidence\`、`delivery\` 并入 `gdd\`；工作区根下平铺的
`proposals\ analysis\ decisions\ evidence\` 是**历史结构**，新工作一律进功能目录。

### 数值铁律（各 skill 产出共同遵守）

数值铁律的完整约束见 `references/sr_project_context.md`（各 skill 第 0 步载入的同一份文件）；正文行内四类标注（`【推断】`、`待确认：`、`[真实]`、`[示例]`）见 `references/evidence-boundary.md`「轻量标注」——两处均不另存副本。

## 三、共享语境文件（供其它 sr-* skill 引用）

全系列**只此一份**，各 skill 按相对路径引用（`../sr-askme/references/<文件>`），不复制副本。

| 文件 | 内容 | 引用方（按各 skill 自身指针实测） |
| --- | --- | --- |
| `references/sr_project_context.md` | 项目语境：数值铁律、写作约束、受众默认 | sr-concept / sr-analysis / sr-gdd-human / sr-gdd-ai / sr-gdd-fix / sr-gdd-review / sr-gdd-html / sr-gtgenerator 第 0 步；sr-config 只取路径（`config_root`）与配置说明口径，不读本文；`skill-hero-config` 也不读 |
| `references/gdd-pipeline.md` | 成稿 / 配置表 / 定稿三份产出契约：分工、生命周期、章节对应、两道门、退回方式 | sr-gdd-human / sr-gdd-ai / sr-gdd-fix / sr-gdd-review 第 0 步；sr-config 按需（派生依据） |
| `references/gdd-writing-discipline.md` | GDD 撰写纪律（成稿 / 定稿共用；编号与判据的唯一出处，按 `适用` 列取用） | sr-gdd-human / sr-gdd-fix 第 0 步；sr-gdd-ai / sr-gdd-review 第 0 步（按适用列自查 / 作审查基准，不复制编号） |
| `references/evidence-boundary.md` | 证据边界：来源标签、Evidence Ledger、证据优先级、轻量标注、高风险断言 | sr-gdd-human 第 0 步（填附录 A 台账用全篇）；sr-gdd-ai / sr-gdd-fix / sr-gdd-review 第 0 步（只用「轻量标注」）；sr-concept / sr-analysis 未挂指针——其内嵌方法卡自带同类规则，按需自取 |
| `references/governance-check.md` | 治理检查五条规则 + 治理引用五条 | sr-concept 第 3 步 / sr-analysis 第 4 步；sr-gdd-human 写附录 A.9 时；sr-gdd-ai 仅直接调用路径（结论随决策记录留档，定稿不设治理引用节） |
| `references/decision-recording.md` | 决策记录写入规范：**一个功能只有一个决策文件** `decisions\决策记录.md`，条目 = 时间（年月日时分秒）+ 决策内容；什么时候写、怎么写、写完怎么说 | **10 个 sr-* skill 全部挂了指针**（在「按需读取」或第 0 步的共享语境清单里）；配套技能 `skill-hero-config` 也挂了（在「关键规则」）—— v5 起**不止 Human Gate**：只要定下了一件事就记 |
| `references/bare-invocation.md` | 裸调用行为：先说明需要什么输入再停下等用户 | sr-concept / sr-analysis / sr-gdd-human / sr-gdd-ai / sr-gdd-fix / sr-gdd-review / sr-gdd-html 的「无输入时的行为」节；config 系三个 skill 无此节 |
| `references/calibration-recording.md` | 校准记录：Gate 前用户迭代输入的实时留痕（触发时机、jsonl 格式、会话恢复） | sr-concept 第 5 步 / sr-analysis 第 6 步（设计稿与规格迭代循环）；sr-gdd-human 第 5 步 / sr-gdd-ai 第 6 步（门内 revise 循环）；无迭代循环的 skill 不写 |

本区文件缺失（未成组安装）时，各 skill 第 0 步读不到共享文件，向用户报告缺的是 sr-askme 兄弟目录，并给出去路：按 §四 成组安装。

## 四、维护提示

- 本 skill 与其余 sr-* skill 需**成组安装**在同一 skill 根；无安装脚本，安装方式与镜像同步由使用者自管。
- `config.local.json` 与 `../sr-config/profiles/timemachine.local.yaml` 是运行时生成的本地文件，更新 skill 时不应被覆盖（若同步机制会清空目录，需先备份这两个文件）。
- 各 skill 内嵌的方法论文件以本机安装目录为准，改动即生效。
