#!/usr/bin/env python3
"""List-store mapping. No network."""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from list_queue import _fields_body, _row_from_item  # noqa: E402
from queue_engine import QUEUE_FIELDS, uses_work_queue_list  # noqa: E402


class ListQueueMapTests(unittest.TestCase):
    def test_round_trip_fields_keep_lock_token_on_the_row(self):
        row = {name: "" for name in QUEUE_FIELDS}
        row["work_order_id"] = "TEST-QUEUE-001"
        row["status"] = "IN_PROGRESS"
        row["lock_token"] = "secret-token"
        body = _fields_body(row)
        self.assertEqual(body["fields"]["Title"], "TEST-QUEUE-001")
        self.assertEqual(body["fields"]["lock_token"], "secret-token")
        loaded = _row_from_item({"id": "9", "fields": body["fields"]})
        self.assertEqual(loaded["work_order_id"], "TEST-QUEUE-001")
        self.assertEqual(loaded["status"], "IN_PROGRESS")
        self.assertEqual(loaded["_item_id"], "9")

    def test_temp_csv_does_not_use_the_list(self):
        os.environ["TGT_QUEUE_BACKEND"] = "list"
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "TGT_AI_EXECUTION_QUEUE.csv"
            path.write_text("work_order_id\n", encoding="utf-8")
            self.assertFalse(uses_work_queue_list(path))


if __name__ == "__main__":
    unittest.main()
