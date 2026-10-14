// V10.1 — thêm nhân viên: kiểm tra trọn bộ trước khi ghi, dựng đủ bảng, không hồ sơ dở dang
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const HC = require("../../core/hr-create.js");

const base = () => ({
  b: { "Mã NV": "NV100", "Họ và tên": "Nguyễn Văn A", "Trạng thái": "Đang làm việc" },
  c: { "Quốc tịch": "Việt Nam" }, hv: {},
  hd: { "Số HĐLĐ": "NV100/HĐ01", "Hình thức HĐLĐ": "Thử việc", "Ngày vào làm": "2026-09-01" },
  l: { HTTT: "Tiền mặt", "Mã hình thức lương": "LTG" }, tk: {}, today: "2026-10-14"
});
const db = { nhanvien: [{ "Mã NV": "NV001", "Số CCCD": "012345678901" }], canhan: [], hopdong: [{ "Số HĐLĐ": "NV001/HĐ01" }] };
let n = 0; const ids = () => "id" + (++n);

test("U-V101-HR-01 chỉ nhập trường bắt buộc: hợp lệ; chỉ dựng nhân viên + hợp đồng + chi tiết (không tạo cá nhân/học vấn/tài khoản rỗng)", () => {
  assert.deepEqual(HC.validate(base(), db), []);
  const r = HC.build(base(), ids);
  assert.deepEqual(Object.keys(r).filter((k) => r[k].length), ["nhanvien", "hopdong", "chitiethd"]);
  assert.equal(r.chitiethd[0]["Mã công tác"], "NV100/HĐ01-PL01");
});
test("U-V101-HR-02 đủ cá nhân + học vấn + tài khoản + HĐLĐ: dựng đủ 6 bảng, cùng Mã NV", () => {
  const i = base(); i.c = { "Quốc tịch": "Việt Nam", "Số CCCD": "098765432109", "Ngày sinh": "1990-05-02", "Ngày cấp": "2021-01-01" }; i.hv = { "Trình độ học vấn": "12/12" };
  i.l.HTTT = "Chuyển khoản"; i.tk = { "Số tài khoản": "0011223344", "Tên ngân hàng": "VCB" };
  assert.deepEqual(HC.validate(i, db), []);
  const r = HC.build(i, ids); Object.keys(r).forEach((k) => { assert.equal(r[k].length, 1, k); assert.equal(r[k][0]["Mã NV"], "NV100"); });
  assert.equal(r.hocvan[0]["Trình độ học vấn"], "12/12");
});
test("U-V101-HR-03 thiếu trường / trùng mã / trùng Số HĐLĐ / trùng CCCD bị từ chối, nêu đúng trường", () => {
  let i = base(); i.b["Họ và tên"] = ""; assert.ok(HC.validate(i, db).some((x) => /Họ và tên/.test(x)));
  i = base(); i.b["Mã NV"] = "nv001"; assert.ok(HC.validate(i, db).some((x) => /đã tồn tại/.test(x)), "trùng mã không phân biệt hoa thường");
  i = base(); i.hd["Số HĐLĐ"] = "NV001/HĐ01"; assert.ok(HC.validate(i, db).some((x) => /Số HĐLĐ.*đã tồn tại/.test(x)));
  i = base(); i.c["Số CCCD"] = "012345678901"; assert.ok(HC.validate(i, db).some((x) => /thuộc nhân viên khác/.test(x)));
});
test("U-V101-HR-04 ngày/định dạng sai: ngày không tồn tại, hết hạn trước vào làm, sinh sau hôm nay, CCCD ≠ 12 số, CK thiếu STK, STK thiếu ngân hàng", () => {
  const bad = (f) => { const i = base(); f(i); return HC.validate(i, db).join(" | "); };
  assert.match(bad((i) => { i.hd["Ngày vào làm"] = "2026-02-30"; }), /ngày không hợp lệ/);
  assert.match(bad((i) => { i.hd["Ngày hết hạn"] = "2026-08-01"; }), /Ngày hết hạn không được trước/);
  assert.match(bad((i) => { i.c["Ngày sinh"] = "2030-01-01"; }), /Ngày sinh phải trước hôm nay/);
  assert.match(bad((i) => { i.c["Số CCCD"] = "123"; }), /12 chữ số/);
  assert.match(bad((i) => { i.l.HTTT = "Chuyển khoản"; }), /chưa nhập Số tài khoản/);
  assert.match(bad((i) => { i.tk = { "Số tài khoản": "123456789" }; }), /Tên ngân hàng/);
});
test("U-V101-HR-05 validate/build thuần: không đổi dữ liệu đầu vào và db", () => {
  const i = base(), d = JSON.parse(JSON.stringify(db)), s0 = JSON.stringify(i);
  HC.validate(i, d); HC.build(i, ids); assert.equal(JSON.stringify(i), s0); assert.deepEqual(d, db);
});
