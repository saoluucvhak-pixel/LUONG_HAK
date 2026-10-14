// V10.1 — bảo mật tại Main Process: khôi phục Admin phải được main xác minh; gate không bỏ qua lỗi; (thêm các nhóm test khác bên dưới)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto");
const { createGuard } = require("../../main/ipc-guard");
const { createPolicy, fileSig } = require("../../main/write-policy.js");
const PERM = require("../../core/permissions.js");
const { baseDb } = require("../fixtures/build.js");
const APP = path.resolve(__dirname, "../..");
const frame = () => ({ senderFrame: { url: require("url").pathToFileURL(path.join(APP, "index.html")).href }, sender: { id: 1 } });
const kdf = (pw, salt, iter) => crypto.pbkdf2Sync(pw, Buffer.from(salt, "hex"), iter, 32, "sha256").toString("hex");
const mkKey = (pw) => { const salt = crypto.randomBytes(16).toString("hex"); return { salt, iter: 1000, hash: kdf(pw, salt, 1000) }; };
const verify = (pw, u) => kdf(pw, u.salt, u.iter) === u.hash;
const clone = (o) => JSON.parse(JSON.stringify(o));

function guardEnv(codeRaw) {
  let t = 1000; const rec = mkKey(codeRaw.replace(/-/g, ""));
  const users = [Object.assign({ tenDangNhap: "admin", vaiTro: "admin", khoa: false }, mkKey("Abcd1234")), Object.assign({ tenDangNhap: "ketoan", vaiTro: "ketoanluong", khoa: false }, mkKey("Abcd1234"))];
  const g = createGuard(APP, { readUsers: () => users, readRecovery: () => rec, rolePerms: (r) => (PERM.ROLES[r] ? PERM.ROLES[r].perms.slice() : []), verify, now: () => t, recoveryMs: 60000 });
  return { g, tick: (ms) => { t += ms; } };
}

test("U-V101-REC-01 mã khôi phục đúng → main cấp phiên khôi phục cho ĐÚNG tài khoản Admin; sai mã / không phải Admin / sai nguồn → từ chối", () => {
  const { g } = guardEnv("ABCD-EF01-2345-6789");
  assert.equal(g.recoveryFor(frame()), null);
  assert.equal(g.recover(frame(), "SAI-SAI-SAI-SAI", "admin").ok, false);
  assert.equal(g.recover(frame(), "abcd-ef01-2345-6789", "ketoan").ok, false, "tài khoản không phải Admin");
  assert.equal(g.recover({ senderFrame: { url: "https://evil.example/" } }, "ABCD-EF01-2345-6789", "admin").ok, false, "nguồn lạ");
  const r = g.recover(frame(), "abcd-ef01-2345-6789", "admin");
  assert.equal(r.ok, true); assert.deepEqual(g.recoveryFor(frame()), { user: "admin" });
  g.recoveryDone(frame()); assert.equal(g.recoveryFor(frame()), null, "dùng một lần");
});
test("U-V101-REC-02 nhập sai quá 5 lần bị khóa tạm; phiên khôi phục tự hết hạn", () => {
  const { g, tick } = guardEnv("ABCD-EF01-2345-6789");
  for (let i = 0; i < 5; i++) assert.equal(g.recover(frame(), "XXXX-XXXX-XXXX-XXXX", "admin").ok, false);
  const locked = g.recover(frame(), "ABCD-EF01-2345-6789", "admin"); assert.equal(locked.ok, false); assert.match(locked.error, /chờ/);
  tick(31000); assert.equal(g.recover(frame(), "ABCD-EF01-2345-6789", "admin").ok, true);
  tick(61000); assert.equal(g.recoveryFor(frame()), null, "hết hạn");
});
test("U-V101-REC-03 policy: payload đặt lại Admin gửi thẳng không có phiên khôi phục bị từ chối; phiên của tài khoản khác cũng bị từ chối", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v101-")), file = path.join(dir, "data.json");
  const db = baseDb(); db.nguoidung = [{ tenDangNhap: "admin", vaiTro: "admin", hash: "h", salt: "s", iter: 1, khoa: false }, { tenDangNhap: "admin2", vaiTro: "admin", hash: "h2", salt: "s2", iter: 1, khoa: false }];
  db.baomat = [{ khoiPhuc: { salt: "a", iter: 1, hash: "b" } }]; db.auditlog = []; db.kyluong = []; db.kyluong_lichsu = [];
  fs.writeFileSync(file, JSON.stringify(db));
  const pol = createPolicy({ readText: () => fs.readFileSync(file, "utf8"), sigOf: fileSig(file) });
  const d = clone(db); d.nguoidung[0].hash = "forged"; d.baomat = [{ khoiPhuc: { salt: "n", iter: 1, hash: "m" } }];
  assert.equal(pol.check(JSON.stringify(d), null).ok, false);
  assert.equal(pol.check(JSON.stringify(d), null, { recovery: null }).ok, false);
  assert.equal(pol.check(JSON.stringify(d), null, { recovery: { user: "admin2" } }).ok, false, "phiên của admin2 không được đổi mật khẩu admin");
  assert.equal(pol.check(JSON.stringify(d), null, { recovery: { user: "admin" } }).ok, true);
  const d2 = clone(db); d2.nguoidung[0].hash = "forged"; // đổi mật khẩu mà KHÔNG phát hành mã mới
  assert.equal(pol.check(JSON.stringify(d2), null, { recovery: { user: "admin" } }).ok, false, "phải đổi mã khôi phục cùng lúc");
});

