'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/accounting-format.js');
test('Vietnamese numeric grouping and precision', () => {
  assert.equal(F.formatNumber(1250000.75), '1.250.000,75');
  assert.equal(F.formatNumber(1250000), '1.250.000');
  assert.equal(F.formatNumber(-1250.5), '-1.250,5');
  assert.equal(F.formatNumber(null), '');
  assert.equal(F.formatVND(1250000), '1.250.000');
});
test('date and alignment rules', () => {
  assert.equal(F.formatISODate('2026-10-16'), '16/10/2026');
  assert.equal(F.formatISODate('2024-02-29'), '29/02/2024');
  assert.throws(() => F.formatISODate('2026-02-31'));
  assert.equal(F.alignment('money'), 'right');
  assert.equal(F.alignment('text'), 'left');
  assert.equal(F.alignment('date'), 'center');
  assert.equal(F.alignment('code'), 'left');
});
