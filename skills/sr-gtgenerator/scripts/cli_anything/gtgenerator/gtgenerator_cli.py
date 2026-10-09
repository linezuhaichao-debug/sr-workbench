"""cli-anything-gtgenerator — agent-native CLI for the GTGenerator config tool.

One-shot subcommand CLI mirroring the GUI's 8 buttons. Session state is the
file pair gtypes.xml + normaltxt.xml in the working directory; mutations
auto-save (use --dry-run to preview).
"""

from __future__ import annotations

import os
import sys

import click

from .core.exporters import (
    convert_android_to_lua,
    gen_android,
    import_android_all,
    merge_translation,
)
from .core.output import out
from .core.session import Session

CONTEXT_SETTINGS = {"help_option_names": ["-h", "--help"]}


def _session(workdir: str) -> Session:
    try:
        return Session(workdir)
    except FileNotFoundError as e:
        raise click.ClickException(str(e))


def _json_option(f):
    f = click.option("--json", "as_json", is_flag=True,
                     help="Emit machine-readable JSON output.")(f)
    return f


@click.group(context_settings=CONTEXT_SETTINGS)
@click.option("-d", "--workdir", default=".",
              type=click.Path(file_okay=False),
              help="GTGenerator working directory containing gtypes.xml / normaltxt.xml "
                   "[default: current directory]")
@click.version_option("1.1.0", prog_name="gtgenerator")
def cli(workdir: str):
    """Drive the GTGenerator GID/text config tool from the command line.

    The working directory must contain gtypes.xml and normaltxt.xml (the same
    layout as the GTGenerator.exe folder). Mutations auto-save; outputs go to
    OutPut/OutPut_Dev exactly like the GUI tool.
    """
    cli._workdir = os.path.abspath(workdir)


def _current_workdir() -> str:
    return getattr(cli, "_workdir", os.path.abspath("."))


# ---------------------------------------------------------------------------
# type group (Create / Delete / Recovery / search)
# ---------------------------------------------------------------------------

@cli.group()
def type():
    """Create, retire, restore, edit and search GID types (gtypes.xml)."""


@type.command("categories")
@_json_option
def type_categories(as_json: bool):
    """List valid Main/Sub/Quality categories for type creation."""
    from .core.model import MAIN_CATEGORIES, SUB_CATEGORIES, QUALITY_TYPES

    data = {
        "main": [{"name": n, "value": v} for n, v in MAIN_CATEGORIES],
        "sub": {m: [{"name": n, "value": v} for n, v in subs] for m, subs in SUB_CATEGORIES.items()},
        "quality": [{"name": n, "value": v} for n, v in QUALITY_TYPES],
    }
    out(data, as_json)


@type.command("next-id")
@click.argument("main")
@click.argument("sub", required=False, default=None)
@_json_option
def type_next_id(main: str, sub: str | None, as_json: bool):
    """Show the next free ID for a Main/Sub group (GUI auto-allocation)."""
    s = _session(_current_workdir())
    from .core.model import MAIN_BY_NAME, SUB_BY_NAME

    if main not in MAIN_BY_NAME:
        raise click.ClickException(f"unknown main: {main}")
    m = MAIN_BY_NAME[main]
    sv = 0
    if sub:
        subs = SUB_BY_NAME.get(main, {})
        if sub not in subs:
            raise click.ClickException(f"unknown sub '{sub}' for {main}")
        sv = subs[sub]
    seq = s.gtypes.next_sequence(m, sv)
    gid = (m << 24) | (sv << 16) | seq
    out({"main": main, "sub": sub or "", "next_id": gid,
         "hex": f"0x{gid:08X}"}, as_json)


@type.command("create")
@click.option("--main", "main_", required=True, help="Main category (see type categories)")
@click.option("--sub", default=None, help="Sub category (required for mains that have subs)")
@click.option("-n", "--name", default="", help="Type name (shown in game)")
@click.option("--comment", default="", help="Type description (Comment attribute)")
@click.option("--dev-des", default="", help="Dev-only description (DevDes attribute)")
@click.option("--quality", default=None, help="Quality (Property/ActivityProperty only): White..Orange")
@click.option("--batch", default=1, type=click.IntRange(min=1), help="Create N sequential IDs")
@click.option("--force-id", default=None, type=int, help="Use explicit ID instead of auto-allocation")
@click.option("--dry-run", is_flag=True, help="Compute IDs without writing anything")
@_json_option
def type_create(main_, sub, name, comment, dev_des, quality, batch, force_id, dry_run, as_json):
    """Create GID type(s). Mirrors Create Type dialog."""
    s = _session(_current_workdir())
    try:
        created = s.create_type(main_, sub, name=name, comment=comment,
                                dev_des=dev_des, quality=quality, batch=batch,
                                force_id=force_id, dry_run=dry_run)
    except ValueError as e:
        raise click.ClickException(str(e))
    out({"created": created, "dry_run": dry_run}, as_json,
        None if as_json else f"created {len(created)} type(s)" + (" (dry-run)" if dry_run else ""))


