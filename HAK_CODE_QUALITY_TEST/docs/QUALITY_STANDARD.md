# HAK Code Quality Standard v1.0

## Design sources (ideas only; no copied third-party source)
- obra/superpowers: RED/GREEN/REFACTOR, systematic debugging, evidence before completion.
- mattpocock/skills: small, composable skills with clear inputs/outputs.
- pbakaus/impeccable: UI audit checklist for typography, spacing, responsive behavior.
- Playwright: repeatable browser flows, screenshots and traces when installed.

## Mandatory gates
1. Discovery: exact repo/branch/commit, dependency manifest, production vs sandbox, data ownership.
2. Reproduce: create a failing test before bug fix, capture stack trace and minimal input.
3. Repair: isolate root cause, avoid global changes, test regression.
4. Verification: execute commands; save JSON result, stdout/stderr, exit code and timestamps.
5. Security: authorization before filtering/export, secrets in code, spreadsheet injection, safe logging.
6. Data: transaction boundaries, concurrency, offline recovery, cache invalidation, idempotent imports.
7. UI: keyboard, focus, clipping, contrast, modal overflow, 1366/1600/1920px desktop, narrow mobile.
8. Accounting: vi-VN separators, dd/MM/yyyy, 0..6 fractional digits, unlimited integer-string display, money/quantity/moisture/dryness, no premature rounding.
9. Exports: row IDs and totals equal the authorized UI snapshot; PDF pagination; XLSX numeric types.
10. Release: P0/P1 issues block; P2 documented; every pass must include actual command evidence.

## Severity
P0: data loss, unauthorized access, wrong financial totals.
P1: reproducible broken critical workflow, corruption or broken exports.
P2: degraded performance, significant UX/layout issue.
P3: minor polish/documentation.

## Evidence contract
Never claim test success based on writing test files. Distinguish Not Run, Passed, Failed, Blocked, Skipped. Static scanner findings are hypotheses until reproduced. Never run destructive tests against live finance/payroll data.

## Modular skills
Use `skill/SKILL.md` for orchestration, `skills/ui-audit/SKILL.md` for visual QA, and `skills/business-regression/SKILL.md` for business invariants.
