"""Queue claim / lock / heartbeat / stale recovery / retry / handoff.

Atomic CSV updates via exclusive flock on a sibling .lock file.
"""

from __future__ import annotations

import csv
import fcntl
import os
import socket
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Mapping, Optional

from audit_log import append_audit
from evidence import iso_now, relative_to_os, write_evidence
from state_machine import (
    CLAIMABLE,
    IN_FLIGHT,
    TERMINAL_SUCCESS,
    IllegalTransition,
    SelfVerifyForbidden,
    assert_transition,
    normalize_status,
)

QUEUE_FIELDS = [
    "work_order_id",
    "priority",
    "owner_ai",
    "lane",
    "objective",
    "current_state",
    "last_completed_action",
    "next_required_action",
    "dependencies",
    "approval_required",
    "verification_criteria",
    "destination",
    "status",
    "claimed_by",
    "claimed_at",
    "heartbeat_at",
    "completed_at",
    "evidence_location",
    "audit_status",
    "lock_expires_at",
    "lock_token",
    "retry_count",
    "max_retries",
    "last_error",
    "blocker",
]

DEFAULT_STALE_SECONDS = int(os.getenv("TGT_STALE_HEARTBEAT_SECONDS", "1200"))  # 20 min
DEFAULT_LOCK_SECONDS = int(os.getenv("TGT_LOCK_SECONDS", "1800"))  # 30 min
DEFAULT_MAX_RETRIES = int(os.getenv("TGT_MAX_RETRIES", "3"))

HANDOFF_PROMOTIONS = {
    "AIWO-006": ("AIWO-007", "READY"),
    "AIWO-001": ("AIWO-002", "READY"),
}


class ClaimDenied(RuntimeError):
    pass


class DuplicateExecution(RuntimeError):
    pass


def _parse_ts(value: str | None) -> Optional[datetime]:
    if not value or not str(value).strip():
        return None
    text = str(value).strip()
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def agent_identity(owner: str) -> str:
    host = socket.gethostname()
    pid = os.getpid()
    tag = os.getenv("TGT_AGENT_ID", f"{owner}@{host}:{pid}")
    return tag