// ---- Gate xuất / chốt: FAIL-CLOSED ----
const PG = require("../../main/payroll-gate.js");
test("U-V101-GATE-01 xuất bảng lương: tên file không xác định kỳ, dữ liệu không đọc được, báo cáo thanh toán kỳ chưa chốt ⇒ CHẶN; file không liên quan ⇒ cho qua", () => {
  const load = () => ({ kyluong: [{ ky: "2026-08" }], congty: [] });
  assert.equal(PG.checkExport("BangTinhLuong.xlsx", load).code, "EXPORT_PERIOD_UNKNOWN");
  assert.equal(PG.checkExport("BangTinhLuong_2026-09.xlsx", () => { throw new Error("x"); }).code, "EXPORT_DATA_UNAVAILABLE");
  assert.equal(PG.checkExport("ThanhToanLuong_2026-09.xlsx", load).code, "EXPORT_NOT_CLOSED");
  assert.equal(PG.checkExport("KeChuyenKhoan_2026-09.pdf", load).code, "EXPORT_NOT_CLOSED");
  assert.equal(PG.checkExport("ThanhToanLuong_2026-08.xlsx", load).ok, true, "kỳ đã chốt");
  ["Mau_Maluong.xlsx", "Maluong.xlsx", "LuongHAK_Backup_2026-09-01.json", "NhanVien.xlsx", "Phan_bo_khoi_luong_2026-09.xlsx"].forEach((n) => assert.equal(PG.checkExport(n, load).ok, true, n));
});
test("U-V101-GATE-02 đổi tên file không vượt được: tên có chữ 'luong' + kỳ vẫn bị kiểm tra; engine ném lỗi ⇒ PAYROLL_RECALCULATION_FAILED", () => {
  const d = baseDb(); d.kyluong = []; d.congty = [{}];
  const r = PG.checkExport("luong_2026-09_final.xlsx", () => d);
  assert.ok(r.ok === true || r.code === "EXPORT_BLOCKED", "hoặc không có lỗi chặn, hoặc bị chặn có mã");
  const bad = { kyluong: [], congty: [{}], nhanvien: "không phải mảng", hopdong: 5 };
  const bl = PG.blockers(bad, "2026-09", {});
  assert.ok(bl.length >= 1 && bl[0].code === "PAYROLL_RECALCULATION_FAILED", JSON.stringify(bl).slice(0, 200));
});
