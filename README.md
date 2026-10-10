# dsh-client-ui-sr-workbench —— 策划工作台（DSH 客户端插件）

按"功能"组织策划工作的**面板**，作为 DSH Web 会话界面里与对话并列的一级面板。
**面板只有两屏**：① 功能卡片墙（+〔＋ 新建功能〕）② 功能详情（只有三个模块：头脑风暴 / 决策记录 / 最终产物）。
它不发指令（除头脑风暴四入口那一条）、不写文件内容；**新建功能是面板自己建**（目录 + 4 个桶 + 专属工作区 + 策划模式会话）。
术语与设计口径见 [`CONTEXT.md`](./CONTEXT.md) 与 [`outputs\策划工作台-操作文档.md`](../outputs/策划工作台-操作文档.md)；
为什么独立成仓库、为什么产物入库，见
[`docs/adr/0003-workbench-ships-as-its-own-repo.md`](./docs/adr/0003-workbench-ships-as-its-own-repo.md)。

这是一个 **DSH 客户端插件包**：宿主半侧（Node）从包内 `skills/` 目录里把 11 个 sr 技能
`ctx.skills.register(...)` 进全局层（工单 05「技能随包注册」，见下文），浏览器半侧是一个
`window.__ModuleLoader__.load({ id, factory })` 形态的 bundle。

```
仓库根/
├─ src/
│  ├─ index.js      # host 半侧（Node ESM 入口）—— 构建成 lib/index.js：把随包 sr 技能注册进 global 层
│  ├─ generated/
│  │  └─ skills.ts  # ★ 构建期生成、**入库**：11 个 sr 技能的正文 + 来源 sha256 清单（不要手改）
│  ├─ client.js     # 浏览器半侧**组合根**（唯一知道 ctx / remote / store 的地方）→ lib/client.js
│  ├─ pure/         # 零依赖纯函数（12 个）—— 决策记录解析 / 4 桶契约 / 产物分组 / 主题派生 /
│  │                #   头脑风暴四入口 / 会话认领缓存 / 主题名校验 / 路径归一 / frontmatter
│  ├─ port/         # WorkspacePort：接口 + 测试替身（node:fs 直读真实工作区）
│  └─ load/         # 加载器 —— 只吃 port，产出视图模型（看板 / 功能详情 / 决策记录 / 建功能事实）
├─ test/            # node --test 直跑（.ts 由 Node 的类型剥离加载）：124 个用例 + paths.ts 真实数据坐标
├─ lib/             # ★ 构建产物，**入库**（clone 即安装；不要手改）
│  ├─ index.js      #   宿主半侧（运行时从 <包根>/skills/ 读 11 条技能正文 + 挂 resourceBase）
│  └─ client.js     #   浏览器半侧
├─ tools/           # 本仓库自己的检查脚本（构建管线的护栏）
│  ├─ check-bundled-skills.mjs  # ★ 包内技能齐全判据（正文 + 兄弟资源同源同包）
│  ├─ check-host-skills.mjs# ★ 构建后判据：产物里真的注册了 11 条技能（7 步判据，见下文）
│  ├─ smoke-client.mjs    # 假 window/require/ctx 冒烟：加载 + apply + slot 注册形状
│  ├─ render-smoke.mjs    # ★ v5 新增：迷你 React 里真跑组件树（补 smoke 补不上的"渲染期崩"那一格）
│  ├─ check-package.mjs   # ★ v5 新增：对 `npm pack` 出来的 tgz 跑五关（清单 / **自挂载行** / 加载 / 渲染 / 宿主自足）
│  ├─ check-no-react.mjs  # 判据：产物里没打包 React，只有 require("react")
│  └─ build-safe.mjs      # ★ 安全构建门：漂移门 → 备份 → build → 三道判据；不过就**还原** lib/
├─ legacy/          # 历史自查/回归脚本（**仅历史用途**，见下）
├─ docs/adr/        # 架构决策记录（随包，来源见下）
├─ CONTEXT.md       # 术语表（随包，来源见下）
├─ cordis.patch.yml # 随包分发的 **「策划模式」预设**（显示名=策划模式，id 仍是 sr-workbench）
├─ eslint.config.js # 分层与依赖方向的机器化（见「分层纪律」一节）
├─ package.json
└─ tsdown.config.ts # 构建配置（复刻 DSH 官方客户端插件的 clientBundle preset）
```

