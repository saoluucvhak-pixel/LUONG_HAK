// V10.3 — Hồi quy TRƯỚC/SAU: bảng lương toàn bộ nhân viên × 3 kỳ phải GIỐNG HỆT (lương thời gian, sản lượng, tăng ca, phụ cấp, hỗ trợ, tiền cơm,
// tổng thu nhập, BH, KPCĐ, thuế, thực lĩnh). Dữ liệu 100% giả lập (tests/fixtures/build.js). Engine "trước" = commit nền V10.2.
//   git archive c7aaca6 LuongHAK_Offline | tar -x -C /tmp/old && OLD_ROOT=/tmp/old/LuongHAK_Offline node tools/v103/regression.js [N] [out.json]
"use strict";
const path = require("path"), fs = require("fs");
const NEW_ROOT = path.join(__dirname, "..", "..") + "/", OLD_ROOT = (process.env.OLD_ROOT || "").replace(/\/?$/, "/");
if (!process.env.OLD_ROOT) { console.error("Thiếu OLD_ROOT (bản V10.2)"); process.exit(2); }
const OLD = { E: require(OLD_ROOT + "engine.js"), HR: require(OLD_ROOT + "hr.js") }, NEW = { E: require(NEW_ROOT + "engine.js"), HR: require(NEW_ROOT + "hr.js") };
const { regressionDataset } = require(NEW_ROOT + "tests/fixtures/build.js");
const N = +process.argv[2] || 300, KYS = [[2026, 8], [2026, 9], [2026, 10]];
const COLS = ["Lương thời gian", "Lương phụ", "Lương sản lượng", "Lương bù SL", "Lương bơm dăm", "Tiền tăng ca", "Phụ cấp", "Phụ cấp công tác", "Lương hỗ trợ", "Tiền cơm", "Thưởng", "Thu nhập khác", "Tổng thu nhập", "BH trừ NLĐ", "KPCĐ trừ NLĐ", "Truy thu BH", "Thuế TNCN", "Trừ khác", "Tạm ứng", "Thực lĩnh"];
const ds = regressionDataset(N);
const run = (X, y, m) => { const sp = X.HR.staffForPayroll(ds, y, m); return X.E.tinhBangLuong(Object.assign({}, ds, { nhansu: sp.list }), y, m, "to", { quyChe: "2026" }).bangluong; };
const diffs = [], tong = {}; let rows = 0;
COLS.forEach((c) => { tong[c] = { truoc: 0, sau: 0 }; });
KYS.forEach(([y, m]) => {
  const a = run(OLD, y, m), b = run(NEW, y, m), bm = {}; b.forEach((r) => { bm[r["Mã NV"]] = r; });
  if (a.length !== b.length) diffs.push({ ky: y + "-" + m, loi: "số dòng khác " + a.length + " ≠ " + b.length });
  a.forEach((r) => { rows++; const z = bm[r["Mã NV"]] || {};
    COLS.forEach((c) => { const x = +r[c] || 0, w = +z[c] || 0; tong[c].truoc += x; tong[c].sau += w; if (x !== w) diffs.push({ ky: y + "-" + m, ma: r["Mã NV"], cot: c, truoc: x, sau: w }); }); });
});
const res = { soNV: N, soKy: KYS.length, soDongLuong: rows, soCotSoSanh: COLS.length, soOSoSanh: rows * COLS.length, soChenhLech: diffs.length, chenhLech: diffs.slice(0, 50), tong };
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(res, null, 1));
console.log(JSON.stringify({ soNV: N, soDongLuong: rows, soOSoSanh: res.soOSoSanh, soChenhLech: diffs.length, tongThucLinh: tong["Thực lĩnh"], tongPhuCap: tong["Phụ cấp"], tongHoTro: tong["Lương hỗ trợ"], tongTienCom: tong["Tiền cơm"] }, null, 1));
process.exit(diffs.length ? 1 : 0);
