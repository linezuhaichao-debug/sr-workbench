# 0028 · 图片闭环的默认稳定资产位与既有包的约定不一致，会派生第二套图片

- 日期：2026-10-19
- 状态：**已接受**（本轮按"先设组件路径、再跑 `--init/--prepare`"复位解决；**脚本补丁未做，待用户决定**）
- 相关：`skills/plan-doc-ai-version/scripts/prepare_image_closure.py` §`_image_dir()`（事件 `formal_image` 组件已设路径则尊重，否则
  `find_active_formal(root).parent / "assets" / "images"`，即 `04_AI输出_策划审核/03_正式交付/assets/images`）
  · 技能契约 `references/contracts-images.md` §图片基线清单 Contract（原生包首次发布的稳定资产位）
  · 功能侧指针：运行包 `03_AI过程档案_策划通常无需处理\图片基线清单_联盟讨伐.json`（`extensions.authority = native_initial_image_set`）

## 背景

联盟讨伐是**原生包**：初始转换时 13 张界面图落在 `04_AI输出_策划审核/assets/images/IMG-###__<原文件名>`，
首次发布时 `publish_downstream_package.py` 正是把**这个位置**登记成了 `图片基线清单`（`native_initial_image_set`）。
本轮（WB-20261019-001）第一次真正跑图片写回闭环，`--prepare` 时事件 `formal_image` 组件的 `path` 还是空的
（`prepare_writeback_event.py` 要在闭环之后才绑定它），于是走了兜底分支：

| 落点 | 结果 |
| --- | --- |
| 工具默认 `04_AI输出_策划审核/03_正式交付/assets/images` | 写进 13 个文件（12 个与既有副本**逐字节相同**、1 个是新 webp）——**5.7 MB 重复**，`archived_stale = []` 因为新目录本来就是空的 |
| 既有约定 `04_AI输出_策划审核/assets/images` | 原 13 个文件原地未动，被替换的 `IMG-001__…png` **没有**被移到版本归档 |

危害：① 同一功能出现两套"最终图"，`formal_image_set()` 只认活动闭环、旧位变成无人看管的残留；
② "退场图必须移入版本归档"这条闭环不变式**静默失效**——工具只清理自己选中的目录；
③ 快照渲染器 `render_current_state_snapshot.py` 按 `IMG-###__*` 全包查找并做哈希唯一性校验，
两套内容不同的同名 IMG 会让它报 `multiple active files with different content claim IMG-001`。

## 决定与规避

1. **先设路径再跑闭环**：在 `--init`/`--prepare` 之前，把事件 `components[formal_image].path` 设为该包**既有**的稳定资产位
   （`04_AI输出_策划审核/assets/images`），`status` 回 `pending`、`sha256` 回 `null`。
2. **废弃落错位的目录**：把兜底分支写出的那份（12 + 1 个文件，逐个哈希核对与既有副本相同、新 webp 另有输入源）整体删除。
3. **重跑闭环**（删掉已 `prepared` 的闭环文件 → 重新 `--init` → 重新只填决策字段 → `--prepare`）——
   **不手改** `final_images` / 文件落位 / 目录树哈希。重跑后 `archived_stale` 正确报出被替换的 `IMG-001__01_活动界面_常规难度.png`，
   并被移到 `03_AI过程档案_策划通常无需处理\版本归档\图片\`。

## 纪律

- **跑图片写回闭环前，先确认该包的稳定资产位在哪**：看 `图片基线清单_*` 的 `images[].source_ref`，或既有正式版里 IMG 图片的实际位置。
  原生包通常是 `04_AI输出_策划审核/assets/images`；不要直接让工具吃兜底默认值。
- **`--init` 之前就把 `formal_image` 组件的 `path` 设好**（`prepare_writeback_event.py` 会保留已设值）。
- 闭环跑完**必须看 `archived_stale`**：本轮应该非空（有图退场）却为空，是"选错目录"的强信号。
- 事件 `formal_image` 组件的 `path`/`sha256` 由工具写；复位时只能改 `path` 并置 `status=pending`，不要在准备好的闭环上手工调字段。

## 影响

- **本轮实例**：联盟讨伐最终图仍为 13 张且全部落在 `04_AI输出_策划审核/assets/images/`（IMG-001 = 新 webp，IMG-002–013 原样），
  退场 PNG 归档在 `版本归档\图片\`；事件 `components[formal_image].path` = `04_AI输出_策划审核/assets/images`。机器差异对账由工具预检 PASS。
- **风险未消除**：任何原生包第一次做图片写回都会命中同一兜底分支。
- **建议补丁（未做，待用户决定）**：① `_image_dir()` 的兜底顺序改为"先看唯一活动 `图片基线清单` 的 `source_ref` 目录，再退回 `03_正式交付/assets/images`"；
  ② 若兜底目标目录为空而基线目录里有同名 IMG，直接 fail-closed 并提示"先设 `formal_image` 组件路径"；
  ③ 事件 `formal_image` 组件已 `completed` 后再次 `--prepare` 时应允许重入（现在闭环的 `extensions.draft` 被替换成 `prepared_by`，重跑只能走"删文件 + 重新 `--init`"）。
