// V9.2 — đo: tra biểu thuế/NPT khi tính lương, kiểm tra cấu hình thuế, bộ lọc Sản lượng/Chấm công. Chạy: node tests/perf/v92-bench.js
"use strict";
const E = require("../../engine.js"), HR = require("../../hr.js"), TCFG = require("../../core/tax-config.js"), DEP = require("../../core/dependents.js"), LF = require("../../core/list-filter.js");
const { regressionDataset } = require("../fixtures/build.js");
const ms = (t) => Math.round(Number(process.hrtime.bigint() - t) / 1e5) / 10;
const out = [];
for (const n of [500, 2000, 5000]) {
  const db = regressionDataset(n);
  db.nhanthan = [];
  db.nhanvien.forEach((nv, i) => { for (let k = 0; k < 2; k++) db.nhanthan.push({ "Mã NV": nv["Mã NV"], "Họ và tên": "PT" + i + "_" + k, "Số CCCD": String(1e11 + i * 10 + k), "Ngày sinh": "2015-01-0" + (k + 1), "Trạng thái đăng ký": "Đã đăng ký", "Giảm trừ từ tháng": "2026-01" }); });
  let t = process.hrtime.bigint(); const sp = HR.staffForPayroll(db, 2026, 9); const tStaff = ms(t);
  t = process.hrtime.bigint(); E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list }), 2026, 9, false); const tPay = ms(t);
  t = process.hrtime.bigint(); TCFG.check(db); const tTax = ms(t);
  t = process.hrtime.bigint(); DEP.check(db, "2026-09-30"); const tDep = ms(t);
  out.push({ "Số NV": n, "Dòng người phụ thuộc": db.nhanthan.length, "Dựng DS lương gồm NPT (ms)": tStaff, "Tính lương 1 kỳ (ms)": tPay, "Kiểm tra cấu hình thuế (ms)": tTax, "Kiểm tra NPT trùng/chồng kỳ (ms)": tDep });
}
console.table(out);
const flt = [];
for (const n of [10000, 30000, 100000]) {
  const rows = Array.from({ length: n }, (_, i) => ({ "Phiếu cân": "P" + i, "Ngày cân": "2026-" + String(1 + (i % 12)).padStart(2, "0") + "-" + String(1 + (i % 28)).padStart(2, "0"), "KL hàng (Tấn)": (i % 40) / 4 + 1, "Mã phòng ban": "TO" + (i % 15), "Mã NV": i % 3 ? "" : "NV" + i }));
  let t = process.hrtime.bigint(); const r = LF.phieuCan(rows, { pb: ["to1", "TO2", "TO3"], tu: "2026-03-01", den: "2026-09-30" }); const tF = ms(t);
  t = process.hrtime.bigint(); LF.tongPhieuCan(r); const tT = ms(t);
  const cc = Array.from({ length: n }, (_, i) => ({ "Mã NV": "NV" + i, "Hình thức công": ["BT", "TC", "", "PN"][i % 4] }));
  t = process.hrtime.bigint(); LF.chamCong(cc, { ht: ["BT", LF.NONE] }); const tC = ms(t);
  flt.push({ "Số dòng": n, "Lọc phiếu cân (ms)": tF, "Tính lại tổng (ms)": tT, "Lọc chấm công (ms)": tC, "Dòng khớp": r.length });
}
console.table(flt);
module.exports = { out, flt };
