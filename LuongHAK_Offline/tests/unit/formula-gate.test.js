// Cổng nghiệm thu GĐ2: tạo TC7, PC99, HT99 CHỈ bằng cấu hình (không sửa mã nguồn) và kỳ đã chốt không đổi khi sửa công thức.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const CLOSE = require("../../core/payroll-close.js");
const { baseDb, ccRow, staff } = require("../fixtures/build.js");

const CT = (o) => Object.assign({ "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2020-01-01" }, o);
const DG = 9000000 / 26;
function gateDb() {
  const db = baseDb();
  db.dm_tangca.push({ "Mã tăng ca": "TC7", "Nội dung tăng ca": "Tăng ca ngày lễ ca đêm", "Hệ số tăng ca": 2, "Hiệu lực từ": "2020-01-01" });
  db.dm_phucap.push({ "Mã phụ cấp": "PCX", "Tên phụ cấp": "Chuyên cần", "Số tiền": "300000", "Tham chiếu": "5", "Loại công thức": "PC99", "Hiệu lực từ": "2020-01-01" });
  db.dm_hotro.push({ "Mã hỗ trợ": "HTX", "Nội dung": "Hỗ trợ xăng", "Số tiền": "50000", "Loại công thức": "HT99", "Hiệu lực từ": "2020-01-01" });
  db.dm_congthuc = [
    CT({ "Mã công thức": "TC7", "Loại": "OVERTIME", "Biểu thức": "CONG_TC * HE_SO_TC + 0.25" }),
    CT({ "Mã công thức": "PC99", "Loại": "ALLOWANCE", "Biểu thức": "IF(CONG_HUONG_PHU_CAP >= CONG_CHUAN, MUC_PHU_CAP, 0)" }),
    CT({ "Mã công thức": "HT99", "Loại": "SUPPORT", "Biểu thức": "MIN(SO_NGAY_COM, 10) * MUC_HO_TRO" })
  ];
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã tăng ca": "TC7", "Mã phụ cấp": "PCX", "Mã hỗ trợ": "HTX" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 26), ccRow("NV", 2026, 9, "TC", 1, 2)];
  return db;
}
const row = (kq) => kq.bangluong.find((r) => r["Mã NV"] === "NV");

test("TC7 mới: tính đúng theo công thức khai báo, không lỗi", () => {
  const kq = E.tinhBangLuong(gateDb(), 2026, 9, false);
  assert.equal(kq.loiCongThuc.length, 0);
  assert.equal(row(kq)["Tiền tăng ca"], Math.round(DG * (2 * 2 + 0.25)));
});
test("PC99 mới: đủ công chuẩn → trả đủ mức; thiếu công → 0", () => {
  assert.equal(row(E.tinhBangLuong(gateDb(), 2026, 9, false))["Phụ cấp"], 300000);
  const db = gateDb(); db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 20)];
  assert.equal(row(E.tinhBangLuong(db, 2026, 9, false))["Phụ cấp"], 0);
});
test("HT99 mới: được nhận diện (không lỗi công thức), ngày cơm = 0 → 0đ; có ngày cơm → MIN(ngày,10) × mức", () => {
  const db = gateDb();
  const r = row(E.tinhBangLuong(db, 2026, 9, false));
  assert.equal(r["Tiền cơm"], 0);
  db.chamcong.push(ccRow("NV", 2026, 9, "CC", 1, 12));
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  assert.equal(kq.loiCongThuc.length, 0);
  assert.equal(row(kq)["Ngày cơm"], 12); assert.equal(row(kq)["Tiền cơm"], 10 * 50000); // MIN(12,10) × 50.000
});
test("Bản nháp của TC7 chưa áp dụng cho đến khi chuyển 'Hiệu lực'; bản nháp thì mã lạ báo FORMULA_ERROR (P2-01: 0đ, không tính ngầm)", () => {
  const db = gateDb(); db.dm_congthuc[0]["Trạng thái"] = "Nháp";
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  assert.equal(row(kq)["Tiền tăng ca"], 0);
  assert.ok(kq.loiCongThuc.some((e) => e.maCongThuc === "TC7" && e.maLoi === "UNKNOWN_CODE"));
});
test("Đổi giữa kỳ: bản mới có hiệu lực từ 2026-10-01 không đổi kỳ 9, có đổi kỳ 10", () => {
  const db = gateDb();
  db.dm_congthuc.push(CT({ "Mã công thức": "TC7", "Loại": "OVERTIME", "Hiệu lực từ": "2026-10-01", "Biểu thức": "CONG_TC * HE_SO_TC" }));
  db.dm_congthuc[0]["Hiệu lực đến"] = "2026-09-30";
  assert.equal(row(E.tinhBangLuong(db, 2026, 9, false))["Tiền tăng ca"], Math.round(DG * 4.25));
  db.chamcong = [ccRow("NV", 2026, 10, "BT", 1, 26), ccRow("NV", 2026, 10, "TC", 1, 2)];
  const kq10 = E.tinhBangLuong(db, 2026, 10, false);
  assert.equal(row(kq10)["Tiền tăng ca"], Math.round(9000000 / 27 * 4));
});
test("Kỳ đã chốt: snapshot lưu danh mục công thức; sửa công thức sau đó không làm đổi số đã chốt", () => {
  const db = gateDb();
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  const snap = CLOSE.buildSnapshot(db, "2026-09", kq, db.nhansu, { user: "t" });
  CLOSE.close(db, snap);
  assert.equal(snap.input.danhmuc.dm_congthuc.length, 3);
  const truoc = JSON.stringify(CLOSE.current(db, "2026-09").kq.bangluong);
  db.dm_congthuc[0]["Biểu thức"] = "CONG_TC * 100";
  assert.equal(JSON.stringify(CLOSE.current(db, "2026-09").kq.bangluong), truoc);
});

test("P2-01: mã tăng ca lạ (không TC1–TC6, không công thức) → FORMULA_ERROR UNKNOWN_CODE, 0đ, checklist điểm 21 chặn chốt; TC1–TC6 không bị ảnh hưởng", () => {
  const CHK = require("../../core/pre-close-checklist.js");
  const db = gateDb(); db.dm_congthuc = [];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  assert.equal(row(kq)["Tiền tăng ca"], 0);
  const e = kq.loiCongThuc.find((x) => x.maLoi === "UNKNOWN_CODE");
  assert.ok(e && e.maCongThuc === "TC7" && /TC1–TC6/.test(e.message) && e.huongXuLy);
  const it = CHK.run({ db, kq }).items.find((x) => x.id === 21);
  assert.equal(it.trangThai, "loi"); assert.ok(/TC7/.test(it.chiTiet[0]));
  const db2 = gateDb(); db2.dm_congthuc = []; db2.dm_tangca.forEach((r) => { r["Mã tăng ca"] = "TC4"; }); db2.nhansu.forEach((n) => { n["Mã tăng ca"] = "TC4"; });
  const k2 = E.tinhBangLuong(db2, 2026, 9, false);
  assert.equal(k2.loiCongThuc.length, 0); assert.ok(row(k2)["Tiền tăng ca"] > 0);
});
