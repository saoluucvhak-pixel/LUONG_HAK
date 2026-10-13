// V9.2 — migration CompanyID có kiểm tra (core/company-id.js)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const CO = require("../../core/company-id.js");
const mk = () => ({ congty: [{ "Mã công ty": "HAK" }], nhanvien: [{ "Mã NV": "A" }, { "Mã NV": "B", "Mã công ty": "HAK" }], chamcong: [{ "Mã NV": "A" }], sanluong: [], bandam: [] });

test("U-CO-01: một công ty có mã → gán cho dòng thiếu, không ghi đè dòng đã có, chạy lại không đổi gì", () => {
  const db = mk(); const p = CO.plan(db);
  assert.equal(p.status, "READY"); assert.deepEqual(p.counts, { nhanvien: 1, chamcong: 1 });
  const r = CO.apply(db); assert.equal(r.ok, true); assert.deepEqual(r.changed, { nhanvien: 1, chamcong: 1 });
  assert.equal(db.nhanvien[0]["Mã công ty"], "HAK");
  assert.equal(CO.plan(db).status, "NOTHING");
  assert.deepEqual(CO.apply(db).changed, {});
});
test("U-CO-02: nhiều công ty hoặc thiếu Mã công ty → BLOCKED, không đổi dữ liệu (không đoán)", () => {
  const a = mk(); a.congty.push({ "Mã công ty": "HAK2" });
  assert.equal(CO.plan(a).status, "BLOCKED"); assert.equal(CO.apply(a).ok, false); assert.equal(a.nhanvien[0]["Mã công ty"], undefined);
  const b = mk(); b.congty = [{ "Tên công ty": "X" }];
  assert.equal(CO.plan(b).status, "BLOCKED"); assert.match(CO.plan(b).reason, /không tự đặt mã/);
});
test("U-CO-03: dòng mang mã công ty lạ bị báo, không bị sửa; lọc theo công ty", () => {
  const db = mk(); db.nhanvien[1]["Mã công ty"] = "KHAC";
  const p = CO.plan(db); assert.equal(p.foreign.length, 1); assert.equal(p.foreign[0].giaTri, "KHAC");
  assert.equal(CO.filter(db.nhanvien, "HAK").length, 0);
  assert.equal(CO.filter(db.nhanvien, "HAK", true).length, 1);
  assert.equal(CO.filter(db.nhanvien, "").length, 2);
});
