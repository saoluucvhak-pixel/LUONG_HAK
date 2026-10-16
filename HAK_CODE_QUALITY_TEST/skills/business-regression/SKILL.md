---
name: hak-business-regression
description: Regression testing for HAK payroll, weighbridge, payment, accounting and woodchip inventory.
---
# HAK Business Regression
- Build synthetic fixtures with no production personal identifiers or credentials.
- Payroll: gross/net, tax, allowances, overtime, rounding and immutable source rows.
- Payment: parent-child row integrity, no duplicate weighbridge vouchers, idempotent payment finalization, authorization and totals.
- Inventory: MT, BDMT, moisture and dryness are typed units; display precision must not alter stock; test loan/return/transfers.
- Accounting: exact decimal arithmetic, negative amounts, zero/null, dates, multi-currency policies and export parity.
- For every defect: failing fixture, reproduction, root cause, fix, regression assertion and executed evidence.
