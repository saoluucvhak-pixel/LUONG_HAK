// ===== V10.2 — QUẢN LÝ CÔNG THỨC TĂNG CA THEO MASTER–DETAIL: logic thuần (không DOM, không ghi dữ liệu) =====
// Cha  = DM_TANGCA (khóa ổn định = "Mã tăng ca"; nhiều dòng cùng mã là các phiên bản hiệu lực của chính mã đó).
// Con  = DM_CONGTHUC, Loại = "OVERTIME", nối với cha qua cột "Mã tăng ca cha".
// Engine KHÔNG đổi: engine vẫn tra công thức theo "Mã công thức" = (Loại công thức || Mã tăng ca) của dòng cha.
// Cột "Mã tăng ca cha" là liên kết hiển thị/kiểm soát, được kiểm khớp với khóa công thức (formula-approval.linkProblem).
//
// Module này chứa: tra cứu cha/con, kế hoạch liên kết dữ liệu cũ (migration có danh sách không liên kết được + hoàn tác theo đợt),
// kiểm tra thông tin mã tăng ca, kiểm tra trước khi kích hoạt, so sánh công thức hiện tại với phiên bản thử trên DỮ LIỆU THẬT
// của bảng lương đã tính (các biến lấy nguyên từ engine, không nhập tay), diễn giải biểu thức, chạy các ca kiểm thử đã lưu.
(function (root) {
  "use strict";
  var isNode = typeof module !== "undefined" && module.exports;
  var FML = isNode ? require("./formula-engine.js") : root.HAKCore.formula;
  var FAP = isNode ? require("./formula-approval.js") : root.HAKCore.formulaApproval;
  var V = isNode ? require("../validate.js") : root.HAKCore.validate;

  var LINK = FAP.LINK, STAMP_LINK = "Liên kết lúc", TYPE = "OVERTIME", TEST_TABLE = "dm_congthuc_kiemthu";
  

  function t(v) { return String(v == null ? "" : v).trim(); }
  function require_dn(s) { var k = String(s || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); return k ? (+k[1]) * 10000 + (+k[2]) * 100 + (+k[3]) : null; }

  /** Khóa công thức mà ENGINE dùng cho 1 dòng DM_TANGCA: "Loại công thức" nếu có, không thì chính Mã tăng ca. */
  function formulaKey(row) { return t(row && row["Loại công thức"]) || t(row && row["Mã tăng ca"]); }

  /** Danh sách mã tăng ca (khóa cha) theo thứ tự xuất hiện. */
  function parentCodes(db) {
    var seen = {}, out = [];
    (db.dm_tangca || []).forEach(function (r) { var c = t(r["Mã tăng ca"]); if (c && !seen[c]) { seen[c] = 1; out.push(c); } });
    return out;
  }
  /** Các dòng DM_TANGCA (phiên bản hiệu lực) của 1 mã, mới nhất trước. */
  function parentRows(db, ma) {
    return (db.dm_tangca || []).filter(function (r) { return t(r["Mã tăng ca"]) === ma; })
      .sort(function (a, b) { return String(b["Hiệu lực từ"] || "") < String(a["Hiệu lực từ"] || "") ? -1 : 1; });
  }
  /** Dòng cha đang hiệu lực trong kỳ (cùng quy tắc engine.hieuLuc). */
  function effectiveRow(rows, nam, thang) {
    var dau = nam * 10000 + thang * 100 + 1, cuoi = nam * 10000 + thang * 100 + 31, best = null;
    (rows || []).forEach(function (r) {
      var tu = require_dn(r["Hiệu lực từ"]), den = require_dn(r["Hiệu lực đến"]);
      if (tu != null && tu > cuoi) return;
      if (den != null && den < dau) return;
      if (!best || (tu || 0) >= (require_dn(best["Hiệu lực từ"]) || 0)) best = r;
    });
    return best;
  }
  /** Khóa công thức → các mã tăng ca (cha) dùng khóa đó. */
  function ownersByKey(db) {
    var map = {};
    parentCodes(db).forEach(function (ma) {
      var ks = {}; parentRows(db, ma).forEach(function (r) { var k = formulaKey(r); if (k) ks[k] = 1; });
      Object.keys(ks).forEach(function (k) { (map[k] = map[k] || []).push(ma); });
    });
    return map;
  }

  /**
   * Cha của 1 công thức OVERTIME.
   * @returns { ma, via: "explicit"|"derived"|"", status: "ok"|"orphan"|"ambiguous"|"invalid"|"notovertime", candidates:[...], problem }
   * Quy tắc "derived" (khi chưa có liên kết rõ): chỉ ĐÚNG KHI suy ra duy nhất —
   *   • đúng 1 mã tăng ca dùng khóa công thức này; hoặc
   *   • nhiều mã dùng chung khóa nhưng có đúng 1 mã có TÊN TRÙNG khóa (chủ sở hữu hiển nhiên — vd TC1 sở hữu công thức "TC1", TC7 chỉ dùng chung).
   * Còn lại → ambiguous/orphan, KHÔNG tự đoán.
   */
  function parentOf(db, rec, owners) {
    if (t(rec["Loại"]) !== TYPE) return { ma: "", via: "", status: "notovertime", candidates: [] };
    var exp = t(rec[LINK]);
    if (exp) {
      var pr = FAP.linkProblem(db, rec);
      return { ma: exp, via: "explicit", status: pr ? "invalid" : "ok", candidates: [exp], problem: pr };
    }
    owners = owners || ownersByKey(db);
    var key = t(rec["Mã công thức"]), c = owners[key] || [];
    if (c.length === 1) return { ma: c[0], via: "derived", status: "ok", candidates: c };
    if (c.length > 1) {
      if (c.indexOf(key) >= 0) return { ma: key, via: "derived", status: "ok", candidates: c };
      return { ma: "", via: "", status: "ambiguous", candidates: c };
    }
    return { ma: "", via: "", status: "orphan", candidates: [] };
  }
  /** Công thức con (mọi phiên bản, mọi trạng thái) của 1 mã tăng ca — KHÔNG gồm công thức của mã khác. Mới nhất trước. */
  function formulasOf(db, ma) {
    var owners = ownersByKey(db);
    return (db.dm_congthuc || []).filter(function (r) { var p = parentOf(db, r, owners); return p.ma === ma && p.status === "ok"; })
      .sort(function (a, b) { return (+b["Phiên bản"] || 1) - (+a["Phiên bản"] || 1) || (String(b["Hiệu lực từ"] || "") < String(a["Hiệu lực từ"] || "") ? -1 : 1); });
  }
  /** Mã tăng ca sở hữu khóa công thức của `ma` (khác ma nếu mã này dùng chung công thức của mã khác). */
  function sharedWith(db, ma) {
    var ks = {}, rows = parentRows(db, ma), o = ownersByKey(db), out = { key: "", ownerMa: "", others: [] };
    rows.forEach(function (r) { var k = formulaKey(r); if (k) ks[k] = 1; });
    var key = rows.length ? formulaKey(rows[0]) : ma; out.key = key;
    var c = o[key] || [];
    out.others = c.filter(function (x) { return x !== ma; });
    out.ownerMa = key !== ma && c.indexOf(key) >= 0 ? key : (key !== ma && c.length ? c[0] : "");
    out.dungChungCongThucCuaMaKhac = key !== ma;
    return out;
  }

  /** Công thức đang áp dụng cho 1 mã trong kỳ (đúng đường tra của engine) → { rec, nguon: "cauhinh"|"macdinh"|"none"|"loi", bieuThuc } */
  function applied(db, ma, nam, thang) {
    var rows = parentRows(db, ma), eff = effectiveRow(rows, nam, thang), key = eff ? formulaKey(eff) : ma;
    var tenCty = db.congty && db.congty[0] ? [db.congty[0]["Mã công ty"], db.congty[0]["Tên công ty"]].filter(function (x) { return t(x) !== ""; }) : [];
    var r = FML.resolveEx(db.dm_congthuc || [], { code: key, type: TYPE, companyId: tenCty, nam: nam, thang: thang });
    if (r.status === "OK" && r.rec) return { rec: r.rec, nguon: "cauhinh", bieuThuc: r.rec["Biểu thức"] || "", key: key };
    if (r.status === "CONFLICT") return { rec: null, nguon: "loi", bieuThuc: "", key: key, ghiChu: "Xung đột nhiều bản Hiệu lực" };
    var d = FML.defaults.overtime(key);
    if (d) return { rec: null, nguon: "macdinh", bieuThuc: d.bieuThuc, key: key, ten: d.ten };
    return { rec: null, nguon: "none", bieuThuc: "", key: key };
  }

  /** Dòng tóm tắt cho danh sách chính. */
  function summary(db, ma, nam, thang) {
    var rows = parentRows(db, ma), eff = effectiveRow(rows, nam, thang), latest = rows[0] || {};
    var base = eff || latest, ap = applied(db, ma, nam, thang), fs = formulasOf(db, ma);
    var trangThai = eff ? "Đang hiệu lực" : (rows.some(function (r) { var tu = require_dn(r["Hiệu lực từ"]); return tu != null && tu > nam * 10000 + thang * 100 + 31; }) ? "Chưa hiệu lực" : "Hết hiệu lực");
    var sh = sharedWith(db, ma);
    return {
      ma: ma, ten: base["Nội dung tăng ca"] || "", heSo: base["Hệ số tăng ca"], tienCoDinh: base["Tiền tăng ca (nếu tính cố định)"],
      loaiCongThuc: t(base["Loại công thức"]), khoaCongThuc: ap.key, trangThai: trangThai, tu: base["Hiệu lực từ"] || "", den: base["Hiệu lực đến"] || "",
      apDung: ap.nguon === "cauhinh" ? "v" + (ap.rec["Phiên bản"] || 1) + " · " + (ap.rec["Mã công thức"] || "") : ap.nguon === "macdinh" ? "Mặc định hệ thống (" + ap.key + ")" : ap.nguon === "loi" ? "⚠ Xung đột phiên bản" : "⚠ Chưa có công thức",
      nguonApDung: ap.nguon, soPhienBan: fs.length, soDong: rows.length, dungChung: sh.dungChungCongThucCuaMaKhac ? sh : null, row: base
    };
  }

  // ---------- Liên kết dữ liệu cũ (migration) ----------
  /**
   * Kế hoạch liên kết — KHÔNG ghi gì. Chỉ liên kết khi suy ra được DUY NHẤT (xem parentOf).
   * @returns { link:[{rec, ma}], already:[rec], ambiguous:[{rec, candidates}], orphans:[rec], invalid:[{rec, problem}], others:n }
   */
  function linkPlan(db) {
    var out = { link: [], already: [], ambiguous: [], orphans: [], invalid: [], others: 0 }, owners = ownersByKey(db);
    (db.dm_congthuc || []).forEach(function (r) {
      var p = parentOf(db, r, owners);
      if (p.status === "notovertime") { out.others++; return; }
      if (p.via === "explicit") { if (p.status === "ok") out.already.push(r); else out.invalid.push({ rec: r, problem: p.problem }); return; }
      if (p.status === "ok") out.link.push({ rec: r, ma: p.ma });
      else if (p.status === "ambiguous") out.ambiguous.push({ rec: r, candidates: p.candidates });
      else out.orphans.push(r);
    });
    return out;
  }
  /** Danh sách thao tác ghi cho kế hoạch (mỗi phần tử: { rec, values }) — nơi gọi đưa qua repository (có kiểm quyền/nhật ký). */
  function linkOps(plan, batchId) {
    return plan.link.map(function (x) { var v = {}; v[LINK] = x.ma; v[STAMP_LINK] = batchId; return { rec: x.rec, values: v, ma: x.ma }; });
  }
  /** Các dòng đã liên kết trong đợt batchId (để hoàn tác: xóa liên kết đã đặt, không đụng gì khác). */
  function rollbackOps(db, batchId) {
    return (db.dm_congthuc || []).filter(function (r) { return t(r[STAMP_LINK]) === batchId && t(r[LINK]); })
      .map(function (r) { var v = {}; v[LINK] = ""; v[STAMP_LINK] = ""; return { rec: r, values: v }; });
  }
  function batches(db) {
    var m = {}; (db.dm_congthuc || []).forEach(function (r) { var b = t(r[STAMP_LINK]); if (b) m[b] = (m[b] || 0) + 1; });
    return Object.keys(m).sort().map(function (b) { return { id: b, soDong: m[b] }; });
  }
  /** Kiểm tra toàn vẹn sau liên kết: mọi dòng giữ nguyên nội dung gốc; chỉ khác 2 cột liên kết. before/after là bản JSON của bảng. */
  function integrityDiff(beforeRows, afterRows) {
    var bad = [];
    if (beforeRows.length !== afterRows.length) bad.push("Số dòng đổi " + beforeRows.length + " → " + afterRows.length);
    var byId = {}; afterRows.forEach(function (r) { byId[r._id] = r; });
    beforeRows.forEach(function (b) {
      var a = byId[b._id]; if (!a) { bad.push("Mất dòng " + (b["Mã công thức"] || b._id)); return; }
      var keys = Object.keys(b).concat(Object.keys(a)).filter(function (k, i, arr) { return arr.indexOf(k) === i && k !== LINK && k !== STAMP_LINK; });
      keys.forEach(function (k) { if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) bad.push((b["Mã công thức"] || b._id) + ": đổi '" + k + "'"); });
    });
    return bad;
  }

  // ---------- Kiểm tra thông tin mã tăng ca (tab 1) ----------
  /**
   * @param f { ma, ten, heSo, tien, loaiCT, tu, den, moTa }  — giá trị người dùng nhập (chuỗi)
   * @param ctx { editing: dòng DM_TANGCA đang sửa | null, pct: function(v) → số hoặc NaN (đúng cách engine đọc hệ số), isoDate: function(v) → "YYYY-MM-DD"|"" }
   * @returns { errors:[], warnings:[] }
   */
  function validateInfo(db, f, ctx) {
    ctx = ctx || {}; var e = [], w = [], ma = t(f.ma);
    if (!ma) e.push("Chưa nhập Mã tăng ca");
    else if (!/^[A-Za-z0-9_.\-]+$/.test(ma)) e.push("Mã tăng ca chỉ gồm chữ không dấu, số, _ . - (không khoảng trắng)");
    if (!t(f.ten)) e.push("Chưa nhập Tên (nội dung) tăng ca");
    var tu = ctx.isoDate ? ctx.isoDate(f.tu) : t(f.tu), den = ctx.isoDate ? ctx.isoDate(f.den) : t(f.den);
    if (!t(f.tu)) e.push("Chưa nhập Hiệu lực từ"); else if (!tu) e.push("Hiệu lực từ không đúng định dạng ngày (dd/MM/yyyy)");
    if (t(f.den) && !den) e.push("Hiệu lực đến không đúng định dạng ngày (dd/MM/yyyy)");
    if (tu && den && den < tu) e.push("Hiệu lực đến phải sau hoặc bằng Hiệu lực từ");
    if (t(f.heSo) === "") w.push("Hệ số tăng ca đang trống — biến HE_SO_TC sẽ bằng 0 khi tính (hệ thống KHÔNG tự đặt hệ số mặc định)");
    else if (ctx.pct) { var p = ctx.pct(f.heSo); if (!isFinite(p) || p < 0) e.push("Hệ số tăng ca không hợp lệ (nhập số ≥ 0, ví dụ 1.5 hoặc 150%)"); }
    if (t(f.tien) !== "" && !(isFinite(+String(f.tien).replace(/[.,\s]/g, "")) && +String(f.tien).replace(/[.,\s]/g, "") >= 0)) e.push("Tiền tăng ca cố định phải là số ≥ 0");
    var lk = t(f.loaiCT);
    if (lk && lk !== ma) {
      var known = !!FML.defaults.overtime(lk) || (db.dm_congthuc || []).some(function (r) { return t(r["Mã công thức"]) === lk && t(r["Loại"]) === TYPE; });
      if (!known) w.push("Loại công thức '" + lk + "' chưa có công thức (không thuộc TC1–TC6 và chưa khai báo trong Công thức tiền lương) → khi tính lương sẽ báo FORMULA_ERROR");
    }
    if (ma && tu) {
      parentRows(db, ma).forEach(function (r) {
        if (ctx.editing && r === ctx.editing) return;
        if (FAP.rangesOverlap({ "Hiệu lực từ": r["Hiệu lực từ"], "Hiệu lực đến": r["Hiệu lực đến"] }, { "Hiệu lực từ": tu, "Hiệu lực đến": den })) e.push("Khoảng hiệu lực chồng lên một phiên bản khác của mã " + ma + " (" + (r["Hiệu lực từ"] || "…") + " → " + (r["Hiệu lực đến"] || "không giới hạn") + ")");
      });
    }
    return { errors: e, warnings: w };
  }
  /** Tác động của việc đổi thông tin mã: kỳ đã chốt từng dùng mã (bản chốt KHÔNG đổi) + mã đang dùng ở bao nhiêu NV (nếu truyền kq của kỳ đang xem). */
  function usage(db, ma, kqNow) {
    var closed = [];
    (db.kyluong || []).forEach(function (k) {
      var n = ((k.kq && k.kq.bangluong) || []).filter(function (b) { return b._ct && t(b._ct.maTangCa) === ma; }).length;
      if (n) closed.push({ ky: k.ky, soNV: n });
    });
    var now = kqNow ? (kqNow.bangluong || []).filter(function (b) { return b._ct && t(b._ct.maTangCa) === ma; }).length : null;
    return { closed: closed.sort(function (a, b) { return a.ky < b.ky ? 1 : -1; }), dangDung: now };
  }

  // ---------- Kiểm tra trước khi kích hoạt (mục 8.3) ----------
  var SAMPLE = { CONG_TINH_LUONG: 28, CONG_CHUAN: 26, CONG_CHUAN_2: 40, CONG_TC: 2, CONG_CHU_NHAT: 3, CONG_LE: 1, CONG_PHEP: 1, CONG_TRUNG_CHUYEN: 1, CONG_DI_CHUYEN: 1, HE_SO_TC: 1.5 };
  var ZERO = {}; Object.keys(SAMPLE).forEach(function (k) { ZERO[k] = 0; });
  /**
   * @returns [{ id, ok, level: "error"|"warn"|"info", msg }]  — "error" chặn kích hoạt.
   * ctx: { companyKeys:[...], closedPeriods:[ "YYYY-MM" ], hasCurrent: bool }
   */
  function preActivation(db, rec, ctx) {
    ctx = ctx || {}; var out = [], expr = t(rec["Biểu thức"]);
    var v = expr ? FML.validate(expr) : { ok: false, errors: [{ message: "Biểu thức để trống" }] };
    out.push({ id: "syntax", ok: v.ok, level: "error", msg: v.ok ? "Cú pháp và biến hợp lệ" : "Biểu thức không hợp lệ: " + v.errors.map(function (x) { return x.message; }).join("; ") });
    if (v.ok) {
      var allowed = {}; (FML.variables.NAMES || []).forEach(function (n) { allowed[n] = 1; });
      var dz = null, bad = null;
      [SAMPLE, ZERO].forEach(function (vars) {
        try { var r = FML.evaluate(expr, vars); if (!isFinite(r)) bad = "kết quả không xác định (NaN/vô hạn)"; } catch (ex) { if (ex.code === "DIV_ZERO") dz = ex.message; else bad = ex.message; }
      });
      out.push({ id: "div0", ok: !dz, level: "error", msg: dz ? "Có nhánh chia cho 0 khi biến bằng 0: " + dz + " — dùng IF để chặn" : "Không chia cho 0 (đã thử bộ biến mẫu và bộ biến bằng 0)" });
      out.push({ id: "finite", ok: !bad, level: "error", msg: bad ? "Phát sinh " + bad : "Kết quả luôn xác định" });
    }
    var cty = t(rec["Công ty"]);
    var keys = (ctx.companyKeys || []).map(function (x) { return t(x).toLowerCase(); });
    var okC = !cty || keys.indexOf(cty.toLowerCase()) >= 0;
    out.push({ id: "company", ok: okC, level: "error", msg: okC ? (cty ? "Công ty của công thức khớp file dữ liệu" : "Áp dụng mọi công ty (để trống)") : "Công thức ghi cho công ty khác ('" + cty + "') — sẽ không được áp dụng" });
    var cf = FAP.conflictWith(db, rec);
    var plan = FAP.activationPlan(db, rec);
    if (cf.length) out.push({ id: "conflict", ok: false, level: "error", msg: "Trùng ngày hiệu lực với bản Hiệu lực v" + (cf[0]["Phiên bản"] || 1) });
    else if (plan.blocked.length) out.push({ id: "overlap", ok: false, level: "error", msg: "Chồng hiệu lực với bản Hiệu lực v" + (plan.blocked[0]["Phiên bản"] || 1) + " bắt đầu cùng/sau ngày " + (rec["Hiệu lực từ"] || "…") + " — không thể tự đóng" });
    else if (plan.close.length) out.push({ id: "overlap", ok: true, level: "warn", msg: "Sẽ đóng ngày bản v" + (plan.close[0].row["Phiên bản"] || 1) + " đang hiệu lực: Hiệu lực đến = " + plan.close[0].den });
    else out.push({ id: "overlap", ok: true, level: "info", msg: "Không chồng khoảng hiệu lực với bản nào" });
    if (!t(rec["Hiệu lực từ"])) out.push({ id: "tu", ok: false, level: "error", msg: "Chưa có Hiệu lực từ" });
    var tuKy = t(rec["Hiệu lực từ"]).slice(0, 7), denKy = t(rec["Hiệu lực đến"]).slice(0, 7);
    var hit = (ctx.closedPeriods || []).filter(function (k) { return tuKy && k >= tuKy && (!denKy || k <= denKy); });
    out.push({ id: "closed", ok: true, level: hit.length ? "warn" : "info", msg: hit.length ? "Khoảng hiệu lực chạm kỳ đã chốt " + hit.join(", ") + " — bản chốt KHÔNG đổi; chỉ áp dụng nếu mở chốt và tính lại (cần quyền hồi tố)" : "Không chạm kỳ đã chốt nào" });
    out.push({ id: "compare", ok: !!ctx.hasCurrent, level: ctx.hasCurrent ? "info" : "warn", msg: ctx.hasCurrent ? "Có công thức hiện hành để so sánh (tab Kiểm thử thực tế)" : "Chưa có công thức hiện hành để so sánh" });
    return out;
  }

  // ---------- Kiểm thử trên dữ liệu thật ----------
  /** Nhân viên có dữ liệu chấm công trong kỳ? (Không có → hiển thị "Chưa có dữ liệu", không dùng 0 giả.) */
  function coChamCong(db, maNV, ky) {
    return (db.chamcong || []).some(function (r) { return t(r["Mã NV"]) === maNV && V.rowPeriod("chamcong", r) === ky; });
  }
  /** Nhân viên của kỳ có mã tăng ca này (theo bảng lương đã tính của engine). */
  function employeesOf(kq, ma, key) {
    return ((kq && kq.bangluong) || []).filter(function (b) { var c = b._ct || {}; return t(c.maTangCa) === ma || (key && t(c.loaiCongThucTangCa) === key && t(c.maTangCa) === ma); });
  }
  /**
   * So sánh công thức hiện tại (kết quả thật của engine) với biểu thức thử, trên cùng bộ biến thật của 1 NV.
   * @param b dòng bảng lương (engine.tinhBangLuong) · expr biểu thức thử · curExpr biểu thức hiện hành (để tái lập, kiểm tra khớp engine)
   * @param o { coChamCong: bool }
   */
  function trial(b, expr, curExpr, o) {
    o = o || {}; var c = (b && b._ct) || {}, vars = c.bienTC;
    var res = { ok: false, reason: "", rows: [], nhanh: c.nhanhTienTC || "", coSo: c.coSoTienTC || 0, selfCheck: null };
    if (!b) { res.reason = "Chưa có dữ liệu: nhân viên không có trong bảng lương kỳ này"; return res; }
    if (!vars) { res.reason = "Chưa có dữ liệu: nhân viên không được tính tăng ca trong kỳ (thiếu mã tăng ca, hết hiệu lực hoặc công chuẩn = 0)"; return res; }
    var nd = function (x) { return o.coChamCong === false ? "Chưa có dữ liệu" : x; };
    var cq0 = c.congTangCaQuyDoi, tien0 = b["Tiền tăng ca"], cqN = null, tienN = null, err = "";
    var v = FML.validate(t(expr)); if (!v.ok) err = v.errors.map(function (x) { return x.message; }).join("; ");
    else { try { cqN = FML.evaluate(expr, vars); tienN = Math.round(res.coSo * cqN); } catch (ex) { err = ex.message; } }
    if (curExpr) {
      try { var rc = FML.evaluate(curExpr, vars); res.selfCheck = { ok: Math.round(res.coSo * rc) === tien0, tai: Math.round(res.coSo * rc), that: tien0 }; } catch (ex) { res.selfCheck = { ok: false, loi: ex.message }; }
    }
    var f3 = function (x) { return x == null ? "" : Math.round(x * 1000) / 1000; };
    res.rows = [
      { chiTieu: "Công chuẩn (theo quy chế)", cu: nd(vars.CONG_CHUAN), moi: nd(vars.CONG_CHUAN) },
      { chiTieu: "Công tăng ca", cu: nd(vars.CONG_TC), moi: nd(vars.CONG_TC) },
      { chiTieu: "Công Chủ nhật (từ chấm công)", cu: nd(vars.CONG_CHU_NHAT), moi: nd(vars.CONG_CHU_NHAT) },
      { chiTieu: "Hệ số (theo danh mục)", cu: vars.HE_SO_TC, moi: vars.HE_SO_TC },
      { chiTieu: "Công quy đổi", cu: f3(cq0), moi: err ? "⚠ " + err : f3(cqN), laKq: true },
      { chiTieu: "Đơn giá / 1 công quy đổi (theo engine" + (res.nhanh ? ", nhánh " + res.nhanh : "") + ")", cu: Math.round(res.coSo), moi: Math.round(res.coSo) },
      { chiTieu: "Tiền tăng ca", cu: tien0, moi: err ? "⚠" : tienN, laKq: true },
      { chiTieu: "Chênh lệch", cu: "", moi: err ? "" : tienN - tien0, laChenh: true }
    ];
    res.ok = !err; res.reason = err; res.cq0 = cq0; res.cqN = cqN; res.tien0 = tien0; res.tienN = tienN; res.chenh = err ? null : tienN - tien0;
    return res;
  }
  /** Chạy các ca kiểm thử đã lưu (mỗi ca: { ten, bien:{...}, kyVong }) với biểu thức expr. */
  function runSaved(tests, expr) {
    return (tests || []).map(function (c) {
      var r = { ten: c.ten || "", kyVong: c.kyVong, ok: false, ketQua: null, loi: "" };
      try { r.ketQua = Math.round(FML.evaluate(expr, c.bien || {}) * 1e6) / 1e6; r.ok = Math.abs(r.ketQua - +c.kyVong) < 1e-6; } catch (ex) { r.loi = ex.message; }
      return r;
    });
  }

  // ---------- Diễn giải / thiết kế ----------
  var FN_VI = { MAX: "lớn nhất của", MIN: "nhỏ nhất của", IF: "nếu", ROUND: "làm tròn", ABS: "giá trị tuyệt đối của", FLOOR: "làm tròn xuống", CEIL: "làm tròn lên", SUM: "tổng của", COUNT: "số lượng của" };
  /** Diễn giải biểu thức bằng tiếng Việt (thay mã biến bằng tên). Không thực thi. */
  function explain(expr) {
    var P = isNode ? require("./formula-parser.js") : root.HAKCore.formulaParser, toks;
    try { toks = P.tokenize(expr); } catch (e) { return { ok: false, text: "", vars: [], msg: e.message }; }
    var used = [], seen = {}, parts = [];
    toks.forEach(function (k, i) {
      if (k.t === "EOF") return;
      if (k.t === "NUM") parts.push(String(k.v));
      else if (k.t === "IDENT") {
        var nx = toks[i + 1];
        if (nx && nx.t === "(") parts.push(FN_VI[k.v] || k.v);
        else { var vv = FML.variables.get(k.v); parts.push(vv ? "[" + vv.label + "]" : k.v); if (vv && !seen[k.v]) { seen[k.v] = 1; used.push(vv); } }
      } else if (k.t === "*") parts.push("×"); else if (k.t === "/") parts.push("÷"); else if (k.t === "AND") parts.push("và"); else if (k.t === "OR") parts.push("hoặc"); else if (k.t === "NOT") parts.push("không");
      else if (k.t === ">=") parts.push("≥"); else if (k.t === "<=") parts.push("≤"); else if (k.t === "!=") parts.push("≠");
      else parts.push(k.v);
    });
    return { ok: true, text: parts.join(" ").replace(/\( /g, "(").replace(/ \)/g, ")").replace(/ ,/g, ","), vars: used };
  }
  /** Tách biểu thức thành các token chip (chuỗi) cho chế độ thiết kế trực quan; join lại bằng joinTokens. */
  function chips(expr) {
    var P = isNode ? require("./formula-parser.js") : root.HAKCore.formulaParser, toks;
    try { toks = P.tokenize(expr); } catch (e) { return null; }
    return toks.filter(function (k) { return k.t !== "EOF"; }).map(function (k) { return k.t === "NUM" ? String(k.v) : String(k.v); });
  }
  function joinTokens(arr) {
    var s = ""; arr.forEach(function (k, i) {
      var prev = arr[i - 1];
      if (k === ")" || k === ",") s += k; else if (prev === "(" || !s) s += k; else if (k === "(" && prev && /^[A-Z_][A-Z0-9_]*$/.test(prev) && (prev === "IF" || FML.functions.isKnown(prev))) s += k; else s += " " + k;
    });
    return s.trim();
  }
  /** 10 biến tăng ca (lấy từ formula-variables.js — KHÔNG duy trì danh sách riêng về nội dung biến, chỉ danh sách TÊN nhóm hiển thị trước). */
  var OT_VARS = ["CONG_TINH_LUONG", "CONG_CHUAN", "CONG_CHUAN_2", "CONG_TC", "CONG_CHU_NHAT", "CONG_LE", "CONG_PHEP", "CONG_TRUNG_CHUYEN", "CONG_DI_CHUYEN", "HE_SO_TC"];
  function varLibrary() {
    return OT_VARS.map(function (n) { return FML.variables.get(n); }).filter(Boolean);
  }
  /** Mẫu TC6 trong wizard so với TC6 thật: số ca ngẫu nhiên khác nhau (để UI/test báo cáo khác biệt). */
  function compareTemplateToDefault(tpl, code, samples) {
    var d = FML.defaults.overtime(code); if (!d) return { comparable: false };
    var bad = 0, n = samples || 500, seed = 12345;
    var rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (var i = 0; i < n; i++) {
      var vv = { CONG_TINH_LUONG: Math.round(rnd() * 400) / 10, CONG_LE: Math.round(rnd() * 3), CONG_TRUNG_CHUYEN: Math.round(rnd() * 3), CONG_PHEP: Math.round(rnd() * 3), CONG_TC: Math.round(rnd() * 100) / 10, CONG_CHUAN: 26, CONG_CHU_NHAT: Math.round(rnd() * 4), CONG_DI_CHUYEN: Math.round(rnd() * 3), CONG_CHUAN_2: rnd() < 0.3 ? 40 : 0, HE_SO_TC: 1.5 };
      if (Math.abs(FML.evaluate(d.bieuThuc, vv) - FML.evaluate(tpl.bieuThuc, vv)) > 1e-9) bad++;
    }
    return { comparable: true, equivalent: bad === 0, soCaKhac: bad, tongCa: n };
  }

  var api = {
    LINK: LINK, STAMP_LINK: STAMP_LINK, TEST_TABLE: TEST_TABLE, OT_VARS: OT_VARS,
    formulaKey: formulaKey, parentCodes: parentCodes, parentRows: parentRows, effectiveRow: effectiveRow, ownersByKey: ownersByKey,
    parentOf: parentOf, formulasOf: formulasOf, sharedWith: sharedWith, applied: applied, summary: summary,
    linkPlan: linkPlan, linkOps: linkOps, rollbackOps: rollbackOps, batches: batches, integrityDiff: integrityDiff,
    validateInfo: validateInfo, usage: usage, preActivation: preActivation,
    coChamCong: coChamCong, employeesOf: employeesOf, trial: trial, runSaved: runSaved,
    explain: explain, chips: chips, joinTokens: joinTokens, varLibrary: varLibrary, compareTemplateToDefault: compareTemplateToDefault
  };
  if (isNode) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.overtimeMaster = api; }
})(typeof window !== "undefined" ? window : this);
