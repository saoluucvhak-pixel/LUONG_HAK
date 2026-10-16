'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFilterAdapter } = require('../src/smart-filter-adapter.js');
const core = require('../../LuongHAK_Offline/core/smart-filter.js');
const adapter = createFilterAdapter(core);
const cfg = {
  fields: [{ key: 'department', type: 'multi', label: 'Phòng ban', match: (row, values) => core.inSet(values, row.department) }],
  matchQ: (row, q) => core.fold(row.name).includes(q),
};
const rows = [
  { id: 1, name: 'Nguyễn Văn A', department: 'Kế toán', permitted: true },
  { id: 2, name: 'Tran Van B', department: 'Kho', permitted: false },
  { id: 3, name: 'Nguyen Thi C', department: 'Kế toán', permitted: true },
];
test('Vietnamese search and permission predicate', () => {
  const s = core.empty(); s.q = 'nguyen';
  const r = adapter.run({ rows, config: cfg, state: s, canRead: x => x.permitted });
  assert.equal(r.ok, true); assert.deepEqual(r.rows.map(x => x.id), [1, 3]);
  assert.equal(r.total, 2);
});
test('multi selection and paging do not mutate source', () => {
  const s = core.empty(); s.sel.department = ['Kế toán'];
  const copy = JSON.stringify(rows);
  const r = adapter.run({ rows, config: cfg, state: s, page: 2, pageSize: 1 });
  assert.equal(r.kept, 2); assert.deepEqual(r.rows.map(x => x.id), [3]);
  assert.equal(JSON.stringify(rows), copy);
});
test('unsupported filters fail closed', () => {
  const s = core.empty(); s.tu = '2026-10-01';
  const r = adapter.run({ rows, config: cfg, state: s });
  assert.equal(r.ok, false); assert.deepEqual(r.unsupported, ['date']);
});
