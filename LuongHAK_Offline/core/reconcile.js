// ===== ĐỐI CHIẾU LƯƠNG POWER QUERY (Master Prompt V3 mục XVII) =====
// Import 1 bảng lương Excel đã xác nhận (của công ty/công cụ cũ) → so với kết quả app, theo từng
// nhân viên, từng chỉ tiêu. Chỉ ĐỌC — không sửa dữ liệu, không tính lại bảng lương.
(function (root) {
  "use strict";
  function fold(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function num(v) {
    if (v === "" || v == null) return null;
    if (typeof v === "number") return v;
    var s = String(v).trim().replace(/\s/g, ""); if (!s) return null;
    if (/,\d{1,2}$/.test(s) && !/\.\d{3}/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
    var n = parseFloat(s); return isNaN(n) ? null : n;
  }

  // Chỉ tiêu đối chiếu chính (mục XVII) — "aliases" = các tên cột đã gặp trong Excel thật các công ty
  // (RP_THBL, RP_THCHAMCONG...) hoặc tên trong chính Master Prompt; "app" = cách lấy giá trị App
  // tương ứng từ 1 dòng bangluong (đã có "_ct" — xem engine.js).
  var CHI_TIEU = [
    { key: "congBT", ten: "Công BT", aliases: ["cong bt", "cong hang ngay"], laTien: false, app: function (r) { return (r._ct || {}).congBT; } },
    { key: "congChuan", ten: "Công chuẩn", aliases: ["cong chuan"], laTien: false, app: function (r) { return r["Công chuẩn"]; } },
    { key: "congTinhTG", ten: "Công tính TG", aliases: ["cong tinh tg", "cong tinh ltg"], laTien: false, app: function (r) { return (r._ct || {}).congTinhTG; } },
    { key: "tienTangCa", ten: "Tiền tăng ca", aliases: ["tien tang ca", "luong tang ca"], laTien: true, app: function (r) { return r["Tiền tăng ca"]; } },
    { key: "phuCapCT", ten: "Phụ cấp công tác", aliases: ["phu cap ct", "phu cap cong tac"], laTien: true, app: function (r) { return r["Phụ cấp công tác"]; } },
    { key: "slPhanBo", ten: "SL phân bổ", aliases: ["sl phan bo", "san luong tan", "san luong"], laTien: false, app: function (r) { return r["Sản lượng (tấn)"]; } },
    { key: "luongSL", ten: "Lương SL", aliases: ["luong sl", "luong san luong"], laTien: true, app: function (r) { return r["Lương sản lượng"]; } },
    { key: "tienBu", ten: "Tiền bù", aliases: ["tien bu", "bu luong", "luong bu sl"], laTien: true, app: function (r) { return r["Lương bù SL"]; } },
    { key: "bh", ten: "BH", aliases: ["bh", "bao hiem", "bh tru nld"], laTien: true, app: function (r) { return r["BH trừ NLĐ"]; } },
    { key: "thue", ten: "Thuế", aliases: ["thue", "khau tru thue tncn", "thue tncn"], laTien: true, app: function (r) { return r["Thuế TNCN"]; } },
    { key: "tongThuNhap", ten: "Tổng thu nhập", aliases: ["tong thu nhap"], laTien: true, app: function (r) { return r["Tổng thu nhập"]; } },
    { key: "thucLinh", ten: "Thực lĩnh", aliases: ["thuc linh", "thu nhap con lai"], laTien: true, app: function (r) { return r["Thực lĩnh"]; } }
  ];
  // Riêng tăng ca — đối chiếu chi tiết hơn (mục XVII, "Riêng tăng ca phải đối chiếu")
  var CHI_TIEU_TANGCA = [
    { key: "maTangCa", ten: "Mã tăng ca", aliases: ["ma tang ca"], soSanh: false, app: function (r) { return (r._ct || {}).maTangCa; } },
    { key: "heSoTangCa", ten: "Hệ số", aliases: ["he so", "he so tang ca"], laTien: false, app: function (r) { return (r._ct || {}).heSoTangCa; } },
    { key: "congChuan2", ten: "Công chuẩn 2", aliases: ["cong chuan 2"], laTien: false, app: function (r) { return (r._ct || {}).congChuan2 || null; } },
    { key: "congTC", ten: "Công TC", aliases: ["cong tc", "cong tang ca"], laTien: false, app: function (r) { return r["Công tăng ca"]; } },
    { key: "congTCQuyDoi", ten: "Công TC quy đổi", aliases: ["cong tc quy doi", "cong tinh tang ca"], laTien: false, app: function (r) { return (r._ct || {}).congTangCaQuyDoi; } },
    { key: "tienTangCa", ten: "Tiền tăng ca", aliases: ["tien tang ca"], laTien: true, app: function (r) { return r["Tiền tăng ca"]; } }
  ];
  var MA_NV_HDR = ["ma nv", "ma nhan vien"], HO_TEN_HDR = ["ho va ten", "ho ten"];

  /**
   * Tự nhận header row + mapping cột từ 1 sheet thô (2D array, dòng đầu có thể là tiêu đề báo cáo —
   * quét tối đa 15 dòng đầu tìm dòng có cột "Mã NV" hoặc "Họ và tên"). rows2D: mảng mảng (mỗi ô 1 giá
   * trị), ví dụ từ XLSX.utils.sheet_to_json(ws, {header:1}).
   */
  function parseSheet(rows2D, extraChiTieu) {
    var ct = (extraChiTieu || CHI_TIEU);
    var headerIdx = -1, cols = null;
    for (var i = 0; i < Math.min(15, rows2D.length); i++) {
      var row = rows2D[i] || [], folded = row.map(function (c) { return fold(c); });
      if (folded.some(function (c) { return MA_NV_HDR.indexOf(c) >= 0; }) || folded.some(function (c) { return HO_TEN_HDR.indexOf(c) >= 0; })) { headerIdx = i; cols = folded; break; }
    }
    if (headerIdx < 0) return { rows: [], matched: [], unmatched: [], headerRow: -1, error: "Không tìm thấy dòng tiêu đề (cần có cột 'Mã NV' hoặc 'Họ và tên')" };
    var iMa = cols.findIndex(function (c) { return MA_NV_HDR.indexOf(c) >= 0; });
    var iHo = cols.findIndex(function (c) { return HO_TEN_HDR.indexOf(c) >= 0; });
    var map = {}, matched = [], unmatched = [];
    cols.forEach(function (c, ci) {
      if (ci === iMa || ci === iHo || !c) return;
      var hit = ct.find(function (tc) { return !map[tc.key] && tc.aliases.indexOf(c) >= 0; });
      if (hit) { map[hit.key] = ci; matched.push(hit.ten); } else unmatched.push(c);
    });
    var rows = [];
    for (var r = headerIdx + 1; r < rows2D.length; r++) {
      var rr = rows2D[r] || []; if (!rr.length) continue;
      var ma = iMa >= 0 ? String(rr[iMa] || "").trim() : "", hoTen = iHo >= 0 ? String(rr[iHo] || "").trim() : "";
      if (!ma && !hoTen) continue;
      var values = {};
      Object.keys(map).forEach(function (key) { values[key] = num(rr[map[key]]); });
      rows.push({ ma: ma, hoTen: hoTen, values: values });
    }
    return { rows: rows, matched: matched, unmatched: unmatched, headerRow: headerIdx };
  }

  /** Phân loại 1 chênh lệch (heuristic — không khẳng định tuyệt đối, chỉ gợi ý hướng kiểm tra). */
  function classify(tieuChi, laTien, chenhLech) {
    var abs = Math.abs(chenhLech);
    if (laTien ? abs <= 1 : abs <= 0.01) return "Khác làm tròn";
    if (/^(Công BT|Công chuẩn|Công tính TG)$/.test(tieuChi)) return "Khác chấm công";
    if (tieuChi === "SL phân bổ") return "Khác sản lượng (phân bổ / NV vắng)";
    if (tieuChi === "Tiền tăng ca" || tieuChi === "Công TC quy đổi") return "Khác công thức tăng ca";
    if (tieuChi === "Tiền bù") return "Khác công thức bù lương (xem sheet \"Bu luong theo ngay - DH\" nếu Đại Hiệp)";
    if (tieuChi === "BH" || tieuChi === "Thuế") return "Khác danh mục (bảo hiểm/thuế) hoặc ngày hiệu lực";
    if (tieuChi === "Tổng thu nhập" || tieuChi === "Thực lĩnh") return "Khác do cộng dồn từ chỉ tiêu khác (xem các dòng lệch khác của người này)";
    return "Khác công thức/danh mục — cần kiểm tra thủ công";
  }

  /**
   * So appRows (kq.bangluong của app) với refRows (đã parseSheet từ Excel tham chiếu).
   * Khớp theo Mã NV trước; nếu ref không có Mã NV thì khớp theo Họ và tên đã chuẩn hóa (fold), chỉ khi
   * khớp DUY NHẤT (trùng tên nhiều người → không tự đoán, báo "Không khớp được người").
   */
  function compare(appRows, refRows, extraChiTieu) {
    var ct = extraChiTieu || CHI_TIEU;
    var byMa = {}, byTen = {};
    appRows.forEach(function (r) {
      if (r["Mã NV"]) byMa[r["Mã NV"]] = r;
      var k = fold(r["Họ và tên"]); (byTen[k] = byTen[k] || []).push(r);
    });
    var out = [], khongKhop = [];
    refRows.forEach(function (rf) {
      var app = rf.ma && byMa[rf.ma] ? byMa[rf.ma] : null;
      if (!app && rf.hoTen) { var cands = byTen[fold(rf.hoTen)] || []; if (cands.length === 1) app = cands[0]; }
      if (!app) { khongKhop.push({ ma: rf.ma, hoTen: rf.hoTen }); return; }
      ct.forEach(function (tc) {
        if (tc.soSanh === false) return;
        var ev = rf.values[tc.key]; if (ev == null) return;
        var av = tc.app(app); if (av == null) av = 0;
        var chenhLech = Math.round((av - ev) * 1000) / 1000;
        out.push({
          "Mã NV": app["Mã NV"], "Họ và tên": app["Họ và tên"], "Chỉ tiêu": tc.ten,
          "Excel": ev, "App": av, "Chênh lệch": chenhLech,
          "Loại lệch": chenhLech === 0 ? "" : classify(tc.ten, tc.laTien, chenhLech)
        });
      });
    });
    return { rows: out, khongKhop: khongKhop };
  }

  var api = { CHI_TIEU: CHI_TIEU, CHI_TIEU_TANGCA: CHI_TIEU_TANGCA, parseSheet: parseSheet, compare: compare, classify: classify, fold: fold };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.reconcile = api; }
})(typeof window !== "undefined" ? window : this);
