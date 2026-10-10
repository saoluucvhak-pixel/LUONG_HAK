// Sao lưu an toàn (2.0 §4.4): tên duy nhất, SHA-256, không xóa bản tốt cuối cùng, mô phỏng lỗi đĩa
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createStorage, sha256 } = require("../../main/storage.js");

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), "hak-fail-")); }
const fixed = () => new Date("2026-10-10T09:00:00.000"); // đồng hồ đứng yên: mọi thao tác "cùng 1 thời điểm"
function failingFs(rule) {
  // Bọc fs thật; rule(tên hàm, đối số) trả lỗi cần ném (hoặc null)
  const wrap = {};
  Object.keys(fs).forEach((k) => { wrap[k] = typeof fs[k] === "function" ? (...a) => { const e = rule(k, a); if (e) throw e; return fs[k](...a); } : fs[k]; });
  return wrap;
}
const err = (code) => Object.assign(new Error(code), { code });
const noTmp = (dir) => fs.readdirSync(dir).concat(fs.existsSync(path.join(dir, "backups")) ? fs.readdirSync(path.join(dir, "backups")) : []).filter((f) => /\.tmp$/.test(f));

test("U-STO-08 nhiều bản sao lưu tại CÙNG thời điểm → tên khác nhau, không bản nào bị ghi đè", () => {
  const dir = tmp(), s = createStorage(dir, { now: fixed });
  const names = [];
  for (let i = 0; i < 5; i++) { s.save(JSON.stringify({ v: i })); names.push(s.backup("truoc-mo-chot")); }
  assert.equal(new Set(names).size, 5);
  assert.deepEqual(names.map((n) => JSON.parse(s.readBackup(n).text).v), [0, 1, 2, 3, 4]);
  // kể cả khi bộ sinh mã ngẫu nhiên trùng: file đã có không bị đè (cờ loại trừ + thử lại)
  let k = 0; const s2 = createStorage(dir, { now: fixed, rand: () => (k++ < 3 ? "aaaaaa" : "bbbbbb" + k) });
  const a = s2.backup("thu-cong"), b = s2.backup("thu-cong");
  assert.notEqual(a, b); assert.ok(s2.readBackup(a).ok && s2.readBackup(b).ok);
});

test("U-STO-09 mỗi bản sao lưu có SHA-256; bản bị sửa/hỏng bị phát hiện, KHÔNG cho khôi phục", () => {
  const dir = tmp(), s = createStorage(dir);
  s.save('{"v":"goc"}'); const n = s.backup("thu-cong");
  const sc = JSON.parse(fs.readFileSync(path.join(dir, "backups", n + ".sha256"), "utf8"));
  assert.equal(sc.sha256, sha256('{"v":"goc"}'));
  assert.equal(s.verifyBackup(n).status, "ok");
  fs.writeFileSync(path.join(dir, "backups", n), '{"v":"bi-sua"}'); // vẫn là JSON hợp lệ
  assert.equal(s.verifyBackup(n).status, "mismatch");
  const r = s.readBackup(n); assert.equal(r.ok, false); assert.match(r.error, /SHA-256/);
  fs.writeFileSync(path.join(dir, "backups", n), '{"v":'); // cắt cụt
  assert.equal(s.verifyAll().find((b) => b.name === n).status, "invalid");
  // bản sao lưu cũ (trước 2.0) không có file kiểm tra → vẫn khôi phục được, đánh dấu chưa kiểm tra
  fs.writeFileSync(path.join(dir, "backups", "startup_20260101-080000.json"), '{"v":"cu"}');
  assert.equal(s.readBackup("startup_20260101-080000.json").status, "unverified");
});

test("U-STO-10 dọn bản cũ KHÔNG BAO GIỜ xóa bản sao lưu tốt mới nhất", () => {
  const dir = tmp(); let t = new Date("2026-10-10T08:00:00").getTime(), corrupt = false;
  // ổ đĩa lỗi: sau bản đầu tiên, mọi bản sao lưu ghi ra đều bị hỏng nội dung (không khớp SHA-256)
  const paths = {}, wfs = failingFs(() => null);
  wfs.openSync = (f, flag) => { const fd = fs.openSync(f, flag); paths[fd] = String(f); return fd; };
  wfs.writeSync = (fd, text, ...rest) => fs.writeSync(fd, corrupt && /startup_.*\.json\.\w+\.tmp$/.test(paths[fd]) ? text.replace("tot", "hỏng") : text, ...rest);
  const s = createStorage(dir, { now: () => new Date(t), fs: wfs });
  s.save('{"v":"tot"}'); t += 1000; const good = s.backup("startup");
  corrupt = true;
  for (let i = 0; i < 14; i++) { t += 1000; s.backup("startup"); }
  assert.equal(s.verifyBackup(good).status, "ok", "bản tốt duy nhất phải còn");
  const st = s.verifyAll().filter((b) => b.tag === "startup");
  assert.equal(st.filter((b) => b.status === "ok").length, 1);
  assert.equal(st.length, 11); // 10 bản mới nhất + bản tốt cuối cùng được giữ lại
});

