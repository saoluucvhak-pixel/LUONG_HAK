// Kiểm thử tích hợp — giai đoạn sửa lỗi 2.0: chấm công nhiều dòng, hồi tố, chốt/mở chốt/chốt lại, lưu thất bại, khôi phục, migration
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const E = require("../../engine.js");
const HR = require("../../hr.js");
const IMP = require("../../core/importer.js");
const INT = require("../../core/integrity.js");
const CLS = require("../../core/payroll-close.js");
const GRD = require("../../core/period-guard.js");
const SCH = require("../../core/schema.js");
const { createStorage } = require("../../main/storage.js");
const { baseDb } = require("../fixtures/build.js");

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const CC_COLS = ["Kỳ", "Mã NV", "Hình thức công"].concat(DAYS);
function payroll(db, nam, thang) {
  const sp = HR.staffForPayroll(db, nam, thang);
  const kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list }), nam, thang, false);
  kq.canhbao = sp.warn.concat(kq.canhbao);
  return { kq, staff: sp.list };
}
function db1() {
  const db = baseDb();
  db.nhanvien = [{ "Mã NV": "NV001", "Họ và tên": "Nguyễn Văn An", "Trạng thái": "Đang làm việc" }];
  db.hopdong = [{ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Ngày vào làm": "2025-01-01", "Hình thức HĐLĐ": "Xác định thời hạn" }];
  db.chitiethd = [{ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Hiệu lực từ": "2025-01-01", "Phòng ban": "02.01", "Mã lương": "CN1", "Lương thỏa thuận": "300000", "Mức đóng bảo hiểm": "BH00", "Thuế TNCN": "MT00", "HTTT": "Tiền mặt" }];
  return db;
}
function half(from, to, ht) { const r = { "Kỳ": "2026-09", "Mã NV": "NV001", "Hình thức công": ht || "BT" }; DAYS.forEach((d) => { r[d] = ""; }); for (let d = from; d <= to; d++) r[String(d).padStart(2, "0")] = 1; return r; }
const tl = (db) => payroll(db, 2026, 9).kq.bangluong[0]["Thực lĩnh"];
function close(db, ky, user) { const [y, m] = ky.split("-").map(Number), p = payroll(db, y, m); return CLS.close(db, CLS.buildSnapshot(db, ky, p.kq, p.staff, { user })); }

test("I-09 chấm công 2 file (nửa đầu + bổ sung nửa cuối) + file tách dòng → lương đúng 30 công, nhập lại không đổi", () => {
  const db = db1();
  IMP.apply(db, IMP.plan(db, "chamcong", CC_COLS, [half(1, 15)]));
  IMP.apply(db, IMP.plan(db, "chamcong", CC_COLS, [half(16, 30)]));
  assert.equal(tl(db), 30 * 300000);
  const again = IMP.plan(db, "chamcong", CC_COLS, [half(1, 10), half(11, 30)]); // file đủ tháng nhưng tách 2 dòng
  assert.equal(again.summary.merged, 1); assert.equal(again.summary.duplicate, 1);
  IMP.apply(db, again); assert.equal(tl(db), 9000000); assert.equal(db.chamcong.length, 1);
});

test("I-10 thay đổi HỒI TỐ sau khi chốt: phụ lục tăng lương hiệu lực trong kỳ đã chốt → bảng lương đã chốt KHÔNG đổi; mở chốt → chốt lại v2 có chênh lệch", () => {
  const db = db1(); IMP.apply(db, IMP.plan(db, "chamcong", CC_COLS, [half(1, 26)]));
  const v1 = close(db, "2026-09", "kt1");
  const pl = { "Mã NV": "NV001", "Số HĐLĐ": "H1", "Hiệu lực từ": "2026-09-01", "Mã lương": "CN1", "Lương thỏa thuận": "350000", "Mức đóng bảo hiểm": "BH00", "Thuế TNCN": "MT00" };
  const imp = GRD.impactChange(db, "chitiethd", null, pl);
  assert.deepEqual(imp, { kind: "retro", periods: ["2026-09"] });
  db.chitiethd.push(pl);
  assert.equal(CLS.current(db, "2026-09").kq.bangluong[0]["Thực lĩnh"], 26 * 300000, "snapshot bất biến");
  assert.equal(CLS.verify(CLS.current(db, "2026-09")), "ok");
  assert.equal(tl(db), 26 * 350000); // tính tạm từ dữ liệu hiện tại đã khác
  const h = CLS.reopen(db, "2026-09", "Áp dụng phụ lục hồi tố", { user: "kt2" });
  const v2 = close(db, "2026-09", "kt2");
  assert.equal(v2.version, 2); assert.equal(h.moChot.nguoi, "kt2"); assert.equal(v1.nguoiChot, "kt1");
  const d = CLS.diff(h.kq, v2.kq);
  assert.ok(d.some((x) => x["Mã NV"] === "NV001" && x["Chênh lệch"] === 26 * 50000), JSON.stringify(d));
  assert.equal(CLS.history(db, "2026-09").length, 1);
});

test("I-11 mọi đường nhập vào kỳ đã chốt đều bị chặn: Excel (kể cả cập nhật dòng cũ), chuyển kỳ, sản lượng/thưởng/tạm ứng", () => {
  const db = db1(); IMP.apply(db, IMP.plan(db, "chamcong", CC_COLS, [half(1, 26)]));
  close(db, "2026-09");
  const locked = { "2026-09": true };
  const p = IMP.plan(db, "chamcong", CC_COLS, [half(1, 30)], { lockedPeriods: locked });
  assert.equal(p.summary.locked, 1);
  for (const [t, cols, r] of [
    ["sanluong", ["Phiếu cân", "Ngày cân", "KL hàng (Tấn)", "Mã NV"], { "Phiếu cân": "P1", "Ngày cân": "2026-09-05", "KL hàng (Tấn)": "10", "Mã NV": "NV001" }],
    ["psluong", ["Ngày hạch toán", "Mã NV", "Thưởng"], { "Ngày hạch toán": "30/09/2026", "Mã NV": "NV001", "Thưởng": "500.000" }],
    ["ungluong", ["Ngày hạch toán", "Mã NV", "Tạm ứng"], { "Ngày hạch toán": "2026-09-15", "Mã NV": "NV001", "Tạm ứng": "1000000" }]
  ]) assert.equal(IMP.plan(db, t, cols, [r], { lockedPeriods: locked }).summary.locked, 1, t);
  assert.equal(GRD.impactChange(db, "chamcong", half(1, 3, "TC"), Object.assign(half(1, 3, "TC"), { "Kỳ": "2026-10" })).kind, "locked");
});

test("I-12 lưu dữ liệu THẤT BẠI khi chốt → hoàn tác, kỳ vẫn chưa chốt; file trên đĩa không đổi", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hak-v2-")), s = createStorage(dir), db = db1();
  IMP.apply(db, IMP.plan(db, "chamcong", CC_COLS, [half(1, 26)]));
  assert.equal(s.save(JSON.stringify(db)), true);
  const before = fs.readFileSync(s.dataFile, "utf8");
  const full = createStorage(dir, { fs: Object.assign({}, fs, { writeSync: () => { throw Object.assign(new Error("x"), { code: "ENOSPC" }); } }) });
  const snap = close(db, "2026-09");
  const r = full.save(JSON.stringify(db));
  assert.notEqual(r, true);
  CLS.rollbackClose(db, snap); // app làm đúng bước này khi saveNow() trả false
  assert.equal(CLS.current(db, "2026-09"), null);
  assert.equal(fs.readFileSync(s.dataFile, "utf8"), before);
});

test("I-13 khôi phục từ bản sao lưu: bản tốt khôi phục được; bản bị sửa bị từ chối; dữ liệu khôi phục qua được kiểm tra cấu trúc", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hak-v2-")), s = createStorage(dir), db = db1();
  IMP.apply(db, IMP.plan(db, "chamcong", CC_COLS, [half(1, 26)])); close(db, "2026-09");
  s.save(JSON.stringify(db)); const name = s.backup("thu-cong");
  s.save(JSON.stringify(Object.assign({}, db, { nhanvien: [] })));
  const r = s.readBackup(name); assert.equal(r.ok, true);
  const back = JSON.parse(r.text);
  assert.equal(SCH.validate(back, { tables: Object.keys(back).filter((k) => k !== "schemaVersion") }).ok, true);
  assert.equal(back.nhanvien.length, 1); assert.equal(CLS.verify(back.kyluong[0]), "ok");
  fs.writeFileSync(path.join(s.backupDir, name), JSON.stringify(Object.assign(back, { nhanvien: [] })));
  assert.equal(s.readBackup(name).ok, false);
});

test("I-14 dữ liệu 1.4.0 có dòng chấm công trùng + 'bt' thường: chuẩn hóa + gộp → lương không đổi, kiểm tra cấu trúc sạch", () => {
  const db = db1();
  db.chamcong.push(Object.assign(half(1, 15), { "Hình thức công": "bt", "Kỳ": "2026-9" }), half(16, 26));
  const t0 = tl(db);
  INT.normalizeDataset(db);
  const r = INT.mergeChamCong(db, {});
  assert.equal(r.groups, 1); assert.equal(db.chamcong.length, 1); assert.equal(db.chamcong[0]["Hình thức công"], "BT");
  assert.equal(tl(db), t0);
  db.schemaVersion = 2;
  const rep = SCH.validate(db, { tables: Object.keys(db).filter((k) => k !== "schemaVersion"), hrTables: ["hopdong", "chitiethd"] });
  assert.deepEqual(rep.fatal, []); assert.deepEqual(rep.errors, []);
});