---

## 技能随包注册（工单 05）—— 本仓库装的插件**自带 sr 技能**

**要解决的问题（实测，不是推断）**：`dsh-skill-filesystem` 的技能根是按 cwd 解析的
（`D:\TimeMachine` 无 `.git` ⇒ projectRoot 回退成 cwd ⇒ 命中 `.agents\skills`）。
同一台机器、同一个 profile，**cwd 一换到 `features\<主题>\`，10 个 sr 技能全部消失**
（三臂实测见 `outputs\.scratch\策划工作台\05-skill-catalog-premise.md`）。
所以"让技能随包走"是工作会话能用 sr 技能的**硬前提**，不是锦上添花。

**做法（6.0.0 起）**：技能**整套**（`SKILL.md` + 兄弟资源）就在仓库 `skills/`，随包分发。
宿主半侧在 `apply()` 时**运行时读** `<包根>/skills/<名>/SKILL.md`，逐条
`ctx.skills.register({ name, description, content, source: 'bundled', invocation, resourceBase })`，
`resourceBase` 指向**同一个目录** ⇒ 正文与 references **同源同包**，谁都读得到。
插件是宿主行 ⇒ 注册落进 **global 层** ⇒ 所有会话可见（与今天一致，ADR 0006 已接受）。
`config.local.json` **不打包**（本机私有；`sr-askme` 第 0 步会检查它、缺失就问）。

| 项 | 值（`npm run check:bundled-skills` 实跑） |
|---|---|
| 技能数 | **10 个** `sr-*`（9 个模型可见 + 1 个用户专用：`sr-gdd-html`）← `sr-config-heroskill` 已改名 `skill-hero-config`、搬回工作区技能目录（不算 sr 系列） |
| 正文合计 | **121.8 KB**（11 个 `SKILL.md`） |
| 兄弟资源 | **127 个文件**（references / scripts / tools / resources / examples）—— **都在包里** |
| 包体积 | tgz **1.2 MB**（技能是主体；旧设计只有正文时是 137 KB） |
| 不打包的 | `*.local.json`（本机私有）、`__pycache__`/`*.pyc`（缓存） |

### 技能源就在本仓库 `skills/`（唯一那份）

6.0.0 起**不再有"生成物"**：`skills/` 就是源码，也是运行时读的那份 —— 没有第二份可漂移，
于是 `gen:skills` 与漂移门一起撤掉了（`src/generated/` 删除）。

**改技能**（用户口径：用和改都用插件里的）：

| 改什么 | 怎么生效 |
|---|---|
| `references/` `scripts/` `tools/`（兄弟资源） | 改完**即生效**（模型按需读文件，读的就是这个目录） |
| `SKILL.md`（正文） | **重启 DSH** 生效（`apply()` 启动时读一次；不用 build、不用打包） |

**判据换成"发出去的那份齐不齐"**：`npm run check:bundled-skills` 查
① 恰好 11 个 `sr-*` 且每个 `SKILL.md` 能解析出 name、正文非空；② 每个技能的兄弟资源都在；
③ 没有本机私有文件混进来；④ 用**真实 `apply()`** 注册一遍，`resourceBase` 指包内、正文与文件逐字一致；
⑤ 技能根为空时**一条都不注册**并打 WARN（宁缺勿假 —— 半个技能比没有更坏）。

### 同名技能谁赢（不改今天的行为）

rank 越小越赢：`project-dsh 100 < project-agents 200 < **runtime 250** < custom 300 < user-* 400/500 < bundled 600`。
⇒ cwd 命中 `.agents\skills` 的会话里（今天的工作会话）**磁盘那一份仍然赢**，本插件只是"够不到磁盘时顶上"。
实测：在带 `MARKER-DISK` 同名技能的 cwd 里跑，catalog 里 `sr-concept` 的 description 是磁盘那份。

### 脚本

```powershell
npm run check:bundled-skills  # ★ 包内技能齐全（11 个 SKILL.md + 兄弟资源 + resourceBase 指包内）
npm run check:host-skills # 产物判据：lib/index.js 真的注册了 11 条（build:safe 第③步）
```

### ⚠️ 改完宿主半侧要重启一次 dsh（它不像 client.js 那样被轮询）

`lib/client.js` 有 `dsh-client-hmr` 每 500ms 轮询；**宿主半侧的 `lib/index.js` 没有这条**。
所以已经跑着的 3080 实例**不会自动**拾起新的技能注册 —— 重启一次 dsh（或让 profile 重新组合）
之后 `/sr-*` 才会从随包这份出现。**工单 05 全程没有重启你的实例**（那是你的现场）。

---

## ⚠️ `lib/client.js` 会被**真机直接服务** —— 构建后必须 smoke

用户的 DSH 实例（本机 `http://127.0.0.1:3080`）通过 profile 里的 junction 直接服务**这个仓库里的**
`lib/client.js`，`dsh-client-hmr` 每 500ms 轮询它的 `mtime/size`，一变就热加载。
所以**一份坏产物躺进 `lib/` = 面板当场坏掉，而且关了终端也还坏着**（它已经写进仓库了）。

