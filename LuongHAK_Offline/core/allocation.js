// ===== CORE / ALLOCATION — chia chi phí lương theo phòng ban (Q-19, R-53) =====
// Nhân viên điều chuyển trong kỳ (phụ lục đổi Phòng ban) → bảng lương có "Phân bổ PB" = [{ "Mã PB", "Phòng ban", "Công", "Tỷ lệ" }].
// Báo cáo theo phòng ban / hạch toán chia từng khoản tiền theo tỷ lệ đó; tổng các phần LUÔN bằng đúng số gốc (làm tròn phần dư lớn nhất).
// Không có "Phân bổ PB" (người không điều chuyển, hoặc kỳ chốt trước 2.0-α12) → toàn bộ vào phòng ban của dòng lương như trước.
(function (root) {
  "use strict";
  var NO_PB = "(chưa có phòng ban)";
  function n0(v) { return +v || 0; }

  /** Các phần phòng ban của 1 dòng lương. */
  function partsOf(row) {
    var p = row && row["Phân bổ PB"];
    if (Array.isArray(p) && p.length) return p.map(function (x) { return { maPB: x["Mã PB"] || "", tenPB: x["Phòng ban"] || x["Mã PB"] || NO_PB, share: n0(x["Tỷ lệ"]) }; });
    return [{ maPB: (row && row["Mã PB"]) || "", tenPB: (row && row["Phòng ban"]) || NO_PB, share: 1 }];
  }
  /** Chia 1 số tiền (số nguyên đồng) theo tỷ lệ; tổng các phần = đúng số gốc. */
  function split(amount, parts) {
    amount = Math.round(n0(amount));
    var tot = parts.reduce(function (a, p) { return a + p.share; }, 0) || 1;
    var raw = parts.map(function (p) { return amount * p.share / tot; });
    var out = raw.map(function (x) { return x < 0 ? Math.ceil(x) : Math.floor(x); });
    var rest = amount - out.reduce(function (a, b) { return a + b; }, 0), step = rest < 0 ? -1 : 1;
    var order = raw.map(function (x, i) { return { i: i, f: Math.abs(x - out[i]) }; }).sort(function (a, b) { return b.f - a.f || a.i - b.i; });
    for (var k = 0; rest !== 0; k = (k + 1) % order.length) { out[order[k].i] += step; rest -= step; }
    return out;
  }

  var MONEY = ["Tổng thu nhập", "BH trừ NLĐ", "Thuế TNCN", "Tạm ứng", "Trừ khác", "Thực lĩnh"];
  /** Tổng hợp theo phòng ban. Người điều chuyển được đếm ở mọi phòng đã làm; dòng tổng đếm số người thật. */
  function byDepartment(kq) {
    var m = {}, partsByMa = {}, people = 0;
    var get = function (k) { return m[k] || (m[k] = { "Phòng ban": k, "Số người": 0, "Tổng công": 0, "Tổng thu nhập": 0, "BH trừ NLĐ": 0, "Thuế TNCN": 0, "Tạm ứng": 0, "Trừ khác": 0, "Thực lĩnh": 0, "BH công ty đóng": 0 }); };
    (kq.bangluong || []).forEach(function (x) {
      var parts = partsOf(x); partsByMa[x["Mã NV"]] = parts; people++;
      parts.forEach(function (p) { get(p.tenPB)["Số người"]++; });
      var cong = parts.length > 1 ? parts.map(function (p, i) { var v = x["Phân bổ PB"][i]; return n0(v && v["Công"]); }) : [n0(x["Tổng công"])];
      if (parts.length > 1) { var sumC = cong.reduce(function (a, b) { return a + b; }, 0), d = n0(x["Tổng công"]) - sumC; cong[cong.length - 1] += d; } // công tăng ca… vào phần cuối để tổng khớp
      parts.forEach(function (p, i) { get(p.tenPB)["Tổng công"] += cong[i]; });
      MONEY.forEach(function (f) { var s = split(x[f], parts); parts.forEach(function (p, i) { get(p.tenPB)[f] += s[i]; }); });
    });
    (kq.bhxh || []).forEach(function (b) {
      var parts = partsByMa[b["Mã NV"]] || [{ maPB: "", tenPB: b["Phòng ban"] || NO_PB, share: 1 }];
      var s = split(b["Cộng BH công ty đóng"], parts);
      parts.forEach(function (p, i) { if (m[p.tenPB]) m[p.tenPB]["BH công ty đóng"] += s[i]; });
    });
    var rows = Object.keys(m).sort().map(function (k) { var r = m[k]; r["Tổng công"] = Math.round(r["Tổng công"] * 1000) / 1000; return r; });
    return { rows: rows, people: people };
  }
  /** Chi phí theo khóa (VD tài khoản chi phí) — tkOf(maPB, tenPB). Trả { luong: {tk: số}, bh: {tk: số} } */
  function costByKey(kq, tkOf) {
    var luong = {}, bh = {}, partsByMa = {};
    (kq.bangluong || []).forEach(function (x) {
      var parts = partsOf(x); partsByMa[x["Mã NV"]] = parts;
      var s = split(x["Tổng thu nhập"], parts);
      parts.forEach(function (p, i) { var k = tkOf(p.maPB, p.tenPB); luong[k] = (luong[k] || 0) + s[i]; });
    });
    (kq.bhxh || []).forEach(function (b) {
      var parts = partsByMa[b["Mã NV"]] || [{ maPB: "", tenPB: b["Phòng ban"] || "", share: 1 }];
      var s = split(b["Cộng BH công ty đóng"], parts);
      parts.forEach(function (p, i) { var k = tkOf(p.maPB, p.tenPB); bh[k] = (bh[k] || 0) + s[i]; });
    });
    return { luong: luong, bh: bh };
  }

  var api = { partsOf: partsOf, split: split, byDepartment: byDepartment, costByKey: costByKey, NO_PB: NO_PB };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.alloc = api; }
})(typeof window !== "undefined" ? window : this);
