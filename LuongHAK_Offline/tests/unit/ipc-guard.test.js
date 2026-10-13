// GĐ6: bảo vệ IPC — nguồn lệnh, đăng nhập, quyền; và gói cài đặt chứa đủ file app cần
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const { createGuard, KNOWN } = require("../../main/ipc-guard");
const PERM = require("../../core/permissions.js");
const APP = path.resolve(__dirname, "../..");
const good = { senderFrame: { url: require("url").pathToFileURL(path.join(APP, "index.html")).href } };

test("chỉ tin trang index.html của chính app (file://), bỏ qua #hash/?query", () => {
  const g = createGuard(APP);
  assert.equal(g.trusted(good), true);
  assert.equal(g.trusted({ senderFrame: { url: good.senderFrame.url + "#x?y" } }), true);
  ["https://evil.example/index.html", "file:///etc/passwd", "file:///tmp/index.html", "", "data:text/html,<p>", "about:blank"].forEach((u) => assert.equal(g.trusted({ senderFrame: { url: u } }), false, u));
  assert.equal(g.trusted(null), false); assert.equal(g.trusted({}), false);
});

// ---- V9: main là nguồn quyền; dựng "ổ đĩa tài khoản" giả để thử đăng nhập / thu hồi / hết hạn ----
const crypto = require("crypto");
const mk = (pw, vaiTro, extra) => { const salt = crypto.randomBytes(16).toString("hex"), iter = 100000; return Object.assign({ tenDangNhap: "u_" + vaiTro, vaiTro, khoa: false, salt, iter, hash: crypto.pbkdf2Sync(pw, Buffer.from(salt, "hex"), iter, 32, "sha256").toString("hex") }, extra); };
function env(users, o) {
  let t = 1000; const clock = { now: () => t, tick: (ms) => { t += ms; } }; const db = { users };
  const g = createGuard(APP, Object.assign({ readUsers: () => db.users, rolePerms: (r) => (PERM.ROLES[r] ? PERM.ROLES[r].perms.slice() : []),
    verify: (pw, u) => crypto.pbkdf2Sync(pw, Buffer.from(u.salt, "hex"), u.iter, 32, "sha256").toString("hex") === u.hash, now: clock.now }, o || {}));
  return { g, db, clock };
}
const frame = (id, url) => ({ sender: { id: id || 1 }, senderFrame: { url: url || good.senderFrame.url } });

test("V9: chưa đăng nhập → mọi lệnh bị từ chối; không có API nào nhận danh sách quyền từ renderer", () => {
  const { g } = env([mk("Abcd1234", "admin")]);
  assert.match(g.deny(frame(), "input.view"), /Chưa đăng nhập/);
  assert.equal(g.setSession, undefined, "setSession(list) đã bị loại bỏ");
  assert.deepEqual(g.perms(frame()), []);
});

test("V9: renderer giả mạo Admin — gửi quyền/tên vai trò lạ vào login không cấp được quyền", () => {
  const { g } = env([mk("Abcd1234", "xembaocao")]);
  assert.equal(g.login(frame(), "u_xembaocao", "sai-mat-khau").ok, false);
  assert.equal(g.login(frame(), ["system.admin"], "x").ok, false);
  assert.equal(g.login(frame(), "u_xembaocao", { perms: ["system.admin"] }).ok, false);
  assert.match(g.deny(frame(), "backup.restore"), /Chưa đăng nhập/);
  const r = g.login(frame(), "u_xembaocao", "Abcd1234");
  assert.equal(r.ok, true); assert.deepEqual(r.perms.sort(), PERM.ROLES.xembaocao.perms.slice().sort());
  assert.match(g.deny(frame(), "backup.restore"), /không có quyền/);
  assert.match(g.deny(frame(), "formula.approve"), /không có quyền/);
  assert.match(g.deny(frame(), "payroll.close"), /không có quyền/);
  assert.equal(g.deny(frame(), "payroll.view"), "");
});

