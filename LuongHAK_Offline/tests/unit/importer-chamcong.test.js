// Nhập chấm công: khóa Kỳ + Mã NV + Hình thức công (2.0 §4.2) — không ghi đè sai, không cộng thiếu, không cộng trùng
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const IMP = require("../../core/importer.js");
const INT = require("../../core/integrity.js");
const E = require("../../engine.js");
const F = require("../fixtures/build.js");

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const COLS = ["Kỳ", "Mã NV", "Hình thức công"].concat(DAYS);
// Dòng như SheetJS đọc với defval:"" — mọi cột đều có mặt, ô trống = ""
function row(ma, from, to, ht, val, ky) {
  const r = {}; COLS.forEach((c) => { r[c] = ""; });
  Object.assign(r, { "Kỳ": ky || "2026-09", "Mã NV": ma, "Hình thức công": ht == null ? "BT" : ht });
  for (let d = from; d <= to; d++) r[String(d).padStart(2, "0")] = val == null ? 1 : val;
  return r;
}
function mkDb() { const db = F.baseDb(); ["NV001", "NV002"].forEach((m) => db.nhanvien.push({ "Mã NV": m, "Họ và tên": m })); return db; }
function imp(db, rows, opts) { const p = IMP.plan(db, "chamcong", COLS, rows, opts || {}); IMP.apply(db, p); return p; }
const cong = (db, ma) => (E.tongHopChamCong(db.chamcong, 2026, 9)[ma || "NV001"] || { tongCong: 0, congTangCa: 0, congCom: 0 });

test("U-CC-01 nhập lại cùng 1 file nhiều lần → không tạo dòng mới, công không đổi", () => {
  const db = mkDb(), file = [row("NV001", 1, 26), row("NV001", 1, 4, "TC"), row("NV002", 1, 20)];
  imp(db, file);
  const p2 = imp(db, file), p3 = imp(db, file);
  assert.equal(db.chamcong.length, 3);
  assert.equal(p2.summary.duplicate, 3); assert.equal(p3.summary.add + p3.summary.update, 0);
  assert.equal(cong(db).tongCong, 30); assert.equal(cong(db).congTangCa, 4);
});

test("U-CC-02 nhiều dòng cùng NV + cùng hình thức trong 1 file (tách nửa tháng) → GỘP, không mất công", () => {
  const db = mkDb(), p = imp(db, [row("NV001", 1, 15), row("NV001", 16, 30)]);
  assert.equal(p.summary.add, 1); assert.equal(p.summary.merged, 1);
  assert.equal(db.chamcong.length, 1); assert.equal(cong(db).tongCong, 30);
});

test("U-CC-03 (Q-12) cùng ngày + cùng hình thức = NHẬP TRÙNG: cùng số công → tính 1 lần; khác số công → xung đột, không ghi", () => {
  let db = mkDb(), p = imp(db, [row("NV001", 1, 10, "BT", 1), row("NV001", 10, 20, "BT", 1)]);
  assert.equal(p.summary.add, 1); assert.equal(p.summary.merged, 1); assert.match(p.items[1].reason, /ngày 10 nhập trùng → tính 1 lần/);
  assert.equal(cong(db).tongCong, 20); // ngày 1–20, ngày 10 không bị cộng 2 lần
  // "1" và "1,0" / "1qc" và "1QC" là cùng giá trị
  db = mkDb(); const a = row("NV001", 1, 3, "BT", "1qc"), b2 = row("NV001", 3, 5, "BT", "1QC");
  assert.equal(imp(db, [a, b2]).summary.merged, 1); assert.equal(cong(db).tongCong, 5);
  db = mkDb(); p = imp(db, [row("NV001", 1, 10, "BT", 1), row("NV001", 10, 20, "BT", 0.5)]);
  assert.equal(p.summary.conflict, 2); assert.equal(db.chamcong.length, 0);
  assert.match(p.items[1].reason, /ngày 10 \(1 \/ 0\.5\)/);
});

test("U-CC-04 nhiều hình thức công của 1 NV → mỗi hình thức 1 dòng, không ghi đè lẫn nhau", () => {
  const db = mkDb();
  imp(db, [row("NV001", 1, 26), row("NV001", 1, 5, "TC"), row("NV001", 1, 20, "CC"), row("NV001", 2, 2, "CL")]);
  assert.equal(db.chamcong.length, 4);
  const c = cong(db);
  assert.equal(c.congTangCa, 5); assert.equal(c.congCom, 20); assert.equal(c.congLe, 1);
  assert.equal(c.tongCong, 26 + 5 + 1); // quy ước engine hiện hành: tổng công gồm TC, CL (không gồm CC) — không đổi
});

test("U-CC-05 nhập BỔ SUNG (file chỉ có ngày 16–30) → giữ nguyên ngày 1–15 đã có", () => {
  const db = mkDb();
  imp(db, [row("NV001", 1, 15)]);
  const p = imp(db, [row("NV001", 16, 30)]);
  assert.equal(p.summary.update, 1); assert.match(p.items[0].reason, /thêm 15 ô/); assert.match(p.items[0].reason, /giữ 15 ô/);
  assert.equal(db.chamcong.length, 1); assert.equal(cong(db).tongCong, 30);
});

test("U-CC-06 nhập ĐIỀU CHỈNH: sửa giá trị ngày → cập nhật đúng ô, báo trước/sau", () => {
  const db = mkDb();
  imp(db, [row("NV001", 1, 26)]);
  const fix = row("NV001", 1, 26); fix["05"] = 0.5;
  const p = imp(db, [fix]);
  assert.equal(p.summary.update, 1); assert.match(p.items[0].reason, /05: 1 → 0\.5/);
  assert.equal(cong(db).tongCong, 25.5);
});

