# 内置渲染器来源与校验（PROVENANCE）

本文内相对路径一律相对 **skill 根**（`sr-gdd-html/`）解析。

## 来源

| 项 | 值 |
| --- | --- |
| 名称 | answer-me-with-html（命令行 `am`） |
| 上游仓库 | https://github.com/QingYunA/answer-me-with-html |
| 许可 | **MIT**（全文见 `resources/am/LICENSE`，随文件一起内置） |
| 上游版本 | `0.4.15`（`node resources/am/am.mjs --version`；**本 fork 未改版本号**，改它可能触发上游的版本检查） |
| 引入日期 | 2026-10-13（sr-gdd-html 重建为"宣讲稿"技能时） |
| 运行要求 | **Node.js 20+**（只用内置模块，无第三方依赖、无需 `npm install`） |

## ★ 本仓库这一份是 **fork**（有本地改动，不再是上游原件）

| 文件 | SHA256 | 字节数 |
| --- | --- | --- |
| `resources/am/am.mjs`（**本 fork**） | `1CDC39A11DF40287C783AE976B413FFECFC910594B70CD22079A6674BE0CE8CB` | 545638 |
| 上游 0.4.15 原件（**仅供参考**，不随仓库） | `BAEFF6D3EE90FDCB0D095275FC3D46DD3F5114A0E84367442753BC70E24B769B` | 532768 |
| `resources/am/LICENSE` | —（上游 MIT 原文 + 出处说明） | — |

`Get-FileHash resources\am\am.mjs -Algorithm SHA256` 现在对的是**我们这一份**：
换版本、或误拿上游原件覆盖回来，hash 都会变——**那正是判据**（`tools/smoke_check.mjs` 第 7、8、9 项会红）。

### 为什么 fork（而不是"渲染后再改 HTML"）

这四件事**本该是生成器的逻辑**。做成后处理有两个真问题：每一步要跑两次（渲染 + 补丁），而且 **`am patch` 一重渲就把补丁冲掉**（实测：只改一个面板，页面立刻回到 30 处字母、样式块消失）。所以直接改在 am 里，一条 `am render` 到位。

### 改动点 1 · 面板头部不再输出字母方块

`render` 里那一处：`<header class="am-panel-head"><span class="am-panel-id">…</span><h2>…` → 去掉那个 `<span>`。

理由：宣讲稿的面板标题**已经带着定稿自己的章节号**（`§4.4 R4 战斗`），am 再套一个字母（头部一个方块 + 目录里一个 `G · ` 前缀）＝**两套编号叠在同一行**，对读者毫无作用、纯噪音。

### 改动点 2 · 左侧目录只输出标题

`const toc = …` 里 `` `${esc(p.id)} · ${esc(p.title)}` `` → `` `${esc(p.title)}` ``。

同上的另一半。**这一处在后处理里删不掉**：字母和标题是 am 拼成的**一个文本节点**，CSS 够不着——只有生成时不拼它才行。

### 改动点 3 · `BASE_CSS` 末尾追加一段 SR 定制样式

- `.am-panel-head { padding-inline-start: 14px }` —— 补回改动点 1 让出来的左内边距；
- `.am-toc { max-height: calc(100vh - 48px); overflow-y: auto; … }` —— **左侧目录自己滚**：宣讲稿动辄 20+ 个面板，目录比视口高，而 **sticky 留不住比视口高的元素**，它会跟着正文往下走、读者点不到下面的章节（实测反馈）；
- `.am-panel:has(.am-md > .am-figure ~ *) { overflow: visible }` 与 `.am-md:has(> .am-figure ~ *) { … }` —— **界面图与正文并排、图吸顶**（对着图读规则）。两条**必须如此**的实测理由：图要受视口高度约束（`46vh`），否则竖屏界面截图比右栏还高、sticky 的可用行程是 0；`.am-panel` 自带 `overflow: hidden`，它是 sticky 的裁剪祖先，不放开就**完全吸不住**。

四处都带 `★★ SR 定制（sr-gdd-html）★★` 注释，合并上游时按这个标记找；改动点 4 的 JS 那半在 `RUNTIME_JS` 末尾，锚点是注释行 `// ④ 目录标出`（它不在上面那段 CSS 注释块里）。

### 改动点 4 · 左侧目录标出「正在读的章节」（2026-10-13 加）

两处：

- CSS（追加在 `★★ SR 定制` 块的 ④ 行）：`.am-toc a.am-toc-current { color: var(--ink); font-weight: 600; border-inline-start-color: var(--accent); }`；
- JS（追加在 `RUNTIME_JS` 末尾、`})();` 闭合之前）：一个自包含 IIFE —— 取 `.am-toc` 的锚点与对应面板，滚动时把「最后一个越过页面上沿 88px 的章节」标成 `.am-toc-current`（只留一个）；目录自身比视口高时，还把当前项滚进目录可视范围（只改目录的 `scrollTop`，不动页面滚动）。

理由：**目录能滚 + 能点，但读者不知道自己读到哪一节**——35 个面板的长文档，没有"当前章节"反馈时，左侧目录只是一个跳转列表（实测反馈：目录改成可滚动之后，读者问"当前看的章节选中效果呢"）。这一处与改动点 3 的 `.am-toc` 滚动是**一对**：目录会滚，才更需要"当前项自动可见"。

