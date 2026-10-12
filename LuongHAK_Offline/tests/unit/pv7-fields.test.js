// PV-7 (PAYROLL_BUSINESS_VALIDATION.md): 3 trường chủ sở hữu chỉ ra còn thiếu/yếu trong app offline
// so với báo cáo thật (RP_BHXH / NL_CHITIET_NS / DM_BAC_TNCN) — đã đối chiếu dữ liệu thật, chủ sở
// hữu duyệt sửa (tin nhắn "làm hết 7a,7b,7c...").
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const HR = require("../../hr.js");
const E = require("../../engine.js");
const F = require("../fixtures/build.js");

function db1() {
  const db = F.baseDb();
  db.nhanvien.push({ "Mã NV": "NV001", "Họ và tên": "Nguyễn Văn A", "Trạng thái": "Đang làm việc" });
  db.canhan.push({ "Mã NV": "NV001", "Số CCCD": "049090000001", "Số sổ BHXH": "4900000001", "Hiệu lực từ": "2024-01-01" });
  db.hopdong.push({ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Ngày vào làm": "2024-03-01" });
  db.chitiethd.push({ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Hiệu lực từ": "2024-03-01", "Phòng ban": "02.01", "Mã lương": "CĐ",
    "Lương cơ bản": "9000000", "Lương thỏa thuận": "9000000", "Mức đóng bảo hiểm": "BH01", "Thuế TNCN": "LT01" });
  db.chamcong.push(F.ccRow("NV001", 2026, 9, "BT"));
  return db;
}

test("PV-7a: 'Số sổ BHXH' truyền từ canhan sang nhansu và xuất hiện trên báo cáo BHXH (bhRow)", () => {
  const db = db1();
  const sp = HR.staffForPayroll(db, 2026, 9);
  assert.equal(sp.list[0]["Số sổ BHXH"], "4900000001", "staffForPayroll phải copy Số sổ BHXH như Số CCCD");
  const kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list }), 2026, 9, false);
  assert.equal(kq.bhxh[0]["Số sổ BHXH"], "4900000001", "báo cáo BHXH (bhRow) phải có Số sổ BHXH");
});

test("PV-7a: không có canhan (hoặc chưa khai Số sổ BHXH) → rỗng, không lỗi", () => {
  const db = db1(); db.canhan = [];
  const sp = HR.staffForPayroll(db, 2026, 9);
  assert.equal(sp.list[0]["Số sổ BHXH"], "");
});

test("PV-7b: để trống 'Mã GT_TNCN_BT'/'Mã GT_TNCN_PT' trong phụ lục → tự nhận mã trong Danh mục giảm trừ (như trước đây)", () => {
  const db = db1();
  const sp = HR.staffForPayroll(db, 2026, 9);
  assert.equal(sp.list[0]["Mã GT_TNCN_BT"], "GTBT.01");
  assert.equal(sp.list[0]["Mã GT_TNCN_PT"], "GTNPT.01");
  assert.equal(sp.warn.length, 0, "chỉ 1 mã mỗi loại trong danh mục → không cảnh báo");
});

test("PV-7b: phụ lục CHỌN RIÊNG 'Mã GT_TNCN_BT'/'Mã GT_TNCN_PT' → dùng đúng mã đã chọn, không dùng mã tự nhận", () => {
  const db = db1();
  db.dm_giamtru.push({ "Mã giảm trừ": "GTBT.02", "Số người": 1, "Số tiền": 20000000, "Hiệu lực từ": "2026-01-01" });
  db.chitiethd[0]["Mã GT_TNCN_BT"] = "GTBT.02";
  const sp = HR.staffForPayroll(db, 2026, 9);
  assert.equal(sp.list[0]["Mã GT_TNCN_BT"], "GTBT.02", "phải ưu tiên mã đã chọn riêng trong phụ lục HĐ");
  assert.equal(sp.list[0]["Mã GT_TNCN_PT"], "GTNPT.01", "GT_TNCN_PT vẫn trống → vẫn tự nhận như cũ");
  // Không cảnh báo mơ hồ nữa vì đã chọn rõ GT_TNCN_BT (chỉ GT_TNCN_PT còn tự nhận, mà danh mục GTNPT chỉ có 1 mã)
  assert.equal(sp.warn.length, 0, sp.warn.join(" | "));
});

