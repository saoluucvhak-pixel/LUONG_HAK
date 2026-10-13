// ===== CORE / PRODUCTION-ALLOC — chia phiếu cân theo tổ (2.0-α19, chủ sở hữu duyệt: "làm như công cụ") =====
// Đúng thuật toán công cụ "Phân bổ khối lượng tính lương" của HAK:
//   phiếu cân ghi Mã phòng ban (tổ) + NV vắng → khối lượng (tấn) / số xe chia ĐỀU cho người của tổ đang làm việc ngày đó
//   (đã vào làm, chưa nghỉ việc) và KHÔNG có tên trong NV vắng (so theo TỪ CUỐI của họ tên, không dấu; app nhận thêm Mã NV).
// Phiếu không chia được (mã tổ lạ / không còn ai có mặt / cả tổ CHƯA CÓ chấm công BT ngày này —
// PENDING_ATTENDANCE, Master Prompt mục IX) → "chưa phân bổ", có cảnh báo, không bỏ sót âm thầm.
// Phiếu đã ghi Mã NV → giữ nguyên cho đúng người đó (cách nhập cũ).
(function (root) {
  "use strict";
  function strip(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D"); }
  function lastWord(name) { var p = String(name || "").trim().split(/\s+/); return strip(p[p.length - 1] || "").toLowerCase(); }
  function tokens(s) { return s ? String(s).split(/[,;/\s]+/).map(function (x) { return strip(x).toLowerCase(); }).filter(function (x) { return x && x !== "@"; }) : []; }
  // α21: so CÓ DẤU trước (như công cụ / Power Query: "Tường" ≠ "Tưởng"), không ai khớp mới so không dấu
  function low(x) { return String(x == null ? "" : x).normalize("NFC").toLowerCase(); }
  function lastWordRaw(name) { var p = String(name || "").trim().split(/\s+/); return low(p[p.length - 1] || ""); }
  function rawTokens(s) { return s ? String(s).split(/[,;/\s]+/).map(low).filter(function (x) { return x && x !== "@"; }) : []; }
  /** Như rawTokens nhưng giữ nguyên cách viết trên phiếu (để hiện trong cảnh báo) */
  function shownTokens(s) { return s ? String(s).split(/[,;/\s]+/).map(function (x) { return x.trim(); }).filter(function (x) { return x && x !== "@"; }) : []; }
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
    // Tên vắng không khớp / trùng tên: gộp 1 cảnh báo cho mỗi (tổ, tên) thay vì lặp lại ở từng phiếu (chi tiết từng phiếu vẫn ở audit[].note)
    var vangWarn = {}, vangOrder = [], nghiInfo = {}, nghiOrder = [], chuaCC = {}, chuaCCOrder = []; // nghiInfo: người có đơn nghỉ đã duyệt → không chia phiếu các ngày đó
    var noteVang = function (pb, t, kind, n, phieu, d) {
      var k = pb + "|" + kind + "|" + t, w = vangWarn[k];
      if (!w) { w = vangWarn[k] = { pb: pb, t: t, kind: kind, n: n, phieu: [], ngay: [] }; vangOrder.push(k); }
      w.phieu.push(phieu); if (d && w.ngay.indexOf(d) < 0) w.ngay.push(d);
    };
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
      var vang = {}, notes = [], vangNghi = {}; // vangNghi: người đang nghỉ / không có công mà phiếu cũng ghi vắng
      var shown = shownTokens(r.vang), mo = []; // mo: tên vắng MƠ HỒ (trùng tên cuối ≥ 2 người, không ghi Mã NV) — V5 mục VII.1
      rawTokens(r.vang).forEach(function (t, ti) {
        var tx = shown[ti] || t; // tên đúng như ghi trên phiếu
        // So trên CẢ người có mặt lẫn người đang nghỉ / không có công: có dấu trước ("Tưởng" ≠ "Tường"), không ai khớp mới so bỏ dấu
        var pool = mem.concat(mem.nghi || []), f = strip(t).toLowerCase();
        // Mã NV khớp CHÍNH XÁC = định danh duy nhất (ưu tiên Mã NV), không bao giờ mơ hồ
        var byCode = pool.filter(function (e) { return e.ma && strip(e.ma).toLowerCase() === f; });
        var hit = byCode.length ? byCode : pool.filter(function (e) { return lastWordRaw(e.hoTen) === t; });
        if (!hit.length) hit = pool.filter(function (e) { return lastWord(e.hoTen) === f; });
        var list = hit.filter(function (e) { return mem.indexOf(e) >= 0; }), nx = hit.filter(function (e) { return mem.indexOf(e) < 0; });
        list.forEach(function (e) { vang[e.ma] = 1; });
        nx.forEach(function (e) { vangNghi[e.ma] = 1; });
        if (!list.length && nx.length) { notes.push("\"" + tx + "\" " + (nx[0].khongCong ? "không có công ngày này" : "đang nghỉ (" + nx[0].loai + ", đơn đã duyệt)")); return; }
        if (!hit.length) { notes.push("\"" + tx + "\" không khớp ai đang làm trong tổ"); noteVang(pb, tx, "none", 0, r.phieu, d); }
        else if (hit.length > 1 && !byCode.length) mo.push({ t: tx, cands: hit }); // trùng tên: KHÔNG tự loại ai — giữ phiếu chờ xác nhận danh tính
      });
      if (mo.length) {
        // Master Prompt V5 mục VII.1 "NV vắng": trùng tên → đánh dấu mơ hồ, yêu cầu xác nhận danh tính, tạm giữ phiếu (không tự loại tất cả người trùng)
        var ds = mo.map(function (m) { return "\"" + m.t + "\" = " + m.cands.map(function (e) { return e.ma + " " + e.hoTen; }).join(" / "); }).join("; ");
        warnings.push("Phiếu " + r.phieu + " (ngày " + d + ", tổ " + pb + ") NV vắng TRÙNG TÊN, chưa xác định được người vắng (PENDING_IDENTITY) — " + ds + ". Giữ phiếu chờ xử lý, KHÔNG tự loại ai — ghi Mã NV thay cho tên trong cột NV vắng rồi tính lại — " + kl + " " + dv + " chưa phân bổ");
        audit.push({ phieu: r.phieu, ngay: d, maPB: pb, kl: kl, soNguoi: 0, names: [], share: 0, note: "PENDING_IDENTITY — NV vắng trùng tên: " + ds, pending: true, pendingKind: "IDENTITY", mo: mo.map(function (m) { return { ten: m.t, ungVien: m.cands.map(function (e) { return { ma: e.ma, hoTen: e.hoTen }; }) }; }) });
        dp.unallocated += kl; unalloc += kl; return;
      }
      var present = mem.filter(function (e) { return !vang[e.ma]; });
      if (mem.chuaCC) { var ck = pb; if (!chuaCC[ck]) { chuaCC[ck] = []; chuaCCOrder.push(ck); } if (chuaCC[ck].indexOf(d) < 0) chuaCC[ck].push(d); }
      (mem.nghi || []).forEach(function (e) { if (e.khongCong && vangNghi[e.ma]) return; /* phiếu đã ghi vắng → không đổi gì, khỏi báo */ var nk = e.ma + "|" + e.loai; if (!(nk in nghiInfo)) { nghiInfo[nk] = { ma: e.ma, hoTen: e.hoTen, loai: e.loai, khongCong: !!e.khongCong, ngay: [] }; nghiOrder.push(nk); } if (nghiInfo[nk].ngay.indexOf(d) < 0) nghiInfo[nk].ngay.push(d); });
      if (!present.length) {
        // Master Prompt mục IX: cả tổ chưa có chấm công BT ngày này (mem.chuaCC, xem hr.js membersOf())
        // → PENDING_ATTENDANCE — phân biệt rõ với "không còn ai có mặt" (mọi người đã nghỉ/bị ghi vắng
        // thật), để người dùng biết cần NHẬP CHẤM CÔNG rồi tính lại, không phải sửa NV vắng trên phiếu.
        if (mem.chuaCC) {
          warnings.push("Phiếu " + r.phieu + " (ngày " + d + ", tổ " + pb + ") CHƯA CÓ CHẤM CÔNG BT (PENDING_ATTENDANCE) — giữ phiếu chờ xử lý, không tự chia theo NV vắng — " + kl + " " + dv + " chưa phân bổ");
          audit.push({ phieu: r.phieu, ngay: d, maPB: pb, kl: kl, soNguoi: 0, names: [], share: 0, note: "PENDING_ATTENDANCE — chưa có chấm công BT ngày này, nhập chấm công rồi tính lại", pending: true });
        } else {
          warnings.push("Phiếu " + r.phieu + " (ngày " + d + ", tổ " + pb + ") không còn công nhân nào có mặt để nhận — " + kl + " " + dv + " chưa phân bổ");
          audit.push({ phieu: r.phieu, ngay: d, maPB: pb, kl: kl, soNguoi: 0, names: [], share: 0, note: "Không có nhân sự phù hợp — chưa phân bổ được" });
        }
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
    var dm = function (x) { return String(x).slice(8, 10) + "/" + String(x).slice(5, 7); };
    vangOrder.forEach(function (k) {
      var w = vangWarn[k], ng = w.ngay.slice().sort(), ds = ng.length ? (ng.length > 1 ? "ngày " + dm(ng[0]) + " → " + dm(ng[ng.length - 1]) : "ngày " + dm(ng[0])) : "";
      var ph = w.phieu.slice(0, 5).join(", ") + (w.phieu.length > 5 ? "…" : "");
      warnings.push("Tổ " + w.pb + ": NV vắng \"" + w.t + "\" không khớp ai đang làm trong tổ — " + w.phieu.length + " phiếu (" + ds + "; phiếu " + ph + "). Phiếu vẫn chia cho người có mặt; kiểm tra người này đã nghỉ việc / chuyển tổ hay ghi sai tên");
    });
    chuaCCOrder.forEach(function (pb) { var ng = chuaCC[pb].sort(); warnings.push("Tổ " + pb + ": chưa có chấm công " + ng.length + " ngày có phiếu (" + ng.slice(0, 6).map(dm).join(", ") + (ng.length > 6 ? "…" : "") + ") — các ngày này đang CHỜ PHÂN BỔ (PENDING_ATTENDANCE), không tự chia theo NV vắng; nhập chấm công rồi tính lại"); });
    var nghi = nghiOrder.map(function (k) { var x = nghiInfo[k]; x.ngay.sort(); return x; });
    return { nghi: nghi, shares: shares, audit: audit, warnings: warnings, byDept: byDept, byEmp: byEmp, dateKeys: Object.keys(dates).sort(), total: total, unallocated: unalloc };
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
