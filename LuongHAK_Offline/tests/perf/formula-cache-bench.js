// Đo tính công thức cho N nhân viên: parse mỗi lần (trước) vs bộ nhớ đệm AST theo nội dung (sau). Chạy: node tests/perf/formula-cache-bench.js
"use strict";
const EV = require("../../core/payroll/formula-evaluator.js"), P = require("../../core/payroll/formula-parser.js");
const SRC = "ROUND(LUONG_CB / 26 * NGAY_CONG + MAX(0, GIO_TC) * LUONG_CB / 26 / 8 * 1.5, 0)";
const ctx = { LUONG_CB: 9000000, NGAY_CONG: 24.5, GIO_TC: 12 };
const ms = (t) => Math.round(Number(process.hrtime.bigint() - t) / 1e5) / 10, out = [];
for (const n of [100, 500, 2000, 5000]) {
  const reps = n * 8; // ~8 công thức / nhân viên
  let t = process.hrtime.bigint(), a = 0; for (let i = 0; i < reps; i++) a += EV.evaluate(P.parse(SRC), ctx); const tNo = ms(t);
  EV.clearCache(); t = process.hrtime.bigint(); let b = 0; for (let i = 0; i < reps; i++) b += EV.evaluate(SRC, ctx); const tYes = ms(t);
  out.push({ "Số NV": n, "Lượt tính": reps, "parse mỗi lần (ms)": tNo, "đệm AST (ms)": tYes, "kết quả giống nhau": a === b, "hit/miss": JSON.stringify(EV.cacheStats()) });
}
console.table(out);
