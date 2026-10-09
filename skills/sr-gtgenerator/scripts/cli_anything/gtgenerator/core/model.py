"""GTGenerator data model.

Mirrors the decompiled .NET model exactly so that serialized XML is
byte-compatible with what the GUI tool writes back:

- TypeList -> <TypeList><TypeItem Export ID Name Comment DevDes Retire/>[<Quality>n</Quality>]</TypeList>
- StringList -> <Resources><String Export Name Value Comment/></Resources>

Attribute order matters: the GUI writes attributes in declaration order
(Export, ID, Name, Comment, DevDes, Retire). Quality is a child *element*,
not an attribute.
"""

from dataclasses import dataclass, field


@dataclass
class TypeItem:
    Export: bool = True
    ID: int = 0
    Name: str | None = None
    Comment: str | None = None
    DevDes: str | None = None
    Retire: bool = False
    Quality: str | None = None  # child element, only Property/ActivityProperty

    @property
    def main(self) -> int:
        return (self.ID >> 24) & 0xFF

    @property
    def sub(self) -> int:
        return (self.ID >> 16) & 0xFF

    @property
    def sequence(self) -> int:
        return self.ID & 0xFFFF


@dataclass
class NameStringPair:
    Export: bool = True
    Name: str | None = None
    Value: str | None = None
    Comment: str | None = None


# Main categories (ConfigManager.TypeCategory)
MAIN_CATEGORIES: list[tuple[str, int]] = [
    ("Building", 1), ("Soldier", 2), ("Effect", 3), ("Property", 4),
    ("Tech", 5), ("Skill", 6), ("Task", 7), ("Leader", 8),
    ("MapBuilding", 9), ("Payment", 10), ("Kingdom", 11), ("Equip", 12),
    ("Misc", 13),
]

MAIN_BY_NAME = {n: v for n, v in MAIN_CATEGORIES}

# Sub categories per main (ConfigManager.GetSubCategory). Tech starts at 0.
SUB_CATEGORIES: dict[str, list[tuple[str, int]]] = {
    "Building": [("CityHall", 1), ("Barracks", 2), ("Research", 3), ("Production", 4),
                 ("House", 5), ("Bonus", 6), ("Normal", 7), ("Facility", 8)],
    "Effect": [("Amount", 1), ("Percent", 2), ("XGameAmount", 3), ("XGamePercent", 4)],
    "Property": [("Normal", 1), ("Resource", 2), ("Goods", 3), ("ActivityProperty", 4),
                 ("BonusFragment", 5), ("NormalFragment", 6), ("HeroFragment", 7),
                 ("HeroSkillFragment", 8), ("EquipStuff", 9), ("CitySkin", 10),
                 ("TroopSkin", 11), ("RedPacket", 12), ("Nameplate", 13), ("HeadSkin", 14),
                 ("ChatSkin", 15), ("HeroEquip", 16), ("NewNormal", 17), ("NewResource", 18)],
    "Tech": [("Age", 0), ("Alliance", 1), ("Lord", 2)],
    "Skill": [("SoilderSpecial", 1), ("HeroFixedSkill", 2), ("HeroAlterableSkill", 3),
              ("PolicySkill", 4), ("XGameSkill", 5), ("TaiTanSkill", 6), ("DungeonSkill", 7),
              ("EquipSkill", 8), ("MineSkill", 9)],
    "Task": [("Productive", 1), ("Chapter", 2), ("Page", 3), ("Requiretype", 4),
             ("Daily", 5), ("NewRequiretype", 6), ("MinimapRequiretype", 7)],
    "Leader": [("Military", 1), ("Strategy", 2), ("Internal", 3), ("King", 4)],
    "Kingdom": [("Officials", 1), ("Gift", 2)],
}

SUB_BY_NAME = {main: dict(subs) for main, subs in SUB_CATEGORIES.items()}

QUALITY_TYPES: list[tuple[str, int]] = [
    ("White", 1), ("Green", 2), ("Blue", 3), ("Purple", 4), ("Orange", 5),
]
QUALITY_BY_NAME = {n: v for n, v in QUALITY_TYPES}

# android/ directory language folder -> output lua name (FilePathForm.button2_Click)
ANDROID_LANG_MAP: dict[str, str] = {
    "arbic": "string_ar.txt",
    "de": "string_de.txt",
    "en_US": "string_en_US.txt",
    "es-ES": "string_es.txt",
    "fr": "string_fr.txt",
    "id": "string_indo.txt",
    "it": "string_it.txt",
    "jp": "string_jp_JP.txt",
    "korea": "string_ko_KR.txt",
    "nl": "string_nl.txt",
    "pt_BR": "string_pt.txt",
    "ru": "string_ru.txt",
    "th": "string_th.txt",
    "vi": "string_vi.txt",
    "zh_HK": "string_zh_TW.txt",
    "tr": "string_tr.txt",
    "sv-SE": "string_sv.txt",
    "he": "string_he.txt",
    "pl": "string_pl.txt",
    "fi": "string_fi.txt",
    "zh_CN": "string_zh_CN.txt",
}
