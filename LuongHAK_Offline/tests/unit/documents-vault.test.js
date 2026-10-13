// GĐ4: kho chứng từ gốc — lưu nguyên bản, SHA-256, dedupe, không ghi đè/xóa, phát hiện hỏng
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { createVault, sha256 } = require("../../main/documents");

function mk() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vault-")); let n = 0;
  return { root, v: createVault(root, { now: () => new Date(2026, 9, 13, 8, 30, 15), rand: () => "A" + String(++n).padStart(5, "0") }) };
}

test("add: lưu nguyên bản + sidecar, đọc lại đúng byte và SHA-256", () => {
  const { v, root } = mk(), buf = Buffer.from("noi dung chung tu 1");
  const r = v.add(buf, { name: "Bảng công T10.pdf", user: "admin" });
  assert.equal(r.ok, true); assert.equal(r.duplicate, false);
  assert.match(r.id, /^DOC-202610-13083015-A00001$/); assert.equal(r.sha256, sha256(buf));
  const rd = v.read(r.id); assert.equal(rd.ok, true); assert.deepEqual(rd.data, buf);
  assert.equal(rd.meta.addedBy, "admin"); assert.equal(rd.meta.ext, "pdf");
  assert.ok(fs.existsSync(path.join(root, "202610", r.id + ".json")));
});

test("trùng nội dung (cùng SHA-256) dùng lại DocumentID cũ, kể cả sau khi mở lại kho", () => {
  const { v, root } = mk(), buf = Buffer.from("abc");
  const a = v.add(buf, { name: "a.png" }), b = v.add(buf, { name: "ten-khac.png" });
  assert.equal(b.duplicate, true); assert.equal(b.id, a.id);
  const v2 = createVault(root), c = v2.add(buf, { name: "x.png" });
  assert.equal(c.duplicate, true); assert.equal(c.id, a.id); assert.equal(v2.list().length, 1);
});

test("từ chối file rỗng, quá lớn, sai loại; tên file nguy hiểm được làm sạch", () => {
  const { v } = mk();
  assert.equal(v.add(Buffer.alloc(0), { name: "a.pdf" }).ok, false);
  assert.equal(v.add(Buffer.from("x"), { name: "virus.exe" }).ok, false);
  assert.equal(v.add("không phải buffer", { name: "a.pdf" }).ok, false);
  const r = v.add(Buffer.from("y"), { name: "..\\..\\evil/a.pdf" });
  assert.equal(r.ok, true); assert.ok(!/[\\/]/.test(r.name));
});

test("verify: phát hiện file bị sửa hoặc mất; không có API xóa", () => {
  const { v } = mk();
  const a = v.add(Buffer.from("goc-1"), { name: "a.pdf" }), b = v.add(Buffer.from("goc-2"), { name: "b.pdf" }), c = v.add(Buffer.from("goc-3"), { name: "c.pdf" });
  assert.ok(v.verify().every((x) => x.status === "ok"));
  fs.writeFileSync(v.pathOf(a.id), "bi sua"); fs.unlinkSync(v.pathOf(b.id));
  const st = Object.fromEntries(v.verify().map((x) => [x.id, x.status]));
  assert.deepEqual([st[a.id], st[b.id], st[c.id]], ["mismatch", "missing", "ok"]);
  assert.equal(v.remove, undefined); assert.equal(v.delete, undefined);
});

test("read id không tồn tại → lỗi rõ ràng", () => {
  const { v } = mk(); assert.equal(v.read("DOC-nope").ok, false);
});

test("V7 tên chuẩn chứng từ: {Company}_{YYYYMM}_{Loại}_{Bộ phận}_{DocumentID}_{8 ký tự hash}.{ext}", () => {
  const os = require("os"), fs = require("fs"), path = require("path"), { createVault } = require("../../main/documents");
  const v = createVault(fs.mkdtempSync(path.join(os.tmpdir(), "dv-"))), r = v.add(Buffer.from("abc".repeat(50)), { name: "bảng công.png", ky: "2026-09", company: "HAK", docType: "BANGCONG", dept: "KHO 1" });
  const m = v.find(r.id);
  assert.match(m.storedName, /^HAK_202609_BANGCONG_KHO1_DOC-\d{6}-\d{8}-[A-Z0-9]+_[0-9a-f]{8}\.png$/);
  assert.equal(m.sha256.slice(0, 8), m.storedName.split("_").pop().slice(0, 8));
});

test("V8: cùng nội dung → dùng lại; cùng tên khác nội dung → lưu bản mới và báo sameNameDifferent, không ghi đè", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dv8-")), v = createVault(dir);
  const a = v.add(Buffer.from("noi dung 1"), { name: "bang-cong.png" }), a2 = v.add(Buffer.from("noi dung 1"), { name: "doi-ten.png" }), b = v.add(Buffer.from("noi dung 2 khac"), { name: "bang-cong.png" });
  assert.equal(a2.duplicate, true); assert.equal(a2.id, a.id);
  assert.equal(b.duplicate, false); assert.notEqual(b.id, a.id); assert.deepEqual(b.sameNameDifferent, [a.id]);
  assert.ok(v.verify().every((x) => x.status === "ok"));
});
