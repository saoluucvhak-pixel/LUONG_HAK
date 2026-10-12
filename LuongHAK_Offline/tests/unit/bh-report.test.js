// Báo cáo bảo hiểm (2.0-α18): chỉ cộng / so sánh bảng BHXH engine đã tính — không tính lại
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const BH = require("../../core/bh-report.js");

const row = (ma, pb, luong, du) => {
  const r = { "Mã NV": ma, "Họ và tên": ma + " Tên", "Phòng ban": pb, "Lương đóng BHXH": luong,
    "CTY.BHXH": luong * 0.175, "CTY.BHYT": luong * 0.03, "CTY.BHTN": luong * 0.01, "CTY.KPCĐ": luong * 0.02,
    "NLĐ.BHXH": luong * 0.08, "NLĐ.BHYT": luong * 0.015, "NLĐ.BHTN": luong * 0.01 };
  r["Cộng BH công ty đóng"] = r["CTY.BHXH"] + r["CTY.BHYT"] + r["CTY.BHTN"] + r["CTY.KPCĐ"];
  r["Cộng BH NLĐ đóng"] = du ? r["NLĐ.BHXH"] + r["NLĐ.BHYT"] + r["NLĐ.BHTN"] : 0;
  r["Truy thu bảo hiểm"] = du ? 0 : r["Cộng BH công ty đóng"];
  r["Ghi chú"] = du ? "Đủ ngưỡng" : "Chưa đủ ngưỡng (2/14 công)";
  return r;
};
const kq9 = { bhxh: [row("NV001", "Văn phòng", 6000000, true), row("NV002", "Xưởng", 5000000, true), row("NV003", "Xưởng", 4000000, false)] };
const kq8 = { bhxh: [row("NV001", "Văn phòng", 5500000, true), row("NV002", "Xưởng", 5000000, true), row("NV009", "Xưởng", 4000000, true)] };

test("U-BHR-01 tổng hợp theo khoản: công ty đóng đủ mọi người; NLĐ chỉ người đủ ngưỡng (đúng số đã trừ lương); KPCĐ tách riêng", () => {
  const t = BH.tongHop(kq9), by = Object.fromEntries(t.rows.map((r) => [r["Khoản"], r]));
  assert.equal(by.BHXH["Công ty đóng"], 15000000 * 0.175); assert.equal(by.BHXH["Người lao động đóng (trừ lương)"], 11000000 * 0.08);
  assert.equal(by["KPCĐ (nộp công đoàn)"]["Người lao động đóng (trừ lương)"], 0);
  const sumNLD = kq9.bhxh.reduce((a, r) => a + r["Cộng BH NLĐ đóng"], 0), sumCty = kq9.bhxh.reduce((a, r) => a + r["Cộng BH công ty đóng"], 0);
  assert.ok(Math.abs(by["TỔNG"]["Người lao động đóng (trừ lương)"] - sumNLD) < 1e-6); assert.ok(Math.abs(by["TỔNG"]["Công ty đóng"] - sumCty) < 1e-6);
  assert.equal(t.soNguoi, 3); assert.equal(t.chuaDuNguong, 1); assert.equal(t.truyThu, kq9.bhxh[2]["Cộng BH công ty đóng"]); assert.ok(Math.abs(t.lechNLD) < 1e-6);
});

test("U-BHR-02 tăng / giảm / điều chỉnh mức đóng so với kỳ trước", () => {
  const b = BH.bienDong(kq9, kq8), by = Object.fromEntries(b.map((r) => [r["Mã NV"], r]));
  assert.equal(by.NV003["Loại"], "Tăng (mới tham gia trong kỳ)");
  assert.equal(by.NV009["Loại"], "Giảm (không còn đóng trong kỳ)");
  assert.deepEqual([by.NV001["Loại"], by.NV001["Lương đóng kỳ trước"], by.NV001["Lương đóng kỳ này"]], ["Điều chỉnh mức đóng", 5500000, 6000000]);
  assert.equal(by.NV002, undefined, "không đổi → không có dòng");
  assert.equal(BH.bienDong(kq9, null).length, 3, "không có kỳ trước → tất cả là tăng");
});

test("U-BHR-03 theo phòng ban + chi tiết: tổng các phòng = tổng chi tiết = tổng bảng BHXH; không đổi dữ liệu nguồn", () => {
  const before = JSON.stringify(kq9);
  const pb = BH.theoPhongBan(kq9), ct = BH.chiTiet(kq9), tot = pb[pb.length - 1], ctt = ct[ct.length - 1];
  assert.equal(pb.find((r) => r["Phòng ban"] === "Xưởng")["Số người"], 2);
  assert.equal(tot["Số người"], 3); assert.equal(tot["Lương đóng BHXH"], 15000000); assert.equal(ctt["Lương đóng BHXH"], 15000000);
  assert.ok(Math.abs(tot["Cộng BH công ty đóng"] - ctt["Cộng BH công ty đóng"]) < 1e-6);
  assert.equal(tot["Tổng BH (công ty + NLĐ + truy thu)"], tot["Cộng BH công ty đóng"] + tot["Cộng BH NLĐ đóng"] + tot["Truy thu bảo hiểm"]);
  assert.equal(JSON.stringify(kq9), before);
  assert.deepEqual(BH.chiTiet({ bhxh: [] }), []); assert.deepEqual(BH.theoPhongBan({}), []);
});

test("U-BHR-04 KPCĐ NLĐ là cột riêng (không gộp trong 'Cộng BH NLĐ đóng') → tổng NLĐ có KPCĐ, KHÔNG báo chênh lệch giả", () => {
  const k = { bhxh: kq9.bhxh.map((r) => Object.assign({}, r, { "NLĐ.KPCĐ": r["Ghi chú"] === "Đủ ngưỡng" ? r["Lương đóng BHXH"] * 0.005 : 0 })) };
  const t = BH.tongHop(k), by = Object.fromEntries(t.rows.map((r) => [r["Khoản"], r]));
  assert.equal(by["KPCĐ (nộp công đoàn)"]["Người lao động đóng (trừ lương)"], 11000000 * 0.005);
  assert.ok(Math.abs(t.lechNLD) < 1e-6, "lệch " + t.lechNLD);
});
