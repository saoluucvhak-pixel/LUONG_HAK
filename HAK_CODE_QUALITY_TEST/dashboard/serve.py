"""Local-only HAK QA dashboard server. Python 3.10+, no third-party packages."""
from __future__ import annotations
import argparse
import http.server
import json
import pathlib
import re
from urllib.parse import urlsplit

BASE = pathlib.Path(__file__).resolve().parent
REPORT_NAMES = {"hak-quality-results.json","hak-security-results.json",
                "hak-architecture-results.json","hak-skill-proposals.json"}
MAX_SIZE = 5_000_000

def collect(directory: pathlib.Path):
    result = []
    if not directory.is_dir():
        return result
    for file in sorted(directory.rglob("*.json")):
        if file.name not in REPORT_NAMES or file.is_symlink():
            continue
        if len(file.relative_to(directory).parts)>4 or file.stat().st_size>MAX_SIZE:
            continue
        try:
            obj=json.loads(file.read_text(encoding="utf-8"))
            if not isinstance(obj,dict):
                continue
            result.append({"name":file.name,"folder":file.parent.relative_to(directory).as_posix(),
                           "report":obj})
        except (OSError,ValueError,UnicodeError):
            continue
    return result[:500]

def handler_factory(reports: pathlib.Path):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self,*args,**kwargs):
            super().__init__(*args,directory=str(BASE),**kwargs)
        def do_GET(self):
            if urlsplit(self.path).path=="/api/reports":
                body=json.dumps({"reports":collect(reports)},ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type","application/json; charset=utf-8")
                self.send_header("Cache-Control","no-store")
                self.send_header("Content-Length",str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                super().do_GET()
    return Handler

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--reports",default=str(BASE/"reports"))
    p.add_argument("--port",type=int,default=8765)
    args=p.parse_args()
    if not 1024<=args.port<=65535:
        p.error("port must be between 1024 and 65535")
    reports=pathlib.Path(args.reports).resolve()
    with http.server.ThreadingHTTPServer(("127.0.0.1",args.port),handler_factory(reports)) as server:
        print(f"Open http://127.0.0.1:{args.port}/auto.html")
        print(f"Reading JSON reports from {reports}")
        server.serve_forever()
if __name__=="__main__":
    main()
