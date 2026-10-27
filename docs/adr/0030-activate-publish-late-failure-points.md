# 0030 · 激活/发布链的三处「最晚才知道」失败点：报错被 GBK 吞、过程措辞门只在发布时开、正式版不能当输入登记

- 日期：2026-10-19
- 状态：**已接受**（本轮按规避手法执行；**脚本补丁未做，待用户决定**）
- 相关：`skills/plan-doc-ai-version/scripts/prepare_writeback_event.py`
  §`_run_scope()`（`subprocess.run(..., capture_output=True, text=True)`，靠 `returncode != 0` 判失败）
  §`activate_event()` 第 1038–1057 行（激活后复验 + 事务回滚）
  · `skills/plan-doc-ai-version/scripts/validate_run_package.py` §`process_text_marker_hits` / §`validate_clean_handoff_process_text`
  · 功能侧指针：`features\联盟讨伐\decisions\决策记录.md` 2026-10-19 条目 · 运行包 `03_AI过程档案_策划通常无需处理\写回事件_WB-20261019-003.json`

## 背景（同一天在同一功能上连续踩到三条）

### 1. 激活失败的**真实原因被解码吞掉**

`_run_scope()` 用 `text=True` 抓子进程输出，父进程按本机 ANSI 代码页（GBK/cp936）解码；子进程写的是 UTF-8 →
reader 线程抛 `UnicodeDecodeError` 直接死掉，`completed.stdout` 变成空串。于是激活失败时的报错长这样：

```
ValueError: 激活事务失败已回滚（…可确定性重试）: ValueError: writeback scope 校验未通过:
        ← 冒号后面是空的
```

真因（本轮是 `inputs[1] hash mismatch`）完全看不见，只能靠"猜 + 手工复跑"。

**规避**：把激活**跑在 UTF-8 模式**下 —— `PYTHONUTF8=1`（PEP 540 会让 `locale.getencoding()` 返回 utf-8，
父进程的 `text=True` 就能正确解码），报错立刻完整显形：

```
PYTHONUTF8=1 python prepare_writeback_event.py … --activate
-> ERROR: 写回事件_WB-20261019-003.json.inputs[1] hash mismatch: 04_AI输出_策划审核/03_正式交付/AI读版策划案_联盟讨伐_正式版.md
```

### 2. 过程措辞门（delivery scope）只在**发布**时才开

`process_text_marker_hits` 用一张固定词表（`本轮新增 / 本轮已 / 本轮未 / 变更记录 / 审核摘要 / 执行记录 / 真实性核验 /
多语言变更需求清单 / 多语言Key真实性核验 / 多语言Key修改执行记录 / 多语言Key落表审核摘要 / 落表审核`）扫描**下游面向文本**；
它只挂在 `--validation-scope delivery` 上，而写回/激活两级（writeback scope）不查。
本轮写回时顺手加的一句「（含**本轮新增**的复用键 `reset_after`）」一路通过 writeback 校验与激活，
到「生成最新下游包」才被拦，而修它**必须再走一次写回 + 策划签收**。

**规避**：起草/改写正式版时，用发布门同一函数自查：
```python
import sys; sys.path.insert(0, "<skill>/scripts")
import validate_run_package as v
print(v.process_text_marker_hits("formal.md", open("formal.md", encoding="utf-8-sig").read()))
```
返回空才算干净（注意该函数会先剥掉严格的审计边界块、并跳过"指向过程档案"的指针行——这两类豁免是设计好的）。

### 3. 把「活动正式版」登记成 `inputs[]` 会在**激活后**报哈希不符

`inputs[].sha256` 记录的是登记时刻的值；活动正式版在激活时会被候选替换，于是激活后的复验必然报
`inputs[N] hash mismatch`。设计上基线已由 `event.baseline` 记录，**正式版不需要、也不应该当输入登记**。

## 纪律

- **激活失败先别猜**：用 `PYTHONUTF8=1` 重跑 `--activate`（事务化，失败会回滚，重试安全），拿完整报错再动手。
- **写回正式版时就把过程措辞清干净**：写完候选稿先跑一次上面那段 `process_text_marker_hits`；别把"下游文档里出现本轮/审核"这类话留到发布时才清。
- **`inputs[]` 只登记"输入材料与证据"**（决策记录、定稿、图片输入、说明文档等）；**活动正式版、候选稿、覆盖索引、闭环**都不是输入。
- 记不清已有哪些输入时，直接读事件的 `inputs[]` 与 `extensions`，不要凭记忆补。

## 影响

- **本轮实例**：清理过程措辞走了 WB-20261019-003（1 行改动、签收级别 `summary`），激活后一次成功；随后发布 `v1.0.20261019` PASS。
- **风险未消除**：
  ① 任何一次激活失败，弱模型/辅助档都可能因为"报错为空"而误判为环境问题并重试或升级——这会浪费轮次，也可能误触发回滚循环；
  ② 过程措辞门在发布阶段才开，意味着**每写一句过程口径都可能要多一次策划签收**（本轮如此）。
- **建议补丁（未做，待用户决定）**：
  ① `_run_scope()` 改 `text=False` + 显式 `encoding="utf-8", errors="replace"`（并在失败时把最后 1200 字符落盘到事务目录，便于事后取证）；
  ② 把 `process_text_marker_hits` 的扫描提前挂到 `--validation-scope writeback`（作为 WARN 或 ERROR 由用户定），让措辞在写回阶段就被发现；
  ③ `--event` 模式对 `inputs[]` 里"路径等于活动正式版或候选稿"的条目直接 fail-closed，提示"正式版不作为输入登记"。
