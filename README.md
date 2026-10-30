# 策划工作台（`dsh-client-ui-sr-workbench`）

按「**功能**」组织策划工作的面板，挂在 DSH Web / 桌面版会话界面里，与对话并列。
一个功能一个目录，从头脑风暴一路走到给程序用的正式版策划案；面板负责**看**和**派活**，
真正写文件的永远是会话里的 agent。

- 版本：`8.1.7` · 包名：`dsh-client-ui-sr-workbench`（`private`，交付走 tgz 或目录，不发公共 npm）
- 组成：宿主半侧 `lib/index.js`（把随包的 11 个 `sr-*` 技能注册进全局层）+ 浏览器半侧 `lib/client.js`（面板本体）
- 随包技能：**11 个**（9 个模型可见 + 2 个用户手动触发：`sr-gdd-html` / `sr-gdd-ue`），正文 164 KB，兄弟资源 151 个文件

---

## 一、功能介绍

### 1. 只有两屏，加一个弹窗

| 界面 | 里面有什么 |
|---|---|
| **功能卡片墙** | `features\` 下每个功能目录一张卡：阶段步进器（头脑 / 成稿 / 定稿 / 宣讲各几件）、决策 / 证据 / 其它件数、最近决策时间、缺桶或已定稿的角标；最后一张是〔＋ 新建功能〕。头部〔刷新〕〔使用说明〕 |
| **功能详情** | 只有三个模块：**头脑风暴** / **决策记录** / **最终产物**。头部：圆形〔←〕返回卡片墙 · 〔刷新〕· 〔新建会话〕 |
| **使用说明弹窗** | 卡片墙头部点开，内容是包内 `skills/sr-askme/references/使用说明.md` 的**整份原文**（表格真渲染），重开即变 |

面板会记住你上次停在哪个功能、看的是哪个模块，从工作会话切回来直接落回去（不是每次回到卡片墙）。

### 2. 新建功能：面板自己建，一次建全

输一个名字，面板当场建好：

- 功能目录 `features\<功能名>\` 与四个桶：`evidence\` · `analysis\` · `gdd\` · `decisions\`；
- 一条**功能工作区**（cwd = 这个功能目录）；
- 一条**工作会话**（标题 `策划工作台·工作（<功能名>）`，预设「策划模式」）。

Windows 上目录选择器只有 native 后端、没有可用原语时，面板会退一步：让索引会话跑一条
`New-Item -Force` 建目录再回读核对；再不行就把命令逐字给你手工建。**面板不写任何文件内容。**

### 3. 头脑风暴：四个入口，面板唯一发指令的地方

| 入口 | 谁干活 | 产出 |
|---|---|---|
| 竞品分析 | `/sr-analysis` | 证据链分析报告 / 复刻规格 |
| 问答式访谈 | `/sr-concept` | 设计核三角报告 / 功能设计稿 |
| 旧文档分析 | 会话按固定格式转换 + 分析（四段章节） | 旧文档分析结论 |
| 人工补充 | 会话把**原话**逐字留下 + 结论 | 人工补充记录 |

填好素材（路径 / 链接 / 一句话创意 / 原话），〔交给工作会话〕发出去 —— 发的是那一条固定格式的指令，
**每发一次都另起一条新会话**（一个功能的活是几次独立派活，不做成一条越跑越长的会话）。
指令正文要求它先读盘：`decisions\决策记录.md` 与 `analysis\` 既有产出（新会话没有对话记忆，连续性靠盘上的记录）。

面板**不做并发闸门**：已有会话在跑也照发。并发写同一个功能目录靠写入纪律兜底 ——
决策记录**只追加、不整篇重写**。

### 4. 会话由面板造

详情页右上角〔新建会话〕**总是**在（旧写法在没有工作会话时整颗不渲染，而那正是最该点它的时候）：
建在本功能的工作区里、预设「策划模式」，不发任何指令。四入口派活走的是同一条创建路。
只有在**没有任何降级**时才把你切过去；有降级就留在面板把话说清。

### 5. 面板的边界（重要）

- **不写文件内容**、**不删任何文件或目录**；只建目录、工作区、会话。
- 唯一的「删」是收拾自己留下的痕迹：手工把 `features\<主题>\` 删掉之后，下次读到看板时把那个功能的
  工作会话归档、工作区登记移除（都不碰文件，会话可在侧边栏「已归档」取消归档）。
- **绝不认领**你自己在侧边栏建的会话。

### 6. 随包的 11 个 sr 技能

宿主半侧在 `apply()` 时从 `<包根>/skills/<名>/SKILL.md` 运行时读正文，`resourceBase` 指向同一个目录
⇒ 正文与 `references/` **同源同包**，装一个包就完整可用，不再有「插件供正文 + 资源包供 references」那种要配对的两个包。

| 技能 | 干什么 |
|---|---|
| `sr-askme` | 首次配置本机路径（工作区根 / Unity 工程 / 配置目录）；也答「sr 系列怎么用」 |
| `sr-analysis` | 素材（截图 / 录屏 / PV / 商店页）→ 证据链分析报告 → 复刻规格 |
| `sr-concept` | 一句话创意 → 设计核三角 → 完整功能设计 |
| `sr-gdd-human` | 出**成稿**：只有纯规则与设计，决策留痕在附录 A |
| `sr-config` | 从成稿规则派生配置字段与记录，最小事务写入 + 读回验收（改表经 Excel COM） |
| `sr-gdd-ai` | 成稿 + 配置表 → **正式版**（程序可实现粒度，含配置契约与多语言文本） |
| `sr-gdd-fix` | 正式版的唯一改动入口：影响面扫描 + 最小编辑 + 决策记录 |
| `sr-gdd-review` | 只读审查：这稿能不能交程序 |
| `sr-gtgenerator` | GID 类型与多语言文本的增删改、翻译合并、导出 |
| `sr-gdd-html` | 把正式版整份出成**宣讲稿**（单文件 HTML，投屏 / 外发）· 用户手动触发 |
| `sr-gdd-ue` | 只把正式版 §5 的界面与交互规则出成 HTML，给 UE/UI 同事照着做 · 用户手动触发 |

同名技能谁赢（宿主规则，本插件不改）：磁盘技能（`project-agents` 200）**高于**随包（`bundled` 600）
⇒ 会话 cwd 命中 `.agents\skills` 时用磁盘那份，够不到磁盘时才由随包顶上。

---

## 二、安装说明

### 前置

- 一个能跑插件的 DSH（Web 或桌面版），profile 目录通常是 `%USERPROFILE%\.dsh\profiles\<profile>\`；
- 装现成的包**不需要** Node 工具链、不需要 build —— `lib/` 里是构建好并入库的产物；
- 只有要从源码改它，才需要 Node 20+ 与 `npm install`。

### 方式 A：装 tgz（推荐给同事）

```powershell
# 在有源码的机器上打一次包
cd D:\TimeMachine\sr-workbench
npm run verify                                   # 交付前过门：lint → build:safe → test
npm pack --pack-destination D:\TimeMachine\outputs
# → dsh-client-ui-sr-workbench-8.1.7.tgz（约 2.2 MB / 141 个文件）
```

把这个 tgz 给同事，解到任意目录（解压出来的目录就是包根，里面有 `package.json` / `lib/` / `skills/` / `cordis.patch.yml`），
然后按下面的「三步接线」挂进 profile。

包里只有运行期要的东西：`package.json` · `cordis.patch.yml` · `lib/index.js` · `lib/client.js` · `skills/` · `README.md`。
`config.local.json`（本机私有）、`src/`、`test/`、`__pycache__` 都不进包。

### 方式 B：git clone + link（本机 / 开发）

```powershell
git clone <repo-url> D:\TimeMachine\sr-workbench
cd D:\TimeMachine\sr-workbench
npm install        # 只为能重新 build；只装 devDependencies
```

### 三步接线

1. **把包放进 profile 的 `node_modules`** —— 二选一：

   ```powershell
   # ① 目录直挂（junction，不留第二份副本）
   cmd /c mklink /J "%USERPROFILE%\.dsh\profiles\node_modules\dsh-client-ui-sr-workbench" "<包根绝对路径>"
   ```

   ```jsonc
   // ② 或在 profile 的 package.json 里加一条 link 依赖（本机开发用的就是这条；
   //    改完在 profile 目录跑一次 pnpm install —— profile 是 pnpm workspace）
   "dependencies": {
     "dsh-client-ui-sr-workbench": "link:D:/TimeMachine/sr-workbench"
   }
   ```

2. **把包名加进 profile 的 `dsh.profile.bundles`**（`%USERPROFILE%\.dsh\profiles\<profile>\package.json`）：

   ```jsonc
   "dsh": { "profile": { "bundles": [
     "@deepseek-ai/dsh-base",
     "@deepseek-ai/dsh-web-app",
     "dsh-client-ui-sr-workbench"      // ← 这一行
   ] } }
   ```

   挂载行**随包走**：包自己的 `cordis.patch.yml` 里已经带了 `- id: sr-workbench` 与「策划模式」预设
   （`preset-sr-workbench`），不用你在 profile 里再写一遍。

3. **重启 DSH**（宿主半侧只在启动时读一次技能）；客户端 bundle 若已热加载则不用，否则 **F5 一次**。

### 本机路径配置（可选，不配也能用）

面板按「工作区列表 → 各会话 cwd → 兜底根」自己找 SR 工作区。要指定就在 profile 的 patch 里按 id 覆盖
（这一层在该 bundle 层**之后**应用，所以是覆盖不是插入）：

```yaml
# %USERPROFILE%\.dsh\profiles\<profile>\cordis.patch.yml
- id: sr-workbench
  config:
    configPath: '<sr-askme>/config.local.json 的绝对路径'   # 可选
    projectRoot: '<工作区根绝对路径>'                        # 可选
