"use strict";
// V8 P0-6: khôi phục theo giao dịch — PRECHECK → STAGING → VERIFY → COMMIT → POSTCHECK, hoàn tác, chống ZIP slip / bomb / gói bị sửa
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { createVault } = require("../../main/documents"), { createStore } = require("../../main/ocr-library.js");
const FB = require("../../main/fullbackup"), Z = require("../../main/zip"), { createRestorer } = require("../../main/restore");
const S = require("../fixtures/synth-digits.js");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "rs-"));
const bb = (a, b, c, d) => ({ x0: a, y0: b, x1: c, y1: d });

function source() {
  const root = tmp(); let n = 0;
  const v = createVault(path.join(root, "documents"), { now: () => new Date(2026, 9, 13, 9, 0, 0), rand: () => "R" + String(++n).padStart(5, "0") });
  const a = v.add(Buffer.from("anh bang cong".repeat(500)), { name: "bang-cong.png" }), b = v.add(Buffer.from("%PDF phieu"), { name: "phieu.pdf" });
  const lib = createStore(path.join(root, "lib"), { spoolDir: path.join(root, "spool") });
  ["1", "7", "3"].forEach((l, i) => { const im = S.render(l, S.prng(i + 1)); lib.record({ raw: im.g, clean: im.g, w: im.w, h: im.h, cellType: "digit", docId: a.id, page: 1, bbox: bb(i * 50, 0, i * 50 + 40, 60), before: "", after: l, employeeId: "NV00" + (i + 1) }); });
  const data = { schemaVersion: 2, nhanvien: [{ "Mã NV": "NV001", "Họ và tên": "Nguyễn Văn Á" }, { "Mã NV": "NV002" }], chamcong: [{ "Kỳ": "2026-09", "Mã NV": "NV001", "01": "1" }], kyluong: [{ "Kỳ": "2026-08", chot: true }], chungtu: [{ id: a.id }, { id: b.id }] };
  const dataText = JSON.stringify(data);
  const pkg = FB.create({ dataText, vault: v, ocrLib: lib, destDir: path.join(root, "out") });
  assert.equal(pkg.status, "SUCCESS");
  return { root, v, lib, a, b, data, dataText, pkg };
}
function target(over) {
  const root = tmp(), userData = path.join(root, "ud"); fs.mkdirSync(userData);
  const t = { root, userData, v: createVault(path.join(root, "documents")), lib: createStore(path.join(root, "lib"), { spoolDir: path.join(root, "spool") }), live: null };
  t.rs = createRestorer(Object.assign({ userData, getVault: () => t.v, getOcrLib: () => t.lib, readData: () => (t.live == null ? { ok: false } : { ok: true, text: t.live }), maxSchema: 5 }, over || {}));
  return t;
}
const snap = (t) => JSON.stringify({ docs: t.v.list().map((d) => d.id).sort(), lib: t.lib.lib.size(), log: fs.existsSync(path.join(t.lib.root, "library.jsonl")) ? fs.statSync(path.join(t.lib.root, "library.jsonl")).size : 0 });

test("U-RS-01 gói tốt: STAGING+VERIFY đạt, KHÔNG đổi gì ở kho chứng từ / thư viện OCR cho tới khi commit", () => {
  const s = source(), t = target(), before = snap(t);
  const r = t.rs.stage(s.pkg.file);
  assert.equal(r.ok, true, r.error); assert.deepEqual(r.phases.map((p) => p.name), ["PRECHECK", "STAGING", "VERIFY"]); assert.ok(r.phases.every((p) => p.ok));
  assert.equal(snap(t), before); assert.equal(r.text, s.dataText); assert.equal(r.ocr.samples, 3);
});

test("U-RS-02 commit + postcheck + finish: chứng từ & thư viện OCR về đủ, nhật ký DONE, thư mục tạm sạch, khóa ghi mở lại", () => {
  const s = source(), t = target(), r = t.rs.stage(s.pkg.file);
  const c = t.rs.commitAssets(r.rid); assert.equal(c.ok, true, c.error); assert.equal(c.docs.added, 2); assert.equal(c.ocr.addedSamples, 3);
  assert.equal(t.rs.busy(), true);
  t.live = s.dataText;
  const p = t.rs.postcheck(r.rid); assert.equal(p.ok, true, JSON.stringify(p.checks));
  t.rs.finish(r.rid); assert.equal(t.rs.busy(), false);
  assert.equal(JSON.parse(fs.readFileSync(t.rs.journalFile, "utf8")).state, "DONE");
  assert.equal(fs.readdirSync(path.join(t.userData, "restore-staging")).length, 0);
  assert.ok(t.v.verify().every((x) => x.status === "ok")); assert.equal(t.lib.verify().ok, true); assert.equal(t.lib.lib.edits().length, 3);
});

