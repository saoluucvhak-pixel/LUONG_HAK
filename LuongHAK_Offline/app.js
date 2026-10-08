// ===== GIAO DIỆN APP TÍNH LƯƠNG HAK (offline) =====
(function () {
  "use strict";
  var KEY = "luonghak_db_v1";
  var E = window.LuongEngine;
  var DAYS = []; for (var i = 1; i <= 31; i++) DAYS.push(("0" + i).slice(-2));

  // ---------- Định nghĩa bảng ----------
  var S = {
    nhansu: { ten: "Nhân sự", icon: "👥", special: "nhansu", cols: ["Mã nhân viên", "Họ và tên", "Mã PB", "Mã CV", "Ngày vào làm", "Ngày nghỉ/thay đổi", "Lương cơ bản", "Lương thỏa thuận", "Mã tiền lương 1", "Mã tiền lương 2", "Mã tăng ca", "Mã phụ cấp", "Mã hỗ trợ", "Mã hỗ trợ 2", "Mã BHXH", "Mã TNCN", "Mã GT_TNCN_BT", "Mã GT_TNCN_PT", "Người phụ thuộc", "Số CCCD", "Số tài khoản", "Tên Ngân hàng"] },
    chamcong: { ten: "Chấm công", icon: "🗓", cols: ["Kỳ", "Mã NV", "Hình thức công"].concat(DAYS), kyCol: "Kỳ", hide: ["Kỳ"], def: { "Hình thức công": "BT" }, showName: true, total: true, hint: "Mỗi dòng = 1 nhân viên × 1 hình thức công trong tháng. Hình thức: BT (bình thường), CL (lễ), PN (phép năm), CC (tính cơm), TC/TC1–TC6 (tăng ca). Ô ngày nhập 1, 0.5, hoặc 1QC (1 công + nhãn QC). Cột đỏ nhạt là Chủ nhật." },
    sanluong: { ten: "Sản lượng", icon: "⚖", cols: ["Phiếu cân", "Ngày cân", "Biển số", "KL hàng (Tấn)", "Mã NV"], dateCol: "Ngày cân", showName: true, hint: "Mỗi phiếu cân gán cho 1 nhân viên. Muốn chia nhiều người thì nhập nhiều dòng cùng số phiếu." },
    bandam: { ten: "Bơm dăm", icon: "🚛", cols: ["Phiếu cân", "Ngày cân", "Biển số", "KL hàng (Tấn)", "Mã NV"], dateCol: "Ngày cân", showName: true, hint: "Cột 'KL hàng (Tấn)' ở bảng này được hiểu là SỐ XE bơm, nhân với đơn giá bơm dăm." },
    psluong: { ten: "Thưởng / Trừ", icon: "🎁", cols: ["Ngày hạch toán", "Mã NV", "Diễn giải", "Thưởng", "Thu nhập khác", "Trừ khác"], dateCol: "Ngày hạch toán", showName: true },
    ungluong: { ten: "Tạm ứng", icon: "💵", cols: ["Ngày hạch toán", "Mã NV", "Diễn giải", "Tạm ứng"], dateCol: "Ngày hạch toán", showName: true },
    tiencom: { ten: "Suất cơm", icon: "🍚", cols: ["Ngày", "Mã NV", "Số suất cơm", "Ghi chú"], dateCol: "Ngày", showName: true }
  };
  var DM = {
    dm_luong: { ten: "Mã lương", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã lương", "Mã hình thức lương", "Hình thức lương", "Số tiền khoán", "Lương phụ", "Ngưỡng truy thu BH (công)", "ĐK_Bù lương (công tối thiểu)", "Đơn giá bù lương", "Đơn giá bơm dăm", "Cách tính"], hint: "'Mã hình thức lương' chứa chữ SP (vd LSP) = lương sản phẩm. 'Cách tính' quyết định công chuẩn: 'Số ngày của tháng - tất cả ngày CN', 'Thực tế ngày công'..." },
    dm_phucap: { ten: "Phụ cấp", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã phụ cấp", "Tên phụ cấp", "Số tiền", "Tỷ lệ", "Tham chiếu", "Cách tính"] },
    dm_tangca: { ten: "Tăng ca", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã tăng ca", "Nội dung tăng ca", "Hệ số tăng ca", "Tiền tăng ca (nếu tính cố định)", "Cách tính"] },
    dm_hotro: { ten: "Hỗ trợ", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã hỗ trợ", "Tên hỗ trợ", "Số tiền", "Cách tính"] },
    dm_baohiem: { ten: "Bảo hiểm", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã bảo hiểm", "Nội dung", "DN.BHXH", "DN.BHYT", "DN.BHTN", "DN.KPCD", "NLD.BHXH", "NLD.BHYT", "NLD.BHTN", "NLD.KPCD"], hint: "Nhập tỷ lệ dạng 0.08 hoặc 8%. DN = công ty đóng, NLD = người lao động đóng." },
    dm_tncn: { ten: "Biểu thuế TNCN", cols: ["Hiệu lực từ", "Hiệu lực đến", "Bậc", "Nội dung khấu trừ", "Tỷ lệ đóng thuế", "Thu nhập tháng (Min)", "Thu nhập tháng (Max)"], hint: "Bậc cuối để trống ô Max (không giới hạn)." },
    dm_giamtru: { ten: "Giảm trừ TNCN", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã giảm trừ", "Số người", "Số tiền"], hint: "Mã BT = bản thân, PT = người phụ thuộc (gán trong form nhân sự)." },
    dm_phongban: { ten: "Phòng ban", cols: ["Mã phòng ban", "Tên phòng ban"] },
    dm_chucvu: { ten: "Chức vụ", cols: ["Mã chức vụ", "Tên chức vụ"] }
  };
  var ALL = Object.assign({}, S, DM);
  var DATECOLS = /^(Ngày|Hiệu lực)/;
  var NUMCOLS = /(Lương|Số tiền|Số suất|KL hàng|Thưởng|Thu nhập|Trừ khác|Tạm ứng|Đơn giá|Tỷ lệ|DN\.|NLD\.|Bậc|Người phụ thuộc|Số người|Tham chiếu|Hệ số|Ngưỡng|ĐK_|Tiền)/;
  var COLW = { "Họ và tên": 170, "Diễn giải": 200, "Cách tính": 260, "Tên phụ cấp": 160, "Hình thức lương": 150, "Nội dung": 180, "Nội dung tăng ca": 160, "Nội dung khấu trừ": 160, "Tên hỗ trợ": 150, "Tên phòng ban": 200, "Tên chức vụ": 200, "Ghi chú": 200, "Hình thức công": 90, "Mã nhân viên": 110, "Tên Ngân hàng": 150 };

  // ---------- Lưu trữ ----------
  var db = (function () { try { var s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {} return {}; })();
  Object.keys(ALL).forEach(function (k) { if (!db[k]) db[k] = []; });
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast("⚠ Không lưu được dữ liệu — hãy bấm Sao lưu ngay!"); } }
  var now = new Date();
  var st = { tab: "home", dm: "dm_luong", nam: now.getFullYear(), thang: now.getMonth() + 1, bu: false, kq: null, compact: true, q: "" };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY + "_ui") || "{}"), { kq: null, q: "" }); } catch (e) {}
  function saveUi() { try { localStorage.setItem(KEY + "_ui", JSON.stringify({ tab: st.tab, dm: st.dm, nam: st.nam, thang: st.thang, bu: st.bu, compact: st.compact })); } catch (e) {} }

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
  function btn(text, cls, fn, title) { return h("button", { class: "b " + (cls || ""), text: text, title: title || "", on: { click: fn } }); }
  function toast(m) { var t = $("#toast"); t.textContent = m; t.className = "show"; clearTimeout(toast.t); toast.t = setTimeout(function () { t.className = ""; }, 2800); }
  function fmt(n) { return typeof n === "number" ? n.toLocaleString("vi-VN") : (n == null ? "" : n); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function ky2() { return ("0" + st.thang).slice(-2); }
  function kyStr() { return st.nam + "-" + ky2(); }
  function rowInKy(r, def) {
    if (def.kyCol) return r[def.kyCol] === kyStr();
    if (def.dateCol) { var m = String(r[def.dateCol] || "").match(/^(\d{4})-(\d{1,2})/); return !!m && +m[1] === +st.nam && +m[2] === +st.thang; }
    return true;
  }
  function tenNV(ma) { for (var i = 0; i < db.nhansu.length; i++) if (db.nhansu[i]["Mã nhân viên"] === ma) return db.nhansu[i]["Họ và tên"] || ""; return ""; }
  function download(name, mime, content) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: mime })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function xls(cols, rows) {
    return "﻿<html><head><meta charset='utf-8'></head><body><table border='1'><tr>" + cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr>" +
      rows.map(function (r) { return "<tr>" + cols.map(function (c) { return "<td>" + esc(r[c]) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table></body></html>";
  }
  function modal(title, body, footer) {
    var m = $("#modal"); m.innerHTML = ""; m.className = "";
    var close = function () { m.className = "hide"; m.innerHTML = ""; };
    var d = h("div", { class: "dlg" }, [h("header", {}, [h("h3", { text: title }), btn("✕", "ghost", close)]), h("div", { class: "bd" }, [body]), footer ? h("footer", {}, footer(close)) : null]);
    m.appendChild(d); m.onclick = function (e) { if (e.target === m) close(); };
    return close;
  }
  function countOf(k) { return db[k] ? db[k].length : 0; }

  // ---------- Ô nhập dùng chung ----------
  function datalistFor(col) {
    var src = { "Mã PB": ["dm_phongban", "Mã phòng ban"], "Mã CV": ["dm_chucvu", "Mã chức vụ"], "Mã tiền lương 1": ["dm_luong", "Mã lương"], "Mã tiền lương 2": ["dm_luong", "Mã lương"], "Mã tăng ca": ["dm_tangca", "Mã tăng ca"], "Mã phụ cấp": ["dm_phucap", "Mã phụ cấp"], "Mã hỗ trợ": ["dm_hotro", "Mã hỗ trợ"], "Mã hỗ trợ 2": ["dm_hotro", "Mã hỗ trợ"], "Mã BHXH": ["dm_baohiem", "Mã bảo hiểm"], "Mã GT_TNCN_BT": ["dm_giamtru", "Mã giảm trừ"], "Mã GT_TNCN_PT": ["dm_giamtru", "Mã giảm trừ"], "Mã TNCN": null };
    if (col === "Mã TNCN") return ["TNCN0", "TNCN1", "TNCN2"];
    if (col === "Hình thức công") return ["BT", "CL", "PN", "CC", "TC", "TC1", "TC2", "TC3", "TC4", "TC5", "TC6", "DC", "TRCH"];
    var s = src[col]; if (!s) return null;
    var seen = {}, out = []; db[s[0]].forEach(function (r) { var v = r[s[1]]; if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
    return out;
  }
  var dlId = 0;
  function makeInput(col, value, onchange, opts) {
    var isDate = DATECOLS.test(col), inp = h("input", { value: value == null ? "" : value });
    if (isDate) inp.type = "date";
    if (NUMCOLS.test(col) && !isDate) inp.className = "num";
    var list = col === "Mã NV" ? "dsnv" : null, opts2 = list ? null : datalistFor(col);
    if (list) inp.setAttribute("list", "dsnv");
    else if (opts2 && opts2.length) { var id = "dl" + (++dlId), dl = h("datalist", { id: id }); opts2.forEach(function (o) { dl.appendChild(h("option", { value: o })); }); inp.setAttribute("list", id); inp._dl = dl; }
    inp.addEventListener("change", function () { onchange(inp.value.trim()); });
    return inp;
  }
  function refreshNVList() {
    var dl = $("#dsnv"); if (!dl) { dl = h("datalist", { id: "dsnv" }); document.body.appendChild(dl); }
    dl.innerHTML = ""; db.nhansu.forEach(function (r) { dl.appendChild(h("option", { value: r["Mã nhân viên"], label: r["Họ và tên"] || "" })); });
  }

  // ---------- Bảng nhập liệu ----------
  function grid(key, def) {
    var wrap = h("div"), card = h("div", { class: "card" }), bar = h("div", { class: "bar" }), body = h("div", { class: "tw" });
    var theoKy = !!(def.kyCol || def.dateCol), cnt = h("span", { class: "hint", style: "margin:0" });
    var q = h("input", { class: "i search", placeholder: "🔍 Tìm trong bảng...", value: st.q });
    q.addEventListener("input", function () { st.q = q.value; draw(); q.focus(); });
    var newRow = function () { var r = Object.assign({}, def.def || {}); if (def.kyCol) r[def.kyCol] = kyStr(); if (def.dateCol) r[def.dateCol] = kyStr() + "-01"; return r; };
    bar.appendChild(btn("＋ Thêm dòng", "pri", function () { db[key].push(newRow()); save(); st.q = ""; q.value = ""; draw(); var tw = body; tw.scrollTop = tw.scrollHeight; }));
    bar.appendChild(q); bar.appendChild(cnt); bar.appendChild(h("span", { class: "sp" }));
    bar.appendChild(btn("⬆ Nhập CSV", "", function () { importCsv(key, def, draw); }));
    bar.appendChild(btn("⬇ Excel", "", function () { var rows = db[key].filter(function (r) { return !theoKy || rowInKy(r, def); }); download(def.ten + (theoKy ? "_" + kyStr() : "") + ".xls", "application/vnd.ms-excel", xls(def.cols, rows)); }));
    card.appendChild(bar);
    card.appendChild(h("div", { class: "hint", text: (def.hint ? def.hint + " " : "") + "Mẹo: copy nhiều dòng từ Excel (đúng thứ tự cột) rồi Ctrl+V vào một ô để dán hàng loạt." }));
    card.appendChild(body); wrap.appendChild(card);
    var vis = def.cols.filter(function (c) { return (def.hide || []).indexOf(c) < 0; });

    function draw() {
      refreshNVList();
      body.innerHTML = "";
      var idx = [], qq = st.q.trim().toLowerCase();
      db[key].forEach(function (r, i) {
        if (theoKy && !rowInKy(r, def)) return;
        if (qq && def.cols.every(function (c) { return String(r[c] || "").toLowerCase().indexOf(qq) < 0; }) && String(tenNV(r["Mã NV"])).toLowerCase().indexOf(qq) < 0) return;
        idx.push(i);
      });
      cnt.textContent = idx.length + " dòng" + (theoKy ? " (kỳ " + st.thang + "/" + st.nam + ")" : "");
      if (!idx.length) { body.appendChild(h("div", { class: "empty", html: "Chưa có dữ liệu" + (theoKy ? " cho kỳ " + st.thang + "/" + st.nam : "") + ".<br>Bấm <b>＋ Thêm dòng</b> hoặc dán từ Excel." })); return; }
      var t = h("table"), trh = h("tr");
      trh.appendChild(h("th", { class: "stk", text: "#", style: "width:36px" }));
      vis.forEach(function (c) {
        var isDay = /^\d\d$/.test(c), cls = isDay ? "day" : (NUMCOLS.test(c) && !DATECOLS.test(c) ? "r" : "");
        if (isDay) { var dt = new Date(st.nam, st.thang - 1, +c); if (dt.getMonth() === st.thang - 1 && dt.getDay() === 0) cls += " we"; }
        var th = h("th", { class: cls, text: isDay ? String(+c) : c });
        if (COLW[c]) th.style.minWidth = COLW[c] + "px";
        trh.appendChild(th);
        if (c === "Mã NV" && def.showName) trh.appendChild(h("th", { text: "Họ tên", style: "min-width:150px" }));
      });
      if (def.total) trh.appendChild(h("th", { class: "r", text: "Tổng" }));
      trh.appendChild(h("th", { text: "" }));
      t.appendChild(h("thead", {}, [trh]));
      var tb = h("tbody");
      idx.forEach(function (ri, n) {
        var r = db[key][ri], tr = h("tr"), tot = h("td", { class: "r" });
        tr.appendChild(h("td", { class: "t stk", text: n + 1 }));
        var updTot = function () { var s = 0; DAYS.forEach(function (d) { s += E.tachCong(r[d]).soCong; }); tot.textContent = s ? fmt(Math.round(s * 100) / 100) : ""; };
        vis.forEach(function (c, ci) {
          var isDay = /^\d\d$/.test(c), cls = isDay ? "day" : "";
          if (isDay) { var dt = new Date(st.nam, st.thang - 1, +c); if (dt.getMonth() === st.thang - 1 && dt.getDay() === 0) cls += " we"; }
          var nameTd;
          var inp = makeInput(c, r[c], function (v) { r[c] = v; save(); if (c === "Mã NV" && nameTd) nameTd.textContent = tenNV(v) || (v ? "⚠ chưa có trong Nhân sự" : ""); if (isDay) updTot(); });
          inp.addEventListener("paste", function (ev) {
            var txt = (ev.clipboardData || window.clipboardData).getData("text");
            if (txt.indexOf("\t") < 0 && txt.indexOf("\n") < 0) return;
            ev.preventDefault();
            var lines = txt.replace(/\r/g, "").replace(/\n$/, "").split("\n"), start = def.cols.indexOf(c);
            lines.forEach(function (ln, li) {
              var tgt = idx[n + li];
              if (tgt == null) { db[key].push(newRow()); tgt = db[key].length - 1; idx.push(tgt); }
              ln.split("\t").forEach(function (v, k) { var col = def.cols[start + k]; if (col && col !== def.kyCol) db[key][tgt][col] = v.trim(); });
            });
            save(); draw(); toast("Đã dán " + lines.length + " dòng");
          });
          var td = h("td", { class: cls }, [inp]); if (inp._dl) td.appendChild(inp._dl);
          tr.appendChild(td);
          if (c === "Mã NV" && def.showName) { var nm = tenNV(r["Mã NV"]); nameTd = h("td", { class: "dis", text: nm || (r["Mã NV"] ? "⚠ chưa có trong Nhân sự" : "") }); tr.appendChild(nameTd); }
        });
        if (def.total) { updTot(); tr.appendChild(tot); }
        tr.appendChild(h("td", { style: "text-align:center" }, [btn("✕", "red ghost", function () { if (confirm("Xóa dòng này?")) { db[key].splice(ri, 1); save(); draw(); updateNav(); } }, "Xóa dòng")]));
        tb.appendChild(tr);
      });
      t.appendChild(tb); body.appendChild(t);
      updateNav();
    }
    draw();
    return wrap;
  }

  function importCsv(key, def, done) {
    var f = h("input", { type: "file", accept: ".csv,.txt,.tsv" });
    f.addEventListener("change", function () {
      var fr = new FileReader();
      fr.onload = function () {
        var lines = String(fr.result).replace(/^﻿/, "").replace(/\r/g, "").split("\n").filter(function (l) { return l.trim(); });
        if (!lines.length) return;
        var sep = lines[0].indexOf("\t") >= 0 ? "\t" : (lines[0].split(";").length > lines[0].split(",").length ? ";" : ",");
        var head = lines[0].split(sep).map(function (s) { return s.trim().replace(/^"|"$/g, ""); }), n = 0;
        lines.slice(1).forEach(function (ln) {
          var cells = ln.split(sep), r = {};
          head.forEach(function (c, i) { if (def.cols.indexOf(c) >= 0) r[c] = (cells[i] || "").trim().replace(/^"|"$/g, ""); });
          if (def.kyCol && !r[def.kyCol]) r[def.kyCol] = kyStr();
          if (Object.keys(r).length) { db[key].push(r); n++; }
        });
        save(); done(); toast("Đã nhập " + n + " dòng. (Dòng đầu file phải là tên cột)");
      };
      fr.readAsText(f.files[0], "utf-8");
    });
    f.click();
  }

  // ---------- Nhân sự (danh sách + form) ----------
  var NS_GROUPS = [
    ["Thông tin chung", ["Mã nhân viên", "Họ và tên", "Mã PB", "Mã CV", "Ngày vào làm", "Ngày nghỉ/thay đổi", "Số CCCD", "Số tài khoản", "Tên Ngân hàng"]],
    ["Lương & phụ cấp", ["Lương thỏa thuận", "Lương cơ bản", "Mã tiền lương 1", "Mã tiền lương 2", "Mã tăng ca", "Mã phụ cấp", "Mã hỗ trợ", "Mã hỗ trợ 2"]],
    ["Bảo hiểm & Thuế TNCN", ["Mã BHXH", "Mã TNCN", "Mã GT_TNCN_BT", "Mã GT_TNCN_PT", "Người phụ thuộc"]]
  ];
  var NS_HELP = { "Lương cơ bản": "Mức đóng BHXH (để trống = lấy lương thỏa thuận)", "Mã TNCN": "TNCN0 miễn / TNCN1 10% / TNCN2 lũy tiến", "Ngày nghỉ/thay đổi": "Điền để ngừng tính từ tháng sau" };
  function formNhanSu(row, isNew) {
    var data = Object.assign({}, row), body = h("div");
    var inputs = {};
    NS_GROUPS.forEach(function (g) {
      body.appendChild(h("div", { class: "fh", text: g[0] }));
      var grid = h("div", { class: "fgrid" });
      g[1].forEach(function (c) {
        var inp = makeInput(c, data[c], function (v) { data[c] = v; });
        inputs[c] = inp;
        var f = h("div", { class: "fld" }, [h("label", { text: c + (NS_HELP[c] ? " — " + NS_HELP[c] : "") }), inp]); if (inp._dl) f.appendChild(inp._dl);
        grid.appendChild(f);
      });
      body.appendChild(grid);
    });
    modal(isNew ? "Thêm nhân viên" : "Sửa: " + (row["Họ và tên"] || row["Mã nhân viên"]), body, function (close) {
      return [btn("Hủy", "", close), btn("💾 Lưu", "pri", function () {
        Object.keys(inputs).forEach(function (c) { data[c] = inputs[c].value.trim(); });
        if (!data["Mã nhân viên"] || !data["Họ và tên"]) { alert("Cần nhập Mã nhân viên và Họ và tên"); return; }
        var dup = db.nhansu.some(function (r) { return r !== row && r["Mã nhân viên"] === data["Mã nhân viên"]; });
        if (dup) { alert("Mã nhân viên này đã tồn tại"); return; }
        if (isNew) db.nhansu.push(data); else Object.keys(data).forEach(function (c) { row[c] = data[c]; });
        save(); close(); render(); toast("Đã lưu nhân viên");
      })];
    });
  }
  function tabNhanSu() {
    var wrap = h("div"), card = h("div", { class: "card" }), bar = h("div", { class: "bar" });
    var q = h("input", { class: "i search", placeholder: "🔍 Tìm theo mã hoặc tên...", value: st.q });
    q.addEventListener("input", function () { st.q = q.value; draw(); q.focus(); });
    bar.appendChild(btn("＋ Thêm nhân viên", "pri", function () { formNhanSu({}, true); }));
    bar.appendChild(q); bar.appendChild(h("span", { class: "sp" }));
    bar.appendChild(btn("⬆ Nhập CSV", "", function () { importCsv("nhansu", S.nhansu, draw); }));
    bar.appendChild(btn("⬇ Excel", "", function () { download("NhanSu.xls", "application/vnd.ms-excel", xls(S.nhansu.cols, db.nhansu)); }));
    card.appendChild(bar);
    card.appendChild(h("div", { class: "hint", text: "Bấm vào một dòng để sửa. Muốn nhập hàng loạt: dùng 'Nhập CSV' (dòng đầu là tên cột như file Excel cũ)." }));
    var tw = h("div", { class: "tw" }); card.appendChild(tw); wrap.appendChild(card);
    function draw() {
      tw.innerHTML = ""; var qq = st.q.trim().toLowerCase();
      var rows = db.nhansu.filter(function (r) { return !qq || (String(r["Mã nhân viên"]) + " " + String(r["Họ và tên"])).toLowerCase().indexOf(qq) >= 0; });
      if (!rows.length) { tw.appendChild(h("div", { class: "empty", html: db.nhansu.length ? "Không tìm thấy." : "Chưa có nhân viên nào.<br>Bấm <b>＋ Thêm nhân viên</b> để bắt đầu." })); return; }
      var cols = ["Mã nhân viên", "Họ và tên", "Mã PB", "Lương thỏa thuận", "Mã tiền lương 1", "Mã BHXH", "Mã TNCN", "Ngày nghỉ/thay đổi"];
      var t = h("table"), tr = h("tr"); cols.forEach(function (c) { tr.appendChild(h("th", { class: /Lương thỏa/.test(c) ? "r" : "", text: c })); }); tr.appendChild(h("th", { text: "" }));
      t.appendChild(h("thead", {}, [tr])); var tb = h("tbody");
      rows.forEach(function (r) {
        var x = h("tr", { class: "click", on: { click: function () { formNhanSu(r, false); } } });
        cols.forEach(function (c) { var v = r[c]; var nghi = c === "Ngày nghỉ/thay đổi" && v; x.appendChild(h("td", { class: /Lương thỏa/.test(c) ? "r" : "t", text: /Lương thỏa/.test(c) ? fmt(E.num(v)) : (v || ""), style: nghi ? "color:#c0362c" : "" })); });
        x.appendChild(h("td", { style: "text-align:center" }, [btn("✕", "red ghost", function (ev) { ev.stopPropagation(); if (confirm("Xóa nhân viên " + (r["Họ và tên"] || r["Mã nhân viên"]) + "?")) { db.nhansu.splice(db.nhansu.indexOf(r), 1); save(); draw(); updateNav(); } }, "Xóa")]));
        tb.appendChild(x);
      });
      t.appendChild(tb); tw.appendChild(t);
    }
    draw(); return wrap;
  }

  // ---------- Danh mục ----------
  function tabDanhMuc() {
    var w = h("div"), bar = h("div", { class: "bar" });
    Object.keys(DM).forEach(function (k) { bar.appendChild(btn(DM[k].ten + (countOf(k) ? " (" + countOf(k) + ")" : ""), st.dm === k ? "pri" : "", function () { st.dm = k; saveUi(); render(); })); });
    w.appendChild(bar); w.appendChild(grid(st.dm, DM[st.dm])); return w;
  }

  // ---------- Tính lương ----------
  var COLS_FULL = ["Mã NV", "Họ và tên", "Phòng ban", "Công chuẩn", "Tổng công", "Lương thời gian", "Lương phụ", "Sản lượng (tấn)", "Lương sản lượng", "Lương bù SL", "Lương bơm dăm", "Tiền tăng ca", "Phụ cấp", "Phụ cấp công tác", "Lương hỗ trợ", "Tiền cơm", "Thưởng", "Thu nhập khác", "Tổng thu nhập", "BH trừ NLĐ", "Truy thu BH", "Thuế TNCN", "Trừ khác", "Tạm ứng", "Thực lĩnh"];
  var COLS_COMPACT = ["Mã NV", "Họ và tên", "Phòng ban", "Tổng công", "Tổng thu nhập", "BH trừ NLĐ", "Thuế TNCN", "Tạm ứng", "Trừ khác", "Thực lĩnh"];
  var TEXTCOLS = { "Mã NV": 1, "Họ và tên": 1, "Phòng ban": 1 };

  function tabLuong() {
    var box = h("div");
    var card = h("div", { class: "card" }), bar = h("div", { class: "bar" });
    var sel = h("select"); [["false", "Bù sản lượng theo THÁNG"], ["true", "Bù sản lượng theo NGÀY (kiểu Đại Hiệp)"]].forEach(function (o) { sel.appendChild(h("option", { value: o[0], text: o[1] })); });
    sel.value = String(st.bu); sel.addEventListener("change", function () { st.bu = sel.value === "true"; saveUi(); });
    bar.appendChild(btn("▶ Tính lương tháng " + st.thang + "/" + st.nam, "pri big", function () {
      if (!db.nhansu.length) { alert("Chưa có nhân viên. Hãy nhập ở mục Nhân sự trước."); return; }
      st.kq = E.tinhBangLuong(db, st.nam, st.thang, st.bu); st.kq.ky = kyStr(); render(); toast("Đã tính xong " + st.kq.bangluong.length + " nhân viên");
    }));
    bar.appendChild(sel); card.appendChild(bar);
    if (!st.kq) {
      card.appendChild(h("div", { class: "hint", text: "Kiểm tra dữ liệu kỳ " + st.thang + "/" + st.nam + " rồi bấm nút xanh. Có thể tính lại bất cứ lúc nào." }));
      var cc = db.chamcong.filter(function (r) { return r["Kỳ"] === kyStr(); }).length;
      card.appendChild(h("div", { class: cc ? "ok" : "warn", html: "Chấm công kỳ này: <b>" + cc + "</b> dòng · Nhân sự: <b>" + db.nhansu.length + "</b> người" + (cc ? "" : " — <b>chưa có dữ liệu chấm công kỳ này</b>.") }));
      box.appendChild(card); return box;
    }
    var r = st.kq, sum = function (c) { return r.bangluong.reduce(function (a, x) { return a + (+x[c] || 0); }, 0); };
    box.appendChild(h("div", { class: "kpis" }, [
      h("div", { class: "kpi", html: "<small>Số nhân viên</small><b>" + r.bangluong.length + "</b>" }),
      h("div", { class: "kpi", html: "<small>Tổng thu nhập</small><b>" + fmt(sum("Tổng thu nhập")) + "</b>" }),
      h("div", { class: "kpi", html: "<small>Khấu trừ (BH + thuế)</small><b>" + fmt(sum("BH trừ NLĐ") + sum("Thuế TNCN") + sum("Truy thu BH")) + "</b>" }),
      h("div", { class: "kpi main", html: "<small>Tổng thực lĩnh</small><b>" + fmt(sum("Thực lĩnh")) + "</b>" })]));
    if (r.canhbao.length) card.appendChild(h("div", { class: "warn", html: "<b>⚠ Cần kiểm tra dữ liệu:</b><br>" + r.canhbao.map(esc).join("<br>") }));
    var noC = r.bangluong.filter(function (x) { return !x["Tổng công"]; });
    if (noC.length) card.appendChild(h("div", { class: "warn", html: "<b>⚠ " + noC.length + " nhân viên chưa có công trong kỳ:</b> " + noC.slice(0, 12).map(function (x) { return esc(x["Họ và tên"]); }).join(", ") + (noC.length > 12 ? "…" : "") }));
    var cols = st.compact ? COLS_COMPACT : COLS_FULL;
    bar.appendChild(h("span", { class: "sp" }));
    bar.appendChild(btn(st.compact ? "Xem đủ cột" : "Xem gọn", "", function () { st.compact = !st.compact; saveUi(); render(); }));
    bar.appendChild(btn("🖨 In phiếu lương", "", function () { st.tab = "slips"; render(); }));
    var mn = h("select", { style: "min-width:150px" }); mn.appendChild(h("option", { text: "⬇ Xuất Excel…" }));
    [["Bảng lương", "bl"], ["BHXH", "bh"], ["Thuế TNCN", "tn"]].forEach(function (o) { mn.appendChild(h("option", { value: o[1], text: o[0] })); });
    mn.addEventListener("change", function () {
      var m = { bl: [COLS_FULL, r.bangluong, "BangLuong"], bh: [r.bhxh[0] ? Object.keys(r.bhxh[0]) : [], r.bhxh, "BHXH"], tn: [r.tncn[0] ? Object.keys(r.tncn[0]) : [], r.tncn, "ThueTNCN"] }[mn.value];
      if (m) download(m[2] + "_" + r.ky + ".xls", "application/vnd.ms-excel", xls(m[0], m[1])); mn.selectedIndex = 0;
    });
    bar.appendChild(mn);
    card.appendChild(h("div", { class: "hint", text: "Bấm vào một dòng để xem chi tiết cách tính và in phiếu lương của người đó." }));
    var tw = h("div", { class: "tw" }), t = h("table"), tr = h("tr");
    cols.forEach(function (c, i) { tr.appendChild(h("th", { class: (TEXTCOLS[c] ? "" : "r") + (i === 0 ? " stk" : ""), text: c })); });
    t.appendChild(h("thead", {}, [tr])); var tb = h("tbody");
    r.bangluong.forEach(function (row) {
      var x = h("tr", { class: "click", on: { click: function () { slipDialog(row); } } });
      cols.forEach(function (c, i) {
        var v = row[c], cl = (TEXTCOLS[c] ? "t" : "r") + (i === 0 ? " stk" : "");
        if (!TEXTCOLS[c] && !v) { x.appendChild(h("td", { class: cl + " z", text: "–" })); return; }
        x.appendChild(h("td", { class: cl + (c === "Thực lĩnh" ? "" : ""), style: c === "Thực lĩnh" ? "font-weight:700" : "", text: fmt(v) }));
      });
      tb.appendChild(x);
    });
    t.appendChild(tb);
    var tf = h("tr"); cols.forEach(function (c, i) { tf.appendChild(h("td", { text: i === 0 ? "TỔNG" : (TEXTCOLS[c] || c === "Công chuẩn" ? "" : fmt(Math.round(sum(c) * 1000) / 1000)), style: i === 0 ? "text-align:left;left:0" : "" })); });
    t.appendChild(h("tfoot", {}, [tf])); tw.appendChild(t); card.appendChild(tw); box.appendChild(card);
    return box;
  }

  var SLIP_LINES = [["Lương thời gian", "Lương thời gian"], ["Lương phụ", "Lương phụ"], ["Lương sản lượng", "Lương sản lượng"], ["Lương bù SL", "Lương bù sản lượng"], ["Lương bơm dăm", "Lương bơm dăm"], ["Tiền tăng ca", "Tiền tăng ca"], ["Phụ cấp", "Phụ cấp"], ["Phụ cấp công tác", "Phụ cấp công tác"], ["Lương hỗ trợ", "Lương hỗ trợ"], ["Tiền cơm", "Tiền cơm"], ["Thưởng", "Thưởng"], ["Thu nhập khác", "Thu nhập khác"], ["Tổng thu nhập", "TỔNG THU NHẬP", 1], ["BH trừ NLĐ", "− BHXH/BHYT/BHTN"], ["Truy thu BH", "− Truy thu bảo hiểm"], ["Thuế TNCN", "− Thuế TNCN"], ["Trừ khác", "− Trừ khác"], ["Tạm ứng", "− Tạm ứng"], ["Thực lĩnh", "THỰC LĨNH", 1]];
  function slipEl(b) {
    var s = h("div", { class: "slip" });
    s.appendChild(h("h3", { text: "PHIẾU LƯƠNG THÁNG " + st.thang + "/" + st.nam, style: "text-align:center;margin:4px 0 10px" }));
    s.appendChild(h("div", { class: "head", html: "<b>" + esc(b["Họ và tên"]) + "</b> · Mã NV: " + esc(b["Mã NV"]) + (b["Phòng ban"] ? " · " + esc(b["Phòng ban"]) : "") + "<br><span style='color:#6c7a74'>Tổng công: " + b["Tổng công"] + " / Công chuẩn: " + b["Công chuẩn"] + (b["Sản lượng (tấn)"] ? " · Sản lượng: " + b["Sản lượng (tấn)"] + " tấn" : "") + "</span>" }));
    var t = h("table");
    SLIP_LINES.forEach(function (l) { if (b[l[0]] || l[2]) t.appendChild(h("tr", { class: l[2] ? "tot" : "", html: "<td>" + l[1] + "</td><td>" + fmt(b[l[0]]) + "</td>" })); });
    s.appendChild(t); return s;
  }
  function slipDialog(b) {
    modal("Chi tiết lương — " + b["Họ và tên"], slipEl(b), function (close) {
      return [btn("Đóng", "", close), btn("🖨 In phiếu này", "pri", function () { var one = st.kq; st.kq = { bangluong: [b], ky: one.ky, bhxh: [], tncn: [], canhbao: [] }; var back = st.tab; st.tab = "slips"; st.kqFull = one; close(); render(); })];
    });
  }
  function tabSlips() {
    var w = h("div"), bar = h("div", { class: "bar" });
    bar.appendChild(btn("← Quay lại bảng lương", "", function () { if (st.kqFull) { st.kq = st.kqFull; st.kqFull = null; } st.tab = "luong"; render(); }));
    bar.appendChild(btn("🖨 In", "pri", function () { window.print(); }));
    bar.appendChild(h("span", { class: "hint", style: "margin:0", text: (st.kq ? st.kq.bangluong.length : 0) + " phiếu — mỗi người 1 trang" }));
    w.appendChild(bar);
    (st.kq ? st.kq.bangluong : []).forEach(function (b) { var c = h("div", { class: "card" }); c.appendChild(slipEl(b)); w.appendChild(c); });
    return w;
  }

  // ---------- Trang chủ ----------
  function tabHome() {
    var w = h("div"), card = h("div", { class: "card" });
    card.appendChild(h("h3", { text: "Bắt đầu nhanh" }));
    card.appendChild(h("div", { class: "hint", text: "Làm lần lượt từ trên xuống. Chỉ cần làm 1 lần phần danh mục, các tháng sau chỉ nhập chấm công, sản lượng rồi bấm tính lương." }));
    var steps = [
      ["backup", "Nạp danh mục mẫu", "Bảo hiểm, biểu thuế, giảm trừ, mã lương cơ bản", countOf("dm_baohiem") > 0],
      ["dm", "Kiểm tra Danh mục", "Mã lương, phụ cấp, tăng ca, hỗ trợ, phòng ban", countOf("dm_luong") > 0],
      ["nhansu", "Nhập Nhân sự", countOf("nhansu") + " người", countOf("nhansu") > 0],
      ["chamcong", "Nhập Chấm công tháng " + st.thang, "Dán từ Excel hoặc nhập tay", db.chamcong.some(function (r) { return r["Kỳ"] === kyStr(); })],
      ["sanluong", "Nhập Sản lượng / Bơm dăm / Thưởng / Tạm ứng", "Nếu có phát sinh trong tháng", db.sanluong.length + db.bandam.length + db.psluong.length + db.ungluong.length > 0],
      ["luong", "Tính lương & xuất Excel / in phiếu", "Bấm nút Tính lương", !!st.kq]
    ];
    var g = h("div", { class: "steps" });
    steps.forEach(function (s, i) { g.appendChild(h("div", { class: "step" + (s[3] ? " done" : ""), on: { click: function () { st.tab = s[0]; saveUi(); render(); } } }, [h("div", { class: "no", text: s[3] ? "✓" : i + 1 }), h("div", { html: "<b>" + s[1] + "</b><small>" + s[2] + "</small>" })])); });
    card.appendChild(g); w.appendChild(card);
    w.appendChild(h("div", { class: "warn", html: "<b>Nhớ sao lưu:</b> dữ liệu nằm trên máy này. Cuối mỗi kỳ lương hãy vào <b>Sao lưu</b> → <b>Sao lưu ra file</b> và cất file ở nơi an toàn (USB, Google Drive...)." }));
    return w;
  }

  // ---------- Sao lưu ----------
  function tabSaoLuu() {
    var c = h("div", { class: "card" });
    c.appendChild(h("h3", { text: "Sao lưu & khôi phục" }));
    c.appendChild(h("div", { class: "warn", text: "Dữ liệu được lưu ngay trên máy này. Hãy sao lưu ra file sau mỗi kỳ lương và trước khi cài lại Windows / đổi máy." }));
    var bar = h("div", { class: "bar" });
    bar.appendChild(btn("⬇ Sao lưu ra file", "pri", function () { download("LuongHAK_backup_" + new Date().toISOString().slice(0, 10) + ".json", "application/json", JSON.stringify(db)); }));
    bar.appendChild(btn("⬆ Khôi phục từ file", "", function () {
      var f = h("input", { type: "file", accept: ".json" });
      f.addEventListener("change", function () { var fr = new FileReader(); fr.onload = function () { try { var o = JSON.parse(fr.result); if (!confirm("Ghi đè TOÀN BỘ dữ liệu hiện tại bằng file này?")) return; db = o; Object.keys(ALL).forEach(function (k) { if (!db[k]) db[k] = []; }); save(); toast("Đã khôi phục"); render(); } catch (e) { alert("File không hợp lệ"); } }; fr.readAsText(f.files[0]); });
      f.click();
    }));
    bar.appendChild(btn("📋 Nạp danh mục mẫu", "", napMau));
    bar.appendChild(h("span", { class: "sp" }));
    bar.appendChild(btn("🗑 Xóa toàn bộ dữ liệu", "red", function () { if (confirm("XÓA TOÀN BỘ dữ liệu? Không thể hoàn tác!") && confirm("Chắc chắn chứ?")) { db = {}; Object.keys(ALL).forEach(function (k) { db[k] = []; }); save(); st.kq = null; render(); } }));
    c.appendChild(bar);
    c.appendChild(h("div", { class: "hint", text: "Hiện có — " + Object.keys(ALL).map(function (k) { return ALL[k].ten + ": " + countOf(k); }).join(" · ") }));
    return c;
  }
  function napMau() {
    var n = 0, set = function (k, rows) { if (!db[k].length) { db[k] = rows; n++; } };
    set("dm_baohiem", [{ "Hiệu lực từ": "2024-01-01", "Mã bảo hiểm": "BH01", "Nội dung": "BHXH bắt buộc", "DN.BHXH": "0.175", "DN.BHYT": "0.03", "DN.BHTN": "0.01", "DN.KPCD": "0.02", "NLD.BHXH": "0.08", "NLD.BHYT": "0.015", "NLD.BHTN": "0.01", "NLD.KPCD": "0" }]);
    set("dm_tncn", [[1, 0.05, 0, 5e6], [2, 0.1, 5e6, 10e6], [3, 0.15, 10e6, 18e6], [4, 0.2, 18e6, 32e6], [5, 0.25, 32e6, 52e6], [6, 0.3, 52e6, 80e6], [7, 0.35, 80e6, ""]].map(function (x) { return { "Hiệu lực từ": "2020-01-01", "Bậc": x[0], "Tỷ lệ đóng thuế": x[1], "Thu nhập tháng (Min)": x[2], "Thu nhập tháng (Max)": x[3] }; }));
    set("dm_giamtru", [{ "Hiệu lực từ": "2020-07-01", "Mã giảm trừ": "BT", "Số người": 1, "Số tiền": 11000000 }, { "Hiệu lực từ": "2020-07-01", "Mã giảm trừ": "PT", "Số người": 1, "Số tiền": 4400000 }, { "Hiệu lực từ": "2026-01-01", "Mã giảm trừ": "BT", "Số người": 1, "Số tiền": 15500000 }, { "Hiệu lực từ": "2026-01-01", "Mã giảm trừ": "PT", "Số người": 1, "Số tiền": 6200000 }]);
    set("dm_luong", [{ "Hiệu lực từ": "2020-01-01", "Mã lương": "TG1", "Mã hình thức lương": "TG", "Hình thức lương": "Lương thời gian", "Cách tính": "Số ngày của tháng - tất cả ngày CN" }, { "Hiệu lực từ": "2020-01-01", "Mã lương": "CĐ", "Mã hình thức lương": "CD", "Hình thức lương": "Lương cố định", "Cách tính": "Cố định" }]);
    save(); render(); toast(n ? "Đã nạp danh mục mẫu — kế toán cần kiểm tra lại tỷ lệ BH, biểu thuế, giảm trừ theo quy định hiện hành" : "Các danh mục đã có dữ liệu, không ghi đè");
  }

  // ---------- Khung & điều hướng ----------
  var NAV = [
    ["home", "🏠", "Trang chủ"], ["luong", "▶", "Tính lương"],
    ["grp", "Nhập liệu hàng tháng"],
    ["chamcong", "🗓", "Chấm công"], ["sanluong", "⚖", "Sản lượng"], ["bandam", "🚛", "Bơm dăm"], ["psluong", "🎁", "Thưởng / Trừ"], ["ungluong", "💵", "Tạm ứng"], ["tiencom", "🍚", "Suất cơm"],
    ["grp", "Dữ liệu gốc"],
    ["nhansu", "👥", "Nhân sự"], ["dm", "📚", "Danh mục"],
    ["grp", "Hệ thống"],
    ["backup", "💾", "Sao lưu"]
  ];
  var TITLES = { home: "Trang chủ", luong: "Tính lương", slips: "Phiếu lương", dm: "Danh mục", backup: "Sao lưu & khôi phục" };
  function updateNav() { document.querySelectorAll("#nav button[data-k]").forEach(function (b) { var k = b.getAttribute("data-k"), n = $(".n", b); if (n && ALL[k]) n.textContent = countOf(k); }); }
  function periodBox() {
    var m = h("select"), y = h("input", { class: "i", type: "number", style: "width:80px", value: st.nam });
    for (var i = 1; i <= 12; i++) m.appendChild(h("option", { value: i, text: "Tháng " + i }));
    m.value = st.thang;
    var ch = function () { st.thang = +m.value; st.nam = +y.value || st.nam; st.kq = null; st.q = ""; saveUi(); render(); };
    m.addEventListener("change", ch); y.addEventListener("change", ch);
    return h("div", { class: "period" }, [h("label", { text: "Kỳ lương" }), m, y]);
  }
  function render() {
    var nav = $("#nav"); nav.innerHTML = "";
    var activeNav = st.tab === "slips" ? "luong" : st.tab;
    NAV.forEach(function (n) {
      if (n[0] === "grp") { nav.appendChild(h("div", { class: "grp", text: n[1] })); return; }
      var b = h("button", { class: activeNav === n[0] ? "on" : "", "data-k": n[0], on: { click: function () { if (st.tab !== n[0]) st.q = ""; st.tab = n[0]; saveUi(); render(); } } }, [h("span", { class: "ic", text: n[1] }), h("span", { text: n[2] })]);
      if (ALL[n[0]] && n[0] !== "dm") b.appendChild(h("span", { class: "n", text: countOf(n[0]) }));
      nav.appendChild(b);
    });
    $("#sidefoot").textContent = "v1.0 · Dữ liệu lưu trên máy này";
    var top = $("#top"); top.innerHTML = "";
    var title = TITLES[st.tab] || (S[st.tab] && S[st.tab].ten) || "";
    top.appendChild(h("h2", { text: title }));
    if (st.tab !== "nhansu" && st.tab !== "dm" && st.tab !== "backup" && st.tab !== "home" || st.tab === "home") top.appendChild(periodBox());
    var m = $("#main"); m.innerHTML = ""; refreshNVList();
    if (st.tab === "home") m.appendChild(tabHome());
    else if (st.tab === "luong") m.appendChild(tabLuong());
    else if (st.tab === "slips") m.appendChild(tabSlips());
    else if (st.tab === "backup") m.appendChild(tabSaoLuu());
    else if (st.tab === "dm") m.appendChild(tabDanhMuc());
    else if (st.tab === "nhansu") m.appendChild(tabNhanSu());
    else if (S[st.tab]) m.appendChild(grid(st.tab, S[st.tab]));
    else { st.tab = "home"; render(); }
  }
  render();
})();
