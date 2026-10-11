// Q-24 (chủ sở hữu duyệt 11/10/2026): lương cá nhân ẩn với người không có quyền Xem bảng lương và không có quyền Sửa hồ sơ
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const HR = require("../../hr.js");
const P = require("../../core/permissions.js");
const F = require("../fixtures/build.js");

test("U-PAY-01 báo cáo nhân sự: hidePay che Lương cơ bản / Lương thỏa thuận / Giá trị tiền thưởng ở Sổ lao động và Lịch sử; không hidePay giữ nguyên", () => {
  const db = F.regressionDataset(5);
  const open = HR.reports(db), hid = HR.reports(db, { hidePay: true });
  const a = open.soLaoDong()[0], b = hid.soLaoDong()[0];
  assert.ok(a["Lương thỏa thuận"] > 0); assert.equal(b["Lương thỏa thuận"], HR.PAY_HIDDEN); assert.equal(b["Lương cơ bản"], HR.PAY_HIDDEN);
  assert.equal(b["Họ và tên"], a["Họ và tên"], "các cột khác không đổi");
  const ma = db.nhanvien[0]["Mã NV"], ls = hid.lichsu(ma).map((x) => x["Nội dung"]).join("\n");
  assert.doesNotMatch(ls, new RegExp("Lương thỏa thuận: \\d")); assert.match(ls, /Lương thỏa thuận: 🔒 ẩn/);
  assert.match(open.lichsu(ma).map((x) => x["Nội dung"]).join("\n"), /Lương thỏa thuận: \d/);
  assert.equal(HR.isPayField("chitiethd", "Lương thỏa thuận"), true); assert.equal(HR.isPayField("chitiethd", "Mã lương"), false); assert.equal(HR.isPayField("hopdong", "Lương thỏa thuận"), false);
  // bổ sung: Giá trị tiền thưởng (Khen thưởng) cũng là tiền cá nhân → ẩn; các cột khác của Khen thưởng vẫn hiện
  assert.equal(HR.isPayField("khenthuong", "Giá trị tiền thưởng"), true); assert.equal(HR.isPayField("khenthuong", "Hình thức khen thưởng"), false);
  const db2 = F.regressionDataset(2), m2 = db2.nhanvien[0]["Mã NV"];
  db2.khenthuong = [{ "Mã NV": m2, "Số HĐLĐ": m2 + "/HĐ01", "Ngày": "2026-09-02", "Hình thức khen thưởng": "Giấy khen", "Giá trị tiền thưởng": "777000" }];
  const k2 = HR.reports(db2, { hidePay: true }).lichsu(m2).map((x) => x["Nội dung"]).join("\n");
  assert.match(k2, /Giá trị tiền thưởng: 🔒 ẩn/); assert.doesNotMatch(k2, /777000/); assert.match(k2, /Giấy khen/);
});

test("U-PAY-02 vai trò được thấy lương = có Xem bảng lương HOẶC Sửa hồ sơ; app.js dùng canSeePay ở mọi chỗ hiện lương cá nhân", () => {
  const see = (r) => P.can({ vaiTro: r }, "payroll.view") || P.can({ vaiTro: r }, "hr.edit");
  assert.deepEqual(Object.keys(P.ROLES).filter((r) => !see(r)), ["truongbophan"]);
  const src = fs.readFileSync(path.join(__dirname, "../../app.js"), "utf8");
  assert.match(src, /function canSeePay\(\) \{ return can\("payroll\.view"\) \|\| can\("hr\.edit"\); \}/);
  assert.equal((src.match(/HRM\.reports\(db, \{ hidePay: !canSeePay\(\) \}\)/g) || []).length, 2, "báo cáo nhân sự + xuất sổ lao động");
  assert.match(src, /HRM\.isPayField\(key, c\) && !canSeePay\(\)/); assert.match(src, /hh\.ct && canSeePay\(\)/);
});
