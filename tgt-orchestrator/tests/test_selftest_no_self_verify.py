import ast
import io
import json
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import tgt_orchestrator  # noqa: E402


class SelftestNoSelfVerifyTests(unittest.TestCase):
    def test_selftest_source_never_writes_verified(self):
        tree = ast.parse((ROOT / "tgt_orchestrator.py").read_text(encoding="utf-8"))
        fn = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == "cmd_selftest")
        for node in ast.walk(fn):
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
                self.assertNotIn("VERIFIED", str(node.value.value), ast.unparse(node))

    def test_selftest_passes_and_leaves_aiwo006_ready_for_review(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = tgt_orchestrator.cmd_selftest(None)
        self.assertEqual(rc, 0, buf.getvalue())
        out = json.loads(buf.getvalue()[buf.getvalue().index("{"):])
        self.assertEqual(out["selftest"], "PASS")
        self.assertEqual(out["aiwo006"], "READY_FOR_REVIEW")


if __name__ == "__main__":
    unittest.main()
