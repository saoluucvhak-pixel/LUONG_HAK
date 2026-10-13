// V9.2 — CompanyID: gán "Mã công ty" cho dòng dữ liệu cũ bằng migration CÓ KIỂM TRA, không đoán.
// Chỉ gán khi xác định được DUY NHẤT một công ty (hồ sơ công ty có Mã công ty). Nhiều công ty / thiếu mã → chặn, báo rõ.
// Không bao giờ ghi đè dòng đã có Mã công ty; không đụng bảng lương đã chốt (ảnh chụp riêng).
(function (root) {
  "use strict";
  var F = "Mã công ty";
  var TABLES = ["nhanvien", "hopdong", "chamcong", "sanluong", "bandam", "nhanthan", "hdld_tailieu"];
  function companies(db) { return (db.congty || []).filter(function (c) { return c && String(c[F] || "").trim(); }); }
  /** Kết quả: {status:"READY"|"BLOCKED"|"NOTHING", companyId, reason, counts:{bảng:số dòng thiếu}, foreign:[{bảng,index,giá trị}]} */
  function plan(db) {
    var cs = companies(db), counts = {}, total = 0, foreign = [], ids = {};
    cs.forEach(function (c) { ids[String(c[F]).trim()] = 1; });
    TABLES.forEach(function (t) {
      var n = 0; (db[t] || []).forEach(function (r, i) {
        var v = String(r[F] == null ? "" : r[F]).trim();
        if (!v) n++; else if (!ids[v]) foreign.push({ bang: t, index: i, giaTri: v });
      });
      if (n) { counts[t] = n; total += n; }
    });
    var out = { status: "NOTHING", companyId: "", reason: "", counts: counts, total: total, foreign: foreign };
    if (!total) { out.reason = "Mọi dòng đã có Mã công ty"; if (foreign.length) { out.status = "BLOCKED"; out.reason = foreign.length + " dòng mang Mã công ty không có trong hồ sơ công ty — cần xử lý tay"; } return out; }
    if (cs.length === 0) { out.status = "BLOCKED"; out.reason = "Hồ sơ công ty chưa có Mã công ty — nhập ở Công ty & Sao lưu trước, hệ thống không tự đặt mã"; return out; }
    if (cs.length > 1) { out.status = "BLOCKED"; out.reason = "Có " + cs.length + " công ty: không thể tự biết dòng cũ thuộc công ty nào — cần bảng ánh xạ do người dùng cung cấp"; return out; }
    out.status = "READY"; out.companyId = String(cs[0][F]).trim(); return out;
  }
  /** Thực hiện: chỉ khi plan READY; trả {ok, changed:{bảng:số dòng}} — idempotent (chạy lại không đổi gì). */
  function apply(db) {
    var p = plan(db);
    if (p.status !== "READY") return { ok: false, reason: p.reason || p.status, changed: {} };
    var changed = {};
    TABLES.forEach(function (t) { (db[t] || []).forEach(function (r) { if (!String(r[F] == null ? "" : r[F]).trim()) { r[F] = p.companyId; changed[t] = (changed[t] || 0) + 1; } }); });
    return { ok: true, companyId: p.companyId, changed: changed };
  }
  /** Lọc theo công ty; dòng chưa có mã chỉ hiện khi includeBlank. */
  function filter(rows, id, includeBlank) {
    if (!id) return rows;
    return rows.filter(function (r) { var v = String(r[F] == null ? "" : r[F]).trim(); return v ? v === id : !!includeBlank; });
  }
  var api = { FIELD: F, TABLES: TABLES, plan: plan, apply: apply, filter: filter };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.company = api; }
})(typeof self !== "undefined" ? self : this);
