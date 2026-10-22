"""Approval gates — 24/7 agents must not blindly retry past these.

Watchdog / stale recovery may restart *recoverable* execution failures.
Authentication, payment, MFA, legal, insurance, and owner-approval stops
must remain at the approval point until a human / owner clears them.
Bypassing those gates is forbidden.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Mapping, Optional

# Canonical gate kinds (stored in current_state as APPROVAL_GATE_<KIND>).
GATE_AUTHENTICATION = "AUTHENTICATION"
GATE_PAYMENT = "PAYMENT"
GATE_MFA = "MFA"
GATE_LEGAL = "LEGAL"
GATE_INSURANCE = "INSURANCE"
GATE_OWNER_APPROVAL = "OWNER_APPROVAL"

APPROVAL_GATE_KINDS = frozenset(
    {
        GATE_AUTHENTICATION,
        GATE_PAYMENT,
        GATE_MFA,
        GATE_LEGAL,
        GATE_INSURANCE,
        GATE_OWNER_APPROVAL,
    }
)

# Truthy values for the queue CSV approval_required column.
_APPROVAL_YES = frozenset({"YES", "Y", "TRUE", "1", "REQUIRED", "OWNER"})

# Error / message patterns → gate kind (first match wins).
_GATE_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        GATE_MFA,
        re.compile(
            r"\b(mfa|2fa|multi[-\s]?factor|one[-\s]?time\s+code|otp\s+challenge)\b",
            re.I,
        ),
    ),
    (
        GATE_AUTHENTICATION,
        re.compile(
            r"\b(aadsts\d+|unauthorized|auth(entication|z)?\s*(failed|required|error)|"
            r"login\.microsoftonline|consent\s+required|invalid_client|"
            r"invalid_grant|401\b|403\b.*auth|graph\s*auth|"
            r"missing\s+graph\s*(secret|env|credential)|token\s+(expired|rejected))\b",
            re.I,
        ),
    ),
    (
        GATE_PAYMENT,
        re.compile(
            r"\b(payment|stripe|billing|invoice|card\s+declined|checkout|"
            r"purchase\s+approval|subscription\s+pay)\b",
            re.I,
        ),
    ),
    (
        GATE_INSURANCE,
        re.compile(
            r"\b(insurance|coi\b|certificate\s+of\s+insurance|w-?9\s*\+?\s*coi|"
            r"liability\s+cert)\b",
            re.I,
        ),
    ),
    (
        GATE_LEGAL,
        re.compile(
            r"\b(legal|attorney|counsel|terms\s+of\s+service|contract\s+review|"
            r"nda\s+required|compliance\s+hold)\b",
            re.I,
        ),
    ),
    (
        GATE_OWNER_APPROVAL,
        re.compile(
            r"\b(owner\s*approval|troy\s*go|awaiting\s+owner|approval\s+required|"
            r"pm\s+approval|human\s+approval|do\s+not\s+bypass|"
            r"stop\s+at\s+approval|gate\s*hold)\b",
            re.I,
        ),
    ),
)


@dataclass(frozen=True)
class GateDecision:
    """Result of classifying a failure or queue row for retry policy."""

    is_approval_gate: bool
    kind: Optional[str]
    retryable: bool
    status: str  # WAITING_EXTERNAL | READY | BLOCKED (suggested)
    current_state: str
    next_required_action: str


def normalize_gate_kind(value: str | None) -> Optional[str]:
    if not value:
        return None
    raw = str(value).strip().upper().replace(" ", "_").replace("-", "_")
    if raw.startswith("APPROVAL_GATE_"):
        raw = raw[len("APPROVAL_GATE_") :]
    aliases = {
        "AUTH": GATE_AUTHENTICATION,
        "AUTHENTICATION": GATE_AUTHENTICATION,
        "LOGIN": GATE_AUTHENTICATION,
        "CREDENTIALS": GATE_AUTHENTICATION,
        "PAYMENT": GATE_PAYMENT,
        "BILLING": GATE_PAYMENT,
        "MFA": GATE_MFA,
        "2FA": GATE_MFA,
        "LEGAL": GATE_LEGAL,
        "INSURANCE": GATE_INSURANCE,
        "COI": GATE_INSURANCE,
        "OWNER": GATE_OWNER_APPROVAL,
        "OWNER_APPROVAL": GATE_OWNER_APPROVAL,
        "TROY": GATE_OWNER_APPROVAL,
    }
    kind = aliases.get(raw, raw if raw in APPROVAL_GATE_KINDS else None)
    return kind


def approval_required_flag(row: Mapping[str, str] | None) -> bool:
    if not row:
        return False
    v = str(row.get("approval_required") or "").strip().upper()
    return v in _APPROVAL_YES


def gate_kind_from_row(row: Mapping[str, str] | None) -> Optional[str]:
    if not row:
        return None
    for key in ("approval_gate", "gate_kind", "current_state", "blocker", "last_error"):
        kind = normalize_gate_kind(str(row.get(key) or ""))
        if kind:
            return kind
        text = str(row.get(key) or "")
        if "APPROVAL_GATE_" in text.upper():
            kind = normalize_gate_kind(text.upper().split("APPROVAL_GATE_", 1)[-1].split()[0])
            if kind:
                return kind
    return classify_error_text(
        " ".join(
            str(row.get(k) or "")
            for k in ("blocker", "last_error", "next_required_action", "current_state")
        )
    )


def classify_error_text(error: str | None) -> Optional[str]:
    text = str(error or "").strip()
    if not text:
        return None
    for kind, pattern in _GATE_PATTERNS:
        if pattern.search(text):
            return kind
    return None


def is_approval_gate_row(row: Mapping[str, str] | None) -> bool:
    """True when this work order is parked at an approval gate (do not auto-retry)."""
    if not row:
        return False
    if approval_required_flag(row) and normalize_gate_kind(row.get("current_state")):
        return True
    state = str(row.get("current_state") or "").upper()
    if state.startswith("APPROVAL_GATE"):
        return True
    status = str(row.get("status") or "").strip().upper()
    if status == "WAITING_EXTERNAL" and (
        approval_required_flag(row) or gate_kind_from_row(row)
    ):
        return True
    return False


def classify_failure(
    error: str,
    *,
    gate_kind: str | None = None,
    row: Mapping[str, str] | None = None,
    retryable: bool = True,
    retries: int = 0,
    max_retries: int = 3,
) -> GateDecision:
    """Decide retry vs stop-at-approval for a failed execution.

    Approval gates never return retryable=True — even if the caller asked to retry.
    """
    kind = normalize_gate_kind(gate_kind) or classify_error_text(error)
    if kind is None and row and approval_required_flag(row):
        kind = GATE_OWNER_APPROVAL

    if kind:
        return GateDecision(
            is_approval_gate=True,
            kind=kind,
            retryable=False,
            status="WAITING_EXTERNAL",
            current_state=f"APPROVAL_GATE_{kind}",
            next_required_action=(
                f"Stop at approval — {kind.replace('_', ' ').title()} gate. "
                "Do not auto-retry or bypass. Owner/human must clear before resume."
            ),
        )

    if retryable and retries < max_retries:
        return GateDecision(
            is_approval_gate=False,
            kind=None,
            retryable=True,
            status="READY",
            current_state="RETRY_SCHEDULED",
            next_required_action=f"Automatic retry {retries}/{max_retries} after recoverable failure",
        )

    return GateDecision(
        is_approval_gate=False,
        kind=None,
        retryable=False,
        status="BLOCKED",
        current_state="BLOCKED",
        next_required_action="Owner gate or reroute after max retries / non-retryable failure",
    )
