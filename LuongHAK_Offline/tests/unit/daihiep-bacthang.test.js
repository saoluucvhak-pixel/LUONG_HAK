// Kiểm thử bắt buộc — Bù lương sản lượng Đại Hiệp theo bậc thang (theo ngày).
// Nguồn quy tắc: Master Prompt V3 mục VII + văn bản "QUY TẮC BẮT BUỘC — BÙ LƯƠNG SẢN LƯỢNG
// ĐẠI HIỆP THEO BẬC THANG" (chủ sở hữu). Mỗi test đối chiếu kết quả engine.js (cheDoBu
// "daihiep") với công thức tham chiếu tính độc lập trong chính file test này, để chứng
// minh engine không hardcode hằng số và tính đúng từng điểm biên bậc thang.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const { baseDb, staff } = require("../fixtures/build.js");

const row = (kq, ma) => kq.bangluong.find((r) => r["Mã NV"] === (ma || "NV"));

/** 1 dòng chấm công BT chỉ cho 1 ngày (để kiểm soát công BT từng ngày độc lập). */
function btRow(ma, nam, thang, day, value) {
  return { "Kỳ": nam + "-" + String(thang).padStart(2, "0"), "Mã NV": ma, "Hình thức công": "BT", [String(day).padStart(2, "0")]: value };
}
/** 1 phiếu cân sản lượng cho 1 ngày. */
function slRow(ma, nam, thang, day, tan, phieu) {
  return { "Phiếu cân": phieu || ("P" + ma + "-" + day), "Ngày cân": nam + "-" + String(thang).padStart(2, "0") + "-" + String(day).padStart(2, "0"), "KL hàng (Tấn)": String(tan), "Mã NV": ma };
}
function dbSP(opts) {
  const db = baseDb();
  const sp = db.dm_luong.find((r) => r["Mã lương"] === "SP");
  if (opts && opts.giaBu != null) sp["Đơn giá bù lương"] = String(opts.giaBu);
  if (opts && opts.donGia != null) sp["Số tiền khoán"] = String(opts.donGia);
  db.nhansu = [staff({ "Mã tiền lương 1": "SP", "Lương thỏa thuận": "200000" })];
  return db;
}
// Tham chiếu bậc thang — viết lại độc lập từ engine.js để không "tự kiểm tra bằng chính nó":
// ngày thường: BT<0,5→0 · 0,5≤BT<1→0,5 · BT≥1→1 (tối đa). Chủ nhật: BT<0,5→0 · 0,5≤BT<1→0,5 · 1≤BT<1,5→1 · BT≥1,5→1,5 (tối đa).
function bacThangRef(congBT, chuNhat) {
  if (!chuNhat) return congBT < 0.5 ? 0 : congBT < 1 ? 0.5 : 1;
  return congBT < 0.5 ? 0 : congBT < 1 ? 0.5 : congBT < 1.5 ? 1 : 1.5;
}

// Tham số mặc định danh mục HAK (dm_luong SP): Số tiền khoán 6.000đ/tấn, Đơn giá bù lương 200.000đ.
// SL_CHUAN_1_NGAY = 200.000 / 6.000 = 33,333333333333336 — không hardcode, tính từ danh mục.
const GIABU = 200000, DONGIA = 6000;

