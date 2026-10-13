// ===== MAIN / PAYROLL-GATE — tiến trình chính TỰ tính lại kỳ lương từ dữ liệu để chặn chốt / xuất bảng lương lỗi (V9.2 mục XV) =====
// Không tin kết quả/trạng thái do renderer gửi: đọc dữ liệu (đã nhận hoặc trên đĩa), tính lại bằng đúng engine + hồ sơ nhân sự, rồi hỏi core/payroll-gate.js.
"use strict";
const E = require("../engine.js");
const HRM = require("../hr.js");
const GATE = require("../core/payroll-gate.js");
const PA = require("../core/production-alloc.js");

function parseKy(ky) { const m = String(ky || "").match(/^(\d{4})-(\d{2})$/); return m ? { nam: +m[1], thang: +m[2] } : null; }

/** Tính kỳ như app.js tinhLuong() (cùng hàm engine/hồ sơ). opts: { quyChe: "2026"|"1.7", bu: false|true|"daihiep"|"to" } */
function computeKy(db, ky, opts) {
  opts = opts || {};
  const p = parseKy(ky); if (!p) throw new Error("Kỳ không hợp lệ: " + ky);
  ["nhanvien", "hopdong", "chitiethd", "nhanthan", "thanhtoan", "canhan", "chamcong", "sanluong", "bandam", "psluong", "ungluong", "tiencom", "kyluong", "kyluong_lichsu", "nghiphep", "nghiom", "congtac"].forEach((k) => { if (!Array.isArray(db[k])) db[k] = []; });
  const sp = HRM.staffForPayroll(db, p.nam, p.thang);
  const slK = HRM.sanLuongKy(db, p.nam, p.thang, "sanluong"), bdK = HRM.sanLuongKy(db, p.nam, p.thang, "bandam");
  const kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list, sanluong: slK.rows, bandam: bdK.rows }), p.nam, p.thang, opts.bu === undefined ? false : opts.bu, { quyChe: opts.quyChe || "2026" });
  kq.canhbao = sp.warn.concat(kq.canhbao);
  const unalloc = [];
  [["Sản lượng", "sanluong", slK], ["Bơm dăm", "bandam", bdK]].forEach(([ten, loai, k]) => {
    try {
      const pbOf = (ma, d) => (HRM.hienHanh(db, ma, d).pb || "");
      const al = PA.withDirect(k.alloc, k.direct.map((r) => ({ phieu: r["Phiếu cân"] || "", ngay: String(r["Ngày cân"] || "").slice(0, 10), kl: r["KL hàng (Tấn)"], ma: r["Mã NV"] })), pbOf, () => "", (pb) => HRM.refName(db, "dm_phongban", pb) || "");
      if (al && al.unallocated > 0.0005) unalloc.push(ten + ": " + Math.round(al.unallocated * 1000) / 1000 + (loai === "bandam" ? " xe" : " tấn") + " chưa phân bổ được cho ai");
    } catch (e) { /* không phân bổ được → bỏ qua điều kiện này, các điều kiện khác vẫn chạy */ }
  });
  return { kq, extra: unalloc.length ? [{ code: "SAN_LUONG_CHUA_PHAN_BO", ten: "Sản lượng chưa phân bổ hết", items: unalloc }] : [] };
}
/** → [{code, ten, count, items}] (rỗng = được phép) */
function blockers(db, ky, opts) { const r = computeKy(db, ky, opts); return GATE.blockers(r.kq, r.extra); }

/** Tên file xuất có vẻ là bảng lương chính thức? (cùng quy tắc với app.js PAYROLL_FILE) */
// "luong" trong "khối lượng / sản lượng / số lượng" KHÔNG phải bảng lương (báo cáo phân bổ khối lượng là công cụ để SỬA lỗi chặn chốt kỳ, không được chặn tải)
const PAYROLL_FILE = /(?<!khoi[ _-]?)(?<!san[ _-]?)(?<!so[ _-]?)(?<!sl[ _-]?)luong|thanhtoan|payslip|phieu ?luong|bangtinh|tonghop ?luong/i;
const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
function isPayrollFile(name) { return PAYROLL_FILE.test(String(name || "")) || PAYROLL_FILE.test(slug(name)); }
/** Lấy kỳ YYYY-MM từ tên file (2026-09, 2026_09, 09-2026, 092026, T09_2026…) hoặc null */
function kyFromName(name) {
  const s = String(name || "");
  let m = s.match(/(20\d{2})[-_.]?(0[1-9]|1[0-2])(?!\d)/); if (m) return m[1] + "-" + m[2];
  m = s.match(/(?:^|[^\d])(0[1-9]|1[0-2])[-_.]?(20\d{2})(?!\d)/); if (m) return m[2] + "-" + m[1];
  return null;
}
module.exports = { computeKy, blockers, isPayrollFile, kyFromName, parseKy };
