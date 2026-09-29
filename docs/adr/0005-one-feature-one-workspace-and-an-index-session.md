# 一个功能一个专属工作区；看板由独立索引会话承担

新建功能 = 建 `features\<主题>\` 文件夹 **+ 把它注册成 DSH 工作区**（功能的专属工作区）+ 在这个工作区里建工作会话。于是**工作会话的 cwd = 功能文件夹**。这个 cwd 引出两处冲突，各自有明确的解法。

## 一、权限：功能文件夹之外写不出去

`workspace-write` 的定义是"may modify files **under the session workspace**: `<workspace root>`"（`dsh-sandbox-policy\README.md:123`），且**额外可写根不是 policy 的一部分**（`:147`）。而 §3.3 有三处产出必须落在功能文件夹之外：`sr-config`/`sr-config-heroskill` → `D:\TimeMachine\planner\策划配置`、`sr-gtgenerator` → `gtgenerator_workdir`、W 轨改 `.agents\skills`。

因此**面板在创建工作会话后用 `commands.execute(sid, "/permission <danger-full-access 预设>")` 给它切权限预设**。`/permission` 是**已注册的宿主命令**（skills 不是、命令是），这条通道成立。

**不能靠 agent preset**：`dsh-permission-presets` 明写"an agent/profile choice is not part of `PresetSpec` yet"（`README:132`）；编辑组合的纪律也写明沙箱、审批、权限行是预设**不得**拥有的边界——"a preset is exactly as privileged as the plugins it names, so letting one relax its own confinement would defeat the confinement"。

## 二、读取根：看板列不出来

`list` 与 `changes` 锁在会话工作区之内（只有 `read` 不受限）。看板要 `list(<SR_WORKSPACE>)`，而 `D:\TimeMachine\GameDesignOS\workspace` 在**每个功能工作区的根之上**，所以任何一个功能工作会话都列不出看板（`outside-workspace`）。

因此**新增一个索引会话**（cwd = `D:\TimeMachine\GameDesignOS\workspace`），专做看板扫描与全部变更订阅；**废除"看板跟随 `sessions.current`"**——功能工作会话会出现在侧边栏里，用户一点它，看板就瞎。功能工作会话只承担"该功能内"的 list 与指令执行。

## 三层会话职责

| 会话 | cwd | 职责 |
|---|---|---|
| **索引会话** | `D:\TimeMachine\GameDesignOS\workspace` | 看板扫描（`list` features）+ 全部变更订阅（一个流覆盖所有功能） |
| **工作会话** | `features\<主题>\` | 该功能的 `list` 与指令执行（`prompt`） |
| 用户自己的会话 | 任意 | 只用来推导工作区归属与 cwd，**不再是读取根** |

## Consequences

- 侧边栏会多出 N 个功能工作区 + 两类工作台会话，都必须用可识别标题标注（`remote.session.rename`）。
- 权限切换是运行时动作，**实现前必须先实测 `/permission` 对已存活会话生效**；不生效则退回"配置支线回根会话跑"。
- cwd 一旦离开 `D:\TimeMachine`，**技能根与工作区指令链都会按新的 cwd 解析**——这是下一份 ADR 的主题。
