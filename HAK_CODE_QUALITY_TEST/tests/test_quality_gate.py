import pathlib
import sys
import tempfile
import unittest
from importlib.util import module_from_spec, spec_from_file_location

MODULE = pathlib.Path(__file__).resolve().parents[1] / "quality_gate.py"
spec = spec_from_file_location("hak_quality_gate", MODULE)
module = module_from_spec(spec)
spec.loader.exec_module(module)

class QualityGateTests(unittest.TestCase):
    def test_success(self):
        with tempfile.TemporaryDirectory() as d:
            r = module.run_checks({"checks":[{"name":"pass","command":[sys.executable,"-c","print('ok')"]}]}, pathlib.Path(d))
            self.assertTrue(r["verified"])
            self.assertEqual(r["passed"],1)
    def test_failure_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            r = module.run_checks({"checks":[{"name":"fail","command":[sys.executable,"-c","raise SystemExit(2)"]}]}, pathlib.Path(d))
            self.assertFalse(r["verified"])
            self.assertEqual(r["failed"],1)
    def test_empty_is_not_verified(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(module.run_checks({"checks":[]},pathlib.Path(d))["verified"])
    def test_missing_command_does_not_crash(self):
        with tempfile.TemporaryDirectory() as d:
            r = module.run_checks({"checks":[{"name":"missing","command":["nonexistent-hak-test-binary"]}]}, pathlib.Path(d))
            self.assertEqual(r["checks"][0]["status"],"error")

if __name__=="__main__":
    unittest.main()
