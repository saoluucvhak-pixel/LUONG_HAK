"use strict";
// V9: Excel xuất ra không được chứa công thức do dữ liệu người dùng (formula injection): chuỗi bắt đầu bằng = + - @ phải là ô CHỮ, không có thuộc tính .f
const test = require("node:test"), assert = require("node:assert/strict");
const path = require("path");
const XLSX = require(path.join(__dirname, "../../xlsx.full.min.js"));
test("U-XLSX-01: ô bắt đầu bằng = + - @ được ghi là chữ (t='s'), không thành công thức; mã NV/số tài khoản dạng chữ giữ số 0 đầu", () => {
  const bad = ["=HYPERLINK(\"http://x\",\"a\")", "+cmd|' /C calc'!A0", "-2+3", "@SUM(1,1)", "0123456789"];
  const ws = XLSX.utils.aoa_to_sheet([["v"], ...bad.map((b) => [b])]);
  const buf = XLSX.write({ SheetNames: ["S"], Sheets: { S: ws } }, { type: "buffer", bookType: "xlsx" });
  const back = XLSX.read(buf, { type: "buffer" }).Sheets.S;
  bad.forEach((b, i) => { const c = back["A" + (i + 2)]; assert.equal(c.t, "s", b); assert.equal(c.f, undefined, b); assert.equal(c.v, b); });
});
