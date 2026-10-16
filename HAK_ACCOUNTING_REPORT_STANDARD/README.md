# HAK Accounting & Reporting Standard V1.0

Independent JavaScript package staged for its own GitHub repository. Does **not** import LUONG_HAK or HAK_SMART_FILTER.

## Features
- Vietnamese thousands grouping and decimal precision.
- dd/MM/yyyy date display with calendar validation.
- Type-based column alignment.
- Declarative report column schema and width constraints.
- Accounting/reporting skill: `skill/SKILL.md`.

## Run
```sh
cd HAK_ACCOUNTING_REPORT_STANDARD
npm test
```

## Example
```js
const F = require('./src');
F.formatNumber(1250000.75); // 1.250.000,75
F.formatDateISO('2026-10-16'); // 16/10/2026
F.validateColumns([{key:'amount',label:'Số tiền',type:'money'}]);
```

## Scope
This release is a standalone **formatting foundation**, not yet a PDF/XLSX renderer. Report layout, export parity and visual-regression rules are specified in the skill but require implementing adapters and tests.

## Repository migration
GitHub connection here cannot create a new repository. Create `HAK_ACCOUNTING_REPORT_STANDARD` under the owner account, then copy **only this folder** as the new repo root. No dependency on LUONG_HAK is required. Preserve Git history by recording source branch and commit in the new repository's migration note.
