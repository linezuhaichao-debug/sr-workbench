"""Unit tests for model, xmlfmt, repo, exporters — synthetic data only."""

import os

import pytest

from cli_anything.gtgenerator.core import xmlfmt
from cli_anything.gtgenerator.core.exporters import gen_apq, gen_lua
from cli_anything.gtgenerator.core.model import (
    MAIN_CATEGORIES,
    SUB_BY_NAME,
    NameStringPair,
    TypeItem,
)
from cli_anything.gtgenerator.core.repo import GtypesRepo, NormalTxtRepo
from cli_anything.gtgenerator.core.session import Session


@pytest.fixture
def sandbox(tmp_path):
    (tmp_path / "OutPut").mkdir()
    (tmp_path / "OutPut_Dev").mkdir()
    (tmp_path / "gtypes.xml").write_bytes(xmlfmt.serialize_gtypes([]).encode("utf-8"))
    (tmp_path / "normaltxt.xml").write_bytes(xmlfmt.serialize_normaltxt([]).encode("utf-8"))
    return str(tmp_path)


# ---------------------------------------------------------------------------
# ID decomposition & sequence allocation
# ---------------------------------------------------------------------------

def test_id_decomposition():
    it = TypeItem(ID=16842754)  # 0x01010002
    assert it.main == 1
    assert it.sub == 1
    assert it.sequence == 2


def test_next_sequence_empty_group_yields_two(sandbox):
    """GUI quirk: NewTypeForm.generateId() seeds max=1, so an empty group
    allocates sequence 2, skipping 1. Must match the GUI."""
    repo = GtypesRepo(sandbox)
    assert repo.next_sequence(1, 1) == 2


def test_next_sequence_continues_group(sandbox):
    repo = GtypesRepo(sandbox)
    repo.items.append(TypeItem(ID=(1 << 24) | (1 << 16) | 5))
    repo.items.append(TypeItem(ID=(1 << 24) | (1 << 16) | 9))
    assert repo.next_sequence(1, 1) == 10


def test_categories_complete():
    names = [n for n, _ in MAIN_CATEGORIES]
    assert names[0] == "Building" and names[-1] == "Misc" and len(names) == 13
    assert SUB_BY_NAME["Building"]["CityHall"] == 1
    assert SUB_BY_NAME["Tech"]["Age"] == 0  # Tech sub starts at 0


# ---------------------------------------------------------------------------
# serialization byte format
# ---------------------------------------------------------------------------

def test_gtypes_xml_byte_format():
    items = [
        TypeItem(Export=True, ID=16842754, Name="主城", Comment="描述",
                 DevDes="开发者", Retire=False),
        TypeItem(Export=True, ID=2, Name=None, Comment=None, Retire=True, Quality="5"),
    ]
    data = xmlfmt.serialize_gtypes(items)
    assert data.startswith("\ufeff")
    assert '\r\n  <TypeItem Export="true" ID="16842754" Name="主城" Comment="描述" DevDes="开发者" Retire="false" />' in data
    assert '<TypeItem Export="true" ID="2" Retire="true">\r\n    <Quality>5</Quality>\r\n  </TypeItem>' in data
    assert data.endswith("</TypeList>")


def test_normaltxt_xml_byte_format():
    items = [NameStringPair(Export=True, Name="some_unlock", Value="解锁$0")]
    data = xmlfmt.serialize_normaltxt(items)
    assert '  <String Export="true" Name="some_unlock" Value="解锁$0" />' in data
    assert "\ufeff" == data[0]


def test_attr_escaping():
    data = xmlfmt.serialize_normaltxt([NameStringPair(Name="k", Value='a"b<c&d')])
    assert 'Value="a&quot;b&lt;c&amp;d"' in data


# ---------------------------------------------------------------------------
# exporters
# ---------------------------------------------------------------------------

def test_lua_export_format_and_order():
    strings = [NameStringPair(Name="train", Value="训练")]
    gids = [
        TypeItem(ID=100, Name="废弃", Comment="不导出", Retire=True),
        TypeItem(ID=101, Name="名字", Comment="描述"),
        TypeItem(ID=102, Name=None, Comment="只有描述"),
    ]
    lua = gen_lua(strings, gids)
    assert lua == ('local loc = {\r\n'
                   'train = "训练",\r\n'
                   'n101 = "名字",\r\n'
                   'd101 = "描述",\r\n'
                   'd102 = "只有描述",\r\n'
                   '}\r\n'
                   'return loc\r\n')


def test_lua_values_not_escaped(sandbox):
    """GUI EscapeJSONString() returns content unchanged — quotes pass through raw."""
    s = Session(sandbox)
    s.add_text("k", 'he said "hi"')
    out = open(os.path.join(sandbox, "OutPut_Dev", "string_zh_CN.txt"), "rb").read()
    assert b'k = "he said "hi"",' in out


