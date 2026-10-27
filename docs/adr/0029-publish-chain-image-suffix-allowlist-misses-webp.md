# 0029 · 发布链的图片后缀白名单不含 `.webp`，会让带 webp 的正式版**发不出包**

- 日期：2026-10-19
- 状态：**已接受**（本轮按规避手法执行：把图片转成 PNG；**脚本补丁未做，待用户决定**）
- 相关：`skills/plan-doc-ai-version/scripts/package_compatibility.py` §`formal_image_set()`（候选筛选内联元组 `(".png", ".jpg", ".jpeg", ".gif")`）
  · `publish_downstream_package.py`（用同一函数解析最终图片集，解析不出即 `BLOCKED`）
  · 功能侧指针：`features\联盟讨伐\decisions\决策记录.md` 2026-10-19 条目 · 运行包 `03_AI过程档案_策划通常无需处理\写回事件_WB-20261019-002.json`

## 背景

同一技能里**其它**脚本的图片后缀集合都是 `{".png", ".jpg", ".jpeg", ".webp", ".gif"}`：
`prepare_image_closure` / `prepare_image_inventory` / `render_current_state_snapshot` / `validate_run_package` / `adopt_downstream_package`。
只有 `package_compatibility.py` 这一处是内联元组、**漏了 `.webp`**：

```python
candidates = sorted(
    path for path in root.rglob(record["filename"])
    if path.is_file() and ".svn" not in str(path)
    and path.suffix.lower() in (".png", ".jpg", ".jpeg", ".gif")   # ← 无 .webp
    and sha256_file(path).lower() == record["sha256"].lower()
)
```

于是 `formal_image_set()` 对 webp 的最终图**静默不解析**（`problems` 仍为空），发布器随后在 `missing_images` 检查处 fail-closed：

```
publish_downstream_package.py --run-package 运行包_联盟讨伐
-> BLOCKED: 正式版引用的图片未在已验证最终图片集中（缺失或被篡改）：IMG-001——发布中止
```

**首例**：联盟讨伐 WB-20261019-001 第一次把 webp 放进了正式图片集（来源是 2026-10-16 批的归一化副本），
所以在此之前从未撞上；即「包里的图片历史全是 png」掩盖了这个缺口。

## 本轮规避（未改技能）

1. 把该图**转成 PNG**（同分辨率 1080×1920、像素逐一相同，只是重新编码；webp 留 `历史版本/` 与 `版本归档/图片/`），
   走 WB-20261019-002 写回更新正式版图片引用，然后重新发布 → `PUBLISHED`。
2. 转换与等价性证据记在事件的 `extensions.image_format_conversion` 与批 `说明.md` 里（含双侧 SHA、字节数、逐点比对结论）。
3. 副作用（**要如实告知**）：本次实际入库的是**对 1080×1920 webp 副本的重新编码**，不是设计原件；PNG 体积 179 KB → 993 KB。

## 纪律

- **图片进正式集前先确认后缀在发布链白名单内**：目前安全集是 `png / jpg / jpeg / gif`；拿到 `webp`（或 avif 等）素材时，
  要么先转 PNG 再登记为输入，要么先补白名单——不要等发布时才踩。
- 遇到 `BLOCKED: 正式版引用的图片未在已验证最终图片集中（缺失或被篡改）` 时，**先单独跑一次 `formal_image_set(root)`** 看返回的
  `images` 键集：缺哪个 IMG、以及它解析到了哪个副本。`problems` 为空却缺图，通常就是本类后缀/路径问题，不是"图丢了"。
- 转码必须留痕：源文件与产物双侧 SHA、字节数、像素等价性结论、以及"是否为设计原件"的明确声明。

## 影响

- **本轮实例**：`下游交付包_联盟讨伐_v1.0.20261019`（树哈希 `93c352af…`）发布成功，13 张图齐全，IMG-001 = `IMG-001__01_活动界面_常规难度.png`。
- **风险未消除**：任何功能只要把 webp 放进正式图片集，就会在下一次发布被拦；而**写回、校验、快照、闭环**各步都不会提示这件事——
  只有发布器会拦，属于「最晚才知道」的失败点。
- **建议补丁（未做，待用户决定）**：① 把该内联元组换成与其它脚本一致的模块级常量（含 `.webp`）；
  ② `formal_image_set` 在"记录要求某后缀但候选集合为空"时给出**显式 problem**，而不是静默不解析；
  ③ `publish_downstream_package.py` 的预检阶段提前打印"最终图片集解析结果（IMG → 文件）"，让缺图在构建包之前就可见。
