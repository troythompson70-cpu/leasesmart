#!/usr/bin/env python3
"""AIWO-007 / AIWO-009 governor regression tests (ERR-ORCH-006 / ERR-ORCH-007)."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from checkpoint import (  # noqa: E402
    ERR_ORCH_006,
    ERR_ORCH_007,
    CheckpointError,
    assert_in_progress_has_fresh_checkpoint,
    assert_worker_cannot_self_verify,
    validate_completion_evidence,
    write_checkpoint,
)
from evidence import evidence_sha256_of, read_back, write_evidence  # noqa: E402
from queue_engine import (  # noqa: E402
    ClaimDenied,
    claim_work_order,
    complete_ready_for_review,
    dependencies_satisfied,
    load_queue,
    queue_lock,
    recover_stale_locks,
    save_queue,
    _is_stale,
)
from state_machine import SelfVerifyForbidden, assert_transition  # noqa: E402

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample_queue.csv"
REPO = Path(__file__).resolve().parents[2]


class Aiwo007GuardTests(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self.root = Path(self._td.name)
        qdir = self.root / "09 AI WORK ORDERS"
        qdir.mkdir(parents=True)
        (self.root / "10 AUDIT & ACTIVITY LOG" / "AGENT EVIDENCE").mkdir(parents=True)
        self.qpath = qdir / "TGT_AI_EXECUTION_QUEUE.csv"
        self.qpath.write_text(FIXTURE.read_text(encoding="utf-8"), encoding="utf-8")
        os.environ.pop("TGT_AGENT_ID", None)

    def tearDown(self):
        os.environ.pop("TGT_AGENT_ID", None)
        self._td.cleanup()

    def test_lock_token_not_leaked_via_spoofed_agent_id(self):
        claimed = claim_work_order(self.qpath, "AIWO-006", owner="Cursor", os_root=self.root)
        token = claimed["lock_token"]
        self.assertTrue(token)
        # Spoof claimed_by identity — must NOT get refresh or token without present_lock_token.
        rows = load_queue(self.qpath)
        six = next(r for r in rows if r["work_order_id"] == "AIWO-006")
        os.environ["TGT_AGENT_ID"] = six["claimed_by"]
        with self.assertRaises(ClaimDenied):
            claim_work_order(self.qpath, "AIWO-006", owner="Cursor", os_root=self.root)
        # With matching token, refresh works.
        refreshed = claim_work_order(
            self.qpath,
            "AIWO-006",
            owner="Cursor",
            os_root=self.root,
            present_lock_token=token,
        )
        self.assertEqual(refreshed["lock_token"], token)

    def test_owner_ai_enforced(self):
        with self.assertRaises(ClaimDenied):
            claim_work_order(self.qpath, "AIWO-007", owner="Cursor", os_root=self.root)

    def test_force_cannot_reclaim_ready_for_review_without_audit_flag(self):
        claimed = claim_work_order(self.qpath, "AIWO-006", owner="Cursor", os_root=self.root)
        ev = write_evidence(self.root, "AIWO-006", "Cursor", {"ok": True})
        complete_ready_for_review(
            self.qpath,
            "AIWO-006",
            lock_token=claimed["lock_token"],
            evidence_location=str(ev),
            last_completed_action="done",
            os_root=self.root,
            evidence_sha256=evidence_sha256_of(ev),
        )
        with self.assertRaises(ClaimDenied):
            claim_work_order(
                self.qpath,
                "AIWO-006",
                owner="Cursor",
                os_root=self.root,
                force=True,
            )
        # Audited reclaim path works.
        reclaimed = claim_work_order(
            self.qpath,
            "AIWO-006",
            owner="Cursor",
            os_root=self.root,
            force=True,
            force_reclaim_review=True,
        )
        self.assertEqual(reclaimed["status"], "IN_PROGRESS")

    def test_stale_honors_future_lock_expires_at(self):
        with queue_lock(self.qpath):
            rows = load_queue(self.qpath)
            row = next(r for r in rows if r["work_order_id"] == "AIWO-006")
            row["status"] = "IN_PROGRESS"
            row["claimed_by"] = "Cursor@zombie:1"
            row["lock_token"] = "zombie"
            # Heartbeat ancient, but lease still in the future.
            row["heartbeat_at"] = "2000-01-01T00:00:00+00:00"
            row["lock_expires_at"] = (
                datetime.now(timezone.utc).astimezone() + timedelta(hours=1)
            ).isoformat(timespec="seconds")
            save_queue(self.qpath, rows)
        rows = load_queue(self.qpath)
        row = next(r for r in rows if r["work_order_id"] == "AIWO-006")
        self.assertFalse(_is_stale(row))
        recovered = recover_stale_locks(rows, os_root=self.root)
        self.assertNotIn("AIWO-006", recovered)

    def test_dependencies_require_verified_not_review(self):
        rows = load_queue(self.qpath)
        seven = next(r for r in rows if r["work_order_id"] == "AIWO-007")
        six = next(r for r in rows if r["work_order_id"] == "AIWO-006")
        for status in ("READY_FOR_REVIEW", "READY_FOR_AUDIT", "COMPLETED"):
            six["status"] = status
            self.assertFalse(dependencies_satisfied(rows, seven), status)
        six["status"] = "VERIFIED"
        self.assertTrue(dependencies_satisfied(rows, seven))

    def test_evidence_sha256_pinned_in_audit(self):
        ev = write_evidence(self.root, "AIWO-006", "Cursor", {"pin": True})
        rb = read_back(ev)
        self.assertEqual(rb["sha256"], evidence_sha256_of(ev))
        audit = (self.root / "10 AUDIT & ACTIVITY LOG" / "AGENT EVIDENCE" / "queue_audit.jsonl").read_text(
            encoding="utf-8"
        )
        self.assertIn("evidence_sha256", audit)
        self.assertIn(evidence_sha256_of(ev), audit)

    def test_complete_rejects_missing_evidence_file(self):
        claimed = claim_work_order(self.qpath, "AIWO-006", owner="Cursor", os_root=self.root)
        with self.assertRaises(ClaimDenied):
            complete_ready_for_review(
                self.qpath,
                "AIWO-006",
                lock_token=claimed["lock_token"],
                evidence_location="/tmp/does-not-exist-aiwo.md",
                last_completed_action="fake",
                os_root=self.root,
            )


class ErrOrch006007Tests(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self.root = Path(self._td.name)
        (self.root / "10 AUDIT & ACTIVITY LOG" / "AGENT EVIDENCE").mkdir(parents=True)

    def tearDown(self):
        self._td.cleanup()

    def test_cp_missing_checkpoint_raises_006(self):
        with self.assertRaises(CheckpointError) as ctx:
            assert_in_progress_has_fresh_checkpoint(
                self.root,
                "AIWO-008",
                heartbeat_at=datetime.now(timezone.utc).astimezone().isoformat(),
            )
        self.assertEqual(ctx.exception.code, ERR_ORCH_006)

    def test_cp_fresh_checkpoint_ok(self):
        write_checkpoint(
            self.root,
            {
                "work_order_id": "AIWO-008",
                "agent": "Cursor",
                "checkpoint_id": "CP-TEST-1",
                "timestamp": datetime.now(timezone.utc).astimezone().isoformat(),
                "current_phase": "TESTING",
                "last_completed_step": "S1",
                "current_step": "S2",
                "next_step": "S3",
                "files_components_touched": ["checkpoint.py"],
                "commands_tests_and_exit_codes": "unittest => 0",
                "evidence_paths": ["n/a"],
                "blockers": "none",
                "rollback_point": "HEAD",
                "resume_instruction": "continue",
                "heartbeat_at": datetime.now(timezone.utc).astimezone().isoformat(),
            },
        )
        path = assert_in_progress_has_fresh_checkpoint(
            self.root,
            "AIWO-008",
            heartbeat_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )
        self.assertTrue(path.exists())

    def test_invalid_commit_evidence_raises_007(self):
        ev = self.root / "ev.md"
        ev.write_text("proof", encoding="utf-8")
        test_path = ROOT / "tests" / "test_aiwo007_009_guards.py"
        with self.assertRaises(CheckpointError) as ctx:
            validate_completion_evidence(
                repo=REPO,
                evidence_paths=[ev],
                test_paths=[test_path],
                commit_sha="9da31d08828bcc8da3c8e8b7a2f40feb875a273a",
                test_commands=[{"command": "true", "exit_code": 0}],
            )
        self.assertEqual(ctx.exception.code, ERR_ORCH_007)

    def test_missing_test_path_raises_007(self):
        ev = self.root / "ev.md"
        ev.write_text("proof", encoding="utf-8")
        with self.assertRaises(CheckpointError) as ctx:
            validate_completion_evidence(
                repo=REPO,
                evidence_paths=[ev],
                test_paths=[self.root / "no-such-test.py"],
                commit_sha="deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
                test_commands=[{"command": "true", "exit_code": 0}],
            )
        self.assertEqual(ctx.exception.code, ERR_ORCH_007)

    def test_worker_self_verify_prohibited(self):
        with self.assertRaises(CheckpointError):
            assert_worker_cannot_self_verify("worker", "VERIFIED")
        with self.assertRaises(SelfVerifyForbidden):
            assert_transition("READY_FOR_REVIEW", "VERIFIED", role="worker")


if __name__ == "__main__":
    unittest.main()
