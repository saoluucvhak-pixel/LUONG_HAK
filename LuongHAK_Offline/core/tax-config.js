// ===== CORE / TAX-CONFIG — kiểm tra cấu hình thuế TNCN cha–con (V9.2 mục III) =====
// DM_TNCN (dm_tncn: 1 dòng/mã/phiên bản) → DM_TNCN_BIEUTHUE (dm_bacthue: nhiều bậc). Chỉ ĐỌC + báo lỗi; không tự sửa.
(function (root) {
  "use strict";
  var PP = ["LUY_TIEN", "LUY_TIEN_TRU_NHANH", "VANG_LAI", "MIEN"], TT = ["Nháp", "Hiệu lực", "Ngừng"];
  function s(v) { return v == null ? "" : String(v).trim(); }
  function n(v) { if (v === "" || v == null) return NaN; var x = Number(String(v).replace(/[.\s]/g, "").replace(",", ".")); return x; }
  function pctv(v) { var x = Number(String(v).replace("%", "").replace(",", ".")); if (!isFinite(x)) return NaN; return String(v).indexOf("%") >= 0 ? x / 100 : x; }
  function chaRows(db) { return (db.dm_tncn || []).filter(function (r) { return r["Mã thuế TNCN"] && (r["Bậc"] === "" || r["Bậc"] == null); }); }
  function conRows(db) { return (db.dm_bacthue || []).concat((db.dm_tncn || []).filter(function (r) { return r["Bậc"] !== "" && r["Bậc"] != null; })); }
  /** Nhóm bậc con theo (Mã thuế, Hiệu lực từ) = một "bộ biểu thuế" của một phiên bản. */
  function bo(db) {
    var g = {};
    conRows(db).forEach(function (r) { var k = s(r["Mã thuế TNCN"]) + "|" + s(r["Hiệu lực từ"]) + "|" + s(r["Hiệu lực đến"]); (g[k] = g[k] || []).push(r); });
    return g;
  }
  /** Kiểm tra cấu hình: trả [{level, area, msg}] */
  function check(db) {
    var out = [], add = function (level, msg) { out.push({ level: level, area: "dm_tncn", msg: msg }); };
    var cha = chaRows(db), codes = {};
    cha.forEach(function (r) {
      var ma = s(r["Mã thuế TNCN"]); (codes[ma] = codes[ma] || []).push(r);
      var pp = s(r["Phương pháp"]).toUpperCase(), tt = s(r["Trạng thái"]);
      if (pp && PP.indexOf(pp) < 0) add("High", "Mã thuế " + ma + ": Phương pháp '" + r["Phương pháp"] + "' không hợp lệ (" + PP.join("/") + ")");
      if (tt && TT.indexOf(tt) < 0) add("Low", "Mã thuế " + ma + ": Trạng thái '" + tt + "' không thuộc " + TT.join("/"));
      if (s(r["Hiệu lực từ"]) && s(r["Hiệu lực đến"]) && s(r["Hiệu lực đến"]) < s(r["Hiệu lực từ"])) add("High", "Mã thuế " + ma + ": Hiệu lực đến trước Hiệu lực từ");
    });
    // 2 phiên bản cùng mã chồng khoảng hiệu lực → kết quả mơ hồ
    Object.keys(codes).forEach(function (ma) {
      var L = codes[ma].filter(function (r) { return !/^nh[áa]p/i.test(s(r["Trạng thái"])); });
      for (var i = 0; i < L.length; i++) for (var j = i + 1; j < L.length; j++) {
        var a = L[i], b = L[j], aT = s(a["Hiệu lực từ"]), aD = s(a["Hiệu lực đến"]), bT = s(b["Hiệu lực từ"]), bD = s(b["Hiệu lực đến"]);
        if (aT === bT) add("High", "Mã thuế " + ma + ": 2 phiên bản cùng Hiệu lực từ " + aT);
        else if ((!aD || !bT || aD >= bT) && (!bD || !aT || bD >= aT) && aD && bD) add("Medium", "Mã thuế " + ma + ": 2 phiên bản chồng khoảng hiệu lực");
      }
    });
    // bảng con
    var bacCoMa = conRows(db).some(function (r) { return s(r["Mã thuế TNCN"]); });
    var g = bo(db);
    Object.keys(g).forEach(function (k) {
      var L = g[k].filter(function (r) { return !/^nh[áa]p/i.test(s(r["Trạng thái"])) && !/^ng[ừu]ng/i.test(s(r["Trạng thái"])); }), ma = s(g[k][0]["Mã thuế TNCN"]), nhan = (ma || "(chung)") + " từ " + (s(g[k][0]["Hiệu lực từ"]) || "?");
      if (ma && !codes[ma]) add("High", "Biểu thuế " + nhan + ": mã thuế '" + ma + "' không có ở bảng cha DM_TNCN");
      if (ma && codes[ma]) {
        var pc = codes[ma][0], pp = s(pc["Phương pháp"]).toUpperCase();
        if (pp === "LUY_TIEN" && L.some(function (r) { return n(r["Trừ nhanh"]) > 0; })) add("High", "Biểu thuế " + nhan + ": có 'Trừ nhanh' nhưng phương pháp LUY_TIEN (từng phần) không dùng trừ nhanh");
        if (pp === "VANG_LAI" || pp === "MIEN") add("Low", "Biểu thuế " + nhan + ": phương pháp " + pp + " không dùng bảng bậc — dòng này bị bỏ qua");
      }
      var rows = L.map(function (r) { return { bac: n(r["Bậc"]), tu: n(r["Thu nhập từ"]), den: (r["Thu nhập đến"] === "" || r["Thu nhập đến"] == null || n(r["Thu nhập đến"]) === 0) ? Infinity : n(r["Thu nhập đến"]), tl: pctv(r["Tỷ lệ"]) }; })
        .sort(function (a, b) { return a.tu - b.tu; });
      rows.forEach(function (r) {
        if (!isFinite(r.tu) || r.tu < 0) add("High", "Biểu thuế " + nhan + ": bậc " + r.bac + " 'Thu nhập từ' không hợp lệ");
        if (!isFinite(r.tl) || r.tl < 0 || r.tl > 1) add("High", "Biểu thuế " + nhan + ": bậc " + r.bac + " 'Tỷ lệ' phải trong khoảng 0–100%");
        if (r.den <= r.tu) add("High", "Biểu thuế " + nhan + ": bậc " + r.bac + " 'Thu nhập đến' ≤ 'Thu nhập từ'");
      });
      for (var i = 1; i < rows.length; i++) {
        if (rows[i].tu < rows[i - 1].den && isFinite(rows[i - 1].den)) add("High", "Biểu thuế " + nhan + ": bậc " + rows[i - 1].bac + " và " + rows[i].bac + " CHỒNG khoảng thu nhập");
        else if (rows[i].tu > rows[i - 1].den && isFinite(rows[i - 1].den)) add("Medium", "Biểu thuế " + nhan + ": HỞ khoảng thu nhập giữa bậc " + rows[i - 1].bac + " và " + rows[i].bac);
        if (!isFinite(rows[i - 1].den)) add("High", "Biểu thuế " + nhan + ": bậc " + rows[i - 1].bac + " không giới hạn nhưng còn bậc cao hơn");
      }
      if (rows.length && rows[0].tu > 0) add("Medium", "Biểu thuế " + nhan + ": bậc đầu bắt đầu từ " + rows[0].tu + " (không phải 0) — thu nhập thấp hơn sẽ không bị tính thuế");
      if (rows.length && isFinite(rows[rows.length - 1].den)) add("Medium", "Biểu thuế " + nhan + ": bậc cuối có giới hạn trên — thu nhập vượt mức sẽ không được tính phần vượt");
    });
    // mã lũy tiến nhưng không có biểu nào
    Object.keys(codes).forEach(function (ma) {
      var pc = codes[ma][codes[ma].length - 1], pp = s(pc["Phương pháp"]).toUpperCase(), nd = s(pc["Nội dung"]);
      var lt = pp ? pp.indexOf("LUY_TIEN") === 0 : /l[ũu]y ti[ếe]n|luỹ tiến/i.test(nd);
      if (!lt) return;
      var coBieu = conRows(db).some(function (r) { return !bacCoMa || !s(r["Mã thuế TNCN"]) || s(r["Mã thuế TNCN"]) === ma; });
      if (!coBieu) add("High", "Mã thuế " + ma + " là lũy tiến nhưng chưa có dòng nào ở biểu thuế (DM_TNCN_BIEUTHUE)");
    });
    return out;
  }
  var api = { PHUONG_PHAP: PP, check: check, chaRows: chaRows, conRows: conRows };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.taxcfg = api; }
})(typeof window !== "undefined" ? window : this);
