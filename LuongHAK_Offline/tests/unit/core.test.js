"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../../core/validate.js");
const IMP = require("../../core/importer.js");
const INT = require("../../core/integrity.js");
const CLS = require("../../core/payroll-close.js");
const { baseDb, ccRow } = require("../fixtures/build.js");

// ---------- validate ----------
test("parseMoney: định dạng Việt Nam, quốc tế, số thuần", () => {
  assert.equal(V.parseMoney("500.000"), 500000);
  assert.equal(V.parseMoney("1.500.000"), 1500000);
  assert.equal(V.parseMoney("1.500.000,5"), 1500000.5);
  assert.equal(V.parseMoney("1,500,000"), 1500000);
  assert.equal(V.parseMoney("9000000"), 9000000);
  assert.equal(V.parseMoney(" 2.000.000 đ "), 2000000);
  assert.equal(V.parseMoney("-200.000"), -200000);
  assert.equal(V.parseMoney(""), 0);
  assert.ok(isNaN(V.parseMoney("abc")));
  assert.equal(V.normMoney("300.000"), "300000");
});
test("normDate / normKy / normId", () => {
  assert.equal(V.normDate("15/09/2026"), "2026-09-15");
  assert.equal(V.normDate("2026-9-5"), "2026-09-05");
  assert.equal(V.normDate(new Date(2026, 8, 15)), "2026-09-15");
  assert.equal(V.normDate(46280), "2026-09-15"); // serial Excel (1899-12-30 + 46280)
  assert.equal(V.normDate("31/02/2026"), null);
  assert.equal(V.normKy("2026-9"), "2026-09");
  assert.equal(V.normKy("09/2026"), "2026-09");
  assert.equal(V.normKy("13/2026"), null);
  assert.equal(V.normId("Số CCCD", 49090001234), "049090001234");
  assert.equal(V.normId("Số điện thoại", "905123456"), "0905123456");
  assert.equal(V.rowPeriod("psluong", { "Ngày hạch toán": "28/09/2026" }), "2026-09");
});

