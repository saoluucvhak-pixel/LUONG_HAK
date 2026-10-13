"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { classify, summary } = require("../../tools/recon/classify.js");
const R = (ma, khoan, excel, app, ky) => ({ ky: ky || "2025-09", ma, ten: "NV " + ma, mal: "X", khoan, excel, app, diff: Math.round((app - excel) * 100) / 100 });
test("U-RECON-01: khớp hoàn toàn → không có dòng lệch; sản lượng lệch → B; hệ quả không bị tính là lỗi riêng", () => {
  const rows = [R("1", "Lương thời gian", 100, 100), R("1", "Thuế TNCN", 0, 0), R("2", "Lương sản lượng", 1000, 900), R("2", "Tổng thu nhập", 1000, 900), R("2", "Tiền lương còn nhận", 900, 800)];
  const o = classify(rows);
  assert.deepEqual(o.map((x) => x.khoan + ":" + x.cls), ["Lương sản lượng:B", "Tổng thu nhập:(hệ quả)", "Tiền lương còn nhận:(hệ quả)"]);
  assert.equal(summary(rows, o).chuaGiaiThich, 0);
});
test("U-RECON-02: Excel không khấu trừ thuế → E (cần quyết định), không bị gán là lỗi thuật toán", () => {
  const rows = [R("3", "Khấu trừ thuế TNCN", 0, 1314000, "2025-11"), R("3", "Thu nhập còn lại", 29160000, 27846000, "2025-11")];
  const o = classify(rows);
  assert.deepEqual(o.map((x) => x.cls), ["E", "E"]);
});
test("U-RECON-03: chênh không giải thích được phải lộ ra là A? (không tự đánh dấu đã khớp)", () => {
  const o = classify([R("4", "Lương hỗ trợ", 500, 400)]);
  assert.equal(o[0].cls, "A?"); assert.equal(summary([R("4", "Lương hỗ trợ", 500, 400)], o).chuaGiaiThich, 1);
});
test("U-RECON-04: dung sai: 1 VNĐ cho tiền, 0,01 cho tấn", () => {
  assert.equal(classify([R("5", "Lương thời gian", 100, 100.9), R("5", "Sản lượng (tấn)", 10, 10.005)]).length, 0);
  assert.equal(classify([R("5", "Sản lượng (tấn)", 10, 10.2)]).length, 1);
});
