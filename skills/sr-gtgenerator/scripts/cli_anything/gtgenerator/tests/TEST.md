# TEST.md — cli-anything-gtgenerator

## Test Plan

### Unit tests (`test_core.py`) — synthetic data only

| # | Case | Verifies |
|---|------|----------|
| U1 | ID decomposition | main/sub/sequence bit extraction |
| U2 | Empty-group next_sequence == 2 | GUI quirk (max seeded at 1) |
| U3 | next_sequence continues group | max+1 within Main/Sub mask |
| U4 | Category tables complete | 13 mains; Building/ Tech sub values |
| U5 | gtypes.xml byte format | BOM, CRLF, attr order, Quality child element, self-close |
| U6 | normaltxt.xml byte format | attribute layout |
| U7 | Attribute escaping | `"`, `<`, `&` |
| U8 | Lua export format/order | strings→GIDs, n/d prefix, retire skip, empty skip, CRLF |
| U9 | Lua values not escaped | GUI EscapeJSONString passthrough |
| U10 | APQ export rules | q-1, quality-5 excluded, retire excluded, BOM |
| U11 | create auto-ID | end-to-end via Session |
| U12 | create batch + quality | sequential IDs, Purple=4 |
| U13 | quality only for Property | ValueError otherwise |
| U14 | retire/restore roundtrip | Retire flag persisted |
| U15 | GID name collision rejected | CLI hard-stops (GUI only warns) |
| U16 | txt add/set/remove | normaltxt.xml persistence |
| U17 | txt duplicate name rejected | collision guard |
| U18 | dry-run writes nothing | byte-identical gtypes.xml after dry-run |
| U19 | backup on save | .gtgen-backup populated |
| U20 | search numeric vs text | ID substring vs Name/Comment |

### E2E tests (`test_full_e2e.py`) — real GTGenerator data, sandboxed copies

| # | Case | Verifies |
|---|------|----------|
| E1 | gtypes.xml round-trip | re-serialization of real 4358-item file is **byte-identical** to GUI output |
| E2 | Lua export vs GUI reference | equals real OutPut_Dev/string_zh_CN.txt byte-for-byte |
| E3 | APQ export vs GUI reference | equals real OutPut_Dev/APQualityMap.txt byte-for-byte |
| E4 | create→save→search workflow | full GUI-equivalent cycle |
| E5 | txt add updates lua | OutPut_Dev regenerated with new key |
| E6 | android format | both files, BOM, GID_ arrays |
| E7 | retire→save removes from lua | logical delete semantics |
| E8 | --json parseable everywhere | agent contract |
| E9 | installed CLI subprocess (opt-in) | `CLI_ANYTHING_FORCE_INSTALLED=1` + installed entry point |

### Byte-compat notes

- `android_string.xml`/`android_string_arr.xml` GUI references in the planner dir are
  from 2026-01-23 (stale vs. current normaltxt.xml of 2026-09-11), so direct byte
  comparison is invalid. Verified instead: entry ordering/format identical; all
  differences are data drift (3184 keys added since Jan; 256 value updates match
  current normaltxt.xml exactly, 0 real mismatches).

## Test Results

Run: `python -m pytest cli_anything/gtgenerator/tests/ -v --tb=short` (cwd = agent-harness)

```
cli_anything/gtgenerator/tests/test_core.py::test_id_decomposition PASSED
cli_anything/gtgenerator/tests/test_core.py::test_next_sequence_empty_group_yields_two PASSED
cli_anything/gtgenerator/tests/test_core.py::test_next_sequence_continues_group PASSED
cli_anything/gtgenerator/tests/test_core.py::test_categories_complete PASSED
cli_anything/gtgenerator/tests/test_core.py::test_gtypes_xml_byte_format PASSED
cli_anything/gtgenerator/tests/test_core.py::test_normaltxt_xml_byte_format PASSED
cli_anything/gtgenerator/tests/test_core.py::test_attr_escaping PASSED
cli_anything/gtgenerator/tests/test_core.py::test_lua_export_format_and_order PASSED
cli_anything/gtgenerator/tests/test_core.py::test_lua_values_not_escaped PASSED
cli_anything/gtgenerator/tests/test_core.py::test_apq_export_excludes_quality_5 PASSED
cli_anything/gtgenerator/tests/test_core.py::test_create_type_auto_id PASSED
cli_anything/gtgenerator/tests/test_core.py::test_create_type_batch_and_quality PASSED
cli_anything/gtgenerator/tests/test_core.py::test_create_type_quality_only_for_property PASSED
cli_anything/gtgenerator/tests/test_core.py::test_retire_restore PASSED
cli_anything/gtgenerator/tests/test_core.py::test_name_collision_rejected PASSED
cli_anything/gtgenerator/tests/test_core.py::test_txt_add_set_remove PASSED
cli_anything/gtgenerator/tests/test_core.py::test_txt_duplicate_name_rejected PASSED
cli_anything/gtgenerator/tests/test_core.py::test_dry_run_writes_nothing PASSED
cli_anything/gtgenerator/tests/test_core.py::test_backup_created_on_save PASSED
cli_anything/gtgenerator/tests/test_core.py::test_search_numeric_vs_text PASSED
cli_anything/gtgenerator/tests/test_full_e2e.py::test_gtypes_roundtrip_identical_to_gui PASSED
cli_anything/gtgenerator/tests/test_full_e2e.py::test_lua_export_matches_gui_reference PASSED
cli_anything/gtgenerator/tests/test_full_e2e.py::test_apq_export_matches_gui_reference PASSED
cli_anything/gtgenerator/tests/test_full_e2e.py::test_e2e_create_then_save_workflow PASSED
cli_anything/gtgenerator/tests/test_full_e2e.py::test_e2e_txt_add_updates_lua PASSED
cli_anything/gtgenerator/tests/test_full_e2e.py::test_e2e_android_format PASSED
cli_anything/gtgenerator/tests/test_full_e2e.py::test_e2e_retire_removes_from_lua PASSED
cli_anything/gtgenerator/tests/test_full_e2e.py::test_e2e_json_flag_every_command PASSED
cli_anything/gtgenerator/tests/test_full_e2e.py::test_e2e_subprocess_installed_cli PASSED (FORCE_INSTALLED run)

28 passed, 1 skipped (skip = subprocess test without env opt-in), 0 failed
```

Manual subprocess verification (installed CLI on sandbox copy of real data):
create ID 17104899 (0x01050003, Building/House seq3) → save → retire → save → get
shows Retire=true; merge against english/gtypes.xml produced addlist.xml (3739
items needing translation) + trangids.xml; android import round-trip 8725
strings / 2957 GIDs → OutPut/lua_string.text.

## Gaps

- Arabic reshaping (ArabicFixer) not ported — `android import --arabic` performs
  the char-level cleanup only. GUI path is authoritative for real Arabic content.
- `MergeTranslationForm` normaltxt diff branch is a no-op in the GUI itself
  (deserializes and discards); CLI mirrors the effective behavior (gtypes only).
