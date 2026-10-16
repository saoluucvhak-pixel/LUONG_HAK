# V2 roadmap and acceptance

P0 (implemented): unified settings for money, quantity, moisture, dryness; 0–6 decimal places; per-column overrides; display only.
P1 (implemented core): Smart Filter V12 typed query AST with AND/OR, operator allowlist, permission scope, deterministic pagination.
P2 (planned): XLSX/PDF report engines with layout measurement, page break rules, Vietnamese fonts, print presets, export parity.
P3 (planned): visual report designer with permissions, schema migrations, audit trail and template versions.

Do not mistake a formatting library for an export engine. No production UI integration or Windows UAT has been completed.
Critical acceptance: same authorized row IDs and totals for UI/XLSX/PDF; no source mutation; no hidden unsupported filter; money calculations must use exact decimal arithmetic; test PDF overflow and XLSX numeric cell types.
