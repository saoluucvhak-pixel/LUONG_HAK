// ===== CORE / VALIDATE — chuẩn hóa & kiểm tra dữ liệu đầu vào (không phụ thuộc giao diện) =====
// Dùng chung cho: ô nhập trên giao diện, nhập Excel, nâng cấp dữ liệu cũ, kiểm tra toàn vẹn.
(function (root) {
  "use strict";

  // ---------- Kiểu cột ----------
  // Cột TIỀN: nhập kiểu Việt Nam "1.500.000" hoặc "500.000" phải hiểu là hàng nghìn.
  var MONEY_COLS = /^(Lương thỏa thuận|Lương cơ bản|Lương phụ|Số tiền|Số tiền khoán|Đơn giá bù lương|Đơn giá bơm dăm|Tiền tăng ca \(nếu tính cố định\)|Thưởng|Thu nhập khác|Trừ khác|Tạm ứng|Thanh toán TM|Giá trị tiền thưởng|Thu nhập từ|Thu nhập đến|Thu nhập tháng \(Min\)|Thu nhập tháng \(Max\))$/;
  var DATE_COLS = /^(Ngày|Hiệu lực|Từ ngày|Đến ngày)/;
  // Mã định danh: luôn là CHỮ, giữ số 0 ở đầu
  var ID_COLS = { "Số CCCD": 12, "Số CCCD nhân thân": 12, "Số điện thoại": 10, "Mã số thuế": 0, "Số tài khoản": 0, "Số sổ BHXH": 10, "Mã NV": 0, "Số HĐLĐ": 0, "Phiếu cân": 0 };
  var KY_COL = "Kỳ";

  function isMoneyCol(c) { return MONEY_COLS.test(c); }
  function isDateCol(c) { return DATE_COLS.test(c); }
  function isIdCol(c) { return Object.prototype.hasOwnProperty.call(ID_COLS, c); }

  // ---------- Số tiền ----------
  /** "1.500.000" → 1500000 · "500.000" → 500000 · "1.500.000,5" → 1500000.5 · "1,500,000" → 1500000 · 1500 → 1500 · "" → 0. Trả NaN nếu không đọc được. */
  function parseMoney(v) {
    if (v === "" || v == null) return 0;
    if (typeof v === "number") return isFinite(v) ? v : NaN;
    var s = String(v).trim().replace(/\s|đ|VNĐ|VND/gi, "");
    if (!s) return 0;
    var neg = /^-/.test(s); if (neg) s = s.slice(1);
    var n;
    if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(s)) n = parseFloat(s.replace(/\./g, "").replace(",", "."));      // 1.500.000 / 500.000 / 1.500.000,5
    else if (/^[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(s)) n = parseFloat(s.replace(/,/g, ""));                    // 1,500,000 / 1,500,000.5
    else if (/^\d+([.,]\d+)?$/.test(s)) n = parseFloat(s.replace(",", "."));                                     // 1500000 / 0.5 / 0,5
    else n = NaN;
    return neg ? -n : n;
  }
  /** Chuẩn hóa ô tiền thành chuỗi số thuần ("1500000"). Giữ nguyên nếu không đọc được để người dùng thấy và sửa. */
  function normMoney(v) {
    if (v === "" || v == null) return "";
    var n = parseMoney(v);
    return isNaN(n) ? String(v) : String(Math.round(n * 1e6) / 1e6);
  }

  // ---------- Ngày ----------
  function pad2(n) { return ("0" + n).slice(-2); }
  function validYMD(y, m, d) { var dt = new Date(y, m - 1, d); return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d; }
  /** Chuẩn hóa ngày về "YYYY-MM-DD". Nhận Date, "2026-09-15", "15/09/2026", "15-9-2026", số serial Excel. Trả "" nếu trống, null nếu không hợp lệ. */
  function normDate(v) {
    if (v === "" || v == null) return "";
    if (v instanceof Date) return isNaN(v) ? null : v.getFullYear() + "-" + pad2(v.getMonth() + 1) + "-" + pad2(v.getDate());
    if (typeof v === "number") { // serial Excel (1900 date system)
      if (v < 20000 || v > 80000) return null;
      var d0 = new Date(Math.round((v - 25569) * 864e5)); // UTC
      return d0.getUTCFullYear() + "-" + pad2(d0.getUTCMonth() + 1) + "-" + pad2(d0.getUTCDate());
    }
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/))) { if (validYMD(+m[1], +m[2], +m[3])) return m[1] + "-" + pad2(+m[2]) + "-" + pad2(+m[3]); return null; }
    if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) { if (validYMD(+m[3], +m[2], +m[1])) return m[3] + "-" + pad2(+m[2]) + "-" + pad2(+m[1]); return null; }
    if (/^\d{5}$/.test(s)) return normDate(+s);
    return null;
  }
  /** Chuẩn hóa kỳ về "YYYY-MM". Nhận "2026-9", "2026-09", "09/2026", "9/2026", Date. */
  function normKy(v) {
    if (v === "" || v == null) return "";
    if (v instanceof Date) return v.getFullYear() + "-" + pad2(v.getMonth() + 1);
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/)) && +m[2] >= 1 && +m[2] <= 12) return m[1] + "-" + pad2(+m[2]);
    if ((m = s.match(/^(\d{1,2})[\/.-](\d{4})$/)) && +m[1] >= 1 && +m[1] <= 12) return m[2] + "-" + pad2(+m[1]);
    if (typeof v === "number") { var d = normDate(v); return d ? d.slice(0, 7) : null; }
    return null;
  }

  // ---------- Mã định danh ----------
  /** Giữ dạng chữ; nếu Excel làm mất số 0 đầu (CCCD 11 số, SĐT 9 số) thì bù lại. */
  function normId(col, v) {
    if (v === "" || v == null) return "";
    var s = typeof v === "number" ? String(Math.round(v)) : String(v).trim();
    var len = ID_COLS[col];
    if (len && /^\d+$/.test(s) && s.length === len - 1) s = "0" + s;
    return s;
  }

  /** Chuẩn hóa 1 giá trị theo tên cột. Trả { value, error } — error là mô tả lỗi nếu không đọc được. */
  function normCell(col, v) {
    if (col === KY_COL) { var k = normKy(v); return k === null ? { value: String(v), error: "Kỳ không hợp lệ (cần dạng 2026-09)" } : { value: k }; }
    if (isDateCol(col)) { var d = normDate(v); return d === null ? { value: String(v), error: "Ngày không hợp lệ (cần dạng 2026-09-15 hoặc 15/09/2026)" } : { value: d }; }
    if (isMoneyCol(col)) { if (v === "" || v == null) return { value: "" }; var n = parseMoney(v); return isNaN(n) ? { value: String(v), error: "Số tiền không đọc được" } : { value: String(Math.round(n * 1e6) / 1e6) }; }
    if (isIdCol(col)) return { value: normId(col, v) };
    if (col === "Hình thức công") return { value: String(v == null ? "" : v).trim().toUpperCase() };
    if (v == null) return { value: "" };
    if (typeof v === "number") return { value: String(Math.round(v * 1e9) / 1e9) };
    if (v instanceof Date) return { value: normDate(v) };
    return { value: String(v).trim() };
  }

  // ---------- Ô ngày chấm công ----------
  // Hợp lệ: trống | số công ≥ 0 (1, 0.5, 1,5) | số công + nhãn (1QC) | chỉ nhãn (QC).
  // Nhãn: bắt đầu bằng chữ cái, sau đó chữ/số (VD QC, CT2). Không chấp nhận số âm, "1.5.2", ký tự lạ.
  var DAY_RE = /^(\d+(?:[.,]\d+)?)?\s*([A-Za-z\u00C0-\u1EF9][A-Za-z0-9\u00C0-\u1EF9]*)?$/;
  var MAX_CONG_NGAY = 3;
  function daysInKy(ky) { var k = normKy(ky); if (!k) return 31; var y = +k.slice(0, 4), m = +k.slice(5, 7); return new Date(y, m, 0).getDate(); }
  /**
   * Kiểm tra 1 ô ngày chấm công.
   * @param day "01".."31"  @param v giá trị ô  @param ky kỳ của dòng ("2026-09") — để biết ngày có tồn tại không
   * @returns { error: mô tả lỗi | null, warn: cảnh báo | null, soCong, nhan }
   */
  function dayCell(day, v, ky) {
    var res = { error: null, warn: null, soCong: 0, nhan: "" };
    if (v === "" || v == null) return res;
    var d = +day;
    if (!(d >= 1 && d <= 31)) { res.error = "Cột ngày " + day + " không hợp lệ"; return res; }
    if (ky && d > daysInKy(ky)) { res.error = "Ngày " + day + " không tồn tại trong tháng " + normKy(ky).slice(5) + "/" + normKy(ky).slice(0, 4) + " (\"" + v + "\")"; return res; }
    if (typeof v === "number") {
      if (!isFinite(v) || v < 0) { res.error = "Ngày " + day + ": số công âm hoặc không hợp lệ (" + v + ")"; return res; }
      res.soCong = v;
    } else {
      var s = String(v).trim(), m = s.match(DAY_RE);
      if (!s) return res;
      if (!m || (m[1] == null && m[2] == null)) { res.error = "Ngày " + day + ": \"" + s + "\" không đọc được (cần dạng 1, 0.5, 1QC hoặc QC)" + (/^-/.test(s) ? " — số công không được âm" : ""); return res; }
      res.soCong = m[1] == null ? 0 : parseFloat(m[1].replace(",", "."));
      res.nhan = m[2] || "";
    }
    if (res.soCong > MAX_CONG_NGAY) res.warn = "Ngày " + day + ": " + res.soCong + " công — vượt " + MAX_CONG_NGAY + " công/ngày, kiểm tra lại";
    return res;
  }

  // ---------- Kỳ của 1 dòng phát sinh ----------
  var PERIOD_FIELD = { chamcong: "Kỳ", sanluong: "Ngày cân", bandam: "Ngày cân", psluong: "Ngày hạch toán", ungluong: "Ngày hạch toán", tiencom: "Ngày" };
  function rowPeriod(table, r) {
    var f = PERIOD_FIELD[table]; if (!f || !r) return null;
    var v = r[f]; if (!v) return null;
    return table === "chamcong" ? normKy(v) : (normDate(v) || "").slice(0, 7) || null;
  }

  var api = { parseMoney: parseMoney, normMoney: normMoney, normDate: normDate, normKy: normKy, normId: normId, normCell: normCell,
    dayCell: dayCell, daysInKy: daysInKy, MAX_CONG_NGAY: MAX_CONG_NGAY,
    isMoneyCol: isMoneyCol, isDateCol: isDateCol, isIdCol: isIdCol, rowPeriod: rowPeriod, PERIOD_FIELD: PERIOD_FIELD };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.validate = api; }
})(typeof window !== "undefined" ? window : this);
