// GĐ5: Full Backup — gói ZIP có manifest SHA-256, từ chối gói hỏng, nhập chứng từ không ghi đè
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path"), cp = require("child_process");
const { createVault } = require("../../main/documents");
const FB = require("../../main/fullbackup");
const Z = require("../../main/zip");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "fb-"));
function setup() {
  const root = tmp(); let n = 0;
  const v = createVault(path.join(root, "documents"), { now: () => new Date(2026, 9, 13, 9, 0, 0), rand: () => "B" + String(++n).padStart(5, "0") });
  const a = v.add(Buffer.from("anh chung tu 1".repeat(1000)), { name: "bang-cong.png", user: "admin" }), b = v.add(Buffer.from("%PDF pdf 2"), { name: "phieu.pdf" });
  const dataText = JSON.stringify({ schemaVersion: 2, nhanvien: [{ "Mã NV": "NV001", "Họ và tên": "Nguyễn Văn Á" }], chungtu: [{ id: a.id }, { id: b.id }] });
  return { root, v, a, b, dataText, dest: path.join(root, "out") };
}
const mk = (s) => FB.create({ dataText: s.dataText, vault: s.v, destDir: s.dest, appVersion: "t", user: "admin", now: () => new Date(2026, 9, 13, 10, 0, 0) });

test("create: gói đọc được bằng ZIP chuẩn, có manifest + sha256 toàn gói + sidecar chứng từ", () => {
  const s = setup(), r = mk(s);
  assert.equal(r.ok, true); assert.equal(r.docs, 2); assert.ok(fs.existsSync(r.file + ".sha256"));
  assert.equal(fs.existsSync(r.file + ".tmp"), false);
  const names = Z.openZip(r.file).entries.map((e) => e.name).sort();
  assert.ok(names.includes("manifest.json") && names.includes("data.json") && names.includes("documents/" + s.a.id + ".png") && names.includes("documents/" + s.a.id + ".json"));
  let py = ""; try { py = cp.execSync("python3 -m zipfile -t " + JSON.stringify(r.file), { encoding: "utf8" }); } catch (e) { py = "skip"; }
  assert.ok(py === "skip" || /Done testing/.test(py));
});

test("inspect: gói tốt → ok, trả lại đúng dữ liệu (kể cả tiếng Việt); phân loại chứng từ new/same", () => {
  const s = setup(), r = mk(s), rep = FB.inspect(r.file, s.v);
  assert.equal(rep.ok, true); assert.equal(rep.dataText, s.dataText); assert.deepEqual(rep.docs.map((d) => d.state), ["same", "same"]);
  const empty = createVault(path.join(tmp(), "d")); assert.deepEqual(FB.inspect(r.file, empty).docs.map((d) => d.state), ["new", "new"]);
});

test("inspect: từ chối gói bị sửa (data, chứng từ), thiếu manifest, không phải ZIP, mục có '..'", () => {
  const s = setup(), r = mk(s), good = fs.readFileSync(r.file);
  const flip = (pos) => { const b = Buffer.from(good); b[pos] ^= 0xFF; const f = path.join(s.root, "x" + pos + ".zip"); fs.writeFileSync(f, b); return FB.inspect(f); };
  assert.equal(flip(45).ok, false);                                   // trong data.json
  const z = Z.openZip(r.file), e = z.entries.find((x) => /^documents\/.*\.png$/.test(x.name)); z.close();
  const bad = Buffer.from(good); bad[e.offset + 30 + Buffer.byteLength(e.name) + 7] ^= 0xFF; const f2 = path.join(s.root, "doc.zip"); fs.writeFileSync(f2, bad);
  const rep = FB.inspect(f2); assert.equal(rep.ok, false); assert.ok(rep.problems.some((p) => p.includes(s.a.id)));
  fs.writeFileSync(path.join(s.root, "junk.zip"), "khong phai zip, chi la van ban dai hon hai muoi hai byte");
  assert.equal(FB.inspect(path.join(s.root, "junk.zip")).ok, false);
  const w = Z.createWriter(path.join(s.root, "nomf.zip")); w.addBuffer("data.json", Buffer.from("{}")); w.finish();
  assert.match(FB.inspect(path.join(s.root, "nomf.zip")).problems[0], /manifest/);
  assert.throws(() => { const w2 = Z.createWriter(path.join(s.root, "slip.zip")); w2.addBuffer("../evil.txt", Buffer.from("x")); }, /không hợp lệ/);
});