[
  // [nhãn, ngày, công BT, Chủ nhật?, tấn thực tế ngày đó]
  ["0,49 ngày thường → hệ số 0 (chưa đạt bậc 0,5)", 7, 0.49, false, 1],
  ["0,5 ngày thường → hệ số 0,5 (đạt bậc 0,5)", 7, 0.5, false, 1],
  ["0,99 ngày thường → vẫn hệ số 0,5 (chưa đạt bậc 1)", 7, 0.99, false, 1],
  ["1 ngày thường → hệ số 1 (tối đa ngày thường)", 7, 1, false, 1],
  ["2 ngày thường → VẪN hệ số 1 (không được vượt tối đa ngày thường)", 7, 2, false, 1],
  ["1,49 Chủ nhật → vẫn hệ số 1 (chưa đạt bậc 1,5)", 6, 1.49, true, 1],
  ["1,5 Chủ nhật → hệ số 1,5 (tối đa Chủ nhật)", 6, 1.5, true, 1],
  ["2 Chủ nhật → VẪN hệ số 1,5 (không được vượt tối đa Chủ nhật)", 6, 2, true, 1],
].forEach(([label, day, bt, chuNhat, tan]) => {
  test("Đại Hiệp bậc thang — điểm biên: " + label, () => {
    const db = dbSP();
    db.chamcong = [btRow("NV", 2026, 9, day, bt)];
    db.sanluong = [slRow("NV", 2026, 9, day, tan)];
    const kq = E.tinhBangLuong(db, 2026, 9, "daihiep");
    const heSo = bacThangRef(bt, chuNhat);
    const expected = Math.round(Math.max(0, heSo * GIABU - tan * DONGIA));
    assert.equal(row(kq)["Lương bù SL"], expected, label);
  });
});

test("Đại Hiệp bậc thang — sản lượng thực tế THẤP HƠN tham chiếu → bù > 0", () => {
  const db = dbSP();
  db.chamcong = [btRow("NV", 2026, 9, 7, 1)]; // hệ số 1 → SL tham chiếu = 33,333333... tấn
  db.sanluong = [slRow("NV", 2026, 9, 7, 10)]; // thực tế 10 tấn < tham chiếu
  const kq = E.tinhBangLuong(db, 2026, 9, "daihiep");
  assert.equal(row(kq)["Lương bù SL"], Math.round(GIABU * 1 - 10 * DONGIA));
  assert.ok(row(kq)["Lương bù SL"] > 0);
});

test("Đại Hiệp bậc thang — sản lượng thực tế BẰNG tham chiếu (SL_CHUAN×hệ số) → bù = 0", () => {
  const db = dbSP();
  const heSo = 1, tanBang = (heSo * GIABU) / DONGIA; // đúng bằng SL tham chiếu ngày (33,333333333333336 tấn)
  db.chamcong = [btRow("NV", 2026, 9, 7, 1)];
  db.sanluong = [slRow("NV", 2026, 9, 7, tanBang)];
  const kq = E.tinhBangLuong(db, 2026, 9, "daihiep");
  assert.equal(row(kq)["Lương bù SL"], 0);
});

test("Đại Hiệp bậc thang — sản lượng thực tế CAO HƠN tham chiếu → bù = 0 (không bù âm, không trừ ngược)", () => {
  const db = dbSP();
  db.chamcong = [btRow("NV", 2026, 9, 7, 1)]; // tham chiếu 33,333333... tấn
  db.sanluong = [slRow("NV", 2026, 9, 7, 40)]; // 40 tấn > tham chiếu
  const kq = E.tinhBangLuong(db, 2026, 9, "daihiep");
  assert.equal(row(kq)["Lương bù SL"], 0);
});

test("Đại Hiệp bậc thang — một ngày có NHIỀU phiếu cân: phải cộng sản lượng trong ngày TRƯỚC khi so với bậc thang (không tính bù riêng từng phiếu rồi cộng)", () => {
  const db = dbSP();
  db.chamcong = [btRow("NV", 2026, 9, 7, 1)]; // hệ số 1, tham chiếu 33,333333... tấn / tổng cả ngày
  db.sanluong = [slRow("NV", 2026, 9, 7, 10, "P1"), slRow("NV", 2026, 9, 7, 10, "P2")]; // 2 phiếu cùng ngày, tổng 20 tấn
  const kq = E.tinhBangLuong(db, 2026, 9, "daihiep");
  // Đúng: bù = mức sàn ngày − (TỔNG 20 tấn) × đơn giá = 200.000 − 120.000 = 80.000
  // Sai (nếu tính riêng từng phiếu rồi cộng, mỗi phiếu lại được "hưởng" nguyên 1 lần mức sàn): sẽ cho kết quả khác hẳn.
  assert.equal(row(kq)["Lương bù SL"], Math.round(GIABU * 1 - 20 * DONGIA));
  assert.equal(row(kq)["Lương bù SL"], 80000);
});

