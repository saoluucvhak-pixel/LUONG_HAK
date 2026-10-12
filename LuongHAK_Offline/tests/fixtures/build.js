// Bộ dữ liệu kiểm thử dùng chung. Không phụ thuộc giao diện.
"use strict";
const HR = require("../../hr.js");

function days(nam, thang) { return new Date(nam, thang, 0).getDate(); }
/** Dòng chấm công: value cho mọi ngày không phải Chủ nhật, tối đa `limit` ngày. */
function ccRow(ma, nam, thang, ht, value, limit) {
  const r = { "Kỳ": nam + "-" + String(thang).padStart(2, "0"), "Mã NV": ma, "Hình thức công": ht || "BT" };
  let n = 0;
  for (let d = 1; d <= days(nam, thang); d++) {
    if (new Date(nam, thang - 1, d).getDay() === 0) continue;
    if (limit != null && n >= limit) break;
    r[String(d).padStart(2, "0")] = value == null ? 1 : value; n++;
  }
  return r;
}
/** Danh mục chuẩn HAK + các bảng rỗng. */
function baseDb() {
  const db = HR.seedDanhMuc();
  ["nhanvien", "hopdong", "chitiethd", "nhanthan", "thanhtoan", "canhan", "chamcong", "sanluong", "bandam", "psluong", "ungluong", "tiencom", "kyluong", "kyluong_lichsu"].forEach((k) => { db[k] = db[k] || []; });
  return db;
}
/** Nhân viên dạng cột engine (hợp đồng "phẳng") — dùng để test trực tiếp engine. */
function staff(o) {
  return Object.assign({ "Mã nhân viên": "NV", "Họ và tên": "Test", "Mã tiền lương 1": "CĐ", "Mã BHXH": "BH00", "Mã TNCN": "MT00",
    "Mã GT_TNCN_BT": "GTBT.01", "Mã GT_TNCN_PT": "GTNPT.01", "Người phụ thuộc": 0, "Lương thỏa thuận": 0 }, o);
}

// PRNG có seed để bộ dữ liệu hồi quy luôn giống nhau
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Bộ dữ liệu chuẩn cho kiểm thử hồi quy: N nhân viên, nhiều loại lương, 3 kỳ. */
function regressionDataset(N) {
  N = N || 80;
  const r = rng(20261010), db = baseDb();
  const pick = (a) => a[Math.floor(r() * a.length)];
  const codes = ["TG1", "TG2", "TG3", "TG4", "CĐ", "CN1", "CN2", "SP"];
  const pcs = ["", "", "TN.01", "TN.02", "TN.03", "TN.04"];
  const tcs = ["", "TC1", "TC2", "TC3", "TC4", "TC5"];
  const thue = ["LT01", "LT01", "LT01", "VL01", "MT00"];
  db.dm_luong.forEach((l) => { if (l["Mã lương"] === "SP") { l["ĐK_Bù lương (công tối thiểu)"] = "1"; l["Đơn giá bù lương"] = "250000"; } if (l["Mã lương"] === "TG1") l["Ngưỡng truy thu BH (công)"] = "14"; });
  for (let i = 1; i <= N; i++) {
    const ma = "NV" + String(i).padStart(3, "0"), code = pick(codes), so = ma + "/HĐ01";
    const ltt = code === "CN1" || code === "CN2" || code === "SP" ? 150000 + Math.floor(r() * 30) * 10000 : 5000000 + Math.floor(r() * 400) * 100000;
    db.nhanvien.push({ "Mã NV": ma, "Họ và tên": "Nhân viên " + i, "Trạng thái": "Đang làm việc" });
    db.hopdong.push({ "Mã NV": ma, "Số HĐLĐ": so, "Ngày vào làm": "2025-0" + (1 + (i % 9)) + "-01", "Hình thức HĐLĐ": "Xác định thời hạn", "Ngày chấm dứt": i % 23 === 0 ? "2026-08-15" : "" });
    db.chitiethd.push({ "Mã NV": ma, "Số HĐLĐ": so, "Hiệu lực từ": "2025-01-01", "Phòng ban": pick(["01.01", "01.06", "02.01", "02.02"]), "Chức vụ": "8",
      "Mã lương": code + (code === "SP" && r() < 0.5 ? ", BD" : ""), "Lương thỏa thuận": String(ltt), "Lương cơ bản": r() < 0.8 ? String(4960000 + Math.floor(r() * 30) * 100000) : "",
      "Mức đóng bảo hiểm": r() < 0.85 ? "BH01" : "BH00", "Thuế TNCN": pick(thue), "Phụ cấp": pick(pcs), "Hỗ trợ": r() < 0.4 ? "HT.01" : (r() < 0.2 ? "HT.01, HT.02" : ""), "Tăng ca": pick(tcs), "HTTT": "Chuyển khoản" });
    if (i % 7 === 0) db.chitiethd.push(Object.assign({}, db.chitiethd[db.chitiethd.length - 1], { "Hiệu lực từ": "2026-09-01", "Lương thỏa thuận": String(ltt + 500000) }));
    for (let k = 0; k < (i % 4); k++) db.nhanthan.push({ "Mã NV": ma, "Họ tên nhân thân": "Con " + k, "Quan hệ": "Con", "Đăng ký phụ thuộc": "Có", "Hiệu lực từ": "2024-01-01" });
    [[2026, 8], [2026, 9], [2026, 10]].forEach(([y, m]) => {
      db.chamcong.push(ccRow(ma, y, m, "BT", 1, 10 + Math.floor(r() * 17)));
      if (r() < 0.4) db.chamcong.push(ccRow(ma, y, m, "TC", 1, Math.floor(r() * 8)));
      if (r() < 0.3) db.chamcong.push(ccRow(ma, y, m, "CC", 1, 20));
      if (r() < 0.15) { const q = ccRow(ma, y, m, "BT", "1QC", 3); q["Hình thức công"] = "CL"; db.chamcong.push(q); }
      if (code === "SP") for (let t = 0; t < 5; t++) db.sanluong.push({ "Phiếu cân": "PC" + ma + y + m + t, "Ngày cân": y + "-" + String(m).padStart(2, "0") + "-" + String(2 + t * 5).padStart(2, "0"), "KL hàng (Tấn)": String(Math.round(r() * 300) / 10), "Mã NV": ma });
      if (code === "SP" && r() < 0.5) db.bandam.push({ "Phiếu cân": "BD" + ma + y + m, "Ngày cân": y + "-" + String(m).padStart(2, "0") + "-10", "KL hàng (Tấn)": String(1 + Math.floor(r() * 6)), "Mã NV": ma });
      if (r() < 0.3) db.psluong.push({ "Ngày hạch toán": y + "-" + String(m).padStart(2, "0") + "-28", "Mã NV": ma, "Thưởng": String(Math.floor(r() * 10) * 100000), "Thu nhập khác": "0", "Trừ khác": r() < 0.3 ? "50000" : "0" });
      if (r() < 0.3) db.ungluong.push({ "Ngày hạch toán": y + "-" + String(m).padStart(2, "0") + "-15", "Mã NV": ma, "Tạm ứng": String(Math.floor(r() * 20) * 100000) });
    });
  }
  return db;
}

module.exports = { ccRow, baseDb, staff, regressionDataset, days };
