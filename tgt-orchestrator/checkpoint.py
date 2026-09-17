"""Progress checkpoint + completion evidence guards (ERR-ORCH-006 / ERR-ORCH-007).

ERR-ORCH-006 — IN_PROGRESS without a fresh checkpoint/heartbeat evidence.
ERR-ORCH-007 — false/unfetchable execution evidence (missing files, bad SHA, bad tests).
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Mapping, Optional, Sequence

from evidence import iso_now, sha256_text

ERR_ORCH_006 = "ERR-ORCH-006"
ERR_ORCH_007 = "ERR-ORCH-007"

REQUIRED_CHECKPOINT_FIELDS = (
    "work_order_id",
    "agent",
    "checkpoint_id",
    "timestamp",
    "current_phase",
    "last_completed_step",
    "current_step",
    "next_step",
    "files_components_touched",
    "commands_tests_and_exit_codes",
    "evidence_paths",
    "blockers",
    "rollback_point",
    "resume_instruction",
    "heartbeat_at",
)


class CheckpointError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


def checkpoint_dir(os_root: Path) -> Path:
    path = os_root / "10 AUDIT & ACTIVITY LOG" / "AGENT EVIDENCE"
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_checkpoint(os_root: Path, payload: Mapping[str, Any]) -> Path:
    missing = [f for f in REQUIRED_CHECKPOINT_FIELDS if f not in payload or payload[f] in (None, "")]
    if missing:
        raise CheckpointError(
            ERR_ORCH_006,
            f"checkpoint missing required fields: {', '.join(missing)}",
        )
    dest = checkpoint_dir(os_root)
    cid = str(payload["checkpoint_id"])
    path = dest / f"{payload['work_order_id']}_CHECKPOINT_{cid}.md"
    body = {
        **dict(payload),
        "written_at": iso_now(),
    }
    text = (
        f"# CHECKPOINT — {payload['work_order_id']}\n\n"
        f"- checkpoint_id: `{cid}`\n"
        f"- written_at: `{body['written_at']}`\n"
        f"- sha256_payload: `{sha256_text(json.dumps(body, sort_keys=True, default=str))}`\n\n"
        f"```json\n{json.dumps(body, indent=2, sort_keys=True, default=str)}\n```\n"
    )
    path.write_text(text, encoding="utf-8")
    return path


def latest_checkpoint(os_root: Path, work_order_id: str) -> Optional[Path]:
    dest = checkpoint_dir(os_root)
    matches = sorted(dest.glob(f"{work_order_id}_CHECKPOINT_*.md"), key=lambda p: p.stat().st_mtime)
    return matches[-1] if matches else None


def _parse_iso(value: str | None) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).strip())
    except ValueError:
        return None


def assert_in_progress_has_fresh_checkpoint(
    os_root: Path,
    work_order_id: str,
    *,
    heartbeat_at: str | None,
    max_age_seconds: int | None = None,
) -> Path:
    """Raise ERR-ORCH-006 if IN_PROGRESS lacks a fresh checkpoint."""
    max_age = max_age_seconds or int(os.getenv("TGT_CHECKPOINT_MAX_AGE_SECONDS", "1800"))
    path = latest_checkpoint(os_root, work_order_id)
    if path is None:
        raise CheckpointError(
            ERR_ORCH_006,
            f"IN_PROGRESS_WITHOUT_PROGRESS_EVIDENCE for {work_order_id}: no checkpoint file",
        )
    text = path.read_text(encoding="utf-8")
    # Prefer embedded heartbeat_at / timestamp from JSON block.
    stamp = None
    m = re.search(r'"heartbeat_at"\s*:\s*"([^"]+)"', text)
    if m:
        stamp = _parse_iso(m.group(1))
    if stamp is None:
        m2 = re.search(r'"timestamp"\s*:\s*"([^"]+)"', text)
        if m2:
            stamp = _parse_iso(m2.group(1))
    if stamp is None:
        stamp = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    now = datetime.now(timezone.utc).astimezone()
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=now.tzinfo)
    if (now - stamp) > timedelta(seconds=max_age):
        raise CheckpointError(
            ERR_ORCH_006,
            f"stale checkpoint for {work_order_id}: age>{max_age}s path={path}",
        )
    hb = _parse_iso(heartbeat_at)
    if hb is None:
        raise CheckpointError(
            ERR_ORCH_006,
            f"IN_PROGRESS for {work_order_id} missing heartbeat_at",
        )
    return path


def git_commit_fetchable(repo: Path, sha: str) -> bool:
    sha = (sha or "").strip()
    if not sha or len(sha) < 7:
        return False
    # Reject known-invalidated placeholder SHAs from prior false evidence.
    if sha.startswith("9da31d0") or sha.startswith("51c11c1"):
        return False
    try:
        local = subprocess.run(
            ["git", "-C", str(repo), "cat-file", "-t", sha],
            capture_output=True,
            text=True,
            check=False,
        )
        if local.returncode == 0 and "commit" in (local.stdout or ""):
            # Also require remote reachability when origin exists.
            remotes = subprocess.run(
                ["git", "-C", str(repo), "remote"],
                capture_output=True,
                text=True,
                check=False,
            )
            if "origin" not in (remotes.stdout or ""):
                return True
            remote = subprocess.run(
                ["git", "-C", str(repo), "fetch", "--dry-run", "origin", sha],
                capture_output=True,
                text=True,
                check=False,
            )
            # dry-run may fail for branchless SHA; fall back to ls-remote / cat-file after fetch attempt
            probe = subprocess.run(
                ["git", "-C", str(repo), "branch", "-r", "--contains", sha],
                capture_output=True,
                text=True,
                check=False,
            )
            if probe.returncode == 0 and (probe.stdout or "").strip():
                return True
            # Object exists locally and was obtained from a real remote-tracking tip earlier.
            # Require that the commit is an ancestor of at least one remote-tracking branch
            # OR that `git rev-parse origin/<branch>` can see it after a targeted fetch.
            fetch = subprocess.run(
                ["git", "-C", str(repo), "fetch", "origin", sha],
                capture_output=True,
                text=True,
                check=False,
            )
            if fetch.returncode == 0:
                return True
            # Accept local object only if it is reachable from refs/remotes/origin/*
            contains = subprocess.run(
                ["git", "-C", str(repo), "merge-base", "--is-ancestor", sha, "HEAD"],
                capture_output=True,
                text=True,
                check=False,
            )
            # Still not enough alone — caller must push. Treat unpushed as NOT fetchable.
            return False
        return False
    except OSError:
        return False


def validate_completion_evidence(
    *,
    repo: Path,
    evidence_paths: Sequence[str | Path],
    test_paths: Sequence[str | Path],
    commit_sha: str,
    test_commands: Sequence[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Raise ERR-ORCH-007 when completion evidence is false/unfetchable."""
    errors: list[str] = []
    for p in evidence_paths:
        path = Path(p)
        if not path.is_file():
            errors.append(f"missing evidence file: {path}")
    for p in test_paths:
        path = Path(p)
        if not path.exists():
            errors.append(f"missing test path: {path}")
    if not git_commit_fetchable(repo, commit_sha):
        errors.append(f"commit SHA not independently fetchable from remote: {commit_sha}")
    if test_commands is not None:
        for cmd in test_commands:
            if "command" not in cmd or "exit_code" not in cmd:
                errors.append(f"test command missing command/exit_code: {cmd}")
            elif int(cmd["exit_code"]) != 0:
                errors.append(
                    f"test command non-zero exit: {cmd['command']} => {cmd['exit_code']}"
                )
    if errors:
        raise CheckpointError(ERR_ORCH_007, "; ".join(errors))
    return {
        "ok": True,
        "commit_sha": commit_sha,
        "evidence_paths": [str(p) for p in evidence_paths],
        "test_paths": [str(p) for p in test_paths],
        "validated_at": iso_now(),
    }


def assert_worker_cannot_self_verify(role: str, target_status: str) -> None:
    if role == "worker" and str(target_status).upper() == "VERIFIED":
        raise CheckpointError(
            ERR_ORCH_007,
            "worker self-VERIFY prohibited",
        )
