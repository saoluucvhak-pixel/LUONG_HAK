// Master V5 P0-01/P0-02: công thức cấu hình HIỆU LỰC bị lỗi → FORMULA_ERROR (khoản = 0đ, KHÔNG rơi về công thức mặc định,
// chặn chốt kỳ qua checklist điểm 21). Bản Nháp không áp dụng; công ty khác không áp dụng; xung đột phiên bản = lỗi.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const PRE = require("../../core/pre-close-checklist.js");
const EVAL = require("../../core/payroll/formula-evaluator.js");
const { baseDb, ccRow, staff } = require("../fixtures/build.js");

const CT = (o) => Object.assign({ "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2020-01-01" }, o);
const row = (kq, ma) => kq.bangluong.find((r) => r["Mã NV"] === (ma || "NV"));
const DG = 9000000 / 26; // đơn giá công TG1 tháng 9/2026 (công chuẩn 26)
const HE_SO_TC4 = 0.5; // hệ số TC4 trong fixture (dm_tangca); mã TC9 do test tự khai hệ số 1

function otDb(congthuc, extraNs) {
  const db = baseDb();
  db.dm_tangca.push({ "Mã tăng ca": "TC9", "Nội dung tăng ca": "test", "Hệ số tăng ca": 1, "Hiệu lực từ": "2020-01-01" });
  db.dm_congthuc = congthuc;
  db.nhansu = [staff(Object.assign({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã tăng ca": "TC9" }, extraNs || {}))];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 20), ccRow("NV", 2026, 9, "TC", 1, 2)];
  return db;
}

test("tăng ca: biến không tồn tại → FORMULA_ERROR UNKNOWN_VAR, ghi rõ biến, 0đ", () => {
  const kq = E.tinhBangLuong(otDb([CT({ "Mã công thức": "TC9", "Loại": "OVERTIME", "Biểu thức": "CONG_TC_DUOC_DUYET * HE_SO_TC" })]), 2026, 9, false);
  assert.equal(row(kq)["Tiền tăng ca"], 0);
  const e = kq.loiCongThuc[0];
  assert.equal(e.maLoi, "UNKNOWN_VAR"); assert.equal(e.bien, "CONG_TC_DUOC_DUYET"); assert.equal(e.maNV, "NV"); assert.equal(e.maCongThuc, "TC9"); assert.equal(e.loai, "OVERTIME");
  assert.ok(e.bieuThuc.includes("CONG_TC_DUOC_DUYET") && e.huongXuLy);
});

test("tăng ca: biểu thức sai cú pháp → FORMULA_ERROR, không dùng công thức mặc định", () => {
  const kq = E.tinhBangLuong(otDb([CT({ "Mã công thức": "TC9", "Loại": "OVERTIME", "Biểu thức": "CONG_TC * (HE_SO_TC" })]), 2026, 9, false);
  assert.equal(row(kq)["Tiền tăng ca"], 0); assert.equal(kq.loiCongThuc.length, 1);
});

test("tăng ca: biểu thức hiệu lực để trống → FORMULA_ERROR EMPTY_EXPRESSION (không im lặng dùng mặc định)", () => {
  const kq = E.tinhBangLuong(otDb([CT({ "Mã công thức": "TC9", "Loại": "OVERTIME", "Biểu thức": "  " })]), 2026, 9, false);
  assert.equal(row(kq)["Tiền tăng ca"], 0); assert.equal(kq.loiCongThuc[0].maLoi, "EMPTY_EXPRESSION");
});

test("mã LỊCH SỬ (TC1) có cấu hình hiệu lực nhưng sai → KHÔNG rơi về công thức TC1 cũ", () => {
  const db = otDb([CT({ "Mã công thức": "TC1", "Loại": "OVERTIME", "Biểu thức": "CONG_TC / 0" })], { "Mã tăng ca": "TC1" });
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  assert.equal(row(kq)["Tiền tăng ca"], 0); assert.equal(kq.loiCongThuc.length, 1);
});

test("không có cấu hình → công thức lịch sử như cũ, không lỗi (tương thích ngược)", () => {
  const kq = E.tinhBangLuong(otDb([], { "Mã tăng ca": "TC4" }), 2026, 9, false);
  assert.equal(row(kq)["Tiền tăng ca"], Math.round(DG * 2 * HE_SO_TC4)); assert.equal(kq.loiCongThuc.length, 0);
});

test("cấu hình chỉ là NHÁP (dù sai) → không áp dụng, không lỗi, dùng công thức lịch sử", () => {
  const kq = E.tinhBangLuong(otDb([CT({ "Mã công thức": "TC4", "Loại": "OVERTIME", "Trạng thái": "Nháp", "Biểu thức": "CONG_TC / 0" })], { "Mã tăng ca": "TC4" }), 2026, 9, false);
  assert.equal(row(kq)["Tiền tăng ca"], Math.round(DG * 2 * HE_SO_TC4)); assert.equal(kq.loiCongThuc.length, 0);
});

test("hai bản 'Hiệu lực' cùng mã, cùng ngày hiệu lực từ → FORMULA_ERROR CONFLICT", () => {
  const kq = E.tinhBangLuong(otDb([
    CT({ "Mã công thức": "TC9", "Loại": "OVERTIME", "Biểu thức": "CONG_TC * HE_SO_TC" }),
    CT({ "Mã công thức": "TC9", "Loại": "OVERTIME", "Biểu thức": "CONG_TC * HE_SO_TC * 2" })]), 2026, 9, false);
  assert.equal(row(kq)["Tiền tăng ca"], 0); assert.equal(kq.loiCongThuc[0].maLoi, "CONFLICT");
});

test("hai phiên bản khác ngày hiệu lực từ = nâng phiên bản hợp lệ (bản mới nhất thắng), không lỗi", () => {
  const kq = E.tinhBangLuong(otDb([
    CT({ "Mã công thức": "TC9", "Loại": "OVERTIME", "Biểu thức": "CONG_TC * HE_SO_TC" }),
    CT({ "Mã công thức": "TC9", "Loại": "OVERTIME", "Hiệu lực từ": "2026-09-01", "Biểu thức": "CONG_TC * HE_SO_TC * 2" })]), 2026, 9, false);
  assert.equal(row(kq)["Tiền tăng ca"], Math.round(DG * 4)); assert.equal(kq.loiCongThuc.length, 0);
});

test("P0-02: công thức ghi 'Công ty' khác → KHÔNG áp dụng (dùng lịch sử) + cảnh báo, không lỗi", () => {
  const db = otDb([CT({ "Mã công thức": "TC4", "Loại": "OVERTIME", "Công ty": "CÔNG TY KHÁC", "Biểu thức": "CONG_TC * 10" })], { "Mã tăng ca": "TC4" });
  db.congty = [{ "Tên công ty": "Công ty HAK" }];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  assert.equal(row(kq)["Tiền tăng ca"], Math.round(DG * 2 * HE_SO_TC4)); assert.equal(kq.loiCongThuc.length, 0);
  assert.ok(kq.canhbao.some((w) => /chỉ ghi cho công ty khác/.test(w)));
});

test("P0-02: 'Công ty' khớp tên công ty trong hồ sơ (không phân biệt hoa/thường, khoảng trắng) → áp dụng, ưu tiên hơn bản chung", () => {
  const db = otDb([
    CT({ "Mã công thức": "TC4", "Loại": "OVERTIME", "Biểu thức": "CONG_TC * 10" }),
    CT({ "Mã công thức": "TC4", "Loại": "OVERTIME", "Công ty": "  công ty   hak ", "Biểu thức": "CONG_TC * 3" })], { "Mã tăng ca": "TC4" });
  db.congty = [{ "Tên công ty": "Công ty HAK" }];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  assert.equal(row(kq)["Tiền tăng ca"], Math.round(DG * 6)); assert.equal(kq.loiCongThuc.length, 0);
});

test("P0-02: khớp theo 'Mã công ty' của hồ sơ", () => {
  const db = otDb([CT({ "Mã công thức": "TC4", "Loại": "OVERTIME", "Công ty": "DAIHIEP", "Biểu thức": "CONG_TC * 3" })], { "Mã tăng ca": "TC4" });
  db.congty = [{ "Mã công ty": "DAIHIEP", "Tên công ty": "Công ty Đại Hiệp" }];
  assert.equal(row(E.tinhBangLuong(db, 2026, 9, false))["Tiền tăng ca"], Math.round(DG * 6));
});

test("phụ cấp: công thức hiệu lực lỗi → FORMULA_ERROR, phụ cấp = 0đ (không rơi về TYLE_KHONG_TRU)", () => {
  const db = baseDb();
  db.dm_phucap.push({ "Mã phụ cấp": "PCX", "Tên phụ cấp": "test", "Số tiền": "300000", "Tham chiếu": "5", "Loại công thức": "PC99", "Hiệu lực từ": "2020-01-01" });
  db.dm_congthuc = [CT({ "Mã công thức": "PC99", "Loại": "ALLOWANCE", "Biểu thức": "MUC_PHU_CAP * BIEN_LA" })];
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã phụ cấp": "PCX" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 20)];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  assert.equal(row(kq)["Phụ cấp"], 0);
  assert.equal(kq.loiCongThuc[0].loai, "ALLOWANCE"); assert.equal(kq.loiCongThuc[0].bien, "BIEN_LA");
});

test("phụ cấp: công thức hợp lệ tính đúng (PC99 tạo bằng cấu hình)", () => {
  const db = baseDb();
  db.dm_phucap.push({ "Mã phụ cấp": "PCX", "Tên phụ cấp": "test", "Số tiền": "300000", "Tham chiếu": "5", "Loại công thức": "PC99", "Hiệu lực từ": "2020-01-01" });
  db.dm_congthuc = [CT({ "Mã công thức": "PC99", "Loại": "ALLOWANCE", "Biểu thức": "MUC_PHU_CAP * CONG_HUONG_PHU_CAP / CONG_CHUAN" })];
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã phụ cấp": "PCX" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 20)];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  assert.equal(row(kq)["Phụ cấp"], Math.round(300000 * 20 / 26)); assert.equal(kq.loiCongThuc.length, 0);
});

test("hỗ trợ: công thức hiệu lực lỗi → FORMULA_ERROR, hỗ trợ = 0đ (không rơi về HT_THEO_NGAY)", () => {
  const db = baseDb();
  db.dm_hotro.push({ "Mã hỗ trợ": "HTX", "Nội dung": "test", "Số tiền": "50000", "Loại công thức": "HT99", "Hiệu lực từ": "2020-01-01" });
  db.dm_congthuc = [CT({ "Mã công thức": "HT99", "Loại": "SUPPORT", "Biểu thức": "SO_NGAY_COM * MUC_HO_TRO / (CONG_CHUAN - CONG_CHUAN)" })];
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã hỗ trợ": "HTX" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 20)];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  assert.equal(row(kq)["Tiền cơm"], 0);
  assert.equal(kq.loiCongThuc[0].loai, "SUPPORT"); assert.equal(kq.loiCongThuc[0].maLoi, "DIV_ZERO");
});

test("checklist trước chốt: có FORMULA_ERROR → điểm 21 'loi' (BLOCKER) kèm mã NV, mã công thức, biến, hướng xử lý", () => {
  const kq = E.tinhBangLuong(otDb([CT({ "Mã công thức": "TC9", "Loại": "OVERTIME", "Biểu thức": "CONG_TC_DUOC_DUYET * HE_SO_TC" })]), 2026, 9, false);
  const r = PRE.run({ db: otDb([]), kq });
  const it = r.items.find((x) => x.id === 21);
  assert.equal(it.trangThai, "loi"); assert.ok(r.loiCount >= 1);
  assert.ok(/NV/.test(it.chiTiet[0]) && /TC9/.test(it.chiTiet[0]) && /CONG_TC_DUOC_DUYET/.test(it.chiTiet[0]) && /→/.test(it.chiTiet[0]));
});

test("evaluator: giá trị biến không phải số và kết quả không hữu hạn → lỗi, không âm thầm = 0", () => {
  assert.throws(() => EVAL.evaluate("CONG_TC * 2", { CONG_TC: NaN }), (e) => e.code === "BAD_VALUE");
  assert.throws(() => EVAL.evaluate("CONG_TC * 2", { CONG_TC: "abc" }), (e) => e.code === "BAD_VALUE");
  assert.equal(EVAL.evaluate("CONG_TC * 2", { CONG_TC: "" }), 0); // ô trống = 0 (đúng như dữ liệu nhập)
  assert.throws(() => EVAL.evaluate("CONG_TC * 10", { CONG_TC: 1e308 }), (e) => e.code === "NON_FINITE");
  assert.throws(() => EVAL.evaluate("CONG_TC", { CONG_TC: Infinity }), (e) => e.code === "BAD_VALUE");
});
