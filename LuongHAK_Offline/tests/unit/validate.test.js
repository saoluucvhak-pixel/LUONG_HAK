"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("U-DATE10 normDate nhập tay dd/MM/yyyy: năm nhuận, gõ liền, ngày không tồn tại bị từ chối, không lệch múi giờ", () => {
  const V = require("../../core/validate.js");
  assert.equal(V.normDate("29/02/2028"), "2028-02-29");
  assert.equal(V.normDate("29/02/2027"), null);
  assert.equal(V.normDate("31/04/2026"), null);
  assert.equal(V.normDate("1-2-2026"), "2026-02-01");
  assert.equal(V.normDate("01022026"), "2026-02-01");
  assert.equal(V.normDate("30022026"), null);
  assert.equal(V.normDate("2026-12-31"), "2026-12-31");
  assert.equal(V.normDate(""), "");
});