★ 它**不是**某个旧功能的回归——本 fork 与上游 0.4.15 都没有过当前章节高亮（`IntersectionObserver` / `is-active` / `aria-current` 三者在 fork 前的渲染产物里都是 0 处），这一处是新增。

### 为什么不整包安装、而是内置单文件

上游 `answer-me-with-html` 是一个**技能包**（SKILL.md + references + scripts）。本 skill 只借它的**渲染器**，不借它的技能语义（"把一次回答画成一页"是另一回事，不是 GDD 的职责）。所以只内置 `scripts/am.mjs` 这一个文件 + LICENSE：

- 它是**单文件、零依赖**的 CLI，拷进来就能跑，同事装策划工作台插件即完整可用（不需要自己装 answer-me-with-html）；
- 版本、字节数与 hash 都记在这里；上游若改了页面语汇，本 skill 的 `references/draft-format.md` 要跟着复核一遍（组件的**最小语法**在那里有示例）。

### 上游更新时（**要重放这三处改动**）

1. 取到新版 `am.mjs`，先看版本号与 CHANGELOG（上游仓库）；
2. **不要直接覆盖** —— 按上面四个改动点把我们的改动重放到新版上（搜索 `am-panel-head`、`const toc =`、`.am-panel--bare .am-kv`、`// ④ 目录标出` 四处锚点；新 CSS 整段追加在 `BASE_CSS` 末尾、JS 追加在 `RUNTIME_JS` 末尾，都带 `★★ SR 定制` 注释）；
3. 更新本文的**上游版本**与两个 SHA256 / 字节数；LICENSE 若有变，一并替换；
4. 跑 `examples/合成示例/` 的复现命令 + `tools/smoke_check.mjs` —— **第 7、8、9 项是改动点 1/2/3 的判据**；**改动点 4 目前还没有进 smoke**（判据是一条临时检查：载入后目录高亮唯一且在第一节、滚到 §7 后高亮切到 §7 且仍在目录可视范围内、计算样式为 `font-weight:600` + 强调色左边线），加进 smoke 第 10 项待定；
5. 抽查 `references/draft-format.md` 里引用的组件最小语法（`am list` 与 `am help <组件>` 对一遍）。

## 本 skill 自研件（非 am 原件）

| 文件 | 说明 |
| --- | --- |
| `tools/cover_check.py` | **不漏信息校验器**：把定稿当成"信息基线"抽出锚点（章节、表格行的首列、反引号里的表名/字段名、Rn/UEn/ACn 编号），逐个查草稿里有没有落点；未命中一律列出来，必须逐条处置。`--list` 只列锚点（第 2 步盘点用） |
| `tools/smoke_check.mjs` | 视觉冒烟检查器：无头浏览器真渲染，查破图 / 横向溢出 / 图片是否 data: 内嵌 / 无外部资源 / 面板数 / 目录锚点 / 草稿源内嵌 / **界面图是否真吸顶**（含滚动实测）/ **面板字母 ID 是否清干净** / **左侧目录能否独立滚动**（滚到文档中部实测），并输出整页截图供人目视复核。★ 后三项同时是"内置 am 确实是本 fork"的判据。★ 视口高默认 **900px**（`--height` 可改）：目录 35 个面板时约 1045px 高，用 1200px 视口测会把它塞得下、第 9 项什么都测不出来，而真实 ~900px 视口里它超高、sticky 失效。Node ≥ 22 + 本机 Chrome/Edge，无第三方依赖 |
| `references/draft-format.md` | **定稿 → 草稿的映射规范**：哪一节用什么组件、面板怎么切、写作纪律与红线 |
| `examples/合成示例/` | 合成形态基准（草稿 + 占位图 + 生成产物），形态是"一份定稿 §1–§11 的宣讲稿" |
| `resources/am/LICENSE` | 上游 MIT 全文 + 出处（合规需要的版权声明） |

## 复现命令

```bash
node resources/am/am.mjs render "examples/合成示例/draft.md" --no-open -o "examples/合成示例/01_宣讲稿_示例.html"
```

**一条就够**：去字母、图吸顶、目录独立滚动都在 am 里，没有第二步。

## 日常用法（本 skill 只用到这几条）

```bash
node <skill>/resources/am/am.mjs render <草稿.md> -o <输出.html> --no-open   # 渲染（版式与去字母都在里面）
node <skill>/resources/am/am.mjs lint   <草稿.md>                            # 只跑 STE 文风检查
node <skill>/resources/am/am.mjs patch  <输出.html> --panel "<面板标题>" --from <新面板.md>   # 只改一个面板，原地覆盖
node <skill>/resources/am/am.mjs list                                        # 模板 / 主题 / 组件清单
node <skill>/resources/am/am.mjs help <组件|format|image|code>               # 某个组件的语法
```

`am render` 默认把页面写进 `~/.answer-me-with-html/pages/`；本 skill **一律用 `-o` 指定到功能目录**（见 `SKILL.md` 的「产出规范」）。渲染器只读草稿与图片，不写别处。
