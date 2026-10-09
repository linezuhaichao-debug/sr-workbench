# GTGenerator SOP — GID 与文本配置生产工具

## 工具定位

GTGenerator.exe 是《文明之跃》策划配置链中维护 **GID 类型**（gtypes.xml）与
**普通文本**（normaltxt.xml）并导出多语言/Android 资源的工具。它不是 SVN 客户端，
只负责把文件生产出来，提交流程在外部完成。

## 数据模型

### gtypes.xml（TypeList）

```xml
<?xml version="1.0" encoding="utf-8"?>   <!-- BOM + CRLF -->
<TypeList>
  <TypeItem Export="true" ID="16842754" Name="主城" Comment="…" DevDes="…" Retire="false" />
  <TypeItem Export="true" ID="67371010" Name="…" Comment="…" Retire="false">
    <Quality>5</Quality>                  <!-- 仅 ActivityProperty 子元素 -->
  </TypeItem>
</TypeList>
```

- 属性顺序固定：Export, ID, Name, Comment, DevDes, Retire；空值属性原样输出 `Name=""`。
- Quality 是**子元素**（非属性），只在 Property/ActivityProperty 上出现。
- Retire 是逻辑废弃，不物理删除。

### normaltxt.xml（StringList）

```xml
<Resources>
  <String Export="true" Name="some_unlock" Value="解锁$0" />
</Resources>
```

属性顺序：Export, Name, Value, Comment（Comment 为 None 时不输出）。

## ID 规则

`ID = (Main << 24) | (Sub << 16) | Sequence`

Main（1..13）：Building, Soldier, Effect, Property, Tech, Skill, Task, Leader,
MapBuilding, Payment, Kingdom, Equip, Misc。部分 Main 无 Sub（Soldier、Payment、
Kingdom 之外的 Misc 等：Soldier/Payment/Misc/Sub 为 0）。

Sub 表：Building 1-8（CityHall..Facility）、Effect 1-4、Property 1-18、Tech 0-2、
Skill 1-9、Task 1-7、Leader 1-4、Kingdom 1-2。

**GUI 怪癖（CLI 必须复刻）**：`next_sequence` 取组内最大 Sequence，然后 +1——
当组内不存在任何条目时最大值初始化为 1，新条目 Sequence = 2（跳过 1）；
组内已有条目时正常递增。

Quality：仅 Property + ActivityProperty 可设，白1绿2蓝3紫4橙5；
APQualityMap 导出时 `quality-1` 且 **5 被排除**（条件 num < 5）。

## 导出格式（Save）

### string_zh_CN.txt（OutPut 与 OutPut_Dev 各一份）

- 无 BOM，UTF-8，CRLF。
- `local loc = {` + 每行 `name = "value",`（**值不做转义**，GUI 原样拼接）+
  未废弃 GID 的 `n<id> = "name",` / `d<id> = "comment",`（空值跳过）+ `}` + `return loc`。
- normaltxt 条目在前，GID 在后；顺序 = 文件内出现顺序（GID 不额外排序输出，
  但加载时 GUI 会按 ID 排序内存列表——Save 写回的 gtypes.xml 是排序后的）。

### APQualityMap.txt

- **带 BOM**，UTF-8，CRLF。`--Auto generated.Donot modify it.` 开头，
  `[id] = "q-1",`（0<q<5 才输出），结尾 `}` + `return APQualityMap`。

### android_string.xml / android_string_arr.xml

- 带 BOM，CRLF，两空格缩进。普通文本 → `<string name="...">值</string>`（仅 Export=true）；
  GID → `<string-array name="GID_<id>">` 含 2 个 `<item>`（Name, Comment，可空），
  仅未废弃且 Export 且 Name/Comment 至少一个非空。
- 空值 item 序列化为 `<item />`。

## 编码/写入规则

- XML 写回：UTF-8 BOM、CRLF、两空格缩进、无命名空间前缀。
- Lua：UTF-8 无 BOM；APQualityMap：UTF-8 BOM。换行一律 CRLF（Windows StreamWriter）。

## GUI 按钮 ↔ CLI 命令映射

| GUI 按钮 | CLI 命令 |
|---|---|
| Create Type | `type create` |
| Delete Type（Retire=true） | `type retire` |
| Recovery Type（Retire=false） | `type restore` |
| Save | `save` |
| Localization 增删改 + Save | `txt add/set/remove` + `txt save` |
| Android Format | `android format` |
| Import Android → Convert To Lua | `android import` |
| Merge Translation | `merge translation` |
| 主界面搜索框 | `type list --search` |

## 安全约束

- 所有写操作前自动备份到 `<workdir>/.gtgen-backup/<时间戳>/`。
- 测试只在临时沙箱副本上进行，绝不触碰真实策划目录。
