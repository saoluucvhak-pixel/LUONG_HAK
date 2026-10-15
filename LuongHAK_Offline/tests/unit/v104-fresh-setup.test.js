// V10.4 — thiết lập ban đầu trên máy mới: tạo dữ liệu công ty mới, không cần file
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const HR = require("../../hr.js");
const { createPolicy, fileSig } = require("../../main/write-policy.js");
const PG = require("../../main/payroll-gate.js");

test("F-SETUP-01: khoiTaoMoi ghi đúng công ty và nạp danh mục chuẩn cho bảng trống", () => {
  const db = { nguoidung: [], auditlog: [] };
  const seeded = HR.khoiTaoMoi(db, "  Công ty TNHH Test  ", " HAKQN ");
  assert.deepEqual(db.congty, [{ "Mã công ty": "HAKQN", "Tên công ty": "Công ty TNHH Test" }]);
  assert.ok(seeded.includes("dm_luong"), "phải nạp dm_luong");
  assert.ok(db.dm_baohiem.length > 0 && db.dm_luong.length > 0);
});

test("F-SETUP-02: khoiTaoMoi không đụng bảng đã có dữ liệu", () => {
  const db = { dm_luong: [{ "Mã lương": "X" }] };
  const seeded = HR.khoiTaoMoi(db, "CT", "CT1");
  assert.deepEqual(db.dm_luong, [{ "Mã lương": "X" }]);
  assert.ok(!seeded.includes("dm_luong"));
});

test("F-SETUP-03: máy mới (chưa có tài khoản) ghi được file thiết lập ban đầu, không cần file có sẵn", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "setup-")), file = path.join(dir, "data.json");
  fs.writeFileSync(file, "{}");
  const pol = createPolicy({ readText: () => fs.readFileSync(file, "utf8"), sigOf: fileSig(file), gate: PG });
  const db = {};
  HR.khoiTaoMoi(db, "Công ty Mới", "NEW1");
  db.nguoidung = [{ tenDangNhap: "admin", vaiTro: "admin", hash: "h", salt: "s", iter: 1, khoa: false }];
  db.auditlog = [{ luc: "t", nguoi: "admin", thaoTac: "Khởi tạo dữ liệu công ty mới" }];
  db.baomat = [{ khoiPhuc: "x" }]; db.kyluong = []; db.kyluong_lichsu = [];
  const v = pol.check(JSON.stringify(db), null);
  assert.equal(v.ok, true, v.msg || "bị từ chối");
});
