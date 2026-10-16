import pathlib
import sys
import tempfile
import unittest
from importlib.util import module_from_spec,spec_from_file_location
BASE=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE))
spec=spec_from_file_location("ci_observer",BASE/"ci_observer.py")
module=module_from_spec(spec)
spec.loader.exec_module(module)
from project_memory import load
class CIObserverTests(unittest.TestCase):
    def test_sanitized_memory_and_repeat_commit_count(self):
        with tempfile.TemporaryDirectory() as folder:
            path=pathlib.Path(folder)/"memory.jsonl"
            for sha in ("abcdef1","abcdef2","abcdef3"):
                module.summarize({"checks":[{"name":"regression suite","status":"failed","outputTail":"SECRET"}]},
                                 {"findings":[]},{"cycles":[]},"HAK","feature/test",sha,path)
            rows=load(path)
            self.assertEqual(len(rows),3)
            self.assertNotIn("SECRET",path.read_text())
            events=[{"project":"HAK","category":"regression","status":"confirmed","commit":r["commit"]} for r in rows]
            self.assertEqual(len(module.suggest(events)),1)
    def test_security_finding_does_not_store_source(self):
        with tempfile.TemporaryDirectory() as folder:
            path=pathlib.Path(folder)/"memory.jsonl"
            module.summarize({"checks":[]},{"findings":[{"severity":"high","source":"PASSWORD"}]},
                             {"cycles":[]},"HAK","main","abcdef1",path)
            self.assertNotIn("PASSWORD",path.read_text())
if __name__=="__main__":unittest.main()
