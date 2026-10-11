// Ô ngày chấm công (AUDIT_V2 A2-01..A2-04): bằng chứng tái hiện = repro trên bản 2.0.0-alpha.3 — ô âm, chữ lạ, "1.5.2", ngày 31/09
// trước đây được nhập không báo lỗi. Test này phải FAIL trên alpha.3 và PASS sau khi sửa.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../../core/validate.js");
const IMP = require("../../core/importer.js");
const INT = require("../../core/integrity.js");
const E = require("../../engine.js");
const F = require("../fixtures/build.js");

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const COLS = ["Kỳ", "Mã NV", "Hình thức công"].concat(DAYS);
function row(ma, cells, ht, ky) {
  const r = {}; COLS.forEach((c) => { r[c] = ""; });
  return Object.assign(r, { "Kỳ": ky || "2026-09", "Mã NV": ma, "Hình thức công": ht || "BT" }, cells);
}
function mkDb() { const db = F.baseDb(); db.nhanvien.push({ "Mã NV": "NV001", "Họ và tên": "A" }); return db; }

test("U-CC-13 dayCell: hợp lệ 1 / 0.5 / 1,5 / 1QC / QC; lỗi số âm, chữ lạ, 1.5.2, ký tự đặc biệt", () => {
  for (const v of ["1", "0.5", "1,5", "1QC", "1 QC", "QC", "1CT2", 2, 0, ""]) assert.equal(V.dayCell("03", v, "2026-09").error, null, String(v));
  for (const v of ["-1", "-0.5", -1, "1.5.2", "#", "1.", "+1", "1/2"]) assert.ok(V.dayCell("03", v, "2026-09").error, String(v));
  assert.deepEqual([V.dayCell("05", "1QC").soCong, V.dayCell("05", "1QC").nhan], [1, "QC"]);
  assert.match(V.dayCell("03", "7", "2026-09").warn, /vượt 3 công/);
});

test("U-CC-14 ngày không có trong tháng (31/09, 29/02 năm thường) → lỗi; 29/02/2028 năm nhuận hợp lệ", () => {
  assert.match(V.dayCell("31", 1, "2026-09").error, /không tồn tại trong tháng 09\/2026/);
  assert.ok(V.dayCell("29", 1, "2026-02").error);
  assert.equal(V.dayCell("29", 1, "2028-02").error, null);
  assert.equal(V.dayCell("31", 1, "2026-10").error, null);
  assert.equal(V.daysInKy("2026-02"), 28);
});

test("U-CC-15 nhập Excel: ô âm / chữ lạ / ngày 31/09 → dòng 'Lỗi dữ liệu', KHÔNG ghi; số công bất thường → ghi + cảnh báo", () => {
  const db = mkDb();
  const p = IMP.plan(db, "chamcong", COLS, [
    row("NV001", { "01": "-1" }), row("NV001", { "02": "1QC!" }, "TC"), row("NV001", { "31": 1 }, "CL"), row("NV001", { "03": "1.5.2" }, "PN"),
    row("NV001", { "04": 7, "05": "1XYZ" }, "BT")]);
  assert.deepEqual(p.items.map((i) => i.action), ["invalid", "invalid", "invalid", "invalid", "add"]);
  assert.match(p.items[0].reason, /không được âm/);
  assert.match(p.items[2].reason, /Ngày 31 không tồn tại/);
  assert.match(p.items[4].warn, /vượt 3 công/);
  assert.match(p.items[4].warn, /nhãn XYZ chưa có mã phụ cấp/);
  IMP.apply(db, p);
  assert.equal(db.chamcong.length, 1);
  assert.equal(E.tongHopChamCong(db.chamcong, 2026, 9).NV001.tongCong, 8);
});

test("U-CC-16 dữ liệu CŨ đã có ô sai → Kiểm tra dữ liệu báo High (không tự xóa); ngày 31/09 nêu rõ đang bị cộng (Q-21)", () => {
  const db = mkDb();
  db.chamcong.push(row("NV001", { "01": 1, "31": 1, "02": "-1" }), row("NV001", { "03": 5 }, "TC"));
  const snap = JSON.stringify(db.chamcong);
  const w = INT.check(db).filter((x) => x.area === "chamcong");
  assert.equal(JSON.stringify(db.chamcong), snap, "kiểm tra không được sửa dữ liệu");
  assert.ok(w.some((x) => x.level === "High" && /Ngày 31 không tồn tại.*VẪN CỘNG/.test(x.msg)), JSON.stringify(w));
  assert.ok(w.some((x) => x.level === "High" && /Ngày 02/.test(x.msg)));
  assert.ok(w.some((x) => x.level === "Medium" && /5 công — vượt 3/.test(x.msg)));
  // engine KHÔNG đổi (chờ Q-21): ngày 31/09 hiện vẫn được cộng
  assert.equal(E.tongHopChamCong(db.chamcong, 2026, 9).NV001.tongCong, 2 + 5);
});

test("U-CC-17 cùng ngày, khác hình thức công (BT + TC) → 2 dòng riêng, cộng đủ; chưa có khái niệm 'ca' (Q-18)", () => {
  const db = mkDb();
  const p = IMP.plan(db, "chamcong", COLS, [row("NV001", { "01": 1 }, "BT"), row("NV001", { "01": 0.5 }, "TC"), row("NV001", { "01": 0.5 }, "BT")]);
  assert.deepEqual(p.items.map((i) => i.action), ["conflict", "add", "conflict"], "cùng ngày + cùng hình thức, khác số công → xung đột (Q-12)");
  IMP.apply(db, p);
  const c = E.tongHopChamCong(db.chamcong, 2026, 9).NV001;
  assert.equal(c.congTangCa, 0.5);
});
