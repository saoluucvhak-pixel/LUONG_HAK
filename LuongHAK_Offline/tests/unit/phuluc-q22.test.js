// Q-22 (chủ sở hữu duyệt 11/10/2026, R-56): chọn cách áp dụng phụ lục hiệu lực giữa tháng — số kỳ vọng TÍNH TAY
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const HR = require("../../hr.js");
const { baseDb, ccRow } = require("../fixtures/build.js");

// Tháng 9/2026: Chủ nhật 6, 13, 20, 27 → ngày làm 1–15: 13 ngày (trừ 6, 13); 16–30: 13 ngày (trừ 20, 27); công chuẩn TG1 = 26
function db1(ma, cu, moi, cach, maMoi) {
  const db = baseDb();
  db.nhanvien = [{ "Mã NV": "NV001", "Họ và tên": "A", "Trạng thái": "Đang làm việc" }];
  db.hopdong = [{ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Ngày vào làm": "2025-01-01" }];
  const pl = { "Mã NV": "NV001", "Số HĐLĐ": "H1", "Mã lương": ma, "Lương cơ bản": "6000000", "Mức đóng bảo hiểm": "BH01", "Thuế TNCN": "MT00", "HTTT": "Tiền mặt" };
  db.chitiethd = [Object.assign({}, pl, { "Hiệu lực từ": "2025-01-01", "Lương thỏa thuận": cu }),
    Object.assign({}, pl, { "Hiệu lực từ": "2026-09-16", "Lương thỏa thuận": moi, "Cách áp dụng trong tháng hiệu lực": cach, "Mã lương": maMoi || ma })];
  db.chamcong = [ccRow("NV001", 2026, 9)];
  return db;
}
const pay = (db, y, m) => { const s = HR.staffForPayroll(db, y || 2026, m || 9), kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: s.list }), y || 2026, m || 9, false); return { b: kq.bangluong[0], warn: s.warn.concat(kq.canhbao), staff: s.list[0] }; };

test("U-PL-01 TG1 20tr → 26tr từ 16/09, chọn 'Từ ngày hiệu lực': 20tr/26×13 + 26tr/26×13 = 10.000.000 + 13.000.000 = 23.000.000", () => {
  const r = pay(db1("TG1", "20000000", "26000000", "Từ ngày hiệu lực"));
  assert.equal(r.b["Lương thời gian"], 23000000);
  assert.equal(r.b["Lương thỏa thuận"], 26000000, "cột Lương thỏa thuận hiện mức của phụ lục đang hiệu lực");
  assert.equal(r.b["BH trừ NLĐ"], 630000, "BH theo phụ lục hiệu lực (Lương cơ bản 6tr × 10,5%), không chia");
  assert.ok(r.warn.some((w) => /phụ lục mới từ ngày 16 .*13 công theo mức cũ 20\.000\.000, 13 công theo mức mới 26\.000\.000/.test(w)), r.warn.join("\n"));
});

test("U-PL-02 cùng dữ liệu, chọn 'Cả tháng' hoặc để trống → cả tháng 26.000.000 (như trước — không đổi hành vi cũ)", () => {
  for (const cach of ["Cả tháng", "", undefined]) {
    const r = pay(db1("TG1", "20000000", "26000000", cach));
    assert.equal(r.b["Lương thời gian"], 26000000, String(cach));
    assert.equal(r.staff["Áp dụng từ ngày"], undefined, "không thêm trường khi không chia");
  }
});

test("U-PL-03 CN1 đơn giá 300.000 → 350.000 từ 16/09: 13 × 300.000 + 13 × 350.000 = 8.450.000; CĐ 10tr → 13tr: (10tr×13 + 13tr×13)/26 = 11.500.000", () => {
  assert.equal(pay(db1("CN1", "300000", "350000", "Từ ngày hiệu lực")).b["Lương thời gian"], 8450000);
  assert.equal(pay(db1("CĐ", "10000000", "13000000", "Từ ngày hiệu lực")).b["Lương thời gian"], 11500000);
});

test("U-PL-04 không chia được → cả tháng theo mức mới + cảnh báo rõ: khác mã lương; tháng sau (hiệu lực đã qua) không chia; hiệu lực ngày 1 không chia", () => {
  const r = pay(db1("TG1", "20000000", "26000000", "Từ ngày hiệu lực", "TG2"));
  assert.ok(r.warn.some((w) => /mã lương khác phụ lục trước \(TG1 → TG2\).*CẢ THÁNG/.test(w)));
  assert.equal(r.staff["Áp dụng từ ngày"], undefined);
  const db = db1("TG1", "20000000", "26000000", "Từ ngày hiệu lực"); db.chamcong.push(ccRow("NV001", 2026, 10));
  assert.equal(pay(db, 2026, 10).b["Lương thời gian"], 26000000, "tháng 10: cả tháng mức mới");
  const d1 = db1("TG1", "20000000", "26000000", "Từ ngày hiệu lực"); d1.chitiethd[1]["Hiệu lực từ"] = "2026-09-01";
  assert.equal(pay(d1).b["Lương thời gian"], 26000000);
});

test("U-PL-05 chỉ làm nửa đầu tháng (13 công trước 16/09) → toàn bộ theo mức cũ: 20tr/26×13 = 10.000.000", () => {
  const db = db1("TG1", "20000000", "26000000", "Từ ngày hiệu lực");
  for (let d = 16; d <= 30; d++) delete db.chamcong[0][String(d).padStart(2, "0")];
  assert.equal(pay(db).b["Lương thời gian"], 10000000);
});
