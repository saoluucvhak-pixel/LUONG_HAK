// V10.3 — Đo thời gian LÕI lọc (Node, không gồm vẽ giao diện) ở 100 / 1.000 / 10.000 dòng. Trung vị 21 lần chạy. Máy đo ghi trong kết quả.
"use strict";
const os = require("os"), fs = require("fs"), SF = require("../../core/smart-filter.js");
const cfg = { fields: [{ key: "pb", label: "PB", type: "multi", options: () => [], match: (r, v) => SF.inSet(v, r.pb) }, { key: "tt", label: "TT", type: "enum", match: (r, v) => r.tt === v }],
  matchQ: (r, q) => SF.hay([r.ma, r.ten, r.pb]).indexOf(q) >= 0, matchDate: (r, tu, den) => (!tu || r.ngay >= tu) && (!den || r.ngay <= den) };
const out = { may: os.cpus()[0].model + " ×" + os.cpus().length, node: process.version, ketQuaMs: {} };
const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
[100, 1000, 10000].forEach((N) => {
  const rows = Array.from({ length: N }, (_, i) => ({ ma: "NV" + i, ten: "Nguyễn Văn " + String.fromCharCode(65 + (i % 26)) + i, pb: ["Sản xuất", "Văn phòng", "Trạm cân", ""][i % 4], tt: i % 5 ? "Đang làm việc" : "Đã nghỉ việc", ngay: "2026-09-" + ("0" + (1 + (i % 28))).slice(-2) }));
  const cases = { "tìm không dấu": { q: "nguyen van b" }, "nhiều điều kiện": { q: "van", sel: { pb: ["Sản xuất", "Trạm cân"] }, one: { tt: "Đang làm việc" }, tu: "2026-09-05", den: "2026-09-20" }, "không lọc": {} };
  out.ketQuaMs[N] = {};
  Object.keys(cases).forEach((k) => { const t = []; for (let i = 0; i < 21; i++) { const a = process.hrtime.bigint(); SF.filterRows(rows, cfg, cases[k]); t.push(Number(process.hrtime.bigint() - a) / 1e6); } out.ketQuaMs[N][k] = Math.round(med(t) * 100) / 100; });
});
fs.writeFileSync(__dirname + "/../../docs/V10_3_FILTER_BENCH.json", JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
