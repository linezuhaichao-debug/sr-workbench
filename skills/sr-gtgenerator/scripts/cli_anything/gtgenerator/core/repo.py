"""Repository layer: load/parse gtypes.xml and normaltxt.xml.

Parsing is lenient (real XmlSerializer behavior: unknown members ignored,
missing attrs default). Writing goes through xmlfmt for byte compatibility.
"""

from __future__ import annotations

import os
import re
import shutil
import time
import xml.etree.ElementTree as ET

from .model import NameStringPair, TypeItem
from . import xmlfmt

GTYPE_FILENAME = "gtypes.xml"
NORMALTXT_FILENAME = "normaltxt.xml"


def _parse_bool(v: str | None, default: bool) -> bool:
    if v is None:
        return default
    return v.strip().lower() == "true"


class GtypesRepo:
    """In-memory view of gtypes.xml. GUI loads then sorts by ID; save writes sorted."""

    def __init__(self, workdir: str):
        self.workdir = os.path.abspath(workdir)
        self.items: list[TypeItem] = []
        self.load()

    @property
    def path(self) -> str:
        return os.path.join(self.workdir, GTYPE_FILENAME)

    def load(self) -> None:
        self.items = []
        if not os.path.exists(self.path):
            return
        tree = ET.parse(self.path)
        root = tree.getroot()
        for el in root.findall("TypeItem"):
            quality_el = el.find("Quality")
            self.items.append(
                TypeItem(
                    Export=_parse_bool(el.get("Export"), True),
                    ID=int(el.get("ID", "0")),
                    Name=el.get("Name"),
                    Comment=el.get("Comment"),
                    DevDes=el.get("DevDes"),
                    Retire=_parse_bool(el.get("Retire"), False),
                    Quality=quality_el.text if quality_el is not None else None,
                )
            )
        self.items.sort(key=lambda t: t.ID)

    def save(self, backup: bool = True) -> None:
        if backup:
            self.backup()
        content = xmlfmt.serialize_gtypes(self.items)
        with open(self.path, "wb") as f:
            f.write(content.encode("utf-8"))

    def backup(self) -> str:
        return backup_file(self.path)

    def find(self, gid: int) -> TypeItem | None:
        for it in self.items:
            if it.ID == gid:
                return it
        return None

    def name_exists(self, name: str, exclude: TypeItem | None = None) -> bool:
        return any(it.Name == name and it is not exclude for it in self.items)

    def next_sequence(self, main: int, sub: int) -> int:
        """Replicates NewTypeForm.generateId(): group max sequence starts at 1,
        so an empty group yields sequence 2 (GUI quirk, kept on purpose)."""
        mask = 0xFFFF0000
        target = (main << 24) | (sub << 16)
        seq = 1
        for it in self.items:
            if (it.ID & mask) == target:
                s = it.ID & 0xFFFF
                if s > seq:
                    seq = s
        return seq + 1

    def search(self, term: str) -> list[TypeItem]:
        """Mirrors MainForm.ParamFilter: numeric term matches ID substring,
        otherwise Name/Comment substring."""
        results = []
        try:
            num = int(term)
        except ValueError:
            num = None
        for it in self.items:
            if num is None:
                if (it.Name and term in it.Name) or (it.Comment and term in it.Comment):
                    results.append(it)
            elif term in str(it.ID):
                results.append(it)
        return results


class NormalTxtRepo:
    """In-memory view of normaltxt.xml. Order is file order (no sorting in GUI)."""

    def __init__(self, workdir: str):
        self.workdir = os.path.abspath(workdir)
        self.items: list[NameStringPair] = []
        self.load()

    @property
    def path(self) -> str:
        return os.path.join(self.workdir, NORMALTXT_FILENAME)

    def load(self) -> None:
        self.items = []
        if not os.path.exists(self.path):
            return
        tree = ET.parse(self.path)
        for el in tree.getroot().findall("String"):
            self.items.append(
                NameStringPair(
                    Export=_parse_bool(el.get("Export"), True),
                    Name=el.get("Name"),
                    Value=el.get("Value"),
                    Comment=el.get("Comment"),
                )
            )

    def save(self, backup: bool = True) -> None:
        if backup:
            self.backup()
        content = xmlfmt.serialize_normaltxt(self.items)
        with open(self.path, "wb") as f:
            f.write(content.encode("utf-8"))

    def backup(self) -> str:
        return backup_file(self.path)

    def find(self, name: str) -> NameStringPair | None:
        for s in self.items:
            if s.Name == name:
                return s
        return None

    def name_exists(self, name: str, exclude: NameStringPair | None = None) -> bool:
        return any(s.Name == name and s is not exclude for s in self.items)

    def search(self, term: str) -> list[NameStringPair]:
        return [s for s in self.items if (s.Name and term in s.Name) or (s.Value and term in s.Value)]


def backup_file(path: str) -> str:
    """Copy path into <dir>/.gtgen-backup/<yyyymmdd_hhmmss>/<filename>. Returns backup path."""
    if not os.path.exists(path):
        return ""
    folder = os.path.join(os.path.dirname(path), ".gtgen-backup", time.strftime("%Y%m%d_%H%M%S"))
    os.makedirs(folder, exist_ok=True)
    dest = os.path.join(folder, os.path.basename(path))
    shutil.copy2(path, dest)
    return dest


_BACKUP_DIR = ".gtgen-backup"


def prune_backups(path: str, keep: int = 20) -> None:
    root = os.path.join(os.path.dirname(path), _BACKUP_DIR)
    if not os.path.isdir(root):
        return
    dirs = sorted(d for d in os.listdir(root) if re.fullmatch(r"\d{8}_\d{6}", d))
    for d in dirs[:-keep] if keep >= 0 else []:
        shutil.rmtree(os.path.join(root, d), ignore_errors=True)
