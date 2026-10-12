---
name: sr-gtgenerator
description: 维护《文明之跃》GTGenerator 配置（GID 类型 gtypes.xml 与多语言文本 normaltxt.xml）并通过自带 CLI 导出。当用户要 新增/修改/废弃 GID、增删改多语言文本/Localizatio(n) 文案、生成 string_zh_CN.txt / APQualityMap.txt / Android 文本资源、翻译合并时触发。
---

# GTGenerator 配置维护（sr-gtgenerator）

你是 GTGenerator（GID + 多语言文本配置工具）的操作员。本 skill 自带 CLI
（源码在 `scripts/`，安装方式见「环境准备」）。所有写操作自动备份到
`<工作目录>/.gtgen-backup/<时间戳>/`，`--dry-run` 可预演。

## 第 0 步：载入项目语境

按 sr 系列惯例读取 `../sr-askme/references/sr_project_context.md`。本 skill 依赖
**sr-askme 兄弟目录**（成组安装见 `../sr-askme/SKILL.md` §四）；单独拷走本 skill 会缺失语境，
第 0 步应明确报错提示（缺失处置口径见 `../sr-askme/SKILL.md` §三）。

本 skill 额外需要一个路径：**GTGenerator 工作目录**（含 gtypes.xml 与
normaltxt.xml，通常即 GTGenerator.exe 所在目录）。检查
`%USERPROFILE%\.dsh\sr-workbench\config.local.json` 的 `gtgenerator_workdir` 字段：
- 存在且非空 → 直接使用（通常由 `/sr-askme` 首次配置时一并收集）；
- 缺失 → 询问用户一次，确认后写回 `config.local.json`（并同步告知用户已固化，
  改路径直接编辑该文件），下次不再问。本 skill 可独立于 `/sr-askme` 引导使用，
  字段缺失时自行收集即可，不要求先跑引导。
兼容 `config.local.example.json` 未列出的新字段：写入时保留原文件已有字段。

- 决策记录：**只要定下了一件事就记**（选表 / 定字段 / 命名 / 改记录 / 放弃某个方案 / 更正之前的判断…，不只确认门那一次）。落点与格式见 `../sr-askme/references/decision-recording.md` —— 追加进**本功能**的 `decisions\决策记录.md`（一个功能只有一个决策文件）。
- 历史版本：**改写已有的 xml / 导出物之前**，先按 `../sr-askme/references/version-history.md` 存一版（`python "<sr-askme 技能目录>/tools/history_snapshot.py" "<产物绝对路径>"`）。

## 环境准备（每次会话首次使用前检查一次）

1. **命令调用方式**（二选一，都能用）：
   - **首选**：`gtgenerator ...`（安装过的命令入口）。
   - **零安装回退**：`python <本skill目录>/scripts/gtgenerator.py ...`——不依赖
     pip 安装，从任何工作目录都能跑（唯一第三方依赖 click，缺了才需要
     `pip install click`）。
   - 两者执行同一份 `scripts/` 内代码。想注册成全局命令再执行一次
     `pip install -e <本skill目录>/scripts`（Python ≥ 3.10），非必需。
   - 先试首选，命令不存在就自动切换到回退路径，不要停下来问用户。
2. 确认工作目录（见第 0 步）。之后所有命令都在该目录下执行
   （`cd` 过去，命令里不用再写 `-d`）。

## 触发 → 工作流路由

文本与 GID 是同一套心智模型：**新增 / 废弃 / 修改** 三件事。

| 用户在说什么 | 走哪个流程 |
|---|---|
| 「新增/加一条文本/文案」「翻译这句」 | **A1 文本新增** |
| 「废弃/下线/停用 这条文本」 | **A2 文本废弃** |
| 「把这条文本改成…」 | **A3 文本修改** |
| 「新增一个 GID」「加个支付id/道具/英雄…」（给了类型和名称） | **B1 新增 GID** |
| 「废弃/下线/删除 这个 GID/功能」 | **B2 废弃 GID** |
| 「改这个 GID 的名字/描述/备注」 | **B3 修改 GID** |
| 「导出/生成 string_zh_CN/APQualityMap/Android 文本」 | 直接跑 `save` / `android format` |

### 流程 A1：文本新增

1. **拿内容**：用户至少给出文本内容（Value）。key 规则：
   - 用户给了 key → 用用户的（先 `gtgenerator txt list --search <key>` 查重，撞了要说明）。
   - 没给 key → 自动生成：全小写下划线英文、见名知义、≤32 字符；
     语义为 GID 名称用 `name_<gid>`，GID 描述用 `des_<gid>`，服务器错误用 `error_<id>`。
   - 生成前把拟用 key 给用户过目（一句话即可），除非用户说过「直接干」。
