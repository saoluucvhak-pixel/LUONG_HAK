// Đo hiệu năng làm baseline (không đặt ngưỡng ở Phase 1). Chạy: node tests/perf/bench.js
"use strict";
const E = require("../../engine.js"), HR = require("../../hr.js"), INT = require("../../core/integrity.js"), IMP = require("../../core/importer.js");
const { regressionDataset } = require("../fixtures/build.js");
const ms = (t) => Math.round(Number(process.hrtime.bigint() - t) / 1e6);
const rows = [];
[100, 500, 1000, 5000].forEach((n) => {
  const db = regressionDataset(n);
  let t = process.hrtime.bigint(); const json = JSON.stringify(db); const tSer = ms(t);
  t = process.hrtime.bigint(); JSON.parse(json); const tParse = ms(t);
  t = process.hrtime.bigint(); const sp = HR.staffForPayroll(db, 2026, 9); const tStaff = ms(t);
  t = process.hrtime.bigint(); const kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list }), 2026, 9, false); const tPay = ms(t);
  t = process.hrtime.bigint(); INT.check(db); const tChk = ms(t);
  const cc = db.chamcong.filter((r) => r["Kỳ"] === "2026-09").map((r) => Object.assign({}, r));
  const cols = ["Kỳ", "Mã NV", "Hình thức công"].concat(Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0")));
  t = process.hrtime.bigint(); IMP.plan(db, "chamcong", cols, cc); const tImp = ms(t);
  rows.push({ "Số NV": n, "Dòng chấm công (3 kỳ)": db.chamcong.length, "Dung lượng dữ liệu (MB)": +(json.length / 1048576).toFixed(2), "Ghi JSON (ms)": tSer, "Đọc JSON (ms)": tParse,
    "Dựng DS lương (ms)": tStaff, "Tính lương 1 kỳ (ms)": tPay, "Kiểm tra toàn vẹn (ms)": tChk, "Dòng CC nhập lại": cc.length, "Nhập lại CC 1 kỳ (ms)": tImp, "Bộ nhớ heap (MB)": Math.round(process.memoryUsage().heapUsed / 1048576), "NV có lương": kq.bangluong.length });
});
console.table(rows);
module.exports = rows;
