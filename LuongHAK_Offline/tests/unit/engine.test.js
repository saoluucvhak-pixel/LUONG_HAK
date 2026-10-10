// Kiểm thử công thức tính lương — kết quả kỳ vọng được TÍNH TAY theo quy tắc trong docs/PAYROLL_FORMULAS.md
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const { baseDb, ccRow, staff } = require("../fixtures/build.js");

function run(staffList, extra, nam, thang, bu) {
  const db = Object.assign(baseDb(), extra || {});
  db.nhansu = staffList;
  return E.tinhBangLuong(db, nam || 2026, thang || 9, !!bu);
}
const row = (kq, ma) => kq.bangluong.find((r) => r["Mã NV"] === (ma || "NV"));

test("công chuẩn theo 'Cách tính' (tháng 9/2026: 30 ngày, 4 Chủ nhật)", () => {
  const db = baseDb(), L = {}; db.dm_luong.forEach((r) => { L[r["Mã lương"]] = r; });
  assert.equal(E.congChuan(L.TG1, 9, 2026, 20), 26);   // 30 − 4 CN
  assert.equal(E.congChuan(L.TG2, 9, 2026, 20), 30);   // "Số ngày của tháng"
  assert.equal(E.congChuan(L.TG3, 9, 2026, 20), 22);   // 26 − 4
  assert.equal(E.congChuan(L.TG4, 9, 2026, 20), 24);   // 26 − 2
  assert.equal(E.congChuan(L.CN1, 9, 2026, 20), 20);   // thực tế ngày công
  assert.equal(E.congChuan(L["CĐ"], 9, 2026, 20), 26);
});

test("lương thời gian TG1: đủ công và nửa công", () => {
  const s = [staff({ "Mã nhân viên": "A", "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000" }), staff({ "Mã nhân viên": "B", "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000" })];
  const kq = run(s, { chamcong: [ccRow("A", 2026, 9), ccRow("B", 2026, 9, "BT", 1, 13)] });
  assert.equal(row(kq, "A")["Lương thời gian"], 9000000);
  assert.equal(row(kq, "B")["Lương thời gian"], 4500000); // 9.000.000 / 26 × 13
  assert.equal(row(kq, "A")["Thực lĩnh"], 9000000);
});

test("lương công nhật CN1 = đơn giá × công, tăng ca CN1 = đơn giá × công tăng ca", () => {
  const kq = run([staff({ "Mã tiền lương 1": "CN1", "Lương thỏa thuận": "300000" })], { chamcong: [ccRow("NV", 2026, 9, "BT", 1, 20), ccRow("NV", 2026, 9, "TC", 1, 2)] });
  const r = row(kq);
  assert.equal(r["Tổng công"], 22); // công tăng ca được cộng vào tổng công (như bản gốc)
  assert.equal(r["Lương thời gian"], 300000 * 22);
  assert.equal(r["Tiền tăng ca"], 600000);
});

