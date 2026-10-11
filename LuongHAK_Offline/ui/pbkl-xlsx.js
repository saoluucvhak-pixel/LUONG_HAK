// ===== UI / PBKL-XLSX — biểu mẫu Excel "Phân bổ khối lượng tính lương" (2.0-α19) =====
// Bố cục, màu, khối tiêu đề, khối chữ ký và các sheet GIỐNG công cụ "Phân bổ khối lượng tính lương" của HAK
// (chủ sở hữu duyệt: "làm như công cụ và biểu mẫu cũng như công cụ"). Dùng ExcelJS 4.4.0 (exceljs.min.js, MIT).
// Chỉ ĐỌC kết quả đã tính (phân bổ + bảng lương) — không tính lại tiền.
(function (root) {
  "use strict";
  var PAL = { header: "FF2F6E4F", headerText: "FFFFFFFF", title: "FF1F4E37", subtitle: "FF59665B", total: "FFE3E8DA", dept: "FFDCE8DE", warnRow: "FFF3E3CD", border: "FFD3DCC7", zebra: "FFF6F8F1" };
  var THIN = { style: "thin", color: { argb: PAL.border } }, BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN }, FONT = "Calibri";
  function r2(n) { return Math.round((n || 0) * 100) / 100; }
  function r3(n) { return Math.round((n || 0) * 1000) / 1000; }
  function dmy(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] + "/" + m[1] : String(iso || ""); }
  function dm(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + "/" + m[2] : String(iso || ""); }
  function lines(text, width, size) { var cpl = Math.max(10, Math.floor(width * 7 / (size * 0.85))); return Math.max(1, Math.ceil(String(text || "").length / cpl)); }
  function widths(ws, w) { w.forEach(function (x, i) { ws.getColumn(i + 1).width = x; }); }

  function title(ws, cols, text, meta) {
    var full = (meta.donVi ? String(meta.donVi).toUpperCase() + " — " : "") + text, tw = 0;
    for (var c = 1; c <= cols; c++) tw += ws.getColumn(c).width || 10;
    var fs = 14, n = lines(full, tw, fs);
    if (n > 2) { fs = 12; n = lines(full, tw, fs); }
    if (n > 3) { fs = 11; n = lines(full, tw, fs); }
    ws.mergeCells(1, 1, 1, cols);
    var t = ws.getCell(1, 1); t.value = full; t.font = { name: FONT, bold: true, size: fs, color: { argb: PAL.title } }; t.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    ws.getRow(1).height = Math.max(24, n * (fs + 9));
    var sub = [];
    if (meta.thang) sub.push("Kỳ báo cáo: " + meta.thang);
    sub.push("Xuất lúc: " + (meta.luc || new Date().toLocaleString("vi-VN")));
    if (meta.nguoiLap) sub.push("Người lập: " + meta.nguoiLap);
    var st = sub.join("   •   ");
    ws.mergeCells(2, 1, 2, cols);
    var s = ws.getCell(2, 1); s.value = st; s.font = { name: FONT, italic: true, size: 10, color: { argb: PAL.subtitle } }; s.alignment = { horizontal: "center", wrapText: true };
    ws.getRow(2).height = Math.max(16, lines(st, tw, 10) * 15);
    return 4;
  }
  function head(row, cols) {
    for (var c = 1; c <= cols; c++) { var x = row.getCell(c); x.font = { name: FONT, bold: true, size: 10, color: { argb: PAL.headerText } }; x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PAL.header } }; x.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; x.border = BORDER; }
    row.height = 30;
  }
  function data(row, cols, o) {
    o = o || {};
    for (var c = 1; c <= cols; c++) {
      var x = row.getCell(c); x.border = BORDER; x.font = { name: FONT, size: 10, bold: !!o.bold, italic: !!o.italic };
      var fill = o.fill || (o.zebra && row.number % 2 === 0 ? PAL.zebra : null);
      if (fill) x.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      if (o.text && o.text.indexOf(c) >= 0) x.alignment = { horizontal: "left", vertical: "middle" };
      else { x.alignment = { horizontal: "center", vertical: "middle" }; if (o.num && o.num.indexOf(c) >= 0) { x.numFmt = o.fmt || "#,##0.00"; x.alignment.horizontal = "right"; } }
    }
  }
  function sign(ws, cols, r, nguoiLap) {
    var half = Math.max(1, Math.floor(cols / 2));
    ws.mergeCells(r, 1, r, cols);
    var d = ws.getCell(r, 1); d.value = "……, ngày ….. tháng ….. năm ……….."; d.font = { name: FONT, italic: true, size: 10 }; d.alignment = { horizontal: "right" };
    var r2_ = r + 1;
    ws.mergeCells(r2_, 1, r2_, half); if (half + 1 <= cols) ws.mergeCells(r2_, half + 1, r2_, cols);
    ws.getCell(r2_, 1).value = "NGƯỜI LẬP BẢNG"; if (half + 1 <= cols) ws.getCell(r2_, half + 1).value = "GIÁM ĐỐC / TRƯỞNG ĐƠN VỊ";
    [ws.getCell(r2_, 1), ws.getCell(r2_, Math.min(cols, half + 1))].forEach(function (c) { c.font = { name: FONT, bold: true, size: 10.5 }; c.alignment = { horizontal: "center" }; });
    var r3_ = r2_ + 4; ws.mergeCells(r3_, 1, r3_, half);
    ws.getCell(r3_, 1).value = nguoiLap || ""; ws.getCell(r3_, 1).font = { name: FONT, italic: true, size: 10 }; ws.getCell(r3_, 1).alignment = { horizontal: "center" };
    return r3_;
  }
  function pageLand(ws) { ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }; }

  // ---------- Biểu mẫu nhập (file mẫu) ----------
  /** File mẫu phiếu cân (kind "sanluong") / bơm dăm ("bandam") — cột, ví dụ, định dạng như công cụ. App đọc lại được bằng ⬆ Nhập Excel. */
  function template(ExcelJS, kind, meta) {
    var bd = kind === "bandam", wb = new ExcelJS.Workbook(), cols = 8;
    wb.creator = "Tính Lương HAK";
    var ws = wb.addWorksheet(bd ? "Bom ban dam" : "Khoi luong");
    widths(ws, [10, 12, 12, 10, 10, 15, 12, 26]);
    var h = title(ws, cols, bd ? "MẪU BẢNG BƠM/BAN DĂM" : "MẪU BẢNG KHỐI LƯỢNG (PHIẾU CÂN)", meta || {});
    var hr = ws.getRow(h);
    hr.values = bd ? ["Phiếu", "Ngày", "Biển số", "Cân lần 1", "Cân lần 2", "Số xe", "Mã phòng ban", "NV vắng"] : ["Phiếu cân", "Ngày cân 1", "Biển số 1", "Cân lần 1", "Cân lần 2", "KL hàng (Tấn)", "Mã phòng ban", "NV vắng"];
    head(hr, cols); ws.views = [{ state: "frozen", ySplit: h }];
    var ky = (meta && meta.mau) || "01/06/2026";
    var sample = bd ? [[201, ky, "43A-97033", "", "", 1, "02.02", "Kiểu, Long, Lynh, Định"], [202, ky, "92K-9181", "", "", 1, "02.02", ""], [203, ky, "92C-07490", "", "", 1, "02.01", ""]]
      : [[4979, ky, "43A-97033", 7540, 4410, 3.13, "02.02", "Kiểu, Long, Lynh, Định"], [4980, ky, "92K-9181", 13770, 4660, 9.11, "02.02", ""], [4987, ky, "92C-07490", 22160, 6050, 16.11, "02.01", ""]];
    var r = h + 1;
    sample.forEach(function (v) {
      var row = ws.getRow(r); row.values = v; data(row, cols, { zebra: true, text: [2, 3, 7, 8], num: [6] });
      [1, 4, 5].forEach(function (ci) { row.getCell(ci).alignment = { horizontal: "right", vertical: "middle" }; row.getCell(ci).numFmt = "0"; });
      row.getCell(6).numFmt = bd ? "0" : "#,##0.00"; r++;
    });
    // ghi chú ở dòng 3 (trên dòng tiêu đề cột) để app / công cụ đọc file không coi là 1 phiếu
    ws.mergeCells(3, 1, 3, cols);
    var note = ws.getCell(3, 1);
    note.value = "Ghi chú: mỗi dòng 1 phiếu. 'Mã phòng ban' = tổ nhận phiếu (theo Danh mục phòng ban / phụ lục lương của nhân viên). 'NV vắng' = tên cuối (VD: Long, Định) hoặc Mã NV của người vắng — phiếu chia ĐỀU cho người còn lại của tổ đang làm việc ngày đó. Muốn giao phiếu cho đúng 1 người: thêm cột 'Mã NV'. Xóa các dòng ví dụ trước khi nhập.";
    note.font = { name: FONT, italic: true, size: 9.5, color: { argb: PAL.subtitle } }; note.alignment = { wrapText: true, vertical: "top" }; ws.getRow(3).height = 48;
    return wb;
  }

  // ---------- File kết quả ----------
  function deptSummary(wb, name, ttl, res, meta, lab) {
    lab = lab || ["Tổng khối lượng (tấn)", "Chưa phân bổ (tấn)"];
    var cols = 5, ws = wb.addWorksheet(name); ws.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    widths(ws, [14, 28, 12, 20, 16]);
    var h = title(ws, cols, ttl, meta), hr = ws.getRow(h); hr.values = ["Mã phòng ban", "Tên phòng ban", "Số nhân sự", lab[0], lab[1]]; head(hr, cols); ws.views = [{ state: "frozen", ySplit: h }];
    var r = h + 1, g1 = 0, g2 = 0, g3 = 0;
    Object.keys(res.byDept).sort().forEach(function (d) {
      var x = res.byDept[d], n = res.empCount ? res.empCount[d] || 0 : 0, row = ws.getRow(r);
      row.values = [d, x.tenPB, n, r2(x.total), r2(x.unallocated)]; data(row, cols, { zebra: true, text: [1, 2], num: [3, 4, 5] }); row.getCell(3).numFmt = "0";
      g1 += n; g2 += x.total; g3 += x.unallocated; r++;
    });
    var t = ws.getRow(r); t.values = ["TỔNG CỘNG", "", g1, r2(g2), r2(g3)]; ws.mergeCells(r, 1, r, 2); data(t, cols, { bold: true, fill: PAL.total, text: [1, 2], num: [3, 4, 5] }); t.getCell(3).numFmt = "0";
    sign(ws, cols, r + 2, meta.nguoiLap);
  }
  function deptDay(wb, name, ttl, res, meta) {
    var dk = res.dateKeys, cols = 2 + dk.length + 1, ws = wb.addWorksheet(name); pageLand(ws);
    widths(ws, [14, 28].concat(dk.map(function () { return 8.5; }), [14]));
    var h = title(ws, cols, ttl, meta), hr = ws.getRow(h); hr.values = ["Mã phòng ban", "Tên phòng ban"].concat(dk.map(dm), ["Tổng cộng"]); head(hr, cols); ws.views = [{ state: "frozen", xSplit: 2, ySplit: h }];
    var num = []; for (var c = 3; c <= cols; c++) num.push(c);
    var r = h + 1, g = dk.map(function () { return 0; }), ga = 0;
    Object.keys(res.byDept).sort().forEach(function (d) {
      var x = res.byDept[d], v = [d, x.tenPB];
      dk.forEach(function (k, i) { var a = x.byDay[k] || 0; g[i] += a; v.push(r2(a)); });
      v.push(r2(x.total)); ga += x.total;
      var row = ws.getRow(r); row.values = v; data(row, cols, { zebra: true, text: [1, 2], num: num }); r++;
    });
    var t = ws.getRow(r); t.values = ["TỔNG CỘNG", ""].concat(g.map(r2), [r2(ga)]); ws.mergeCells(r, 1, r, 2); data(t, cols, { bold: true, fill: PAL.total, text: [1, 2], num: num });
  }
  function empDay(wb, name, ttl, res, meta) {
    var dk = res.dateKeys, cols = 4 + dk.length + 1, ws = wb.addWorksheet(name); pageLand(ws);
    widths(ws, [14, 24, 14, 22].concat(dk.map(function () { return 8.5; }), [14]));
    var h = title(ws, cols, ttl, meta), hr = ws.getRow(h); hr.values = ["Mã phòng ban", "Tên phòng ban", "Mã nhân viên", "Họ và tên"].concat(dk.map(dm), ["Tổng cộng"]); head(hr, cols); ws.views = [{ state: "frozen", xSplit: 4, ySplit: h }];
    var num = []; for (var c = 5; c <= cols; c++) num.push(c);
    var r = h + 1, ga = 0, emps = Object.keys(res.byEmp).map(function (k) { return res.byEmp[k]; });
    Object.keys(res.byDept).sort().forEach(function (d) {
      var inD = emps.filter(function (e) { return e.maPB === d; }).sort(function (a, b) { return b.total - a.total; });
      if (!inD.length) return;
      var dr = ws.getRow(r); dr.values = [d, res.byDept[d].tenPB, "", ""].concat(dk.map(function () { return ""; }), [r2(inD.reduce(function (a, e) { return a + e.total; }, 0))]);
      ws.mergeCells(r, 3, r, 4); data(dr, cols, { bold: true, fill: PAL.dept, text: [1, 2, 3, 4], num: [cols] }); r++;
      inD.forEach(function (e) {
        var v = ["", "", e.ma || "", e.hoTen]; dk.forEach(function (k) { v.push(r2(e.byDay[k] || 0)); }); v.push(r2(e.total));
        var row = ws.getRow(r); row.values = v; data(row, cols, { zebra: true, text: [1, 2, 3, 4], num: num }); ga += e.total; r++;
      });
    });
    var t = ws.getRow(r); t.values = ["TỔNG CỘNG", "", "", ""].concat(dk.map(function () { return ""; }), [r2(ga)]); ws.mergeCells(r, 1, r, 4); data(t, cols, { bold: true, fill: PAL.total, text: [1, 2, 3, 4], num: [cols] });
    sign(ws, cols, r + 2, meta.nguoiLap);
  }
  function auditSheet(wb, name, ttl, res, meta, lab) {
    lab = lab || ["Khối lượng", "KL/người"];
    var cols = 8, ws = wb.addWorksheet(name); pageLand(ws); widths(ws, [12, 12, 12, 16, 12, 14, 40, 34]);
    var h = title(ws, cols, ttl, meta), hr = ws.getRow(h); hr.values = ["Phiếu", "Ngày", "Mã phòng ban", lab[0], "Số người nhận", lab[1], "Danh sách người nhận", "Ghi chú"]; head(hr, cols); ws.views = [{ state: "frozen", ySplit: h }];
    var r = h + 1;
    res.audit.forEach(function (a) {
      var row = ws.getRow(r), bad = !a.soNguoi;
      row.values = [a.phieu, dmy(a.ngay), a.maPB, r2(a.kl), a.soNguoi, a.share ? r3(a.share) : "", a.names.join(", "), a.note];
      data(row, cols, { zebra: !bad && !a.note, fill: bad || (a.note && !/^Giao trực tiếp/.test(a.note)) ? PAL.warnRow : null, text: [2, 7, 8], num: [4, 6] });
      row.getCell(1).alignment = { horizontal: "right", vertical: "middle" }; row.getCell(5).alignment = { horizontal: "right", vertical: "middle" }; row.getCell(5).numFmt = "0";
      r++;
    });
    if (r > h + 1) ws.autoFilter = { from: { row: h, column: 1 }, to: { row: r - 1, column: cols } };
  }
  var CO_CHE = { "daihiep": "theo từng cá nhân — mẫu Đại Hiệp, theo ngày (bậc thang)", "to": "theo bình quân cả tổ", "true": "theo ngày (liên tục — cách cũ của app)", "false": "theo tháng, từng người (cách cũ của app)" };
  function luongSheet(wb, L, meta, bdOn) {
    var hd = ["Mã phòng ban", "Tên phòng ban", "Mã nhân viên", "Họ và tên", "Số công", "Khối lượng (tấn)"], w = [14, 24, 14, 22, 10, 14];
    if (bdOn) { hd.push("Số xe BD"); w.push(10); }
    hd.push("Lương sản lượng"); w.push(16); if (bdOn) { hd.push("Lương ban dăm"); w.push(16); }
    hd.push("Bù lương", "Tổng cộng"); w.push(16, 16);
    var cols = hd.length, ws = wb.addWorksheet("Tien luong va bu luong"); pageLand(ws); widths(ws, w);
    var h = title(ws, cols, "LƯƠNG SẢN LƯỢNG" + (bdOn ? " / LƯƠNG BAN DĂM" : "") + " & BÙ LƯƠNG (cơ chế: " + (CO_CHE[L.coChe] || L.coChe) + ")", meta), hr = ws.getRow(h); hr.values = hd; head(hr, cols); ws.views = [{ state: "frozen", xSplit: 4, ySplit: h }];
    var cSo = 5, cKl = 6, cXe = bdOn ? 7 : 0, cSl = bdOn ? 8 : 7, cBd = bdOn ? 9 : 0, cBu = bdOn ? 10 : 8, cTo = bdOn ? 11 : 9, num = [];
    for (var c = 5; c <= cols; c++) num.push(c);
    var fmtRow = function (row) { row.getCell(cSo).numFmt = "0.0"; row.getCell(cKl).numFmt = "#,##0.00"; if (bdOn) row.getCell(cXe).numFmt = "#,##0.00"; [cSl, cBd, cBu, cTo].forEach(function (k) { if (k) row.getCell(k).numFmt = "#,##0"; }); };
    var r = h + 1, g = { kl: 0, xe: 0, sl: 0, bd: 0, bu: 0, to: 0 }, depts = {};
    L.rows.forEach(function (x) { (depts[x.maPB] = depts[x.maPB] || []).push(x); });
    Object.keys(depts).sort().forEach(function (d) {
      var rows = depts[d].sort(function (a, b) { return b.tong - a.tong; }), dv = new Array(cols).fill("");
      dv[0] = d; dv[1] = rows[0].tenPB || d;
      var dr = ws.getRow(r); dr.values = dv; ws.mergeCells(r, 3, r, 4); data(dr, cols, { bold: true, fill: PAL.dept, text: [1, 2, 3, 4], num: num }); r++;
      rows.forEach(function (x) {
        var v = new Array(cols).fill("");
        v[2] = x.ma || ""; v[3] = x.hoTen; v[cSo - 1] = r2(x.soCong); v[cKl - 1] = r2(x.tan); if (bdOn) v[cXe - 1] = r2(x.xe);
        v[cSl - 1] = Math.round(x.luongSL); if (bdOn) v[cBd - 1] = Math.round(x.luongBD); v[cBu - 1] = Math.round(x.bu); v[cTo - 1] = Math.round(x.tong);
        var row = ws.getRow(r); row.values = v; data(row, cols, { zebra: true, text: [1, 2, 3, 4], num: num }); fmtRow(row);
        g.kl += x.tan; g.xe += x.xe; g.sl += x.luongSL; g.bd += x.luongBD; g.bu += x.bu; g.to += x.tong; r++;
      });
    });
    var tv = new Array(cols).fill(""); tv[0] = "TỔNG CỘNG"; tv[cKl - 1] = r2(g.kl); if (bdOn) tv[cXe - 1] = r2(g.xe); tv[cSl - 1] = Math.round(g.sl); if (bdOn) tv[cBd - 1] = Math.round(g.bd); tv[cBu - 1] = Math.round(g.bu); tv[cTo - 1] = Math.round(g.to);
    var t = ws.getRow(r); t.values = tv; ws.mergeCells(r, 1, r, 4); data(t, cols, { bold: true, fill: PAL.total, text: [1, 2, 3, 4], num: num }); fmtRow(t);
    r += 2;
    if (L.note) { ws.getCell(r, 1).value = "Ghi chú: " + L.note; ws.getCell(r, 1).font = { name: FONT, italic: true, size: 9.5, color: { argb: PAL.subtitle } }; r += 2; }
    sign(ws, cols, r, meta.nguoiLap);
  }
  function rawSheet(wb, name, cols, rows) {
    var ws = wb.addWorksheet(name); widths(ws, cols.map(function () { return 16; }));
    var hr = ws.getRow(1); hr.values = cols; head(hr, cols.length); ws.views = [{ state: "frozen", ySplit: 1 }];
    rows.forEach(function (x, i) { var row = ws.getRow(i + 2); row.values = cols.map(function (c) { return c === "Ngày cân" ? dmy(x[c]) : (x[c] == null ? "" : x[c]); }); data(row, cols.length, { zebra: true, text: cols.map(function (_, j) { return j + 1; }) }); });
  }
  function guide(wb, meta, ctx) {
    var cw = 82, ws = wb.addWorksheet("Huong dan su dung"); ws.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }; widths(ws, [cw]);
    var r = title(ws, 1, "HƯỚNG DẪN SỬ DỤNG FILE BÁO CÁO", meta);
    var H = function (t) { var c = ws.getRow(r).getCell(1); c.value = t; c.font = { name: FONT, bold: true, size: 12, color: { argb: PAL.title } }; ws.getRow(r).height = 20; r++; };
    var P = function (t) { var c = ws.getRow(r).getCell(1); c.value = t; c.font = { name: FONT, size: 10.5 }; c.alignment = { wrapText: true, vertical: "top" }; ws.getRow(r).height = Math.max(16, lines(t, cw, 10.5) * 14); r++; };
    P("File này do app Tính Lương HAK tạo từ dữ liệu phiếu cân và bảng lương của kỳ " + (meta.thang || "") + " — app chạy offline trên máy, không gửi dữ liệu lương đi đâu. Bố cục giống công cụ \"Phân bổ khối lượng tính lương\". Rà soát các cảnh báo (sheet \"Đối soát...\") trước khi dùng để trả lương.");
    r++; H("1. DANH SÁCH CÁC SHEET");
    P("• Tổng hợp phòng ban: tổng khối lượng (tấn) mỗi tổ nhận trong tháng và phần chưa phân bổ được.");
    P("• Phân bổ theo phòng ban: như trên nhưng chia theo từng ngày.");
    P("• Chi tiết công nhân: khối lượng (tấn) từng công nhân nhận, theo ngày và tổng tháng, nhóm theo tổ.");
    P("• Đối soát phiếu cân: từng phiếu — ngày, tổ, chia cho bao nhiêu người, mỗi người bao nhiêu; phiếu ghi Mã NV là \"Giao trực tiếp\".");
    if (ctx.bdOn) P("• Tổng hợp BD / BD - Phòng ban / BD - Công nhân / Đối soát BD: 4 sheet cùng cấu trúc cho BƠM/BAN DĂM — đơn vị là XE, không phải tấn.");
    if (ctx.luongOn) P("• Tiền lương và bù lương: lương sản lượng, lương ban dăm, bù lương, tổng cộng từng công nhân — lấy đúng từ bảng lương của kỳ" + (ctx.chot ? " ĐÃ CHỐT." : " (kỳ CHƯA chốt — số tính tạm)."));
    P("• Dữ liệu - ...: chép lại nguyên dữ liệu phiếu cân của kỳ để đối chiếu.");
    r++; H("2. QUY TẮC PHÂN BỔ KHỐI LƯỢNG / SỐ XE");
    P("Mỗi phiếu ghi Mã phòng ban (tổ): khối lượng (hoặc số xe) CHIA ĐỀU cho công nhân của tổ đang làm việc ngày cân (đã vào làm, chưa nghỉ việc — theo hợp đồng và phụ lục lương trong hồ sơ) và KHÔNG có tên trong cột \"NV vắng\" của phiếu đó (so theo từ cuối của họ tên, không dấu; hoặc Mã NV). Phiếu không tìm được người nhận → \"chưa phân bổ\", có cảnh báo, không bị bỏ sót âm thầm. Phiếu ghi Mã NV → giao trực tiếp cho người đó.");
    if (ctx.luongOn) {
      r++; H("3. CƠ CHẾ TÍNH LƯƠNG");
      P("Đơn giá khối lượng: " + (ctx.giaKl || 0).toLocaleString("vi-VN") + " đ/tấn" + (ctx.bdOn ? "   •   Đơn giá bơm/ban dăm: " + (ctx.giaBd || 0).toLocaleString("vi-VN") + " đ/xe" : "") + "   •   Mức sàn bù lương: " + (ctx.mucSan || 0).toLocaleString("vi-VN") + " đ/ngày công (Danh mục mã lương).");
      if (ctx.coChe === "to") P("Bù lương THEO BÌNH QUÂN CẢ TỔ: tổng tiền sản lượng cả tổ (tấn × đơn giá + xe × đơn giá) ÷ số ngày của tháng (" + ctx.soNgay + ") ÷ số người của tổ = bình quân đ/người/ngày. Nếu bình quân THẤP HƠN mức sàn, người có công BT từ " + ctx.nguong + " công/tháng trở lên được bù (mức sàn − bình quân tổ) × công BT của mình; dưới ngưỡng không được bù.");
      else if (ctx.coChe === "daihiep") P("Bù lương THEO TỪNG CÁ NHÂN, THEO NGÀY (mẫu Đại Hiệp): mỗi ngày có sản lượng, mức tham chiếu = bậc thang công BT ngày đó × mức sàn — ngày thường: công BT < 0,5 → 0; 0,5 – <1 → 0,5; ≥ 1 → 1; Chủ nhật thêm bậc ≥ 1,5 → 1,5 (tương đương 0 / 16,666667 / 33,333333 / 50 tấn với đơn giá 6.000đ, mức sàn 200.000đ). Tiền ngày = MAX(tấn ngày × đơn giá, mức tham chiếu). Bù cả tháng = tổng phần chênh. Không xét ngưỡng công tháng; không áp dụng cho bơm/ban dăm; ngày không có công BT = không có mức tham chiếu.");
      else P("Bù lương theo cách cũ của app: " + (CO_CHE[ctx.coChe] || ctx.coChe) + " (xem Hướng dẫn & Quy chế trong app).");
    }
    r++; H("4. LƯU Ý KHI ĐỐI CHIẾU SỐ LIỆU");
    P("Kiểm tra theo thứ tự: (1) cột \"NV vắng\" trên phiếu cân gốc có ghi đúng, đủ tên người vắng không; (2) mã tổ trên phiếu có đúng với Danh mục phòng ban và phụ lục lương của công nhân không; (3) người nghỉ NGUYÊN NGÀY phải có tên trong NV vắng của TẤT CẢ phiếu của tổ hôm đó — đây là nguyên nhân sai lệch phổ biến nhất.");
    P("Đây là file hỗ trợ kế toán — người phụ trách vẫn cần rà soát trước khi dùng làm căn cứ trả lương chính thức.");
  }
  /**
   * Workbook kết quả như công cụ. d = { sl, bd: kết quả phân bổ (có empCount), raw: { sl:[], bd:[] }, luong: { rows, coChe, note } | null, ctx }
   */
  function report(ExcelJS, d, meta) {
    var wb = new ExcelJS.Workbook(); wb.creator = "Tính Lương HAK — Phân bổ khối lượng"; wb.created = new Date();
    var bdOn = !!(d.bd && d.bd.audit.length);
    guide(wb, meta, Object.assign({ bdOn: bdOn, luongOn: !!d.luong }, d.ctx || {}));
    deptSummary(wb, "Tong hop phong ban", "BẢNG TỔNG HỢP PHÂN BỔ SẢN LƯỢNG THEO PHÒNG BAN", d.sl, meta);
    deptDay(wb, "Phan bo theo phong ban", "PHÂN BỔ SẢN LƯỢNG THEO PHÒNG BAN THEO NGÀY", d.sl, meta);
    empDay(wb, "Chi tiet cong nhan", "PHÂN BỔ SẢN LƯỢNG CHI TIẾT CÔNG NHÂN", d.sl, meta);
    auditSheet(wb, "Doi soat phieu can", "ĐỐI SOÁT PHÂN BỔ THEO TỪNG PHIẾU CÂN", d.sl, meta);
    if (bdOn) {
      deptSummary(wb, "Tong hop BD", "BẢNG TỔNG HỢP PHÂN BỔ BƠM/BAN DĂM THEO PHÒNG BAN", d.bd, meta, ["Tổng số xe", "Chưa phân bổ (xe)"]);
      deptDay(wb, "BD - Phong ban", "PHÂN BỔ BƠM/BAN DĂM THEO PHÒNG BAN THEO NGÀY", d.bd, meta);
      empDay(wb, "BD - Cong nhan", "PHÂN BỔ BƠM/BAN DĂM CHI TIẾT CÔNG NHÂN", d.bd, meta);
      auditSheet(wb, "Doi soat BD", "ĐỐI SOÁT PHÂN BỔ BƠM/BAN DĂM THEO TỪNG PHIẾU", d.bd, meta, ["Số xe", "Xe/người"]);
    }
    if (d.luong) luongSheet(wb, d.luong, meta, bdOn);
    var RC = ["Phiếu cân", "Ngày cân", "Biển số", "Cân lần 1", "Cân lần 2", "KL hàng (Tấn)", "Mã phòng ban", "NV vắng", "Mã NV"];
    rawSheet(wb, "Du lieu - Khoi luong", RC, d.raw.sl || []);
    if (bdOn) rawSheet(wb, "Du lieu - Bom ban dam", RC, d.raw.bd || []);
    return wb;
  }
  var api = { template: template, report: report, PAL: PAL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKUi = root.HAKUi || {}; root.HAKUi.pbkl = api; }
})(typeof window !== "undefined" ? window : this);
