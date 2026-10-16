# HAK Task Observer and Project Memory v1

## Task Observer
Input: confirmed QA events containing project, category, status, commit.
Counts repeated confirmed categories by project. Default threshold: three.
Output: proposed skill metadata only. **Never auto-generates executable code, edits repository or executes a proposed skill.** A human must review each proposal.

## Project Memory
Local append-only JSONL store with allowlisted fields and required commit SHA. Query by project and exact commit to avoid stale evidence. No code, credentials, free-form comments, documents, or personal identifiers are accepted as fields. Keep storage private and out of Git.

## Security limits
Allowlist is not a complete data-loss prevention solution: callers must use neutral project/test identifiers; do not pass secrets in identifiers. Future production rollout needs OS file permissions, encryption at rest, retention limits, access-control review and event authentication.

## Remaining
No automatic hook into GitHub, issue trackers or CI yet; these are reusable Python modules and unit tests. No third-party Task Observer or Claude Mem code is embedded.
