"""Zero-install launcher for the sr-gtgenerator CLI.

Usage:
    python <skill_dir>/scripts/gtgenerator.py <args...>

Makes the bundled cli_anything package importable from this exact directory
(so tests and docs always match the bundled code, not a stray installed copy),
then invokes the CLI main. `pip install -e` users get the same code via the
`gtgenerator` entry point; the launcher is the fallback that needs no install.

Only third-party dependency: click (`pip install click`).
"""

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from cli_anything.gtgenerator.gtgenerator_cli import main  # noqa: E402

if __name__ == "__main__":
    main()
