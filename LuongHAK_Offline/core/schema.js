// ===== CORE / SCHEMA — kiểm tra cấu trúc & kiểu dữ liệu của toàn bộ file dữ liệu (không chỉ "JSON hợp lệ") =====
// Nguyên tắc: KHÔNG tự xóa/sửa dữ liệu chưa nhận diện. Chỉ báo cáo để người dùng xử lý.
//  fatal  — cấu trúc sai tới mức mở ra có thể làm mất dữ liệu (bảng không phải danh sách, file của phiên bản mới hơn…)
//           → app chuyển sang chế độ CHỈ XEM / khôi phục, không ghi đè file.
//  error  — dòng dữ liệu sai kiểu/thiếu khóa/tham chiếu sai → bị bỏ qua hoặc tính sai nếu không sửa.
//  info   — bảng lạ không nhận diện → giữ nguyên, không đụng tới.
(function (root) {
  "use strict";
  var V = (typeof module !== "undefined" && module.exports) ? require("./validate.js") : root.HAKCore.validate;
  var CLS = (typeof module !== "undefined" && module.exports) ? require("./payroll-close.js") : root.HAKCore.close;

  var SUPPORTED_SCHEMA = 2;
  var SYSTEM_TABLES = ["congty", "kyluong", "kyluong_lichsu", "auditlog", "nhansu", "nguoidung", "baomat"];
  var SCALAR_KEYS = { schemaVersion: "number" };
  var MONTHLY = ["chamcong", "sanluong", "bandam", "psluong", "ungluong", "tiencom"];

  function typeName(v) { return v === null ? "null" : Array.isArray(v) ? "danh sách" : typeof v === "object" ? "đối tượng" : typeof v; }

  /**
   * @param db dữ liệu đã JSON.parse
   * @param opts { tables: [tên bảng app biết], hrTables: [bảng hồ sơ nhân sự cần Mã NV] }
   * @returns { ok, fatal: [msg], errors: [{table, msg}], info: [msg], stats: {table: số dòng} }
   */
  function validate(db, opts) {
    opts = opts || {};
    var res = { ok: true, fatal: [], errors: [], info: [], stats: {} };
    var err = function (t, m) { res.errors.push({ table: t, msg: m }); };
    if (!db || typeof db !== "object" || Array.isArray(db)) { res.fatal.push("Dữ liệu gốc phải là 1 đối tượng, đang là " + typeName(db)); res.ok = false; return res; }
    var known = {}; (opts.tables || []).concat(SYSTEM_TABLES).forEach(function (t) { known[t] = 1; });

    // Phiên bản cấu trúc
    if (db.schemaVersion != null) {
      if (typeof db.schemaVersion !== "number" || !isFinite(db.schemaVersion)) res.fatal.push("schemaVersion không hợp lệ: " + JSON.stringify(db.schemaVersion));
      else if (db.schemaVersion > SUPPORTED_SCHEMA) res.fatal.push("File dữ liệu của phiên bản MỚI HƠN (cấu trúc " + db.schemaVersion + ", bản này hỗ trợ tới " + SUPPORTED_SCHEMA + "). Hãy cài bản mới — mở bằng bản cũ có thể làm hỏng dữ liệu.");
    }
    Object.keys(db).forEach(function (k) {
      var v = db[k];
      if (SCALAR_KEYS[k]) return;
      if (known[k]) {
        if (!Array.isArray(v)) { res.fatal.push("Bảng '" + k + "' phải là danh sách nhưng đang là " + typeName(v) + " — không mở để tránh mất dữ liệu"); return; }
        res.stats[k] = v.length;
        var bad = 0; v.forEach(function (r) { if (!r || typeof r !== "object" || Array.isArray(r)) bad++; });
        if (bad) err(k, bad + " dòng không phải bản ghi hợp lệ (bị bỏ qua khi xử lý)");
      } else res.info.push("Bảng '" + k + "' không thuộc phiên bản này (" + typeName(v) + ") — giữ nguyên, không xử lý");
    });
    if (res.fatal.length) { res.ok = false; return res; }

    var rows = function (t) { return (db[t] || []).filter(function (r) { return r && typeof r === "object" && !Array.isArray(r); }); };
    // Nhân viên: Mã NV bắt buộc, kiểu chữ
    var emp = {};
    rows("nhanvien").forEach(function (n, i) {
      var ma = n["Mã NV"];
      if (ma == null || String(ma).trim() === "") err("nhanvien", "Dòng " + (i + 1) + ": thiếu Mã NV");
      else if (typeof ma !== "string") err("nhanvien", "Mã NV " + ma + " lưu dạng " + typeName(ma) + " (cần dạng chữ)");
      else if (ma !== ma.trim()) err("nhanvien", "Mã NV '" + ma + "' có khoảng trắng thừa — sẽ không khớp dữ liệu khác");
      if (ma != null) emp[String(ma)] = 1;
    });
    // Kiểu cột: ngày, tiền, kỳ — trên mọi bảng nghiệp vụ
    Object.keys(res.stats).forEach(function (t) {
      if (t === "kyluong" || t === "kyluong_lichsu" || t === "auditlog" || t === "nhansu" || t === "nguoidung" || t === "baomat") return;
      var bd = 0, bm = 0, bk = 0, ex = [];
      rows(t).forEach(function (r) {
        Object.keys(r).forEach(function (c) {
          var v = r[c]; if (v === "" || v == null || c === "_id") return;
          if (c === "Kỳ") { if (!V.normKy(v)) { bk++; if (ex.length < 3) ex.push(c + "=" + v); } return; }
          if (V.isDateCol(c)) { if (V.normDate(v) === null) { bd++; if (ex.length < 3) ex.push(c + "=" + v); } return; }
          if (V.isMoneyCol(c)) { if (isNaN(V.parseMoney(v))) { bm++; if (ex.length < 3) ex.push(c + "=" + v); } }
        });
      });
      if (bd || bm || bk) err(t, (bd ? bd + " ô ngày sai, " : "") + (bm ? bm + " ô tiền không đọc được, " : "") + (bk ? bk + " ô kỳ sai, " : "") + "VD: " + ex.join("; "));
    });
    // Quan hệ: bảng phát sinh + hồ sơ phải trỏ tới nhân viên có thật
    MONTHLY.concat(opts.hrTables || []).forEach(function (t) {
      if (!res.stats[t]) return;
      var miss = {}, noMa = 0;
      rows(t).forEach(function (r) { var m = r["Mã NV"]; if (m == null || m === "") noMa++; else if (!emp[m]) miss[m] = 1; });
      if (noMa && t !== "sanluong" && t !== "bandam") err(t, noMa + " dòng thiếu Mã NV");
      var ks = Object.keys(miss); if (ks.length) err(t, "Mã NV không có trong Nhân sự: " + ks.slice(0, 10).join(", ") + (ks.length > 10 ? "…" : ""));
    });
    // Hợp đồng ↔ phụ lục
    var hd = {}; rows("hopdong").forEach(function (r) { hd[r["Mã NV"] + "|" + r["Số HĐLĐ"]] = 1; });
    var orphan = rows("chitiethd").filter(function (r) { return !hd[r["Mã NV"] + "|" + r["Số HĐLĐ"]]; }).length;
    if (orphan) err("chitiethd", orphan + " phụ lục lương không thuộc hợp đồng nào (Mã NV + Số HĐLĐ)");
    // Kỳ đã chốt: cấu trúc + toàn vẹn
    var seenKy = {};
    rows("kyluong").forEach(function (k) {
      if (!V.normKy(k.ky)) { err("kyluong", "Bản chốt có kỳ không hợp lệ: " + JSON.stringify(k.ky)); return; }
      if (seenKy[k.ky]) err("kyluong", "Kỳ " + k.ky + " có nhiều hơn 1 bản chốt đang hiệu lực");
      seenKy[k.ky] = 1;
      if (!k.kq || !Array.isArray(k.kq.bangluong)) { err("kyluong", "Bản chốt kỳ " + k.ky + " thiếu bảng lương"); return; }
      var v = CLS.verify(k);
      if (v === "modified") err("kyluong", "Bản chốt kỳ " + k.ky + " v" + (k.version || 1) + ": checksum KHÔNG khớp — số liệu đã chốt bị thay đổi ngoài app");
    });
    rows("kyluong_lichsu").forEach(function (k) {
      if (!k.ky || !k.moChot) err("kyluong_lichsu", "Bản ghi lịch sử chốt kỳ " + (k.ky || "?") + " thiếu thông tin mở chốt");
      else if (CLS.verify(k) === "modified") err("kyluong_lichsu", "Bản chốt cũ kỳ " + k.ky + " v" + (k.version || "?") + ": checksum không khớp");
    });
    // Tài khoản: thiếu thông tin đăng nhập, vai trò lạ, không còn Admin hoạt động
    var us = rows("nguoidung");
    us.forEach(function (u) { if (!u.tenDangNhap || !u.hash || !u.salt) err("nguoidung", "Tài khoản " + (u.tenDangNhap || "?") + " thiếu thông tin đăng nhập"); });
    if (us.length && !us.some(function (u) { return u.vaiTro === "admin" && !u.khoa; })) err("nguoidung", "Không còn tài khoản Admin đang hoạt động — dùng mã khôi phục để lấy lại quyền");
    res.ok = !res.fatal.length;
    return res;
  }

  var api = { validate: validate, SUPPORTED_SCHEMA: SUPPORTED_SCHEMA };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.schema = api; }
})(typeof window !== "undefined" ? window : this);
