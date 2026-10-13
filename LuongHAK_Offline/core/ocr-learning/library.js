// ===== OCR LEARNING / LIBRARY — thư viện mẫu OCR tự học (HAK OCR Learning Library, V7) =====
// KHÔNG huấn luyện AI: chỉ lưu ảnh ô đã được người dùng sửa/xác nhận + nhãn, rồi tra cứu bằng độ giống đặc trưng ảnh (core/ocr-learning/features.js).
// Lõi thuần (không đọc/ghi đĩa): mọi thay đổi là một "bản ghi" JSON thêm-vào-cuối; lưu bền do main/ocr-library.js làm; nạp lại bằng apply(rec).
//   sample  — một ảnh ô + nhãn (trạng thái PENDING_APPROVAL → VERIFIED | SUPERSEDED | REJECTED | CONFLICT)
//   edit    — nhật ký mỗi lần người dùng đổi giá trị 1 ô (kể cả khi không tạo được mẫu)
//   status / relabel / refs — đổi trạng thái, đổi nhãn (có lịch sử), đếm lần tham chiếu
(function (root) {
  "use strict";
  var NODE = typeof module !== "undefined" && module.exports;
  var F = NODE ? require("./features.js") : root.HAKCore.ocrFeat;
  var ST = { PENDING: "PENDING_APPROVAL", VERIFIED: "VERIFIED", SUPERSEDED: "SUPERSEDED", REJECTED: "REJECTED", CONFLICT: "CONFLICT" };
  var DEFAULT_CFG = { autoThreshold: 0.93, suggestThreshold: 0.85, minAgree: 2, singleAutoThreshold: 0.975, margin: 0.04, conflictSim: 0.96, nearDupSim: 0.995, confusionBand: 0.06, topK: 5, coarseKeep: 200, saveConfirmed: false };
  var COARSE = 16;

  function coarseOf(vec) { // 12×12 → 4×4 (trung bình 3×3) rồi chuẩn hóa: bước lọc thô của chỉ mục
    var c = new Float32Array(COARSE), s = 0, i;
    for (var y = 0; y < 12; y++) for (var x = 0; x < 12; x++) c[Math.floor(y / 3) * 4 + Math.floor(x / 3)] += vec[y * 12 + x];
    for (i = 0; i < COARSE; i++) s += c[i] * c[i]; s = Math.sqrt(s) || 1; for (i = 0; i < COARSE; i++) c[i] /= s;
    return c;
  }
  function normLabel(v) { return String(v == null ? "" : v).trim().replace(",", "."); }
  function cellKeyOf(p) { var b = p.bbox || {}; return [p.docId || "-", p.page || 0, Math.round(b.x0 || 0), Math.round(b.y0 || 0), Math.round(b.x1 || 0), Math.round(b.y1 || 0), p.rot || 0].join("|"); }

  function createLibrary(opts) {
    opts = opts || {};
    var cfg = Object.assign({}, DEFAULT_CFG, opts.config || {});
    var now = opts.now || function () { return new Date().toISOString(); };
    var seq = 0, rand = opts.rand || function () { return Math.random().toString(36).slice(2, 8).toUpperCase(); };
    var samples = {}, edits = [], active = {}, bySha = {}, refs = {}, order = [];
    var index = null; // index dựng lười, hủy khi trạng thái đổi

    function newId(p) { seq++; return p + "-" + now().replace(/[-:TZ.]/g, "").slice(0, 14) + "-" + String(seq).padStart(4, "0") + rand(); }

    // ---------- áp bản ghi (dùng khi nạp từ đĩa và sau mỗi thao tác) ----------
    function apply(rec) {
      if (!rec || !rec.t) return;
      if (rec.t === "sample") {
        var s = Object.assign({}, rec); delete s.t; delete s.rawPng; s.vec = rec.vec || (rec.feat && F.fromB64 ? F.fromB64(rec.feat) : null);
        if (s.vec) s.coarse = coarseOf(s.vec);
        s.history = s.history || []; samples[s.id] = s; order.push(s.id);
        if (s.cellKey && (s.status === ST.PENDING || s.status === ST.VERIFIED)) active[s.cellKey] = s.id;
        if (s.pngSha) (bySha[s.pngSha] = bySha[s.pngSha] || []).push(s.id);
      } else if (rec.t === "edit") edits.push(rec);
      else if (rec.t === "status") { var a = samples[rec.id]; if (a) { a.history.push({ at: rec.at, by: rec.by, what: "status", from: a.status, to: rec.status, reason: rec.reason || "" }); a.status = rec.status; if (rec.status !== ST.PENDING && rec.status !== ST.VERIFIED && a.cellKey && active[a.cellKey] === a.id) delete active[a.cellKey]; if (rec.status === ST.VERIFIED) { a.verifiedAt = rec.at; a.verifiedBy = rec.by; } } }
      else if (rec.t === "relabel") { var b = samples[rec.id]; if (b) { b.history.push({ at: rec.at, by: rec.by, what: "label", from: b.label, to: rec.label, reason: rec.reason || "" }); b.label = rec.label; if (rec.labelKind) b.labelKind = rec.labelKind; } }
      else if (rec.t === "refs") { Object.keys(rec.counts || {}).forEach(function (k) { refs[k] = (refs[k] || 0) + rec.counts[k]; }); }
      index = null;
    }
    var deferred = false;
    function emit(recs) { if (!deferred) recs.forEach(apply); return recs; }
    /** Chạy fn mà CHƯA áp bản ghi vào bộ nhớ: nơi lưu bền ghi xong rồi mới commit(records) — ghi thất bại thì trạng thái không đổi. */
    function defer(fn) { deferred = true; try { return fn(); } finally { deferred = false; } }
    function commit(recs) { recs.forEach(apply); }

    // ---------- ghi nhận một lần sửa ô ----------
    /** p: { docId, page, bbox, rot, scale, cellType, mode, employeeId, ky, company, ocrValue, before, after, rawPng, pngSha, w, h, vec, labelKind, layoutSuspect, user, ocrVersion, ocrRunId, ocrConf }
     *  Trả { records, sampleId|null, note } — records phải được lưu bền TRƯỚC khi báo "đã học". Không tạo mẫu giả khi thiếu ảnh nguồn. */
    function recordCorrection(p) {
      var at = now(), key = cellKeyOf(p), after = normLabel(p.after), before = normLabel(p.before), ocr = normLabel(p.ocrValue);
      var recs = [], edit = { t: "edit", id: newId("EDT"), at: at, by: p.user || "", cellKey: key, docId: p.docId || "", page: p.page || 0, bbox: p.bbox || null, employeeId: p.employeeId || "", ky: p.ky || "", ocr: ocr, from: before, to: after, mode: p.mode || "so", sampleId: null, note: "" };
      if (after === before) return { records: [], sampleId: null, note: "không đổi" };
      var kind = p.labelKind || (p.mode && p.mode !== "so" ? "UNKNOWN" : "SYMBOL");
      if (!p.rawPng || !p.vec || !p.pngSha) { edit.note = "thiếu ảnh nguồn — chỉ ghi sự kiện sửa, không tạo mẫu"; recs.push(edit); emit(recs); return { records: recs, sampleId: null, note: edit.note }; }
      if (after === "") { edit.note = "xóa giá trị — không tạo mẫu"; recs.push(edit); emit(recs); return { records: recs, sampleId: null, note: edit.note }; }
      // vô hiệu hóa mẫu đang hiệu lực của đúng ô này (1 → 7 → 1: chỉ nhãn cuối cùng có quyền)
      var prev = active[key] && samples[active[key]];
      if (prev && prev.status !== ST.REJECTED) {
        if (prev.label === after && prev.pngSha === p.pngSha) { edit.sampleId = prev.id; edit.note = "cùng nhãn — giữ mẫu cũ"; recs.push(edit); emit(recs); return { records: recs, sampleId: prev.id, note: edit.note }; }
        recs.push({ t: "status", id: prev.id, status: ST.SUPERSEDED, at: at, by: p.user || "", reason: "sửa lại ô: " + prev.label + " → " + after });
      }
      var dupId = null; (bySha[p.pngSha] || []).forEach(function (id) { var s = samples[id]; if (s && s.label === after && s.cellType === p.cellType && (s.status === ST.PENDING || s.status === ST.VERIFIED)) dupId = id; });
      if (dupId) { edit.sampleId = dupId; edit.note = "ảnh trùng byte với mẫu đã có — không lưu thêm"; recs.push(edit); emit(recs); return { records: recs, sampleId: dupId, note: edit.note }; }
      // gần trùng (cùng nhãn, ảnh gần như giống hệt mẫu đã có) → dùng lại mẫu cũ, không phình thư viện
      var near = nearDup(p.vec, after, p.cellType || "digit"); if (near) { edit.sampleId = near; edit.note = "ảnh gần trùng mẫu đã có — không lưu thêm"; recs.push(edit); emit(recs); return { records: recs, sampleId: near, note: edit.note }; }
      var id = newId("SMP");
      var rec = { t: "sample", id: id, source: "CORRECTED", status: ST.PENDING, cellType: p.cellType || "digit", label: after, labelKind: kind, ocrValue: ocr, prevValue: before, docId: p.docId || "", page: p.page || 0, bbox: p.bbox || null, rot: p.rot || 0, scale: p.scale || 1,
        employeeId: p.employeeId || "", ky: p.ky || "", company: p.company || "", mode: p.mode || "so", ocrVersion: p.ocrVersion || "", ocrRunId: p.ocrRunId || "", ocrConf: p.ocrConf == null ? null : p.ocrConf,
        cellKey: key, pngSha: p.pngSha, w: p.w, h: p.h, createdAt: at, createdBy: p.user || "", flags: p.layoutSuspect ? ["LAYOUT"] : [], vec: p.vec, rawPng: p.rawPng };
      edit.sampleId = id; recs.push(edit); recs.push(rec); emit(recs);
      return { records: recs, sampleId: id, note: kind === "UNKNOWN" ? "chờ xác định loại nhãn (ký hiệu hay giá trị công)" : "" };
    }
    function nearDup(vec, label, cellType) {
      var best = null; order.forEach(function (id) { var o = samples[id]; if (!o || o.label !== label || o.cellType !== cellType || !o.vec || (o.status !== ST.PENDING && o.status !== ST.VERIFIED)) return; if (F.similarity(vec, o.vec) >= cfg.nearDupSim) best = id; });
      return best;
    }
    /** Ô OCR đọc đúng và người dùng đã xem ảnh ô (không sửa) — CONFIRMED_SAMPLE. Chỉ khi cfg.saveConfirmed. */
    function recordConfirmed(p) {
      if (!cfg.saveConfirmed || !p.rawPng || !p.vec || !p.pngSha) return { records: [], sampleId: null };
      var key = cellKeyOf(p), label = normLabel(p.value); if (!label) return { records: [], sampleId: null };
      if (active[key]) return { records: [], sampleId: active[key] };
      var dup = (bySha[p.pngSha] || []).filter(function (id) { var s = samples[id]; return s && s.label === label && s.cellType === p.cellType && (s.status === ST.PENDING || s.status === ST.VERIFIED); })[0];
      if (dup) return { records: [], sampleId: dup };
      var at = now(), id = newId("SMP");
      var rec = { t: "sample", id: id, source: "CONFIRMED", status: ST.PENDING, cellType: p.cellType || "digit", label: label, labelKind: p.labelKind || (p.mode && p.mode !== "so" ? "UNKNOWN" : "SYMBOL"), ocrValue: label, prevValue: label, docId: p.docId || "", page: p.page || 0, bbox: p.bbox || null, rot: p.rot || 0, scale: p.scale || 1,
        employeeId: p.employeeId || "", ky: p.ky || "", company: p.company || "", mode: p.mode || "so", ocrVersion: p.ocrVersion || "", ocrRunId: p.ocrRunId || "", ocrConf: p.ocrConf == null ? null : p.ocrConf, cellKey: key, pngSha: p.pngSha, w: p.w, h: p.h, createdAt: at, createdBy: p.user || "", flags: p.layoutSuspect ? ["LAYOUT"] : [], vec: p.vec, rawPng: p.rawPng };
      var recs = [rec]; emit(recs); return { records: recs, sampleId: id };
    }

    // ---------- duyệt bảng: PENDING → VERIFIED (trừ mẫu chưa rõ loại nhãn / lỗi bố cục / xung đột) ----------
    function approve(q) {
      var at = now(), recs = [], out = { verified: 0, conflict: 0, skippedUnknownKind: 0, skippedLayout: 0 };
      var ids = q.sampleIds || order.filter(function (id) { var s = samples[id]; return s && s.status === ST.PENDING && (!q.docId || s.docId === q.docId) && (!q.page || s.page === q.page); });
      ids.forEach(function (id) {
        var s = samples[id]; if (!s || s.status !== ST.PENDING) return;
        if (s.labelKind === "UNKNOWN") { out.skippedUnknownKind++; return; }
        if (s.flags && s.flags.indexOf("LAYOUT") >= 0) { out.skippedLayout++; return; }
        var c = s.vec ? conflictFor(s) : null;
        if (c) { recs.push({ t: "status", id: id, status: ST.CONFLICT, at: at, by: q.user || "", reason: "gần giống mẫu " + c.id + " (nhãn " + c.label + ", độ giống " + c.sim.toFixed(3) + ") nhưng nhãn khác" }); out.conflict++; return; }
        recs.push({ t: "status", id: id, status: ST.VERIFIED, at: at, by: q.user || "", reason: "duyệt bảng OCR" }); out.verified++;
      });
      emit(recs); out.records = recs; return out;
    }
    function conflictFor(s) {
      var best = null;
      order.forEach(function (id) { var o = samples[id]; if (!o || o.id === s.id || o.status !== ST.VERIFIED || o.labelKind !== "SYMBOL" || o.cellType !== s.cellType || !o.vec || o.label === s.label) return; var sim = F.similarity(s.vec, o.vec); if (sim >= cfg.conflictSim && (!best || sim > best.sim)) best = { id: o.id, label: o.label, sim: sim }; });
      return best;
    }
    function setStatus(id, status, user, reason) { var s = samples[id]; if (!s || s.status === status) return { records: [] }; var r = [{ t: "status", id: id, status: status, at: now(), by: user || "", reason: reason || "" }]; emit(r); return { records: r }; }
    function relabel(id, label, kind, user, reason) { var s = samples[id]; if (!s) return { records: [] }; var r = [{ t: "relabel", id: id, label: normLabel(label), labelKind: kind || s.labelKind, at: now(), by: user || "", reason: reason || "" }]; if (s.status === ST.VERIFIED) r.push({ t: "status", id: id, status: ST.PENDING, at: now(), by: user || "", reason: "đổi nhãn — cần duyệt lại" }); emit(r); return { records: r }; }
    /** Hoàn tác lần sửa gần nhất của 1 ô: mẫu hiện hành → REJECTED (giữ lịch sử). */
    function undoCell(key, user) { var id = active[key]; if (!id) return { records: [] }; return setStatus(id, ST.REJECTED, user, "hoàn tác chỉnh sửa"); }

    // ---------- chỉ mục + tra cứu ----------
    function buildIndex() {
      var groups = {};
      order.forEach(function (id) { var s = samples[id]; if (!s || s.status !== ST.VERIFIED || s.labelKind !== "SYMBOL" || !s.vec) return; var g = groups[s.cellType] || (groups[s.cellType] = { ids: [], coarse: [] }); g.ids.push(id); g.coarse.push(s.coarse); });
      Object.keys(groups).forEach(function (k) { var g = groups[k], n = g.ids.length, m = new Float32Array(n * COARSE); g.coarse.forEach(function (c, i) { m.set(c, i * COARSE); }); g.mat = m; g.n = n; delete g.coarse; });
      index = groups; return index;
    }
    function confusionCount(a, b) { var n = 0; order.forEach(function (id) { var s = samples[id]; if (s && s.source === "CORRECTED" && s.status !== ST.REJECTED && ((s.ocrValue === a && s.label === b) || (s.ocrValue === b && s.label === a))) n++; }); return n; }
    /** vec: vector ô cần nhận; cellType; opt.ocrText: chữ Tesseract đọc được (để so khớp). @returns { status: AUTO_ACCEPT|SUGGESTED|UNRECOGNIZED, label, score, consensus, top:[{id,label,sim}], reason } */
    function lookup(vec, cellType, opt) {
      opt = opt || {}; var g = (index || buildIndex())[cellType];
      if (!g || !g.n) return { status: "UNRECOGNIZED", label: "", score: 0, consensus: 0, top: [], reason: "thư viện chưa có mẫu đã xác minh cho loại ô này" };
      var q = coarseOf(vec), n = g.n, K = Math.min(cfg.coarseKeep, n), i, j;
      // chọn K ứng viên có điểm thô cao nhất bằng min-heap (O(n log K)) — không sắp xếp toàn bộ n mẫu
      var hs = new Float64Array(K), hi = new Int32Array(K), hn = 0;
      function up(k) { while (k > 0) { var p = (k - 1) >> 1; if (hs[p] <= hs[k]) break; var ts = hs[p]; hs[p] = hs[k]; hs[k] = ts; var ti = hi[p]; hi[p] = hi[k]; hi[k] = ti; k = p; } }
      function down(k) { for (;;) { var l = 2 * k + 1, r = l + 1, m = k; if (l < hn && hs[l] < hs[m]) m = l; if (r < hn && hs[r] < hs[m]) m = r; if (m === k) break; var ts = hs[m]; hs[m] = hs[k]; hs[k] = ts; var ti = hi[m]; hi[m] = hi[k]; hi[k] = ti; k = m; } }
      for (i = 0; i < n; i++) {
        var d = 0, o = i * COARSE; for (j = 0; j < COARSE; j++) d += q[j] * g.mat[o + j];
        if (hn < K) { hs[hn] = d; hi[hn] = i; hn++; up(hn - 1); } else if (d > hs[0]) { hs[0] = d; hi[0] = i; down(0); }
      }
      var top = []; for (i = 0; i < hn; i++) { var s0 = samples[g.ids[hi[i]]]; top.push({ id: s0.id, label: s0.label, sim: F.similarity(vec, s0.vec) }); }
      top.sort(function (a, b) { return b.sim - a.sim; });
      var tk = top.slice(0, cfg.topK), byLabel = {};
      tk.forEach(function (t) { var w = Math.pow(t.sim, 8); var e = byLabel[t.label] || (byLabel[t.label] = { w: 0, best: 0, n: 0 }); e.w += w; e.n++; if (t.sim > e.best) e.best = t.sim; });
      var labels = Object.keys(byLabel).sort(function (a, b) { return byLabel[b].w - byLabel[a].w; }), best = labels[0];
      var tot = labels.reduce(function (s, k) { return s + byLabel[k].w; }, 0) || 1, cons = byLabel[best].w / tot, bs = byLabel[best].best;
      // nhãn khác cũng có mẫu rất gần (kể cả ngoài top-K) → không chắc
      var rival = null; top.forEach(function (t) { if (t.label !== best && (!rival || t.sim > rival.sim)) rival = t; });
      var res = { status: "UNRECOGNIZED", label: best, score: bs, consensus: cons, top: tk, reason: "" };
      if (bs < cfg.suggestThreshold) { res.reason = "độ giống thấp (" + bs.toFixed(3) + ")"; res.status = "UNRECOGNIZED"; return res; }
      res.status = "SUGGESTED";
      var clear = !rival || bs - rival.sim >= cfg.margin, agree = byLabel[best].n >= cfg.minAgree || bs >= cfg.singleAutoThreshold;
      if (bs >= cfg.autoThreshold && cons >= 0.8 && clear && agree) res.status = "AUTO_ACCEPT"; else res.reason = !clear ? "có mẫu nhãn " + rival.label + " gần tương đương" : !agree ? "chỉ 1 mẫu ủng hộ" : cons < 0.8 ? "mẫu bất đồng nhãn" : "độ giống chưa đủ ngưỡng tự nhận";
      // cặp dễ nhầm từng bị sửa: nhãn đối lập có mẫu trong dải gần → hạ xuống SUGGESTED
      if (res.status === "AUTO_ACCEPT" && rival && bs - rival.sim < cfg.confusionBand && confusionCount(best, rival.label) > 0) { res.status = "SUGGESTED"; res.reason = "cặp " + best + "/" + rival.label + " từng bị nhầm — cần xác minh"; }
      if (opt.ocrText != null && normLabel(opt.ocrText) !== "" && normLabel(opt.ocrText) !== best && res.status === "AUTO_ACCEPT" && (opt.ocrConf || 0) >= 85) { res.status = "SUGGESTED"; res.reason = "Tesseract (tin cậy " + opt.ocrConf + ") đọc khác: " + opt.ocrText; }
      return res;
    }
    function noteRefs(counts) { var r = [{ t: "refs", counts: counts, at: now() }]; emit(r); return r; }

    // ---------- truy vấn / thống kê ----------
    function list(f) {
      f = f || {}; return order.map(function (id) { return samples[id]; }).filter(function (s) {
        if (!s) return false; if (f.status && s.status !== f.status) return false; if (f.label != null && f.label !== "" && s.label !== f.label) return false; if (f.cellType && s.cellType !== f.cellType) return false;
        if (f.source && s.source !== f.source) return false; if (f.docId && s.docId !== f.docId) return false; if (f.ky && s.ky !== f.ky) return false; if (f.user && s.createdBy !== f.user) return false; if (f.company && s.company !== f.company) return false;
        if (f.pendingKind && s.labelKind !== "UNKNOWN") return false; return true;
      });
    }
    function confusions() {
      var m = {}; order.forEach(function (id) { var s = samples[id]; if (!s || s.source !== "CORRECTED" || s.status === ST.REJECTED || s.ocrValue === s.label) return; var k = s.ocrValue + "→" + s.label; var e = m[k] || (m[k] = { ocr: s.ocrValue, corrected: s.label, count: 0, last: "", samples: [] }); e.count++; if (s.createdAt > e.last) e.last = s.createdAt; e.samples.push(s.id); });
      return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.count - a.count; });
    }
    function stats() {
      var by = {}, labels = {}, kinds = {}; order.forEach(function (id) { var s = samples[id]; if (!s) return; by[s.status] = (by[s.status] || 0) + 1; labels[s.label] = 1; kinds[s.source] = (kinds[s.source] || 0) + 1; });
      var totalRefs = 0; Object.keys(refs).forEach(function (k) { totalRefs += refs[k]; });
      return { total: order.length, labels: Object.keys(labels).length, byStatus: by, bySource: kinds, edits: edits.length, refs: totalRefs, confusions: confusions().length };
    }
    return { cfg: cfg, STATUS: ST, apply: apply, defer: defer, commit: commit, recordCorrection: recordCorrection, recordConfirmed: recordConfirmed, approve: approve, setStatus: setStatus, relabel: relabel, undoCell: undoCell, lookup: lookup, noteRefs: noteRefs, list: list, get: function (id) { return samples[id] || null; }, edits: function () { return edits.slice(); }, confusions: confusions, stats: stats, activeFor: function (key) { return active[key] || null; }, refsOf: function (id) { return refs[id] || 0; }, size: function () { return order.length; } };
  }
  var api = { createLibrary: createLibrary, STATUS: ST, DEFAULT_CFG: DEFAULT_CFG, cellKeyOf: cellKeyOf, normLabel: normLabel };
  if (NODE) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.ocrLib = api; }
})(typeof window !== "undefined" ? window : this);