2. **查重**：`gtgenerator txt list --search <key>`；存在同名且语义不同 → 换 key 并说明。
3. **执行**：`gtgenerator txt add -n <key> -v '<value>'`（值含 `$0`/`$1` 等占位符时**必须单引号**）。
4. **汇报**：见「结果汇报模板」。

### 流程 A2：文本废弃

1. 定位：`gtgenerator txt list --search <词> --json`（或用户直接给 key），展示当前值。
2. **语义把关**：文本废弃 = `Export=false`（数据保留、不再导出、可恢复），
   与 GID 废弃哲学一致；**不是物理删除**。用户说「删除」且上下文不明确时先问：
   「文本可以废弃（保留数据、不再导出、随时恢复）或物理删除（不可逆），选哪种？」
   用户明确说「废弃/下线/停用」→ 直接废弃；明确说「彻底删掉」→ 走 `txt remove`。
3. **执行**：`gtgenerator txt set <key> --no-export`。恢复：`txt set <key> --export`。
   查看：`txt list --no-export`（全部已废弃文本）。
4. **汇报**：见「结果汇报模板」（废弃对比列 Export true → false）。

### 流程 A3：文本修改

1. **留底**：`gtgenerator txt get <key> --json`（改前快照）。key 不确定就先搜索定位。
2. **执行**：`gtgenerator txt set <key> -v '<新值>'`（占位符单引号）；连 key 一起换用 `--rename 新key`。
3. **汇报**：见「结果汇报模板」（修改对比必须列改前/改后）。

### 流程 B1：新增 GID

1. **类型解析**（内置映射表，用户词 → `--main/--sub`）：

| 用户说的类型 | --main | --sub |
|---|---|---|
| Soldier / 怪物 / 敌对士兵 | Soldier | —（无 Sub） |
| 战争属性-固定值 | Effect | Amount |
| 战争属性-百分比 | Effect | Percent |
| 冒险属性-固定值 | Effect | XGameAmount |
| 冒险属性-百分比 | Effect | XGamePercent |
| 飞船科技 | Tech | Lord |
| 联盟科技 | Tech | Alliance |
| 政策 | Skill | PolicySkill |
| 道具 | Property | Normal |
| 英雄碎片 | Property | HeroFragment |
| 英雄装备 | Property | HeroEquip |
| 英雄 | Leader | Military |
| 英雄技能 | Skill | HeroFixedSkill |
| 支付 id | Payment | —（无 Sub） |
| 飞船装置 | Equip | —（无 Sub） |

   映射表之外的类型请求：**绝不写入**。告诉用户 `type categories` 的完整清单并说明：
   新增 Main/Sub 分类需要程序同事先在本 skill 的
   `scripts/cli_anything/gtgenerator/core/model.py`（MAIN_CATEGORIES / SUB_CATEGORIES
   两张表）和本 skill 的映射表中增加，扩充生效前该类型无法创建。不要用任何方式绕过
   （`--force-id` 也只能在本组内指定序号，高位必须匹配已验证的分类，越界会被 CLI 拒绝）。

2. **名称**：用户的词作为 `Name`（玩家可见）。`Comment`（玩家可见描述）自动生成
   一句符合语境的中文说明并展示给用户；用户提供了描述就用用户的。
   `DevDes` 仅在用户给了开发备注时写。
3. **执行**：`gtgenerator type next-id <Main> <Sub> --json` 看一眼起始 ID，
   然后 `gtgenerator type create --main <M> --sub <S> -n '<名称>' --comment '<描述>' [--quality <Q>] --json`。
   Quality 只用于 Property/ActivityProperty，用户没提就不加。
4. **汇报**：见「结果汇报模板」。

### 流程 B2：废弃 GID

1. `gtgenerator type get <ID或搜索> --json` 查出目标并展示（名字/描述/当前状态）。
2. **「废弃」和「删除」必须区分**：GTGenerator 只有逻辑废弃（Retire，可恢复），
   没有物理删除。用户说「删除」且上下文不明确时，先问：
   「GTGenerator 只能逻辑废弃（数据保留、可恢复、不再导出），确认废弃吗？」
   用户明确说「废弃/下线」→ 直接执行。
3. **执行**：`gtgenerator type retire <ID>`。随后 **必须** 跑 `save` 重新生成导出文件
   （retire 只改 XML，不重生成 lua）。
4. **汇报**：见「结果汇报模板」。

### 流程 B3：修改 GID

1. 定位：`gtgenerator type get <ID>` 或 `type list --search <词>`。
2. **留底**：`gtgenerator type get <ID> --json`（这就是改前快照）。
3. **执行**：`gtgenerator type set <ID> -n '<新名>' / --comment '<新描述>' / --dev-des '<新备注>' / --export|--no-export`。
   重名会被 CLI 硬拒绝，撞了就换名并说明。
