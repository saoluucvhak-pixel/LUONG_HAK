// ===== CORE / PRODUCTION-ALLOC — chia phiếu cân theo tổ (2.0-α19, chủ sở hữu duyệt: "làm như công cụ") =====
// Đúng thuật toán công cụ "Phân bổ khối lượng tính lương" của HAK:
//   phiếu cân ghi Mã phòng ban (tổ) + NV vắng → khối lượng (tấn) / số xe chia ĐỀU cho người của tổ đang làm việc ngày đó
//   (đã vào làm, chưa nghỉ việc) và KHÔNG có tên trong NV vắng (so theo TỪ CUỐI của họ tên, không dấu; app nhận thêm Mã NV).
// Phiếu không chia được (mã tổ lạ / không còn ai có mặt) → "chưa phân bổ", có cảnh báo, không bỏ sót âm thầm.
// Phiếu đã ghi Mã NV → giữ nguyên cho đúng người đó (cách nhập cũ).
(function (root) {
  "use strict";
  function strip(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D"); }
  function lastWord(name) { var p = String(name || "").trim().split(/\s+/); return strip(p[p.length - 1] || "").toLowerCase(); }
  function tokens(s) { return s ? String(s).split(/[,;/\s]+/).map(function (x) { return strip(x).toLowerCase(); }).filter(function (x) { return x && x !== "@"; }) : []; }
  function num(v) { if (typeof v === "number") return v; var x = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isNaN(x) ? 0 : x; }

  /**
   * rows: [{ phieu, ngay: "YYYY-MM-DD", kl, maPB, vang }] (chỉ phiếu CHƯA ghi Mã NV)
   * membersOf(ngay, maPB) → [{ ma, hoTen }] người của tổ đang làm việc ngày đó (null = tổ không có trong danh mục / hồ sơ)
   * opts.donVi: "tấn" | "xe"; opts.tenPB(maPB) → tên tổ
   */
  function allocate(rows, membersOf, opts) {
    opts = opts || {};
    var dv = opts.donVi || "tấn", tenPB = opts.tenPB || function (x) { return x; };
    var shares = [], audit = [], warnings = [], byDept = {}, byEmp = {}, dates = {}, total = 0, unalloc = 0;
    (rows || []).forEach(function (r) {
      var kl = num(r.kl), d = r.ngay || "", pb = String(r.maPB || "").trim();
      total += kl; if (d) dates[d] = 1;
      var dp = byDept[pb] || (byDept[pb] = { maPB: pb, tenPB: tenPB(pb) || pb, total: 0, unallocated: 0, byDay: {} });
      dp.total += kl; dp.byDay[d] = (dp.byDay[d] || 0) + kl;
      var mem = membersOf(d, pb);
      if (mem == null) {
        warnings.push("Phiếu " + r.phieu + " (ngày " + d + ") dùng mã tổ \"" + pb + "\" nhưng không có tổ / người nào thuộc mã này — " + kl + " " + dv + " chưa phân bổ");
        audit.push({ phieu: r.phieu, ngay: d, maPB: pb, kl: kl, soNguoi: 0, names: [], share: 0, note: "Mã phòng ban không có trong danh mục / hồ sơ" });
        dp.unallocated += kl; unalloc += kl; return;
      }
      var tk = tokens(r.vang), hit = {};
      var present = mem.filter(function (e) {
        var lw = lastWord(e.hoTen), mk = strip(e.ma).toLowerCase();
        if (tk.indexOf(lw) >= 0) { hit[lw] = (hit[lw] || 0) + 1; return false; }
        if (mk && tk.indexOf(mk) >= 0) { hit[mk] = (hit[mk] || 0) + 1; return false; }
        return true;
      });
      var notes = [];
      tk.forEach(function (t) { if (!hit[t]) notes.push("\"" + t + "\" không khớp ai trong tổ"); else if (hit[t] > 1) notes.push("\"" + t + "\" khớp " + hit[t] + " người (trùng tên cuối) — đều bị coi là vắng"); });
      if (notes.length) warnings.push("Phiếu " + r.phieu + " (ngày " + d + ", tổ " + pb + "): NV vắng " + notes.join("; "));
      if (!present.length) {
        warnings.push("Phiếu " + r.phieu + " (ngày " + d + ", tổ " + pb + ") không còn công nhân nào có mặt để nhận — " + kl + " " + dv + " chưa phân bổ");
        audit.push({ phieu: r.phieu, ngay: d, maPB: pb, kl: kl, soNguoi: 0, names: [], share: 0, note: "Không có nhân sự phù hợp — chưa phân bổ được" });
        dp.unallocated += kl; unalloc += kl; return;
      }
      var share = kl / present.length;
      present.forEach(function (e) {
        shares.push({ ma: e.ma, ngay: d, kl: share, phieu: r.phieu, maPB: pb });
        var k = e.ma, o = byEmp[k] || (byEmp[k] = { ma: e.ma, hoTen: e.hoTen, maPB: pb, total: 0, byDay: {} });
        o.total += share; o.byDay[d] = (o.byDay[d] || 0) + share;
      });
      audit.push({ phieu: r.phieu, ngay: d, maPB: pb, kl: kl, soNguoi: present.length, names: present.map(function (e) { return e.hoTen; }), share: share, note: notes.join("; ") });
    });
    return { shares: shares, audit: audit, warnings: warnings, byDept: byDept, byEmp: byEmp, dateKeys: Object.keys(dates).sort(), total: total, unallocated: unalloc };
  }
  /**
   * Gộp thêm các phiếu đã ghi Mã NV (giao trực tiếp) vào kết quả phân bổ — để báo cáo / file xuất có đủ mọi phiếu.
   * direct: [{ phieu, ngay, kl, ma }]; pbOf(ma, ngay) → mã tổ của người đó ngày đó; nameOf(ma); tenPB(maPB)
   */
  function withDirect(al, direct, pbOf, nameOf, tenPB) {
    (direct || []).forEach(function (r) {
      var kl = num(r.kl), d = r.ngay || "", pb = pbOf(r.ma, d) || "(chưa có tổ)";
      al.total += kl; if (d && al.dateKeys.indexOf(d) < 0) al.dateKeys.push(d);
      var dp = al.byDept[pb] || (al.byDept[pb] = { maPB: pb, tenPB: tenPB(pb) || pb, total: 0, unallocated: 0, byDay: {} });
      dp.total += kl; dp.byDay[d] = (dp.byDay[d] || 0) + kl;
      var o = al.byEmp[r.ma] || (al.byEmp[r.ma] = { ma: r.ma, hoTen: nameOf(r.ma) || r.ma, maPB: pb, total: 0, byDay: {} });
      o.total += kl; o.byDay[d] = (o.byDay[d] || 0) + kl;
      al.audit.push({ phieu: r.phieu, ngay: d, maPB: pb, kl: kl, soNguoi: 1, names: [nameOf(r.ma) || r.ma], share: kl, note: "Giao trực tiếp (phiếu ghi Mã NV " + r.ma + ")" });
    });
    al.dateKeys.sort();
    al.audit.sort(function (a, b) { return a.ngay < b.ngay ? -1 : a.ngay > b.ngay ? 1 : String(a.phieu).localeCompare(String(b.phieu), "vi", { numeric: true }); });
    return al;
  }
  var api = { allocate: allocate, withDirect: withDirect, lastWord: lastWord, tokens: tokens };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.palloc = api; }
})(typeof window !== "undefined" ? window : this);
