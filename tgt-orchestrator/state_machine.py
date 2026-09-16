"""TGT AI work-order state machine (AIWO-006).

No worker may transition into VERIFIED. Only AI Auditor / PM may.
"""

from __future__ import annotations

from typing import FrozenSet, Mapping

# Canonical statuses (governance + bootstrap). Aliases accepted on read.
STATES: FrozenSet[str] = frozenset(
    {
        "NOT_STARTED",
        "READY",
        "CLAIMED",
        "IN_PROGRESS",
        "WAITING",
        "WAITING_EXTERNAL",
        "READY_FOR_REVIEW",
        "REVIEW_FAILED",
        "READY_FOR_AUDIT",
        "VERIFIED",
        "BLOCKED",
        "SUPERSEDED",
        "ACTIVE",  # auditor lane sentinel
        "COMPLETED",  # legacy alias treated like READY_FOR_REVIEW for deps
    }
)

# Worker-allowed transitions (Cursor / Claude / ChatGPT workers).
WORKER_TRANSITIONS: Mapping[str, FrozenSet[str]] = {
    "NOT_STARTED": frozenset({"READY", "WAITING", "SUPERSEDED"}),
    "READY": frozenset({"CLAIMED", "IN_PROGRESS", "WAITING", "SUPERSEDED", "BLOCKED"}),
    "WAITING": frozenset({"READY", "CLAIMED", "IN_PROGRESS", "SUPERSEDED", "BLOCKED"}),
    "WAITING_EXTERNAL": frozenset({"READY", "CLAIMED", "IN_PROGRESS", "BLOCKED", "SUPERSEDED"}),
    "CLAIMED": frozenset({"IN_PROGRESS", "READY", "BLOCKED", "SUPERSEDED"}),
    "IN_PROGRESS": frozenset(
        {
            "READY_FOR_REVIEW",
            "READY_FOR_AUDIT",
            "BLOCKED",
            "WAITING_EXTERNAL",
            "WAITING",
            "IN_PROGRESS",  # heartbeat refresh
        }
    ),
    "BLOCKED": frozenset({"READY", "IN_PROGRESS", "SUPERSEDED", "WAITING"}),
    "REVIEW_FAILED": frozenset({"READY", "IN_PROGRESS", "SUPERSEDED"}),
    "READY_FOR_REVIEW": frozenset({"READY_FOR_AUDIT", "REVIEW_FAILED", "IN_PROGRESS"}),
    "READY_FOR_AUDIT": frozenset({"REVIEW_FAILED", "IN_PROGRESS"}),
    "ACTIVE": frozenset({"ACTIVE", "IN_PROGRESS", "BLOCKED"}),
    "COMPLETED": frozenset({"READY_FOR_REVIEW", "READY_FOR_AUDIT"}),
    "SUPERSEDED": frozenset(),
    "VERIFIED": frozenset(),
}

# Auditor / PM may promote review -> verified (workers must not).
AUDITOR_TRANSITIONS: Mapping[str, FrozenSet[str]] = {
    "READY_FOR_REVIEW": frozenset({"READY_FOR_AUDIT", "VERIFIED", "REVIEW_FAILED", "BLOCKED"}),
    "READY_FOR_AUDIT": frozenset({"VERIFIED", "REVIEW_FAILED", "BLOCKED"}),
    "REVIEW_FAILED": frozenset({"READY", "BLOCKED", "SUPERSEDED"}),
    "VERIFIED": frozenset(),
}

CLAIMABLE = frozenset({"READY", "WAITING", "NOT_STARTED", "BLOCKED"})
TERMINAL_SUCCESS = frozenset({"READY_FOR_REVIEW", "READY_FOR_AUDIT", "VERIFIED", "COMPLETED"})
IN_FLIGHT = frozenset({"CLAIMED", "IN_PROGRESS", "ACTIVE"})


class IllegalTransition(ValueError):
    pass


class SelfVerifyForbidden(PermissionError):
    pass


def normalize_status(status: str | None) -> str:
    if not status:
        return "NOT_STARTED"
    s = status.strip().upper().replace(" ", "_").replace("-", "_")
    aliases = {
        "READY_FOR_AUDIT": "READY_FOR_AUDIT",
        "READYFORAUDIT": "READY_FOR_AUDIT",
        "READY_FOR_REVIEW": "READY_FOR_REVIEW",
        "INPROGRESS": "IN_PROGRESS",
        "NOTSTARTED": "NOT_STARTED",
        "WAITINGEXTERNAL": "WAITING_EXTERNAL",
    }
    return aliases.get(s.replace("_", ""), s) if s.replace("_", "") in aliases else aliases.get(s, s)


def can_transition(from_status: str, to_status: str, *, role: str = "worker") -> bool:
    src = normalize_status(from_status)
    dst = normalize_status(to_status)
    if src == dst and src in IN_FLIGHT:
        return True
    if dst == "VERIFIED" and role == "worker":
        return False
    table = AUDITOR_TRANSITIONS if role in ("auditor", "pm", "ai_auditor") else WORKER_TRANSITIONS
    allowed = table.get(src, frozenset())
    if role in ("auditor", "pm", "ai_auditor"):
        allowed = allowed | WORKER_TRANSITIONS.get(src, frozenset())
    return dst in allowed


def assert_transition(from_status: str, to_status: str, *, role: str = "worker") -> str:
    src = normalize_status(from_status)
    dst = normalize_status(to_status)
    if dst == "VERIFIED" and role == "worker":
        raise SelfVerifyForbidden(
            f"Worker may not mark {src} as VERIFIED; hand off READY_FOR_REVIEW for auditor."
        )
    if not can_transition(src, dst, role=role):
        raise IllegalTransition(f"Illegal transition {src} -> {dst} for role={role}")
    return dst
