// Đo nhập chấm công (IMP.plan + IMP.apply) với 5.000 / 10.000 / 30.000 dòng, mỗi dòng 31 ô ngày. Chạy: node tests/perf/attendance-import-bench.js
"use strict";
const IMP = require("../../core/importer.js");
const DAYS = Array.from({ length: 31 }, (_, i) => ("0" + (i + 1)).slice(-2)), COLS = ["Kỳ", "Mã NV", "Hình thức công"].concat(DAYS);
const ms = (t) => Math.round(Number(process.hrtime.bigint() - t) / 1e5) / 10;
const out = [];
for (const n of (process.argv[2] ? [Number(process.argv[2])] : [5000, 10000, 30000])) {
  const emp = Math.ceil(n / 4), db = { nhanvien: Array.from({ length: emp }, (_, i) => ({ "Mã NV": "NV" + String(i).padStart(5, "0") })), chamcong: [], dm_phucap: [{ "Mã phụ cấp": "CT" }] };
  const rows = []; for (let i = 0; i < n; i++) { const r = { "Kỳ": "2026-09", "Mã NV": "NV" + String(i % emp).padStart(5, "0"), "Hình thức công": ["BT", "TC", "CT", "ĐH"][Math.floor(i / emp) % 4] }; for (let d = 0; d < 30; d++) r[DAYS[d]] = d % 7 === 6 ? "" : (d % 3 === 0 ? "0,5" : "1"); rows.push(r); }
  let t = process.hrtime.bigint(); const p = IMP.plan(db, "chamcong", COLS, rows, { lockedPeriods: {}, defaultKy: "2026-09", mode: "merge" }); const tPlan = ms(t);
  t = process.hrtime.bigint(); const added = IMP.apply(db, p, null, false); const tApply = ms(t);
  t = process.hrtime.bigint(); const p2 = IMP.plan(db, "chamcong", COLS, rows, { lockedPeriods: {}, defaultKy: "2026-09", mode: "merge" }); const tRe = ms(t);
  out.push({ "Số dòng": n, "plan (ms)": tPlan, "apply (ms)": tApply, "plan lần 2 — đã có dữ liệu (ms)": tRe, "dòng thêm": added, "trùng ở lần 2": p2.summary.duplicate });
}
console.table(out);
