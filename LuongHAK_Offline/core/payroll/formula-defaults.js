// ===== CÔNG THỨC MẶC ĐỊNH CỦA HỆ THỐNG (dữ liệu, không phải mã rẽ nhánh) =====
// Thay cho switch/case TC1–TC6 trong engine.js (Master V5 giai đoạn 2). Đây là các công thức LỊCH SỬ đã đối chiếu
// với Excel/Power Query; mỗi biểu thức được chứng minh bằng test tương đương với bản switch cũ
// (tests/unit/formula-defaults-equivalence.test.js). Công ty có thể ghi đè bằng 1 dòng "Hiệu lực" trong
// Danh mục → Công thức tiền lương; không có ghi đè thì dùng bản mặc định này.
(function (root) {
  "use strict";
  var OVERTIME = {
    TC1: { ten: "Tăng ca 1 — vượt chuẩn × hệ số + tăng ca × hệ số",
      bieuThuc: "MAX(0, CONG_TINH_LUONG - CONG_LE - CONG_TRUNG_CHUYEN - CONG_PHEP - CONG_TC - CONG_CHUAN) * HE_SO_TC + CONG_TC * HE_SO_TC" },
    TC2: { ten: "Tăng ca 2 — như TC1, trừ công đi chuyển; chuẩn riêng khi có nhãn DQ",
      bieuThuc: "MAX(0, CONG_TINH_LUONG - CONG_LE - CONG_TRUNG_CHUYEN - CONG_PHEP - CONG_TC - CONG_DI_CHUYEN - IF(CONG_CHUAN_2 > 0, CONG_CHUAN_2, CONG_CHUAN)) * HE_SO_TC + CONG_TC * HE_SO_TC" },
    TC3: { ten: "Tăng ca 3 — (tăng ca + công Chủ nhật) × hệ số", bieuThuc: "(CONG_TC + CONG_CHU_NHAT) * HE_SO_TC" },
    TC4: { ten: "Tăng ca 4 — tăng ca × hệ số", bieuThuc: "CONG_TC * HE_SO_TC" },
    TC5: { ten: "Tăng ca 5 — tăng ca × hệ số (tiền cố định tính ở bước nhân đơn giá)", bieuThuc: "CONG_TC * HE_SO_TC" },
    TC6: { ten: "Tăng ca 6 — công vượt chuẩn (không nhân hệ số)", bieuThuc: "MAX(0, CONG_TINH_LUONG - CONG_TRUNG_CHUYEN - CONG_LE - CONG_CHUAN)" }
  };
  /** Mã tăng ca chưa có công thức nào (P2-01): giữ hành vi cũ tăng ca × hệ số — còn chờ chủ sở hữu quyết định có coi là lỗi không. */
  var OVERTIME_FALLBACK = { ma: "(mặc định)", bieuThuc: "CONG_TC * HE_SO_TC" };
  function overtime(code) { return OVERTIME[code] || null; }
  var api = { OVERTIME: OVERTIME, OVERTIME_FALLBACK: OVERTIME_FALLBACK, overtime: overtime };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.formulaDefaults = api; }
})(typeof window !== "undefined" ? window : this);
