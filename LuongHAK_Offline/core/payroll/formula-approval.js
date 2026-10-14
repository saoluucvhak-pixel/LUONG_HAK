// ===== DUYỆT & PHIÊN BẢN CÔNG THỨC TIỀN LƯƠNG (Master V5 giai đoạn 2) =====
// Máy trạng thái: Nháp → Chờ duyệt → Đã duyệt → Hiệu lực → Ngừng. Kiểm tra ở TẦNG GHI DỮ LIỆU (core/repository.js gọi check()),
// giao diện chỉ gọi lại cùng hàm này để bật/tắt nút — không có đường ghi nào đi vòng được.
//   • Chỉ bản "Nháp" được sửa nội dung. Đã gửi duyệt/duyệt/hiệu lực: muốn đổi → sao chép thành phiên bản mới (copyAsDraft).
//   • Gửi duyệt/trả về/hủy nháp: quyền dm.edit. Duyệt, kích hoạt, ngừng: quyền formula.approve.
//   • Người duyệt khác người lập (trừ Admin). Kích hoạt kiểm tra: biểu thức hợp lệ, không trùng bản "Hiệu lực" cùng mã/công ty/ngày hiệu lực.
//   • Mỗi bước ghi người + thời điểm. Không xóa được bản đã gửi duyệt (giữ lịch sử).
(function (root) {
  "use strict";
  var isNode = typeof module !== "undefined" && module.exports;
  var FML = isNode ? require("./formula-engine.js") : root.HAKCore.formula;
  var REG = isNode ? require("./formula-registry.js") : root.HAKCore.formulaRegistry;

  var S = { NHAP: "Nháp", CHO: "Chờ duyệt", DUYET: "Đã duyệt", HL: "Hiệu lực", NGUNG: "Ngừng" };
  var TABLE = "dm_congthuc";
  // Nội dung làm thay đổi cách tính → chỉ sửa được khi còn Nháp
  var CONTENT = ["Mã công thức", "Loại", "Công ty", "Biểu thức", "Tham số", "Đơn vị tính", "Mức tiền", "Hệ số", "Đối tượng áp dụng", "Hiệu lực từ", "Phiên bản"];
  var STAMP = ["Người lập", "Ngày lập", "Người duyệt", "Thời điểm duyệt", "Người kích hoạt", "Thời điểm kích hoạt", "Người ngừng", "Thời điểm ngừng"];
  var NEXT = {}; // từ → { đến: quyền cần }
  NEXT[S.NHAP] = {}; NEXT[S.NHAP][S.CHO] = "dm.edit"; NEXT[S.NHAP][S.NGUNG] = "dm.edit";
  NEXT[S.CHO] = {}; NEXT[S.CHO][S.NHAP] = "dm.edit"; NEXT[S.CHO][S.DUYET] = "formula.approve"; NEXT[S.CHO][S.NGUNG] = "formula.approve";
  NEXT[S.DUYET] = {}; NEXT[S.DUYET][S.HL] = "formula.approve"; NEXT[S.DUYET][S.NGUNG] = "formula.approve"; NEXT[S.DUYET][S.NHAP] = "formula.approve";
  NEXT[S.HL] = {}; NEXT[S.HL][S.NGUNG] = "formula.approve";
  NEXT[S.NGUNG] = {};

  function st(r) { return r && r["Trạng thái"] ? String(r["Trạng thái"]) : S.NHAP; }
  function same(a, b) { return String(a == null ? "" : a).trim() === String(b == null ? "" : b).trim(); }
  function nowOf(env) { return env.now || new Date().toISOString(); }
  function userOf(env) { return env.user || ""; }
  function deny(code, msg) { return { ok: false, code: code, msg: msg }; }

  function exprProblem(rec) {
    var e = String(rec["Biểu thức"] || "").trim();
    if (!e) return "Biểu thức để trống";
    var v = FML.validate(e);
    return v.ok ? "" : v.errors.map(function (x) { return x.message; }).join("; ");
  }
  function conflictWith(db, rec) {
    var key = REG.normCompany(rec["Công ty"]);
    return (db[TABLE] || []).filter(function (r) {
      return r !== rec && st(r) === S.HL && same(r["Mã công thức"], rec["Mã công thức"]) && same(r["Loại"], rec["Loại"]) &&
        REG.normCompany(r["Công ty"]) === key && same(r["Hiệu lực từ"], rec["Hiệu lực từ"]);
    });
  }
  var LINK = "Mã tăng ca cha"; // V10.2: khóa cha = "Mã tăng ca" của DM_TANGCA (khóa ổn định; DM_TANGCA nhiều dòng cùng mã = các phiên bản hiệu lực của mã đó)
  function dnum(s) { return REG.dateNum(s); }
  /** Hai khoảng [tu, den] (rỗng = không giới hạn) có giao nhau không. */
  function rangesOverlap(a, b) {
    var at = dnum(a["Hiệu lực từ"]), ad = dnum(a["Hiệu lực đến"]), bt = dnum(b["Hiệu lực từ"]), bd = dnum(b["Hiệu lực đến"]);
    var aT = at == null ? -1 : at, bT = bt == null ? -1 : bt, aD = ad == null ? 99999999 : ad, bD = bd == null ? 99999999 : bd;
    return aT <= bD && bT <= aD;
  }
  /** Các bản "Hiệu lực" khác cùng mã/loại/phạm vi công ty có khoảng hiệu lực CHỒNG lên bản rec (không chỉ trùng ngày bắt đầu). */
  function overlapWith(db, rec) {
    var key = REG.normCompany(rec["Công ty"]);
    return (db[TABLE] || []).filter(function (r) {
      return r !== rec && st(r) === S.HL && same(r["Mã công thức"], rec["Mã công thức"]) && same(r["Loại"], rec["Loại"]) &&
        REG.normCompany(r["Công ty"]) === key && rangesOverlap(r, rec);
    });
  }
  function prevDay(iso) {
    var m = String(iso || "").match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (!m) return "";
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - 86400000);
    return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2);
  }
  /**
   * Kế hoạch thay thế khi kích hoạt bản rec: các bản "Hiệu lực" đang chồng được ĐÓNG NGÀY (Hiệu lực đến = ngày trước Hiệu lực từ của rec).
   * Chỉ đóng được bản bắt đầu TRƯỚC rec; bản bắt đầu cùng/sau rec → không tự đóng (blocked) để không làm mất hiệu lực lịch sử.
   * @returns { close:[{row, den}], blocked:[row] }
   */
  function activationPlan(db, rec) {
    var out = { close: [], blocked: [] }, tu = dnum(rec["Hiệu lực từ"]);
    overlapWith(db, rec).forEach(function (r) {
      var rt = dnum(r["Hiệu lực từ"]);
      if (tu != null && (rt == null || rt < tu)) out.close.push({ row: r, den: prevDay(rec["Hiệu lực từ"]) }); else out.blocked.push(r);
    });
    return out;
  }
  /** Mã cha có tồn tại trong DM_TANGCA và khớp khóa công thức (Loại công thức || Mã tăng ca) không. "" = hợp lệ. */
  function linkProblem(db, rec) {
    var p = String(rec[LINK] == null ? "" : rec[LINK]).trim();
    if (!p || String(rec["Loại"] || "") !== "OVERTIME") return "";
    var rows = (db.dm_tangca || []).filter(function (r) { return same(r["Mã tăng ca"], p); });
    if (!rows.length) return "Mã tăng ca cha '" + p + "' không có trong Danh mục tăng ca";
    var ok = rows.some(function (r) { return same(String(r["Loại công thức"] || "").trim() || String(r["Mã tăng ca"] || "").trim(), rec["Mã công thức"]); });
    return ok ? "" : "Mã công thức '" + (rec["Mã công thức"] || "") + "' không phải công thức của mã tăng ca '" + p + "' (mã tăng ca này dùng công thức '" + (String(rows[0]["Loại công thức"] || "").trim() || p) + "')";
  }
  function nextVersion(db, code, type) {
    var mx = 0; (db[TABLE] || []).forEach(function (r) { if (same(r["Mã công thức"], code) && same(r["Loại"], type)) mx = Math.max(mx, +r["Phiên bản"] || 1); });
    return mx + 1;
  }

  /**
   * @param op "insert" | "update" | "remove";  before: dòng hiện có (null khi insert); after: dòng sau thay đổi (null khi remove)
   * @param env { can(perm), user, now, db }
   * @returns { ok:true, patch } (patch = các trường hệ thống cần ghi thêm) | { ok:false, code, msg }
   */
  function check(op, before, after, env) {
    var db = env.db || {}, patch = {};
    if (op === "insert") {
      var s0 = st(after);
      if (s0 !== S.NHAP) {
        if (!env.can("formula.approve")) return deny("formula-state", "Công thức mới phải lưu ở trạng thái 'Nháp' rồi gửi duyệt (bạn không có quyền duyệt/kích hoạt công thức).");
        if (s0 === S.HL || s0 === S.DUYET) { var pr0 = exprProblem(after); if (pr0) return deny("formula-expr", "Biểu thức không hợp lệ: " + pr0); }
        patch["Người duyệt"] = userOf(env); patch["Thời điểm duyệt"] = nowOf(env);
      }
      var lp0 = linkProblem(db, after); if (lp0) return deny("formula-link", lp0);
      patch["Người lập"] = after["Người lập"] || userOf(env); patch["Ngày lập"] = after["Ngày lập"] || nowOf(env);
      if (!after["Phiên bản"]) patch["Phiên bản"] = nextVersion(db, after["Mã công thức"], after["Loại"]);
      return { ok: true, patch: patch };
    }
    var from = st(before);
    if (op === "remove") {
      if (from !== S.NHAP) return deny("formula-keep", "Không xóa công thức đã gửi duyệt/đã duyệt/đang hiệu lực — chuyển sang 'Ngừng' để giữ lịch sử phiên bản.");
      return { ok: true, patch: patch };
    }
    var to = st(after), changed = CONTENT.filter(function (c) { return !same(before[c], after[c]); });
    if (STAMP.some(function (c) { return !same(before[c], after[c]); }) && !env.internal) return deny("formula-stamp", "Không sửa trực tiếp các cột người lập/người duyệt/thời điểm — hệ thống tự ghi.");
    if (!same(before[LINK], after[LINK])) {
      // liên kết cha: Nháp sửa tự do (có kiểm khớp); các trạng thái khác chỉ được GÁN khi đang trống (liên kết bổ sung/migration), không đổi cha đã gán
      if (from !== S.NHAP && String(before[LINK] == null ? "" : before[LINK]).trim() !== "" && !env.internal && !env.can("system.admin")) return deny("formula-link", "Công thức đã gửi duyệt trở đi không được đổi mã tăng ca cha — hãy sao chép thành phiên bản mới.");
      var lp1 = linkProblem(db, after); if (lp1) return deny("formula-link", lp1);
    }
    if (from === to) {
      if (!changed.length) return { ok: true, patch: patch };
      if (from === S.NHAP) return { ok: true, patch: patch };
      if (from === S.HL && changed.length === 1 && changed[0] === "Hiệu lực đến") {
        if (!env.can("formula.approve")) return deny("perm", "Chỉ người có quyền duyệt công thức mới đặt ngày hết hiệu lực.");
        return { ok: true, patch: patch };
      }
      return deny("formula-frozen", "Công thức ở trạng thái '" + from + "' không được sửa nội dung (" + changed.join(", ") + "). Hãy 'Sao chép thành phiên bản mới' rồi duyệt lại.");
    }
    if (!NEXT[from] || !NEXT[from][to]) return deny("formula-flow", "Không chuyển trực tiếp '" + from + "' → '" + to + "'. Quy trình: Nháp → Chờ duyệt → Đã duyệt → Hiệu lực.");
    if (changed.length) return deny("formula-frozen", "Khi đổi trạng thái không đồng thời sửa nội dung (" + changed.join(", ") + ").");
    var perm = NEXT[from][to];
    if (!env.can(perm)) return deny("perm", perm === "formula.approve" ? "Bạn không có quyền duyệt/kích hoạt/ngừng công thức tiền lương." : "Bạn không có quyền sửa danh mục.");
    if (to === S.CHO || to === S.DUYET || to === S.HL) { var pr = exprProblem(before); if (pr) return deny("formula-expr", "Không thể chuyển '" + to + "': biểu thức không hợp lệ — " + pr); }
    if (to === S.DUYET && same(before["Người lập"], userOf(env)) && before["Người lập"] && !env.can("system.admin"))
      return deny("formula-maker", "Người duyệt phải khác người lập công thức (" + before["Người lập"] + ").");
    if (to === S.HL) {
      var cf = conflictWith(db, before);
      if (cf.length) return deny("formula-conflict", "Đã có bản 'Hiệu lực' cùng mã, cùng công ty, cùng ngày hiệu lực từ (phiên bản " + (cf[0]["Phiên bản"] || 1) + ") — ngừng bản đó hoặc đặt ngày hiệu lực khác.");
      var ov = overlapWith(db, before);
      if (ov.length) return deny("formula-overlap", "Khoảng hiệu lực chồng lên bản 'Hiệu lực' phiên bản " + (ov[0]["Phiên bản"] || 1) + " (" + (ov[0]["Hiệu lực từ"] || "…") + " → " + (ov[0]["Hiệu lực đến"] || "không giới hạn") + "). Đặt 'Hiệu lực đến' cho bản cũ (ngày trước ngày hiệu lực từ của bản mới) hoặc đổi ngày hiệu lực.");
    }
    if (to === S.DUYET) { patch["Người duyệt"] = userOf(env); patch["Thời điểm duyệt"] = nowOf(env); }
    if (to === S.HL) { patch["Người kích hoạt"] = userOf(env); patch["Thời điểm kích hoạt"] = nowOf(env); }
    if (to === S.NGUNG) { patch["Người ngừng"] = userOf(env); patch["Thời điểm ngừng"] = nowOf(env); }
    if (to === S.NHAP) { patch["Người duyệt"] = ""; patch["Thời điểm duyệt"] = ""; }
    return { ok: true, patch: patch };
  }

  /** Các thao tác trạng thái người dùng được phép làm trên 1 dòng — để giao diện hiện nút (quyền thật vẫn do check() quyết định). */
  function actionsFor(rec, env) {
    var from = st(rec), out = [];
    Object.keys(NEXT[from] || {}).forEach(function (to) {
      if (!env.can(NEXT[from][to])) return;
      if (to === S.DUYET && same(rec["Người lập"], userOf(env)) && rec["Người lập"] && !env.can("system.admin")) return;
      out.push(to);
    });
    return out;
  }

  /** Giá trị cho dòng "Sao chép thành phiên bản mới": cùng nội dung, trạng thái Nháp, phiên bản kế tiếp, xóa dấu duyệt. */
  function copyAsDraft(rec, env) {
    var v = {}; Object.keys(rec).forEach(function (k) { if (k !== "_id") v[k] = rec[k]; });
    STAMP.forEach(function (k) { v[k] = ""; });
    v["Trạng thái"] = S.NHAP; v["Phiên bản"] = nextVersion(env.db || {}, rec["Mã công thức"], rec["Loại"]);
    v["Hiệu lực đến"] = ""; v["Lý do thay đổi"] = "";
    return v;
  }

  var api = { STATES: S, TABLE: TABLE, check: check, actionsFor: actionsFor, copyAsDraft: copyAsDraft, conflictWith: conflictWith, nextVersion: nextVersion,
    LINK: LINK, overlapWith: overlapWith, activationPlan: activationPlan, linkProblem: linkProblem, rangesOverlap: rangesOverlap, prevDay: prevDay };
  if (isNode) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.formulaApproval = api; }
})(typeof window !== "undefined" ? window : this);
