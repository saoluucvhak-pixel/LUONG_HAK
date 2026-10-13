// ===== CORE / DEPENDENTS — người phụ thuộc (V9.2 mục IV) =====
// Quy tắc: một người chỉ được tính giảm trừ ở tháng thuộc khoảng giảm trừ hợp lệ, đã đăng ký, không bị ngừng; không đếm trùng.
// CCCD / MST luôn là CHỮ (giữ số 0 đầu). Không tự suy ra / tự tạo số định danh, ngày cấp.
(function (root) {
  "use strict";
  var F = { ten: "Họ tên nhân thân", cccd: "Số CCCD nhân thân", cap: "Ngày cấp CCCD", gt: "Giới tính", mst: "Mã số thuế", sinh: "Ngày sinh", dc: "Địa chỉ", dk: "Đăng ký phụ thuộc",
    tu: "Giảm trừ từ tháng", den: "Giảm trừ đến tháng", hlTu: "Hiệu lực từ", hlDen: "Hiệu lực đến", tt: "Trạng thái đăng ký" };
  var TRANG_THAI = ["Đã đăng ký", "Chờ đăng ký", "Ngừng giảm trừ"];
  function s(v) { return v == null ? "" : String(v).trim(); }
  function ym(v) { var m = s(v).match(/^(\d{4})-(\d{1,2})/); return m ? m[1] + "-" + ("0" + m[2]).slice(-2) : ""; }
  function kyOf(nam, thang) { return nam + "-" + ("0" + thang).slice(-2); }
  /** Khoảng tháng giảm trừ {tu, den} (YYYY-MM, "" = mở). Có "Giảm trừ từ tháng" thì dùng, không thì suy từ Hiệu lực từ/đến (giữ đúng số liệu cũ). */
  function range(r) {
    var tu = ym(r[F.tu]), den = ym(r[F.den]);
    if (!tu && !s(r[F.tu])) tu = ym(r[F.hlTu]);
    if (!den && !s(r[F.den])) den = ym(r[F.hlDen]);
    return { tu: tu, den: den };
  }
  /** Người này có được giảm trừ trong kỳ ky ("YYYY-MM") không. */
  function dangGiamTru(r, ky) {
    if (s(r[F.dk]) !== "Có") return false;
    var tt = s(r[F.tt]); if (tt === "Chờ đăng ký" || tt === "Ngừng giảm trừ") return false;
    var g = range(r); return (!g.tu || g.tu <= ky) && (!g.den || g.den >= ky);
  }
  /** Danh sách NPT được giảm trừ của nhân viên ma trong kỳ ky, KHÔNG đếm trùng cùng 1 người (cùng CCCD / MST / họ tên + ngày sinh). */
  function danhSach(rows, ky) {
    var seen = {}, out = [];
    (rows || []).forEach(function (r) {
      if (!dangGiamTru(r, ky)) return;
      var key = s(r[F.cccd]) ? "c:" + s(r[F.cccd]) : (s(r[F.mst]) ? "m:" + s(r[F.mst]) : "n:" + s(r[F.ten]).toLowerCase() + "|" + s(r[F.sinh]));
      if (seen[key]) return; seen[key] = 1; out.push(r);
    });
    return out;
  }
  function isDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(s(v)) && !isNaN(new Date(s(v)).getTime()); }
  /** Kiểm tra dữ liệu 1 dòng NPT → [{level, msg}] (không tự sửa, không tự suy đoán). */
  function checkRow(r, today) {
    var out = [], ten = s(r[F.ten]) || "(chưa có tên)";
    var add = function (level, msg) { out.push({ level: level, msg: ten + ": " + msg }); };
    var c = s(r[F.cccd]), m = s(r[F.mst]);
    if (c && !/^\d{9}$|^\d{12}$/.test(c)) add("Medium", "Số CCCD/CMND '" + c + "' không đúng dạng 9 hoặc 12 chữ số");
    if (m && !/^\d{10}$|^\d{10}-\d{3}$|^\d{13}$/.test(m)) add("Medium", "Mã số thuế '" + m + "' không đúng dạng 10 hoặc 13 chữ số");
    ["cap", "sinh"].forEach(function (k) { if (s(r[F[k]]) && !isDate(r[F[k]])) add("Medium", F[k] + " '" + r[F[k]] + "' không phải ngày hợp lệ"); });
    if (isDate(r[F.cap]) && isDate(r[F.sinh]) && s(r[F.cap]) < s(r[F.sinh])) add("Medium", "Ngày cấp CCCD trước ngày sinh");
    if (today && isDate(r[F.cap]) && s(r[F.cap]) > today) add("Medium", "Ngày cấp CCCD ở tương lai");
    if (s(r[F.gt]) && ["Nam", "Nữ", "Khác"].indexOf(s(r[F.gt])) < 0) add("Low", "Giới tính '" + r[F.gt] + "' không thuộc Nam/Nữ/Khác");
    ["tu", "den"].forEach(function (k) { if (s(r[F[k]]) && !/^\d{4}-\d{2}$/.test(s(r[F[k]]))) add("Medium", F[k] + " '" + r[F[k]] + "' không đúng dạng YYYY-MM"); });
    var g = range(r); if (g.tu && g.den && g.den < g.tu) add("High", "tháng kết thúc giảm trừ (" + g.den + ") trước tháng bắt đầu (" + g.tu + ")");
    if (s(r[F.tt]) && TRANG_THAI.indexOf(s(r[F.tt])) < 0) add("Low", "Trạng thái '" + r[F.tt] + "' không thuộc " + TRANG_THAI.join("/"));
    if (s(r[F.dk]) === "Có" && !s(r[F.cccd]) && !s(r[F.sinh])) add("Low", "đăng ký phụ thuộc nhưng chưa có CCCD và chưa có ngày sinh — khó chứng minh khi quyết toán");
    return out;
  }
  function overlap(a, b) { return (!a.den || !b.tu || a.den >= b.tu) && (!b.den || !a.tu || b.den >= a.tu); }
  /** Kiểm tra toàn bộ: dữ liệu từng dòng + trùng/chồng kỳ giảm trừ. Cùng 1 người ghi 2 lần chồng kỳ, hoặc cùng CCCD/MST được 2 nhân viên cùng giảm trừ 1 kỳ. */
  function check(db, today) {
    var rows = db.nhanthan || [], out = [];
    rows.forEach(function (r) { checkRow(r, today).forEach(function (x) { out.push({ level: x.level, area: "nhanthan", msg: "[" + s(r["Mã NV"]) + "] " + x.msg }); }); });
    var byId = {};
    rows.forEach(function (r, i) {
      if (s(r[F.dk]) !== "Có" || s(r[F.tt]) === "Ngừng giảm trừ") return;
      var id = s(r[F.cccd]) ? "c:" + s(r[F.cccd]) : (s(r[F.mst]) ? "m:" + s(r[F.mst]) : "");
      if (!id) return; (byId[id] = byId[id] || []).push({ r: r, i: i });
    });
    Object.keys(byId).forEach(function (id) {
      var L = byId[id];
      for (var a = 0; a < L.length; a++) for (var b = a + 1; b < L.length; b++) {
        if (!overlap(range(L[a].r), range(L[b].r))) continue;
        var same = s(L[a].r["Mã NV"]) === s(L[b].r["Mã NV"]);
        out.push({ level: "High", area: "nhanthan", msg: (same ? "Đăng ký trùng/chồng kỳ giảm trừ" : "Cùng 1 người phụ thuộc được 2 nhân viên cùng giảm trừ ở cùng kỳ") + ": " + s(L[a].r[F.ten]) + " (" + id.slice(2) + ") — [" + s(L[a].r["Mã NV"]) + "] và [" + s(L[b].r["Mã NV"]) + "]" });
      }
    });
    return out;
  }
  var api = { F: F, TRANG_THAI: TRANG_THAI, range: range, dangGiamTru: dangGiamTru, danhSach: danhSach, checkRow: checkRow, check: check, kyOf: kyOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.dep = api; }
})(typeof window !== "undefined" ? window : this);