@type.command("list")
@click.option("--search", "-s", default=None, help="Search term (numeric = ID substring, else Name/Comment)")
@click.option("--retired/--active", default=None, help="Filter by Retire flag")
@click.option("--limit", default=50, type=int, help="Max rows to show")
@_json_option
def type_list(search, retired, limit, as_json):
    """List/search GID types (mirrors the main grid + search box)."""
    s = _session(_current_workdir())
    items = s.gtypes.search(search) if search else list(s.gtypes.items)
    if retired is not None:
        items = [i for i in items if i.Retire == retired]
    rows = [{
        "ID": i.ID, "hex": f"0x{i.ID:08X}", "Name": i.Name or "",
        "Comment": i.Comment or "", "DevDes": i.DevDes or "",
        "Retire": i.Retire, "Export": i.Export, "Quality": i.Quality or "",
    } for i in items]
    out({"total": len(rows), "shown": rows[:limit]}, as_json)


@type.command("get")
@click.argument("gid", type=int)
@_json_option
def type_get(gid: int, as_json: bool):
    """Show one GID with its decoded Main/Sub decomposition."""
    s = _session(_current_workdir())
    item = s.gtypes.find(gid)
    if not item:
        raise click.ClickException(f"GID {gid} not found")
    out({"ID": item.ID, "hex": f"0x{item.ID:08X}", "main": item.main, "sub": item.sub,
         "sequence": item.sequence, "Name": item.Name or "", "Comment": item.Comment or "",
         "DevDes": item.DevDes or "", "Retire": item.Retire, "Export": item.Export,
         "Quality": item.Quality or ""}, as_json)


@type.command("set")
@click.argument("gid", type=int)
@click.option("-n", "--name", default=None, help="New Name (empty string clears)")
@click.option("--comment", default=None, help="New Comment")
@click.option("--dev-des", default=None, help="New DevDes")
@click.option("--export/--no-export", "export", default=None, help="Toggle Export flag")
@click.option("--dry-run", is_flag=True)
@_json_option
def type_set(gid, name, comment, dev_des, export, dry_run, as_json):
    """Edit a GID's fields (mirrors in-grid cell editing)."""
    s = _session(_current_workdir())
    try:
        result = s.set_type(gid, name=name, comment=comment, dev_des=dev_des,
                            export=export, dry_run=dry_run)
    except (KeyError, ValueError) as e:
        raise click.ClickException(str(e))
    out(result, as_json)


@type.command("retire")
@click.argument("gid", type=int)
@click.option("--dry-run", is_flag=True)
@_json_option
def type_retire(gid: int, dry_run, as_json):
    """Logically deprecate a GID (Retire=true). NOT a physical delete."""
    s = _session(_current_workdir())
    try:
        result = s.retire_type(gid, dry_run=dry_run)
    except KeyError as e:
        raise click.ClickException(str(e))
    out(result, as_json)


@type.command("restore")
@click.argument("gid", type=int)
@click.option("--dry-run", is_flag=True)
@_json_option
def type_restore(gid: int, dry_run, as_json):
    """Restore a retired GID (Retire=false). Mirrors Recovery Type."""
    s = _session(_current_workdir())
    try:
        result = s.restore_type(gid, dry_run=dry_run)
    except KeyError as e:
        raise click.ClickException(str(e))
    out(result, as_json)


# ---------------------------------------------------------------------------
# txt group (Localization window)
# ---------------------------------------------------------------------------

@cli.group()
def txt():
    """Maintain normal text strings (normaltxt.xml) — the Localization window."""


@txt.command("list")
@click.option("--search", "-s", default=None, help="Substring match on Name/Value")
@click.option("--export/--no-export", "export", default=None,
              help="Filter by Export flag (no-export = deprecated texts)")
@click.option("--limit", default=100, type=int)
@_json_option
def txt_list(search, export, limit, as_json):
    """List text entries. --no-export shows deprecated (Export=false) ones."""
    s = _session(_current_workdir())
    items = s.txt.search(search) if search else list(s.txt.items)
    if export is not None:
        items = [i for i in items if i.Export == export]
    rows = [{"Name": i.Name, "Value": i.Value, "Export": i.Export} for i in items]
    out({"total": len(rows), "shown": rows[:limit]}, as_json)


@txt.command("get")
@click.argument("name")
@_json_option
def txt_get(name, as_json):
    """Show one text entry (for before/after diffs)."""
    s = _session(_current_workdir())
    item = s.txt.find(name)
    if not item:
        raise click.ClickException(f"text '{name}' not found")
    out({"Name": item.Name, "Value": item.Value, "Export": item.Export,
         "Comment": item.Comment or ""}, as_json)


