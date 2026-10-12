// ===== GIAO DIỆN APP TÍNH LƯƠNG HAK (offline) =====
(function () {
  "use strict";
  var KEY = "luonghak_db_v1";
  var E = window.LuongEngine, C = window.HAKCore, VAL = C.validate, IMP = C.importer, INT = C.integrity, CLS = C.close;
  var DAYS = []; for (var i = 1; i <= 31; i++) DAYS.push(("0" + i).slice(-2));

  // ---------- Định nghĩa bảng ----------
  var S = {
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
    dm_tncn: { ten: "Thuế TNCN", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã thuế TNCN", "Nội dung", "Mức thuế", "Ghi chú"], hint: "Phương thức thuế gán trong phụ lục HĐ. 'Nội dung' chứa 'Khấu trừ vãng lai' → khấu trừ theo Mức thuế (mặc định 10%); 'Lũy tiến' → tính theo Biểu thuế lũy tiến; 'Miễn thuế' → không khấu trừ." },
    dm_bacthue: { ten: "Biểu thuế lũy tiến", cols: ["Hiệu lực từ", "Hiệu lực đến", "Bậc", "Thu nhập từ", "Thu nhập đến", "Tỷ lệ"], hint: "Bậc cao nhất để 'Thu nhập đến' = 0 hoặc trống (không giới hạn). Mỗi bộ biểu thuế có 'Hiệu lực từ/đến' riêng." },
    dm_giamtru: { ten: "Giảm trừ gia cảnh", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã giảm trừ", "Số người", "Số tiền"], hint: "Mã bắt đầu GTBT = bản thân, GTNPT = mỗi người phụ thuộc. Số người phụ thuộc lấy từ hồ sơ Nhân thân (Đăng ký phụ thuộc = Có)." },
    dm_phongban: { ten: "Phòng ban", cols: ["Mã khối", "Tên khối", "Mã phòng ban", "Tên phòng ban", "Tài khoản chi phí", "Hiệu lực từ", "Hiệu lực đến"], hint: "'Tài khoản chi phí' dùng cho Bảng hạch toán lương (VD 622 sản xuất, 627 quản lý PX, 641 bán hàng, 642 quản lý DN). Để trống: khối Sản xuất → 622, còn lại → 642." },
    dm_chucvu: { ten: "Chức vụ", cols: ["Mã chức vụ", "Tên chức vụ", "Hiệu lực từ", "Hiệu lực đến"] },
    dm_cc: { ten: "Hình thức công", cols: ["Mã CC", "Nội dung", "Hình thức công", "Diễn giải", "Hiệu lực từ", "Hiệu lực đến"], hint: "Danh sách mã hình thức công dùng trong bảng chấm công (BT, PN, CL, TC, CC…)." }
  };
  var HRT = {}; Object.keys(HRM.HR).forEach(function (k) { HRT[k] = { ten: HRM.HR[k].ten, cols: HRM.HR[k].store, hr: true }; });
  var ALL = Object.assign({}, S, DM, HRT);
  var DATECOLS = /^(Ngày|Hiệu lực)/;
  var NUMCOLS = /(Lương|Số tiền|Số suất|KL hàng|Thưởng|Thu nhập|Trừ khác|Tạm ứng|Đơn giá|Tỷ lệ|DN\.|NLD\.|Bậc|Người phụ thuộc|Số người|Tham chiếu|Hệ số|Ngưỡng|ĐK_|Tiền)/;
  var COLW = { "Mã NV": 96, "Họ và tên": 170, "Diễn giải": 200, "Cách tính": 260, "Tên phụ cấp": 160, "Hình thức lương": 150, "Nội dung": 180, "Nội dung tăng ca": 160, "Nội dung khấu trừ": 160, "Tên hỗ trợ": 150, "Tên phòng ban": 200, "Tên chức vụ": 200, "Ghi chú": 200, "Hình thức công": 90, "Mã nhân viên": 110, "Tên Ngân hàng": 150 };

  // ---------- Lưu trữ ----------
  // Bản cài (.exe): lưu ra file data.json trong thư mục dữ liệu của app (window.hakStore, xem preload.js).
  // Mở bằng trình duyệt: lưu trong localStorage.
  var store = window.hakStore || null, fromLocal = false, loadError = null, readOnly = false;
  var db = (function () {
    if (store) {
      var res = store.load();
      if (res && res.ok === false) { loadError = res; readOnly = true; return {}; } // file hỏng: KHÔNG ghi đè, chuyển sang màn hình khôi phục
      if (res && res.text) { try { return JSON.parse(res.text); } catch (e) { loadError = { error: "Không đọc được dữ liệu: " + e.message, backups: store.listBackups() }; readOnly = true; return {}; } }
    }
    try { var s = localStorage.getItem(KEY); if (s) { fromLocal = !!store; return JSON.parse(s); } } catch (e) {}
    return {};
  })();
  // Sao lưu TRƯỚC NÂNG CẤP: chụp nguyên trạng file dữ liệu của bản cũ trước khi chuyển đổi (1 lần cho mỗi lần nâng schema)
  if (!readOnly && store && store.backup && db && Object.keys(db).length && db.schemaVersion !== 2) { try { store.backup("truoc-nang-cap"); } catch (e) { /* không chặn mở app */ } }
  var migMsg = readOnly ? [] : HRM.migrate(db);
  if (!readOnly) migMsg = migMsg.concat(INT.normalizeDataset(db).messages);
  function ensureTables() {
    Object.keys(ALL).forEach(function (k) { if (!Array.isArray(db[k])) db[k] = []; });
    ["congty", "kyluong", "kyluong_lichsu", "auditlog"].forEach(function (k) { if (!Array.isArray(db[k])) db[k] = []; });
    db.schemaVersion = 2;
  }
  ensureTables();
  var saveTimer = null, dirty = false;
  /** Ghi dữ liệu xuống nơi lưu bền vững. Trả true nếu chắc chắn đã lưu. */
  function saveNow() {
    clearTimeout(saveTimer);
    if (readOnly) { toast("⚠ Đang ở chế độ khôi phục — chưa ghi dữ liệu"); return false; }
    var str = JSON.stringify(db);
    if (store) { var r = store.save(str); if (r !== true) { dirty = true; toast("⚠ KHÔNG LƯU ĐƯỢC dữ liệu: " + r); return false; } dirty = false; return true; }
    try { localStorage.setItem(KEY, str); dirty = false; return true; } catch (e) { dirty = true; toast("⚠ Bộ nhớ trình duyệt đã đầy — hãy bấm Sao lưu ra file ngay!"); return false; }
  }
  function save() { dirty = true; st.kqStale = true; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }
  function backupNow(tag) { if (!store || !store.backup) return null; if (dirty) saveNow(); return store.backup(tag); }
  function audit(action, detail) { db.auditlog.push({ luc: new Date().toISOString(), thaoTac: action, chiTiet: detail || "" }); if (db.auditlog.length > 5000) db.auditlog.splice(0, db.auditlog.length - 5000); }
  window.addEventListener("beforeunload", function () { if (dirty) saveNow(); });
  if (!readOnly && (fromLocal || migMsg.length)) saveNow();
  var now = new Date();
  var st = { tab: "home", dm: "dm_luong", nam: now.getFullYear(), thang: now.getMonth() + 1, bu: false, kq: null, compact: true, q: "" };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY + "_ui") || "{}"), { kq: null, q: "" }); } catch (e) {}
  function saveUi() { try { localStorage.setItem(KEY + "_ui", JSON.stringify({ tab: st.tab === "nv" || st.tab === "slips" ? (st.tab === "nv" ? "nhansu" : "luong") : st.tab, dm: st.dm, nam: st.nam, thang: st.thang, bu: st.bu, compact: st.compact })); } catch (e) {} }

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
  function tenNV(ma) { for (var i = 0; i < db.nhanvien.length; i++) if (db.nhanvien[i]["Mã NV"] === ma) return db.nhanvien[i]["Họ và tên"] || ""; return ""; }
  function download(name, mime, content) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type: mime })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  // ---------- Excel thật (.xlsx) ----------
  var SAMPLES = {
    nhanvien: [{ "Mã NV": "NV001", "Họ và tên": "Nguyễn Văn An", "Số CCCD": "049090001234", "Ngày tạo hồ sơ": "2024-03-01", "Trạng thái": "Đang làm việc" }],
    canhan: [{ "Mã NV": "NV001", "Số CCCD": "049090001234", "Ngày cấp": "2021-05-10", "Nơi cấp": "Cục CS QLHC về TTXH", "Ngày sinh": "1990-06-15", "Giới tính": "Nam", "Quốc tịch": "Việt Nam", "Dân tộc": "Kinh", "Thường trú": "Quế Sơn, Quảng Nam", "Địa chỉ hiện tại": "Liên Chiểu, Đà Nẵng", "Số điện thoại": "0905123456", "Hiệu lực từ": "2024-03-01" }],
    nhanthan: [{ "Mã NV": "NV001", "Họ tên nhân thân": "Nguyễn Thị Bình", "Quan hệ": "Con", "Ngày sinh": "2018-02-01", "Đăng ký phụ thuộc": "Có", "Hiệu lực từ": "2024-03-01" }],
    thanhtoan: [{ "Mã NV": "NV001", "Số tài khoản": "0123456789", "Tên ngân hàng": "Vietcombank", "Chi nhánh": "Đà Nẵng", "Hiệu lực từ": "2024-03-01" }],
    hopdong: [{ "Mã NV": "NV001", "Số HĐLĐ": "NV001/HĐ01", "Hình thức HĐLĐ": "Xác định thời hạn", "Ngày vào làm": "2024-03-01", "Ngày hết hạn": "2027-02-28" }],
    chitiethd: [{ "Mã NV": "NV001", "Số HĐLĐ": "NV001/HĐ01", "Mã công tác": "NV001/HĐ01-PL01", "Loại phụ lục": "Hợp đồng gốc", "Hiệu lực từ": "2024-03-01", "Phòng ban": "02.01", "Chức vụ": "8", "Mã hình thức lương": "LTG", "Mã lương": "TG1", "Lương cơ bản": 5000000, "Lương thỏa thuận": 9000000, "HTTT": "Chuyển khoản", "Mức đóng bảo hiểm": "BH01", "Thuế TNCN": "LT01", "Phụ cấp": "TN.02", "Hỗ trợ": "HT.01", "Tăng ca": "TC4" }],
    chamcong: [{ "Kỳ": "2026-09", "Mã NV": "NV001", "Hình thức công": "BT", "01": 1, "02": 1, "03": 1, "04": 1, "05": 1, "06": "", "07": 1, "08": 1, "09": "1QC" }, { "Kỳ": "2026-09", "Mã NV": "NV001", "Hình thức công": "TC", "01": 2, "02": 2 }],
    sanluong: [{ "Phiếu cân": "PC0001", "Ngày cân": "2026-09-15", "Biển số": "43C-12345", "KL hàng (Tấn)": 28.5, "Mã NV": "NV001" }],
    bandam: [{ "Phiếu cân": "PC0001", "Ngày cân": "2026-09-15", "Biển số": "43C-12345", "KL hàng (Tấn)": 1, "Mã NV": "NV001" }],
    psluong: [{ "Ngày hạch toán": "2026-09-30", "Mã NV": "NV001", "Diễn giải": "Thưởng chuyên cần", "Thưởng": 500000, "Thu nhập khác": 0, "Trừ khác": 0 }],
    ungluong: [{ "Ngày hạch toán": "2026-09-15", "Mã NV": "NV001", "Diễn giải": "Tạm ứng kỳ 1", "Tạm ứng": 2000000 }],
    tiencom: [{ "Ngày": "2026-09-15", "Mã NV": "NV001", "Số suất cơm": 1, "Ghi chú": "" }],
    dm_luong: null, dm_phucap: null, dm_tangca: null, dm_hotro: null, dm_baohiem: null, dm_tncn: null, dm_bacthue: null, dm_giamtru: null, dm_phongban: null, dm_chucvu: null, dm_cc: null
  };
  (function () { var sd = HRM.seedDanhMuc(); Object.keys(sd).forEach(function (k) { if (SAMPLES[k] === null) SAMPLES[k] = sd[k]; }); })();
  function excelCell(col, v) { // số thì lưu số, còn lại lưu chữ
    if (v === "" || v == null) return "";
    if (typeof v === "number") return v;
    if (NUMCOLS.test(col) && !DATECOLS.test(col) && /^[\d.,%\s-]+$/.test(String(v)) && String(v).indexOf("%") < 0) return E.num(v);
    if (/^\d\d$/.test(col) && /^\d+([.,]\d+)?$/.test(String(v))) return E.num(v);
    return v;
  }
  function saveXlsx(filename, sheets) { // sheets: [{name, cols, rows}]
    if (!window.XLSX) { alert("Thiếu thư viện Excel"); return; }
    var wb = XLSX.utils.book_new();
    sheets.forEach(function (sh) {
      var aoa = [sh.cols].concat(sh.rows.map(function (r) { return sh.cols.map(function (c) { return excelCell(c, r[c]); }); }));
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = sh.cols.map(function (c) { return { wch: Math.max(/^\d\d$/.test(c) ? 4 : 10, Math.min(30, c.length + 3)) }; });
      XLSX.utils.book_append_sheet(wb, ws, sheetName(sh.name));
    });
    XLSX.writeFile(wb, filename);
  }
  function sheetName(t) { return t.replace(/[\\\/\?\*\[\]:]/g, "").replace(/\s+/g, " ").trim().slice(0, 31); }
  function slug(t) { return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9]+/g, ""); }
  function templateSheet(key) { var d = ALL[key]; return { name: d.ten, cols: d.cols, rows: SAMPLES[key] || [] }; }
  function downloadTemplate(key) {
    var d = ALL[key];
    var guide = [{ "Cột": "Cách dùng", "Giải thích": "Xóa dòng ví dụ rồi nhập dữ liệu thật của bạn. KHÔNG đổi tên cột (dòng 1). Có thể bỏ bớt cột không dùng." }];
    if (d.hint) guide.push({ "Cột": "Lưu ý", "Giải thích": d.hint });
    guide.push({ "Cột": "Ngày tháng", "Giải thích": "Nhập kiểu ngày Excel bình thường hoặc 2026-09-15." });
    guide.push({ "Cột": "Nhập vào app", "Giải thích": "Mở app → mục \"" + d.ten + "\" → nút ⬆ Nhập Excel → chọn file này." });
    saveXlsx("Mau_" + slug(d.ten) + ".xlsx", [templateSheet(key), { name: "Hướng dẫn", cols: ["Cột", "Giải thích"], rows: guide }]);
  }
  function downloadAllTemplates() { saveXlsx("Mau_TatCa_LuongHAK.xlsx", Object.keys(ALL).map(templateSheet)); toast("Đã tải file mẫu — mỗi bảng là 1 sheet"); }

  // ---------- Trung tâm nhập Excel: đọc → chuẩn hóa → kiểm tra → xem trước → xác nhận → ghi ----------
  function lockedMap() { var m = {}; db.kyluong.forEach(function (k) { m[k.ky] = true; }); return m; }
  function readWorkbook(cb) {
    var f = h("input", { type: "file", accept: ".xlsx,.xls,.csv,.txt" });
    f.addEventListener("change", function () {
      var file = f.files[0]; if (!file) return;
      // Giảm rủi ro thư viện đọc Excel (SheetJS 0.18.5 có lỗ hổng khi đọc file độc hại — xem docs/AUDIT_REPORT.md SEC-03)
      if (file.size > 20 * 1024 * 1024) { alert("File quá lớn (" + Math.round(file.size / 1048576) + " MB). Giới hạn 20 MB — hãy tách file."); return; }
      var fr = new FileReader();
      fr.onload = function () { try { cb(XLSX.read(fr.result, { type: "array", cellDates: true }), file.name); } catch (e) { alert("Không đọc được file: " + e.message); } };
      fr.readAsArrayBuffer(file);
    });
    f.click();
  }
  // Thứ tự nhập: danh mục → nhân viên → hồ sơ con → dữ liệu phát sinh (để kiểm tra tham chiếu Mã NV đúng)
  function importOrder(keys) { var rank = function (k) { return /^dm_/.test(k) ? 0 : k === "nhanvien" ? 1 : HRT[k] ? 2 : 3; }; return keys.slice().sort(function (a, b) { return rank(a) - rank(b); }); }
  function planWorkbook(wb, onlyKey) {
    var plans = [], extraEmp = {};
    var keys = onlyKey ? [onlyKey] : importOrder(Object.keys(ALL));
    keys.forEach(function (k) {
      var name = wb.SheetNames.filter(function (x) { return x === sheetName(ALL[k].ten); })[0];
      if (!name && onlyKey) name = wb.SheetNames[0];
      if (!name) return;
      var raw = XLSX.utils.sheet_to_json(wb.Sheets[name], { raw: true, defval: "" });
      var p = IMP.plan(db, k, ALL[k].cols, raw, { lockedPeriods: lockedMap(), defaultKy: kyStr(), extraEmployees: extraEmp });
      p.sheet = name;
      if (k === "nhanvien") p.items.forEach(function (it) { if (it.action === "add" || it.action === "update") extraEmp[it.row["Mã NV"]] = 1; });
      plans.push(p);
    });
    return plans;
  }
  function importPreview(plans, fileName, done) {
    if (!plans.length) { alert("Không thấy sheet nào đúng tên (Nhân viên, Chấm công, Mã lương...). Hãy dùng file mẫu của app."); return; }
    var body = h("div"), tot = { add: 0, update: 0, duplicate: 0, invalid: 0, refError: 0, locked: 0 };
    plans.forEach(function (p) { Object.keys(tot).forEach(function (k) { tot[k] += p.summary[k]; }); });
    body.appendChild(h("div", { class: "hint", html: "File <b>" + esc(fileName) + "</b> — kiểm tra trước khi ghi. Chỉ dòng <b>Thêm mới</b> và <b>Cập nhật</b> được ghi; các dòng lỗi/trùng/kỳ đã chốt bị bỏ qua." }));
    var sumRows = plans.map(function (p) { var o = { "Bảng": ALL[p.table].ten, "Sheet": p.sheet }; Object.keys(IMP.LABEL).forEach(function (k) { o[IMP.LABEL[k]] = p.summary[k]; }); return o; });
    body.appendChild(simpleTable(sumRows));
    var errs = [];
    plans.forEach(function (p) { p.items.forEach(function (it) { if (["invalid", "refError", "locked", "duplicate"].indexOf(it.action) >= 0) errs.push({ "Bảng": ALL[p.table].ten, "Dòng Excel": it.line, "Phân loại": IMP.LABEL[it.action], "Lý do": it.reason, "Mã NV": it.row["Mã NV"] || "" }); }); });
    if (errs.length) { body.appendChild(h("div", { class: "fh", text: "Các dòng không được ghi (" + errs.length + ")" })); body.appendChild(simpleTable(errs.slice(0, 200))); if (errs.length > 200) body.appendChild(h("div", { class: "hint", text: "… và " + (errs.length - 200) + " dòng nữa — bấm 'Tải danh sách lỗi' để xem đủ." })); }
    var nWrite = tot.add + tot.update;
    modal("Xem trước nhập Excel", body, function (close) {
      return [
        errs.length ? btn("⬇ Tải danh sách lỗi", "", function () { saveXlsx("LoiNhapExcel.xlsx", [{ name: "Loi", cols: Object.keys(errs[0]), rows: errs }]); }) : null,
        btn("Hủy", "", close),
        btn(nWrite ? "✔ Ghi " + nWrite + " dòng" : "Không có dòng nào để ghi", "pri", function () {
          if (!nWrite) { close(); return; }
          if (nWrite >= 20) backupNow("truoc-nhap-excel");
          var n = 0; plans.forEach(function (p) { n += IMP.apply(db, p, HRM.uid, !!(ALL[p.table] && ALL[p.table].hr)); });
          audit("Nhập Excel", fileName + ": " + plans.map(function (p) { return p.table + " +" + p.summary.add + "/~" + p.summary.update; }).join(", "));
          var ok = saveNow(); close(); (done || render)();
          toast(ok ? "Đã ghi " + n + " dòng (" + tot.add + " mới, " + tot.update + " cập nhật)" : "⚠ Đã nhập nhưng CHƯA lưu được xuống đĩa!");
        })];
    });
  }
  function importFile(key, done) { readWorkbook(function (wb, name) { importPreview(planWorkbook(wb, key), name, done); }); }
  function importAllFile() { readWorkbook(function (wb, name) { importPreview(planWorkbook(wb, null), name, render); }); }

  function modal(title, body, footer) {
    var m = $("#modal"); m.innerHTML = ""; m.className = "";
    var close = function () { m.className = "hide"; m.innerHTML = ""; };
    var d = h("div", { class: "dlg" }, [h("header", {}, [h("h3", { text: title }), btn("✕", "ghost", close)]), h("div", { class: "bd" }, [body]), footer ? h("footer", {}, footer(close)) : null]);
    m.appendChild(d); m.onclick = function (e) { if (e.target === m) close(); };
    return close;
  }
  // Hộp nhập chữ của app (Electron KHÔNG hỗ trợ window.prompt — trả về null nên các nút dùng prompt sẽ không chạy)
  function askText(title, message, opts, cb) {
    opts = opts || {};
    var body = h("div"), inp = h(opts.multiline ? "textarea" : "input", { class: "i", style: "width:100%", placeholder: opts.placeholder || "" });
    if (opts.type) inp.type = opts.type;
    inp.value = opts.value || "";
    String(message || "").split("\n").forEach(function (ln) { body.appendChild(h("div", { class: ln.trim() ? "" : "hint", text: ln || " ", style: "margin:2px 0" })); });
    body.appendChild(h("div", { class: "fld", style: "margin-top:10px" }, [h("label", { text: (opts.label || "Nội dung") + (opts.required ? " *" : "") }), inp]));
    var closeFn = modal(title, body, function (close) {
      return [btn("Hủy", "", close), btn(opts.okText || "Đồng ý", "pri", function () {
        var v = inp.value.trim();
        if (opts.required && !v) { inp.focus(); toast("Vui lòng nhập " + (opts.label || "nội dung")); return; }
        if (opts.pattern && v && !opts.pattern.test(v)) { inp.focus(); toast(opts.patternMsg || "Giá trị không hợp lệ"); return; }
        close(); cb(v);
      })];
    });
    setTimeout(function () { inp.focus(); }, 30);
    return closeFn;
  }
  function countOf(k) { return db[k] ? db[k].length : 0; }

  // ---------- Ô nhập dùng chung ----------
  function datalistFor(col) {
    var src = { "Mã PB": ["dm_phongban", "Mã phòng ban"], "Mã CV": ["dm_chucvu", "Mã chức vụ"], "Mã tiền lương 1": ["dm_luong", "Mã lương"], "Mã tiền lương 2": ["dm_luong", "Mã lương"], "Mã tăng ca": ["dm_tangca", "Mã tăng ca"], "Mã phụ cấp": ["dm_phucap", "Mã phụ cấp"], "Mã hỗ trợ": ["dm_hotro", "Mã hỗ trợ"], "Mã hỗ trợ 2": ["dm_hotro", "Mã hỗ trợ"], "Mã BHXH": ["dm_baohiem", "Mã bảo hiểm"], "Mã GT_TNCN_BT": ["dm_giamtru", "Mã giảm trừ"], "Mã GT_TNCN_PT": ["dm_giamtru", "Mã giảm trừ"], "Mã TNCN": null };
    if (col === "Mã TNCN") return ["TNCN0", "TNCN1", "TNCN2"];
    if (col === "Hình thức công") { var hs = db.dm_cc.map(function (r) { return r["Hình thức công"]; }).filter(Boolean); return hs.length ? hs.filter(function (v, i) { return hs.indexOf(v) === i; }) : ["BT", "CL", "PN", "CC", "TC", "DC", "TRCH"]; }
    if (col === "Mã hình thức lương") return ["LTG", "LSP"];
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
    dl.innerHTML = ""; db.nhanvien.forEach(function (r) { dl.appendChild(h("option", { value: r["Mã NV"], label: r["Họ và tên"] || "" })); });
  }

  // ---------- Bảng nhập liệu ----------
  function grid(key, def) {
    var wrap = h("div"), card = h("div", { class: "card" }), bar = h("div", { class: "bar" }), body = h("div", { class: "tw" });
    var theoKy = !!(def.kyCol || def.dateCol), cnt = h("span", { class: "hint", style: "margin:0" });
    var locked = theoKy && !!kyChot(kyStr());
    var q = h("input", { class: "i search", placeholder: "🔍 Tìm trong bảng...", value: st.q });
    q.addEventListener("input", function () { st.q = q.value; draw(); q.focus(); });
    var newRow = function () { var r = Object.assign({}, def.def || {}); if (def.kyCol) r[def.kyCol] = kyStr(); if (def.dateCol) r[def.dateCol] = kyStr() + "-01"; return r; };
    if (!locked) bar.appendChild(btn("＋ Thêm dòng", "pri", function () { db[key].push(newRow()); save(); st.q = ""; q.value = ""; draw(); var tw = body; tw.scrollTop = tw.scrollHeight; }));
    bar.appendChild(q); bar.appendChild(cnt); bar.appendChild(h("span", { class: "sp" }));
    bar.appendChild(btn("📄 Tải file mẫu", "", function () { downloadTemplate(key); }, "File Excel mẫu có sẵn tên cột + dòng ví dụ"));
    if (!locked) bar.appendChild(btn("⬆ Nhập Excel", "", function () { importFile(key, draw); }, "Nhập từ file .xlsx / .xls / .csv"));
    bar.appendChild(btn("⬇ Xuất Excel", "", function () { var rows = db[key].filter(function (r) { return !theoKy || rowInKy(r, def); }); saveXlsx(slug(def.ten) + (theoKy ? "_" + kyStr() : "") + ".xlsx", [{ name: def.ten, cols: def.cols, rows: rows }]); }));
    card.appendChild(bar);
    if (locked) card.appendChild(h("div", { class: "locked", html: "🔒 <b>" + kyLabel(kyStr()) + " đã chốt lương</b> — dữ liệu kỳ này chỉ xem, không sửa được. Muốn sửa: vào <b>Kỳ lương đã chốt</b> → Mở chốt." }));
    card.appendChild(h("div", { class: "hint", text: (def.hint ? def.hint + " " : "") + "Nhập hàng loạt: bấm '📄 Tải file mẫu' → điền Excel → '⬆ Nhập Excel'. Hoặc copy nhiều dòng từ Excel rồi Ctrl+V vào một ô." }));
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
          var inp = makeInput(c, r[c], function (v) {
            var n = VAL.normCell(c, v);
            if (n.error) { toast("⚠ " + c + ": " + n.error); inp.value = r[c] == null ? "" : r[c]; return; }
            var test = Object.assign({}, r); test[c] = n.value;
            var p2 = VAL.rowPeriod(key, test);
            if (p2 && kyChot(p2)) { alert("Không thể chuyển dòng này sang " + kyLabel(p2) + " vì kỳ đó đã chốt lương."); inp.value = r[c] == null ? "" : r[c]; return; }
            r[c] = n.value; if (inp.value !== n.value && !isDay) inp.value = n.value;
            save(); if (c === "Mã NV" && nameTd) nameTd.textContent = tenNV(n.value) || (n.value ? "⚠ chưa có trong Nhân sự" : ""); if (isDay) updTot();
          });
          inp.addEventListener("paste", function (ev) {
            var txt = (ev.clipboardData || window.clipboardData).getData("text");
            if (txt.indexOf("\t") < 0 && txt.indexOf("\n") < 0) return;
            ev.preventDefault();
            var lines = txt.replace(/\r/g, "").replace(/\n$/, "").split("\n"), start = def.cols.indexOf(c);
            var bad = 0, skip = 0;
            lines.forEach(function (ln, li) {
              var tgt = idx[n + li], cand = tgt == null ? newRow() : Object.assign({}, db[key][tgt]);
              ln.split("\t").forEach(function (v, k) { var col = def.cols[start + k]; if (col && col !== def.kyCol) { var nc = VAL.normCell(col, v); if (nc.error) bad++; cand[col] = nc.value; } });
              var pp = VAL.rowPeriod(key, cand); if (pp && kyChot(pp)) { skip++; return; }
              if (tgt == null) { db[key].push(cand); idx.push(db[key].length - 1); } else Object.assign(db[key][tgt], cand);
            });
            save(); draw(); toast("Đã dán " + (lines.length - skip) + " dòng" + (skip ? " · bỏ qua " + skip + " dòng thuộc kỳ đã chốt" : "") + (bad ? " · " + bad + " ô sai định dạng, kiểm tra lại" : ""));
          });
          if (locked) inp.disabled = true;
          var td = h("td", { class: cls }, [inp]); if (inp._dl) td.appendChild(inp._dl);
          tr.appendChild(td);
          if (c === "Mã NV" && def.showName) { var nm = tenNV(r["Mã NV"]); nameTd = h("td", { class: "dis", text: nm || (r["Mã NV"] ? "⚠ chưa có trong Nhân sự" : "") }); tr.appendChild(nameTd); }
        });
        if (def.total) { updTot(); tr.appendChild(tot); }
        tr.appendChild(h("td", { style: "text-align:center" }, [locked ? null : btn("✕", "red ghost", function () { if (confirm("Xóa dòng này?")) { db[key].splice(ri, 1); save(); draw(); updateNav(); } }, "Xóa dòng")]));
        tb.appendChild(tr);
      });
      t.appendChild(tb); body.appendChild(t);
      updateNav();
    }
    draw();
    return wrap;
  }

  // ---------- NHÂN SỰ (mô hình QL_NHANSU) ----------
  var HR = HRM.HR;
  function refOptions(ref) {
    var c = HRM.REFS[ref], seen = {}, out = [];
    (db[ref] || []).forEach(function (r) { var v = r[c[0]]; if (v && !seen[v]) { seen[v] = 1; out.push([v, r[c[1]] || ""]); } });
    return out;
  }
  function dispVal(f, v) {
    if (v === "" || v == null) return "";
    if (f.t === "ref") return v + (HRM.refName(db, f.ref, v) !== v ? " — " + HRM.refName(db, f.ref, v) : "");
    if (f.t === "multi") return HRM.split(v).join(", ");
    if (f.t === "money") return fmt(E.money(v));
    if (f.t === "date") { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v)); if (m) return m[3] + "/" + m[2] + "/" + m[1]; }
    return String(v);
  }
  // Tạo các ô nhập cho danh sách field; trả về hàm lấy dữ liệu
  function fieldInputs(container, fields, data) {
    var getters = {};
    fields.forEach(function (f) {
      var v = data[f.k] == null ? "" : String(data[f.k]), el, wrap = h("div", { class: "fld" + (f.t === "area" || f.t === "multi" ? " wide" : "") });
      wrap.appendChild(h("label", { text: (f.label || f.k) + (f.req ? " *" : "") + (f.hint ? " — " + f.hint : "") }));
      if (f.t === "sel" || f.t === "yesno" || f.t === "ref") {
        el = h("select");
        el.appendChild(h("option", { value: "", text: "— chọn —" }));
        var opts = f.t === "ref" ? refOptions(f.ref) : (f.t === "yesno" ? [["Có", ""], ["Không", ""]] : f.o.map(function (o) { return [o, ""]; }));
        if (v && !opts.some(function (o) { return o[0] === v; })) opts.push([v, "(không có trong danh mục)"]);
        opts.forEach(function (o) { el.appendChild(h("option", { value: o[0], text: o[1] ? o[0] + " — " + o[1] : o[0] })); });
        el.value = v;
        getters[f.k] = function () { return el.value; };
      } else if (f.t === "multi") {
        el = h("div", { class: "chips" });
        var cur = HRM.split(v), opts2 = refOptions(f.ref);
        cur.forEach(function (c) { if (!opts2.some(function (o) { return o[0] === c; })) opts2.push([c, "(không có trong danh mục)"]); });
        var boxes = opts2.map(function (o) {
          var cb = h("input", { type: "checkbox", value: o[0] }); cb.checked = cur.indexOf(o[0]) >= 0;
          el.appendChild(h("label", { class: "chip" }, [cb, document.createTextNode(" " + o[0] + (o[1] ? " — " + o[1] : ""))]));
          return cb;
        });
        if (!opts2.length) el.appendChild(h("span", { class: "hint", text: "Danh mục trống — vào Danh mục để thêm" }));
        getters[f.k] = function () { return boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; }).join(", "); };
      } else if (f.t === "area") {
        el = h("textarea", { rows: 2 }); el.value = v; getters[f.k] = function () { return el.value.trim(); };
      } else {
        el = h("input", { value: v });
        if (f.t === "date") el.type = "date";
        if (f.t === "num" || f.t === "money" || f.t === "pct") el.className = "num";
        if (f.t === "money") { el.addEventListener("blur", function () { var n = VAL.parseMoney(el.value); if (el.value && !isNaN(n)) el.value = fmt(n); }); if (v) { var n0v = VAL.parseMoney(v); el.value = isNaN(n0v) ? v : fmt(n0v); } }
        getters[f.k] = function () { var x = el.value.trim(); return f.t === "money" && x ? VAL.normMoney(x) : x; };
      }
      wrap.appendChild(el); container.appendChild(wrap);
    });
    return function () { var o = {}; Object.keys(getters).forEach(function (k) { o[k] = getters[k](); }); return o; };
  }
  function missingReq(fields, data) { return fields.filter(function (f) { return f.req && !data[f.k]; }).map(function (f) { return f.label || f.k; }); }

  function hrForm(key, row, base, onDone) {
    var cfg = HR[key], isNew = !row, data = Object.assign({}, base || {}, row || {});
    if (isNew && cfg.defaults) Object.assign(data, cfg.defaults(base));
    var body = h("div");
    if (cfg.desc) body.appendChild(h("div", { class: "hint", text: cfg.desc }));
    var g = h("div", { class: "fgrid" }); body.appendChild(g);
    var get = fieldInputs(g, cfg.f, data);
    modal((isNew ? "Thêm: " : "Sửa: ") + cfg.ten, body, function (close) {
      return [btn("Hủy", "", close), btn("💾 Lưu", "pri", function () {
        var d = get(), miss = missingReq(cfg.f, d);
        if (miss.length) { alert("Cần nhập: " + miss.join(", ")); return; }
        var bad = cfg.f.filter(function (f) { return f.t === "money" && d[f.k] && isNaN(VAL.parseMoney(d[f.k])); }).map(function (f) { return f.label || f.k; });
        if (bad.length) { alert("Số tiền không hợp lệ: " + bad.join(", ")); return; }
        var dupKey = IMP.keyOf(key, Object.assign({}, base || {}, d));
        if (dupKey && db[key].some(function (r) { return r !== row && IMP.keyOf(key, r) === dupKey; })) { alert("Đã có bản ghi trùng (" + IMP.KEYS[key].join(" + ") + "). Hãy sửa bản ghi đó thay vì thêm mới."); return; }
        if (key === "hopdong") {
          var dup = db.hopdong.some(function (r) { return r !== row && r["Mã NV"] === data["Mã NV"] && r["Số HĐLĐ"] === d["Số HĐLĐ"]; });
          if (dup) { alert("Số HĐLĐ này đã có"); return; }
          if (row && row["Số HĐLĐ"] !== d["Số HĐLĐ"]) HRM.HD_TABS.forEach(function (k) { (db[k] || []).forEach(function (r) { if (r["Mã NV"] === row["Mã NV"] && r["Số HĐLĐ"] === row["Số HĐLĐ"]) r["Số HĐLĐ"] = d["Số HĐLĐ"]; }); });
        }
        if (isNew) db[key].push(Object.assign({ _id: HRM.uid() }, base || {}, d)); else Object.assign(row, d);
        save(); close(); toast("Đã lưu"); (onDone || render)();
      })];
    });
  }
  // Mặc định khi thêm mới phụ lục: chép từ phụ lục gần nhất
  HR.chitiethd.defaults = function (base) {
    var prev = (db.chitiethd || []).filter(function (r) { return r["Mã NV"] === base["Mã NV"] && r["Số HĐLĐ"] === base["Số HĐLĐ"]; })
      .sort(function (a, b) { return String(a["Hiệu lực từ"]) < String(b["Hiệu lực từ"]) ? -1 : 1; });
    var last = prev[prev.length - 1], o = last ? Object.assign({}, last) : {};
    delete o._id; delete o["Ghi chú"];
    o["Loại phụ lục"] = last ? "Phụ lục sửa đổi" : "Hợp đồng gốc";
    o["Mã công tác"] = base["Số HĐLĐ"] + "-PL" + ("0" + (prev.length + 1)).slice(-2);
    o["Hiệu lực từ"] = last ? HRM.today() : ((db.hopdong.filter(function (r) { return r["Mã NV"] === base["Mã NV"] && r["Số HĐLĐ"] === base["Số HĐLĐ"]; })[0] || {})["Ngày vào làm"] || HRM.today());
    if (!last) { o["HTTT"] = "Chuyển khoản"; o["Mã hình thức lương"] = "LTG"; }
    return o;
  };
  HR.hopdong.defaults = function (base) {
    var n = db.hopdong.filter(function (r) { return r["Mã NV"] === base["Mã NV"]; }).length + 1;
    return { "Số HĐLĐ": base["Mã NV"] + "/HĐ" + ("0" + n).slice(-2), "Ngày vào làm": HRM.today(), "Hình thức HĐLĐ": n === 1 ? "Thử việc" : "Xác định thời hạn" };
  };

  function subTable(key, base, opts) {
    opts = opts || {};
    var cfg = HR[key], rows = (db[key] || []).filter(function (r) { return Object.keys(base).every(function (k) { return r[k] === base[k]; }); });
    var dateF = cfg.cols.filter(function (c) { return /Hiệu lực từ|Ngày vào làm|Từ ngày|^Ngày/.test(c); })[0];
    if (dateF) rows.sort(function (a, b) { return String(a[dateF] || "") < String(b[dateF] || "") ? 1 : -1; });
    var card = h("div", { class: "card" });
    var bar = h("div", { class: "bar" }, [h("h3", { text: cfg.icon + " " + cfg.ten, style: "margin:0" }), h("span", { class: "sp" }), btn("＋ Thêm", "pri", function () { hrForm(key, null, base); })]);
    card.appendChild(bar);
    if (cfg.desc) card.appendChild(h("div", { class: "hint", text: cfg.desc }));
    if (!rows.length) { card.appendChild(h("div", { class: "empty", style: "padding:16px", text: "Chưa có dữ liệu." })); return card; }
    var fmap = {}; cfg.f.forEach(function (f) { fmap[f.k] = f; });
    var t = h("table"), tr = h("tr");
    cfg.cols.forEach(function (c) { tr.appendChild(h("th", { class: fmap[c] && fmap[c].t === "money" ? "r" : "", text: (fmap[c] && fmap[c].label) || c })); });
    tr.appendChild(h("th", { text: "" })); t.appendChild(h("thead", {}, [tr]));
    var tb = h("tbody");
    rows.forEach(function (r, i) {
      var x = h("tr", { class: "click" + (opts.selected && opts.selected === r ? " sel" : ""), on: { click: function () { if (opts.onPick) opts.onPick(r); else hrForm(key, r, base); } } });
      cfg.cols.forEach(function (c) { var f = fmap[c] || {}; x.appendChild(h("td", { class: f.t === "money" ? "r" : "t", text: dispVal(f, r[c]) })); });
      var acts = h("td", { style: "text-align:right;white-space:nowrap" });
      if (opts.onPick) acts.appendChild(btn("✎", "ghost", function (ev) { ev.stopPropagation(); hrForm(key, r, base); }, "Sửa"));
      acts.appendChild(btn("✕", "red ghost", function (ev) {
        ev.stopPropagation();
        if (!confirm("Xóa dòng này?" + (key === "hopdong" ? "\nToàn bộ phụ lục lương, nghỉ phép… của hợp đồng này cũng bị xóa." : ""))) return;
        db[key].splice(db[key].indexOf(r), 1);
        if (key === "hopdong") HRM.HD_TABS.forEach(function (k) { db[k] = (db[k] || []).filter(function (y) { return !(y["Mã NV"] === r["Mã NV"] && y["Số HĐLĐ"] === r["Số HĐLĐ"]); }); });
        save(); render();
      }, "Xóa"));
      x.appendChild(acts); tb.appendChild(x);
    });
    t.appendChild(tb); card.appendChild(h("div", { class: "tw", style: "max-height:none" }, [t]));
    return card;
  }

  function nextMaNV() {
    var max = 0, pre = "NV", w = 3;
    db.nhanvien.forEach(function (r) { var m = String(r["Mã NV"] || "").match(/^(\D*)(\d+)$/); if (m && +m[2] >= max) { max = +m[2]; pre = m[1]; w = m[2].length; } });
    return pre + String(max + 1).padStart(w, "0");
  }

  // Thêm nhân viên mới: 1 form gồm thông tin cơ bản + cá nhân + hợp đồng + lương + tài khoản
  function wizardNV() {
    var ma = nextMaNV(), body = h("div");
    var sec = function (title) { body.appendChild(h("div", { class: "fh", text: title })); var g = h("div", { class: "fgrid" }); body.appendChild(g); return g; };
    var pick = function (key, names) { return HR[key].f.filter(function (f) { return names.indexOf(f.k) >= 0; }); };
    var fBase = HR.nhanvien.f.filter(function (f) { return f.k !== "Số CCCD" && f.k !== "Ngày tạo hồ sơ"; });
    var fCN = pick("canhan", ["Số CCCD", "Ngày cấp", "Nơi cấp", "Ngày sinh", "Giới tính", "Số điện thoại", "Thường trú", "Địa chỉ hiện tại"]);
    var fHD = pick("hopdong", ["Số HĐLĐ", "Hình thức HĐLĐ", "Ngày vào làm", "Ngày hết hạn"]);
    var fCT = HR.chitiethd.f.filter(function (f) { return ["Mã công tác", "Loại phụ lục", "Hiệu lực từ", "Ghi chú"].indexOf(f.k) < 0; });
    var fTK = pick("thanhtoan", ["Số tài khoản", "Tên ngân hàng", "Chi nhánh"]);
    var gB = fieldInputs(sec("1. Thông tin cơ bản"), fBase, { "Mã NV": ma, "Trạng thái": "Đang làm việc" });
    var gC = fieldInputs(sec("2. Thông tin cá nhân"), fCN, {});
    var gH = fieldInputs(sec("3. Hợp đồng lao động"), fHD, { "Số HĐLĐ": ma + "/HĐ01", "Hình thức HĐLĐ": "Thử việc", "Ngày vào làm": HRM.today() });
    var gL = fieldInputs(sec("4. Lương, bảo hiểm, thuế"), fCT, { "HTTT": "Chuyển khoản", "Mã hình thức lương": "LTG", "Mức đóng bảo hiểm": "BH01", "Thuế TNCN": "LT01" });
    var gT = fieldInputs(sec("5. Tài khoản nhận lương (nếu chuyển khoản)"), fTK, {});
    body.appendChild(h("div", { class: "hint", text: "Các mục khác (nhân thân/người phụ thuộc, học vấn, nghỉ phép…) bổ sung sau trong hồ sơ nhân viên." }));
    modal("Thêm nhân viên mới", body, function (close) {
      return [btn("Hủy", "", close), btn("💾 Lưu nhân viên", "pri", function () {
        var b = gB(), c = gC(), hd = gH(), l = gL(), tk = gT();
        var miss = missingReq(fBase, b).concat(missingReq(fHD, hd), missingReq(fCT, l));
        if (miss.length) { alert("Cần nhập: " + miss.join(", ")); return; }
        if (db.nhanvien.some(function (r) { return r["Mã NV"] === b["Mã NV"]; })) { alert("Mã NV đã tồn tại"); return; }
        var m = b["Mã NV"], vao = hd["Ngày vào làm"];
        db.nhanvien.push(Object.assign({ _id: HRM.uid(), "Ngày tạo hồ sơ": HRM.today(), "Số CCCD": c["Số CCCD"] }, b));
        if (Object.keys(c).some(function (k) { return c[k]; })) db.canhan.push(Object.assign({ _id: HRM.uid(), "Mã NV": m, "Hiệu lực từ": vao }, c));
        db.hopdong.push(Object.assign({ _id: HRM.uid(), "Mã NV": m }, hd));
        db.chitiethd.push(Object.assign({ _id: HRM.uid(), "Mã NV": m, "Số HĐLĐ": hd["Số HĐLĐ"], "Mã công tác": hd["Số HĐLĐ"] + "-PL01", "Loại phụ lục": "Hợp đồng gốc", "Hiệu lực từ": vao }, l));
        if (tk["Số tài khoản"]) db.thanhtoan.push(Object.assign({ _id: HRM.uid(), "Mã NV": m, "Hiệu lực từ": vao }, tk));
        save(); close(); st.tab = "nv"; st.nv = m; st.nvTab = "canhan"; render(); toast("Đã thêm nhân viên " + b["Họ và tên"]);
      })];
    });
  }

  function editBaseNV(nv) {
    var body = h("div"), g = h("div", { class: "fgrid" }); body.appendChild(g);
    var get = fieldInputs(g, HR.nhanvien.f, nv);
    modal("Sửa thông tin cơ bản", body, function (close) {
      return [btn("Hủy", "", close), btn("💾 Lưu", "pri", function () {
        var d = get(), miss = missingReq(HR.nhanvien.f, d);
        if (miss.length) { alert("Cần nhập: " + miss.join(", ")); return; }
        var old = nv["Mã NV"];
        if (d["Mã NV"] !== old) {
          if (db.nhanvien.some(function (r) { return r !== nv && r["Mã NV"] === d["Mã NV"]; })) { alert("Mã NV đã tồn tại"); return; }
          if (!confirm("Đổi Mã NV " + old + " → " + d["Mã NV"] + "? App sẽ đổi theo ở mọi hồ sơ, chấm công, sản lượng…")) return;
          Object.keys(db).forEach(function (k) { if (Array.isArray(db[k])) db[k].forEach(function (r) { if (r && r !== nv && r["Mã NV"] === old) r["Mã NV"] = d["Mã NV"]; }); });
          st.nv = d["Mã NV"];
        }
        Object.assign(nv, d); save(); close(); render();
      })];
    });
  }
  function nghiViec(nv) {
    var hh = HRM.hienHanh(db, nv["Mã NV"]);
    askText("Cho nghỉ việc — " + nv["Họ và tên"], "Ngày chấm dứt sẽ ghi vào hợp đồng " + (hh.hd ? hh.hd["Số HĐLĐ"] : "(chưa có hợp đồng)") + ". Từ tháng sau ngày này không tính lương.", { label: "Ngày nghỉ việc", type: "date", value: HRM.today(), required: true, okText: "Cho nghỉ việc" }, function (d) {
      d = VAL.normDate(d); if (!d) { alert("Ngày không hợp lệ"); return; }
      nv["Trạng thái"] = "Đã nghỉ việc";
      if (hh.hd) hh.hd["Ngày chấm dứt"] = d;
      audit("Cho nghỉ việc", nv["Mã NV"] + " từ " + d);
      save(); render(); toast("Đã cho nghỉ việc từ " + d + " — tháng sau sẽ không tính lương");
    });
  }

  function tabNhanVien() {
    var nv = db.nhanvien.filter(function (r) { return r["Mã NV"] === st.nv; })[0];
    if (!nv) { st.tab = "nhansu"; return tabNhanSu(); }
    var ma = nv["Mã NV"], hh = HRM.hienHanh(db, ma), w = h("div");
    var head = h("div", { class: "card nvhead" });
    head.appendChild(h("div", { class: "bar", style: "margin:0" }, [
      btn("← Danh sách", "", function () { st.tab = "nhansu"; render(); }),
      h("div", { class: "avatar", text: String(nv["Họ và tên"] || "?").trim().split(/\s+/).pop().charAt(0).toUpperCase() }),
      h("div", { html: "<b style='font-size:18px'>" + esc(nv["Họ và tên"]) + "</b> <span class='tag " + (nv["Trạng thái"] === "Đã nghỉ việc" ? "off" : "on") + "'>" + esc(nv["Trạng thái"] || "") + "</span><br><span class='hint' style='margin:0'>" +
        esc(ma) + (hh.tenPB ? " · " + esc(hh.tenPB) : "") + (hh.tenCV ? " · " + esc(hh.tenCV) : "") + (hh.hd ? " · HĐ " + esc(hh.hd["Số HĐLĐ"]) + " (" + esc(hh.hd["Hình thức HĐLĐ"] || "") + ")" : " · chưa có hợp đồng") +
        (hh.ct ? " · Lương " + fmt(E.money(hh.ct["Lương thỏa thuận"])) : "") + "</span>" }),
      h("span", { class: "sp" }),
      btn("✎ Sửa cơ bản", "", function () { editBaseNV(nv); }),
      btn("🕘 Lịch sử", "", function () { st.tab = "baocao"; st.bc = "lichsu"; st.bcNV = ma; render(); }),
      nv["Trạng thái"] !== "Đã nghỉ việc" ? btn("Cho nghỉ việc", "", function () { nghiViec(nv); }) : null,
      btn("🗑", "red", function () {
        if (!confirm("XÓA hẳn nhân viên " + nv["Họ và tên"] + " và toàn bộ hồ sơ (không xóa chấm công/sản lượng)?")) return;
        Object.keys(HR).forEach(function (k) { db[k] = (db[k] || []).filter(function (r) { return r["Mã NV"] !== ma; }); });
        save(); st.tab = "nhansu"; render();
      }, "Xóa nhân viên")]));
    w.appendChild(head);
    var warn = [];
    if (!hh.hd) warn.push("Chưa có <b>hợp đồng lao động</b> → chưa tính lương được. Vào tab Hợp đồng để thêm.");
    else if (!hh.ct) warn.push("Hợp đồng chưa có dòng <b>Lương & phụ lục HĐ</b> → chưa tính lương được.");
    if (warn.length) w.appendChild(h("div", { class: "warn", html: warn.join("<br>") }));
    var tabs = h("div", { class: "subtabs" });
    st.nvTab = st.nvTab || "canhan";
    HRM.NV_TABS.forEach(function (k) {
      var n = (db[k] || []).filter(function (r) { return r["Mã NV"] === ma; }).length;
      tabs.appendChild(h("button", { class: st.nvTab === k ? "on" : "", on: { click: function () { st.nvTab = k; render(); } } }, [document.createTextNode(HR[k].icon + " " + HR[k].ten), n ? h("span", { class: "n", text: n }) : null]));
    });
    w.appendChild(tabs);
    if (st.nvTab !== "hopdong") { w.appendChild(subTable(st.nvTab, { "Mã NV": ma })); return w; }
    // Tab hợp đồng: danh sách HĐ + mục con của HĐ đang chọn
    var hds = db.hopdong.filter(function (r) { return r["Mã NV"] === ma; });
    var cur = hds.filter(function (r) { return r["Số HĐLĐ"] === st.hd; })[0] || hh.hd || hds[0];
    w.appendChild(subTable("hopdong", { "Mã NV": ma }, { selected: cur, onPick: function (r) { st.hd = r["Số HĐLĐ"]; render(); } }));
    if (!cur) return w;
    st.hd = cur["Số HĐLĐ"];
    w.appendChild(h("div", { class: "hint", html: "Mục con của hợp đồng <b>" + esc(cur["Số HĐLĐ"]) + "</b> (bấm vào hợp đồng khác ở bảng trên để chuyển):" }));
    var t2 = h("div", { class: "subtabs" }); st.hdTab = st.hdTab || "chitiethd";
    HRM.HD_TABS.forEach(function (k) {
      var n = (db[k] || []).filter(function (r) { return r["Mã NV"] === ma && r["Số HĐLĐ"] === cur["Số HĐLĐ"]; }).length;
      t2.appendChild(h("button", { class: st.hdTab === k ? "on" : "", on: { click: function () { st.hdTab = k; render(); } } }, [document.createTextNode(HR[k].icon + " " + HR[k].ten), n ? h("span", { class: "n", text: n }) : null]));
    });
    w.appendChild(t2);
    w.appendChild(subTable(st.hdTab, { "Mã NV": ma, "Số HĐLĐ": cur["Số HĐLĐ"] }));
    return w;
  }

  function tabNhanSu() {
    var wrap = h("div"), card = h("div", { class: "card" }), bar = h("div", { class: "bar" });
    var q = h("input", { class: "i search", placeholder: "🔍 Tìm mã, tên, phòng ban...", value: st.q });
    var ft = h("select"); [["", "Tất cả trạng thái"], ["Đang làm việc", "Đang làm việc"], ["Tạm hoãn HĐLĐ", "Tạm hoãn HĐLĐ"], ["Đã nghỉ việc", "Đã nghỉ việc"]].forEach(function (o) { ft.appendChild(h("option", { value: o[0], text: o[1] })); });
    ft.value = st.ft || "";
    q.addEventListener("input", function () { st.q = q.value; draw(); });
    ft.addEventListener("change", function () { st.ft = ft.value; draw(); });
    bar.appendChild(btn("＋ Thêm nhân viên", "pri", wizardNV));
    bar.appendChild(q); bar.appendChild(ft); bar.appendChild(h("span", { class: "sp" }));
    bar.appendChild(btn("📄 Tải file mẫu", "", function () { saveXlsx("Mau_HoSoNhanSu.xlsx", Object.keys(HR).map(templateSheet)); toast("File mẫu có 1 sheet cho mỗi loại hồ sơ"); }, "Mỗi loại hồ sơ là 1 sheet"));
    bar.appendChild(btn("⬆ Nhập Excel", "", importAllFile, "Nhập file Excel nhiều sheet (Nhân viên, Thông tin cá nhân, Hợp đồng…)"));
    bar.appendChild(btn("⬇ Sổ lao động", "", function () { var rows = HRM.reports(db).soLaoDong(); saveXlsx("SoQuanLyLaoDong.xlsx", [{ name: "Sổ quản lý lao động", cols: rows[0] ? Object.keys(rows[0]) : [], rows: rows }]); }));
    card.appendChild(bar);
    card.appendChild(h("div", { class: "hint", text: "Bấm vào một nhân viên để mở hồ sơ đầy đủ (cá nhân, hợp đồng, phụ lục lương, người phụ thuộc, nghỉ phép…). Lương được tính theo phụ lục hợp đồng đang hiệu lực." }));
    var tw = h("div", { class: "tw" }); card.appendChild(tw); wrap.appendChild(card);
    function draw() {
      tw.innerHTML = ""; var qq = st.q.trim().toLowerCase();
      var rows = db.nhanvien.map(function (r) { return { r: r, hh: HRM.hienHanh(db, r["Mã NV"]) }; }).filter(function (x) {
        if (st.ft && x.r["Trạng thái"] !== st.ft) return false;
        return !qq || [x.r["Mã NV"], x.r["Họ và tên"], x.hh.tenPB, x.hh.tenCV].join(" ").toLowerCase().indexOf(qq) >= 0;
      });
      if (!rows.length) { tw.appendChild(h("div", { class: "empty", html: db.nhanvien.length ? "Không tìm thấy." : "Chưa có nhân viên nào.<br>Bấm <b>＋ Thêm nhân viên</b> hoặc nhập từ file Excel." })); return; }
      var cols = ["Mã NV", "Họ và tên", "Phòng ban", "Chức vụ", "Loại HĐ", "Hết hạn HĐ", "Lương thỏa thuận", "Trạng thái"];
      var t = h("table"), tr = h("tr"); cols.forEach(function (c) { tr.appendChild(h("th", { class: c === "Lương thỏa thuận" ? "r" : "", text: c })); });
      t.appendChild(h("thead", {}, [tr])); var tb = h("tbody");
      rows.forEach(function (x) {
        var r = x.r, hd = x.hh.hd || {}, het = hd["Ngày hết hạn"] || "", soon = het && !hd["Ngày chấm dứt"] && het <= new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
        var e = h("tr", { class: "click", on: { click: function () { st.tab = "nv"; st.nv = r["Mã NV"]; st.nvTab = "canhan"; st.hd = null; st.q = ""; render(); } } });
        [r["Mã NV"], r["Họ và tên"], x.hh.tenPB, x.hh.tenCV, hd["Hình thức HĐLĐ"] || "", het].forEach(function (v, i) { e.appendChild(h("td", { class: "t", text: v || "", style: i === 5 && soon ? "color:#c0362c;font-weight:600" : "" })); });
        e.appendChild(h("td", { class: "r", text: x.hh.ct ? fmt(E.money(x.hh.ct["Lương thỏa thuận"])) : "" }));
        e.appendChild(h("td", { class: "t" }, [h("span", { class: "tag " + (r["Trạng thái"] === "Đã nghỉ việc" ? "off" : "on"), text: r["Trạng thái"] || "" })]));
        tb.appendChild(e);
      });
      t.appendChild(tb); tw.appendChild(t);
    }
    draw(); return wrap;
  }

  // ---------- Báo cáo nhân sự ----------
  var BC = [["hethan", "⏰ HĐLĐ sắp hết hạn"], ["tinhhinh", "👥 Tình hình nhân sự"], ["nghi", "🌴 Nghỉ phép / ốm"], ["vipham", "⚠️ Vi phạm chưa xử lý"], ["sinhnhat", "🎂 Sinh nhật trong tháng"], ["solaodong", "📋 Sổ quản lý lao động"], ["lichsu", "🕘 Lịch sử nhân sự"]];
  function simpleTable(rows, moneyCols) {
    if (!rows.length) return h("div", { class: "empty", text: "Không có dữ liệu." });
    var cols = Object.keys(rows[0]), t = h("table"), tr = h("tr");
    cols.forEach(function (c) { tr.appendChild(h("th", { text: c })); }); t.appendChild(h("thead", {}, [tr]));
    var tb = h("tbody");
    rows.forEach(function (r) { var x = h("tr"); cols.forEach(function (c) { var v = r[c]; x.appendChild(h("td", { class: typeof v === "number" ? "r" : "t", text: typeof v === "number" ? fmt(v) : (v == null ? "" : v), style: v === "ĐÃ QUÁ HẠN" ? "color:#c0362c;font-weight:700" : "" })); }); tb.appendChild(x); });
    t.appendChild(tb); return h("div", { class: "tw" }, [t]);
  }
  function tabBaoCao() {
    var w = h("div"), bar = h("div", { class: "bar" }), R = HRM.reports(db);
    st.bc = st.bc || "hethan";
    BC.forEach(function (b) { bar.appendChild(btn(b[1], st.bc === b[0] ? "pri" : "", function () { st.bc = b[0]; render(); })); });
    w.appendChild(bar);
    var card = h("div", { class: "card" }), tools = h("div", { class: "bar" }), rows = [], title = BC.filter(function (b) { return b[0] === st.bc; })[0][1].replace(/^\S+\s/, "");
    card.appendChild(tools);
    if (st.bc === "hethan") {
      var nd = h("select"); [15, 30, 60, 90].forEach(function (n) { nd.appendChild(h("option", { value: n, text: "Trong " + n + " ngày tới" })); });
      nd.value = st.bcDays || 30; nd.addEventListener("change", function () { st.bcDays = +nd.value; render(); });
      tools.appendChild(nd); rows = R.hethan(+(st.bcDays || 30));
      card.appendChild(h("div", { class: "hint", text: "Gồm cả hợp đồng đã quá hạn mà chưa ký tiếp/chưa chấm dứt. Lấy theo 'Ngày hết hạn' của hợp đồng đang hiệu lực." }));
      card.appendChild(simpleTable(rows));
    } else if (st.bc === "tinhhinh") {
      var th = R.tinhhinh(), g = h("div", { class: "kpis" });
      [["Theo trạng thái", th.trangthai], ["Theo phòng ban (đang làm)", th.phongban], ["Theo giới tính (đang làm)", th.gioitinh], ["Theo loại HĐ (đang làm)", th.loaihd]].forEach(function (p) {
        var c = h("div", { class: "kpi" }); c.appendChild(h("small", { text: p[0] }));
        p[1].forEach(function (x) { c.appendChild(h("div", { class: "kv", html: "<span>" + esc(x["Nhóm"]) + "</span><b>" + x["Số người"] + "</b>" })); });
        g.appendChild(c);
        rows = rows.concat(p[1].map(function (x) { return { "Tiêu chí": p[0], "Nhóm": x["Nhóm"], "Số người": x["Số người"] }; }));
      });
      card.appendChild(g);
    } else if (st.bc === "nghi") {
      var yy = h("input", { class: "i", type: "number", value: st.nam, style: "width:90px" }); yy.addEventListener("change", function () { st.nam = +yy.value; render(); });
      tools.appendChild(h("label", { text: "Năm " })); tools.appendChild(yy);
      rows = R.nghi(st.nam);
      card.appendChild(h("div", { class: "hint", text: "Chỉ đếm các lần nghỉ 'Đã duyệt'. Phép được cấp = Số ngày được cấp + cộng dồn năm trước (mục Quyền lợi phép của hợp đồng)." }));
      card.appendChild(simpleTable(rows));
    } else if (st.bc === "vipham") { rows = R.vipham(); card.appendChild(simpleTable(rows)); }
    else if (st.bc === "sinhnhat") { rows = R.sinhnhat(st.thang); card.appendChild(h("div", { class: "hint", text: "Theo kỳ lương đang chọn: tháng " + st.thang })); card.appendChild(simpleTable(rows)); }
    else if (st.bc === "solaodong") { rows = R.soLaoDong(); card.appendChild(simpleTable(rows)); }
    else if (st.bc === "lichsu") {
      var sel = h("select"); sel.appendChild(h("option", { value: "", text: "— chọn nhân viên —" }));
      db.nhanvien.forEach(function (n) { sel.appendChild(h("option", { value: n["Mã NV"], text: n["Mã NV"] + " — " + n["Họ và tên"] })); });
      sel.value = st.bcNV || ""; sel.addEventListener("change", function () { st.bcNV = sel.value; render(); });
      tools.appendChild(sel);
      rows = st.bcNV ? R.lichsu(st.bcNV) : [];
      card.appendChild(st.bcNV ? simpleTable(rows) : h("div", { class: "empty", text: "Chọn nhân viên để xem toàn bộ lịch sử hồ sơ." }));
    }
    tools.appendChild(h("span", { class: "sp" }));
    tools.appendChild(btn("⬇ Xuất Excel", "", function () { if (!rows.length) { toast("Không có dữ liệu"); return; } saveXlsx(slug(title) + ".xlsx", [{ name: title, cols: Object.keys(rows[0]), rows: rows }]); }));
    tools.appendChild(h("span", { class: "hint", style: "margin:0", text: rows.length + " dòng" }));
    w.appendChild(card); return w;
  }

  // ---------- Hồ sơ công ty ----------
  var CONGTY_F = [{ k: "Tên công ty", req: 1 }, { k: "Địa chỉ" }, { k: "Mã số thuế" }, { k: "Số điện thoại" }, { k: "Người đại diện pháp luật" }];
  function congTy() { return (db.congty && db.congty[0]) || {}; }
  function cardCongTy() {
    var c = h("div", { class: "card" }), g = h("div", { class: "fgrid" });
    c.appendChild(h("h3", { text: "🏢 Hồ sơ công ty" }));
    c.appendChild(h("div", { class: "hint", text: "Tên công ty hiện trên thanh bên trái và trên phiếu lương." }));
    c.appendChild(g);
    var get = fieldInputs(g, CONGTY_F, congTy());
    c.appendChild(h("div", { class: "bar" }, [btn("💾 Lưu hồ sơ công ty", "pri", function () { db.congty = [get()]; save(); render(); toast("Đã lưu"); })]));
    return c;
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

  function tinhLuong(nam, thang) {
    nam = nam || st.nam; thang = thang || st.thang;
    var sp = HRM.staffForPayroll(db, nam, thang);
    var kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list }), nam, thang, st.bu);
    var by = {}; sp.list.forEach(function (x) { by[x["Mã nhân viên"]] = x; });
    kq.bangluong.forEach(function (r) { var x = by[r["Mã NV"]] || {}; r["HTTT"] = x["HTTT"] || ""; r["Số tài khoản"] = x["Số tài khoản"] || ""; r["Ngân hàng"] = x["Tên Ngân hàng"] || ""; r["Người phụ thuộc"] = x["Người phụ thuộc"] || 0; r["Số HĐLĐ"] = x["Số HĐLĐ"] || ""; r["Mã PB"] = x["Mã PB"] || ""; });
    kq.canhbao = sp.warn.concat(kq.canhbao); kq.ky = nam + "-" + ("0" + thang).slice(-2);
    Object.defineProperty(kq, "_staff", { value: sp.list, enumerable: false });
    return kq;
  }
  // ---------- Chốt kỳ lương ----------
  function kyChot(ky) { return db.kyluong.filter(function (k) { return k.ky === ky; })[0] || null; }
  function kyLabel(ky) { var m = String(ky).split("-"); return "Tháng " + (+m[1]) + "/" + m[0]; }
  function fmtTime(isoS) { var d = new Date(isoS); return isNaN(d) ? "" : d.toLocaleString("vi-VN"); }
  function excelSheets(r, ky) {
    var mm = String(ky).split("-");
    var ck = r.bangluong.filter(function (x) { return x["HTTT"] === "Chuyển khoản" && x["Thực lĩnh"] > 0; }).map(function (x, i) { return { "STT": i + 1, "Mã NV": x["Mã NV"], "Họ và tên": x["Họ và tên"], "Số tài khoản": x["Số tài khoản"], "Ngân hàng": x["Ngân hàng"], "Số tiền": x["Thực lĩnh"], "Nội dung": "Luong T" + (+mm[1]) + "/" + mm[0] + " " + x["Mã NV"] }; });
    return {
      bl: { name: "BangLuong", cols: COLS_FULL.concat(["HTTT", "Số tài khoản", "Ngân hàng"]), rows: r.bangluong },
      bh: { name: "BHXH", cols: r.bhxh[0] ? Object.keys(r.bhxh[0]) : ["Mã NV"], rows: r.bhxh },
      tn: { name: "ThueTNCN", cols: r.tncn[0] ? Object.keys(r.tncn[0]) : ["Mã NV"], rows: r.tncn },
      ck: { name: "ChuyenKhoan", cols: ["STT", "Mã NV", "Họ và tên", "Số tài khoản", "Ngân hàng", "Số tiền", "Nội dung"], rows: ck }
    };
  }
  function exportAll(r, ky) { var x = excelSheets(r, ky); saveXlsx("KyLuong_" + ky + ".xlsx", [x.bl, x.bh, x.tn, x.ck]); }
  function chotKy() {
    if (!st.kq) return;
    var ky = kyStr();
    if (kyChot(ky)) { alert(kyLabel(ky) + " đã chốt."); return; }
    // Luôn tính lại từ dữ liệu mới nhất: tránh chốt nhầm bảng lương cũ đang hiển thị
    var shown = CLS.totals(st.kq), fresh = tinhLuong(), now2 = CLS.totals(fresh);
    if (shown.thucLinh !== now2.thucLinh || shown.soNV !== now2.soNV) {
      st.kq = fresh; render();
      alert("Dữ liệu đã thay đổi sau lần tính trước. App đã TÍNH LẠI: " + now2.soNV + " NV, tổng thực lĩnh " + fmt(now2.thucLinh) + ".\nHãy kiểm tra lại rồi bấm Chốt lần nữa.");
      return;
    }
    var w = fresh.canhbao.length;
    askText("Chốt " + kyLabel(ky), now2.soNV + " nhân viên · Tổng thực lĩnh " + fmt(now2.thucLinh) + " đ" +
      (w ? "\n⚠ Còn " + w + " cảnh báo dữ liệu chưa xử lý (xem trên màn hình Tính lương)." : "") +
      "\nSau khi chốt: lưu bảng lương + dữ liệu đầu vào của kỳ, khóa chấm công/sản lượng/thưởng/tạm ứng của kỳ.", { label: "Ghi chú (không bắt buộc)", okText: "🔒 Chốt kỳ lương" }, function (note) {
    if (w && !confirm("Xác nhận CHỐT dù còn " + w + " cảnh báo?")) return;
    var snap = CLS.buildSnapshot(db, ky, fresh, fresh._staff, { note: note, buTheoNgay: st.bu, engineVersion: E.ENGINE_VERSION });
    CLS.close(db, snap); audit("Chốt kỳ lương", ky + " v" + snap.version + " — " + now2.soNV + " NV, thực lĩnh " + now2.thucLinh);
    if (!saveNow()) { CLS.rollbackClose(db, snap); db.auditlog.pop(); alert("CHỐT KHÔNG THÀNH CÔNG: chưa lưu được dữ liệu xuống đĩa. Kỳ lương vẫn ở trạng thái chưa chốt."); render(); return; }
    st.kq = null; render(); toast("Đã chốt và lưu " + kyLabel(ky) + " (phiên bản " + snap.version + ")");
    });
  }
  function moChot(ky) {
    var c = kyChot(ky); if (!c) return;
    askText("Mở chốt " + kyLabel(ky) + " (phiên bản " + (c.version || 1) + ")", "Bản chốt hiện tại KHÔNG bị xóa — được chuyển vào lịch sử chốt kỳ.\nDữ liệu kỳ được mở khóa để sửa, tính lại và chốt thành phiên bản mới.", { label: "Lý do mở chốt", required: true, multiline: true, okText: "🔓 Mở chốt" }, function (reason) {
    backupNow("truoc-mo-chot");
    var hrec = CLS.reopen(db, ky, reason); audit("Mở chốt kỳ lương", ky + " v" + hrec.version + " — " + reason);
    if (!saveNow()) { CLS.rollbackReopen(db, hrec); db.auditlog.pop(); alert("Không mở chốt được vì chưa lưu được dữ liệu xuống đĩa."); render(); return; }
    st.kq = null; render(); toast("Đã mở chốt " + kyLabel(ky) + " — bản cũ lưu trong lịch sử");
    });
  }
  function doiChieu(chot) {
    var rows = CLS.diff(chot.kq, tinhLuong()).map(function (r) { return { "Mã NV": r["Mã NV"], "Họ và tên": r["Họ và tên"], "Đã chốt": r["Trước"], "Tính lại hôm nay": r["Sau"], "Chênh lệch": r["Chênh lệch"], "Ghi chú": r["Ghi chú"] }; });
    var body = h("div");
    body.appendChild(h("div", { class: rows.length ? "warn" : "ok", text: rows.length ? rows.length + " nhân viên có thực lĩnh khác với bảng đã chốt (do hồ sơ/danh mục đã thay đổi sau khi chốt). Bảng đã chốt KHÔNG bị thay đổi." : "Khớp hoàn toàn: tính lại với dữ liệu hiện tại ra đúng bảng đã chốt." }));
    if (rows.length) body.appendChild(simpleTable(rows));
    modal("Đối chiếu " + kyLabel(chot.ky) + " với dữ liệu hiện tại", body, function (close) { return [btn("Đóng", "", close)]; });
  }
  function tabKyLuong() {
    var c = h("div", { class: "card" });
    c.appendChild(h("div", { class: "hint", text: "Các kỳ lương đã chốt được lưu nguyên bảng lương, BHXH, thuế TNCN tại thời điểm chốt — sửa hồ sơ hay danh mục về sau không làm thay đổi số đã chốt." }));
    if (!db.kyluong.length) { c.appendChild(h("div", { class: "empty", html: "Chưa chốt kỳ nào.<br>Vào <b>Tính lương</b>, tính xong bấm <b>🔒 Chốt kỳ lương</b>." })); return c; }
    var t = h("table"), tr = h("tr");
    ["Kỳ lương", "Phiên bản", "Ngày chốt", "Số NV", "Tổng thu nhập", "BH NLĐ", "Thuế TNCN", "Tổng thực lĩnh", "Toàn vẹn", "Ghi chú", ""].forEach(function (x, i) { tr.appendChild(h("th", { class: i >= 3 && i <= 7 ? "r" : "", text: x })); });
    t.appendChild(h("thead", {}, [tr])); var tb = h("tbody");
    db.kyluong.forEach(function (k) {
      var bl = k.kq.bangluong, sm = function (f) { return bl.reduce(function (a, x) { return a + (+x[f] || 0); }, 0); };
      var go = function () { var m = k.ky.split("-"); st.nam = +m[0]; st.thang = +m[1]; st.tab = "luong"; st.kq = null; saveUi(); render(); };
      var x = h("tr", { class: "click", on: { click: go } });
      [kyLabel(k.ky), "v" + (k.version || 1), fmtTime(k.ngayChot)].forEach(function (v) { x.appendChild(h("td", { class: "t", text: v })); });
      [bl.length, sm("Tổng thu nhập"), sm("BH trừ NLĐ"), sm("Thuế TNCN"), sm("Thực lĩnh")].forEach(function (v, i) { x.appendChild(h("td", { class: "r", text: fmt(v), style: i === 4 ? "font-weight:700" : "" })); });
      var vf = CLS.verify(k);
      x.appendChild(h("td", { class: "t", html: vf === "ok" ? "<span class='tag on'>Nguyên vẹn</span>" : vf === "legacy" ? "<span class='tag'>Bản cũ</span>" : "<span class='tag off'>BỊ SỬA</span>" }));
      x.appendChild(h("td", { class: "t", text: k.ghiChu || "" }));
      x.appendChild(h("td", { style: "text-align:right;white-space:nowrap" }, [
        btn("Xem", "", function (e) { e.stopPropagation(); go(); }),
        btn("⬇ Excel", "", function (e) { e.stopPropagation(); exportAll(k.kq, k.ky); }),
        btn("Mở chốt", "red ghost", function (e) { e.stopPropagation(); moChot(k.ky); })]));
      tb.appendChild(x);
    });
    t.appendChild(tb); c.appendChild(h("div", { class: "tw" }, [t]));
    if (db.kyluong_lichsu.length) {
      c.appendChild(h("h3", { text: "🕘 Lịch sử các lần mở chốt", style: "margin-top:18px" }));
      c.appendChild(h("div", { class: "hint", text: "Bản chốt cũ được giữ lại nguyên vẹn khi mở chốt — dùng để đối chiếu trước/sau điều chỉnh." }));
      var hrows = db.kyluong_lichsu.slice().sort(function (a, b) { return a.ky < b.ky ? 1 : (a.ky > b.ky ? -1 : (b.version || 0) - (a.version || 0)); }).map(function (k) {
        var t2 = k.totals || CLS.totals(k.kq);
        return { "Kỳ": kyLabel(k.ky), "Phiên bản": "v" + (k.version || 1), "Chốt lúc": fmtTime(k.ngayChot), "Mở chốt lúc": fmtTime(k.moChot && k.moChot.luc), "Lý do mở chốt": (k.moChot && k.moChot.lyDo) || "", "Số NV": t2.soNV, "Tổng thực lĩnh": t2.thucLinh };
      });
      c.appendChild(simpleTable(hrows));
      var cur = h("div", { class: "bar", style: "margin-top:8px" });
      db.kyluong_lichsu.forEach(function (k) {
        var c2 = kyChot(k.ky); if (!c2) return;
        cur.appendChild(btn("↔ So sánh " + kyLabel(k.ky) + " v" + (k.version || 1) + " → v" + (c2.version || "?"), "", function () {
          var rows = CLS.diff(k.kq, c2.kq);
          var body = h("div"); body.appendChild(h("div", { class: rows.length ? "warn" : "ok", text: rows.length ? rows.length + " nhân viên thay đổi thực lĩnh" : "Không có chênh lệch thực lĩnh" }));
          if (rows.length) body.appendChild(simpleTable(addTotal(rows)));
          modal("Trước / sau điều chỉnh — " + kyLabel(k.ky), body, function (close) { return [btn("⬇ Excel", "", function () { if (rows.length) saveXlsx("DieuChinh_" + k.ky + ".xlsx", [{ name: "TruocSau", cols: Object.keys(rows[0]), rows: rows }]); }), btn("Đóng", "", close)]; });
        }));
      });
      c.appendChild(cur);
    }
    return c;
  }
  // ---------- BÁO CÁO LƯƠNG ----------
  function kyKey(nam, thang) { return nam + "-" + ("0" + thang).slice(-2); }
  // Kết quả lương của 1 kỳ: kỳ đã chốt lấy bản đã lưu, chưa chốt thì tính tạm
  function kqKy(nam, thang) {
    var c = kyChot(kyKey(nam, thang));
    if (c) return { kq: c.kq, chot: true };
    if (!db.nhanvien.length) return { kq: { bangluong: [], bhxh: [], tncn: [], canhbao: [] }, chot: false };
    return { kq: tinhLuong(nam, thang), chot: false };
  }
  function n0(v) { return +v || 0; }
  function addTotal(rows, label) {
    if (!rows.length) return rows;
    var t = {}, keys = Object.keys(rows[0]);
    keys.forEach(function (k, i) {
      if (i === 0) { t[k] = label || "TỔNG"; return; }
      var allNum = rows.every(function (r) { return typeof r[k] === "number" || r[k] === "" || r[k] == null; }) && rows.some(function (r) { return typeof r[k] === "number"; });
      t[k] = allNum && !/STT|Bậc|Số người phụ thuộc/.test(k) ? Math.round(rows.reduce(function (a, r) { return a + n0(r[k]); }, 0) * 1000) / 1000 : "";
    });
    return rows.concat([t]);
  }
  function tkChiPhi(maPB, tenPB) {
    var r = db.dm_phongban.filter(function (x) { return (maPB && x["Mã phòng ban"] === maPB) || (!maPB && tenPB && x["Tên phòng ban"] === tenPB); })[0];
    if (r && r["Tài khoản chi phí"]) return String(r["Tài khoản chi phí"]);
    if (r && /^02|sản xuất/i.test((r["Mã khối"] || "") + " " + (r["Tên khối"] || ""))) return "622";
    return "642";
  }
  var BCL = [
    ["phongban", "🏢 Tổng hợp theo phòng ban"], ["cong", "🗓 Tổng hợp công"], ["sanluong", "⚖ Phân bổ sản lượng"],
    ["hachtoan", "📒 Bảng hạch toán"], ["phieuchi", "💵 Phiếu chi lương / tạm ứng"], ["sosanh", "↔ So sánh với kỳ trước"],
    ["thang", "📅 Lương 12 tháng"], ["nvnam", "👤 Thu nhập năm theo NV"], ["thuenam", "🧾 Thuế TNCN cả năm"]
  ];
  var BCL_NAM = { thang: 1, nvnam: 1, thuenam: 1 };

  function bcPhongBan(r) {
    var m = {};
    r.bangluong.forEach(function (x) {
      var k = x["Phòng ban"] || "(chưa có phòng ban)";
      var o = m[k] || (m[k] = { "Phòng ban": k, "Số người": 0, "Tổng công": 0, "Tổng thu nhập": 0, "BH trừ NLĐ": 0, "Thuế TNCN": 0, "Tạm ứng": 0, "Trừ khác": 0, "Thực lĩnh": 0, "BH công ty đóng": 0 });
      o["Số người"]++; ["Tổng công", "Tổng thu nhập", "BH trừ NLĐ", "Thuế TNCN", "Tạm ứng", "Trừ khác", "Thực lĩnh"].forEach(function (f) { o[f] += n0(x[f]); });
    });
    r.bhxh.forEach(function (b) { var k = b["Phòng ban"] || "(chưa có phòng ban)"; if (m[k]) m[k]["BH công ty đóng"] += n0(b["Cộng BH công ty đóng"]); });
    return addTotal(Object.keys(m).sort().map(function (k) { return m[k]; }));
  }
  function bcCong(nam, thang) {
    var ky = kyKey(nam, thang), m = {};
    db.chamcong.filter(function (r) { return r["Kỳ"] === ky; }).forEach(function (r) {
      var ma = r["Mã NV"]; if (!ma) return;
      var o = m[ma] || (m[ma] = { "Mã NV": ma, "Họ và tên": tenNV(ma), "Công BT": 0, "Phép năm (PN)": 0, "Công lễ (CL)": 0, "Di chuyển/Trung chuyển": 0, "Tổng công tính lương": 0, "Công tăng ca": 0, "Công Chủ nhật": 0, "Ngày cơm (CC)": 0, "Ngày có nhãn": "" });
      var ht = String(r["Hình thức công"] || "BT").trim().toUpperCase(), sum = 0, nh = {};
      for (var d = 1; d <= 31; d++) {
        var t = E.tachCong(r[("0" + d).slice(-2)]); sum += t.soCong; if (t.nhan) nh[t.nhan] = (nh[t.nhan] || 0) + 1;
        if (ht !== "CC" && !/TC/.test(ht) && t.soCong && new Date(nam, thang - 1, d).getDay() === 0 && new Date(nam, thang - 1, d).getMonth() === thang - 1) o["Công Chủ nhật"] += t.soCong;
      }
      if (ht === "CC") o["Ngày cơm (CC)"] += sum;
      else if (/TC/.test(ht)) { o["Công tăng ca"] += sum; o["Tổng công tính lương"] += sum; }
      else {
        o["Tổng công tính lương"] += sum;
        if (ht === "PN") o["Phép năm (PN)"] += sum; else if (ht === "CL") o["Công lễ (CL)"] += sum; else if (ht === "DC" || ht === "TRCH") o["Di chuyển/Trung chuyển"] += sum; else o["Công BT"] += sum;
      }
      var lb = Object.keys(nh).map(function (k) { return k + "×" + nh[k]; }); if (lb.length) o["Ngày có nhãn"] = (o["Ngày có nhãn"] ? o["Ngày có nhãn"] + ", " : "") + lb.join(", ");
    });
    return addTotal(Object.keys(m).sort().map(function (k) { return m[k]; }));
  }
  function bcSanLuong(nam, thang, loai) {
    var src = loai === "bandam" ? db.bandam : db.sanluong, sp = HRM.staffForPayroll(db, nam, thang), pb = {};
    sp.list.forEach(function (x) { pb[x["Mã nhân viên"]] = HRM.refName(db, "dm_phongban", x["Mã PB"]) || x["Mã PB"]; });
    var rows = src.filter(function (r) { var mm = String(r["Ngày cân"] || "").match(/^(\d{4})-(\d{1,2})/); return mm && +mm[1] === nam && +mm[2] === thang; });
    var byNV = {}, byPB = {}, chuaGan = [];
    rows.forEach(function (r) {
      var tan = E.num(r["KL hàng (Tấn)"]), ma = r["Mã NV"];
      if (!ma) { chuaGan.push({ "Phiếu cân": r["Phiếu cân"] || "", "Ngày cân": r["Ngày cân"] || "", "Biển số": r["Biển số"] || "", "KL": tan }); return; }
      var o = byNV[ma] || (byNV[ma] = { "Mã NV": ma, "Họ và tên": tenNV(ma) || "(không có trong Nhân sự)", "Phòng ban": pb[ma] || "", "Số phiếu": 0, "Tổng": 0 });
      o["Số phiếu"]++; o["Tổng"] += tan;
      var p = byPB[o["Phòng ban"] || "(chưa có)"] || (byPB[o["Phòng ban"] || "(chưa có)"] = { "Phòng ban": o["Phòng ban"] || "(chưa có)", "Số người": {}, "Số phiếu": 0, "Tổng": 0 });
      p["Số người"][ma] = 1; p["Số phiếu"]++; p["Tổng"] += tan;
    });
    var dv = loai === "bandam" ? "Số xe" : "Sản lượng (tấn)";
    var ren = function (o) { var x = Object.assign({}, o); x[dv] = Math.round(x["Tổng"] * 1000) / 1000; delete x["Tổng"]; return x; };
    return {
      nv: addTotal(Object.keys(byNV).sort().map(function (k) { return ren(byNV[k]); })),
      pb: addTotal(Object.keys(byPB).sort().map(function (k) { var o = ren(byPB[k]); o["Số người"] = Object.keys(byPB[k]["Số người"]).length; return o; })),
      chuaGan: chuaGan
    };
  }
  function bcHachToan(r, nam, thang) {
    var ky = thang + "/" + nam, rows = [], cp = {}, cpBH = {}, sum = function (f) { return r.bangluong.reduce(function (a, x) { return a + n0(x[f]); }, 0); };
    var maPBof = {}; r.bangluong.forEach(function (x) { maPBof[x["Mã NV"]] = x["Mã PB"]; });
    r.bangluong.forEach(function (x) { var tk = tkChiPhi(x["Mã PB"], x["Phòng ban"]); cp[tk] = (cp[tk] || 0) + n0(x["Tổng thu nhập"]); });
    r.bhxh.forEach(function (b) { var tk = tkChiPhi(maPBof[b["Mã NV"]], b["Phòng ban"]); cpBH[tk] = (cpBH[tk] || 0) + n0(b["Cộng BH công ty đóng"]); });
    var add = function (no, co, dg, tien) { if (Math.round(tien)) rows.push({ "Kỳ": ky, "TK Nợ": no, "TK Có": co, "Diễn giải": dg, "Số tiền": Math.round(tien) }); };
    Object.keys(cp).sort().forEach(function (tk) { add(tk, "334", "Tính lương phải trả kỳ " + ky, cp[tk]); });
    Object.keys(cpBH).sort().forEach(function (tk) { add(tk, "338", "Trích BHXH/BHYT/BHTN/KPCĐ (DN đóng) kỳ " + ky, cpBH[tk]); });
    add("334", "338", "Khấu trừ BH vào lương (NLĐ đóng) kỳ " + ky, sum("BH trừ NLĐ"));
    add("334", "338", "Truy thu BH (chưa đủ ngưỡng công) kỳ " + ky, sum("Truy thu BH"));
    add("334", "3335", "Khấu trừ thuế TNCN kỳ " + ky, sum("Thuế TNCN"));
    add("334", "141", "Trừ tạm ứng lương kỳ " + ky, sum("Tạm ứng"));
    add("334", "1388", "Các khoản trừ khác kỳ " + ky, sum("Trừ khác"));
    var tm = r.bangluong.filter(function (x) { return x["HTTT"] !== "Chuyển khoản"; }).reduce(function (a, x) { return a + n0(x["Thực lĩnh"]); }, 0);
    var ck = r.bangluong.filter(function (x) { return x["HTTT"] === "Chuyển khoản"; }).reduce(function (a, x) { return a + n0(x["Thực lĩnh"]); }, 0);
    add("334", "1111", "Chi lương thực lĩnh bằng tiền mặt kỳ " + ky, tm);
    add("334", "1121", "Chi lương thực lĩnh chuyển khoản kỳ " + ky, ck);
    var coLuong = sum("Tổng thu nhập"), no334 = rows.filter(function (x) { return x["TK Nợ"] === "334"; }).reduce(function (a, x) { return a + x["Số tiền"]; }, 0);
    return { rows: rows, lech: coLuong - no334 };
  }
  function bcPhieuChi(r, nam, thang) {
    var ky = ("0" + thang).slice(-2) + nam, out = [], i = 1;
    r.bangluong.forEach(function (x) {
      if (n0(x["Thực lĩnh"]) <= 0) return;
      out.push({ "Số phiếu": "PC-L" + ky + "-" + String(i++).padStart(3, "0"), "Loại chi": "Lương", "Mã NV": x["Mã NV"], "Họ và tên": x["Họ và tên"], "Hình thức": x["HTTT"] || "Tiền mặt", "Số tài khoản": x["Số tài khoản"] || "", "Số tiền": n0(x["Thực lĩnh"]), "Diễn giải": "Chi lương tháng " + thang + "/" + nam });
    });
    var j = 1;
    db.ungluong.filter(function (u) { var mm = String(u["Ngày hạch toán"] || "").match(/^(\d{4})-(\d{1,2})/); return mm && +mm[1] === nam && +mm[2] === thang && E.num(u["Tạm ứng"]) > 0; }).forEach(function (u) {
      out.push({ "Số phiếu": "PC-U" + ky + "-" + String(j++).padStart(3, "0"), "Loại chi": "Tạm ứng", "Mã NV": u["Mã NV"], "Họ và tên": tenNV(u["Mã NV"]), "Hình thức": "", "Số tài khoản": "", "Số tiền": E.num(u["Tạm ứng"]), "Diễn giải": u["Diễn giải"] || ("Tạm ứng " + (u["Ngày hạch toán"] || "")) });
    });
    return addTotal(out);
  }
  function bcSoSanh(nam, thang) {
    var pn = thang === 1 ? nam - 1 : nam, pt = thang === 1 ? 12 : thang - 1;
    var A = kqKy(pn, pt), B = kqKy(nam, thang), a = {}, b = {}, rows = [];
    A.kq.bangluong.forEach(function (x) { a[x["Mã NV"]] = x; }); B.kq.bangluong.forEach(function (x) { b[x["Mã NV"]] = x; });
    Object.keys(b).concat(Object.keys(a).filter(function (k) { return !b[k]; })).forEach(function (k) {
      var x = a[k], y = b[k], ta = x ? n0(x["Thực lĩnh"]) : 0, tb = y ? n0(y["Thực lĩnh"]) : 0;
      rows.push({ "Mã NV": k, "Họ và tên": (y || x)["Họ và tên"], "Công kỳ trước": x ? n0(x["Tổng công"]) : 0, "Công kỳ này": y ? n0(y["Tổng công"]) : 0,
        "Thực lĩnh kỳ trước": ta, "Thực lĩnh kỳ này": tb, "Chênh lệch": tb - ta, "Tỷ lệ": ta ? Math.round((tb - ta) / ta * 1000) / 10 + "%" : "", "Ghi chú": !x ? "Mới" : (!y ? "Không còn trong kỳ này" : "") });
    });
    rows.sort(function (p, q) { return Math.abs(q["Chênh lệch"]) - Math.abs(p["Chênh lệch"]); });
    return { rows: addTotal(rows), prev: kyLabel(kyKey(pn, pt)) + (A.chot ? " (đã chốt)" : " (tạm tính)"), cur: kyLabel(kyKey(nam, thang)) + (B.chot ? " (đã chốt)" : " (tạm tính)") };
  }
  function chotTrongNam(nam) { return db.kyluong.filter(function (k) { return k.ky.slice(0, 4) === String(nam); }).sort(function (a, b) { return a.ky < b.ky ? -1 : 1; }); }
  function bc12Thang(nam) {
    var rows = [];
    for (var t = 1; t <= 12; t++) {
      var c = kyChot(kyKey(nam, t)), o = { "Tháng": t + "/" + nam, "Trạng thái": c ? "Đã chốt" : "Chưa chốt" };
      var bl = c ? c.kq.bangluong : [], bh = c ? c.kq.bhxh : [], s = function (f) { return bl.reduce(function (a, x) { return a + n0(x[f]); }, 0); };
      o["Số NV"] = bl.length; o["Tổng thu nhập"] = s("Tổng thu nhập"); o["BH NLĐ đóng"] = s("BH trừ NLĐ") + s("Truy thu BH");
      o["BH công ty đóng"] = bh.reduce(function (a, x) { return a + n0(x["Cộng BH công ty đóng"]); }, 0); o["Thuế TNCN"] = s("Thuế TNCN");
      o["Tạm ứng"] = s("Tạm ứng"); o["Thực lĩnh"] = s("Thực lĩnh"); o["Tổng chi phí lương (TN + BH công ty)"] = o["Tổng thu nhập"] + o["BH công ty đóng"];
      rows.push(o);
    }
    return addTotal(rows, "CẢ NĂM");
  }
  function bcNVNam(nam, field) {
    var m = {}, ks = chotTrongNam(nam);
    ks.forEach(function (k) {
      var t = +k.ky.slice(5);
      k.kq.bangluong.forEach(function (x) {
        var o = m[x["Mã NV"]] || (m[x["Mã NV"]] = (function () { var r = { "Mã NV": x["Mã NV"], "Họ và tên": x["Họ và tên"] }; for (var i = 1; i <= 12; i++) r["T" + i] = ""; r["Cả năm"] = 0; return r; })());
        o["T" + t] = n0(x[field]); o["Cả năm"] += n0(x[field]);
      });
    });
    return addTotal(Object.keys(m).sort().map(function (k) { return m[k]; }));
  }
  function bcThueNam(nam) {
    var m = {};
    chotTrongNam(nam).forEach(function (k) {
      k.kq.bangluong.forEach(function (x) {
        var o = m[x["Mã NV"]] || (m[x["Mã NV"]] = { "Mã NV": x["Mã NV"], "Họ và tên": x["Họ và tên"], "Số tháng có lương": 0, "Tổng thu nhập": 0, "Tiền cơm (không chịu thuế)": 0, "BH bắt buộc NLĐ đóng": 0, "Người phụ thuộc (tối đa)": 0, "Thuế TNCN đã khấu trừ": 0 });
        o["Số tháng có lương"]++; o["Tổng thu nhập"] += n0(x["Tổng thu nhập"]); o["Tiền cơm (không chịu thuế)"] += n0(x["Tiền cơm"]);
        o["BH bắt buộc NLĐ đóng"] += n0(x["BH trừ NLĐ"]); o["Thuế TNCN đã khấu trừ"] += n0(x["Thuế TNCN"]);
        o["Người phụ thuộc (tối đa)"] = Math.max(o["Người phụ thuộc (tối đa)"], n0(x["Người phụ thuộc"]));
      });
    });
    return addTotal(Object.keys(m).sort().map(function (k) { return m[k]; }));
  }

  function tabBaoCaoLuong() {
    var w = h("div"), bar = h("div", { class: "bar" });
    st.bcl = st.bcl || "phongban";
    BCL.forEach(function (b) { bar.appendChild(btn(b[1], st.bcl === b[0] ? "pri" : "", function () { st.bcl = b[0]; render(); })); });
    w.appendChild(bar);
    var card = h("div", { class: "card" }), tools = h("div", { class: "bar" }), sheets = [], title = BCL.filter(function (b) { return b[0] === st.bcl; })[0][1].replace(/^\S+\s/, "");
    card.appendChild(tools);
    var nam = st.nam, thang = st.thang, info = function (t, cls) { card.appendChild(h("div", { class: cls || "hint", html: t })); };
    if (BCL_NAM[st.bcl]) {
      var ks = chotTrongNam(nam);
      info("Năm <b>" + nam + "</b> (đổi năm ở ô Kỳ lương phía trên). Báo cáo cả năm chỉ cộng các <b>kỳ đã chốt</b>: " + (ks.length ? ks.map(function (k) { return "T" + (+k.ky.slice(5)); }).join(", ") : "chưa có kỳ nào") + ".", ks.length ? "hint" : "warn");
    } else {
      var src = st.bcl === "cong" || st.bcl === "sanluong" ? null : kqKy(nam, thang);
      if (src) info(src.chot ? "🔒 Số liệu kỳ <b>" + thang + "/" + nam + "</b> lấy từ bảng lương <b>đã chốt</b>." : "⚠ Kỳ <b>" + thang + "/" + nam + "</b> <b>chưa chốt</b> — số liệu tính tạm từ dữ liệu hiện tại, có thể thay đổi.", src.chot ? "locked" : "warn");
    }
    if (st.bcl === "phongban") { var r1 = bcPhongBan(src.kq); card.appendChild(simpleTable(r1)); sheets.push({ name: "TheoPhongBan", rows: r1 }); }
    else if (st.bcl === "cong") { var r2 = bcCong(nam, thang); info("Tổng hợp từ bảng chấm công kỳ " + thang + "/" + nam + ". Ngày có nhãn: VD QC×7 = 7 ngày công tác QC."); card.appendChild(simpleTable(r2)); sheets.push({ name: "TongHopCong", rows: r2 }); }
    else if (st.bcl === "sanluong") {
      st.bclLoai = st.bclLoai || "sanluong";
      var ls = h("select"); [["sanluong", "Sản lượng gỗ (tấn)"], ["bandam", "Bơm dăm (số xe)"]].forEach(function (o) { ls.appendChild(h("option", { value: o[0], text: o[1] })); });
      ls.value = st.bclLoai; ls.addEventListener("change", function () { st.bclLoai = ls.value; render(); }); tools.appendChild(ls);
      var r3 = bcSanLuong(nam, thang, st.bclLoai);
      card.appendChild(h("div", { class: "fh", text: "Theo phòng ban" })); card.appendChild(simpleTable(r3.pb));
      card.appendChild(h("div", { class: "fh", text: "Theo công nhân" })); card.appendChild(simpleTable(r3.nv));
      if (r3.chuaGan.length) { card.appendChild(h("div", { class: "warn", html: "<b>⚠ " + r3.chuaGan.length + " phiếu cân chưa gán Mã NV</b> — chưa được tính lương cho ai:" })); card.appendChild(simpleTable(r3.chuaGan)); }
      sheets.push({ name: "TheoPhongBan", rows: r3.pb }, { name: "TheoCongNhan", rows: r3.nv }, { name: "ChuaGanNguoi", rows: r3.chuaGan });
    }
    else if (st.bcl === "hachtoan") {
      var ht = bcHachToan(src.kq, nam, thang);
      info("Hạch toán tổng hợp theo TT200. TK chi phí lấy theo cột 'Tài khoản chi phí' của Phòng ban (mặc định khối Sản xuất → 622, còn lại → 642). Sửa ở Danh mục → Phòng ban.");
      card.appendChild(simpleTable(addTotal(ht.rows)));
      if (Math.abs(ht.lech) >= 1) info("Chênh lệch TK 334 (Có − Nợ) = <b>" + fmt(ht.lech) + "</b> — do thực lĩnh được làm tròn đến 1.000đ hoặc thực lĩnh âm được để 0.", "warn");
      sheets.push({ name: "HachToan", rows: ht.rows });
    }
    else if (st.bcl === "phieuchi") { var r5 = bcPhieuChi(src.kq, nam, thang); card.appendChild(simpleTable(r5)); sheets.push({ name: "PhieuChi", rows: r5 }); }
    else if (st.bcl === "sosanh") { var ss = bcSoSanh(nam, thang); info("So sánh <b>" + ss.prev + "</b> → <b>" + ss.cur + "</b>, sắp theo mức chênh lớn nhất."); card.appendChild(simpleTable(ss.rows)); sheets.push({ name: "SoSanh", rows: ss.rows }); }
    else if (st.bcl === "thang") { var r7 = bc12Thang(nam); card.appendChild(simpleTable(r7)); sheets.push({ name: "Luong12Thang", rows: r7 }); }
    else if (st.bcl === "nvnam") {
      st.bclF = st.bclF || "Thực lĩnh";
      var fs = h("select"); ["Thực lĩnh", "Tổng thu nhập", "Thuế TNCN", "BH trừ NLĐ", "Tổng công", "Tạm ứng"].forEach(function (f) { fs.appendChild(h("option", { value: f, text: f })); });
      fs.value = st.bclF; fs.addEventListener("change", function () { st.bclF = fs.value; render(); }); tools.appendChild(h("label", { text: "Chỉ tiêu " })); tools.appendChild(fs);
      var r8 = bcNVNam(nam, st.bclF); card.appendChild(simpleTable(r8)); sheets.push({ name: slug(st.bclF) + "_" + nam, rows: r8 });
    }
    else if (st.bcl === "thuenam") {
      var r9 = bcThueNam(nam);
      info("Số liệu hỗ trợ quyết toán thuế TNCN năm " + nam + " — cộng từ các kỳ đã chốt. Kế toán đối chiếu thêm với tờ khai 05/KK đã nộp.");
      card.appendChild(simpleTable(r9)); sheets.push({ name: "ThueTNCN_" + nam, rows: r9 });
    }
    tools.appendChild(h("span", { class: "sp" }));
    tools.appendChild(btn("⬇ Xuất Excel", "pri", function () {
      var sh = sheets.filter(function (x) { return x.rows.length; }).map(function (x) { return { name: x.name, cols: Object.keys(x.rows[0]), rows: x.rows }; });
      if (!sh.length) { toast("Không có dữ liệu"); return; }
      saveXlsx("BaoCao_" + slug(title) + "_" + (BCL_NAM[st.bcl] ? nam : kyKey(nam, thang)) + ".xlsx", sh);
    }));
    w.appendChild(card); return w;
  }

  function tabLuong() {
    var box = h("div"), chot = kyChot(kyStr());
    var card = h("div", { class: "card" }), bar = h("div", { class: "bar" });
    if (chot) {
      st.kq = Object.assign({ ky: chot.ky }, chot.kq);
      box.appendChild(h("div", { class: "locked", html: "🔒 <b>" + kyLabel(chot.ky) + " đã chốt</b> lúc " + esc(fmtTime(chot.ngayChot)) + (chot.ghiChu ? " — " + esc(chot.ghiChu) : "") +
        "<br><span>Đây là bảng lương đã lưu, không tính lại. Dữ liệu chấm công/sản lượng/thưởng/tạm ứng của kỳ này đang bị khóa.</span>" }, [
        h("div", { class: "bar", style: "margin:8px 0 0" }, [btn("⬇ Xuất trọn bộ Excel", "pri", function () { exportAll(chot.kq, chot.ky); }), btn("🔍 Đối chiếu với dữ liệu hiện tại", "", function () { doiChieu(chot); }), btn("🔓 Mở chốt để sửa", "red", function () { moChot(chot.ky); })])]));
      card.appendChild(bar);
      return renderKq(box, card, bar);
    }
    var sel = h("select"); [["false", "Bù sản lượng theo THÁNG"], ["true", "Bù sản lượng theo NGÀY (kiểu Đại Hiệp)"]].forEach(function (o) { sel.appendChild(h("option", { value: o[0], text: o[1] })); });
    sel.value = String(st.bu); sel.addEventListener("change", function () { st.bu = sel.value === "true"; saveUi(); });
    bar.appendChild(btn("▶ Tính lương tháng " + st.thang + "/" + st.nam, "pri big", function () {
      if (!db.nhanvien.length) { alert("Chưa có nhân viên. Hãy nhập ở mục Nhân sự trước."); return; }
      st.kq = tinhLuong(); render(); toast("Đã tính xong " + st.kq.bangluong.length + " nhân viên");
    }));
    bar.appendChild(sel); card.appendChild(bar);
    if (!st.kq) {
      card.appendChild(h("div", { class: "hint", text: "Kiểm tra dữ liệu kỳ " + st.thang + "/" + st.nam + " rồi bấm nút xanh. Có thể tính lại bất cứ lúc nào." }));
      var cc = db.chamcong.filter(function (r) { return r["Kỳ"] === kyStr(); }).length;
      var sp = HRM.staffForPayroll(db, st.nam, st.thang);
      card.appendChild(h("div", { class: cc ? "ok" : "warn", html: "Chấm công kỳ này: <b>" + cc + "</b> dòng · Nhân viên có hợp đồng hiệu lực trong kỳ: <b>" + sp.list.length + "</b> người" + (cc ? "" : " — <b>chưa có dữ liệu chấm công kỳ này</b>.") }));
      if (sp.warn.length) card.appendChild(h("div", { class: "warn", html: "<b>⚠ Hồ sơ cần bổ sung:</b><br>" + sp.warn.map(esc).join("<br>") }));
      box.appendChild(card); return box;
    }
    bar.appendChild(btn("🔒 Chốt kỳ lương", "pri", chotKy, "Lưu bảng lương kỳ này để xem lại về sau và khóa dữ liệu kỳ"));
    return renderKq(box, card, bar);
  }
  function renderKq(box, card, bar) {
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
    [["Bảng lương", "bl"], ["BHXH", "bh"], ["Thuế TNCN", "tn"], ["Danh sách chuyển khoản", "ck"]].forEach(function (o) { mn.appendChild(h("option", { value: o[1], text: o[0] })); });
    mn.addEventListener("change", function () {
      var m = excelSheets(r, r.ky || kyStr())[mn.value];
      if (m) saveXlsx(m.name + "_" + (r.ky || kyStr()) + ".xlsx", [m]); mn.selectedIndex = 0;
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
    if (congTy()["Tên công ty"]) s.appendChild(h("div", { text: congTy()["Tên công ty"], style: "font-weight:700;text-transform:uppercase;font-size:13px" }));
    s.appendChild(h("h3", { text: "PHIẾU LƯƠNG THÁNG " + st.thang + "/" + st.nam, style: "text-align:center;margin:4px 0 10px" }));
    s.appendChild(h("div", { class: "head", html: "<b>" + esc(b["Họ và tên"]) + "</b> · Mã NV: " + esc(b["Mã NV"]) + (b["Phòng ban"] ? " · " + esc(b["Phòng ban"]) : "") + "<br><span style='color:#6c7a74'>Tổng công: " + b["Tổng công"] + " / Công chuẩn: " + b["Công chuẩn"] + (b["Sản lượng (tấn)"] ? " · Sản lượng: " + b["Sản lượng (tấn)"] + " tấn" : "") + "</span>" }));
    var t = h("table");
    SLIP_LINES.forEach(function (l) { if (b[l[0]] || l[2]) t.appendChild(h("tr", { class: l[2] ? "tot" : "", html: "<td>" + l[1] + "</td><td>" + fmt(b[l[0]]) + "</td>" })); });
    s.appendChild(t); return s;
  }
  function slipDialog(b) {
    modal("Chi tiết lương — " + b["Họ và tên"], slipEl(b), function (close) {
      return [btn("Đóng", "", close), btn("🖨 In phiếu này", "pri", function () { var one = st.kq; st.kq = { bangluong: [b], ky: one.ky, bhxh: [], tncn: [], canhbao: [] }; st.tab = "slips"; st.kqFull = one; close(); render(); })];
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
      ["backup", "Nạp danh mục chuẩn HAK", "Phòng ban, chức vụ, mã lương, phụ cấp, BH, thuế 2026", countOf("dm_baohiem") > 0],
      ["dm", "Kiểm tra Danh mục", "Sửa đơn giá, phụ cấp… theo đơn vị", countOf("dm_luong") > 0],
      ["nhansu", "Nhập hồ sơ Nhân sự + hợp đồng", countOf("nhanvien") + " nhân viên", countOf("nhanvien") > 0 && countOf("chitiethd") > 0],
      ["chamcong", "Nhập Chấm công tháng " + st.thang, "Dán từ Excel hoặc nhập tay", db.chamcong.some(function (r) { return r["Kỳ"] === kyStr(); })],
      ["sanluong", "Nhập Sản lượng / Bơm dăm / Thưởng / Tạm ứng", "Nếu có phát sinh trong tháng", db.sanluong.length + db.bandam.length + db.psluong.length + db.ungluong.length > 0],
      ["luong", "Tính lương → kiểm tra → 🔒 Chốt kỳ", "Chốt để lưu bảng lương, xem lại về sau", !!kyChot(kyStr())]
    ];
    var g = h("div", { class: "steps" });
    steps.forEach(function (s, i) { g.appendChild(h("div", { class: "step" + (s[3] ? " done" : ""), on: { click: function () { st.tab = s[0]; saveUi(); render(); } } }, [h("div", { class: "no", text: s[3] ? "✓" : i + 1 }), h("div", { html: "<b>" + s[1] + "</b><small>" + s[2] + "</small>" })])); });
    card.appendChild(g); w.appendChild(card);
    w.appendChild(h("div", { class: "card", html: "<h3>Có sẵn file Excel của bạn?</h3><div class='hint'>Tải file mẫu, dán dữ liệu của bạn vào đúng cột rồi nhập vào app — không phải gõ lại.</div>" }, [h("div", { class: "bar" }, [btn("📄 Tải toàn bộ file mẫu Excel", "pri", downloadAllTemplates), btn("⬆ Nhập từ file Excel tổng", "", importAllFile)])]));
    var iss = INT.check(db).filter(function (i) { return i.level === "Critical" || i.level === "High"; });
    if (iss.length) w.appendChild(h("div", { class: "warn", html: "<b>🩺 " + iss.length + " vấn đề dữ liệu mức Critical/High</b> có thể làm sai tiền lương — xem tại <b>Công ty & Sao lưu → Kiểm tra dữ liệu</b>.<br>" + iss.slice(0, 3).map(function (i) { return "• " + esc(i.msg); }).join("<br>") }));
    var het = HRM.reports(db).hethan(30);
    if (het.length) w.appendChild(h("div", { class: "warn", html: "<b>⏰ " + het.length + " hợp đồng sắp hết hạn / đã quá hạn trong 30 ngày tới.</b> <a href='#' id='lnkhh'>Xem báo cáo</a>" }));
    w.appendChild(h("div", { class: "warn", html: "<b>Nhớ sao lưu:</b> " + (store ? "app tự lưu dữ liệu và tự giữ bản sao lưu mỗi ngày trên máy này. Vẫn nên định kỳ" : "dữ liệu nằm trong trình duyệt của máy này. Cuối mỗi kỳ lương hãy") + " vào <b>Sao lưu</b> → <b>Sao lưu ra file</b> và cất file ở nơi khác (USB, Google Drive...)." }));
    setTimeout(function () { var a = $("#lnkhh"); if (a) a.onclick = function (e) { e.preventDefault(); st.tab = "baocao"; st.bc = "hethan"; render(); }; }, 0);
    return w;
  }

  // ---------- Sao lưu ----------
  function tabSaoLuu() {
    var c = h("div", { class: "card" });
    c.appendChild(h("h3", { text: "Sao lưu & khôi phục" }));
    if (store) {
      var inf = store.info();
      c.appendChild(h("div", { class: "ok", html: "Dữ liệu tự lưu tại: <code>" + esc(inf.dataFile) + "</code><br>Bản sao lưu tự động mỗi ngày (giữ 60 ngày): <code>" + esc(inf.backupDir) + "</code>" }));
      c.appendChild(h("div", { class: "bar", style: "margin-top:8px" }, [btn("📂 Mở thư mục dữ liệu", "", function () { store.openFolder(); })]));
    }
    c.appendChild(h("div", { class: "warn", text: "Trước khi cài lại Windows / đổi máy: bấm 'Sao lưu ra file' và cất file sang USB/Drive. Sang máy mới cài app rồi 'Khôi phục từ file'." }));
    var bar = h("div", { class: "bar" });
    bar.appendChild(btn("⬇ Sao lưu ra file", "pri", function () { download("LuongHAK_backup_" + new Date().toISOString().slice(0, 10) + ".json", "application/json", JSON.stringify(db)); audit("Sao lưu ra file", ""); }));
    bar.appendChild(btn("⬆ Khôi phục từ file", "", function () {
      var f = h("input", { type: "file", accept: ".json" });
      f.addEventListener("change", function () { var fr = new FileReader(); fr.onload = function () { restoreFromText(fr.result, f.files[0].name); }; fr.readAsText(f.files[0]); });
      f.click();
    }));
    bar.appendChild(btn("📋 Nạp danh mục chuẩn HAK", "", napMau));
    c.appendChild(bar);
    c.appendChild(h("h3", { text: "Nhập dữ liệu từ Excel", style: "margin-top:18px" }));
    c.appendChild(h("div", { class: "hint", text: "Cách nhanh nhất: tải 1 file mẫu có đủ các sheet (Nhân sự, Chấm công, Mã lương...), điền dữ liệu rồi nhập lại 1 lần. Hoặc vào từng mục và dùng nút 'Tải file mẫu' riêng." }));
    bar = h("div", { class: "bar" });
    bar.appendChild(btn("📄 Tải toàn bộ file mẫu", "pri", downloadAllTemplates));
    bar.appendChild(btn("⬆ Nhập từ file Excel tổng", "", importAllFile));
    bar.appendChild(h("span", { class: "sp" }));
    bar.appendChild(btn("🗑 Xóa toàn bộ dữ liệu", "red", function () { if (confirm("XÓA TOÀN BỘ dữ liệu? Không thể hoàn tác!") && confirm("Chắc chắn chứ?")) { backupNow("truoc-xoa-toan-bo"); db = {}; ensureTables(); audit("Xóa toàn bộ dữ liệu", "đã sao lưu trước khi xóa"); saveNow(); st.kq = null; render(); } }));
    c.appendChild(bar);
    c.appendChild(h("div", { class: "hint", text: "Hiện có — " + Object.keys(ALL).map(function (k) { return ALL[k].ten + ": " + countOf(k); }).join(" · ") }));
    var w = h("div"); w.appendChild(cardCongTy()); w.appendChild(c); w.appendChild(cardBackups()); w.appendChild(cardIntegrity());
    return w;
  }
  // ---------- Khôi phục / sao lưu / kiểm tra dữ liệu ----------
  function summarize(o) { return "Nhân viên: " + ((o.nhanvien || []).length) + " · Chấm công: " + ((o.chamcong || []).length) + " dòng · Kỳ đã chốt: " + ((o.kyluong || []).length); }
  function restoreFromText(text, label) {
    var o;
    try { o = JSON.parse(text); } catch (e) { alert("File không phải dữ liệu hợp lệ (JSON lỗi)."); return; }
    if (!o || typeof o !== "object" || Array.isArray(o)) { alert("File không đúng cấu trúc dữ liệu của app."); return; }
    var known = Object.keys(ALL).concat(["kyluong", "nhansu", "congty"]).filter(function (k) { return Array.isArray(o[k]); });
    if (!known.length) { alert("File không chứa bảng dữ liệu nào của app — không khôi phục."); return; }
    if (!confirm("KHÔI PHỤC từ " + label + "\n\nFile này: " + summarize(o) + "\nHiện tại: " + summarize(db) + "\n\nToàn bộ dữ liệu hiện tại sẽ được THAY THẾ. App sẽ tự sao lưu dữ liệu hiện tại trước khi khôi phục. Tiếp tục?")) return;
    if (!readOnly) backupNow("truoc-khoi-phuc");
    db = o; var mm = HRM.migrate(db).concat(INT.normalizeDataset(db).messages); readOnly = false; loadError = null; ensureTables();
    audit("Khôi phục dữ liệu", label);
    if (!saveNow()) { alert("Đã nạp dữ liệu nhưng CHƯA lưu được xuống đĩa!"); }
    st.kq = null; st.tab = "home"; render(); toast("Đã khôi phục từ " + label); if (mm.length) alert(mm.join("\n"));
  }
  function cardBackups() {
    var c = h("div", { class: "card" });
    c.appendChild(h("h3", { text: "🗂 Các bản sao lưu tự động trên máy" }));
    if (!store || !store.listBackups) { c.appendChild(h("div", { class: "hint", text: "Chỉ có trong bản cài (.exe). Bản chạy trình duyệt: dùng 'Sao lưu ra file'." })); return c; }
    c.appendChild(h("div", { class: "hint", text: "daily = đầu mỗi ngày (giữ 60) · startup = mỗi lần mở app (giữ 10) · truoc-… = tự sao lưu trước thao tác lớn (nhập Excel, mở chốt, khôi phục, xóa)." }));
    c.appendChild(h("div", { class: "bar" }, [btn("💾 Tạo bản sao lưu ngay", "pri", function () { var n = backupNow("thu-cong"); toast(n ? "Đã tạo " + n : "Chưa có dữ liệu để sao lưu"); render(); })]));
    var list = store.listBackups().slice(0, 40);
    if (!list.length) { c.appendChild(h("div", { class: "empty", text: "Chưa có bản sao lưu." })); return c; }
    var t = h("table"), tr = h("tr"); ["Tên file", "Loại", "Thời điểm", "Dung lượng", ""].forEach(function (x) { tr.appendChild(h("th", { text: x })); }); t.appendChild(h("thead", {}, [tr]));
    var tb = h("tbody");
    list.forEach(function (b) {
      var x = h("tr");
      [b.name, b.tag, fmtTime(b.mtime), Math.round(b.size / 1024) + " KB"].forEach(function (v) { x.appendChild(h("td", { class: "t", text: v })); });
      x.appendChild(h("td", { style: "text-align:right" }, [btn("Khôi phục", "", function () { var r = store.readBackup(b.name); if (!r.ok) { alert(r.error); return; } restoreFromText(r.text, b.name); })]));
      tb.appendChild(x);
    });
    t.appendChild(tb); c.appendChild(h("div", { class: "tw", style: "max-height:320px" }, [t]));
    return c;
  }
  function cardIntegrity() {
    var c = h("div", { class: "card" }), issues = INT.check(db);
    c.appendChild(h("h3", { text: "🩺 Kiểm tra dữ liệu" }));
    if (!issues.length) { c.appendChild(h("div", { class: "ok", text: "Không phát hiện vấn đề về toàn vẹn dữ liệu." })); return c; }
    c.appendChild(h("div", { class: "hint", text: issues.length + " vấn đề cần xem xét. Critical/High có thể làm sai tiền lương." }));
    c.appendChild(simpleTable(issues.map(function (i) { return { "Mức độ": i.level, "Khu vực": i.area, "Nội dung": i.msg }; })));
    return c;
  }
  function recoveryScreen() {
    var w = h("div"), c = h("div", { class: "card" });
    c.appendChild(h("h3", { text: "⚠ Không mở được file dữ liệu" }));
    c.appendChild(h("div", { class: "warn", html: esc(loadError.error) + "<br>App <b>chưa ghi đè</b> file này. Hãy khôi phục từ một bản sao lưu bên dưới, hoặc từ file sao lưu bạn đã cất (USB/Drive)." }));
    var bar = h("div", { class: "bar" });
    bar.appendChild(btn("⬆ Khôi phục từ file…", "pri", function () { var f = h("input", { type: "file", accept: ".json" }); f.addEventListener("change", function () { var fr = new FileReader(); fr.onload = function () { if (store.quarantine) store.quarantine(); restoreFromText(fr.result, f.files[0].name); }; fr.readAsText(f.files[0]); }); f.click(); }));
    bar.appendChild(btn("📂 Mở thư mục dữ liệu", "", function () { store.openFolder(); }));
    bar.appendChild(btn("Bắt đầu với dữ liệu trống", "red", function () {
      if (!confirm("Cất file hỏng sang tên khác (KHÔNG xóa) và bắt đầu với dữ liệu trống?")) return;
      var q = store.quarantine && store.quarantine(); db = {}; readOnly = false; loadError = null; ensureTables(); saveNow(); render(); alert("File hỏng đã được giữ lại với tên: " + (q || "(không có)"));
    }));
    c.appendChild(bar);
    var list = (loadError.backups || []).slice(0, 30);
    if (list.length) {
      var t = h("table"), tr = h("tr"); ["Bản sao lưu", "Thời điểm", "Dung lượng", ""].forEach(function (x) { tr.appendChild(h("th", { text: x })); }); t.appendChild(h("thead", {}, [tr]));
      var tb = h("tbody");
      list.forEach(function (b) {
        var x = h("tr"); [b.name, fmtTime(b.mtime), Math.round(b.size / 1024) + " KB"].forEach(function (v) { x.appendChild(h("td", { class: "t", text: v })); });
        x.appendChild(h("td", {}, [btn("Khôi phục bản này", "pri", function () { var r = store.readBackup(b.name); if (!r.ok) { alert(r.error); return; } if (store.quarantine) store.quarantine(); restoreFromText(r.text, b.name); })]));
        tb.appendChild(x);
      });
      t.appendChild(tb); c.appendChild(h("div", { class: "tw" }, [t]));
    } else c.appendChild(h("div", { class: "empty", text: "Không tìm thấy bản sao lưu tự động." }));
    w.appendChild(c); return w;
  }
  function napMau() {
    var sd = HRM.seedDanhMuc(), done = [], skip = [];
    Object.keys(sd).forEach(function (k) { if (!db[k].length) { db[k] = sd[k]; done.push(DM[k].ten); } else skip.push(DM[k].ten); });
    if (done.length) audit("Nạp danh mục chuẩn", done.join(", "));
    saveNow(); render();
    alert((done.length ? "Đã nạp: " + done.join(", ") + "\n" : "") + (skip.length ? "Giữ nguyên (đã có dữ liệu): " + skip.join(", ") + "\n" : "") + "\nSố liệu lấy theo danh mục thật của HAK (QL_NHANSU). Kế toán kiểm tra lại đơn giá, tỷ lệ BH, biểu thuế theo quy định hiện hành.");
  }

  // ---------- Khung & điều hướng ----------
  var NAV = [
    ["home", "🏠", "Trang chủ"], ["luong", "▶", "Tính lương"], ["kyluong", "🔒", "Kỳ lương đã chốt"], ["baocaoluong", "📈", "Báo cáo lương"],
    ["grp", "Nhập liệu hàng tháng"],
    ["chamcong", "🗓", "Chấm công"], ["sanluong", "⚖", "Sản lượng"], ["bandam", "🚛", "Bơm dăm"], ["psluong", "🎁", "Thưởng / Trừ"], ["ungluong", "💵", "Tạm ứng"], ["tiencom", "🍚", "Suất cơm"],
    ["grp", "Dữ liệu gốc"],
    ["nhansu", "👥", "Nhân sự"], ["baocao", "📊", "Báo cáo nhân sự"], ["dm", "📚", "Danh mục"],
    ["grp", "Hệ thống"],
    ["backup", "⚙", "Công ty & Sao lưu"]
  ];
  var TITLES = { home: "Trang chủ", luong: "Tính lương", slips: "Phiếu lương", dm: "Danh mục", backup: "Công ty & Sao lưu", nhansu: "Nhân sự", nv: "Hồ sơ nhân viên", baocao: "Báo cáo nhân sự", kyluong: "Kỳ lương đã chốt", baocaoluong: "Báo cáo lương" };
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
    try { renderInner(); }
    catch (e) {
      var m = $("#main"); if (!m) return;
      m.innerHTML = "";
      m.appendChild(h("div", { class: "card" }, [h("h3", { text: "⚠ Có lỗi khi hiển thị màn hình này" }),
        h("div", { class: "warn", text: String(e && e.message || e) }),
        h("div", { class: "hint", text: "Dữ liệu KHÔNG bị mất. Hãy quay về Trang chủ; nếu lỗi lặp lại, bấm Sao lưu ra file và gửi file + ảnh màn hình cho người hỗ trợ." }),
        h("div", { class: "bar" }, [btn("🏠 Về Trang chủ", "pri", function () { st.tab = "home"; render(); }), btn("⬇ Sao lưu ra file", "", function () { download("LuongHAK_backup_" + new Date().toISOString().slice(0, 10) + ".json", "application/json", JSON.stringify(db)); })])]));
      if (window.console) console.error(e);
    }
  }
  function renderInner() {
    if (loadError) { $("#nav").innerHTML = ""; $("#top").innerHTML = "<h2>Khôi phục dữ liệu</h2>"; var mm = $("#main"); mm.innerHTML = ""; mm.appendChild(recoveryScreen()); return; }
    var nav = $("#nav"); nav.innerHTML = "";
    var activeNav = st.tab === "slips" ? "luong" : (st.tab === "nv" ? "nhansu" : st.tab);
    NAV.forEach(function (n) {
      if (n[0] === "grp") { nav.appendChild(h("div", { class: "grp", text: n[1] })); return; }
      var b = h("button", { class: activeNav === n[0] ? "on" : "", "data-k": n[0], on: { click: function () { if (st.tab !== n[0]) st.q = ""; st.tab = n[0]; saveUi(); render(); } } }, [h("span", { class: "ic", text: n[1] }), h("span", { text: n[2] })]);
      if (S[n[0]]) b.appendChild(h("span", { class: "n", text: countOf(n[0]) }));
      if (n[0] === "kyluong") b.appendChild(h("span", { class: "n", text: db.kyluong.length }));
      if (n[0] === "nhansu") b.appendChild(h("span", { class: "n", text: db.nhanvien.filter(function (r) { return r["Trạng thái"] !== "Đã nghỉ việc"; }).length }));
      nav.appendChild(b);
    });
    $("#sidefoot").textContent = "v1.4 · " + (store ? "Tự lưu ra file trên máy" : "Dữ liệu lưu trong trình duyệt");
    var bb = $(".brand small"); if (bb) bb.textContent = congTy()["Tên công ty"] || "Chạy offline";
    var top = $("#top"); top.innerHTML = "";
    var title = TITLES[st.tab] || (S[st.tab] && S[st.tab].ten) || "";
    top.appendChild(h("h2", { text: title }));
    if (["nhansu", "nv", "dm", "backup", "kyluong"].indexOf(st.tab) < 0) top.appendChild(periodBox());
    var m = $("#main"); m.innerHTML = ""; refreshNVList();
    if (st.tab === "home") m.appendChild(tabHome());
    else if (st.tab === "luong") m.appendChild(tabLuong());
    else if (st.tab === "slips") m.appendChild(tabSlips());
    else if (st.tab === "backup") m.appendChild(tabSaoLuu());
    else if (st.tab === "dm") m.appendChild(tabDanhMuc());
    else if (st.tab === "nhansu") m.appendChild(tabNhanSu());
    else if (st.tab === "nv") m.appendChild(tabNhanVien());
    else if (st.tab === "baocao") m.appendChild(tabBaoCao());
    else if (st.tab === "kyluong") m.appendChild(tabKyLuong());
    else if (st.tab === "baocaoluong") m.appendChild(tabBaoCaoLuong());
    else if (S[st.tab]) m.appendChild(grid(st.tab, S[st.tab]));
    else { st.tab = "home"; render(); }
  }
  if (window.HAKIcons) { window.HAKIcons.watch($("#app")); window.HAKIcons.watch($("#modal")); }
  render();
  if (migMsg.length) setTimeout(function () { alert("Đã nâng cấp dữ liệu:\n- " + migMsg.join("\n- ")); }, 300);
})();
