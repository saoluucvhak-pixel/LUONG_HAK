// Checklist 20 điểm trước khi chốt kỳ lương (Master Prompt V3 mục XVIII) — core/pre-close-checklist.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../engine.js");
const PCC = require("../../core/pre-close-checklist.js");
const { baseDb, ccRow, staff } = require("../fixtures/build.js");

function item(r, id) { return r.items.find((x) => x.id === id); }

test("dữ liệu sạch: đủ 21 điểm (20 điểm V3 + FORMULA_ERROR), không điểm nào 'loi'", () => {
  const db = baseDb();
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000" })];
  db.chamcong = [ccRow("NV", 2026, 9)];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  const r = PCC.run({ db, kq });
  assert.equal(r.items.length, 21);
  assert.equal(r.loiCount, 0);
  assert.ok(r.items.every((x) => ["ok", "canhbao", "loi"].includes(x.trangThai)));
});

test("#4: mã lương nhân viên không có trong danh mục → 'loi'", () => {
  const db = baseDb();
  db.nhansu = [staff({ "Mã tiền lương 1": "MA_LA", "Lương thỏa thuận": "9000000" })];
  db.chamcong = [ccRow("NV", 2026, 9)];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  const r = PCC.run({ db, kq });
  assert.equal(item(r, 4).trangThai, "loi");
  assert.ok(item(r, 4).chiTiet.some((m) => /MA_LA/.test(m)));
});

test("#5: mã tăng ca gán cho NV nhưng không có trong danh mục → 'canhbao' (không chặn cứng, vẫn tính được 0đ)", () => {
  const db = baseDb();
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã tăng ca": "TC_LA" })];
  db.chamcong = [ccRow("NV", 2026, 9)];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  const r = PCC.run({ db, kq });
  assert.equal(item(r, 5).trangThai, "canhbao");
});

test("#8: phiếu cân trùng khóa (Phiếu cân + Mã NV) → 'loi'", () => {
  const db = baseDb();
  db.nhansu = [staff({ "Mã tiền lương 1": "SP", "Lương thỏa thuận": "200000" })];
  db.chamcong = [ccRow("NV", 2026, 9)];
  db.sanluong = [
    { "Phiếu cân": "P1", "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "10", "Mã NV": "NV" },
    { "Phiếu cân": "P1", "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "10", "Mã NV": "NV" },
  ];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  const r = PCC.run({ db, kq });
  assert.equal(item(r, 8).trangThai, "loi");
});

test("#9: sản lượng chưa phân bổ hết (unallocated > 0) → 'loi'; #7: có warnings phân bổ → 'canhbao'", () => {
  const r = PCC.run({ db: baseDb(), kq: { bangluong: [], canhbao: [] }, slAlloc: { unallocated: 5, warnings: ["Phiếu P9 dùng mã tổ lạ"] } });
  assert.equal(item(r, 9).trangThai, "loi");
  assert.ok(item(r, 9).chiTiet.some((m) => /5 tấn chưa phân bổ/.test(m)));
  assert.equal(item(r, 7).trangThai, "canhbao");
});

test("#10: có sản lượng nhưng thiếu chấm công BT ngày đó → 'loi'", () => {
  const db = baseDb();
  db.dm_luong.find((x) => x["Mã lương"] === "SP")["Đơn giá bù lương"] = "200000";
  db.nhansu = [staff({ "Mã tiền lương 1": "SP", "Lương thỏa thuận": "200000" })];
  db.chamcong = [];
  db.sanluong = [{ "Phiếu cân": "P1", "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "3", "Mã NV": "NV" }];
  const kq = E.tinhBangLuong(db, 2026, 9, "daihiep");
  const r = PCC.run({ db, kq });
  assert.equal(item(r, 10).trangThai, "loi");
});

test("#15: nhãn công tác không có mã phụ cấp tương ứng → 'canhbao'", () => {
  const db = baseDb();
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000" })];
  db.chamcong = [ccRow("NV", 2026, 9, "BT", "1XYZ", 3)];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  const r = PCC.run({ db, kq });
  assert.equal(item(r, 15).trangThai, "canhbao");
});

test("#16/#17: thuế TNCN và bảo hiểm thiếu danh mục → 'canhbao'", () => {
  const db = baseDb();
  db.nhansu = [staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã TNCN": "TNCN_LA", "Mã BHXH": "BH_LA" })];
  db.chamcong = [ccRow("NV", 2026, 9)];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  const r = PCC.run({ db, kq });
  assert.equal(item(r, 16).trangThai, "canhbao");
  assert.equal(item(r, 17).trangThai, "canhbao");
});

test("#18/#20: 'Tổng thu nhập'/'Thực lĩnh' trên bảng lương không khớp với cộng dồn từ các cột thành phần → 'loi' (phát hiện lỗi/giả mạo dữ liệu)", () => {
  const kq = { bangluong: [{ "Mã NV": "X", "Họ và tên": "X", "Lương thời gian": 9000000, "Tổng thu nhập": 1, "Thực lĩnh": 1 }], canhbao: [] };
  const r = PCC.run({ db: baseDb(), kq: kq });
  assert.equal(item(r, 18).trangThai, "loi");
  assert.equal(item(r, 20).trangThai, "loi");
});

test("#18/#20: dữ liệu thật từ tinhBangLuong() luôn tự khớp (bảng lương do engine xuất ra không bao giờ bị cross-check này báo 'loi')", () => {
  const db = baseDb();
  db.nhansu = [
    staff({ "Mã tiền lương 1": "TG1", "Lương thỏa thuận": "9000000", "Mã phụ cấp": "TN.02" }),
    staff({ "Mã nhân viên": "NV2", "Mã tiền lương 1": "SP", "Lương thỏa thuận": "200000" }),
  ];
  db.chamcong = [ccRow("NV", 2026, 9), ccRow("NV2", 2026, 9)];
  db.sanluong = [{ "Phiếu cân": "P1", "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "10", "Mã NV": "NV2" }];
  const kq = E.tinhBangLuong(db, 2026, 9, false);
  const r = PCC.run({ db, kq });
  assert.equal(item(r, 18).trangThai, "ok");
  assert.equal(item(r, 20).trangThai, "ok");
});
