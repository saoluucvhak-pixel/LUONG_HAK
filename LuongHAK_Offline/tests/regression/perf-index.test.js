// PERF-01: chỉ mục Mã NV trong hr.js phải cho kết quả GIỐNG HỆT bản quét toàn bảng của 2.0.0-alpha.4
// (lưu nguyên trong baseline_2.0.0-alpha.4/hr.js). Kể cả trường hợp biên: Mã NV kiểu số, trùng ngày hiệu lực, mã lạ.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const HR = require("../../hr.js");
const OLD = require("./baseline_2.0.0-alpha.4/hr.js");
const E = require("../../engine.js");
const { regressionDataset } = require("../fixtures/build.js");

function edgeDb() {
  const db = regressionDataset(60);
  // trùng ngày hiệu lực → dòng sau thắng (latestBy dùng >=): thứ tự dòng phải được giữ
  db.chitiethd.push(Object.assign({}, db.chitiethd[0], { "Lương thỏa thuận": "99000000" }));
  db.thanhtoan.push({ "Mã NV": "NV001", "Số tài khoản": "A", "Hiệu lực từ": "2025-01-01" }, { "Mã NV": "NV001", "Số tài khoản": "B", "Hiệu lực từ": "2025-01-01" });
  // Mã NV kiểu số trên bảng con KHÔNG được khớp với "123" (bản cũ so sánh ===)
  db.nhanvien.push({ "Mã NV": "123", "Họ và tên": "Số", "Trạng thái": "Đang làm việc" });
  db.hopdong.push({ "Mã NV": 123, "Số HĐLĐ": "X", "Ngày vào làm": "2025-01-01" }, { "Mã NV": "123", "Số HĐLĐ": "Y", "Ngày vào làm": "2025-01-01" });
  db.chitiethd.push({ "Mã NV": "123", "Số HĐLĐ": "Y", "Hiệu lực từ": "2025-01-01", "Mã lương": "CĐ", "Lương thỏa thuận": "1000000" }, { "Mã NV": 123, "Số HĐLĐ": "Y", "Hiệu lực từ": "2026-01-01", "Mã lương": "CĐ", "Lương thỏa thuận": "5" });
  // mã lạ
  db.nhanvien.push({ "Mã NV": "__proto__", "Họ và tên": "Lạ", "Trạng thái": "Đang làm việc" }, { "Mã NV": "constructor", "Họ và tên": "Lạ 2" });
  db.dm_phongban.push({ "Mã phòng ban": "__proto__", "Tên phòng ban": "PB lạ" });
  db.congtac = [{ "Mã NV": "NV002", "Từ ngày": "2026-01-01", "Phòng ban": "01.06", "Chức vụ": "8" }];
  return db;
}

test("R-PERF-01 staffForPayroll (có chỉ mục) = bản alpha.4 (quét) cho 3 kỳ, 80 NV + trường hợp biên; bảng lương giống hệt", () => {
  for (const db of [regressionDataset(80), edgeDb()])
    for (const [y, m] of [[2026, 8], [2026, 9], [2026, 10], [2025, 12]]) {
      const a = HR.staffForPayroll(db, y, m), b = OLD.staffForPayroll(db, y, m);
      assert.deepEqual(a, b, y + "-" + m);
      const ka = E.tinhBangLuong(Object.assign({}, db, { nhansu: a.list }), y, m, false), kb = E.tinhBangLuong(Object.assign({}, db, { nhansu: b.list }), y, m, false);
      assert.deepEqual(ka.bangluong, kb.bangluong);
    }
});

test("R-PERF-02 hienHanh có/không chỉ mục = bản alpha.4 cho mọi NV, nhiều ngày; báo cáo nhân sự giống hệt", () => {
  const db = edgeDb(), ix = HR.buildIndex(db);
  for (const asOf of ["2025-06-30", "2026-09-15", "2026-12-31"])
    for (const n of db.nhanvien) {
      const old = OLD.hienHanh(db, n["Mã NV"], asOf);
      assert.deepEqual(HR.hienHanh(db, n["Mã NV"], asOf, ix), old, n["Mã NV"] + " " + asOf);
      assert.deepEqual(HR.hienHanh(db, n["Mã NV"], asOf), old);
    }
  const r = HR.reports(db), o = OLD.reports(db);
  assert.deepEqual(r.hethan(400), o.hethan(400));
  assert.deepEqual(r.tinhhinh(), o.tinhhinh());
  assert.deepEqual(r.nghi(2026), o.nghi(2026));
  assert.deepEqual(r.sinhnhat(9), o.sinhnhat(9));
  assert.deepEqual(r.soLaoDong(), o.soLaoDong());
});

test("R-PERF-03 hiệu năng: dựng danh sách lương 5.000 NV < 200 ms (bản quét alpha.4 ~1 giây)", () => {
  const db = regressionDataset(5000);
  HR.staffForPayroll(db, 2026, 9); // làm nóng JIT
  const t = process.hrtime.bigint(); HR.staffForPayroll(db, 2026, 9);
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  assert.ok(ms < 200, "mất " + Math.round(ms) + " ms");
});
