#!/usr/bin/env python3
"""Local Graph .env scaffold + Azure Portal breadcrumbs.

Never prints secret values. Never overwrites an existing .env.
Does not mark VERIFIED. Does not open a public RCC tunnel.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXAMPLE = ROOT / ".env.example"
ENV_PATH = ROOT / ".env"

GRAPH_NAMES = [
    "GRAPH_TENANT_ID",
    "GRAPH_CLIENT_ID",
    "GRAPH_CLIENT_SECRET",
    "GRAPH_ACCESS_TOKEN",
    "GRAPH_REFRESH_TOKEN",
]

AZURE_APPS = (
    "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
)
AZURE_OVERVIEW = (
    "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Overview"
)

PLACEHOLDER_RE = re.compile(r"^YOUR_|placeholder|changeme|example", re.I)


def parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        trimmed = raw_line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue
        eq = trimmed.find("=")
        if eq <= 0:
            continue
        key = trimmed[:eq].strip()
        value = trimmed[eq + 1 :].strip().strip("'\"")
        out[key] = value
    return out


def classify(value: str | None) -> str:
    text = (value or "").strip()
    if not text:
        return "MISSING"
    if PLACEHOLDER_RE.search(text):
        return "PLACEHOLDER"
    return "SET"


def open_url(url: str) -> None:
    if sys.platform == "darwin":
        subprocess.Popen(["open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return
    print(f"Open: {url}")


def main() -> int:
    if not EXAMPLE.is_file():
        print("Missing .env.example at repo root.", file=sys.stderr)
        return 1

    if not ENV_PATH.exists():
        shutil.copyfile(EXAMPLE, ENV_PATH)
        print("Created gitignored .env from .env.example (placeholders only).")
    else:
        print(".env already exists — not overwritten.")

    file_env = parse_env_file(ENV_PATH)
    print("Graph env (names only; values never printed):")
    for name in GRAPH_NAMES:
        from_file = classify(file_env.get(name))
        from_proc = classify(os.environ.get(name))
        state = "SET" if from_proc == "SET" else from_file
        print(f"  {name}: {state}")

    print("")
    print("Azure clicks (TGT tenant, not personal MSA):")
    print("  1. Microsoft Entra ID → App registrations → the Graph app for TEAM TGT MSP")
    print("  2. Overview → Directory (tenant) ID → GRAPH_TENANT_ID")
    print("  3. Overview → Application (client) ID → GRAPH_CLIENT_ID")
    print("  4. Certificates & secrets → New client secret → GRAPH_CLIENT_SECRET")
    print("  5. API permissions: Microsoft Graph Sites.Selected (preferred) or Sites.ReadWrite.All")
    print("     Admin grant. Then grant that app access to TEAM TGT MSP")
    print("     Shared Documents/General/TGT REVENUE COMMAND CENTER/")
    print("     00 Lead Intake (write) and 10 Dashboard Feed (read).")
    print("  6. Put the three values in gitignored .env. Do not paste them in chat.")
    print("  7. Reply in Cursor: Graph env is set on the iMac")
    print("")
    open_url(AZURE_OVERVIEW)
    open_url(AZURE_APPS)
    print("Opened Azure Entra overview and App registrations in the browser.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