这道门**顺序不可变**，任何一步失败就回滚：

```powershell
npm test                  # 124 个用例必须全绿
npm run lint              # 分层纪律 + 未声明标识符
npm run check:bundled-skills  # ★ 包内技能齐全（正文 + 兄弟资源同源同包）
npm run build             # 产出 lib/index.js + lib/client.js
npm run smoke             # ★ 必须通过；不过就立刻还原 lib/
npm run smoke:render      # ★ v5 新增：在迷你 React 里把组件树真跑一遍（smoke 的 React 是桩，不渲染）
npm run check:host-skills # ★ 产物里真的注册了 11 条 sr 技能
```

两条更省事的等价入口（**推荐日常用**）：

```powershell
npm run build:safe  # 漂移门 → 备份 → build → smoke + smoke:render + check:react + check:host-skills；
                    # 任何一道不过就自动还原 lib/ 并非 0 退出
npm run verify      # lint → build:safe → test（**build 在前**：几条单测读的是 lib/ 产物）
```

> 本机有两条路径进同一个仓库：真目录 `D:\TimeMachine\sr-workbench`，
> 以及 3080 那条过渡 junction `outputs\_dsh-panel-test\dsh-client-ui-sr-workbench`。
> 构建已做成**路径无关**（`tsdown.config.ts` 归一了 rolldown 的 `//#region` 路径注释），
> 两条走法产出的 `lib/client.js` 逐字节相同。

---

## 改了 `src/` 必须 build 并提交（`lib/` 入库的口径）

`lib/` 是**构建产物但入库**——本机没有私有 registry，分发走 git，"clone 即安装"成立的前提就是
仓库里带着构建好的 `lib/client.js` 与 `lib/index.js`。所以：

```powershell
npm run verify    # 一次过（lint → build:safe → test；build 在前，因为几条单测读的是 lib/ 产物）
git add src lib && git commit -m "…"
```

改了技能：`references/` 即改即生效；`SKILL.md` 正文重启 DSH 生效（运行时读，不用 build，也没有漂移门了 —— 只有一份）。

**只改 `src/` 不 build 就提交 = 把仓库改坏**：别人 clone 下来装的还是旧 bundle，而源码看起来是新的。
反过来，**不要手改 `lib/`**——下次 build 就冲掉。

---

## 构建

```powershell
npm install          # 只装 devDependencies（tsdown / eslint / typescript-eslint）
npm run build        # tsdown → lib/index.js + lib/client.js
npm run build:safe   # ★ 带保险的构建：漂移门 → 备份 → build → 三道判据，不过就还原 lib/
npm run watch        # 开发时后台跑；写完存盘，约 1 秒后浏览器自动热加载（只对 client.js 有效）
npm run smoke        # 构建产物冒烟自检（tools/smoke-client.mjs）
npm run smoke:render # ★ 渲染冒烟：迷你 React 里真跑组件树（tools/render-smoke.mjs）
npm run pack:check   # ★ 安装包验收：对 npm pack 出来的 tgz 跑五关（tools/check-package.mjs）
npm run check:react  # 判据：产物里没有 React 实现体，且只有 require("react")
npm run check:host-skills # 判据：lib/index.js 真的注册了 11 条 sr 技能
npm run check:bundled-skills # 判据：包内技能齐全（正文 + 兄弟资源同源同包）
npm test             # 124 个用例（node --test，直接 import 真模块 + 真实工作区数据）
npm run lint         # 分层纪律（见「分层纪律」一节）
npm run verify       # lint → build:safe → test（build 在前：几条单测读 lib/ 产物）
```

