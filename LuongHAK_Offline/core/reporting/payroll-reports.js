// ===== CORE / REPORTING / PAYROLL-REPORTS — bộ báo cáo lương (V9.4 mục IV, VI) =====
// View-model thuần dùng chung cho màn hình, Excel và PDF: Tổng hợp lương, Thanh toán lương, Kê chuyển khoản, Thanh toán tiền mặt.
// Số tiền thanh toán lấy từ "đề nghị chi / còn phải thanh toán" (thực lĩnh − đã trả − đang chờ chi), KHÔNG lấy tổng thu nhập.
// Tiêu đề luôn IN HOA. Lỗi nghiêm trọng (loi) chặn xuất chính thức; cảnh báo (canhbao) chỉ báo.
(function (root) {
  "use strict";
  var isNode = typeof module !== "undefined" && module.exports;
  var RF = isNode ? require("./report-filter.js") : root.HAKCore.reportFilter;
  var PL = isNode ? require("../payment-ledger.js") : root.HAKCore.payledger;

  var TYPES = {
    TONG_HOP: { title: "BẢNG TỔNG HỢP LƯƠNG", file: "TongHopLuong" },
    THANH_TOAN: { title: "BẢNG THANH TOÁN LƯƠNG", file: "ThanhToanLuong" },
    CHUYEN_KHOAN: { title: "BẢNG KÊ CHUYỂN KHOẢN LƯƠNG", file: "KeChuyenKhoan" },
    TIEN_MAT: { title: "BẢNG THANH TOÁN LƯƠNG TIỀN MẶT", file: "ThanhToanTienMat" },
    CHI_TIET_NV: { title: "BẢNG TỔNG HỢP CHI TIẾT LƯƠNG TOÀN BỘ NHÂN VIÊN", file: "ChiTietLuongNhanVien" },
    CHI_TIET_TT: { title: "BẢNG CHI TIẾT THANH TOÁN TIỀN LƯƠNG", file: "ChiTietThanhToan" },
    SO_CHUNG_TU: { title: "SỔ CHỨNG TỪ THANH TOÁN LƯƠNG", file: "SoChungTuThanhToan" }
  };
  /** Báo cáo xem được cả khi kỳ chưa chốt (số tính tạm); các loại còn lại chỉ xuất chính thức từ kỳ đã chốt. */
  var KHONG_CAN_CHOT = { TONG_HOP: 1, CHI_TIET_NV: 1 };

  /** V10.1 — BẢNG CHI TIẾT THANH TOÁN TIỀN LƯƠNG: một dòng mỗi nhân viên của kỳ (lấy từ bảng lương, KHÔNG từ sổ chứng từ). Nhóm cột có tiêu đề hai tầng. */
  var CT_TT_GROUPS = [
    { label: "NHÂN VIÊN", cols: [["STT", "qty"], ["Mã NV", "text"], ["Họ và tên", "text"], ["Công ty", "text"], ["Phòng ban", "text"], ["Hình thức lương", "text"], ["Kỳ lương", "text"]] },
    { label: "CÔNG & SẢN LƯỢNG", cols: [["Công chuẩn", "qty"], ["Công hưởng lương", "qty"], ["Công tăng ca", "qty"], ["Sản lượng (tấn)", "qty"], ["Số xe bơm dăm", "qty"]] },
    { label: "THU NHẬP", cols: [["Lương thời gian", "money"], ["Lương phụ", "money"], ["Lương sản lượng", "money"], ["Lương bù SL", "money"], ["Lương bơm dăm", "money"], ["Tiền tăng ca", "money"], ["Phụ cấp", "money"], ["Phụ cấp công tác", "money"], ["Lương hỗ trợ", "money"], ["Tiền cơm", "money"], ["Thưởng", "money"], ["Thu nhập khác", "money"], ["Tổng thu nhập", "money"]] },
    { label: "KHẤU TRỪ", cols: [["BHXH NLĐ", "money"], ["BHYT NLĐ", "money"], ["BHTN NLĐ", "money"], ["BH trừ NLĐ", "money"], ["KPCĐ trừ NLĐ", "money"], ["Truy thu BH", "money"], ["Thuế TNCN", "money"], ["Tạm ứng", "money"], ["Trừ khác", "money"], ["Tổng khấu trừ", "money"]] },
    { label: "THANH TOÁN", cols: [["Chênh lệch làm tròn", "money"], ["Thực lĩnh", "money"], ["Đã thanh toán", "money"], ["Đang chờ chi", "money"], ["Còn phải thanh toán", "money"], ["Có thể lập đề nghị chi", "money"], ["Hình thức thanh toán", "text"], ["Ngân hàng", "text"], ["Số tài khoản", "text"], ["Trạng thái", "text"], ["Ghi chú", "text"]] }
  ];
  var CT_NV_GROUPS = [
    { label: "NHÂN VIÊN", cols: [["STT", "qty"], ["Mã NV", "text"], ["Họ và tên", "text"], ["Phòng ban", "text"]] },
    { label: "CÔNG & SẢN LƯỢNG", cols: [["Công chuẩn", "qty"], ["Tổng công", "qty"], ["Sản lượng (tấn)", "qty"]] },
    { label: "THU NHẬP", cols: [["Lương thời gian", "money"], ["Lương phụ", "money"], ["Lương sản lượng", "money"], ["Lương bù SL", "money"], ["Lương bơm dăm", "money"], ["Tiền tăng ca", "money"], ["Phụ cấp", "money"], ["Phụ cấp công tác", "money"], ["Lương hỗ trợ", "money"], ["Tiền cơm", "money"], ["Thưởng", "money"], ["Thu nhập khác", "money"], ["Tổng thu nhập", "money"]] },
    { label: "KHẤU TRỪ", cols: [["BH trừ NLĐ", "money"], ["KPCĐ trừ NLĐ", "money"], ["Truy thu BH", "money"], ["Thuế TNCN", "money"], ["Trừ khác", "money"], ["Tạm ứng", "money"]] },
    { label: "THANH TOÁN", cols: [["Thực lĩnh", "money"]] }
  ];
  function flat(groups) { var out = []; groups.forEach(function (g) { g.cols.forEach(function (c) { out.push(c); }); }); return out; }
  function groupSpans(groups) { var i = 0; return groups.map(function (g) { var from = i; i += g.cols.length; return { label: g.label, from: from, to: i - 1 }; }); }
  function tongKhauTru(r) { return n(r["BH trừ NLĐ"]) + n(r["KPCĐ trừ NLĐ"]) + n(r["Truy thu BH"]) + n(r["Thuế TNCN"]) + n(r["Trừ khác"]) + n(r["Tạm ứng"]); }
  function n(v) { var x = +v; return isFinite(x) ? x : 0; }
  function s(v) { return v == null ? "" : String(v).trim(); }
  function sumBy(rows, k) { return rows.reduce(function (a, r) { return a + n(r[k]); }, 0); }
  function noDiacritics(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D"); }
  function kyLabel(nam, thang) { return ("0" + thang).slice(-2) + "/" + nam; }
  function upper(t) { return String(t || "").toLocaleUpperCase("vi-VN"); }

  /**
   * @param type  khóa TYPES
   * @param src   { bangluong:[...], chot:bool, blockers:[{code,ten,count,items}] }
   * @param opt   { nam, thang, filter, tenCongTy, lines (sổ thanh toán), nguoiLap, ngay }
   */
  function build(type, src, opt) {
    opt = opt || {}; var T = TYPES[type]; if (!T) throw new Error("Loại báo cáo không hợp lệ: " + type);
    var ky = opt.nam + "-" + ("0" + opt.thang).slice(-2);
    var f = RF.apply((src && src.bangluong) || [], opt.filter);
    var os = PL.outstanding(f.rows, opt.lines, ky), osBy = {}; os.forEach(function (o) { osBy[o.maNV] = o; });
    var loi = [], canhbao = [];
    (src.blockers || []).forEach(function (b) { loi.push(b.code + " — " + b.ten + " (" + b.count + "): " + (b.items || []).slice(0, 2).join(" | ")); });
    var cols, rows, groups = null;
    if (type === "TONG_HOP") {
      cols = [["Phòng ban", "text"], ["Số người", "qty"], ["Tổng thu nhập", "money"], ["BH trừ NLĐ", "money"], ["KPCĐ trừ NLĐ", "money"], ["Truy thu BH", "money"], ["Thuế TNCN", "money"], ["Trừ khác", "money"], ["Tạm ứng", "money"], ["Thực lĩnh", "money"]];
      var g = {}, ord = [];
      f.rows.forEach(function (r) { var p = s(r["Phòng ban"]) || "(Chưa có phòng ban)"; if (!g[p]) { g[p] = []; ord.push(p); } g[p].push(r); });
      ord.sort();
      rows = ord.map(function (p) { var o = { "Phòng ban": p, "Số người": g[p].length }; cols.slice(2).forEach(function (c) { o[c[0]] = sumBy(g[p], c[0]); }); return o; });
      if (f.rows.some(function (r) { return !s(r["Phòng ban"]); })) canhbao.push("Có người chưa gán phòng ban — gộp vào '(Chưa có phòng ban)'.");
    } else if (type === "THANH_TOAN") {
      cols = [["STT", "qty"], ["Mã NV", "text"], ["Họ và tên", "text"], ["Phòng ban", "text"], ["Hình thức", "text"], ["Thực lĩnh", "money"], ["Đã thanh toán", "money"], ["Đang chờ chi", "money"], ["Còn phải thanh toán", "money"], ["Trạng thái", "text"], ["Ký nhận", "text"]];
      rows = f.rows.map(function (r, i) {
        var o = osBy[r["Mã NV"]], ht = PL.hinhThucCua(r["HTTT"]);
        if (!ht) loi.push(r["Mã NV"] + " — " + r["Họ và tên"] + ": chưa khai hình thức thanh toán (HTTT)");
        if (o.vuot) loi.push(r["Mã NV"] + ": đã chi/đang chờ chi vượt thực lĩnh");
        return { "STT": i + 1, "Mã NV": r["Mã NV"], "Họ và tên": r["Họ và tên"], "Phòng ban": r["Phòng ban"] || "", "Hình thức": ht, "Thực lĩnh": o.thucLinh, "Đã thanh toán": o.daTra,
          "Đang chờ chi": o.dangCho, "Còn phải thanh toán": o.conPhaiTra, "Trạng thái": o.trangThai, "Ký nhận": "" };
      });
    } else if (type === "CHI_TIET_NV") {
      groups = CT_NV_GROUPS; cols = flat(groups);
      rows = f.rows.map(function (r, i) { var o = { "STT": i + 1 }; cols.forEach(function (c) { if (c[0] !== "STT") o[c[0]] = c[1] === "text" ? s(r[c[0]]) : (r[c[0]] == null || r[c[0]] === "" ? 0 : n(r[c[0]])); }); return o; });
      f.rows.forEach(function (r) {
        if (n(r["Tổng thu nhập"]) < n(r["Thực lĩnh"])) loi.push(r["Mã NV"] + ": thực lĩnh lớn hơn tổng thu nhập");
      });
      if (f.rows.some(function (r) { return !s(r["Phòng ban"]); })) canhbao.push("Có người chưa gán phòng ban.");
    } else if (type === "CHI_TIET_TT") {
      groups = CT_TT_GROUPS; cols = flat(groups);
      var bhBy = {}; (src.bhxh || []).forEach(function (b) { if (!(b["Mã NV"] in bhBy)) bhBy[b["Mã NV"]] = b; });
      rows = f.rows.map(function (r, i) {
        var o = osBy[r["Mã NV"]], ct = r["_ct"] || {}, bh = bhBy[r["Mã NV"]] || {}, kt = tongKhauTru(r), tn = n(r["Tổng thu nhập"]), tl = n(r["Thực lĩnh"]);
        var lech = tl - (tn - kt), ghiChu = [], ht = PL.hinhThucCua(r["HTTT"]);
        if (o.vuotChi > 0) { ghiChu.push("TRẢ VƯỢT " + Math.round(o.vuotChi)); loi.push(r["Mã NV"] + " — " + r["Họ và tên"] + ": đã chi/đang chờ chi vượt thực lĩnh " + Math.round(o.vuotChi) + " — cần điều chỉnh hoặc thu hồi"); }
        if (tn - kt < 0) { ghiChu.push("Khấu trừ vượt thu nhập"); loi.push(r["Mã NV"] + " — " + r["Họ và tên"] + ": tổng khấu trừ vượt tổng thu nhập " + Math.round(kt - tn) + " (thực lĩnh để 0, phần thiếu chưa chuyển kỳ sau)"); }
        else if (Math.abs(lech) > 500) loi.push(r["Mã NV"] + ": thực lĩnh lệch " + Math.round(lech) + " so với (thu nhập − khấu trừ) — vượt biên làm tròn 500đ");
        if (tl <= 0 && tn > 0) ghiChu.push("Thực lĩnh 0");
        if (!ht && tl > 0) ghiChu.push("Chưa khai hình thức thanh toán");
        return {
          "STT": i + 1, "Mã NV": s(r["Mã NV"]), "Họ và tên": s(r["Họ và tên"]), "Công ty": opt.tenCongTy || "", "Phòng ban": s(r["Phòng ban"]), "Hình thức lương": s(ct.hinhThucLuong || ct.maLuong), "Kỳ lương": kyLabel(opt.nam, opt.thang),
          "Công chuẩn": n(r["Công chuẩn"]), "Công hưởng lương": n(r["Tổng công"]), "Công tăng ca": n(r["Công tăng ca"]), "Sản lượng (tấn)": n(r["Sản lượng (tấn)"]), "Số xe bơm dăm": n(r["Số xe bơm dăm"]),
          "Lương thời gian": n(r["Lương thời gian"]), "Lương phụ": n(r["Lương phụ"]), "Lương sản lượng": n(r["Lương sản lượng"]), "Lương bù SL": n(r["Lương bù SL"]), "Lương bơm dăm": n(r["Lương bơm dăm"]), "Tiền tăng ca": n(r["Tiền tăng ca"]),
          "Phụ cấp": n(r["Phụ cấp"]), "Phụ cấp công tác": n(r["Phụ cấp công tác"]), "Lương hỗ trợ": n(r["Lương hỗ trợ"]), "Tiền cơm": n(r["Tiền cơm"]), "Thưởng": n(r["Thưởng"]), "Thu nhập khác": n(r["Thu nhập khác"]), "Tổng thu nhập": tn,
          "BHXH NLĐ": n(bh["NLĐ.BHXH"]), "BHYT NLĐ": n(bh["NLĐ.BHYT"]), "BHTN NLĐ": n(bh["NLĐ.BHTN"]), "BH trừ NLĐ": n(r["BH trừ NLĐ"]), "KPCĐ trừ NLĐ": n(r["KPCĐ trừ NLĐ"]), "Truy thu BH": n(r["Truy thu BH"]),
          "Thuế TNCN": n(r["Thuế TNCN"]), "Tạm ứng": n(r["Tạm ứng"]), "Trừ khác": n(r["Trừ khác"]), "Tổng khấu trừ": kt,
          "Chênh lệch làm tròn": lech, "Thực lĩnh": tl, "Đã thanh toán": o.daTra, "Đang chờ chi": o.dangCho, "Còn phải thanh toán": o.conPhaiTraRaw, "Có thể lập đề nghị chi": o.deNghiChi,
          "Hình thức thanh toán": ht, "Ngân hàng": s(r["Ngân hàng"]), "Số tài khoản": s(r["Số tài khoản"]), "Trạng thái": o.trangThai, "Ghi chú": ghiChu.join("; ")
        };
      });
      // đối chiếu: BHXH+BHYT+BHTN (nếu có chi tiết) phải bằng BH trừ NLĐ
      rows.forEach(function (x) { var ph = x["BHXH NLĐ"] + x["BHYT NLĐ"] + x["BHTN NLĐ"]; if (ph > 0 && Math.abs(ph - x["BH trừ NLĐ"]) > 1) canhbao.push(x["Mã NV"] + ": BHXH+BHYT+BHTN (" + Math.round(ph) + ") khác BH trừ NLĐ (" + Math.round(x["BH trừ NLĐ"]) + ")"); });
      if ((src.canhbaoNguon || []).length) canhbao.push("Có " + src.canhbaoNguon.length + " cảnh báo dữ liệu nguồn của kỳ (nhân viên thiếu hợp đồng/hồ sơ…) — xem màn Kiểm tra bảng lương để biết ai bị loại khỏi bảng lương.");
    } else if (type === "SO_CHUNG_TU") {
      cols = [["STT", "qty"], ["Số chứng từ", "text"], ["Hình thức", "text"], ["Mã NV", "text"], ["Họ và tên", "text"], ["Phòng ban", "text"], ["Số tiền", "money"], ["Trạng thái", "text"], ["Ngày lập", "text"], ["Ngày duyệt", "text"], ["Ngày thanh toán", "text"], ["Người lập", "text"], ["Người duyệt", "text"], ["Người ghi nhận", "text"], ["Lý do hủy", "text"]];
      var pbOf = {}; f.rows.forEach(function (r) { pbOf[r["Mã NV"]] = s(r["Phòng ban"]); });
      rows = [];
      (opt.lines || []).filter(function (l) { return s(l["Kỳ"]) === ky && Object.prototype.hasOwnProperty.call(pbOf, l["Mã NV"]); })
        .sort(function (a, b) { return s(a["Số chứng từ"]) < s(b["Số chứng từ"]) ? -1 : s(a["Số chứng từ"]) > s(b["Số chứng từ"]) ? 1 : s(a["Mã NV"]) < s(b["Mã NV"]) ? -1 : 1; })
        .forEach(function (l) {
          rows.push({ "STT": rows.length + 1, "Số chứng từ": s(l["Số chứng từ"]), "Hình thức": s(l["Hình thức"]), "Mã NV": s(l["Mã NV"]), "Họ và tên": s(l["Họ và tên"]), "Phòng ban": pbOf[l["Mã NV"]], "Số tiền": n(l["Số tiền"]), "Trạng thái": s(l["Trạng thái"]),
            "Ngày lập": s(l["Ngày lập"]), "Ngày duyệt": s(l["Ngày duyệt"]), "Ngày thanh toán": s(l["Ngày thanh toán"]), "Người lập": s(l["Người lập"]), "Người duyệt": s(l["Người duyệt"]), "Người ghi nhận": s(l["Người ghi nhận"]), "Lý do hủy": s(l["Lý do hủy"]) });
        });
      if (!rows.length) canhbao.push("Kỳ này chưa có chứng từ thanh toán nào trong phạm vi lọc.");
      os.forEach(function (o) { if (o.vuot) loi.push(o.maNV + ": đã chi/đang chờ chi vượt thực lĩnh"); });
    } else if (type === "CHUYEN_KHOAN") {
      cols = [["STT", "qty"], ["Mã NV", "text"], ["Họ và tên", "text"], ["Số tài khoản", "text"], ["Ngân hàng", "text"], ["Số tiền", "money"], ["Nội dung", "text"]];
      var sel = f.rows.filter(function (r) { return PL.hinhThucCua(r["HTTT"]) === PL.HT.CK; }), accSeen = {};
      rows = [];
      sel.forEach(function (r) {
        var o = osBy[r["Mã NV"]]; if (o.deNghiChi <= 0) return;
        var stk = s(r["Số tài khoản"]), nh = s(r["Ngân hàng"]);
        if (!stk) loi.push(r["Mã NV"] + " — " + r["Họ và tên"] + ": thiếu số tài khoản");
        else if (!/^[0-9A-Za-z .\-]{6,30}$/.test(stk)) loi.push(r["Mã NV"] + ": số tài khoản '" + stk + "' không hợp lệ");
        if (!nh) loi.push(r["Mã NV"] + " — " + r["Họ và tên"] + ": thiếu ngân hàng");
        if (stk) { if (accSeen[stk] && accSeen[stk] !== r["Mã NV"]) canhbao.push("Số tài khoản " + stk + " trùng giữa " + accSeen[stk] + " và " + r["Mã NV"]); accSeen[stk] = r["Mã NV"]; }
        rows.push({ "STT": rows.length + 1, "Mã NV": r["Mã NV"], "Họ và tên": r["Họ và tên"], "Số tài khoản": stk, "Ngân hàng": nh, "Số tiền": o.deNghiChi, "Nội dung": "Luong T" + ("0" + opt.thang).slice(-2) + "/" + opt.nam + " " + noDiacritics(r["Họ và tên"]) });
      });
      if (!sel.length) canhbao.push("Không có ai thanh toán bằng chuyển khoản trong phạm vi lọc.");
    } else {
      cols = [["STT", "qty"], ["Mã NV", "text"], ["Họ và tên", "text"], ["Phòng ban", "text"], ["Số tiền", "money"], ["Ký nhận", "text"]];
      rows = [];
      f.rows.forEach(function (r) {
        if (PL.hinhThucCua(r["HTTT"]) !== PL.HT.TM) return;
        var o = osBy[r["Mã NV"]]; if (o.deNghiChi <= 0) return;
        rows.push({ "STT": rows.length + 1, "Mã NV": r["Mã NV"], "Họ và tên": r["Họ và tên"], "Phòng ban": r["Phòng ban"] || "", "Số tiền": o.deNghiChi, "Ký nhận": "" });
      });
    }
    // lỗi dùng chung
    f.rows.forEach(function (r) { if (n(r["Thực lĩnh"]) < 0) loi.push(r["Mã NV"] + ": thực lĩnh âm"); });
    if (!src.chot) canhbao.push("Kỳ chưa chốt — số liệu tính tạm, chỉ để xem; không lập chứng từ/chi tiền theo bảng này.");
    var tong = {}; cols.forEach(function (c) { if (c[1] === "money" || (type === "TONG_HOP" && c[0] === "Số người")) tong[c[0]] = Math.round(sumBy(rows, c[0])); });
    if (type === "CHUYEN_KHOAN" || type === "TIEN_MAT") {
      f.rows.forEach(function (r) { if (!PL.hinhThucCua(r["HTTT"]) && osBy[r["Mã NV"]].deNghiChi > 0) loi.push(r["Mã NV"] + " — " + r["Họ và tên"] + ": chưa khai hình thức thanh toán nên không nằm trong bảng kê nào"); });
    }
    return {
      type: type, title: upper(T.title), file: T.file, congTy: opt.tenCongTy || "", ky: kyLabel(opt.nam, opt.thang), kyKey: ky,
      kyText: upper("Tháng " + kyLabel(opt.nam, opt.thang)), trangThai: src.chot ? "Kỳ đã chốt" : "Tính tạm — kỳ chưa chốt", chot: !!src.chot,
      loc: RF.describe(opt.filter), phamVi: RF.describe(opt.filter).length ? RF.describe(opt.filter).join("; ") : "Toàn bộ", donVi: "Đồng (VND)",
      ngayLap: opt.ngay || "", nguoiLap: opt.nguoiLap || "", cols: cols.map(function (c) { return { key: c[0], label: c[0], kind: c[1] }; }), rows: rows, tong: tong, groups: groups ? groupSpans(groups) : null,
      soDong: rows.length, soDongGoc: f.total, loi: loi, canhbao: canhbao, choXuatChinhThuc: loi.length === 0 && !!src.chot
    };
  }
  /** Dòng phẳng + dòng tổng cho Excel/PDF. */
  function toRows(vm) {
    var out = vm.rows.map(function (r) { var o = {}; vm.cols.forEach(function (c) { o[c.label] = r[c.key]; }); return o; });
    if (vm.rows.length) { var t = {}; vm.cols.forEach(function (c, i) { t[c.label] = i === 0 ? "TỔNG CỘNG" : (vm.tong[c.key] != null ? vm.tong[c.key] : ""); }); out.push(t); }
    return out;
  }
  var api = { TYPES: TYPES, KHONG_CAN_CHOT: KHONG_CAN_CHOT, build: build, toRows: toRows, upper: upper };
  if (isNode) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.payrollReports = api; }
})(typeof window !== "undefined" ? window : this);
