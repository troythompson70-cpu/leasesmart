"""Approval gates: watchdog may retry recoverable failures; never bypass gates."""

from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

from approval_gates import (
    GATE_AUTHENTICATION,
    GATE_MFA,
    GATE_OWNER_APPROVAL,
    GATE_PAYMENT,
    classify_error_text,
    classify_failure,
    is_approval_gate_row,
)
from queue_engine import (
    ClaimDenied,
    claim_work_order,
    fail_blocked,
    load_queue,
    queue_lock,
    recover_stale_locks,
    save_queue,
    select_next_eligible,
)


FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample_queue.csv"


class ApprovalGateClassifyTests(unittest.TestCase):
    def test_auth_and_mfa_patterns(self):
        self.assertEqual(
            classify_error_text("AADSTS700016: Application not found"),
            GATE_AUTHENTICATION,
        )
        self.assertEqual(classify_error_text("MFA challenge required"), GATE_MFA)
        self.assertEqual(classify_error_text("Stripe payment declined"), GATE_PAYMENT)
        self.assertEqual(
            classify_error_text("Awaiting owner approval — Troy GO"),
            GATE_OWNER_APPROVAL,
        )

    def test_recoverable_stays_retryable(self):
        d = classify_failure("boom timeout", retryable=True, retries=1, max_retries=3)
        self.assertFalse(d.is_approval_gate)
        self.assertTrue(d.retryable)
        self.assertEqual(d.status, "READY")

    def test_approval_overrides_retryable_true(self):
        d = classify_failure(
            "Graph auth failed: invalid_client",
            retryable=True,
            retries=0,
            max_retries=5,
        )
        self.assertTrue(d.is_approval_gate)
        self.assertFalse(d.retryable)
        self.assertEqual(d.status, "WAITING_EXTERNAL")
        self.assertEqual(d.kind, GATE_AUTHENTICATION)


class ApprovalGateQueueTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="tgt-gates-"))
        self.root = self.tmp / "os"
        self.root.mkdir()
        self.qpath = self.tmp / "queue.csv"
        shutil.copy(FIXTURE, self.qpath)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_fail_auth_stops_without_retry(self):
        claimed = claim_work_order(self.qpath, "AIWO-006", owner="Cursor", os_root=self.root)
        out = fail_blocked(
            self.qpath,
            "AIWO-006",
            lock_token=claimed["lock_token"],
            error="Unauthorized — Graph auth failed (AADSTS700016)",
            retryable=True,
            os_root=self.root,
        )
        self.assertEqual(out["status"], "WAITING_EXTERNAL")
        self.assertTrue(out["current_state"].startswith("APPROVAL_GATE_"))
        self.assertEqual(out["approval_required"], "YES")
        self.assertNotEqual(out["current_state"], "RETRY_SCHEDULED")

    def test_select_next_skips_approval_gate(self):
        claimed = claim_work_order(self.qpath, "AIWO-006", owner="Cursor", os_root=self.root)
        fail_blocked(
            self.qpath,
            "AIWO-006",
            lock_token=claimed["lock_token"],
            error="MFA required before mailbox access",
            retryable=True,
            os_root=self.root,
        )
        rows = load_queue(self.qpath)
        nxt = select_next_eligible(rows, owners=("Cursor",), order=["AIWO-006", "AIWO-001"])
        # AIWO-006 parked at MFA; AIWO-001 still depends on AIWO-006 VERIFIED → none
        self.assertIsNone(nxt)
        six = next(r for r in rows if r["work_order_id"] == "AIWO-006")
        self.assertTrue(is_approval_gate_row(six))

    def test_claim_denied_while_waiting_external(self):
        claimed = claim_work_order(self.qpath, "AIWO-006", owner="Cursor", os_root=self.root)
        fail_blocked(
            self.qpath,
            "AIWO-006",
            lock_token=claimed["lock_token"],
            error="Payment authorization required",
            retryable=True,
            os_root=self.root,
        )
        with self.assertRaises(ClaimDenied):
            claim_work_order(self.qpath, "AIWO-006", owner="Cursor", os_root=self.root)

    def test_stale_recover_holds_approval_gate(self):
        claimed = claim_work_order(self.qpath, "AIWO-006", owner="Cursor", os_root=self.root)
        fail_blocked(
            self.qpath,
            "AIWO-006",
            lock_token=claimed["lock_token"],
            error="COI / insurance packet required before paid work",
            retryable=True,
            os_root=self.root,
        )
        # Simulate a bad state: in-flight again while still marked approval gate
        with queue_lock(self.qpath):
            rows = load_queue(self.qpath)
            row = next(r for r in rows if r["work_order_id"] == "AIWO-006")
            row["status"] = "IN_PROGRESS"
            row["claimed_by"] = "Cursor@zombie:1"
            row["lock_token"] = "zombie"
            row["heartbeat_at"] = "2000-01-01T00:00:00+00:00"
            row["lock_expires_at"] = "2000-01-01T00:30:00+00:00"
            row["approval_required"] = "YES"
            row["current_state"] = "APPROVAL_GATE_INSURANCE"
            save_queue(self.qpath, rows)
        with queue_lock(self.qpath):
            rows = load_queue(self.qpath)
            recover_stale_locks(rows, os_root=self.root)
            save_queue(self.qpath, rows)
        row = next(r for r in load_queue(self.qpath) if r["work_order_id"] == "AIWO-006")
        self.assertEqual(row["status"], "WAITING_EXTERNAL")
        self.assertNotEqual(row["status"], "READY")
        self.assertTrue(is_approval_gate_row(row))


if __name__ == "__main__":
    unittest.main()