产物形态（与官方客户端插件 `@deepseek-ai/dsh-client-ui-plan` / `-goal` 逐字同形）：

```js
window.__ModuleLoader__.load({
	id: "dsh-client-ui-sr-workbench",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		…（CJS 形态的插件代码）…
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
```

`platform: "web"` + `dsh.client.inject` 决定它进浏览器名册；运行期**只服务 `exports["./client"]`
这一个 bundle**，跨文件 `import` 一律 404（历史踩坑见 `legacy/` 与开发笔记坑 11）。

### React 走平台基座模块表（external）

`react` / `react-dom` / `@deepseek-ai/dsh-client-ui-primitives` 在 `tsdown.config.ts`
的 `PLATFORM_EXTERNAL` 里声明为 external，产物里只有 `require("react")`，不含实现体。
判据脚本：`node tools/check-no-react.mjs`。

### 构建期差异（已知，刻意接受）

rolldown 会对入口模块做**声明级 DCE 与内联**，`treeshake: false`（raw rolldown 与 tsdown 都试过）
也拦不住。实测差异只有两类，都不改变行为：

1. 删掉**零调用点**的死函数 `errText()`（源码里只声明、从不引用）；
2. 把从未重新赋值的只读 `const` 内联掉（`isDir` / `hay` / `d0` / `contractErr`）。

核对方法（`legacy/check-sandbox.js` 已按 ADR 0001 删除，原来靠它打印函数名清单比对）：
现在用 `npm run build` 复现产物 + `git diff --stat -- lib/`（同一份源码应产出**同一串字节**），
再用 `npm run smoke` 证明它能加载、`apply` 与 slot 注册形状没变。

---

## 分层纪律（`eslint.config.js` + `test/seam.test.ts`）

设计 §6.1 的四条纪律不再靠自律，由**目录结构 + 静态检查**维持：

```
src/
  pure/    零依赖纯函数 —— 不许 import React、ctx、window、document、node 内置
  port/    WorkspacePort 接口 + 两个实现（生产 / 测试替身）—— 不许依赖任何上层
  load/    加载器 —— 只许 import pure/ 与 port/（同层允许）；不写
  ui/      React 组件（**仍在组合根 src/client.js 里**，尚未单独拆出来）—— 只吃 props
```

`npm run lint` 里跑两张网：

| 网 | 谁 | 抓什么 |
|---|---|---|
| `no-restricted-imports` | 各层 | 点名禁令：React 家族 / `@deepseek-ai/*` / `node:*` / 反向跨层边 |
| `no-restricted-syntax` 的 `ImportDeclaration:not([source.value=/…/])` | 各层 | **白名单方向**（"只能 import 这几个"）；`patterns.group` 的 `!` 取反在 ESLint 9.39 实测无效，所以用这条 |
| `no-undef`（`pure` / `load` / `port` / 组合根） | 同上 | **未声明的标识符 = 自由变量** |

> `no-undef` 这一条是删掉 `legacy/check-sandbox.js` 的**直接替代**。实锤：`src/pure/finalgdd.ts` 的
> `checkFinals` 排序引用了 `dateOf` 却没 import —— 在 client.js 里它是同层自由变量，搬成模块后调用即
> `ReferenceError: dateOf is not defined`（4 个用例同时红）。正则式检查与依赖方向规则都抓不到它，
> 只有 `no-undef` / `tsc --noEmit` 能抓。**本票修的就是它。**

**测不到什么**（如实声明，别当全覆盖）：

- **不渲染 React 组件**（没有渲染测试框架）⇒ 渲染期的 `ReferenceError`、hooks 违规**抓不到**；
  真正的"白屏"防线是 `npm run build` + `npm run smoke`（在假 ModuleLoader 里真跑 `apply` 与 slot 生成器）。
- **不做类型检查**（本仓库没装 typescript）。`tsc --noEmit` 是更彻底的替代，留给后续票。
- `legacy/**` 是历史归档，**不 lint**。

---

## 安装到 DSH

