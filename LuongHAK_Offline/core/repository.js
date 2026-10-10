// ===== CORE / REPOSITORY — 1 cửa ghi dữ liệu nghiệp vụ (2.0 PR3) =====
// Mọi thêm / sửa / xóa bản ghi đi qua đây để các kiểm tra luôn chạy ĐỦ và ĐÚNG THỨ TỰ, TRƯỚC khi dữ liệu bị thay đổi:
//   1. quyền theo bảng (input.edit / dm.edit / hr.edit)
//   2. ô ngày chấm công hợp lệ (R-03d)
//   3. trùng khóa nghiệp vụ (hồ sơ nhân sự)
//   4. Q-15: phụ lục / hợp đồng đã dùng tính lương kỳ đã chốt → khóa (kể cả Admin)
//   5. kỳ đã chốt (locked) → chặn; hồi tố (retro) → chỉ Admin (Q-14), có thể yêu cầu xác nhận
// Hai bước: plan() chỉ kiểm tra, KHÔNG sửa gì → giao diện hỏi xác nhận nếu cần → apply() kiểm tra lại rồi mới ghi.
// Repository không biết giao diện: không alert/confirm, không lưu đĩa (việc lưu do app gọi save()).
(function (root) {
  "use strict";
  var isNode = typeof module !== "undefined" && module.exports;
  var V = isNode ? require("./validate.js") : root.HAKCore.validate;
  var GRD = isNode ? require("./period-guard.js") : root.HAKCore.guard;
  var IMP = isNode ? require("./importer.js") : root.HAKCore.importer;

  var MONTHLY = { chamcong: 1, sanluong: 1, bandam: 1, psluong: 1, ungluong: 1, tiencom: 1 };
  // Bảng con của hợp đồng (đổi Số HĐLĐ / xóa hợp đồng thì đổi / xóa theo) — giữ khớp hr.js HD_TABS
  var HD_CHILD_DEFAULT = ["chitiethd", "quyenloiphep", "nghiphep", "nghiom", "khamsk", "khenthuong", "noiquy", "tailieu"];

  function permFor(table) { return /^dm_/.test(table) ? "dm.edit" : MONTHLY[table] ? "input.edit" : table === "congty" ? "system.admin" : "hr.edit"; }
  function labels(ps) { return ps.map(GRD.label).join(", "); }
  function retroText(imp) {
    return "Dữ liệu này có hiệu lực trong kỳ lương ĐÃ CHỐT: " + labels(imp.periods) + ".\n" +
      "• Bảng lương đã chốt KHÔNG thay đổi.\n• Muốn áp dụng cho kỳ đó: Kỳ lương đã chốt → Mở chốt (ghi lý do) → tính lại → chốt lại (phiên bản mới, có so sánh trước/sau).";
  }
  function identOf(r) {
    if (!r) return "";
    return [r["Mã NV"], r["Số HĐLĐ"], r["Hiệu lực từ"] || r["Từ ngày"] || r["Ngày vào làm"], r["Mã lương"] || r["Mã phụ cấp"] || r["Mã phòng ban"] || r["Mã chức vụ"]].filter(Boolean).join(" · ");
  }

  /**
   * @param ctx {
   *   db: function () → dữ liệu hiện tại (app có thể thay cả object khi khôi phục)
   *   can: function (perm) → bool (quyền của người đang đăng nhập)
   *   audit: function (action, detail) — ghi nhật ký (app giữ việc cắt nhật ký + sao lưu)
   *   uid: function () → id mới
   *   tableName: function (table) → tên hiển thị
   *   hdChildren: [bảng con của hợp đồng] (mặc định HD_CHILD_DEFAULT)
   * }
   */
  function createRepo(ctx) {
    var hdChildren = ctx.hdChildren || HD_CHILD_DEFAULT;
    var tname = ctx.tableName || function (t) { return t; };

    function deny(code, msg, extra) { return Object.assign({ ok: false, code: code, msg: msg }, extra || {}); }

    /**
     * Kiểm tra 1 thao tác, KHÔNG sửa dữ liệu.
     * @param op "insert" | "update" | "remove"
     * @param target dòng đang có (update/remove) — đúng object trong db
     * @param values insert: dòng mới; update: các trường thay đổi (patch)
     * @param opts { what: "sửa phụ lục" (dùng trong thông báo), checkDup: true (hồ sơ: chặn trùng khóa) }
     * @returns { ok, code?, msg?, op, table, target, values, before, after, impact, retro, confirmMsg }
     */
    function plan(op, table, target, values, opts) {
      opts = opts || {};
      var db = ctx.db(), what = opts.what || (op === "insert" ? "thêm dữ liệu" : op === "remove" ? "xóa dữ liệu" : "sửa dữ liệu");
      var before = op === "insert" ? null : Object.assign({}, target);
      var after = op === "remove" ? null : op === "insert" ? Object.assign({}, values) : Object.assign({}, target, values);
      var base = { op: op, table: table, target: target, values: values, before: before, after: after, opts: opts };
      if (!Array.isArray(db[table])) return deny("table", "Bảng '" + table + "' không có trong dữ liệu");
      if (op !== "insert" && db[table].indexOf(target) < 0) return deny("stale", "Dòng này không còn trong dữ liệu (đã bị sửa / xóa ở thao tác khác) — hãy tải lại màn hình");
      // 1. quyền
      var perm = permFor(table);
      if (!ctx.can(perm)) return deny("perm", "Bạn không có quyền " + what + " (" + tname(table) + ")");
      // 2. ô ngày chấm công
      if (table === "chamcong" && after) {
        for (var d = 1; d <= 31; d++) {
          var c = ("0" + d).slice(-2);
          if (before && before[c] === after[c]) continue; // không chặn vì ô CŨ sai mà người dùng không sửa
          var dc = V.dayCell(c, after[c], after["Kỳ"]);
          if (dc.error) return deny("invalid", dc.error);
        }
      }
      // 3. trùng khóa nghiệp vụ (hồ sơ)
      if (opts.checkDup && after) {
        var k = IMP.keyOf(table, after);
        if (k && db[table].some(function (r) { return r !== target && IMP.keyOf(table, r) === k; }))
          return deny("dup", "Đã có bản ghi trùng (" + (IMP.KEYS[table] || []).join(" + ") + "). Hãy sửa bản ghi đó thay vì thêm mới.");
      }
      // 4. Q-15
      if (table === "chitiethd" && before) {
        var fz = GRD.frozenAppendix(db, before);
        if (fz.length) return deny("frozen", op === "remove"
          ? "⛔ Không xóa được: phụ lục này đã dùng tính lương kỳ ĐÃ CHỐT " + labels(fz) + " (quy tắc Q-15)."
          : "⛔ Phụ lục này đã dùng để tính lương kỳ ĐÃ CHỐT " + labels(fz) + " — không được sửa (quy tắc Q-15).\nMuốn thay đổi lương/chức vụ/phòng ban: bấm '＋ Thêm' để lập PHỤ LỤC MỚI có ngày hiệu lực từ kỳ chưa chốt.", { periods: fz });
      }
      if (table === "hopdong" && before && (op === "remove" || before["Số HĐLĐ"] !== after["Số HĐLĐ"])) {
        var fzH = GRD.frozenOfContract(db, before["Mã NV"], before["Số HĐLĐ"]);
        if (fzH.length) return deny("frozen", op === "remove"
          ? "⛔ Không xóa được: phụ lục của hợp đồng này đã dùng tính lương kỳ ĐÃ CHỐT " + labels(fzH) + " (quy tắc Q-15)."
          : "⛔ Không đổi được Số HĐLĐ: phụ lục của hợp đồng này đã dùng tính lương kỳ đã chốt " + labels(fzH) + " (Q-15).", { periods: fzH });
      }
      // 5. kỳ đã chốt / hồi tố
      var imp = GRD.impactChange(db, table, before, after);
      if (imp.kind === "locked") return deny("locked", "Không thể " + what + ": dữ liệu thuộc kỳ " + labels(imp.periods) + " đã chốt lương. Hãy mở chốt trước.", { impact: imp });
      if (imp.kind === "retro" && !ctx.can("retro.edit"))
        return deny("retro", "⛔ Không thể " + what + ": dữ liệu có hiệu lực trong kỳ lương đã chốt " + labels(imp.periods) + ".\nChỉ Admin được sửa dữ liệu hồi tố (Q-14).", { impact: imp });
      return Object.assign(base, { ok: true, impact: imp, retro: imp.kind === "retro",
        confirmMsg: imp.kind === "retro" ? what.charAt(0).toUpperCase() + what.slice(1) + "?\n\n" + retroText(imp) + "\n\nVẫn lưu thay đổi?" : "" });
    }

    /**
     * Ghi theo kế hoạch đã duyệt. Kiểm tra LẠI (dữ liệu có thể đã đổi trong lúc hỏi xác nhận) rồi mới sửa.
     * @param p kết quả plan() (ok = true)
     * @param o { audit: "always" | "retro" | false (mặc định "always"), action: nhãn nhật ký }
     * @returns { ok, row?, code?, msg? }
     */
    function apply(p, o) {
      o = o || {};
      if (!p || !p.ok) return p || deny("plan", "Chưa kiểm tra thao tác");
      var q = plan(p.op, p.table, p.target, p.values, p.opts);
      if (!q.ok) return q;
      if (q.retro !== p.retro) return deny("changed", "Dữ liệu vừa thay đổi — hãy thử lại");
      var db = ctx.db(), list = db[q.table], row = null;
      // Mọi kiểm tra đã qua → bây giờ mới sửa dữ liệu
      if (q.op === "insert") { row = Object.assign({ _id: ctx.uid() }, q.values); list.push(row); }
      else if (q.op === "update") {
        row = q.target;
        var oldHD = q.table === "hopdong" ? q.before["Số HĐLĐ"] : null;
        Object.assign(row, q.values);
        if (oldHD != null && oldHD !== row["Số HĐLĐ"])
          hdChildren.forEach(function (k) { (db[k] || []).forEach(function (r) { if (r["Mã NV"] === q.before["Mã NV"] && r["Số HĐLĐ"] === oldHD) r["Số HĐLĐ"] = row["Số HĐLĐ"]; }); });
      } else {
        list.splice(list.indexOf(q.target), 1);
        if (q.table === "hopdong")
          hdChildren.forEach(function (k) { if (db[k]) db[k] = db[k].filter(function (y) { return !(y["Mã NV"] === q.before["Mã NV"] && y["Số HĐLĐ"] === q.before["Số HĐLĐ"]); }); });
      }
      var mode = o.audit == null ? "always" : o.audit;
      if (mode === "always" || (mode === "retro" && q.retro)) {
        var ch = GRD.changedFields(q.before, q.op === "remove" ? null : row), id = identOf(q.after || q.before);
        ctx.audit(o.action || (q.op === "insert" ? "Thêm" : q.op === "remove" ? "Xóa" : "Sửa") + " dữ liệu",
          tname(q.table) + (id ? " · " + id : "") + (ch.length ? " · " + ch.slice(0, 12).join("; ") : "") +
          (q.retro ? " · [HỒI TỐ kỳ đã chốt " + labels(q.impact.periods) + "]" : ""));
      }
      return { ok: true, row: row, retro: q.retro, impact: q.impact };
    }

    return { plan: plan, apply: apply, permFor: permFor, retroText: retroText, identOf: identOf };
  }

  var api = { createRepo: createRepo, permFor: permFor, retroText: retroText, identOf: identOf, HD_CHILD_DEFAULT: HD_CHILD_DEFAULT };
  if (isNode) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.repo = api; }
})(typeof window !== "undefined" ? window : this);
