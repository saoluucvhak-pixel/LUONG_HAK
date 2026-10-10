// ===== CORE / IMPORTER — lập kế hoạch nhập dữ liệu (xem trước) rồi mới ghi =====
// Mỗi dòng được phân loại: add (thêm mới) · update (cập nhật theo khóa) · duplicate (trùng y hệt / trùng trong file)
// · merged (chấm công: gộp vào dòng cùng khóa trong file) · conflict (cùng khóa nhưng dữ liệu mâu thuẫn — không đoán, không ghi)
// · invalid (thiếu/sai kiểu) · refError (Mã NV không có trong Nhân sự) · locked (thuộc kỳ lương đã chốt).
// Mặc định chế độ "merge": ô để trống trong file KHÔNG xóa dữ liệu đang có (nhập bổ sung an toàn).
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

  // Chuẩn hóa từng phần của khóa để "bt" / "BT" / để trống (engine coi là BT), "2026-9" / "2026-09" được coi là cùng 1 bản ghi
  function keyPart(table, c, v) {
    var s = String(v == null ? "" : v).trim();
    if (table === "chamcong" && c === "Hình thức công") return (s || "BT").toUpperCase();
    if (c === "Kỳ") return V.normKy(s) || s;
    return s;
  }
  function keyOf(table, r) {
    var k = KEYS[table]; if (!k) return null;
    var parts = k.map(function (c) { return keyPart(table, c, r[c]); });
    var raw = k.map(function (c) { return String(r[c] == null ? "" : r[c]).trim(); });
    if (raw.every(function (p) { return !p; })) return null;
    if (table === "sanluong" || table === "bandam") { if (!parts[0]) return null; } // không có số phiếu → không dùng khóa
    return parts.join("\u0001");
  }
  function fingerprint(cols, r) { return cols.map(function (c) { return String(r[c] == null ? "" : r[c]); }).join("\u0001"); }
  function blank(v) { return v === "" || v == null; }
  function str(v) { return v == null ? "" : String(v); }

  /** So sánh dòng nhập r với bản ghi hiện có tgt theo chế độ: merge = chỉ ô có dữ liệu; replace = mọi cột có trong file. */
  function diffRow(tgt, r, mode) {
    var d = { set: [], change: [], clear: [], keep: [] };
    Object.keys(r).forEach(function (c) {
      var a = str(tgt[c]), b = str(r[c]);
      if (a === b) return;
      if (b === "") { if (mode === "replace") d.clear.push(c); else d.keep.push(c); }
      else if (a === "") d.set.push(c); else d.change.push(c + ": " + a + " → " + b);
    });
    return d;
  }
  function diffText(d, mode) {
    var t = [];
    if (d.set.length) t.push("thêm " + d.set.length + " ô");
    if (d.change.length) t.push("sửa " + d.change.length + " ô (" + d.change.slice(0, 4).join("; ") + (d.change.length > 4 ? "; …" : "") + ")");
    if (d.clear.length) t.push("XÓA " + d.clear.length + " ô đang có (" + d.clear.slice(0, 6).join(", ") + (d.clear.length > 6 ? ", …" : "") + ")");
    if (mode !== "replace" && d.keep.length) t.push("giữ " + d.keep.length + " ô đang có vì ô trong file để trống");
    return t.join(" · ");
  }
  /**
   * Gộp 2 dòng chấm công cùng khóa: hợp từng ô ngày. Cùng 1 NGÀY có dữ liệu ở cả 2 dòng → XUNG ĐỘT, kể cả khi bằng nhau
   * (VD 0.5 + 0.5 có thể là 2 buổi hoặc nhập trùng — không đoán, để người dùng quyết định).
   */
  function mergeCells(a, b) {
    var out = Object.assign({}, a), conflicts = [];
    Object.keys(b).forEach(function (c) {
      if (blank(b[c])) return;
      if (blank(out[c])) { out[c] = b[c]; return; }
      if (/^\d\d$/.test(c) || str(out[c]) !== str(b[c])) conflicts.push("ngày " + c + " (" + out[c] + " / " + b[c] + ")");
    });
    return { row: out, conflicts: conflicts };
  }

  /**
   * Lập kế hoạch nhập.
   * @param db toàn bộ dữ liệu hiện có
   * @param table tên bảng
   * @param cols danh sách cột hợp lệ của bảng
   * @param rawRows mảng object đọc từ Excel (tên cột → giá trị thô)
   * @param opts { lockedPeriods: {"2026-09":true}, defaultKy: "2026-09", extraEmployees: {"NV001":true},
   *               mode: "merge" (mặc định — ô trống trong file KHÔNG xóa dữ liệu đang có) | "replace" (ghi đè cả dòng theo file) }
   */
  function plan(db, table, cols, rawRows, opts) {
    opts = opts || {};
    var mode = opts.mode === "replace" ? "replace" : "merge";
    var locked = opts.lockedPeriods || {}, items = [], seenKey = {}, seenFp = {};
    var existing = db[table] || [], byKey = {}, byFp = {};
    existing.forEach(function (r) { var k = keyOf(table, r); if (k) (byKey[k] = byKey[k] || []).push(r); byFp[fingerprint(cols, r)] = r; });
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
      if (table === "chamcong") {
        if (!r["Kỳ"] && opts.defaultKy) r["Kỳ"] = opts.defaultKy;
        r["Hình thức công"] = keyPart(table, "Hình thức công", r["Hình thức công"]);
      }
      if (table === "nhanvien" && !r["Trạng thái"]) r["Trạng thái"] = "Đang làm việc";
      var item = { line: idx + 2, row: r, action: "add", reason: "" };
      (REQUIRED[table] || []).forEach(function (c) { if (!r[c]) errs.push("Thiếu " + c); });
      if (errs.length) { item.action = "invalid"; item.reason = errs.join("; "); items.push(item); return; }
      if (needRef && r["Mã NV"] && !emp[r["Mã NV"]]) { item.action = "refError"; item.reason = "Mã NV " + r["Mã NV"] + " chưa có trong Nhân sự"; items.push(item); return; }
      var p = V.rowPeriod(table, r);
      if (p && locked[p]) { item.action = "locked"; item.reason = "Thuộc kỳ " + p + " đã chốt lương"; items.push(item); return; }
      var k = keyOf(table, r), fp = fingerprint(cols, r);
      if (k && seenKey[k]) {
        var first = seenKey[k];
        if (first.action === "conflict") { item.action = "conflict"; item.reason = "Cùng khóa với dòng " + first.line + " (đang xung đột)"; items.push(item); return; }
        if (table === "chamcong" && fingerprint(cols, first.row) === fp && !first.mergedLines) { item.action = "duplicate"; item.reason = "Trùng y hệt dòng " + first.line + " trong cùng file"; items.push(item); return; }
        if (table === "chamcong") {
          // Nhiều dòng cùng NV + cùng hình thức công trong 1 file (VD: tách nửa tháng) → gộp từng ngày, không bỏ sót công
          var mg = mergeCells(first.row, r);
          if (mg.conflicts.length) {
            item.action = "conflict"; item.reason = "Cùng NV/kỳ/hình thức với dòng " + first.line + " và cùng có công ở: " + mg.conflicts.join(", ") + " — không biết là 2 lần công hay nhập trùng; sửa file (gộp thành 1 dòng) rồi nhập lại";
            first.action = "conflict"; first.reason = "Trùng ngày với dòng " + item.line + ": " + mg.conflicts.join(", ");
            items.push(item); return;
          }
          first.row = mg.row; first.mergedLines = (first.mergedLines || []).concat(item.line);
          item.action = "merged"; item.reason = "Gộp vào dòng " + first.line + " (cùng NV, kỳ, hình thức công)"; items.push(item); return;
        }
        var same0 = fingerprint(cols, first.row) === fp;
        if (same0) { item.action = "duplicate"; item.reason = "Trùng y hệt dòng " + first.line + " trong cùng file"; items.push(item); return; }
        item.action = "conflict"; item.reason = "Cùng khóa (" + KEYS[table].join(" + ") + ") với dòng " + first.line + " nhưng dữ liệu khác — không biết dòng nào đúng";
        first.action = "conflict"; first.reason = "Cùng khóa với dòng " + item.line + " nhưng dữ liệu khác";
        items.push(item); return;
      }
      if (!k && seenFp[fp]) { item.action = "duplicate"; item.reason = "Trùng y hệt dòng " + seenFp[fp] + " trong cùng file"; items.push(item); return; }
      if (k) seenKey[k] = item; else seenFp[fp] = item.line;
      items.push(item);
    });

    // So với dữ liệu đang có (làm sau khi đã gộp các dòng trong file)
    items.forEach(function (item) {
      if (item.action !== "add") return;
      var r = item.row, k = keyOf(table, r);
      if (k && byKey[k]) {
        var tgts = byKey[k];
        if (tgts.length > 1) {
          item.action = "conflict";
          item.reason = "Dữ liệu đang có " + tgts.length + " dòng cùng khóa (" + KEYS[table].join(" + ") + ") — vào Công ty & Sao lưu → Kiểm tra dữ liệu để gộp trước khi nhập";
          return;
        }
        var tgt = tgts[0];
        // khi cập nhật: kỳ của bản ghi hiện có cũng không được thuộc kỳ đã chốt
        var p0 = V.rowPeriod(table, tgt); if (p0 && locked[p0]) { item.action = "locked"; item.reason = "Bản ghi hiện có thuộc kỳ " + p0 + " đã chốt"; return; }
        var d = diffRow(tgt, r, mode);
        item.target = tgt; item.diff = d;
        if (!d.set.length && !d.change.length && !d.clear.length) { item.action = "duplicate"; item.reason = d.keep.length ? "Đã có, không có ô mới (" + d.keep.length + " ô để trống trong file — giữ dữ liệu đang có)" : "Đã có, giống hệt"; }
        else { item.action = "update"; item.reason = "Cập nhật theo " + KEYS[table].join(" + ") + ": " + diffText(d, mode); }
      } else if (!k && byFp[fingerprint(cols, r)]) { item.action = "duplicate"; item.reason = "Đã có dòng giống hệt"; }
      if (item.mergedLines && item.action !== "conflict") item.reason = (item.reason ? item.reason + " · " : "") + "đã gộp dòng " + item.mergedLines.join(", ");
    });
    var sum = { add: 0, update: 0, merged: 0, duplicate: 0, conflict: 0, invalid: 0, refError: 0, locked: 0 };
    items.forEach(function (it) { sum[it.action]++; });
    return { table: table, mode: mode, items: items, summary: sum };
  }

  /** Ghi kế hoạch vào db (chỉ add + update). makeId: hàm sinh _id cho bảng nhân sự. Trả số dòng đã ghi. */
  function apply(db, p, makeId, isHr) {
    var n = 0; db[p.table] = db[p.table] || [];
    p.items.forEach(function (it) {
      if (it.action === "add") { var r = Object.assign({}, it.row); if (isHr && !r._id && makeId) r._id = makeId(); db[p.table].push(r); n++; }
      else if (it.action === "update") {
        Object.keys(it.row).forEach(function (c) { if (p.mode === "replace" || !blank(it.row[c])) it.target[c] = it.row[c]; });
        n++;
      }
    });
    return n;
  }

  var LABEL = { add: "Thêm mới", update: "Cập nhật", merged: "Gộp vào dòng khác", duplicate: "Trùng (bỏ qua)", conflict: "Xung đột (không ghi)", invalid: "Lỗi dữ liệu", refError: "Sai tham chiếu", locked: "Kỳ đã chốt" };
  var api = { KEYS: KEYS, REQUIRED: REQUIRED, keyOf: keyOf, plan: plan, apply: apply, mergeCells: mergeCells, LABEL: LABEL };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.importer = api; }
})(typeof window !== "undefined" ? window : this);
