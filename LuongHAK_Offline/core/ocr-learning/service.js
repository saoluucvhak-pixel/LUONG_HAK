// ===== CORE / OCR-LEARNING / SERVICE — OCRCorrectionLearningService (renderer) =====
// Mỗi ô OCR mà người dùng THỰC SỰ sửa tự ghi 1 mẫu (không có nút "lưu mẫu"). Dịch vụ cắt ảnh ô từ kết quả OCR (res.g hiển thị, res.clean tính đặc trưng),
// gửi sang tiến trình chính (api = window.hakOcrLib) để ghi bền; ghi lỗi → xếp hàng thử lại và báo, KHÔNG báo "đã học".
(function (root) {
  "use strict";
  var MAXSIDE = 160;
  function rectOf(cell) { // vùng chữ nếu có, không thì lòng ô (để ô trống → có chữ vẫn ghi sự kiện sửa)
    if (cell.bb) return cell.bb;
    return { x0: cell.x0 + 2, y0: cell.y0 + 2, x1: cell.x1 - 2, y1: cell.y1 - 2 };
  }
  function cutGray(g, W, H, r, pad) {
    var x0 = Math.max(0, Math.floor(r.x0 - pad)), y0 = Math.max(0, Math.floor(r.y0 - pad)), x1 = Math.min(W, Math.ceil(r.x1 + pad)), y1 = Math.min(H, Math.ceil(r.y1 + pad));
    var w = x1 - x0, h = y1 - y0; if (w < 4 || h < 4) return null;
    var out = new Uint8Array(w * h); for (var y = 0; y < h; y++) out.set(g.subarray((y0 + y) * W + x0, (y0 + y) * W + x0 + w), y * w);
    return { data: out, w: w, h: h };
  }
  /** Cắt ô từ kết quả analyze: { raw, clean, w, h } hoặc null nếu ô quá nhỏ / thiếu ảnh. */
  function cropCell(res, cell, pad) {
    if (!res || !res.g || !res.clean || !cell) return null; pad = pad == null ? 6 : pad;
    var r = rectOf(cell), a = cutGray(res.g, res.w, res.h, r, pad), b = cutGray(res.clean, res.w, res.h, r, pad);
    if (!a || !b || a.w !== b.w || a.h !== b.h || a.w > MAXSIDE * 4 || a.h > MAXSIDE * 4) return null;
    return { raw: a.data, clean: b.data, w: a.w, h: a.h };
  }
  function cellKey(docId, page, cell, rot) { return [docId || "-", page || 0, Math.round(cell.x0 || 0), Math.round(cell.y0 || 0), Math.round(cell.x1 || 0), Math.round(cell.y1 || 0), rot || 0].join("|"); }

  function createService(o) {
    var api = o.api, userFn = o.user || function () { return ""; }, cfgFn = o.cfg || function () { return {}; };
    var queue = [], learned = 0, lastError = "";
    function ctxPayload(c) {
      var cr = cropCell(c.res, c.cell); var pg = c.pg || {};
      var p = { cellType: pg.mode && pg.mode !== "so" ? "mark" : "digit", docId: pg.docId || "", page: pg.page || pg.trang || 0, bbox: { x0: c.cell.x0, y0: c.cell.y0, x1: c.cell.x1, y1: c.cell.y1 }, rot: pg.rot || 0, scale: c.res && c.res.scale || 1,
        employeeId: c.ma || "", ky: pg.ky || "", mode: pg.mode || "so", ocrVersion: o.ocrVersion || "", ocrRunId: pg.runId || "", ocrConf: c.cell.conf == null ? null : c.cell.conf, ocrValue: c.ocrValue == null ? "" : String(c.ocrValue),
        before: c.before == null ? "" : String(c.before), after: c.after == null ? "" : String(c.after), user: userFn(), layoutSuspect: !!pg.layoutSuspect };
      if (cr) { p.raw = cr.raw; p.clean = cr.clean; p.w = cr.w; p.h = cr.h; }
      return p;
    }
    /** Người dùng sửa ô. Trả Promise<{ok, queued?, sampleId?, note?}>. Không bao giờ ném lỗi. */
    function onEdit(c) {
      if (!api || !c || !c.cell || String(c.before == null ? "" : c.before).trim() === String(c.after == null ? "" : c.after).trim()) return Promise.resolve({ ok: true, skipped: true });
      var p = ctxPayload(c);
      return api.record(p).then(function (r) {
        if (r && r.ok) { learned++; lastError = ""; return { ok: true, sampleId: r.sampleId, note: r.note }; }
        throw new Error(r && r.error || "ghi thất bại");
      }).catch(function (e) { lastError = String(e && e.message || e); queue.push(p); return { ok: false, queued: true, error: lastError }; });
    }
    /** Ô OCR đọc đúng, người dùng đã xem ảnh ô rồi rời đi mà không sửa → mẫu CONFIRMED (chỉ khi bật cấu hình). */
    function onViewedUnchanged(c) {
      if (!api || !cfgFn().saveConfirmed || !c || !c.cell || !String(c.value || "").trim()) return Promise.resolve({ ok: true, skipped: true });
      var p = ctxPayload(Object.assign({}, c, { before: "", after: c.value })); p.value = c.value;
      return api.confirm(p).catch(function () { return { ok: false }; });
    }
    /** Thử lại các lần ghi lỗi trước đó. */
    function flush() {
      var items = queue.splice(0, queue.length); if (!items.length || !api) return Promise.resolve({ sent: 0, left: 0 });
      return items.reduce(function (pr, p) { return pr.then(function (acc) { return api.record(p).then(function (r) { if (r && r.ok) acc.sent++; else { queue.push(p); acc.left++; } return acc; }, function () { queue.push(p); acc.left++; return acc; }); }); }, Promise.resolve({ sent: 0, left: 0 }));
    }
    /** Duyệt bảng: PENDING → VERIFIED cho các trang đã chốt. */
    function approvePages(pages) {
      if (!api) return Promise.resolve({ verified: 0 });
      return flush().then(function () {
        var ids = {}; pages.forEach(function (pg) { if (pg.docId) ids[pg.docId + "|" + (pg.page || 0)] = { docId: pg.docId, page: pg.page || 0 }; });
        return Object.keys(ids).reduce(function (pr, k) { return pr.then(function (acc) { return api.approve({ docId: ids[k].docId, page: ids[k].page, user: userFn() }).then(function (r) { if (r && r.ok) { acc.verified += r.verified; acc.conflict += r.conflict; acc.skippedUnknownKind += r.skippedUnknownKind; acc.skippedLayout += r.skippedLayout; } return acc; }, function () { return acc; }); }); }, Promise.resolve({ verified: 0, conflict: 0, skippedUnknownKind: 0, skippedLayout: 0 }));
      });
    }
    /** Tra cứu hàng loạt các ô số. cells: [{cell, key}] → Promise<{key: result}>; lỗi → rỗng (OCR vẫn chạy như cũ). */
    function lookupCells(res, cells, mode) {
      if (!api || !cells.length) return Promise.resolve({});
      var items = [], keys = [];
      cells.forEach(function (c) { var cr = cropCell(res, c.cell, 4); if (cr) { items.push({ clean: cr.clean, w: cr.w, h: cr.h, cellType: mode && mode !== "so" ? "mark" : "digit", ocrText: c.cell.text || "", ocrConf: c.cell.conf }); keys.push(c.key); } });
      if (!items.length) return Promise.resolve({});
      return api.lookup(items).then(function (r) { var out = {}; if (r && r.ok) r.results.forEach(function (x, i) { out[keys[i]] = x; }); return out; }, function () { return {}; });
    }
    return { onEdit: onEdit, onViewedUnchanged: onViewedUnchanged, flush: flush, approvePages: approvePages, lookupCells: lookupCells, pending: function () { return queue.length; }, learned: function () { return learned; }, lastError: function () { return lastError; } };
  }
  var API = { createService: createService, cropCell: cropCell, cellKey: cellKey };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.ocrLearn = API; }
})(typeof self !== "undefined" ? self : this);
