import pathlib
import tempfile
import unittest
from importlib.util import module_from_spec,spec_from_file_location
BASE=pathlib.Path(__file__).resolve().parents[1]
spec=spec_from_file_location("architecture_analyzer",BASE/"architecture_analyzer.py")
module=module_from_spec(spec)
spec.loader.exec_module(module)
class ArchitectureTests(unittest.TestCase):
    def test_python_import_impact(self):
        with tempfile.TemporaryDirectory() as d:
            pathlib.Path(d,"a.py").write_text("import b\n",encoding="utf-8")
            pathlib.Path(d,"b.py").write_text("VALUE=1\n",encoding="utf-8")
            graph=module.analyze(d)
            self.assertEqual(graph["a.py"],["b.py"])
            self.assertEqual(module.impacted(graph,["b.py"]),["a.py","b.py"])
    def test_js_cycle(self):
        with tempfile.TemporaryDirectory() as d:
            pathlib.Path(d,"a.js").write_text("import { b } from './b';\n",encoding="utf-8")
            pathlib.Path(d,"b.js").write_text("import { a } from './a';\n",encoding="utf-8")
            self.assertEqual(len(module.cycles(module.analyze(d))),1)
    def test_no_code_execution(self):
        with tempfile.TemporaryDirectory() as d:
            pathlib.Path(d,"a.py").write_text("raise RuntimeError('must not execute')\n",encoding="utf-8")
            self.assertEqual(module.analyze(d)["a.py"],[])
if __name__=="__main__":unittest.main()
