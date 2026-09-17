"""Evidence write / read-back helpers for TGT automation foundation."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping


def iso_now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def evidence_dir(os_root: Path) -> Path:
    path = os_root / "10 AUDIT & ACTIVITY LOG" / "AGENT EVIDENCE"
    path.mkdir(parents=True, exist_ok=True)
    return path


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


_SHA_CACHE: dict[str, str] = {}


def write_evidence(
    os_root: Path,
    work_order_id: str,
    owner: str,
    payload: Mapping[str, Any] | str,
    *,
    suffix: str = "md",
) -> Path:
    """Write evidence under AGENT EVIDENCE and return absolute path.

    Also appends sha256 into the markdown header so audit can pin the hash at write time.
    """
    dest_dir = evidence_dir(os_root)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = dest_dir / f"{work_order_id}_{owner}_{stamp}.{suffix}"
    if isinstance(payload, Mapping):
        body_core = json.dumps(dict(payload), indent=2, sort_keys=True, default=str)
        core_digest = sha256_text(body_core)
        if suffix == "md":
            body = (
                f"# Evidence — {work_order_id}\n\n"
                f"- owner: `{owner}`\n"
                f"- written_at: `{iso_now()}`\n"
                f"- sha256_payload: `{core_digest}`\n\n"
                f"```json\n{body_core}\n```\n"
            )
        else:
            body = body_core
    else:
        body = str(payload)
    path.write_text(body, encoding="utf-8")
    digest = sha256_text(body)
    _SHA_CACHE[str(path.resolve())] = digest
    # Best-effort audit pin (AIWO-007 fix #7) — hash of final on-disk bytes.
    try:
        from audit_log import append_audit

        append_audit(
            os_root,
            {
                "event": "evidence_written",
                "work_order_id": work_order_id,
                "owner": owner,
                "evidence_location": str(path),
                "evidence_sha256": digest,
            },
        )
    except Exception:
        pass
    return path


def evidence_sha256_of(path: Path) -> str:
    key = str(path.resolve())
    if key in _SHA_CACHE:
        return _SHA_CACHE[key]
    return sha256_text(path.read_text(encoding="utf-8"))


def read_back(path: Path) -> dict[str, Any]:
    """Prove evidence exists and is readable (canonical read-back)."""
    if not path.exists():
        raise FileNotFoundError(f"Evidence missing: {path}")
    text = path.read_text(encoding="utf-8")
    if not text.strip():
        raise ValueError(f"Evidence empty: {path}")
    return {
        "path": str(path),
        "bytes": path.stat().st_size,
        "sha256": sha256_text(text),
        "read_back_at": iso_now(),
        "preview": text[:400],
    }


def relative_to_os(os_root: Path, path: Path) -> str:
    try:
        return str(path.resolve().relative_to(os_root.resolve()))
    except ValueError:
        return str(path)
