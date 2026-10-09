"""Byte-compatible XML serialization for gtypes.xml / normaltxt.xml.

Replicates .NET XmlWriter output as produced by GTGenerator's Utilities.SerializeObject:
- UTF-8 with BOM
- CRLF line endings
- two-space indent
- no namespace prefixes
- attributes in dataclass field order; None attributes omitted; "" kept as empty attr
- Quality serialized as child element <Quality>n</Quality>
- empty child-less elements self-close (<TypeItem ... />)
- empty values in android arrays serialize as <item />
"""

from __future__ import annotations

import xml.sax.saxutils as saxutils

from .model import NameStringPair, TypeItem

BOM = "\ufeff"


def _esc_attr(value: str) -> str:
    return saxutils.escape(value, {'"': "&quot;"})


def _attr(name: str, value: object) -> str:
    return f' {name}="{_esc_attr(str(value))}"'


def _bool(v: bool) -> str:
    return "true" if v else "false"


def _open_or_selfclose(tag: str, attrs: str, children: list[str], indent: str) -> str:
    if not children:
        return f"{indent}<{tag}{attrs} />"
    inner = "\r\n".join(f"{indent}  {c}" for c in children)
    return f"{indent}<{tag}{attrs}>\r\n{inner}\r\n{indent}</{tag}>"


def serialize_gtypes(items: list[TypeItem]) -> str:
    lines: list[str] = []
    lines.append('<?xml version="1.0" encoding="utf-8"?>')
    lines.append("<TypeList>")
    for it in items:
        attrs = f'{_attr("Export", _bool(it.Export))}{_attr("ID", it.ID)}'
        if it.Name is not None:
            attrs += _attr("Name", it.Name)
        if it.Comment is not None:
            attrs += _attr("Comment", it.Comment)
        if it.DevDes is not None:
            attrs += _attr("DevDes", it.DevDes)
        attrs += _attr("Retire", _bool(it.Retire))
        children = []
        if it.Quality is not None and it.Quality != "":
            children.append(f"<Quality>{saxutils.escape(it.Quality)}</Quality>")
        lines.append(_open_or_selfclose("TypeItem", attrs, children, "  "))
    lines.append("</TypeList>")
    return BOM + "\r\n".join(lines)


def serialize_normaltxt(items: list[NameStringPair]) -> str:
    lines: list[str] = []
    lines.append('<?xml version="1.0" encoding="utf-8"?>')
    lines.append("<Resources>")
    for s in items:
        attrs = f'{_attr("Export", _bool(s.Export))}'
        if s.Name is not None:
            attrs += _attr("Name", s.Name)
        if s.Value is not None:
            attrs += _attr("Value", s.Value)
        if s.Comment is not None:
            attrs += _attr("Comment", s.Comment)
        lines.append(f'  <String{attrs} />')
    lines.append("</Resources>")
    return BOM + "\r\n".join(lines)


def serialize_android_string(single: list[tuple[str, str]]) -> str:
    """single: list of (name, content)."""
    lines = ['<?xml version="1.0" encoding="utf-8"?>', "<resources>"]
    for name, content in single:
        if content:
            lines.append(f'  <string name="{_esc_attr(name)}">{saxutils.escape(content)}</string>')
        else:
            lines.append(f'  <string name="{_esc_attr(name)}" />')
    lines.append("</resources>")
    return BOM + "\r\n".join(lines)


def serialize_android_arr(arrays: list[tuple[str, list[str]]]) -> str:
    """arrays: list of (name, [item1, item2, ...])."""
    lines = ['<?xml version="1.0" encoding="utf-8"?>', "<resources>"]
    for name, items in arrays:
        lines.append(f'  <string-array name="{_esc_attr(name)}">')
        for item in items:
            if item:
                lines.append(f"    <item>{saxutils.escape(item)}</item>")
            else:
                lines.append("    <item />")
        lines.append("  </string-array>")
    lines.append("</resources>")
    return BOM + "\r\n".join(lines)
