"""Convert CI quality evidence to sanitized, commit-scoped memory and suggestions."""
from __future__ import annotations
import argparse
import json
import pathlib
from observer import suggest
from project_memory import append, load

CATEGORY_MAP = {"security":"authorization","architecture":"regression"}
def summarize(quality,security,architecture,project,branch,commit,memory_path):
    events=[]
    for check in quality.get("checks",[]):
        status=check.get("status")
        if status not in {"passed","failed","timeout","error"}:
            continue
        name=check.get("name","unnamed")
        category="regression"
        append(memory_path,{"project":project,"branch":branch,"commit":commit,
                            "category":category,"testName":str(name)[:120],"status":status})
        if status!="passed":
            events.append({"project":project,"category":category,"status":"confirmed","commit":commit})
    for label,report in (("security",security),("architecture",architecture)):
        if label=="security":
            findings=report.get("findings",[])
            issues=[f for f in findings if isinstance(f,dict) and f.get("severity")=="high"]
        else:
            issues=report.get("cycles",[])
        for index,_ in enumerate(issues):
            category=CATEGORY_MAP[label]
            append(memory_path,{"project":project,"branch":branch,"commit":commit,
                                "category":category,"testName":label,"status":"failed",
                                "findingId":f"{label}-{index}"})
            events.append({"project":project,"category":category,"status":"confirmed","commit":commit})
    return events
def main():
    p=argparse.ArgumentParser()
    for name in ("quality","security","architecture","project","branch","commit","memory","out"):
        p.add_argument("--"+name,required=True)
    args=p.parse_args()
    def read(path):
        path=pathlib.Path(path)
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    quality,security,architecture=(read(getattr(args,k)) for k in ("quality","security","architecture"))
    memory=pathlib.Path(args.memory)
    current=summarize(quality,security,architecture,args.project,args.branch,args.commit,memory)
    # Only unique findings from different commits count as repeated incidents.
    historical=load(memory,project=args.project)
    unique={}
    for row in historical:
        if row.get("status")!="failed":
            continue
        key=(row.get("commit"),row.get("category"))
        unique[key]={"project":args.project,"category":row.get("category"),"status":"confirmed","commit":row.get("commit")}
    proposals=suggest(list(unique.values()))
    output={"schemaVersion":1,"project":args.project,"commit":args.commit,
            "currentIncidents":len(current),"historicalCommits":len(set(x[0] for x in unique)),
            "proposals":proposals,"approvalRequired":True}
    pathlib.Path(args.out).write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"currentIncidents":len(current),"proposals":len(proposals)}))
if __name__=="__main__":main()
