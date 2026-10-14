// ===== BẢNG TÍNH LƯƠNG NỘI BỘ (Master V5) =====
// Chỉ các khoản TÍNH RA thu nhập (công → tiền): lương thời gian, sản lượng, bù, bơm dăm, tăng ca, phụ cấp, hỗ trợ, cơm, thưởng, thu nhập khác.
// KHÔNG có khấu trừ (BH, thuế, tạm ứng, trừ khác) và KHÔNG có thực lĩnh — đó là việc của bảng thanh toán/phiếu lương.
// Đây là view-model thuần (không đụng giao diện) để màn hình, Excel và PDF dùng CHUNG một nguồn số. Không tính lại tiền:
// chỉ lấy số engine đã tính; riêng cột "Kiểm tra" cộng lại các thành phần để bắt lệch với "Tổng thu nhập" của engine.
(function (root) {
  "use strict";
  var RF = (typeof module !== "undefined" && module.exports) ? require("./report-filter.js") : root.HAKCore.reportFilter;

  var INFO = ["Mã NV", "Họ và tên", "Phòng ban", "Công chuẩn", "Tổng công"];
  var MONEY = [
    ["Lương thời gian", "Lương thời gian"], ["Lương phụ", "Lương phụ"], ["Lương sản lượng", "Lương sản lượng"], ["Lương bù SL", "Lương bù SL"],
    ["Lương bơm dăm", "Lương bơm dăm"], ["Tiền tăng ca", "Tăng ca"], ["Phụ cấp", "Phụ cấp"], ["Phụ cấp công tác", "Phụ cấp công tác"],
    ["Lương hỗ trợ", "Hỗ trợ"], ["Tiền cơm", "Tiền cơm"], ["Thưởng", "Thưởng"], ["Thu nhập khác", "Thu nhập khác"]
  ];
  var QTY = [["Sản lượng (tấn)", "Sản lượng (tấn)"], ["Số xe bơm dăm", "Số xe bơm dăm"], ["Công tăng ca", "Công tăng ca"], ["Ngày cơm", "Ngày cơm"]];
  function n(v) { var x = +v; return isFinite(x) ? x : 0; }
  function r3(v) { return Math.round(v * 1000) / 1000; }

  /**
   * @param kq   kết quả engine (kq.bangluong…) — không bị sửa
   * @param opt  { nam, thang, filter: spec, tenCongTy, chot: bool, cheDoBu }
   * @returns { title, ky, congTy, trangThai, loc: [mô tả lọc], cols: [{key,label,kind}], groups: [{ten, rows, tong}], tong, soDong, soDongGoc, kiemTra: {lech:[...]}}
   */
  function build(kq, opt) {
    opt = opt || {};
    var all = (kq && kq.bangluong) || [];
    var f = RF.apply(all, opt.filter);
    // Khoản nào KHÔNG ai có (toàn 0) thì ẩn cột cho bảng gọn — nhưng cột lương thời gian luôn hiện
    var used = function (key) { return f.rows.some(function (r) { return n(r[key]) !== 0; }); };
    var cols = INFO.map(function (k) { return { key: k, label: k, kind: k === "Mã NV" || k === "Họ và tên" || k === "Phòng ban" ? "text" : "qty" }; });
    QTY.forEach(function (q) { if (used(q[0])) cols.push({ key: q[0], label: q[1], kind: "qty" }); });
    MONEY.forEach(function (m) { if (m[0] === "Lương thời gian" || used(m[0])) cols.push({ key: m[0], label: m[1], kind: "money" }); });
    cols.push({ key: "Tổng thu nhập", label: "Tổng thu nhập", kind: "money", strong: true });

    var byPb = {}, order = [];
    f.rows.forEach(function (r) { var p = r["Phòng ban"] || "(Chưa có phòng ban)"; if (!byPb[p]) { byPb[p] = []; order.push(p); } byPb[p].push(r); });
    order.sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
    var sumOf = function (rows) { var t = {}; cols.forEach(function (c) { if (c.kind === "money" || (c.kind === "qty" && c.key !== "Công chuẩn")) t[c.key] = r3(rows.reduce(function (s, r) { return s + n(r[c.key]); }, 0)); }); return t; };
    var groups = order.map(function (p) { return { ten: p, rows: byPb[p].map(function (r) { var o = {}; cols.forEach(function (c) { o[c.key] = r[c.key]; }); o._maNV = r["Mã NV"]; return o; }), tong: sumOf(byPb[p]) }; });

    // Kiểm tra: cộng các thành phần (đủ 12 khoản, kể cả cột đang ẩn) phải bằng "Tổng thu nhập" engine đã tính
    var lech = [];
    f.rows.forEach(function (r) {
      var s = MONEY.reduce(function (t, m) { return t + n(r[m[0]]); }, 0), tt = n(r["Tổng thu nhập"]);
      if (Math.abs(s - tt) > 1) lech.push({ maNV: r["Mã NV"], hoTen: r["Họ và tên"], tongThanhPhan: Math.round(s), tongThuNhap: Math.round(tt) });
    });
    return {
      title: "BẢNG TÍNH LƯƠNG", ky: opt.thang && opt.nam ? ("0" + opt.thang).slice(-2) + "/" + opt.nam : "", congTy: opt.tenCongTy || "",
      trangThai: opt.chot ? "Kỳ đã chốt" : "Tính tạm — kỳ chưa chốt", cheDoBu: opt.cheDoBu || "",
      loc: RF.describe(opt.filter), cols: cols, groups: groups, tong: sumOf(f.rows), soDong: f.kept, soDongGoc: f.total, kiemTra: { lech: lech }
    };
  }

  /** Dòng phẳng cho Excel: [mô tả cột] → mảng object theo nhãn cột, kèm dòng tổng từng phòng ban và tổng cộng. */
  function toRows(vm) {
    var out = [];
    vm.groups.forEach(function (g) {
      g.rows.forEach(function (r) { var o = {}; vm.cols.forEach(function (c) { o[c.label] = r[c.key]; }); out.push(o); });
      var s = {}; vm.cols.forEach(function (c, i) { s[c.label] = i === 1 ? "Cộng " + g.ten : (g.tong[c.key] != null ? g.tong[c.key] : ""); }); out.push(s);
    });
    var t = {}; vm.cols.forEach(function (c, i) { t[c.label] = i === 1 ? "TỔNG CỘNG" : (vm.tong[c.key] != null ? vm.tong[c.key] : ""); }); out.push(t);
    return out;
  }

  /** Dạng phẳng cho builder Excel chuyên nghiệp (ui/report-xlsx.js): từng người, tổng cuối; phạm vi lọc để in trên đầu bảng. */
  function toXlsxVm(vm, extra) {
    var rows = []; vm.groups.forEach(function (g) { g.rows.forEach(function (r) { rows.push(r); }); });
    rows = rows.map(function (r, i) { var o = Object.assign({}, r); o.__i = i + 1; return o; });
    return Object.assign({ title: vm.title, congTy: vm.congTy, kyText: ("THÁNG " + vm.ky).toLocaleUpperCase("vi-VN"), trangThai: vm.trangThai, phamVi: vm.loc && vm.loc.length ? vm.loc.join("; ") : "Toàn bộ",
      donVi: "Đồng (VND)", cols: vm.cols, rows: rows, tong: vm.tong }, extra || {});
  }
  var api = { build: build, toRows: toRows, toXlsxVm: toXlsxVm, MONEY: MONEY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.internalPayroll = api; }
})(typeof window !== "undefined" ? window : this);
