// ===== DYNAMIC PAYROLL FORMULA ENGINE — tra công thức theo mã + công ty + ngày hiệu lực (mục III.2/IV.1) =====
// Chỉ ĐỌC danh mục DM_PAYROLL_FORMULA (mảng record phẳng, giống các danh mục khác của app) — không
// gọi parser/evaluator ở đây, chỉ chọn ĐÚNG 1 bản ghi công thức cho (mã, công ty, kỳ) đang tính.
(function (root) {
  "use strict";

  /** "YYYY-MM-DD" → số để so sánh nhanh; null nếu rỗng/không hợp lệ. */
  function dateNum(s) {
    var k = String(s || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    return k ? (+k[1]) * 10000 + (+k[2]) * 100 + (+k[3]) : null;
  }

  /**
   * @param records   mảng DM_PAYROLL_FORMULA (field tiếng Việt: "Mã công thức", "Loại", "Công ty",
   *                   "Hiệu lực từ", "Hiệu lực đến", "Trạng thái", "Biểu thức", "Tham số"...)
   * @param q         { code: "Mã công thức", type: "OVERTIME"|"ALLOWANCE"|"SUPPORT", companyId,
   *                   nam, thang }
   * @returns bản ghi công thức ĐANG HIỆU LỰC khớp nhất, hoặc null nếu không có.
   *   Ưu tiên: (1) chỉ xét Trạng thái = "Hiệu lực" — "Nháp"/"Đã duyệt" (chưa tới ngày)/"Ngừng" không
   *   được dùng để tính lương chính thức (mục VII.4); (2) khớp đúng Mã công thức + Loại; (3) khớp
   *   Công ty CỤ THỂ trước, bản không ghi Công ty (áp dụng mọi công ty) chỉ dùng khi không có bản
   *   riêng cho công ty đó; (4) trong các bản còn lại, lấy "Hiệu lực từ" lớn nhất mà vẫn <= cuối kỳ
   *   và ("Hiệu lực đến" trống hoặc >= đầu kỳ).
   */
  /** Chuẩn hóa tên/mã công ty để so khớp: bỏ khoảng trắng thừa, không phân biệt hoa/thường. */
  function normCompany(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase(); }
  /** q.companyId có thể là 1 chuỗi hoặc mảng (mã công ty + tên công ty của file dữ liệu — mô hình 1 công ty/1 file). */
  function companyKeys(q) {
    var raw = q.companyId == null ? [] : (Array.isArray(q.companyId) ? q.companyId : [q.companyId]);
    return raw.map(normCompany).filter(Boolean);
  }

  /**
   * Bản đầy đủ của resolve(): trả { rec, status, otherCompany } để nơi gọi (engine) phân biệt các tình huống
   * mà resolve() chỉ trả null/bản ghi:
   *   status "OK"            — chọn được đúng 1 bản ghi (rec).
   *   status "NONE"          — không có bản "Hiệu lực" nào cho mã này trong kỳ (rec = null).
   *   status "OTHER_COMPANY" — CÓ bản hiệu lực nhưng chỉ ghi cho công ty KHÁC (rec = null, otherCompany = danh sách công ty đó):
   *                            KHÔNG dùng công thức của công ty khác, nhưng để engine cảnh báo, không âm thầm bỏ qua.
   *   status "CONFLICT"      — ≥ 2 bản hiệu lực cùng mã, cùng phạm vi công ty, cùng "Hiệu lực từ" mới nhất: không có
   *                            quy tắc ưu tiên rõ ràng (mục III.2) → rec = null, conflict = các bản ghi xung đột.
   * Công ty của bản ghi: để trống = áp dụng mọi công ty; ghi tên/mã = chỉ áp dụng khi khớp (không phân biệt hoa/thường)
   * với một trong q.companyId. File không có danh tính công ty → chỉ bản không ghi công ty được áp dụng.
   */
  function resolveEx(records, q) {
    var dauKy = q.nam * 10000 + q.thang * 100 + 1, cuoiKy = q.nam * 10000 + q.thang * 100 + 31;
    var cand = (records || []).filter(function (r) {
      if (String(r["Trạng thái"] || "") !== "Hiệu lực") return false;
      if (String(r["Mã công thức"] || "") !== q.code) return false;
      if (q.type && r["Loại"] && String(r["Loại"]) !== q.type) return false;
      var tu = dateNum(r["Hiệu lực từ"]), den = dateNum(r["Hiệu lực đến"]);
      if (tu != null && tu > cuoiKy) return false;
      if (den != null && den < dauKy) return false;
      return true;
    });
    if (!cand.length) return { rec: null, status: "NONE" };
    var keys = companyKeys(q);
    var withCompany = keys.length ? cand.filter(function (r) { return r["Công ty"] && keys.indexOf(normCompany(r["Công ty"])) >= 0; }) : [];
    var generic = cand.filter(function (r) { return !String(r["Công ty"] || "").trim(); });
    var pool = withCompany.length ? withCompany : generic;
    if (!pool.length) {
      var others = []; cand.forEach(function (r) { var c = String(r["Công ty"] || "").trim(); if (c && others.indexOf(c) < 0) others.push(c); });
      return { rec: null, status: "OTHER_COMPANY", otherCompany: others };
    }
    var maxTu = -1, best = null;
    pool.forEach(function (r) { var tu = dateNum(r["Hiệu lực từ"]) || 0; if (tu > maxTu) { maxTu = tu; best = r; } });
    var top = pool.filter(function (r) { return (dateNum(r["Hiệu lực từ"]) || 0) === maxTu; });
    if (top.length > 1) return { rec: null, status: "CONFLICT", conflict: top };
    return { rec: best, status: "OK" };
  }

  /** Như resolveEx() nhưng chỉ trả bản ghi (hoặc null cho NONE/OTHER_COMPANY/CONFLICT) — giữ API cũ cho UI/test. */
  function resolve(records, q) { return resolveEx(records, q).rec; }

  /** Các công thức (mọi trạng thái) của 1 mã — dùng cho màn hình "Lịch sử phiên bản" (mục VII.4). */
  function versionsOf(records, code, type) {
    return (records || []).filter(function (r) { return String(r["Mã công thức"] || "") === code && (!type || String(r["Loại"] || "") === type); })
      .sort(function (a, b) { return String(a["Hiệu lực từ"] || "") < String(b["Hiệu lực từ"] || "") ? 1 : -1; });
  }

  var api = { resolve: resolve, resolveEx: resolveEx, versionsOf: versionsOf, dateNum: dateNum, normCompany: normCompany };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.formulaRegistry = api; }
})(typeof window !== "undefined" ? window : this);