本机没有私有 registry，安装 = **clone + junction + profile patch 加一行**。

> **`private: true` 是刻意的**：不发公共 npm，交付走**目录**或 **`npm pack` 出来的 tgz**。

### 交付物：一个 124 KB 的 tgz（推荐）

```powershell
cd D:\TimeMachine\sr-workbench
npm run verify                                   # 先过门（lint → build:safe → test）
npm pack --pack-destination D:\TimeMachine\outputs
# → D:\TimeMachine\outputs\dsh-client-ui-sr-workbench-<版本>.tgz（~125 KB，5 个文件）
npm run pack:check                                # ★ 对**这个包**跑四关验收（自己 pack 到临时目录，跑完删掉）
```

tgz 里**只有运行期要的东西**：`package.json` · `cordis.patch.yml`（含挂载行与「策划模式」预设）·
`lib/index.js`（宿主半侧，**11 个 sr 技能的正文内联在里面**）· `lib/client.js`（面板）· `README.md`。
**没有任何私有文件**（`config.local.json` 从不进包，`src/` 与 `test/` 也不进）。

### 交付物只有一个：tgz（技能在包里）

6.0.0 起**技能资源包退役** —— 技能（正文 + references）已经全在插件包里，同事**只装这一个包**就完整可用。
旧的那套"插件供正文 + 资源包供 references"是坏设计：资源包里没有正文、插件里没有 references，
**两个包必须配对**，少装一个就是 11 个空壳（实测每个技能都有兄弟资源）。

```powershell
npm run pack:check -- D:\TimeMachine\outputs\dsh-client-ui-sr-workbench-<版本>.tgz
# 验收（五关）：顶层 5 个文件 + 包内技能齐全（11 个 SKILL.md + 127 个资源 · 无私有文件）
#              + bundle patch 自带挂载行 + 客户端加载/渲染冒烟 + 宿主半侧注册 11 条
```

### 手动接线（3 步 —— **挂载行随包走，不用你写**）

1. clone（或解开 tgz）到任意位置（本机开发时是 `D:\TimeMachine\sr-workbench`）：

   ```powershell
   git clone <repo-url> <目标目录>
   cd <目标目录>
   npm install      # 只为能重新 build；装现成的面板**不需要**它
   ```

2. 把它挂进 profile 的 `node_modules`（本机开发用 junction，**不留第二份手写副本**）：

   ```powershell
   # 目标：C:\Users\<你>\.dsh\profiles\node_modules\dsh-client-ui-sr-workbench
   cmd /c mklink /J "C:\Users\<你>\.dsh\profiles\node_modules\dsh-client-ui-sr-workbench" "<目标目录>"
   ```

3. **把包名加进 profile 的 `dsh.profile.bundles`**（`<profile>\package.json`）—— 这一条就够了：
   bundle 自己的 `cordis.patch.yml` 里**已经带了挂载行**（`- id: sr-workbench`），装上就会挂。

   要配本机路径（可选）就在 profile 的 patch 里**按 id 覆盖**（它在 bundle 层之后应用）：

   ```yaml
   # <profile>\cordis.patch.yml —— 只覆盖 config，不再 insert 一次
   - id: sr-workbench
     config:
       configPath: '<sr-askme>/config.local.json 的绝对路径'
       projectRoot: '<工作区根绝对路径>'
   ```

   profile 是 `patchReload: live`：**改这些文件即时重组，不用重启**。
   停用 = 从 `bundles` 里去掉包名（或在 patch 里 `- id: sr-workbench` + `disabled: true`）。

4. 客户端 bundle 由 `dsh-client-hmr` 每 500ms 轮询，`lib/client.js` 的 `mtime/size` 一变就热加载；
   新装的插件同一页面不会自动捡起，**F5 一次**。

### 装完必须知道的四个坑

0. **bundle 进名册 ≠ 挂上**：`dsh.profile.bundles` 只是把包放进名册，**真正挂载插件的是
   bundle 自己的 patch 里那一行**。本包从 **5.0.1** 起自带那一行；**5.0.0 没有** ——
   装 5.0.0 会出现「依赖装好了、bundle 进名册了、重启了，侧边栏却什么都不出」。
   手里是 5.0.0 就换 5.0.1，或在 profile 的 patch 里手写那一行：

   ```yaml
   - insert:
       - id: sr-workbench
         name: 'dsh-client-ui-sr-workbench'
   ```