@contextmanager
def queue_lock(queue_path: Path) -> Iterator[None]:
    lock_path = queue_path.with_suffix(queue_path.suffix + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+", encoding="utf-8") as lf:
        fcntl.flock(lf.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(lf.fileno(), fcntl.LOCK_UN)


def load_queue(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(path)
    with path.open(newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    # Ensure extended columns exist on every row.
    for row in rows:
        for field in QUEUE_FIELDS:
            row.setdefault(field, "")
    return rows


def save_queue(path: Path, rows: List[Dict[str, str]]) -> None:
    if not rows:
        return
    fieldnames = list(QUEUE_FIELDS)
    # Preserve any unexpected columns from the source file.
    extras: List[str] = []
    for row in rows:
        for k in row.keys():
            if k not in fieldnames and k not in extras:
                extras.append(k)
    fieldnames = fieldnames + extras
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})
    os.replace(tmp, path)


def find_row(rows: Iterable[Mapping[str, str]], work_order_id: str) -> Dict[str, str]:
    for row in rows:
        if row.get("work_order_id") == work_order_id:
            return dict(row)
    raise KeyError(work_order_id)


def _is_stale(row: Mapping[str, str], *, now: Optional[datetime] = None) -> bool:
    now = now or datetime.now(timezone.utc).astimezone()
    status = normalize_status(row.get("status"))
    # ACTIVE is the standing AI Auditor sentinel — do not auto-reclaim it.
    if status == "ACTIVE":
        return False
    if status not in IN_FLIGHT:
        return False
    lock_exp = _parse_ts(row.get("lock_expires_at"))
    if lock_exp and lock_exp.tzinfo is None:
        lock_exp = lock_exp.replace(tzinfo=now.tzinfo)
    if lock_exp and now > lock_exp:
        return True
    hb = _parse_ts(row.get("heartbeat_at")) or _parse_ts(row.get("claimed_at"))
    if hb is None:
        return True
    if hb.tzinfo is None:
        hb = hb.replace(tzinfo=now.tzinfo)
    return (now - hb) > timedelta(seconds=DEFAULT_STALE_SECONDS)


def recover_stale_locks(
    rows: List[Dict[str, str]],
    *,
    os_root: Optional[Path] = None,
) -> List[str]:
    recovered: List[str] = []
    for row in rows:
        if not _is_stale(row):
            continue
        wid = row["work_order_id"]
        prev_owner = row.get("claimed_by") or ""
        row["status"] = "READY"
        row["current_state"] = "STALE_LOCK_RECOVERED"
        row["last_completed_action"] = f"Recovered stale lock from {prev_owner}"
        row["next_required_action"] = "Reclaim and resume from last evidence"
        row["blocker"] = f"STALE_LOCK previous_owner={prev_owner}"
        row["claimed_by"] = ""
        row["lock_token"] = ""
        row["lock_expires_at"] = ""
        row["heartbeat_at"] = iso_now()
        row["audit_status"] = "STALE_RECOVERED"
        recovered.append(wid)
        if os_root:
            append_audit(
                os_root,
                {
                    "event": "stale_lock_recovered",
                    "work_order_id": wid,
                    "previous_owner": prev_owner,
                },
            )
    return recovered


def dependencies_satisfied(rows: List[Dict[str, str]], row: Mapping[str, str]) -> bool:
    deps = (row.get("dependencies") or "").strip()
    if not deps or deps.lower() in {"none", "n/a", "-"}:
        return True
    # Comma-separated work order ids; also accept prose mentioning AIWO-###.
    tokens = []
    for part in deps.replace(";", ",").split(","):
        part = part.strip()
        if part.startswith("AIWO-"):
            tokens.append(part.split()[0])
    by_id = {r["work_order_id"]: r for r in rows}
    for dep in tokens:
        other = by_id.get(dep)
        if not other:
            return False
        if normalize_status(other.get("status")) not in TERMINAL_SUCCESS | {"VERIFIED"}:
            # WAITING reviews may also unblock when READY_FOR_REVIEW
            if normalize_status(other.get("status")) not in {
                "READY_FOR_REVIEW",
                "READY_FOR_AUDIT",
                "COMPLETED",
                "VERIFIED",
            }:
                return False
    return True


def claim_work_order(
    queue_path: Path,
    work_order_id: str,
    *,
    owner: str,
    os_root: Optional[Path] = None,
    force: bool = False,
) -> Dict[str, str]:
    """Atomically claim a work order. Raises ClaimDenied / DuplicateExecution."""
    identity = agent_identity(owner)
    with queue_lock(queue_path):
        rows = load_queue(queue_path)
        recover_stale_locks(rows, os_root=os_root)
        row = next((r for r in rows if r["work_order_id"] == work_order_id), None)
        if row is None:
            raise KeyError(work_order_id)

        status = normalize_status(row.get("status"))
        if status in TERMINAL_SUCCESS and not force:
            raise DuplicateExecution(
                f"{work_order_id} already in terminal state {status}; refusing duplicate execution"
            )

        if status in IN_FLIGHT and not _is_stale(row):
            if row.get("claimed_by") == identity and row.get("lock_token"):
                # Same agent refresh.
                row["heartbeat_at"] = iso_now()
                row["lock_expires_at"] = (
                    datetime.now(timezone.utc).astimezone()
                    + timedelta(seconds=DEFAULT_LOCK_SECONDS)
                ).isoformat(timespec="seconds")
                save_queue(queue_path, rows)
                return dict(row)
            raise ClaimDenied(
                f"{work_order_id} locked by {row.get('claimed_by')} until "
                f"{row.get('lock_expires_at') or row.get('heartbeat_at')}"
            )

        if status not in CLAIMABLE and status not in IN_FLIGHT and not force:
            raise ClaimDenied(f"{work_order_id} status={status} is not claimable")

        if not dependencies_satisfied(rows, row) and not force:
            raise ClaimDenied(f"{work_order_id} dependencies not satisfied: {row.get('dependencies')}")

        assert_transition(status if status not in IN_FLIGHT else "CLAIMED", "IN_PROGRESS", role="worker")

        token = uuid.uuid4().hex
        now = iso_now()
        expires = (
            datetime.now(timezone.utc).astimezone() + timedelta(seconds=DEFAULT_LOCK_SECONDS)
        ).isoformat(timespec="seconds")
        row.update(
            {
                "status": "IN_PROGRESS",
                "current_state": "CLAIMED_LOCKED",
                "claimed_by": identity,
                "claimed_at": now,
                "heartbeat_at": now,
                "lock_token": token,
                "lock_expires_at": expires,
                "last_completed_action": f"Claimed by {identity}",
                "next_required_action": "Execute work order and write evidence",
                "audit_status": "CLAIMED",
                "blocker": "",
            }
        )
        if not row.get("max_retries"):
            row["max_retries"] = str(DEFAULT_MAX_RETRIES)
        if not row.get("retry_count"):
            row["retry_count"] = "0"
        save_queue(queue_path, rows)
        if os_root:
            append_audit(
                os_root,
                {
                    "event": "claimed",
                    "work_order_id": work_order_id,
                    "claimed_by": identity,
                    "lock_token": token,
                },
            )
        return dict(row)


def heartbeat(
    queue_path: Path,
    work_order_id: str,
    *,
    lock_token: str,
    last_completed_action: Optional[str] = None,
    next_required_action: Optional[str] = None,
    current_state: Optional[str] = None,
    blocker: Optional[str] = None,
    os_root: Optional[Path] = None,
) -> Dict[str, str]:
    with queue_lock(queue_path):
        rows = load_queue(queue_path)
        row = next((r for r in rows if r["work_order_id"] == work_order_id), None)
        if row is None:
            raise KeyError(work_order_id)
        if row.get("lock_token") != lock_token:
            raise ClaimDenied(
                f"Heartbeat rejected: lock_token mismatch for {work_order_id} "
                f"(holder={row.get('claimed_by')})"
            )
        now = iso_now()
        row["heartbeat_at"] = now
        row["lock_expires_at"] = (
            datetime.now(timezone.utc).astimezone() + timedelta(seconds=DEFAULT_LOCK_SECONDS)
        ).isoformat(timespec="seconds")
        row["status"] = "IN_PROGRESS"
        if last_completed_action is not None:
            row["last_completed_action"] = last_completed_action
        if next_required_action is not None:
            row["next_required_action"] = next_required_action
        if current_state is not None:
            row["current_state"] = current_state
        if blocker is not None:
            row["blocker"] = blocker
        save_queue(queue_path, rows)
        if os_root:
            append_audit(
                os_root,
                {"event": "heartbeat", "work_order_id": work_order_id, "heartbeat_at": now},
            )
        return dict(row)


def complete_ready_for_review(
    queue_path: Path,
    work_order_id: str,
    *,
    lock_token: str,
    evidence_location: str,
    last_completed_action: str,
    next_required_action: str = "Claude / AI Auditor review",
    os_root: Optional[Path] = None,
) -> Dict[str, str]:
    with queue_lock(queue_path):
        rows = load_queue(queue_path)
        row = next((r for r in rows if r["work_order_id"] == work_order_id), None)
        if row is None:
            raise KeyError(work_order_id)
        if row.get("lock_token") != lock_token:
            raise ClaimDenied("complete rejected: lock_token mismatch")
        try:
            assert_transition(row.get("status") or "IN_PROGRESS", "READY_FOR_REVIEW", role="worker")
        except SelfVerifyForbidden:
            raise
        now = iso_now()
        row.update(
            {
                "status": "READY_FOR_REVIEW",
                "current_state": "READY_FOR_REVIEW",
                "completed_at": now,
                "heartbeat_at": now,
                "evidence_location": evidence_location,
                "last_completed_action": last_completed_action,
                "next_required_action": next_required_action,
                "audit_status": "PENDING_REVIEW",
                "lock_token": "",
                "lock_expires_at": "",
                "blocker": "",
                "last_error": "",
            }
        )
        # Auto-promote dependent review work orders.
        promo = HANDOFF_PROMOTIONS.get(work_order_id)
        if promo:
            dep_id, dep_status = promo
            dep = next((r for r in rows if r["work_order_id"] == dep_id), None)
            if dep is not None:
                dep["status"] = dep_status
                dep["current_state"] = f"AUTO_PROMOTED_AFTER_{work_order_id}"
                dep["next_required_action"] = (
                    f"Review {work_order_id} evidence at {evidence_location}"
                )
                dep["last_completed_action"] = f"Dependency {work_order_id} reached READY_FOR_REVIEW"
                dep["audit_status"] = "PENDING"
        save_queue(queue_path, rows)
        if os_root:
            append_audit(
                os_root,
                {
                    "event": "ready_for_review",
                    "work_order_id": work_order_id,
                    "evidence_location": evidence_location,
                    "promoted": promo[0] if promo else None,
                },
            )
        return dict(row)


def fail_blocked(
    queue_path: Path,
    work_order_id: str,
    *,
    lock_token: str,
    error: str,
    evidence_location: str = "",
    retryable: bool = True,
    os_root: Optional[Path] = None,
) -> Dict[str, str]:
    with queue_lock(queue_path):
        rows = load_queue(queue_path)
        row = next((r for r in rows if r["work_order_id"] == work_order_id), None)
        if row is None:
            raise KeyError(work_order_id)
        if row.get("lock_token") != lock_token:
            raise ClaimDenied("fail rejected: lock_token mismatch")
        retries = int(row.get("retry_count") or "0") + 1
        max_retries = int(row.get("max_retries") or str(DEFAULT_MAX_RETRIES))
        row["retry_count"] = str(retries)
        row["last_error"] = error[:2000]
        row["blocker"] = error[:500]
        row["heartbeat_at"] = iso_now()
        if evidence_location:
            row["evidence_location"] = evidence_location
        if retryable and retries < max_retries:
            row["status"] = "READY"
            row["current_state"] = "RETRY_SCHEDULED"
            row["claimed_by"] = ""
            row["lock_token"] = ""
            row["lock_expires_at"] = ""
            row["next_required_action"] = f"Automatic retry {retries}/{max_retries} after failure"
            row["audit_status"] = f"RETRY_{retries}"
            row["last_completed_action"] = f"Failed (retryable): {error[:200]}"
        else:
            row["status"] = "BLOCKED"
            row["current_state"] = "BLOCKED"
            row["lock_token"] = ""
            row["lock_expires_at"] = ""
            row["next_required_action"] = "Owner gate or reroute after max retries"
            row["audit_status"] = "EXECUTION_FAILED"
            row["last_completed_action"] = f"Failed (blocked): {error[:200]}"
        save_queue(queue_path, rows)
        if os_root:
            append_audit(
                os_root,
                {
                    "event": "failed",
                    "work_order_id": work_order_id,
                    "error": error[:500],
                    "retry_count": retries,
                    "status": row["status"],
                },
            )
        return dict(row)


def mark_superseded_duplicate(
    queue_path: Path,
    work_order_id: str,
    *,
    linked_to: str,
    os_root: Optional[Path] = None,
) -> Dict[str, str]:
    with queue_lock(queue_path):
        rows = load_queue(queue_path)
        row = next((r for r in rows if r["work_order_id"] == work_order_id), None)
        if row is None:
            raise KeyError(work_order_id)
        row["status"] = "SUPERSEDED"
        row["current_state"] = "SUPERSEDED_DUPLICATE"
        row["blocker"] = f"Duplicate of {linked_to}"
        row["next_required_action"] = f"Use existing {linked_to}"
        row["last_completed_action"] = f"Marked SUPERSEDED; linked to {linked_to}"
        row["audit_status"] = "SUPERSEDED"
        row["lock_token"] = ""
        save_queue(queue_path, rows)
        if os_root:
            append_audit(
                os_root,
                {
                    "event": "superseded_duplicate",
                    "work_order_id": work_order_id,
                    "linked_to": linked_to,
                },
            )
        return dict(row)


def select_next_eligible(
    rows: List[Dict[str, str]],
    *,
    owners: Iterable[str] = ("Cursor", "Claude"),
    order: Optional[List[str]] = None,
) -> Optional[Dict[str, str]]:
    recover_stale_locks(rows)
    order = order or ["AIWO-006", "AIWO-007", "AIWO-001", "AIWO-002"]
    by_id = {r["work_order_id"]: r for r in rows}
    for wid in order:
        row = by_id.get(wid)
        if not row:
            continue
        if row.get("owner_ai") not in owners:
            continue
        status = normalize_status(row.get("status"))
        if status not in CLAIMABLE:
            continue
        if not dependencies_satisfied(rows, row):
            continue
        return dict(row)
    return None
