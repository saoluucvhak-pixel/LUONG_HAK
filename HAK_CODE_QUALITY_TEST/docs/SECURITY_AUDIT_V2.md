# HAK Security Audit V2

Offline static screening for Python, JS, TS, HTML and Apps Script. Findings include rule, severity, relative path and line number; source snippets and credentials are not written into reports.

Run: `python HAK_CODE_QUALITY_TEST/security_audit.py --root . --out hak-security-results.json`

High-severity findings produce a nonzero exit code. This is a heuristic scanner, not a complete security audit: findings may be false positives, and absence of findings does not imply safety. Human review is required for authentication, authorization, tenant isolation, banking, payroll, and data export flows. Do not commit report files containing internal paths without review.

Planned: data-flow analysis, dependency auditing, threat-model reviews, GitHub Actions integration, Graphify-style dependency maps. No third-party source code is copied.
