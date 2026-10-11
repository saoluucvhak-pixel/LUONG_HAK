// Lịch sao lưu (2.0-α17, chủ sở hữu duyệt 11/10/2026): định kỳ mỗi N giờ, khi đóng app, số ngày giữ bản đầu ngày
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { createStorage, SCHEDULE_DEFAULT } = require("../../main/storage.js");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "hak-sch-"));
function mk() { const c = { t: Date.parse("2026-10-11T08:00:00Z") }; const dir = tmp(); return { dir, c, s: createStorage(dir, { now: () => new Date(c.t) }) }; }
const tags = (s, t) => s.list().filter((b) => b.tag === t).length;

test("U-SCH-01 mặc định: định kỳ 2 giờ, sao lưu khi đóng app, giữ bản đầu ngày 60 ngày; giá trị lạ trong settings.json → mặc định", () => {
  const { dir, s } = mk();
  assert.deepEqual(Object.assign({}, s.getSchedule(), { lastAuto: undefined }), Object.assign({}, SCHEDULE_DEFAULT, { lastAuto: undefined }));
  fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify({ backupSchedule: { everyHours: 3, onClose: "x", keepDaily: -1 } }));
  assert.equal(s.getSchedule().everyHours, 2); assert.equal(s.getSchedule().onClose, true); assert.equal(s.getSchedule().keepDaily, 60);
  assert.equal(s.setSchedule({ everyHours: 5 }).ok, false); assert.equal(s.setSchedule({ keepDaily: 7 }).ok, false);
  const r = s.setSchedule({ everyHours: 4, onClose: false, keepDaily: 180 });
  assert.equal(r.ok, true); assert.deepEqual([r.everyHours, r.onClose, r.keepDaily], [4, false, 180]);
  assert.equal(s.setSchedule({ everyHours: 0 }).keepDaily, 180, "đổi 1 mục không làm mất mục khác");
});

test("U-SCH-02 định kỳ: chỉ sao lưu khi ĐẾN GIỜ và dữ liệu ĐÃ ĐỔI; tắt (0) thì không sao lưu", () => {
  const { s, c } = mk();
  s.save('{"a":1}'); s.backup("startup");
  assert.equal(s.tickSchedule(), null, "lần đầu: dữ liệu giống bản mới nhất → không tạo bản trùng");
  s.save('{"a":2}');
  c.t += 60 * 60e3; assert.equal(s.tickSchedule(), null, "mới 1 giờ < 2 giờ");
  c.t += 61 * 60e3; const f = s.tickSchedule(); assert.match(f, /^dinh-ky_/); assert.equal(tags(s, "dinh-ky"), 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(s.backupDir, f), "utf8")).a, 2, "bản định kỳ = dữ liệu hiện tại");
  c.t += 3 * 3600e3; assert.equal(s.tickSchedule(), null, "đến giờ nhưng dữ liệu không đổi → không tạo");
  s.setSchedule({ everyHours: 0 }); s.save('{"a":3}'); c.t += 9 * 3600e3; assert.equal(s.tickSchedule(), null);
});

test("U-SCH-03 khi đóng app: bật + dữ liệu đã đổi → 'khi-dong'; tắt hoặc không đổi → không tạo", () => {
  const { s } = mk();
  s.save('{"a":1}'); s.backup("startup");
  assert.equal(s.backupOnClose(), null, "không đổi");
  s.save('{"a":2}'); assert.match(s.backupOnClose(), /^khi-dong_/);
  s.save('{"a":3}'); s.setSchedule({ onClose: false }); assert.equal(s.backupOnClose(), null);
});

test("U-SCH-04 số ngày giữ bản đầu ngày theo lịch: 30 ngày → chỉ giữ 30 bản daily mới nhất; bản sau chốt kỳ không bao giờ bị dọn", () => {
  const { s, c } = mk();
  s.setSchedule({ keepDaily: 30 });
  s.save('{"a":0}'); s.backup("sau-chot-2026-09");
  for (let i = 1; i <= 35; i++) { c.t += 864e5; s.save('{"a":' + i + "}"); }
  assert.equal(tags(s, "daily"), 30); assert.equal(tags(s, "sau-chot-2026-09"), 1);
});

test("U-SCH-05 bản định kỳ giữ 48 bản gần nhất", () => {
  const { s, c } = mk(); s.setSchedule({ everyHours: 1 });
  for (let i = 1; i <= 52; i++) { s.save('{"a":' + i + "}"); c.t += 3600e3 + 1; s.tickSchedule(); }
  assert.equal(tags(s, "dinh-ky"), 48);
});
