// ===== CORE / BH-REPORT — báo cáo bảo hiểm của 1 kỳ lương (2.0-α18) =====
// CHỈ cộng / so sánh các số engine đã tính trong bảng BHXH của kỳ (kq.bhxh) — không tính lại, không đổi công thức.
// Báo cáo NỘI BỘ để đối chiếu trước khi kê khai / nộp; KHÔNG thay mẫu chính thức của cơ quan BHXH (D02-LT, C12-TS…).
(function (root) {
  "use strict";
  function n0(v) { return +v || 0; }
  var MONEY = ["Lương đóng BHXH", "CTY.BHXH", "CTY.BHYT", "CTY.BHTN", "CTY.KPCĐ", "Cộng BH công ty đóng", "NLĐ.BHXH", "NLĐ.BHYT", "NLĐ.BHTN", "NLĐ.KPCĐ", "Cộng BH NLĐ đóng", "Truy thu bảo hiểm"];
  var duNguong = function (r) { return !/^Chưa đủ ngưỡng/.test(String(r["Ghi chú"] || "")); };

  /** Chi tiết từng người (đúng bảng BHXH của kỳ) + dòng tổng */
  function chiTiet(kq) {
    var rows = (kq && kq.bhxh || []).map(function (r, i) { return Object.assign({ "STT": i + 1 }, r); });
    if (!rows.length) return rows;
    var t = { "STT": "", "Mã NV": "", "Họ và tên": "TỔNG CỘNG (" + rows.length + " người)", "Phòng ban": "" };
    MONEY.forEach(function (c) { t[c] = rows.reduce(function (a, r) { return a + n0(r[c]); }, 0); });
    t["Ghi chú"] = ""; rows.push(t);
    return rows;
  }
  /** Theo phòng ban */
  function theoPhongBan(kq) {
    var m = {}, order = [];
    (kq && kq.bhxh || []).forEach(function (r) {
      var k = r["Phòng ban"] || "(chưa có phòng ban)";
      if (!m[k]) { m[k] = { "Phòng ban": k, "Số người": 0, "Lương đóng BHXH": 0, "Cộng BH công ty đóng": 0, "Cộng BH NLĐ đóng": 0, "Truy thu bảo hiểm": 0 }; order.push(k); }
      var o = m[k]; o["Số người"]++; ["Lương đóng BHXH", "Cộng BH công ty đóng", "Cộng BH NLĐ đóng", "Truy thu bảo hiểm"].forEach(function (c) { o[c] += n0(r[c]); });
    });
    var rows = order.map(function (k) { var o = m[k]; o["Tổng BH (công ty + NLĐ + truy thu)"] = o["Cộng BH công ty đóng"] + o["Cộng BH NLĐ đóng"] + o["Truy thu bảo hiểm"]; return o; });
    if (rows.length) { var t = { "Phòng ban": "TỔNG CỘNG" }; Object.keys(rows[0]).slice(1).forEach(function (c) { t[c] = rows.reduce(function (a, r) { return a + r[c]; }, 0); }); rows.push(t); }
    return rows;
  }
  /** Tổng hợp theo khoản (để đối chiếu số phải nộp) */
  function tongHop(kq) {
    var b = kq && kq.bhxh || [], s = function (c, f) { return b.filter(f || function () { return true; }).reduce(function (a, r) { return a + n0(r[c]); }, 0); };
    var rows = [
      { "Khoản": "BHXH", "Công ty đóng": s("CTY.BHXH"), "Người lao động đóng (trừ lương)": s("NLĐ.BHXH", duNguong) },
      { "Khoản": "BHYT", "Công ty đóng": s("CTY.BHYT"), "Người lao động đóng (trừ lương)": s("NLĐ.BHYT", duNguong) },
      { "Khoản": "BHTN", "Công ty đóng": s("CTY.BHTN"), "Người lao động đóng (trừ lương)": s("NLĐ.BHTN", duNguong) },
      { "Khoản": "KPCĐ (nộp công đoàn)", "Công ty đóng": s("CTY.KPCĐ"), "Người lao động đóng (trừ lương)": s("NLĐ.KPCĐ", duNguong) }]; // KPCĐ NLĐ trừ riêng (cột "KPCĐ trừ NLĐ" của bảng lương)
    rows.forEach(function (r) { r["Cộng"] = r["Công ty đóng"] + r["Người lao động đóng (trừ lương)"]; });
    var t = { "Khoản": "TỔNG", "Công ty đóng": 0, "Người lao động đóng (trừ lương)": 0, "Cộng": 0 };
    rows.forEach(function (r) { ["Công ty đóng", "Người lao động đóng (trừ lương)", "Cộng"].forEach(function (c) { t[c] += r[c]; }); });
    rows.push(t);
    var chua = b.filter(function (r) { return !duNguong(r); });
    return { rows: rows, soNguoi: b.length, chuaDuNguong: chua.length, truyThu: s("Truy thu bảo hiểm"), lechNLD: s("Cộng BH NLĐ đóng") + s("NLĐ.KPCĐ", duNguong) - t["Người lao động đóng (trừ lương)"] }; // "Cộng BH NLĐ đóng" = BHXH + BHYT + BHTN; KPCĐ NLĐ là cột riêng
  }
  /** Tăng / giảm / điều chỉnh mức đóng so với kỳ trước */
  function bienDong(kq, kqTruoc) {
    var a = {}, b = {}, out = [];
    (kqTruoc && kqTruoc.bhxh || []).forEach(function (r) { a[r["Mã NV"]] = r; });
    (kq && kq.bhxh || []).forEach(function (r) { b[r["Mã NV"]] = r; });
    Object.keys(b).forEach(function (k) {
      var y = b[k], x = a[k];
      if (!x) out.push({ "Loại": "Tăng (mới tham gia trong kỳ)", "Mã NV": k, "Họ và tên": y["Họ và tên"], "Phòng ban": y["Phòng ban"] || "", "Lương đóng kỳ trước": "", "Lương đóng kỳ này": n0(y["Lương đóng BHXH"]) });
      else if (n0(x["Lương đóng BHXH"]) !== n0(y["Lương đóng BHXH"])) out.push({ "Loại": "Điều chỉnh mức đóng", "Mã NV": k, "Họ và tên": y["Họ và tên"], "Phòng ban": y["Phòng ban"] || "", "Lương đóng kỳ trước": n0(x["Lương đóng BHXH"]), "Lương đóng kỳ này": n0(y["Lương đóng BHXH"]) });
    });
    Object.keys(a).forEach(function (k) { if (!b[k]) { var x = a[k]; out.push({ "Loại": "Giảm (không còn đóng trong kỳ)", "Mã NV": k, "Họ và tên": x["Họ và tên"], "Phòng ban": x["Phòng ban"] || "", "Lương đóng kỳ trước": n0(x["Lương đóng BHXH"]), "Lương đóng kỳ này": "" }); } });
    return out;
  }
  var api = { chiTiet: chiTiet, theoPhongBan: theoPhongBan, tongHop: tongHop, bienDong: bienDong, MONEY: MONEY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.bh = api; }
})(typeof window !== "undefined" ? window : this);
