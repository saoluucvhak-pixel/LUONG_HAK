// V9.2 — Bộ lọc dùng chung cho Chấm công / Sản lượng / Bơm dăm (thuần dữ liệu, không đụng DOM)
// Quy tắc: lọc KHÔNG sửa dữ liệu; tổng tính lại từ đúng các dòng đã lọc; mỗi phiếu cân tính một lần (không cộng trùng).
(function (root) {
  "use strict";
  var NONE = "__NONE__"; // lựa chọn "không có hình thức / không có phòng ban"
  function fold(s) { // không phân biệt hoa thường, dấu tiếng Việt
    return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
  }
  function isoDay(v) { var m = String(v == null ? "" : v).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); return m ? m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2) : ""; }
  function inSet(sel, v) { // sel: mảng giá trị chọn; rỗng/undefined = không lọc
    if (!sel || !sel.length) return true;
    var x = String(v == null ? "" : v).trim();
    if (!x) return sel.indexOf(NONE) >= 0;
    return sel.some(function (s) { return s !== NONE && fold(s) === fold(x); });
  }
  function isEmpty(f) { return !f || !(["tu", "den", "thang", "q"].some(function (k) { return f[k]; }) || ["ht", "pb", "nv", "to"].some(function (k) { return f[k] && f[k].length; })); }

  /** Chấm công: hình thức công (nhiều lựa chọn + "không có hình thức"), nhân viên, từ khóa. rowKeys: {maNV -> {pb,to,ten}} tùy chọn */
  function chamCong(rows, f, ctx) {
    f = f || {}; ctx = ctx || {};
    var q = fold(f.q);
    return rows.filter(function (r) {
      if (!inSet(f.ht, r["Hình thức công"])) return false;
      if (f.nv && f.nv.length && f.nv.indexOf(r["Mã NV"]) < 0) return false;
      var info = (ctx.nv && ctx.nv[r["Mã NV"]]) || {};
      if (!inSet(f.pb, info.pb)) return false;
      if (!inSet(f.to, info.to)) return false;
      if (q && fold(r["Mã NV"] + " " + (info.ten || "")).indexOf(q) < 0) return false;
      return true;
    });
  }

  /** Phiếu cân (Sản lượng / Bơm dăm): phòng ban nhiều lựa chọn, từ ngày–đến ngày (gồm cả hai đầu), tháng YYYY-MM, kỳ lương YYYY-MM, từ khóa.
   *  Từ/đến ngày ưu tiên hơn tháng/kỳ nếu có cả hai (giao của các điều kiện). */
  function phieuCan(rows, f) {
    f = f || {};
    var q = fold(f.q), tu = isoDay(f.tu), den = isoDay(f.den), th = f.thang || f.ky || "";
    return rows.filter(function (r) {
      var d = isoDay(r["Ngày cân"]);
      if (tu && (!d || d < tu)) return false;
      if (den && (!d || d > den)) return false;
      if (th && d.slice(0, 7) !== th) return false;
      if (!inSet(f.pb, r["Mã phòng ban"])) return false;
      if (f.nv && f.nv.length && f.nv.indexOf(r["Mã NV"]) < 0) return false;
      if (q && fold([r["Phiếu cân"], r["Biển số"], r["Mã NV"], r["Mã phòng ban"], r["NV vắng"]].join(" ")).indexOf(q) < 0) return false;
      return true;
    });
  }
  var kl = function (r) { var n = parseFloat(String(r["KL hàng (Tấn)"] == null ? "" : r["KL hàng (Tấn)"]).replace(",", ".")); return isFinite(n) ? n : 0; };
  var r3 = function (x) { return Math.round(x * 1000) / 1000; };
  /** Tổng tính lại từ đúng các dòng đã lọc. Phiếu trùng khóa (Phiếu cân + Mã NV) chỉ tính một lần và được báo riêng.
   *  daPhanBo: tập khóa phiếu đã phân bổ (tùy chọn) để tách "đã phân bổ / chờ phân bổ". */
  function tongPhieuCan(rows, opt) {
    opt = opt || {};
    var seen = {}, out = { soPhieu: 0, tongKL: 0, trung: [], theoNgay: {}, theoPhongBan: {}, daPhanBo: 0, choPhanBo: 0 };
    rows.forEach(function (r) {
      var key = String(r["Phiếu cân"] == null ? "" : r["Phiếu cân"]).trim() + "|" + String(r["Mã NV"] || "").trim();
      if (String(r["Phiếu cân"] || "").trim() && seen[key]) { out.trung.push(String(r["Phiếu cân"])); return; }
      seen[key] = 1;
      var k = kl(r), d = isoDay(r["Ngày cân"]) || "(không ngày)", pb = String(r["Mã phòng ban"] || "").trim() || "(không phòng ban)";
      out.soPhieu++; out.tongKL += k;
      out.theoNgay[d] = r3((out.theoNgay[d] || 0) + k);
      out.theoPhongBan[pb] = r3((out.theoPhongBan[pb] || 0) + k);
      var pbo = opt.daPhanBo ? !!opt.daPhanBo[String(r["Phiếu cân"]).trim()] : (String(r["Mã NV"] || "").trim() || String(r["Mã phòng ban"] || "").trim());
      if (pbo) out.daPhanBo += k; else out.choPhanBo += k;
    });
    out.tongKL = r3(out.tongKL); out.daPhanBo = r3(out.daPhanBo); out.choPhanBo = r3(out.choPhanBo);
    return out;
  }
  var api = { NONE: NONE, fold: fold, isoDay: isoDay, inSet: inSet, isEmpty: isEmpty, chamCong: chamCong, phieuCan: phieuCan, tongPhieuCan: tongPhieuCan };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.lf = api; }
})(typeof self !== "undefined" ? self : this);
