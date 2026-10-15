// ===== UI / FORMULA-MASTER — Danh mục dạng Master–Detail + Form Modal quản lý công thức, DÙNG CHUNG cho Tăng ca · Phụ cấp · Hỗ trợ (V10.2/V10.3) =====
// Tách khỏi app.js theo module: MasterView (danh sách) · DetailModal (khung modal + tab) · InfoForm (tab 1) ·
// FormulaList + FormulaDesigner (tab 2) · FormulaTestPanel (tab 3) · FormulaVersionHistory (tab 4) · LinkMigrationDialog.
// Quy tắc: giao diện KHÔNG sửa dữ liệu trực tiếp — mọi ghi đi qua REPO.plan/commit (kiểm quyền, duyệt/phiên bản, kỳ chốt) và txn (một lần lưu);
// quyền thật được kiểm lại ở tiến trình chính (main/write-policy.js). Logic nghiệp vụ nằm ở core/payroll/formula-master.js (thuần, có test). Khác biệt giữa 3 loại chỉ nằm ở cấu hình KINDS (create(A, type)).
// Chạy thử / chọn mẫu / đổi bộ lọc KHÔNG ghi dữ liệu.
(function (root) {
  "use strict";
  var FM = root.HAKCore.formulaMaster, FAP = root.HAKCore.formulaApproval, FML = root.HAKCore.formula, TPL = root.HAKCore.formulaTemplates, VAL = root.HAKCore.validate;

  function create(A, type) {
    type = type || "OVERTIME";
    var OM = FM.forType(type), K = OM.KIND, IS_OT = type === "OVERTIME";
    var h = A.h, btn = A.btn, esc = A.esc, fmt = A.fmt, T = K.table, TC = "dm_congthuc", TT = OM.TEST_TABLE;
    var S = { q: "", fTrang: "", fCT: "", nam: null, thang: null }; // bộ lọc danh sách (không lưu dữ liệu)
    var M = null; // trạng thái modal đang mở
    var tag = function (txt, cls) { return h("span", { class: "tag " + (cls || "off"), text: txt }); };
    var ky = function () { return S.nam + "-" + ("0" + S.thang).slice(-2); };
    function periodInit() { if (!S.nam) { S.nam = A.st.nam; S.thang = A.st.thang; } }
    var fdate = function (iso) { var n = VAL.normDate(iso); return n ? n.slice(8, 10) + "/" + n.slice(5, 7) + "/" + n.slice(0, 4) : (iso || ""); };
    var money = function (v) { var n = +v; return isFinite(n) && v !== "" && v != null ? n.toLocaleString("vi-VN") : ""; };
    var db = function () { return A.db(); };

    /** Danh sách chọn cho ô "Loại công thức": công thức mặc định/có sẵn của hệ thống + khóa công thức đã cấu hình + (tăng ca) mã tăng ca khác. */
    function loaiOpts() {
      var FD = (window.HAKCore && window.HAKCore.formulaDefaults) || {}, seen = { "": 1 }, out = [];
      out.push(["", IS_OT ? "Theo mã này (mặc định)" : "(Để trống — " + K.fallbackLabel.split(" (")[0] + ")"]);
      var sys = [];
      if (IS_OT) Object.keys(FD.OVERTIME || {}).forEach(function (k) { if (!seen[k]) { seen[k] = 1; sys.push([k, k + " — " + String((FD.OVERTIME[k] || {}).ten || "công thức mặc định").replace(/^[^—]*—\s*/, "")]); } });
      else Object.keys(K.builtin || {}).forEach(function (k) { if (!seen[k]) { seen[k] = 1; sys.push([k, k + " — " + K.builtin[k]]); } });
      if (sys.length) out.push({ group: "Công thức có sẵn của hệ thống", items: sys });
      var cfg = [];
      (db().dm_congthuc || []).forEach(function (r) { var k = String(r["Mã công thức"] || "").trim(); if (String(r["Loại"] || "") === type && k && !seen[k]) { seen[k] = 1; cfg.push([k, k + (r["Tên công thức"] ? " — " + r["Tên công thức"] : "") + (r["Trạng thái"] ? " (" + r["Trạng thái"] + ")" : "")]); } });
      if (cfg.length) out.push({ group: "Công thức đã cấu hình", items: cfg });
      if (IS_OT) { var oth = []; OM.parentCodes(db()).forEach(function (c) { if (!seen[c] && c !== (M && M.ma)) { seen[c] = 1; oth.push([c, "Dùng chung công thức của mã " + c]); } }); if (oth.length) out.push({ group: "Dùng chung với mã tăng ca khác", items: oth }); }
      return out;
    }

    // ---- Ô nhập SỐ TIỀN: hiện dấu chấm phân cách hàng nghìn khi gõ, dấu phẩy là thập phân; giá trị LƯU là số thường (vd "1234567" hoặc "1234.5") ----
    function moneyShow(v) { var x = String(v == null ? "" : v).trim(); if (!/^\d+(\.\d+)?$/.test(x)) return x; var p = x.split("."); return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (p[1] != null ? "," + p[1] : ""); }
    function moneyEdit(inp) {
      var raw = inp.value, pos = inp.selectionStart == null ? raw.length : inp.selectionStart;
      var keep = raw.slice(0, pos).replace(/[^\d,]/g, "").length;
      var c = raw.replace(/[^\d,]/g, ""), ci = c.indexOf(","), ip = (ci < 0 ? c : c.slice(0, ci)), dp = ci < 0 ? null : c.slice(ci + 1).replace(/,/g, "");
      ip = ip.replace(/^0+(?=\d)/g, "");
      var shown = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (dp != null ? "," + dp : "");
      if (shown !== raw) { inp.value = shown; var n = 0, i = 0; if (keep > 0) { for (; i < shown.length && n < keep; i++) if (/[\d,]/.test(shown[i])) n++; } try { inp.setSelectionRange(i, i); } catch (e) { /* ô không hỗ trợ đặt con trỏ */ } }
      return ip === "" && dp == null ? "" : (ip === "" ? "0" : ip) + (dp ? "." + dp : "");
    }

    // ================= DANH SÁCH (MASTER) =================
    function rows() {
      periodInit();
      var out = OM.parentCodes(db()).map(function (ma) { return OM.summary(db(), ma, S.nam, S.thang); });
      var q = S.q.trim().toLowerCase();
      return out.filter(function (r) {
        if (q && (r.ma + " " + r.ten + " " + r.loaiCongThuc).toLowerCase().indexOf(q) < 0) return false;
        if (S.fTrang && r.trangThai !== S.fTrang) return false;
        if (S.fCT === "cauhinh" && r.nguonApDung !== "cauhinh") return false;
        if (S.fCT === "macdinh" && r.nguonApDung !== "macdinh") return false;
        if (S.fCT === "lichsu" && r.nguonApDung !== "lichsu" && r.nguonApDung !== "none") return false;
        if (S.fCT === "thieu" && (r.nguonApDung === "cauhinh" || r.nguonApDung === "macdinh" || (!IS_OT && r.nguonApDung === "lichsu"))) return false;
        return true;
      });
    }
    function masterView() {
      periodInit();
      var w = h("div", { class: "card ot-master", "data-ot-master": "1" });
      var bar = h("div", { class: "bar" });
      bar.appendChild(h("h3", { text: K.title, style: "margin:0 12px 0 0" }));
      var inq = h("input", { class: "i", placeholder: "Tìm mã / tên " + K.short.toLowerCase() + "…", value: S.q, "aria-label": "Tìm " + K.noun, "data-ot-q": "1", style: "min-width:220px" });
      var sTr = h("select", { "aria-label": "Lọc trạng thái", "data-ot-ftrang": "1" }); [["", "Mọi trạng thái"], ["Đang hiệu lực", "Đang hiệu lực"], ["Chưa hiệu lực", "Chưa hiệu lực"], ["Hết hiệu lực", "Hết hiệu lực"]].forEach(function (o) { sTr.appendChild(h("option", { value: o[0], text: o[1] })); }); sTr.value = S.fTrang;
      var sCT = h("select", { "aria-label": "Lọc công thức", "data-ot-fct": "1" }); (IS_OT ? [["", "Mọi công thức"], ["cauhinh", "Có công thức cấu hình"], ["macdinh", "Dùng mặc định hệ thống"], ["thieu", "Thiếu / lỗi công thức"]] : [["", "Mọi công thức"], ["cauhinh", "Có công thức cấu hình"], ["macdinh", "Dùng cách tính có sẵn của engine"], ["lichsu", "Dùng cách tính lịch sử (chưa có công thức)"], ["thieu", "Thiếu / lỗi công thức"]]).forEach(function (o) { sCT.appendChild(h("option", { value: o[0], text: o[1] })); }); sCT.value = S.fCT;
      var kyIn = h("select", { "aria-label": "Kỳ xét", title: "Kỳ dùng để xác định công thức/phiên bản đang áp dụng", "data-ot-ky": "1" });
      (function () { var ids = {}, closed = {}; (A.closedPeriods ? A.closedPeriods() : []).forEach(function (k) { if (k) { ids[k] = 1; closed[k] = 1; } });
        for (var d = -18; d <= 6; d++) { var dt = new Date(A.st.nam, A.st.thang - 1 + d, 1); ids[dt.getFullYear() + "-" + ("0" + (dt.getMonth() + 1)).slice(-2)] = 1; } ids[ky()] = 1;
        Object.keys(ids).sort().reverse().forEach(function (k) { var o = h("option", { value: k, text: "Kỳ " + k.slice(5) + "/" + k.slice(0, 4) + (closed[k] ? " 🔒" : "") }); if (k === ky()) o.selected = true; kyIn.appendChild(o); }); })();
      kyIn.addEventListener("change", function () { if (kyIn.value) { var m = kyIn.value.split("-"); S.nam = +m[0]; S.thang = +m[1]; paint(); } });
      bar.appendChild(inq); bar.appendChild(sTr); bar.appendChild(sCT); bar.appendChild(h("label", { text: "Kỳ xét" })); bar.appendChild(kyIn);
      bar.appendChild(h("span", { class: "sp" }));
      if (A.can("dm.edit")) bar.appendChild(btn("＋ Thêm " + K.noun, "pri", function () { openModal(null, { tab: "info", edit: true }); }));
      if (A.can("dm.edit") || A.can("formula.approve")) bar.appendChild(btn("🔗 Liên kết công thức cũ", "", linkDialog));
      bar.appendChild(btn("↻ Làm mới", "", function () { A.render(); }));
      w.appendChild(bar);
      w.appendChild(h("div", { class: "hint", text: "Mỗi " + K.noun + " (bảng cha) quản lý các phiên bản công thức của riêng nó (bảng con). Mở chi tiết để xem/chỉnh thông tin, quản lý công thức, kiểm thử trên dữ liệu thật và xem lịch sử. Không sửa hàng loạt trên bảng này." }));
      var box = h("div", { class: "tw ot-list" }); w.appendChild(box);
      function paint() {
        box.innerHTML = "";
        var rs = rows(), t = h("table", { "data-ot-table": "1" });
        t.appendChild(h("tr", {}, [{ label: K.code }, { label: K.name.replace(" (nội dung)", "") }].concat(K.listCols, [{ label: "Mã công thức" }, { label: "Trạng thái" }, { label: "Hiệu lực" }, { label: "Công thức đang áp dụng" }, { label: "Số phiên bản" }, { label: "Thao tác" }]).map(function (c) { return h("th", c.tip ? { text: c.label + " ⓘ", title: c.tip, style: "cursor:help" } : { text: c.label }); })));
        rs.forEach(function (r) {
          var act = h("td", { class: "t ot-act" });
          act.appendChild(btn("Xem chi tiết", "pri", function () { openModal(r.ma, { tab: "info" }); }));
          if (A.can("dm.edit")) act.appendChild(btn("Chỉnh sửa", "", function () { openModal(r.ma, { tab: "info", edit: true }); }));
          if (A.can("dm.edit") && r.trangThai === "Đang hiệu lực") act.appendChild(btn("Ngừng sử dụng", "", function () { stopDialog(r.ma); }));
          if (A.can("dm.edit")) act.appendChild(btn("Xóa", "red ghost", function () { deleteMa(r.ma); }, "Chỉ xóa được " + K.noun + " chưa áp dụng cho nhân viên nào")).setAttribute("data-ot-del", r.ma);
          var apCls = r.nguonApDung === "cauhinh" ? "on" : (r.nguonApDung === "macdinh" || r.nguonApDung === "lichsu") ? "off" : "bad";
          t.appendChild(h("tr", { "data-ot-row": r.ma }, [
            h("td", { class: "t", html: "<b>" + esc(r.ma) + "</b>" }), h("td", { class: "t", text: r.ten })
            ].concat(K.listCols.map(function (c) { return h("td", { class: "t" + (c.num ? " num" : ""), text: c.get(r.row) }); }), [
            h("td", { class: "t", text: r.loaiCongThuc || (IS_OT ? "(theo mã)" : "(trống)") }),
            h("td", {}, [tag(r.trangThai, r.trangThai === "Đang hiệu lực" ? "on" : "off")]),
            h("td", { class: "t", text: (fdate(r.tu) || "…") + " → " + (fdate(r.den) || "không giới hạn") }),
            h("td", {}, [tag(r.apDung, apCls)].concat(r.dungChung ? [h("div", { class: "hint", style: "margin:2px 0 0", text: "dùng chung công thức " + r.khoaCongThuc })] : [])),
            h("td", { class: "t num", text: String(r.soPhienBan) }), act])));
        });
        box.appendChild(t);
        if (!rs.length) box.appendChild(h("div", { class: "empty", text: OM.parentCodes(db()).length ? "Không có mã nào khớp bộ lọc." : "Chưa có " + K.noun + " nào — bấm “＋ Thêm " + K.noun + "”." }));
        var cnt = w.querySelector("[data-ot-count]"); if (cnt) cnt.textContent = rs.length + " / " + OM.parentCodes(db()).length + " mã";
      }
      inq.addEventListener("input", function () { S.q = inq.value; paint(); });
      sTr.addEventListener("change", function () { S.fTrang = sTr.value; paint(); });
      sCT.addEventListener("change", function () { S.fCT = sCT.value; paint(); });
      w.appendChild(h("div", { class: "hint", "data-ot-count": "1" }));
      paint();
      return w;
    }

    // ================= KHUNG MODAL =================
    function openModal(ma, o) {
      o = o || {}; periodInit();
      var rs = ma ? OM.parentRows(db(), ma) : [];
      M = { ma: ma, tab: o.tab || "info", edit: !!o.edit || !ma, isNew: !ma, dirty: false, row: ma ? (OM.effectiveRow(rs, S.nam, S.thang) || rs[0]) : null,
        info: null, fsel: null, fd: null, test: { nv: "", ver: "", expr: "" }, lsFilter: "", reason: "" };
      M.info = infoFromRow(M.row, ma);
      mount();
    }
    function tryClose() {
      if (M && M.dirty && !confirm("Có thay đổi CHƯA LƯU trong hồ sơ này. Đóng và bỏ thay đổi?")) return false;
      var m = A.$("#modal"); m.className = "hide"; m.innerHTML = ""; m.onclick = null; document.removeEventListener("keydown", onKey, true); M = null; A.render(); return true;
    }
    function onKey(e) { if (e.key === "Escape" && M) { e.stopPropagation(); tryClose(); } }
    function mount() {
      var m = A.$("#modal"); m.innerHTML = ""; m.className = "";
      m.onclick = function (e) { if (e.target === m) tryClose(); };
      document.removeEventListener("keydown", onKey, true); document.addEventListener("keydown", onKey, true);
      var d = h("div", { class: "dlg wide ot-dlg", "data-ot-modal": M.ma || "(mới)", role: "dialog", "aria-modal": "true" });
      m.appendChild(d); draw();
    }
    function draw() {
      var d = A.$("#modal .ot-dlg"); if (!d) return; d.innerHTML = "";
      var sm = M.ma ? OM.summary(db(), M.ma, S.nam, S.thang) : null;
      var hd = h("header", {}, [h("h3", { text: M.ma ? M.ma + " — " + (sm.ten || "") : "Thêm " + K.noun + " mới" })]);
      if (sm) { hd.appendChild(tag(sm.trangThai, sm.trangThai === "Đang hiệu lực" ? "on" : "off")); hd.appendChild(h("span", { class: "hint", style: "margin:0 8px", text: "Hiệu lực " + (fdate(sm.tu) || "…") + " → " + (fdate(sm.den) || "không giới hạn") })); }
      hd.appendChild(M.edit ? tag("Đang sửa", "bad") : tag("Chỉ xem", "off"));
      hd.appendChild(btn("✕", "ghost", function () { tryClose(); }, "Đóng"));
      d.appendChild(hd);
      var tabs = h("div", { class: "bar ot-tabs", style: "padding:8px 20px 0;margin:0" });
      [["info", "Thông tin " + K.short.toLowerCase()], ["ct", "Công thức tính"], ["test", "Kiểm thử thực tế"], ["ls", "Lịch sử phiên bản"]].forEach(function (t) {
        var dis = M.isNew && t[0] !== "info";
        var b = btn(t[1], M.tab === t[0] ? "pri" : "", function () { if (dis) { A.toast("Hãy lưu thông tin " + K.noun + " trước"); return; } M.tab = t[0]; draw(); });
        b.setAttribute("data-ot-tab", t[0]); if (dis) b.disabled = true; tabs.appendChild(b);
      });
      d.appendChild(tabs);
      var bd = h("div", { class: "bd ot-body" });
      if (M.tab === "info") bd.appendChild(infoTab()); else if (M.tab === "ct") bd.appendChild(formulaTab()); else if (M.tab === "test") bd.appendChild(testTab()); else bd.appendChild(historyTab());
      d.appendChild(bd);
      var ft = h("footer", {}); footerFor(ft); d.appendChild(ft);
    }
    function footerFor(ft) {
      if (M.tab === "info" && M.edit) {
        ft.appendChild(btn("Hủy", "", function () { if (M.dirty && !confirm("Bỏ các thay đổi chưa lưu?")) return; if (M.isNew) { M.dirty = false; tryClose(); return; } M.edit = false; M.dirty = false; M.info = infoFromRow(M.row, M.ma); draw(); }));
        ft.appendChild(btn("Lưu thông tin", "pri", saveInfo)).setAttribute("data-ot-save-info", "1");
      } else if (M.tab === "info" && A.can("dm.edit")) ft.appendChild(btn("Chỉnh sửa thông tin", "pri", function () { M.edit = true; draw(); })).setAttribute("data-ot-edit-info", "1");
      ft.appendChild(btn("Đóng", "", function () { tryClose(); })).setAttribute("data-ot-close", "1");
    }

    // ================= TAB 1: THÔNG TIN =================
    function infoFromRow(r, ma) {
      r = r || {};
      var o = { ma: ma || r[K.code] || "", ten: r[K.nameCol] || "", loaiCT: r["Loại công thức"] || "", tu: r["Hiệu lực từ"] || "", den: r["Hiệu lực đến"] || "", moTa: r["Cách tính"] || "", mode: "inplace", tuMoi: "" };
      K.fields.forEach(function (fd) { o[fd.key] = r[fd.col] == null ? "" : String(r[fd.col]); });
      return o;
    }
    function infoTab() {
      var w = h("div"), f = M.info, ro = !M.edit;
      var sh = M.ma ? OM.sharedWith(db(), M.ma) : null;
      var grid = h("div", { class: "fgrid ot-info" });
      var fld = function (lbl, key, o) {
        o = o || {}; var box = h("div", { class: "fld" + (o.wide ? " wide" : "") + (o.span2 ? " span2" : "") }), inp;
        box.appendChild(h("label", { text: lbl + (o.req && !ro ? " *" : "") }));
        if (ro) { box.appendChild(h("div", { class: "ot-ro" + (o.right || o.money ? " rt" : ""), "data-ot-ro": key, text: o.show ? o.show(f[key]) : (f[key] === "" ? "—" : String(f[key])) })); return box; }
        if (o.date) { inp = A.dateField(f[key], { "aria-label": lbl }); inp.addEventListener("change", function () { var v = A.dateIso(inp); f[key] = v === null ? inp.value : v || ""; dirty(); }); }
        else if (o.area) { inp = h("textarea", { rows: 2, "aria-label": lbl }); inp.value = f[key]; inp.addEventListener("input", function () { f[key] = inp.value; dirty(); }); }
        else if (o.opts) { inp = h("select", { "aria-label": lbl }); var cur = String(f[key] == null ? "" : f[key]), seen0 = false;
          o.opts().forEach(function (g) { var og = g.group ? h("optgroup", { label: g.group }) : null; (g.items || [g]).forEach(function (it) { var op = h("option", { value: it[0], text: it[1] }); if (it[0] === cur) { op.selected = true; seen0 = true; } (og || inp).appendChild(op); }); if (og) inp.appendChild(og); });
          if (!seen0 && cur) { var op2 = h("option", { value: cur, text: cur + " (giá trị hiện tại — không còn trong danh sách)" }); op2.selected = true; inp.appendChild(op2); }
          inp.addEventListener("change", function () { f[key] = inp.value; dirty(); }); }
        else if (o.money) { inp = h("input", { "aria-label": lbl, value: moneyShow(f[key]), class: (o.cls || "") + " rt", inputmode: "decimal", autocomplete: "off" }); inp.addEventListener("input", function () { f[key] = moneyEdit(inp); dirty(); }); }
        else { inp = h("input", { "aria-label": lbl, value: f[key], class: (o.cls || "") + (o.right ? " rt" : "") }); if (o.locked) inp.disabled = true; inp.addEventListener("input", function () { f[key] = inp.value; dirty(); }); }
        inp.setAttribute("data-ot-f", key); box.appendChild(inp); if (o.note) box.appendChild(h("div", { class: "hint", style: "margin:2px 0 0", text: o.note })); return box;
      };
      grid.appendChild(fld(K.code, "ma", { req: true, locked: !M.isNew, note: M.isNew ? "Chữ không dấu, số, _ . -" : "Khóa của mã — không đổi" }));
      grid.appendChild(fld(K.name, "ten", { req: true }));
      K.fields.forEach(function (fd) { grid.appendChild(fld(fd.label, fd.key, { note: fd.note, money: fd.type === "money", right: fd.type !== "text", span2: fd.type === "pct" || fd.type === "num" ? !!fd.note || fd.key === "tyLe" : false, show: function (v) { return v === "" ? (fd.type === "pct" && IS_OT ? "(trống)" : "—") : (fd.type === "money" ? money(v) : v); } })); });
      grid.appendChild(fld("Mã công thức", "loaiCT", { opts: loaiOpts, span2: true, note: IS_OT ? "Chọn công thức có sẵn (TC1–TC6) hoặc công thức đã tạo. Chưa có công thức phù hợp thì tạo ở Cài đặt → Công thức → Trình thiết lập. Để “Theo mã này” = công thức riêng của mã" : "Dòng đầu = " + K.fallbackLabel + ". Hoặc chọn công thức có sẵn / công thức đã cấu hình", show: function (v) { return v || (IS_OT ? "(theo mã)" : "(trống — cách tính lịch sử)"); } }));
      grid.appendChild(fld("Hiệu lực từ", "tu", { req: true, date: true, show: fdate }));
      grid.appendChild(fld("Hiệu lực đến", "den", { date: true, show: function (v) { return fdate(v) || "không giới hạn"; } }));
      grid.appendChild(fld("Mô tả / cách tính (ghi chú)", "moTa", { area: true, wide: true }));
      w.appendChild(grid);
      if (sh && sh.dungChungCongThucCuaMaKhac) w.appendChild(h("div", { class: "warn", text: "Mã này dùng chung công thức “" + sh.key + "” (Loại công thức). Công thức được quản lý ở mã " + (sh.ownerMa || sh.key) + "; đổi công thức đó sẽ ảnh hưởng mọi mã dùng chung (" + [sh.ownerMa || sh.key].concat(sh.others).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).join(", ") + ")." }));
      if (M.edit && !M.isNew) {
        var us = OM.usage(db(), M.ma, A.kqKy(S.nam, S.thang).kq);
        var how = h("div", { class: "mode" });
        [["inplace", "Sửa tại chỗ (sửa lỗi nhập liệu)", "Ghi đè lên phiên bản đang xem. Nếu phiên bản này đang hiệu lực trong kỳ đã chốt, hệ thống cảnh báo hồi tố."], ["newver", "Áp dụng từ ngày mới (phiên bản hiệu lực mới)", "Giữ nguyên bản cũ, đóng ngày bản cũ và tạo bản mới có hiệu lực từ ngày chọn — nên dùng khi đổi hệ số."]].forEach(function (o) {
          var rb = h("input", { type: "radio", name: "otmode", value: o[0] }); rb.checked = f.mode === o[0]; rb.addEventListener("change", function () { f.mode = o[0]; draw(); });
          how.appendChild(h("label", {}, [rb, h("div", {}, [h("b", { text: o[1] }), h("small", { text: o[2] })])]));
        });
        w.appendChild(how);
        if (f.mode === "newver") { var tm = h("div", { class: "fld", style: "max-width:260px" }); tm.appendChild(h("label", { text: "Áp dụng từ ngày *" })); var di = A.dateField(f.tuMoi, { "aria-label": "Áp dụng từ ngày", "data-ot-f": "tuMoi" }); di.addEventListener("change", function () { var v = A.dateIso(di); f.tuMoi = v === null ? di.value : v || ""; dirty(); }); tm.appendChild(di); w.appendChild(tm); }
        var imp = h("div", { class: "hint", "data-ot-impact": "1" });
        imp.textContent = "Tác động: " + (us.dangDung != null ? us.dangDung + " nhân viên đang dùng mã này trong kỳ " + S.thang + "/" + S.nam + ". " : "") + (us.closed.length ? "Kỳ đã chốt từng dùng mã: " + us.closed.slice(0, 6).map(function (x) { return x.ky + " (" + x.soNV + " NV)"; }).join(", ") + (us.closed.length > 6 ? "…" : "") + " — bản chốt KHÔNG thay đổi." : "Chưa kỳ đã chốt nào dùng mã này.");
        w.appendChild(imp);
      }
      if (M.edit) { w.appendChild(infoCheck(OM.validateInfo(db(), f, vctx()))); }
      return w;
    }
    function infoCheck(chk) {
      var b = h("div", { "data-ot-check": "1" });
      chk.errors.forEach(function (x) { b.appendChild(h("div", { class: "warn ot-err", text: "⛔ " + x })); });
      chk.warnings.forEach(function (x) { b.appendChild(h("div", { class: "hint", text: "⚠ " + x })); });
      return b;
    }
    function vctx() { return { editing: M.isNew || (M.info && M.info.mode === "newver") ? null : M.row, pct: A.pct, isoDate: function (v) { var s = String(v == null ? "" : v).trim(); if (!s) return ""; var n = VAL.normDate(s); return n || ""; } }; }
    function dirty() { M.dirty = true; var c = A.$("#modal [data-ot-check]"); if (c && M.tab === "info") { var chk = OM.validateInfo(db(), M.info, vctx()); var nb = infoCheck(chk); c.replaceWith(nb); } }
    function saveInfo() {
      var f = M.info; var chk = OM.validateInfo(db(), f, vctx());
      if (f.mode === "newver" && !M.isNew) { if (!f.tuMoi) chk.errors.push("Chưa nhập ngày áp dụng của phiên bản mới"); else if (M.row && f.tuMoi <= (M.row["Hiệu lực từ"] || "")) chk.errors.push("Ngày áp dụng mới phải sau Hiệu lực từ của bản đang xem (" + fdate(M.row["Hiệu lực từ"]) + ")"); }
      if (chk.errors.length) { A.$("#modal [data-ot-check]").replaceWith(infoCheck(chk)); A.toast("Còn lỗi trong biểu mẫu — xem phần cảnh báo"); return; }
      if (M.isNew) {
        var vals = vals0(f, f.tu, f.den);
        if (!A.commit(A.REPO.plan("insert", T, null, vals, { what: "thêm " + K.noun }), { action: K.title + " — thêm mã " + f.ma })) return;
        A.save(); A.toast("Đã thêm " + K.noun + " " + f.ma); M.ma = f.ma; M.isNew = false; M.edit = false; M.dirty = false; M.row = OM.parentRows(db(), f.ma)[0]; M.info = infoFromRow(M.row, f.ma); draw(); return;
      }
      var ok;
      if (f.mode === "newver") {
        ok = A.txn([T], function () {
          var r1 = A.commit(A.REPO.plan("update", T, M.row, { "Hiệu lực đến": FAP.prevDay(f.tuMoi) }, { what: "đóng ngày phiên bản cũ của " + K.noun }), { confirm: true, action: K.title + " — đóng bản cũ " + M.ma }); if (!r1) return false;
          var r2 = A.commit(A.REPO.plan("insert", T, null, vals0(f, f.tuMoi, f.den), { what: "tạo phiên bản " + K.noun }), { confirm: true, action: K.title + " — phiên bản mới " + M.ma + " từ " + f.tuMoi }); return !!r2;
        });
      } else {
        // chỉ ghi các cột THỰC SỰ đổi (không đổi kiểu số → chuỗi của cột giữ nguyên, tránh hồi tố giả)
        var full = vals0(f, f.tu, f.den), patch = {}; delete full[K.code];
        Object.keys(full).forEach(function (c) { if (String(M.row[c] == null ? "" : M.row[c]).trim() !== String(full[c] == null ? "" : full[c]).trim()) patch[c] = full[c]; });
        if (!Object.keys(patch).length) { A.toast("Không có thay đổi để lưu"); M.edit = false; M.dirty = false; draw(); return; }
        ok = A.txn([T], function () { return !!A.commit(A.REPO.plan("update", T, M.row, patch, { what: "sửa thông tin " + K.noun }), { confirm: true, action: K.title + " — sửa " + M.ma }); });
      }
      if (!ok) return;
      A.dirtyBump(); A.toast("Đã lưu thông tin mã " + M.ma); M.edit = false; M.dirty = false;
      var rs = OM.parentRows(db(), M.ma); M.row = OM.effectiveRow(rs, S.nam, S.thang) || rs[0]; M.info = infoFromRow(M.row, M.ma); draw();
    }
    function vals0(f, tu, den) {
      var v = {}; v[K.code] = f.ma.trim(); v[K.nameCol] = f.ten.trim();
      K.fields.forEach(function (fd) { v[fd.col] = f[fd.key] === "" ? "" : String(f[fd.key]).trim(); });
      v["Loại công thức"] = f.loaiCT.trim(); v["Cách tính"] = f.moTa; v["Hiệu lực từ"] = tu; v["Hiệu lực đến"] = den || "";
      return v;
    }

    // ================= TAB 2: CÔNG THỨC =================
    function formulaTab() {
      var w = h("div"), sh = OM.sharedWith(db(), M.ma);
      if (M.fd) { w.appendChild(designerView()); return w; }
      var ap = OM.applied(db(), M.ma, S.nam, S.thang);
      var box = h("div", { class: "kpis ot-kpis" });
      box.appendChild(h("div", { class: "kpi" }, [h("small", { text: "Công thức đang áp dụng (kỳ " + S.thang + "/" + S.nam + ")" }), h("b", { style: "font-size:16px", text: ap.nguon === "cauhinh" ? "v" + (ap.rec["Phiên bản"] || 1) + " · " + ap.rec["Mã công thức"] : ap.nguon === "macdinh" ? (IS_OT ? "Mặc định hệ thống " : "Có sẵn của engine: ") + ap.key : ap.nguon === "lichsu" ? "Cách tính lịch sử" : "⚠ Chưa có" })]));
      box.appendChild(h("div", { class: "kpi" }, [h("small", { text: "Biểu thức" }), h("div", { style: "font-family:monospace;font-size:13px;word-break:break-all", text: ap.bieuThuc || "—" })]));
      w.appendChild(box);
      if (ap.nguon === "macdinh" && IS_OT) w.appendChild(h("div", { class: "hint", text: "Chưa có công thức cấu hình hiệu lực — engine dùng công thức mặc định " + ap.key + " (formula-defaults.js, không sửa trực tiếp). Muốn dùng công thức riêng: tạo ở Cài đặt → Công thức rồi chọn mã công thức ở tab “Thông tin”." }));
      if (!IS_OT && ap.ten) w.appendChild(h("div", { class: ap.nguon === "none" ? "warn" : "hint", text: (ap.nguon === "macdinh" ? "Cách tính có sẵn: " : "") + ap.ten + (ap.nguon === "macdinh" ? ". Engine KHÔNG tra công thức cấu hình cho khóa này — muốn dùng công thức tùy chỉnh phải đổi “Loại công thức” sang tên công thức riêng." : "") }));
      if (!IS_OT) w.appendChild(h("div", { class: "hint", text: "Biến mà engine thực sự cấp cho " + K.short.toLowerCase() + ": " + K.vars.join(", ") + ". " + (type === "ALLOWANCE" ? "Công thức chỉ được dùng khi công chuẩn > 0 và cách tính của mã không phải CO_DINH." : "Mã hỗ trợ (tiền cơm) truyền số ngày cơm; Mã hỗ trợ 2 truyền 0.") }));
      if (sh.dungChungCongThucCuaMaKhac) {
        w.appendChild(h("div", { class: "warn", text: "Mã " + M.ma + " dùng chung công thức “" + sh.key + "”. Danh sách bên dưới là các phiên bản công thức của khóa đó; thay đổi sẽ ảnh hưởng mọi mã dùng chung (" + [sh.key].concat(sh.others).filter(function (x, i, a) { return x && x !== M.ma && a.indexOf(x) === i; }).join(", ") + "). Muốn mã này có công thức riêng, đặt “Loại công thức” trống ở tab Thông tin." }));
      }
      var list = formulasForTab(sh);
      w.appendChild(h("div", { class: "hint", "data-ot-readonly": "1", text: "Tab này chỉ để XEM. Tạo mới, sửa, gửi duyệt, duyệt và kích hoạt công thức ở Cài đặt → Công thức lương / tăng ca / phụ cấp / hỗ trợ. Ở đây chỉ cần chọn Mã công thức cho " + K.noun + " (tab “Thông tin”)." }));
      var t = h("table", { "data-ot-flist": "1" });
      t.appendChild(h("tr", {}, ["Phiên bản", "Tên công thức", "Biểu thức", "Trạng thái", "Hiệu lực từ", "Hiệu lực đến", "Người lập", "Người duyệt", "Cập nhật", "Thao tác"].map(function (x) { return h("th", { text: x }); })));
      list.forEach(function (r) {
        var acts = h("td", { class: "t ot-act" });
        acts.appendChild(btn("Xem công thức", "", function () { startDesigner(r, true); }));
        acts.appendChild(btn("Kiểm tra", "", function () { M.chk = { id: r._id, items: OM.preActivation(db(), r, pctx(r)) }; draw(); }));
        acts.appendChild(btn("Lịch sử", "", function () { M.tab = "ls"; M.lsFilter = r._id; draw(); }));
        t.appendChild(h("tr", { "data-ot-ver": (r["Mã công thức"] || "") + "#" + (r["Phiên bản"] || 1) }, [
          h("td", { class: "t", html: "<b>v" + (r["Phiên bản"] || 1) + "</b>" }), h("td", { class: "t", text: r["Tên công thức"] || "" }), h("td", { class: "t", style: "font-family:monospace;max-width:340px;word-break:break-all", text: r["Biểu thức"] || "" }),
          h("td", {}, [tag(r["Trạng thái"] || "Nháp", r["Trạng thái"] === "Hiệu lực" ? "on" : r["Trạng thái"] === "Ngừng" ? "off" : "bad")]),
          h("td", { class: "t", text: fdate(r["Hiệu lực từ"]) }), h("td", { class: "t", text: fdate(r["Hiệu lực đến"]) }), h("td", { class: "t", text: r["Người lập"] || "" }), h("td", { class: "t", text: r["Người duyệt"] || "" }),
          h("td", { class: "t", text: A.fmtTime(r["Thời điểm ngừng"] || r["Thời điểm kích hoạt"] || r["Thời điểm duyệt"] || r["Ngày lập"]) }), acts]));
        if (M.chk && M.chk.id === r._id) t.appendChild(h("tr", {}, [h("td", { colspan: 10 }, [chkView(M.chk.items)])]));
      });
      w.appendChild(h("div", { class: "tw", style: "max-height:none" }, [t]));
      if (!list.length) w.appendChild(h("div", { class: "empty", text: "Mã này chưa có công thức riêng. Dùng công thức có sẵn (chọn ở tab “Thông tin”) hoặc tạo công thức mới ở Cài đặt → Công thức → Trình thiết lập." }));
      if (M.act) w.appendChild(actPanel());
      return w;
    }
    function formulasForTab() { return OM.versionsForTab(db(), M.ma); }
    /** Phụ cấp/Hỗ trợ chưa khai báo "Loại công thức": phải đặt khóa công thức cho mã cha TRƯỚC khi lập công thức (engine tra theo khóa này). Ghi qua repository (kiểm quyền/hồi tố/nhật ký). */
    function pctx(r) {
      var tenCty = db().congty && db().congty[0] ? [db().congty[0]["Mã công ty"], db().congty[0]["Tên công ty"]].filter(Boolean) : [];
      return { companyKeys: tenCty, closedPeriods: A.closedPeriods(), hasCurrent: OM.applied(db(), M.ma, S.nam, S.thang).nguon !== "none" };
    }
    function chkView(items) {
      var b = h("div", { class: "ot-chk", "data-ot-chk": "1" });
      items.forEach(function (x) { b.appendChild(h("div", { class: x.ok ? (x.level === "warn" ? "hint" : "ok-line") : "warn", text: (x.ok ? (x.level === "warn" ? "⚠ " : "✓ ") : "⛔ ") + x.msg })); });
      var bad = items.filter(function (x) { return !x.ok; }).length;
      b.appendChild(h("div", { class: "hint", text: bad ? "Còn " + bad + " lỗi chặn kích hoạt." : "Không có lỗi chặn kích hoạt." }));
      return b;
    }
    function actPanel() {
      var a = M.act, r = (db()[TC] || []).filter(function (x) { return x._id === a.id; })[0]; var p = h("div", { class: "card ot-act-panel", "data-ot-act": a.to });
      if (!r) { M.act = null; return p; }
      p.appendChild(h("div", { class: "fh", text: (a.to === "Hiệu lực" ? "Kích hoạt" : "Ngừng hiệu lực") + " phiên bản v" + (r["Phiên bản"] || 1) + " (" + (r["Mã công thức"] || "") + ")" }));
      if (a.items) p.appendChild(chkView(a.items));
      var inp = h("input", { class: "i reason-in", placeholder: "Lý do thay đổi (bắt buộc khi Kích hoạt / Ngừng)", value: a.reason, "data-ot-reason": "1", "aria-label": "Lý do thay đổi" }); inp.addEventListener("input", function () { a.reason = inp.value; M.reason = inp.value; });
      p.appendChild(h("div", { class: "bar" }, [h("label", { class: "reason-lbl", text: "Lý do thay đổi" }), inp]));
      var blocked = a.items && a.items.some(function (x) { return !x.ok; });
      p.appendChild(h("div", { class: "bar" }, [btn("Xác nhận", "pri", function () {
        if (!String(a.reason).trim()) { A.toast("Nhập lý do thay đổi"); inp.focus(); return; }
        if (blocked) { A.toast("Còn lỗi chặn — xử lý trước khi kích hoạt"); return; }
        var rs = runTransition(r, a.to, a.reason); if (rs) { M.act = null; M.reason = ""; draw(); }
      }), btn("Hủy", "", function () { M.act = null; draw(); })]));
      p.lastChild.firstChild.setAttribute("data-ot-act-ok", "1");
      return p;
    }
    function runTransition(r, to, reason) {
      var L = { "Chờ duyệt": "gửi duyệt", "Nháp": "trả về nháp", "Đã duyệt": "duyệt", "Hiệu lực": "kích hoạt", "Ngừng": "ngừng" };
      var vals = { "Trạng thái": to }; if (reason) vals["Lý do thay đổi"] = reason;
      var ok = A.txn([TC], function () {
        if (to === "Hiệu lực") { // đóng ngày bản đang hiệu lực chồng lên (nếu có) rồi mới kích hoạt
          var pl = FAP.activationPlan(db(), r);
          if (pl.blocked.length) { A.toast("⛔ Chồng hiệu lực với bản không đóng được"); return false; }
          for (var i = 0; i < pl.close.length; i++) {
            var c = pl.close[i], rr = A.commit(A.REPO.plan("update", TC, c.row, { "Hiệu lực đến": c.den, "Lý do thay đổi": "Thay thế bởi v" + (r["Phiên bản"] || 1) + " từ " + r["Hiệu lực từ"] }, { what: "đóng ngày công thức cũ" }), { confirm: true, action: "Công thức tiền lương — đóng ngày " + (c.row["Mã công thức"] || "") + " v" + (c.row["Phiên bản"] || 1) });
            if (!rr) return false;
          }
        }
        return !!A.commit(A.REPO.plan("update", TC, r, vals, { what: L[to] + " công thức" }), { confirm: true, action: "Công thức tiền lương — " + L[to] + " " + (r["Mã công thức"] || "") });
      });
      if (ok) { A.dirtyBump(); A.toast("Đã " + L[to] + " công thức " + (r["Mã công thức"] || "")); }
      return ok;
    }

    // ---------- Trình thiết kế ----------
    function startDesigner(rec, viewOnly, copy) {
      var sh = OM.sharedWith(db(), M.ma), key = sh.key || (IS_OT ? M.ma : "");
      var base = rec || null, ap = OM.applied(db(), M.ma, S.nam, S.thang);
      var D = { rec: copy ? null : base, view: !!viewOnly, key: key, parent: sh.dungChungCongThucCuaMaKhac ? (sh.ownerMa || M.ma) : M.ma, mode: "visual", err: "", src: base ? base : null };
      var st0 = base ? (base["Trạng thái"] || "Nháp") : "Nháp";
      if (rec && !copy && !viewOnly && st0 !== "Nháp") { A.toast("Chỉ bản Nháp được sửa — hãy Sao chép thành phiên bản mới"); return; }
      D.f = {
        ten: base ? (copy ? (base["Tên công thức"] || "") : (base["Tên công thức"] || "")) : K.short + " " + M.ma + " — công thức mới",
        tu: copy || !base ? "" : (base["Hiệu lực từ"] || ""), den: copy || !base ? "" : (base["Hiệu lực đến"] || ""), cty: base ? (base["Công ty"] || "") : "",
        expr: base ? (base["Biểu thức"] || "") : (ap.bieuThuc || ""), moTa: base ? (base["Mô tả"] || "") : "", ly: ""
      };
      D.origin = ap.bieuThuc || ""; D.originLabel = ap.nguon === "cauhinh" ? "Công thức cấu hình đang hiệu lực v" + (ap.rec["Phiên bản"] || 1) : ap.nguon === "macdinh" ? (IS_OT ? "Công thức mặc định hệ thống " + ap.key + " (formula-defaults.js)" : "Cách tính có sẵn của engine: " + (ap.ten || ap.key) + " (không phải biểu thức — chỉ để tham khảo)") : "";
      D.tokens = OM.chips(D.f.expr) || [];
      if (copy) D.f.ly = "Sao chép từ v" + (base["Phiên bản"] || 1);
      M.fd = D; M.dirty = M.dirty || !!copy; draw();
    }
    function designerView() {
      var D = M.fd, f = D.f, ro = D.view, w = h("div", { class: "ot-designer", "data-ot-designer": ro ? "view" : "edit" });
      var top = h("div", { class: "bar" }, [btn("← Về danh sách phiên bản", "", function () { if (M.fdDirty && !confirm("Bỏ công thức đang soạn (chưa lưu)?")) return; M.fd = null; M.fdDirty = false; draw(); })]);
      top.appendChild(h("b", { text: ro ? " Xem công thức" + (D.rec ? " v" + (D.rec["Phiên bản"] || 1) + " · " + (D.rec["Trạng thái"] || "Nháp") : "") : D.rec ? " Sửa bản Nháp v" + (D.rec["Phiên bản"] || 1) : " Phiên bản công thức mới (Nháp)" }));
      w.appendChild(top);
      // A — thông tin
      w.appendChild(h("div", { class: "fh", text: "A. Thông tin công thức" }));
      var g = h("div", { class: "fgrid" });
      var fld = function (lbl, key, o) {
        o = o || {}; var b = h("div", { class: "fld" + (o.wide ? " wide" : "") }); b.appendChild(h("label", { text: lbl })); var i;
        if (ro || o.fixed) { b.appendChild(h("div", { class: "ot-ro", text: o.fixed != null ? o.fixed : (o.date ? fdate(f[key]) : (f[key] || "—")) })); return b; }
        if (o.date) { i = A.dateField(f[key], { "aria-label": lbl }); i.addEventListener("change", function () { var v = A.dateIso(i); f[key] = v === null ? i.value : v || ""; fdirty(); }); }
        else if (o.area) { i = h("textarea", { rows: 2, "aria-label": lbl }); i.value = f[key]; i.addEventListener("input", function () { f[key] = i.value; fdirty(); }); }
        else { i = h("input", { "aria-label": lbl, value: f[key] }); i.addEventListener("input", function () { f[key] = i.value; fdirty(); }); }
        i.setAttribute("data-ot-fd", key); b.appendChild(i); return b;
      };
      g.appendChild(fld("Mã công thức", "", { fixed: D.key + (IS_OT ? " (theo mã tăng ca)" : " (theo Loại công thức của " + K.noun + ")") }));
      g.appendChild(fld("Tên công thức", "ten"));
      g.appendChild(fld("Phiên bản", "", { fixed: D.rec ? "v" + (D.rec["Phiên bản"] || 1) : "tự đánh số: v" + FAP.nextVersion(db(), D.key, type) }));
      g.appendChild(fld("Hiệu lực từ *", "tu", { date: true }));
      g.appendChild(fld("Hiệu lực đến", "den", { date: true }));
      g.appendChild(fld("Trạng thái", "", { fixed: D.rec ? (D.rec["Trạng thái"] || "Nháp") : "Nháp (lưu xong mới gửi duyệt)" }));
      g.appendChild(fld("Công ty (để trống = mọi công ty)", "cty"));
      g.appendChild(fld("Diễn giải nghiệp vụ", "moTa", { area: true, wide: true }));
      if (!ro) g.appendChild(fld("Lý do thay đổi", "ly", { wide: true }));
      w.appendChild(g);
      // B — thư viện biến
      w.appendChild(h("div", { class: "fh", text: "B. Thư viện biến (lấy từ formula-variables.js)" }));
      var vt = h("table", { class: "ot-vars", "data-ot-vars": "1" });
      vt.appendChild(h("tr", {}, ["Biến", "Mã", "Đơn vị", "Nguồn dữ liệu", "Khi thiếu dữ liệu", "Chèn"].map(function (x) { return h("th", { text: x }); })));
      OM.varLibrary().forEach(function (v) {
        var ins = ro ? h("td") : h("td", {}, [btn("＋", "", function () { addToken(v.name); }, "Chèn " + v.name)]);
        vt.appendChild(h("tr", { title: v.desc }, [h("td", { class: "t", text: v.label }), h("td", { class: "t", style: "font-family:monospace", text: v.name }), h("td", { class: "t", text: v.unit }), h("td", { class: "t", text: v.source }), h("td", { class: "t", text: v.missing === "zero" ? "Coi là 0 (có cảnh báo riêng khi danh mục thiếu)" : "Báo lỗi cấu hình" }), ins]));
      });
      w.appendChild(h("div", { class: "tw", style: "max-height:220px" }, [vt]));
      // C — biểu thức
      w.appendChild(h("div", { class: "fh", text: "C. Thiết kế biểu thức" }));
      if (D.originLabel) w.appendChild(h("div", { class: "ot-origin" }, [h("div", { class: "hint", style: "margin:0", text: "Công thức gốc để đối chiếu — " + D.originLabel + ":" }), h("code", { text: D.origin })]));
      if (!ro) {
        var bar = h("div", { class: "bar" });
        var mo = [["visual", "Thiết kế trực quan"], ["adv", "Chỉnh sửa nâng cao"]];
        mo.forEach(function (m) { bar.appendChild(btn(m[1], D.mode === m[0] ? "pri" : "", function () { switchMode(m[0]); })).setAttribute("data-ot-mode", m[0]); });
        var sel = h("select", { "aria-label": "Chọn mẫu công thức", "data-ot-tpl": "1" }); sel.appendChild(h("option", { value: "", text: "— Chọn mẫu công thức —" }));
        (IS_OT ? TPL.ofType(type) : TPL.usable(type)).forEach(function (t, i) { sel.appendChild(h("option", { value: String(TPL.TEMPLATES.indexOf(t)), text: (t.thamKhao ? "[Tham khảo] " : "") + t.ten })); });
        sel.addEventListener("change", function () { if (sel.value === "") return; var t = TPL.TEMPLATES[+sel.value]; if (f.expr && !confirm("Thay biểu thức đang soạn bằng mẫu này?")) { sel.value = ""; return; } setExpr(t.bieuThuc); sel.value = ""; fdirty(); redrawExpr(); });
        bar.appendChild(sel);
        if (D.origin) bar.appendChild(btn("Lấy công thức đang áp dụng", "", function () { setExpr(D.origin); fdirty(); redrawExpr(); }));
        w.appendChild(bar);
      }
      var exprBox = h("div", { class: "ot-exprbox", "data-ot-exprbox": "1" }); w.appendChild(exprBox); D.exprBox = exprBox; redrawExpr();
      // nút
      var fb = h("div", { class: "bar", style: "margin-top:10px" });
      if (!ro) {
        fb.appendChild(btn("Lưu nháp", "pri", saveFormula)).setAttribute("data-ot-save-formula", "1");
        fb.appendChild(btn("Thử với dữ liệu thật →", "", function () { M.test.expr = f.expr; M.test.ver = "__draft"; M.tab = "test"; draw(); }));
      }
      w.appendChild(fb);
      return w;
    }
    function fdirty() { M.dirty = true; M.fdDirty = true; }
    function setExpr(e) { M.fd.f.expr = e; M.fd.tokens = OM.chips(e) || M.fd.tokens; }
    function addToken(tk) {
      var D = M.fd; if (!D || D.view) return;
      D.tokens = D.tokens || []; D.tokens.push(tk); D.f.expr = OM.joinTokens(D.tokens); fdirty(); redrawExpr();
    }
    function switchMode(m) {
      var D = M.fd; if (D.mode === m) return;
      if (m === "visual") { var c = OM.chips(D.f.expr); if (c === null) { A.toast("Biểu thức đang có ký tự không hợp lệ — sửa ở chế độ nâng cao trước"); return; } D.tokens = c; }
      else D.f.expr = OM.joinTokens(D.tokens);
      D.mode = m; draw();
    }
    function redrawExpr() {
      var D = M.fd, box = D.exprBox; if (!box) return; box.innerHTML = ""; var f = D.f, ro = D.view;
      if (ro || D.mode === "adv") {
        var ta = h("textarea", { rows: 3, style: "width:100%;font-family:monospace", "aria-label": "Biểu thức", "data-ot-expr": "1" }); ta.value = f.expr; if (ro) ta.readOnly = true;
        ta.addEventListener("input", function () { f.expr = ta.value; D.tokens = OM.chips(ta.value) || D.tokens; fdirty(); analysis(); }); box.appendChild(ta);
      } else {
        var chips = h("div", { class: "ot-chips", "data-ot-chips": "1" });
        (D.tokens || []).forEach(function (tk, i) {
          var isVar = FML.variables.isKnown(tk), v = isVar ? FML.variables.get(tk) : null;
          var c = h("span", { class: "ot-chip" + (isVar ? " var" : /^[0-9.]+$/.test(tk) ? " num" : " op"), title: v ? v.label : "" }, [h("span", { text: tk })]);
          c.appendChild(h("button", { class: "ot-x", "aria-label": "Xóa " + tk, text: "✕", on: { click: function () { D.tokens.splice(i, 1); f.expr = OM.joinTokens(D.tokens); fdirty(); redrawExpr(); } } }));
          chips.appendChild(c);
        });
        if (!(D.tokens || []).length) chips.appendChild(h("span", { class: "hint", text: "Chưa có thành phần — chèn biến ở bảng B hoặc dùng nút bên dưới." }));
        box.appendChild(chips);
        var pal = h("div", { class: "bar ot-pal" });
        [["+", "+"], ["−", "-"], ["×", "*"], ["÷", "/"], ["(", "("], [")", ")"], [",", ","], [">", ">"], ["≥", ">="], ["<", "<"], ["≤", "<="], ["=", "="], ["≠", "!="], ["VÀ", "AND"], ["HOẶC", "OR"]].forEach(function (o) { pal.appendChild(btn(o[0], "ghost", function () { addToken(o[1]); }, "Chèn " + o[1])); });
        ["MAX", "MIN", "IF", "ROUND", "ABS", "FLOOR", "CEIL", "SUM"].forEach(function (fn) { pal.appendChild(btn(fn + "(…)", "", function () { addToken(fn); addToken("("); }, "Chèn hàm " + fn)); });
        var num = h("input", { class: "i", placeholder: "Số", style: "width:70px", "aria-label": "Chèn số" }); pal.appendChild(num); pal.appendChild(btn("＋ Số", "", function () { var v = num.value.trim().replace(",", "."); if (/^[0-9]+(\.[0-9]+)?$/.test(v)) { addToken(v); } else A.toast("Nhập số hợp lệ"); }));
        pal.appendChild(btn("Chèn IF(điều kiện; đúng; sai)", "", function () { ["IF", "(", "…", ",", "…", ",", "…", ")"].forEach(function (x) { if (x !== "…") D.tokens.push(x); else D.tokens.push("0"); }); D.f.expr = OM.joinTokens(D.tokens); fdirty(); redrawExpr(); }));
        pal.appendChild(btn("Xóa hết", "", function () { D.tokens = []; f.expr = ""; fdirty(); redrawExpr(); }));
        box.appendChild(pal);
      }
      var an = h("div", { class: "ot-analysis", "data-ot-analysis": "1" }); box.appendChild(an); D.an = an; analysis();
    }
    function analysis() {
      var D = M.fd, an = D.an; if (!an) return; an.innerHTML = ""; var e = String(D.f.expr || "").trim();
      an.appendChild(h("div", { class: "hint", style: "margin-top:8px", text: "Biểu thức kỹ thuật:" })); an.appendChild(h("code", { "data-ot-tech": "1", text: e || "(trống)" }));
      if (!e) return;
      var v = FML.validate(e);
      an.appendChild(h("div", { class: v.ok ? "ok" : "warn", "data-ot-syntax": v.ok ? "ok" : "bad", style: "margin:8px 0", text: v.ok ? "✓ Cú pháp và biến hợp lệ (cùng trình kiểm tra với engine)" : "⛔ " + v.errors.map(function (x) { return x.message; }).join("; ") }));
      var ex = OM.explain(e);
      if (ex.ok) {
        an.appendChild(h("div", { class: "hint", text: "Giải thích bằng tiếng Việt:" }));
        an.appendChild(h("div", { class: "ot-explain", "data-ot-explain": "1", text: ex.text }));
        if (ex.vars.length) an.appendChild(h("ul", { class: "ot-explain-vars" }, ex.vars.map(function (x) { return h("li", { text: x.label + " — " + x.desc + " (" + x.unit + ")" }); })));
      }
    }
    function saveFormula() {
      var D = M.fd, f = D.f, errs = [];
      if (!String(f.tu || "").trim()) errs.push("Chưa nhập Hiệu lực từ");
      if (f.tu && !VAL.normDate(f.tu)) errs.push("Hiệu lực từ không đúng định dạng ngày");
      if (f.den && VAL.normDate(f.den) && f.tu && VAL.normDate(f.den) < VAL.normDate(f.tu)) errs.push("Hiệu lực đến phải sau Hiệu lực từ");
      if (!String(f.ten || "").trim()) errs.push("Chưa nhập Tên công thức");
      if (!String(f.expr || "").trim()) errs.push("Chưa có biểu thức");
      else { var v = FML.validate(f.expr); if (!v.ok) errs.push("Biểu thức không hợp lệ: " + v.errors.map(function (x) { return x.message; }).join("; ")); }
      if (errs.length) { A.alert("Chưa lưu được:\n• " + errs.join("\n• ")); return; }
      var vals = { "Mã công thức": D.key, "Tên công thức": f.ten.trim(), "Loại": type, "Công ty": f.cty.trim(), "Biểu thức": f.expr.trim(), "Hiệu lực từ": VAL.normDate(f.tu), "Hiệu lực đến": f.den ? VAL.normDate(f.den) : "", "Mô tả": f.moTa || "", "Trạng thái": "Nháp" };
      vals[K.link] = D.parent; if (f.ly) vals["Lý do thay đổi"] = f.ly;
      var ok;
      if (D.rec) { var up = Object.assign({}, vals); delete up["Trạng thái"]; ok = A.txn([TC], function () { return !!A.commit(A.REPO.plan("update", TC, D.rec, up, { what: "sửa công thức nháp" }), { action: "Công thức tiền lương — Sửa nháp " + D.key }); }); }
      else ok = A.txn([TC], function () { return !!A.commit(A.REPO.plan("insert", TC, null, vals, { what: "tạo công thức " + K.short.toLowerCase() }), { action: "Công thức tiền lương — Tạo Nháp " + D.key }); });
      if (!ok) return;
      A.dirtyBump(); A.toast("Đã lưu công thức (Nháp). Tiếp theo: Gửi duyệt → Duyệt → Kích hoạt."); M.fd = null; M.fdDirty = false; M.dirty = false; draw();
    }

    // ================= TAB 3: KIỂM THỬ =================
    function testTab() {
      var w = h("div", { "data-ot-testtab": "1" }), Tt = M.test, sh = OM.sharedWith(db(), M.ma);
      w.appendChild(h("div", { class: "hint", text: "Chọn kỳ, nhân viên và phiên bản cần thử. Các biến (" + (IS_OT ? "công chuẩn, công tăng ca, công Chủ nhật…" : type === "ALLOWANCE" ? "công chuẩn, công hưởng phụ cấp, công lễ/phép/tăng ca, ngưỡng, mức phụ cấp…" : "công chuẩn, công thực tế, số ngày cơm, mức hỗ trợ…") + ") tự lấy từ kết quả tính lương thật của kỳ — không nhập tay. Chạy thử KHÔNG ghi dữ liệu và không đổi bảng lương/kỳ đã chốt." }));
      var bar = h("div", { class: "bar" });
      var kyIn = h("input", { type: "month", value: ky(), "aria-label": "Kỳ lương", "data-ot-test-ky": "1" });
      kyIn.addEventListener("change", function () { if (kyIn.value) { var m = kyIn.value.split("-"); S.nam = +m[0]; S.thang = +m[1]; Tt.nv = ""; draw(); } });
      var res = A.kqKy(S.nam, S.thang), kq = res.kq, emps = OM.employeesOf(kq, M.ma, sh.key);
      if (Tt.nv && !emps.some(function (x) { return x["Mã NV"] === Tt.nv; })) Tt.nv = "";
      var selNV = h("select", { "aria-label": "Nhân viên", "data-ot-test-nv": "1" }); selNV.appendChild(h("option", { value: "", text: emps.length ? "— Chọn nhân viên —" : "(không có nhân viên dùng mã này trong kỳ)" }));
      emps.forEach(function (b) { selNV.appendChild(h("option", { value: b["Mã NV"], text: b["Mã NV"] + " — " + (b["Họ và tên"] || "") })); }); selNV.value = Tt.nv;
      selNV.addEventListener("change", function () { Tt.nv = selNV.value; draw(); });
      var vers = formulasForTab(), selV = h("select", { "aria-label": "Phiên bản thử", "data-ot-test-ver": "1" });
      selV.appendChild(h("option", { value: "", text: "— Chọn phiên bản cần thử —" }));
      if (M.fd && M.fd.f.expr) selV.appendChild(h("option", { value: "__draft", text: "Bản đang soạn (chưa lưu)" }));
      vers.forEach(function (r) { selV.appendChild(h("option", { value: r._id, text: "v" + (r["Phiên bản"] || 1) + " · " + (r["Trạng thái"] || "Nháp") + " · " + fdate(r["Hiệu lực từ"]) })); });
      selV.appendChild(h("option", { value: "__manual", text: "Nhập biểu thức tạm…" }));
      selV.value = Tt.ver; selV.addEventListener("change", function () { Tt.ver = selV.value; if (Tt.ver === "__draft" && M.fd) Tt.expr = M.fd.f.expr; draw(); });
      bar.appendChild(h("label", { text: "Kỳ " })); bar.appendChild(kyIn); bar.appendChild(h("label", { text: " Nhân viên " })); bar.appendChild(selNV); bar.appendChild(h("label", { text: " Phiên bản thử " })); bar.appendChild(selV);
      w.appendChild(bar);
      if (res.chot) w.appendChild(h("div", { class: "hint", text: "Kỳ này ĐÃ CHỐT — đang đọc số liệu trong bản chốt (chỉ xem, không tính lại)." }));
      var expr = "";
      if (Tt.ver === "__draft") expr = M.fd ? M.fd.f.expr : Tt.expr; else if (Tt.ver === "__manual") {
        var ta = h("textarea", { rows: 2, style: "width:100%;font-family:monospace", "aria-label": "Biểu thức tạm", "data-ot-test-expr": "1" }); ta.value = Tt.expr; ta.addEventListener("change", function () { Tt.expr = ta.value; draw(); }); w.appendChild(ta); expr = Tt.expr;
      } else { var vr = vers.filter(function (r) { return r._id === Tt.ver; })[0]; expr = vr ? (vr["Biểu thức"] || "") : ""; }
      if (!Tt.nv || !expr) { w.appendChild(h("div", { class: "empty", text: !Tt.nv ? "Chọn nhân viên để xem số liệu thật." : "Chọn phiên bản cần thử." })); w.appendChild(savedTests(expr)); return w; }
      var b = emps.filter(function (x) { return x["Mã NV"] === Tt.nv; })[0];
      var ap = OM.applied(db(), M.ma, S.nam, S.thang);
      var out = OM.trial(b, expr, ap.bieuThuc, { coChamCong: OM.coChamCong(db(), Tt.nv, ky()), ma: M.ma, slot: Tt.slot });
      if (type === "SUPPORT" && out.slots && out.slots.length > 1) { var ss = h("select", { "aria-label": "Vị trí gán hỗ trợ", "data-ot-test-slot": "1" }, out.slots.map(function (x) { return h("option", { value: x, text: x === "ht1" ? "Mã hỗ trợ (tiền cơm)" : "Mã hỗ trợ 2 (hỗ trợ lương)" }); })); ss.value = out.slot; ss.addEventListener("change", function () { Tt.slot = ss.value; draw(); }); w.appendChild(h("div", { class: "bar" }, [h("label", { text: "Vị trí gán " }), ss])); }
      if (!out.rows.length) { w.appendChild(h("div", { class: "warn", "data-ot-nodata": "1", text: out.reason })); w.appendChild(savedTests(expr)); return w; }
      var t = h("table", { "data-ot-trial": "1" });
      t.appendChild(h("tr", {}, ["Chỉ tiêu", "Công thức hiện tại", "Phiên bản thử"].map(function (x) { return h("th", { text: x }); })));
      out.rows.forEach(function (r) {
        var nd = function (x) { return x === "Chưa có dữ liệu" ? h("td", { class: "t", style: "color:#a15c00;font-style:italic", text: x }) : h("td", { class: "t num" + (r.laKq ? " b" : ""), style: r.laChenh && typeof r.moi === "number" && r.moi ? "color:#c0362c;font-weight:700" : "", text: typeof x === "number" ? fmt(x) : String(x) }); };
        if (r.laGhiChu) { t.appendChild(h("tr", { "data-ot-trownote": "1" }, [h("td", { colspan: 3, class: "t ot-note", style: "font-style:italic", text: r.chiTieu })])); return; }
        t.appendChild(h("tr", { "data-ot-trow": r.chiTieu }, [h("td", { class: "t", text: r.chiTieu }), nd(r.cu), nd(r.moi)]));
      });
      w.appendChild(h("div", { class: "tw", style: "max-height:none" }, [t]));
      if (out.selfCheck) w.appendChild(h("div", { class: out.selfCheck.ok ? "hint" : "warn", "data-ot-self": out.selfCheck.ok ? "ok" : "bad", text: out.selfCheck.ok ? "✓ Công thức hiện hành tái lập đúng tiền " + K.short.toLowerCase() + " của engine (" + fmt(out.selfCheck.that) + ") — bộ biến lấy đúng." : "⚠ Công thức hiện hành không tái lập được số của engine (" + (out.selfCheck.loi || fmt(out.selfCheck.tai) + " ≠ " + fmt(out.selfCheck.that)) + ") — kiểm tra nguồn công thức." }));
      if (IS_OT && out.nhanh === "TC5") w.appendChild(h("div", { class: "hint", text: "Nhánh TC5: tiền = Tiền tăng ca cố định ÷ công chuẩn × công quy đổi (cơ sở tiền cố định của danh mục)." }));
      if (IS_OT && (out.nhanh === "CN" || out.nhanh === "CN_2026")) w.appendChild(h("div", { class: "hint", text: "Nhánh " + (out.nhanh === "CN_2026" ? "CN1/CN2 theo quy chế 2026 (công chuẩn = số ngày − ngày giảm trừ)" : "CN1/CN2") + ": tiền = Lương thỏa thuận (bình quân) × công quy đổi." }));
      if (OM.coChamCong(db(), Tt.nv, ky()) === false) w.appendChild(h("div", { class: "warn", text: "Nhân viên chưa có dữ liệu chấm công trong kỳ — các chỉ tiêu công hiển thị “Chưa có dữ liệu”." }));
      w.appendChild(savedTests(expr, out, b));
      return w;
    }
    function savedTests(expr, out, b) {
      var box = h("div", { class: "card", style: "margin-top:12px", "data-ot-saved": "1" });
      box.appendChild(h("div", { class: "fh", text: "Ca kiểm thử đã lưu (hồi quy)" }));
      var cases = (db()[TT] || []).filter(function (c) { return (c["Loại"] || "OVERTIME") === type && (c["Mã cha"] || c["Mã tăng ca"]) === M.ma; });
      if (!cases.length) box.appendChild(h("div", { class: "hint", text: "Chưa có ca nào. Chạy thử một nhân viên rồi bấm “Lưu thành ca kiểm thử” để khóa kết quả kỳ vọng." }));
      else if (expr) {
        var rs = OM.runSaved(cases.map(function (c) { return { ten: c["Tên ca"], bien: c.bien, kyVong: c["Kết quả kỳ vọng"] != null && c["Kết quả kỳ vọng"] !== "" ? c["Kết quả kỳ vọng"] : c["Công quy đổi kỳ vọng"] }; }), expr);
        var t = h("table"); t.appendChild(h("tr", {}, ["Ca", IS_OT ? "Kỳ vọng (công quy đổi)" : "Kỳ vọng (số tiền)", "Kết quả", "Đạt", ""].map(function (x) { return h("th", { text: x }); })));
        rs.forEach(function (r, i) { t.appendChild(h("tr", { "data-ot-case": r.ten }, [h("td", { class: "t", text: r.ten }), h("td", { class: "t num", text: String(r.kyVong) }), h("td", { class: "t num", text: r.loi ? "⚠ " + r.loi : String(r.ketQua) }), h("td", { class: "t", text: r.ok ? "✓" : "✗" }), h("td", {}, A.can("dm.edit") ? [btn("Xóa", "", function () { delCase(cases[i]); })] : [])])); });
        box.appendChild(h("div", { class: "tw", style: "max-height:none" }, [t]));
        var pass = rs.filter(function (r) { return r.ok; }).length; box.appendChild(h("div", { class: pass === rs.length ? "hint" : "warn", text: pass + "/" + rs.length + " ca đạt với phiên bản đang thử." }));
      } else box.appendChild(h("div", { class: "hint", text: cases.length + " ca đã lưu — chọn phiên bản để chạy." }));
      if (out && out.ok && b && A.can("dm.edit") && out.kyVong != null) {
        var nm = h("input", { class: "i", placeholder: "Tên ca (ví dụ: NV A kỳ 10/2026)", style: "width:260px", "data-ot-case-name": "1", "aria-label": "Tên ca kiểm thử" });
        box.appendChild(h("div", { class: "bar" }, [nm, btn("Lưu thành ca kiểm thử (kỳ vọng = kết quả đang thử)", "", function () {
          var n = nm.value.trim() || ("Ca " + b["Mã NV"] + " kỳ " + ky());
          var vals = { "Loại": type, "Mã cha": M.ma, "Tên ca": n, bien: Object.assign({}, out.bien), "Kết quả kỳ vọng": IS_OT ? Math.round(out.kyVong * 1e6) / 1e6 : out.kyVong, "Nguồn": b["Mã NV"] + " · kỳ " + ky(), "Người tạo": A.user(), "Ngày tạo": new Date().toISOString() };
          if (IS_OT) { vals["Mã tăng ca"] = M.ma; vals["Công quy đổi kỳ vọng"] = vals["Kết quả kỳ vọng"]; } // tương thích dữ liệu V10.2
          if (!A.txn([TT], function () { return !!A.commit(A.REPO.plan("insert", TT, null, vals, { what: "lưu ca kiểm thử công thức" }), { action: "Công thức tiền lương — lưu ca kiểm thử " + M.ma }); })) return;
          A.dirtyBump(); A.toast("Đã lưu ca kiểm thử"); draw();
        })]));
      }
      return box;
    }
    function delCase(c) { if (!confirm("Xóa ca kiểm thử “" + c["Tên ca"] + "”?")) return; if (A.txn([TT], function () { return !!A.commit(A.REPO.plan("remove", TT, c, null, { what: "xóa ca kiểm thử" }), { action: "Công thức tiền lương — xóa ca kiểm thử" }); })) { A.dirtyBump(); draw(); } }

    // ================= TAB 4: LỊCH SỬ =================
    function historyTab() {
      var w = h("div", { "data-ot-history": "1" }), sh = OM.sharedWith(db(), M.ma), vers = formulasForTab();
      w.appendChild(h("div", { class: "fh", text: "Phiên bản công thức (mới nhất trước)" }));
      if (M.lsFilter) w.appendChild(h("div", { class: "bar" }, [h("span", { class: "hint", text: "Đang lọc một phiên bản." }), btn("Bỏ lọc", "", function () { M.lsFilter = ""; draw(); })]));
      var t = h("table"); t.appendChild(h("tr", {}, ["Phiên bản", "Trạng thái", "Hiệu lực từ", "Hiệu lực đến", "Biểu thức", "Người lập · ngày", "Người duyệt · lúc", "Kích hoạt · lúc", "Ngừng · lúc", "Lý do"].map(function (x) { return h("th", { text: x }); })));
      var shown = vers.filter(function (r) { return !M.lsFilter || r._id === M.lsFilter; });
      shown.forEach(function (r) {
        var pair = function (a, b2) { return (r[a] || "") + (r[b2] ? " · " + A.fmtTime(r[b2]) : ""); };
        t.appendChild(h("tr", { "data-ot-hrow": "v" + (r["Phiên bản"] || 1) }, [h("td", { class: "t", text: "v" + (r["Phiên bản"] || 1) }), h("td", {}, [tag(r["Trạng thái"] || "Nháp", r["Trạng thái"] === "Hiệu lực" ? "on" : "off")]), h("td", { class: "t", text: fdate(r["Hiệu lực từ"]) }), h("td", { class: "t", text: fdate(r["Hiệu lực đến"]) }), h("td", { class: "t", style: "font-family:monospace;word-break:break-all", text: r["Biểu thức"] || "" }),
          h("td", { class: "t", text: pair("Người lập", "Ngày lập") }), h("td", { class: "t", text: pair("Người duyệt", "Thời điểm duyệt") }), h("td", { class: "t", text: pair("Người kích hoạt", "Thời điểm kích hoạt") }), h("td", { class: "t", text: pair("Người ngừng", "Thời điểm ngừng") }), h("td", { class: "t", text: r["Lý do thay đổi"] || "" })]));
      });
      w.appendChild(h("div", { class: "tw", style: "max-height:none" }, [t]));
      if (!shown.length) w.appendChild(h("div", { class: "empty", text: "Chưa có phiên bản công thức cấu hình." }));
      w.appendChild(h("div", { class: "fh", text: "Phiên bản thông tin " + K.noun + " (" + K.fields.map(function (fd) { return fd.label.split(" (")[0].toLowerCase(); }).join(", ") + ", loại công thức)" }));
      var t2 = h("table"); t2.appendChild(h("tr", {}, ["Hiệu lực từ", "Hiệu lực đến"].concat(K.fields.map(function (fd) { return fd.label.split(" (")[0]; }), ["Loại công thức", "Nội dung"]).map(function (x) { return h("th", { text: x }); })));
      OM.parentRows(db(), M.ma).forEach(function (r) { t2.appendChild(h("tr", {}, [h("td", { class: "t", text: fdate(r["Hiệu lực từ"]) }), h("td", { class: "t", text: fdate(r["Hiệu lực đến"]) })].concat(K.fields.map(function (fd) { return h("td", { class: "t num", text: fd.type === "money" ? money(r[fd.col]) : String(r[fd.col] == null ? "" : r[fd.col]) }); }), [h("td", { class: "t", text: r["Loại công thức"] || (IS_OT ? "(theo mã)" : "(trống)") }), h("td", { class: "t", text: r[K.nameCol] || "" })]))); });
      w.appendChild(h("div", { class: "tw", style: "max-height:none" }, [t2]));
      var key = sh.key || (IS_OT ? M.ma : "");
      var logs = (db().auditlog || []).filter(function (a) { var c = a.chiTiet || ""; return (key && c.indexOf("Công thức tiền lương") >= 0 && c.indexOf(key) >= 0) || (c.indexOf(K.title) >= 0 && c.indexOf(M.ma) >= 0); }).slice(-40).reverse();
      w.appendChild(h("div", { class: "fh", text: "Nhật ký thao tác (ai, khi nào)" }));
      if (!logs.length) w.appendChild(h("div", { class: "hint", text: "Chưa có nhật ký khớp mã này." }));
      else { var t3 = h("table"); t3.appendChild(h("tr", {}, ["Lúc", "Người", "Thao tác", "Nội dung"].map(function (x) { return h("th", { text: x }); }))); logs.forEach(function (a) { t3.appendChild(h("tr", {}, [h("td", { class: "t", text: A.fmtTime(a.luc) }), h("td", { class: "t", text: a.nguoi || "" }), h("td", { class: "t", text: a.thaoTac || "" }), h("td", { class: "t", text: a.chiTiet || "" })])); }); w.appendChild(h("div", { class: "tw", style: "max-height:260px" }, [t3])); }
      return w;
    }

    // ================= NGỪNG SỬ DỤNG MÃ =================
    /** Xóa mã CHƯA ÁP DỤNG (và các công thức con chưa áp dụng của nó). Mã đã dùng → chỉ được "Ngừng sử dụng". */
    function deleteMa(ma) {
      var ck = OM.deleteCheck(db(), ma);
      if (!ck.ok) { A.alert("⛔ Không xóa được: " + ck.reason); return; }
      var msg = "Xóa " + K.noun + " “" + ma + "”?\n\n• " + ck.rows.length + " dòng danh mục của mã" + (ck.kids.length ? "\n• " + ck.kids.length + " phiên bản công thức chưa áp dụng đi kèm: " + ck.kids.map(function (k) { return String(k["Mã công thức"] || "") + " v" + (k["Phiên bản"] || 1) + " (" + (k["Trạng thái"] || "Nháp") + ")"; }).join(", ") : "") + "\n\nChưa nhân viên nào dùng mã này nên không ảnh hưởng lương. Thao tác được ghi vào nhật ký.";
      var plans = [];
      for (var i = 0; i < ck.kids.length; i++) { var pk = A.REPO.plan("remove", TC, ck.kids[i], null, { what: "xóa công thức chưa áp dụng" }); if (!pk.ok) { A.alert("⛔ Không xóa được: " + pk.msg); return; } plans.push(pk); }
      for (var j = 0; j < ck.rows.length; j++) { var pp = A.REPO.plan("remove", T, ck.rows[j], null, { what: "xóa " + K.noun }); if (!pp.ok) { A.alert("⛔ Không xóa được: " + pp.msg); return; } plans.push(pp); }
      if (!confirm(msg)) return;
      if (A.txn([T, TC], function () { var ok = true; plans.forEach(function (p) { if (ok && !A.commit(p, { action: K.title + " — xóa " + ma + " (chưa áp dụng)" })) ok = false; }); return ok; })) { A.dirtyBump(); A.toast("Đã xóa " + K.noun + " " + ma); A.render(); }
    }
    function stopDialog(ma) {
      var rs = OM.parentRows(db(), ma), row = OM.effectiveRow(rs, S.nam || A.st.nam, S.thang || A.st.thang);
      if (!row) { A.toast("Mã này không có phiên bản đang hiệu lực"); return; }
      var us = OM.usage(db(), ma, A.kqKy(S.nam, S.thang).kq), body = h("div");
      body.appendChild(h("div", { class: "hint", text: "Đặt “Hiệu lực đến” cho phiên bản đang hiệu lực của mã " + ma + ". Từ ngày sau đó, nhân viên còn gán mã này sẽ báo thiếu danh mục khi tính lương." }));
      body.appendChild(h("div", { class: us.dangDung ? "warn" : "hint", text: (us.dangDung != null ? us.dangDung + " nhân viên đang dùng mã trong kỳ " + S.thang + "/" + S.nam + ". " : "") + (us.closed.length ? "Kỳ đã chốt từng dùng mã (bản chốt không đổi): " + us.closed.slice(0, 6).map(function (x) { return x.ky; }).join(", ") + "." : "") }));
      var di = A.dateField("", { "aria-label": "Ngừng từ ngày", "data-ot-stop-date": "1" }); body.appendChild(h("div", { class: "fld", style: "max-width:240px" }, [h("label", { text: "Hiệu lực đến (ngày cuối cùng còn dùng) *" }), di]));
      var m = A.$("#modal"); m.innerHTML = ""; m.className = ""; m.onclick = function (e) { if (e.target === m) closeSmall(); };
      var closeSmall = function () { m.className = "hide"; m.innerHTML = ""; m.onclick = null; A.render(); };
      var d = h("div", { class: "dlg", "data-ot-stop": ma }, [h("header", {}, [h("h3", { text: "Ngừng sử dụng mã " + ma }), btn("✕", "ghost", closeSmall)]), h("div", { class: "bd" }, [body]), h("footer", {}, [btn("Hủy", "", closeSmall), btn("Ngừng sử dụng", "pri", function () {
        var v = A.dateIso(di); if (!v) { A.toast("Nhập ngày hợp lệ"); return; } if (v < (row["Hiệu lực từ"] || "")) { A.toast("Ngày phải sau Hiệu lực từ " + fdate(row["Hiệu lực từ"])); return; }
        if (A.txn([T], function () { return !!A.commit(A.REPO.plan("update", T, row, { "Hiệu lực đến": v }, { what: "ngừng sử dụng " + K.noun }), { confirm: true, action: K.title + " — ngừng sử dụng " + ma + " đến " + v }); })) { A.dirtyBump(); A.toast("Đã đặt ngừng sử dụng mã " + ma); closeSmall(); }
      })])]);
      m.appendChild(d);
    }

    // ================= LIÊN KẾT DỮ LIỆU CŨ (MIGRATION) =================
    function linkDialog() {
      var plan = OM.linkPlan(db()), body = h("div", { "data-ot-link": "1" });
      body.appendChild(h("div", { class: "hint", text: "Gán “" + K.link + "” cho các công thức " + K.short.toLowerCase() + " đã có. Chỉ liên kết khi suy ra DUY NHẤT; mã công thức, biểu thức, trạng thái, hiệu lực, phiên bản và lịch sử được giữ nguyên 100%. Trường hợp không chắc được liệt kê để xử lý — không tự đoán. Có thể hoàn tác theo đợt." }));
      var kp = h("div", { class: "kpis" });
      [["Sẽ liên kết", plan.link.length], ["Đã liên kết", plan.already.length], ["Không rõ cha (nhiều mã dùng chung)", plan.ambiguous.length], ["Không có mã cha", plan.orphans.length], ["Liên kết sai khóa", plan.invalid.length]].forEach(function (k) { kp.appendChild(h("div", { class: "kpi" }, [h("small", { text: k[0] }), h("b", { text: String(k[1]) })])); });
      body.appendChild(kp);
      var list = function (title, items, fn) { if (!items.length) return; body.appendChild(h("div", { class: "fh", text: title })); var t = h("table"); t.appendChild(h("tr", {}, ["Mã công thức", "Phiên bản", "Trạng thái", "Chi tiết"].map(function (x) { return h("th", { text: x }); }))); items.forEach(function (x) { var r = x.rec || x; t.appendChild(h("tr", {}, [h("td", { class: "t", text: r["Mã công thức"] || "" }), h("td", { class: "t", text: "v" + (r["Phiên bản"] || 1) }), h("td", { class: "t", text: r["Trạng thái"] || "Nháp" }), h("td", { class: "t", text: fn(x) })])); }); body.appendChild(h("div", { class: "tw", style: "max-height:200px" }, [t])); };
      list("Sẽ được liên kết", plan.link, function (x) { return "→ " + x.ma; });
      list("Cần xử lý: nhiều " + K.noun + " dùng chung khóa này, không có mã nào mang đúng tên khóa", plan.ambiguous, function (x) { return "Ứng viên: " + x.candidates.join(", ") + " — đặt “Loại công thức” cho rõ hoặc liên kết thủ công"; });
      list("Cần xử lý: không có " + K.noun + " nào dùng khóa này", plan.orphans, function () { return "Chưa có " + K.noun + " cha — tạo mã hoặc để công thức ngoài danh sách"; });
      list("Liên kết hiện có không khớp khóa công thức", plan.invalid, function (x) { return x.problem; });
      var bs = OM.batches(db());
      if (bs.length) { body.appendChild(h("div", { class: "fh", text: "Các đợt đã liên kết (hoàn tác theo đợt — chỉ Quản trị)" })); bs.forEach(function (b) { body.appendChild(h("div", { class: "bar" }, [h("span", { text: b.id + " · " + b.soDong + " dòng" }), A.can("system.admin") ? btn("Hoàn tác đợt này", "", function () { rollback(b.id, close); }) : null])); }); }
      var m = A.$("#modal"); m.innerHTML = ""; m.className = ""; var close = function () { m.className = "hide"; m.innerHTML = ""; m.onclick = null; A.render(); }; m.onclick = function (e) { if (e.target === m) close(); };
      var d = h("div", { class: "dlg wide" }, [h("header", {}, [h("h3", { text: "Liên kết công thức " + K.short.toLowerCase() + " với mã cha" }), btn("✕", "ghost", close)]), h("div", { class: "bd" }, [body]),
        h("footer", {}, [btn("Đóng", "", close), plan.link.length ? btn("Áp dụng liên kết (" + plan.link.length + ")", "pri", function () { applyLink(plan, close); }) : null])]);
      d.setAttribute("data-ot-linkdlg", "1"); m.appendChild(d);
    }
    function applyLink(plan, close) {
      var batch = "LK-" + new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14), before = JSON.stringify(db()[TC] || []);
      try { A.backup("truoc-lien-ket-congthuc"); } catch (e) { /* sao lưu là phụ — vẫn có hoàn tác theo đợt */ }
      var ops = OM.linkOps(plan, batch), ok = A.txn([TC], function () {
        for (var i = 0; i < ops.length; i++) { if (!A.commit(A.REPO.plan("update", TC, ops[i].rec, ops[i].values, { what: "liên kết công thức với " + K.noun + " cha" }), { audit: false })) return false; }
        var bad = OM.integrityDiff(JSON.parse(before), db()[TC]); if (bad.length) { A.alert("Kiểm tra toàn vẹn thất bại — hoàn tác:\n• " + bad.slice(0, 8).join("\n• ")); return false; }
        A.audit("Công thức tiền lương — liên kết " + K.noun + " cha", "Đợt " + batch + ": " + ops.length + " công thức (nội dung giữ nguyên)");
        return true;
      });
      if (ok) { A.dirtyBump(); A.toast("Đã liên kết " + ops.length + " công thức (đợt " + batch + ")"); close(); }
    }
    function rollback(batch, close) {
      var ops = OM.rollbackOps(db(), batch); if (!ops.length) return;
      if (!confirm("Hoàn tác liên kết đợt " + batch + " (" + ops.length + " dòng)? Chỉ xóa cột liên kết, không đổi gì khác.")) return;
      var ok = A.txn([TC], function () { for (var i = 0; i < ops.length; i++) { if (!A.commit(A.REPO.plan("update", TC, ops[i].rec, ops[i].values, { what: "hoàn tác liên kết công thức" }), { audit: false })) return false; } A.audit("Công thức tiền lương — hoàn tác liên kết mã cha", "Đợt " + batch + ": " + ops.length + " dòng"); return true; });
      if (ok) { A.dirtyBump(); A.toast("Đã hoàn tác đợt " + batch); close(); }
    }

    return { masterView: masterView, openModal: openModal, linkDialog: linkDialog, _state: function () { return { S: S, M: M }; } };
  }
  root.HAKUI = root.HAKUI || {}; root.HAKUI.formulaMaster = { create: create };
})(typeof window !== "undefined" ? window : this);