test("U-STO-11 ổ đĩa ĐẦY khi ghi → báo lỗi rõ ràng, file đang có giữ nguyên, không để lại file tạm", () => {
  const dir = tmp(), ok = createStorage(dir); ok.save('{"v":"cu"}');
  const s = createStorage(dir, { fs: failingFs((fn, a) => (fn === "writeSync" ? err("ENOSPC") : null)) });
  const r = s.save('{"v":"moi"}');
  assert.match(r, /Ổ đĩa đã đầy/);
  assert.equal(JSON.parse(ok.load().text).v, "cu");
  assert.deepEqual(noTmp(dir), []);
});

test("U-STO-12 không có quyền ghi / ổ chỉ đọc → báo lỗi, không hỏng dữ liệu", () => {
  for (const code of ["EACCES", "EPERM", "EROFS"]) {
    const dir = tmp(), ok = createStorage(dir); ok.save('{"v":"cu"}');
    const s = createStorage(dir, { fs: failingFs((fn, a) => (fn === "openSync" && String(a[0]).endsWith(".tmp") ? Object.assign(err(code), { path: a[0] }) : null)) });
    const r = s.save('{"v":"moi"}');
    assert.notEqual(r, true); assert.match(r, code === "EROFS" ? /chỉ đọc/ : /quyền/);
    assert.equal(JSON.parse(ok.load().text).v, "cu");
  }
});

test("U-STO-13 MẤT ĐIỆN giữa ghi file tạm và đổi tên → file cũ nguyên vẹn; lần mở sau dọn file tạm", () => {
  const dir = tmp(), ok = createStorage(dir); ok.save('{"v":"cu"}');
  const s = createStorage(dir, { fs: failingFs((fn, a) => (fn === "renameSync" && String(a[1]).endsWith("data.json") ? err("EIO") : null)) });
  assert.notEqual(s.save('{"v":"moi"}'), true);
  assert.equal(JSON.parse(ok.load().text).v, "cu");
  // mô phỏng file tạm sót lại do tắt máy đột ngột (tiến trình chết trước khi kịp dọn)
  fs.writeFileSync(path.join(dir, "data.json.abc123.tmp"), '{"v":"do dang');
  const r = ok.load(); assert.equal(JSON.parse(r.text).v, "cu"); assert.deepEqual(noTmp(dir), []);
});

test("U-STO-14 ghi xong nhưng đọc lại không khớp (đĩa lỗi) → KHÔNG báo thành công", () => {
  const dir = tmp(), ok = createStorage(dir); ok.save('{"v":"cu"}');
  let reads = 0;
  const bad = failingFs(() => null);
  bad.readFileSync = (f, enc) => { const t = fs.readFileSync(f, enc); return String(f).endsWith("data.json") && ++reads > 1 ? t.slice(0, -2) : t; };
  const s = createStorage(dir, { fs: bad });
  const r = s.save('{"v":"moi-hon-nua"}');
  assert.notEqual(r, true); assert.match(r, /không khớp/);
});

test("U-STO-15 cất file hỏng nhiều lần cùng thời điểm → mỗi lần một tên, không mất file hỏng nào", () => {
  const dir = tmp(), s = createStorage(dir, { now: fixed }), q = [];
  for (const t of ["{h1", "{h2", "{h3"]) { fs.writeFileSync(path.join(dir, "data.json"), t); q.push(s.quarantineCorrupt()); }
  assert.equal(new Set(q).size, 3);
  assert.deepEqual(q.map((f) => fs.readFileSync(path.join(dir, f), "utf8")), ["{h1", "{h2", "{h3"]);
});

test("U-STO-16 sao lưu thất bại giữa chừng (đầy đĩa) → không để lại bản sao lưu dở dang", () => {
  const dir = tmp(), ok = createStorage(dir); ok.save('{"v":"x"}');
  let n = 0;
  const s = createStorage(dir, { fs: failingFs((fn, a) => (fn === "writeSync" && ++n === 1 ? err("ENOSPC") : null)) });
  assert.throws(() => s.backup("thu-cong"), /ENOSPC/);
  assert.equal(s.list().length, 0); assert.deepEqual(noTmp(dir), []);
});
