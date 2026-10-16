"""Dependency graph and change impact analyzer; static, no code execution."""
from __future__ import annotations
import argparse
import ast
import json
import pathlib
import re
EXT={".py",".js",".jsx",".ts",".tsx"}
SKIP={".git","node_modules","dist","build",".venv","venv"}
JS_IMPORT=re.compile(r"""(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]""")
def analyze(root):
    root=pathlib.Path(root).resolve()
    files={p.relative_to(root).as_posix():p for p in root.rglob("*") if p.is_file() and p.suffix in EXT and not p.is_symlink() and not set(p.relative_to(root).parts)&SKIP}
    graph={name:set() for name in files}
    for name,path in files.items():
        source=path.read_text(encoding="utf-8",errors="replace")
        imports=[]
        if path.suffix==".py":
            try:
                tree=ast.parse(source)
                for node in ast.walk(tree):
                    if isinstance(node,ast.Import):
                        imports.extend(n.name for n in node.names)
                    elif isinstance(node,ast.ImportFrom) and node.module:
                        imports.append(("."*node.level)+node.module)
            except SyntaxError:
                continue
        else:
            imports=JS_IMPORT.findall(source)
        for imp in imports:
            if path.suffix==".py":
                relative=imp.startswith(".")
                stem=imp.lstrip(".").replace(".","/")
                prefix=path.parent.relative_to(root).as_posix() if relative else ""
                candidates=[str(pathlib.PurePosixPath(prefix)/ (stem+".py")),str(pathlib.PurePosixPath(prefix)/stem/"__init__.py")]
            elif imp.startswith("."):
                base=pathlib.PurePosixPath(name).parent/imp
                candidates=[str(base)+ext for ext in (".js",".jsx",".ts",".tsx")]+[str(base/"index")+ext for ext in (".js",".ts")]
            else:
                continue
            for candidate in candidates:
                normalized=pathlib.PurePosixPath(candidate).as_posix()
                if normalized in files and normalized!=name:
                    graph[name].add(normalized)
                    break
    return {k:sorted(v) for k,v in sorted(graph.items())}
def cycles(graph):
    found=set()
    def visit(node,path):
        if node in path:
            part=path[path.index(node):]
            rotations=[tuple(part[i:]+part[:i]) for i in range(len(part))]
            found.add(min(rotations))
            return
        if len(path)>=len(graph):
            return
        for child in graph.get(node,[]):
            visit(child,path+[node])
    for node in graph:
        visit(node,[])
    return [list(c) for c in sorted(found)]
def impacted(graph,changed):
    reverse={node:set() for node in graph}
    for node,deps in graph.items():
        for dep in deps:
            reverse.setdefault(dep,set()).add(node)
    seen=set(changed)
    todo=list(changed)
    while todo:
        for dependent in reverse.get(todo.pop(),()):
            if dependent not in seen:
                seen.add(dependent)
                todo.append(dependent)
    return sorted(seen)
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--root",default=".")
    parser.add_argument("--changed",action="append",default=[])
    parser.add_argument("--out",default="hak-architecture-results.json")
    args=parser.parse_args()
    graph=analyze(args.root)
    report={"schemaVersion":1,"modules":len(graph),"dependencies":graph,"cycles":cycles(graph),"impacted":impacted(graph,args.changed)}
    pathlib.Path(args.out).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"modules":report["modules"],"cycles":len(report["cycles"]),"impacted":len(report["impacted"])}))
if __name__=="__main__":main()