test("V9: người chỉ xem không sửa được; nhân sự không đọc lương; kế toán thanh toán không Restore", () => {
  const users = [mk("Abcd1234", "xembaocao"), mk("Abcd1234", "nhansu"), mk("Abcd1234", "ketoanthanhtoan")];
  const { g } = env(users);
  g.login(frame(1), "u_xembaocao", "Abcd1234"); g.login(frame(2), "u_nhansu", "Abcd1234"); g.login(frame(3), "u_ketoanthanhtoan", "Abcd1234");
  assert.match(g.deny(frame(1), "input.edit"), /không có quyền/);
  assert.match(g.deny(frame(2), "payroll.view"), /không có quyền/);
  assert.match(g.deny(frame(3), "backup.restore"), /không có quyền/);
  assert.equal(g.deny(frame(3), "payroll.view"), "");
});

test("V9: phiên gắn theo cửa sổ — cửa sổ khác không dùng được phiên của người khác", () => {
  const { g } = env([mk("Abcd1234", "admin")]);
  g.login(frame(1), "u_admin", "Abcd1234");
  assert.equal(g.deny(frame(1), "backup.restore"), "");
  assert.match(g.deny(frame(2), "backup.restore"), /Chưa đăng nhập/);
});

test("V9: IPC từ trang khác / frame khác bị từ chối kể cả khi đã đăng nhập", () => {
  const { g } = env([mk("Abcd1234", "admin")]);
  g.login(frame(1), "u_admin", "Abcd1234");
  assert.match(g.deny(frame(1, "https://evil.example/"), "backup.restore"), /Nguồn lệnh/);
  assert.equal(g.login(frame(1, "https://evil.example/"), "u_admin", "Abcd1234").ok, false);
  const mainF = { url: good.senderFrame.url }, sub = { url: good.senderFrame.url };
  assert.match(g.deny({ sender: { id: 1, mainFrame: mainF }, senderFrame: sub }, "backup.restore"), /Nguồn lệnh/, "iframe cùng URL vẫn bị chặn");
  assert.equal(g.deny({ sender: { id: 1, mainFrame: mainF }, senderFrame: mainF }, "backup.restore"), "");
});

test("V9: phiên hết hạn sau thời gian không thao tác; thao tác hợp lệ gia hạn phiên", () => {
  const { g, clock } = env([mk("Abcd1234", "admin")], { idleMs: 60000 });
  g.login(frame(), "u_admin", "Abcd1234");
  clock.tick(50000); assert.equal(g.deny(frame(), "export"), "");
  clock.tick(50000); assert.equal(g.deny(frame(), "export"), "", "đã gia hạn bởi thao tác trước");
  clock.tick(61000); assert.match(g.deny(frame(), "export"), /hết hạn|Chưa đăng nhập/);
});

test("V9: thu hồi quyền có hiệu lực ngay — đổi vai trò, khóa, xóa tài khoản", () => {
  const { g, db } = env([mk("Abcd1234", "admin")]);
  g.login(frame(), "u_admin", "Abcd1234"); assert.equal(g.deny(frame(), "backup.restore"), "");
  db.users = [Object.assign({}, db.users[0], { vaiTro: "xembaocao" })]; // hạ vai trò
  assert.match(g.deny(frame(), "report.view"), /Chưa đăng nhập|hết hạn/, "đổi vai trò → phiên cũ bị thu hồi, phải đăng nhập lại");
  db.users = [mk("Abcd1234", "admin")]; g.login(frame(), "u_admin", "Abcd1234");
  db.users = [Object.assign({}, db.users[0], { khoa: true })];
  assert.match(g.deny(frame(), "export"), /Chưa đăng nhập|hết hạn/);
  db.users = [mk("Abcd1234", "admin")]; g.login(frame(), "u_admin", "Abcd1234");
  db.users = [];
  assert.match(g.deny(frame(), "export"), /Chưa đăng nhập|hết hạn/);
});

