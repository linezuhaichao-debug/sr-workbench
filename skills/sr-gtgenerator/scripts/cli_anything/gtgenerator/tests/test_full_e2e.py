"""E2E tests: full CLI workflows on sandboxed copies of the REAL GTGenerator data.

The real directory D:/TimeMachine/planner/策划配置/GTGenerator is never touched —
tests copy gtypes.xml/normaltxt.xml into a temp dir and assert against the
GUI-generated reference outputs (byte-level compatibility).

Run via subprocess against the installed entry point when
CLI_ANYTHING_FORCE_INSTALLED=1 is set (HARNESS spec), else via CliRunner.
"""

from __future__ import annotations

import os
import shutil
import subprocess

import pytest
from click.testing import CliRunner

from cli_anything.gtgenerator.core.repo import GtypesRepo, NormalTxtRepo
from cli_anything.gtgenerator.gtgenerator_cli import cli

REAL_DIR = r"D:\TimeMachine\planner\策划配置\GTGenerator"

CLI_NAME = "cli-anything-gtgenerator"


def _resolve_cli() -> str:
    """HARNESS spec: resolve installed command, skipping CWD."""
    if os.environ.get("CLI_ANYTHING_FORCE_INSTALLED") == "1":
        exe = shutil.which(CLI_NAME)
        assert exe, f"{CLI_NAME} not on PATH"
        return exe
    return ""


@pytest.fixture(scope="module")
def real_data(tmp_path_factory):
    """Copy the real data pair into a sandbox once per module."""
    src = tmp_path_factory.mktemp("gtgen-src")
    for name in ("gtypes.xml", "normaltxt.xml"):
        shutil.copy2(os.path.join(REAL_DIR, name), os.path.join(src, name))
    return src


@pytest.fixture
def sandbox(real_data, tmp_path):
    work = tmp_path / "work"
    shutil.copytree(real_data, work)
    return str(work)


@pytest.fixture
def runner():
    return CliRunner()


def run(runner, sandbox, args):
    result = runner.invoke(cli, ["-d", sandbox] + args, obj={})
    assert result.exit_code == 0, result.output
    return result.output


# ---------------------------------------------------------------------------
# byte-level compatibility with the real GUI-generated files
# ---------------------------------------------------------------------------

def test_gtypes_roundtrip_identical_to_gui(sandbox):
    """Re-serialize the real gtypes.xml through our formatter; must be
    byte-identical to what the GUI last wrote."""
    path = os.path.join(sandbox, "gtypes.xml")
    original = open(path, "rb").read()
    repo = GtypesRepoForTest(sandbox)
    rewritten = repo.reserialized()
    assert rewritten == original


def test_lua_export_matches_gui_reference(sandbox):
    """Our Save output must equal the GUI's OutPut_Dev/string_zh_CN.txt."""
    from cli_anything.gtgenerator.core.exporters import gen_lua

    g = GtypesRepo(sandbox)
    t = NormalTxtRepo(sandbox)
    ours = gen_lua(t.items, g.items).encode("utf-8")
    reference = open(os.path.join(REAL_DIR, "OutPut_Dev", "string_zh_CN.txt"), "rb").read()
    assert ours == reference


def test_apq_export_matches_gui_reference(sandbox):
    from cli_anything.gtgenerator.core.exporters import gen_apq

    g = GtypesRepo(sandbox)
    ours = gen_apq(g.items).encode("utf-8")
    reference = open(os.path.join(REAL_DIR, "OutPut_Dev", "APQualityMap.txt"), "rb").read()
    assert ours == reference


class GtypesRepoForTest(GtypesRepo):
    def reserialized(self) -> bytes:
        from cli_anything.gtgenerator.core import xmlfmt

        return xmlfmt.serialize_gtypes(self.items).encode("utf-8")


# ---------------------------------------------------------------------------
# end-to-end workflows through the CLI
# ---------------------------------------------------------------------------

def test_e2e_create_then_save_workflow(runner, sandbox):
    run(runner, sandbox, ["type", "create", "--main", "Building", "--sub", "House",
                          "-n", "测试房屋", "--comment", "E2E 描述", "--json"])
    out = run(runner, sandbox, ["save", "--json"])
    assert "gtypes" in out
    # file reloaded from disk contains the new entry
    out2 = run(runner, sandbox, ["type", "list", "--search", "测试房屋", "--json"])
    assert "测试房屋" in out2
    # lua output regenerated and contains GID entries
    lua = open(os.path.join(sandbox, "OutPut_Dev", "string_zh_CN.txt"), "rb").read()
    assert "测试房屋".encode("utf-8") in lua


def test_e2e_txt_add_updates_lua(runner, sandbox):
    run(runner, sandbox, ["txt", "add", "-n", "e2e_key", "-v", "端到端", "--json"])
    lua = open(os.path.join(sandbox, "OutPut_Dev", "string_zh_CN.txt"), "rb").read()
    assert b'e2e_key = "\xe7\xab\xaf\xe5\x88\xb0\xe7\xab\xaf",' in lua


def test_e2e_android_format(runner, sandbox):
    run(runner, sandbox, ["android", "format", "--json"])
    s = open(os.path.join(sandbox, "android_string.xml"), "rb").read()
    a = open(os.path.join(sandbox, "android_string_arr.xml"), "rb").read()
    assert s.startswith(b"\xef\xbb\xbf<?xml")
    assert b"<string-array name=\"GID_" in a


def test_e2e_retire_removes_from_lua(runner, sandbox):
    # pick an active GID with a Name
    out = run(runner, sandbox, ["type", "list", "--active", "--limit", "1", "--json"])
    import json

    first = json.loads(out)["shown"][0]
    run(runner, sandbox, ["type", "retire", str(first["ID"]), "--json"])
    # retire only writes gtypes.xml (mirrors GUI); Save regenerates lua outputs
    run(runner, sandbox, ["save", "--json"])
    lua = open(os.path.join(sandbox, "OutPut_Dev", "string_zh_CN.txt"), "rb").read()
    assert f'n{first["ID"]} ='.encode() not in lua


def test_e2e_json_flag_every_command(runner, sandbox):
    """Agent contract: --json must produce parseable JSON on every command."""
    import json

    for args in (
        ["type", "categories"], ["type", "list", "--limit", "2"],
        ["type", "next-id", "Building", "CityHall"],
        ["txt", "list", "--limit", "2"], ["save"],
    ):
        out = run(runner, sandbox, args + ["--json"])
        # commands without structured payload still must not crash; those with
        # dict payload parse as JSON
        try:
            json.loads(out)
        except json.JSONDecodeError:
            raise AssertionError(f"--json output not parseable for {args}: {out!r}")


def test_e2e_subprocess_installed_cli():
    """When CLI_ANYTHING_FORCE_INSTALLED=1, verify the installed command works
    against the sandbox copy (no CWD dependence)."""
    if os.environ.get("CLI_ANYTHING_FORCE_INSTALLED") != "1":
        pytest.skip("set CLI_ANYTHING_FORCE_INSTALLED=1 to test the installed entry point")
    exe = _resolve_cli()
    work = os.environ["CLI_ANYTHING_SANDBOX"]
    r = subprocess.run([exe, "-d", work, "type", "list", "--limit", "1", "--json"],
                       capture_output=True, text=True, check=True)
    import json

    json.loads(r.stdout)
