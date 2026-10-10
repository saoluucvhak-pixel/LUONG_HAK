// ===== CORE / PERIOD-GUARD — phân loại ảnh hưởng của 1 thay đổi dữ liệu tới các kỳ lương đã chốt =====
// 4 loại (MASTER PROMPT 2.0 §4.3):
//   "locked" — dữ liệu phát sinh thuộc kỳ đã chốt (chấm công, sản lượng, thưởng, tạm ứng…) → KHÔNG cho sửa, phải mở chốt.
//   "retro"  — dữ liệu có hiệu lực hồi tố (phụ lục HĐ, hợp đồng, người phụ thuộc, danh mục có hiệu lực…) chồng lên kỳ đã chốt
//              → cho lưu nhưng phải cảnh báo + ghi nhật ký; bảng lương đã chốt KHÔNG đổi, muốn áp dụng phải mở chốt và chốt lại (phiên bản mới).
//   "none"   — không ảnh hưởng kỳ đã chốt.
// Snapshot kỳ đã chốt luôn bất biến (core/payroll-close.js); module này chỉ phân loại để giao diện cảnh báo/chặn đúng.
(function (root) {
  "use strict";
  var V = (typeof module !== "undefined" && module.exports) ? require("./validate.js") : root.HAKCore.validate;

  // Bảng có hiệu lực theo thời gian: [cột bắt đầu, cột kết thúc (có thể nhiều cột, lấy cột đầu tiên có giá trị)]
  var RANGE = {
    chitiethd: ["Hiệu lực từ", ["Hiệu lực đến"]],
    hopdong: ["Ngày vào làm", ["Ngày chấm dứt"]],
    nhanthan: ["Hiệu lực từ", ["Hiệu lực đến"]],
    thanhtoan: ["Hiệu lực từ", ["Hiệu lực đến"]],
    canhan: ["Hiệu lực từ", ["Hiệu lực đến"]],
    congtac: ["Từ ngày", ["Đến ngày"]],
    nghiphep: ["Từ ngày", ["Đến ngày"]],
    nghiom: ["Từ ngày", ["Đến ngày"]]
  };
  function rangeSpec(table) {
    if (RANGE[table]) return RANGE[table];
    if (/^dm_/.test(table)) return ["Hiệu lực từ", ["Hiệu lực đến"]];
    return null;
  }
  // Bảng được engine dùng khi tính lương (thay đổi bảng khác — VD học vấn, sức khỏe — không ảnh hưởng tiền lương)
  var PAYROLL_TABLES = { chitiethd: 1, hopdong: 1, nhanthan: 1, thanhtoan: 1, nhanvien: 1 };

  function closedPeriods(db) { return (db.kyluong || []).map(function (k) { return k.ky; }).sort(); }
  function monthStart(ky) { return ky + "-01"; }
  function monthEnd(ky) { var p = ky.split("-"), d = new Date(+p[0], +p[1], 0).getDate(); return ky + "-" + ("0" + d).slice(-2); }

  /** Khoảng hiệu lực của 1 dòng: { from, to } dạng YYYY-MM-DD; null = không giới hạn. */
  function rangeOf(table, r) {
    var sp = rangeSpec(table); if (!sp || !r) return null;
    var from = V.normDate(r[sp[0]]) || null, to = null;
    sp[1].forEach(function (c) { if (!to && r[c]) to = V.normDate(r[c]) || null; });
    return { from: from, to: to };
  }

  /** Ảnh hưởng của 1 dòng (trạng thái hiện tại) tới các kỳ đã chốt. */
  function impact(db, table, r) {
    var closed = closedPeriods(db), res = { kind: "none", periods: [] };
    if (!r || !closed.length) return res;
    var p = V.rowPeriod(table, r);
    if (V.PERIOD_FIELD[table]) {
      if (p && closed.indexOf(p) >= 0) res = { kind: "locked", periods: [p] };
      return res;
    }
    if (!(PAYROLL_TABLES[table] || /^dm_/.test(table))) return res;
    if (table === "nhanvien") {
      var ma = r["Mã NV"], used = closed.filter(function (ky) { return usedInSnapshot(db, ky, ma); });
      return used.length ? { kind: "retro", periods: used } : res;
    }
    var rg = rangeOf(table, r); if (!rg) return res;
    if (table === "chitiethd" && !rg.to && rg.from) {
      // Phụ lục không ghi "Hiệu lực đến" → hết hiệu lực khi phụ lục kế tiếp của cùng HĐ bắt đầu
      var next = (db.chitiethd || []).filter(function (x) { return x !== r && x["Mã NV"] === r["Mã NV"] && x["Số HĐLĐ"] === r["Số HĐLĐ"] && (V.normDate(x["Hiệu lực từ"]) || "") > rg.from; })
        .map(function (x) { return V.normDate(x["Hiệu lực từ"]); }).sort()[0];
      if (next) { var d = new Date(next + "T00:00:00"); d.setDate(d.getDate() - 1); rg.to = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
    }
    var hit = closed.filter(function (ky) { return (!rg.from || rg.from <= monthEnd(ky)) && (!rg.to || rg.to >= monthStart(ky)); });
    // Hồ sơ của 1 nhân viên chỉ ảnh hưởng kỳ có nhân viên đó trong bảng lương đã chốt
    if (r["Mã NV"]) hit = hit.filter(function (ky) { return usedInSnapshot(db, ky, r["Mã NV"]); });
    return hit.length ? { kind: "retro", periods: hit } : res;
  }
  function usedInSnapshot(db, ky, ma) {
    var c = (db.kyluong || []).filter(function (k) { return k.ky === ky; })[0];
    if (!c || !c.kq || !c.kq.bangluong) return !!c; // bản chốt cũ không đủ thông tin → coi là có ảnh hưởng
    return c.kq.bangluong.some(function (x) { return x["Mã NV"] === ma; });
  }
  /** Ảnh hưởng của 1 thay đổi: hợp ảnh hưởng của dòng TRƯỚC và SAU khi sửa (sửa ngày hiệu lực ra khỏi kỳ chốt vẫn là hồi tố). */
  function impactChange(db, table, before, after) {
    var a = impact(db, table, before), b = impact(db, table, after);
    var kind = a.kind === "locked" || b.kind === "locked" ? "locked" : (a.kind === "retro" || b.kind === "retro" ? "retro" : "none");
    var ps = {}; a.periods.concat(b.periods).forEach(function (p) { ps[p] = 1; });
    return { kind: kind, periods: Object.keys(ps).sort() };
  }
  /** Các cột thay đổi giữa 2 trạng thái — để ghi nhật ký trước/sau. */
  function changedFields(before, after) {
    var out = [], keys = {};
    Object.keys(before || {}).concat(Object.keys(after || {})).forEach(function (k) { if (k !== "_id") keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var a = before && before[k] != null ? String(before[k]) : "", b = after && after[k] != null ? String(after[k]) : "";
      if (a !== b) out.push(k + ": " + (a || "∅") + " → " + (b || "∅"));
    });
    return out;
  }
  /** Mã NV đang được dùng ở đâu (để chặn đổi Mã NV làm mồ côi dữ liệu). */
  function references(db, ma) {
    var out = {};
    Object.keys(db).forEach(function (t) {
      if (!Array.isArray(db[t]) || t === "nhanvien" || t === "auditlog") return;
      var n = 0;
      if (t === "kyluong" || t === "kyluong_lichsu") db[t].forEach(function (k) { if (k.kq && (k.kq.bangluong || []).some(function (x) { return x["Mã NV"] === ma; })) n++; });
      else db[t].forEach(function (r) { if (r && r["Mã NV"] === ma) n++; });
      if (n) out[t] = n;
    });
    return out;
  }
  function label(ky) { var p = String(ky).split("-"); return (+p[1]) + "/" + p[0]; }

  var api = { impact: impact, impactChange: impactChange, rangeOf: rangeOf, changedFields: changedFields, references: references, closedPeriods: closedPeriods, label: label };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.guard = api; }
})(typeof window !== "undefined" ? window : this);
