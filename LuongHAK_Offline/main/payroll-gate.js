// ===== MAIN / PAYROLL-GATE — tiến trình chính TỰ tính lại kỳ lương từ dữ liệu để chặn chốt / xuất bảng lương lỗi (V9.2 mục XV) =====
// Không tin kết quả/trạng thái do renderer gửi: đọc dữ liệu (đã nhận hoặc trên đĩa), tính lại bằng đúng engine + hồ sơ nhân sự, rồi hỏi core/payroll-gate.js.
"use strict";
const E = require("../engine.js");
const HRM = require("../hr.js");
const GATE = require("../core/payroll-gate.js");
const PA = require("../core/production-alloc.js");
const CLS = require("../core/payroll-close.js");

function parseKy(ky) { const m = String(ky || "").match(/^(\d{4})-(\d{2})$/); return m ? { nam: +m[1], thang: +m[2] } : null; }

/** Tính kỳ như app.js tinhLuong() (cùng hàm engine/hồ sơ). opts: { quyChe: "2026"|"1.7", bu: false|true|"daihiep"|"to" } */
function computeKy(db, ky, opts) {
  opts = opts || {};
  const p = parseKy(ky); if (!p) throw new Error("Kỳ không hợp lệ: " + ky);
  ["nhanvien", "hopdong", "chitiethd", "nhanthan", "thanhtoan", "canhan", "chamcong", "sanluong", "bandam", "psluong", "ungluong", "tiencom", "kyluong", "kyluong_lichsu", "nghiphep", "nghiom", "congtac"].forEach((k) => { if (db[k] === undefined || db[k] === null) db[k] = []; else if (!Array.isArray(db[k])) throw new Error("Bảng '" + k + "' sai cấu trúc (không phải danh sách) — không tính được kỳ"); });
  const sp = HRM.staffForPayroll(db, p.nam, p.thang);
  const slK = HRM.sanLuongKy(db, p.nam, p.thang, "sanluong"), bdK = HRM.sanLuongKy(db, p.nam, p.thang, "bandam");
  const kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list, sanluong: slK.rows, bandam: bdK.rows }), p.nam, p.thang, opts.bu === undefined ? false : opts.bu, { quyChe: opts.quyChe || "2026" });
  kq.canhbao = sp.warn.concat(kq.canhbao);
  const unalloc = [], allocErr = [];
  [["Sản lượng", "sanluong", slK], ["Bơm dăm", "bandam", bdK]].forEach(([ten, loai, k]) => {
    try {
      const pbOf = (ma, d) => (HRM.hienHanh(db, ma, d).pb || "");
      const al = PA.withDirect(k.alloc, k.direct.map((r) => ({ phieu: r["Phiếu cân"] || "", ngay: String(r["Ngày cân"] || "").slice(0, 10), kl: r["KL hàng (Tấn)"], ma: r["Mã NV"] })), pbOf, () => "", (pb) => HRM.refName(db, "dm_phongban", pb) || "");
      if (al && al.unallocated > 0.0005) unalloc.push(ten + ": " + Math.round(al.unallocated * 1000) / 1000 + (loai === "bandam" ? " xe" : " tấn") + " chưa phân bổ được cho ai");
    } catch (e) { allocErr.push(ten + ": " + String(e && e.message || e)); } // V10.1: FAIL-CLOSED — không phân bổ được thì CHẶN, không bỏ qua điều kiện
  });
  const extra = [];
  if (unalloc.length) extra.push({ code: "SAN_LUONG_CHUA_PHAN_BO", ten: "Sản lượng chưa phân bổ hết", items: unalloc });
  if (allocErr.length) extra.push({ code: "PRODUCTION_ALLOCATION_ERROR", ten: "Không kiểm tra được phân bổ sản lượng (lỗi nguồn dữ liệu)", items: allocErr });
  return { kq, extra };
}
/** → [{code, ten, count, items}] (rỗng = được phép) */
function blockers(db, ky, opts) {
  let r;
  try { r = computeKy(db, ky, opts); }
  catch (e) { return [{ code: "PAYROLL_RECALCULATION_FAILED", ten: "Không tính lại được kỳ " + ky + " tại tiến trình chính", count: 1, items: [String(e && e.message || e)] }]; } // V10.1: lỗi engine ⇒ CHẶN
  return GATE.blockers(r.kq, r.extra);
}

