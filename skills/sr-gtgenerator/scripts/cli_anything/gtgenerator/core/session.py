"""Session layer — mimics the GUI's load-edit-save lifecycle.

The GUI keeps gtypes.xml/normaltxt.xml in memory; Save writes XML + regenerates
outputs. A CLI session is file-backed: every repo is loaded fresh from disk,
so commands can be chained in a pipeline by saving between steps (auto-save on
mutations, --dry-run to suppress).
"""

from __future__ import annotations

import os

from .exporters import export_all
from .repo import GtypesRepo, NormalTxtRepo, prune_backups


class Session:
    def __init__(self, workdir: str):
        workdir = os.path.abspath(workdir)
        if not os.path.isdir(workdir):
            raise FileNotFoundError(f"working directory not found: {workdir}")
        self.workdir = workdir
        self.gtypes = GtypesRepo(workdir)
        self.txt = NormalTxtRepo(workdir)

    # ---- GID operations -------------------------------------------------

    def create_type(
        self,
        main: str,
        sub: str | None,
        name: str = "",
        comment: str = "",
        dev_des: str = "",
        quality: str | None = None,
        batch: int = 1,
        force_id: int | None = None,
        dry_run: bool = False,
    ) -> list[dict]:
        from .model import MAIN_BY_NAME, SUB_BY_NAME, QUALITY_BY_NAME

        if main not in MAIN_BY_NAME:
            raise ValueError(f"unknown main category: {main}. Valid: {', '.join(MAIN_BY_NAME)}")
        m = MAIN_BY_NAME[main]
        s = 0
        if sub is not None and sub != "":
            subs = SUB_BY_NAME.get(main)
            if not subs:
                raise ValueError(f"main '{main}' has no sub categories")
            if sub not in subs:
                raise ValueError(f"unknown sub '{sub}' for {main}. Valid: {', '.join(subs)}")
            s = subs[sub]
        q: str | None = None
        if quality:
            if quality not in QUALITY_BY_NAME:
                raise ValueError(f"unknown quality '{quality}'. Valid: {', '.join(QUALITY_BY_NAME)}")
            if main != "Property":
                raise ValueError("quality is only valid for main category 'Property'")
            q = str(QUALITY_BY_NAME[quality])

        created = []
        if not dry_run and name:
            # GUI only warns on duplicate names; the CLI refuses (safer for agents)
            if self.gtypes.name_exists(name):
                raise ValueError(f"type name already exists: {name}")
        if force_id is not None:
            # hard consistency: forced ID must stay inside the validated main/sub group
            expected = (m << 24) | (s << 16)
            seq = force_id & 0xFFFF
            if (force_id & 0xFFFF0000) != expected:
                raise ValueError(
                    f"force-id {force_id} (0x{force_id:08X}) is outside the "
                    f"{main}/{sub or ''} group (expected 0x{expected:08X}-prefix)"
                )
            start_id = expected | seq
        else:
            start_id = (m << 24) | (s << 16) | self.gtypes.next_sequence(m, s)
        for i in range(max(1, batch)):
            item = {
                "ID": start_id + i,
                "Name": name,
                "Comment": comment or None,
                "DevDes": dev_des or None,
                "Quality": q,
            }
            created.append(item)
        if dry_run:
            return created
        for item in created:
            self.gtypes.items.append(
                _mk_type_item(item["ID"], item["Name"], item["Comment"], item["DevDes"], item["Quality"])
            )
        self.gtypes.items.sort(key=lambda t: t.ID)
        self.gtypes.save()
        prune_backups(self.gtypes.path)
        return created

    def retire_type(self, gid: int, dry_run: bool = False) -> dict:
        item = self.gtypes.find(gid)
        if not item:
            raise KeyError(f"GID {gid} not found")
        item.Retire = True
        if not dry_run:
            self.gtypes.save()
            prune_backups(self.gtypes.path)
        return {"ID": gid, "Retire": True}

    def restore_type(self, gid: int, dry_run: bool = False) -> dict:
        item = self.gtypes.find(gid)
        if not item:
            raise KeyError(f"GID {gid} not found")
        item.Retire = False
        if not dry_run:
            self.gtypes.save()
            prune_backups(self.gtypes.path)
        return {"ID": gid, "Retire": False}

    def set_type(
        self,
        gid: int,
        name: str | None = None,
        comment: str | None = None,
        dev_des: str | None = None,
        export: bool | None = None,
        dry_run: bool = False,
    ) -> dict:
        item = self.gtypes.find(gid)
        if not item:
            raise KeyError(f"GID {gid} not found")
        changed = {}
        if name is not None:
            name = name.strip()
            if name and self.gtypes.name_exists(name, exclude=item):
                raise ValueError(f"type name already exists: {name}")
            item.Name = name
            changed["Name"] = name
        if comment is not None:
            item.Comment = comment
            changed["Comment"] = comment
        if dev_des is not None:
            item.DevDes = dev_des
            changed["DevDes"] = dev_des
        if export is not None:
            item.Export = export
            changed["Export"] = export
        if not dry_run and changed:
            self.gtypes.save()
            prune_backups(self.gtypes.path)
        return {"ID": gid, "changed": changed}

    def save_all(self, release: bool = False) -> dict:
        """Save button: gtypes.xml + regenerate string_zh_CN.txt + APQualityMap.txt."""
        self.gtypes.save()
        paths = export_all(self.workdir, self.txt.items, self.gtypes.items, release=release)
        prune_backups(self.gtypes.path)
        return {"gtypes": self.gtypes.path, **paths}

    # ---- text operations -------------------------------------------------

    def add_text(self, name: str, value: str, comment: str | None = None,
                 dry_run: bool = False) -> dict:
        if self.txt.name_exists(name):
            raise ValueError(f"text name already exists: {name}")
        if not dry_run:
            self.txt.items.append(_mk_pair(name, value, comment))
            self.save_txt()
        return {"Name": name, "Value": value}

    def set_text(self, name: str, value: str | None = None,
                 new_name: str | None = None, export: bool | None = None,
                 dry_run: bool = False) -> dict:
        item = self.txt.find(name)
        if not item:
            raise KeyError(f"text '{name}' not found")
        changed = {}
        if new_name is not None:
            new_name = new_name.strip()
            if new_name and self.txt.name_exists(new_name, exclude=item):
                raise ValueError(f"text name already exists: {new_name}")
            item.Name = new_name
            changed["Name"] = new_name
        if value is not None:
            item.Value = value
            changed["Value"] = value
        if export is not None:
            item.Export = export
            changed["Export"] = export
        if not dry_run and changed:
            self.save_txt()
        return {"Name": name, "changed": changed}

    def remove_text(self, name: str, dry_run: bool = False) -> dict:
        item = self.txt.find(name)
        if not item:
            raise KeyError(f"text '{name}' not found")
        if not dry_run:
            self.txt.items.remove(item)
            self.save_txt()
        return {"Name": name, "removed": True}

    def save_txt(self) -> dict:
        """Localization Save: normaltxt.xml + regenerate string_zh_CN.txt."""
        self.txt.save()
        paths = export_all(self.workdir, self.txt.items, self.gtypes.items)
        prune_backups(self.txt.path)
        return {"normaltxt": self.txt.path, **paths}


def _mk_type_item(gid: int, name: str | None, comment: str | None,
                  dev_des: str | None, quality: str | None):
    from .model import TypeItem

    return TypeItem(ID=gid, Name=name, Comment=comment, DevDes=dev_des, Quality=quality)


def _mk_pair(name: str, value: str, comment: str | None):
    from .model import NameStringPair

    return NameStringPair(Name=name, Value=value, Comment=comment)