def test_apq_export_excludes_quality_5():
    gids = [
        TypeItem(ID=1, Quality="1"),
        TypeItem(ID=2, Quality="4"),
        TypeItem(ID=3, Quality="5"),  # excluded: GUI condition num < 5
        TypeItem(ID=4, Retire=True, Quality="2"),
        TypeItem(ID=5, Quality=None),
    ]
    apq = gen_apq(gids)
    assert apq.startswith("\ufeff--Auto generated.Donot modify it.\r\nAPQualityMap = {\r\n")
    assert '[1] = "0",' in apq and '[2] = "3",' in apq
    assert "[3]" not in apq and "[4]" not in apq
    assert apq.endswith("}\r\nreturn APQualityMap\r\n")


# ---------------------------------------------------------------------------
# session mutations
# ---------------------------------------------------------------------------

def test_create_type_auto_id(sandbox):
    s = Session(sandbox)
    created = s.create_type("Building", "CityHall", name="测试建筑", comment="说明")
    assert created[0]["ID"] == (1 << 24) | (1 << 16) | 2  # empty-group quirk
    repo = GtypesRepo(sandbox)
    assert repo.find(created[0]["ID"]).Name == "测试建筑"


def test_create_type_unknown_category_refused(sandbox):
    """Unknown main/sub must never write anything (new categories are added
    by the program team in code, not bypassed by users)."""
    s = Session(sandbox)
    before = open(os.path.join(sandbox, "gtypes.xml"), "rb").read()
    with pytest.raises(ValueError):
        s.create_type("NewMain", None, name="越权类型")       # unknown main
    with pytest.raises(ValueError):
        s.create_type("Building", "NoSuchSub", name="越权子类")  # unknown sub
    assert open(os.path.join(sandbox, "gtypes.xml"), "rb").read() == before


def test_create_type_force_id_must_match_group(sandbox):
    """force-id cannot smuggle an unvalidated main/sub: high bits must equal
    the validated category prefix."""
    s = Session(sandbox)
    smuggled = (14 << 24) | 3  # pretend Main=14 exists — must be refused
    with pytest.raises(ValueError):
        s.create_type("Misc", None, name="越权ID", force_id=smuggled)
    created = s.create_type("Misc", None, name="合法指定", force_id=(13 << 24) | 500)
    assert created[0]["ID"] == (13 << 24) | 500


def test_create_type_batch_and_quality(sandbox):
    s = Session(sandbox)
    created = s.create_type("Property", "ActivityProperty", name="活动属性",
                            quality="Purple", batch=3)
    assert [c["ID"] for c in created] == [(4 << 24) | (4 << 16) | 2 + i for i in range(3)]
    assert created[0]["Quality"] == "4"


def test_create_type_quality_only_for_property(sandbox):
    s = Session(sandbox)
    with pytest.raises(ValueError):
        s.create_type("Building", "CityHall", name="x", quality="Blue")


def test_retire_restore(sandbox):
    s = Session(sandbox)
    item = s.create_type("Misc", None, name="临时")[0]
    gid = item["ID"]
    s.retire_type(gid)
    assert GtypesRepo(sandbox).find(gid).Retire is True
    s.restore_type(gid)
    assert GtypesRepo(sandbox).find(gid).Retire is False


def test_name_collision_rejected(sandbox):
    s = Session(sandbox)
    s.create_type("Misc", None, name="唯一名")
    with pytest.raises(ValueError):
        s.create_type("Misc", None, name="唯一名")


def test_txt_add_set_remove(sandbox):
    s = Session(sandbox)
    s.add_text("hello", "你好")
    assert NormalTxtRepo(sandbox).find("hello").Value == "你好"
    s.set_text("hello", value="您好")
    assert NormalTxtRepo(sandbox).find("hello").Value == "您好"
    s.remove_text("hello")
    assert NormalTxtRepo(sandbox).find("hello") is None


def test_txt_duplicate_name_rejected(sandbox):
    s = Session(sandbox)
    s.add_text("dup", "1")
    with pytest.raises(ValueError):
        s.add_text("dup", "2")


def test_dry_run_writes_nothing(sandbox):
    s = Session(sandbox)
    before = open(os.path.join(sandbox, "gtypes.xml"), "rb").read()
    created = s.create_type("Misc", None, name="预演", dry_run=True)
    assert created
    assert open(os.path.join(sandbox, "gtypes.xml"), "rb").read() == before


def test_backup_created_on_save(sandbox):
    s = Session(sandbox)
    s.create_type("Misc", None, name="备份测试")
    backup_root = os.path.join(sandbox, ".gtgen-backup")
    assert os.path.isdir(backup_root)
    assert any(f == "gtypes.xml" for _, _, fs in os.walk(backup_root) for f in fs)


def test_search_numeric_vs_text(sandbox):
    repo = GtypesRepo(sandbox)
    repo.items = [TypeItem(ID=123456, Name="目标A"), TypeItem(ID=654321, Name="目标B")]
    assert [i.ID for i in repo.search("1234")] == [123456]     # numeric → ID substring
    assert [i.ID for i in repo.search("目标")] == [123456, 654321]  # text → Name
