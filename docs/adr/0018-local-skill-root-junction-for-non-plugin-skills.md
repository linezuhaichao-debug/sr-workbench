# 0018 · 非插件技能接进工作会话：走用户技能根的 junction，不走 profile patch

- 日期：2026-10-15
- 状态：**已接受**（用户口径：只在本机接上，不改仓库、不影响同事）
- 相关：**0006**（技能随插件分发）· **0008**（技能整套随包 + 本机配置落用户目录）
  —— 本票不取代它们，是"**不在插件里的技能**怎么在本机看见"的补口

## 背景

工作会话的 cwd 在 `features\<主题>\`，`dsh-skill-filesystem` 的技能根按 cwd 解析
（项目根 = 最近带 `.git` 的祖先；`D:\TimeMachine` 是 SVN 工作副本、**没有 `.git`** ⇒ 回退 cwd）。
于是 `D:\TimeMachine\.agents\skills\` 这一整棵目录（当时 9 个技能：`plan-doc-ai-version`、
`plan-doc-human-review`、`skill-hero-config`、`skill-vfx-design`、`team-wiki-codebase`、
`univer-*` …）在工作会话里**一个都看不见**；能用的只有 sr 系列 —— 它们由插件 host 半侧
`ctx.skills.register(...)` 注册在 **global 层**，与 cwd 无关（0006/0008 的做法）。

用户拿 `plan-doc-version` 这个名字来问"为什么调不了"。两个原因叠加：

1. **没有这个技能名** —— 只有 `plan-doc-ai-version` 与 `plan-doc-human-review`；
2. **就算名字对也看不到** —— 上面那条 cwd 解析。

## 决定

**在用户技能根建 junction**，把需要的技能指向真实目录：

```
C:\Users\ZuHaiChao\.agents\skills\plan-doc-ai-version
  └─(Junction)→ D:\TimeMachine\.agents\skills\plan-doc-ai-version
C:\Users\ZuHaiChao\.agents\skills\plan-doc-human-review
  └─(Junction)→ D:\TimeMachine\.agents\skills\plan-doc-human-review
```

理由：`customSkillDirs` 默认根表里 **rank 500 = `user-agents` = `<agentsHome>/skills`**，
而 `agentsHome` 默认 `~/.agents` —— **现成的、已经在扫的技能根**。所以这条路：

- **零配置改动**（`cordis.patch.yml`、`config.local.json`、插件源码都不动 ⇒ 同事零影响）；
- **不复制文件** ⇒ 不产生第二份会漂移的副本（junction 对读取完全透明）；
- `watch` 开着 ⇒ **热生效**，不用重启、不用 F5。

技能包本身是自包含的（两个技能各有 `SKILL.md` + `references/` + `scripts/` + `agents/`
[+ `schemas/`]），junction 不动内容 ⇒ 相对路径照旧成立。

## 实测证据（2026-10-15）

| # | 动作 | 结果 |
|---|---|---|
| E1 | 建 junction 后**不重启** | 本会话技能目录**当场更新**，两个技能已可 `skill()` 加载；`Base directory` = `C:\Users\ZuHaiChao\.agents\skills\plan-doc-ai-version`，`scripts/`、`references/` 可读 |
| E2 | profile 层 patch 定位根行 `skill-filesystem`（写 `customSkillDirs`） | 用 DSH CLI 自带 `--dump-config` 在 **web** profile 上验证：**唯一命中 dsh-base 的根行**，且 `config` 被**整行替换**（连 `disabled` 都丢了 ⇒ 那一行被停用）；**preset 内部那 4 行同名行一行都没动** |
| E3 | `dsh --profile desktop --dump-config` | 被拒：`profile "desktop" is managed exclusively by the Electron application` |

**E2 同时否掉了"patch 打 preset 内行"这条路**。原因是结构性的，不是写法问题：

- 顶层 patch 的 id 定位**只认顶层条目**（`cordis.yml` 是空数组，行都来自 bundle 层）；
- preset 的插件行在 `config.plugins[]` **里**（web dump 第 1293/1575 行那种），
  不是顶层条目 ⇒ **顶层 patch 够不着**；要改只能改 preset 自己的 `config.plugins`。
- 而工作会话吃的是 **preset 自己那一行** provider ⇒ 修根行**没用**。

E2/E3 的净结论：**配置层的路（profile patch / `customSkillDirs`）在本机要么打偏、要么得改仓库
（`sr-workbench\cordis.patch.yml` 的 preset 声明，或桌面 profile patch）—— 两者都超出"只在本机"的口径**。

## 我不打算做的（边界）

- **不动仓库与任何配置**：`sr-workbench\cordis.patch.yml`、`config.local.json`、
  `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml` 一律不改（改前两者会波及同事）。
- **不把这两个技能打包进插件**：那是"同事也要能看见"时的路（沿 0006/0008 的机制），
  单独一票；本票明确没选它。
- **不建第二份技能副本**：不复制到 `~/.agents/skills` 实体目录，避免与 `D:\TimeMachine` 侧漂移。

## Consequences

- **是机器本地状态，不在仓库里** ⇒ 换机、重建用户目录要重做**两条** `New-Item -ItemType Junction`
  （就是上面那段命令）。**撤销**同两行：`Remove-Item <junction 路径>` —— 删链接**不动**目标目录内容。
- **目标目录移动 / 改名 / 删除即断链**（`D:\TimeMachine\.agents\skills\` 里那两个技能是镜像来的，
  真源更新后要同步，否则 junction 忠实指向旧内容）。
- **同事侧不在本票范围内**：他们既没有 junction，也看不见 `D:\TimeMachine\.agents\skills`
  ⇒ 想让同事也看见，走 0006/0008 的插件分发（另开票）。
- **不需要的连带收益**：`--dump-config` 是本仓今后查"某行到底在不在合成树里、配置是什么"的
  权威手段（E2/E3 就是靠它定案的）—— 它同时给出 preset 内部行，这是读配置文件读不出来的。

## 没选的方案

| 方案 | 为什么没选 |
|---|---|
| **A. profile patch 改 `customSkillDirs`** | E2 实测：只命中根行且整行替换（还把它停用了），**preset 内行够不着** ⇒ 技能不会出现 |
| **B. 改 preset 声明（`sr-workbench\cordis.patch.yml`）加技能目录** | 会**改仓库、波及同事**（他们 `git pull` 就跟着变），与"只在本机"口径冲突 |
| **C. 打包进插件 `skills/`** | 与 A/B 同类的问题（改动入库），且要加同步机制防漂移副本；用户本次明确不要 |
| **D. 改会话 cwd 到 `D:\TimeMachine`** | 与"一个功能一个目录"的既定口径冲突（ADR 0005） |
