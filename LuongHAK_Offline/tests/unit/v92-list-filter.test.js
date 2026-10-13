// V9.2 — bộ lọc Chấm công / Sản lượng / Bơm dăm (core/list-filter.js)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../../core/list-filter.js");

const cc = [
  { "Mã NV": "A", "Hình thức công": "BT" }, { "Mã NV": "B", "Hình thức công": "TC" },
  { "Mã NV": "C", "Hình thức công": "" }, { "Mã NV": "D" }, { "Mã NV": "E", "Hình thức công": "pn" },
];
test("U-LF-01: hình thức công chọn nhiều + 'không có hình thức' + không phân biệt hoa thường", () => {
  assert.deepEqual(L.chamCong(cc, { ht: ["BT", "PN"] }).map((r) => r["Mã NV"]), ["A", "E"]);
  assert.deepEqual(L.chamCong(cc, { ht: [L.NONE] }).map((r) => r["Mã NV"]), ["C", "D"]);
  assert.deepEqual(L.chamCong(cc, { ht: ["TC", L.NONE] }).map((r) => r["Mã NV"]), ["B", "C", "D"]);
  assert.equal(L.chamCong(cc, {}).length, 5);
});
test("U-LF-02: kết hợp phòng ban/tổ/từ khóa không dấu với hình thức công", () => {
  const ctx = { nv: { A: { pb: "Sản xuất", to: "T1", ten: "Nguyễn Văn Đức" }, B: { pb: "Sản xuất", to: "T2", ten: "Lê Bình" }, E: { pb: "Kho", to: "", ten: "Đỗ An" } } };
  assert.deepEqual(L.chamCong(cc, { ht: ["BT", "TC"], pb: ["san xuat"] }, ctx).map((r) => r["Mã NV"]), ["A", "B"]);
  assert.deepEqual(L.chamCong(cc, { q: "duc" }, ctx).map((r) => r["Mã NV"]), ["A"]);
  assert.deepEqual(L.chamCong(cc, { to: [L.NONE] }, ctx).map((r) => r["Mã NV"]), ["C", "D", "E"]);
});

const pc = [
  { "Phiếu cân": "P1", "Ngày cân": "2026-09-30", "KL hàng (Tấn)": "10,5", "Mã phòng ban": "TO1" },
  { "Phiếu cân": "P2", "Ngày cân": "2026-10-01", "KL hàng (Tấn)": 4, "Mã phòng ban": "TO2" },
  { "Phiếu cân": "P3", "Ngày cân": "2026-10-02", "KL hàng (Tấn)": 6, "Mã phòng ban": "" },
  { "Phiếu cân": "P3", "Ngày cân": "2026-10-02", "KL hàng (Tấn)": 6, "Mã phòng ban": "" },
  { "Phiếu cân": "P4", "Ngày cân": "2026-10-03", "KL hàng (Tấn)": 2, "Mã phòng ban": "TO1", "Mã NV": "A" },
];
test("U-LF-03: từ ngày–đến ngày gồm cả hai đầu, vượt tháng; phòng ban nhiều lựa chọn", () => {
  assert.deepEqual(L.phieuCan(pc, { tu: "2026-09-30", den: "2026-10-01" }).map((r) => r["Phiếu cân"]), ["P1", "P2"]);
  assert.deepEqual(L.phieuCan(pc, { pb: ["to1", "TO2"] }).map((r) => r["Phiếu cân"]), ["P1", "P2", "P4"]);
  assert.deepEqual(L.phieuCan(pc, { thang: "2026-10", pb: [L.NONE] }).map((r) => r["Phiếu cân"]), ["P3", "P3"]);
});
test("U-LF-04: tổng tính lại từ dòng đã lọc, phiếu trùng khóa chỉ tính một lần", () => {
  const t = L.tongPhieuCan(L.phieuCan(pc, { thang: "2026-10" }));
  assert.equal(t.soPhieu, 3);
  assert.equal(t.tongKL, 12);
  assert.deepEqual(t.trung, ["P3"]);
  assert.equal(t.theoNgay["2026-10-02"], 6);
  assert.equal(t.theoPhongBan["TO1"], 2);
  assert.equal(t.theoPhongBan["(không phòng ban)"], 6);
  assert.equal(t.daPhanBo, 6); assert.equal(t.choPhanBo, 6);
  assert.equal(L.tongPhieuCan(pc).tongKL, 22.5); // 10,5 + 4 + 6 + 2 (P3 trùng bỏ)
  assert.equal(L.tongPhieuCan([]).tongKL, 0);
});
