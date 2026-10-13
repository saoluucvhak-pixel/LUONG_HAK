// V9.2 — tài liệu đính kèm HĐLĐ (core/hdld-docs.js)
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("../../core/hdld-docs.js");

const mk = (n, sha, o) => H.newLink(Object.assign({ maNV: "NV1", soHD: "HD1", doc: { id: "DOC" + n, name: "f" + n + ".pdf", size: 2048, sha256: sha || "s" + n }, user: "u" }, o || {}));

test("U-HDD-01: chỉ nhận pdf/png/jpg/jpeg, giới hạn 25 MB", () => {
  assert.ok(!H.checkFile("a.pdf", 1000));
  assert.ok(!H.checkFile("a.JPG", 1000));
  assert.ok(H.checkFile("a.exe", 1000));
  assert.ok(H.checkFile("a.docx", 1000));
  assert.ok(H.checkFile("a.pdf", H.MAX_BYTES + 1));
});

test("U-HDD-02: newLink giữ DocumentID + SHA-256, trạng thái Hiệu lực; trùng nội dung bị phát hiện theo hợp đồng", () => {
  const rows = [mk(1, "AAA")];
  assert.equal(rows[0]["DocumentID"], "DOC1");
  assert.equal(rows[0]["SHA256"], "AAA");
  assert.equal(rows[0]["Trạng thái"], H.TT.OK);
  assert.ok(H.duplicate(rows, "NV1", "HD1", "AAA"));
  assert.equal(H.duplicate(rows, "NV1", "HD2", "AAA"), null);
});

test("U-HDD-03: thay thế giữ bản cũ trong lịch sử, tăng phiên bản; không thay được bản đã thay", () => {
  const a = mk(1);
  const b = mk(2, null, { version: 2, group: a["Nhóm tài liệu"] });
  H.replace(a, b, "u");
  assert.equal(a["Trạng thái"], H.TT.REPLACED);
  assert.deepEqual(H.active([a, b], "NV1", "HD1").map((r) => r["DocumentID"]), ["DOC2"]);
  assert.equal(H.history([a, b], b).length, 2);
  assert.throws(() => H.replace(a, mk(3), "u"));
});

test("U-HDD-04: gỡ liên kết bắt buộc lý do, không xóa dòng", () => {
  const a = mk(1);
  assert.throws(() => H.unlink(a, "u", "  "));
  H.unlink(a, "u", "scan nhầm");
  assert.equal(a["Trạng thái"], H.TT.UNLINKED);
  assert.equal(a["Lý do gỡ"], "scan nhầm");
  assert.equal(H.ofContract([a], "NV1", "HD1").length, 1);
  assert.equal(H.active([a], "NV1", "HD1").length, 0);
  assert.throws(() => H.unlink(a, "u", "lần 2"));
});