test("U-CC-07 chế độ GHI ĐÈ cả dòng: ô trống trong file xóa dữ liệu đang có, có báo trước", () => {
  const db = mkDb();
  imp(db, [row("NV001", 1, 26)]);
  const p = imp(db, [row("NV001", 1, 20)], { mode: "replace" });
  assert.equal(p.mode, "replace"); assert.match(p.items[0].reason, /XÓA \d+ ô/);
  assert.equal(p.items[0].diff.clear.length, 6); // ngày 21–26
  assert.equal(cong(db).tongCong, 20);
});

test("U-CC-08 dữ liệu thuộc kỳ đã chốt → bị chặn, kể cả khi file ghi kỳ dạng khác (9/2026)", () => {
  const db = mkDb(); imp(db, [row("NV001", 1, 26)]);
  const locked = { "2026-09": true };
  const p = imp(db, [row("NV001", 1, 30, "BT", 1, "9/2026"), row("NV002", 1, 5, "BT", 1, "2026-9")], { lockedPeriods: locked });
  assert.equal(p.summary.locked, 2); assert.equal(cong(db).tongCong, 26); assert.equal(db.chamcong.length, 1);
});

test("U-CC-09 'bt' viết thường / hình thức để trống = BT → nhận là cùng bản ghi, không cộng đôi", () => {
  const db = mkDb(); imp(db, [row("NV001", 1, 26)]);
  const p = imp(db, [row("NV001", 1, 26, "bt"), row("NV002", 1, 3, "")]);
  assert.equal(p.summary.duplicate, 1);
  assert.equal(db.chamcong.filter((r) => r["Mã NV"] === "NV001").length, 1);
  assert.equal(db.chamcong.filter((r) => r["Mã NV"] === "NV002")[0]["Hình thức công"], "BT");
  assert.equal(cong(db).tongCong, 26);
});

test("U-CC-10 dữ liệu đang có 2 dòng cùng khóa → nhập bị CHẶN (xung đột), gộp bằng công cụ rồi nhập được", () => {
  const db = mkDb(); db.chamcong.push(row("NV001", 1, 15), row("NV001", 16, 30));
  const p = imp(db, [row("NV001", 1, 30)]);
  assert.equal(p.summary.conflict, 1); assert.match(p.items[0].reason, /Kiểm tra dữ liệu/);
  assert.equal(cong(db).tongCong, 30); // không bị cộng thành 45 như bản 1.4.0
  const issues = INT.check(db).filter((i) => i.area === "chamcong");
  assert.ok(issues.some((i) => i.level === "Medium" && /nên gộp/.test(i.msg)));
  const r = INT.mergeChamCong(db, {});
  assert.deepEqual([r.groups, r.removed], [1, 1]);
  assert.equal(db.chamcong.length, 1); assert.equal(cong(db).tongCong, 30);
  assert.equal(imp(db, [row("NV001", 1, 30)]).summary.duplicate, 1);
});

test("U-CC-11 công cụ gộp: ngày nhập trùng cùng số công → tính 1 lần; khác số công hoặc kỳ đã chốt → giữ nguyên", () => {
  const db = mkDb();
  db.chamcong.push(row("NV001", 1, 15), row("NV001", 15, 20, "BT", 0.5), row("NV002", 1, 10), row("NV002", 10, 20));
  assert.equal(cong(db, "NV002").tongCong, 21); // bản 1.4.0: ngày 10 bị cộng 2 lần
  assert.ok(INT.check(db).some((i) => i.level === "High" && /nhập trùng/.test(i.msg)));
  assert.ok(INT.check(db).some((i) => i.level === "High" && /KHÁC số công/.test(i.msg)));
  const before1 = cong(db).tongCong;
  const r = INT.mergeChamCong(db, { "2026-09": true });
  assert.equal(r.groups, 0); assert.equal(r.skipped.length, 2); assert.equal(db.chamcong.length, 4);
  const r2 = INT.mergeChamCong(db, {});
  assert.equal(r2.groups, 1); assert.equal(r2.dupDays, 1); assert.match(r2.skipped[0].reason, /khác số công 15/);
  assert.equal(cong(db, "NV002").tongCong, 20); // ngày 10 tính 1 lần
  assert.equal(cong(db).tongCong, before1);      // NV001 (khác số công) giữ nguyên
});

test("U-CC-12 bảng khác: cùng khóa trong file nhưng dữ liệu khác → xung đột cả 2 dòng; ô trống không xóa dữ liệu", () => {
  const db = mkDb(); db.nhanvien[0]["Số CCCD"] = "049201012345";
  const cols = ["Mã NV", "Họ và tên", "Số CCCD", "Trạng thái"];
  const p = IMP.plan(db, "nhanvien", cols, [{ "Mã NV": "NV003", "Họ và tên": "A" }, { "Mã NV": "NV003", "Họ và tên": "B" }], {});
  assert.equal(p.summary.conflict, 2);
  const p2 = IMP.plan(db, "nhanvien", cols, [{ "Mã NV": "NV001", "Họ và tên": "NV001 mới", "Số CCCD": "", "Trạng thái": "" }], {});
  IMP.apply(db, p2);
  assert.equal(db.nhanvien[0]["Họ và tên"], "NV001 mới"); assert.equal(db.nhanvien[0]["Số CCCD"], "049201012345");
});