```

- `configPath` / `projectRoot`：给客户端半侧；
- `skillsRoot`：给宿主半侧，覆盖「从哪儿读随包技能」（只在排障时用）。

配置也可以由面板自己写进 `%USERPROFILE%\.dsh\sr-workbench\config.local.json`（**本机私有，别放进技能目录**，
插件升一次级就没了）：本机没有配置时卡片墙会出现「先配一下本机路径」向导，或点〔在会话里问答配置〕让 `/sr-askme` 带你走
（细节见下面「使用方法」第 1 条）。

### 生效与更新

| 改了什么 | 怎么生效 |
|---|---|
| `lib/client.js`（面板） | 有 HMR，每 500ms 轮询 `mtime/size`，存盘约 1 秒后浏览器热加载 |
| `lib/index.js` / 技能注册（宿主半侧） | **没有 HMR**，重启 DSH 才生效 |
| `skills/<名>/SKILL.md`（正文） | 重启 DSH（`apply()` 启动时读一次） |
| `skills/<名>/references/` 等兄弟资源 | **即改即生效**（模型按需读文件） |
| profile 的 `package.json` / `cordis.patch.yml` | profile 是 `patchReload: live`，改完即时重组 |

更新版本：换 tgz（或 `git pull`）→ 重启 DSH。新装或换了包之后，当前页面不会自动捡起新的客户端 bundle，**F5 一次**。

### 卸载

从 `dsh.profile.bundles` 里去掉包名（或在 profile 的 patch 里 `- id: sr-workbench` + `disabled: true`）→ 重启。
彻底清掉再把依赖行与 `node_modules` 里的那份 link / 目录删掉。卸载**不动**你的工作区与功能目录。

### 四个坑（都实测过）

1. **bundle 进名册 ≠ 挂上**：`dsh.profile.bundles` 只是把包放进名册，真正挂载的是 patch 里那一行。
   本包从 5.0.1 起自带那一行；装 5.0.0 会出现「依赖装好、bundle 进名册、重启了、侧边栏什么都不出」。
2. **宿主半侧要重启**：新装的实例第一次必须重启 DSH，`/sr-*` 才会从随包这份出现（`lib/index.js` 没有 HMR）。
3. **兜底根写死了本机路径**：`D:\TimeMachine` 只在「profile 没配 `projectRoot`、且一条工作区都没登记」时兜底；
   对方工作区在别处就配 `projectRoot`，别指望它猜对。
4. **客户端 bundle 有加载期错误会白屏**（整个 GUI 报 `Failed to load plugins`）—— 所以改 `src/` 之后不要手写 `lib/`，
   跑 `npm run build:safe`（构建不过会自动还原）。

### 从源码改它（开发者）

```powershell
npm run verify      # lint → build:safe → test（201 个用例；build 在前，几条用例读 lib/ 产物）
npm run watch       # 开发时后台构建，存盘约 1 秒后浏览器热加载（只对 client.js 有效）
npm run build:safe  # 漂移门 → 备份 → build → smoke / smoke:render / check:react / check:host-skills，不过就还原 lib/
```

`lib/` 是**构建产物但入库**（分发走 git 与 tgz，「clone 即安装」）。所以：**改了 `src/` 必须 build 并一起提交**，
**不要手改 `lib/`**（下次 build 就冲掉）。只改 `skills/` 不需要 build。

---

## 三、使用方法

### 1. 第一次打开

面板在侧边栏与主区都占一个槽位。第一次点开时若这台机器还没有配置，会出现「先配一下本机路径」向导，
四个字段：**策划工作区**（放 `features\<主题>\` 的那一层，必填）· **Unity 工程**（必填）·
**策划配置目录**（只有 `/sr-config` 用得到）· **GTGenerator 工作目录**（可选）。

面板自己不写盘：点〔保存并验证〕是把这份值**交给一条会话去写**，写完面板回读核对（读到且必填齐才算成功）。
也可以点〔在会话里问答配置〕走 `/sr-askme` 一问一答。配一次就记住。

### 2. 建一个功能

卡片墙最后一张卡〔＋ 新建功能〕→ 输功能名 →〔建立〕。建完直接进详情页，四个桶与工作区、工作会话都就位。
名字就是目录名，也是产物名的主题（`<功能名>_成稿.md` 之类），起名时就把「这个功能叫什么」定下来。

### 3. 走一轮头脑风暴

在「头脑风暴」模块挑一个入口 → 填素材 →〔交给工作会话〕。点开〔看将要发出去的指令〕可以逐字看要发什么。
发完面板会另起一条工作会话并切过去（有降级则不切，留在面板说明原因）。
产出的分析落 `analysis\`，决策落 `decisions\决策记录.md` —— 回来点〔刷新〕就能在面板上看到。

### 4. 看决策记录与最终产物

- **决策记录**：面板只读 `decisions\决策记录.md`，**最新的在最上面**、按天分组（今天 / 昨天 / 本周 / 更早）；
  每条显示时间、第几条、标题与「决策 / 依据 / 影响」三段。右上可切〔看原文〕〔看时间线〕〔打开文件〕。
  写入一律由会话里的 agent 追加（面板不写），所以别在面板上找「编辑」。
- **最终产物**：把桶里的东西**按类型分组**列出 —— 头脑风暴的产物（`analysis\`）/ 成稿 / 定稿 / UE 界面稿 /
  宣讲稿 / 配置表；每类第一份标〔当前〕，`_<日期>_<序号>` 结尾的标〔历史版本〕。
  过程留痕（变更集 / 读回验收报告 / 审查报告 / 修订点清单）**不列条目、只在底部报数**；
  认不出来的收进「其它」折叠区，**如实列出、不丢也不猜**。

### 5. 主线 skill 流程

推荐顺序（每个 skill 也都能单独调用）：

1. **头脑风暴** → `/sr-analysis`（竞品）/ `/sr-concept`（一句话创意）/ 旧文档分析 / 人工补充；
2. **成稿** → `/sr-gdd-human`：只有纯规则与界面（零配置指代），可以反复改；
3. **配置表与线框图**（可选）→ `/sr-config` 从成稿规则派生字段与记录；
4. **正式版** → `/sr-gdd-ai`：成稿 + 配置表整合成程序可实现的粒度，并列出多语言文本条目；
5. **改正式版** → `/sr-gdd-fix`（唯一入口）；
6. **外发材料** → `/sr-gdd-ue`（只出 §5 界面与交互）/ `/sr-gdd-html`（整份宣讲稿）；
   **多语言文本** → `/sr-gtgenerator`。

### 6. 产出落在哪

每个功能的活全部落 `<工作区>\features\<主题>\`：

| 桶 | 装什么 | 典型产出 |
|---|---|---|
| `evidence\` | 进来的原件 + 过程证据 | 竞品截图 / 录屏 / PV · 旧文档原件 · 外部交付包 · 抽帧与证据包 |
| `analysis\` | 想出来的内容 | 设计核三角报告 · 功能设计稿 · 体验报告 · 复刻规格 · 旧文档分析 · 人工补充 |
| `gdd\` | 写出来的正文与交付物 | 成稿 · 正式版 · 审查报告 · UE 界面稿 · 宣讲稿 · 配置表；正文内联图片在 `assets\images\` |
| `decisions\` | 定下来的事 | `决策记录.md` —— **一个功能只有一个决策文件**，只追加 |

命名口径（2026-10-28 起）：

- 成稿 `gdd\<功能名>_成稿.md` · 正式版 `gdd\AI读版策划案_<功能名>_正式版.md` · UE `gdd\<功能名>_UE.html` · 宣讲 `gdd\<功能名>_宣讲.html`；
- **当前版名里不带日期**；每次改写已存在的产物**之前**先存一版 `<当前版名>_<YYYYMMDD>_<序号>`（成稿 / 正式版 / UE / 宣讲 / 配置表五类要存）；
- 正式版正文内联的图片统一放 `gdd\assets\images\`，正文按相对路径 `assets/images/<文件名>` 引用；**对图核对的真源仍是 `evidence\`**。

### 7. 两条日常纪律

- **决策要留痕**：每一次拍板都追加进本功能同一个 `决策记录.md`（只追加、不整篇重写 —— 一个功能并行两条会话是常态）。
  判据一句话：这件事以后有人问「当时为什么这么定」，这条记录要能回答。
- **改产物先存版**：改之前先跑一次 `skills/sr-askme/tools/history_snapshot.py`（它自己算序号并打印新路径），
  改配置表这条线由写入引擎在验收通过后自动留。

术语与设计口径见 [`CONTEXT.md`](./CONTEXT.md)；为什么这么定见 [`docs/adr/`](./docs/adr/)；
面板上那个弹窗的正文就是 [`skills/sr-askme/references/使用说明.md`](./skills/sr-askme/references/使用说明.md)。
