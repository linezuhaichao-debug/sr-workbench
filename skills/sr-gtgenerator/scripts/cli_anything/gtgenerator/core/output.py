"""JSON output helper (agent mode) and human output helper."""

from __future__ import annotations

import json
import sys


def out(data, as_json: bool = False, message: str | None = None) -> None:
    if as_json:
        json.dump(data, sys.stdout, ensure_ascii=False, indent=2, default=str)
        sys.stdout.write("\n")
    else:
        if message:
            print(message)
        elif isinstance(data, dict):
            for k, v in data.items():
                print(f"{k}: {v}")
        elif isinstance(data, list):
            for item in data:
                print(_fmt_row(item))
        else:
            print(data)


def _fmt_row(item) -> str:
    if isinstance(item, dict):
        return "  ".join(f"{k}={v}" for k, v in item.items() if v is not None)
    return str(item)