// ---------- importer ----------
const CC_COLS = ["Kỳ", "Mã NV", "Hình thức công"].concat(Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")));
function dbWithNV() { const db = baseDb(); db.nhanvien = [{ "Mã NV": "NV001", "Họ và tên": "A" }, { "Mã NV": "NV002", "Họ và tên": "B" }]; return db; }

test("nhập chấm công 2 lần: lần 2 là trùng/cập nhật, KHÔNG nhân đôi dòng", () => {
  const db = dbWithNV(), rows = [{ "Kỳ": "2026-09", "Mã NV": "NV001", "Hình thức công": "BT", "01": 1, "02": 1 }];
  const p1 = IMP.plan(db, "chamcong", CC_COLS, rows); assert.equal(p1.summary.add, 1); IMP.apply(db, p1);
  const p2 = IMP.plan(db, "chamcong", CC_COLS, rows); assert.equal(p2.summary.duplicate, 1); assert.equal(p2.summary.add, 0); IMP.apply(db, p2);
  assert.equal(db.chamcong.length, 1);
  const p3 = IMP.plan(db, "chamcong", CC_COLS, [{ "Kỳ": "2026-09", "Mã NV": "NV001", "Hình thức công": "BT", "01": 1, "02": 0.5 }]);
  assert.equal(p3.summary.update, 1); IMP.apply(db, p3);
  assert.equal(db.chamcong.length, 1); assert.equal(db.chamcong[0]["02"], "0.5");
});
test("nhập: trùng trong cùng file, sai tham chiếu, thiếu cột, sai ngày, kỳ đã chốt", () => {
  const db = dbWithNV();
  const p = IMP.plan(db, "chamcong", CC_COLS, [
    { "Kỳ": "2026-09", "Mã NV": "NV001", "Hình thức công": "BT", "01": 1 },
    { "Kỳ": "2026-9", "Mã NV": "NV001", "Hình thức công": "BT", "01": 1 },      // trùng khóa sau chuẩn hóa kỳ
    { "Kỳ": "2026-09", "Mã NV": "NV999", "Hình thức công": "BT", "01": 1 },     // sai tham chiếu
    { "Kỳ": "2026-09", "Hình thức công": "BT", "01": 1 },                      // thiếu Mã NV
    { "Kỳ": "2026-08", "Mã NV": "NV002", "Hình thức công": "BT", "01": 1 }      // kỳ đã chốt
  ], { lockedPeriods: { "2026-08": true } });
  assert.deepEqual(p.items.map((i) => i.action), ["add", "duplicate", "refError", "invalid", "locked"]);
  const p2 = IMP.plan(db, "psluong", ["Ngày hạch toán", "Mã NV", "Diễn giải", "Thưởng"], [{ "Ngày hạch toán": "32/09/2026", "Mã NV": "NV001", "Thưởng": "100.000" }]);
  assert.equal(p2.items[0].action, "invalid");
});
test("nhập: chuẩn hóa tiền VN và CCCD mất số 0; nhân viên trùng mã → cập nhật", () => {
  const db = dbWithNV();
  const p = IMP.plan(db, "psluong", ["Ngày hạch toán", "Mã NV", "Diễn giải", "Thưởng"], [{ "Ngày hạch toán": "28/09/2026", "Mã NV": "NV001", "Thưởng": "500.000" }]);
  assert.equal(p.items[0].row["Thưởng"], "500000"); assert.equal(p.items[0].row["Ngày hạch toán"], "2026-09-28");
  const p2 = IMP.plan(db, "nhanvien", ["Mã NV", "Họ và tên", "Số CCCD", "Ngày tạo hồ sơ", "Trạng thái"], [{ "Mã NV": "NV001", "Họ và tên": "A mới", "Số CCCD": 49090001234 }]);
  assert.equal(p2.summary.update, 1); assert.equal(p2.items[0].row["Số CCCD"], "049090001234");
});
test("nhập: dữ liệu không có khóa (tạm ứng) — chặn dòng trùng y hệt", () => {
  const db = dbWithNV(), cols = ["Ngày hạch toán", "Mã NV", "Diễn giải", "Tạm ứng"];
  const rows = [{ "Ngày hạch toán": "2026-09-15", "Mã NV": "NV001", "Tạm ứng": "1000000" }];
  IMP.apply(db, IMP.plan(db, "ungluong", cols, rows));
  const p2 = IMP.plan(db, "ungluong", cols, rows);
  assert.equal(p2.summary.duplicate, 1); assert.equal(db.ungluong.length, 1);
});

// ---------- integrity ----------
test("normalizeDataset: sửa tiền '500.000', kỳ '2026-9', ngày dd/mm/yyyy, CCCD; idempotent; không đụng kỳ đã chốt", () => {
  const db = baseDb();
  db.psluong = [{ "Ngày hạch toán": "28/09/2026", "Mã NV": "NV001", "Thưởng": "500.000" }];
  db.chamcong = [{ "Kỳ": "2026-9", "Mã NV": "NV001" }];
  db.nhanvien = [{ "Mã NV": "NV001", "Số CCCD": "49090001234" }];
  db.kyluong = [{ ky: "2026-08", kq: { bangluong: [{ "Thưởng": "500.000" }] } }];
  const r = INT.normalizeDataset(db);
  assert.equal(db.psluong[0]["Thưởng"], "500000"); assert.equal(db.psluong[0]["Ngày hạch toán"], "2026-09-28");
  assert.equal(db.chamcong[0]["Kỳ"], "2026-09"); assert.equal(db.nhanvien[0]["Số CCCD"], "049090001234");
  assert.equal(db.kyluong[0].kq.bangluong[0]["Thưởng"], "500.000");
  assert.ok(r.messages.length >= 3);
  assert.equal(INT.normalizeDataset(db).messages.length, 0);
});
test("integrity.check: phát hiện trùng Mã NV, chấm công trùng khóa, lương nghi lỗi, ngày sai", () => {
  const db = baseDb();
  db.nhanvien = [{ "Mã NV": "NV001" }, { "Mã NV": "NV001" }];
  db.chamcong = [ccRow("NV001", 2026, 9), ccRow("NV001", 2026, 9)];
  db.chitiethd = [{ "Mã NV": "NV001", "Số HĐLĐ": "H1", "Lương thỏa thuận": "300" }];
  db.psluong = [{ "Ngày hạch toán": "abc", "Mã NV": "NV001" }];
  const msgs = INT.check(db).map((i) => i.level + ":" + i.msg).join("\n");
  assert.match(msgs, /Critical:Mã NV NV001 bị trùng/);
  assert.match(msgs, /CỘNG 2 LẦN/);
  assert.match(msgs, /quá nhỏ/);
  assert.match(msgs, /BỎ QUA khi tính lương/);
});

// ---------- payroll close ----------
function kqSample(tl) { return { bangluong: [{ "Mã NV": "NV001", "Họ và tên": "A", "Thực lĩnh": tl, "Tổng thu nhập": tl }], bhxh: [], tncn: [], canhbao: [] }; }
test("chốt kỳ: snapshot có dữ liệu đầu vào + checksum; không chốt 2 lần; mở chốt giữ lịch sử, phiên bản tăng", () => {
  const db = baseDb(); db.chamcong = [ccRow("NV001", 2026, 9), ccRow("NV001", 2026, 8)];
  const s1 = CLS.buildSnapshot(db, "2026-09", kqSample(100), [{ "Mã nhân viên": "NV001" }], { note: "lần 1" });
  CLS.close(db, s1);
  assert.equal(s1.version, 1); assert.equal(s1.input.data.chamcong.length, 1); assert.equal(CLS.verify(s1), "ok");
  assert.throws(() => CLS.close(db, CLS.buildSnapshot(db, "2026-09", kqSample(1), [])), /đã chốt/);
  assert.throws(() => CLS.reopen(db, "2026-09", "  "), /lý do/);
  const h = CLS.reopen(db, "2026-09", "Sai chấm công");
  assert.equal(db.kyluong.length, 0); assert.equal(db.kyluong_lichsu.length, 1); assert.equal(h.moChot.lyDo, "Sai chấm công");
  const s2 = CLS.buildSnapshot(db, "2026-09", kqSample(200), []); CLS.close(db, s2);
  assert.equal(s2.version, 2);
  assert.deepEqual(CLS.diff(h.kq, s2.kq).map((r) => r["Chênh lệch"]), [100]);
  s2.kq.bangluong[0]["Thực lĩnh"] = 999; assert.equal(CLS.verify(s2), "modified");
  assert.equal(CLS.verify({ kq: {} }), "legacy");
});
test("chốt kỳ: rollback khi lưu thất bại", () => {
  const db = baseDb(), s = CLS.buildSnapshot(db, "2026-09", kqSample(1), []);
  CLS.close(db, s); CLS.rollbackClose(db, s); assert.equal(db.kyluong.length, 0);
  CLS.close(db, CLS.buildSnapshot(db, "2026-09", kqSample(1), []));
  const h = CLS.reopen(db, "2026-09", "x"); CLS.rollbackReopen(db, h);
  assert.equal(db.kyluong.length, 1); assert.equal(db.kyluong_lichsu.length, 0); assert.equal(db.kyluong[0].moChot, undefined);
});
