# sr-gtgenerator 使用卡：GTGenerator 配置维护

**职责**：维护《文明之跃》GTGenerator 配置——GID 类型表（gtypes.xml）与多语言文本表（normaltxt.xml）的新增 / 废弃 / 修改，并通过自带 CLI 导出 lua 与 Android 文本资源；写操作自动备份，可 `--dry-run` 预演。

**什么时候用**："新增/修改/废弃 GID"、"加一条多语言文案 / Localizatio(n) 文案"、"生成 string_zh_CN.txt / APQualityMap.txt / Android 文本资源"、"翻译合并"。

**怎么用**：

```
/sr-gtgenerator 新增 GID <类型> <说明>
```

**产出**（GTGenerator 工作目录下）：`gtypes.xml` / `normaltxt.xml` 写回（备份在 `.gtgen-backup/<时间戳>/`）、`OutPut_Dev/string_zh_CN.txt` 与 `APQualityMap.txt` 重新生成（Android 文本资源需另行生成）。
