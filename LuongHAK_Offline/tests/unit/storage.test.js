"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createStorage } = require("../../main/storage.js");

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), "hak-store-")); }
function clock(start) { let t = new Date(start).getTime(); return { now: () => new Date(t), add: (ms) => { t += ms; } }; }

test("lưu / đọc lại; chưa có file → text null", () => {
  const s = createStorage(tmp());
  assert.deepEqual(s.load(), { ok: true, text: null });
  assert.equal(s.save(JSON.stringify({ nhanvien: [{ a: 1 }] })), true);
  assert.equal(JSON.parse(s.load().text).nhanvien[0].a, 1);
});
test("từ chối ghi dữ liệu không hợp lệ (bảo vệ file đang có)", () => {
  const s = createStorage(tmp());
  s.save('{"x":1}');
  assert.notEqual(s.save("không phải json"), true);
  assert.notEqual(s.save("[1,2]"), true);
  assert.equal(JSON.parse(s.load().text).x, 1);
});
test("file dữ liệu hỏng → load báo lỗi kèm danh sách sao lưu, không tự ghi đè", () => {
  const dir = tmp(), c = clock("2026-10-01T08:00:00"), s = createStorage(dir, { now: c.now });
  s.save('{"v":1}'); c.add(864e5); s.save('{"v":2}'); // tạo daily_ của ngày 2 chứa v=1
  fs.writeFileSync(path.join(dir, "data.json"), "{hỏng");
  const r = s.load();
  assert.equal(r.ok, false); assert.match(r.error, /hỏng/); assert.ok(r.backups.length >= 1);
  const q = s.quarantineCorrupt(); assert.ok(fs.existsSync(path.join(dir, q)));
  assert.equal(JSON.parse(s.readBackup(r.backups[0].name).text).v, 1);
});
test("sao lưu đầu ngày giữ trạng thái TRƯỚC thay đổi và không bị ghi đè trong ngày", () => {
  const dir = tmp(), c = clock("2026-10-01T08:00:00"), s = createStorage(dir, { now: c.now });
  s.save('{"v":"hom-qua"}');
  c.add(864e5); s.save('{"v":"sang"}'); s.save('{"v":"chieu"}'); s.save('{"v":"toi"}');
  const daily = s.list().filter((b) => b.tag === "daily");
  assert.equal(daily.length, 1);
  assert.equal(JSON.parse(s.readBackup(daily[0].name).text).v, "hom-qua");
});
test("dữ liệu giảm > 50% → tự sao lưu bản trước đó", () => {
  const dir = tmp(), s = createStorage(dir);
  s.save(JSON.stringify({ big: "x".repeat(10000) }));
  s.save(JSON.stringify({ big: "x".repeat(9000) }));
  s.save(JSON.stringify({ big: "" }));
  const b = s.list().filter((x) => x.tag === "truoc-giam-du-lieu");
  assert.equal(b.length, 1); assert.equal(JSON.parse(s.readBackup(b[0].name).text).big.length, 9000);
});
test("không sao lưu file hỏng đè lên bản tốt; readBackup chặn đường dẫn lạ", () => {
  const dir = tmp(), s = createStorage(dir);
  s.save('{"ok":1}'); fs.writeFileSync(path.join(dir, "data.json"), "rác");
  assert.equal(s.backup("thu-cong"), null);
  assert.equal(s.readBackup("../data.json").ok, false);
  assert.equal(s.readBackup("..\\x.json").ok, false);
});
test("giới hạn số bản sao lưu theo loại", () => {
  const dir = tmp(), c = clock("2026-10-01T08:00:00"), s = createStorage(dir, { now: c.now });
  s.save('{"a":1}');
  for (let i = 0; i < 15; i++) { c.add(1000); s.backup("startup"); }
  assert.equal(s.list().filter((b) => b.tag === "startup").length, 10);
});
