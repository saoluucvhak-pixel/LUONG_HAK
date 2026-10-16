# HAK Smart Filter — shared package staging

Source: `feature/luong-hak-v10-3-smart-filter-allowance-support` in LUONG_HAK.

This directory is a **staging package**, not yet an independent GitHub repository. The installed GitHub connector can create branches/files but does not expose repository creation.

## Architecture
- Existing V10.3 core: `../LuongHAK_Offline/core/smart-filter.js`
- Existing V10.3 UI: `../LuongHAK_Offline/ui/smart-filter.js`
- Existing popover: `../LuongHAK_Offline/ui/filter-popover.js`
- New portable adapter: `src/smart-filter-adapter.js`
- New tests: `tests/adapter.test.js`
- Integration skill: `../HAK_AI_SKILLS/smart-filter/SKILL.md`

## V11 hardening
- Fail closed on unsupported conditions by default (avoid false totals).
- Stable, deterministic filtering snapshot.
- Permission predicate before user filters.
- Optional stable sorting and pagination applied after filtering.
- Export consumers use exactly the same snapshot.
- No payroll calculations or source mutations.
- No UI rewrite; V10.3 three-layer UI remains authoritative.

## Extracting independent repository
Copy this folder, the three V10.3 files above, and the integration skill to a new `HAK_SMART_FILTER` GitHub repository. Rewrite relative imports and verify licenses/dependencies before release.

## Tests
`node --test HAK_SMART_FILTER/tests/adapter.test.js`
