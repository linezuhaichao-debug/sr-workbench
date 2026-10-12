# 内置渲染器来源与校验（PROVENANCE）

本文内相对路径一律相对 **skill 根**（`sr-gdd-html/`）解析。

## 来源

| 项 | 值 |
| --- | --- |
| 名称 | answer-me-with-html（命令行 `am`） |
| 上游仓库 | https://github.com/QingYunA/answer-me-with-html |
| 许可 | **MIT**（全文见 `resources/am/LICENSE`，随文件一起内置） |
| 内置版本 | `0.4.15`（`node resources/am/am.mjs --version`） |
| 引入日期 | 2026-10-13（sr-gdd-html 重建为"定稿人读版"时） |
| 运行要求 | **Node.js 20+**（只用内置模块，无第三方依赖、无需 `npm install`） |

## 已入库文件（原样，未改动一个字节）

| 文件 | SHA256 | 字节数 |
| --- | --- | --- |
| `resources/am/am.mjs` | `BAEFF6D3EE90FDCB0D095275FC3D46DD3F5114A0E84367442753BC70E24B769B` | 532768 |
| `resources/am/LICENSE` | —（上游 LICENSE 原文 + 出处说明；新增文件，非上游原件） | — |

`am.mjs 逐字节一致`是这份内置关系的唯一判据：`Get-FileHash resources\am\am.mjs -Algorithm SHA256` 对得上即视为未被就地修改。

### 为什么不整包安装、而是内置单文件

上游 `answer-me-with-html` 是一个**技能包**（SKILL.md + references + scripts）。本 skill 只借它的**渲染器**，不借它的技能语义（"把一次回答画成一页"是另一回事，不是 GDD 的职责）。所以只内置 `scripts/am.mjs` 这一个文件 + LICENSE：

- 它是**单文件、零依赖**的 CLI，拷进来就能跑，同事装策划工作台插件即完整可用（不需要自己装 answer-me-with-html）；
- 版本、字节数与 hash 都记在这里，升级时整体替换、更新三行数字即可；
- 上游若改了页面语汇，本 skill 的 `references/draft-format.md` 要跟着复核一遍（组件的**最小语法**在那里有示例）。

## 本 skill 自研件（非 am 原件）

| 文件 | 说明 |
| --- | --- |
| `tools/cover_check.py` | **不漏信息校验器**：把定稿当成"信息基线"抽出锚点（章节、表格行的首列、反引号里的表名/字段名、Rn/UEn/ACn 编号），逐个查草稿里有没有落点；未命中一律列出来，必须逐条处置。`--list` 只列锚点（第 2 步盘点用） |
| `tools/apply_reading_layout.mjs` | **阅读版版式补丁**：往 am 渲染出的页面里加一段样式，让「界面图 + 正文」的面板变成**图左、规则右、图吸顶**（规则再长图也留在视野里，与 `sr-gdd-ue` 的宣讲版式同一个用意）。只加样式、不碰内容，幂等。两条**必须如此**的实测理由：① 图要受视口高度约束（`46vh`），否则竖屏截图比右栏还高、吸顶行程是 0；② am 的 `.am-panel` 带 `overflow: hidden`，它是 sticky 的裁剪祖先，不放开就**完全吸不住**（声明在、滚起来照样走） |
| `tools/smoke_check.mjs` | 视觉冒烟检查器：无头浏览器真渲染，查破图 / 横向溢出 / 图片是否 data: 内嵌 / 无外部资源 / 面板数 / 目录锚点 / 草稿源内嵌 / **界面图是否真吸顶**（含滚动实测），并输出整页截图供人目视复核。Node ≥ 22 + 本机 Chrome/Edge，无第三方依赖 |
| `references/draft-format.md` | **定稿 → 草稿的映射规范**：哪一节用什么组件、面板怎么切、写作纪律与红线 |
| `examples/合成示例/` | 合成形态基准（草稿 + 占位图 + 生成产物），形态是"一份定稿 §1–§11 的人读版" |
| `resources/am/LICENSE` | 上游 MIT 全文 + 出处（合规需要的版权声明） |

## 上游更新时

1. 取到新版 `am.mjs`，先看版本号与 CHANGELOG（上游仓库）；
2. 整体替换 `resources/am/am.mjs`（**不要局部改**——改了就不再是上游那一份，hash 也就失去意义）；
3. 更新本文的版本、SHA256 与字节数；LICENSE 若上游有变，一并替换；
4. 跑一次 `examples/合成示例/` 的复现命令，确认草稿仍能渲染；再抽查 `references/draft-format.md` 里引用的组件最小语法（跑 `node resources/am/am.mjs list` 与 `am help <组件>` 对一遍）。

## 复现命令

```bash
node resources/am/am.mjs render "examples/合成示例/draft.md" --no-open -o "examples/合成示例/01_人读版_示例.html"
node tools/apply_reading_layout.mjs "examples/合成示例/01_人读版_示例.html"   # 版式补丁（图左文右 + 图吸顶）
```

## 日常用法（本 skill 只用到这几条）

```bash
node <skill>/resources/am/am.mjs render <草稿.md> -o <输出.html> --no-open   # 渲染
node <skill>/resources/am/am.mjs lint   <草稿.md>                            # 只跑 STE 文风检查
node <skill>/resources/am/am.mjs patch  <输出.html> --panel "<面板标题>" --from <新面板.md>   # 只改一个面板，原地覆盖
node <skill>/resources/am/am.mjs list                                        # 模板 / 主题 / 组件清单
node <skill>/resources/am/am.mjs help <组件|format|image|code>               # 某个组件的语法
```

`am render` 默认把页面写进 `~/.answer-me-with-html/pages/`；本 skill **一律用 `-o` 指定到功能目录**（见 `SKILL.md` 的「产出规范」）。渲染器只读草稿与图片，不写别处。