/** Tên file xuất có vẻ là bảng lương chính thức? (cùng quy tắc với app.js PAYROLL_FILE) */
// "luong" trong "khối lượng / sản lượng / số lượng" KHÔNG phải bảng lương (báo cáo phân bổ khối lượng là công cụ để SỬA lỗi chặn chốt kỳ, không được chặn tải)
const PAYROLL_FILE = /(?<!khoi[ _-]?)(?<!san[ _-]?)(?<!so[ _-]?)(?<!sl[ _-]?)luong|thanhtoan|payslip|phieu ?luong|bangtinh|tonghop ?luong|kechuyenkhoan|ke ?chuyen ?khoan|chuyenkhoan/i;
const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
function isPayrollFile(name) { return PAYROLL_FILE.test(String(name || "")) || PAYROLL_FILE.test(slug(name)); }
/** Lấy kỳ YYYY-MM từ tên file (2026-09, 2026_09, 09-2026, 092026, T09_2026…) hoặc null */
function kyFromName(name) {
  const s = String(name || "");
  let m = s.match(/(20\d{2})[-_.]?(0[1-9]|1[0-2])(?!\d)/); if (m) return m[1] + "-" + m[2];
  m = s.match(/(?:^|[^\d])(0[1-9]|1[0-2])[-_.]?(20\d{2})(?!\d)/); if (m) return m[2] + "-" + m[1];
  return null;
}
// Báo cáo thanh toán (bảng thanh toán / kê chuyển khoản / tiền mặt / chi tiết thanh toán) CHỈ xuất từ kỳ ĐÃ CHỐT
const PAYMENT_FILE = /thanh ?toan|chuyen ?khoan|tien ?mat/i;
function isPaymentFile(name) { return PAYMENT_FILE.test(String(name || "")) || PAYMENT_FILE.test(slug(name)); }
/**
 * V10.1 — kiểm tra xuất file tại MAIN, FAIL-CLOSED. loadDb() → đối tượng dữ liệu hoặc ném lỗi.
 * Tên file không xác định kỳ / không đọc được dữ liệu / engine lỗi / thiếu bản chốt cho báo cáo thanh toán ⇒ CHẶN (không "không kiểm tra được thì cho qua").
 * @returns { ok:true } | { ok:false, code, message, blocked:[...] }
 */
