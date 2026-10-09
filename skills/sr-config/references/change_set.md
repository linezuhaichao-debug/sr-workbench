# Change set 与确认门

每次写入只有一个 change set；未知但必要的值进入 `blocking_items`，不能用省略号代替。

## 顶层结构

```yaml
schema_version: 2
change_set:
  change_set_id: CS-YYYYMMDD-001
  status: DRAFT                 # DRAFT|PASS|BLOCKED
  title: ""
  created_at: ""
  updated_at: ""
  task_branches: []             # create_workbook|schema_change|record_change
  config_root: ""
  source_file: null
  target_file: ""
  target_sheets: []
  scope:
    included: []
    excluded: []
  source_data_fingerprint: null
  proposal_hash: ""
  sources: []
  rules: []
  enums: []
  codecs: []
  references: []
  constraints: []
  sheets: []
  output_mappings: []
  changes: []
  fixtures: []
  approvals: []
  blocking_items: []
  deferred_items: []
  validation_targets: []
  validation_results: []
```

`proposal_hash` 对任务范围、规则、schema、changes、fixtures 和 validation targets 的规范化内容计算，不包含审批、状态和运行时时间戳。

## change

```yaml
changes:
  - change_id: CHG-001
    change_hash: ""
    branch: schema_change
    entity_kind: field          # workbook|sheet|field|index|record|comment|note|output_mapping|fixture
    operation: add              # add|modify|move|delete
    target: {}
    from: null
    to: null
    before: null
    after: null
    fixture: false
    rule_refs: [R-001]
    evidence_refs: [SRC-001]
    risk:
      level: medium             # low|medium|high
      reasons: []
    approval_required: true
    approval_refs: []
    validation_refs: []
```

字段移动必须填写 `from` 和 `to`。每个 change 只能属于一个已声明分支。`change_hash` 对 target、from、to、before、after、fixture、规则和风险计算；内容变化后，绑定旧哈希的审批失效。

风险取命中规则中的最高级：

- `low`：仅说明、批注或不改变配置语义的格式；
- `medium`：新增运行时字段或记录、修改既有记录、默认值、枚举、单位或 codec；
- `high`：删除字段或记录，修改英文名、简写、主键、索引、scope、type、引用或输出映射。

## 逐项确认

```yaml
approvals:
  - approval_id: APR-001
    approved_changes:
      - change_id: CHG-001
        change_hash: ""
    status: approved            # pending|approved|rejected|revoked|stale|auto_approved
    basis: explicit_user        # explicit_user|confirmed_schema|non_semantic
    confirmed_source: ""
    confirmed_at: ""
```

中高风险变更、新建运行时表契约、主键、索引、codec、引用和输出映射需要用户确认。低风险非语义变更可按 `non_semantic` 自动确认。符合已确认 schema 的 fixture 可按 `confirmed_schema` 自动确认，但仍须作为独立 change 记录。

## blocker 与 deferred

```yaml
blocking_items:
  - blocker_id: BLK-001
    category: missing_evidence  # missing_evidence|missing_approval|schema_conflict|missing_reference|duplicate_key|invalid_codec|validation_failed|write_failed|other
    summary: ""
    affected_change_ids: []
    resolution_required: ""
    state: open                # open|resolved

deferred_items:
  - deferred_id: DEF-001
    summary: ""
    reason: ""
    affected_refs: []
    excluded_from_write_set: true
    blocks_pass: false
    owner: ""
    resume_trigger: ""
```

影响任一写入项正确性、引用完整性、唯一性或验收的事项必须是 blocker。deferred 只表示明确排除在本次写入集合之外且与其无依赖的后续工作。存在未解决 blocker 时，顶层状态必须为 `BLOCKED`。

## 最低闭合条件

- `task_branches` 非空，每个 change 的 branch 均属于该集合；
- 每条确认规则至少有一个目标；
- 每个写入项有唯一 change ID、当前 change hash、前后值、证据、风险和验证目标；
- 所有必需审批均绑定当前 change hash；
- `blocking_items` 中没有 open 项；
- `deferred_items` 全部排除在写入集合之外且不影响其正确性。

不满足时保持 `DRAFT`；出现无法继续的冲突或失败时为 `BLOCKED`，不得进入写入阶段。
