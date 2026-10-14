// V10.1 — đo: Payroll Engine + gate ở main, xác minh bản chốt, CHI_TIET_TT, Excel nhiều cột (2 tầng), HTML PDF bảng rộng. Dữ liệu GIẢ LẬP (regressionDataset).
// Chạy: node tests/perf/v101-bench.js [N ...]   → in bảng markdown; ghi docs/V10_1_PERF_RESULT.json
"use strict";
const fs = require("fs"), path = require("path");
const X = require("../../exceljs.min.js"), PG = require("../../main/payroll-gate.js"), CLS = require("../../core/payroll-close.js");
const PR = require("../../core/reporting/payroll-reports.js"), RX = require("../../ui/report-xlsx.js"), RH = require("../../core/reporting/report-html.js");
const { regressionDataset } = require("../fixtures/build.js");
const ms = (a) => Math.round(Number(process.hrtime.bigint() - a) / 1e5) / 10;
(async () => {
  const Ns = process.argv.slice(2).map(Number).filter(Boolean), out = [];
  for (const n of (Ns.length ? Ns : [500, 2000, 5000])) {
    const db = regressionDataset(n); db.kyluong = db.kyluong || []; db.ttluong = [];
    let t = process.hrtime.bigint(); const { kq } = PG.computeKy(db, "2026-09", { quyChe: "2026", bu: "to" }); const tCalc = ms(t);
    t = process.hrtime.bigint(); const bl = PG.blockers(db, "2026-09", { quyChe: "2026", bu: "to" }); const tGate = ms(t);
    const snap = CLS.buildSnapshot(db, "2026-09", kq, [], { quyChe: "2026", buTheoNgay: "to" });
    t = process.hrtime.bigint(); const vs = PG.verifySnapshot(db, snap); const tVer = ms(t);
    const src = { bangluong: kq.bangluong, bhxh: kq.bhxh, chot: true, blockers: [] }, o = { nam: 2026, thang: 9, tenCongTy: "T", lines: [] };
    t = process.hrtime.bigint(); const vm = PR.build("CHI_TIET_TT", src, o); const tVm = ms(t);
    t = process.hrtime.bigint(); const buf = await RX.build(X, vm, {}).xlsx.writeBuffer(); const tX = ms(t);
    t = process.hrtime.bigint(); const html = RH.sheets({ title: "T", sheets: [{ name: "T", cols: vm.cols.map((c) => c.label), rows: PR.toRows(vm), groups: vm.groups }] }, {}); const tH = ms(t);
    out.push({ "Số NV": n, "Tính lương (ms)": tCalc, "Gate chốt (ms)": tGate, "Xác minh bản chốt (ms)": tVer, "CHI_TIET_TT vm (ms)": tVm, "Excel (ms)": tX, "Excel (KB)": Math.round(buf.byteLength / 1024), "HTML PDF (ms)": tH, "HTML (KB)": Math.round(html.length / 1024), "Cột": vm.cols.length, "Lỗi chặn": bl.length, "Lệch xác minh": vs.length });
  }
  console.table(out);
  try { fs.writeFileSync(path.join(__dirname, "../../docs/V10_1_PERF_RESULT.json"), JSON.stringify({ node: process.version, ngay: new Date().toISOString().slice(0, 10), du_lieu: "giả lập regressionDataset", ket_qua: out }, null, 2)); } catch (e) { /* docs có thể chưa tồn tại */ }
})();
