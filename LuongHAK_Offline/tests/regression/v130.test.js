// Kiểm thử hồi quy: so sánh kết quả engine hiện tại với engine v1.3.0 (commit 78a612c, lưu nguyên trong baseline_v1.3.0/)
// Mọi khác biệt phải được phân loại; khác biệt chưa giải thích → test FAIL.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js"), HR = require("../../hr.js");
const E0 = require("./baseline_v1.3.0/engine.js"), HR0 = require("./baseline_v1.3.0/hr.js");
const { regressionDataset } = require("../fixtures/build.js");

function runBoth(db, nam, thang) {
  const sp0 = HR0.staffForPayroll(db, nam, thang), sp = HR.staffForPayroll(db, nam, thang);
  const a = E0.tinhBangLuong(Object.assign({}, db, { nhansu: sp0.list }), nam, thang, false);
  const b = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list }), nam, thang, false);
  return { a, b, sp0, sp };
}

test("bộ dữ liệu chuẩn (80 NV × 3 kỳ, số liệu dạng số thuần): kết quả tiền lương TRÙNG KHỚP 100% với v1.3.0", () => {
  const db = regressionDataset(80);
  let people = 0;
  [[2026, 8], [2026, 9], [2026, 10]].forEach(([y, m]) => {
    const { a, b, sp0, sp } = runBoth(JSON.parse(JSON.stringify(db)), y, m);
    assert.deepEqual(sp.list, sp0.list, "danh sách nhân sự tính lương " + m + "/" + y);
    assert.deepEqual(b.bangluong, a.bangluong, "bảng lương " + m + "/" + y);
    assert.deepEqual(b.bhxh, a.bhxh, "BHXH " + m + "/" + y);
    assert.deepEqual(b.tncn, a.tncn, "TNCN " + m + "/" + y);
    // Cảnh báo: bản mới chỉ được THÊM cảnh báo (có chủ đích), không được mất cảnh báo cũ
    a.canhbao.forEach((w) => assert.ok(b.canhbao.indexOf(w) >= 0, "mất cảnh báo: " + w));
    people += b.bangluong.length;
  });
  assert.ok(people > 200, "bộ dữ liệu đủ lớn: " + people);
});

test("khác biệt CÓ CHỦ ĐÍCH: số tiền nhập dạng VN '500.000' (BUG-002)", () => {
  const db = regressionDataset(10);
  db.psluong = [{ "Ngày hạch toán": "2026-09-28", "Mã NV": "NV001", "Thưởng": "500.000", "Thu nhập khác": "0", "Trừ khác": "0" }];
  const { a, b } = runBoth(db, 2026, 9);
  const ra = a.bangluong.find((r) => r["Mã NV"] === "NV001"), rb = b.bangluong.find((r) => r["Mã NV"] === "NV001");
  assert.equal(ra["Thưởng"], 500, "v1.3.0 hiểu sai thành 500đ");
  assert.equal(rb["Thưởng"], 500000, "bản sửa hiểu đúng 500.000đ");
  // Ngoài NV001, mọi người khác không đổi
  a.bangluong.filter((r) => r["Mã NV"] !== "NV001").forEach((r) => assert.deepEqual(b.bangluong.find((x) => x["Mã NV"] === r["Mã NV"]), r));
});
