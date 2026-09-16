#!/usr/bin/env python3
"""TGT Orchestrator — automation foundation (AIWO-006).

Loop:
  365 WORK QUEUE -> CLAIM/LOCK -> HEARTBEAT -> EXECUTE -> EVIDENCE
  -> READY_FOR_REVIEW -> (handoff) -> never self-VERIFIED
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

# Allow running as script from this directory or installed copy.
_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

from evidence import iso_now, read_back, relative_to_os, write_evidence  # noqa: E402
from queue_engine import (  # noqa: E402
    ClaimDenied,
    DuplicateExecution,
    claim_work_order,
    complete_ready_for_review,
    fail_blocked,
    heartbeat,
    load_queue,
    queue_lock,
    recover_stale_locks,
    save_queue,
    select_next_eligible,
)
from audit_log import append_audit  # noqa: E402

HOME = Path.home()


def find_os_root(explicit: Optional[str] = None) -> Path:
    if explicit:
        p = Path(explicit)
        if not p.exists():
            raise SystemExit(f"TGT_OS_NOT_FOUND: {p}")
        return p
    env = os.getenv("TGT_OS_ROOT")
    if env and Path(env).exists():
        return Path(env)
    candidates = []
    for base in [
        HOME / "Library/CloudStorage",
        HOME / "OneDrive",
        HOME / "Documents",
        HOME / "Desktop",
        Path("/workspace/sot"),  # cloud agent mirror of SoT docs
    ]:
        if base.exists():
            candidates += list(base.glob("**/TGT BUSINESS/TGT OPERATING SYSTEM"))
            # Local mirror layout used by cloud agents
            if (base / "09-ai-work-orders").exists() or (base / "09 AI WORK ORDERS").exists():
                candidates.append(base)
    if not candidates:
        raise SystemExit("TGT_OS_NOT_FOUND")
    candidates.sort(key=lambda p: len(str(p)))
    return candidates[0]


def find_repo(explicit: Optional[str] = None) -> Path:
    for key in ("TGT_REPO", "TGT_COMMAND_REPO"):
        env = explicit or os.getenv(key)
        if env and (Path(env) / ".git").exists():
            return Path(env)
    if (Path("/workspace") / ".git").exists():
        return Path("/workspace")
    roots = [
        HOME / "Documents",
        HOME / "Desktop",
        HOME / "Developer",
        HOME / "Projects",
        HOME / "src",
    ]
    scored = []
    for r in roots:
        if not r.exists():
            continue
        for git in r.glob("**/.git"):
            p = git.parent
            name = p.name.lower()
            score = sum(k in name for k in ["tgt", "command", "revenue", "dashboard", "leasesmart"])
            if (p / "package.json").exists():
                score += 1
            if (p / "tgt-orchestrator").exists():
                score += 3
            scored.append((score, len(str(p)), p))
    if not scored:
        raise SystemExit("TGT_REPO_NOT_FOUND_SET_TGT_REPO")
    scored.sort(key=lambda x: (-x[0], x[1]))
    return scored[0][2]


def queue_path_for(os_root: Path) -> Path:
    for rel in (
        "09 AI WORK ORDERS/TGT_AI_EXECUTION_QUEUE.csv",
        "09-ai-work-orders/TGT_AI_EXECUTION_QUEUE.csv",
    ):
        p = os_root / rel
        if p.exists():
            return p
    # Prefer canonical name even if creating later
    return os_root / "09 AI WORK ORDERS" / "TGT_AI_EXECUTION_QUEUE.csv"


def which_cli(name: str) -> Optional[str]:
    return shutil.which(name)


def validate_environment(os_root: Path, repo: Path) -> dict:
    report = {
        "os_root": str(os_root),
        "os_root_exists": os_root.exists(),
        "queue": str(queue_path_for(os_root)),
        "queue_exists": queue_path_for(os_root).exists(),
        "repo": str(repo),
        "repo_git": (repo / ".git").exists(),
        "cursor_cli": which_cli("agent"),
        "claude_cli": which_cli("claude"),
        "python": sys.executable,
        "checked_at": iso_now(),
    }
    return report


def build_prompt(os_root: Path, row: dict) -> str:
    files = []
    for rel in [
        "09 AI WORK ORDERS/TGT_AI_HANDOFF_BOOTSTRAP_PROTOCOL_v1.md",
        "09-ai-work-orders/TGT_AI_HANDOFF_BOOTSTRAP_PROTOCOL_v1.md",
        "10 AUDIT & ACTIVITY LOG/TGT_AI_GOVERNANCE_AND_REDUNDANCY_CONTROL_v1.md",
        "10-audit/TGT_AI_GOVERNANCE_AND_REDUNDANCY_CONTROL_v1.md",
        "11 APP BUILD/CURSOR_COMMAND_CENTER_IMPLEMENTATION_SPEC_v1.md",
        "11-app-build/CURSOR_COMMAND_CENTER_IMPLEMENTATION_SPEC_v1.md",
    ]:
        p = os_root / rel
        if p.exists():
            files.append(f"\n## {rel}\n" + p.read_text(errors="ignore")[:12000])
    return (
        f"You are executing TGT work order {row['work_order_id']} for TGT Technologies Inc.\n"
        f"Objective: {row['objective']}\n"
        f"Next required action: {row['next_required_action']}\n"
        f"Verification criteria: {row['verification_criteria']}\n"
        f"Destination: {row['destination']}\n\n"
        "Rules:\n"
        "- Continue until verification criteria are satisfied or a concrete blocker is proven.\n"
        "- Do not mark your own work VERIFIED.\n"
        "- Run relevant tests.\n"
        "- Do not delete unrelated files, force-push, or expose secrets.\n"
        "- Write evidence and leave status READY_FOR_REVIEW for Claude/AI Auditor.\n"
        + "".join(files)
    )


def run_agent(owner: str, repo: Path, prompt: str) -> Tuple[int, str]:
    if owner == "Cursor":
        bin_name = "agent"
        cmd = ["agent", "-p", prompt, "--output-format", "text"]
    elif owner == "Claude":
        bin_name = "claude"
        cmd = ["claude", "-p", prompt, "--output-format", "text"]
    else:
        return 2, f"Unsupported owner_ai={owner}"
    if not which_cli(bin_name):
        return 127, f"{bin_name} CLI not found on PATH"
    proc = subprocess.run(cmd, cwd=repo, text=True, capture_output=True)
    out = (proc.stdout or "") + "\n--- STDERR ---\n" + (proc.stderr or "")
    return proc.returncode, out


def cmd_validate(_: argparse.Namespace) -> int:
    os_root = find_os_root()
    repo = find_repo()
    report = validate_environment(os_root, repo)
    print(json.dumps(report, indent=2))
    ok = report["os_root_exists"] and report["queue_exists"] and report["repo_git"]
    # CLIs may be missing in cloud; report but only hard-fail if --require-cli
    return 0 if ok else 1


def cmd_recover(args: argparse.Namespace) -> int:
    os_root = find_os_root(args.os_root)
    qpath = queue_path_for(os_root)
    with queue_lock(qpath):
        rows = load_queue(qpath)
        recovered = recover_stale_locks(rows, os_root=os_root)
        save_queue(qpath, rows)
    print(json.dumps({"recovered": recovered}, indent=2))
    return 0


def cmd_claim(args: argparse.Namespace) -> int:
    os_root = find_os_root(args.os_root)
    qpath = queue_path_for(os_root)
    try:
        row = claim_work_order(
            qpath,
            args.work_order_id,
            owner=args.owner,
            os_root=os_root,
            force=args.force,
        )
    except (ClaimDenied, DuplicateExecution, KeyError) as e:
        print(json.dumps({"ok": False, "error": str(e)}), file=sys.stderr)
        return 2
    print(json.dumps({"ok": True, "row": row}, indent=2))
    return 0


def cmd_heartbeat(args: argparse.Namespace) -> int:
    os_root = find_os_root(args.os_root)
    qpath = queue_path_for(os_root)
    try:
        row = heartbeat(
            qpath,
            args.work_order_id,
            lock_token=args.lock_token,
            last_completed_action=args.last_action,
            next_required_action=args.next_action,
            current_state=args.current_state,
            blocker=args.blocker or "",
            os_root=os_root,
        )
    except ClaimDenied as e:
        print(json.dumps({"ok": False, "error": str(e)}), file=sys.stderr)
        return 2
    print(json.dumps({"ok": True, "row": row}, indent=2))
    return 0


def cmd_run_once(args: argparse.Namespace) -> int:
    """Claim next eligible Cursor/Claude work and execute (or dry-run foundation)."""
    os_root = find_os_root(args.os_root)
    repo = find_repo(args.repo)
    qpath = queue_path_for(os_root)
    env_report = validate_environment(os_root, repo)
    append_audit(os_root, {"event": "run_once_start", **env_report})

    with queue_lock(qpath):
        rows = load_queue(qpath)
        recover_stale_locks(rows, os_root=os_root)
        save_queue(qpath, rows)
        nxt = select_next_eligible(rows)

    if not nxt:
        print(json.dumps({"ok": True, "message": "No eligible work", "env": env_report}, indent=2))
        return 0

    wid = nxt["work_order_id"]
    owner = nxt["owner_ai"]
    try:
        claimed = claim_work_order(qpath, wid, owner=owner, os_root=os_root)
    except (ClaimDenied, DuplicateExecution) as e:
        print(json.dumps({"ok": False, "error": str(e), "work_order_id": wid}, indent=2))
        return 2

    lock_token = claimed["lock_token"]
    heartbeat(
        qpath,
        wid,
        lock_token=lock_token,
        last_completed_action="Claim acquired",
        next_required_action="Execute agent",
        current_state="EXECUTING",
        os_root=os_root,
    )

    if args.dry_run or args.foundation_only:
        # Foundation self-test path: do not invoke external CLIs.
        evidence = write_evidence(
            os_root,
            wid,
            owner,
            {
                "mode": "foundation_dry_run",
                "work_order_id": wid,
                "claimed_by": claimed["claimed_by"],
                "env": env_report,
                "note": "Automation foundation claimed/locked/heartbeat without external agent spawn",
            },
        )
        rb = read_back(evidence)
        complete_ready_for_review(
            qpath,
            wid,
            lock_token=lock_token,
            evidence_location=relative_to_os(os_root, evidence),
            last_completed_action="Foundation dry-run claim/lock/heartbeat/evidence complete",
            next_required_action="Claude review of automation foundation",
            os_root=os_root,
        )
        print(
            json.dumps(
                {
                    "ok": True,
                    "work_order_id": wid,
                    "status": "READY_FOR_REVIEW",
                    "evidence": rb,
                },
                indent=2,
            )
        )
        return 0

    prompt = build_prompt(os_root, claimed)
    heartbeat(
        qpath,
        wid,
        lock_token=lock_token,
        last_completed_action="Prompt built",
        next_required_action=f"Run {owner} CLI",
        current_state="AGENT_RUNNING",
        os_root=os_root,
    )
    rc, output = run_agent(owner, repo, prompt)
    evidence = write_evidence(os_root, wid, owner, output, suffix="txt")
    rb = read_back(evidence)
    rel = relative_to_os(os_root, evidence)
    if rc == 0:
        complete_ready_for_review(
            qpath,
            wid,
            lock_token=lock_token,
            evidence_location=rel,
            last_completed_action=f"{owner} execution completed rc=0",
            os_root=os_root,
        )
        status = "READY_FOR_REVIEW"
    else:
        fail_blocked(
            qpath,
            wid,
            lock_token=lock_token,
            error=f"EXECUTION_FAILED_RC_{rc}",
            evidence_location=rel,
            retryable=rc not in (2,),
            os_root=os_root,
        )
        status = "BLOCKED_OR_RETRY"
    print(
        json.dumps(
            {
                "ok": rc == 0,
                "work_order_id": wid,
                "rc": rc,
                "status": status,
                "evidence": rb,
                "env": env_report,
            },
            indent=2,
        )
    )
    return 0 if rc == 0 else 1


def cmd_selftest(args: argparse.Namespace) -> int:
    """Run foundation against an isolated temp queue (no M365 mutation)."""
    import tempfile
    from queue_engine import HANDOFF_PROMOTIONS  # noqa: F401

    fixture = Path(__file__).resolve().parent / "tests" / "fixtures" / "sample_queue.csv"
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        qdir = root / "09 AI WORK ORDERS"
        qdir.mkdir(parents=True)
        (root / "10 AUDIT & ACTIVITY LOG" / "AGENT EVIDENCE").mkdir(parents=True)
        qpath = qdir / "TGT_AI_EXECUTION_QUEUE.csv"
        qpath.write_text(fixture.read_text(encoding="utf-8"), encoding="utf-8")

        # Claim AIWO-006
        claimed = claim_work_order(qpath, "AIWO-006", owner="Cursor", os_root=root)
        assert claimed["lock_token"], "missing lock_token"
        token = claimed["lock_token"]

        # Duplicate claim by another identity must fail while lock valid
        os.environ["TGT_AGENT_ID"] = "Cursor@other:1"
        try:
            claim_work_order(qpath, "AIWO-006", owner="Cursor", os_root=root)
            print("FAIL: duplicate claim allowed")
            return 1
        except ClaimDenied:
            pass
        finally:
            os.environ.pop("TGT_AGENT_ID", None)

        # Heartbeat
        hb = heartbeat(
            qpath,
            "AIWO-006",
            lock_token=token,
            last_completed_action="selftest heartbeat",
            next_required_action="complete",
            current_state="TESTING",
            os_root=root,
        )
        assert hb["current_state"] == "TESTING"

        # Bad token heartbeat
        try:
            heartbeat(qpath, "AIWO-006", lock_token="bogus", os_root=root)
            print("FAIL: bad token accepted")
            return 1
        except ClaimDenied:
            pass

        evidence = write_evidence(
            root,
            "AIWO-006",
            "Cursor",
            {"selftest": True, "at": iso_now()},
        )
        rb = read_back(evidence)
        complete_ready_for_review(
            qpath,
            "AIWO-006",
            lock_token=token,
            evidence_location=relative_to_os(root, evidence),
            last_completed_action="selftest complete",
            os_root=root,
        )
        rows = load_queue(qpath)
        six = next(r for r in rows if r["work_order_id"] == "AIWO-006")
        seven = next(r for r in rows if r["work_order_id"] == "AIWO-007")
        assert six["status"] == "READY_FOR_REVIEW"
        assert seven["status"] == "READY"
        # Duplicate execution prevention
        try:
            claim_work_order(qpath, "AIWO-006", owner="Cursor", os_root=root)
            print("FAIL: terminal duplicate allowed")
            return 1
        except DuplicateExecution:
            pass

        # Stale recovery
        os.environ["TGT_STALE_HEARTBEAT_SECONDS"] = "0"
        # Re-import constants already bound — set heartbeat in past via direct edit
        with queue_lock(qpath):
            rows = load_queue(qpath)
            seven = next(r for r in rows if r["work_order_id"] == "AIWO-007")
            seven["status"] = "IN_PROGRESS"
            seven["claimed_by"] = "Cursor@dead:9"
            seven["claimed_at"] = "2000-01-01T00:00:00+00:00"
            seven["heartbeat_at"] = "2000-01-01T00:00:00+00:00"
            seven["lock_token"] = "deadtoken"
            seven["lock_expires_at"] = "2000-01-01T00:30:00+00:00"
            save_queue(qpath, rows)
        # Force stale by lock_expires_at in the past (independent of env)
        with queue_lock(qpath):
            rows = load_queue(qpath)
            recovered = recover_stale_locks(rows, os_root=root)
            save_queue(qpath, rows)
        assert "AIWO-007" in recovered, recovered
        rows = load_queue(qpath)
        seven = next(r for r in rows if r["work_order_id"] == "AIWO-007")
        assert seven["status"] == "READY"
        assert seven["lock_token"] == ""

        # Failure / retry
        claimed7 = claim_work_order(qpath, "AIWO-007", owner="Claude", os_root=root)
        fail_blocked(
            qpath,
            "AIWO-007",
            lock_token=claimed7["lock_token"],
            error="simulated failure",
            retryable=True,
            os_root=root,
        )
        rows = load_queue(qpath)
        seven = next(r for r in rows if r["work_order_id"] == "AIWO-007")
        assert seven["status"] == "READY"
        assert seven["retry_count"] == "1"

        print(
            json.dumps(
                {
                    "ok": True,
                    "selftest": "PASS",
                    "evidence_read_back": rb,
                    "aiwo006": six["status"],
                    "aiwo007_after_stale_and_retry": seven["status"],
                },
                indent=2,
            )
        )
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="TGT Orchestrator (AIWO-006 foundation)")
    p.add_argument("--os-root", default=None)
    p.add_argument("--repo", default=None)
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("validate").set_defaults(func=cmd_validate)
    sub.add_parser("recover-stale").set_defaults(func=cmd_recover)
    sub.add_parser("selftest").set_defaults(func=cmd_selftest)

    c = sub.add_parser("claim")
    c.add_argument("work_order_id")
    c.add_argument("--owner", default="Cursor")
    c.add_argument("--force", action="store_true")
    c.set_defaults(func=cmd_claim)

    h = sub.add_parser("heartbeat")
    h.add_argument("work_order_id")
    h.add_argument("--lock-token", required=True)
    h.add_argument("--last-action", default=None)
    h.add_argument("--next-action", default=None)
    h.add_argument("--current-state", default=None)
    h.add_argument("--blocker", default=None)
    h.set_defaults(func=cmd_heartbeat)

    r = sub.add_parser("run-once")
    r.add_argument("--dry-run", action="store_true")
    r.add_argument("--foundation-only", action="store_true")
    r.set_defaults(func=cmd_run_once)

    return p


def main(argv: Optional[list] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
