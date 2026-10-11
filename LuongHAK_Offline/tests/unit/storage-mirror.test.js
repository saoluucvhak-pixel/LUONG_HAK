// Sao lưu ra ngoài máy (2.0-α13, chủ sở hữu chọn A + B + D 11/10/2026)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { createStorage, sha256 } = require("../../main/storage.js");

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p || "hak-mir-"));
let t0 = Date.parse("2026-10-11T08:00:00Z");
const clock = () => new Date(t0);

test("U-MIR-01 (A) chọn thư mục thứ hai → mỗi bản sao lưu được chép kèm file kiểm tra, nội dung khớp SHA-256; trạng thái ghi lần chép tốt", () => {
  const dir = tmp(), usb = tmp("hak-usb-"), s = createStorage(dir, { now: clock });
  s.save('{"nhanvien":[{"Mã NV":"NV001"}]}');
  assert.equal(s.setMirror(usb).ok, true);
  const f = s.backup("manual"), root = path.join(usb, "TinhLuongHAK-SaoLuu");
  assert.ok(fs.existsSync(path.join(root, f)) && fs.existsSync(path.join(root, f + ".sha256")));
  assert.equal(sha256(fs.readFileSync(path.join(root, f), "utf8")), JSON.parse(fs.readFileSync(path.join(root, f + ".sha256"), "utf8")).sha256);
  const st = s.backupStatus();
  assert.equal(st.mirrorDir, usb); assert.ok(st.lastMirrorOk); assert.equal(st.lastMirrorError, ""); assert.equal(st.daysSinceExternal, 0);
  assert.equal(s.setMirror(path.join(dir, "backups")).ok, false, "không cho chọn thư mục nằm trong thư mục dữ liệu");
});

test("U-MIR-02 (A) rút USB / mất ổ mạng → sao lưu TRÊN MÁY vẫn thành công, lỗi được ghi lại để nhắc; cắm lại → chép tiếp được", () => {
  const dir = tmp(), usb = tmp("hak-usb-"), s = createStorage(dir, { now: clock });
  s.save('{"a":1}'); s.setMirror(usb);
  fs.rmSync(usb, { recursive: true, force: true }); // rút USB
  const f = s.backup("manual");
  assert.ok(f && fs.existsSync(path.join(dir, "backups", f)), "bản sao lưu trên máy vẫn có");
  assert.match(s.backupStatus().lastMirrorError, /Không truy cập được thư mục/);
  fs.mkdirSync(usb); // cắm lại
  assert.equal(s.syncMirror().ok, true);
  assert.equal(s.backupStatus().lastMirrorError, "");
});

test("U-MIR-03 (B) bản sau chốt kỳ KHÔNG BAO GIỜ bị dọn (trên máy và thư mục thứ hai); bản thường vẫn dọn theo số lượng", () => {
  const dir = tmp(), usb = tmp("hak-usb-"), s = createStorage(dir, { now: clock });
  s.save('{"a":1}'); s.setMirror(usb);
  for (let i = 0; i < 25; i++) { t0 += 1000; s.backup("sau-chot-2026-09"); s.backup("manual"); }
  const local = s.list();
  assert.equal(local.filter((b) => b.tag === "sau-chot-2026-09").length, 25);
  assert.equal(local.filter((b) => b.tag === "manual").length, 20);
  const m = fs.readdirSync(path.join(usb, "TinhLuongHAK-SaoLuu")).filter((x) => /\.json$/.test(x));
  assert.equal(m.filter((x) => /^sau-chot-2026-09_/.test(x)).length, 25);
  assert.equal(m.filter((x) => /^manual_/.test(x)).length, 20);
  assert.equal(s.backupStatus().permanent, 25);
});

test("U-MIR-04 (D) ngày kể từ lần sao lưu ra ngoài: chưa bao giờ = null; Sao lưu ra file / chép thư mục thứ hai → 0; 8 ngày sau → 8", () => {
  const dir = tmp(), s = createStorage(dir, { now: clock });
  s.save('{"a":1}');
  assert.equal(s.backupStatus().daysSinceExternal, null);
  s.noteExternal(); assert.equal(s.backupStatus().daysSinceExternal, 0);
  t0 += 8 * 864e5; assert.equal(s.backupStatus().daysSinceExternal, 8);
  assert.ok(!fs.readFileSync(path.join(dir, "data.json"), "utf8").includes("lastExternal"), "cấu hình máy KHÔNG nằm trong data.json");
});
