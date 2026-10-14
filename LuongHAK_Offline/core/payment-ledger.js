// ===== CORE / PAYMENT-LEDGER — sổ thanh toán lương (V9.4 mục IV) =====
// Trạng thái thanh toán sinh từ NGHIỆP VỤ (chứng từ được lập / duyệt / ghi nhận chi), KHÔNG sinh từ việc xuất file.
// Mỗi dòng = một người trong một chứng từ. Số tiền luôn lấy từ "còn phải thanh toán" (thực lĩnh − đã thanh toán − đang chờ chi), không lấy tổng thu nhập.
// Thuần dữ liệu: dùng chung cho giao diện, tiến trình chính và kiểm thử.
(function (root) {
  "use strict";
  var TT = { LAP: "Đã lập", DUYET: "Đã duyệt", TRA: "Đã thanh toán", HUY: "Đã hủy" };
  var HT = { CK: "Chuyển khoản", TM: "Tiền mặt" };
  var COLS = ["Số chứng từ", "Kỳ", "Hình thức", "Mã NV", "Họ và tên", "Số tiền", "Trạng thái", "Ngày lập", "Người lập", "Ngày duyệt", "Người duyệt", "Ngày thanh toán", "Người ghi nhận", "Ghi chú", "Lý do hủy"];
  function n(v) { var x = +v; return isFinite(x) ? x : 0; }
  function s(v) { return v == null ? "" : String(v).trim(); }
  function hinhThucCua(httt) { var t = s(httt).toLowerCase(); if (!t) return ""; return /chuy[ểe]n kho[ảa]n|^ck$/.test(t) ? HT.CK : HT.TM; }

  /** Tổng hợp theo (kỳ, NV): đã trả / đang chờ chi. */
  function sums(lines, ky) {
    var m = {};
    (lines || []).forEach(function (l) {
      if (s(l["Kỳ"]) !== ky || l["Trạng thái"] === TT.HUY) return;
      var o = m[l["Mã NV"]] || (m[l["Mã NV"]] = { tra: 0, cho: 0, soCT: 0 });
      if (l["Trạng thái"] === TT.TRA) o.tra += n(l["Số tiền"]); else o.cho += n(l["Số tiền"]);
      o.soCT++;
    });
    return m;
  }
  /** Công nợ thanh toán của từng người trong kỳ. rows = bảng lương (kết quả engine / bản chốt). */
  function outstanding(rows, lines, ky) {
    var sm = sums(lines, ky);
    return (rows || []).map(function (r) {
      var x = sm[r["Mã NV"]] || { tra: 0, cho: 0, soCT: 0 }, tl = n(r["Thực lĩnh"]);
      var conPhaiTra = Math.max(0, tl - x.tra), denghi = Math.max(0, conPhaiTra - x.cho);
      return { maNV: r["Mã NV"], hoTen: r["Họ và tên"], thucLinh: tl, daTra: x.tra, dangCho: x.cho, conPhaiTra: conPhaiTra, deNghiChi: denghi, vuot: x.tra + x.cho > tl,
        trangThai: status(tl, x) };
    });
  }
  /** Chưa lập / Đã lập chứng từ / Thanh toán một phần / Đã thanh toán */
  function status(thucLinh, x) {
    if (thucLinh <= 0) return "Không phát sinh";
    if (x.tra >= thucLinh) return "Đã thanh toán";
    if (x.tra > 0) return "Thanh toán một phần";
    if (x.cho > 0) return "Đã lập chứng từ";
    return "Chưa thanh toán";
  }
  function nextNo(lines, ky, ht) {
    var pre = (ht === HT.CK ? "UNC" : "PC") + "-" + ky.replace("-", "") + "-", mx = 0;
    (lines || []).forEach(function (l) { var t = s(l["Số chứng từ"]); if (t.indexOf(pre) === 0) mx = Math.max(mx, n(t.slice(pre.length))); });
    return pre + ("00" + (mx + 1)).slice(-3);
  }
  /**
   * Lập chứng từ cho một hình thức: chỉ lấy người có HTTT khớp và "đề nghị chi" > 0 (chống lập trùng người đã có chứng từ chưa hủy).
   * ctx: { ky, ht, rows, lines, nguoi, ngay, chot, blockers, ids? (chỉ lập cho các mã NV này) }
   * @returns { ok, msg, so, dong:[...], boQua:[{maNV, ly}] }
   */
  function lapChungTu(ctx) {
    if (!ctx.chot) return { ok: false, msg: "Kỳ " + ctx.ky + " chưa chốt — chỉ lập chứng từ thanh toán chính thức từ bảng lương ĐÃ CHỐT." };
    if (ctx.blockers && ctx.blockers.length) return { ok: false, msg: "Bảng lương còn lỗi chặn: " + ctx.blockers.slice(0, 3).join("; ") };
    var os = outstanding(ctx.rows, ctx.lines, ctx.ky), by = {};
    os.forEach(function (o) { by[o.maNV] = o; });
    var so = nextNo(ctx.lines, ctx.ky, ctx.ht), dong = [], bo = [];
    (ctx.rows || []).forEach(function (r) {
      var ma = r["Mã NV"]; if (ctx.ids && ctx.ids.indexOf(ma) < 0) return;
      var ht = hinhThucCua(r["HTTT"]); if (ht !== ctx.ht) return;
      var o = by[ma];
      if (o.vuot) { bo.push({ maNV: ma, ly: "đã chi/đang chờ vượt thực lĩnh" }); return; }
      if (o.deNghiChi <= 0) { bo.push({ maNV: ma, ly: o.dangCho > 0 ? "đã có chứng từ đang chờ" : "không còn khoản phải trả" }); return; }
      if (ht === HT.CK && (!s(r["Số tài khoản"]) || !s(r["Ngân hàng"]))) { bo.push({ maNV: ma, ly: "thiếu số tài khoản/ngân hàng" }); return; }
      dong.push({ "Số chứng từ": so, "Kỳ": ctx.ky, "Hình thức": ht, "Mã NV": ma, "Họ và tên": r["Họ và tên"], "Số tiền": o.deNghiChi, "Trạng thái": TT.LAP,
        "Ngày lập": ctx.ngay, "Người lập": ctx.nguoi, "Ngày duyệt": "", "Người duyệt": "", "Ngày thanh toán": "", "Người ghi nhận": "", "Ghi chú": "", "Lý do hủy": "" });
    });
    if (!dong.length) return { ok: false, msg: "Không có khoản nào cần lập chứng từ " + ctx.ht.toLowerCase() + " (đã lập đủ hoặc không có người thuộc hình thức này).", boQua: bo };
    return { ok: true, so: so, dong: dong, boQua: bo, tong: dong.reduce(function (a, d) { return a + d["Số tiền"]; }, 0) };
  }
  function dongCua(lines, so) { return (lines || []).filter(function (l) { return l["Số chứng từ"] === so; }); }
  function trangThaiCT(lines, so) { var d = dongCua(lines, so); return d.length ? d[0]["Trạng thái"] : ""; }
  /** Chuyển trạng thái cả chứng từ: lap→duyet (người duyệt ≠ người lập) → tra; hủy chỉ khi chưa thanh toán và phải có lý do. */
  function chuyen(lines, so, to, ctx) {
    var d = dongCua(lines, so); if (!d.length) return { ok: false, msg: "Không thấy chứng từ " + so };
    var cur = d[0]["Trạng thái"];
    if (cur === TT.TRA) return { ok: false, msg: "Chứng từ " + so + " đã thanh toán — khóa, không sửa/hủy. Muốn điều chỉnh phải lập chứng từ điều chỉnh." };
    if (cur === TT.HUY) return { ok: false, msg: "Chứng từ " + so + " đã hủy." };
    if (to === TT.DUYET) {
      if (cur !== TT.LAP) return { ok: false, msg: "Chỉ duyệt được chứng từ ở trạng thái 'Đã lập'." };
      if (s(d[0]["Người lập"]) && s(d[0]["Người lập"]).toLowerCase() === s(ctx.nguoi).toLowerCase()) return { ok: false, msg: "Người duyệt phải khác người lập chứng từ." };
      return { ok: true, patch: { "Trạng thái": TT.DUYET, "Ngày duyệt": ctx.ngay, "Người duyệt": ctx.nguoi } };
    }
    if (to === TT.TRA) {
      if (cur !== TT.DUYET) return { ok: false, msg: "Phải duyệt chứng từ trước khi ghi nhận thanh toán." };
      return { ok: true, patch: { "Trạng thái": TT.TRA, "Ngày thanh toán": ctx.ngayTra || ctx.ngay, "Người ghi nhận": ctx.nguoi } };
    }
    if (to === TT.HUY) {
      if (!s(ctx.lyDo)) return { ok: false, msg: "Hủy chứng từ phải ghi lý do." };
      return { ok: true, patch: { "Trạng thái": TT.HUY, "Lý do hủy": s(ctx.lyDo) } };
    }
    return { ok: false, msg: "Trạng thái không hợp lệ" };
  }
  /** Kiểm tra toàn sổ: vượt thực lĩnh, trùng người trong cùng chứng từ, chứng từ thiếu thông tin. */
  function kiemTra(lines, rowsByKy) {
    var out = [], seen = {}, sm = {};
    (lines || []).forEach(function (l) {
      if (l["Trạng thái"] === TT.HUY) return;
      var k = l["Số chứng từ"] + "|" + l["Mã NV"]; if (seen[k]) out.push("Chứng từ " + l["Số chứng từ"] + ": " + l["Mã NV"] + " xuất hiện 2 lần"); seen[k] = 1;
      if (n(l["Số tiền"]) <= 0) out.push("Chứng từ " + l["Số chứng từ"] + ": số tiền của " + l["Mã NV"] + " không dương");
      var kk = l["Kỳ"] + "|" + l["Mã NV"]; sm[kk] = (sm[kk] || 0) + n(l["Số tiền"]);
    });
    var idx = {};
    Object.keys(sm).forEach(function (kk) {
      var p = kk.split("|"), rows = rowsByKy && rowsByKy[p[0]]; if (!rows) return;
      if (!idx[p[0]]) { idx[p[0]] = {}; rows.forEach(function (x) { if (!(x["Mã NV"] in idx[p[0]])) idx[p[0]][x["Mã NV"]] = x; }); }
      var r = idx[p[0]][p[1]];
      if (r && sm[kk] > n(r["Thực lĩnh"])) out.push("Kỳ " + p[0] + ": " + p[1] + " đã lập/chi " + sm[kk] + " > thực lĩnh " + n(r["Thực lĩnh"]));
    });
    return out;
  }
  var api = { TT: TT, HT: HT, COLS: COLS, hinhThucCua: hinhThucCua, outstanding: outstanding, status: status, lapChungTu: lapChungTu, chuyen: chuyen, kiemTra: kiemTra, dongCua: dongCua, trangThaiCT: trangThaiCT, nextNo: nextNo };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.payledger = api; }
})(typeof window !== "undefined" ? window : this);
