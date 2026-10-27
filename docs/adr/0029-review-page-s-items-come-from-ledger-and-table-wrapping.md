# 0029 · 策划审核版的两个坑：S 项只认台账、表内换行会打断章节投影

- 日期：2026-10-19
- 状态：**已接受**（本轮按"先建台账条目再重生成""表内换行只去换行、字符零增删"通过；**脚本补丁未做，待用户决定**）
- 相关：
  - `skills/plan-doc-ai-version/scripts/generate_derived_view.py` §`pending_ledger_items()`（唯一活动台账里 `state ∈ {pending, blocked}` 的条目 → 审核版 S 卡片；`priority == "P0"` 或 `state == "blocked"` 记为阻断）
  - `skills/plan-doc-ai-version/scripts/derived_view_renderer.py` §`render_review_page()`（`S-{index:03d}`；状态行 `待策划裁决：N 非阻塞边界：0 当前可进入整体签收：是/否`）
  - `skills/plan-doc-ai-version/scripts/derived_html_feedback.py` §`_section_mapping_failures()` / `_excerpt_failure()` / `_SENTENCE_SPLIT_RE` / `_SectionContentCollector._BLOCK_BOUNDARY_TAGS`
  - `skills/plan-doc-ai-version/scripts/markdown_text.py` §`projection_text()`（**逐行**用空格连接）
  - 功能侧实例：运行包 `运行包_圣物系统\`（`策划裁决台账_圣物系统.json` revision 4 → 审核版 S-001–S-004）

## 背景

### 1. 审核版的「需要你判断的AI处理项」不由候选稿决定，只由台账决定

`generate_derived_view.py::pending_ledger_items()` 扫运行包里的**唯一活动**台账（多份则阻断、非法则阻断），把 `state ∈ {pending, blocked}`
的条目渲染成页面内的 `S-001…`，并按 `priority == "P0"` 计算 `当前可进入整体签收：是/否`。没有台账或台账全闭合时，页面固定输出
`本轮无额外AI处理项需要单独判断` ＋ `待策划裁决：0 非阻塞边界：0 当前可进入整体签收：是`。

后果：正文里写了 `S01/S02`、页面却自报"无 AI 处理项"——**两边会互相矛盾**，而这个矛盾不会被签名校验拦住。

### 2. 目标 HTML 一旦注册，生成器不再覆盖

`generate_derived_view.py` 对已带 `plan-doc-derived-view` 元数据的同名页会以 `reason_code: already_registered` 拒绝（源未变化时），
提示走 `--claim regenerate` / `--claim source`。也就是说：改台账后要刷新审核版，必须
**先跑生成器拿 `.draft.html`，再用 `derived_html_feedback.py --claim regenerate --html <已注册页> --new <草稿>` 注册**。

### 3. 表格单元格里的换行会让章节投影"凭空多出一句"

口径链：源侧 `projection_text()` 把 Markdown **每一行**用空格连接；HTML 侧 `_SectionContentCollector` 在块级标签（含 `td/th/tr`）边界分段、
再 `normalize(" ".join(parts))`；`_excerpt_failure()` 按 `[.!?。！？；\n]` 切句，要求**每段都是源章节的原文子串**。

于是当定稿表格里有一行"行尾没有竖线"的**表内换行**（单元格内容写成两行以上）时：
- 渲染器把该行当普通段落，其后各行**丢掉了单元格竖线**；
- 源侧投影却是逐行拼接，`|` 全部保留；
- 于是一段跨行文本在 HTML 侧是 `) cost table 每次抽取消耗（圣物抽卡券） fir…`，在源侧却是 `…。) | cost | table | 每次抽取消耗（圣物抽卡券） | …`
  → 判定"源章节中不存在的语句" → `create_section_mapping_failure`，页面生成被拒。

本轮实测根因：定稿 §6.1「圣物常量表」`hiddenGuaranteeConfig` 行的单元格被写成三行（第三行才是带 `|` 的结尾行）。

## 决定与规避

1. **要暴露判断项，先落台账**：`decision_ledger.py add --priority P1`（非阻塞，计入"待策划裁决 N"）或 `P0`（计入阻断，页面自报不可签收）→ 再重生成审核版。
   S 编号是**页面内序号**，与台账 `Q-###` / `C-###` 不同名同源，别把两者混作同一套 ID。
2. **刷新已注册的审核版**：`generate_derived_view.py`（拿 `.draft.html`）→ `derived_html_feedback.py --claim regenerate --new <草稿>`（源未变）或 `--claim source`（源已变）。
   不手改已注册页的正文；展示白名单内的改动才走 `--claim view`。