function checkExport(name, loadDb, opts) {
  // loại trừ tên thương hiệu "LuongHAK_…" (sao lưu), danh mục "Mã lương", file mẫu "Mau_…" — không phải báo cáo bảng lương
  const base = slug(name).replace(/luong ?hak/ig, "").replace(/ma[ _-]?luong/ig, "");
  if (/^mau[_ -]/i.test(slug(name)) || !isPayrollFile(base)) return { ok: true };
  const ky = kyFromName(name);
  if (!ky) return { ok: false, code: "EXPORT_PERIOD_UNKNOWN", message: "Không xác định được kỳ lương từ tên file '" + name + "' — không thể kiểm tra, không cho xuất", blocked: [] };
  let d; try { d = loadDb(); } catch (e) { d = null; }
  if (!d || typeof d !== "object") return { ok: false, code: "EXPORT_DATA_UNAVAILABLE", message: "Không đọc được dữ liệu để kiểm tra kỳ " + ky + " — không cho xuất", blocked: [] };
  const closed = (d.kyluong || []).some((k) => k.ky === ky);
  if (closed) return { ok: true, closed: true };
  if (isPaymentFile(name)) return { ok: false, code: "EXPORT_NOT_CLOSED", message: "Báo cáo thanh toán chỉ xuất từ kỳ ĐÃ CHỐT — kỳ " + ky + " chưa chốt", blocked: [] };
  const o = Object.assign({ quyChe: ((d.congty || [])[0] || {})["Quy chế tính lương"] === "1.7" ? "1.7" : "2026" }, opts || {});
  const bl = blockers(d, ky, o);
  if (bl.length) return { ok: false, code: "EXPORT_BLOCKED", message: "Kỳ " + ky + " còn lỗi chặn: " + bl.map((b) => b.code + " ×" + b.count).join(", "), blocked: bl };
  return { ok: true, closed: false };
}
/**
 * V10.1 — MAIN kiểm tra bản chốt mà renderer gửi lên: (1) checksum kết quả khớp; (2) tính lại từ dữ liệu → từng nhân viên cùng Thu nhập/Thực lĩnh;
 * (3) kỳ có sản lượng cần bù thì phương pháp bù trong bản chốt phải là bản "Hiệu lực" của Quy chế bù sản lượng (không tin lựa chọn xem thử).
 * Trả về mảng lý do từ chối (rỗng = hợp lệ).
 */
function verifySnapshot(db, snap) {
  const why = [];
  if (!snap || !snap.kq || !Array.isArray(snap.kq.bangluong)) return ["bản chốt thiếu bảng lương"];
  try { if (snap.checksum && CLS.checksum(snap.kq) !== snap.checksum) why.push("checksum kết quả không khớp (bản chốt bị sửa sau khi tạo)"); } catch (e) { why.push("không tính được checksum: " + (e && e.message || e)); }
  let r; try { r = computeKy(db, snap.ky, { quyChe: snap.quyChe || "2026", bu: snap.buTheoNgay }); } catch (e) { return why.concat(["không tính lại được kỳ " + snap.ky + ": " + (e && e.message || e)]); }
  const mine = {}; r.kq.bangluong.forEach((x) => { mine[x["Mã NV"]] = x; });
  const theirs = {}; snap.kq.bangluong.forEach((x) => { theirs[x["Mã NV"]] = x; });
  const lech = [];
  Object.keys(mine).forEach((ma) => { const a = mine[ma], b = theirs[ma]; if (!b) lech.push(ma + " thiếu trong bản chốt"); else if (Math.abs((+a["Thực lĩnh"] || 0) - (+b["Thực lĩnh"] || 0)) > 1 || Math.abs((+a["Tổng thu nhập"] || 0) - (+b["Tổng thu nhập"] || 0)) > 1) lech.push(ma + ": thực lĩnh " + Math.round(+b["Thực lĩnh"] || 0) + " ≠ tính lại " + Math.round(+a["Thực lĩnh"] || 0)); });
  Object.keys(theirs).forEach((ma) => { if (!mine[ma]) lech.push(ma + " không có trong kết quả tính lại"); });
  if (lech.length) why.push(lech.length + " nhân viên lệch khi tính lại: " + lech.slice(0, 3).join(" | "));
  const p = parseKy(snap.ky);
  if (p && r.kq.bangluong.some((b) => b._ct && b._ct.laSanLuong)) {
    const qc = E.quyCheBuChinhThuc(db.dm_quychebu, p.nam, p.thang), ma = qc && String(qc["Cách bù"] || "").trim();
    if (!ma || (ma !== "daihiep" && ma !== "to")) why.push("kỳ có sản lượng cần bù nhưng chưa có phương pháp bù CHÍNH THỨC hợp lệ");
    else if (String(snap.buTheoNgay) !== ma) why.push("phương pháp bù trong bản chốt (" + snap.buTheoNgay + ") khác phương pháp chính thức (" + ma + ")");
  }
  return why;
}
module.exports = { verifySnapshot, computeKy, blockers, isPayrollFile, isPaymentFile, kyFromName, parseKy, checkExport };
