// Kiểm thử tích hợp các luồng nghiệp vụ chính (không qua giao diện)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const E = require("../../engine.js");
const HR = require("../../hr.js");
const IMP = require("../../core/importer.js");
const INT = require("../../core/integrity.js");
const CLS = require("../../core/payroll-close.js");
const { createStorage } = require("../../main/storage.js");
const { baseDb, ccRow } = require("../fixtures/build.js");

const CC_COLS = ["Kỳ", "Mã NV", "Hình thức công"].concat(Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")));
function payroll(db, nam, thang) {
  const sp = HR.staffForPayroll(db, nam, thang);
  const kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list }), nam, thang, false);
  kq.canhbao = sp.warn.concat(kq.canhbao);
  return { kq, staff: sp.list };
}
function oneEmployee() {
  const db = baseDb();
  db.nhanvien = [{ "Mã NV": "NV001", "Họ và tên": "Nguyễn Văn An", "Trạng thái": "Đang làm việc" }];
  db.hopdong = [{ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Ngày vào làm": "2025-01-01", "Hình thức HĐLĐ": "Xác định thời hạn" }];
  db.chitiethd = [{ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Hiệu lực từ": "2025-01-01", "Phòng ban": "02.01", "Mã lương": "TG1", "Lương thỏa thuận": "20000000", "Lương cơ bản": "6000000", "Mức đóng bảo hiểm": "BH01", "Thuế TNCN": "LT01", "HTTT": "Chuyển khoản" }];
  db.thanhtoan = [{ "Mã NV": "NV001", "Số tài khoản": "0123", "Tên ngân hàng": "VCB", "Hiệu lực từ": "2025-01-01" }];
  return db;
}

test("Import chấm công (Excel) → Tính lương; nhập lại cùng file KHÔNG làm tăng lương", () => {
  const db = oneEmployee(), xl = [ccRow("NV001", 2026, 9)];
  IMP.apply(db, IMP.plan(db, "chamcong", CC_COLS, xl));
  const t1 = payroll(db, 2026, 9).kq.bangluong[0]["Thực lĩnh"];
  IMP.apply(db, IMP.plan(db, "chamcong", CC_COLS, xl));
  assert.equal(db.chamcong.length, 1);
  assert.equal(payroll(db, 2026, 9).kq.bangluong[0]["Thực lĩnh"], t1);
  // 20tr − BH 630.000 − thuế (20tr − 0,63tr − 15,5tr = 3,87tr × 5% = 193.500) = 19.176.500 → 19.177.000
  assert.equal(t1, 19177000);
});

test("Hợp đồng → phụ lục tăng lương có hiệu lực 01/09 → tháng 8 lương cũ, tháng 9 lương mới", () => {
  const db = oneEmployee();
  db.chitiethd.push(Object.assign({}, db.chitiethd[0], { "Hiệu lực từ": "2026-09-01", "Lương thỏa thuận": "25000000" }));
  db.chamcong = [ccRow("NV001", 2026, 8), ccRow("NV001", 2026, 9)];
  assert.equal(payroll(db, 2026, 8).kq.bangluong[0]["Lương thời gian"], 20000000);
  assert.equal(payroll(db, 2026, 9).kq.bangluong[0]["Lương thời gian"], 25000000);
});

test("Người phụ thuộc lấy từ Nhân thân còn hiệu lực trong kỳ", () => {
  const db = oneEmployee(); db.chamcong = [ccRow("NV001", 2026, 9), ccRow("NV001", 2026, 12)];
  db.nhanthan = [{ "Mã NV": "NV001", "Họ tên nhân thân": "Con", "Đăng ký phụ thuộc": "Có", "Hiệu lực từ": "2024-01-01", "Hiệu lực đến": "2026-10-31" }];
  assert.equal(HR.staffForPayroll(db, 2026, 9).list[0]["Người phụ thuộc"], 1);
  assert.equal(HR.staffForPayroll(db, 2026, 12).list[0]["Người phụ thuộc"], 0);
});

test("Nghỉ việc: hợp đồng chấm dứt 15/08 → tháng 9 không tính lương; trạng thái mâu thuẫn có cảnh báo", () => {
  const db = oneEmployee(); db.hopdong[0]["Ngày chấm dứt"] = "2026-08-15";
  assert.equal(HR.staffForPayroll(db, 2026, 9).list.length, 0);
  assert.equal(HR.staffForPayroll(db, 2026, 8).list.length, 1);
  const db2 = oneEmployee(); db2.nhanvien[0]["Trạng thái"] = "Đã nghỉ việc";
  assert.ok(HR.staffForPayroll(db2, 2026, 9).warn.some((w) => /chưa có Ngày chấm dứt/.test(w)));
});

test("Sản lượng → tính lương sản phẩm; phiếu cân chia nhiều người có cảnh báo đối chiếu", () => {
  const db = oneEmployee(); db.chitiethd[0]["Mã lương"] = "SP"; db.chitiethd[0]["Lương thỏa thuận"] = "0";
  db.nhanvien.push({ "Mã NV": "NV002", "Họ và tên": "B", "Trạng thái": "Đang làm việc" });
  db.chamcong = [ccRow("NV001", 2026, 9)];
  db.sanluong = [{ "Phiếu cân": "P1", "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "20", "Mã NV": "NV001" }, { "Phiếu cân": "P1", "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "10", "Mã NV": "NV002" }];
  const r = payroll(db, 2026, 9).kq.bangluong.find((x) => x["Mã NV"] === "NV001");
  assert.equal(r["Lương sản lượng"], 120000); // 20 tấn × 6.000 (chỉ phần được phân bổ cho NV001)
  assert.ok(INT.check(db).some((i) => /chia cho nhiều dòng/.test(i.msg)));
});

test("Chốt lương → sửa dữ liệu → số đã chốt KHÔNG đổi; mở chốt + chốt lại tạo phiên bản 2 và so sánh trước/sau", () => {
  const db = oneEmployee(); db.chamcong = [ccRow("NV001", 2026, 9)];
  const a = payroll(db, 2026, 9), s1 = CLS.close(db, CLS.buildSnapshot(db, "2026-09", a.kq, a.staff, {}));
  db.chitiethd[0]["Lương thỏa thuận"] = "30000000";
  assert.equal(CLS.current(db, "2026-09").kq.bangluong[0]["Thực lĩnh"], 19177000);
  assert.equal(s1.input.staff[0]["Lương thỏa thuận"], "20000000");
  CLS.reopen(db, "2026-09", "Điều chỉnh lương");
  const b = payroll(db, 2026, 9), s2 = CLS.close(db, CLS.buildSnapshot(db, "2026-09", b.kq, b.staff, {}));
  assert.equal(s2.version, 2);
  const d = CLS.diff(CLS.history(db, "2026-09")[0].kq, s2.kq);
  assert.equal(d.length, 1); assert.ok(d[0]["Chênh lệch"] > 0);
});

test("Sao lưu → khôi phục: dữ liệu khôi phục khớp bản gốc", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hak-int-")), s = createStorage(dir);
  const db = oneEmployee(); db.chamcong = [ccRow("NV001", 2026, 9)];
  s.save(JSON.stringify(db)); const name = s.backup("thu-cong");
  s.save(JSON.stringify({ nhanvien: [] }));
  const restored = JSON.parse(s.readBackup(name).text);
  assert.deepEqual(restored, JSON.parse(JSON.stringify(db)));
  assert.equal(payroll(restored, 2026, 9).kq.bangluong[0]["Thực lĩnh"], 19177000);
});

test("Migration v1.0 → hiện tại: bảng Nhân sự phẳng chuyển sang hồ sơ + HĐ; lương giữ nguyên", () => {
  const db = baseDb();
  db.nhansu = [{ "Mã nhân viên": "A1", "Họ và tên": "Cũ", "Lương thỏa thuận": "9.000.000", "Mã tiền lương 1": "TG1", "Mã BHXH": "BH01", "Mã TNCN": "TNCN2", "Mã GT_TNCN_BT": "GTBT.01", "Người phụ thuộc": "1", "Số CCCD": "49090001234" }];
  db.chamcong = [ccRow("A1", 2026, 9)];
  HR.migrate(db); INT.normalizeDataset(db);
  assert.equal(db.nhanvien.length, 1); assert.equal(db.chitiethd[0]["Lương thỏa thuận"], "9000000");
  assert.equal(db.nhanvien[0]["Số CCCD"], "049090001234");
  const r = payroll(db, 2026, 9).kq.bangluong[0];
  assert.equal(r["Lương thời gian"], 9000000); assert.equal(r["BH trừ NLĐ"], 945000);
});
