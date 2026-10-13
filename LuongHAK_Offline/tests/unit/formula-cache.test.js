"use strict";
// V8: bộ nhớ đệm AST theo nội dung biểu thức — kết quả y hệt, tự hết hiệu lực khi sửa công thức, không giấu lỗi
const test = require("node:test"), assert = require("node:assert/strict");
const EV = require("../../core/payroll/formula-evaluator.js"), P = require("../../core/payroll/formula-parser.js");

test("U-FCACHE-01 kết quả giống hệt bản parse mỗi lần; lần 2 trở đi là hit", () => {
  EV.clearCache(); const src = "ROUND(LUONG_CB / 26 * NGAY_CONG, 0)", ctx = { LUONG_CB: 9000000, NGAY_CONG: 24.5 };
  const a = EV.evaluate(P.parse(src), ctx), b = EV.evaluate(src, ctx), c = EV.evaluate(src, ctx);
  assert.equal(a, b); assert.equal(b, c); const s = EV.cacheStats(); assert.equal(s.miss, 1); assert.equal(s.hit, 1);
});
test("U-FCACHE-02 sửa biểu thức → khóa mới, không bao giờ dùng AST cũ", () => {
  EV.clearCache(); const ctx = { NGAY_CONG: 10 };
  assert.equal(EV.evaluate("NGAY_CONG * 2", ctx), 20); assert.equal(EV.evaluate("NGAY_CONG * 3", ctx), 30); assert.equal(EV.evaluate("NGAY_CONG * 2", ctx), 20);
  assert.equal(EV.cacheStats().size, 2);
});
test("U-FCACHE-03 lỗi vẫn báo mỗi lần: cú pháp sai không được đệm; thiếu biến / chia 0 vẫn FORMULA error theo từng nhân viên", () => {
  EV.clearCache();
  assert.throws(() => EV.evaluate("1 +", {}), /./); assert.throws(() => EV.evaluate("1 +", {}), /./); assert.equal(EV.cacheStats().size, 0);
  assert.throws(() => EV.evaluate("LUONG_CB / SO_NGAY", { LUONG_CB: 1, SO_NGAY: 0 }), /chia|DIV|0/i);
  assert.equal(EV.evaluate("LUONG_CB / SO_NGAY", { LUONG_CB: 10, SO_NGAY: 5 }), 2); // cùng AST, ngữ cảnh khác → kết quả khác (đệm không giữ giá trị)
});
test("U-FCACHE-04 giới hạn kích thước: không phình quá 2000 mục", () => {
  EV.clearCache(); for (let i = 0; i < 2100; i++) EV.evaluate("NGAY_CONG + " + i, { NGAY_CONG: 1 });
  assert.ok(EV.cacheStats().size <= 2000);
});
