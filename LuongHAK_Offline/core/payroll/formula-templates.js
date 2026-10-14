// ===== MẪU CÔNG THỨC (dữ liệu dùng chung cho Trình thiết lập công thức & Trình thiết kế công thức tăng ca) =====
// V10.2: tách khỏi app.js để MỘT danh sách duy nhất. Mẫu có `tuongDuong` đã được test tương đương công thức mặc định TC1–TC3
// (tests/unit/v102-overtime-master.test.js). Mẫu có `thamKhao` KHÔNG tương đương công thức cùng tên trong formula-defaults.js
// (TC6 thật: MAX(0, CONG_TINH_LUONG - CONG_TRUNG_CHUYEN - CONG_LE - CONG_CHUAN); mẫu bên dưới trừ thêm CONG_TC và không trừ CONG_TRUNG_CHUYEN)
// → luôn hiển thị là mẫu tham khảo; KHÔNG tự sửa cho khớp khi chưa có xác nhận quy tắc nghiệp vụ.
(function (root) {
  "use strict";
  var TEMPLATES = [
    { loai: "OVERTIME", tuongDuong: "TC1", ten: "Vượt công chuẩn, nhân hệ số (như TC1)", bieuThuc: "IF(CONG_TINH_LUONG - CONG_LE - CONG_TRUNG_CHUYEN - CONG_PHEP - CONG_TC - CONG_CHUAN > 0, (CONG_TINH_LUONG - CONG_LE - CONG_TRUNG_CHUYEN - CONG_PHEP - CONG_TC - CONG_CHUAN) * HE_SO_TC, 0) + CONG_TC * HE_SO_TC", moTa: "Phần công vượt công chuẩn (đã trừ lễ/phép/trung chuyển/tăng ca) × hệ số, cộng thêm công tăng ca đã chấm × hệ số." },
    { loai: "OVERTIME", tuongDuong: "TC2", ten: "Vượt công chuẩn, có Công chuẩn 2 (như TC2)", bieuThuc: "IF(CONG_TINH_LUONG - CONG_LE - CONG_TRUNG_CHUYEN - CONG_PHEP - CONG_TC - CONG_DI_CHUYEN - IF(CONG_CHUAN_2 > 0, CONG_CHUAN_2, CONG_CHUAN) > 0, (CONG_TINH_LUONG - CONG_LE - CONG_TRUNG_CHUYEN - CONG_PHEP - CONG_TC - CONG_DI_CHUYEN - IF(CONG_CHUAN_2 > 0, CONG_CHUAN_2, CONG_CHUAN)) * HE_SO_TC, 0) + CONG_TC * HE_SO_TC", moTa: "Như trên nhưng trừ thêm công di chuyển; dùng Công chuẩn 2 (nhãn DQ) thay Công chuẩn khi có." },
    { loai: "OVERTIME", tuongDuong: "TC3", ten: "Tăng ca + Chủ nhật nhân hệ số (như TC3)", bieuThuc: "(CONG_TC + CONG_CHU_NHAT) * HE_SO_TC", moTa: "Công tăng ca cộng công Chủ nhật, nhân hệ số tăng ca." },
    { loai: "OVERTIME", ten: "Phần vượt công chuẩn, KHÔNG nhân hệ số (MẪU THAM KHẢO — không tương đương TC6 của hệ thống)", thamKhao: "TC6", bieuThuc: "MAX(CONG_TINH_LUONG - CONG_TC - CONG_LE - CONG_CHUAN, 0)", moTa: "Chỉ lấy phần công vượt công chuẩn, không nhân hệ số tăng ca." },
    { loai: "OVERTIME", ten: "Công tăng ca × hệ số (mặc định)", bieuThuc: "CONG_TC * HE_SO_TC", moTa: "Công thức đơn giản nhất — dùng khi không có quy tắc đặc biệt." },
    { loai: "ALLOWANCE", ten: "Tỷ lệ theo công, có ngưỡng (ví dụ mẫu)", bieuThuc: "IF(CONG_HUONG_PHU_CAP >= NGUONG_PHU_CAP, MUC_PHU_CAP, MUC_PHU_CAP * CONG_HUONG_PHU_CAP / CONG_CHUAN)", moTa: "Đủ ngưỡng công → hưởng đủ mức phụ cấp; chưa đủ → chia theo tỷ lệ công / công chuẩn." },
    { loai: "ALLOWANCE", ten: "Tỷ lệ, trừ lễ+phép khi dưới ngưỡng", bieuThuc: "IF(CONG_TINH_LUONG - CONG_LE - CONG_PHEP >= CONG_CHUAN - NGUONG_PHU_CAP, MUC_PHU_CAP, ROUND(MUC_PHU_CAP / CONG_CHUAN * (CONG_TINH_LUONG - CONG_LE - CONG_PHEP)))", moTa: "Giống kiểu TYLE_TRU_LE_PHEP cũ — đối chiếu M thật HAK_DN." },
    { loai: "ALLOWANCE", ten: "Tỷ lệ, trừ phép+tăng ca khi dưới ngưỡng", bieuThuc: "IF(CONG_TINH_LUONG - CONG_PHEP - CONG_TC >= CONG_CHUAN - NGUONG_PHU_CAP, MUC_PHU_CAP, ROUND(MUC_PHU_CAP / CONG_CHUAN * (CONG_TINH_LUONG - CONG_PHEP - CONG_TC)))", moTa: "Giống kiểu TYLE_TRU_PHEP_TANGCA cũ — quy chế 2026/C6." },
    { loai: "ALLOWANCE", ten: "Cố định, không tính theo công", bieuThuc: "MUC_PHU_CAP", moTa: "Luôn trả đủ mức phụ cấp, không trừ gì theo công." },
    { loai: "SUPPORT", ten: "Theo ngày / lượt được hưởng", bieuThuc: "SO_NGAY_DUOC_HUONG * MUC_HO_TRO", moTa: "Số ngày (hoặc lượt) được hưởng × đơn giá hỗ trợ." },
    { loai: "SUPPORT", ten: "Bù thiếu công chuẩn (như HT_THIEU_CHUAN)", bieuThuc: "IF(CONG_CHUAN > 0 AND CONG_THUC_TE <= CONG_CHUAN, (CONG_CHUAN - CONG_THUC_TE) * MUC_HO_TRO, 0)", moTa: "Chỉ trả khi công thực tế chưa đạt công chuẩn — bù đúng phần còn thiếu." },
    { loai: "SUPPORT", ten: "Theo xe / đơn vị hợp lệ", bieuThuc: "SO_XE_HOP_LE * DON_GIA_HO_TRO", moTa: "Số xe (hoặc đơn vị) hợp lệ × đơn giá hỗ trợ theo xe." },
    { loai: "SUPPORT", ten: "Gấp đôi khi đủ điều kiện", bieuThuc: "IF(DU_DIEU_KIEN_HO_TRO = 1, SO_NGAY_DUOC_HUONG * MUC_HO_TRO * 2, SO_NGAY_DUOC_HUONG * MUC_HO_TRO)", moTa: "Đủ điều kiện (biến 0/1) → hưởng gấp đôi mức thường." }
  ];
  var api = { TEMPLATES: TEMPLATES, ofType: function (loai) { return TEMPLATES.filter(function (x) { return x.loai === loai; }); } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.formulaTemplates = api; }
})(typeof window !== "undefined" ? window : this);
