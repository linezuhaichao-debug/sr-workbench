# 技能随插件分发；预设随仓库分发；指令链用 `projectRootMarkers` 锚定

## 技能随插件走

sr 技能正文**打包进插件包**，由插件 host 半侧 `ctx.skills.register(...)` 注册（`dsh-skill` README:52 *"Embedded skills. Plugins register an in-memory skill with `ctx.skills.register(...)`"*），正文在**构建期**从 `sr-team-skills` 生成进包。

插件是宿主行（profile patch 的 `insert`），注册落进 **global 层**（`dsh-skill` README:82："host rows and repository plugins land in the global layer"）⇒ 所有会话都看得见 sr 技能。这是有意接受的：与今天的行为一致。

**`config.local.json` 不打包**——它是本机私有（`sr_workspace` / `sr_project` / `config_root` 每人不同），且 `sr-askme` 第 0 步本就会检查它、缺失就问。

## 为什么必须打包，而不是钉路径

功能专属工作区把 cwd 搬到 `features\<主题>\`，而**技能根与工作区指令链都是按 cwd 解析的**：

- `dsh-skill-filesystem\lib\index.js:802` 的 marker 硬编码 `.git`，README:54 明写 *"The project root is the nearest ancestor containing `.git`; without one, the current cwd is used."* 今天工作会话能用 sr 技能，唯一原因是 cwd 恰好是 `D:\TimeMachine`（无 `.git` → 回退 cwd → 命中 `D:\TimeMachine\.agents\skills`）。
- 钉 `customSkillDirs` 只修本机，**对同事零帮助**（他的路径不同）。打包同时解决 cwd 依赖与分发。

## 预设随仓库分发

预设就是一个目录，花名册扫三处：包内 `presets/`、配置的 `roots`、`<dshHome>/.agent-presets`（`dsh-agent-presets` README:36/:54/:55/:56）。**没有"插件包自带预设"的机制**——`roots` 是配置项，`dsh plugin add` 装的是 Profile Bundle。

因此在部署配置的 `roots` 里指向**仓库里的预设目录**：同事 `git pull` 即更新预设，不产生"复制品与源漂移"。

**契约（产物桶语义、条目引用格式、§6.4 指令三段式）留在预设**，因为预设是"只对某类会话生效"的唯一载体；塞进插件 host 半侧会全局生效，连无关会话都吃这套。

## 工作区指令链：预设里改 marker

`dsh-agent-instructions\lib\index.js:16,27` 显示 marker **是配置项**：

```js
const DEFAULT_PROJECT_ROOT_MARKERS = [".git"];
projectRootMarkers: z.array(z.string()).default([...DEFAULT_PROJECT_ROOT_MARKERS]),
```

而该文件 `:477` 的契约是 *"@returns the discovered project root, or `cwd` when no marker exists"*，`:578` 从 projectRoot 向下走到 cwd 收集指令文件。若 cwd = 功能文件夹且无 `.git` 祖先，projectRoot = 功能文件夹 ⇒ `D:\TimeMachine\AGENTS.md` 不再进链。

**在预设里配 `projectRootMarkers: ['AGENTS.md']`**：向上爬时到 `D:\TimeMachine\` 命中（它是唯一带 `AGENTS.md` 的祖先）⇒ projectRoot 固定回 `D:\TimeMachine`，指令链恢复。standard 会话不受影响（这行在预设里）。

## Consequences

- 预设的 delta 从 2 处增至 4 处（persona 契约、`agent-instructions` 的 markers、`skill-filesystem` 相关、原有 delegation 删行）；`agent.cordis.yml` 是 `standard` 的拷贝、无 patch 语义，**每次 DSH 升级都要重新施加**，维护成本上升。
- 构建期必须有一步"从 `sr-team-skills` 生成技能快照"，否则出现第三份永久漂移的副本。
- 技能可见范围是**全部会话**，不是只有工作台会话。
