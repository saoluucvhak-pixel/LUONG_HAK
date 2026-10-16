import pathlib
import tempfile
import unittest
from importlib.util import module_from_spec, spec_from_file_location
BASE=pathlib.Path(__file__).resolve().parents[1]
def load(name):
    spec=spec_from_file_location(name,BASE/(name+".py"))
    module=module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
observer=load("observer")
memory=load("project_memory")
class ObserverMemoryTests(unittest.TestCase):
    def test_observer_requires_confirmed_repeats(self):
        events=[{"project":"LUONG_HAK","category":"cache","status":"confirmed","commit":"abc1234"} for _ in range(3)]
        events.append({"project":"LUONG_HAK","category":"cache","status":"suspected"})
        result=observer.suggest(events)
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]["count"],3)
        self.assertFalse(result[0]["autoExecute"])
    def test_memory_allowlist_and_commit(self):
        with tempfile.TemporaryDirectory() as folder:
            path=pathlib.Path(folder)/"events.jsonl"
            row=memory.append(path,{"project":"LUONG_HAK","branch":"feature/test","commit":"a1b2c3d4","status":"passed","password":"not-allowed"})
            self.assertNotIn("password",row)
            self.assertEqual(len(memory.load(path,commit="a1b2c3d4")),1)
            self.assertEqual(len(memory.load(path,commit="ffffffff")),0)
    def test_invalid_sha_rejected(self):
        with self.assertRaises(ValueError):
            memory.sanitize({"project":"HAK","branch":"main","commit":"wrong"})
if __name__=="__main__":unittest.main()
