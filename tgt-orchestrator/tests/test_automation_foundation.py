#!/usr/bin/env python3
"""Unit tests for TGT automation foundation (AIWO-006)."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from queue_engine import (  # noqa: E402
    ClaimDenied,
    DuplicateExecution,
    claim_work_order,
    complete_ready_for_review,
    dependencies_satisfied,
    fail_blocked,
    heartbeat,
    load_queue,
    queue_lock,
    recover_stale_locks,
    save_queue,
    select_next_eligible,
    _is_stale,
)
from state_machine import (  # noqa: E402
    IllegalTransition,
    SelfVerifyForbidden,
    assert_transition,
    can_transition,
)
from evidence import read_back, write_evidence  # noqa: E402


FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample_queue.csv"


class StateMachineTests(unittest.TestCase):
    def test_worker_cannot_verify(self):
        self.assertFalse(can_transition("READY_FOR_REVIEW", "VERIFIED", role="worker"))
        with self.assertRaises(SelfVerifyForbidden):
            assert_transition("READY_FOR_REVIEW", "VERIFIED", role="worker")

    def test_auditor_can_verify(self):
        self.assertTrue(can_transition("READY_FOR_AUDIT", "VERIFIED", role="auditor"))

    def test_illegal_transition(self):
        with self.assertRaises(IllegalTransition):
            assert_transition("VERIFIED", "READY", role="worker")


class QueueEngineTests(unittest.TestCase):
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

    def test_claim_lock_heartbeat_complete_handoff(self):
        claimed = claim_work_order(self.qpath, "AIWO-006", owner="Cursor", os_root=self.root)
        self.assertEqual(claimed["status"], "IN_PROGRESS")
        self.assertTrue(claimed["lock_token"])
        token = claimed["lock_token"]

        os.environ["TGT_AGENT_ID"] = "Cursor@intruder:99"
        with self.assertRaises(ClaimDenied):
            claim_work_order(self.qpath, "AIWO-006", owner="Cursor", os_root=self.root)
        os.environ.pop("TGT_AGENT_ID", None)

        hb = heartbeat(
            self.qpath,
            "AIWO-006",
            lock_token=token,
            last_completed_action="unit heartbeat",
            next_required_action="finish",
            current_state="UNIT_TEST",
            os_root=self.root,
        )
        self.assertEqual(hb["current_state"], "UNIT_TEST")

        ev = write_evidence(self.root, "AIWO-006", "Cursor", {"ok": True})
        rb = read_back(ev)
        self.assertGreater(rb["bytes"], 0)

        complete_ready_for_review(
            self.qpath,
            "AIWO-006",
            lock_token=token,
            evidence_location=str(ev),
            last_completed_action="unit complete",
            os_root=self.root,
        )
        rows = load_queue(self.qpath)
        six = next(r for r in rows if r["work_order_id"] == "AIWO-006")
        seven = next(r for r in rows if r["work_order_id"] == "AIWO-007")
        self.assertEqual(six["status"], "READY_FOR_REVIEW")
        self.assertEqual(seven["status"], "READY")

        with self.assertRaises(DuplicateExecution):
            claim_work_order(self.qpath, "AIWO-006", owner="Cursor", os_root=self.root)

    def test_stale_lock_recovery(self):
        with queue_lock(self.qpath):
            rows = load_queue(self.qpath)
            row = next(r for r in rows if r["work_order_id"] == "AIWO-006")
            row["status"] = "IN_PROGRESS"
            row["claimed_by"] = "Cursor@zombie:1"
            row["lock_token"] = "zombie"
            row["heartbeat_at"] = "2000-01-01T00:00:00+00:00"
            row["lock_expires_at"] = "2000-01-01T00:30:00+00:00"
            save_queue(self.qpath, rows)
        with queue_lock(self.qpath):
            rows = load_queue(self.qpath)
            recovered = recover_stale_locks(rows, os_root=self.root)
            save_queue(self.qpath, rows)
        self.assertIn("AIWO-006", recovered)
        rows = load_queue(self.qpath)
        row = next(r for r in rows if r["work_order_id"] == "AIWO-006")
        self.assertEqual(row["status"], "READY")
        self.assertEqual(row["lock_token"], "")

    def test_retry_then_block(self):
        claimed = claim_work_order(self.qpath, "AIWO-006", owner="Cursor", os_root=self.root)
        token = claimed["lock_token"]
        # Force max_retries=1
        with queue_lock(self.qpath):
            rows = load_queue(self.qpath)
            row = next(r for r in rows if r["work_order_id"] == "AIWO-006")
            row["max_retries"] = "1"
            save_queue(self.qpath, rows)
        fail_blocked(
            self.qpath,
            "AIWO-006",
            lock_token=token,
            error="boom",
            retryable=True,
            os_root=self.root,
        )
        rows = load_queue(self.qpath)
        row = next(r for r in rows if r["work_order_id"] == "AIWO-006")
        self.assertEqual(row["status"], "BLOCKED")
        self.assertEqual(row["retry_count"], "1")

    def test_select_next_respects_dependencies(self):
        rows = load_queue(self.qpath)
        # AIWO-007 waiting on AIWO-006 — READY_FOR_REVIEW must NOT unlock (AIWO-007 fix #5)
        nxt = select_next_eligible(rows, owners=("Claude",), order=["AIWO-007"])
        self.assertIsNone(nxt)
        six = next(r for r in rows if r["work_order_id"] == "AIWO-006")
        six["status"] = "READY_FOR_REVIEW"
        self.assertFalse(dependencies_satisfied(rows, next(r for r in rows if r["work_order_id"] == "AIWO-007")))
        nxt = select_next_eligible(rows, owners=("Claude",), order=["AIWO-007"])
        self.assertIsNone(nxt)
        six["status"] = "VERIFIED"
        self.assertTrue(dependencies_satisfied(rows, next(r for r in rows if r["work_order_id"] == "AIWO-007")))
        nxt = select_next_eligible(rows, owners=("Claude",), order=["AIWO-007"])
        self.assertIsNotNone(nxt)
        self.assertEqual(nxt["work_order_id"], "AIWO-007")


if __name__ == "__main__":
    unittest.main()