test("PV-7b: Danh mục giảm trừ có ≥2 mã GTBT nhưng phụ lục chưa chọn riêng → cảnh báo (không âm thầm đoán sai)", () => {
  const db = db1();
  db.dm_giamtru.push({ "Mã giảm trừ": "GTBT.02", "Số người": 1, "Số tiền": 20000000, "Hiệu lực từ": "2026-01-01" });
  const sp = HR.staffForPayroll(db, 2026, 9);
  assert.ok(sp.warn.some((w) => /Danh mục giảm trừ có 2 mã GTBT/.test(w)), sp.warn.join(" | "));
  assert.equal(sp.list[0]["Mã GT_TNCN_BT"], "GTBT.01", "vẫn tạm dùng mã tự nhận đầu tiên, không chặn tính lương");
});

test("PV-7c: 1 biểu thuế lũy tiến chung (không ghi 'Mã thuế TNCN') vẫn áp dụng cho mọi mã lũy tiến — không đổi số liệu cũ", () => {
  const db = db1();
  const sp = HR.staffForPayroll(db, 2026, 9);
  const kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list }), 2026, 9, false);
  assert.equal(kq.canhbao.some((w) => /không có biểu thuế lũy tiến/.test(w)), false);
});

test("PV-7c: 2 mã thuế lũy tiến khác nhau, mỗi mã 1 biểu riêng (ghi 'Mã thuế TNCN') → mỗi người chỉ tính theo đúng biểu của mã mình", () => {
  const luongCao = { "Lương thỏa thuận": "50000000", "Lương cơ bản": "50000000" }; // đủ lớn để vượt giảm trừ bản thân, có số thuế rõ ràng để so sánh
  const db = db1(); Object.assign(db.chitiethd[0], luongCao);
  // Thêm 1 mã thuế lũy tiến thứ 2 ("LT02") với biểu RIÊNG, nặng hơn hẳn LT01 — mô phỏng DM_BAC_TNCN thật (có cột Mã thuế TNCN)
  db.dm_tncn.push({ "Mã thuế TNCN": "LT02", "Nội dung": "Lũy tiến (đơn vị khác)", "Hiệu lực từ": "2020-01-01" });
  db.dm_bacthue.forEach((r) => { r["Mã thuế TNCN"] = "LT01"; }); // gắn biểu hiện có cho LT01
  db.dm_bacthue.push({ "Mã thuế TNCN": "LT02", "Bậc": 1, "Thu nhập từ": 0, "Thu nhập đến": 0, "Tỷ lệ": 0.35, "Hiệu lực từ": "2020-01-01" });
  const db2 = db1(); Object.assign(db2.chitiethd[0], luongCao, { "Thuế TNCN": "LT02" }); db2.dm_tncn = db.dm_tncn; db2.dm_bacthue = db.dm_bacthue;
  const sp1 = HR.staffForPayroll(db, 2026, 9), sp2 = HR.staffForPayroll(db2, 2026, 9);
  const k1 = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp1.list }), 2026, 9, false);
  const k2 = E.tinhBangLuong(Object.assign({}, db2, { nhansu: sp2.list }), 2026, 9, false);
  // Người dùng mã LT02 (biểu riêng 35% ngay từ đồng đầu) phải bị thuế CAO HƠN hẳn người dùng LT01 (biểu chuẩn, có bậc 5%/10%...)
  const thue1 = k1.tncn.length ? k1.tncn[0]["Thuế TNCN phải nộp"] : 0, thue2 = k2.tncn.length ? k2.tncn[0]["Thuế TNCN phải nộp"] : 0;
  assert.ok(thue1 > 0 && thue2 > 0, "cả 2 phải có thuế dương để so sánh được: " + thue1 + " / " + thue2);
  assert.ok(thue2 > thue1, "LT02 (biểu riêng 35%) phải nộp thuế nhiều hơn LT01 (biểu chuẩn): " + thue2 + " vs " + thue1);
});
