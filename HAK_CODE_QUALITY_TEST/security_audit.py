"""Conservative offline security scanner for HAK projects (Python 3.10+)."""
from __future__ import annotations
import argparse
import json
import pathlib
import re

RULES = (
 ("SEC001","high","Possible hardcoded credential",re.compile(r"(?i)\b(?:password|api_key|secret_key|access_token)\s*[:=]\s*['\"][^'\"]{8,}['\"]")),
 ("SEC002","high","Dangerous dynamic execution",re.compile(r"\b(?:eval|exec)\s*\(")),
 ("SEC003","medium","Unsafe HTML injection sink",re.compile(r"\.innerHTML\s*=")),
 ("SEC004","medium","TLS certificate verification disabled",re.compile(r"\bverify\s*=\s*False\b")),
 ("SEC005","medium","Potentially unsafe subprocess shell",re.compile(r"\bshell\s*=\s*True\b")),
)
EXTENSIONS={".py",".js",".jsx",".ts",".tsx",".html",".gs"}
SKIP={".git","node_modules","dist","build",".venv","venv","coverage"}
def scan(root: pathlib.Path, max_files=5000, max_bytes=1_000_000):
    root=root.resolve()
    findings=[]
    scanned=0
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in EXTENSIONS or any(part in SKIP for part in path.relative_to(root).parts):
            continue
        if path.is_symlink() or path.stat().st_size > max_bytes:
            continue
        scanned+=1
        if scanned > max_files:
            raise RuntimeError("Scan file limit exceeded")
        for number,line in enumerate(path.read_text(encoding="utf-8",errors="replace").splitlines(),1):
            for rule,severity,description,pattern in RULES:
                if pattern.search(line):
                    findings.append({"rule":rule,"severity":severity,"description":description,"file":str(path.relative_to(root)),"line":number})
    return {"schemaVersion":1,"scannedFiles":scanned,"findings":findings,"high":sum(f["severity"]=="high" for f in findings)}
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--root",default=".")
    p.add_argument("--out",default="hak-security-results.json")
    args=p.parse_args()
    result=scan(pathlib.Path(args.root))
    pathlib.Path(args.out).write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"scannedFiles":result["scannedFiles"],"findings":len(result["findings"]),"high":result["high"]}))
    return 1 if result["high"] else 0
if __name__=="__main__":
    raise SystemExit(main())
