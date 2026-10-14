// ===== UI / REPORT-XLSX — Excel báo cáo lương chuyên nghiệp (V9.4 mục V) =====
// Một sheet cho mỗi báo cáo (chỉ thêm sheet khi thật sự cần). Khối tiêu đề công ty / TÊN BÁO CÁO IN HOA / kỳ / phạm vi lọc / đơn vị tính / ngày lập,
// dòng tiêu đề cột, dòng tổng, khối chữ ký; A4 ngang (A3 khi > 14 cột), vừa chiều ngang trang, lặp dòng tiêu đề khi in, vùng in, đóng băng, AutoFilter.
// Mã NV / số tài khoản / CCCD / MST luôn là CHỮ (không mất số 0 đầu, không thành ký hiệu khoa học).
(function (root) {
  "use strict";
  var TEXT_COLS = /^(Mã NV|Mã nhân viên|Số tài khoản|STK|CCCD|Số CCCD|Mã số thuế|MST|Mã thuế|Số HĐLĐ|Số chứng từ|Mã PB|Mã phòng ban)$/i;
  var FILL = "FFE8F0E8", BORDER = { style: "thin", color: { argb: "FF9AA79F" } };
  function colLetter(i) { var s = ""; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - m) / 26); } return s; }
  /**
   * @param X ExcelJS   @param vm { title, congTy, kyText, phamVi, donVi, ngayLap, trangThai, cols:[{key,label,kind}], rows, tong }
   * @param o { chuKy:[...], tenSheet, nguoiLap }
   */
  function build(X, vm, o) {
    o = o || {};
    var wb = new X.Workbook(); wb.creator = o.nguoiLap || vm.nguoiLap || "Tính lương HAK"; wb.created = new Date();
    var name = String(o.tenSheet || vm.title || "BaoCao").replace(/[\\\/\?\*\[\]:]/g, " ").slice(0, 31).trim() || "BaoCao";
    var ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 0 }] });
    var nc = vm.cols.length, last = colLetter(nc - 1);
    var put = function (r, v, st) { var c = ws.getCell(r, 1); c.value = v; if (st) Object.assign(c, st); };
    var merge = function (r) { if (nc > 1) ws.mergeCells("A" + r + ":" + last + r); };
    var r = 1;
    put(r, vm.congTy || "", { font: { bold: true, size: 11 } }); merge(r); r++;
    put(r, vm.title, { font: { bold: true, size: 15 }, alignment: { horizontal: "center", vertical: "middle" } }); merge(r); ws.getRow(r).height = 26; r++;
    put(r, vm.kyText || "", { font: { bold: true, size: 11 }, alignment: { horizontal: "center" } }); merge(r); r++;
    put(r, "Phạm vi: " + (vm.phamVi || "Toàn bộ") + (vm.trangThai ? " · " + vm.trangThai : ""), { font: { italic: true, size: 10 }, alignment: { horizontal: "center", wrapText: true } }); merge(r); r++;
    put(r, "Đơn vị tính: " + (vm.donVi || "Đồng (VND)") + (vm.ngayLap ? " · Ngày lập: " + vm.ngayLap : ""), { font: { size: 10 }, alignment: { horizontal: "center" } }); merge(r); r++;
    r++;
    var hr = r; ws.getRow(hr).height = 32;
    vm.cols.forEach(function (c, i) {
      var cell = ws.getCell(hr, i + 1); cell.value = c.label;
      cell.font = { bold: true }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILL } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
    });
    r++;
    vm.rows.forEach(function (row) {
      vm.cols.forEach(function (c, i) {
        var cell = ws.getCell(r, i + 1), v = row[c.key];
        if (TEXT_COLS.test(c.label) || c.kind === "text") { cell.value = v == null ? "" : String(v); cell.numFmt = "@"; cell.alignment = { vertical: "middle", wrapText: c.label === "Nội dung" }; }
        else if (c.kind === "money") { cell.value = v === "" || v == null ? null : Math.round(+v); cell.numFmt = "#,##0;[Red]-#,##0"; }
        else { cell.value = v === "" || v == null ? null : +v; cell.numFmt = "#,##0.###"; if (/^STT$/i.test(c.label)) cell.alignment = { horizontal: "center" }; }
        cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
      });
      r++;
    });
    var lastData = r - 1;
    if (vm.rows.length) {
      vm.cols.forEach(function (c, i) {
        var cell = ws.getCell(r, i + 1);
        if (i === 0) cell.value = "TỔNG CỘNG";
        else if (vm.tong && vm.tong[c.key] != null && vm.tong[c.key] !== "") { cell.value = +vm.tong[c.key]; cell.numFmt = c.kind === "money" ? "#,##0" : "#,##0.###"; }
        cell.font = { bold: true }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F4" } }; cell.border = { top: BORDER, left: BORDER, bottom: { style: "double", color: { argb: "FF444444" } }, right: BORDER };
      });
      lastData = r; r++;
    }
    // chữ ký
    r += 1;
    var ck = o.chuKy || ["Người lập", "Kế toán trưởng", "Giám đốc"], per = Math.max(1, Math.floor(nc / ck.length));
    ck.forEach(function (t, i) {
      var c0 = Math.min(nc, i * per + 1), c1 = Math.min(nc, (i + 1) * per);
      if (c1 > c0) ws.mergeCells(r, c0, r, c1);
      var cell = ws.getCell(r, c0); cell.value = t; cell.font = { bold: true }; cell.alignment = { horizontal: "center" };
      if (c1 > c0) ws.mergeCells(r + 1, c0, r + 1, c1);
      var c2 = ws.getCell(r + 1, c0); c2.value = "(Ký, ghi rõ họ tên)"; c2.font = { italic: true, size: 9 }; c2.alignment = { horizontal: "center" };
    });
    var sigEnd = r + 5;
    // độ rộng cột theo nội dung
    vm.cols.forEach(function (c, i) {
      var mx = String(c.label).length; vm.rows.forEach(function (row) { var v = row[c.key]; var L = v == null ? 0 : (c.kind === "money" ? String(Math.round(+v || 0)).length + 3 : String(v).length); if (L > mx) mx = L; });
      ws.getColumn(i + 1).width = /^Ký nhận$/i.test(c.label) ? 20 : Math.max(/^STT$/i.test(c.label) ? 6 : 9, Math.min(c.label === "Nội dung" ? 44 : 32, mx + 2));
    });
    ws.pageSetup = { paperSize: nc > 14 ? 8 : 9, orientation: nc > 6 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 }, printTitlesRow: hr + ":" + hr };
    ws.pageSetup.printArea = "A1:" + last + sigEnd;
    ws.headerFooter = { oddFooter: "&L" + (vm.congTy || "") + " · " + vm.title + "&RTrang &P / &N" };
    ws.views = [{ state: "frozen", xSplit: 0, ySplit: hr, topLeftCell: "A" + (hr + 1) }];
    if (vm.rows.length) ws.autoFilter = { from: { row: hr, column: 1 }, to: { row: lastData - (vm.rows.length ? 1 : 0), column: nc } };
    ws.properties.defaultRowHeight = 18;
    return wb;
  }
  var api = { build: build, colLetter: colLetter };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.HAKUi = root.HAKUi || {}; root.HAKUi.reportXlsx = api; }
})(typeof window !== "undefined" ? window : this);
