// ===== CORE / PAYROLL-STEPS (V10.1) — trạng thái THẬT của 7 bước tính lương, tính từ dữ liệu (không đoán theo màn hình đang mở) =====
// Mỗi bước: { ten, trangThai: "xong"|"dang"|"chan"|"chua", ly }. Hàm thuần — dùng chung renderer và test.
(function (root) {
  "use strict";
  var TEN = ["Chọn kỳ & cách tính", "Kiểm tra dữ liệu đầu vào", "Tính lương", "Kiểm tra bảng lương", "Chốt kỳ", "Thanh toán lương", "Báo cáo & phiếu lương"];
  /**
   * in: { chot:bool, daTinh:bool (đã tính và không cũ), loiDauVao:number (Critical/cộng trùng), loiChan:number (blockers của bảng lương),
   *       thanhToan:{ soNV, soCT, nguoiDaTraDu } }
   */
  function compute(i) {
    i = i || {};
    var tt = i.thanhToan || { soNV: 0, soCT: 0, nguoiDaTraDu: 0 }, out = [];
    function add(k, st, ly) { out.push({ ten: TEN[k], trangThai: st, ly: ly || "" }); }
    add(0, "xong");
    if (i.chot) add(1, "xong", "Đã chốt kỳ"); else if (i.loiDauVao > 0) add(1, "chan", i.loiDauVao + " lỗi dữ liệu nghiêm trọng"); else add(1, i.daTinh ? "xong" : "dang");
    if (i.chot || i.daTinh) add(2, "xong"); else add(2, i.loiDauVao > 0 ? "chua" : "dang");
    if (i.chot) add(3, "xong"); else if (!i.daTinh) add(3, "chua"); else if (i.loiChan > 0) add(3, "chan", i.loiChan + " lỗi chặn chốt"); else add(3, "dang", "Không còn lỗi chặn — có thể chốt");
    if (i.chot) add(4, "xong"); else if (i.daTinh && i.loiChan === 0 && !(i.loiDauVao > 0)) add(4, "dang"); else add(4, "chua");
    if (!i.chot) add(5, "chua", "Chỉ thanh toán sau khi chốt kỳ");
    else if (tt.soNV > 0 && tt.nguoiDaTraDu >= tt.soNV) add(5, "xong", "Đã thanh toán đủ " + tt.soNV + " người");
    else add(5, "dang", tt.soCT ? tt.nguoiDaTraDu + "/" + tt.soNV + " người đã trả đủ" : "Chưa lập chứng từ");
    if (!i.chot) add(6, "chua", "Phiếu lương/báo cáo chính thức sau khi chốt kỳ"); else add(6, "dang", "Có thể xuất báo cáo & phiếu lương");
    return out;
  }
  var api = { TEN: TEN, compute: compute };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.payrollSteps = api; }
})(typeof window !== "undefined" ? window : this);
