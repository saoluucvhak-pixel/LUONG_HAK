// Đăng nhập & phân quyền (Q-14: chỉ Admin sửa hồi tố; Q-16: cần đăng nhập + phân quyền)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), crypto = require("crypto"), { Buffer } = require("buffer"), { TextEncoder } = require("util");
const P = require("../../core/permissions.js");

const U = (vaiTro, extra) => Object.assign({ tenDangNhap: vaiTro, hoTen: vaiTro, vaiTro, salt: "00", hash: "00", iter: P.ITER }, extra);

test("U-PERM-01 Admin có mọi quyền; CHỈ Admin được sửa hồi tố, khôi phục, quản trị (Q-14)", () => {
  for (const p of Object.keys(P.PERMS)) assert.equal(P.can(U("admin"), p), true, p);
  for (const r of Object.keys(P.ROLES).filter((x) => x !== "admin"))
    for (const p of ["retro.edit", "backup.restore", "system.admin", "payroll.reopen"]) assert.equal(P.can(U(r), p), false, r + " " + p);
});

test("U-PERM-02 ma trận vai trò mặc định: tách nhập liệu / tính lương / xem lương nhạy cảm", () => {
  assert.equal(P.can(U("ketoanluong"), "payroll.close"), true);
  assert.equal(P.can(U("nhansu"), "payroll.view"), false, "Nhân sự không xem bảng lương");
  assert.equal(P.can(U("nhansu"), "hr.edit"), true);
  assert.equal(P.can(U("truongbophan"), "input.edit"), true);
  assert.equal(P.can(U("truongbophan"), "payroll.view"), false);
  assert.equal(P.can(U("xembaocao"), "input.edit"), false);
  assert.equal(P.can(U("ketoanthanhtoan"), "payroll.calc"), false);
  assert.equal(P.can(U("pheduyet"), "payroll.close"), false);
});

test("U-PERM-03 chưa đăng nhập / tài khoản khóa / vai trò lạ → không có quyền; need() ném lỗi rõ ràng", () => {
  assert.equal(P.can(null, "hr.view"), false);
  assert.equal(P.can(U("admin", { khoa: true }), "hr.view"), false);
  assert.equal(P.can(U("hacker"), "hr.view"), false);
  assert.throws(() => P.need(U("xembaocao"), "payroll.close"), /không có quyền chốt kỳ lương \(vai trò: Người xem báo cáo\)/);
  assert.throws(() => P.need(null, "hr.edit"), /chưa đăng nhập/);
  assert.doesNotThrow(() => P.need(U("admin"), "retro.edit"));
});

test("U-PERM-04 mật khẩu: ≥ 8 ký tự, có chữ và số; tên đăng nhập không phân biệt hoa/thường", () => {
  assert.match(P.validatePassword("abc12"), /8 ký tự/);
  assert.match(P.validatePassword("abcdefgh"), /chữ và số/);
  assert.match(P.validatePassword("12345678"), /chữ và số/);
  assert.equal(P.validatePassword("matkhau2026"), null);
  const db = { nguoidung: [U("admin", { tenDangNhap: "KeToan.A" })] };
  assert.ok(P.findUser(db, " ketoan.a "));
  assert.equal(P.findUser(db, "khac"), null);
});

test("U-PERM-05 chống dò mật khẩu: sai 5 lần → khóa 30 giây", () => {
  P.resetFails(); const t = 1e12;
  for (let i = 0; i < 4; i++) P.noteFail("a", t);
  assert.equal(P.lockedFor("a", t), 0);
  P.noteFail("A", t);
  assert.ok(P.lockedFor("a", t + 1000) > 28000);
  assert.equal(P.lockedFor("a", t + 31000), 0);
  P.noteOk("a"); assert.equal(P.lockedFor("a", t), 0);
});

test("U-PERM-06 không được khóa / hạ quyền Admin hoạt động cuối cùng", () => {
  const a1 = U("admin", { tenDangNhap: "a1" }), a2 = U("admin", { tenDangNhap: "a2" }), k = U("ketoanluong");
  const db = { nguoidung: [a1, k] };
  assert.equal(P.wouldRemoveLastAdmin(db, a1, { vaiTro: "ketoanluong" }), true);
  assert.equal(P.wouldRemoveLastAdmin(db, a1, { vaiTro: "admin", khoa: true }), true);
  assert.equal(P.wouldRemoveLastAdmin(db, a1, { vaiTro: "admin" }), false);
  assert.equal(P.wouldRemoveLastAdmin(db, k, { vaiTro: "xembaocao" }), false);
  db.nguoidung.push(a2);
  assert.equal(P.wouldRemoveLastAdmin(db, a1, { vaiTro: "ketoanluong" }), false);
});

test("U-PERM-07 mọi quyền dùng trong app.js đều có trong danh mục quyền; mọi thao tác ghi quan trọng có kiểm tra quyền", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../app.js"), "utf8");
  const used = new Set([...src.matchAll(/\b(?:need|can)\("([a-z.]+)"/g)].map((m) => m[1]));
  for (const p of used) assert.ok(P.PERMS[p], "quyền lạ: " + p);
  for (const p of ["hr.edit", "input.edit", "dm.edit", "payroll.calc", "payroll.close", "payroll.reopen", "import", "export", "retro.edit", "backup.restore", "system.admin"]) assert.ok(used.has(p), "thiếu kiểm tra " + p);
  // các hàm nghiệp vụ ghi dữ liệu phải gọi need(...) ngay trong thân hàm
  for (const fn of ["chotKy", "moChot", "napMau", "importFile", "importAllFile", "saveXlsx", "restoreFromText"]) {
    const body = src.slice(src.indexOf("function " + fn + "("), src.indexOf("function " + fn + "(") + 600);
    assert.match(body, /need\(/, fn);
  }
});

test("U-PERM-08 băm mật khẩu PBKDF2 ở tiến trình chính khớp WebCrypto (cùng thuật toán, cùng tham số)", async () => {
  const salt = crypto.randomBytes(16).toString("hex"), pw = "matkhau2026";
  const node = crypto.pbkdf2Sync(pw, Buffer.from(salt, "hex"), P.ITER, 32, "sha256").toString("hex");
  const k = await crypto.webcrypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.webcrypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: Buffer.from(salt, "hex"), iterations: P.ITER }, k, 256);
  assert.equal(Buffer.from(bits).toString("hex"), node);
  assert.ok(P.ITER >= 210000);
});
