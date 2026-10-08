// ===== GIAO DIỆN APP TÍNH LƯƠNG HAK (offline, không cần internet/server) =====
(function () {
  "use strict";
  var KEY = "luonghak_db_v1";
  var E = window.LuongEngine;
  var DAYS = []; for (var i = 1; i <= 31; i++) DAYS.push(("0" + i).slice(-2));

  // ---------- Định nghĩa các bảng dữ liệu ----------
  var S = {
    nhansu: { ten: "Nhân sự", cols: ["Mã nhân viên", "Họ và tên", "Mã PB", "Mã CV", "Ngày vào làm", "Ngày nghỉ/thay đổi", "Lương cơ bản", "Lương thỏa thuận", "Mã tiền lương 1", "Mã tiền lương 2", "Mã tăng ca", "Mã phụ cấp", "Mã hỗ trợ", "Mã hỗ trợ 2", "Mã BHXH", "Mã TNCN", "Mã GT_TNCN_BT", "Mã GT_TNCN_PT", "Người phụ thuộc", "Số CCCD", "Số tài khoản", "Tên Ngân hàng"], hint: "Ngày nhập dạng 2026-09-30. Mã TNCN: TNCN0 = miễn thuế, TNCN1 = khấu trừ 10%, TNCN2 = lũy tiến. Nghỉ việc: điền 'Ngày nghỉ/thay đổi'." },
    chamcong: { ten: "Chấm công", cols: ["Kỳ", "Mã NV", "Hình thức công"].concat(DAYS), kyCol: "Kỳ", def: { "Hình thức công": "BT" }, hint: "Kỳ dạng 2026-09. Hình thức công: BT (bình thường), CL (lễ), PN (phép năm), CC (cơm), TC/TC1..TC6 (tăng ca), DC, TRCH. Ô ngày có thể ghi '1', '0.5' hoặc '1QC' (1 công + nhãn QC)." },
    sanluong: { ten: "Sản lượng", cols: ["Phiếu cân", "Ngày cân", "Biển số", "KL hàng (Tấn)", "Mã NV"], dateCol: "Ngày cân", hint: "Ngày cân dạng 2026-09-15. Mỗi dòng gán cho 1 Mã NV." },
    bandam: { ten: "Bơm dăm", cols: ["Phiếu cân", "Ngày cân", "Biển số", "KL hàng (Tấn)", "Mã NV"], dateCol: "Ngày cân", hint: "Cột 'KL hàng (Tấn)' ở đây = số xe bơm (nhân với đơn giá bơm dăm)." },
    psluong: { ten: "Thưởng / Trừ", cols: ["Ngày hạch toán", "Mã NV", "Diễn giải", "Thưởng", "Thu nhập khác", "Trừ khác"], dateCol: "Ngày hạch toán" },
    ungluong: { ten: "Tạm ứng", cols: ["Ngày hạch toán", "Mã NV", "Diễn giải", "Tạm ứng"], dateCol: "Ngày hạch toán" },
    tiencom: { ten: "Suất cơm", cols: ["Ngày", "Mã NV", "Số suất cơm", "Ghi chú"], dateCol: "Ngày" }
  };
  var DM = {
    dm_luong: { ten: "Lương", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã lương", "Mã hình thức lương", "Hình thức lương", "Số tiền khoán", "Lương phụ", "Ngưỡng truy thu BH (công)", "ĐK_Bù lương (công tối thiểu)", "Đơn giá bù lương", "Đơn giá bơm dăm", "Cách tính"] },
    dm_phucap: { ten: "Phụ cấp", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã phụ cấp", "Tên phụ cấp", "Số tiền", "Tỷ lệ", "Tham chiếu", "Cách tính"] },
    dm_tangca: { ten: "Tăng ca", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã tăng ca", "Nội dung tăng ca", "Hệ số tăng ca", "Tiền tăng ca (nếu tính cố định)", "Cách tính"] },
    dm_hotro: { ten: "Hỗ trợ", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã hỗ trợ", "Tên hỗ trợ", "Số tiền", "Cách tính"] },
    dm_baohiem: { ten: "Bảo hiểm", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã bảo hiểm", "Nội dung", "DN.BHXH", "DN.BHYT", "DN.BHTN", "DN.KPCD", "NLD.BHXH", "NLD.BHYT", "NLD.BHTN", "NLD.KPCD"] },
    dm_tncn: { ten: "Biểu thuế TNCN", cols: ["Hiệu lực từ", "Hiệu lực đến", "Bậc", "Nội dung khấu trừ", "Tỷ lệ đóng thuế", "Thu nhập tháng (Min)", "Thu nhập tháng (Max)"] },
    dm_giamtru: { ten: "Giảm trừ TNCN", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã giảm trừ", "Số người", "Số tiền"] },
    dm_phongban: { ten: "Phòng ban", cols: ["Mã phòng ban", "Tên phòng ban"] },
    dm_chucvu: { ten: "Chức vụ", cols: ["Mã chức vụ", "Tên chức vụ"] }
  };
  var ALL = Object.assign({}, S, DM);

  // ---------- Lưu trữ ----------
  var db = load();
  function load() {
    try { var s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {}
    return {};
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast("⚠ Không lưu được vào trình duyệt, hãy bấm Sao lưu!"); }
  }
  Object.keys(ALL).forEach(function (k) { if (!db[k]) db[k] = []; });
  var st = { tab: "luong", dm: "dm_luong", nam: new Date().getFullYear(), thang: new Date().getMonth() + 1, bu: false, kq: null };
  try { var p = JSON.parse(localStorage.getItem(KEY + "_ui") || "{}"); Object.assign(st, p, { kq: null }); } catch (e) {}
  function saveUi() { try { localStorage.setItem(KEY + "_ui", JSON.stringify({ tab: st.tab, dm: st.dm, nam: st.nam, thang: st.thang, bu: st.bu })); } catch (e) {} }

  // ---------- Tiện ích ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "on") Object.keys(attrs.on).forEach(function (ev) { el.addEventListener(ev, attrs.on[ev]); });
      else if (k === "text") el.textContent = attrs[k]; else if (k === "html") el.innerHTML = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function toast(m) { var t = $("#toast"); t.textContent = m; t.className = "show"; setTimeout(function () { t.className = ""; }, 2600); }
  function fmt(n) { return typeof n === "number" ? n.toLocaleString("vi-VN") : (n == null ? "" : n); }
  function kyStr() { return st.nam + "-" + ("0" + st.thang).slice(-2); }
  function rowInKy(r, def) {
    if (def.kyCol) return r[def.kyCol] === kyStr();
    if (def.dateCol) { var m = String(r[def.dateCol] || "").match(/^(\d{4})-(\d{1,2})/); return !!m && +m[1] === +st.nam && +m[2] === +st.thang; }
    return true;
  }
  function download(name, mime, content) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function xlsHtml(title, cols, rows) {
    var esc = function (v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
    var t = "<html xmlns:x='urn:schemas-microsoft-com:office:excel'><head><meta charset='utf-8'></head><body><table border='1'><tr>" +
      cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr>" +
      rows.map(function (r) { return "<tr>" + cols.map(function (c) { return "<td>" + esc(r[c]) + "</td>"; }).join("") + "</tr>"; }).join("") +
      "</table></body></html>";
    return "﻿" + t;
  }

  // ---------- Bảng nhập liệu (hỗ trợ dán từ Excel) ----------
  function grid(key, def) {
    var wrap = h("div", { class: "card" });
    var bar = h("div", { class: "bar" });
    var body = h("div", { class: "gridwrap" });
    var theoKy = !!(def.kyCol || def.dateCol);
    if (theoKy) bar.appendChild(kyPicker(function () { render(); }));
    var cnt = h("span", { class: "hint" });
    bar.appendChild(h("button", { class: "b pri", text: "+ Thêm dòng", on: { click: function () { var r = Object.assign({}, def.def || {}); if (def.kyCol) r[def.kyCol] = kyStr(); if (def.dateCol) r[def.dateCol] = kyStr() + "-01"; db[key].push(r); save(); draw(); } } }));
    bar.appendChild(h("button", { class: "b", text: "⬇ Xuất Excel", on: { click: function () { var rows = db[key].filter(function (r) { return !theoKy || rowInKy(r, def); }); download(def.ten + ".xls", "application/vnd.ms-excel", xlsHtml(def.ten, def.cols, rows)); } } }));
    bar.appendChild(h("button", { class: "b", text: "⬆ Nhập file CSV", on: { click: function () { importCsv(key, def, draw); } } }));
    bar.appendChild(cnt);
    wrap.appendChild(bar);
    if (def.hint) wrap.appendChild(h("div", { class: "hint", text: "💡 " + def.hint + " Có thể copy nhiều dòng từ Excel rồi Ctrl+V vào ô bất kỳ." }));
    else wrap.appendChild(h("div", { class: "hint", text: "💡 Có thể copy nhiều dòng từ Excel (đúng thứ tự cột) rồi Ctrl+V vào ô bất kỳ." }));
    wrap.appendChild(body);

    function draw() {
      body.innerHTML = "";
      var idx = []; db[key].forEach(function (r, i) { if (!theoKy || rowInKy(r, def)) idx.push(i); });
      cnt.textContent = idx.length + " dòng";
      var t = h("table"), thead = h("thead"), trh = h("tr");
      trh.appendChild(h("th", { text: "#" }));
      def.cols.forEach(function (c) { trh.appendChild(h("th", { text: c })); });
      trh.appendChild(h("th", { text: "" })); thead.appendChild(trh); t.appendChild(thead);
      var tb = h("tbody");
      idx.forEach(function (ri, n) {
        var r = db[key][ri], tr = h("tr");
        tr.appendChild(h("td", { class: "txt", text: n + 1 }));
        def.cols.forEach(function (c, ci) {
          var inp = h("input", { value: r[c] == null ? "" : r[c], "data-r": n, "data-c": ci });
          inp.addEventListener("change", function () { r[c] = inp.value; save(); });
          inp.addEventListener("paste", function (ev) {
            var txt = (ev.clipboardData || window.clipboardData).getData("text");
            if (txt.indexOf("\t") < 0 && txt.indexOf("\n") < 0) return;
            ev.preventDefault();
            var lines = txt.replace(/\r/g, "").replace(/\n$/, "").split("\n");
            lines.forEach(function (ln, li) {
              var cells = ln.split("\t"), target = idx[n + li];
              if (target == null) { var nr = Object.assign({}, def.def || {}); if (def.kyCol) nr[def.kyCol] = kyStr(); db[key].push(nr); target = db[key].length - 1; idx.push(target); }
              cells.forEach(function (v, k) { var col = def.cols[ci + k]; if (col) db[key][target][col] = v.trim(); });
            });
            save(); draw(); toast("Đã dán " + lines.length + " dòng");
          });
          tr.appendChild(h("td", {}, [inp]));
        });
        tr.appendChild(h("td", { class: "act" }, [h("button", { class: "b red", text: "✕", title: "Xóa dòng", on: { click: function () { if (confirm("Xóa dòng này?")) { db[key].splice(ri, 1); save(); draw(); } } } })]));
        tb.appendChild(tr);
      });
      t.appendChild(tb); body.appendChild(t);
    }
    draw();
    return wrap;
  }

  function importCsv(key, def, done) {
    var f = h("input", { type: "file", accept: ".csv,.txt,.tsv" });
    f.addEventListener("change", function () {
      var fr = new FileReader();
      fr.onload = function () {
        var text = String(fr.result).replace(/^﻿/, "").replace(/\r/g, "");
        var lines = text.split("\n").filter(function (l) { return l.trim(); });
        if (!lines.length) return;
        var sep = lines[0].indexOf("\t") >= 0 ? "\t" : (lines[0].split(";").length > lines[0].split(",").length ? ";" : ",");
        var head = lines[0].split(sep).map(function (s) { return s.trim().replace(/^"|"$/g, ""); });
        var n = 0;
        lines.slice(1).forEach(function (ln) {
          var cells = ln.split(sep), r = {};
          head.forEach(function (c, i) { if (def.cols.indexOf(c) >= 0) r[c] = (cells[i] || "").trim().replace(/^"|"$/g, ""); });
          if (Object.keys(r).length) { db[key].push(r); n++; }
        });
        save(); done(); toast("Đã nhập " + n + " dòng (dòng đầu file phải là tên cột).");
      };
      fr.readAsText(f.files[0], "utf-8");
    });
    f.click();
  }

  function kyPicker(onChange) {
    var m = h("select"), y = h("input", { class: "i", type: "number", style: "width:80px", value: st.nam });
    for (var i = 1; i <= 12; i++) m.appendChild(h("option", { value: i, text: "Tháng " + i }));
    m.value = st.thang;
    m.addEventListener("change", function () { st.thang = +m.value; saveUi(); onChange(); });
    y.addEventListener("change", function () { st.nam = +y.value; saveUi(); onChange(); });
    return h("span", {}, [h("label", { text: "Kỳ: " }), m, document.createTextNode(" "), y]);
  }

  // ---------- Tab tính lương ----------
  var COLS_BL = ["Mã NV", "Họ và tên", "Phòng ban", "Chức vụ", "Công chuẩn", "Tổng công", "Lương thời gian", "Lương phụ", "Sản lượng (tấn)", "Lương sản lượng", "Lương bù SL", "Lương lương bơm dăm".replace("lương ", ""), "Tiền tăng ca", "Phụ cấp", "Phụ cấp công tác", "Lương hỗ trợ", "Tiền cơm", "Thưởng", "Thu nhập khác", "Tổng thu nhập", "BH trừ NLĐ", "Truy thu BH", "Thuế TNCN", "Trừ khác", "Tạm ứng", "Thực lĩnh"];
  COLS_BL[11] = "Lương bơm dăm";
  var SUM_BL = COLS_BL.slice(6);

  function tabLuong() {
    var box = h("div"), card = h("div", { class: "card" }), bar = h("div", { class: "bar" });
    bar.appendChild(kyPicker(function () { st.kq = null; render(); }));
    var sel = h("select"); [["false", "Bù sản lượng theo THÁNG (mặc định)"], ["true", "Bù sản lượng theo NGÀY (Đại Hiệp)"]].forEach(function (o) { sel.appendChild(h("option", { value: o[0], text: o[1] })); });
    sel.value = String(st.bu); sel.addEventListener("change", function () { st.bu = sel.value === "true"; saveUi(); });
    bar.appendChild(sel);
    bar.appendChild(h("button", { class: "b pri", text: "▶ TÍNH LƯƠNG", on: { click: function () { st.kq = E.tinhBangLuong(db, st.nam, st.thang, st.bu); st.kq.ky = kyStr(); render(); toast("Đã tính " + st.kq.bangluong.length + " nhân viên"); } } }));
    if (st.kq) {
      bar.appendChild(h("button", { class: "b", text: "⬇ Excel: Bảng lương", on: { click: function () { download("BangLuong_" + st.kq.ky + ".xls", "application/vnd.ms-excel", xlsHtml("BL", COLS_BL, st.kq.bangluong)); } } }));
      bar.appendChild(h("button", { class: "b", text: "⬇ BHXH", on: { click: function () { var c = st.kq.bhxh[0] ? Object.keys(st.kq.bhxh[0]) : []; download("BHXH_" + st.kq.ky + ".xls", "application/vnd.ms-excel", xlsHtml("BH", c, st.kq.bhxh)); } } }));
      bar.appendChild(h("button", { class: "b", text: "⬇ Thuế TNCN", on: { click: function () { var c = st.kq.tncn[0] ? Object.keys(st.kq.tncn[0]) : []; download("TNCN_" + st.kq.ky + ".xls", "application/vnd.ms-excel", xlsHtml("TNCN", c, st.kq.tncn)); } } }));
      bar.appendChild(h("button", { class: "b", text: "🖨 In phiếu lương", on: { click: function () { printSlips(); } } }));
    }
    card.appendChild(bar);
    if (!st.kq) { card.appendChild(h("div", { class: "hint", text: "Nhập dữ liệu ở các tab bên trên (Nhân sự, Chấm công, Danh mục...), chọn kỳ rồi bấm TÍNH LƯƠNG. Dữ liệu lưu ngay trên máy này, không cần mạng." })); box.appendChild(card); return box; }
    var r = st.kq, tong = r.bangluong.reduce(function (a, x) { return a + x["Thực lĩnh"]; }, 0);
    card.appendChild(h("div", { class: "kpi" }, [
      h("div", { html: "Số nhân viên<b>" + r.bangluong.length + "</b>" }),
      h("div", { html: "Tổng thu nhập<b>" + fmt(r.bangluong.reduce(function (a, x) { return a + x["Tổng thu nhập"]; }, 0)) + "</b>" }),
      h("div", { html: "Tổng thực lĩnh<b>" + fmt(tong) + "</b>" })]));
    if (r.canhbao.length) card.appendChild(h("div", { class: "warn", html: "<b>⚠ Cảnh báo dữ liệu:</b><br>" + r.canhbao.map(function (x) { return x.replace(/</g, "&lt;"); }).join("<br>") }));
    var gw = h("div", { class: "gridwrap" }), t = h("table"), tr = h("tr");
    COLS_BL.forEach(function (c) { tr.appendChild(h("th", { text: c })); });
    t.appendChild(h("thead", {}, [tr]));
    var tb = h("tbody");
    r.bangluong.forEach(function (row) { var x = h("tr"); COLS_BL.forEach(function (c, i) { x.appendChild(h("td", { class: i < 4 ? "txt" : "ro", text: fmt(row[c]) })); }); tb.appendChild(x); });
    t.appendChild(tb);
    var tf = h("tr"); COLS_BL.forEach(function (c, i) { var s = SUM_BL.indexOf(c) >= 0 && c !== "Công chuẩn" ? r.bangluong.reduce(function (a, x) { return a + (+x[c] || 0); }, 0) : ""; tf.appendChild(h("td", { text: i === 0 ? "TỔNG" : (s === "" ? "" : fmt(Math.round(s * 1000) / 1000)) })); });
    t.appendChild(h("tfoot", {}, [tf]));
    gw.appendChild(t); card.appendChild(gw); box.appendChild(card);
    return box;
  }

  function printSlips() {
    var r = st.kq; if (!r) return;
    var box = h("div", { id: "slips" });
    var lines = [["Lương thời gian", "Lương thời gian"], ["Lương phụ", "Lương phụ"], ["Lương sản lượng", "Lương sản lượng"], ["Lương bù SL", "Lương bù SL"], ["Lương bơm dăm", "Lương bơm dăm"], ["Tiền tăng ca", "Tiền tăng ca"], ["Phụ cấp", "Phụ cấp"], ["Phụ cấp công tác", "Phụ cấp công tác"], ["Lương hỗ trợ", "Lương hỗ trợ"], ["Tiền cơm", "Tiền cơm"], ["Thưởng", "Thưởng"], ["Thu nhập khác", "Thu nhập khác"], ["Tổng thu nhập", "TỔNG THU NHẬP"], ["BH trừ NLĐ", "BHXH/BHYT/BHTN"], ["Truy thu BH", "Truy thu bảo hiểm"], ["Thuế TNCN", "Thuế TNCN"], ["Trừ khác", "Trừ khác"], ["Tạm ứng", "Tạm ứng"], ["Thực lĩnh", "THỰC LĨNH"]];
    r.bangluong.forEach(function (b) {
      var s = h("div", { class: "slip" });
      s.appendChild(h("h3", { text: "PHIẾU LƯƠNG THÁNG " + st.thang + "/" + st.nam }));
      s.appendChild(h("div", { html: "<b>" + b["Họ và tên"] + "</b> — Mã NV: " + b["Mã NV"] + " — " + (b["Phòng ban"] || "") + "<br>Tổng công: " + b["Tổng công"] + " / Công chuẩn: " + b["Công chuẩn"] }));
      var t = h("table");
      lines.forEach(function (l) { if (b[l[0]] || /TỔNG|THỰC/.test(l[1])) t.appendChild(h("tr", { html: "<td>" + l[1] + "</td><td>" + fmt(b[l[0]]) + "</td>" })); });
      s.appendChild(t); box.appendChild(s);
    });
    var w = window.open("", "_blank");
    if (!w) { toast("Trình duyệt chặn cửa sổ in, hãy cho phép pop-up."); return; }
    w.document.write("<html><head><meta charset='utf-8'><title>Phiếu lương</title><link rel='stylesheet' href='" + location.href.replace(/[^\/]*$/, "") + "style.css'></head><body>" + box.outerHTML + "<script>setTimeout(function(){print()},400)<\/script></body></html>");
    w.document.close();
  }

  // ---------- Tab sao lưu ----------
  function tabSaoLuu() {
    var c = h("div", { class: "card" });
    c.appendChild(h("h3", { text: "Sao lưu / Khôi phục dữ liệu" }));
    c.appendChild(h("div", { class: "warn", text: "Dữ liệu lưu trong trình duyệt (Edge/Chrome) của máy này. Nếu xóa dữ liệu duyệt web hoặc di chuyển thư mục app, dữ liệu có thể mất → hãy SAO LƯU thường xuyên (cuối mỗi kỳ lương) và cất file ở nơi an toàn." }));
    var bar = h("div", { class: "bar" });
    bar.appendChild(h("button", { class: "b pri", text: "⬇ Sao lưu ra file", on: { click: function () { var d = new Date(); download("LuongHAK_backup_" + d.toISOString().slice(0, 10) + ".json", "application/json", JSON.stringify(db)); } } }));
    bar.appendChild(h("button", { class: "b", text: "⬆ Khôi phục từ file", on: { click: function () {
      var f = h("input", { type: "file", accept: ".json" });
      f.addEventListener("change", function () { var fr = new FileReader(); fr.onload = function () { try { var o = JSON.parse(fr.result); if (!confirm("Ghi đè TOÀN BỘ dữ liệu hiện tại bằng file này?")) return; db = o; Object.keys(ALL).forEach(function (k) { if (!db[k]) db[k] = []; }); save(); toast("Đã khôi phục"); render(); } catch (e) { alert("File không hợp lệ"); } }; fr.readAsText(f.files[0]); });
      f.click(); } } }));
    bar.appendChild(h("button", { class: "b", text: "📋 Nạp danh mục mẫu (VN)", on: { click: function () { nap_mau(); } } }));
    bar.appendChild(h("button", { class: "b red", text: "🗑 Xóa toàn bộ dữ liệu", on: { click: function () { if (confirm("XÓA TOÀN BỘ dữ liệu? Không thể hoàn tác!") && confirm("Chắc chắn chứ?")) { db = {}; Object.keys(ALL).forEach(function (k) { db[k] = []; }); save(); render(); } } } }));
    c.appendChild(bar);
    var tot = Object.keys(ALL).map(function (k) { return ALL[k].ten + ": " + db[k].length; }).join(" · ");
    c.appendChild(h("div", { class: "hint", text: "Hiện có — " + tot }));
    return c;
  }
  // Danh mục mẫu: chỉ nạp khi bảng còn trống; số liệu chỉ là gợi ý, kế toán cần kiểm tra lại theo quy định hiện hành.
  function nap_mau() {
    var n = 0, set = function (k, rows) { if (!db[k].length) { db[k] = rows; n++; } };
    set("dm_baohiem", [{ "Hiệu lực từ": "2024-01-01", "Mã bảo hiểm": "BH01", "Nội dung": "BHXH bắt buộc", "DN.BHXH": "0.175", "DN.BHYT": "0.03", "DN.BHTN": "0.01", "DN.KPCD": "0.02", "NLD.BHXH": "0.08", "NLD.BHYT": "0.015", "NLD.BHTN": "0.01", "NLD.KPCD": "0" }]);
    set("dm_tncn", [[1, 0.05, 0, 5e6], [2, 0.1, 5e6, 10e6], [3, 0.15, 10e6, 18e6], [4, 0.2, 18e6, 32e6], [5, 0.25, 32e6, 52e6], [6, 0.3, 52e6, 80e6], [7, 0.35, 80e6, ""]].map(function (x) { return { "Hiệu lực từ": "2020-01-01", "Bậc": x[0], "Tỷ lệ đóng thuế": x[1], "Thu nhập tháng (Min)": x[2], "Thu nhập tháng (Max)": x[3] }; }));
    set("dm_giamtru", [{ "Hiệu lực từ": "2020-07-01", "Mã giảm trừ": "BT", "Số người": 1, "Số tiền": 11000000 }, { "Hiệu lực từ": "2020-07-01", "Mã giảm trừ": "PT", "Số người": 1, "Số tiền": 4400000 }, { "Hiệu lực từ": "2026-01-01", "Mã giảm trừ": "BT", "Số người": 1, "Số tiền": 15500000 }, { "Hiệu lực từ": "2026-01-01", "Mã giảm trừ": "PT", "Số người": 1, "Số tiền": 6200000 }]);
    set("dm_luong", [{ "Hiệu lực từ": "2020-01-01", "Mã lương": "TG1", "Mã hình thức lương": "TG", "Hình thức lương": "Lương thời gian", "Cách tính": "Số ngày của tháng - tất cả ngày CN" }, { "Hiệu lực từ": "2020-01-01", "Mã lương": "CĐ", "Mã hình thức lương": "CD", "Hình thức lương": "Lương cố định", "Cách tính": "Cố định" }]);
    save(); render(); toast(n ? "Đã nạp danh mục mẫu (chỉ là số gợi ý — kế toán cần kiểm tra lại tỷ lệ BH, biểu thuế, giảm trừ theo quy định hiện hành)" : "Các danh mục đã có dữ liệu, không ghi đè");
  }

  // ---------- Điều hướng ----------
  var TABS = [["luong", "▶ Tính lương"], ["nhansu", "Nhân sự"], ["chamcong", "Chấm công"], ["sanluong", "Sản lượng"], ["bandam", "Bơm dăm"], ["psluong", "Thưởng/Trừ"], ["ungluong", "Tạm ứng"], ["tiencom", "Suất cơm"], ["dm", "Danh mục"], ["backup", "Sao lưu"]];
  function render() {
    var nav = $("#tabs"); nav.innerHTML = "";
    TABS.forEach(function (t) { nav.appendChild(h("button", { class: st.tab === t[0] ? "on" : "", text: t[1], on: { click: function () { st.tab = t[0]; saveUi(); render(); } } })); });
    var m = $("#main"); m.innerHTML = "";
    if (st.tab === "luong") m.appendChild(tabLuong());
    else if (st.tab === "backup") m.appendChild(tabSaoLuu());
    else if (st.tab === "dm") {
      var bar = h("div", { class: "bar" });
      Object.keys(DM).forEach(function (k) { bar.appendChild(h("button", { class: "b" + (st.dm === k ? " pri" : ""), text: DM[k].ten, on: { click: function () { st.dm = k; saveUi(); render(); } } })); });
      m.appendChild(bar); m.appendChild(grid(st.dm, DM[st.dm]));
    } else m.appendChild(grid(st.tab, S[st.tab]));
  }
  render();
})();