1. **宿主半侧要重启才生效**：`lib/client.js` 有 HMR 轮询，`lib/index.js`（注册 11 个 sr 技能的
   那一半）**没有** —— 新装的实例第一次必须重启 DSH（或让 profile 重新组合），`/sr-*` 才会从随包这份出现。
2. **兄弟资源不进包**（要进包得多带 1.51 MB）：技能正文全在包里，但 `references/` `tools/` `resources/`
   靠**磁盘上的技能目录**。⇒ 想让「决策记录写入规范」「撰写纪律」这类**兄弟文件**也被读到，
   把 `.agents\skills\` 一起拷到目标机器；不拷也不会崩 —— 会如实降级成"资源不可用"，
   而最关键的**决策记录契约已经写进 persona**（每轮在上下文里），不吃兄弟文件。
3. **本机兜底路径**：`src/client.js` 里的 `DEFAULT_ROOT = "D:\TimeMachine"` 只在
   "profile 没配 `projectRoot`、且一条工作区都没登记"时兜底。对方工作区在别处就把这一行改掉，
   或干脆不管（工作区列表 / 会话 cwd 这两条候选通常已经命中）。

> ⚠️ 客户端 bundle 若有**加载期**错误，整个 GUI 会白屏（"Failed to load plugins"）。
> 所以改完 `src/` 先跑 `npm run smoke`，再 build。

### 本机（2026-09-29 迁移现场）的一条过渡 junction

`@deepseek-ai/dsh-client-modules` 在**启动时**解析并缓存插件的真实路径（"until restart"）。
迁移当时正在运行的 3080 实例缓存的是**旧路径** `outputs\_dsh-panel-test\dsh-client-ui-sr-workbench\lib\client.js`，
所以那条旧路径被留成**指向本仓库的 junction**（不是副本）——当前实例因此立刻服务新产物。
**下次重启 dsh 之后**可以删掉它，只留 profile 里那一条 junction：

```powershell
cmd /c rmdir "D:\TimeMachine\outputs\_dsh-panel-test\dsh-client-ui-sr-workbench"
```

细节与判据写在 `D:\TimeMachine\outputs\_dsh-panel-test\插件已搬到-sr-workbench.md`。

---

## `legacy/` —— 历史脚本（仅历史用途）

这些脚本是"手写单文件 `client.js`"那条路线的产物，**已构建管线取代**。
工单 02 把它们整体搬进仓库，只做了一件事：把写死的旧路径改成指向本仓库的 `lib/client.js`。
`legacy/package.json` 强制 CommonJS（仓库根是 `"type": "module"`）。

### 本票（工单 03）删掉的两个（按 ADR 0001）

| 已删除 | 它当年管什么 | 现在谁管 | **测不到什么** |
|---|---|---|---|
| `check-sandbox.js` | 把 factory 体整段放进沙箱执行、挨个调用组件函数，让运行时自己报**未声明标识符**（`notice is not defined` 那类白屏） | ① `eslint.config.js` 在 `pure` / `load` / `port` / 组合根上开 `no-undef`（**静态**抓自由变量）② `npm test` 里 `test/seam.test.ts` 做文本层面的越界检查 ③ `npm run smoke` 抓**加载期**的 `ReferenceError` | **渲染期**的自由变量：`smoke` 用 React 桩、组件根本不渲染，所以 `src/client.js` 里组件体内的未声明标识符现在**没有网**（这正是"把 client.js 接回 pure/ 层"要解决的） |
| `syntax-check.js` | ① `node --check` 全文件语法 ② factory 体语法 ③ **16 条正则式产品自查**（hooks 违规、`ctx.config`、缺 signal、`[object Object]` 拼接、`session.create` 同给 workspaceId+cwd…） | ① ESLint 解析全部源码（语法过不了就红）② `npm run smoke` 真跑 bundle + `apply` + slot 注册形状 ③ `tsdown.config.ts` / `port/dsh.ts` 里那些坑已写进注释与用例 | 那 16 条正则式产品自查**没有替代品**：它们是对**成品行为**的模式断言，随脚本一起消失。要留只能把它们改写成对 `src/client.js` 的正则用例（本票没做，见报告「留给后续票」） |

其余保留的历史脚本状态：

| 脚本 | 作用 | 现在的状态 |
|---|---|---|
| `check-ids.js` | 上一个版本的"未声明标识符"扫描（正则式） | **已废弃**：对手写版也报 80 项假阳性，正是 `check-sandbox.js` 要取代它的原因 |
| `test-buckets.js` `test-finalgdd.js` `test-refgraph.js` `test-ledger.js` `test-topic.js` `test-dashboard-v1.js` `test-finalcheck.js` `test-mdcheck.js` `test-toabs.js` `test-parse5.js` `test-mdspec.js` `test-validate.js` `test-inline-intake.js` | 按**哨兵字符串切片** + `new Function` 从 `client.js` 里抽代码（或读真实文件） | **已被 `test/` 取代**（工单 03）：同一批断言迁到直接 `import` 真模块，`npm test` 124 个用例全绿。切片版随 ADR 0001 删除手法，本目录只留档 |
| `sync-intake.js` | 比对 `client.js` 内联 INTAKE 与 `intake-parse.js` 两份副本的函数体指纹 | **已失效**：拆分后不再有两份副本（`src/pure/intake.ts` 是唯一一份） |
| `migrate-to-features.js` | 旧扁平层 → `features\<主题>\<桶>\` 的迁移 | 历史一次性脚本 |
| `intake-parse.js` | 当年的"跨文件复用"尝试 | **已废弃**：DSH 运行期只服务 `client.js` 一个入口（坑 11） |
| `test-intake.mjs` | `intake-parse.js` 的离线回归（28 项） | 随 `intake-parse.js` 一起废弃；对应断言现在是 `test/pure-intake.test.ts` |
| `package.pre-migration.json` | 迁移前那份 `package.json` 原件（`dsh.client.inject` / `platform` / `exports` 的原始形态） | 只作留档，证明"历史没丢"；生效的是仓库根的 `package.json` |

**迁移前那份手写版 `lib/client.js`（244,814 字节）不留工作副本**（避免"第二份源码"），
逐字节留档在 git 里：

```powershell
git show pre-migration-baseline:legacy/pre-migration/lib/client.js      # 手写版原件
git show pre-migration-baseline:legacy/pre-migration/package.json
```

核对口径（本票的"逐字不变"判据）：`src/client.js` 的正文与该原件**逐行相同**，
唯一差异是那一行 `const React = require("react")` → `import * as React from "react"`，
外加头尾的外壳↔ESM 入口互换。

---

## `CONTEXT.md` 与 `docs/adr/` 的来源

按 ADR 0003「`CONTEXT.md` 与 `docs/adr/` 随包进仓库」，这两处是从
`D:\TimeMachine\outputs\`（工作区的设计文档区）**复制**进来的快照：

| 仓库内 | 来源 | 改哪一份 |
|---|---|---|
| `CONTEXT.md` | `D:\TimeMachine\outputs\CONTEXT.md` | **改工作区那一份**（它是权威源，被 spec/ADR 引用）；改完再复制进来 |
| `docs/adr/*.md` | `D:\TimeMachine\outputs\docs\adr\*.md` | 同上：新增/修改 ADR 在工作区侧做，再复制进来 |

仓库里这两份是**副本**，不是权威源——避免出现"两个都对"的漂移。

---

## 已知限制

- **随包技能只嵌了正文**（工单 05）：兄弟资源（`references/` `tools/` `resources/`，合计 1.51 MB）没进包
  ⇒ **只嵌正文 ≠ 技能完整可用**。详见上文「技能随包注册」一节与 `resourceBase` 表。
- **随包技能的生成源是 `.agents\skills`**（今天会话真正加载的那一份），不是 ADR 0006 里写的
  `sr-team-skills`（两份已漂移）。04 对齐两份之后要改 `--from` 一个参数并同步 ADR。
- **建目录在 Windows 上走的是"会话跑 PowerShell"那条路**：`uiWorkspace.createDirectory` 只在目录选择器的
  **browse** 后端存在，而 `dsh-host-directory-picker-auto` 的规则是 **win32 ⇒ native** ⇒ 本机（桌面版与
  `dsh web` 都算）没有这个能力。面板按三条路退：① browse 原语 → ② **索引会话跑 `New-Item -Force` + 面板回读核对**
  → ③ 把逐字命令给你手工建（建完再点一次〔建立〕，面板认出"只有桶没有文件"的空脚手架会接着往下做）。
  判据与理由在 `src/pure/createfeature.ts` 的「建目录：三条路」一节，行为在 `test/create-flow.test.ts` 钉住。
- **宿主半侧改动要重启 dsh 才生效**（`lib/index.js` 没有 HMR 轮询；`lib/client.js` 有）。
- 浏览器半侧是**手写的单文件 `src/client.js`**（v5 重写后约 1400 行，含全部 React 组件）——
  纯函数与加载器都在 `src/pure|port|load` 里（有测试、有 lint 网），**组件层没有单独拆目录**。
  多模块 TypeScript 拆分的来龙去脉见 [ADR 0001](./docs/adr/0001-multi-module-typescript-source.md)。
- 组件层没有渲染测试；`tools/smoke-client.mjs` 用的是**假环境**（假 `window`、假 `React`、假 `ctx`），
  只证明"能加载、形状对、注册调用对"，**不渲染组件**（hooks 违规、渲染期 `ReferenceError` 测不到）。
  这一类的旧防线 `legacy/check-sandbox.js` 已按 ADR 0001 删除，替代是 `no-undef`（静态，覆盖
  `pure/port/load` 与组合根源码，**覆盖不到组件渲染**）+ `npm run smoke`（覆盖加载期）。
- `syntax-check.js` 那 16 条**产品行为正则自查**没有替代品（见上面 `legacy/` 一节）。
- 组件层**已经有渲染网了**（v5 新增）：`npm run smoke:render` 用一个迷你 React 逐遍真跑组件树
  （初始帧 / 卡片墙 / 真数据详情 / 三个模块 / 技能用法弹窗 / 配置向导 / 新建表单），断言屏幕上真出现了该出现的字。
  它**仍未覆盖**：状态更新后的重渲染、副作用（`useEffect` 不跑）、真实 DOM 与样式 ——
  所以面板在浏览器里"逐屏无差异"还是只能人看。
  加载期那条网仍是 `npm run smoke`；静态那条是 `no-undef`（`pure/port/load` 与组合根源码）。
- **决策记录的三道保证里有一道不在面板这边**：面板只读那个文件；真正写它的是会话里的 agent。
  详见 [`outputs\策划工作台-操作文档.md`](../outputs/策划工作台-操作文档.md) 第三节与「已知限制」。

## 技能用法弹窗（面板上怎么看 sr 技能怎么用）

卡片墙头部有〔技能用法〕按钮，点开是一个弹窗，里面**就是那份使用说明的 md 原样渲染**
（主线五步、旁支、skill 一览、术语、产出落盘摘要、两条共用规矩的指针 —— 表格就是表格）。

**内容只有一个来源**：包内 `skills/sr-askme/references/使用说明.md`（**整份字节**）。
面板**不复制**、也**不解析**任何一句教学文字 —— 技能改了，重开弹窗即变。

- 数据是**构建期快照**：`npm run gen:teaching` 把那份 md 写进 `src/generated/teaching.js`
  （`{ markdown, source }`），面板 `import` 直接用 —— 零网络、零基址、零失败面
  （7.0.0 之前那条 `GET /sr-workbench/teaching.json` 与多基址探测都已删掉）；
- 渲染**两支**：宿主给了官方 `MarkdownText` 就交给它；拿不到走自绘的
  `src/ui/mdview.js`（分块与行内拆分在 `src/pure/mdview.ts`，有单测）。
  表格 `table-layout: auto` + `white-space: normal`（长单元格换行，不撑破弹窗）；
- 判据：`npm run check:teaching`（进 `build:safe`）—— **快照 == 该 md 的字节** /
  md 里 ≥2 个表格 / **SKILL.md 里不再有教学正文**（正文只许有一份）/ 产物里不许再有那条路由；
  渲染那一层由 `npm run smoke:render` 盯：自绘臂断言真出 `<table>`、标题、`<strong>`，
  官方臂断言**整份 md 原文真的交给了 `MarkdownText`**；
- 设计稿：`outputs\技能用法弹窗-设计方案.md`；界面预览：`outputs\技能用法弹窗-界面预览.html`。
