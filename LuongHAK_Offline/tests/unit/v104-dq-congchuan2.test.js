// v10.4 — Công chuẩn 2 & phụ cấp công tác theo nhãn (DQ):
// - Công chuẩn 2 lấy từ Danh mục phụ cấp, cột "Công chuẩn 2", theo nhãn công tác trên dòng công BT.
//   Có Công chuẩn 2 > 0 → Công chuẩn của người đó = Công chuẩn 2 (đơn giá ngày, lương thời gian, tăng ca).
// - Mã phụ cấp có Công chuẩn 2 > 0 (DQ): 500.000đ 1 lần/kỳ nếu có ≥1 công BT mang nhãn; không nhân số ngày.
// - Mã khác (QC/ĐH/QS/ĐN): vẫn = số ngày × Số tiền.
// - Nhãn chỉ có trên dòng TC (không phải BT) → không áp dụng Công chuẩn 2 và không được tiền 500k.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const F = require("../fixtures/build.js");

// 30 công BT, TG1, không tăng ca; ghi nhãn tùy ý cho các ngày (ví dụ {"05":"1DQ","06":"1DQ"})
function db(nhanBT, nhanTC) {
  const d = F.baseDb();
  d.nhansu = [F.staff({
    "Mã nhân viên": "NV1", "Họ và tên": "A", "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000",
    "Mã tăng ca": "TC2", "Mã BHXH": "", "Mã TNCN": "MT00"
  })];
  const bt = { "Kỳ": "2026-09", "Mã NV": "NV1", "Hình thức công": "BT" };
  for (let i = 1; i <= 30; i++) bt[("0" + i).slice(-2)] = 1;
  Object.keys(nhanBT || {}).forEach(k => { bt[k] = nhanBT[k]; });
  const rows = [bt];
  if (nhanTC) rows.push({ "Kỳ": "2026-09", "Mã NV": "NV1", "Hình thức công": "TC", ...nhanTC });
  d.chamcong = rows;
  return d;
}

function pcCT(d) { return E.tinhBangLuong(d, 2026, 9, false).bangluong[0]["Phụ cấp công tác"]; }

test("V104-01: DQ trên 2 ngày BT → 500.000đ 1 lần/kỳ (không nhân 2)", () => {
  assert.equal(pcCT(db({ "05": "1DQ", "06": "1DQ" })), 500000);
});

test("V104-02: DQ 1 ngày BT → 500.000đ; không có nhãn → 0", () => {
  assert.equal(pcCT(db({ "05": "1DQ" })), 500000);
  assert.equal(pcCT(db({})), 0);
});

test("V104-03: mã khác (QC) vẫn = số ngày × Số tiền (100.000 × 2)", () => {
  assert.equal(pcCT(db({ "05": "1QC", "06": "1QC" })), 200000);
});

test("V104-04: DQ + QC cùng kỳ → 500.000 (DQ 1 lần) + 100.000 × 1 ngày QC", () => {
  assert.equal(pcCT(db({ "05": "1DQ", "06": "1DQ", "07": "1QC" })), 600000);
});

test("V104-05: nhãn DQ chỉ có trên dòng TC → không được 500k và không đổi Công chuẩn", () => {
  const d = db({}, { "05": "1DQ" });
  const r = E.tinhBangLuong(d, 2026, 9, false).bangluong[0];
  assert.equal(r["Phụ cấp công tác"], 0);
  // Công chuẩn thường = 26 (tháng 9/2026 trừ CN); công tính lương = min(31, 26) → lương TG đủ 9.000.000
  assert.equal(r["Lương thời gian"], 9000000);
});

test("V104-06: Công chuẩn 2 lấy từ bảng (không hardcode): mã QT có Công chuẩn 2 = 35 → đơn giá ngày = 9.000.000/35", () => {
  const d = db({ "05": "1QT" });
  const qc = d.dm_phucap.find(x => x["Mã phụ cấp"] === "QC");
  d.dm_phucap.push(Object.assign({}, qc, { "Mã phụ cấp": "QT", "Tên phụ cấp": "Test", "Công chuẩn 2": 35 }));
  const r = E.tinhBangLuong(d, 2026, 9, false).bangluong[0];
  assert.equal(r["Lương thời gian"], Math.round(9000000 / 35 * 30));
  assert.equal(r["Phụ cấp công tác"], 100000); // QT không có "Công chuẩn 2" trong bảng → không phải DQ, nhân ngày như cũ
});

test("V104-07: Công chuẩn 2 = 0/trống trong bảng → không đổi Công chuẩn (nhãn DQ không còn hardcode 40)", () => {
  const d = db({ "05": "1DQ" });
  d.dm_phucap.forEach(x => { if (x["Mã phụ cấp"] === "DQ") x["Công chuẩn 2"] = 0; });
  const r = E.tinhBangLuong(d, 2026, 9, false).bangluong[0];
  // Công chuẩn thường = 26 → lương TG = 9.000.000 (min(30, 26) công)
  assert.equal(r["Lương thời gian"], 9000000);
  assert.equal(r["Phụ cấp công tác"], 500000); // không có Công chuẩn 2 → DQ vẫn là mã phụ cấp thường: 1 ngày × 500k
});

function themCongThuc(d, ma, bieuThuc) {
  d.dm_congthuc = (d.dm_congthuc || []).concat([{ "Mã công thức": ma, "Loại": "ALLOWANCE", "Trạng thái": "Hiệu lực", "Hiệu lực từ": "2026-01-01", "Biểu thức": bieuThuc }]);
}

test("V104-08: mã công tác có 'Loại công thức' trỏ tới công thức ALLOWANCE → dùng công thức (QC: 100.000 × 3 ngày / 2)", () => {
  const d = db({ "05": "1QC", "06": "1QC", "07": "1QC" });
  d.dm_phucap.forEach(x => { if (x["Mã phụ cấp"] === "QC") x["Loại công thức"] = "CT_QC"; });
  themCongThuc(d, "CT_QC", "MUC_PHU_CAP * CONG_HUONG_PHU_CAP / 2");
  assert.equal(pcCT(d), 150000);
});

test("V104-09: DQ (Công chuẩn 2) có công thức riêng → công thức quyết định số tiền, CONG_HUONG_PHU_CAP = số ngày BT có DQ", () => {
  const d = db({ "05": "1DQ", "06": "1DQ" });
  d.dm_phucap.forEach(x => { if (x["Mã phụ cấp"] === "DQ") x["Loại công thức"] = "CT_DQ"; });
  themCongThuc(d, "CT_DQ", "MUC_PHU_CAP * CONG_HUONG_PHU_CAP");
  assert.equal(pcCT(d), 1000000); // 500.000 × 2 ngày BT
});

test("V104-10: 'Loại công thức' trỏ tới mã không tồn tại trong Danh mục công thức → cách tính mặc định (không mất tiền)", () => {
  const d = db({ "05": "1QC" });
  d.dm_phucap.forEach(x => { if (x["Mã phụ cấp"] === "QC") x["Loại công thức"] = "KHONG_CO"; });
  assert.equal(pcCT(d), 100000);
});
