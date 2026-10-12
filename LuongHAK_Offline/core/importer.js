// ===== CORE / IMPORTER — lập kế hoạch nhập dữ liệu (xem trước) rồi mới ghi =====
// Mỗi dòng được phân loại: add (thêm mới) · update (cập nhật theo khóa) · duplicate (trùng y hệt / trùng trong file)
// · invalid (thiếu/sai kiểu) · refError (Mã NV không có trong Nhân sự) · locked (thuộc kỳ lương đã chốt).
(function (root) {
  "use strict";
  var V = (typeof module !== "undefined" && module.exports) ? require("./validate.js") : root.HAKCore.validate;

  // Khóa nghiệp vụ của từng bảng: cùng khóa = cùng 1 bản ghi → CẬP NHẬT thay vì thêm dòng trùng.
  // null = không có khóa tự nhiên → chỉ chặn dòng trùng y hệt.
  var KEYS = {
    chamcong: ["Kỳ", "Mã NV", "Hình thức công"],
    sanluong: ["Phiếu cân", "Mã NV"], bandam: ["Phiếu cân", "Mã NV"],
    tiencom: ["Ngày", "Mã NV"], psluong: null, ungluong: null,
    dm_luong: ["Mã lương", "Hiệu lực từ"], dm_phucap: ["Mã phụ cấp", "Hiệu lực từ"], dm_tangca: ["Mã tăng ca", "Hiệu lực từ"],
    dm_hotro: ["Mã hỗ trợ", "Hiệu lực từ"], dm_baohiem: ["Mã bảo hiểm", "Hiệu lực từ"], dm_tncn: ["Mã thuế TNCN", "Hiệu lực từ"],
    dm_bacthue: ["Bậc", "Hiệu lực từ"], dm_giamtru: ["Mã giảm trừ", "Hiệu lực từ"], dm_phongban: ["Mã phòng ban"], dm_chucvu: ["Mã chức vụ"],
    dm_cc: ["Mã CC", "Hình thức công"],
    nhanvien: ["Mã NV"], canhan: ["Mã NV", "Hiệu lực từ"], thanhtoan: ["Mã NV", "Hiệu lực từ"], nhanthan: ["Mã NV", "Họ tên nhân thân"],
    hopdong: ["Mã NV", "Số HĐLĐ"], chitiethd: ["Mã NV", "Số HĐLĐ", "Hiệu lực từ"], congtac: ["Mã NV", "Từ ngày"],
    hocvan: ["Mã NV", "Bằng cấp", "Ngày cấp bằng"], quyenloiphep: ["Mã NV", "Số HĐLĐ", "Năm áp dụng"],
    nghiphep: ["Mã NV", "Số HĐLĐ", "Từ ngày"], nghiom: ["Mã NV", "Số HĐLĐ", "Từ ngày"]
  };
  // Cột bắt buộc khi nhập
  var REQUIRED = {
    chamcong: ["Mã NV", "Kỳ"], tiencom: ["Mã NV", "Ngày"], psluong: ["Mã NV", "Ngày hạch toán"], ungluong: ["Mã NV", "Ngày hạch toán", "Tạm ứng"],
    sanluong: ["Ngày cân", "KL hàng (Tấn)"], bandam: ["Ngày cân", "KL hàng (Tấn)"],
    nhanvien: ["Mã NV", "Họ và tên"], hopdong: ["Mã NV", "Số HĐLĐ", "Ngày vào làm"], chitiethd: ["Mã NV", "Số HĐLĐ", "Hiệu lực từ"]
  };
  var HR_SUB = { canhan: 1, hocvan: 1, nhanthan: 1, thanhtoan: 1, suckhoe: 1, lienhe: 1, nghenghiep: 1, congtac: 1, hopdong: 1, chitiethd: 1, khamsk: 1, quyenloiphep: 1, nghiphep: 1, nghiom: 1, noiquy: 1, khenthuong: 1, tailieu: 1 };
  var MONTHLY = { chamcong: 1, sanluong: 1, bandam: 1, psluong: 1, ungluong: 1, tiencom: 1 };

  function keyOf(table, r) {
    var k = KEYS[table]; if (!k) return null;
    var parts = k.map(function (c) { return String(r[c] == null ? "" : r[c]).trim(); });
    if (parts.every(function (p) { return !p; })) return null;
    if (table === "sanluong" || table === "bandam") { if (!parts[0]) return null; } // không có số phiếu → không dùng khóa
    return parts.join("\u0001");
  }
  function fingerprint(cols, r) { return cols.map(function (c) { return String(r[c] == null ? "" : r[c]); }).join("\u0001"); }

  /**
   * Lập kế hoạch nhập.
   * @param db toàn bộ dữ liệu hiện có
   * @param table tên bảng
   * @param cols danh sách cột hợp lệ của bảng
   * @param rawRows mảng object đọc từ Excel (tên cột → giá trị thô)
   * @param opts { lockedPeriods: {"2026-09":true}, defaultKy: "2026-09", extraEmployees: {"NV001":true} }
   */
  function plan(db, table, cols, rawRows, opts) {
    opts = opts || {};
    var locked = opts.lockedPeriods || {}, items = [], seenKey = {}, seenFp = {};
    var existing = db[table] || [], byKey = {}, byFp = {};
    existing.forEach(function (r, i) { var k = keyOf(table, r); if (k) byKey[k] = r; byFp[fingerprint(cols, r)] = r; });
    var emp = {}; (db.nhanvien || []).forEach(function (n) { emp[n["Mã NV"]] = 1; });
    Object.keys(opts.extraEmployees || {}).forEach(function (k) { emp[k] = 1; });
    var needRef = MONTHLY[table] || HR_SUB[table];

    (rawRows || []).forEach(function (src, idx) {
      var r = {}, errs = [], has = false;
      Object.keys(src).forEach(function (h0) {
        var c = String(h0).trim();
        if (/^\d$/.test(c) && cols.indexOf("0" + c) >= 0) c = "0" + c;
        if (cols.indexOf(c) < 0) return;
        var raw = src[h0]; if (raw === "" || raw == null) { r[c] = ""; return; }
        var n = V.normCell(c, raw); r[c] = n.value; has = true;
        if (n.error) errs.push(c + ": " + n.error + " (\"" + raw + "\")");
      });
      if (!has) return; // dòng trống
      if (table === "chamcong" && !r["Kỳ"] && opts.defaultKy) r["Kỳ"] = opts.defaultKy;
      if (table === "nhanvien" && !r["Trạng thái"]) r["Trạng thái"] = "Đang làm việc";
      var item = { line: idx + 2, row: r, action: "add", reason: "" };
      (REQUIRED[table] || []).forEach(function (c) { if (!r[c]) errs.push("Thiếu " + c); });
      if (errs.length) { item.action = "invalid"; item.reason = errs.join("; "); items.push(item); return; }
      if (needRef && r["Mã NV"] && !emp[r["Mã NV"]]) { item.action = "refError"; item.reason = "Mã NV " + r["Mã NV"] + " chưa có trong Nhân sự"; items.push(item); return; }
      var p = V.rowPeriod(table, r);
      if (p && locked[p]) { item.action = "locked"; item.reason = "Thuộc kỳ " + p + " đã chốt lương"; items.push(item); return; }
      var k = keyOf(table, r), fp = fingerprint(cols, r);
      if (k && seenKey[k]) { item.action = "duplicate"; item.reason = "Trùng khóa với dòng " + seenKey[k] + " trong cùng file"; items.push(item); return; }
      if (!k && seenFp[fp]) { item.action = "duplicate"; item.reason = "Trùng y hệt dòng " + seenFp[fp] + " trong cùng file"; items.push(item); return; }
      if (k) seenKey[k] = item.line; else seenFp[fp] = item.line;
      if (k && byKey[k]) {
        var tgt = byKey[k];
        // khi cập nhật: kỳ của bản ghi hiện có cũng không được thuộc kỳ đã chốt
        var p0 = V.rowPeriod(table, tgt); if (p0 && locked[p0]) { item.action = "locked"; item.reason = "Bản ghi hiện có thuộc kỳ " + p0 + " đã chốt"; items.push(item); return; }
        var same = Object.keys(r).every(function (c) { return String(tgt[c] == null ? "" : tgt[c]) === String(r[c]); });
        item.action = same ? "duplicate" : "update"; item.target = tgt; item.reason = same ? "Đã có, giống hệt" : "Cập nhật bản ghi đã có (" + KEYS[table].join(" + ") + ")";
      } else if (!k && byFp[fp]) { item.action = "duplicate"; item.reason = "Đã có dòng giống hệt"; }
      items.push(item);
    });
    var sum = { add: 0, update: 0, duplicate: 0, invalid: 0, refError: 0, locked: 0 };
    items.forEach(function (it) { sum[it.action]++; });
    return { table: table, items: items, summary: sum };
  }

  /** Ghi kế hoạch vào db (chỉ add + update). makeId: hàm sinh _id cho bảng nhân sự. Trả số dòng đã ghi. */
  function apply(db, p, makeId, isHr) {
    var n = 0; db[p.table] = db[p.table] || [];
    p.items.forEach(function (it) {
      if (it.action === "add") { var r = Object.assign({}, it.row); if (isHr && !r._id && makeId) r._id = makeId(); db[p.table].push(r); n++; }
      else if (it.action === "update") { Object.assign(it.target, it.row); n++; }
    });
    return n;
  }

  var LABEL = { add: "Thêm mới", update: "Cập nhật", duplicate: "Trùng (bỏ qua)", invalid: "Lỗi dữ liệu", refError: "Sai tham chiếu", locked: "Kỳ đã chốt" };
  var api = { KEYS: KEYS, REQUIRED: REQUIRED, keyOf: keyOf, plan: plan, apply: apply, LABEL: LABEL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.importer = api; }
})(typeof window !== "undefined" ? window : this);
