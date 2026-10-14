// V10.1 — Đối chiếu bản vá trên `main` (bản Google Apps Script) với Electron: KPCĐ NLĐ (d220554, 12/10/2026) và công chuẩn TG3/TG4 (25332f6, 13/09/2026).
// Dữ liệu giả lập. Mục đích: khóa số liệu để không bỏ sót bản vá hoặc tái tạo lỗi đã xử lý.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const { baseDb, staff } = require("../fixtures/build.js");

function tinh(extra, nv, opt) {
  const db = Object.assign(baseDb(), extra || {});
  db.nhansu = [staff(nv)]; db.chamcong = [];
  const kq = E.tinhBangLuong(db, 2026, 9, false, opt || {});
  return { kq, r: kq.bangluong[0], b: kq.bhxh[0] };
}
const BH = (db) => db.dm_baohiem.concat([{ "Mã bảo hiểm": "BH_KPCD.01", "DN.BHXH": 0.175, "DN.BHYT": 0.03, "DN.BHTN": 0.01, "DN.KPCD": 0.02, "NLD.BHXH": 0.08, "NLD.BHYT": 0.015, "NLD.BHTN": 0.01, "NLD.KPCD": 0.005, "Hiệu lực từ": "2025-09-01" }]);

test("U-MAIN-01 KPCĐ NLĐ: lương đóng BH 5.450.000 × 0,5% = 27.250, tách khỏi Cộng BH NLĐ đóng (10,5% = 572.250)", () => {
  const { r, b } = tinh({ dm_baohiem: BH(baseDb()) }, { "Mã tiền lương 1": "CĐ", "Lương thỏa thuận": "10000000", "Lương cơ bản": "5450000", "Mã BHXH": "BH_KPCD.01" });
  assert.equal(r["KPCĐ trừ NLĐ"], 27250);
  assert.equal(b["NLĐ.KPCĐ"], 27250);
  assert.equal(r["BH trừ NLĐ"], 572250);
  assert.equal(b["Cộng BH NLĐ đóng"], 572250, "KPCĐ không được cộng vào Cộng BH NLĐ đóng");
});

test("U-MAIN-02 Thực lĩnh trừ KPCĐ đúng 1 lần; thu nhập chịu thuế đã trừ KPCĐ", () => {
  const { r } = tinh({ dm_baohiem: BH(baseDb()) }, { "Mã tiền lương 1": "CĐ", "Lương thỏa thuận": "10000000", "Lương cơ bản": "5450000", "Mã BHXH": "BH_KPCD.01", "Mã TNCN": "MT00" });
  const cl = r["Tổng thu nhập"] - r["BH trừ NLĐ"] - r["KPCĐ trừ NLĐ"] - r["Truy thu BH"] - r["Thuế TNCN"] - r["Trừ khác"] - r["Tạm ứng"];
  assert.equal(r["Thực lĩnh"], Math.round(cl / 1000) * 1000);
  const khong = tinh({}, { "Mã tiền lương 1": "CĐ", "Lương thỏa thuận": "10000000", "Lương cơ bản": "5450000", "Mã BHXH": "BH00", "Mã TNCN": "MT00" }).r;
  assert.equal(khong["KPCĐ trừ NLĐ"], 0, "mã BH không khai NLD.KPCD → không trừ");
});

test("U-MAIN-03 công chuẩn TG3/TG4 (cách cũ): luôn trừ Chủ nhật rồi trừ thêm N — tháng 31 ngày/4 CN không được ra 31−N", () => {
  // 10/2026 có 31 ngày, 4 Chủ nhật (4,11,18,25) → 27; TG3 = 27−4 = 23; TG4 = 27−2 = 25
  const L = { TG3: { "Mã lương": "TG3", "Cách tính": "Số ngày của tháng - 4" }, TG4: { "Mã lương": "TG4", "Cách tính": "Số ngày của tháng - 2" } };
  assert.equal(E.congChuan(L.TG3, 10, 2026, 0), 23);
  assert.equal(E.congChuan(L.TG4, 10, 2026, 0), 25);
  assert.notEqual(E.congChuan(L.TG3, 10, 2026, 0), 27, "lỗi cũ trên main: 31−4");
});
