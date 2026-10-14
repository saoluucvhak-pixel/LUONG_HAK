// ===== UI / SLIP-XLSX — Excel PHIẾU LƯƠNG theo bố cục in riêng (V10) =====
// Sheet "Phiếu lương": mỗi nhân viên là một phiếu (khối tiêu đề công ty, tên phiếu, thông tin NV, bảng khoản mục - số tiền, THỰC LĨNH, chữ ký),
// A4 dọc, ngắt trang sau mỗi `perPage` phiếu (1 = mỗi phiếu một trang; 2 = in gọn). Sheet "Dữ liệu" giữ bảng thô để đối chiếu.
// Chỉ ĐỌC số đã tính/đã chốt, không tính lại tiền. Mã NV luôn là chữ.
(function (root) {
  "use strict";
  var THIN = { style: "thin", color: { argb: "FF9AA79F" } }, BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
  var FILL = "FFE8F0E8", TOT = "FFF4F4F4";
  function build(X, vm, o) {
    o = o || {};
    var perPage = o.perPage === 2 ? 2 : 1;
    var wb = new X.Workbook(); wb.creator = o.nguoiLap || "Tính lương HAK"; wb.created = new Date();
    var ws = wb.addWorksheet("Phiếu lương");
    ws.getColumn(1).width = 8; ws.getColumn(2).width = 40; ws.getColumn(3).width = 20; ws.getColumn(4).width = 26;
    var r = 1, count = 0, breaks = [];
    var put = function (row, col, v, st) { var c = ws.getCell(row, col); c.value = v; if (st) Object.assign(c, st); return c; };
    var merge = function (row) { ws.mergeCells("A" + row + ":D" + row); };
    (vm.slips || []).forEach(function (s) {
      put(r, 1, vm.congTy || "", { font: { bold: true, size: 11 } }); merge(r); r++;
      put(r, 1, "PHIẾU LƯƠNG " + String(vm.kyText || "").toUpperCase(), { font: { bold: true, size: 15 }, alignment: { horizontal: "center", vertical: "middle" } }); merge(r); ws.getRow(r).height = 26; r++;
      if (vm.trangThai) { put(r, 1, vm.trangThai, { font: { italic: true, size: 9 }, alignment: { horizontal: "center" } }); merge(r); r++; }
      put(r, 1, "Họ và tên: " + (s.hoTen || ""), { font: { bold: true } }); ws.mergeCells("A" + r + ":C" + r);
      var cm = put(r, 4, s.maNV || "", { alignment: { horizontal: "left" } }); cm.numFmt = "@"; cm.value = "Mã NV: " + String(s.maNV || ""); r++;
      put(r, 1, "Phòng ban: " + (s.phongBan || "—")); ws.mergeCells("A" + r + ":C" + r);
      put(r, 4, "Công chuẩn: " + (s.congChuan == null ? "" : s.congChuan)); r++;
      put(r, 1, "Tổng công: " + (s.tongCong == null ? "" : s.tongCong) + (s.sanLuong ? " · Sản lượng: " + s.sanLuong + " tấn" : ""), { font: { size: 10, color: { argb: "FF59665B" } } }); merge(r); r++;
      ["STT", "Khoản mục", "Số tiền (VND)", "Ghi chú"].forEach(function (t, i) {
        var c = put(r, i + 1, t, { font: { bold: true }, alignment: { horizontal: "center", vertical: "middle" }, border: BORDER }); c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL } };
      });
      r++;
      var stt = 0;
      (s.lines || []).forEach(function (l) {
        var tot = !!l.tot;
        if (!tot) stt++;
        var a = put(r, 1, tot ? "" : stt, { alignment: { horizontal: "center" }, border: BORDER });
        var b = put(r, 2, l.label, { font: { bold: tot }, border: BORDER });
        var c = put(r, 3, Math.round(+l.value || 0), { font: { bold: tot }, border: BORDER, alignment: { horizontal: "right" } }); c.numFmt = "#,##0;[Red]-#,##0";
        var d = put(r, 4, l.note || "", { border: BORDER, font: { size: 9 } });
        if (tot) [a, b, c, d].forEach(function (x) { x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOT } }; });
        r++;
      });
      r++;
      put(r, 2, "Người lập", { font: { bold: true }, alignment: { horizontal: "center" } }); put(r, 3, "Người nhận", { font: { bold: true }, alignment: { horizontal: "center" } }); ws.mergeCells("C" + r + ":D" + r); r++;
      put(r, 2, "(Ký, ghi rõ họ tên)", { font: { italic: true, size: 9 }, alignment: { horizontal: "center" } }); put(r, 3, "(Ký, ghi rõ họ tên)", { font: { italic: true, size: 9 }, alignment: { horizontal: "center" } }); ws.mergeCells("C" + r + ":D" + r); r += 3;
      count++;
      if (count % perPage === 0 && count < (vm.slips || []).length) { breaks.push(r - 1); }
      else r += 1;
    });
    breaks.forEach(function (row) { ws.getRow(row).addPageBreak(); });
    ws.pageSetup = { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
    ws.headerFooter = { oddFooter: "&L" + (vm.congTy || "") + "&RTrang &P / &N" };
    // sheet dữ liệu thô — để đối chiếu / lọc
    var raw = wb.addWorksheet(o.rawName || "Dữ liệu");
    var cols = vm.rawCols || [];
    raw.addRow(cols).font = { bold: true };
    (vm.rawRows || []).forEach(function (row) { raw.addRow(cols.map(function (c) { var v = row[c]; return v == null ? "" : (c === "Mã NV" ? String(v) : v); })); });
    cols.forEach(function (c, i) { raw.getColumn(i + 1).width = Math.max(10, Math.min(28, String(c).length + 3)); if (c === "Mã NV") raw.getColumn(i + 1).numFmt = "@"; });
    raw.views = [{ state: "frozen", ySplit: 1 }];
    return wb;
  }
  var api = { build: build };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.HAKUi = root.HAKUi || {}; root.HAKUi.slipXlsx = api; }
})(typeof window !== "undefined" ? window : this);
