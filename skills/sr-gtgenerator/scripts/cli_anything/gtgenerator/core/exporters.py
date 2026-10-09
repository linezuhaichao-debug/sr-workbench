"""Export generators — byte-compatible ports of ConfigManager's Gen* methods.

- GenAllLocalizationString -> string_zh_CN.txt (no BOM, CRLF, values NOT escaped — GUI quirk)
- GenActivityPropetyString -> APQualityMap.txt (BOM, CRLF, quality-1, quality 5 excluded)
- GenAndroidLocalizationString -> android_string.xml + android_string_arr.xml (BOM, CRLF)
- ConvertAndroidFormatToLua -> reverse conversion incl. <name>$-space error report
"""

from __future__ import annotations

import os
import re

from . import xmlfmt
from .model import ANDROID_LANG_MAP, NameStringPair, TypeItem


def gen_lua(strings: list[NameStringPair], gids: list[TypeItem]) -> str:
    """Port of GenAllLocalizationString. Values are written raw (no escaping),
    matching EscapeJSONString() which returns content unchanged."""
    lines: list[str] = ["local loc = {"]
    for s in strings:
        value = s.Value if s.Value else ""
        lines.append(f'{s.Name} = "{value}",')
    for g in gids:
        if g.Retire:
            continue
        if g.Name:
            lines.append(f'n{g.ID} = "{g.Name}",')
        if g.Comment:
            lines.append(f'd{g.ID} = "{g.Comment}",')
    lines.append("}")
    lines.append("return loc")
    return "\r\n".join(lines) + "\r\n"


def gen_apq(gids: list[TypeItem]) -> str:
    """Port of GenActivityPropetyString. Quality 1-4 exported as q-1; 5 excluded."""
    lines: list[str] = ["--Auto generated.Donot modify it.", "APQualityMap = {"]
    for g in gids:
        if g.Retire or not g.Quality:
            continue
        try:
            q = int(g.Quality)
        except ValueError:
            continue
        if 0 < q < 5:
            lines.append(f'[{g.ID}] = "{q - 1}",')
    lines.append("}")
    lines.append("return APQualityMap")
    return "\ufeff" + "\r\n".join(lines) + "\r\n"


def write_text(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content.encode("utf-8"))


def export_all(
    workdir: str,
    strings: list[NameStringPair],
    gids: list[TypeItem],
    release: bool = False,
) -> dict[str, str]:
    """Save button behavior: gtypes.xml already written by repo; here regenerate
    string_zh_CN.txt (Dev by default, Release on demand) + APQualityMap.txt."""
    out_dir = "OutPut" if release else "OutPut_Dev"
    lua_path = os.path.join(workdir, out_dir, "string_zh_CN.txt")
    apq_path = os.path.join(workdir, out_dir, "APQualityMap.txt")
    write_text(lua_path, gen_lua(strings, gids))
    write_text(apq_path, gen_apq(gids))
    return {"lua": lua_path, "apq": apq_path}


def gen_android(workdir: str, strings: list[NameStringPair], gids: list[TypeItem]) -> dict[str, str]:
    """Port of GenAndroidLocalizationString. Returns written file paths."""
    single = [(s.Name or "", s.Value or "") for s in strings if s.Export]
    arrays = []
    for g in gids:
        if g.Retire or not g.Export:
            continue
        if not g.Name and not g.Comment:
            continue
        arrays.append((f"GID_{g.ID}", [g.Name or "", g.Comment or ""]))
    s_path = os.path.join(workdir, "android_string.xml")
    a_path = os.path.join(workdir, "android_string_arr.xml")
    with open(s_path, "wb") as f:
        f.write(xmlfmt.serialize_android_string(single).encode("utf-8"))
    with open(a_path, "wb") as f:
        f.write(xmlfmt.serialize_android_arr(arrays).encode("utf-8"))
    return {"android_string": s_path, "android_arr": a_path}


_DOLLAR_SPACE = re.compile(r"\$\s")


def _fix_arabic(content: str) -> str:
    """Approximation of ArabicFixer.Fix + FixArbic cleanup. The reshaping engine
    is not ported (out of scope for a Python harness); the character cleanup is.
    Set --arabic only when round-tripping Arabic content that the GUI already fixed."""
    text = content
    for i in range(4):
        text = text.replace(f"{i}$", f"${i}")
    return text.replace("\\", "").replace('"', "").replace("rn", "\r\n")


