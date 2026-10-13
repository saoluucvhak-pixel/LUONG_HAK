// ===== CORE / HDLD-DOCS — tài liệu đính kèm Hợp đồng lao động (V9.2 mục VII) =====
// Bảng HDLD_TAILIEU (db.hdld_tailieu) chỉ giữ LIÊN KẾT + siêu dữ liệu; nội dung file nằm trong kho chứng từ gốc (main/documents.js, DocumentID + SHA-256).
// Quy tắc: không ghi đè, không xóa file; thay thế = bản mới (PhienBan + 1), bản cũ "Đã thay thế" vẫn xem được; gỡ = đổi trạng thái kèm lý do.
(function (root) {
  "use strict";
  var EXT = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };
  var MAX_BYTES = 25 * 1024 * 1024;
  var LOAI = ["Hợp đồng lao động", "Phụ lục hợp đồng", "Hồ sơ khác"];
  var TT = { OK: "Hiệu lực", REPLACED: "Đã thay thế", UNLINKED: "Đã gỡ liên kết", HD_DELETED: "Hợp đồng đã xóa" };
  function extOf(n) { var m = /\.([A-Za-z0-9]{1,5})$/.exec(String(n || "")); return m ? m[1].toLowerCase() : ""; }
  function mimeOf(n) { return EXT[extOf(n)] || ""; }
  /** → "" nếu hợp lệ, ngược lại thông báo lỗi (kiểm tra sơ bộ ở giao diện; main/documents.js kiểm tra lại NỘI DUNG thật). */
  function checkFile(name, size) {
    if (!EXT[extOf(name)]) return "Chỉ nhận PDF, JPG, PNG (file: " + name + ")";
    if (!(size > 0)) return "File rỗng: " + name;
    if (size > MAX_BYTES) return "File quá " + (MAX_BYTES / 1048576) + " MB: " + name;
    return "";
  }
  function newLink(o) {
    var id = o.id || "TL-" + (o.now || new Date().toISOString()).replace(/[^0-9]/g, "").slice(0, 14) + "-" + String(Math.random()).slice(2, 6);
    return {
      "ID_TaiLieu": id, "Mã NV": o.maNV, "Số HĐLĐ": o.soHD, "Mã công tác": o.maCT || "", "DocumentID": o.doc.id,
      "Tên file gốc": o.doc.name, "Tên tài liệu": o.ten || o.doc.name, "Loại tài liệu": LOAI.indexOf(o.loai) >= 0 ? o.loai : LOAI[2],
      "MIME": mimeOf(o.doc.name), "Dung lượng (byte)": o.doc.size, "SHA256": o.doc.sha256, "Thêm lúc": o.now || new Date().toISOString(), "Người thêm": o.user || "",
      "Phiên bản": o.version || 1, "Nhóm tài liệu": o.group || id, "Trạng thái": TT.OK, "Ghi chú": o.note || ""
    };
  }
  var same = function (r, ma, hd) { return r["Mã NV"] === ma && r["Số HĐLĐ"] === hd; };
  function ofContract(rows, ma, hd) { return (rows || []).filter(function (r) { return same(r, ma, hd); }); }
  function active(rows, ma, hd) { return ofContract(rows, ma, hd).filter(function (r) { return r["Trạng thái"] === TT.OK; }); }
  /** File này (SHA-256) đã đang gắn với hợp đồng chưa? */
  function duplicate(rows, ma, hd, sha) { return active(rows, ma, hd).filter(function (r) { return r["SHA256"] === sha; })[0] || null; }
  /** Thay thế: bản cũ → "Đã thay thế" (giữ nguyên để tra lịch sử), bản mới cùng nhóm, phiên bản + 1. */
  function replace(oldRow, nextRow, user, now) {
    if (oldRow["Trạng thái"] !== TT.OK) throw new Error("Chỉ thay thế được tài liệu đang hiệu lực");
    oldRow["Trạng thái"] = TT.REPLACED; oldRow["Thay thế bởi"] = nextRow["ID_TaiLieu"]; oldRow["Thay thế lúc"] = now || new Date().toISOString(); oldRow["Người thay thế"] = user || "";
    nextRow["Nhóm tài liệu"] = oldRow["Nhóm tài liệu"] || oldRow["ID_TaiLieu"]; nextRow["Phiên bản"] = (+oldRow["Phiên bản"] || 1) + 1;
    return nextRow;
  }
  /** Gỡ liên kết (KHÔNG xóa file trong kho): bắt buộc có lý do. */
  function unlink(row, user, reason, now) {
    if (!String(reason || "").trim()) throw new Error("Cần ghi lý do gỡ liên kết");
    if (row["Trạng thái"] !== TT.OK) throw new Error("Tài liệu không ở trạng thái hiệu lực");
    row["Trạng thái"] = TT.UNLINKED; row["Gỡ bởi"] = user || ""; row["Gỡ lúc"] = now || new Date().toISOString(); row["Lý do gỡ"] = String(reason).trim();
    return row;
  }
  function history(rows, row) {
    var g = row["Nhóm tài liệu"] || row["ID_TaiLieu"];
    return (rows || []).filter(function (r) { return (r["Nhóm tài liệu"] || r["ID_TaiLieu"]) === g; }).sort(function (a, b) { return (+a["Phiên bản"] || 1) - (+b["Phiên bản"] || 1); });
  }
  function sizeText(n) { n = +n || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  var api = { EXT: Object.keys(EXT), MAX_BYTES: MAX_BYTES, LOAI: LOAI, TT: TT, extOf: extOf, mimeOf: mimeOf, checkFile: checkFile, newLink: newLink, ofContract: ofContract, active: active, duplicate: duplicate, replace: replace, unlink: unlink, history: history, sizeText: sizeText };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.hdld = api; }
})(typeof window !== "undefined" ? window : this);
