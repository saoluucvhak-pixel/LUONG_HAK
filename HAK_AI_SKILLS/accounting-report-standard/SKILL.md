---
name: hak-accounting-report-standard
description: Enforce Vietnamese accounting data formats, alignment, and professional Excel/PDF/print layouts in HAK web and offline applications.
---
# HAK Accounting & Reporting Design Standard V1.0

## Mandatory display rules
- Locale: vi-VN. Thousands separator "." and decimal separator ",". Never insert separators in underlying numeric values.
- Numeric values right-aligned, textual values left-aligned, date values centered. IDs (tax codes, CCCD, bank accounts, document codes, phone numbers) are strings, never numbers.
- Dates in every user-facing WebApp/offline screen, Excel and PDF: dd/MM/yyyy; store dates as typed dates or ISO yyyy-MM-dd. Validate actual calendar dates and avoid timezone day shifts.
- General quantities: display at most 2 decimal places; configurable minimum 0 or 2. Monetary VND: 0 decimals by default. Currency-specific precision is explicit. Do not silently round underlying data. Accounting rounding must be deterministic and specified per business rule.
- Negative amounts: -1.250,50 by default; optionally accounting parentheses (1.250,50), consistently within a report. Zero: 0 or dash according to report template, not a mixture.
- Use decimal arithmetic / minor currency units for financial calculations; do not rely on IEEE 754 floats for exact totals.

## Semantic column schema
Every report column must declare:
`key, label, type, align, minWidth, maxWidth, width, wrap, precision, unit, totalMode, sensitive`.
Types: text, code, integer, decimal, money, percent, date, datetime, boolean.
Defaults: text/code left; integer/decimal/money/percent right; date/datetime center.
Do not infer code from numeric-looking strings.

## Table and page layout
1. Report header: legal entity, report title, reporting period, unit, generation timestamp, filter scope.
2. Use consistent type scale and spacing; title 14–18pt, table 9–11pt, notes 8–9pt. Prefer fonts with Vietnamese glyphs.
3. Minimum body row height 20–24px on screen; use content-driven row height for wrapped text, with a sensible maximum and explicit overflow handling. Never overlap cells or clip important content silently.
4. Fixed column widths for codes/dates/numbers; flexible bounded widths for descriptions. Measure text, then apply min/max; overflow wraps or moves to a detail appendix. Avoid arbitrary global shrink-to-fit.
5. Header and footer are separated from table; repeat table header on each printed page. Preserve totals and signatures as intact blocks.
6. A4 portrait for narrow tables; A4 landscape or A3 landscape for wide tables. Set print area, margins, scale, paper size, repeated rows and page numbers. Prefer additional pages to illegible text.
7. Numeric precision, negative notation, grouping and units must match screen, Excel, PDF and print.
8. Use real numeric/date cells in XLSX with number formats, not formatted text. Freeze header, enable autofilter when appropriate, define print titles and print area, set explicit widths/heights, wrap text.
9. Use PDF font embedding/subsetting with Vietnamese support, safe line breaking, measured column widths, and page-break-aware rendering. Never depend on browser default print CSS.
10. Report footer: subtotals, grand totals, notes, optional maker/reviewer/approver signature blocks. Signature placement must follow template and not collide with table or page footer.

## Data and security integrity
- Source data immutable during filtering/formatting/export.
- Same authorized filtered snapshot feeds UI, sums, Excel, PDF and print.
- Display rounding and calculation rounding are separate. Totals derive from unrounded values, then format once, unless a statutory rule explicitly requires per-line rounding.
- Handle blank/null separately from zero; invalid date and NaN must show validation error, never fake zero.
- Prevent spreadsheet formula injection for user-supplied text beginning with =, +, -, @; preserve leading zeros.
- Do not expose sensitive data in exported files beyond user's permissions. Record report version, export timestamp, scope and row count.

## Quality gates
- Numeric tests: 0, negative, 999.995, large numbers, null, nonnumeric, 2-decimal rounding, precision policy.
- Date tests: leap years, 31/02, timezone boundaries, invalid/blank dates.
- Layout tests: long Vietnamese text, 30+ columns, 1/100/10000 rows, mixed font sizes, multipage, narrow screen, print page breaks, repeating header, totals and signatures.
- Visual regression: 1366x768, 1600x900, 1920x1080; A4 portrait/landscape, A3 landscape.
- XLSX/PDF automated checks: numeric cell types, formats, formula safety, sheet titles, no clipping, page count, identical IDs/totals with screen.
- Do not claim layout or calculation verified without executing relevant tests.
