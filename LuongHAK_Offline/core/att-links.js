// ===== CORE / ATT-LINKS — liên kết ô chấm công ↔ chứng từ gốc (V8) =====
// AttendanceRecordID → DocumentID → PageNumber → CellKey → OCRRunID (→ SampleID tra theo CellKey trong thư viện OCR).
// AttendanceRecordID là khóa tự nhiên ổn định: CC|kỳ|mã NV|hình thức công (chấm công) · SC|ngày|mã NV (suất cơm).
// Nhập lại ô từ chứng từ khác: liên kết cũ được GIỮ (current=false) làm lịch sử; liên kết mới là hiện hành.
(function (root) {
  "use strict";
  function recordId(table, r) { return table === "chamcong" ? ["CC", r["Kỳ"], r["Mã NV"], r["Hình thức công"] || "BT"].join("|") : ["SC", r["Ngày"], r["Mã NV"]].join("|"); }
  function mapOf(list) { var m = {}; (list || []).forEach(function (l) { if (l.current !== false) m[l.recordId + "|" + l.day] = l; }); return m; }
  /** cells: [{recordId, day, docId, page, key, value, runId, bbox, imgW, imgH, rot, pdfScale}] → số liên kết ghi/làm mới. Không có docId → bỏ qua (không có gì để liên kết). */
  function record(list, cells, o) {
    o = o || {}; var at = o.at || new Date().toISOString(), by = o.by || "", n = 0, cur = mapOf(list);
    (cells || []).forEach(function (c) {
      if (!c || !c.docId || !c.recordId) return;
      var k = c.recordId + "|" + c.day, old = cur[k];
      if (old && old.docId === c.docId && old.page === c.page && old.cellKey === c.key) { old.value = c.value; old.at = at; old.importBatchId = o.batchId || ""; n++; return; }
      if (old) old.current = false;
      var row = { id: (o.makeId ? o.makeId(list.length + 1) : "LK-" + (list.length + 1)), recordId: c.recordId, day: c.day, docId: c.docId, page: c.page, cellKey: c.key, runId: c.runId || "", bbox: c.bbox || null, imgW: c.imgW || 0, imgH: c.imgH || 0, rot: c.rot || 0, pdfScale: c.pdfScale || 0, value: c.value, importBatchId: o.batchId || "", at: at, by: by, current: true };
      list.push(row); cur[k] = row; n++;
    });
    return n;
  }
  function history(list, recId, day) { return (list || []).filter(function (l) { return l.recordId === recId && l.day === day; }).sort(function (a, b) { return a.at < b.at ? 1 : -1; }); }
  var api = { recordId: recordId, mapOf: mapOf, record: record, history: history };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.attLinks = api; }
})(typeof self !== "undefined" ? self : this);
