---
name: hak-accounting-report-standard
description: Vietnamese accounting and professional reporting formatting for HAK web, Electron and offline apps.
---
# HAK Accounting & Reporting Standard

- Display numeric values with Vietnamese grouping (1.250.000,75), right aligned; text/code left aligned; dates centered as dd/MM/yyyy.
- General numeric display: at most 2 fractional digits. VND amounts default to 0; currency-specific precision configurable.
- Never convert CCCD, bank accounts, tax codes or voucher IDs into numbers.
- Store typed values, not formatted display strings; never round original data to format the UI. Use exact decimal arithmetic for accounting totals.
- Validate date and number input; blank is not zero.
- Report schema per column: key, label, type, minWidth, maxWidth, wrap, precision, totalMode, sensitivity.
- Reports: entity name, title, date range, unit, scope, timestamp, table header, data, totals, signatures, page numbers.
- Print: A4 portrait/landscape or A3 landscape as needed; repeat headers; prevent clipped cells, overlapping borders, orphan totals or signatures; use measured text and content-driven row heights.
- XLSX: real numeric/date cells, appropriate formats, freeze panes, autofilter, print area/titles, safe strings against formula injection.
- PDF: embedded Vietnamese-compatible font, measured widths, robust wrapping, explicit page breaks.
- Use the same permission-filtered data snapshot for UI, totals, Excel, PDF and print.
- Test 1366x768, 1600x900, 1920x1080; long Vietnamese text, 30 columns, multiple pages, negatives, null, leap days and large numbers.
- Run package tests before integration. Do not claim XLSX/PDF renderers exist until implemented and verified.