test("Đại Hiệp bậc thang — Đơn giá khoán và Mức bù lương SL đổi giữa 2 kỳ: mỗi kỳ phải dùng đúng giá trị DM_LUONG hiệu lực của kỳ đó", () => {
  const db = baseDb();
  const spCu = db.dm_luong.find((r) => r["Mã lương"] === "SP");
  spCu["Hiệu lực đến"] = "2026-08-31";
  const spMoi = Object.assign({}, spCu);
  delete spMoi["Hiệu lực đến"];
  spMoi["Hiệu lực từ"] = "2026-09-01";
  spMoi["Đơn giá bù lương"] = "300000";
  spMoi["Số tiền khoán"] = "7000";
  db.dm_luong.push(spMoi);
  db.nhansu = [staff({ "Mã tiền lương 1": "SP", "Lương thỏa thuận": "200000" })];
  db.chamcong = [btRow("NV", 2026, 8, 10, 1), btRow("NV", 2026, 9, 10, 1)];
  db.sanluong = [slRow("NV", 2026, 8, 10, 1, "PA"), slRow("NV", 2026, 9, 10, 1, "PB")];
  const kqThang8 = E.tinhBangLuong(db, 2026, 8, "daihiep");
  const kqThang9 = E.tinhBangLuong(db, 2026, 9, "daihiep");
  assert.equal(row(kqThang8)["Lương bù SL"], Math.round(200000 * 1 - 1 * 6000), "tháng 8 phải dùng giá CŨ (200.000đ / 6.000đ/tấn)");
  assert.equal(row(kqThang9)["Lương bù SL"], Math.round(300000 * 1 - 1 * 7000), "tháng 9 phải dùng giá MỚI (300.000đ / 7.000đ/tấn)");
});

test("Đại Hiệp bậc thang — SL_CHUAN_1_NGAY tính từ DM_LUONG, không hardcode 33,333333/16,666667/49,9999999", () => {
  // Đổi tham số sang bộ số KHÁC bộ mặc định (200.000 / 6.000 = 33,333333...) — nếu engine hardcode
  // hằng số cũ thì test này sẽ sai lệch rõ ràng.
  const db = dbSP({ giaBu: 150000, donGia: 5000 }); // SL_CHUAN_1_NGAY = 150.000 / 5.000 = 30 tấn/ngày (hệ số 1)
  db.chamcong = [btRow("NV", 2026, 9, 7, 1)];
  db.sanluong = [slRow("NV", 2026, 9, 7, 12)]; // 12 tấn < 30 tấn tham chiếu
  const kq = E.tinhBangLuong(db, 2026, 9, "daihiep");
  assert.equal(row(kq)["Lương bù SL"], Math.round(150000 * 1 - 12 * 5000)); // 90.000
});

test("Đại Hiệp bậc thang — KHÔNG xét ngưỡng công BT tháng (khác cách bù 'theo tháng'/'theo ngày' cũ)", () => {
  const db = dbSP();
  db.dm_luong.find((r) => r["Mã lương"] === "SP")["ĐK_Bù lương (công tối thiểu)"] = "9999"; // ngưỡng rất cao — nếu bị áp dụng sẽ chặn hết bù
  db.chamcong = [btRow("NV", 2026, 9, 7, 1)]; // chỉ 1 ngày công BT trong cả tháng — tổng công BT tháng rất thấp
  db.sanluong = [slRow("NV", 2026, 9, 7, 1)];
  const kq = E.tinhBangLuong(db, 2026, 9, "daihiep");
  // Bù vẫn được tính theo CÔNG THỨC NGÀY của ngày 07, hoàn toàn không bị ngưỡng tháng "ĐK_Bù lương (công tối thiểu)" chặn.
  assert.equal(row(kq)["Lương bù SL"], Math.round(GIABU * 1 - 1 * DONGIA));
});

