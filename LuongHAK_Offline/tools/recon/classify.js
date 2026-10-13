// Phân loại chênh lệch Excel ↔ app theo A–E (V9 mục VI.3) từ file rows*.json do recon-t9/t11 xuất (RECON_OUT=...).
//   node tools/recon/classify.js out.csv rows9.json rows11.json
// A lỗi thuật toán · B khác biệt quy chế đã duyệt · C dữ liệu nguồn · D pháp lý theo kỳ · E cần quyết định người quản lý
// Tệp kết quả chứa dữ liệu cá nhân → giữ NGOÀI repo. Chỉ có `summary()` được dán vào docs.
"use strict";
const fs = require("fs");
const SL = /sản lượng|Lương SL/i, DER = /Tổng thu nhập|Tiền lương còn nhận|Thu nhập còn lại/, TAX = /Thuế|thuế/, TOL = (k) => (/tấn/i.test(k) ? 0.01 : 1);
function classify(rows) {
  const by = {}; rows.forEach((x) => { ((by[x.ky + "|" + x.ma + "|" + x.ten] = by[x.ky + "|" + x.ma + "|" + x.ten] || {})[x.khoan] = x); });
  const out = [];
  Object.keys(by).forEach((k) => {
    const m = by[k], ks = Object.keys(m);
    const diff = (kk) => (m[kk] ? Math.abs(m[kk].diff) > TOL(kk) : false);
    const upstream = ks.filter((kk) => !DER.test(kk) && !TAX.test(kk) && !/Công/.test(kk) && diff(kk));
    const taxK = ks.find((kk) => TAX.test(kk)), kpcdK = ks.find((kk) => /KPCĐ/.test(kk) && !/trừ/i.test(kk)) || ks.find((kk) => /KPCĐ/.test(kk));
    ks.forEach((kk) => {
      const x = m[kk]; if (!diff(kk)) return;
      let cls, why, act;
      if (/Công chuẩn/.test(kk)) { cls = "E"; why = "Công chuẩn của mã lương cố định (CĐ): Excel ghi 25, app 30 — lương cố định nên KHÔNG ảnh hưởng tiền"; act = "Cần xác nhận công chuẩn quy ước cho mã CĐ (không ảnh hưởng số tiền)"; }
      else if (SL.test(kk)) { cls = "B"; why = "Quy chế chia sản lượng theo công BT (R-73, đã duyệt) và bù theo tổ khác công thức Excel"; act = "Giữ quy chế; xem báo cáo phiếu chờ phân bổ (PENDING_ATTENDANCE)"; }
      else if (/Truy thu/.test(kk)) { cls = "E"; why = "Excel vừa trừ BH NLĐ vừa truy thu phần doanh nghiệp khi chưa đủ công; app chỉ truy thu theo quy chế đang cấu hình"; act = "Cần quyết định: có truy thu phần doanh nghiệp không (docs/DOI_CHIEU_EXCEL_2025.md §3)"; }
      else if (TAX.test(kk)) {
        const tx = x.app, ex = x.excel, kp = kpcdK && m[kpcdK] ? m[kpcdK].excel : 0;
        if (ex === 0 && tx > 0) { cls = "E"; why = "Excel có tính thuế TNCN nhưng cột khấu trừ = 0 (không trừ vào thu nhập còn lại); app trừ thuế"; act = "Cần quyết định: công ty có khấu trừ tạm thuế TNCN hàng tháng hay quyết toán cuối năm"; }
        else if (Math.abs(Math.abs(x.diff) - 0.05 * kp) < 1 || Math.abs(Math.abs(x.diff) - 0.1 * kp) < 1) { cls = "E"; why = "Khác nhau do KPCĐ NLĐ có/không được trừ khi tính thu nhập chịu thuế"; act = "Cần quyết định/đối chiếu pháp lý: đoàn phí trừ khi tính thuế?"; }
        else { cls = "C"; why = "Chênh thuế không do thu nhập đầu nguồn: nghi do hồ sơ người phụ thuộc (đăng ký/hiệu lực) và/hoặc KPCĐ có trừ khi tính thuế khác giữa Excel và dữ liệu nhập"; act = "Đối chiếu hồ sơ NPT của nhân viên này; không tự đổi công thức"; }
      } else if (DER.test(kk)) {
        if (upstream.length) { cls = "(hệ quả)"; why = "Hệ quả của: " + upstream.join(", "); act = "Xử lý theo khoản đầu nguồn"; }
        else if (taxK && diff(taxK) || /còn|lĩnh/i.test(kk)) {
          const tr = taxK && m[taxK]; cls = "E"; why = tr && Math.abs(Math.abs(x.diff) - Math.abs(tr.app)) < 2 ? "Excel không trừ thuế TNCN vào thu nhập còn lại" : "Hệ quả của chênh thuế TNCN";
          act = "Theo quyết định về khấu trừ thuế TNCN";
        } else { cls = "A?"; why = "Chưa giải thích được"; act = "Điều tra"; }
      } else { cls = "A?"; why = "Chưa giải thích được"; act = "Điều tra"; }
      out.push({ ky: x.ky, ma: x.ma, ten: x.ten, khoan: kk, excel: x.excel, app: x.app, diff: x.diff, cls, why, act });
    });
  });
  return out;
}
function summary(rows, out) {
  const tot = {}, per = {}; rows.forEach((x) => { tot[x.ky] = tot[x.ky] || new Set(); tot[x.ky].add(x.ma + x.ten); });
  const bad = {}; out.forEach((x) => { (bad[x.ky] = bad[x.ky] || new Set()).add(x.ma + x.ten); (per[x.cls] = per[x.cls] || 0); per[x.cls]++; });
  return { nv: Object.fromEntries(Object.keys(tot).map((k) => [k, tot[k].size])), nvLech: Object.fromEntries(Object.keys(bad).map((k) => [k, bad[k].size])), dongTheoLoai: per, chuaGiaiThich: out.filter((x) => x.cls === "A?").length };
}
module.exports = { classify, summary };
if (require.main === module) {
  const [, , csv, ...files] = process.argv; let rows = []; files.forEach((f) => { rows = rows.concat(JSON.parse(fs.readFileSync(f, "utf8"))); });
  const out = classify(rows);
  const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  fs.writeFileSync(csv, "﻿" + ["Kỳ", "Mã NV", "Họ tên", "Khoản lương", "Excel", "App", "Chênh lệch", "Phân loại", "Nguyên nhân", "Hướng xử lý"].join(",") + "\n" + out.map((x) => [x.ky, x.ma, x.ten, x.khoan, x.excel, x.app, x.diff, x.cls, x.why, x.act].map(esc).join(",")).join("\n"));
  console.log(JSON.stringify(summary(rows, out), null, 1));
}