4. 名字/描述改动影响导出内容时跑 `save` 重生成。
5. **汇报**：见「结果汇报模板」。

## 结果汇报模板（每个流程完成后必须给用户）

**完成判据（A1–B3 六条流程共用）**：① 命令的真实输出已读回并与结果一致；② 下面模板的每个字段都已按实际值填满，改前/改后快照成对；③ 改动已真正落地——`gtypes.xml` / `normaltxt.xml` 已写回、需要重新生成导出文件的流程已跑 `save`、备份路径已在汇报里给出。

用中文、按下面结构输出，全部字段来自命令的真实输出，不许编造：

```
✅ <做了什么>（流程 A1/A2/A3/B1/B2/B3）

【新增】
- GID: 67371025 (0x04040011, Property/ActivityProperty)  ← B1 流程
- 名称: 冰晶积分
- 描述: 冰封活动期间完成任务获得
- 分配的 key: ice_activity_score  ← A1 流程（自动生成时要标注「自动生成」）

【修改对比】（A3 / B3 流程）
- 字段: Value
- 改前: 当前积分：$0
- 改后: 当前积分：$0，上限 $1

【废弃对比】（A2 / B2 流程）
- GID 67371025（冰晶积分）: Retire false → true，已从导出中移除，数据保留可恢复
- 文本 ice_activity_score: Export true → false，已从导出中移除，数据保留可恢复

【产出文件】
- gtypes.xml / normaltxt.xml 已写回（备份: .gtgen-backup/20260916_193000/）
- OutPut_Dev/string_zh_CN.txt、APQualityMap.txt 已重新生成

【待办提醒】（只在适用时出现）
- 需要提交 SVN 的变更文件：gtypes.xml、normaltxt.xml、OutPut_Dev/string_zh_CN.txt、APQualityMap.txt
- Android 文本未重新生成（需要的话跑 android format）
```

## 硬规则（违反即事故）

1. **不要动 GUI 正开着的同一份数据**：提醒用户 GUI 与 CLI 互斥使用（后保存者覆盖）。
2. **值里的 `$0`/`$1` 占位符必须单引号包裹**（bash 会展开双引号里的 `$0`）。
3. **废弃优先于删除**：文本废弃 = Export=false（A2），GID 废弃 = Retire=true（B2）。
   物理删除（txt remove）只在用户明确说「彻底删掉」且知情不可逆后执行。
4. **不确定类型 → 问**（流程 B1 的映射表之外）；不确定「废弃还是彻底删除」→ 问。
5. 批量操作（>5 条）先给用户一张计划表（类型/名称/拟分配 key），确认后一次执行。
6. 空分组首个 ID 序号是 2（不是 bug，是 GUI 兼容行为），不要「修正」。
7. 测试/试验一律用沙箱副本（临时目录 + 拷贝 gtypes.xml/normaltxt.xml），不拿真实目录练手。

## 命令速查

下表以 `gtgenerator` 简写；零安装时替换为
`python <本skill目录>/scripts/gtgenerator.py`（见「环境准备」）。

```bash
gtgenerator type get <ID> --json                # 查 GID（含解码）
gtgenerator type list --search <词> [--retired|--active] --json
gtgenerator type next-id <Main> <Sub> --json    # 下一可用 ID
gtgenerator type categories                     # 全部合法类型
gtgenerator type create --main M --sub S -n 名称 --comment 描述 \
    [--dev-des 备注] [--quality White|Green|Blue|Purple|Orange] [--batch N] [--dry-run] --json
gtgenerator type set <ID> [-n 名] [--comment 描述] [--dev-des 备注] [--export|--no-export] --json
gtgenerator type retire <ID> / type restore <ID> --json
gtgenerator txt list --search <词> [--export|--no-export] --json
gtgenerator txt get <key> --json                # 修改前留底
gtgenerator txt add -n <key> -v '<值>' --json
gtgenerator txt set <key> [-v '<新值>'] [--rename 新key] [--export|--no-export] --json
gtgenerator txt remove <key> --json             # 物理删除，仅明确要求时用
gtgenerator save [--release] --json             # Save 按钮
gtgenerator android format --json               # Android Format 按钮
gtgenerator android import -s a.xml -a b.xml -o 输出名 --json
gtgenerator merge <新翻译目录> --json           # Merge Translation 按钮
```

## 深入资料

- 行为与格式规范：`references/GTGENERATOR.md`（ID 规则、XML/Lua/Android 字节格式、
  Quality 排除规则、全部 GUI↔CLI 映射）
- 结构与测试报告（28 passed）：`scripts/cli_anything/gtgenerator/tests/TEST.md`
