"""Append-only local audit trail for queue mutations."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping


def iso_now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def audit_path(os_root: Path) -> Path:
    path = os_root / "10 AUDIT & ACTIVITY LOG" / "AGENT EVIDENCE" / "queue_audit.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def append_audit(os_root: Path, event: Mapping[str, Any]) -> None:
    record = {"ts": iso_now(), **dict(event)}
    path = audit_path(os_root)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, sort_keys=True, default=str) + "\n")
