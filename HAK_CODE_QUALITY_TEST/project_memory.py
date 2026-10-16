"""Minimal local JSONL QA memory with allowlisted metadata; no source code or PII."""
import json
import pathlib
import re

SAFE_KEYS = ("project", "branch", "commit", "category", "testName", "status", "findingId")
SHA = re.compile(r"^[0-9a-f]{7,40}$")
def sanitize(record):
    if not isinstance(record, dict):
        raise TypeError("Expected object")
    safe = {key: value for key in SAFE_KEYS if isinstance((value := record.get(key)), str)
            and len(value) <= 120 and not any(c in value for c in "\r\n\x00")}
    if not SHA.fullmatch(safe.get("commit", "")):
        raise ValueError("A valid git commit SHA is required")
    if not safe.get("project") or not safe.get("branch"):
        raise ValueError("project and branch are required")
    return {"schemaVersion": 1, **safe}
def append(path, record):
    path = pathlib.Path(path)
    data = sanitize(record)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False) + "\n")
    return data
def load(path, project=None, commit=None):
    path = pathlib.Path(path)
    if not path.exists():
        return []
    result = []
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if (project is None or row.get("project") == project) and (commit is None or row.get("commit") == commit):
            result.append(row)
    return result
