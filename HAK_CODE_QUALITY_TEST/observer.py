"""Analyze sanitized QA events and suggest (never execute) reusable skills."""
from collections import Counter
from typing import Any

ALLOWED = {"cache", "authorization", "sync", "accounting", "ui", "performance", "export", "regression"}
def suggest(events: list[dict[str, Any]], threshold: int = 3) -> list[dict]:
    if not isinstance(threshold, int) or threshold < 2:
        raise ValueError("threshold must be >= 2")
    counts = Counter()
    examples = {}
    for event in events:
        if not isinstance(event, dict) or event.get("status") != "confirmed":
            continue
        category = event.get("category")
        if category not in ALLOWED:
            continue
        project = event.get("project")
        if not isinstance(project, str) or not project or len(project) > 100:
            continue
        key = (project, category)
        counts[key] += 1
        examples[key] = event.get("commit", "")[:40] if isinstance(event.get("commit"), str) else ""
    return [{"project": project, "category": category, "count": count,
             "proposal": f"Draft a regression skill for {category}",
             "reviewRequired": True, "autoExecute": False, "lastCommit": examples[(project, category)]}
            for (project, category), count in sorted(counts.items()) if count >= threshold]
