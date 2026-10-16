"""Evidence-based, non-destructive quality gate. Python 3.10+ standard library."""
from __future__ import annotations
import argparse
import json
import pathlib
import subprocess
import sys
import time

def run_checks(config: dict, root: pathlib.Path) -> dict:
    results = []
    for check in config.get("checks", []):
        name = check["name"]
        command = check["command"]
        if not isinstance(command, list) or not command or not all(isinstance(x, str) for x in command):
            raise ValueError(f"Invalid argv for {name}")
        started = time.monotonic()
        try:
            completed = subprocess.run(command, cwd=root, capture_output=True, text=True, timeout=int(check.get("timeoutSeconds", 120)), shell=False)
            status = "passed" if completed.returncode == 0 else "failed"
            code = completed.returncode
            output = (completed.stdout + "\n" + completed.stderr)[-12000:]
        except subprocess.TimeoutExpired:
            status, code, output = "timeout", None, "Check exceeded configured timeout"
        except OSError as exc:
            status, code, output = "error", None, str(exc)
        results.append({"name": name, "status": status, "exitCode": code, "seconds": round(time.monotonic()-started, 3), "outputTail": output})
    return {"schemaVersion": 1, "project": config.get("project", root.name), "checks": results,
            "passed": sum(r["status"] == "passed" for r in results),
            "failed": sum(r["status"] != "passed" for r in results),
            "verified": bool(results) and all(r["status"] == "passed" for r in results)}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--config", required=True)
    p.add_argument("--root", default=".")
    p.add_argument("--out", default="hak-quality-results.json")
    args = p.parse_args()
    root = pathlib.Path(args.root).resolve()
    config = json.loads(pathlib.Path(args.config).read_text(encoding="utf-8"))
    report = run_checks(config, root)
    pathlib.Path(args.out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("project", "passed", "failed", "verified")}, ensure_ascii=False))
    return 0 if report["verified"] else 1

if __name__ == "__main__":
    sys.exit(main())
