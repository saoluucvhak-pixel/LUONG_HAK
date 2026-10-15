// V10.3 — Xóa mã (tăng ca / phụ cấp / hỗ trợ) và công thức CHƯA áp dụng; mã đã dùng / công thức đã hiệu lực thì chặn. Dữ liệu giả lập.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const FM = require("../../core/payroll/formula-master.js");
const R = require("../../core/repository.js");
const { baseDb } = require("../fixtures/build.js");

const OT = FM.forType("OVERTIME"), PC = FM.forType("ALLOWANCE");
const F = (o) => Object.assign({ "Loại": "OVERTIME", "Trạng thái": "Nháp", "Biểu thức": "CONG_TC * 2", "Phiên bản": 1, "Hiệu lực từ": "2026-01-01" }, o);
function mk() {
  const db = baseDb(); db.auditlog = []; db.kyluong = [];
  db.dm_tangca = [{ "Mã tăng ca": "TCX", "Nội dung tăng ca": "TC thử", "Loại công thức": "CT_X", "Hệ số tăng ca": "2", "Hiệu lực từ": "2026-01-01" }, { "Mã tăng ca": "TCU", "Nội dung tăng ca": "TC đã gán", "Hệ số tăng ca": "1.5", "Hiệu lực từ": "2026-01-01" }];
  db.dm_congthuc = [F({ "Mã công thức": "CT_X", "Trạng thái": "Nháp" }), F({ "Mã công thức": "CT_X", "Phiên bản": 2, "Trạng thái": "Đã duyệt" })];
  db.nhansu = [{ "Mã nhân viên": "N1", "Họ và tên": "A", "Mã tăng ca": "TCU" }];
  return db;
}
const repo = (db, can) => R.createRepo({ db: () => db, can: can || (() => true), audit: () => {}, uid: () => "x" });

test("U-DEL-01 mã tăng ca chưa gán cho ai + công thức con chưa áp dụng → xóa được cả mã lẫn công thức con", () => {
  const db = mk(), ck = OT.deleteCheck(db, "TCX");
  assert.equal(ck.ok, true, ck.reason); assert.equal(ck.rows.length, 1); assert.equal(ck.kids.length, 2);
  const rp = repo(db);
  ck.kids.forEach((k) => { const p = rp.plan("remove", "dm_congthuc", k, null, {}); assert.ok(p.ok, p.msg); assert.ok(rp.apply(p, {}).ok); });
  const p2 = rp.plan("remove", "dm_tangca", ck.rows[0], null, {}); assert.ok(p2.ok, p2.msg); assert.ok(rp.apply(p2, {}).ok);
  assert.equal(db.dm_tangca.filter((r) => r["Mã tăng ca"] === "TCX").length, 0); assert.equal(db.dm_congthuc.length, 0);
  assert.equal(db.dm_tangca.length, 1, "mã khác còn nguyên");
});
test("U-DEL-02 mã đã gán cho nhân viên → chặn, nêu rõ chỗ đang dùng", () => {
  const ck = OT.deleteCheck(mk(), "TCU");
  assert.equal(ck.ok, false); assert.match(ck.reason, /đang được gán ở: nhansu \(1\)/);
});
test("U-DEL-03 công thức con đang Hiệu lực / đã Ngừng → chặn xóa mã (giữ lịch sử); công thức dùng chung với mã khác → không bị xóa theo", () => {
  const db = mk(); db.dm_congthuc[1]["Trạng thái"] = "Hiệu lực";
  assert.match(OT.deleteCheck(db, "TCX").reason, /Hiệu lực/);
  db.dm_congthuc[1]["Trạng thái"] = "Ngừng"; assert.match(OT.deleteCheck(db, "TCX").reason, /Ngừng/);
  const db2 = mk(); db2.dm_tangca.push({ "Mã tăng ca": "TCY", "Nội dung tăng ca": "dùng chung", "Loại công thức": "CT_X", "Hiệu lực từ": "2026-01-01" });
  const c2 = OT.deleteCheck(db2, "TCX"); assert.equal(c2.ok, true, "khóa dùng chung không thuộc riêng mã nào → xóa mã được nhưng KHÔNG xóa công thức (mã TCY còn dùng)"); assert.equal(c2.kids.length, 0);
});
test("U-DEL-04 mã từng dùng tính lương kỳ đã chốt → chặn", () => {
  const db = mk(); db.kyluong = [{ ky: "2026-08", kq: { bangluong: [{ "Mã NV": "N1", _ct: { maTangCa: "TCX" } }] } }];
  const ck = OT.deleteCheck(db, "TCX"); assert.equal(ck.ok, false); assert.match(ck.reason, /kỳ đã chốt/);
});
test("U-DEL-05 phụ cấp: mã không ai dùng xóa được; không có quyền sửa danh mục thì repository chặn", () => {
  const db = mk(); db.dm_phucap = [{ "Mã phụ cấp": "PZ", "Tên phụ cấp": "Z", "Hiệu lực từ": "2026-01-01" }];
  const ck = PC.deleteCheck(db, "PZ"); assert.equal(ck.ok, true, ck.reason);
  const p = repo(db, () => false).plan("remove", "dm_phucap", ck.rows[0], null, {}); assert.equal(p.ok, false); assert.equal(p.code, "perm");
});
