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

test("chưa đăng nhập → từ chối; có phiên → chỉ cho quyền vai trò có; đăng xuất → lại từ chối", () => {
  const g = createGuard(APP);
  assert.match(g.deny(good, "input.view"), /Chưa đăng nhập/);
  assert.equal(g.setSession(good, PERM.ROLES.xembaocao.perms).ok, true);
  assert.equal(g.deny(good, "payroll.view"), ""); assert.match(g.deny(good, "backup.restore"), /không có quyền/); assert.match(g.deny(good, "input.edit"), /không có quyền/);
  g.setSession(good, PERM.ROLES.admin.perms); assert.equal(g.deny(good, "backup.restore"), "");
  g.setSession(good, []); assert.match(g.deny(good, "export"), /Chưa đăng nhập/);
});

test("nguồn lạ không đặt được phiên; quyền lạ/kiểu sai bị loại", () => {
  const g = createGuard(APP), evil = { senderFrame: { url: "https://evil.example/" } };
  assert.equal(g.setSession(evil, ["system.admin"]).ok, false); assert.match(g.deny(evil, ""), /Nguồn lệnh/);
  g.setSession(good, ["system.admin", "hack.all", 5, null, { a: 1 }]); assert.deepEqual(g.perms(), ["system.admin"]);
  g.setSession(good, "backup.restore"); assert.deepEqual(g.perms(), []);
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
