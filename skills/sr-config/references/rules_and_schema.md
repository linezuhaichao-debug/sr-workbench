# 规则与配置 schema

本文件定义规则台账、字段、codec、引用、约束、`INDEX`、配置说明和字段批注。它只描述配置数据。

## 来源与规则台账

既有工作簿的单元格批注是一等证据来源：探查时必须读取 `cell.comment`（优先运行 `../tools/probe_workbook.py`），批注中的枚举含义、格式与边界规则按 `source_type: existing_comment` 登记进台账；只读单元格值而漏读批注等同于漏读既有契约，属证据缺口。

```yaml
sources:
  - source_id: SRC-001
    source_type: planning_doc   # planning_doc|conversation|workbook|existing_comment|config_note|profile|user_supplied_code
    path: ""
    locator: ""
    source_hash: null
    excerpt: ""

rules:
  - rule_id: R-001
    source_refs: [SRC-001]
    original_text: ""
    parsed:
      object: ""
      condition: null
      action_or_result: ""
      constraints: []
    evidence_status: fact       # fact|derived|assumption
    resolution_status: proposed # proposed|confirmed|conflict|deferred
    rule_types: []
    confidence: high            # high|medium|low
    targets: []
    conflict_with: []
    derivation: null
```

- `evidence_status` 只表示知识如何得到；用户确认 assumption 后仍是 `assumption`。
- `resolution_status` 只表示当前处理结果。
- `derived` 必须填写 `derivation` 并引用来源。
- `assumption` 进入写入集合前必须由 approval 确认。
- `conflict` 若影响写入集合，必须产生 blocker。
- 每条 `confirmed` 规则至少有一个目标；允许一条规则关联多个字段、记录或约束。
- 合并规则通过多个 `source_refs` 表达，不使用额外的 `origin: merged` 状态。

稳定的 `rule_types` 包括：

`enum`、`unit`、`format`、`codec`、`reference`、`default`、`sentinel`、`range`、`display`、`cross_field`、`cross_record`、`immutable`、`sync`。

## 字段、枚举、引用与约束

```yaml
sheets:
  - sheet_id: SHEET-001
    name: ""
    role: runtime               # runtime|index|note|enum
    header_rows: 5
    data_start_row: 6
    primary_key: [FIELD-001]
    indexes:
      - index_id: IDX-001
        fields: [FIELD-001]
        unique: true
        sort: none              # asc|desc|none
    fields:
      - field_id: FIELD-001
        column: A
        order: 1
        zh_name: ""
        name: ""
        short: ""
        scope: cs
        type: int
        nullable: false
        default: null
        unit: null
        enum_ref: null
        codec_ref: null
        reference_refs: []
        constraint_refs: []
        comment: ""
        evidence_refs: [R-001]
```

运行时字段的 `zh_name`、`name`、`short`、`scope`、`type`、`nullable` 和 `default` 必须明确。来源中存在异常拼写时原样记录并进入确认门。英文名、简写、主键和索引在各自有效范围内唯一。

```yaml
enums:
  - enum_id: ENUM-001
    value_type: int             # int|string|bool
    values:
      - value: 1
        meaning: ""
    allow_unknown: false
    evidence_refs: [R-001]

references:
  - reference_id: REF-001
    source:
      sheet_id: SHEET-001
      field_id: FIELD-003
    target:
      workbook: ""
      sheet: ""
      key_fields: [gid]
    nullable: false
    evidence_refs: [R-001]

constraints:
  - constraint_id: CON-001
    kind: unique                # unique|range|cross_field|cross_record|reference|custom
    targets: []
    expression: ""
    error_message: ""
    evidence_refs: [R-001]
```

引用目标、键和空值策略缺失时形成 blocker。

## 结构化 codec

复杂字符串、元组、列表、位标记或自定义序列化字段必须引用结构化 codec：

```yaml
codecs:
  - codec_id: CODEC-001
    name: id_level_count
    shape: list_of_tuple        # scalar|tuple|list|list_of_tuple|key_value|bit_flags|custom
    item_arity: 3
    item_separator: ","
    group_separator: ";"
    trailing_group_separator: optional # required|optional|forbidden
    components:
      - position: 1
        name: gid
        type: int
        nullable: false
        enum_ref: null
        reference_ref: REF-001
        unit: null
    null_policy: empty          # forbidden|empty|null|sentinel
    sentinel: null
    min_groups: 1
    max_groups: null
    normalization: preserve     # preserve|canonicalize
    valid_examples: []
    invalid_examples: []
    evidence_refs: [R-001]
    resolution_status: confirmed
```

codec 必须明确组件顺序和类型、分隔符、尾分隔符、空值、哨兵、组数、枚举、单位及引用。`custom` 必须附完整 grammar、解析/序列化规则和至少一组正反例。读回时执行 `parse → validate → serialize → parse`，按 `normalization` 判断文本等值或语义等值。

字段批注和配置说明由结构化契约生成，不以批注反向代替 codec。

## INDEX 与说明

```yaml
output_mappings:
  - mapping_id: MAP-001
    sheet_id: SHEET-001
    index_value: 1
    output_file: ""
    field_mapping_file: ""
    scope: cs
    description: ""
    evidence_refs: [R-001]
```

新增运行时表必须有唯一 `INDEX` 映射。列名以目标工作簿现状或用户确认的目标契约为准。输出文件名、字段映射文件名、索引值或 scope 缺失时形成 blocker。

配置说明依次包含：用途与范围、工作簿/工作表/INDEX 映射、字段表、枚举与 codec、引用与主键、跨字段/跨记录约束、填写顺序、测试数据清单、批注清单、阻断项和延期项。

字段批注包含适用的填写规则、取值或格式、引用或约束、最小示例。表级与跨记录规则写入配置说明，并从相关字段批注索引过去。

字段批注是**交付物而非可选项**：新建运行时表的每个含枚举、单位、格式、引用、约束或边界语义的字段，其第 1 行中文名单元格必须写入批注；批注清单进入 change set（`entity_kind: comment`），读回验收按「字段批注写入项 100% 匹配」逐条核对。枚举含义、引用目标这类信息写进配置说明 sheet 不能免除字段批注。
