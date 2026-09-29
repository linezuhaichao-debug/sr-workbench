# dsh-client-ui-sr-workbench —— 策划工作台（DSH 客户端插件）

按"功能"组织策划工作的**只读面板**，作为 DSH Web 会话界面里与对话并列的一级面板。
术语与设计口径见 [`CONTEXT.md`](./CONTEXT.md)；为什么独立成仓库、为什么产物入库，见
[`docs/adr/0003-workbench-ships-as-its-own-repo.md`](./docs/adr/0003-workbench-ships-as-its-own-repo.md)。

这是一个 **DSH 客户端插件包**：宿主半侧（Node）从 `src/generated/skills.ts` 里把 12 个 sr 技能
`ctx.skills.register(...)` 进全局层（工单 05「技能随包注册」，见下文），浏览器半侧是一个
`window.__ModuleLoader__.load({ id, factory })` 形态的 bundle。

```
仓库根/
├─ src/
│  ├─ index.js      # host 半侧（Node ESM 入口）—— 构建成 lib/index.js：把随包 sr 技能注册进 global 层
│  ├─ generated/
│  │  └─ skills.ts  # ★ 构建期生成、**入库**：12 个 sr 技能的正文 + 来源 sha256 清单（不要手改）
│  ├─ client.js     # 浏览器半侧**组合根**（手写单文件，工单 03 的后续票才接回下面的层）
│  │                #   构建成 lib/client.js
│  ├─ pure/         # 零依赖纯函数（12 个）—— 主题派生 / 产物分类 / 定稿解析 / 引用图 / 台账 / 校验 / 路径归一
│  ├─ port/         # WorkspacePort：接口 + 生产实现（ctx.remote.*）+ 测试替身（node:fs 直读真实工作区）
│  ├─ load/         # 加载器 —— 只吃 port，产出视图模型（看板 / 功能详情 / 台账 / 定稿 / 界面图）
│  └─ actions/      # 唯一副作用出口 —— 只发 prompt / 权限 / 会话操作
├─ test/            # node --test 直跑（.ts 由 Node 的类型剥离加载）：14 个测试 + paths.ts 真实数据坐标
├─ lib/             # ★ 构建产物，**入库**（clone 即安装；不要手改）
│  ├─ index.js      #   宿主半侧（内联着 src/generated/skills.ts 的 12 条技能正文）
│  └─ client.js     #   浏览器半侧
├─ tools/           # 本仓库自己的检查脚本（构建管线的护栏）
│  ├─ gen-skills.mjs       # ★ 从磁盘技能目录生成 src/generated/skills.ts（`npm run gen:skills`）
│  ├─ check-host-skills.mjs# ★ 构建后判据：产物里真的注册了 12 条技能（7 步判据，见下文）
│  ├─ smoke-client.mjs    # 假 window/require/ctx 冒烟：加载 + apply + slot 注册形状
│  ├─ check-no-react.mjs  # 判据：产物里没打包 React，只有 require("react")
│  └─ build-safe.mjs      # ★ 安全构建门：漂移门 → 备份 → build → 三道判据；不过就**还原** lib/
├─ legacy/          # 历史自查/回归脚本（**仅历史用途**，见下）
├─ docs/adr/        # 架构决策记录（随包，来源见下）
├─ CONTEXT.md       # 术语表（随包，来源见下）
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

**做法**：构建期把技能正文生成进 `src/generated/skills.ts`（入库），宿主半侧逐条
`ctx.skills.register({ name, description, content, source: 'bundled', invocation })`。
插件是宿主行 ⇒ 注册落进 **global 层** ⇒ 所有会话可见（与今天一致，ADR 0006 已接受）。
`config.local.json` **不打包**（本机私有；`sr-askme` 第 0 步会检查它、缺失就问）。

| 项 | 值（`npm run gen:skills` 实跑） |
|---|---|
| 技能数 | **12 个** `sr-*`（10 个模型可见 + 2 个用户专用：`sr-config-heroskill`、`sr-gdd-html`） |
| 正文合计 | **121,530 字节（118.7 KB）** ← 进包的就是这个 |
| 兄弟资源合计 | 1,588,227 字节（**1.51 MB，不进包**；`sr-gdd-html` 一个占 1.09 MB） |
| 排除的私有文件 | 1 个（`sr-askme/config.local.json`） |

### 生成源：**`.agents\skills`**（仓库上一级），不是 `sr-team-skills`

`--from` 默认解析成"仓库上一级的 `.agents\skills`"（本机 = `D:\TimeMachine\.agents\skills`），
也就是**今天会话真正加载的那一份**。两份技能目录**已经漂移**（`sr-team-skills` 多 17 个文件、
3 个 `SKILL.md` 内容不同），用仓库那份会顺带改变运行时行为，超出工单 05 范围。
⇒ 等 04 把两份对齐之后，改 `--from` 一个参数（或 `npm run gen:skills -- --from <目录>`）即可。
ADR 0006 里写的源是 `sr-team-skills`，**以本节的现状为准**，对齐后一并更新 ADR。

### 漂移要能被发现（不是靠自觉）

```powershell
npm run gen:skills     # 重新生成 src/generated/skills.ts（入库；内容没变会如实说"逐字节相同"）
npm run check:skills   # 只比对不写盘：SKILLS[] 逐字段 + 每个源 SKILL.md 的 sha256
```

`check:skills` 是 `build:safe` 的**第 0 步**（早于 build，失败时 `lib/` 一个字节都没动）：

- 源目录不存在 ⇒ **跳过**（分发到没有 `.agents\skills` 的机器上就是这种情形，以入库产物为准）；
- 源目录在、但有任何一个技能的正文/description/invocation 变了 ⇒ **非 0 退出**，逐条列出是谁漂了。

> 副作用是刻意接受的：**改完技能必须 `npm run gen:skills` 再提交**，否则 `npm run verify` 会红。

### 只嵌正文 —— **只嵌正文 ≠ 技能完整可用**（如实声明）

兄弟文件（`references/` `tools/` `resources/`）**没有进包**（要进包得多带 1.51 MB）。
有兄弟资源的 11 个技能会挂 `resourceBase`：

| 情形 | `resourceBase` | 效果 |
|---|---|---|
| 磁盘技能目录在（本机默认） | `{kind:'directory', path:'<磁盘根>/<技能名>'}` | 注入正文时把基目录告诉模型，相对路径能解析 |
| 磁盘目录不在（同事机器） | `{kind:'opaque', description:'…没有随包分发，磁盘上也找不到技能目录'}` | **如实说明资源不可用**，不假装可用 |
| 技能本身没有兄弟资源（`sr-figma-design-system`） | 不挂这个字段 | 没什么可解析的 |

磁盘根按 `config.skillsRoot` → 环境变量 `SR_SKILLS_ROOT` → 构建期记录的源目录 依次找，都没有就 opaque。
⇒ **纯正文流程不受影响**；依赖兄弟文件的环节（`sr-askme` 的 `references/decision.schema.json`、
`sr-gdd-html` 的 `tools/`）在没 clone 技能目录的机器上仍然缺文件。连兄弟资源一起打包是后续票的选项。

### 同名技能谁赢（不改今天的行为）

rank 越小越赢：`project-dsh 100 < project-agents 200 < **runtime 250** < custom 300 < user-* 400/500 < bundled 600`。
⇒ cwd 命中 `.agents\skills` 的会话里（今天的工作会话）**磁盘那一份仍然赢**，本插件只是"够不到磁盘时顶上"。
实测：在带 `MARKER-DISK` 同名技能的 cwd 里跑，catalog 里 `sr-concept` 的 description 是磁盘那份。

### 脚本

```powershell
npm run gen:skills        # 生成 src/generated/skills.ts（改了技能之后必须跑，否则 check:skills 会红）
npm run check:skills      # 漂移比对（build:safe 第 0 步）
npm run check:host-skills # 产物判据：lib/index.js 真的注册了 12 条（build:safe 第③步）
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
npm test                  # 76 个用例必须全绿
npm run lint              # 分层纪律 + 未声明标识符
npm run check:skills      # ★ 随包技能快照没漂移（源目录不存在时跳过）
npm run build             # 产出 lib/index.js + lib/client.js
npm run smoke             # ★ 必须通过；不过就立刻还原 lib/
npm run check:host-skills # ★ 产物里真的注册了 12 条 sr 技能
```

两条更省事的等价入口（**推荐日常用**）：

```powershell
npm run build:safe  # 漂移门 → 备份 → build → smoke + check:react + check:host-skills；不过就自动还原 lib/ 并非 0 退出
npm run verify      # test → lint → build:safe（交付前该跑的那一条）
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
npm run verify    # 一次过（test → lint → build:safe：漂移门 → build → 三道产物判据）
git add src lib && git commit -m "…"
```

改了技能正文（磁盘上的 `.agents\skills`）还要先 `npm run gen:skills`，否则漂移门会红。

**只改 `src/` 不 build 就提交 = 把仓库改坏**：别人 clone 下来装的还是旧 bundle，而源码看起来是新的。
反过来，**不要手改 `lib/`**——下次 build 就冲掉。

---

## 构建

```powershell
npm install          # 只装 devDependencies（tsdown / eslint / typescript-eslint）
npm run gen:skills   # 从磁盘技能目录重新生成 src/generated/skills.ts（改了技能必须跑）
npm run build        # tsdown → lib/index.js + lib/client.js
npm run build:safe   # ★ 带保险的构建：漂移门 → 备份 → build → 三道判据，不过就还原 lib/
npm run watch        # 开发时后台跑；写完存盘，约 1 秒后浏览器自动热加载（只对 client.js 有效）
npm run smoke        # 构建产物冒烟自检（tools/smoke-client.mjs）
npm run check:react  # 判据：产物里没有 React 实现体，且只有 require("react")
npm run check:host-skills # 判据：lib/index.js 真的注册了 12 条 sr 技能
npm run check:skills # 判据：随包技能快照与磁盘源没漂移
npm test             # 76 个用例（node --test，直接 import 真模块 + 真实工作区数据）
npm run lint         # 分层纪律（见「分层纪律」一节）
npm run verify       # test → lint → build:safe
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
  actions/ 唯一副作用出口 —— 只许 import pure/ 与 port/（同层允许）
  ui/      React 组件（规格里已定名，**尚未拆分出来**）—— 只吃 props
