// Dấu vân tay NỘI DUNG của dữ liệu lương (V9 VII.6): so sánh trước/sau khôi phục không chỉ bằng số dòng mà bằng SHA-256 của nội dung
// từng bảng (chuẩn hóa khóa) + tổng tiền snapshot từng kỳ đã chốt. Dùng ở Full Backup (ghi vào manifest) và POSTCHECK khi khôi phục.
"use strict";
const crypto = require("crypto");
// auditlog KHÔNG nằm trong dấu vân tay: nhật ký được ghi thêm ngay sau khi khôi phục ("Khôi phục dữ liệu…") nên luôn khác gói gốc
// V9.2: dấu vân tay phủ MỌI bảng dạng danh sách (kể cả nhân thân/người phụ thuộc, danh mục thuế cha–con, tài liệu HĐLĐ, CompanyID…) — trừ nhật ký/tài khoản/bảo mật
const SKIP = { auditlog: 1, nguoidung: 1, baomat: 1 };
function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v === undefined ? null : v);
}
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
function digest(data) {
  const out = { tables: {}, kyChot: {} };
  Object.keys(data || {}).sort().forEach((t) => { if (!SKIP[t] && Array.isArray(data[t])) out.tables[t] = { n: data[t].length, sha: sha(canon(data[t])) }; });
  (data.kyluong || []).forEach((k) => {
    const bl = (k && k.kq && k.kq.bangluong) || []; let tl = 0, tn = 0;
    bl.forEach((b) => { tl += +b["Thực lĩnh"] || 0; tn += +b["Tổng thu nhập"] || 0; });
    out.kyChot[k.ky + "#v" + (k.version || 1)] = { soNV: bl.length, tongThucLinh: Math.round(tl), tongThuNhap: Math.round(tn) };
  });
  return out;
}
/** So hai dấu vân tay → danh sách lệch (rỗng = khớp). */
function compare(expect, got) {
  const bad = [];
  Object.keys(expect.tables || {}).forEach((t) => {
    const e = expect.tables[t], g = (got.tables || {})[t];
    if (!g) bad.push(t + ": thiếu bảng"); else if (g.n !== e.n) bad.push(t + ": số dòng " + g.n + " ≠ " + e.n); else if (g.sha !== e.sha) bad.push(t + ": nội dung khác (SHA-256)");
  });
  Object.keys(expect.kyChot || {}).forEach((k) => {
    const e = expect.kyChot[k], g = (got.kyChot || {})[k];
    if (!g) bad.push("kỳ chốt " + k + ": thiếu"); else if (g.tongThucLinh !== e.tongThucLinh || g.soNV !== e.soNV || g.tongThuNhap !== e.tongThuNhap) bad.push("kỳ chốt " + k + ": tổng snapshot khác (" + g.tongThucLinh + " ≠ " + e.tongThucLinh + ")");
  });
  return bad;
}
module.exports = { digest, compare, canon };
