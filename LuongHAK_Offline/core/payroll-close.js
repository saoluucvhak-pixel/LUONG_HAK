// ===== CORE / PAYROLL-CLOSE — chốt kỳ lương, phiên bản, mở chốt có lưu vết =====
// Quy tắc:
// - Mỗi kỳ chỉ có 1 bản chốt đang hiệu lực trong db.kyluong.
// - Mở chốt KHÔNG xóa bản cũ: chuyển sang db.kyluong_lichsu kèm lý do, thời điểm, người mở.
// - Chốt lại tạo phiên bản mới (version = số lần đã chốt + 1).
// - Snapshot gồm kết quả + dữ liệu đầu vào của kỳ + danh mục tại thời điểm chốt + checksum để phát hiện bị sửa.
(function (root) {
  "use strict";
  var V = (typeof module !== "undefined" && module.exports) ? require("./validate.js") : root.HAKCore.validate;
  var MONTHLY = ["chamcong", "sanluong", "bandam", "psluong", "ungluong", "tiencom"];
  var DM = ["dm_luong", "dm_phucap", "dm_tangca", "dm_hotro", "dm_baohiem", "dm_tncn", "dm_bacthue", "dm_giamtru", "dm_phongban", "dm_chucvu", "dm_cc"];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  // FNV-1a 32-bit — đủ để phát hiện dữ liệu chốt bị sửa tay trong file (không phải chữ ký bảo mật)
  function checksum(obj) {
    var s = JSON.stringify(obj), h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
    return ("0000000" + h.toString(16)).slice(-8);
  }
  function totals(kq) {
    var s = function (f) { return kq.bangluong.reduce(function (a, x) { return a + (+x[f] || 0); }, 0); };
    return { soNV: kq.bangluong.length, tongThuNhap: s("Tổng thu nhập"), bhNLD: s("BH trừ NLĐ"), thue: s("Thuế TNCN"), tamUng: s("Tạm ứng"), thucLinh: s("Thực lĩnh") };
  }
  function current(db, ky) { return (db.kyluong || []).filter(function (k) { return k.ky === ky; })[0] || null; }
  function history(db, ky) { return (db.kyluong_lichsu || []).filter(function (k) { return k.ky === ky; }); }

  /** Dựng snapshot chốt kỳ. kq = kết quả tính lương; staff = danh sách nhân sự đã dùng để tính. */
  function buildSnapshot(db, ky, kq, staff, meta) {
    meta = meta || {};
    var input = {};
    MONTHLY.forEach(function (t) { input[t] = clone((db[t] || []).filter(function (r) { return V.rowPeriod(t, r) === ky; })); });
    var dm = {}; DM.forEach(function (t) { dm[t] = clone(db[t] || []); });
    var result = clone({ bangluong: kq.bangluong, bhxh: kq.bhxh, tncn: kq.tncn, canhbao: kq.canhbao });
    return {
      ky: ky, version: history(db, ky).length + 1, ngayChot: meta.now || new Date().toISOString(), nguoiChot: meta.user || "", ghiChu: meta.note || "",
      buTheoNgay: !!meta.buTheoNgay, engineVersion: meta.engineVersion || "", kq: result, totals: totals(kq), checksum: checksum(result),
      input: { staff: clone(staff || []), data: input, danhmuc: dm }
    };
  }
  /** Ghi bản chốt. Lỗi nếu kỳ đã có bản chốt hiệu lực (phải mở chốt trước). */
  function close(db, snap) {
    if (current(db, snap.ky)) throw new Error("Kỳ " + snap.ky + " đã chốt — phải mở chốt trước khi chốt lại");
    db.kyluong = db.kyluong || [];
    db.kyluong.push(snap);
    db.kyluong.sort(function (a, b) { return a.ky < b.ky ? 1 : -1; });
    return snap;
  }
  /** Gỡ bản chốt vừa ghi (dùng khi lưu file thất bại). */
  function rollbackClose(db, snap) { db.kyluong = (db.kyluong || []).filter(function (k) { return k !== snap; }); }
  /** Mở chốt: chuyển bản chốt sang lịch sử, bắt buộc có lý do. */
  function reopen(db, ky, reason, meta) {
    meta = meta || {};
    if (!reason || !String(reason).trim()) throw new Error("Phải nhập lý do mở chốt");
    var c = current(db, ky); if (!c) throw new Error("Kỳ " + ky + " chưa chốt");
    db.kyluong = db.kyluong.filter(function (k) { return k !== c; });
    var h = Object.assign({}, c, { moChot: { luc: meta.now || new Date().toISOString(), lyDo: String(reason).trim(), nguoi: meta.user || "" } });
    if (!h.version) h.version = history(db, ky).length + 1;
    db.kyluong_lichsu = db.kyluong_lichsu || [];
    db.kyluong_lichsu.push(h);
    return h;
  }
  /** Gỡ thao tác mở chốt (dùng khi lưu file thất bại). */
  function rollbackReopen(db, h) {
    db.kyluong_lichsu = (db.kyluong_lichsu || []).filter(function (k) { return k !== h; });
    var c = Object.assign({}, h); delete c.moChot;
    db.kyluong.push(c); db.kyluong.sort(function (a, b) { return a.ky < b.ky ? 1 : -1; });
  }
  /** Kiểm tra bản chốt còn nguyên vẹn (checksum khớp). Bản chốt cũ (≤ v1.3) không có checksum → "legacy". */
  function verify(snap) {
    if (!snap.checksum) return "legacy";
    return checksum(snap.kq) === snap.checksum ? "ok" : "modified";
  }
  /** So sánh 2 kết quả theo từng nhân viên (dùng cho đối chiếu & báo cáo trước/sau điều chỉnh). */
  function diff(kqA, kqB, field) {
    field = field || "Thực lĩnh";
    var a = {}, b = {}, rows = [];
    kqA.bangluong.forEach(function (x) { a[x["Mã NV"]] = x; }); kqB.bangluong.forEach(function (x) { b[x["Mã NV"]] = x; });
    Object.keys(a).concat(Object.keys(b).filter(function (k) { return !a[k]; })).forEach(function (k) {
      var v1 = a[k] ? +a[k][field] || 0 : 0, v2 = b[k] ? +b[k][field] || 0 : 0;
      if (v1 !== v2) rows.push({ "Mã NV": k, "Họ và tên": (a[k] || b[k])["Họ và tên"], "Trước": v1, "Sau": v2, "Chênh lệch": v2 - v1, "Ghi chú": !a[k] ? "Mới" : (!b[k] ? "Không còn" : "") });
    });
    return rows;
  }

  var api = { buildSnapshot: buildSnapshot, close: close, rollbackClose: rollbackClose, reopen: reopen, rollbackReopen: rollbackReopen,
    verify: verify, diff: diff, checksum: checksum, totals: totals, current: current, history: history };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.close = api; }
})(typeof window !== "undefined" ? window : this);