```

`npm run lint` 里跑两张网：

| 网 | 谁 | 抓什么 |
|---|---|---|
| `no-restricted-imports` | 各层 | 点名禁令：React 家族 / `@deepseek-ai/*` / `node:*` / 反向跨层边 |
| `no-restricted-syntax` 的 `ImportDeclaration:not([source.value=/…/])` | 各层 | **白名单方向**（"只能 import 这几个"）；`patterns.group` 的 `!` 取反在 ESLint 9.39 实测无效，所以用这条 |
| `no-undef`（`pure` / `load` / `actions` / `port` / 组合根） | 同上 | **未声明的标识符 = 自由变量** |

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

1. clone 到任意位置（本机开发时是 `D:\TimeMachine\sr-workbench`）：

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

3. 在 `C:\Users\<你>\.dsh\profiles\web\cordis.patch.yml` 里加一行 `insert`：

   ```yaml
   - insert:
       - id: sr-workbench
         name: 'dsh-client-ui-sr-workbench'
         config:
           configPath: '<sr-askme>/config.local.json 的绝对路径'
           projectRoot: '<工作区根绝对路径>'
   ```

   `web` profile 是 `patchReload: live`：**改这个文件即时重组，不用重启**。
   停用 = 把这段 `insert` 注释掉。

4. 客户端 bundle 由 `dsh-client-hmr` 每 500ms 轮询，`lib/client.js` 的 `mtime/size` 一变就热加载；
   新装的插件同一页面不会自动捡起，**F5 一次**。

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
| `check-sandbox.js` | 把 factory 体整段放进沙箱执行、挨个调用组件函数，让运行时自己报**未声明标识符**（`notice is not defined` 那类白屏） | ① `eslint.config.js` 在 `pure` / `load` / `actions` / `port` / 组合根上开 `no-undef`（**静态**抓自由变量）② `npm test` 里 `test/seam.test.ts` 做文本层面的越界检查 ③ `npm run smoke` 抓**加载期**的 `ReferenceError` | **渲染期**的自由变量：`smoke` 用 React 桩、组件根本不渲染，所以 `src/client.js` 里组件体内的未声明标识符现在**没有网**（这正是"把 client.js 接回 pure/ 层"要解决的） |
| `syntax-check.js` | ① `node --check` 全文件语法 ② factory 体语法 ③ **16 条正则式产品自查**（hooks 违规、`ctx.config`、缺 signal、`[object Object]` 拼接、`session.create` 同给 workspaceId+cwd…） | ① ESLint 解析全部源码（语法过不了就红）② `npm run smoke` 真跑 bundle + `apply` + slot 注册形状 ③ `tsdown.config.ts` / `port/dsh.ts` 里那些坑已写进注释与用例 | 那 16 条正则式产品自查**没有替代品**：它们是对**成品行为**的模式断言，随脚本一起消失。要留只能把它们改写成对 `src/client.js` 的正则用例（本票没做，见报告「留给后续票」） |

其余保留的历史脚本状态：

| 脚本 | 作用 | 现在的状态 |
|---|---|---|
| `check-ids.js` | 上一个版本的"未声明标识符"扫描（正则式） | **已废弃**：对手写版也报 80 项假阳性，正是 `check-sandbox.js` 要取代它的原因 |
| `test-buckets.js` `test-finalgdd.js` `test-refgraph.js` `test-ledger.js` `test-topic.js` `test-dashboard-v1.js` `test-finalcheck.js` `test-mdcheck.js` `test-toabs.js` `test-parse5.js` `test-mdspec.js` `test-validate.js` `test-inline-intake.js` | 按**哨兵字符串切片** + `new Function` 从 `client.js` 里抽代码（或读真实文件） | **已被 `test/` 取代**（工单 03）：同一批断言迁到直接 `import` 真模块，`npm test` 76 个用例全绿。切片版随 ADR 0001 删除手法，本目录只留档 |
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
- **宿主半侧改动要重启 dsh 才生效**（`lib/index.js` 没有 HMR 轮询；`lib/client.js` 有）。
- 浏览器半侧仍是**手写的单文件 `src/client.js`**（约 5100 行）——**尚未接回 `src/pure|port|load|actions`**
  （工单 03 只把纯函数层抽出来并测起来，接回是后续票）。两边的重复实现见
  `D:\TimeMachine\outputs\.scratch\策划工作台\03-workspace-port-report.md` 的「残留风险」。
  多模块 TypeScript 拆分的来龙去脉见 [ADR 0001](./docs/adr/0001-multi-module-typescript-source.md)。
- 组件层没有渲染测试；`tools/smoke-client.mjs` 用的是**假环境**（假 `window`、假 `React`、假 `ctx`），
  只证明"能加载、形状对、注册调用对"，**不渲染组件**（hooks 违规、渲染期 `ReferenceError` 测不到）。
  这一类的旧防线 `legacy/check-sandbox.js` 已按 ADR 0001 删除，替代是 `no-undef`（静态，覆盖
  `pure/port/load/actions` 与组合根源码，**覆盖不到组件渲染**）+ `npm run smoke`（覆盖加载期）。
- `syntax-check.js` 那 16 条**产品行为正则自查**没有替代品（见上面 `legacy/` 一节）。
- 面板在浏览器里"逐屏无差异"只能人看，自动化测不到。
