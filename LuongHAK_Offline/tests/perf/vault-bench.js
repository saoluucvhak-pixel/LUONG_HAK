// Đo kho chứng từ + Full Backup: thêm N chứng từ ~200 KB, tạo gói, kiểm tra gói, khôi phục vào kho trống. Chạy: node tests/perf/vault-bench.js
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto");
const { createVault } = require("../../main/documents"), FB = require("../../main/fullbackup");
const ms = (t) => Math.round(Number(process.hrtime.bigint() - t) / 1e6);
const rows = [];
for (const n of [100, 500, 2000]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vb-")), v = createVault(path.join(root, "documents"));
  let t = process.hrtime.bigint(); for (let i = 0; i < n; i++) v.add(crypto.randomBytes(200 * 1024), { name: "ct" + i + ".png" }); const tAdd = ms(t);
  const dataText = JSON.stringify({ schemaVersion: 2, nhanvien: Array.from({ length: 1000 }, (_, i) => ({ "Mã NV": "NV" + i })) });
  t = process.hrtime.bigint(); const r = FB.create({ dataText, vault: v, destDir: path.join(root, "out") }); const tCreate = ms(t);
  t = process.hrtime.bigint(); const ins = FB.inspect(r.file, v); const tInspect = ms(t);
  const v2 = createVault(path.join(root, "d2")); t = process.hrtime.bigint(); const imp = FB.importDocuments(r.file, v2); const tImp = ms(t);
  t = process.hrtime.bigint(); v2.verify(); const tVer = ms(t);
  rows.push({ "Số chứng từ": n, "Gói (MB)": +(r.size / 1048576).toFixed(1), "Thêm (ms)": tAdd, "Tạo gói+tự kiểm (ms)": tCreate, "Kiểm tra gói (ms)": tInspect, "Nhập vào kho trống (ms)": tImp, "Verify kho (ms)": tVer, ok: r.ok && ins.ok && imp.added === n });
  fs.rmSync(root, { recursive: true, force: true });
}
console.table(rows);