test("U-RS-03 gói bị sửa 1 byte (chứng từ / data / thư viện): PRECHECK từ chối, thư mục tạm không để lại, kho nguyên", () => {
  const s = source(), good = fs.readFileSync(s.pkg.file), z = Z.openZip(s.pkg.file);
  const targets = z.entries.filter((e) => /^documents\/.*\.png$/.test(e.name) || e.name === "data.json" || e.name === "ocr_library/library.jsonl"); z.close();
  targets.forEach((e, i) => {
    const bad = Buffer.from(good); bad[e.offset + 30 + Buffer.byteLength(e.name) + 3] ^= 0xFF; const f = path.join(s.root, "bad" + i + ".zip"); fs.writeFileSync(f, bad);
    const t = target(), before = snap(t), r = t.rs.stage(f); assert.equal(r.ok, false, e.name); assert.equal(r.phase, "PRECHECK"); assert.equal(snap(t), before);
    const sd = path.join(t.userData, "restore-staging"); assert.ok(!fs.existsSync(sd) || fs.readdirSync(sd).length === 0);
  });
});

test("U-RS-04 thiếu ảnh mẫu OCR / thiếu thư viện trong gói: từ chối", () => {
  const s = source(), z = Z.openZip(s.pkg.file), strip = (pred, name) => {
    const w = Z.createWriter(path.join(s.root, name)); z.entries.forEach((e) => { if (!pred(e.name)) w.addBuffer(e.name, z.readBuffer(e)); }); w.finish(); return path.join(s.root, name); };
  const noImg = strip((n) => /^ocr_library\/images\//.test(n) && n.endsWith("0.png") || /^ocr_library\/images\/[0-9a-f]{2}\/[0-9a-f]{63}[0-4]\.png$/.test(n), "noimg.zip");
  const noLib = strip((n) => n === "ocr_library/library.jsonl", "nolib.zip"); z.close();
  [noImg, noLib].forEach((f) => { const t = target(), r = t.rs.stage(f); assert.equal(r.ok, false); });
});

test("U-RS-05 ZIP slip: tên mục '../' bị từ chối ngay khi mở; bomb: tỉ lệ nén / tổng dung lượng vượt giới hạn bị từ chối", () => {
  const dir = tmp(), f = path.join(dir, "s.zip"), w = Z.createWriter(f); w.addBuffer("xx/evil.txt", Buffer.from("x")); w.finish();
  const b = fs.readFileSync(f); let s0 = b.toString("latin1"); s0 = s0.split("xx/evil.txt").join("../evil.txt"); fs.writeFileSync(f, Buffer.from(s0, "latin1"));
  assert.throws(() => Z.openZip(f), /không an toàn/);
  const g = path.join(dir, "bomb.zip"), w2 = Z.createWriter(g); w2.addBuffer("zeros.bin", Buffer.alloc(8 * 1048576)); w2.finish();
  assert.throws(() => Z.openZip(g, { maxRatio: 100 }), /ZIP bomb/); assert.throws(() => Z.openZip(g, { maxTotalBytes: 1048576 }), /ZIP bomb/);
  Z.openZip(g, { maxRatio: 100000 }).close(); // nới giới hạn thì mở được
});

test("U-RS-06 lỗi giữa chừng khi commit: tự hoàn tác — chứng từ vừa thêm biến mất, thư viện OCR về đúng kích thước cũ, chứng từ có sẵn không bị đụng", () => {
  const s = source(), t = target(); const keep = t.v.add(Buffer.from("co san"), { name: "cu.pdf" });
  const imx = S.render("5", S.prng(9)); t.lib.record({ raw: imx.g, clean: imx.g, w: imx.w, h: imx.h, cellType: "digit", docId: "OLD", page: 1, bbox: bb(0, 0, 9, 9), before: "", after: "5" });
  const before = snap(t), r = t.rs.stage(s.pkg.file); assert.equal(r.ok, true);
  const real = t.v.importDoc; let k = 0; t.v.importDoc = (m, b) => { if (++k === 2) throw new Error("đĩa đầy giả lập"); return real(m, b); };
  const c = t.rs.commitAssets(r.rid); assert.equal(c.ok, false); assert.equal(c.rolledBack, true);
  assert.equal(snap(t), before); assert.ok(t.v.find(keep.id)); assert.equal(t.rs.busy(), false);
  assert.equal(JSON.parse(fs.readFileSync(t.rs.journalFile, "utf8")).state, "ROLLED_BACK");
});

test("U-RS-07 postcheck hỏng (dữ liệu sau khi ghi thiếu dòng) → ok:false; rollback() đưa tài sản về như cũ", () => {
  const s = source(), t = target(), before = snap(t), r = t.rs.stage(s.pkg.file); t.rs.commitAssets(r.rid);
  t.live = JSON.stringify(Object.assign({}, s.data, { nhanvien: [] }));
  const p = t.rs.postcheck(r.rid); assert.equal(p.ok, false); assert.ok(p.checks.some((c) => !c.ok));
  assert.equal(t.rs.rollback(r.rid).ok, true); assert.equal(snap(t), before); assert.equal(t.rs.busy(), false);
});

test("U-RS-08 khởi động lại giữa chừng: COMMITTING → hoàn tác; ASSETS_DONE + dữ liệu đã thay → giữ nguyên (roll-forward)", () => {
  const s = source(), t = target(), before = snap(t), r = t.rs.stage(s.pkg.file); t.rs.commitAssets(r.rid);
  const t2 = target(); t2.v = t.v; t2.lib = t.lib; t2.userData = t.userData;
  const rs2 = createRestorer({ userData: t.userData, getVault: () => t.v, getOcrLib: () => t.lib, readData: () => ({ ok: true, text: "{}" }) });
  assert.match(rs2.recover().note, /hoàn tác/); assert.equal(snap(t), before);
  // roll-forward
  const rsA = createRestorer({ userData: t.userData, getVault: () => t.v, getOcrLib: () => t.lib, readData: () => ({ ok: false }) }); const r2 = rsA.stage(s.pkg.file); assert.equal(rsA.commitAssets(r2.rid).ok, true);
  const rs3 = createRestorer({ userData: t.userData, getVault: () => t.v, getOcrLib: () => t.lib, readData: () => ({ ok: true, text: s.dataText }) });
  assert.match(rs3.recover().note, /roll-forward/); assert.equal(t.v.list().length, 2);
});

test("U-RS-09 dữ liệu đã có: chứng từ trùng → same; khác nội dung cùng mã → giữ bản cũ; mẫu OCR đã có không nhân đôi; chạy lại 2 lần không trùng", () => {
  const s = source(), t = target();
  let r = t.rs.stage(s.pkg.file); t.rs.commitAssets(r.rid); t.rs.finish(r.rid);
  r = t.rs.stage(s.pkg.file); const c = t.rs.commitAssets(r.rid); assert.equal(c.docs.added, 0); assert.equal(c.docs.same, 2); assert.equal(c.ocr.addedSamples, 0); t.rs.finish(r.rid);
  assert.equal(t.lib.lib.size(), 3); assert.equal(t.lib.lib.edits().length, 3);
  const m = t.v.find(s.b.id); fs.writeFileSync(t.v.pathOf(s.b.id), "KHAC"); m.sha256 = "0".repeat(64);
  r = t.rs.stage(s.pkg.file); assert.deepEqual(r.conflicts, [s.b.id]); const c2 = t.rs.commitAssets(r.rid); assert.deepEqual(c2.docs.conflict, [s.b.id]); t.rs.finish(r.rid);
  assert.equal(fs.readFileSync(t.v.pathOf(s.b.id), "utf8"), "KHAC");
});

test("U-RS-10 schema mới hơn app → từ chối; gói MỘT PHẦN cần xác nhận riêng; thiếu dung lượng → từ chối", () => {
  const s = source(); const t = target({ maxSchema: 1 }); const r = t.rs.stage(s.pkg.file); assert.equal(r.ok, false); assert.match(r.error, /schema/);
  const t2 = target({ statfs: () => ({ bavail: 1, bsize: 512 }) }); const r2 = t2.rs.stage(s.pkg.file); assert.equal(r2.ok, false); assert.match(r2.error, /dung lượng/);
  fs.unlinkSync(s.v.pathOf(s.b.id)); const part = FB.create({ dataText: s.dataText, vault: s.v, ocrLib: s.lib, destDir: path.join(s.root, "p"), allowPartial: true }); assert.equal(part.status, "PARTIAL");
  const t3 = target(), r3 = t3.rs.stage(part.file); assert.equal(r3.ok, false); assert.equal(r3.needsPartialAck, true);
  const r4 = t3.rs.stage(part.file, { acceptPartial: true }); assert.equal(r4.ok, true); assert.equal(r4.partial, true);
});

test("U-RS-11 khôi phục sang thư mục/ổ khác (kho chứng từ & thư viện OCR ở đường dẫn tùy chọn): đủ và nguyên vẹn", () => {
  const s = source(), alt = tmp(), t = target(); t.v = createVault(path.join(alt, "D", "KhoChungTu")); t.lib = createStore(path.join(alt, "D", "ThuVienOCR"), { spoolDir: path.join(t.root, "sp") });
  const r = t.rs.stage(s.pkg.file); assert.equal(r.ok, true, r.error); assert.equal(t.rs.commitAssets(r.rid).ok, true); t.rs.finish(r.rid);
  assert.equal(t.v.list().length, 2); assert.ok(t.v.verify().every((x) => x.status === "ok")); assert.equal(t.lib.verify().ok, true);
});

test("U-RS-12 (V9) POSTCHECK so NỘI DUNG: sửa 1 ô công / đổi tổng thực lĩnh snapshot kỳ chốt dù số dòng giữ nguyên → không đạt", () => {
  const DD = require("../../main/data-digest");
  const base = { nhanvien: [{ "Mã NV": "A", "Họ và tên": "An" }], chamcong: [{ "Kỳ": "2026-09", "Mã NV": "A", "01": "1" }], ocr_ten: [], chungtu_lienket: [],
    kyluong: [{ ky: "2026-09", version: 2, kq: { bangluong: [{ "Mã NV": "A", "Tổng thu nhập": 10000000, "Thực lĩnh": 9000000 }] } }] };
  const exp = DD.digest(base);
  assert.deepEqual(DD.compare(exp, DD.digest(JSON.parse(JSON.stringify(base)))), [], "bản sao y hệt (khác thứ tự khóa) phải khớp");
  const reordered = JSON.parse(JSON.stringify(base)); reordered.nhanvien[0] = { "Họ và tên": "An", "Mã NV": "A" };
  assert.deepEqual(DD.compare(exp, DD.digest(reordered)), [], "thứ tự khóa không làm lệch");
  const c1 = JSON.parse(JSON.stringify(base)); c1.chamcong[0]["01"] = "0,5";
  assert.match(DD.compare(exp, DD.digest(c1)).join(), /chamcong: nội dung khác/);
  const c2 = JSON.parse(JSON.stringify(base)); c2.kyluong[0].kq.bangluong[0]["Thực lĩnh"] = 9000001;
  assert.ok(DD.compare(exp, DD.digest(c2)).some((x) => /kỳ chốt 2026-09#v2: tổng snapshot khác/.test(x)));
  const c3 = JSON.parse(JSON.stringify(base)); c3.kyluong = [];
  assert.ok(DD.compare(exp, DD.digest(c3)).some((x) => /kyluong|kỳ chốt/.test(x)));
});
test("U-RS-13 (V9) Full Backup ghi digest vào manifest; khôi phục sai nội dung (cùng số dòng) bị POSTCHECK bắt", () => {
  const s = source(), t = target(), r = t.rs.stage(s.pkg.file); t.rs.commitAssets(r.rid);
  const live = JSON.parse(s.dataText); live.nhanvien[0]["Họ và tên"] = "Người khác"; t.live = JSON.stringify(live);
  const p = t.rs.postcheck(r.rid); assert.equal(p.ok, false);
  assert.ok(p.checks.some((c) => /nội dung dữ liệu lương/.test(c.name) && !c.ok && /nhanvien/.test(c.detail)), JSON.stringify(p.checks));
  t.live = s.dataText; assert.equal(t.rs.postcheck(r.rid).ok, true); t.rs.rollback(r.rid);
});

test("U-RS-14 (V9) không chạy 2 lần khôi phục đồng thời: stage thứ 2 trong lúc COMMIT bị từ chối; commit lần 2 cùng phiên bị từ chối", () => {
  const s = source(), t = target(), r1 = t.rs.stage(s.pkg.file), r2 = t.rs.stage(s.pkg.file);
  assert.equal(r1.ok, true); assert.equal(r2.ok, true, "chuẩn bị song song được, nhưng chỉ một phiên được COMMIT");
  assert.equal(t.rs.commitAssets(r1.rid).ok, true);
  const again = t.rs.commitAssets(r2.rid); assert.equal(again.ok, false, "phiên thứ 2 không được commit khi phiên 1 đang chạy");
  const st3 = t.rs.stage(s.pkg.file); assert.equal(st3.ok, false); assert.match(st3.error, /khác chưa kết thúc/);
  t.live = s.dataText; assert.equal(t.rs.postcheck(r1.rid).ok, true); t.rs.finish(r1.rid);
  assert.equal(t.rs.busy(), false);
});
