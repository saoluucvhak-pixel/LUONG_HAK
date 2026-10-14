// V10.2 — Đối chiếu TRƯỚC/SAU nâng cấp Danh mục tăng ca Master–Detail: tiền tăng ca và thực lĩnh từng nhân viên, từng kỳ.
// Dữ liệu 100% giả lập (đủ mã TC1–TC6, CN1/CN2, công Chủ nhật, nhiều kỳ). Engine "trước" lấy từ commit nền V10.1.
//   OLD_ROOT=/đường/dẫn/tới/LuongHAK_Offline-của-V10.1 node tools/v102/recon-overtime.js [out.json]
//   (tạo OLD_ROOT:  git archive 042f13b LuongHAK_Offline | tar -x -C /tmp/old && OLD_ROOT=/tmp/old/LuongHAK_Offline)
"use strict";
const path = require("path"), fs = require("fs");
const NEW_ROOT = path.join(__dirname, "..", "..") + "/", OLD_ROOT = (process.env.OLD_ROOT || "").replace(/\/?$/, "/");
if (!process.env.OLD_ROOT) { console.error("Thiếu OLD_ROOT (bản V10.1)"); process.exit(2); }
const load = (root) => ({ E: require(root + "engine.js"), HR: require(root + "hr.js") });
const OLD = load(OLD_ROOT), NEW = load(NEW_ROOT);
const CODES = ["TC1", "TC2", "TC3", "TC4", "TC5", "TC6", "CN1", "CN2"], KYS = [[2026, 8], [2026, 9], [2026, 10]], pad = (n) => ("0" + n).slice(-2);
function build(HR) {
  const db = HR.seedDanhMuc();
  ["nhanvien", "hopdong", "chitiethd", "nhanthan", "thanhtoan", "canhan", "chamcong", "sanluong", "bandam", "psluong", "ungluong", "tiencom", "kyluong", "kyluong_lichsu", "dm_congthuc", "nghiphep", "nghiom"].forEach((k) => { db[k] = db[k] || []; });
  db.congty = [{ "Mã công ty": "HAKDN", "Tên công ty": "HAK", "Quy chế tính lương": "2026" }];
  ["TC6", "CN1", "CN2"].forEach((c) => { if (!db.dm_tangca.some((r) => r["Mã tăng ca"] === c)) db.dm_tangca.push({ "Mã tăng ca": c, "Nội dung tăng ca": c + " (giả lập)", "Hệ số tăng ca": 1, "Tiền tăng ca (nếu tính cố định)": 0, "Hiệu lực từ": "2025-09-01" }); });
  CODES.forEach((tc, i) => {
    const ma = "NV" + pad(i + 1), so = ma + "/HĐ", lg = 7000000 + i * 350000;
    db.nhanvien.push({ "Mã NV": ma, "Họ và tên": "Nhân viên " + tc, "Trạng thái": "Đang làm việc" });
    db.hopdong.push({ "Mã NV": ma, "Số HĐLĐ": so, "Ngày vào làm": "2025-01-01", "Hình thức HĐLĐ": "Xác định thời hạn" });
    db.chitiethd.push({ "Mã NV": ma, "Số HĐLĐ": so, "Hiệu lực từ": "2025-01-01", "Mã lương": "TG1", "Lương thỏa thuận": String(lg), "Tăng ca": tc, "HTTT": "Chuyển khoản" });
    KYS.forEach(([y, m]) => {
      const nd = new Date(y, m, 0).getDate(), ky = y + "-" + pad(m), bt = { "Kỳ": ky, "Mã NV": ma, "Hình thức công": "BT" }, ot = { "Kỳ": ky, "Mã NV": ma, "Hình thức công": "TC" };
      for (let d = 1; d <= nd; d++) { const w = new Date(y, m - 1, d).getDay(); if (w !== 0 || (i + d) % 3 === 0) bt[pad(d)] = "1"; if (d <= 4 + (i % 3)) ot[pad(d)] = d % 2 ? "1" : "0.5"; }
      db.chamcong.push(bt, ot);
    });
  });
  return db;
}
function run(X, y, m) {
  const db = build(X.HR), sp = X.HR.staffForPayroll(db, y, m);
  const kq = X.E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list, sanluong: [], bandam: [] }), y, m, "to", { quyChe: "2026" });
  const out = {}; kq.bangluong.forEach((b) => { out[b["Mã NV"]] = { tc: +b["Tiền tăng ca"] || 0, tl: +b["Thực lĩnh"] || 0, ct: b._ct || {} }; }); return out;
}
const diffs = [], rows = []; let n = 0;
KYS.forEach(([y, m]) => {
  const a = run(OLD, y, m), b = run(NEW, y, m);
  Object.keys(a).forEach((ma) => { n++; const x = a[ma], z = b[ma] || { tc: NaN, tl: NaN }, code = CODES[+ma.slice(2) - 1];
    rows.push({ ky: y + "-" + pad(m), ma, code, tienTruoc: x.tc, tienSau: z.tc, thucLinhTruoc: x.tl, thucLinhSau: z.tl, congQuyDoi: z.ct && z.ct.congQuyDoi, donGia: z.ct && z.ct.coSoTienTC });
    if (x.tc !== z.tc || x.tl !== z.tl) diffs.push({ ky: y + "-" + pad(m), ma, code, tienTruoc: x.tc, tienSau: z.tc, thucLinhTruoc: x.tl, thucLinhSau: z.tl }); });
});
const res = { soDong: n, soNV: CODES.length, soKy: KYS.length, soChenhLech: diffs.length, chenhLech: diffs, tongTienTruoc: rows.reduce((s, r) => s + r.tienTruoc, 0), tongTienSau: rows.reduce((s, r) => s + r.tienSau, 0), tongTienTrenTungMa: CODES.map((c) => ({ code: c, truoc: rows.filter((r) => r.code === c).reduce((s, r) => s + r.tienTruoc, 0), sau: rows.filter((r) => r.code === c).reduce((s, r) => s + r.tienSau, 0) })), rows };
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res, null, 1));
console.log(JSON.stringify({ soDong: res.soDong, soChenhLech: res.soChenhLech, tongTienTruoc: res.tongTienTruoc, tongTienSau: res.tongTienSau, theoMa: res.tongTienTrenTungMa }, null, 1));
process.exit(diffs.length ? 1 : 0);