test("V9: tài khoản khóa không đăng nhập được; sai mật khẩu 5 lần bị chặn tạm thời tại main", () => {
  const { g, clock } = env([mk("Abcd1234", "admin", { khoa: true }), mk("Abcd1234", "nhansu")], { maxFails: 5, lockMs: 30000 });
  assert.match(g.login(frame(), "u_admin", "Abcd1234").error, /khóa/);
  for (let i = 0; i < 5; i++) assert.equal(g.login(frame(), "u_nhansu", "sai" + i).ok, false);
  assert.match(g.login(frame(), "u_nhansu", "Abcd1234").error, /chờ/, "đúng mật khẩu nhưng đang bị khóa tạm");
  clock.tick(31000); assert.equal(g.login(frame(), "u_nhansu", "Abcd1234").ok, true);
});

test("V9: đăng xuất xóa phiên tại main", () => {
  const { g } = env([mk("Abcd1234", "admin")]);
  g.login(frame(), "u_admin", "Abcd1234"); g.logout(frame());
  assert.match(g.deny(frame(), "export"), /Chưa đăng nhập/);
});

test("KNOWN khớp danh sách quyền của core/permissions (không sót quyền mới)", () => {
  assert.deepEqual(Object.keys(PERM.PERMS).sort(), KNOWN.slice().sort());
});

test("gói cài (package.json build.files) phủ mọi file nạp bởi index.html, main.js, preload.js", () => {
  const pk = JSON.parse(fs.readFileSync(path.join(APP, "package.json"), "utf8")), globs = pk.build.files;
  const covered = (rel) => globs.some((g) => g === rel || (g.endsWith("/**") && rel.startsWith(g.slice(0, -2))));
  const need = new Set();
  const html = fs.readFileSync(path.join(APP, "index.html"), "utf8");
  for (const m of html.matchAll(/(?:src|href)="([^"#?]+\.(?:js|css))"/g)) if (!/^https?:/.test(m[1])) need.add(m[1]);
  for (const f of ["main.js", "preload.js"]) { const t = fs.readFileSync(path.join(APP, f), "utf8"); for (const m of t.matchAll(/require\("\.\/([^"]+)"\)/g)) need.add(m[1].endsWith(".js") ? m[1] : m[1] + ".js"); }
  const miss = [...need].filter((f) => !covered(f));
  assert.deepEqual(miss, [], "file chưa nằm trong build.files: " + miss.join(", "));
  [...need].forEach((f) => assert.ok(fs.existsSync(path.join(APP, f)), "thiếu file " + f));
});

test("V8: mọi ipcMain.handle trừ allowlist đều đi qua guarded/guardedW (có quyền); ipcMain.on được bọc kiểm nguồn", () => {
  const src = fs.readFileSync(path.join(APP, "main.js"), "utf8");
  assert.match(src, /ipcMain\.on = \(ch, fn\) => _on\(ch,[^;]*guard\.trusted\(e\)/);
  assert.match(src, /ipcMain\.handle = \(ch, fn\) => _handle\(ch,[^;]*guard\.trusted\(e\)/);
  const open = [];
  src.split("\n").forEach((ln) => { const m = ln.match(/ipcMain\.handle\("([^"]+)",\s*(.*)$/); if (m && !/^guarded(W)?\(/.test(m[2])) open.push(m[1]); });
  assert.deepEqual(open.sort(), ["ocr-selftest"]);
  // các lệnh nhạy cảm phải đòi đúng quyền
  const need = { "fb-create": "backup.restore", "rs-commit": "backup.restore", "rs-stage": "backup.restore", "ocrlib-approve": "input.edit", "ocrlib-set-status": "ocr.library", "ocrlib-relabel": "ocr.library", "ocrlib-image": "input.view", "report-pdf": "export", "paths-move": "backup.restore" };
  Object.keys(need).forEach((ch) => { const re = new RegExp('ipcMain\\.handle\\("' + ch + '",\\s*guarded(W)?\\("' + need[ch].replace(".", "\\.") + '"'); assert.match(src, re, ch); });
});
