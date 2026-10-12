// ===== CORE / INTEGRITY — chuẩn hóa dữ liệu đã lưu + kiểm tra toàn vẹn =====
(function (root) {
  "use strict";
  var V = (typeof module !== "undefined" && module.exports) ? require("./validate.js") : root.HAKCore.validate;
  var MONTHLY = ["chamcong", "sanluong", "bandam", "psluong", "ungluong", "tiencom"];
  var DAYS = []; for (var i = 1; i <= 31; i++) DAYS.push(("0" + i).slice(-2));

  /**
   * Chuẩn hóa dữ liệu đã lưu (an toàn, chạy lại nhiều lần không đổi kết quả):
   * - tiền dạng chuỗi VN "500.000" / "1.500.000" → "500000" / "1500000"
   * - kỳ chấm công "2026-9" / "09/2026" → "2026-09"
   * - ngày "15/09/2026" → "2026-09-15"
   * - CCCD 11 số / SĐT 9 số (mất số 0 do Excel) → bù số 0
   * Không đụng tới kỳ lương đã chốt (db.kyluong) — đó là snapshot bất biến.
   */
  function normalizeDataset(db) {
    var changed = { money: 0, ky: 0, date: 0, id: 0 };
    Object.keys(db).forEach(function (t) {
      if (!Array.isArray(db[t]) || t === "kyluong" || t === "kyluong_lichsu" || t === "nhansu_cu" || t === "auditlog") return;
      db[t].forEach(function (r) {
        if (!r || typeof r !== "object") return;
        Object.keys(r).forEach(function (c) {
          var v = r[c]; if (v === "" || v == null || c === "_id") return;
          if (c === "Kỳ") { var k = V.normKy(v); if (k && k !== v) { r[c] = k; changed.ky++; } return; }
          if (V.isMoneyCol(c) && typeof v === "string") { var m = V.parseMoney(v); if (!isNaN(m) && String(m) !== v) { r[c] = String(m); changed.money++; } return; }
          if (V.isDateCol(c) && typeof v === "string") { var d = V.normDate(v); if (d && d !== v) { r[c] = d; changed.date++; } return; }
          if (V.isIdCol(c)) { var x = V.normId(c, v); if (x !== v) { r[c] = x; changed.id++; } }
        });
      });
    });
    var msg = [];
    if (changed.money) msg.push(changed.money + " ô số tiền nhập dạng \"500.000\" đã được chuẩn hóa (trước đây có thể bị hiểu sai thành 500)");
    if (changed.ky) msg.push(changed.ky + " kỳ chấm công đã chuẩn hóa về dạng YYYY-MM");
    if (changed.date) msg.push(changed.date + " ô ngày đã chuẩn hóa về dạng YYYY-MM-DD");
    if (changed.id) msg.push(changed.id + " mã định danh (CCCD/SĐT) bị mất số 0 đầu đã được bù lại");
    return { changed: changed, messages: msg };
  }

  /** Kiểm tra toàn vẹn. Trả mảng { level: "Critical|High|Medium|Low", area, msg }. */
  function check(db) {
    var out = [], push = function (level, area, msg) { out.push({ level: level, area: area, msg: msg }); };
    var nv = db.nhanvien || [], emp = {}, cntMa = {};
    nv.forEach(function (n) { cntMa[n["Mã NV"]] = (cntMa[n["Mã NV"]] || 0) + 1; emp[n["Mã NV"]] = n; });
    Object.keys(cntMa).forEach(function (k) { if (cntMa[k] > 1) push("Critical", "Nhân sự", "Mã NV " + k + " bị trùng " + cntMa[k] + " lần"); });
    // CCCD trùng giữa các nhân viên
    var cccd = {};
    nv.forEach(function (n) { if (n["Số CCCD"]) (cccd[n["Số CCCD"]] = cccd[n["Số CCCD"]] || {})[n["Mã NV"]] = 1; });
    (db.canhan || []).forEach(function (r) { if (r["Số CCCD"]) (cccd[r["Số CCCD"]] = cccd[r["Số CCCD"]] || {})[r["Mã NV"]] = 1; });
    Object.keys(cccd).forEach(function (k) { var m = Object.keys(cccd[k]); if (m.length > 1) push("High", "Nhân sự", "Số CCCD " + k + " dùng cho nhiều nhân viên: " + m.join(", ")); });
    // Phụ lục lương nghi bị lỗi lưu tiền (bản 1.1–1.3)
    (db.chitiethd || []).forEach(function (r) {
      ["Lương thỏa thuận", "Lương cơ bản"].forEach(function (c) {
        var v = V.parseMoney(r[c]);
        if (r[c] !== "" && r[c] != null && v > 0 && v < 1000) push("High", "Hợp đồng", r["Mã NV"] + " / " + r["Số HĐLĐ"] + " (hiệu lực " + (r["Hiệu lực từ"] || "?") + "): " + c + " = " + r[c] + " — quá nhỏ, có thể bị lỗi lưu số tiền của bản cũ. Hãy kiểm tra và nhập lại.");
      });
    });
    // Nhân viên đã nghỉ nhưng hợp đồng chưa chấm dứt
    nv.forEach(function (n) {
      if (n["Trạng thái"] !== "Đã nghỉ việc") return;
      var open = (db.hopdong || []).filter(function (h) { return h["Mã NV"] === n["Mã NV"] && !h["Ngày chấm dứt"]; });
      if (open.length) push("Medium", "Hợp đồng", n["Mã NV"] + " có trạng thái 'Đã nghỉ việc' nhưng hợp đồng " + open.map(function (h) { return h["Số HĐLĐ"]; }).join(", ") + " chưa có Ngày chấm dứt → vẫn được tính lương");
    });
    // Dữ liệu phát sinh: ngày/kỳ sai, mã NV không tồn tại, trùng
    MONTHLY.forEach(function (t) {
      var badDate = 0, badRef = {}, seen = {}, dup = 0;
      (db[t] || []).forEach(function (r) {
        if (V.rowPeriod(t, r) === null) badDate++;
        if (r["Mã NV"] && !emp[r["Mã NV"]]) badRef[r["Mã NV"]] = 1;
        var k = t === "chamcong" ? [r["Kỳ"], r["Mã NV"], String(r["Hình thức công"] || "BT").toUpperCase()].join("|") :
          (t === "sanluong" || t === "bandam") && r["Phiếu cân"] ? [r["Phiếu cân"], r["Mã NV"] || ""].join("|") : null;
        if (k) { if (seen[k]) dup++; seen[k] = 1; }
      });
      if (badDate) push("High", t, badDate + " dòng có ngày/kỳ không đọc được → bị BỎ QUA khi tính lương");
      if (Object.keys(badRef).length) push("High", t, "Mã NV không có trong Nhân sự: " + Object.keys(badRef).slice(0, 15).join(", "));
      if (dup) push("High", t, dup + " dòng trùng khóa (" + (t === "chamcong" ? "Kỳ + Mã NV + Hình thức công" : "Phiếu cân + Mã NV") + ") → bị CỘNG 2 LẦN khi tính lương");
    });
    // Một phiếu cân chia cho nhiều người: cảnh báo để đối chiếu tổng
    ["sanluong", "bandam"].forEach(function (t) {
      var by = {};
      (db[t] || []).forEach(function (r) { if (r["Phiếu cân"]) (by[r["Phiếu cân"]] = by[r["Phiếu cân"]] || []).push(r); });
      var multi = Object.keys(by).filter(function (k) { return by[k].length > 1; });
      if (multi.length) push("Medium", t, multi.length + " phiếu cân được chia cho nhiều dòng (VD " + multi.slice(0, 5).join(", ") + ") — kiểm tra tổng KL các dòng không vượt KL gốc của phiếu");
    });
    // Ô công bất thường
    (db.chamcong || []).forEach(function (r) {
      DAYS.forEach(function (d) {
        var v = r[d]; if (v === "" || v == null) return;
        var m = String(v).match(/^(\d+(?:[.,]\d+)?)/);
        if (m && parseFloat(m[1].replace(",", ".")) > 3) push("Medium", "chamcong", r["Mã NV"] + " kỳ " + r["Kỳ"] + " ngày " + d + ": " + v + " công — vượt 3 công/ngày");
      });
    });
    var order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return out.sort(function (a, b) { return order[a.level] - order[b.level]; });
  }

  var api = { normalizeDataset: normalizeDataset, check: check };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.integrity = api; }
})(typeof window !== "undefined" ? window : this);
