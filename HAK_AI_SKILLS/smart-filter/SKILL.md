---
name: hak-smart-filter
description: Integrate and improve HAK Smart Filter across HAK Electron and browser apps without changing business calculations.
---
# HAK Smart Filter integration skill

## Source of truth
- Original V10.3: `LuongHAK_Offline/core/smart-filter.js` and `LuongHAK_Offline/ui/smart-filter.js`.
- Existing dependency: `LuongHAK_Offline/ui/filter-popover.js`; styles in `LuongHAK_Offline/style.css`.
- Keep existing production interfaces stable; use adapters instead of rewriting payroll logic.

## Mandatory workflow
1. Inspect target app's state management, data source, rendering, exports, date semantics, permissions, and row identity.
2. Declare one `screenId`, `fields`, `quickFields`, `advancedFields`, `state.get/set`, `onApply`, `onReset`, `dataSource`, `summary`.
3. Define pure `matchQ`, `matchDate`, and each field's `match` function; preserve original records and stable IDs.
4. Apply the same filtered snapshot to displayed rows, counts, aggregates, and exports (Excel/PDF/print). Never calculate payroll or mutate source data when filtering.
5. If a filter is unsupported, surface `unsupported` and block misleading exports or warn explicitly; never silently ignore.
6. Persist named presets per screen and schema version; show dropped/invalid fields when importing a preset.
7. Verify keyboard navigation, focus restoration, ESC/cancel behavior, mobile widths, and Vietnamese diacritic folding.
8. Test 0/1/10k/100k rows, malformed dates, missing values, permission scope, and equality of UI/export totals.

## Upgrade policy
- Core remains JavaScript and works in Node, Electron, browser.
- Python/PySide6 integrations require a separate adapter with parity tests; never claim the JavaScript DOM UI is a native Qt widget.
- For server pagination, filter/sort on the server BEFORE paging; report total matched and total accessible.
- Presets and export scopes are user-specific; don't leak data between accounts.
- Benchmark against V10.3 and document regressions.
- No changes to `main` without review and explicit approval.

## Acceptance
- All existing V10.3 tests pass.
- New adapter and core tests pass.
- Filtering never changes payroll calculation count.
- Same filter produces identical row IDs, totals, and export scopes.