3. **表内换行的处置口径**：只把单元格内的换行**去掉**（拼成一行），**一个字符不增删**，并用
   `sec.replace("\n", "") == sec_raw.replace("\n", "")` 断言；**不改定稿原文**，修复只在 AI 读版产物里，并在 `00_本轮处理说明.md` 写明。
   多段内容应在单元格内用 `；`，不要让 Markdown 行断开。

## 纪律

- 生成审核版前先查台账：**页面上的 S 项数 = 台账未闭合条目数**；发现自己正文里引用过 S 编号却页面为 0，说明台账没建。
- 表格里不要"换行写单元格"；这是**下游解析 + 派生页投影双重**的坑，不只是排版问题。
- 审核版缺「多语言Key清单 / 配置范围」折叠附录是**生成器模板现状**（圣物系统与联盟讨伐两个包都报同一条 WARN，模板只产出空的「承接覆盖索引」折叠），
  属模板级非阻断项；同内容仍在页内折叠的「完整候选稿」里。

## 影响

- **本轮实例**：圣物系统台账 revision 4（pending 4 / P0 0）→ 审核版渲染 S-001–S-004 与「待策划裁决：4 非阻塞边界：0 当前可进入整体签收：是」；
  自检 `PASS_WITH_WARNINGS`（2 条模板级附录缺失）；`--claim regenerate` 返回 `REGENERATED`（源 sha `5845299e…` 未变，未产生写回事件、不要求签收）。
- **风险未消除**：任何"定稿表格里带换行"的功能首次生成审核版都会命中同一个拒绝；生成器也不会自动补那两个附录。
- **建议补丁（未做，待用户决定）**：① `generate_derived_view.py` 命中 `already_registered` 时直接打印 regenerate 命令；
  ② 让 `_SectionContentCollector` 的表格 join 口径与 `projection_text()` 对齐（或对含表格的章节按块比对，而不是按句子子串）；
  ③ 模板补 `多语言Key清单` / `配置范围` 两个折叠附录（或直接产出「承接覆盖索引」内容）。

## 补充（同日实测）：先跑干净 delivery 判据，再发布

首版发布**之后**又改了正式版 → `formal_drift` fail-closed：`publish_downstream_package.py` 与 `prepare_writeback_event.py --init`
被同一条 `detect_package_compatibility` 一起挡住（提示"不要自行选择新旧流程或修改历史文件"）。也就是说，
**发布过之后再改正式版，必须走写回事件；而写回入口本身又被漂移挡死**——只能先恢复一致性。

顺序与恢复口径：

1. **先把正式根跑干净再发布**：正式版 + 多语言覆盖索引 + §7 表按 delivery 判据自查（GT 绑定表列名、活动文本需求暴露、未核验措辞、
   audit-only 边界），再 `publish_downstream_package.py` 首次发布。
2. **发布后的任何改动都开写回事件**（编辑性改动也开）：`prepare_writeback_event.py --init` → 填轻量变更稿 + 输入记录 → `--prepare`
   → 补组件闭合 → `--activate`（编辑性事件自动落 `editorial_complete`，不要求策划签收）→ 再 `--publish`。
3. **踩坑后的恢复**：把正式版**逐字节还原成"已发布的那一版"**（本轮用生成器的 `revert-editorial` 开关重建，SHA 与发布状态记录相同），
   漂移即消失，之后才能 `--init` 开写回。

写回事件填写的三个硬口径（本轮被校验器逐条打回后改正）：

| 字段 | 正确写法 | 打回信息 |
| --- | --- | --- |
| `change_type` / `impact_dimensions` | `editorial_only` 时 `change_type` 必须是 **`editorial`**（不是 `modify`），`impact_dimensions` 只能是 **`["no_semantic_change"]`**，`editorial_kind` ∈ typo/punctuation/formatting/link_repair/metadata_only | `editorial_only is outside the narrow allowlist` / `must use only no_semantic_change` |
| `target_sections` | 必须是**正式版 H2 标题逐字**（含编号，如 `7. 多语言引用`） | `claims sections with no machine diff` / `machine-changed section(s) absent from changes[]` |
| `components[kind=localization].evidence` | 必须同时写明**分流结论**（无文本变化 / 需求记录模式 / 落表闭环模式）、**比较基准**（对照 / 比对 / 检查范围 …）与**权威源状态**（GTGenerator / 权威源 / 未提供源 …） | `must state localization triage` / `comparison basis` / `authoritative-source status` |

另两条操作注意：① 激活时工具会 `subprocess` 调 `validate_run_package.py`，父进程按 GBK 解码子进程输出——
把环境变量设成 `PYTHONIOENCODING=gbk` 才不会在读取阶段 `UnicodeDecodeError`；② 工具在准备/归档时对同名文件有**短暂不可读窗口**
（atomic replace 的中间态），同一命令里紧接着读它可能报 `FileNotFoundError`，重试或分两步执行即可。
