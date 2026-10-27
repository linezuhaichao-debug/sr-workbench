# 0026 · preset 的 persona suffix 用了 `{{cwd}}`：DSH 已不注册该变量，策划模式会话一条都起不来

- 日期：2026-10-19
- 状态：**已接受**（已修：删掉 suffix 行并在注释里留成因；未做：preset 快照的整份 diff）
- 相关：`cordis.patch.yml` → `preset-sr-workbench` → `config.plugins[0]`（`persona`）的 `suffix` 字段
  · DSH 内置文档 `@deepseek-ai/dsh-persona` / `dsh-system-prompt`（`D:\DSH\resources\app.asar` 内）：
  「自定义 persona 模板不得依赖内置 `{{cwd}}` 变量：循环不注册它……请从 home、profile 或单次调用的
  `personaSuffix` 设置以及 preset 的 `suffix` 字段中移除 `Your working directory is {{cwd}}.` 语句」
  · 报错原文（用户截图）：`unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix"; registered variables: provider, model`
  · 同类前例：ADR 0011（改 persona 的验证口径「宽容解析 + 字段长度」）· ADR 0006（preset 是 `standard` 的快照）

## 现象

新起的会话（含面板四个入口派出去的工作会话）**本轮运行失败**，正文只有一行：

```
unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix";
registered variables: provider, model
```

失败发生在**提示词组装**阶段、任何模型请求之前 —— 于是这条会话什么都做不了；面板侧看不出来（它只发指令、
不渲染 prompt），用户侧只看到一句 `UNKNOWN` 的失败。

## 根因

① 模板变量是**严格解析**的：`.tmp` 里定位到 DSH 的 `interpolate()` —— 名字不在注册表里就直接抛错，
不是"渲染成空字符串"。报错里的 `registered variables: provider, model` 就是该 scope 的全部注册项。

② `{{cwd}}` **从来不是内置变量**：循环只供给 `provider` 与 `model`；当前目录由
**working-directory 服务**作为**必需的运行时上下文**交付 —— 也就是说模型本来就看得到
（本会话的 runtime context 里就写着 `Current working directory: D:\TimeMachine`），
persona 里再写一遍是**第二份副本**，而不是唯一来源。

③ 这一行是我们自己的 preset 抄进去的：`suffix: Your working directory is {{cwd}}.`，
随 `dsh.bundle.patch` 发给同事（ADR 0006），所以**同事和我这一侧一起坏**。
同处的注释（`{{model}} 和 {{cwd}} 都从 agent 自己的路由与工作区解析`）是旧版本的声称，
本轮按实测改成"只有 provider / model 注册"。

## 决定

1. **删掉 `suffix` 行**（不改成别的写法）。字段省略 = 遮蔽掉 deployment 默认后缀为空，
   正是官方文档给的处置。
2. **不新写插件去注册 `cwd`**：目录已在必需的运行时上下文里，为了一句话多养一个变量=多一个漂移面。
3. **注释里保留报错原文与成因**：下次 DSH 升级再扫这个文件时，不必重新考古（顶部三条 delta 的纪律照旧）。

## 验证

- 宽容解析（Python + 给 `!js` 注册 multi-constructor，文件里本来就有 `!!js` 标签）**通过**，
  顶层仍是 1 个 patch 条目；脚本 `.tmp\verify-workbench-patch.py`（临时件，不入库）。
- 断言逐条 PASS：
  - 生效文本（非注释行）里 `{{cwd}}` **0 处**（注释里仅剩成因说明）；
  - `persona` 行**无 `suffix` 字段**，`id`/`name`/`order` 未动（`sr-workbench` / 策划模式 / 5）；
  - `prefix` **4575 字符**、仍含 `{{model}}`、结尾与改前逐字一致 —— 与 ADR 0011 记录的 4575 字符一致
    ⇒ **只有 suffix 被删，正文没被误伤**。
- **生效时机 = 下一个新会话**（与 ADR 0011 同款结论）；**已经在途的失败会话不会自动复活**。
- **未做**：没有真的用「策划模式」起一条会话（需要用户在 GUI 里建一条）—— 这是本票留给用户的验收动作。

## 纪律

- **persona / 系统提示模板里的 `{{…}}` 只能写注册过的名字**。要写新变量，先确认注册表里有没有；
  "工作目录"这类事实**已经**在运行时上下文里，不要再抄一份。
- **DSH 升级后要重扫 preset 快照**（本文件顶部三条 delta 的既定纪律）：本次命中的正是
  「整份拷贝来的快照里带了一个新版本已删掉的旧字段」这一类。判据：升级后**真起一条会话**当冒烟，
  YAML 解析通过不算过（`{{cwd}}` 这种错 YAML 层面完全合法）。

## 影响

- 修复前：**策划模式一条都起不来**（含面板派活建的工作会话、含同事那侧），失败信息与配置无关，
  只看报错很难联想到 preset。
- 修复后：preset 的 persona 只剩 prefix 一块，行为与文档一致；模型依旧从运行时上下文知道当前目录。
- **未修（待用户定）**：preset 是 `standard` 的**整份快照**，无 patch 语义（ADR 0006）。本票只修了本次命中处；
  下一次 DSH 升级后建议对整份快照做一次 diff，别等它再以"起不来"的形式暴露。
