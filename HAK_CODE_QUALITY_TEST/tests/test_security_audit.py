import pathlib
import tempfile
import unittest
from importlib.util import module_from_spec, spec_from_file_location
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=spec_from_file_location("security_audit",ROOT/"security_audit.py")
module=module_from_spec(spec)
spec.loader.exec_module(module)
class SecurityAuditTests(unittest.TestCase):
    def test_flags_dynamic_execution_without_leaking_source(self):
        with tempfile.TemporaryDirectory() as d:
            pathlib.Path(d,"app.py").write_text("eval(user_input)\n",encoding="utf-8")
            report=module.scan(pathlib.Path(d))
            self.assertEqual(report["high"],1)
            self.assertNotIn("eval(user_input)",str(report))
    def test_ignores_build_folders(self):
        with tempfile.TemporaryDirectory() as d:
            build=pathlib.Path(d,"node_modules")
            build.mkdir()
            (build/"app.js").write_text("eval(input)",encoding="utf-8")
            self.assertEqual(module.scan(pathlib.Path(d))["scannedFiles"],0)
    def test_detects_tls_bypass(self):
        with tempfile.TemporaryDirectory() as d:
            pathlib.Path(d,"api.py").write_text("requests.get(url, verify=False)",encoding="utf-8")
            self.assertEqual(module.scan(pathlib.Path(d))["findings"][0]["rule"],"SEC004")
if __name__=="__main__":unittest.main()
