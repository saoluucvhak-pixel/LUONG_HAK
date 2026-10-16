---
name: hak-ui-audit
description: Audit HAK web and offline UI for layout, accessibility, responsiveness and report clipping.
---
# HAK UI Audit
1. Identify UI framework and obtain an actual screenshot at each supported viewport.
2. Inspect horizontal overflow, table columns, date and numeric alignment, modal bounds, focus order, keyboard operation, empty/loading/error states.
3. Use automated browser assertions where browser UI exists; otherwise test native desktop UI separately.
4. Capture before/after screenshots and failing selectors; never report an unexecuted screenshot comparison as passing.
5. Export A4 portrait/landscape and A3 landscape reports and inspect header repeats, signatures, totals and clipped text.
6. Keep visual polish independent of calculation logic and permission checks.
