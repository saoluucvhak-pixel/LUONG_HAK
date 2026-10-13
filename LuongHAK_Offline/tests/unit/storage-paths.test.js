"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const SP = require("../../main/storage-paths.js"), { createVault } = require("../../main/documents");
const { createStore } = require("../../main/ocr-library.js"), S = require("../fixtures/synth-digits.js");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "sp-"));

test("U-STOR-01 mặc định + cấu hình tùy chỉnh được phân giải đúng", () => {
  const r = SP.resolve("/u", { ocrLibDir: "/x/ocr" }, "/u/exports");
  assert.equal(r.docs, path.join("/u", "documents")); assert.equal(r.ocrLib, "/x/ocr"); assert.equal(r.backup, "/u/exports"); assert.equal(r.mirror, "");
});
test("U-STOR-02 chuyển chứng từ: chép + kiểm SHA-256, nguồn còn nguyên, kho mới đọc được đủ", () => {
  const ud = tmp(), dst = tmp() + "/docs2"; const v = createVault(path.join(ud, "documents"));
  const a = v.add(Buffer.from("anh 1".repeat(500)), { name: "a.png" }), b = v.add(Buffer.from("%PDF b"), { name: "b.pdf" });
  let applied = null, saved = null;
  const r = SP.move({ kind: "docs", dir: dst, userData: ud, settings: {}, writeSettings: (s) => { saved = s; }, onApplied: (p) => { applied = p; } });
  assert.equal(r.ok, true); assert.equal(saved.docsDir, dst); assert.equal(applied.docs, dst);
  assert.ok(r.files >= 4); // 2 file + 2 sidecar
  const v2 = createVault(dst); assert.equal(v2.list().length, 2); assert.ok(v2.verify().every((x) => x.status === "ok"));
  assert.ok(fs.existsSync(path.join(ud, "documents"))); assert.equal(createVault(path.join(ud, "documents")).list().length, 2);
  assert.ok(v2.find(a.id) && v2.find(b.id));
});
test("U-STOR-03 đích có file khác nội dung → từ chối, không đổi cấu hình, không ghi đè", () => {
  const ud = tmp(), dst = tmp(); const v = createVault(path.join(ud, "documents")); v.add(Buffer.from("goc"), { name: "a.png" });
  const rel = fs.readdirSync(path.join(ud, "documents"))[0], sub = fs.readdirSync(path.join(ud, "documents", rel))[0];
  fs.mkdirSync(path.join(dst, rel), { recursive: true }); fs.writeFileSync(path.join(dst, rel, sub), "KHAC");
  let saved = null; const r = SP.move({ kind: "docs", dir: dst, userData: ud, settings: {}, writeSettings: (s) => { saved = s; } });
  assert.equal(r.ok, false); assert.equal(saved, null); assert.equal(fs.readFileSync(path.join(dst, rel, sub), "utf8"), "KHAC");
});
test("U-STOR-04 thư mục lồng nhau / không ghi được bị từ chối", () => {
  const ud = tmp(); const cur = SP.resolve(ud, {}, path.join(ud, "exports"));
  assert.match(SP.validate("ocrLib", path.join(cur.docs, "con"), cur), /lồng|trùng/);
  assert.match(SP.validate("docs", "tuongdoi/x", cur), /đầy đủ/);
  const fl = path.join(tmp(), "la-file"); fs.writeFileSync(fl, "x");
  assert.match(SP.validate("docs", path.join(fl, "con"), cur), /không ghi được/);
});
test("U-STOR-05 chuyển thư viện mẫu OCR: mở lại ở thư mục mới còn nguyên mẫu, tra cứu như cũ", () => {
  const ud = tmp(), dst = tmp() + "/ocr2", st = createStore(path.join(ud, "ocr_library")), rng = S.prng(5); let n = 0;
  "012".split("").forEach((l) => { for (let i = 0; i < 3; i++) { const im = S.render(l, rng); st.record({ raw: im.g, clean: im.g, w: im.w, h: im.h, cellType: "digit", docId: "D", page: 1, bbox: { x0: n, y0: n, x1: n + 1, y1: n + 1 }, after: l, before: "", mode: "so" }); n++; } });
  st.approve({ docId: "D" });
  const r = SP.move({ kind: "ocrLib", dir: dst, userData: ud, settings: {}, writeSettings: () => {} }); assert.equal(r.ok, true);
  const st2 = createStore(dst); st2.load(); assert.equal(st2.lib.size(), 9); assert.equal(st2.verify().ok, true);
  const t = S.render("1", S.prng(77)); assert.equal(st2.lookup([{ clean: t.g, w: t.w, h: t.h }])[0].label, st.lookup([{ clean: t.g, w: t.w, h: t.h }])[0].label);
});
test("U-STOR-06 sao lưu chính: chỉ chép các gói Full Backup (+ .sha256), bỏ file khác", () => {
  const ud = tmp(), ex = path.join(ud, "exports"), dst = tmp() + "/bk"; fs.mkdirSync(ex, { recursive: true });
  fs.writeFileSync(path.join(ex, "LuongHAK_FullBackup_20261013_100000.zip"), "zip"); fs.writeFileSync(path.join(ex, "LuongHAK_FullBackup_20261013_100000.zip.sha256"), "h"); fs.writeFileSync(path.join(ex, "BaoCao.xlsx"), "x");
  const r = SP.move({ kind: "backup", dir: dst, userData: ud, settings: {}, exportsDir: ex, writeSettings: () => {} });
  assert.equal(r.ok, true); assert.deepEqual(fs.readdirSync(dst).sort(), ["LuongHAK_FullBackup_20261013_100000.zip", "LuongHAK_FullBackup_20261013_100000.zip.sha256"]);
});