@txt.command("add")
@click.option("-n", "--name", required=True, help="Key (name_/des_ prefix = GID name/description)")
@click.option("-v", "--value", required=True)
@click.option("--comment", default=None)
@click.option("--dry-run", is_flag=True)
@_json_option
def txt_add(name, value, comment, dry_run, as_json):
    """Add a text entry and regenerate outputs (mirrors Add + Save)."""
    s = _session(_current_workdir())
    try:
        result = s.add_text(name, value, comment, dry_run=dry_run)
    except ValueError as e:
        raise click.ClickException(str(e))
    out(result, as_json)


@txt.command("set")
@click.argument("name")
@click.option("-v", "--value", default=None)
@click.option("--rename", "new_name", default=None)
@click.option("--export/--no-export", "export", default=None)
@click.option("--dry-run", is_flag=True)
@_json_option
def txt_set(name, value, new_name, export, dry_run, as_json):
    """Update a text entry and regenerate outputs."""
    s = _session(_current_workdir())
    try:
        result = s.set_text(name, value=value, new_name=new_name, export=export, dry_run=dry_run)
    except (KeyError, ValueError) as e:
        raise click.ClickException(str(e))
    out(result, as_json)


@txt.command("remove")
@click.argument("name")
@click.option("--dry-run", is_flag=True)
@_json_option
def txt_remove(name, dry_run, as_json):
    """Delete a text entry and regenerate outputs (mirrors Delete + Save)."""
    s = _session(_current_workdir())
    try:
        result = s.remove_text(name, dry_run=dry_run)
    except KeyError as e:
        raise click.ClickException(str(e))
    out(result, as_json)


@txt.command("save")
@_json_option
def txt_save(as_json):
    """Write normaltxt.xml + regenerate string_zh_CN.txt (Localization Save)."""
    s = _session(_current_workdir())
    result = s.save_txt()
    out(result, as_json)


# ---------------------------------------------------------------------------
# save / android / merge (main window buttons)
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--release", is_flag=True, help="Also write to OutPut (release); default writes OutPut_Dev")
@_json_option
def save(release: bool, as_json: bool):
    """Save button: write gtypes.xml + regenerate string_zh_CN.txt + APQualityMap.txt."""
    s = _session(_current_workdir())
    result = s.save_all(release=release)
    out(result, as_json)


@cli.group()
def android():
    """Android resource format export and re-import."""


@android.command("format")
@_json_option
def android_format(as_json):
    """Generate android_string.xml + android_string_arr.xml (Android Format button)."""
    s = _session(_current_workdir())
    paths = gen_android(s.workdir, s.txt.items, s.gtypes.items)
    out(paths, as_json)


@android.command("import")
@click.option("-s", "--string-file", required=True, type=click.Path(exists=True, dir_okay=False),
              help="android_string.xml to convert")
@click.option("-a", "--arr-file", required=True, type=click.Path(exists=True, dir_okay=False),
              help="android_string_arr.xml to convert")
@click.option("--arabic", is_flag=True,
              help="Apply Arabic cleanup (GUI checkbox; reshaping not ported — char cleanup only)")
@click.option("-o", "--output-name", default="lua_string.text",
              help="Output lua file name written into OutPut/ [default: lua_string.text]")
@_json_option
def android_import(string_file, arr_file, arabic, output_name, as_json):
    """Convert android XML files back to lua/text (Import Android → Convert To Lua)."""
    s = _session(_current_workdir())
    result = convert_android_to_lua(s.workdir, os.path.abspath(string_file),
                                    os.path.abspath(arr_file), arabic, output_name,
                                    gids_for_apq=s.gtypes.items if output_name == "string_zh_CN.txt" else None)
    out(result, as_json)


@android.command("import-all")
@click.option("--android-dir", default=None, type=click.Path(file_okay=False),
              help="Directory containing per-language subfolders [default: <workdir>/android]")
@_json_option
def android_import_all(android_dir, as_json):
    """Convert every language folder (android/<lang>/) in one pass (GUI batch button)."""
    s = _session(_current_workdir())
    a_dir = os.path.abspath(android_dir) if android_dir else os.path.join(s.workdir, "android")
    if not os.path.isdir(a_dir):
        raise click.ClickException(f"android directory not found: {a_dir}")
    results = import_android_all(s.workdir, a_dir)
    out({"converted": results}, as_json)


@cli.command()
@click.argument("new_dir", type=click.Path(file_okay=False))
@_json_option
def merge(new_dir: str, as_json: bool):
    """Merge Translation: diff current gtypes.xml against a translation folder.

    Writes addlist.xml (GIDs still needing translation) and trangids.xml
    (the incoming translation) into the working directory.
    """
    workdir = _current_workdir()
    result = merge_translation(workdir, os.path.abspath(new_dir))
    if "error" in result:
        raise click.ClickException(str(result["error"]))
    out(result, as_json)


def main() -> None:
    cli(prog_name="cli-anything-gtgenerator")


if __name__ == "__main__":
    main()
