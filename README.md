# dsh-client-ui-sr-workbench —— 策划工作台（DSH 客户端插件）

按"功能"组织策划工作的**只读面板**，作为 DSH Web 会话界面里与对话并列的一级面板。
术语与设计口径见 [`CONTEXT.md`](./CONTEXT.md)；为什么独立成仓库、为什么产物入库，见
[`docs/adr/0003-workbench-ships-as-its-own-repo.md`](./docs/adr/0003-workbench-ships-as-its-own-repo.md)。

这是一个 **DSH 客户端插件包**：宿主半侧（Node）只有一行空的 `apply`，浏览器半侧是一个
`window.__ModuleLoader__.load({ id, factory })` 形态的 bundle。

```
仓库根/
├─ src/
│  ├─ index.js      # host 半侧（Node ESM 入口）—— 构建成 lib/index.js
│  └─ client.js     # 浏览器半侧（唯一的实现源码）—— 构建成 lib/client.js
├─ lib/             # ★ 构建产物，**入库**（clone 即安装；不要手改）
│  ├─ index.js
│  └─ client.js
├─ tools/           # 本仓库自己的检查脚本（构建管线的护栏）
│  ├─ smoke-client.mjs    # 假 window/require/ctx 冒烟：加载 + apply + slot 注册形状
│  └─ check-no-react.mjs  # 判据：产物里没打包 React，只有 require("react")
├─ legacy/          # 历史自查/回归脚本（**仅历史用途**，见下）
├─ docs/adr/        # 架构决策记录（随包，来源见下）
├─ CONTEXT.md       # 术语表（随包，来源见下）
├─ package.json
└─ tsdown.config.ts # 构建配置（复刻 DSH 官方客户端插件的 clientBundle preset）
```

---

## ⚠️ 改了 `src/` 必须先 build 再提交

`lib/` 是**构建产物但入库**——本机没有私有 registry，分发走 git，"clone 即安装"成立的前提就是
仓库里带着构建好的 `lib/client.js`。所以：

```powershell
npm run build     # 或开发时开着 npm run watch
git add src lib && git commit -m "…"
```

**只改 `src/` 不 build 就提交 = 把仓库改坏**：别人 clone 下来装的还是旧 bundle，而源码看起来是新的。
反过来，**不要手改 `lib/`**——下次 build 就冲掉。

---

## 构建

```powershell
npm install          # 只装 devDependencies（tsdown）
npm run build        # tsdown → lib/index.js + lib/client.js
npm run watch        # 开发时后台跑；写完存盘，约 1 秒后浏览器自动热加载
npm run smoke        # 构建产物冒烟自检（tools/smoke-client.mjs）
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

核对方法：`legacy/check-sandbox.js` 会打印它扫到的全部函数名清单，
新旧两份 `client.js` 对比**只差 `errText`**。

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
本票（工单 02）把它们整体搬进仓库，只做了一件事：把写死的旧路径改成指向本仓库的 `lib/client.js`。
`legacy/package.json` 强制 CommonJS（仓库根是 `"type": "module"`）。

| 脚本 | 作用 | 现在的状态 |
|---|---|---|
| `check-sandbox.js` | 把 factory 体整段放进沙箱执行，挨个调用组件函数抓未声明标识符 | **仍有效**（语义检查；对新 bundle 跑：78 个函数、0 处未声明） |
| `syntax-check.js` | 16 条模式匹配自查（hooks 违规、`ctx.config`、缺 signal…） | **仍有效**（对新 bundle 跑通过） |
| `check-ids.js` | 上一个版本的"未声明标识符"扫描（正则式） | **已废弃**：对手写版也报 80 项假阳性，正是 `check-sandbox.js` 要取代它的原因 |
| `test-buckets.js` `test-finalgdd.js` `test-refgraph.js` `test-ledger.js` `test-topic.js` `test-dashboard-v1.js` `test-finalcheck.js` `test-mdcheck.js` `test-toabs.js` `test-refgraph.js` | 按**哨兵字符串切片** + `new Function` 从 `client.js` 里抽出真实代码段来跑 | **已失效**：它们的切片锚点绑定手写版的排版，构建产物经 rolldown 重排后抽不到（报"抽取失败"）。按 ADR 0001 这批测试本来就要改成直接 `import` |
| `test-parse5.js` `test-mdspec.js` `test-validate.js` | 不依赖切片（读真实文件） | **仍有效** |
| `sync-intake.js` | 比对 `client.js` 内联 INTAKE 与 `intake-parse.js` 两份副本的函数体指纹 | **已失效**：拆分后不再有两份副本 |
| `migrate-to-features.js` | 旧扁平层 → `features\<主题>\<桶>\` 的迁移 | 历史一次性脚本 |
| `intake-parse.js` | 当年的"跨文件复用"尝试 | **已废弃**：DSH 运行期只服务 `client.js` 一个入口（坑 11），这份逻辑现在是 `src/client.js` 里的内联 INTAKE |
| `test-intake.mjs` | `intake-parse.js` 的离线回归（28 项） | 随 `intake-parse.js` 一起废弃；已改成本目录内相对 `import` |
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

- 浏览器半侧仍是**手写的单文件 `src/client.js`**（约 5100 行）。多模块 TypeScript 拆分见
  [ADR 0001](./docs/adr/0001-multi-module-typescript-source.md)，**不在本票范围**。
- 组件层没有渲染测试；`tools/smoke-client.mjs` 用的是**假环境**（假 `window`、假 `React`、假 `ctx`），
  只证明"能加载、形状对、注册调用对"，**不渲染组件**（hooks 违规、渲染期 `ReferenceError` 测不到——
  那一类由 `legacy/check-sandbox.js` 覆盖）。
- 面板在浏览器里"逐屏无差异"只能人看，自动化测不到。