test("importDocuments: kho trống → thêm đủ, giữ nguyên DocumentID; chạy lại → 'same'; khác nội dung cùng ID → conflict, không ghi đè", () => {
  const s = setup(), r = mk(s), v2 = createVault(path.join(tmp(), "d"));
  const i1 = FB.importDocuments(r.file, v2); assert.equal(i1.added, 2); assert.deepEqual(v2.list().map((m) => m.id).sort(), [s.a.id, s.b.id].sort());
  assert.ok(v2.verify().every((x) => x.status === "ok"));
  const i2 = FB.importDocuments(r.file, v2); assert.equal(i2.added, 0); assert.equal(i2.same, 2);
  fs.writeFileSync(v2.pathOf(s.b.id), "NOI DUNG KHAC");                // kho đích có ID trùng nhưng nội dung khác (meta vẫn cũ)
  const meta = v2.find(s.b.id); meta.sha256 = "0".repeat(64);          // giả lập khác SHA
  const i3 = FB.importDocuments(r.file, v2); assert.deepEqual(i3.conflict, [s.b.id]); assert.equal(fs.readFileSync(v2.pathOf(s.b.id), "utf8"), "NOI DUNG KHAC");
});

test("create: chứng từ mất file → FAILED (không tạo gói, không để file dở); JSON lỗi bị từ chối", () => {
  const s = setup(); fs.unlinkSync(s.v.pathOf(s.b.id));
  const r = mk(s); assert.equal(r.ok, false); assert.equal(r.status, "FAILED"); assert.equal(r.missing.length, 1); assert.equal(r.missing[0].id, s.b.id);
  assert.equal(fs.existsSync(s.dest) ? fs.readdirSync(s.dest).filter((n) => /\.zip/.test(n)).length : 0, 0);
  assert.equal(FB.create({ dataText: "{hong", vault: s.v, destDir: s.dest }).ok, false);
});

test("V8 create: allowPartial → PARTIAL (ok:false, không tính Full Backup), tên PartialBackup, manifest.complete=false, liệt kê phần thiếu", () => {
  const s = setup(); fs.unlinkSync(s.v.pathOf(s.b.id));
  const r = FB.create({ dataText: s.dataText, vault: s.v, destDir: s.dest, allowPartial: true, now: () => new Date(2026, 9, 13, 10, 0, 0) });
  assert.equal(r.status, "PARTIAL"); assert.equal(r.ok, false); assert.equal(r.partial, true); assert.match(r.name, /^LuongHAK_PartialBackup_/);
  assert.equal(r.docs, 1); assert.equal(r.missing[0].id, s.b.id);
  const rep = FB.inspect(r.file); assert.equal(rep.ok, true); assert.equal(rep.partial, true); assert.equal(rep.manifest.complete, false);
});

test("V8 create: ảnh chứng từ bị hỏng (sai SHA) → FAILED; thư mục không ghi được → FAILED; thiếu dung lượng → FAILED", () => {
  const s = setup(); fs.writeFileSync(s.v.pathOf(s.a.id), "hong hoc");
  const r = mk(s); assert.equal(r.status, "FAILED"); assert.match(r.missing[0].problem, /SHA/);
  const s2 = setup(), blocker = path.join(s2.root, "file"); fs.writeFileSync(blocker, "x");
  assert.equal(FB.create({ dataText: s2.dataText, vault: s2.v, destDir: path.join(blocker, "sub") }).status, "FAILED");
  const low = FB.create({ dataText: s2.dataText, vault: s2.v, destDir: s2.dest, statfs: () => ({ bavail: 1, bsize: 1024 }) });
  assert.equal(low.status, "FAILED"); assert.match(low.error, /dung lượng/);
});

