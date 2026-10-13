"use strict";
// V9: Full Backup chạy trong worker_thread — kết quả giống chạy trực tiếp, có tiến độ, hủy được, lỗi worker → FAILED (không treo, không reject)
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { createVault } = require("../../main/documents"), W = require("../../main/fullbackup-worker");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "fbw-"));
function setup(n) {
  const root = tmp(), docs = path.join(root, "documents"), v = createVault(docs); for (let i = 0; i < n; i++) v.add(Buffer.from("tai lieu " + i + " ".repeat(2000) + Math.random()), { name: "t" + i + ".png" });
  return { root, docs, out: path.join(root, "out") };
}
test("U-FBW-01 worker tạo gói SUCCESS, có thông báo tiến độ, gói qua kiểm tra SHA-256", async () => {
  const s = setup(12), prog = [];
  const job = W.run({ dataText: JSON.stringify({ nhanvien: [{ "Mã NV": "A" }] }), docsDir: s.docs, ocrDir: null, destDir: s.out, appVersion: "t", user: "u" }, (m) => prog.push(m));
  const r = await job.promise;
  assert.equal(r.status, "SUCCESS", JSON.stringify(r)); assert.equal(r.docs, 12); assert.ok(fs.existsSync(r.file) && fs.existsSync(r.file + ".sha256"));
  assert.ok(prog.length >= 1, "có tiến độ");
});
test("U-FBW-02 hủy giữa chừng → CANCELLED, không để lại gói/tệp tạm", async () => {
  const s = setup(1500); let cancelled = false;
  const job = W.run({ dataText: JSON.stringify({ nhanvien: [] }), docsDir: s.docs, ocrDir: null, destDir: s.out, appVersion: "t", user: "u" }, () => { if (!cancelled) { cancelled = true; job.cancel(); } });
  const r = await job.promise;
  assert.equal(r.status, "CANCELLED", JSON.stringify(r).slice(0, 300));
  assert.deepEqual(fs.existsSync(s.out) ? fs.readdirSync(s.out).filter((f) => !f.startsWith(".")) : [], [], "không còn gói / .tmp");
});
test("U-FBW-03 dữ liệu hỏng / thư mục đích không ghi được → FAILED rõ ràng, không throw", async () => {
  const s = setup(2);
  const r1 = await W.run({ dataText: "{khong phai json", docsDir: s.docs, ocrDir: null, destDir: s.out, appVersion: "t" }).promise;
  assert.equal(r1.status, "FAILED");
  const blocker = path.join(s.root, "file-chan"); fs.writeFileSync(blocker, "x");
  const r2 = await W.run({ dataText: "{}", docsDir: s.docs, ocrDir: null, destDir: path.join(blocker, "con"), appVersion: "t" }).promise;
  assert.equal(r2.status, "FAILED");
});
