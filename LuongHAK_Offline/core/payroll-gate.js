// ===== CORE / PAYROLL-GATE — điều kiện CHẶN chốt kỳ / xuất bảng lương chính thức (V9.2 mục XV) =====
// Thuần dữ liệu, không phụ thuộc giao diện: dùng chung cho renderer (báo sớm) VÀ tiến trình chính (kiểm lại, không tin trạng thái renderer gửi).
(function (root) {
  "use strict";
  // Mỗi luật: mã, nhãn, hàm nhận kq (kết quả tinhBangLuong) → danh sách thông báo chi tiết
  var RULES = [
    { code: "FORMULA_ERROR", ten: "Lỗi công thức tiền lương", test: function (kq) { return (kq.loiCongThuc || []).map(function (e) { return (e.maNV ? e.maNV + " · " : "") + e.loai + " '" + e.maCongThuc + "' — " + e.message; }); } },
    { code: "TAX_CONFIG_CONFLICT", ten: "Biểu thuế TNCN xung đột (bậc chồng nhau)", test: function (kq) { return (kq.loiThue || []).filter(function (e) { return e.loai === "CONFLICT"; }).map(function (e) { return e.maNV + " (mã '" + e.maThue + "'): " + e.message; }); } },
    { code: "TAX_CONFIG_ERROR", ten: "Cấu hình thuế TNCN lỗi (mã thuế, biểu thuế, giảm trừ)", test: function (kq) { return (kq.loiThue || []).filter(function (e) { return e.loai !== "CONFLICT"; }).map(function (e) { return e.maNV + " (mã '" + e.maThue + "'): " + e.message; }); } },
    { code: "CONG_CHUAN_ERROR", ten: "Công chuẩn của mã lương không hợp lệ", test: function (kq) { return (kq.loiCongChuan || []).map(function (e) { return e.maNV + " (mã lương '" + e.maLuong + "'): " + e.message; }); } },
    { code: "MA_LUONG_THIEU", ten: "Mã lương không có trong danh mục", test: function (kq) { return pick(kq, /chưa có trong Danh mục lương/); } },
    { code: "MA_TANG_CA_THIEU", ten: "Mã tăng ca không xác định", test: function (kq) { return pick(kq, /chưa có trong Danh mục tăng ca/); } },
    { code: "MA_BH_THIEU", ten: "Mã bảo hiểm không có trong danh mục", test: function (kq) { return pick(kq, /chưa có trong Danh mục bảo hiểm/); } }
  ];
  function pick(kq, re) { return (kq.canhbao || []).filter(function (w) { return re.test(String(w)); }).map(String); }
  /** → [{ code, ten, count, items:[...] }] — rỗng = không có gì chặn. */
  function blockers(kq, extra) {
    kq = kq || {}; var out = [];
    RULES.forEach(function (r) { var it = r.test(kq); if (it.length) out.push({ code: r.code, ten: r.ten, count: it.length, items: it }); });
    (extra || []).forEach(function (x) { if (x && x.items && x.items.length) out.push({ code: x.code, ten: x.ten, count: x.items.length, items: x.items }); });
    return out;
  }
  function summary(bl) { return (bl || []).map(function (b) { return b.code + " ×" + b.count; }).join(", "); }
  var api = { blockers: blockers, summary: summary, RULES: RULES.map(function (r) { return { code: r.code, ten: r.ten }; }) };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.gate = api; }
})(typeof window !== "undefined" ? window : this);
