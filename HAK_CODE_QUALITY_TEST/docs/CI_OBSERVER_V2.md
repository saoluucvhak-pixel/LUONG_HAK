# HAK Quality Observer V2

Workflow: `.github/workflows/hak-quality-observer-v2.yml`.

Each run generates commit-scoped sanitized QA metadata and proposed regression skills. No source code, log tails, or credentials are copied to memory. Reports are artifacts retained 30 days.

**Important:** GitHub Actions runners are ephemeral. The included memory file contains only the current run unless a separately authorized, secured historical artifact store is configured. Therefore cross-run repeat detection is NOT operational yet. A skill is proposed only when three distinct commit records are actually present in the memory input. No skill is automatically created or executed.

The existing unified workflow may also run on pull requests, causing duplicate CI runs. Consolidation is recommended after verifying the V2 workflow. Do not merge into main until CI is verified.

Run local unit tests:
`python -m unittest discover -s HAK_CODE_QUALITY_TEST/tests -p 'test_*.py' -v`
