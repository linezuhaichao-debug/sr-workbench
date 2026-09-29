# 已有数据迁入 features\ 结构，并把改名裂开的两个目录合并

工作区根上**并存两代布局**：旧的扁平层（`analysis\` `concept\` `decisions\` `evidence\` `experiments\` `inbox\` `proposals\` `retrospectives\` `scripts\` `运行包_联盟悬赏\` `design-asset-index.json` + 它的 `.backup.20260929` + `game.designos.yaml`）和新的 `features\<主题>\<桶>\`（68 个文件）。两个 UE 交付 zip 也还在根上，而它们该去的归档位是 `features\<主题>\source\UE交付_<日期>\`。更关键的是：`features\神话宝库\`（38 个文件）与 `features\诸神降临\`（2 个文件）现在作为**两个功能**并存——改名裂开已经真实发生了。

因此：**把旧层中属于某功能的产物迁进 `features\<主题>\<桶>\`；旧层原地保留并标注"历史归档，不再写入"**，面板只读新层。**`神话宝库` 与 `诸神降临` 认定为同一个功能**（同一 `feature_id`，`诸神降临` 为当前标签，`神话宝库` 进 `aliases`），38 个文件并入。`design-asset-index.json` 及其 backup 不迁移（§3.4 已砍掉该职能）。

## Considered Options

- **不迁移、面板同时读两代** —— 破裂"零猜测"：旧层不带主题目录名，找回去就得按文件名派生，正是 §3.1 那个反例。
- **迁移并删掉旧层** —— 在没有备份、新读法没跑通前删数据不可逆，不该与结构改造同步做。

## Consequences

- 一次性、不可逆的数据移动，**动手前必须先备份**。
- `design-asset-index.json` 里的素材索引信息在迁移中丢失。§3.4 声称其职能已由"头脑风暴四种入口 + 定稿线框图"承载——这条等于正式接受那部分信息不再可查。
- 旧层"还是不是 skill 的写入目标"必须显式定死，否则 W2 无法验收（一次改完还是分批共存）。