test("lương sản phẩm + bù theo tháng khi dưới ngưỡng", () => {
  const extra = { chamcong: [ccRow("NV", 2026, 9)], sanluong: [{ "Phiếu cân": "P1", "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "30", "Mã NV": "NV" }] };
  const db = baseDb(); db.dm_luong.find((r) => r["Mã lương"] === "SP")["ĐK_Bù lương (công tối thiểu)"] = "5";
  db.dm_luong.find((r) => r["Mã lương"] === "SP")["Đơn giá bù lương"] = "300000";
  db.nhansu = [staff({ "Mã tiền lương 1": "SP", "Lương thỏa thuận": "200000" })];
  Object.assign(db, extra);
  const r = row(E.tinhBangLuong(db, 2026, 9, false));
  assert.equal(r["Lương sản lượng"], 180000);                 // 30 tấn × 6.000
  assert.equal(r["Lương bù SL"], 300000 * 26 - 180000);        // 30/26 < 5 → bù
  assert.equal(r["Lương thời gian"], 200000 * 26);
});

test("phụ cấp TN.02 theo tỷ lệ công: dưới ngưỡng (công chuẩn − 5) thì tính theo công", () => {
  const kq = run([staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã phụ cấp": "TN.02" })], { chamcong: [ccRow("NV", 2026, 9, "BT", 1, 18)] });
  assert.equal(row(kq)["Phụ cấp"], Math.round(200000 / 26 * 18)); // 138.462
  const kq2 = run([staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã phụ cấp": "TN.02" })], { chamcong: [ccRow("NV", 2026, 9, "BT", 1, 21)] });
  assert.equal(row(kq2)["Phụ cấp"], 200000);
});

test("phụ cấp công tác theo nhãn chấm công 1QC", () => {
  const kq = run([staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000" })], { chamcong: [ccRow("NV", 2026, 9, "BT", "1QC", 7)] });
  assert.equal(row(kq)["Phụ cấp công tác"], 700000);
  assert.equal(row(kq)["Tổng công"], 7);
});

test("BHXH người lao động 10,5% lương đóng BH; truy thu khi dưới ngưỡng công", () => {
  const kq = run([staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Lương cơ bản": "5000000", "Mã BHXH": "BH01" })], { chamcong: [ccRow("NV", 2026, 9)] });
  assert.equal(row(kq)["BH trừ NLĐ"], 525000);
  const db = baseDb(); db.dm_luong.find((r) => r["Mã lương"] === "TG1")["Ngưỡng truy thu BH (công)"] = "14";
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Lương cơ bản": "5000000", "Mã BHXH": "BH01" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", 1, 10)];
  const r2 = row(E.tinhBangLuong(db, 2026, 9, false));
  assert.equal(r2["BH trừ NLĐ"], 0);
  assert.equal(r2["Truy thu BH"], 1175000); // 5.000.000 × 23,5%
});

test("thuế TNCN lũy tiến biểu 5 bậc 2026: thu nhập tính thuế 40 triệu → 4,5 triệu", () => {
  const kq = run([staff({ "Lương thỏa thuận": "55500000", "Mã TNCN": "LT01" })], { chamcong: [ccRow("NV", 2026, 9)] });
  assert.equal(row(kq)["Thuế TNCN"], 4500000); // 10tr×5% + 20tr×10% + 10tr×20%
  assert.equal(row(kq)["Thực lĩnh"], 51000000);
});

test("thuế TNCN theo hiệu lực: 12/2025 dùng biểu 7 bậc + GT 11tr, 01/2026 dùng biểu 5 bậc + GT 15,5tr", () => {
  const s = [staff({ "Lương thỏa thuận": "20000000", "Mã TNCN": "LT01" })];
  assert.equal(row(run(s, { chamcong: [ccRow("NV", 2025, 12)] }, 2025, 12))["Thuế TNCN"], 650000); // 9tr: 5tr×5% + 4tr×10%
  assert.equal(row(run(s, { chamcong: [ccRow("NV", 2026, 1)] }, 2026, 1))["Thuế TNCN"], 225000);   // 4,5tr × 5%
});

test("người phụ thuộc giảm trừ 6,2 triệu/người", () => {
  const kq = run([staff({ "Lương thỏa thuận": "30000000", "Mã TNCN": "LT01", "Người phụ thuộc": 1 })], { chamcong: [ccRow("NV", 2026, 9)] });
  assert.equal(row(kq)["Thuế TNCN"], Math.round((30000000 - 15500000 - 6200000) * 0.05)); // 8,3tr → 415.000
});

test("khấu trừ vãng lai VL01 10% trên tổng thu nhập", () => {
  const kq = run([staff({ "Lương thỏa thuận": "6000000", "Mã TNCN": "VL01" })], { chamcong: [ccRow("NV", 2026, 9)] });
  assert.equal(row(kq)["Thuế TNCN"], 600000);
  assert.equal(row(kq)["Thực lĩnh"], 5400000);
});

test("thực lĩnh làm tròn 1.000đ; khoản trừ vượt thu nhập → 0 và CÓ cảnh báo", () => {
  const kq = run([staff({ "Lương thỏa thuận": "1000000" })], { chamcong: [ccRow("NV", 2026, 9)], ungluong: [{ "Ngày hạch toán": "2026-09-10", "Mã NV": "NV", "Tạm ứng": "2000000" }] });
  assert.equal(row(kq)["Thực lĩnh"], 0);
  assert.ok(kq.canhbao.some((w) => /vượt thu nhập/.test(w)));
  const kq2 = run([staff({ "Lương thỏa thuận": "1000499" })], { chamcong: [ccRow("NV", 2026, 9)] });
  assert.equal(row(kq2)["Thực lĩnh"], 1000000);
});

test("BUG-002: số tiền nhập kiểu VN '500.000' được hiểu là 500.000đ (không phải 500đ)", () => {
  const kq = run([staff({ "Lương thỏa thuận": "9.000.000" })], { chamcong: [ccRow("NV", 2026, 9)], psluong: [{ "Ngày hạch toán": "2026-09-28", "Mã NV": "NV", "Thưởng": "500.000" }] });
  assert.equal(row(kq)["Thưởng"], 500000);
  assert.equal(row(kq)["Lương thời gian"], 9000000);
  assert.equal(E.money("0.015"), 0.015);   // không làm hỏng số thập phân
  assert.equal(E.num("0.175"), 0.175);     // tỷ lệ vẫn đọc như cũ
});

test("cảnh báo khi thuế lũy tiến mà thiếu mức giảm trừ", () => {
  const kq = run([staff({ "Lương thỏa thuận": "20000000", "Mã TNCN": "LT01", "Mã GT_TNCN_BT": "KHONG_CO" })], { chamcong: [ccRow("NV", 2026, 9)] });
  assert.ok(kq.canhbao.some((w) => /giảm trừ bản thân/.test(w)));
});
