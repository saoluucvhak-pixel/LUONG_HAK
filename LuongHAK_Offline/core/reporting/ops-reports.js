// ===== CORE / REPORTING / OPS-REPORTS — mẫu báo cáo riêng cho 6 loại (V10.1 bổ sung) =====
// Nhân sự · Sản lượng · Bơm dăm · Thưởng/Trừ · Tạm ứng · Suất cơm.
// View-model thuần (không đụng DOM, không ghi dữ liệu): cùng một vm cho màn hình, Excel (ui/report-xlsx.js) và PDF (core/reporting/report-html.js).
// Mỗi loại có tiêu đề IN HOA, cột, nhóm cột, dòng tổng, khối chữ ký và (nếu cần) bảng tổng hợp phụ riêng — không dùng chung một mẫu bảng chung.
//  loi      — lỗi dữ liệu làm báo cáo sai (Mã NV không có hồ sơ, số tiền/khối lượng âm hoặc không phải số, ngày sai) → chặn XUẤT chính thức
//  canhbao  — bất thường cần xem (phiếu chưa gán người, trùng chứng từ, lệch với bảng lương…) → chỉ báo
// Số đọc bằng cùng hàm num() của engine (opt.num) và lọc kỳ theo cùng quy tắc "YYYY-MM-DD" của engine → khớp với số tính lương.
(function (root) {
  "use strict";
  var isNode = typeof module !== "undefined" && module.exports;

  var TYPES = {
    NHAN_SU: { title: "DANH SÁCH NHÂN SỰ", file: "DanhSachNhanSu", perm: "hr.view", donVi: "Người", theoKy: false, chuKy: ["Người lập", "Trưởng phòng nhân sự", "Giám đốc"] },
    SAN_LUONG: { title: "BẢNG KÊ PHIẾU CÂN SẢN LƯỢNG", file: "BangKeSanLuong", perm: "input.view", donVi: "Tấn", theoKy: true, chuKy: ["Người lập", "Nhân viên cân", "Trưởng bộ phận", "Giám đốc"] },
    BOM_DAM: { title: "BẢNG KÊ BƠM DĂM", file: "BangKeBomDam", perm: "input.view", donVi: "Số xe", theoKy: true, chuKy: ["Người lập", "Nhân viên cân", "Trưởng bộ phận", "Giám đốc"] },
    THUONG: { title: "BẢNG KÊ THƯỞNG VÀ CÁC KHOẢN THU NHẬP, KHẤU TRỪ KHÁC", file: "BangKeThuong", perm: "payroll.view", donVi: "Đồng (VND)", theoKy: true, chuKy: ["Người lập", "Kế toán trưởng", "Giám đốc"] },
    TAM_UNG: { title: "BẢNG KÊ TẠM ỨNG LƯƠNG", file: "BangKeTamUng", perm: "payroll.view", donVi: "Đồng (VND)", theoKy: true, chuKy: ["Người lập", "Kế toán trưởng", "Thủ quỹ", "Giám đốc"] },
    SUAT_COM: { title: "BẢNG TỔNG HỢP SUẤT CƠM", file: "TongHopSuatCom", perm: "input.view", donVi: "Suất", theoKy: true, chuKy: ["Người lập", "Người chấm cơm", "Trưởng bộ phận", "Giám đốc"] }
  };
  var NGUONG_SUAT_NGAY = 3; // tham khảo — truyền opt.nguongSuatNgay để đổi

  function s(v) { return v == null ? "" : String(v).trim(); }
  function fold(t) { return String(t == null ? "" : t).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim(); }
  function upper(t) { return String(t || "").toLocaleUpperCase("vi-VN"); }
  function r3(x) { return Math.round(x * 1000) / 1000; }
  function r0(x) { return Math.round(x); }
  /** Dự phòng khi không truyền opt.num — cùng quy tắc với engine.num (dấu cuối là dấu thập phân). */
  function numFallback(v) {
    if (v === "" || v == null) return 0; if (typeof v === "number") return isFinite(v) ? v : NaN;
    var t = String(v).trim().replace(/\s/g, ""); if (!t) return 0;
    var dots = (t.match(/\./g) || []).length, commas = (t.match(/,/g) || []).length;
    if (dots && commas) { var dec = t.lastIndexOf(".") > t.lastIndexOf(",") ? "." : ","; t = dec === "." ? t.replace(/,/g, "") : t.replace(/\./g, "").replace(",", "."); }
    else if (commas > 1 || dots > 1) t = t.replace(/[.,]/g, "");
    else if (commas === 1) t = t.replace(",", ".");
    var x = Number(t); return isFinite(x) ? x : NaN;
  }
  /** Số TIỀN kiểu Việt Nam: "500.000" = 500000 (dấu chấm hàng nghìn) — cùng quy tắc engine.money. */
  function moneyFallback(v) {
    if (v === "" || v == null) return 0; if (typeof v === "number") return isFinite(v) ? v : NaN;
    var t = String(v).trim().replace(/\s|đ|VNĐ|VND/gi, ""), neg = /^-/.test(t); if (neg) t = t.slice(1);
    var n;
    if (/^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(t)) n = parseFloat(t.replace(/\./g, "").replace(",", "."));
    else if (/^[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/.test(t)) n = parseFloat(t.replace(/,/g, ""));
    else n = numFallback(t);
    return neg ? -n : n;
  }
  /** Ô có thật sự là số không (engine.num/money trả 0 cho chữ nên phải kiểm trước để không âm thầm coi "abc" là 0). */
  function isNumeric(v) { if (v === "" || v == null) return true; if (typeof v === "number") return isFinite(v); return /^[-+]?\s*\d[\d.,\s]*(đ|vnđ|vnd)?$/i.test(String(v).trim()); }
  /** "YYYY-MM-DD…" → {y,m,d} hoặc null (đúng như engine.ky). */
  function ymd(v) { var m = String(v == null ? "" : v).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; }
  function kyLabel(nam, thang) { return ("0" + thang).slice(-2) + "/" + nam; }
  function soNgayThang(nam, thang) { return new Date(nam, thang, 0).getDate(); }
  function lastDay(nam, thang) { return nam + "-" + ("0" + thang).slice(-2) + "-" + ("0" + soNgayThang(nam, thang)).slice(-2); }
  function ddmmyyyy(v) { var k = ymd(v); return k ? ("0" + k.d).slice(-2) + "/" + ("0" + k.m).slice(-2) + "/" + k.y : s(v); }

  function mkCols(arr) { return arr.map(function (c) { return { key: c[0], label: c[0], kind: c[1] }; }); }
  function spans(groups) { var i = 0; return groups.map(function (g) { var from = i; i += g.n; return { label: g.label, from: from, to: i - 1 }; }); }
  function sumTong(cols, rows, keys) { var t = {}; cols.forEach(function (c) { if (!keys || keys.indexOf(c.key) >= 0) { if (c.kind === "money") t[c.key] = r0(rows.reduce(function (a, r) { return a + (+r[c.key] || 0); }, 0)); else if (c.kind === "qty" || c.kind === "qty3") t[c.key] = r3(rows.reduce(function (a, r) { return a + (+r[c.key] || 0); }, 0)); } }); return t; }

  /** Ngữ cảnh chung: tên NV, phòng ban theo ngày cuối kỳ, bộ lọc phòng ban / từ khóa. */
  function context(db, opt) {
    var name = {}, has = {}; (db.nhanvien || []).forEach(function (n) { if (n && n["Mã NV"] != null) { has[s(n["Mã NV"])] = 1; name[s(n["Mã NV"])] = s(n["Họ và tên"]); } });
    var HR = opt.hr || null, ix = HR && HR.buildIndex ? HR.buildIndex(db) : null, asOf = opt.nam ? lastDay(opt.nam, opt.thang) : null, cache = {};
    function pb(ma) {
      ma = s(ma); if (ma in cache) return cache[ma];
      var v = ""; if (HR && has[ma]) { try { v = s(HR.hienHanh(db, ma, asOf, ix).tenPB); } catch (e) { v = ""; } }
      return (cache[ma] = v);
    }
    var kw = fold(opt.tuKhoa), pbf = s(opt.phongBan);
    return {
      qty: function (v) { return isNumeric(v) ? (opt.num || numFallback)(v) : NaN; }, money: function (v) { return isNumeric(v) ? (opt.money || moneyFallback)(v) : NaN; }, name: function (ma) { return name[s(ma)] || ""; }, has: function (ma) { return !!has[s(ma)]; }, pb: pb,
      pass: function (ma, pbName, extra) {
        if (pbf && (pbName != null ? s(pbName) : pb(ma)) !== pbf) return false;
        if (!kw) return true; return fold([ma, name[s(ma)], pbName != null ? pbName : pb(ma), extra].join(" ")).indexOf(kw) >= 0;
      },
      refPB: function (code) { try { return HR && HR.refName ? s(HR.refName(db, "dm_phongban", code)) : ""; } catch (e) { return ""; } },
      loc: function () { var l = []; if (pbf) l.push("Phòng ban: " + pbf); if (s(opt.tuKhoa)) l.push("Từ khóa: " + s(opt.tuKhoa)); return l; }
    };
  }

  function sortBy(rows, f) { return rows.slice().sort(function (a, b) { var x = f(a), y = f(b); return x < y ? -1 : x > y ? 1 : 0; }); }

  // ---------- NHÂN SỰ ----------
  function buildNhanSu(db, opt, cx, out) {
    var HR = opt.hr, ix = HR && HR.buildIndex ? HR.buildIndex(db) : null, today = opt.homNay || (HR && HR.today ? HR.today() : "");
    var cols = mkCols([["STT", "qty"], ["Mã NV", "text"], ["Họ và tên", "text"], ["Giới tính", "text"], ["Ngày sinh", "text"], ["Phòng ban", "text"], ["Chức vụ", "text"], ["Vị trí việc làm", "text"],
      ["Số HĐLĐ", "text"], ["Hình thức HĐLĐ", "text"], ["Ngày vào làm", "text"], ["Ngày hết hạn", "text"], ["Trạng thái", "text"]]);
    var groups = spans([{ label: "NHÂN VIÊN", n: 5 }, { label: "CÔNG VIỆC", n: 3 }, { label: "HỢP ĐỒNG LAO ĐỘNG", n: 4 }, { label: "TÌNH TRẠNG", n: 1 }]);
    var all = (db.nhanvien || []).filter(function (n) { return n && s(n["Mã NV"]); }), rows = [], nghi = 0, dang = 0, seen = {};
    var tt = s(opt.trangThaiNV) || "dang";
    sortBy(all, function (n) { return s(n["Mã NV"]); }).forEach(function (n) {
      var ma = s(n["Mã NV"]);
      if (seen[ma]) { out.loi.push(ma + ": trùng Mã NV trong hồ sơ nhân viên"); return; } seen[ma] = 1;
      var hh = HR ? HR.hienHanh(db, ma, null, ix) : { hd: null, cn: null, tenPB: "", tenCV: "", ct: null }, hd = hh.hd || {}, cn = hh.cn || {}, ct = hh.ct || {};
      var daNghi = s(n["Trạng thái"]) === "Đã nghỉ việc"; if (daNghi) nghi++; else dang++;
      if (tt === "dang" && daNghi) return; if (tt === "nghi" && !daNghi) return;
      if (!cx.pass(ma, hh.tenPB, [hd["Số HĐLĐ"], hh.tenCV].join(" "))) return;
      var het = s(hd["Ngày hết hạn"]).slice(0, 10), ghi = [];
      if (!daNghi) {
        if (!hh.hd) ghi.push("Chưa có hợp đồng"); else if (hd["Ngày chấm dứt"]) ghi.push("HĐ đã chấm dứt");
        else if (het && today && het < today) ghi.push("HĐ quá hạn " + ddmmyyyy(het));
        if (!hh.tenPB) ghi.push("Chưa gán phòng ban");
      }
      if (ghi.length) out.canhbao.push(ma + " — " + s(n["Họ và tên"]) + ": " + ghi.join("; "));
      rows.push({ "STT": rows.length + 1, "Mã NV": ma, "Họ và tên": s(n["Họ và tên"]), "Giới tính": s(cn["Giới tính"]), "Ngày sinh": s(cn["Ngày sinh"]).slice(0, 10), "Phòng ban": s(hh.tenPB), "Chức vụ": s(hh.tenCV),
        "Vị trí việc làm": s(ct["Vị trí việc làm"]), "Số HĐLĐ": s(hd["Số HĐLĐ"]), "Hình thức HĐLĐ": s(hd["Hình thức HĐLĐ"]), "Ngày vào làm": s(hd["Ngày vào làm"]).slice(0, 10), "Ngày hết hạn": het,
        "Trạng thái": daNghi ? "Đã nghỉ việc" : (s(n["Trạng thái"]) || "Đang làm việc") });
    });
    out.cols = cols; out.rows = rows; out.groups = groups; out.tong = {}; out.soDongGoc = all.length;
    out.tongNhan = "TỔNG CỘNG: " + rows.length + " người";
    out.phamVi = [tt === "dang" ? "Đang làm việc" : tt === "nghi" ? "Đã nghỉ việc" : "Tất cả nhân viên"].concat(cx.loc()).join("; ");
    out.ghiChu = ["Danh sách không có CCCD, mã số thuế, số tài khoản và mức lương — chỉ thông tin quản lý nhân sự."];
    out.kyText = "Tính đến ngày " + ddmmyyyy(today || ""); out.theoKy = false;
    out.thongKe = { dang: dang, nghi: nghi };
    var by = {}; rows.forEach(function (r) { var p = r["Phòng ban"] || "(Chưa có phòng ban)"; by[p] = (by[p] || 0) + 1; });
    var ex = Object.keys(by).sort().map(function (p) { return { "Phòng ban": p, "Số người": by[p] }; });
    out.extras = ex.length ? [{ name: "TheoPhongBan", title: "SỐ NHÂN SỰ THEO PHÒNG BAN", cols: mkCols([["Phòng ban", "text"], ["Số người", "qty"]]), rows: ex, tong: { "Số người": rows.length } }] : [];
  }

  // ---------- SẢN LƯỢNG / BƠM DĂM ----------
  function buildPhieuCan(type, db, opt, cx, out) {
    var tbl = type === "SAN_LUONG" ? "sanluong" : "bandam", isXe = type === "BOM_DAM", klLabel = isXe ? "Số xe" : "KL hàng (Tấn)";
    var al = opt.alloc || null, auditBy = {};
    if (al && al.audit) al.audit.forEach(function (a) { var k = s(a.phieu) + "|" + s(a.ngay); (auditBy[k] = auditBy[k] || []).push(a); });
    var cols = mkCols([["STT", "qty"], ["Ngày cân", "text"], ["Phiếu cân", "text"], ["Biển số", "text"], [klLabel, "qty3"], ["Cách giao", "text"], ["Mã phòng ban (tổ)", "text"], ["Mã NV", "text"], ["Người nhận", "text"], ["NV vắng", "text"], ["Số người nhận", "qty"], ["Mỗi người", "qty3"], ["Cân lần 1", "qty"], ["Cân lần 2", "qty"], ["Ghi chú", "text"]]);
    var groups = spans([{ label: "PHIẾU CÂN", n: 5 }, { label: "GIAO CHO", n: 7 }, { label: "SỐ CÂN", n: 2 }, { label: "GHI CHÚ", n: 1 }]);
    var raw = (db[tbl] || []).filter(function (r) { return r; }), inKy = [], badDate = 0, seen = {}, rows = [], byTo = {}, byNV = {};
    raw.forEach(function (r) { var k = ymd(r["Ngày cân"]); if (!k) { if (s(r["Phiếu cân"]) || s(r["KL hàng (Tấn)"])) badDate++; return; } if (k.y === opt.nam && k.m === opt.thang) inKy.push(r); });
    if (badDate) out.canhbao.push(badDate + " dòng có Ngày cân trống/sai định dạng (YYYY-MM-DD) — không thuộc kỳ nào nên không nằm trong báo cáo.");
    sortBy(inKy, function (r) { return s(r["Ngày cân"]).slice(0, 10) + "|" + s(r["Phiếu cân"]); }).forEach(function (r) {
      var ma = s(r["Mã NV"]), to = s(r["Mã phòng ban"]), nd = s(r["Ngày cân"]).slice(0, 10), ph = s(r["Phiếu cân"]), kl = cx.qty(r["KL hàng (Tấn)"]), ghi = [];
      var tenNV = ma ? cx.name(ma) : "", pbNV = ma ? cx.pb(ma) : "";
      if (!cx.pass(ma || to, ma ? pbNV : (cx.refPB(to) || to), [ph, r["Biển số"], to].join(" "))) return;
      if (!isFinite(kl)) { out.loi.push((ph || nd) + ": khối lượng '" + s(r["KL hàng (Tấn)"]) + "' không phải số"); kl = 0; }
      else if (kl < 0) out.loi.push((ph || nd) + ": khối lượng âm (" + kl + ")"); else if (kl === 0) ghi.push("Khối lượng = 0");
      if (ma && !cx.has(ma)) out.loi.push((ph || nd) + ": Mã NV '" + ma + "' không có trong hồ sơ nhân viên");
      if (ph) { if (seen[ph]) { ghi.push("Trùng số phiếu"); out.canhbao.push("Số phiếu '" + ph + "' xuất hiện nhiều lần trong kỳ"); } seen[ph] = 1; }
      var cach = ma ? "Giao trực tiếp" : to ? "Chia theo tổ" : "Chưa gán", nguoi = ma ? tenNV : "", soNg = ma ? 1 : "", moi = ma ? r3(kl) : "";
      if (cach === "Chưa gán") { ghi.push("Chưa có Mã NV / Mã phòng ban — không tính lương cho ai"); out.canhbao.push("Phiếu " + (ph || nd) + " chưa gán người/tổ"); }
      if (cach === "Chia theo tổ") {
        var a = (auditBy[ph + "|" + nd] || []).shift();
        if (a) { nguoi = (a.names || []).join(", "); soNg = a.soNguoi || 0; moi = a.share ? r3(a.share) : ""; if (a.note) ghi.push(a.note); if (!a.soNguoi) out.canhbao.push("Phiếu " + (ph || nd) + " (tổ " + to + "): không chia được cho ai" + (a.note ? " — " + a.note : "")); }
        else if (!al) ghi.push("Chưa phân bổ (chưa có dữ liệu chia tổ)");
      }
      var key = cach === "Chia theo tổ" ? to : "(Giao trực tiếp)"; byTo[key] = byTo[key] || { phieu: 0, kl: 0 }; byTo[key].phieu++; byTo[key].kl += kl;
      if (ma) { byNV[ma] = byNV[ma] || { ma: ma, ten: tenNV, pb: pbNV, phieu: 0, kl: 0 }; byNV[ma].phieu++; byNV[ma].kl += kl; }
      rows.push({ "STT": rows.length + 1, "Ngày cân": nd, "Phiếu cân": ph, "Biển số": s(r["Biển số"]), "Cân lần 1": r["Cân lần 1"] === "" || r["Cân lần 1"] == null || !isFinite(cx.qty(r["Cân lần 1"])) ? "" : cx.qty(r["Cân lần 1"]), "Cân lần 2": r["Cân lần 2"] === "" || r["Cân lần 2"] == null || !isFinite(cx.qty(r["Cân lần 2"])) ? "" : cx.qty(r["Cân lần 2"]),
        "Cách giao": cach, "Mã phòng ban (tổ)": to, "Mã NV": ma, "Người nhận": nguoi, "NV vắng": s(r["NV vắng"]), "Số người nhận": soNg, "Mỗi người": moi, "Ghi chú": ghi.join("; ") });
      rows[rows.length - 1][klLabel] = r3(kl);
    });
    out.cols = cols; out.rows = rows; out.groups = groups; out.tong = sumTong(cols, rows, [klLabel]); out.soDongGoc = inKy.length;
    out.donVi = isXe ? "Số xe (mỗi phiếu thường = 1 xe)" : "Tấn";
    var ex = [], toRows = Object.keys(byTo).sort().map(function (k) { return { "Mã phòng ban (tổ)": k, "Số phiếu": byTo[k].phieu, [klLabel]: r3(byTo[k].kl) }; });
    if (toRows.length) ex.push({ name: "TheoTo", title: out.title + " — TỔNG HỢP THEO TỔ", cols: mkCols([["Mã phòng ban (tổ)", "text"], ["Số phiếu", "qty"], [klLabel, "qty3"]]), rows: toRows, tong: { "Số phiếu": toRows.reduce(function (a, x) { return a + x["Số phiếu"]; }, 0), [klLabel]: r3(toRows.reduce(function (a, x) { return a + x[klLabel]; }, 0)) } });
    // Theo công nhân: lấy kết quả chia tổ của app nếu có (đã gồm cả phiếu chia theo tổ), nếu không chỉ phiếu giao trực tiếp
    var nvRows;
    if (al && al.byEmp) nvRows = Object.keys(al.byEmp).map(function (k) { return al.byEmp[k]; }).sort(function (a, b) { return s(a.maPB) < s(b.maPB) ? -1 : s(a.maPB) > s(b.maPB) ? 1 : b.total - a.total; })
      .filter(function (e) { return cx.pass(e.ma, cx.pb(e.ma), ""); })
      .map(function (e) { var o = { "Mã NV": s(e.ma), "Họ và tên": s(e.hoTen), "Phòng ban": cx.pb(e.ma) || s(e.maPB), "Số ngày có SL": Object.keys(e.byDay || {}).length }; o[klLabel] = r3(e.total); return o; });
    else nvRows = Object.keys(byNV).sort().map(function (k) { var e = byNV[k], o = { "Mã NV": e.ma, "Họ và tên": e.ten, "Phòng ban": e.pb, "Số ngày có SL": e.phieu }; o[klLabel] = r3(e.kl); return o; });
    if (nvRows.length) ex.push({ name: "TheoCongNhan", title: out.title + " — TỔNG HỢP THEO CÔNG NHÂN", cols: mkCols([["Mã NV", "text"], ["Họ và tên", "text"], ["Phòng ban", "text"], ["Số ngày có SL", "qty"], [klLabel, "qty3"]]), rows: nvRows, tong: (function () { var t = {}; t[klLabel] = r3(nvRows.reduce(function (a, x) { return a + x[klLabel]; }, 0)); return t; })() });
    out.extras = ex;
    if (al && al.warnings && al.warnings.length) al.warnings.forEach(function (w) { out.canhbao.push(w); });
    out.ghiChu = [isXe ? "Cột \"Số xe\" lấy từ cột KL hàng của bảng Bơm dăm (mỗi phiếu thường = 1 xe)." : "Khối lượng tính bằng tấn, làm tròn 3 chữ số thập phân khi hiển thị."];
  }

  // ---------- THƯỞNG / TRỪ ----------
  function readSoChungTu(db, tbl, opt, cx, out, fields) {
    var raw = (db[tbl] || []).filter(function (r) { return r; }), inKy = [], bad = 0;
    raw.forEach(function (r) { var k = ymd(r["Ngày hạch toán"]); if (!k) { if (s(r["Mã NV"]) || s(r["Số chứng từ"])) bad++; return; } if (k.y === opt.nam && k.m === opt.thang) inKy.push(r); });
    if (bad) out.canhbao.push(bad + " dòng có Ngày hạch toán trống/sai định dạng (YYYY-MM-DD) — không thuộc kỳ nào nên không nằm trong báo cáo.");
    return sortBy(inKy, function (r) { return s(r["Ngày hạch toán"]).slice(0, 10) + "|" + s(r["Số chứng từ"]) + "|" + s(r["Mã NV"]); });
  }
  function soSanhBangLuong(out, perNV, bl, map, nhan) {
    if (!bl || !bl.length) return;
    var byMa = {}; bl.forEach(function (b) { byMa[s(b["Mã NV"])] = b; });
    Object.keys(perNV).sort().forEach(function (ma) {
      var b = byMa[ma]; if (!b) { out.canhbao.push(ma + ": có " + nhan + " trong kỳ nhưng không có trong bảng lương kỳ này"); return; }
      Object.keys(map).forEach(function (k) { var a = r0(perNV[ma][k] || 0), c = r0(+b[map[k]] || 0); if (Math.abs(a - c) > 0) out.canhbao.push(ma + ": " + k + " trên báo cáo " + a.toLocaleString("vi-VN") + " ≠ bảng lương " + c.toLocaleString("vi-VN") + " (" + map[k] + ")"); });
    });
  }
  function buildThuong(db, opt, cx, out) {
    var cols = mkCols([["STT", "qty"], ["Ngày hạch toán", "text"], ["Số chứng từ", "text"], ["Mã NV", "text"], ["Họ và tên", "text"], ["Phòng ban", "text"], ["Diễn giải", "text"], ["Thưởng", "money"], ["Thu nhập khác", "money"], ["Trừ khác", "money"], ["Thực nhận", "money"]]);
    var groups = spans([{ label: "CHỨNG TỪ", n: 3 }, { label: "NHÂN VIÊN", n: 3 }, { label: "DIỄN GIẢI VÀ SỐ TIỀN (ĐỒNG)", n: 5 }]), src = readSoChungTu(db, "psluong", opt, cx, out), rows = [], per = {}, seen = {};
    src.forEach(function (r) {
      var ma = s(r["Mã NV"]), pbn = cx.pb(ma); if (!cx.pass(ma, pbn, [r["Số chứng từ"], r["Diễn giải"]].join(" "))) return;
      var v = {}; ["Thưởng", "Thu nhập khác", "Trừ khác"].forEach(function (k) { var x = cx.money(r[k]); if (!isFinite(x)) { out.loi.push((s(r["Số chứng từ"]) || ma) + ": " + k + " '" + s(r[k]) + "' không phải số"); x = 0; } else if (x < 0) out.loi.push((s(r["Số chứng từ"]) || ma) + ": " + k + " âm (" + x + ") — nhập số dương, khoản trừ ghi ở cột Trừ khác"); v[k] = x; });
      if (!ma) out.loi.push((s(r["Số chứng từ"]) || s(r["Ngày hạch toán"])) + ": thiếu Mã NV"); else if (!cx.has(ma)) out.loi.push((s(r["Số chứng từ"]) || ma) + ": Mã NV '" + ma + "' không có trong hồ sơ nhân viên");
      if (!v["Thưởng"] && !v["Thu nhập khác"] && !v["Trừ khác"]) out.canhbao.push((s(r["Số chứng từ"]) || ma) + ": dòng không có số tiền");
      if (!s(r["Số chứng từ"])) out.canhbao.push(ma + ": dòng thiếu Số chứng từ"); else { var sk = s(r["Số chứng từ"]) + "|" + ma; if (seen[sk]) out.canhbao.push("Số chứng từ " + s(r["Số chứng từ"]) + " của " + ma + " xuất hiện nhiều lần"); seen[sk] = 1; }
      var p = per[ma] = per[ma] || { "Thưởng": 0, "Thu nhập khác": 0, "Trừ khác": 0, n: 0 }; p["Thưởng"] += v["Thưởng"]; p["Thu nhập khác"] += v["Thu nhập khác"]; p["Trừ khác"] += v["Trừ khác"]; p.n++;
      rows.push({ "STT": rows.length + 1, "Ngày hạch toán": s(r["Ngày hạch toán"]).slice(0, 10), "Số chứng từ": s(r["Số chứng từ"]), "Mã NV": ma, "Họ và tên": cx.name(ma), "Phòng ban": pbn, "Diễn giải": s(r["Diễn giải"]),
        "Thưởng": v["Thưởng"], "Thu nhập khác": v["Thu nhập khác"], "Trừ khác": v["Trừ khác"], "Thực nhận": v["Thưởng"] + v["Thu nhập khác"] - v["Trừ khác"] });
    });
    out.cols = cols; out.rows = rows; out.groups = groups; out.tong = sumTong(cols, rows); out.soDongGoc = src.length;
    out.ghiChu = ["Thực nhận = Thưởng + Thu nhập khác − Trừ khác. Chỉ là bảng kê khoản phát sinh; thuế/BH và thực lĩnh tính ở bảng lương."];
    var ex = Object.keys(per).sort().map(function (ma) { var p = per[ma]; return { "Mã NV": ma, "Họ và tên": cx.name(ma), "Phòng ban": cx.pb(ma), "Số chứng từ": p.n, "Thưởng": p["Thưởng"], "Thu nhập khác": p["Thu nhập khác"], "Trừ khác": p["Trừ khác"], "Thực nhận": p["Thưởng"] + p["Thu nhập khác"] - p["Trừ khác"] }; });
    if (ex.length) { var ec = mkCols([["Mã NV", "text"], ["Họ và tên", "text"], ["Phòng ban", "text"], ["Số chứng từ", "qty"], ["Thưởng", "money"], ["Thu nhập khác", "money"], ["Trừ khác", "money"], ["Thực nhận", "money"]]); var et = sumTong(ec, ex); et["Số chứng từ"] = ex.reduce(function (a, x) { return a + x["Số chứng từ"]; }, 0); out.extras = [{ name: "TheoNhanVien", title: out.title + " — TỔNG HỢP THEO NHÂN VIÊN", cols: ec, rows: ex, tong: et }]; } else out.extras = [];
    if (!cx.loc().length) soSanhBangLuong(out, per, opt.bangluong, { "Thưởng": "Thưởng", "Thu nhập khác": "Thu nhập khác", "Trừ khác": "Trừ khác" }, "thưởng/trừ");
  }

  // ---------- TẠM ỨNG ----------
  function buildTamUng(db, opt, cx, out) {
    var cols = mkCols([["STT", "qty"], ["Ngày hạch toán", "text"], ["Số chứng từ", "text"], ["Mã NV", "text"], ["Họ và tên", "text"], ["Phòng ban", "text"], ["Diễn giải", "text"], ["Tạm ứng", "money"], ["Ký nhận", "text"]]);
    var groups = spans([{ label: "CHỨNG TỪ", n: 3 }, { label: "NHÂN VIÊN", n: 3 }, { label: "NỘI DUNG VÀ SỐ TIỀN", n: 3 }]), src = readSoChungTu(db, "ungluong", opt, cx, out), rows = [], per = {}, seen = {}, byMa = {};
    (opt.bangluong || []).forEach(function (b) { byMa[s(b["Mã NV"])] = b; });
    src.forEach(function (r) {
      var ma = s(r["Mã NV"]), pbn = cx.pb(ma); if (!cx.pass(ma, pbn, [r["Số chứng từ"], r["Diễn giải"]].join(" "))) return;
      var x = cx.money(r["Tạm ứng"]);
      if (!isFinite(x)) { out.loi.push((s(r["Số chứng từ"]) || ma) + ": Tạm ứng '" + s(r["Tạm ứng"]) + "' không phải số"); x = 0; } else if (x < 0) out.loi.push((s(r["Số chứng từ"]) || ma) + ": Tạm ứng âm (" + x + ")"); else if (x === 0) out.canhbao.push((s(r["Số chứng từ"]) || ma) + ": dòng tạm ứng = 0");
      if (!ma) out.loi.push((s(r["Số chứng từ"]) || s(r["Ngày hạch toán"])) + ": thiếu Mã NV"); else if (!cx.has(ma)) out.loi.push((s(r["Số chứng từ"]) || ma) + ": Mã NV '" + ma + "' không có trong hồ sơ nhân viên");
      if (!s(r["Số chứng từ"])) out.canhbao.push(ma + ": dòng tạm ứng thiếu Số chứng từ"); else { var sk = s(r["Số chứng từ"]) + "|" + ma; if (seen[sk]) out.canhbao.push("Số chứng từ " + s(r["Số chứng từ"]) + " của " + ma + " xuất hiện nhiều lần"); seen[sk] = 1; }
      var p = per[ma] = per[ma] || { n: 0, tong: 0 }; p.n++; p.tong += x;
      rows.push({ "STT": rows.length + 1, "Ngày hạch toán": s(r["Ngày hạch toán"]).slice(0, 10), "Số chứng từ": s(r["Số chứng từ"]), "Mã NV": ma, "Họ và tên": cx.name(ma), "Phòng ban": pbn, "Diễn giải": s(r["Diễn giải"]), "Tạm ứng": x, "Ký nhận": "" });
    });
    out.cols = cols; out.rows = rows; out.groups = groups; out.tong = sumTong(cols, rows); out.soDongGoc = src.length;
    out.ghiChu = ["Cột Ký nhận để người nhận tạm ứng ký khi in. Số tạm ứng được trừ vào thực lĩnh ở bảng lương cùng kỳ."];
    var hasBL = Object.keys(byMa).length > 0, ec = [["Mã NV", "text"], ["Họ và tên", "text"], ["Phòng ban", "text"], ["Số lần ứng", "qty"], ["Tổng tạm ứng", "money"]];
    if (hasBL) { ec.push(["Tổng thu nhập (bảng lương)", "money"]); ec.push(["Thực lĩnh (bảng lương)", "money"]); }
    var ex = Object.keys(per).sort().map(function (ma) {
      var p = per[ma], b = byMa[ma], o = { "Mã NV": ma, "Họ và tên": cx.name(ma), "Phòng ban": cx.pb(ma), "Số lần ứng": p.n, "Tổng tạm ứng": p.tong };
      if (hasBL) {
        o["Tổng thu nhập (bảng lương)"] = b ? r0(+b["Tổng thu nhập"] || 0) : ""; o["Thực lĩnh (bảng lương)"] = b ? r0(+b["Thực lĩnh"] || 0) : "";
        if (!cx.loc().length) { if (!b) out.canhbao.push(ma + ": có tạm ứng trong kỳ nhưng không có trong bảng lương kỳ này"); else { if (r0(+b["Tạm ứng"] || 0) !== r0(p.tong)) out.canhbao.push(ma + ": tạm ứng trên báo cáo " + r0(p.tong).toLocaleString("vi-VN") + " ≠ bảng lương " + r0(+b["Tạm ứng"] || 0).toLocaleString("vi-VN")); if (p.tong > (+b["Tổng thu nhập"] || 0)) out.canhbao.push(ma + ": tạm ứng " + r0(p.tong).toLocaleString("vi-VN") + " vượt tổng thu nhập " + r0(+b["Tổng thu nhập"] || 0).toLocaleString("vi-VN")); } }
      }
      return o;
    });
    if (ex.length) { var cc = mkCols(ec), et = sumTong(cc, ex); et["Số lần ứng"] = ex.reduce(function (a, x) { return a + x["Số lần ứng"]; }, 0); out.extras = [{ name: "TheoNhanVien", title: out.title + " — TỔNG HỢP THEO NHÂN VIÊN", cols: cc, rows: ex, tong: et }]; } else out.extras = [];
  }

  // ---------- SUẤT CƠM ----------
  function buildSuatCom(db, opt, cx, out) {
    var nd = soNgayThang(opt.nam, opt.thang), ngVuot = opt.nguongSuatNgay > 0 ? opt.nguongSuatNgay : NGUONG_SUAT_NGAY, days = [], base = [["STT", "qty"], ["Mã NV", "text"], ["Họ và tên", "text"], ["Phòng ban", "text"]];
    for (var d = 1; d <= nd; d++) days.push(("0" + d).slice(-2));
    var cols = mkCols(base.concat(days.map(function (x) { return [x, "qty"]; }), [["Tổng suất", "qty"], ["Ghi chú", "text"]]));
    var groups = spans([{ label: "NHÂN VIÊN", n: 4 }, { label: "SỐ SUẤT CƠM THEO NGÀY", n: nd }, { label: "TỔNG HỢP", n: 2 }]);
    var raw = (db.tiencom || []).filter(function (r) { return r; }), per = {}, bad = 0, nIn = 0;
    raw.forEach(function (r) {
      var k = ymd(r["Ngày"]); if (!k) { if (s(r["Mã NV"]) || s(r["Số suất cơm"])) bad++; return; } if (k.y !== opt.nam || k.m !== opt.thang) return;
      nIn++; var ma = s(r["Mã NV"]), x = cx.qty(r["Số suất cơm"]);
      if (!ma) { out.loi.push("Ngày " + ddmmyyyy(r["Ngày"]) + ": dòng suất cơm thiếu Mã NV"); return; }
      if (!cx.has(ma)) out.loi.push("Ngày " + ddmmyyyy(r["Ngày"]) + ": Mã NV '" + ma + "' không có trong hồ sơ nhân viên");
      if (!isFinite(x)) { out.loi.push(ma + " ngày " + ddmmyyyy(r["Ngày"]) + ": Số suất cơm '" + s(r["Số suất cơm"]) + "' không phải số"); return; }
      if (x < 0) { out.loi.push(ma + " ngày " + ddmmyyyy(r["Ngày"]) + ": Số suất cơm âm (" + x + ")"); return; }
      var p = per[ma] = per[ma] || { d: {}, notes: [] }; p.d[k.d] = (p.d[k.d] || 0) + x; if (s(r["Ghi chú"]) && p.notes.indexOf(s(r["Ghi chú"])) < 0) p.notes.push(s(r["Ghi chú"]));
    });
    if (bad) out.canhbao.push(bad + " dòng suất cơm có Ngày trống/sai định dạng (YYYY-MM-DD) — không nằm trong báo cáo.");
    var rows = [];
    Object.keys(per).sort().forEach(function (ma) {
      var pbn = cx.pb(ma); if (!cx.pass(ma, pbn, per[ma].notes.join(" "))) return;
      var o = { "STT": rows.length + 1, "Mã NV": ma, "Họ và tên": cx.name(ma), "Phòng ban": pbn }, tot = 0;
      for (var d2 = 1; d2 <= nd; d2++) { var v = per[ma].d[d2] || 0; o[("0" + d2).slice(-2)] = v ? r3(v) : ""; tot += v; if (v > ngVuot) out.canhbao.push(ma + " ngày " + ("0" + d2).slice(-2) + ": " + r3(v) + " suất/ngày vượt ngưỡng " + ngVuot); }
      o["Tổng suất"] = r3(tot); o["Ghi chú"] = per[ma].notes.join("; "); rows.push(o);
    });
    out.cols = cols; out.rows = rows; out.groups = groups; out.soDongGoc = Object.keys(per).length;
    out.tong = {}; days.concat(["Tổng suất"]).forEach(function (k) { var sm = r3(rows.reduce(function (a, r) { return a + (+r[k] || 0); }, 0)); out.tong[k] = sm || ""; });
    out.tongNhan = null; out.donVi = "Suất cơm"; out.nIn = nIn;
    out.ghiChu = ["Mỗi ô là số suất cơm của nhân viên trong ngày (cộng các dòng cùng ngày). Ngưỡng cảnh báo " + ngVuot + " suất/ngày chỉ là giá trị tham khảo."];
    var by = {}; rows.forEach(function (r) { var p = r["Phòng ban"] || "(Chưa có phòng ban)"; by[p] = by[p] || { n: 0, t: 0 }; by[p].n++; by[p].t += r["Tổng suất"]; });
    var ex = Object.keys(by).sort().map(function (p) { return { "Phòng ban": p, "Số người ăn cơm": by[p].n, "Tổng suất": r3(by[p].t) }; });
    out.extras = ex.length ? [{ name: "TheoPhongBan", title: out.title + " — TỔNG HỢP THEO PHÒNG BAN", cols: mkCols([["Phòng ban", "text"], ["Số người ăn cơm", "qty"], ["Tổng suất", "qty"]]), rows: ex, tong: { "Số người ăn cơm": ex.reduce(function (a, x) { return a + x["Số người ăn cơm"]; }, 0), "Tổng suất": r3(ex.reduce(function (a, x) { return a + x["Tổng suất"]; }, 0)) } }] : [];
  }

  /**
   * @param type  khóa TYPES
   * @param db    dữ liệu (nhanvien, sanluong, bandam, psluong, ungluong, tiencom + hồ sơ nếu truyền opt.hr)
   * @param opt   { nam, thang, tenCongTy, ngay, nguoiLap, chot, hr (HRM), num (engine.num), alloc (kết quả chia tổ của app), bangluong (kq.bangluong để đối chiếu),
   *                phongBan, tuKhoa, trangThaiNV: "dang"|"nghi"|"tatca", nguongSuatNgay }
   */
  function build(type, db, opt) {
    opt = opt || {}; var T = TYPES[type]; if (!T) throw new Error("Loại báo cáo không hợp lệ: " + type);
    var out = { loi: [], canhbao: [], extras: [], ghiChu: [] }; out.title = T.title;
    var cx = context(db || {}, opt);
    if (T.theoKy && (!opt.nam || !opt.thang)) throw new Error("Thiếu kỳ (nam, thang) cho " + type);
    if (type === "NHAN_SU") buildNhanSu(db || {}, opt, cx, out);
    else if (type === "SAN_LUONG" || type === "BOM_DAM") buildPhieuCan(type, db || {}, opt, cx, out);
    else if (type === "THUONG") buildThuong(db || {}, opt, cx, out);
    else if (type === "TAM_UNG") buildTamUng(db || {}, opt, cx, out);
    else buildSuatCom(db || {}, opt, cx, out);
    var loc = cx.loc(), ky = T.theoKy ? opt.nam + "-" + ("0" + opt.thang).slice(-2) : "";
    return {
      type: type, title: T.title, file: T.file, perm: T.perm, congTy: opt.tenCongTy || "", ky: T.theoKy ? kyLabel(opt.nam, opt.thang) : "", kyKey: ky || (opt.homNay || "").slice(0, 10) || "",
      kyText: out.kyText || upper("Tháng " + kyLabel(opt.nam, opt.thang)), trangThai: T.theoKy ? (opt.chot ? "Kỳ lương đã chốt" : "Dữ liệu nhập — kỳ lương chưa chốt") : "",
      chot: !!opt.chot, loc: loc, phamVi: out.phamVi || (loc.length ? loc.join("; ") : "Toàn bộ"), donVi: out.donVi || T.donVi, ngayLap: opt.ngay || "", nguoiLap: opt.nguoiLap || "",
      cols: out.cols, rows: out.rows, tong: out.tong, tongNhan: out.tongNhan || null, groups: out.groups, extras: out.extras, ghiChu: out.ghiChu, chuKy: T.chuKy,
      soDong: out.rows.length, soDongGoc: out.soDongGoc, loi: dedupe(out.loi), canhbao: dedupe(out.canhbao), thongKe: out.thongKe || null
    };
  }
  function dedupe(a) { var seen = {}; return a.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; }); }

  /** Dòng phẳng + dòng tổng cho PDF (và đối chiếu). */
  function toRows(vm) {
    var out = vm.rows.map(function (r) { var o = {}; vm.cols.forEach(function (c) { o[c.label] = r[c.key]; }); return o; });
    if (vm.rows.length) { var t = {}; vm.cols.forEach(function (c, i) { t[c.label] = i === 0 ? (vm.tongNhan || "TỔNG CỘNG") : (vm.tong[c.key] != null ? vm.tong[c.key] : ""); }); out.push(t); }
    return out;
  }
  /** Các bảng (chính + tổng hợp phụ) dưới dạng vm đầy đủ đầu trang — để Excel mỗi bảng một sheet. */
  function sheetVms(vm) {
    var head = { congTy: vm.congTy, kyText: vm.kyText, phamVi: vm.phamVi, donVi: vm.donVi, ngayLap: vm.ngayLap, trangThai: vm.trangThai, nguoiLap: vm.nguoiLap };
    var list = [Object.assign({}, vm, { sheetName: vm.title })];
    (vm.extras || []).forEach(function (e) { list.push(Object.assign({}, head, { title: e.title, sheetName: e.name, cols: e.cols, rows: e.rows, tong: e.tong || {}, groups: null, tongNhan: null })); });
    return list;
  }
  /** Các bảng cho PDF (report-html.sheets). */
  function toSheets(vm) {
    var sh = [{ name: vm.title, cols: vm.cols.map(function (c) { return c.label; }), rows: toRows(vm), groups: vm.groups || null }];
    (vm.extras || []).forEach(function (e) {
      var rows = e.rows.map(function (r) { var o = {}; e.cols.forEach(function (c) { o[c.label] = r[c.key]; }); return o; });
      if (e.rows.length) { var t = {}; e.cols.forEach(function (c, i) { t[c.label] = i === 0 ? "TỔNG CỘNG" : (e.tong && e.tong[c.key] != null ? e.tong[c.key] : ""); }); rows.push(t); }
      sh.push({ name: e.title, cols: e.cols.map(function (c) { return c.label; }), rows: rows, groups: null });
    });
    return sh;
  }

  /**
   * Bảng dạng mảng đối tượng (báo cáo nhân sự sẵn có: hết hạn HĐ, biến động, nghỉ phép…) → vm theo MẪU CHUNG của hệ thống
   * (tiêu đề công ty / TÊN IN HOA / chữ ký / A4 ngang) để Excel và PDF không còn là bảng trần.
   */
  function fromRows(title, rows, opt) {
    opt = opt || {}; rows = (rows || []).filter(function (r) { return r; });
    var keys = rows.length ? Object.keys(rows[0]).filter(function (k) { return k.charAt(0) !== "_"; }) : [], tot = null;
    if (rows.length > 1 && keys.length && /^(TỔNG|CẢ NĂM)/i.test(s(rows[rows.length - 1][keys[0]]))) { tot = rows[rows.length - 1]; rows = rows.slice(0, -1); }
    var cols = keys.map(function (k) {
      var vals = rows.map(function (r) { return r[k]; }).filter(function (v) { return v !== "" && v != null; });
      var allNum = vals.length > 0 && vals.every(function (v) { return typeof v === "number" && isFinite(v); });
      return { key: k, label: k, kind: allNum ? (/tiền|lương|thu nhập|thuế|mức đóng|đồng/i.test(k) ? "money" : "qty") : "text" };
    });
    var tong = {}; if (tot) cols.forEach(function (c, i) { if (i > 0 && typeof tot[c.key] === "number") tong[c.key] = tot[c.key]; });
    var withSTT = opt.stt !== false && rows.length && keys.indexOf("STT") < 0;
    if (withSTT) { cols.unshift({ key: "STT", label: "STT", kind: "qty" }); rows = rows.map(function (r, i) { return Object.assign({ STT: i + 1 }, r); }); }
    var ky = opt.nam && opt.thang ? kyLabel(opt.nam, opt.thang) : s(opt.kyText);
    return { type: "BANG", title: upper(title), file: opt.file || "BaoCao", congTy: opt.tenCongTy || "", ky: ky, kyKey: opt.kyKey || "", kyText: opt.kyText || (opt.nam && opt.thang ? upper("Tháng " + ky) : ""), trangThai: opt.trangThai || "", chot: false,
      loc: opt.loc || [], phamVi: opt.phamVi || (opt.loc && opt.loc.length ? opt.loc.join("; ") : "Toàn bộ"), donVi: opt.donVi || "", ngayLap: opt.ngay || "", nguoiLap: opt.nguoiLap || "",
      cols: cols, rows: rows, tong: tong, tongNhan: null, groups: null, extras: [], ghiChu: [], chuKy: opt.chuKy || ["Người lập", "Trưởng phòng nhân sự", "Giám đốc"], soDong: rows.length, soDongGoc: rows.length, loi: [], canhbao: [] };
  }

  var api = { TYPES: TYPES, build: build, toRows: toRows, toSheets: toSheets, sheetVms: sheetVms, fromRows: fromRows, upper: upper };
  if (isNode) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.opsReports = api; }
})(typeof window !== "undefined" ? window : this);
