// ===== REPORT FILTER ENGINE — bộ lọc dùng chung cho mọi báo cáo (Master V5 mục "HAK Reporting Center") =====
// Một đặc tả lọc (spec) thuần dữ liệu, dùng chung cho màn hình, xuất Excel và xuất PDF để 3 nơi luôn ra CÙNG tập dòng.
//   spec = { khoi: [tên khối], phongBan: [tên PB], to: [tên tổ], maLuong: [mã], httt: [text], hinhThucCong: [BT|TC…], tuKhoa: "chuỗi", maNV: [mã], chiCoThuNhap: bool, thucLinhTu: số, thucLinhDen: số }
// Chọn nhiều giá trị (HOẶC trong 1 tiêu chí, VÀ giữa các tiêu chí). ctx (setContext) cho biết khối của phòng ban / hình thức công của nhân viên — tiêu chí nào chưa có dữ liệu thì BÁO và không áp (applyGeneric.skipped).
// Không đổi dữ liệu gốc; lọc không phân biệt hoa/thường và dấu tiếng Việt cho từ khóa.
(function (root) {
  "use strict";

  function fold(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim(); }
  function list(v) { return (Array.isArray(v) ? v : v == null || v === "" ? [] : [v]).map(function (x) { return String(x).trim(); }).filter(Boolean); }
  var CTX = {};
  /** Ngữ cảnh dữ liệu cho các tiêu chí không nằm sẵn trong dòng: { khoiOf(tênPB) → tên khối, formsOf(mãNV) → ["BT","TC"] }. */
  function setContext(c) { CTX = c || {}; }
  function toOf(pb) { return /^Tổ\b/i.test(String(pb || "")) ? String(pb) : ""; }
  function numOrNull(v) { if (v === "" || v == null) return null; var x = +v; return isFinite(x) ? x : null; }

  /** Chuẩn hóa spec nhận từ giao diện/file đã lưu: bỏ khóa lạ, ép kiểu — spec rỗng = không lọc gì. */
  function normalize(spec) {
    spec = spec || {};
    return {
      khoi: list(spec.khoi), phongBan: list(spec.phongBan), to: list(spec.to), hinhThucCong: list(spec.hinhThucCong), maLuong: list(spec.maLuong), httt: list(spec.httt), maNV: list(spec.maNV),
      tuKhoa: String(spec.tuKhoa == null ? "" : spec.tuKhoa).trim(),
      chiCoThuNhap: !!spec.chiCoThuNhap, thucLinhTu: numOrNull(spec.thucLinhTu), thucLinhDen: numOrNull(spec.thucLinhDen)
    };
  }
  function isEmpty(spec) {
    var s = normalize(spec);
    return !s.khoi.length && !s.to.length && !s.hinhThucCong.length && !s.phongBan.length && !s.maLuong.length && !s.httt.length && !s.maNV.length && !s.tuKhoa && !s.chiCoThuNhap && s.thucLinhTu == null && s.thucLinhDen == null;
  }

  /** Dòng bảng lương nằm trong spec không. Mọi điều kiện cùng phải đúng (AND); các giá trị trong 1 danh sách là HOẶC. */
  function matchRow(r, spec) {
    var s = spec;
    if (s.phongBan.length && s.phongBan.indexOf(String(r["Phòng ban"] == null ? "" : r["Phòng ban"])) < 0) return false;
    if (s.khoi.length) { var kh = CTX.khoiOf ? String(CTX.khoiOf(r["Phòng ban"]) || "") : ""; if (s.khoi.indexOf(kh) < 0) return false; }
    if (s.to.length && s.to.indexOf(toOf(r["Phòng ban"])) < 0) return false;
    if (s.hinhThucCong.length) { var fm = CTX.formsOf ? (CTX.formsOf(String(r["Mã NV"])) || []) : []; if (!s.hinhThucCong.some(function (m) { return fm.indexOf(m) >= 0; })) return false; }
    if (s.maLuong.length) { var ml = r._ct && r._ct.maLuong ? String(r._ct.maLuong) : ""; if (s.maLuong.indexOf(ml) < 0 && !s.maLuong.some(function (m) { return ml.split(/\s*,\s*/).indexOf(m) >= 0; })) return false; }
    if (s.httt.length) { var parts = String(r["HTTT"] == null ? "" : r["HTTT"]).split(/\s*,\s*/); if (!s.httt.some(function (m) { return parts.indexOf(m) >= 0; })) return false; }
    if (s.maNV.length && s.maNV.indexOf(String(r["Mã NV"])) < 0) return false;
    if (s.tuKhoa) { var hay = fold(r["Mã NV"] + " " + r["Họ và tên"]); if (hay.indexOf(fold(s.tuKhoa)) < 0) return false; }
    if (s.chiCoThuNhap && !(+r["Tổng thu nhập"] > 0)) return false;
    var tl = +r["Thực lĩnh"] || 0;
    if (s.thucLinhTu != null && tl < s.thucLinhTu) return false;
    if (s.thucLinhDen != null && tl > s.thucLinhDen) return false;
    return true;
  }

  /** @returns { rows, total, kept, removed } — giữ nguyên thứ tự gốc. */
  function apply(rows, spec) {
    var s = normalize(spec), src = rows || [];
    var out = isEmpty(s) ? src.slice() : src.filter(function (r) { return matchRow(r, s); });
    return { rows: out, total: src.length, kept: out.length, removed: src.length - out.length };
  }


  var TOTAL_RE = /^(TỔNG|CẢ NĂM)/i;
  /** Lọc cho bảng báo cáo BẤT KỲ (mảng đối tượng): chỉ áp tiêu chí mà bảng có cột tương ứng; tiêu chí không áp được thì báo lại để người đọc biết.
   *  Dòng tổng (addTotal) bị tách ra — người gọi tính lại tổng sau lọc. @returns { rows, hadTotal, applied[], skipped[], filtered } */
  function applyGeneric(rows, spec) {
    var s = normalize(spec), src = (rows || []).slice(), hadTotal = false;
    if (src.length > 1) { var last = src[src.length - 1], k0 = Object.keys(last)[0]; if (k0 && typeof last[k0] === "string" && TOTAL_RE.test(last[k0])) { hadTotal = true; src.pop(); } }
    var keys = {}; src.forEach(function (r) { Object.keys(r).forEach(function (k) { keys[k] = 1; }); });
    var has = function () { for (var i = 0; i < arguments.length; i++) if (keys[arguments[i]]) return true; return false; };
    var can = { khoi: has("Phòng ban") && !!CTX.khoiOf, to: has("Phòng ban"), hinhThuc: has("Mã NV") && !!CTX.formsOf, phongBan: has("Phòng ban"), httt: has("HTTT", "Hình thức"), maNV: has("Mã NV"), tuKhoa: has("Mã NV", "Họ và tên"), chiCoThuNhap: has("Tổng thu nhập"), thuc: has("Thực lĩnh") };
    var eff = normalize({}), applied = [], skipped = [];
    var use = function (name, ok, set) { if (!set.on) return; if (ok) { set.apply(); applied.push(name); } else skipped.push(name); };
    use("Khối", can.khoi, { on: s.khoi.length, apply: function () { eff.khoi = s.khoi; } });
    use("Tổ", can.to, { on: s.to.length, apply: function () { eff.to = s.to; } });
    use("Hình thức công", can.hinhThuc, { on: s.hinhThucCong.length, apply: function () { eff.hinhThucCong = s.hinhThucCong; } });
    use("Phòng ban", can.phongBan, { on: s.phongBan.length, apply: function () { eff.phongBan = s.phongBan; } });
    use("Mã lương", false, { on: s.maLuong.length });
    use("Thanh toán", can.httt, { on: s.httt.length, apply: function () { eff.httt = s.httt; } });
    use("Mã NV", can.maNV, { on: s.maNV.length, apply: function () { eff.maNV = s.maNV; } });
    use("Từ khóa", can.tuKhoa, { on: !!s.tuKhoa, apply: function () { eff.tuKhoa = s.tuKhoa; } });
    use("Chỉ người có thu nhập", can.chiCoThuNhap, { on: s.chiCoThuNhap, apply: function () { eff.chiCoThuNhap = true; } });
    use("Khoảng thực lĩnh", can.thuc, { on: s.thucLinhTu != null || s.thucLinhDen != null, apply: function () { eff.thucLinhTu = s.thucLinhTu; eff.thucLinhDen = s.thucLinhDen; } });
    if (isEmpty(eff)) return { rows: rows || [], hadTotal: false, applied: applied, skipped: skipped, filtered: false };
    var out = src.filter(function (r) { var v = Object.assign({}, r); if (v["HTTT"] == null && r["Hình thức"] != null) v["HTTT"] = r["Hình thức"]; return matchRow(v, eff); });
    return { rows: out, hadTotal: hadTotal, applied: applied, skipped: skipped, filtered: true };
  }

  /** Các lựa chọn có thật trong dữ liệu để dựng ô chọn (không gợi ý giá trị không tồn tại). */
  function options(rows) {
    var pb = {}, ml = {}, ht = {}, kh = {}, to = {}, nv = {}, hf = {};
    (rows || []).forEach(function (r) {
      pb[r["Phòng ban"] || ""] = 1;
      if (CTX.khoiOf) kh[CTX.khoiOf(r["Phòng ban"]) || ""] = 1;
      to[toOf(r["Phòng ban"])] = 1;
      if (r["Mã NV"] != null) { nv[String(r["Mã NV"])] = (r["Họ và tên"] ? r["Họ và tên"] : ""); if (CTX.formsOf) (CTX.formsOf(String(r["Mã NV"])) || []).forEach(function (m) { hf[m] = 1; }); }
      String(r._ct && r._ct.maLuong || "").split(/\s*,\s*/).filter(Boolean).forEach(function (m) { ml[m] = 1; });
      String(r["HTTT"] || "").split(/\s*,\s*/).filter(Boolean).forEach(function (m) { ht[m] = 1; });
    });
    var k = function (o) { return Object.keys(o).filter(function (x) { return x !== ""; }).sort(); };
    return { khoi: k(kh), phongBan: k(pb), to: k(to), maLuong: k(ml), httt: k(ht), hinhThucCong: k(hf), nhanVien: Object.keys(nv).sort().map(function (m) { return { value: m, label: m + (nv[m] ? " · " + nv[m] : "") }; }) };
  }

  /** Mô tả bộ lọc bằng chữ — in ở đầu báo cáo/PDF/Excel để người đọc biết số liệu đã bị lọc. */
  function describe(spec) {
    var s = normalize(spec), out = [];
    if (s.khoi.length) out.push("Khối: " + s.khoi.join(", "));
    if (s.phongBan.length) out.push("Phòng ban: " + s.phongBan.join(", "));
    if (s.to.length) out.push("Tổ: " + s.to.join(", "));
    if (s.hinhThucCong.length) out.push("Hình thức công: " + s.hinhThucCong.join(", "));
    if (s.maLuong.length) out.push("Mã lương: " + s.maLuong.join(", "));
    if (s.httt.length) out.push("Hình thức thanh toán: " + s.httt.join(", "));
    if (s.maNV.length) out.push("Mã NV: " + s.maNV.join(", "));
    if (s.tuKhoa) out.push("Từ khóa: “" + s.tuKhoa + "”");
    if (s.chiCoThuNhap) out.push("Chỉ người có thu nhập");
    if (s.thucLinhTu != null) out.push("Thực lĩnh ≥ " + s.thucLinhTu);
    if (s.thucLinhDen != null) out.push("Thực lĩnh ≤ " + s.thucLinhDen);
    return out;
  }

  var api = { setContext: setContext, toOf: toOf, normalize: normalize, isEmpty: isEmpty, apply: apply, applyGeneric: applyGeneric, options: options, describe: describe, fold: fold };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.reportFilter = api; }
})(typeof window !== "undefined" ? window : this);