test("Đại Hiệp bậc thang — sai số làm tròn khi quy đổi tấn sang tiền: CHỈ làm tròn 1 lần ở tổng tháng, không làm tròn từng ngày rồi cộng", () => {
  // Chọn tấn/ngày sao cho phần bù mỗi ngày kết thúc đúng ở .5 (điểm Math.round có thể lệch hướng khác
  // nhau giữa "làm tròn rồi cộng" và "cộng rồi làm tròn 1 lần"), để chứng minh cách tính đúng theo quy chế.
  const tan = 99999.5 / DONGIA; // → mỗi ngày: 200.000 − tan×6.000 = 100.000,5 (đúng ở biên .5)
  const db = dbSP();
  db.chamcong = [btRow("NV", 2026, 9, 7, 1), btRow("NV", 2026, 9, 8, 1)];
  db.sanluong = [slRow("NV", 2026, 9, 7, tan, "P1"), slRow("NV", 2026, 9, 8, tan, "P2")];
  const kq = E.tinhBangLuong(db, 2026, 9, "daihiep");
  const dNgay = GIABU * 1 - tan * DONGIA; // ≈ 100.000,5 mỗi ngày (chưa làm tròn)
  const dungCongRoiTron = Math.round(dNgay + dNgay); // cách ĐÚNG: cộng 2 ngày rồi làm tròn 1 lần
  const saiTronRoiCong = Math.round(dNgay) + Math.round(dNgay); // cách SAI: làm tròn từng ngày rồi cộng
  assert.notEqual(dungCongRoiTron, saiTronRoiCong, "bộ số kiểm thử phải thật sự tạo ra sự khác biệt giữa 2 cách tính");
  assert.equal(row(kq)["Lương bù SL"], dungCongRoiTron);
});

test("Đại Hiệp bậc thang — công thức tương đương (tiền bù ngày = MAX(0, mức bù×hệ số − SL thực tế×đơn giá)) phải ra cùng kết quả như tính qua SL bù×đơn giá", () => {
  const cases = [
    { bt: 0.5, chuNhat: false, tan: 1 },
    { bt: 1, chuNhat: false, tan: 10 },
    { bt: 1.5, chuNhat: true, tan: 5 },
    { bt: 2, chuNhat: true, tan: 0.2 },
  ];
  cases.forEach(({ bt, chuNhat, tan }, i) => {
    const day = chuNhat ? 6 : 7;
    const db = dbSP();
    db.chamcong = [btRow("NV", 2026, 9, day, bt)];
    db.sanluong = [slRow("NV", 2026, 9, day, tan)];
    const kq = E.tinhBangLuong(db, 2026, 9, "daihiep");
    const heSo = bacThangRef(bt, chuNhat);
    const slChuan = GIABU / DONGIA, slThamChieu = slChuan * heSo;
    const slBu = Math.max(0, slThamChieu - tan);
    const tienBuQuaSL = slBu * DONGIA; // cách 1: SL_BU × đơn giá khoán
    const tienBuTuongDuong = Math.max(0, GIABU * heSo - tan * DONGIA); // cách 2: MAX(0, mức bù×hệ số − SL thực tế×đơn giá)
    assert.ok(Math.abs(tienBuQuaSL - tienBuTuongDuong) < 1e-6, "case " + i + ": 2 công thức tương đương phải cho cùng kết quả trước khi làm tròn");
    assert.equal(row(kq)["Lương bù SL"], Math.round(tienBuTuongDuong), "case " + i);
  });
});
