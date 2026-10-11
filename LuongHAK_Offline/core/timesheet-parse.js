// ===== CORE / TIMESHEET-PARSE — dựng bảng chấm công / chấm cơm từ các ô đã OCR (2.0-α20) =====
// Nhận 2 kiểu bảng giấy hay gặp:
//   A. Mỗi dòng 1 người (hoặc 1 người × Công / Tăng ca), cột = ngày 1…31, cuối dòng có "Tổng công", "Tổng cơm"…
//   B. Mỗi dòng 1 ngày ("Lịch làm …"), cột = CÔNG, CƠM, TĂNG CA…, dòng cuối "TC" / "Tổng".
// Chỉ dựng bảng XEM TRƯỚC — người dùng sửa / xác nhận trước khi ghi vào Chấm công / Suất cơm.
(function (root) {
  "use strict";
  function fold(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9.,/ ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }

  /** Liên kết ô bên phải / bên dưới (khớp cạnh, chồng ≥ 50% theo chiều còn lại) */
  function link(cells) {
    var hs = cells.map(function (c) { return c.y1 - c.y0; }).sort(function (a, b) { return a - b; }), ws = cells.map(function (c) { return c.x1 - c.x0; }).sort(function (a, b) { return a - b; });
    var tolX = Math.max(6, (ws[Math.floor(ws.length / 2)] || 10) * 0.6), tolY = Math.max(6, (hs[Math.floor(hs.length / 2)] || 10) * 0.6);
    cells.forEach(function (c, i) { c.id = c.id == null ? i : c.id; c.right = null; c.down = null; c.left = null; c.up = null; });
    cells.forEach(function (c) {
      var bestR = null, bR = 0, bestD = null, bD = 0;
      cells.forEach(function (d) {
        if (d === c) return;
        if (Math.abs(d.x0 - c.x1) <= tolX && d.cx > c.cx) { var ov = overlap(c.y0, c.y1, d.y0, d.y1) / Math.min(c.y1 - c.y0, d.y1 - d.y0); if (ov >= 0.5 && ov > bR) { bR = ov; bestR = d; } }
        if (Math.abs(d.y0 - c.y1) <= tolY && d.cy > c.cy) { var ov2 = overlap(c.x0, c.x1, d.x0, d.x1) / Math.min(c.x1 - c.x0, d.x1 - d.x0); if (ov2 >= 0.5 && ov2 > bD) { bD = ov2; bestD = d; } }
      });
      c.right = bestR; c.down = bestD;
    });
    cells.forEach(function (c) { if (c.right && !c.right.left) c.right.left = c; if (c.down && !c.down.up) c.down.up = c; });
  }
  function chain(c, dir) { var out = [], seen = {}; while (c && !seen[c.id]) { seen[c.id] = 1; out.push(c); c = c[dir]; } return out; }
  function isInt(v) { return typeof v === "number" && isFinite(v) && Math.floor(v) === v; }
  /** Dãy ngày 1…N trong 1 chuỗi ô: offset sao cho (giá trị − vị trí) trùng nhiều nhất */
  function daySeq(ch) {
    var cnt = {};
    ch.forEach(function (c, i) { if (isInt(c.num) && c.num >= 1 && c.num <= 31) { var k = c.num - i; cnt[k] = (cnt[k] || 0) + 1; } });
    var best = null, bn = 0; Object.keys(cnt).forEach(function (k) { if (cnt[k] > bn) { bn = cnt[k]; best = +k; } });
    if (best == null) return null;
    var days = ch.map(function (c, i) { var d = i + best; return d >= 1 && d <= 31 ? d : null; });
    // ô có chữ (VD "Tổng công") không phải ngày
    days = days.map(function (d, i) { return d && /[a-z]{2,}/.test(fold(ch[i].text)) ? null : d; });
    return { offset: best, hits: bn, days: days };
  }
  function cellAt(col, y0, y1) {
    var best = null, bo = 0;
    col.forEach(function (c) { var o = overlap(c.y0, c.y1, y0, y1) / Math.max(1, y1 - y0); if (o > bo) { bo = o; best = c; } });
    return bo >= 0.3 ? best : null;
  }
  function cellAtX(row, x0, x1) {
    var best = null, bo = 0;
    row.forEach(function (c) { var o = overlap(c.x0, c.x1, x0, x1) / Math.max(1, x1 - x0); if (o > bo) { bo = o; best = c; } });
    return bo >= 0.3 ? best : null;
  }
  /** Loại dòng theo nhãn: Công / Tăng ca / Cơm */
  function kindOf(t) {
    var f = fold(t);
    if (!f) return "";
    if (/^(tang ca|tangca|t ca|tc)\b/.test(f) || /tang ca/.test(f)) return "Tăng ca";
    if (/com\b|^com/.test(f) && !/cong/.test(f)) return "Cơm";
    if (/cong/.test(f)) return "Công";
    return "";
  }
  function valOf(c) { if (!c) return { v: null, c: null }; return { v: c.num, c: c, conf: c.conf }; }

  /** Kiểu A — dòng = người, cột = ngày */
  function parseA(cells, hdr) {
    var hRow = hdr.chain, seq = hdr.seq, dayCols = [], lastDayX = 0;
    hRow.forEach(function (c, i) { var d = seq.days[i]; if (d && (c.x1 - c.x0) < 3 * hdr.medW) { dayCols.push({ day: d, head: c, col: chain(c, "down").slice(1) }); lastDayX = Math.max(lastDayX, c.x1); } });
    if (!dayCols.length) return null;
    // ô tiêu đề (dòng tiêu đề + dòng ngay trên: ô gộp "HỌ VÀ TÊN" cao 2 dòng)
    var heads = cells.filter(function (c) { return c.y1 <= hRow[0].y1 + hdr.medH * 0.5 && c.y1 >= hRow[0].y0 - hdr.medH * 3; });
    var nameHead = heads.filter(function (c) { return /\bten\b|ho va ten|ho ten/.test(fold(c.text)); }).sort(function (a, b) { return (b.x1 - b.x0) - (a.x1 - a.x0); })[0];
    var totals = heads.filter(function (c) { return c.x0 >= lastDayX - 2 && /tong|com|cong|tc/.test(fold(c.text)); }).map(function (c) { return { label: totalLabel(c.text), head: c }; });
    var bottom = function (c) { return chain(c, "down").slice(1); };
    var nameCol = nameHead ? bottom(nameHead) : null;
    if (!nameCol || !nameCol.length) { // không đọc được "HỌ VÀ TÊN": lấy cột ô rộng nhất bên trái ngày đầu
      var cand = cells.filter(function (c) { return c.y0 >= hRow[0].y1 - 2 && c.x1 <= dayCols[0].head.x0 + 2 && (c.x1 - c.x0) > 2 * hdr.medW; });
      nameCol = cand;
    }
    totals.forEach(function (t) { t.col = bottom(t.head); });
    var typeCol = null;
    cells.forEach(function (c) { if (c.y0 < hRow[0].y1 || c.x1 > dayCols[0].head.x0 + 2) return; if (kindOf(c.text)) { typeCol = typeCol || []; typeCol.push(c); } });
    // dòng tham chiếu = cột ngày có nhiều ô nhất
    var ref = dayCols.slice().sort(function (a, b) { return b.col.length - a.col.length; })[0].col, lines = [], footer = null;
    ref.forEach(function (R) {
      var nm = nameCol ? cellAt(nameCol, R.y0, R.y1) : null, ty = typeCol ? cellAt(typeCol, R.y0, R.y1) : null;
      var line = { name: nm ? String(nm.text || "").trim() : "", nameCell: nm, kind: ty ? kindOf(ty.text) : "", values: {}, cells: {}, totals: {}, y0: R.y0, y1: R.y1 };
      dayCols.forEach(function (dc) { var c = cellAt(dc.col, R.y0, R.y1); if (c) { line.values[dc.day] = c.num; line.cells[dc.day] = c; } });
      totals.forEach(function (t) { var c = cellAt(t.col, R.y0, R.y1); if (c) { line.totals[t.label] = c.num; line.cells["T:" + t.label] = c; } });
      var anyV = Object.keys(line.values).some(function (d) { return line.values[d] != null; });
      if (/tong cong|^tong$|cong cong/.test(fold(line.name))) { footer = line; return; }
      if (!line.name && !anyV && !Object.keys(line.totals).some(function (k) { return line.totals[k] != null; })) return;
      if (!line.name && anyV && Object.keys(line.values).every(function (d) { return line.values[d] == null || line.values[d] === 0; }) && lines.length) { footer = line; return; } // dòng cộng cột (0 0 0 …)
      lines.push(line);
    });
    // dòng thứ 2 của người có ô tên gộp (Công / Tăng ca) dùng chung tên
    lines.forEach(function (l, i) { if (!l.name && i && l.nameCell == null && lines[i - 1].name) l.name = lines[i - 1].name; });
    return { layout: "A", days: dayCols.map(function (d) { return d.day; }), lines: lines, footer: footer, totalsLabels: totals.map(function (t) { return t.label; }) };
  }
  /** Nhãn cột tổng chuẩn hóa (OCR hay đọc "Tông ông công") */
  function totalLabel(t) {
    var f = fold(t); if (/tong/.test(f) && /cong/.test(f)) return "Tổng công"; if (/tong/.test(f) && /com/.test(f)) return "Tổng cơm";
    return String(t || "").replace(/\s+/g, " ").trim();
  }
  /** Kiểu B — dòng = ngày, cột = Công / Cơm … */
  function parseB(cells, hdr) {
    var dayChain = hdr.chain, seq = hdr.seq, rows = [];
    dayChain.forEach(function (c, i) { if (seq.days[i]) rows.push({ day: seq.days[i], cell: c }); });
    // dòng cuối "TC" / "Tổng" bị coi nhầm là ngày: số ngày đọc không khớp + giá trị trong dòng > 3,5 (không thể là công 1 ngày)
    var popped = null;
    while (rows.length > 1) {
      var lr = rows[rows.length - 1], rc = chain(lr.cell, "right").slice(1);
      var big = rc.some(function (x) { return typeof x.num === "number" && x.num > 3.5; });
      if (lr.cell.num !== lr.day && big) popped = rows.pop(); else break;
    }
    if (!rows.length) return null;
    var first = rows[0].cell, headCell = first.up, last = rows[rows.length - 1].cell, foot = popped ? popped.cell : last.down;
    var headRow = headCell ? chain(headCell, "right") : [], fields = [];
    headRow.slice(1).forEach(function (h) { fields.push({ label: String(h.text || "").trim() || "Cột " + (fields.length + 1), head: h, col: chain(h, "down").slice(1) }); });
    if (!fields.length) { // không có dòng tiêu đề → các cột bên phải cột ngày
      var r1 = chain(first, "right").slice(1); r1.forEach(function (c, j) { fields.push({ label: "Cột " + (j + 1), head: null, col: chain(c, "down") }); });
    }
    var footLabel = foot && /[A-Za-zÀ-ỹ]/.test(String(foot.text || "")) ? String(foot.text).replace(/\s+/g, " ").trim() : "TC"; // ô nhãn "TC" đọc nhầm thành số → vẫn là dòng tổng
    var lines = fields.map(function (f) {
      var line = { name: "", kind: kindOf(f.label) || f.label, label: f.label, values: {}, cells: {}, totals: {} };
      rows.forEach(function (r) { var c = cellAt(f.col, r.cell.y0, r.cell.y1); if (c) { line.values[r.day] = c.num; line.cells[r.day] = c; } });
      if (foot) { var fc = cellAt(f.col, foot.y0, foot.y1); if (fc) { line.totals[footLabel] = fc.num; line.cells["T:TC"] = fc; } }
      return line;
    });
    return { layout: "B", days: rows.map(function (r) { return r.day; }), lines: lines, footer: null, totalsLabels: foot ? [footLabel] : [] };
  }
  /**
   * cells: [{ x0,y0,x1,y1,cx,cy, text, conf, num }] (num = số đọc được trong ô / null trống / NaN không đọc được)
   * Trả { layout, days, lines: [{ name, kind, values: {ngày: số}, totals: {nhãn: số}, check: [...] }], warnings }
   */
  function parse(cells, opt) {
    opt = opt || {};
    if (!cells || !cells.length) return { layout: null, days: [], lines: [], warnings: ["Không tìm thấy bảng (đường kẻ ô) trong ảnh"] };
    link(cells);
    var ws = cells.map(function (c) { return c.x1 - c.x0; }).sort(function (a, b) { return a - b; }), hs = cells.map(function (c) { return c.y1 - c.y0; }).sort(function (a, b) { return a - b; });
    var medW = ws[Math.floor(ws.length / 2)], medH = hs[Math.floor(hs.length / 2)];
    var best = null;
    cells.forEach(function (c) {
      if (!c.left) { var ch = chain(c, "right"), s = daySeq(ch); if (s && (!best || s.hits > best.seq.hits)) best = { dir: "A", chain: ch, seq: s }; }
      if (!c.up) { var cv = chain(c, "down"), s2 = daySeq(cv); if (s2 && (!best || s2.hits > best.seq.hits)) best = { dir: "B", chain: cv, seq: s2 }; }
    });
    if (!best || best.seq.hits < (opt.minDays || 10)) {
      // Dự phòng: không đọc được số ngày in ở tiêu đề (ảnh nhỏ / mờ) → dòng trên cùng có 28–31 ô hẹp liền nhau = ngày 1…N theo vị trí
      var pos = null;
      cells.forEach(function (c) {
        if (c.left) return;
        var ch = chain(c, "right"), run = [], bestRun = [];
        ch.forEach(function (x) { var wd = x.x1 - x.x0; if (wd <= medW * 1.6 && wd >= medW * 0.5) run.push(x); else { if (run.length > bestRun.length) bestRun = run; run = []; } });
        if (run.length > bestRun.length) bestRun = run;
        if (bestRun.length >= 28 && bestRun.length <= 33 && (!pos || bestRun[0].cy < pos.run[0].cy)) pos = { chain: ch, run: bestRun };
      });
      if (pos) {
        var start = pos.chain.indexOf(pos.run[0]), n = Math.min(31, pos.run.length);
        best = { dir: "A", chain: pos.chain, seq: { offset: 1 - start, hits: 0, days: pos.chain.map(function (x, i) { var d = i - start + 1; return d >= 1 && d <= n ? d : null; }) }, positional: true };
      }
    }
    if (!best || (best.seq.hits < (opt.minDays || 10) && !best.positional)) return { layout: null, days: [], lines: [], warnings: ["Không nhận ra hàng / cột ngày (1…31) — kiểm tra ảnh có đúng bảng chấm công, đủ nét, đúng chiều"] };
    best.medW = medW; best.medH = medH;
    var res = best.dir === "A" ? parseA(cells, best) : parseB(cells, best);
    if (!res) return { layout: null, days: [], lines: [], warnings: ["Không dựng được bảng"] };
    res.warnings = [];
    if (best.positional) res.warnings.push("Không đọc được số ngày ở tiêu đề — app suy ra ngày 1…" + res.days.length + " theo vị trí cột (ảnh nhỏ / mờ). Kiểm tra lại cột đầu, cột cuối");
    else if (best.seq.hits < res.days.length * 0.6) res.warnings.push("Chỉ đọc chắc được " + best.seq.hits + "/" + res.days.length + " số ngày ở tiêu đề — app suy ra các ngày còn lại theo thứ tự cột; kiểm tra lại");
    res.lines.forEach(function (l) {
      var sum = 0, bad = 0; Object.keys(l.values).forEach(function (d) { var v = l.values[d]; if (typeof v === "number" && isFinite(v)) sum += v; else if (v !== null && v !== undefined) bad++; });
      l.sum = Math.round(sum * 100) / 100; l.unreadable = bad; l.check = [];
      Object.keys(l.totals).forEach(function (k) {
        var t = l.totals[k], f = fold(k);
        if (/com/.test(f) && !/cong/.test(f) && l.kind !== "Cơm") return; // "Tổng cơm" không so với công
        if (typeof t === "number" && isFinite(t)) l.check.push({ label: k, total: t, sum: l.sum, ok: Math.abs(t - l.sum) < 0.01 });
      });
    });
    return res;
  }

  // ---------- Ghép tên trên giấy với nhân viên trong app ----------
  var STOP = { anh: 1, chu: 1, co: 1, chi: 1, em: 1, ong: 1, ba: 1, cn: 1, nv: 1 };
  function nameTokens(s) { return fold(s).replace(/[_.,/]/g, " ").split(" ").filter(function (t) { return t && !STOP[t] && !/^\d+$/.test(t); }); }
  /**
   * Gợi ý Mã NV cho 1 tên đọc từ giấy. list: [{ ma, ten }]. Trả [{ ma, ten, score }] (score 0…1, cao nhất trước).
   * Khớp đủ họ tên = 1; khớp tên + tên đệm / họ = cao; chỉ khớp tên (từ cuối) = thấp → người dùng chọn lại.
   */
  function matchName(name, list) {
    var t = nameTokens(name); if (!t.length) return [];
    return (list || []).map(function (e) {
      var u = nameTokens(e.ten); if (!u.length) return null;
      var full = t.join(" ") === u.join(" "), common = t.filter(function (x) { return u.indexOf(x) >= 0; }).length;
      var lastHit = t.indexOf(u[u.length - 1]) >= 0, firstHit = t.indexOf(u[0]) >= 0;
      var sc = full ? 1 : common === 0 ? 0 : (common / Math.max(t.length, u.length)) * 0.7 + (lastHit ? 0.2 : 0) + (firstHit ? 0.05 : 0);
      return sc > 0 ? { ma: e.ma, ten: e.ten, score: Math.min(0.99, Math.round(sc * 100) / 100) + (full ? 0.01 : 0) } : null;
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; });
  }
  /** Kỳ "YYYY-MM" từ chữ tiêu đề ("Tháng 09/2026", "Tháng 9 năm 2026") */
  function periodFromText(s) {
    var f = fold(s), m = f.match(/thang\s*(\d{1,2})\s*(?:\/|nam|-)\s*(\d{4})/);
    return m && +m[1] >= 1 && +m[1] <= 12 ? m[2] + "-" + ("0" + m[1]).slice(-2) : "";
  }
  var api = { parse: parse, link: link, chain: chain, daySeq: daySeq, kindOf: kindOf, matchName: matchName, periodFromText: periodFromText, fold: fold, cellAtX: cellAtX, valOf: valOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.tsparse = api; }
})(typeof window !== "undefined" ? window : this);