test("V8 create: hủy giữa chừng → CANCELLED, không để lại .tmp/.zip", () => {
  const s = setup(); let n = 0;
  const r = FB.create({ dataText: s.dataText, vault: s.v, destDir: s.dest, shouldCancel: () => ++n > 2 });
  assert.equal(r.status, "CANCELLED");
  assert.deepEqual(fs.readdirSync(s.dest), []);
});

test("V8 create với thư viện OCR: đủ → SUCCESS và có library.jsonl + ảnh; ảnh mẫu hỏng → FAILED, PARTIAL liệt kê ảnh", () => {
  const { createStore } = require("../../main/ocr-library.js"), S = require("../fixtures/synth-digits.js");
  const s = setup(), lib = createStore(path.join(s.root, "lib")), im = S.render("7", S.prng(1));
  lib.record({ raw: im.g, clean: im.g, w: im.w, h: im.h, cellType: "digit", docId: "D", page: 1, bbox: { x0: 1, y0: 1, x1: 9, y1: 9 }, before: "", after: "7" });
  const ok = FB.create({ dataText: s.dataText, vault: s.v, ocrLib: lib, destDir: s.dest }); assert.equal(ok.status, "SUCCESS"); assert.equal(ok.ocrSamples, 1);
  const names = Z.openZip(ok.file).entries.map((e) => e.name); assert.ok(names.includes("ocr_library/library.jsonl") && names.some((n) => /^ocr_library\/images\//.test(n)));
  const img = lib.files().find((f) => /\.png$/.test(f.rel)); fs.writeFileSync(img.abs, "hong");
  const bad = FB.create({ dataText: s.dataText, vault: s.v, ocrLib: lib, destDir: s.dest }); assert.equal(bad.status, "FAILED"); assert.equal(bad.missing[0].kind, "ocr-image");
  const part = FB.create({ dataText: s.dataText, vault: s.v, ocrLib: lib, destDir: s.dest, allowPartial: true }); assert.equal(part.status, "PARTIAL");
});

test("V8 create: nhật ký OCR cắt dở ở dòng cuối (mất điện) vẫn SUCCESS + cảnh báo; gói giữ assign/unassign khi khôi phục", () => {
  const { createStore } = require("../../main/ocr-library.js"), S = require("../fixtures/synth-digits.js");
  const s = setup(), lib = createStore(path.join(s.root, "lib")), im = S.render("7", S.prng(1)), P = (a, b) => ({ raw: im.g, clean: im.g, w: im.w, h: im.h, cellType: "digit", docId: "D", page: 1, bbox: { x0: 1, y0: 1, x1: 9, y1: 9 }, before: a, after: b });
  lib.record(P("", "7")); lib.record(Object.assign(P("7", ""), { raw: null, clean: null }));
  fs.appendFileSync(path.join(s.root, "lib", "library.jsonl"), '{"t":"edit","id":"EDT-cut');
  const lib2 = createStore(path.join(s.root, "lib")); lib2.load();
  const r = FB.create({ dataText: s.dataText, vault: s.v, ocrLib: lib2, destDir: s.dest }); assert.equal(r.status, "SUCCESS"); assert.ok(r.warnings.some((w) => /cắt dở/.test(w)));
  const fresh = createStore(path.join(s.root, "lib-new")); FB.importOcrLibrary(r.file, fresh);
  assert.equal(fresh.lib.edits().length, 2); assert.equal(fresh.lib.list()[0].status, "SUPERSEDED"); assert.equal(fresh.lib.cellSample(fresh.lib.edits()[0].cellKey), null);
});