def convert_android_to_lua(
    workdir: str,
    str_path: str,
    arr_path: str,
    arabic: bool,
    lua_name: str,
    gids_for_apq: list[TypeItem] | None = None,
) -> dict[str, object]:
    """Port of ConvertAndroidFormatToLua. Writes <lua_name> into OutPut (release=True
    in GUI) and error.xml when $-space anomalies found."""
    fix = _fix_arabic if arabic else (lambda t: t)
    strings: list[NameStringPair] = []
    errors: list[NameStringPair] = []

    with open(str_path, "rb") as f:
        root = ET_from_bytes(f.read())
    for el in root.findall("string"):
        content = el.text or ""
        pair = NameStringPair(Name=el.get("name"), Value=fix(content))
        strings.append(pair)
        if content and _DOLLAR_SPACE.search(content):
            errors.append(NameStringPair(Name=el.get("name"), Value=content))

    gid_items: list[TypeItem] = []
    with open(arr_path, "rb") as f:
        arr_root = ET_from_bytes(f.read())
    for el in arr_root.findall("string-array"):
        items = [it.text or "" for it in el.findall("item")]
        name_text = (items[0].strip() if len(items) > 0 and items[0] else "") or ""
        comment_text = (items[1].strip() if len(items) > 1 and items[1] else "") or ""
        if arabic:
            name_text = fix(name_text)
            comment_text = fix(comment_text)
        raw_name = el.get("name", "")
        gid = int(raw_name[4:])  # "GID_" prefix
        gid_items.append(TypeItem(ID=gid, Name=name_text, Comment=comment_text))
        if _DOLLAR_SPACE.search(name_text) or _DOLLAR_SPACE.search(comment_text):
            errors.append(NameStringPair(Name=str(gid), Value=comment_text))

    result: dict[str, object] = {"strings": len(strings), "gids": len(gid_items)}
    if errors:
        err_path = os.path.join(workdir, lua_name.replace(".txt", "") + "error.xml")
        with open(err_path, "wb") as f:
            f.write(xmlfmt.serialize_normaltxt(errors).encode("utf-8"))
        result["error_file"] = err_path

    lua_path = os.path.join(workdir, "OutPut", lua_name)
    write_text(lua_path, gen_lua(strings, gid_items))
    result["lua"] = lua_path
    if lua_name == "string_zh_CN.txt" and gids_for_apq is not None:
        apq_path = os.path.join(workdir, "OutPut", "APQualityMap.txt")
        write_text(apq_path, gen_apq(gids_for_apq))
        result["apq"] = apq_path
    return result


def import_android_all(workdir: str, android_dir: str) -> list[dict[str, object]]:
    """Port of FilePathForm.button2_Click: iterate android/<lang>/ and convert each."""
    results = []
    for lang, lua_name in ANDROID_LANG_MAP.items():
        s_path = os.path.join(android_dir, lang, "android_string.xml")
        a_path = os.path.join(android_dir, lang, "android_string_arr.xml")
        if not (os.path.exists(s_path) and os.path.exists(a_path)):
            results.append({"lang": lang, "skipped": True})
            continue
        r = convert_android_to_lua(workdir, s_path, a_path, arabic=False, lua_name=lua_name)
        r["lang"] = lang
        results.append(r)
    return results


def merge_translation(workdir: str, new_dir: str) -> dict[str, object]:
    """Port of MergeTranslationForm.FirstTranslation.

    - addlist.xml: active GIDs in current gtypes.xml missing from new translation
      (i.e. still need translation).
    - trangids.xml: the new translation's gtypes.xml copied verbatim.
    Returns counts; missing pieces reported as still-needed."""
    new_gtypes = os.path.join(new_dir, "gtypes.xml")
    out: dict[str, object] = {}
    if os.path.exists(new_gtypes):
        with open(new_gtypes, "rb") as f:
            new_root = ET_from_bytes(f.read())
        new_ids = {int(el.get("ID", "0")) for el in new_root.findall("TypeItem")}
        with open(os.path.join(workdir, "gtypes.xml"), "rb") as f:
            cur_root = ET_from_bytes(f.read())
        need = []
        for el in cur_root.findall("TypeItem"):
            if _parse_bool(el.get("Retire")):
                continue
            gid = int(el.get("ID", "0"))
            if gid not in new_ids:
                need.append(el)
        # serialize the missing ones back through our formatter
        items = [
            TypeItem(
                Export=el.get("Export", "true").strip().lower() == "true",
                ID=int(el.get("ID", "0")),
                Name=el.get("Name"),
                Comment=el.get("Comment"),
                DevDes=el.get("DevDes"),
                Retire=False,
            )
            for el in need
        ]
        addlist_path = os.path.join(workdir, "addlist.xml")
        with open(addlist_path, "wb") as f:
            f.write(xmlfmt.serialize_gtypes(items).encode("utf-8"))
        trangids_path = os.path.join(workdir, "trangids.xml")
        shutil_copy(new_gtypes, trangids_path)
        out = {"addlist": addlist_path, "trangids": trangids_path,
               "need_translation": len(items)}
    else:
        out = {"error": f"gtypes.xml not found in {new_dir}"}
    return out


def _parse_bool(v: str | None) -> bool:
    return (v or "").strip().lower() == "true"


def ET_from_bytes(data: bytes):
    import xml.etree.ElementTree as ET

    return ET.fromstring(data.decode("utf-8-sig"))


def shutil_copy(src: str, dst: str) -> None:
    import shutil

    shutil.copy2(src, dst)
