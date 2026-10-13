// ===== GIAO DIỆN APP TÍNH LƯƠNG HAK (offline) =====
(function () {
  "use strict";
  var KEY = "luonghak_db_v1";
  var E = window.LuongEngine, C = window.HAKCore, VAL = C.validate, IMP = C.importer, INT = C.integrity, CLS = C.close, GRD = C.guard, SCH = C.schema, PERM = C.perm, RP = C.repo, ALLOC = C.alloc, BHR = C.bh, RC = C.reconcile, PCC = C.preClose, FML = C.formula, FAP = C.formulaApproval, RF = C.reportFilter, IPAY = C.internalPayroll, RH = C.reportHtml;
  var DAYS = []; for (var i = 1; i <= 31; i++) DAYS.push(("0" + i).slice(-2));

  // ---------- Định nghĩa bảng ----------
  var S = {
    chamcong: { ten: "Chấm công", icon: "🗓", cols: ["Kỳ", "Mã NV", "Hình thức công"].concat(DAYS), kyCol: "Kỳ", hide: ["Kỳ"], def: { "Hình thức công": "BT" }, showName: true, total: true, hint: "Mỗi dòng = 1 nhân viên × 1 hình thức công trong tháng. Hình thức: BT (bình thường), CL (lễ), PN (phép năm), CC (tính cơm), TC/TC1–TC6 (tăng ca). Ô ngày nhập 1, 0.5, hoặc 1QC (1 công + nhãn QC). Cột đỏ nhạt là Chủ nhật." },
    sanluong: { ten: "Sản lượng", icon: "⚖", cols: ["Phiếu cân", "Ngày cân", "Biển số", "KL hàng (Tấn)", "Mã NV", "Mã phòng ban", "NV vắng", "Cân lần 1", "Cân lần 2"], dateCol: "Ngày cân", showName: true, hint: "Cách 1 (như công cụ phân bổ): ghi Mã phòng ban (tổ) + NV vắng → khối lượng chia ĐỀU cho người của tổ có mặt ngày cân (vắng: ghi tên cuối, VD 'Long, Định', hoặc Mã NV). Người có đơn nghỉ đã duyệt (nghỉ phép, không lương, ốm) tự không nhận phiếu những ngày nghỉ — không cần ghi NV vắng. Cách 2: ghi Mã NV → giao đúng người đó. Xem kết quả chia ở Báo cáo lương → Phân bổ sản lượng." },
    bandam: { ten: "Bơm dăm", icon: "🚛", cols: ["Phiếu cân", "Ngày cân", "Biển số", "KL hàng (Tấn)", "Mã NV", "Mã phòng ban", "NV vắng", "Cân lần 1", "Cân lần 2"], dateCol: "Ngày cân", showName: true, hint: "Cột 'KL hàng (Tấn)' ở bảng này là SỐ XE (mỗi phiếu thường = 1 xe), nhân với đơn giá bơm dăm. Chia theo tổ như Sản lượng: ghi Mã phòng ban + NV vắng, hoặc ghi Mã NV." },
    psluong: { ten: "Thưởng / Trừ", icon: "🎁", cols: ["Ngày hạch toán", "Số chứng từ", "Mã NV", "Diễn giải", "Thưởng", "Thu nhập khác", "Trừ khác"], dateCol: "Ngày hạch toán", showName: true },
    ungluong: { ten: "Tạm ứng", icon: "💵", cols: ["Ngày hạch toán", "Số chứng từ", "Mã NV", "Diễn giải", "Tạm ứng"], dateCol: "Ngày hạch toán", showName: true },
    tiencom: { ten: "Suất cơm", icon: "🍚", cols: ["Ngày", "Mã NV", "Số suất cơm", "Ghi chú"], dateCol: "Ngày", showName: true }
  };
  var DM = {
    dm_luong: { ten: "Mã lương", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã lương", "Mã hình thức lương", "Hình thức lương", "Loại công thức", "Số tiền khoán", "Lương phụ", "Ngưỡng truy thu BH (công)", "ĐK_Bù lương (công tối thiểu)", "Đơn giá bù lương", "Ngưỡng công bù theo tổ", "Đơn giá bơm dăm", "Số ngày giảm trừ", "Cách tính"], hint: "Quy chế 2026: công chuẩn = số ngày của tháng − 'Số ngày giảm trừ' (riêng 'tất cả ngày CN' = trừ Chủ nhật); công nhật tính tăng ca theo công chuẩn này. 'Mã hình thức lương' chứa chữ SP (vd LSP) = lương sản phẩm. 'Đơn giá bù lương' = mức sàn đ/ngày công. Bù theo tháng / ngày (cách cũ) dùng 'ĐK_Bù lương' (tấn/công); bù theo bình quân tổ dùng 'Ngưỡng công bù theo tổ' (công BT tối thiểu/tháng); bù theo ngày bậc thang không xét ngưỡng. 'Cách tính' quyết định công chuẩn: 'Số ngày của tháng - tất cả ngày CN', 'Thực tế ngày công'... 'Loại công thức' (chỉ áp dụng cho mã SP, quy chế 2026): để trống = Lương TG tính theo Công lễ + Công phép (hành vi hiện tại) · TG_LE_TANGCA = tính theo Công lễ + Công tăng ca (đúng M thật HAK_DN — chỉ chọn khi đã xác nhận đúng cho dữ liệu công ty mình)." },
    dm_phucap: { ten: "Phụ cấp", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã phụ cấp", "Tên phụ cấp", "Loại công thức", "Số tiền", "Tỷ lệ", "Tham chiếu", "Cách tính"], hint: "'Loại công thức' (để trống = hành vi cũ, không đổi số liệu): CO_DINH = luôn tính cố định dù 'Cách tính' ghi gì · TYLE_KHONG_TRU = tỷ lệ theo công, không trừ gì khi dưới ngưỡng · TYLE_TRU_PHEP_TANGCA = tỷ lệ, dưới ngưỡng trừ phép+tăng ca (quy chế 2026/C6, đã đối chiếu CNHAK/HAKQN thật) · TYLE_TRU_LE_PHEP = tỷ lệ, dưới ngưỡng trừ lễ+phép (đối chiếu M thật HAK_DN — chỉ dùng khi đã xác nhận đúng cho mã/công ty đó)." },
    dm_tangca: { ten: "Tăng ca", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã tăng ca", "Nội dung tăng ca", "Loại công thức", "Hệ số tăng ca", "Tiền tăng ca (nếu tính cố định)", "Cách tính"], hint: "'Loại công thức': để trống = dùng đúng công thức của tên Mã tăng ca (TC1-TC6, như trước đây). Thêm mã MỚI muốn dùng lại 1 trong các công thức TC1/TC2/TC3/TC4/TC5/TC6 đã có — ghi đúng tên công thức đó vào đây, không cần sửa phần mềm." },
    dm_hotro: { ten: "Hỗ trợ", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã hỗ trợ", "Tên hỗ trợ", "Loại công thức", "Số tiền", "Cách tính"], hint: "'Loại công thức' (để trống = đúng công thức cũ theo vị trí gán — 'Mã hỗ trợ' = theo ngày, 'Mã hỗ trợ 2' = bù thiếu công chuẩn): HT_THEO_NGAY = Số tiền × số ngày (cơm...) · HT_THIEU_CHUAN = (Công chuẩn − Tổng công) × Số tiền khi thiếu công, 0 khi đủ/thừa. Cho phép 1 mã dùng công thức khác vị trí gán mặc định." },
    dm_baohiem: { ten: "Bảo hiểm", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã bảo hiểm", "Nội dung", "DN.BHXH", "DN.BHYT", "DN.BHTN", "DN.KPCD", "NLD.BHXH", "NLD.BHYT", "NLD.BHTN", "NLD.KPCD"], hint: "Nhập tỷ lệ dạng 0.08 hoặc 8%. DN = công ty đóng, NLD = người lao động đóng." },
    dm_tncn: { ten: "Thuế TNCN", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã thuế TNCN", "Nội dung", "Mức thuế", "Ghi chú"], hint: "Phương thức thuế gán trong phụ lục HĐ. 'Nội dung' chứa 'Khấu trừ vãng lai' → khấu trừ theo Mức thuế (mặc định 10%); 'Lũy tiến' → tính theo Biểu thuế lũy tiến; 'Miễn thuế' → không khấu trừ." },
    dm_bacthue: { ten: "Biểu thuế lũy tiến", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã thuế TNCN", "Bậc", "Thu nhập từ", "Thu nhập đến", "Tỷ lệ"], hint: "Bậc cao nhất để 'Thu nhập đến' = 0 hoặc trống (không giới hạn). Mỗi bộ biểu thuế có 'Hiệu lực từ/đến' riêng. 'Mã thuế TNCN': để trống = áp dụng chung cho mọi mã lũy tiến; chỉ cần ghi khi có NHIỀU HƠN 1 biểu thuế lũy tiến khác nhau (PV-7c)." },
    dm_giamtru: { ten: "Giảm trừ gia cảnh", cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã giảm trừ", "Số người", "Số tiền"], hint: "Mã bắt đầu GTBT = bản thân, GTNPT = mỗi người phụ thuộc. Số người phụ thuộc lấy từ hồ sơ Nhân thân (Đăng ký phụ thuộc = Có)." },
    dm_phongban: { ten: "Phòng ban", cols: ["Mã khối", "Tên khối", "Mã phòng ban", "Tên phòng ban", "Tài khoản chi phí", "Hiệu lực từ", "Hiệu lực đến"], hint: "'Tài khoản chi phí' dùng cho Bảng hạch toán lương (VD 622 sản xuất, 627 quản lý PX, 641 bán hàng, 642 quản lý DN). Để trống: khối Sản xuất → 622, còn lại → 642." },
    dm_chucvu: { ten: "Chức vụ", cols: ["Mã chức vụ", "Tên chức vụ", "Hiệu lực từ", "Hiệu lực đến"] },
    dm_cc: { ten: "Hình thức công", cols: ["Mã CC", "Nội dung", "Hình thức công", "Diễn giải", "Hiệu lực từ", "Hiệu lực đến"], hint: "Danh sách mã hình thức công dùng trong bảng chấm công (BT, PN, CL, TC, CC…)." },
    // Master Prompt mục III/VII: Dynamic Payroll Formula Engine — thêm/sửa công thức tăng ca, phụ cấp, hỗ trợ KHÔNG cần sửa code.
    dm_congthuc: {
      ten: "Công thức tiền lương",
      cols: ["Hiệu lực từ", "Hiệu lực đến", "Mã công thức", "Tên công thức", "Loại", "Công ty", "Biểu thức", "Tham số", "Đơn vị tính", "Mức tiền", "Hệ số", "Đối tượng áp dụng", "Trạng thái", "Phiên bản", "Người lập", "Ngày lập", "Người duyệt", "Thời điểm duyệt", "Người kích hoạt", "Thời điểm kích hoạt", "Người ngừng", "Thời điểm ngừng", "Lý do thay đổi", "Mô tả"],
      def: { "Trạng thái": "Nháp" },
      hint: "'Loại': OVERTIME (tăng ca) · ALLOWANCE (phụ cấp) · SUPPORT (hỗ trợ) — khớp đúng 'Mã công thức' đã gán cho nhân viên (Mã tăng ca / Mã phụ cấp / Mã hỗ trợ), engine tự tra công thức này TRƯỚC, không cần sửa phần mềm. 'Trạng thái': chỉ 'Hiệu lực' mới được dùng để tính lương chính thức — 'Nháp'/'Đã duyệt' dùng để soạn & chạy thử (tab Kiểm tra công thức) trước khi kích hoạt; 'Ngừng' = thôi áp dụng. 'Công ty': để trống = áp dụng mọi công ty; ghi cụ thể để ưu tiên hơn bản chung. 'Biểu thức' dùng tên biến ở tab Thư viện biến (CONG_TC, MUC_PHU_CAP, HE_SO_TC…), hàm MIN/MAX/ROUND/IF… Xem tab Mẫu công thức để copy công thức có sẵn."
    },
    // Master Prompt mục VIII: CompanyID → PolicyVersion → PayrollMethod — phương pháp bù sản lượng
    // CHÍNH THỨC (dùng khi chốt kỳ) không được quyết định bởi lựa chọn tự do trên màn hình Tính
    // lương; phải lấy từ đây (bản "Hiệu lực"). Màn hình Tính lương vẫn cho chọn tự do để XEM THỬ.
    dm_quychebu: {
      ten: "Quy chế bù sản lượng",
      cols: ["Hiệu lực từ", "Hiệu lực đến", "Cách bù", "Trạng thái", "Người phê duyệt", "Mô tả"],
      def: { "Trạng thái": "Nháp" },
      hint: "'Cách bù' (đúng 1 trong 4 mã, xem Tính lương để biết tên hiển thị): false = theo THÁNG (từng người) · true = theo NGÀY liên tục (cách cũ) · daihiep = theo NGÀY bậc thang (công cụ HAK/Đại Hiệp) · to = theo BÌNH QUÂN TỔ (công cụ HAK). Chỉ bản 'Trạng thái'='Hiệu lực' mới được dùng để CHỐT kỳ — màn hình Tính lương vẫn cho chọn phương pháp khác để xem thử/so sánh, nhưng khi chốt app tự tính lại theo đúng bản Hiệu lực ở đây. Chưa có bản Hiệu lực nào cho kỳ đang chốt (và kỳ đó có sản lượng cần bù) → KHÔNG chốt được."
    }
  };
  var HRT = {}; Object.keys(HRM.HR).forEach(function (k) { HRT[k] = { ten: HRM.HR[k].ten, cols: HRM.HR[k].store, hr: true }; });
  var ALL = Object.assign({}, S, DM, HRT);
  // Q-20: bảng có Số chứng từ → trên lưới chặn 2 dòng cùng Số chứng từ + Mã NV (dòng chưa có số chứng từ không bị ảnh hưởng)
  var CT_KEY = { psluong: true, ungluong: true };
  // Mọi thêm / sửa / xóa bản ghi nghiệp vụ đi qua repository (core/repository.js): quyền → ô ngày → trùng khóa → Q-15 → kỳ chốt / hồi tố, kiểm tra xong mới sửa dữ liệu
  var REPO = RP.createRepo({ db: function () { return db; }, can: function (p) { return can(p); }, audit: function (a, d) { audit(a, d); }, uid: function () { return HRM.uid(); }, user: function () { return session ? session.tenDangNhap : currentUser(); },
    tableName: function (t) { return ALL[t] ? ALL[t].ten : t; }, hdChildren: HRM.HD_TABS });
  /** Ghi theo kế hoạch của repository: bị chặn → báo lý do; hồi tố + o.confirm → hỏi xác nhận (Hủy = không đổi gì). Trả kết quả hoặc null. */
  function commit(p, o) {
    o = o || {};
    if (!p.ok) { alert(p.msg); return null; }
    if (p.retro && o.confirm && !confirm(p.confirmMsg)) return null;
    var r = REPO.apply(p, o);
    if (!r.ok) { alert(r.msg); return null; }
    return r;
  }
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
    var s = null; try { s = localStorage.getItem(KEY); } catch (e) { s = null; }
    if (s) {
      // Dữ liệu trong trình duyệt bị hỏng: KHÔNG coi là rỗng (sẽ bị ghi đè) — chuyển sang màn hình khôi phục
      try { fromLocal = !!store; return JSON.parse(s); } catch (e) { loadError = { error: "Dữ liệu lưu trong trình duyệt bị hỏng: " + e.message, backups: [] }; readOnly = true; return {}; }
    }
    return {};
  })();
  // Kiểm tra CẤU TRÚC trước khi nâng cấp/chuẩn hóa: bảng sai kiểu, file của bản mới hơn… → chỉ xem, không ghi đè
  var schemaReport = null;
  if (!readOnly) {
    schemaReport = SCH.validate(db, { tables: Object.keys(ALL), hrTables: Object.keys(HRT) });
    if (schemaReport.fatal.length) { loadError = { error: "Cấu trúc dữ liệu không an toàn để mở:\n- " + schemaReport.fatal.join("\n- "), backups: store && store.listBackups ? store.listBackups() : [], schema: schemaReport }; readOnly = true; }
  }
  // Sao lưu TRƯỚC NÂNG CẤP: chụp nguyên trạng file dữ liệu của bản cũ trước khi chuyển đổi (1 lần cho mỗi lần nâng schema)
  if (!readOnly && store && store.backup && db && Object.keys(db).length && db.schemaVersion !== 2) { try { store.backup("truoc-nang-cap"); } catch (e) { /* không chặn mở app */ } }
  var migMsg = [];
  if (!readOnly) {
    try { migMsg = HRM.migrate(db).concat(INT.normalizeDataset(db).messages); }
    catch (e) { loadError = { error: "Lỗi khi chuyển đổi dữ liệu cũ: " + e.message + " — dữ liệu KHÔNG bị ghi đè", backups: store && store.listBackups ? store.listBackups() : [] }; readOnly = true; }
  }
  // Chỉ TẠO bảng còn thiếu; bảng có nhưng sai kiểu đã bị chặn ở bước kiểm tra cấu trúc (không bao giờ thay bằng bảng rỗng)
  function ensureTables() {
    Object.keys(ALL).concat(["congty", "kyluong", "kyluong_lichsu", "auditlog", "nguoidung", "baomat", "chungtu"]).forEach(function (k) {
      if (db[k] === undefined) db[k] = [];
      else if (!Array.isArray(db[k])) throw new Error("Bảng " + k + " sai cấu trúc — không tự thay thế");
    });
    db.schemaVersion = 2;
  }
  if (!readOnly) {
    // Không để lỗi cấu trúc thoát ra làm sập cả app khi khởi động → chuyển sang chế độ chỉ xem / khôi phục (như bước chuyển đổi ở trên)
    try { ensureTables(); }
    catch (e) { loadError = { error: "Lỗi khi kiểm tra bảng dữ liệu: " + e.message + " — dữ liệu KHÔNG bị ghi đè", backups: store && store.listBackups ? store.listBackups() : [] }; readOnly = true; }
  }
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
  // P0: backupNow() có thể âm thầm thất bại (đĩa đầy, mất quyền ghi…) và trả null — các hành động KHÔNG THỂ
  // HOÀN TÁC (xóa hẳn dữ liệu) phải DỪNG LẠI khi sao lưu thất bại, không được tiếp tục xóa như chưa có gì xảy ra.
  function backupOrBlock(tag, label) {
    var n = backupNow(tag);
    if (!n) { alert("⛔ KHÔNG tạo được bản sao lưu trước khi " + label + " — dữ liệu CHƯA bị xóa, để tránh mất không thể khôi phục.\nKiểm tra dung lượng đĩa / quyền ghi ở Công ty & Sao lưu rồi thử lại."); return false; }
    return true;
  }
  // Người thực hiện: tên người dùng khai báo trên máy này (Công ty & Sao lưu) hoặc tài khoản Windows
  var winUser = (function () { try { return store && store.whoami ? store.whoami() : null; } catch (e) { return null; } })();
  // ---------- Đăng nhập & phân quyền (core/permissions.js) ----------
  var session = null, lastActive = Date.now(), IDLE_MS = 30 * 60 * 1000;
  function currentUser() {
    var w = winUser ? winUser.user + "@" + winUser.host : "";
    if (session) return session.hoTen + " [" + session.tenDangNhap + "]" + (w ? " (" + w + ")" : "");
    return w || "Người dùng trình duyệt";
  }
  function can(p) { return PERM.can(session, p); }
  /** Q-24: được thấy lương cá nhân (lương thỏa thuận / lương cơ bản) nếu có quyền Xem bảng lương hoặc Sửa hồ sơ (Nhân sự cần để lập phụ lục) */
  function canSeePay() { return can("payroll.view") || can("hr.edit"); }
  /** Kiểm tra quyền ở tầng nghiệp vụ — gọi ở đầu mọi thao tác ghi/xuất dữ liệu. Trả false (và báo) nếu không có quyền. */
  function need(p, what) {
    try { PERM.need(session, p, what); return true; } catch (e) { alert("⛔ " + e.message + "."); return false; }
  }
  // Băm mật khẩu: bản cài dùng tiến trình chính (Node crypto); bản trình duyệt dùng WebCrypto
  var AUTH = {
    salt: function () {
      if (store && store.authSalt) return store.authSalt();
      var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    },
    hash: function (pw, salt, iter) {
      if (store && store.authHash) return Promise.resolve(store.authHash(pw, salt, iter));
      var enc = new TextEncoder(), sb = new Uint8Array(salt.match(/../g).map(function (x) { return parseInt(x, 16); }));
      return crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]).then(function (k) {
        return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sb, iterations: iter }, k, 256);
      }).then(function (bits) { return Array.prototype.map.call(new Uint8Array(bits), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); });
    },
    verify: function (pw, u) {
      if (store && store.authVerify) return Promise.resolve(store.authVerify(pw, u.salt, u.iter, u.hash));
      return AUTH.hash(pw, u.salt, u.iter).then(function (h0) { return h0 === u.hash; });
    },
    make: function (pw) { var salt = AUTH.salt(), iter = PERM.ITER; return AUTH.hash(pw, salt, iter).then(function (hash) { return { salt: salt, iter: iter, hash: hash }; }); }
  };
  function randomCode() { var a = AUTH.salt().toUpperCase(); return a.slice(0, 4) + "-" + a.slice(4, 8) + "-" + a.slice(8, 12) + "-" + a.slice(12, 16); }
  function logout(reason) { if (session) audit("Đăng xuất", reason || ""); session = null; st.kq = null; if (!readOnly) saveNow(); render(); }
  ["mousedown", "keydown"].forEach(function (ev) { document.addEventListener(ev, function () { lastActive = Date.now(); }, true); });
  // Ctrl+F: nhảy tới ô tìm kiếm của màn hình đang mở (nếu có)
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "k" || e.key === "K") && session && !loadError) { e.preventDefault(); quickSearch(); return; }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "f" || e.key === "F")) { var sb = document.querySelector("#main input.search, main input.search"); if (sb) { e.preventDefault(); sb.focus(); sb.select(); } }
  });
  setInterval(function () { if (session && Date.now() - lastActive > IDLE_MS) { logout("tự khóa sau 30 phút không thao tác"); toast("Đã tự khóa sau 30 phút không thao tác — đăng nhập lại"); } }, 30000);
  var AUDIT_MAX = 20000;
  function audit(action, detail) {
    db.auditlog.push({ luc: new Date().toISOString(), nguoi: currentUser(), thaoTac: action, chiTiet: detail || "" });
    if (db.auditlog.length > AUDIT_MAX) {
      // Không xóa im lặng: chuyển phần cũ ra bản sao lưu nhật ký trước khi cắt bớt
      if (store && store.backup) { try { store.backup("nhat-ky-truoc-cat"); } catch (e) { /* vẫn cắt để file không phình vô hạn */ } }
      db.auditlog.splice(0, db.auditlog.length - AUDIT_MAX);
    }
  }
  window.addEventListener("beforeunload", function () { if (dirty) saveNow(); });
  if (!readOnly && (fromLocal || migMsg.length)) saveNow();
  var now = new Date();
  var st = { tab: "home", dm: "dm_luong", nam: now.getFullYear(), thang: now.getMonth() + 1, bu: false, kq: null, compact: true, q: "", qs: {}, pg: {}, pageSize: 100 };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY + "_ui") || "{}"), { kq: null, q: "", pg: {} }); } catch (e) {}
  if (!st.qs || typeof st.qs !== "object") st.qs = {};
  if ([50, 100, 200, 500].indexOf(+st.pageSize) < 0) st.pageSize = 100;
  function saveUi() { try { localStorage.setItem(KEY + "_ui", JSON.stringify({ tab: st.tab === "nv" ? "nhansu" : st.tab === "slips" && st.kqFull ? "luong" : st.tab, dm: st.dm, nam: st.nam, thang: st.thang, bu: st.bu, compact: st.compact, qs: st.qs, pageSize: st.pageSize })); } catch (e) {} }
  // Giao diện sáng / tối (2.0-α15): ghi nhớ theo máy, mặc định sáng
  function curTheme() { try { return localStorage.getItem(KEY + "_theme") === "dark" ? "dark" : "light"; } catch (e) { return "light"; } }
  function applyTheme(t) { document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "light"); }
  function toggleTheme() { var t = curTheme() === "dark" ? "light" : "dark"; try { localStorage.setItem(KEY + "_theme", t); } catch (e) { /* vẫn đổi cho phiên này */ } applyTheme(t); render(); }
  applyTheme(curTheme());
  // ---------- Phân trang + tìm kiếm (PERF-03: 1.000 NV mở lưới chấm công 6,9 s, gõ 4 ký tự 19,9 s khi vẽ toàn bộ) ----------
  var PAGE_SIZES = [50, 100, 200, 500];
  /** Ô tìm kiếm riêng cho từng bảng (nhớ khi chuyển màn hình / mở lại app), chỉ lọc khi ngừng gõ 250 ms. */
  function searchBox(key, placeholder, onChange) {
    var q = h("input", { class: "i search", placeholder: placeholder, value: st.qs[key] || "" });
    q.addEventListener("input", function () {
      clearTimeout(q._t);
      q._t = setTimeout(function () { st.qs[key] = q.value; st.pg[key] = 0; saveUi(); onChange(); q.focus(); }, 250);
    });
    return q;
  }
  function qOf(key) { return String(st.qs[key] || "").trim().toLowerCase(); }
  /** Thanh phân trang. Trả { start, end, el }; trang hiện tại nhớ theo bảng trong phiên làm việc. */
  function pager(key, total, onChange) {
    var size = +st.pageSize || 100, pages = Math.max(1, Math.ceil(total / size));
    var p = Math.min(Math.max(0, st.pg[key] || 0), pages - 1); st.pg[key] = p;
    var go = function (x) { st.pg[key] = Math.min(Math.max(0, x), pages - 1); onChange(); };
    var sel = h("select", { title: "Số dòng mỗi trang" }); PAGE_SIZES.forEach(function (n) { sel.appendChild(h("option", { value: n, text: n + " dòng/trang" })); }); sel.value = size;
    sel.addEventListener("change", function () { var first = p * size; st.pageSize = +sel.value; st.pg[key] = Math.floor(first / st.pageSize); saveUi(); onChange(); });
    var el = total <= PAGE_SIZES[0] ? null : h("div", { class: "pager noprint" }, [
      btn("«", "ghost", function () { go(0); }, "Trang đầu"), btn("‹", "ghost", function () { go(p - 1); }, "Trang trước"),
      h("span", { text: "Trang " + (p + 1) + "/" + pages + " · dòng " + (p * size + 1) + "–" + Math.min(total, (p + 1) * size) + " / " + total }),
      btn("›", "ghost", function () { go(p + 1); }, "Trang sau"), btn("»", "ghost", function () { go(pages - 1); }, "Trang cuối"), sel]);
    return { start: p * size, end: Math.min(total, (p + 1) * size), el: el };
  }

  // ---------- Tiện ích ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "on") Object.keys(attrs.on).forEach(function (ev) { el.addEventListener(ev, attrs.on[ev]); });
      else if (k === "text") el.textContent = attrs[k]; else if (k === "html") el.innerHTML = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); }); // chữ → nút văn bản (icon emoji đầu chuỗi vẫn được đổi)
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
    sanluong: [{ "Phiếu cân": 4979, "Ngày cân": "2026-09-01", "Biển số": "43A-97033", "KL hàng (Tấn)": 3.13, "Mã NV": "", "Mã phòng ban": "02.02", "NV vắng": "Kiểu, Long, Lynh, Định", "Cân lần 1": 7540, "Cân lần 2": 4410 },
      { "Phiếu cân": 4980, "Ngày cân": "2026-09-01", "Biển số": "92K-9181", "KL hàng (Tấn)": 9.11, "Mã NV": "", "Mã phòng ban": "02.02", "NV vắng": "", "Cân lần 1": 13770, "Cân lần 2": 4660 },
      { "Phiếu cân": "PC0001", "Ngày cân": "2026-09-15", "Biển số": "43C-12345", "KL hàng (Tấn)": 28.5, "Mã NV": "NV001", "Mã phòng ban": "", "NV vắng": "" }],
    bandam: [{ "Phiếu cân": 201, "Ngày cân": "2026-09-01", "Biển số": "43A-97033", "KL hàng (Tấn)": 1, "Mã NV": "", "Mã phòng ban": "02.02", "NV vắng": "Kiểu, Long, Lynh, Định" },
      { "Phiếu cân": 202, "Ngày cân": "2026-09-01", "Biển số": "92K-9181", "KL hàng (Tấn)": 1, "Mã NV": "", "Mã phòng ban": "02.01", "NV vắng": "" }],
    psluong: [{ "Ngày hạch toán": "2026-09-30", "Số chứng từ": "QĐ-KT/09-01", "Mã NV": "NV001", "Diễn giải": "Thưởng chuyên cần", "Thưởng": 500000, "Thu nhập khác": 0, "Trừ khác": 0 }],
    ungluong: [{ "Ngày hạch toán": "2026-09-15", "Số chứng từ": "PC-0915-01", "Mã NV": "NV001", "Diễn giải": "Tạm ứng kỳ 1", "Tạm ứng": 2000000 }],
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
  function saveXlsx(filename, sheets, kind) { // sheets: [{name, cols, rows}] · kind "template" = file mẫu trống (không chứa dữ liệu)
    if (kind !== "template" && !need("export", "xuất dữ liệu ra Excel")) return;
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
    saveXlsx("Mau_" + slug(d.ten) + ".xlsx", [templateSheet(key), { name: "Hướng dẫn", cols: ["Cột", "Giải thích"], rows: guide }], "template");
  }
  function downloadAllTemplates() { saveXlsx("Mau_TatCa_LuongHAK.xlsx", Object.keys(ALL).map(templateSheet), "template"); toast("Đã tải file mẫu — mỗi bảng là 1 sheet"); }

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
  function planWorkbook(wb, onlyKey, mode) {
    var plans = [], extraEmp = {};
    var keys = onlyKey ? [onlyKey] : importOrder(Object.keys(ALL));
    keys.forEach(function (k) {
      var alt = { sanluong: ["Khoi luong", "Khối lượng"], bandam: ["Bom ban dam", "Bơm dăm"] }[k] || []; // tên sheet trong mẫu công cụ phân bổ
      var name = wb.SheetNames.filter(function (x) { return x === sheetName(ALL[k].ten); })[0] || wb.SheetNames.filter(function (x) { return alt.indexOf(x) >= 0; })[0];
      if (!name && onlyKey) name = wb.SheetNames[0];
      if (!name) return;
      // α19: Sản lượng / Bơm dăm đọc được cả file theo mẫu công cụ phân bổ (dòng tiêu đề phía trên, tên cột khác: "Ngày cân 1", "Số xe", "Mã phòng ban"…)
      var raw = k === "sanluong" || k === "bandam" ? IMP.rowsFromAoa(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" }), k, ALL[k].cols).rows : XLSX.utils.sheet_to_json(wb.Sheets[name], { raw: true, defval: "" });
      var p = IMP.plan(db, k, ALL[k].cols, raw, { lockedPeriods: lockedMap(), defaultKy: kyStr(), extraEmployees: extraEmp, mode: mode });
      p.sheet = name;
      if (k === "nhanvien") p.items.forEach(function (it) { if (it.action === "add" || it.action === "update") extraEmp[it.row["Mã NV"]] = 1; });
      plans.push(p);
    });
    return plans;
  }
  // replan(mode) → danh sách kế hoạch theo chế độ cập nhật ("merge" | "replace")
  function importPreview(replan, fileName, done, mode) {
    mode = mode || "merge";
    var plans = replan(mode);
    // Quyền theo từng bảng + chỉ Admin được ghi dữ liệu hồi tố (Q-14): dòng không đủ quyền → không ghi
    plans.forEach(function (p) {
      var perm = /^dm_/.test(p.table) ? "dm.edit" : (S[p.table] ? "input.edit" : "hr.edit"), okT = can(perm);
      p.items.forEach(function (it) {
        if (it.action !== "add" && it.action !== "update") return;
        if (!okT) { it.action = "locked"; it.reason = "Vai trò của bạn không có quyền ghi bảng này (" + PERM.PERMS[perm] + ")"; return; }
        if (it.action === "update" && p.table === "chitiethd" && GRD.frozenAppendix(db, it.target).length) { it.action = "locked"; it.reason = "Phụ lục đã dùng tính lương kỳ đã chốt " + GRD.frozenAppendix(db, it.target).map(GRD.label).join(", ") + " — không sửa được, hãy thêm phụ lục mới (Q-15)"; return; }
        if (!can("retro.edit")) {
          var imp0 = GRD.impactChange(db, p.table, it.target || null, Object.assign({}, it.target || {}, it.row));
          if (imp0.kind === "retro") { it.action = "locked"; it.reason = "HỒI TỐ kỳ đã chốt " + imp0.periods.map(GRD.label).join(", ") + " — chỉ Admin được ghi"; }
        }
      });
      Object.keys(p.summary).forEach(function (k) { p.summary[k] = 0; }); p.items.forEach(function (it) { p.summary[it.action] = (p.summary[it.action] || 0) + 1; });
    });
    if (!plans.length) { alert("Không thấy sheet nào đúng tên (Nhân viên, Chấm công, Mã lương...). Hãy dùng file mẫu của app."); return; }
    var body = h("div"), tot = {};
    Object.keys(IMP.LABEL).forEach(function (k) { tot[k] = 0; });
    plans.forEach(function (p) { Object.keys(tot).forEach(function (k) { tot[k] += p.summary[k] || 0; }); });
    body.appendChild(h("div", { class: "hint", html: "File <b>" + esc(fileName) + "</b> — kiểm tra trước khi ghi. Chỉ dòng <b>Thêm mới</b> và <b>Cập nhật</b> được ghi; dòng <b>Gộp</b> đã được cộng vào dòng cùng khóa; các dòng lỗi/trùng/xung đột/kỳ đã chốt bị bỏ qua." }));
    // Q-13 (chủ sở hữu xác nhận): khi file có dòng TRÙNG với dữ liệu đã có → người dùng chọn Bổ sung hay Ghi đè
    var nSame = 0; plans.forEach(function (p) { p.items.forEach(function (it) { if (it.target) nSame++; }); });
    var choice = h("div", { class: nSame ? "warn" : "hint", style: "margin:8px 0 12px" });
    choice.appendChild(h("div", { html: nSame ? "<b>File có " + nSame + " dòng trùng với dữ liệu đã có.</b> Chọn cách xử lý:" : "Cách xử lý nếu có dòng trùng với dữ liệu đã có:" }));
    [["merge", "Bổ sung", "chỉ thêm/sửa ô có dữ liệu trong file — ô để trống GIỮ NGUYÊN số đang có (mặc định, an toàn)"],
      ["replace", "Ghi đè", "thay cả dòng theo file — ô để trống trong file sẽ XÓA số đang có"]].forEach(function (o) {
      var r0 = h("input", { type: "radio", name: "impmode", value: o[0], "data-mode": o[0] }); r0.checked = mode === o[0];
      r0.addEventListener("change", function () { if (r0.checked) importPreview(replan, fileName, done, o[0]); });
      choice.appendChild(h("label", { style: "display:flex;gap:8px;align-items:flex-start;margin:6px 0;cursor:pointer" }, [r0, h("span", { html: "<b>" + o[1] + "</b> — " + o[2] })]));
    });
    body.appendChild(choice);
    var sumRows = plans.map(function (p) { var o = { "Bảng": ALL[p.table].ten, "Sheet": p.sheet }; Object.keys(IMP.LABEL).forEach(function (k) { o[IMP.LABEL[k]] = p.summary[k] || 0; }); return o; });
    body.appendChild(simpleTable(sumRows));
    var clears = 0, retro = {};
    plans.forEach(function (p) { p.items.forEach(function (it) {
      if (it.action === "update" && it.diff) clears += it.diff.clear.length;
      if (it.action !== "add" && it.action !== "update") return;
      var imp = GRD.impactChange(db, p.table, it.target || null, Object.assign({}, it.target || {}, it.row));
      if (imp.kind === "retro") { it.reason = (it.reason ? it.reason + " · " : "") + "HỒI TỐ kỳ đã chốt " + imp.periods.map(GRD.label).join(", "); imp.periods.forEach(function (x) { retro[x] = 1; }); }
    }); });
    if (Object.keys(retro).length) body.appendChild(h("div", { class: "warn", text: "⚠ Có dòng có hiệu lực hồi tố trong kỳ đã chốt " + Object.keys(retro).sort().map(GRD.label).join(", ") + ". Bảng lương đã chốt KHÔNG thay đổi — muốn áp dụng phải mở chốt và chốt lại." }));
    if (clears) body.appendChild(h("div", { class: "warn", text: "⚠ Chế độ ghi đè sẽ XÓA " + clears + " ô đang có dữ liệu (ô trống trong file). Kiểm tra cột 'Lý do' bên dưới." }));
    var rows = [];
    var nWarn = 0;
    plans.forEach(function (p) { p.items.forEach(function (it) { if (it.warn && (it.action === "add" || it.action === "update")) nWarn++; if (it.action !== "add" || /HỒI TỐ/.test(it.reason) || it.warn) rows.push({ "Bảng": ALL[p.table].ten, "Dòng Excel": it.line, "Phân loại": IMP.LABEL[it.action], "Lý do": it.reason, "Cảnh báo": it.warn || "", "Mã NV": it.row["Mã NV"] || "" }); }); });
    if (nWarn) body.appendChild(h("div", { class: "warn", text: "⚠ " + nWarn + " dòng sẽ ghi nhưng có ô bất thường (VD quá " + VAL.MAX_CONG_NGAY + " công/ngày, nhãn chưa có mã phụ cấp) — xem cột 'Cảnh báo'." }));
    var order = { conflict: 0, invalid: 1, refError: 2, locked: 3, update: 4, add: 4, merged: 5, duplicate: 6 }, byLabel = {};
    Object.keys(IMP.LABEL).forEach(function (k) { byLabel[IMP.LABEL[k]] = k; });
    rows.sort(function (a, b) { return order[byLabel[a["Phân loại"]]] - order[byLabel[b["Phân loại"]]]; });
    if (rows.length) { body.appendChild(h("div", { class: "fh", text: "Chi tiết các dòng cập nhật / không ghi (" + rows.length + ")" })); body.appendChild(simpleTable(rows.slice(0, 200))); if (rows.length > 200) body.appendChild(h("div", { class: "hint", text: "… và " + (rows.length - 200) + " dòng nữa — bấm 'Tải chi tiết' để xem đủ." })); }
    var nWrite = tot.add + tot.update;
    modal("Xem trước nhập Excel", body, function (close) {
      return [
        rows.length ? btn("⬇ Tải chi tiết", "", function () { saveXlsx("KiemTraNhapExcel.xlsx", [{ name: "ChiTiet", cols: Object.keys(rows[0]), rows: rows }]); }) : null,
        btn("Hủy", "", close),
        btn(nWrite ? "✔ Ghi " + nWrite + " dòng" : "Không có dòng nào để ghi", "pri", function () {
          if (!nWrite) { close(); return; }
          // P1: thao tác này đã có "before" + hoàn tác riêng khi saveNow() thất bại (an toàn dù sao lưu
          // dưới đây có thất bại hay không) — nên chỉ CẢNH BÁO, không chặn, nếu không tạo được bản sao lưu.
          var bkOk = !!backupNow("truoc-nhap-excel");
          var before = JSON.stringify(db), n = 0;
          plans.forEach(function (p) { n += IMP.apply(db, p, HRM.uid, !!(ALL[p.table] && ALL[p.table].hr)); });
          audit("Nhập Excel", fileName + " (" + (mode === "replace" ? "ghi đè cả dòng" : "bổ sung") + "): " + plans.map(function (p) { return p.table + " +" + p.summary.add + "/~" + p.summary.update + (p.summary.merged ? "/gộp " + p.summary.merged : ""); }).join(", "));
          if (!saveNow()) {
            // Lưu thất bại → hoàn tác trong bộ nhớ, không báo thành công
            db = JSON.parse(before); ensureTables(); close(); (done || render)();
            alert("⚠ KHÔNG lưu được xuống đĩa — đã hủy toàn bộ lần nhập này, dữ liệu giữ nguyên như trước khi nhập.");
            return;
          }
          close(); if (done) done(true); else render();
          toast("Đã ghi " + n + " dòng (" + tot.add + " mới, " + tot.update + " cập nhật" + (tot.merged ? ", gộp " + tot.merged : "") + ")" + (bkOk ? "" : " · ⚠ KHÔNG tạo được bản sao lưu trước khi nhập — kiểm tra dung lượng đĩa"));
        })];
    });
  }
  function importFile(key, done) { if (!need("import", "nhập Excel")) return; readWorkbook(function (wb, name) { importPreview(function (m) { return planWorkbook(wb, key, m); }, name, done); }); }
  function importAllFile() { if (!need("import", "nhập Excel")) return; readWorkbook(function (wb, name) { importPreview(function (m) { return planWorkbook(wb, null, m); }, name, render); }); }

  function modal(title, body, footer, opts) {
    var m = $("#modal"); m.innerHTML = ""; m.className = opts && opts.drawer ? "drawer" : "";
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
  function datalistFor(col, tableKey) {
    var src = { "Mã PB": ["dm_phongban", "Mã phòng ban"], "Mã CV": ["dm_chucvu", "Mã chức vụ"], "Mã tiền lương 1": ["dm_luong", "Mã lương"], "Mã tiền lương 2": ["dm_luong", "Mã lương"], "Mã tăng ca": ["dm_tangca", "Mã tăng ca"], "Mã phụ cấp": ["dm_phucap", "Mã phụ cấp"], "Mã hỗ trợ": ["dm_hotro", "Mã hỗ trợ"], "Mã hỗ trợ 2": ["dm_hotro", "Mã hỗ trợ"], "Mã BHXH": ["dm_baohiem", "Mã bảo hiểm"], "Mã GT_TNCN_BT": ["dm_giamtru", "Mã giảm trừ"], "Mã GT_TNCN_PT": ["dm_giamtru", "Mã giảm trừ"], "Mã thuế TNCN": ["dm_tncn", "Mã thuế TNCN"], "Mã TNCN": null };
    if (col === "Mã TNCN") return ["TNCN0", "TNCN1", "TNCN2"];
    if (col === "Hình thức công") { var hs = db.dm_cc.map(function (r) { return r["Hình thức công"]; }).filter(Boolean); return hs.length ? hs.filter(function (v, i) { return hs.indexOf(v) === i; }) : ["BT", "CL", "PN", "CC", "TC", "DC", "TRCH"]; }
    if (col === "Mã hình thức lương") return ["LTG", "LSP"];
    if (tableKey === "dm_congthuc" && col === "Loại") return ["OVERTIME", "ALLOWANCE", "SUPPORT"];
    if ((tableKey === "dm_congthuc" || tableKey === "dm_quychebu") && col === "Trạng thái") return ["Nháp", "Đã duyệt", "Hiệu lực", "Ngừng"];
    if (tableKey === "dm_quychebu" && col === "Cách bù") return BU_OPTS.map(function (o) { return o[0]; });
    var s = src[col]; if (!s) return null;
    var seen = {}, out = []; db[s[0]].forEach(function (r) { var v = r[s[1]]; if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
    return out;
  }
  var dlId = 0;
  function makeInput(col, value, onchange, opts, tableKey) {
    var isDate = DATECOLS.test(col), inp = h("input", { value: value == null ? "" : value });
    if (isDate) inp.type = "date";
    if (NUMCOLS.test(col) && !isDate) inp.className = "num";
    var list = col === "Mã NV" ? "dsnv" : null, opts2 = list ? null : datalistFor(col, tableKey);
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
    var editPerm = S[key] ? "input.edit" : "dm.edit", noRight = !can(editPerm);
    var locked = (theoKy && !!kyChot(kyStr())) || noRight;
    var shared = key === "chamcong"; // Chấm công dùng bộ lọc chung (phòng ban, từ khóa) như Báo cáo lương
    var deptOf = {};
    if (shared && can("payroll.view")) { try { kqKy(st.nam, st.thang).kq.bangluong.forEach(function (r) { deptOf[r["Mã NV"]] = r["Phòng ban"] || ""; }); } catch (e) { /* không tính được lương kỳ này: bỏ lọc phòng ban */ } }
    var q = shared ? h("span") : searchBox(key, "🔍 Tìm trong bảng...", function () { draw(); });
    var newRow = function () { var r = Object.assign({}, def.def || {}); if (def.kyCol) r[def.kyCol] = kyStr(); if (def.dateCol) r[def.dateCol] = kyStr() + "-01"; return r; };
    if (!locked) bar.appendChild(btn("＋ Thêm dòng", "pri", function () { if (!need(editPerm)) return; if (!commit(REPO.plan("insert", key, null, newRow(), { what: "thêm dòng" }), { audit: theoKy ? false : "retro", action: "Thêm dòng danh mục" })) return; save(); st.qs[key] = ""; q.value = ""; st.pg[key] = 1e9; draw(); var tw = body; tw.scrollTop = tw.scrollHeight; }));
    bar.appendChild(q); bar.appendChild(cnt); bar.appendChild(h("span", { class: "sp" }));
    if (key === "sanluong" || key === "bandam") bar.appendChild(btn("📄 Tải file mẫu", "", function () { downloadPBTemplate(key); }, "Mẫu phiếu cân như công cụ phân bổ khối lượng: Mã phòng ban (tổ) + NV vắng"));
    else bar.appendChild(btn("📄 Tải file mẫu", "", function () { downloadTemplate(key); }, "File Excel mẫu có sẵn tên cột + dòng ví dụ"));
    if (!locked) bar.appendChild(btn("⬆ Nhập Excel", "", function () { importFile(key, draw); }, "Nhập từ file .xlsx / .xls / .csv"));
    bar.appendChild(btn("⬇ Xuất Excel", "", function () { var rows = db[key].filter(function (r) { return (!theoKy || rowInKy(r, def)) && (!def.rowFilter || def.rowFilter(r)); }); saveXlsx(slug(def.ten) + (theoKy ? "_" + kyStr() : "") + ".xlsx", [{ name: def.ten, cols: def.cols, rows: rows }]); }));
    card.appendChild(bar);
    if (shared) {
      var fr = []; db.chamcong.forEach(function (r) { if (rowInKy(r, def)) fr.push({ "Mã NV": r["Mã NV"], "Họ và tên": "", "Phòng ban": deptOf[r["Mã NV"]] || "" }); });
      card.appendChild(reportFilterBar(fr, { compact: true }));
    }
    if (noRight) card.appendChild(h("div", { class: "locked", html: "👁 Chế độ <b>chỉ xem</b> — vai trò của bạn không có quyền sửa bảng này." }));
    else if (locked) card.appendChild(h("div", { class: "locked", html: "🔒 <b>" + kyLabel(kyStr()) + " đã chốt lương</b> — dữ liệu kỳ này chỉ xem, không sửa được. Muốn sửa: vào <b>Kỳ lương đã chốt</b> → Mở chốt." }));
    card.appendChild(h("div", { class: "hint", text: (def.hint ? def.hint + " " : "") + "Nhập hàng loạt: bấm '📄 Tải file mẫu' → điền Excel → '⬆ Nhập Excel'. Hoặc copy nhiều dòng từ Excel rồi Ctrl+V vào một ô." }));
    if (key === "chamcong") card.appendChild(h("div", { class: "legend", html: "<b>Màu ô:</b> <span><i class='c1'>1</i>đủ công</span><span><i class='cH'>0,5</i>nửa công</span><span><i class='cX'>1QC</i>có nhãn / dòng tăng ca</span><span><i class='cP'>1</i>dòng phép (PN)</span><span><i class='cO'>1</i>dòng lễ (CL)</span><span><i class='cE'>?</i>không đọc được số công</span><span><i class='we'>&nbsp;</i>Chủ nhật</span>" }));
    card.appendChild(body); wrap.appendChild(card);
    var vis = def.cols.filter(function (c) { return (def.hide || []).indexOf(c) < 0; });
    // Tô màu ô chấm công theo số công + loại dòng (Hình thức công) — chỉ hiển thị, không đổi dữ liệu
    var dayCls = function (v, ht) {
      if (v === "" || v == null) return "";
      var t = E.tachCong(v); if (!t.soCong) return "cv cE";
      ht = String(ht || "BT").trim().toUpperCase();
      if (ht === "PN") return "cv cP"; if (ht === "CL") return "cv cO"; if (/^TC/.test(ht) || t.nhan) return "cv cX";
      return t.soCong >= 1 ? "cv c1" : "cv cH";
    };

    function draw() {
      refreshNVList();
      body.innerHTML = "";
      var idx = [], qq = qOf(key), names = {};
      db.nhanvien.forEach(function (n) { if (!(n["Mã NV"] in names)) names[n["Mã NV"]] = n["Họ và tên"] || ""; }); // tra tên 1 lần / lượt vẽ (trước: dò cả danh sách NV cho mỗi dòng)
      var nameOf = function (ma) { return Object.prototype.hasOwnProperty.call(names, ma) ? names[ma] : ""; };
      db[key].forEach(function (r, i) {
        if (theoKy && !rowInKy(r, def)) return;
        if (def.rowFilter && !def.rowFilter(r)) return;
        if (shared && !RF.isEmpty(st.rf)) { var nm = nameOf(r["Mã NV"]); if (!RF.applyGeneric([{ "Mã NV": r["Mã NV"], "Họ và tên": nm, "Phòng ban": deptOf[r["Mã NV"]] || "" }], st.rf).rows.length) return; }
        if (qq && def.cols.every(function (c) { return String(r[c] || "").toLowerCase().indexOf(qq) < 0; }) && String(nameOf(r["Mã NV"])).toLowerCase().indexOf(qq) < 0) return;
        idx.push(i);
      });
      cnt.textContent = idx.length + " dòng" + (theoKy ? " (kỳ " + st.thang + "/" + st.nam + ")" : "") + (qq ? " · đang lọc \"" + st.qs[key] + "\"" : "");
      if (!idx.length) { body.appendChild(h("div", { class: "empty", html: qq ? "Không có dòng nào khớp \"" + esc(st.qs[key]) + "\"." : "Chưa có dữ liệu" + (theoKy ? " cho kỳ " + st.thang + "/" + st.nam : "") + ".<br>Bấm <b>＋ Thêm dòng</b> hoặc dán từ Excel." })); return; }
      var pg = pager(key, idx.length, draw);
      if (pg.el) body.appendChild(pg.el);
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
      idx.slice(pg.start, pg.end).forEach(function (ri, n0) {
        var n = pg.start + n0; // vị trí trong TOÀN BỘ danh sách đã lọc (dán nhiều dòng tiếp sang trang sau đúng thứ tự)
        var r = db[key][ri], tr = h("tr"), tot = h("td", { class: "r" });
        tr.appendChild(h("td", { class: "t stk", text: n + 1 }));
        var updTot = function () { var s = 0; DAYS.forEach(function (d) { s += E.tachCong(r[d]).soCong; }); tot.textContent = s ? fmt(Math.round(s * 100) / 100) : ""; };
        vis.forEach(function (c, ci) {
          var isDay = /^\d\d$/.test(c), cls = isDay ? "day" : "";
          if (isDay) { var dt = new Date(st.nam, st.thang - 1, +c); if (dt.getMonth() === st.thang - 1 && dt.getDay() === 0) cls += " we"; }
          var nameTd;
          var inp = makeInput(c, r[c], function (v) {
            if (!need(editPerm)) { inp.value = r[c] == null ? "" : r[c]; return; }
            var n = VAL.normCell(c, v);
            if (n.error) { toast("⚠ " + c + ": " + n.error); inp.value = r[c] == null ? "" : r[c]; return; }
            var patch = {}; patch[c] = n.value;
            // Kỳ đã chốt, ô ngày sai, quyền, hồi tố (danh mục chồng lên kỳ đã chốt: chỉ Admin, cảnh báo + nhật ký) — repository kiểm tra
            var pE = REPO.plan("update", key, r, patch, { what: "sửa dòng này", checkDup: CT_KEY[key] });
            if (!pE.ok) { alert(pE.msg); inp.value = r[c] == null ? "" : r[c]; return; }
            var dc = isDay && key === "chamcong" ? VAL.dayCell(c, n.value, r["Kỳ"]) : null;
            if (dc && dc.warn) toast("⚠ " + dc.warn);
            if (pE.retro) toast("⚠ Hồi tố: dòng này có hiệu lực trong kỳ đã chốt " + pE.impact.periods.map(GRD.label).join(", ") + " — bảng lương đã chốt không đổi");
            if (!commit(pE, { audit: theoKy ? false : "retro", action: "Sửa danh mục" })) { inp.value = r[c] == null ? "" : r[c]; return; }
            if (inp.value !== n.value && !isDay) inp.value = n.value;
            save(); if (c === "Mã NV" && nameTd) nameTd.textContent = tenNV(n.value) || (n.value ? "⚠ chưa có trong Nhân sự" : ""); if (isDay) updTot();
          }, null, key);
          inp.addEventListener("paste", function (ev) {
            var txt = (ev.clipboardData || window.clipboardData).getData("text");
            if (txt.indexOf("\t") < 0 && txt.indexOf("\n") < 0) return;
            ev.preventDefault();
            if (!need(editPerm)) return;
            if (!theoKy && GRD.closedPeriods(db).length && !can("retro.edit")) { alert("⛔ Đã có kỳ lương chốt — chỉ Admin được dán hàng loạt vào danh mục (có thể hồi tố)."); return; }
            var lines = txt.replace(/\r/g, "").replace(/\n$/, "").split("\n"), start = def.cols.indexOf(c);
            var bad = 0, skip = 0, retro = 0, retroKy = {};
            lines.forEach(function (ln, li) {
              var tgt = idx[n + li], cand = tgt == null ? newRow() : Object.assign({}, db[key][tgt]);
              ln.split("\t").forEach(function (v, k) { var col = def.cols[start + k]; if (col && col !== def.kyCol) { var nc = VAL.normCell(col, v); if (nc.error || (key === "chamcong" && /^\d\d$/.test(col) && VAL.dayCell(col, nc.value, cand["Kỳ"]).error)) { bad++; return; } cand[col] = nc.value; } });
              var pP = tgt == null ? REPO.plan("insert", key, null, cand, { what: "dán dữ liệu", checkDup: CT_KEY[key] }) : REPO.plan("update", key, db[key][tgt], cand, { what: "dán dữ liệu", checkDup: CT_KEY[key] });
              var rP = pP.ok ? REPO.apply(pP, { audit: theoKy ? false : "retro", action: "Dán dữ liệu" }) : pP;
              if (!rP.ok) { skip++; return; }
              // Danh mục chồng lên kỳ đã chốt: repository đã ghi nhật ký [HỒI TỐ] từng dòng — đếm lại để cảnh báo (không chặn)
              if (rP.retro) { retro++; rP.impact.periods.forEach(function (p) { retroKy[p] = 1; }); }
              if (tgt == null) idx.push(db[key].length - 1);
            });
            save(); draw(); toast("Đã dán " + (lines.length - skip) + " dòng" + (skip ? " · bỏ qua " + skip + " dòng (thuộc kỳ đã chốt / không đủ quyền / không hợp lệ)" : "") + (bad ? " · " + bad + " ô sai định dạng / ngày không hợp lệ — KHÔNG dán, kiểm tra lại" : "") +
              (retro ? " · ⚠ " + retro + " dòng hồi tố kỳ đã chốt " + Object.keys(retroKy).sort().map(GRD.label).join(", ") + " — bảng lương đã chốt không đổi" : ""));
          });
          if (isDay && key === "chamcong") {
            var paint = function () { inp.className = dayCls(inp.value, r["Hình thức công"]); };
            paint(); inp.addEventListener("input", paint); inp.addEventListener("change", function () { setTimeout(paint, 0); });
          }
          if (locked) inp.disabled = true;
          // Ngày không có trong tháng (VD 31/09): không cho nhập; nếu dữ liệu cũ có giá trị thì vẫn cho sửa để xóa
          if (isDay && key === "chamcong" && +c > VAL.daysInKy(r["Kỳ"]) && (r[c] === "" || r[c] == null)) { inp.disabled = true; inp.title = "Tháng này không có ngày " + c; cls += " dis"; }
          var td = h("td", { class: cls }, [inp]); if (inp._dl) td.appendChild(inp._dl);
          tr.appendChild(td);
          if (c === "Mã NV" && def.showName) { var nm = nameOf(r["Mã NV"]); nameTd = h("td", { class: "dis", text: nm || (r["Mã NV"] ? "⚠ chưa có trong Nhân sự" : "") }); tr.appendChild(nameTd); }
        });
        if (def.total) { updTot(); tr.appendChild(tot); }
        tr.appendChild(h("td", { style: "text-align:center" }, [locked ? null : btn("✕", "red ghost", function () {
          if (!need(editPerm)) return;
          var pX = REPO.plan("remove", key, db[key][ri], null, { what: "xóa dòng này" });
          if (!pX.ok) { alert(pX.msg); return; }
          if (!confirm("Xóa dòng này?" + (pX.retro ? "\n\n" + retroText(pX.impact) : ""))) return;
          if (!commit(pX, { audit: theoKy ? false : "always", action: "Xóa dòng danh mục" })) return;
          save(); draw(); updateNav();
        }, "Xóa dòng")]));
        tb.appendChild(tr);
      });
      // Bàn phím như Excel: Enter = xuống ô cùng cột dòng dưới, Shift+Enter = lên (ô đang gõ được ghi khi rời ô)
      tb.addEventListener("keydown", function (ev) {
        if (ev.key !== "Enter" || ev.target.tagName !== "INPUT") return;
        var td = ev.target.closest("td"), tr = td && td.parentNode; if (!tr) return;
        var col = Array.prototype.indexOf.call(tr.children, td), nx = ev.shiftKey ? tr.previousElementSibling : tr.nextElementSibling;
        var nxIn = nx && nx.children[col] && nx.children[col].querySelector("input:not([disabled])");
        if (nxIn) { ev.preventDefault(); nxIn.focus(); nxIn.select(); }
      });
      t.appendChild(tb); body.appendChild(t);
      if (pg.el && pg.end - pg.start > 20) body.appendChild(pager(key, idx.length, draw).el);
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
      var v = data[f.k] == null ? "" : String(data[f.k]), el, wrap = h("div", { class: "fld" + (f.t === "area" || f.t === "multi" ? " wide" : ""), "data-k": f.k });
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

  // ---------- Kiểm soát thay đổi ảnh hưởng kỳ lương đã chốt (core/period-guard.js) ----------
  function retroText(imp) { return RP.retroText(imp); }
  /** Hỏi trước khi ghi 1 thay đổi. Trả true nếu được phép ghi. */
  function guardChange(table, before, after, what) {
    var imp = GRD.impactChange(db, table, before, after);
    if (imp.kind === "locked") { alert("Không thể " + what + ": dữ liệu thuộc kỳ " + imp.periods.map(GRD.label).join(", ") + " đã chốt lương. Hãy mở chốt trước."); return false; }
    if (imp.kind === "retro" && !can("retro.edit")) { alert("⛔ Không thể " + what + ": dữ liệu có hiệu lực trong kỳ lương đã chốt " + imp.periods.map(GRD.label).join(", ") + ".\nChỉ Admin được sửa dữ liệu hồi tố (quy tắc Q-14)."); return false; }
    if (imp.kind === "retro") return confirm(what.charAt(0).toUpperCase() + what.slice(1) + "?\n\n" + retroText(imp) + "\n\nVẫn lưu thay đổi?");
    return true;
  }
  /** Ghi nhật ký thay đổi có trước/sau; đánh dấu HỒI TỐ nếu chạm kỳ đã chốt. */
  function auditChange(action, table, before, after, ident) {
    var imp = GRD.impactChange(db, table, before, after), ch = GRD.changedFields(before, after);
    audit(action, (ALL[table] ? ALL[table].ten : table) + (ident ? " · " + ident : "") + (ch.length ? " · " + ch.slice(0, 12).join("; ") : "") +
      (imp.kind === "retro" ? " · [HỒI TỐ kỳ đã chốt " + imp.periods.map(GRD.label).join(", ") + "]" : ""));
  }

  /** Khung "Sẽ lưu N thay đổi": so giá trị đang nhập với bản cũ, tô viền ô đã đổi. Trả hàm cập nhật. */
  function liveDiff(body, get, fields, orig) {
    var box = h("section", { class: "diff none", "aria-live": "polite" });
    var show = function (f, v) { var s = dispVal(f, v); return s === "" ? "(trống)" : s; };
    var upd = function () {
      var d = get(), ch = fields.filter(function (f) { return String(orig[f.k] == null ? "" : orig[f.k]) !== String(d[f.k] == null ? "" : d[f.k]); });
      body.querySelectorAll(".fld[data-k]").forEach(function (w) { w.classList.toggle("chg", ch.some(function (f) { return f.k === w.getAttribute("data-k"); })); });
      box.innerHTML = ""; box.className = "diff" + (ch.length ? "" : " none");
      box.appendChild(h("div", { text: ch.length ? "Sẽ lưu " + ch.length + " thay đổi" : "Chưa có thay đổi nào" }));
      if (ch.length) { var dl = h("dl"); ch.forEach(function (f) { dl.appendChild(h("div", {}, [h("dt", { text: f.label || f.k }), h("dd", {}, [h("del", { text: show(f, orig[f.k]) }), " → ", h("ins", { text: show(f, d[f.k]) })])])); }); box.appendChild(dl); }
      return ch;
    };
    body.addEventListener("input", upd); body.addEventListener("change", upd);
    body.appendChild(box); upd();
    return upd;
  }
  // Bảng hồ sơ lưu theo "Hiệu lực từ" (giữ lịch sử): khi sửa được chọn "Thông tin mới" (thêm bản mới) hay "Sửa lỗi nhập sai" (ghi đè)
  var VERSIONED = { canhan: 1, thanhtoan: 1 };
  function hrForm(key, row, base, onDone) {
    var cfg = HR[key], isNew = !row, data = Object.assign({}, base || {}, row || {});
    if (isNew && cfg.defaults) Object.assign(data, cfg.defaults(base));
    var body = h("div");
    if (cfg.desc) body.appendChild(h("div", { class: "hint", text: cfg.desc }));
    var ver = !isNew && VERSIONED[key], mode = { v: ver ? "new" : "fix" };
    if (ver) {
      var mk = function (val, title, sub) {
        var r = h("input", { type: "radio", name: "hrmode", value: val }); r.checked = mode.v === val;
        r.addEventListener("change", function () { mode.v = val; var hl = body.querySelector('.fld[data-k="Hiệu lực từ"] input'); if (hl && val === "new" && hl.value === (row["Hiệu lực từ"] || "")) hl.value = HRM.today(); if (hl && val === "fix") hl.value = row["Hiệu lực từ"] || ""; if (upd) upd(); });
        return h("label", {}, [r, h("span", {}, [h("b", { text: title }), h("small", { text: sub })])]);
      };
      body.appendChild(h("div", { class: "mode", role: "radiogroup", "aria-label": "Loại thay đổi" }, [
        mk("new", "Thông tin mới", "Đổi CCCD, địa chỉ, tài khoản… — thêm bản mới từ ngày 'Hiệu lực từ', bản cũ giữ làm lịch sử"),
        mk("fix", "Sửa lỗi nhập sai", "Ghi đè bản này; nhật ký vẫn lưu giá trị cũ")]));
      data["Hiệu lực từ"] = HRM.today();
    }
    // Q-24: không có quyền xem lương → không hiện ô lương (người này cũng không có quyền lưu hồ sơ)
    var fs = canSeePay() ? cfg.f : cfg.f.filter(function (f) { return !HRM.isPayField(key, f.k); });
    if (fs.length < cfg.f.length) body.appendChild(h("div", { class: "hint", text: "🔒 Các ô lương được ẩn vì vai trò của bạn không có quyền xem lương." }));
    var g = h("div", { class: "fgrid" }); body.appendChild(g);
    var get = fieldInputs(g, fs, data), upd = null;
    if (!isNew) upd = liveDiff(body, get, fs, row);
    // Bản ghi bị khóa (Q-15 phụ lục đã dùng cho kỳ chốt / kỳ đã chốt): báo ngay khi mở, không đợi bấm Lưu
    var p0 = isNew ? null : REPO.plan("update", key, row, {}, { what: "sửa " + cfg.ten });
    if (p0 && !p0.ok && (p0.code === "frozen" || p0.code === "locked")) body.insertBefore(h("div", { class: "locked", text: p0.msg }), body.firstChild);
    modal((isNew ? "Thêm: " : "Sửa: ") + cfg.ten, body, function (close) {
      return [btn("Hủy", "", close), btn("💾 Lưu", "pri", function () {
        var d = get(), miss = missingReq(fs, d);
        if (miss.length) { alert("Cần nhập: " + miss.join(", ")); return; }
        var bad = fs.filter(function (f) { return f.t === "money" && d[f.k] && isNaN(VAL.parseMoney(d[f.k])); }).map(function (f) { return f.label || f.k; });
        if (bad.length) { alert("Số tiền không hợp lệ: " + bad.join(", ")); return; }
        if (!need("hr.edit", "sửa hồ sơ nhân sự")) return;
        var asNew = ver && mode.v === "new";
        if (asNew && !(String(d["Hiệu lực từ"] || "") > String(row["Hiệu lực từ"] || ""))) { alert("Thông tin mới phải có 'Hiệu lực từ' SAU bản đang có (" + dispVal({ t: "date" }, row["Hiệu lực từ"]) + ").\nNếu chỉ sửa lỗi nhập sai của bản này, chọn 'Sửa lỗi nhập sai'."); return; }
        if (!isNew && !asNew && upd && !upd().length) { if (p0 && !p0.ok && (p0.code === "frozen" || p0.code === "locked")) { alert(p0.msg); return; } close(); return; }
        // Trùng khóa, Q-15, kỳ chốt / hồi tố, đổi Số HĐLĐ kéo theo phụ lục: repository kiểm tra HẾT rồi mới ghi (A3-01)
        var vals = isNew ? Object.assign({}, base || {}, d) : asNew ? Object.assign({}, row, d) : d;
        if (asNew) delete vals._id;
        var pF = REPO.plan(isNew || asNew ? "insert" : "update", key, isNew || asNew ? null : row, vals, { what: (isNew ? "thêm " : asNew ? "cập nhật thông tin mới — " : "sửa ") + cfg.ten, checkDup: true });
        if (!commit(pF, { confirm: true, action: isNew ? "Thêm hồ sơ" : asNew ? "Cập nhật hồ sơ (bản mới)" : "Sửa hồ sơ" })) return;
        save(); close(); toast(asNew ? "Đã thêm thông tin mới từ " + dispVal({ t: "date" }, d["Hiệu lực từ"]) + " — bản cũ giữ làm lịch sử" : "Đã lưu"); (onDone || render)();
      })];
    }, { drawer: true });
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
      cfg.cols.forEach(function (c) { var f = fmap[c] || {}; x.appendChild(h("td", { class: f.t === "money" ? "r" : "t", text: HRM.isPayField(key, c) && !canSeePay() ? HRM.PAY_HIDDEN : dispVal(f, r[c]) })); });
      var acts = h("td", { style: "text-align:right;white-space:nowrap" });
      if (opts.onPick) acts.appendChild(btn("✎", "ghost", function (ev) { ev.stopPropagation(); hrForm(key, r, base); }, "Sửa"));
      acts.appendChild(btn("✕", "red ghost", function (ev) {
        ev.stopPropagation();
        if (!need("hr.edit", "xóa hồ sơ nhân sự")) return;
        var pD = REPO.plan("remove", key, r, null, { what: "xóa " + cfg.ten });
        if (!pD.ok) { alert(pD.msg); return; }
        if (!confirm("Xóa dòng này?" + (key === "hopdong" ? "\nToàn bộ phụ lục lương, nghỉ phép… của hợp đồng này cũng bị xóa." : "") + (pD.retro ? "\n\n" + retroText(pD.impact) : ""))) return;
        if (!commit(pD, { action: "Xóa hồ sơ" })) return;
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
    // α18: đủ các trường sổ quản lý lao động (NĐ 145/2020 Đ3) ngay khi thêm mới — quốc tịch, dân tộc, số sổ BHXH, trình độ
    var fCN = pick("canhan", ["Số CCCD", "Ngày cấp", "Nơi cấp", "Ngày sinh", "Giới tính", "Quốc tịch", "Dân tộc", "Số điện thoại", "Thường trú", "Địa chỉ hiện tại", "Mã số thuế", "Số sổ BHXH"]);
    var fHV = pick("hocvan", ["Trình độ học vấn", "Chuyên môn", "Bậc trình độ kỹ năng nghề", "Bằng cấp"]);
    var fHD = pick("hopdong", ["Số HĐLĐ", "Hình thức HĐLĐ", "Ngày vào làm", "Ngày hết hạn"]);
    var fCT = HR.chitiethd.f.filter(function (f) { return ["Mã công tác", "Loại phụ lục", "Loại biến động", "Số quyết định", "Hiệu lực từ", "Ghi chú"].indexOf(f.k) < 0; });
    var fTK = pick("thanhtoan", ["Số tài khoản", "Tên ngân hàng", "Chi nhánh"]);
    var gB = fieldInputs(sec("1. Thông tin cơ bản"), fBase, { "Mã NV": ma, "Trạng thái": "Đang làm việc" });
    var gC = fieldInputs(sec("2. Thông tin cá nhân"), fCN, { "Quốc tịch": "Việt Nam" });
    var gV = fieldInputs(sec("2b. Trình độ (sổ quản lý lao động)"), fHV.map(function (f) { return Object.assign({}, f, { req: 0 }); }), {});
    var gH = fieldInputs(sec("3. Hợp đồng lao động"), fHD, { "Số HĐLĐ": ma + "/HĐ01", "Hình thức HĐLĐ": "Thử việc", "Ngày vào làm": HRM.today() });
    var gL = fieldInputs(sec("4. Lương, bảo hiểm, thuế"), fCT, { "HTTT": "Chuyển khoản", "Mã hình thức lương": "LTG", "Mức đóng bảo hiểm": "BH01", "Thuế TNCN": "LT01" });
    var gT = fieldInputs(sec("5. Tài khoản nhận lương (nếu chuyển khoản)"), fTK, {});
    body.appendChild(h("div", { class: "hint", text: "Các mục khác (nhân thân/người phụ thuộc, quá trình công tác, nghỉ phép…) bổ sung sau trong hồ sơ nhân viên. Báo cáo nhân sự → Sổ quản lý lao động cho biết ai còn thiếu thông tin." }));
    modal("Thêm nhân viên mới", body, function (close) {
      return [btn("Hủy", "", close), btn("💾 Lưu nhân viên", "pri", function () {
        if (!need("hr.edit", "thêm nhân viên")) return;
        var b = gB(), c = gC(), hd = gH(), l = gL(), tk = gT(), hv = gV();
        var miss = missingReq(fBase, b).concat(missingReq(fHD, hd), missingReq(fCT, l));
        if (miss.length) { alert("Cần nhập: " + miss.join(", ")); return; }
        if (db.nhanvien.some(function (r) { return r["Mã NV"] === b["Mã NV"]; })) { alert("Mã NV đã tồn tại"); return; }
        var m = b["Mã NV"], vao = hd["Ngày vào làm"];
        db.nhanvien.push(Object.assign({ _id: HRM.uid(), "Ngày tạo hồ sơ": HRM.today(), "Số CCCD": c["Số CCCD"] }, b));
        // chỉ có Quốc tịch mặc định "Việt Nam" (người dùng không nhập gì khác) → chưa tạo bản Thông tin cá nhân
        if (Object.keys(c).some(function (k) { return c[k] && !(k === "Quốc tịch" && c[k] === "Việt Nam"); })) db.canhan.push(Object.assign({ _id: HRM.uid(), "Mã NV": m, "Hiệu lực từ": vao }, c));
        db.hopdong.push(Object.assign({ _id: HRM.uid(), "Mã NV": m }, hd));
        db.chitiethd.push(Object.assign({ _id: HRM.uid(), "Mã NV": m, "Số HĐLĐ": hd["Số HĐLĐ"], "Mã công tác": hd["Số HĐLĐ"] + "-PL01", "Loại phụ lục": "Hợp đồng gốc", "Hiệu lực từ": vao }, l));
        if (tk["Số tài khoản"]) db.thanhtoan.push(Object.assign({ _id: HRM.uid(), "Mã NV": m, "Hiệu lực từ": vao }, tk));
        if (Object.keys(hv).some(function (k) { return hv[k]; })) db.hocvan.push(Object.assign({ _id: HRM.uid(), "Mã NV": m }, hv));
        save(); close(); st.tab = "nv"; st.nv = m; st.nvTab = "canhan"; render(); toast("Đã thêm nhân viên " + b["Họ và tên"]);
      })];
    });
  }

  function editBaseNV(nv) {
    var body = h("div"), g = h("div", { class: "fgrid" }); body.appendChild(g);
    var get = fieldInputs(g, HR.nhanvien.f, nv);
    liveDiff(body, get, HR.nhanvien.f, nv);
    body.appendChild(h("div", { class: "hint", style: "margin-top:10px", html: "Đổi CCCD, địa chỉ… → tab <b>Thông tin cá nhân</b>. Đổi lương, chức vụ, phòng ban → <b>＋ Tăng lương / biến động</b> (lập phụ lục mới)." }));
    modal("Sửa thông tin cơ bản", body, function (close) {
      return [btn("Hủy", "", close), btn("💾 Lưu", "pri", function () {
        if (!need("hr.edit", "sửa thông tin nhân viên")) return;
        var d = get(), miss = missingReq(HR.nhanvien.f, d);
        if (miss.length) { alert("Cần nhập: " + miss.join(", ")); return; }
        // NV có trong bảng lương đã chốt → hỏi xác nhận hồi tố TRƯỚC khi ghi bất cứ gì (như hrForm / sửa ô / xóa dòng); Hủy = không lưu, không ghi nhật ký
        var aNV = Object.assign({}, nv, d);
        if (GRD.changedFields(nv, aNV).length && !guardChange("nhanvien", nv, aNV, "sửa thông tin cơ bản của " + (nv["Họ và tên"] || nv["Mã NV"]))) return;
        var old = nv["Mã NV"];
        if (d["Mã NV"] !== old) {
          if (db.nhanvien.some(function (r) { return r !== nv && r["Mã NV"] === d["Mã NV"]; })) { alert("Mã NV đã tồn tại"); return; }
          var refs = GRD.references(db, old);
          if (refs.kyluong || refs.kyluong_lichsu) { alert("Không đổi được Mã NV " + old + ": mã này đã có trong bảng lương ĐÃ CHỐT (" + (refs.kyluong || 0) + " kỳ hiện hành, " + (refs.kyluong_lichsu || 0) + " bản lịch sử). Đổi mã sẽ làm dữ liệu kỳ đã chốt không còn khớp với hồ sơ.\nNếu thật sự cần mã mới: tạo nhân viên mới và chấm dứt hồ sơ cũ."); return; }
          var refTxt = Object.keys(refs).map(function (k) { return (ALL[k] ? ALL[k].ten : k) + ": " + refs[k]; }).join(", ");
          if (!confirm("Đổi Mã NV " + old + " → " + d["Mã NV"] + "?\nApp sẽ đổi theo ở: " + (refTxt || "(không có dữ liệu liên quan)"))) return;
          Object.keys(db).forEach(function (k) { if (Array.isArray(db[k]) && k !== "auditlog" && k !== "kyluong" && k !== "kyluong_lichsu") db[k].forEach(function (r) { if (r && r !== nv && r["Mã NV"] === old) r["Mã NV"] = d["Mã NV"]; }); });
          audit("Đổi Mã NV", old + " → " + d["Mã NV"] + " (" + (refTxt || "không có dữ liệu liên quan") + ")");
          st.nv = d["Mã NV"];
        }
        var bNV = Object.assign({}, nv);
        Object.assign(nv, d); auditChange("Sửa thông tin cơ bản", "nhanvien", bNV, nv, nv["Mã NV"]); save(); close(); render();
      })];
    }, { drawer: true });
  }
  /** Tăng lương / điều chuyển / đổi chức vụ / đổi mức đóng BH: lập PHỤ LỤC MỚI (không sửa phụ lục cũ — Q-15), có so sánh trước → sau. */
  function bienDongForm(nv, hd) {
    if (!need("hr.edit", "lập phụ lục biến động")) return;
    var base = { "Mã NV": nv["Mã NV"], "Số HĐLĐ": hd["Số HĐLĐ"] };
    var cur = db.chitiethd.filter(function (r) { return r["Mã NV"] === base["Mã NV"] && r["Số HĐLĐ"] === base["Số HĐLĐ"]; }).sort(function (a, b) { return String(a["Hiệu lực từ"]) < String(b["Hiệu lực từ"]) ? 1 : -1; })[0];
    if (!cur) { hrForm("chitiethd", null, base); return; }
    var draft = HR.chitiethd.defaults(base), body = h("div"), loai = { v: "" };
    body.appendChild(h("div", { class: "hint", html: "Lập <b>phụ lục mới " + esc(draft["Mã công tác"]) + "</b> từ phụ lục hiện tại <b>" + esc(cur["Mã công tác"] || "") + "</b> (hiệu lực " + esc(dispVal({ t: "date" }, cur["Hiệu lực từ"])) + "). Phụ lục cũ giữ nguyên; bảng lương tự lấy phụ lục mới từ ngày hiệu lực." }));
    var chips = h("div", { class: "chips", role: "radiogroup", "aria-label": "Loại biến động", style: "margin:4px 0 14px" });
    HRM.BIEN_DONG.forEach(function (L) { var r = h("input", { type: "radio", name: "bd", value: L }); r.addEventListener("change", function () { loai.v = L; }); chips.appendChild(h("label", { class: "chip" }, [r, " " + L])); });
    body.appendChild(h("div", { class: "fh", text: "Loại biến động" })); body.appendChild(chips);
    var keys = ["Hiệu lực từ", "Số quyết định", "Lương thỏa thuận", "Lương cơ bản", "Mức đóng bảo hiểm", "Phòng ban", "Chức vụ", "Vị trí việc làm", "Cách áp dụng trong tháng hiệu lực", "Ghi chú"];
    var fs = keys.map(function (k) { return HR.chitiethd.f.filter(function (f) { return f.k === k; })[0]; }).filter(Boolean).map(function (f) { return f.k === "Ghi chú" ? Object.assign({}, f, { label: "Lý do / ghi chú" }) : f; });
    if (!canSeePay()) fs = fs.filter(function (f) { return !HRM.isPayField("chitiethd", f.k); });
    var g = h("div", { class: "fgrid" }); body.appendChild(g);
    var get = fieldInputs(g, fs, draft);
    var pctBox = h("div", { class: "ok", style: "margin:8px 0" });
    var upd = liveDiff(body, get, fs.filter(function (f) { return f.k !== "Hiệu lực từ" && f.k !== "Số quyết định" && f.k !== "Ghi chú"; }), cur);
    var showPct = function () {
      var d = get(), a = E.money(cur["Lương thỏa thuận"]), b = E.money(d["Lương thỏa thuận"]);
      pctBox.style.display = a && b && a !== b && canSeePay() ? "" : "none";
      if (a && b) pctBox.textContent = "Lương thỏa thuận " + (b > a ? "+" : "") + fmt(b - a) + " (" + (b > a ? "+" : "") + String(Math.round((b - a) / a * 1000) / 10).replace(".", ",") + "%)" + (E.money(d["Lương cơ bản"]) !== E.money(cur["Lương cơ bản"]) ? " · lương đóng BH đổi → báo điều chỉnh mức đóng BHXH" : "");
    };
    body.addEventListener("input", showPct); body.addEventListener("change", showPct); body.appendChild(pctBox); showPct();
    modal("Tăng lương / biến động — " + (nv["Họ và tên"] || nv["Mã NV"]), body, function (close) {
      return [btn("Hủy", "", close), btn("💾 Lập phụ lục " + draft["Mã công tác"], "pri", function () {
        var d = get(), ch = upd();
        if (!d["Hiệu lực từ"]) { alert("Cần nhập 'Hiệu lực từ'"); return; }
        if (!(String(d["Hiệu lực từ"]) > String(cur["Hiệu lực từ"] || ""))) { alert("Phụ lục mới phải có 'Hiệu lực từ' SAU phụ lục hiện tại (" + dispVal({ t: "date" }, cur["Hiệu lực từ"]) + ")."); return; }
        if (!ch.length) { alert("Chưa thay đổi gì so với phụ lục hiện tại."); return; }
        var L = loai.v || (function () { var a = E.money(cur["Lương thỏa thuận"]), b = E.money(d["Lương thỏa thuận"]); return b > a ? "Tăng lương" : b < a ? "Giảm lương" : d["Phòng ban"] !== cur["Phòng ban"] ? "Điều chuyển phòng ban" : d["Chức vụ"] !== cur["Chức vụ"] ? "Bổ nhiệm / đổi chức vụ" : "Điều chỉnh mức đóng BH"; })();
        var rec = Object.assign({}, draft, d, { "Loại biến động": L, "Loại phụ lục": "Phụ lục sửa đổi" }); delete rec._id;
        var pF = REPO.plan("insert", "chitiethd", null, rec, { what: "lập phụ lục " + L.toLowerCase(), checkDup: true });
        if (!commit(pF, { confirm: true, action: "Biến động: " + L })) return;
        save(); close(); st.nvTab = "hopdong"; st.hd = hd["Số HĐLĐ"]; st.hdTab = "chitiethd"; render(); toast("Đã lập phụ lục " + rec["Mã công tác"] + " · " + L + " từ " + dispVal({ t: "date" }, rec["Hiệu lực từ"]));
      })];
    }, { drawer: true });
  }
  /** Lịch sử 1 nhân viên: quá trình lương + dòng thời gian thay đổi hồ sơ (từ nhật ký, chỉ đọc). */
  function lichSuNV(nv) {
    var ma = nv["Mã NV"], body = h("div"), pay = canSeePay(), R = HRM.reports(db, { hidePay: !pay });
    var ql = R.quaTrinhLuong(ma);
    if (pay && ql.length) {
      var mx = Math.max.apply(null, ql.map(function (x) { return +x["Lương thỏa thuận"] || 0; })) || 1, bars = h("div", { class: "salbar", "aria-label": "Quá trình lương" });
      ql.forEach(function (x) { var v = +x["Lương thỏa thuận"] || 0; bars.appendChild(h("div", {}, [h("b", { text: (v / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " tr" }), h("i", { style: "height:" + Math.max(8, Math.round(v / mx * 110)) + "px" }), h("span", { text: dispVal({ t: "date" }, x["Hiệu lực từ"]).slice(3) + (x["Thay đổi (%)"] !== "" ? " · " + (x["Thay đổi (%)"] > 0 ? "+" : "") + String(x["Thay đổi (%)"]).replace(".", ",") + "%" : "") })])); });
      body.appendChild(h("div", { class: "fh", text: "Quá trình lương" })); body.appendChild(bars);
    }
    // Nhật ký: dòng có Mã NV này; số tiền lương bị che nếu không có quyền xem lương (Q-24)
    var re = new RegExp("(^|[\\s·/(])" + ma.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[\\s·/)])");
    var nameKey = {}; Object.keys(ALL).forEach(function (k) { nameKey[ALL[k].ten] = k; });
    var ev = (db.auditlog || []).filter(function (a) { return re.test(String(a.chiTiet || "")); }).slice(-300).reverse();
    var parts = [["", "Tất cả"], ["luong", "Lương & phụ lục"], ["hd", "Hợp đồng"], ["cn", "Cá nhân"], ["khac", "Khác"]], sel = { v: "" };
    var partOf = function (t) { return t === "chitiethd" ? "luong" : t === "hopdong" ? "hd" : t === "canhan" || t === "nhanvien" || t === "thanhtoan" || t === "nhanthan" ? "cn" : "khac"; };
    var items = ev.map(function (a) {
      var seg = String(a.chiTiet || "").split(" · "), table = nameKey[seg[0]] || "", ch = [];
      seg.forEach(function (s) { if (/→/.test(s)) s.split("; ").forEach(function (c) { var m = /^([^:]+):\s*(.*?)\s*→\s*(.*)$/.exec(c); if (m) ch.push({ f: m[1], a: m[2], b: m[3] }); }); });
      var ff = {}; ((HR[table] || {}).f || []).forEach(function (f) { ff[f.k] = f; });
      ch = ch.filter(function (c) { return ["Mã NV", "Số HĐLĐ"].indexOf(c.f) < 0; });
      ch.forEach(function (c) { var f = ff[c.f]; if (f && (f.t === "money" || f.t === "date")) ["a", "b"].forEach(function (k) { if (c[k] && c[k] !== "∅") c[k] = dispVal(f, c[k]); }); });
      if (!pay) ch.forEach(function (c) { if (table && HRM.isPayField(table, c.f)) { c.a = HRM.PAY_HIDDEN; c.b = HRM.PAY_HIDDEN; } });
      var isAdd = ch.length && ch.every(function (c) { return c.a === "∅"; });
      var retro = /HỒI TỐ/.test(a.chiTiet || "");
      return { a: a, table: table, part: partOf(table), ch: ch, isAdd: isAdd, retro: retro, txt: ch.length ? "" : seg.slice(1).filter(function (s) { return !/→/.test(s); }).join(" · ") };
    });
    var chipBar = h("div", { class: "chips", style: "margin:14px 0 6px" }), list = h("ul", { class: "tl" });
    var draw = function () {
      list.innerHTML = "";
      var xs = items.filter(function (it) { return !sel.v || it.part === sel.v; });
      if (!xs.length) list.appendChild(h("li", { class: "empty", text: "Chưa có thay đổi nào được ghi nhật ký cho nhân viên này." }));
      xs.forEach(function (it) {
        var ul = h("ul", { class: "ch" });
        it.ch.slice(0, 12).forEach(function (c) { ul.appendChild(h("li", {}, it.isAdd ? [h("span", { class: "hint", style: "margin:0", text: c.f + ": " }), h("ins", { text: c.b })] : [h("span", { class: "hint", style: "margin:0", text: c.f + ": " }), h("del", { text: c.a === "∅" ? "(trống)" : c.a }), " → ", h("ins", { text: c.b === "∅" ? "(trống)" : c.b })])); });
        list.appendChild(h("li", {}, [h("span", { class: "ti", text: { luong: "PL", hd: "HĐ", cn: "CN", khac: "•" }[it.part] }), h("div", { class: "tb" }, [
          h("div", {}, [h("b", { text: it.a.thaoTac + (it.table && ALL[it.table] ? " — " + ALL[it.table].ten : "") }), it.retro ? h("span", { class: "tag t-retro", style: "margin-left:8px", text: "HỒI TỐ" }) : null]),
          h("small", { text: (it.a.nguoi || "") + " · " + fmtTime(it.a.luc) + (it.txt ? " · " + it.txt : "") }), it.ch.length ? ul : null])]));
      });
    };
    parts.forEach(function (p) { var r = h("input", { type: "radio", name: "lsp", value: p[0] }); r.checked = !p[0]; r.addEventListener("change", function () { sel.v = p[0]; draw(); }); chipBar.appendChild(h("label", { class: "chip" }, [r, " " + p[1]])); });
    body.appendChild(h("div", { class: "fh", text: "Thay đổi hồ sơ" })); body.appendChild(chipBar); body.appendChild(list); draw();
    body.appendChild(h("div", { class: "hint", style: "margin-top:10px", text: "Nhật ký chỉ thêm, không sửa / xóa được — kể cả Admin." }));
    modal("Lịch sử — " + (nv["Họ và tên"] || ma), body, function (close) {
      return [btn("📋 Bảng toàn bộ hồ sơ theo thời gian", "", function () { close(); st.tab = "baocao"; st.bc = "lichsu"; st.bcNV = ma; render(); }), btn("Đóng", "pri", close)];
    }, { drawer: true });
  }
  function nghiViec(nv) {
    var hh = HRM.hienHanh(db, nv["Mã NV"]);
    askText("Cho nghỉ việc — " + nv["Họ và tên"], "Ngày chấm dứt sẽ ghi vào hợp đồng " + (hh.hd ? hh.hd["Số HĐLĐ"] : "(chưa có hợp đồng)") + ". Từ tháng sau ngày này không tính lương.", { label: "Ngày nghỉ việc", type: "date", value: HRM.today(), required: true, okText: "Cho nghỉ việc" }, function (d) {
      if (!need("hr.edit", "cho nghỉ việc")) return;
      d = VAL.normDate(d); if (!d) { alert("Ngày không hợp lệ"); return; }
      if (hh.hd && !guardChange("hopdong", hh.hd, Object.assign({}, hh.hd, { "Ngày chấm dứt": d }), "cho nghỉ việc từ " + d)) return;
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
        (hh.ct && canSeePay() ? " · Lương " + fmt(E.money(hh.ct["Lương thỏa thuận"])) : "") + "</span>" }),
      h("span", { class: "sp" }),
      hh.hd ? btn("📶 Tăng lương / biến động", "pri", function () { bienDongForm(nv, hh.hd); }) : null,
      btn("✎ Sửa cơ bản", "", function () { editBaseNV(nv); }),
      btn("🕘 Lịch sử", "", function () { lichSuNV(nv); }),
      nv["Trạng thái"] !== "Đã nghỉ việc" ? btn("Cho nghỉ việc", "", function () { nghiViec(nv); }) : null,
      btn("🗑", "red", function () {
        if (!need("hr.edit", "xóa nhân viên")) return;
        var refs = GRD.references(db, ma), inClosed = refs.kyluong || refs.kyluong_lichsu;
        if (inClosed && !can("retro.edit")) { alert("⛔ Nhân viên " + ma + " đã có trong bảng lương ĐÃ CHỐT. Chỉ Admin được xóa hồ sơ này (bảng lương đã chốt vẫn giữ nguyên)."); return; }
        if (!confirm("XÓA hẳn nhân viên " + nv["Họ và tên"] + " và toàn bộ hồ sơ (không xóa chấm công/sản lượng)?" + (inClosed ? "\n\n⚠ Nhân viên này có trong " + inClosed + " bảng lương đã chốt — số đã chốt KHÔNG đổi, nhưng hồ sơ gốc sẽ không còn để đối chiếu." : ""))) return;
        if (!backupOrBlock("truoc-xoa-nhan-vien", "xóa nhân viên")) return;
        Object.keys(HR).forEach(function (k) { db[k] = (db[k] || []).filter(function (r) { return r["Mã NV"] !== ma; }); });
        audit("Xóa nhân viên", ma + " — " + nv["Họ và tên"] + (inClosed ? " [có trong bảng lương đã chốt]" : ""));
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
    var q = searchBox("nhansu", "🔍 Tìm mã, tên, phòng ban...", function () { draw(); });
    var ft = h("select"); [["", "Tất cả trạng thái"], ["Đang làm việc", "Đang làm việc"], ["Tạm hoãn HĐLĐ", "Tạm hoãn HĐLĐ"], ["Đã nghỉ việc", "Đã nghỉ việc"]].forEach(function (o) { ft.appendChild(h("option", { value: o[0], text: o[1] })); });
    ft.value = st.ft || "";
    ft.addEventListener("change", function () { st.ft = ft.value; st.pg.nhansu = 0; draw(); });
    bar.appendChild(btn("＋ Thêm nhân viên", "pri", wizardNV));
    bar.appendChild(q); bar.appendChild(ft); bar.appendChild(h("span", { class: "sp" }));
    bar.appendChild(btn("📄 Tải file mẫu", "", function () { saveXlsx("Mau_HoSoNhanSu.xlsx", Object.keys(HR).map(templateSheet), "template"); toast("File mẫu có 1 sheet cho mỗi loại hồ sơ"); }, "Mỗi loại hồ sơ là 1 sheet"));
    bar.appendChild(btn("⬆ Nhập Excel", "", importAllFile, "Nhập file Excel nhiều sheet (Nhân viên, Thông tin cá nhân, Hợp đồng…)"));
    bar.appendChild(btn("⬇ Sổ lao động", "", function () { var rows = HRM.reports(db, { hidePay: !canSeePay() }).soLaoDong(st.nam); saveXlsx("SoQuanLyLaoDong.xlsx", [{ name: "Sổ quản lý lao động", cols: rows[0] ? Object.keys(rows[0]) : [], rows: rows }]); }));
    card.appendChild(bar);
    card.appendChild(h("div", { class: "hint", text: "Bấm vào một nhân viên để mở hồ sơ đầy đủ (cá nhân, hợp đồng, phụ lục lương, người phụ thuộc, nghỉ phép…). Lương được tính theo phụ lục hợp đồng đang hiệu lực." }));
    var tw = h("div", { class: "tw" }); card.appendChild(tw); wrap.appendChild(card);
    function draw() {
      tw.innerHTML = ""; var qq = qOf("nhansu");
      var ixNV = HRM.buildIndex(db), rows = db.nhanvien.map(function (r) { return { r: r, hh: HRM.hienHanh(db, r["Mã NV"], null, ixNV) }; }).filter(function (x) {
        if (st.ft && x.r["Trạng thái"] !== st.ft) return false;
        return !qq || [x.r["Mã NV"], x.r["Họ và tên"], x.hh.tenPB, x.hh.tenCV].join(" ").toLowerCase().indexOf(qq) >= 0;
      });
      if (!rows.length) { tw.appendChild(h("div", { class: "empty", html: db.nhanvien.length ? "Không tìm thấy." : "Chưa có nhân viên nào.<br>Bấm <b>＋ Thêm nhân viên</b> hoặc nhập từ file Excel." })); return; }
      var pgN = pager("nhansu", rows.length, draw); if (pgN.el) tw.appendChild(pgN.el);
      var seePay = canSeePay(), cols = ["Mã NV", "Họ và tên", "Phòng ban", "Chức vụ", "Loại HĐ", "Hết hạn HĐ"].concat(seePay ? ["Lương thỏa thuận"] : [], ["Trạng thái"]);
      var t = h("table"), tr = h("tr"); cols.forEach(function (c) { tr.appendChild(h("th", { class: c === "Lương thỏa thuận" ? "r" : "", text: c })); });
      t.appendChild(h("thead", {}, [tr])); var tb = h("tbody");
      rows.slice(pgN.start, pgN.end).forEach(function (x) {
        var r = x.r, hd = x.hh.hd || {}, het = hd["Ngày hết hạn"] || "", soon = het && !hd["Ngày chấm dứt"] && het <= new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
        var e = h("tr", { class: "click", on: { click: function () { st.tab = "nv"; st.nv = r["Mã NV"]; st.nvTab = "canhan"; st.hd = null; render(); } } });
        [r["Mã NV"], r["Họ và tên"], x.hh.tenPB, x.hh.tenCV, hd["Hình thức HĐLĐ"] || "", het].forEach(function (v, i) { e.appendChild(h("td", { class: "t", text: v || "", style: i === 5 && soon ? "color:#c0362c;font-weight:600" : "" })); });
        if (seePay) e.appendChild(h("td", { class: "r", text: x.hh.ct ? fmt(E.money(x.hh.ct["Lương thỏa thuận"])) : "" }));
        e.appendChild(h("td", { class: "t" }, [h("span", { class: "tag " + (r["Trạng thái"] === "Đã nghỉ việc" ? "off" : "on"), text: r["Trạng thái"] || "" })]));
        tb.appendChild(e);
      });
      t.appendChild(tb); tw.appendChild(t);
    }
    draw(); return wrap;
  }

  // ---------- Báo cáo nhân sự ----------
  var BC = [["biendong", "📶 Biến động nhân sự"], ["hethan", "⏰ HĐLĐ sắp hết hạn"], ["tinhhinh", "👥 Tình hình nhân sự"], ["nghi", "🌴 Nghỉ phép / ốm"], ["vipham", "⚠️ Vi phạm chưa xử lý"], ["sinhnhat", "🎂 Sinh nhật trong tháng"], ["solaodong", "📋 Sổ quản lý lao động"], ["lichsu", "🕘 Lịch sử nhân sự"]];
  function simpleTable(rows, moneyCols) {
    if (!rows.length) return h("div", { class: "empty", text: "Không có dữ liệu." });
    var cols = Object.keys(rows[0]), t = h("table"), tr = h("tr");
    cols.forEach(function (c) { tr.appendChild(h("th", { text: c })); }); t.appendChild(h("thead", {}, [tr]));
    var tb = h("tbody");
    rows.forEach(function (r) { var x = h("tr"); cols.forEach(function (c) { var v = r[c]; x.appendChild(h("td", { class: typeof v === "number" ? "r" : "t", text: typeof v === "number" ? fmt(v) : (v == null ? "" : v), style: v === "ĐÃ QUÁ HẠN" ? "color:#c0362c;font-weight:700" : "" })); }); tb.appendChild(x); });
    t.appendChild(tb); return h("div", { class: "tw" }, [t]);
  }
  /** Sổ lao động (α18): ai còn thiếu thông tin bắt buộc + nút mở đúng tab hồ sơ để bổ sung */
  var TAB_TEN = { canhan: "Thông tin cá nhân", hocvan: "Trình độ học vấn", hopdong: "Hợp đồng lao động", chitiethd: "Lương & phụ lục HĐ" };
  function goHoSo(ma, tab) {
    st.tab = "nv"; st.nv = ma;
    if (tab === "chitiethd" || tab === "hopdong") { var hh = HRM.hienHanh(db, ma); st.nvTab = "hopdong"; st.hd = hh.hd ? hh.hd["Số HĐLĐ"] : null; st.hdTab = tab === "chitiethd" ? "chitiethd" : st.hdTab; }
    else st.nvTab = tab;
    saveUi(); render();
  }
  function soLaoDongThieuCard(list) {
    var box = h("div", { "data-sld-thieu": String(list.length) });
    if (!list.length) { box.appendChild(h("div", { class: "ok", text: "✓ Mọi nhân viên đã đủ thông tin bắt buộc của sổ quản lý lao động." })); return box; }
    var show = !!st.sldThieu;
    box.appendChild(h("div", { class: "warn" }, [h("b", { text: "⚠ " + list.length + " người còn thiếu thông tin sổ lao động" }), document.createTextNode(" — bấm tên mục để mở đúng tab hồ sơ và bổ sung (hoặc dùng file mẫu Excel của Nhân sự). "), btn(show ? "Thu gọn" : "Xem danh sách", "ghost", function () { st.sldThieu = !show; render(); })]));
    if (!show) return box;
    var t = h("table", { class: "sld-thieu" }), tb = h("tbody");
    t.appendChild(h("thead", {}, [h("tr", {}, [h("th", { text: "Mã NV" }), h("th", { text: "Họ và tên" }), h("th", { text: "Còn thiếu (bấm để bổ sung)" })])]));
    list.forEach(function (x) {
      var by = {}; x.thieu.forEach(function (m) { (by[m.tab] = by[m.tab] || []).push(m.field); });
      var cell = h("td", { class: "t" });
      Object.keys(by).forEach(function (tab) { cell.appendChild(btn(TAB_TEN[tab] + ": " + by[tab].join(", "), "chipbtn", function () { goHoSo(x["Mã NV"], tab); }, "Mở hồ sơ " + x["Họ và tên"] + " → " + TAB_TEN[tab])); });
      tb.appendChild(h("tr", {}, [h("td", { class: "t", text: x["Mã NV"] }), h("td", { class: "t", text: x["Họ và tên"] }), cell]));
    });
    t.appendChild(tb); box.appendChild(h("div", { class: "tw", style: "max-height:360px" }, [t]));
    return box;
  }
  function tabBaoCao() {
    var w = h("div"), bar = h("div", { class: "bar" }), R = HRM.reports(db, { hidePay: !canSeePay() });
    st.bc = st.bc || "hethan";
    BC.forEach(function (b) { bar.appendChild(btn(b[1], st.bc === b[0] ? "pri" : "", function () { st.bc = b[0]; render(); })); });
    w.appendChild(bar);
    var card = h("div", { class: "card" }), tools = h("div", { class: "bar" }), rows = [], title = BC.filter(function (b) { return b[0] === st.bc; })[0][1].replace(/^\S+\s/, "");
    card.appendChild(tools);
    if (st.bc === "biendong") {
      var mk = function (v, set) { var i = h("input", { class: "i", type: "month", value: v, style: "width:150px" }); i.addEventListener("change", function () { if (i.value) { set(i.value); render(); } }); return i; };
      var den0 = st.bdDen || kyStr(), tu0 = st.bdTu || (function () { var d = new Date(+den0.slice(0, 4), +den0.slice(5, 7) - 3, 1); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2); })();
      tools.appendChild(h("label", { text: "Từ " })); tools.appendChild(mk(tu0, function (v) { st.bdTu = v; }));
      tools.appendChild(h("label", { text: "đến " })); tools.appendChild(mk(den0, function (v) { st.bdDen = v; }));
      var all = R.biendong(tu0 < den0 ? tu0 : den0, tu0 < den0 ? den0 : tu0), loai = st.bdLoai || "";
      var tiles = h("div", { class: "kpis", role: "group", "aria-label": "Lọc theo loại biến động" });
      [""].concat(["Tăng mới", "Nghỉ việc"], HRM.BIEN_DONG.filter(function (x) { return x !== "Khác"; })).forEach(function (L) {
        var n = all.filter(function (r) { return !L || r["Loại biến động"] === L; }).length;
        if (L && !n) return;
        tiles.appendChild(h("button", { type: "button", class: "kpi qcard", "aria-pressed": loai === L ? "true" : "false", style: loai === L ? "border-color:var(--brand);background:var(--brandSoft)" : "", on: { click: function () { st.bdLoai = L; render(); } } }, [h("small", { text: L || "Tất cả" }), h("b", { text: String(n) })]));
      });
      card.appendChild(tiles);
      rows = all.filter(function (r) { return !loai || r["Loại biến động"] === loai; });
      card.appendChild(h("div", { class: "hint", text: "Tự nhận biết từ hợp đồng (vào làm / chấm dứt) và từ mỗi phụ lục so với phụ lục liền trước — dữ liệu cũ không phải nhập lại. Dùng để theo dõi tăng / giảm lao động, tăng lương, báo tăng / giảm mức đóng BHXH hằng tháng." }));
      card.appendChild(simpleTable(rows));
    } else if (st.bc === "hethan") {
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
    else if (st.bc === "solaodong") {
      rows = R.soLaoDong(st.nam);
      card.appendChild(soLaoDongThieuCard(R.soLaoDongThieu()));
      card.appendChild(h("div", { class: "hint", text: "Nội dung theo khoản 2 Điều 3 Nghị định 145/2020/NĐ-CP (lập sổ trong 30 ngày kể từ ngày bắt đầu hoạt động; cập nhật từ ngày người lao động bắt đầu làm việc; xuất trình khi cơ quan có thẩm quyền yêu cầu). Các cột nghỉ / làm thêm / đào tạo / kỷ luật / tai nạn lấy theo năm " + st.nam + " (năm của kỳ đang chọn). Bấm 'Xuất Excel' để in / lưu sổ." }));
      card.appendChild(simpleTable(rows));
    }
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
    c.appendChild(h("div", { class: "bar" }, [btn("💾 Lưu hồ sơ công ty", "pri", function () { if (!need("system.admin")) return; db.congty = [Object.assign({}, congTy(), get())]; save(); /* giữ trường ngoài form (VD Quy chế tính lương) */ render(); toast("Đã lưu"); })]));
    return c;
  }

  function cardAudit() {
    var c = h("div", { class: "card" }), list = (db.auditlog || []).slice().reverse();
    c.appendChild(h("h3", { text: "🕘 Nhật ký thao tác" }));
    c.appendChild(h("div", { class: "hint", text: list.length + " thao tác được ghi (chốt / mở chốt, nhập Excel, khôi phục, sửa hồ sơ & danh mục — kèm trước/sau, đánh dấu HỒI TỐ khi chạm kỳ đã chốt)." }));
    if (!list.length) return c;
    var rows = list.map(function (a) { return { "Thời điểm": fmtTime(a.luc), "Người thực hiện": a.nguoi || "(bản cũ — không ghi)", "Thao tác": a.thaoTac, "Chi tiết": a.chiTiet }; });
    c.appendChild(h("div", { class: "bar" }, [btn("⬇ Xuất Excel nhật ký", "", function () { saveXlsx("NhatKyThaoTac.xlsx", [{ name: "NhatKy", cols: Object.keys(rows[0]), rows: rows }]); })]));
    c.appendChild(h("div", { class: "tw", style: "max-height:320px" }, [simpleTable(rows.slice(0, 300))]));
    return c;
  }

  // ---------- Hướng dẫn, quy trình, dự thảo quy chế (ui/guide.js) ----------
  function tabHuongDan() {
    var G = window.HAKGuide, w = h("div"), tabs = h("div", { class: "subtabs noprint" }), key = st.hd2 || "start";
    G.TABS.forEach(function (t) { tabs.appendChild(h("button", { class: key === t[0] ? "on" : "", text: t[1], on: { click: function () { st.hd2 = t[0]; render(); } } })); });
    w.appendChild(tabs);
    var ctx = { db: db, E: E, nam: st.nam, thang: st.thang, congTy: congTy() };
    var bar = h("div", { class: "bar noprint" }, [btn("🖨 In", "", function () { window.print(); })]);
    if (key === "rules") {
      bar.appendChild(btn("⬇ Tải file Word (.doc) để chỉnh sửa", "pri", function () { download("Du_thao_Quy_che_tra_luong_" + kyKey(st.nam, st.thang) + ".doc", "application/msword", G.regulationDoc(ctx)); audit("Tải dự thảo Quy chế trả lương", kyLabel(kyKey(st.nam, st.thang))); }));
      bar.appendChild(h("span", { class: "hint", style: "margin:0", text: "Bảng mức lương, phụ cấp, BH, thuế lấy theo danh mục đang có hiệu lực ở kỳ " + st.thang + "/" + st.nam + " (đổi kỳ ở góc phải trên)." }));
    }
    w.appendChild(bar);
    w.appendChild(h("div", { class: "card guide" + (key === "rules" ? " g-doc" : ""), html: G.section(key, ctx) }));
    return w;
  }

  // ---------- Danh mục ----------
  function tabDanhMuc() {
    var w = h("div"), bar = h("div", { class: "bar" });
    Object.keys(DM).forEach(function (k) { bar.appendChild(btn(DM[k].ten + (countOf(k) ? " (" + countOf(k) + ")" : ""), st.dm === k ? "pri" : "", function () { st.dm = k; saveUi(); render(); })); });
    w.appendChild(bar);
    w.appendChild(st.dm === "dm_congthuc" ? congThucPanel() : grid(st.dm, DM[st.dm]));
    return w;
  }

  // ---------- Công thức tiền lương — Formula management UI (Master Prompt mục VII) ----------
  var CT_LOAI = [["OVERTIME", "Tăng ca"], ["ALLOWANCE", "Phụ cấp"], ["SUPPORT", "Hỗ trợ"]];
  function ctLoaiTen(v) { var o = CT_LOAI.filter(function (x) { return x[0] === v; })[0]; return o ? o[1] : (v || ""); }
  var CT_SUBTABS = [["tangca", "Tăng ca"], ["phucap", "Phụ cấp"], ["hotro", "Hỗ trợ"], ["vars", "Thư viện biến"], ["mau", "Mẫu công thức"], ["test", "Kiểm tra công thức"], ["lichsu", "Lịch sử phiên bản"]];
  var CT_SUBTAB_LOAI = { tangca: "OVERTIME", phucap: "ALLOWANCE", hotro: "SUPPORT" };
  function congThucPanel() {
    var w = h("div"), bar2 = h("div", { class: "bar sub" });
    st.ct = st.ct || "tangca";
    CT_SUBTABS.forEach(function (t) { bar2.appendChild(btn(t[1], st.ct === t[0] ? "pri" : "", function () { st.ct = t[0]; render(); })); });
    w.appendChild(bar2);
    var loai = CT_SUBTAB_LOAI[st.ct];
    if (loai) {
      var def = Object.assign({}, DM.dm_congthuc, { def: Object.assign({}, DM.dm_congthuc.def, { "Loại": loai }), rowFilter: function (r) { return (r["Loại"] || "") === loai; } });
      w.appendChild(h("div", { class: "hint", text: "Chỉ hiện công thức Loại = " + loai + " (" + ctLoaiTen(loai) + "). Dòng mới tự gán Loại này." }));
      w.appendChild(grid("dm_congthuc", def));
    } else if (st.ct === "vars") w.appendChild(ctVarsPanel());
    else if (st.ct === "mau") w.appendChild(ctTemplatesPanel());
    else if (st.ct === "test") w.appendChild(ctTestPanel());
    else if (st.ct === "lichsu") w.appendChild(ctHistoryPanel());
    return w;
  }
  /** Tab "Thư viện biến" (mục VII, tab 4) — danh sách biến được khai báo, chỉ xem. */
  function ctVarsPanel() {
    var box = h("div", { class: "card" });
    box.appendChild(h("div", { class: "hint", text: "Tên biến dùng trong ô 'Biểu thức' ở các tab Tăng ca / Phụ cấp / Hỗ trợ. Biến không có trong danh sách này sẽ báo lỗi khi lưu công thức (không âm thầm coi là 0)." }));
    var t = h("table");
    t.appendChild(h("tr", {}, [h("th", { text: "Biến" }), h("th", { text: "Tên" }), h("th", { text: "Đơn vị" }), h("th", { text: "Nguồn" }), h("th", { text: "Diễn giải" })]));
    FML.variables.VARS.forEach(function (v) {
      t.appendChild(h("tr", {}, [h("td", { class: "t", html: "<code>" + esc(v.name) + "</code>" }), h("td", { class: "t", text: v.label }), h("td", { class: "t", text: v.unit }), h("td", { class: "t", style: "color:#6c7a74", text: v.source }), h("td", { class: "t", text: v.desc })]));
    });
    box.appendChild(h("div", { class: "tw" }, [t])); return box;
  }
  /** Tab "Mẫu công thức" (mục VII, tab 5) — công thức có sẵn để copy, transcribe đúng từ switch/case gốc. */
  var CT_TEMPLATES = [
    { loai: "OVERTIME", ten: "Vượt công chuẩn, nhân hệ số (như TC1)", bieuThuc: "IF(CONG_TINH_LUONG - CONG_LE - CONG_TRUNG_CHUYEN - CONG_PHEP - CONG_TC - CONG_CHUAN > 0, (CONG_TINH_LUONG - CONG_LE - CONG_TRUNG_CHUYEN - CONG_PHEP - CONG_TC - CONG_CHUAN) * HE_SO_TC, 0) + CONG_TC * HE_SO_TC", moTa: "Phần công vượt công chuẩn (đã trừ lễ/phép/trung chuyển/tăng ca) × hệ số, cộng thêm công tăng ca đã chấm × hệ số." },
    { loai: "OVERTIME", ten: "Vượt công chuẩn, có Công chuẩn 2 (như TC2)", bieuThuc: "IF(CONG_TINH_LUONG - CONG_LE - CONG_TRUNG_CHUYEN - CONG_PHEP - CONG_TC - CONG_DI_CHUYEN - IF(CONG_CHUAN_2 > 0, CONG_CHUAN_2, CONG_CHUAN) > 0, (CONG_TINH_LUONG - CONG_LE - CONG_TRUNG_CHUYEN - CONG_PHEP - CONG_TC - CONG_DI_CHUYEN - IF(CONG_CHUAN_2 > 0, CONG_CHUAN_2, CONG_CHUAN)) * HE_SO_TC, 0) + CONG_TC * HE_SO_TC", moTa: "Như trên nhưng trừ thêm công di chuyển; dùng Công chuẩn 2 (nhãn DQ) thay Công chuẩn khi có." },
    { loai: "OVERTIME", ten: "Tăng ca + Chủ nhật nhân hệ số (như TC3)", bieuThuc: "(CONG_TC + CONG_CHU_NHAT) * HE_SO_TC", moTa: "Công tăng ca cộng công Chủ nhật, nhân hệ số tăng ca." },
    { loai: "OVERTIME", ten: "Phần vượt công chuẩn, KHÔNG nhân hệ số (như TC6)", bieuThuc: "MAX(CONG_TINH_LUONG - CONG_TC - CONG_LE - CONG_CHUAN, 0)", moTa: "Chỉ lấy phần công vượt công chuẩn, không nhân hệ số tăng ca." },
    { loai: "OVERTIME", ten: "Công tăng ca × hệ số (mặc định)", bieuThuc: "CONG_TC * HE_SO_TC", moTa: "Công thức đơn giản nhất — dùng khi không có quy tắc đặc biệt." },
    { loai: "ALLOWANCE", ten: "Tỷ lệ theo công, có ngưỡng (ví dụ mẫu)", bieuThuc: "IF(CONG_HUONG_PHU_CAP >= NGUONG_PHU_CAP, MUC_PHU_CAP, MUC_PHU_CAP * CONG_HUONG_PHU_CAP / CONG_CHUAN)", moTa: "Đủ ngưỡng công → hưởng đủ mức phụ cấp; chưa đủ → chia theo tỷ lệ công / công chuẩn." },
    { loai: "ALLOWANCE", ten: "Tỷ lệ, trừ lễ+phép khi dưới ngưỡng", bieuThuc: "IF(CONG_TINH_LUONG - CONG_LE - CONG_PHEP >= CONG_CHUAN - NGUONG_PHU_CAP, MUC_PHU_CAP, ROUND(MUC_PHU_CAP / CONG_CHUAN * (CONG_TINH_LUONG - CONG_LE - CONG_PHEP)))", moTa: "Giống kiểu TYLE_TRU_LE_PHEP cũ — đối chiếu M thật HAK_DN." },
    { loai: "ALLOWANCE", ten: "Tỷ lệ, trừ phép+tăng ca khi dưới ngưỡng", bieuThuc: "IF(CONG_TINH_LUONG - CONG_PHEP - CONG_TC >= CONG_CHUAN - NGUONG_PHU_CAP, MUC_PHU_CAP, ROUND(MUC_PHU_CAP / CONG_CHUAN * (CONG_TINH_LUONG - CONG_PHEP - CONG_TC)))", moTa: "Giống kiểu TYLE_TRU_PHEP_TANGCA cũ — quy chế 2026/C6." },
    { loai: "ALLOWANCE", ten: "Cố định, không tính theo công", bieuThuc: "MUC_PHU_CAP", moTa: "Luôn trả đủ mức phụ cấp, không trừ gì theo công." },
    { loai: "SUPPORT", ten: "Theo ngày / lượt được hưởng", bieuThuc: "SO_NGAY_DUOC_HUONG * MUC_HO_TRO", moTa: "Số ngày (hoặc lượt) được hưởng × đơn giá hỗ trợ." },
    { loai: "SUPPORT", ten: "Bù thiếu công chuẩn (như HT_THIEU_CHUAN)", bieuThuc: "IF(CONG_CHUAN > 0 AND CONG_THUC_TE <= CONG_CHUAN, (CONG_CHUAN - CONG_THUC_TE) * MUC_HO_TRO, 0)", moTa: "Chỉ trả khi công thực tế chưa đạt công chuẩn — bù đúng phần còn thiếu." },
    { loai: "SUPPORT", ten: "Theo xe / đơn vị hợp lệ", bieuThuc: "SO_XE_HOP_LE * DON_GIA_HO_TRO", moTa: "Số xe (hoặc đơn vị) hợp lệ × đơn giá hỗ trợ theo xe." },
    { loai: "SUPPORT", ten: "Gấp đôi khi đủ điều kiện", bieuThuc: "IF(DU_DIEU_KIEN_HO_TRO = 1, SO_NGAY_DUOC_HUONG * MUC_HO_TRO * 2, SO_NGAY_DUOC_HUONG * MUC_HO_TRO)", moTa: "Đủ điều kiện (biến 0/1) → hưởng gấp đôi mức thường." }
  ];
  function ctTemplatesPanel() {
    var box = h("div", { class: "card" });
    box.appendChild(h("div", { class: "hint", text: "Công thức có sẵn để tham khảo / copy vào ô 'Biểu thức' ở tab tương ứng (Tăng ca / Phụ cấp / Hỗ trợ), hoặc dùng ngay ở tab 'Kiểm tra công thức' để chạy thử." }));
    CT_LOAI.forEach(function (lo) {
      box.appendChild(h("div", { class: "fh", text: ctLoaiTen(lo[0]) }));
      CT_TEMPLATES.filter(function (x) { return x.loai === lo[0]; }).forEach(function (x) {
        var card = h("div", { class: "slip", style: "margin-bottom:8px" });
        card.appendChild(h("div", { html: "<b>" + esc(x.ten) + "</b>" }));
        card.appendChild(h("div", { style: "font-family:monospace;background:var(--brandSoft, #eef3e8);padding:6px;border-radius:6px;margin:4px 0;word-break:break-all", text: x.bieuThuc }));
        card.appendChild(h("div", { class: "hint", style: "margin:0", text: x.moTa }));
        box.appendChild(card);
      });
    });
    return box;
  }
  /** Giá trị mặc định của 1 biến, lấy từ danh mục (mã tăng ca/phụ cấp/hỗ trợ cùng mã công thức) nếu có,
   * không thì lấy từ dữ liệu đã tính của 1 nhân viên/kỳ cụ thể (_ct — không tính lại), còn lại = nhập tay. */
  function ctVarFromCode(name, loai, ma, nam, thang) {
    if (!ma) return null;
    if (loai === "OVERTIME") {
      var rTC = E.hieuLuc(db.dm_tangca, "Mã tăng ca", nam, thang)[ma];
      if (rTC) { if (name === "HE_SO_TC") return E.pct(rTC["Hệ số tăng ca"]); if (name === "TIEN_TC_CO_DINH") return E.money(rTC["Tiền tăng ca (nếu tính cố định)"]); }
    } else if (loai === "ALLOWANCE") {
      var rPC = E.hieuLuc(db.dm_phucap, "Mã phụ cấp", nam, thang)[ma];
      if (rPC) { if (name === "MUC_PHU_CAP") return E.money(rPC["Số tiền"]); if (name === "NGUONG_PHU_CAP") return E.num(rPC["Tham chiếu"]); }
    } else if (loai === "SUPPORT") {
      var rHT = E.hieuLuc(db.dm_hotro, "Mã hỗ trợ", nam, thang)[ma];
      if (rHT) { if (name === "MUC_HO_TRO" || name === "DON_GIA_HO_TRO") return E.money(rHT["Số tiền"]); }
    }
    return null;
  }
  function ctVarFromRow(name, b, nam, thang) {
    var c = (b && b["_ct"]) || {};
    switch (name) {
      case "CONG_CHUAN": return c.congChuan;
      case "CONG_CHUAN_2": return c.congChuan2;
      case "CONG_TINH_LUONG": case "CONG_HUONG_PHU_CAP": case "CONG_THUC_TE": return b && b["Tổng công"];
      case "CONG_BT": return c.congBT;
      case "CONG_TC": return c.congTangCa;
      case "CONG_CHU_NHAT": return c.congChuNhat;
      case "CONG_LE": return c.congLe;
      case "CONG_PHEP": return c.congPhep;
      case "CONG_DI_CHUYEN": return c.congDiChuyen;
      case "CONG_TRUNG_CHUYEN": return c.congTrungChuyen;
      case "LUONG_THOA_THUAN": return b && b["Lương thỏa thuận"];
      case "DON_GIA_CONG": return c.donGiaTG;
      case "SL_TAN": return b && b["Sản lượng (tấn)"];
      case "SO_XE": return b && b["Số xe bơm dăm"];
      case "LUONG_SAN_LUONG": return b && b["Lương sản lượng"];
      case "LUONG_BU": return b && b["Lương bù SL"];
      case "SO_NGAY_COM": case "SO_NGAY_DUOC_HUONG": return b && b["Ngày cơm"];
      case "SO_NGAY_THANG": return new Date(nam, thang, 0).getDate();
      default: return null;
    }
  }
  function ctDefaultVar(name, b, loai, ma, nam, thang) {
    var vc = ctVarFromCode(name, loai, ma, nam, thang);
    if (vc != null) return { value: Math.round(vc * 1000) / 1000, source: "Danh mục " + ctLoaiTen(loai) + " (mã " + ma + ")" };
    var vr = ctVarFromRow(name, b, nam, thang);
    if (vr != null) return { value: Math.round(vr * 1000) / 1000, source: b ? ("Nhân viên " + b["Mã NV"] + " · kỳ " + thang + "/" + nam) : "" };
    return { value: 0, source: "chưa có nguồn tự động — nhập tay" };
  }
  /** Tên biến có trong formula-variables.js xuất hiện trong 1 biểu thức (để biết cần hỏi giá trị biến nào). */
  function ctRefVars(expr) {
    var found = [], seen = {};
    (String(expr || "").match(/[A-Za-zÀ-ỹ_][A-Za-zÀ-ỹ0-9_]*/g) || []).forEach(function (w) {
      if (FML.variables.isKnown(w) && !seen[w]) { seen[w] = 1; found.push(w); }
    });
    return found;
  }
  /** Tab "Kiểm tra công thức" (mục VII, tab 6 / mục VII.2-3) — chạy thử KHÔNG ghi vào bảng lương thật. */
  function ctTestPanel() {
    st.ctTest = st.ctTest || { nam: st.nam, thang: st.thang, loai: "OVERTIME", ma: "", maNV: "", maCT: "", expr: "", vars: {} };
    var T = st.ctTest, box = h("div", { class: "card" });
    box.appendChild(h("div", { class: "hint", text: "Thử công thức với dữ liệu của 1 nhân viên đã tính (hoặc giả lập, nếu không chọn nhân viên) — KHÔNG ghi/đổi bảng lương thật. Chọn 'Mã công thức' có sẵn để nạp biểu thức, hoặc tự sửa trực tiếp." }));
    refreshNVList();
    var row1 = h("div", { class: "bar" });
    var selLoai = h("select"); CT_LOAI.forEach(function (x) { selLoai.appendChild(h("option", { value: x[0], text: x[1] })); }); selLoai.value = T.loai;
    selLoai.addEventListener("change", function () { T.loai = selLoai.value; T.maCT = ""; T.vars = {}; render(); });
    row1.appendChild(h("label", { text: "Loại " })); row1.appendChild(selLoai);
    var rows = db.dm_congthuc.filter(function (r) { return (r["Loại"] || "") === T.loai; });
    var selMa = h("select"); selMa.appendChild(h("option", { value: "", text: "— tự nhập biểu thức —" }));
    rows.forEach(function (r) { selMa.appendChild(h("option", { value: r._id, text: (r["Mã công thức"] || "") + " — " + (r["Tên công thức"] || "") + " (" + (r["Trạng thái"] || "") + ")" })); });
    selMa.value = T.maCT;
    selMa.addEventListener("change", function () {
      T.maCT = selMa.value; var r = rows.filter(function (x) { return x._id === T.maCT; })[0];
      if (r) { T.ma = r["Mã công thức"] || ""; T.expr = r["Biểu thức"] || ""; T.vars = {}; }
      render();
    });
    row1.appendChild(h("label", { text: " Mã công thức " })); row1.appendChild(selMa);
    box.appendChild(row1);
    var row2 = h("div", { class: "bar" });
    var inNV = h("input", { value: T.maNV, placeholder: "Mã NV (để trống = giả lập)", list: "dsnv" });
    inNV.addEventListener("change", function () { T.maNV = inNV.value.trim(); render(); });
    row2.appendChild(h("label", { text: "Nhân viên " })); row2.appendChild(inNV);
    var inKy = h("input", { type: "month", value: T.nam + "-" + ("0" + T.thang).slice(-2) });
    inKy.addEventListener("change", function () { if (inKy.value) { var m = inKy.value.split("-"); T.nam = +m[0]; T.thang = +m[1]; render(); } });
    row2.appendChild(h("label", { text: " Kỳ " })); row2.appendChild(inKy);
    row2.appendChild(btn("↺ Lấy lại giá trị theo nhân viên/kỳ", "", function () { T.vars = {}; render(); }));
    box.appendChild(row2);
    box.appendChild(h("label", { text: "Biểu thức (có thể sửa trực tiếp để thử, không ảnh hưởng danh mục)" }));
    var ta = h("textarea", { rows: 2, style: "width:100%;font-family:monospace" }); ta.value = T.expr;
    ta.addEventListener("change", function () { T.expr = ta.value; render(); });
    box.appendChild(ta);
    var vr = FML.validate(T.expr || "");
    if (!T.expr) { box.appendChild(h("div", { class: "hint", text: "Nhập hoặc chọn một công thức để thử." })); return box; }
    if (!vr.ok) { box.appendChild(h("div", { class: "warn", text: "⚠ Công thức không hợp lệ: " + vr.errors.map(function (e) { return e.message; }).join("; ") })); return box; }
    var b = null, kqB = null;
    if (T.maNV) { kqB = kqKy(T.nam, T.thang); b = (kqB.kq.bangluong || []).filter(function (x) { return x["Mã NV"] === T.maNV; })[0] || null; if (!b) box.appendChild(h("div", { class: "warn", text: "⚠ Không thấy " + T.maNV + " trong bảng lương kỳ " + T.thang + "/" + T.nam + " — dùng giá trị giả lập (0), có thể tự sửa." })); }
    var names = ctRefVars(T.expr);
    if (!names.length) box.appendChild(h("div", { class: "warn", text: "Công thức không dùng biến nào trong Thư viện biến — kết quả sẽ là hằng số." }));
    var ctx = {}, vt = h("table");
    vt.appendChild(h("tr", {}, [h("th", { text: "Biến" }), h("th", { text: "Giá trị" }), h("th", { text: "Nguồn" })]));
    names.forEach(function (name) {
      var cur = T.vars[name];
      if (cur === undefined) { var d = ctDefaultVar(name, b, T.loai, T.ma, T.nam, T.thang); cur = d.value; T.vars[name] = cur; T.vars["_src_" + name] = d.source; }
      ctx[name] = +cur || 0;
      var inp = h("input", { class: "num", value: cur });
      inp.addEventListener("change", function () { T.vars[name] = E.num(inp.value); T.vars["_src_" + name] = "nhập tay"; render(); });
      vt.appendChild(h("tr", {}, [h("td", { class: "t", html: "<code>" + esc(name) + "</code> — " + esc((FML.variables.get(name) || {}).label || "") }), h("td", {}, [inp]), h("td", { class: "t", style: "color:#6c7a74", text: T.vars["_src_" + name] || "" })]));
    });
    box.appendChild(h("div", { class: "tw" }, [vt]));
    var ketQuaMoi = null, loi = null;
    try { ketQuaMoi = Math.round(FML.evaluate(T.expr, ctx)); } catch (e) { loi = e.message; }
    var fieldCu = T.loai === "OVERTIME" ? "Tiền tăng ca" : T.loai === "ALLOWANCE" ? "Phụ cấp" : "Lương hỗ trợ";
    var ketQuaCu = b ? b[fieldCu] : null;
    var kq = h("div", { class: "kpis" });
    kq.appendChild(h("div", { class: "kpi" }, [h("small", { text: "Kết quả công thức này" }), h("b", { text: loi ? "⚠ lỗi" : fmt(ketQuaMoi) })]));
    if (b) kq.appendChild(h("div", { class: "kpi" }, [h("small", { text: "Đang áp dụng cho " + T.maNV + " (" + fieldCu + ")" }), h("b", { text: fmt(ketQuaCu) })]));
    if (b && !loi) kq.appendChild(h("div", { class: "kpi" }, [h("small", { text: "Chênh lệch" }), h("b", { style: ketQuaMoi - ketQuaCu ? "color:#c0362c" : "", text: (ketQuaMoi - ketQuaCu > 0 ? "+" : "") + fmt(ketQuaMoi - ketQuaCu) })]));
    box.appendChild(kq);
    if (loi) box.appendChild(h("div", { class: "warn", text: "⚠ Lỗi khi tính: " + loi }));
    box.appendChild(h("div", { class: "hint", style: "margin-top:8px", text: "Chỉ chạy thử trong màn hình này — chưa lưu, chưa đổi bảng lương/kỳ đã chốt. Muốn áp dụng thật: lưu biểu thức này vào tab " + ctLoaiTen(T.loai) + " (Trạng thái = Hiệu lực)." }));
    return box;
  }
  /** Tab "Lịch sử phiên bản" (mục VII, tab 7 / mục VII.4) — mọi dòng cùng Mã công thức (mọi Trạng thái) +
   * nhật ký chỉnh sửa liên quan (ai, khi nào, nội dung trước/sau — lấy từ nhật ký chung của app). */
  function ctHistoryPanel() {
    var box = h("div", { class: "card" });
    var codes = []; db.dm_congthuc.forEach(function (r) { var c = r["Mã công thức"]; if (c && codes.indexOf(c) < 0) codes.push(c); });
    if (!codes.length) { box.appendChild(h("div", { class: "empty", text: "Chưa có công thức nào trong danh mục." })); return box; }
    st.ctHist = st.ctHist && codes.indexOf(st.ctHist) >= 0 ? st.ctHist : codes[0];
    var sel = h("select"); codes.forEach(function (c) { sel.appendChild(h("option", { value: c, text: c })); }); sel.value = st.ctHist;
    sel.addEventListener("change", function () { st.ctHist = sel.value; render(); });
    box.appendChild(h("label", { text: "Mã công thức " })); box.appendChild(sel);
    var vers = FML.versionsOf(db.dm_congthuc, st.ctHist);
    box.appendChild(h("div", { class: "fh", text: "Các phiên bản (mới nhất trước)" }));
    var fenv = function () { return { can: can, user: session ? session.tenDangNhap : "", db: db }; };
    var LBL = { "Chờ duyệt": "Gửi duyệt", "Nháp": "Trả về nháp", "Đã duyệt": "Duyệt", "Hiệu lực": "Kích hoạt", "Ngừng": "Ngừng" };
    var chuyen = function (r, to) {
      var reason = String(st.ctReason || "").trim(); // Electron không hỗ trợ prompt() → lý do nhập ở ô phía trên bảng
      if ((to === "Hiệu lực" || to === "Ngừng") && !reason) { alert("Nhập 'Lý do thay đổi' vào ô phía trên bảng trước khi " + LBL[to].toLowerCase() + " công thức."); return; }
      var vals = { "Trạng thái": to }; if (reason) vals["Lý do thay đổi"] = reason;
      if (!commit(REPO.plan("update", "dm_congthuc", r, vals, { what: LBL[to].toLowerCase() + " công thức" }), { confirm: true, action: "Công thức tiền lương — " + LBL[to] + " " + (r["Mã công thức"] || "") })) return;
      st.ctReason = ""; save(); toast(LBL[to] + " công thức " + (r["Mã công thức"] || "") + ": xong."); render();
    };
    var saoChep = function (r) {
      if (!commit(REPO.plan("insert", "dm_congthuc", null, FAP.copyAsDraft(r, fenv()), { what: "sao chép công thức" }), { action: "Công thức tiền lương — Sao chép thành phiên bản mới " + (r["Mã công thức"] || "") })) return;
      save(); toast("Đã tạo phiên bản mới (Nháp) — sửa biểu thức rồi bấm 'Gửi duyệt'."); render();
    };
    var inReason = h("input", { value: st.ctReason || "", placeholder: "Lý do thay đổi (bắt buộc khi Kích hoạt / Ngừng)", style: "width:60%", "data-ct-reason": "1" });
    inReason.addEventListener("input", function () { st.ctReason = inReason.value; });
    box.appendChild(h("div", { class: "bar" }, [h("label", { text: "Lý do thay đổi " }), inReason]));
    var t = h("table");
    t.appendChild(h("tr", {}, ["Phiên bản", "Hiệu lực từ", "Hiệu lực đến", "Trạng thái", "Công ty", "Biểu thức", "Người lập", "Người duyệt", "Kích hoạt", "Thao tác"].map(function (x) { return h("th", { text: x }); })));
    vers.forEach(function (r) {
      var acts = h("td", { class: "t" });
      FAP.actionsFor(r, fenv()).forEach(function (to) { acts.appendChild(btn(LBL[to], to === "Hiệu lực" ? "pri" : "", function () { chuyen(r, to); })); });
      if (can("dm.edit")) acts.appendChild(btn("⎘ Sao chép bản mới", "", function () { saoChep(r); }));
      t.appendChild(h("tr", { "data-ct-ver": (r["Mã công thức"] || "") + "#" + (r["Phiên bản"] || 1) }, [h("td", { class: "t", text: "v" + (r["Phiên bản"] || 1) }), h("td", { class: "t", text: r["Hiệu lực từ"] || "" }), h("td", { class: "t", text: r["Hiệu lực đến"] || "" }),
        h("td", { class: "t", html: "<span class='tag " + (r["Trạng thái"] === "Hiệu lực" ? "on" : "off") + "'>" + esc(r["Trạng thái"] || "Nháp") + "</span>" }),
        h("td", { class: "t", text: r["Công ty"] || "(mọi công ty)" }), h("td", { class: "t", style: "font-family:monospace", text: r["Biểu thức"] || "" }),
        h("td", { class: "t", text: (r["Người lập"] || "") + (r["Ngày lập"] ? " · " + fmtTime(r["Ngày lập"]) : "") }),
        h("td", { class: "t", text: (r["Người duyệt"] || "") + (r["Thời điểm duyệt"] ? " · " + fmtTime(r["Thời điểm duyệt"]) : "") }),
        h("td", { class: "t", text: (r["Người kích hoạt"] || "") + (r["Thời điểm kích hoạt"] ? " · " + fmtTime(r["Thời điểm kích hoạt"]) : "") + (r["Lý do thay đổi"] ? " — " + r["Lý do thay đổi"] : "") }), acts]));
    });
    box.appendChild(h("div", { class: "tw" }, [t]));
    box.appendChild(h("div", { class: "hint", text: "Quy trình: Nháp → Gửi duyệt → Duyệt (người khác người lập) → Kích hoạt. Chỉ bản 'Hiệu lực' được dùng để tính lương. Bản đã gửi duyệt trở đi không sửa nội dung — dùng 'Sao chép bản mới'. Kích hoạt bản có ngày hiệu lực trong kỳ đã chốt là hồi tố (chỉ Admin) và không làm đổi bảng lương đã chốt." }));
    var logs = (db.auditlog || []).filter(function (a) { return a.chiTiet && a.chiTiet.indexOf("Công thức tiền lương") >= 0 && a.chiTiet.indexOf(st.ctHist) >= 0; }).slice(-30).reverse();
    box.appendChild(h("div", { class: "fh", text: "Nhật ký chỉnh sửa (ai, khi nào, nội dung trước/sau)" }));
    if (!logs.length) box.appendChild(h("div", { class: "hint", text: "Chưa có nhật ký khớp mã này (nhật ký chỉ ghi được khi thao tác đổi/trống trường 'Mã công thức' trong dòng sửa)." }));
    else {
      var t2 = h("table"); t2.appendChild(h("tr", {}, [h("th", { text: "Lúc" }), h("th", { text: "Người" }), h("th", { text: "Thao tác" }), h("th", { text: "Nội dung" })]));
      logs.forEach(function (a) { t2.appendChild(h("tr", {}, [h("td", { class: "t", text: fmtTime(a.luc) }), h("td", { class: "t", text: a.nguoi || "" }), h("td", { class: "t", text: a.thaoTac || "" }), h("td", { class: "t", text: a.chiTiet || "" })])); });
      box.appendChild(h("div", { class: "tw" }, [t2]));
    }
    return box;
  }

  // ---------- Tính lương ----------
  var COLS_FULL = ["Mã NV", "Họ và tên", "Phòng ban", "Công chuẩn", "Tổng công", "Lương thời gian", "Lương phụ", "Sản lượng (tấn)", "Lương sản lượng", "Lương bù SL", "Lương bơm dăm", "Tiền tăng ca", "Phụ cấp", "Phụ cấp công tác", "Lương hỗ trợ", "Tiền cơm", "Thưởng", "Thu nhập khác", "Tổng thu nhập", "BH trừ NLĐ", "KPCĐ trừ NLĐ", "Truy thu BH", "Thuế TNCN", "Trừ khác", "Tạm ứng", "Thực lĩnh"];
  var COLS_COMPACT = ["Mã NV", "Họ và tên", "Phòng ban", "Tổng công", "Tổng thu nhập", "BH trừ NLĐ", "KPCĐ trừ NLĐ", "Thuế TNCN", "Tạm ứng", "Trừ khác", "Thực lĩnh"];
  var TEXTCOLS = { "Mã NV": 1, "Họ và tên": 1, "Phòng ban": 1 };

  // Cách bù lương sản lượng (α19 thêm 2 cách của công cụ phân bổ khối lượng; 2 cách cũ giữ nguyên)
  var BU_OPTS = [["false", "Bù SL theo THÁNG (từng người)"], ["true", "Bù SL theo NGÀY (liên tục — cách cũ)"], ["daihiep", "Bù SL theo NGÀY — bậc thang (công cụ HAK / Đại Hiệp)"], ["to", "Bù SL theo BÌNH QUÂN TỔ (công cụ HAK)"]];
  // Quy chế tính lương (R-68): "2026" = quy chế HAK Group (HAK, CNHAK, HAKQN — chủ sở hữu duyệt 11/10/2026) · "1.7" = cách tính trước đó (đối chiếu)
  var QC_OPTS = [["2026", "Quy chế lương HAK Group 2026"], ["1.7", "Cách tính cũ (engine 1.7 — để đối chiếu)"]];
  function quyChe() { var v = congTy()["Quy chế tính lương"]; return v === "1.7" ? "1.7" : "2026"; }
  function qcLabel(v) { var o = QC_OPTS.filter(function (x) { return x[0] === String(v); })[0]; return o ? o[1] : "Cách tính cũ (trước quy chế 2026)"; }
  function buLabel(v) { var o = BU_OPTS.filter(function (x) { return x[0] === String(v); })[0]; return o ? o[1] : String(v); }
  function tinhLuong(nam, thang, qcDung) {
    nam = nam || st.nam; thang = thang || st.thang;
    var sp = HRM.staffForPayroll(db, nam, thang);
    // α19: phiếu cân ghi Mã phòng ban → chia đều cho tổ (như công cụ phân bổ khối lượng) trước khi tính
    var slK = HRM.sanLuongKy(db, nam, thang, "sanluong"), bdK = HRM.sanLuongKy(db, nam, thang, "bandam");
    var qc = qcDung || quyChe(), kq = E.tinhBangLuong(Object.assign({}, db, { nhansu: sp.list, sanluong: slK.rows, bandam: bdK.rows }), nam, thang, st.bu, { quyChe: qc });
    slK.alloc.warnings.forEach(function (w) { kq.canhbao.push("Sản lượng — " + w); });
    // α22: người có đơn nghỉ đã duyệt (mọi loại) tự không nhận phiếu ngày nghỉ — ghi rõ để kế toán thấy
    var dmN = function (x) { return x.slice(8, 10) + "/" + x.slice(5, 7); };
    [["Sản lượng", slK], ["Bơm dăm", bdK]].forEach(function (p) { (p[1].alloc.nghi || []).forEach(function (x) {
      if (x.khongCong) kq.canhbao.push(p[0] + " — " + x.hoTen + " (" + x.ma + "): công = 0 / trống " + x.ngay.length + " ngày có phiếu của tổ (" + x.ngay.slice(0, 8).map(dmN).join(", ") + (x.ngay.length > 8 ? "…" : "") + ") — coi như nghỉ nguyên ngày, KHÔNG chia sản lượng các ngày này; kiểm tra lại chấm công");
      else kq.canhbao.push(p[0] + " — " + x.hoTen + " (" + x.ma + "): " + x.loai + " (đơn đã duyệt) — không chia " + x.ngay.length + " ngày cân " + dmN(x.ngay[0]) + (x.ngay.length > 1 ? " → " + dmN(x.ngay[x.ngay.length - 1]) : ""));
    }); });
    bdK.alloc.warnings.forEach(function (w) { kq.canhbao.push("Bơm dăm — " + w); });
    kq.cheDoBu = String(st.bu); kq.quyChe = qc;
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
  /**
   * Checklist trước khi chốt kỳ (Master Prompt mục XIV/XVIII). Chỉ hiện khi có điểm cần xem (lỗi
   * hoặc cảnh báo) — dữ liệu sạch thì bỏ qua thẳng, không thêm bước cho trường hợp bình thường.
   * "loi" (⛔) = BLOCKER mục XIV — không có nút vượt qua, phải sửa dữ liệu rồi tính lại.
   * "canhbao" (⚠) = WARNING — được chốt nếu đã kiểm tra là đúng. onContinue() chỉ được gọi khi
   * người dùng chủ động xác nhận tiếp tục (hoặc không có gì phải xem).
   */
  function preChotChecklist(fresh, onContinue) {
    if (!PCC) { onContinue(); return; }
    var slA = pbAlloc(st.nam, st.thang, "sanluong"), bdA = pbAlloc(st.nam, st.thang, "bandam");
    var ck = PCC.run({ db: db, kq: fresh, slAlloc: slA, bdAlloc: bdA, quyChe: quyChe() });
    if (!ck.loiCount && !ck.canhbaoCount) { onContinue(); return; }
    var ICON = { ok: "✔", canhbao: "⚠", loi: "⛔" };
    var body = h("div");
    body.appendChild(h("div", { class: ck.loiCount ? "warn" : "hint", html: "Checklist trước khi chốt kỳ — <b>" + ck.loiCount + " lỗi</b>, <b>" + ck.canhbaoCount + "</b> cảnh báo trên " + ck.items.length + " điểm." +
      (ck.loiCount ? " ⛔ Lỗi là BLOCKER (mục XIV) — phải sửa dữ liệu rồi tính lại, KHÔNG thể vượt qua." : " Cảnh báo có thể chốt nếu đã kiểm tra là đúng.") }));
    var t = h("table");
    ck.items.forEach(function (x) {
      var tr = h("tr");
      tr.appendChild(h("td", { text: ICON[x.trangThai] + " " + x.id }));
      tr.appendChild(h("td", { class: "t", html: "<b>" + esc(x.ten) + "</b>" + (x.chiTiet.length ? "<br><span style='color:#6c7a74;font-size:12px'>" + x.chiTiet.slice(0, 5).map(esc).join("<br>") + (x.chiTiet.length > 5 ? "<br>…(" + (x.chiTiet.length - 5) + " dòng nữa)" : "") + "</span>" : "") }));
      t.appendChild(tr);
    });
    body.appendChild(h("div", { class: "tw" }, [t]));
    modal("Checklist trước khi chốt kỳ lương", body, function (close) {
      // BLOCKER (còn "loi"): chỉ có nút đóng để quay lại sửa — không có đường nào bấm qua được (mục XIV).
      return ck.loiCount ? [btn("Đóng — sửa dữ liệu rồi tính lại", "pri", close)]
        : [btn("Hủy, để tôi kiểm tra lại", "", close), btn("Đã kiểm tra, tiếp tục chốt", "pri", function () { close(); onContinue(); })];
    });
  }
  function chotKy() {
    if (!st.kq || !need("payroll.close")) return;
    var ky = kyStr();
    if (kyChot(ky)) { alert(kyLabel(ky) + " đã chốt."); return; }
    // P0 (BLOCKER — mục IV.2): lỗi dữ liệu NGHIÊM TRỌNG phải CHẶN CỨNG, không cho chốt bằng 1 hộp
    // thoại xác nhận như cảnh báo thường — gồm mức "Critical" (Mã NV trùng) VÀ các dòng "High" mà
    // core/integrity.js đã tự xác định là tiền bị CỘNG TRÙNG (phiếu cân / số chứng từ trùng khóa
    // → sản lượng, thưởng, tạm ứng bị tính 2 lần) — khớp đúng BLOCKER "sản lượng/chấm công bị cộng
    // trùng" của mục IV.2, dù mức integrity.js gán là High (ảnh hưởng tiền trực tiếp như Critical).
    var critIssues = INT.check(db).filter(function (i) { return i.level === "Critical" || /CỘNG (2 LẦN|NHIỀU LẦN)/.test(i.msg); });
    if (critIssues.length) {
      alert("⛔ KHÔNG THỂ CHỐT — có " + critIssues.length + " lỗi dữ liệu NGHIÊM TRỌNG cần sửa trước:\n" +
        critIssues.slice(0, 10).map(function (i) { return "• " + i.msg; }).join("\n") + (critIssues.length > 10 ? "\n…" : "") +
        "\n\nVào Công ty & Sao lưu → Kiểm tra dữ liệu để xem đầy đủ và sửa, rồi tính lại.");
      return;
    }
    // Luôn tính lại từ dữ liệu mới nhất: tránh chốt nhầm bảng lương cũ đang hiển thị.
    // P0: so sánh TỪNG chỉ tiêu của TỪNG nhân viên (CLS.diffDetailed), không chỉ tổng thực lĩnh/số NV —
    // 2 người đổi lương ngược dấu nhau (A +1tr, B -1tr) làm tổng & số NV y nguyên nhưng bảng lương đã khác.
    var fresh = tinhLuong(), now2 = CLS.totals(fresh), diffRows = CLS.diffDetailed(st.kq, fresh);
    if (diffRows.length) {
      st.kq = fresh; render();
      var dBody = h("div");
      dBody.appendChild(h("div", { class: "warn", text: "Dữ liệu đã thay đổi sau lần tính trước — " + diffRows.length + " chênh lệch theo từng nhân viên/chỉ tiêu (không chỉ tổng). App đã TÍNH LẠI: " + now2.soNV + " NV, tổng thực lĩnh " + fmt(now2.thucLinh) + ".\nHãy xem kỹ bảng dưới rồi bấm Chốt lần nữa." }));
      dBody.appendChild(simpleTable(diffRows));
      modal("⚠ Dữ liệu đã đổi trước khi chốt " + kyLabel(ky), dBody, function (close) { return [btn("Đóng", "", close)]; });
      return;
    }
    // P0 (BLOCKER — mục IV.2): ô chấm công không hợp lệ trong kỳ đang chốt phải chặn cứng, không chỉ cảnh báo.
    // Chạy TRƯỚC checklist mềm (preChotChecklist) để không hiện "tiếp tục được" rồi mới chặn cứng ngay sau.
    var badDay = 0;
    db.chamcong.forEach(function (r) { if (VAL.normKy(r["Kỳ"]) === ky) DAYS.forEach(function (d) { if (VAL.dayCell(d, r[d], ky).error) badDay++; }); });
    if (badDay) { alert("⛔ KHÔNG THỂ CHỐT — có " + badDay + " ô chấm công không hợp lệ (số âm, chữ lạ, ngày không có trong tháng) trong kỳ " + kyLabel(ky) + ".\nSửa ở Chấm công (hoặc xem Công ty & Sao lưu → Kiểm tra dữ liệu) rồi tính lại."); return; }
    // P0 (BLOCKER — mục IV.2 "thiếu mã lương/tham số thiết yếu"): mã BHXH không có trong Danh mục
    // bảo hiểm → cả khối BH (NLĐ + công ty) bị BỎ QUA HOÀN TOÀN cho người đó (engine.js), không chỉ
    // tính sai — công ty có thể thiếu nghĩa vụ đóng BHXH thật. Chặn cứng, không cho bấm qua.
    var missingBH = fresh.canhbao.filter(function (w2) { return /chưa có trong Danh mục bảo hiểm/.test(w2); });
    if (missingBH.length) {
      alert("⛔ KHÔNG THỂ CHỐT — " + missingBH.length + " người có mã BHXH không có trong Danh mục bảo hiểm (toàn bộ BHXH/BHYT/BHTN của người đó đang bị BỎ QUA, không chỉ tính sai):\n" +
        missingBH.slice(0, 10).map(function (m) { return "• " + m; }).join("\n") + (missingBH.length > 10 ? "\n…" : "") +
        "\n\nSửa Mã BHXH hoặc bổ sung mã vào Danh mục bảo hiểm rồi tính lại.");
      return;
    }
    // P0 (BLOCKER — mục VIII "CompanyID → PolicyVersion → PayrollMethod"): phương pháp bù sản lượng
    // CHÍNH THỨC khi chốt KHÔNG được quyết định bởi lựa chọn tự do (st.bu) trên màn hình Tính lương —
    // phải lấy từ bản "Hiệu lực" trong Danh mục → Quy chế bù sản lượng. Chỉ chặn khi kỳ này THỰC SỰ
    // có sản lượng cần bù (laSanLuong) — công ty không dùng lương sản phẩm không bị ảnh hưởng.
    var VALID_BU = { "false": 1, "true": 1, daihiep: 1, to: 1 };
    var coSanLuong = fresh.bangluong.some(function (b) { return b["_ct"] && b["_ct"].laSanLuong; });
    if (coSanLuong) {
      var qcBuChot = E.quyCheBuChinhThuc(db.dm_quychebu, st.nam, st.thang);
      var maChinhThuc = qcBuChot && String(qcBuChot["Cách bù"] || "").trim();
      if (!qcBuChot || !VALID_BU[maChinhThuc]) {
        alert("⛔ KHÔNG THỂ CHỐT — kỳ " + kyLabel(ky) + " có sản lượng cần bù lương nhưng CHƯA có Quy chế bù sản lượng CHÍNH THỨC hợp lệ (Trạng thái = Hiệu lực) cho kỳ này.\nVào Danh mục → Quy chế bù sản lượng để khai báo và duyệt (Trạng thái = Hiệu lực), rồi chốt lại.\nMàn hình Tính lương vẫn dùng được để xem tạm/so sánh nhiều phương pháp.");
        return;
      }
      var buChinhThuc = maChinhThuc === "true" ? true : maChinhThuc === "false" ? false : maChinhThuc;
      if (String(buChinhThuc) !== String(st.bu)) {
        // Không chốt theo lựa chọn xem tạm — tự chuyển đúng phương pháp đã duyệt rồi tính lại trước khi chốt.
        st.bu = buChinhThuc; saveUi();
        fresh = tinhLuong(); now2 = CLS.totals(fresh);
        toast("Đã tự chuyển sang đúng phương pháp bù đã duyệt (" + buLabel(buChinhThuc) + ") theo Quy chế bù sản lượng để chốt.");
      }
    }
    preChotChecklist(fresh, function () { chotKyTiep(ky, fresh, now2); });
  }
  function chotKyTiep(ky, fresh, now2) {
    var w = fresh.canhbao.length;
    askText("Chốt " + kyLabel(ky), now2.soNV + " nhân viên · Tổng thực lĩnh " + fmt(now2.thucLinh) + " đ" +
      (w ? "\n⚠ Còn " + w + " cảnh báo dữ liệu chưa xử lý (xem trên màn hình Tính lương)." : "") +
      "\nSau khi chốt: lưu bảng lương + dữ liệu đầu vào của kỳ, khóa chấm công/sản lượng/thưởng/tạm ứng của kỳ.", { label: "Ghi chú (không bắt buộc)", okText: "🔒 Chốt kỳ lương" }, function (note) {
    if (w && !confirm("Xác nhận CHỐT dù còn " + w + " cảnh báo?")) return;
    var snap = CLS.buildSnapshot(db, ky, fresh, fresh._staff, { note: note, buTheoNgay: st.bu, quyChe: fresh.quyChe || quyChe(), engineVersion: E.ENGINE_VERSION, user: currentUser() });
    CLS.close(db, snap); audit("Chốt kỳ lương", ky + " v" + snap.version + " — " + now2.soNV + " NV, thực lĩnh " + now2.thucLinh);
    if (!saveNow()) { CLS.rollbackClose(db, snap); db.auditlog.pop(); alert("CHỐT KHÔNG THÀNH CÔNG: chưa lưu được dữ liệu xuống đĩa. Kỳ lương vẫn ở trạng thái chưa chốt."); render(); return; }
    // Bản sao lưu SAU CHỐT KỲ: giữ vĩnh viễn, tự chép sang thư mục sao lưu thứ hai nếu đã chọn (main/storage.js)
    var bkChot = null; try { bkChot = store && store.backup ? store.backup("sau-chot-" + ky) : null; } catch (e) { bkChot = null; }
    var bs = bkChot && store.backupStatus ? store.backupStatus() : null;
    st.kq = null; render(); toast("Đã chốt và lưu " + kyLabel(ky) + " (phiên bản " + snap.version + ")" + (bkChot ? " · đã tạo bản sao lưu sau chốt" + (bs && bs.mirrorDir && !bs.lastMirrorError ? " và chép sang thư mục thứ hai" : "") : ""));
    if (bs && bs.mirrorDir && bs.lastMirrorError) alert("⚠ Đã chốt và sao lưu trên máy, nhưng KHÔNG chép được sang thư mục sao lưu thứ hai:\n" + bs.lastMirrorError + "\n\nCắm USB / kết nối ổ mạng rồi vào Công ty & Sao lưu → 'Chép sang thư mục thứ hai ngay'.");
    });
  }
  function moChot(ky) {
    var c = kyChot(ky); if (!c || !need("payroll.reopen")) return;
    askText("Mở chốt " + kyLabel(ky) + " (phiên bản " + (c.version || 1) + ")", "Bản chốt hiện tại KHÔNG bị xóa — được chuyển vào lịch sử chốt kỳ.\nDữ liệu kỳ được mở khóa để sửa, tính lại và chốt thành phiên bản mới.", { label: "Lý do mở chốt", required: true, multiline: true, okText: "🔓 Mở chốt" }, function (reason) {
    // P1: reopen() có rollbackReopen() riêng khi saveNow() thất bại — chỉ cảnh báo, không chặn, nếu
    // không tạo được bản sao lưu phòng hộ thêm này.
    var bkOk = !!backupNow("truoc-mo-chot");
    var hrec = CLS.reopen(db, ky, reason, { user: currentUser() }); audit("Mở chốt kỳ lương", ky + " v" + hrec.version + " — " + reason);
    if (!saveNow()) { CLS.rollbackReopen(db, hrec); db.auditlog.pop(); alert("Không mở chốt được vì chưa lưu được dữ liệu xuống đĩa."); render(); return; }
    st.kq = null; render(); toast("Đã mở chốt " + kyLabel(ky) + " — bản cũ lưu trong lịch sử" + (bkOk ? "" : " · ⚠ KHÔNG tạo được bản sao lưu phòng hộ trước khi mở chốt — kiểm tra dung lượng đĩa"));
    });
  }
  function doiChieu(chot) {
    // so với đúng quy chế lúc chốt (bản chốt trước α21 = cách tính cũ) — chênh lệch chỉ do dữ liệu đổi, không do đổi quy chế
    var rows = CLS.diff(chot.kq, tinhLuong(undefined, undefined, chot.quyChe || "1.7")).map(function (r) { return { "Mã NV": r["Mã NV"], "Họ và tên": r["Họ và tên"], "Đã chốt": r["Trước"], "Tính lại hôm nay": r["Sau"], "Chênh lệch": r["Chênh lệch"], "Ghi chú": r["Ghi chú"] }; });
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
        btn("⬇ PDF", "", function (e) {
          e.stopPropagation(); var m = k.ky.split("-");
          exportSheetsPdf({ title: "Bảng lương kỳ đã chốt", ky: "Kỳ " + (+m[1]) + "/" + m[0] + " · v" + (k.version || 1), trangThai: "Đã chốt " + fmtTime(k.ngayChot) + (CLS.verify(k) === "ok" ? " · nguyên vẹn" : ""), loc: [], sheets: [{ name: "BangLuong_" + k.ky, rows: addTotal(k.kq.bangluong.map(function (r) { var o = {}; COLS_COMPACT.forEach(function (c) { o[c] = r[c] == null ? "" : r[c]; }); return o; })) }] }, "BangLuongDaChot_" + k.ky + "_v" + (k.version || 1) + ".pdf");
        }, "PDF bảng lương đúng như lúc chốt"),
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
    ["baohiem", "🛡 Báo cáo bảo hiểm"], ["hachtoan", "📒 Bảng hạch toán"], ["phieuchi", "💵 Phiếu chi lương / tạm ứng"], ["sosanh", "↔ So sánh với kỳ trước"],
    ["thang", "📅 Lương 12 tháng"], ["nvnam", "👤 Thu nhập năm theo NV"], ["thuenam", "🧾 Thuế TNCN cả năm"]
  ];
  var BCL_NAM = { thang: 1, nvnam: 1, thuenam: 1 };

  function bcPhongBan(r) {
    // Q-19 (R-53): người điều chuyển trong kỳ được chia theo công ở từng phòng (core/allocation.js); tổng các phòng = tổng bảng lương
    var res = ALLOC.byDepartment(r), rows = addTotal(res.rows);
    if (rows.length) rows[rows.length - 1]["Số người"] = res.people; // người điều chuyển được đếm ở mỗi phòng đã làm; dòng tổng = số người thật
    return rows;
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
  /**
   * (α19) Phân bổ sản lượng / bơm dăm của kỳ — như công cụ "Phân bổ khối lượng tính lương":
   * phiếu ghi Mã phòng ban → chia đều cho tổ (trừ NV vắng); phiếu ghi Mã NV → giao trực tiếp.
   */
  function pbAlloc(nam, thang, loai) {
    var PA = C.palloc, k = HRM.sanLuongKy(db, nam, thang, loai), cache = {};
    var pbOf = function (ma, d) { var key = ma + "\u0001" + d; if (!(key in cache)) { var hh = HRM.hienHanh(db, ma, d); cache[key] = hh.pb || ""; } return cache[key]; };
    var tenPB = function (pb) { return HRM.refName(db, "dm_phongban", pb) || ""; };
    var al = PA.withDirect(k.alloc, k.direct.map(function (r) { return { phieu: r["Phiếu cân"] || "", ngay: String(r["Ngày cân"] || "").slice(0, 10), kl: r["KL hàng (Tấn)"], ma: r["Mã NV"] }; }), pbOf, tenNV, tenPB);
    var sp = HRM.staffForPayroll(db, nam, thang), cnt = {};
    sp.list.forEach(function (x) { if (x["Mã PB"]) cnt[x["Mã PB"]] = (cnt[x["Mã PB"]] || 0) + 1; });
    al.empCount = cnt; al.chuaGan = k.chuaGan; al.raw = (db[loai] || []).filter(function (r) { return String(r["Ngày cân"] || "").slice(0, 7) === kyKey(nam, thang); });
    return al;
  }
  function bcSanLuong(nam, thang, loai) {
    var al = pbAlloc(nam, thang, loai), dv = loai === "bandam" ? "Số xe" : "Sản lượng (tấn)", r3_ = function (x) { return Math.round(x * 1000) / 1000; };
    var pb = Object.keys(al.byDept).sort().map(function (d) { var x = al.byDept[d], o = { "Mã phòng ban": d, "Tên phòng ban": x.tenPB, "Số nhân sự": al.empCount[d] || 0 }; o[dv] = r3_(x.total); o["Chưa phân bổ"] = r3_(x.unallocated); return o; });
    var nv = Object.keys(al.byEmp).map(function (k) { return al.byEmp[k]; }).sort(function (a, b) { return a.maPB < b.maPB ? -1 : a.maPB > b.maPB ? 1 : b.total - a.total; })
      .map(function (e) { var o = { "Mã phòng ban": e.maPB, "Mã NV": e.ma, "Họ và tên": e.hoTen, "Số ngày có SL": Object.keys(e.byDay).length }; o[dv] = r3_(e.total); return o; });
    var audit = al.audit.map(function (a) { return { "Phiếu": a.phieu, "Ngày": a.ngay, "Mã phòng ban": a.maPB, "KL / số xe": r3_(a.kl), "Số người nhận": a.soNguoi, "Mỗi người": a.share ? r3_(a.share) : "", "Người nhận": a.names.join(", "), "Ghi chú": a.note }; });
    var chuaGan = al.chuaGan.map(function (r) { return { "Phiếu cân": r["Phiếu cân"] || "", "Ngày cân": r["Ngày cân"] || "", "Biển số": r["Biển số"] || "", "KL": E.num(r["KL hàng (Tấn)"]) }; });
    return { pb: addTotal(pb), nv: addTotal(nv), audit: audit, chuaGan: chuaGan, warnings: al.warnings, al: al };
  }
  /** File Excel "Phân bổ khối lượng tính lương" — bố cục như công cụ (ExcelJS). */
  function exportPBKL(nam, thang) {
    if (!need("export", "xuất dữ liệu ra Excel")) return;
    if (!window.ExcelJS || !window.HAKUi) { alert("Thiếu thư viện Excel (ExcelJS)"); return; }
    var sl = pbAlloc(nam, thang, "sanluong"), bd = pbAlloc(nam, thang, "bandam"), src = kqKy(nam, thang), dmL = {};
    (db.dm_luong || []).forEach(function (r) { if (r["Mã lương"] === "SP") dmL = r; });
    var bc = {}; db.chamcong.filter(function (r) { return r["Kỳ"] === kyKey(nam, thang) && String(r["Hình thức công"] || "BT").toUpperCase() === "BT"; })
      .forEach(function (r) { for (var d = 1; d <= 31; d++) bc[r["Mã NV"]] = (bc[r["Mã NV"]] || 0) + E.tachCong(r[("0" + d).slice(-2)]).soCong; });
    var rows = src.kq.bangluong.filter(function (b) { return n0(b["Lương sản lượng"]) || n0(b["Lương bơm dăm"]) || n0(b["Lương bù SL"]) || n0(b["Sản lượng (tấn)"]) || n0(b["Số xe bơm dăm"]); })
      .map(function (b) { var pb = b["Mã PB"] || ""; return { maPB: pb, tenPB: HRM.refName(db, "dm_phongban", pb) || b["Phòng ban"] || pb, ma: b["Mã NV"], hoTen: b["Họ và tên"], soCong: bc[b["Mã NV"]] || 0, tan: n0(b["Sản lượng (tấn)"]), xe: n0(b["Số xe bơm dăm"]), luongSL: n0(b["Lương sản lượng"]), luongBD: n0(b["Lương bơm dăm"]), bu: n0(b["Lương bù SL"]), tong: n0(b["Lương sản lượng"]) + n0(b["Lương bơm dăm"]) + n0(b["Lương bù SL"]) }; });
    var coChe = src.chot ? String((kyChot(kyKey(nam, thang)) || {}).buTheoNgay) : String(st.bu);
    // Master Prompt V3 mục XVII: chi tiết bù lương Đại Hiệp theo NGÀY bậc thang (chỉ khi đúng cơ chế này)
    var daihiepDetail = null;
    if (coChe === "daihiep") {
      var sp2 = HRM.staffForPayroll(db, nam, thang), slK2 = HRM.sanLuongKy(db, nam, thang, "sanluong");
      var chiTiet = E.chiTietBuNgayDaiHiep(Object.assign({}, db, { nhansu: sp2.list, sanluong: slK2.rows }), nam, thang);
      if (chiTiet.length) daihiepDetail = chiTiet.map(function (x) { return Object.assign({ tenPB: HRM.refName(db, "dm_phongban", x.maPB) || x.maPB }, x); });
    }
    var meta = { donVi: congTy()["Tên công ty"] || "", thang: "Tháng " + thang + "/" + nam, nguoiLap: session ? session.hoTen : "" };
    var wb = window.HAKUi.pbkl.report(window.ExcelJS, { sl: sl, bd: bd, raw: { sl: sl.raw, bd: bd.raw },
      luong: rows.length ? { rows: rows, coChe: coChe, note: (src.chot ? "Số liệu lấy từ bảng lương ĐÃ CHỐT." : "Kỳ CHƯA chốt — số liệu tính tạm.") + " Số công = công BT trong chấm công." } : null,
      daihiepDetail: daihiepDetail,
      ctx: { coChe: coChe, chot: src.chot, giaKl: n0(dmL["Số tiền khoán"]), giaBd: n0(((db.dm_luong || []).filter(function (r) { return r["Mã lương"] === "BD"; })[0] || {})["Số tiền khoán"]), mucSan: n0(dmL["Đơn giá bù lương"]), nguong: n0(dmL["Ngưỡng công bù theo tổ"]), soNgay: new Date(nam, thang, 0).getDate() } }, meta);
    wb.xlsx.writeBuffer().then(function (buf) {
      download("Phan_bo_khoi_luong_" + kyKey(nam, thang) + ".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf);
      audit("Xuất Excel phân bổ khối lượng", kyLabel(kyKey(nam, thang)));
    }, function (e) { alert("Không tạo được file: " + e.message); });
  }
  /** File mẫu phiếu cân / bơm dăm như công cụ (ExcelJS) */
  function downloadPBTemplate(key) {
    if (!window.ExcelJS || !window.HAKUi) { downloadTemplate(key); return; }
    var wb = window.HAKUi.pbkl.template(window.ExcelJS, key, { donVi: congTy()["Tên công ty"] || "", thang: "Tháng " + st.thang + "/" + st.nam, mau: "01/" + ("0" + st.thang).slice(-2) + "/" + st.nam });
    wb.xlsx.writeBuffer().then(function (buf) { download(key === "bandam" ? "mau_bang_bom_ban_dam.xlsx" : "mau_bang_khoi_luong.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buf); });
  }
  function bcHachToan(r, nam, thang) {
    var ky = thang + "/" + nam, rows = [], cp = {}, cpBH = {}, sum = function (f) { return r.bangluong.reduce(function (a, x) { return a + n0(x[f]); }, 0); };
    // Q-19 (R-53): chi phí người điều chuyển chia theo công ở từng phòng → đúng TK chi phí của từng phòng
    var cost = ALLOC.costByKey(r, tkChiPhi); cp = cost.luong; cpBH = cost.bh;
    var add = function (no, co, dg, tien) { if (Math.round(tien)) rows.push({ "Kỳ": ky, "TK Nợ": no, "TK Có": co, "Diễn giải": dg, "Số tiền": Math.round(tien) }); };
    Object.keys(cp).sort().forEach(function (tk) { add(tk, "334", "Tính lương phải trả kỳ " + ky, cp[tk]); });
    Object.keys(cpBH).sort().forEach(function (tk) { add(tk, "338", "Trích BHXH/BHYT/BHTN/KPCĐ (DN đóng) kỳ " + ky, cpBH[tk]); });
    add("334", "338", "Khấu trừ BH vào lương (NLĐ đóng) kỳ " + ky, sum("BH trừ NLĐ"));
    add("334", "3382", "Khấu trừ KPCĐ vào lương (NLĐ đóng) kỳ " + ky, sum("KPCĐ trừ NLĐ"));
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
      o["KPCĐ NLĐ đóng"] = s("KPCĐ trừ NLĐ");
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
        var o = m[x["Mã NV"]] || (m[x["Mã NV"]] = { "Mã NV": x["Mã NV"], "Họ và tên": x["Họ và tên"], "Số tháng có lương": 0, "Tổng thu nhập": 0, "Tiền cơm (không chịu thuế)": 0, "BH bắt buộc NLĐ đóng": 0, "KPCĐ NLĐ đóng": 0, "Người phụ thuộc (tối đa)": 0, "Thuế TNCN đã khấu trừ": 0 });
        o["Số tháng có lương"]++; o["Tổng thu nhập"] += n0(x["Tổng thu nhập"]); o["Tiền cơm (không chịu thuế)"] += n0(x["Tiền cơm"]);
        o["BH bắt buộc NLĐ đóng"] += n0(x["BH trừ NLĐ"]); o["KPCĐ NLĐ đóng"] += n0(x["KPCĐ trừ NLĐ"]); o["Thuế TNCN đã khấu trừ"] += n0(x["Thuế TNCN"]);
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
    var optRows = (kqKy(st.nam, st.thang).kq || { bangluong: [] }).bangluong, rfHint = h("div", { class: "hint", "data-rf-hint": "1" }), rfSkip = {};
    card.appendChild(reportFilterBar(optRows)); card.appendChild(rfHint);
    /** Lọc 1 bảng báo cáo theo bộ lọc dùng chung (chỉ tiêu chí mà bảng có cột); dòng tổng tính lại sau lọc */
    function FX(rows) {
      var g = RF.applyGeneric(rows, st.rf); g.skipped.forEach(function (x) { rfSkip[x] = 1; });
      if (!g.filtered) return rows;
      var lab = g.hadTotal ? String(rows[rows.length - 1][Object.keys(rows[rows.length - 1])[0]]) : "";
      return g.hadTotal && g.rows.length ? addTotal(g.rows, lab) : g.rows;
    }
    var nam = st.nam, thang = st.thang, info = function (t, cls) { card.appendChild(h("div", { class: cls || "hint", html: t })); };
    if (BCL_NAM[st.bcl]) {
      var ks = chotTrongNam(nam);
      info("Năm <b>" + nam + "</b> (đổi năm ở ô Kỳ lương phía trên). Báo cáo cả năm chỉ cộng các <b>kỳ đã chốt</b>: " + (ks.length ? ks.map(function (k) { return "T" + (+k.ky.slice(5)); }).join(", ") : "chưa có kỳ nào") + ".", ks.length ? "hint" : "warn");
    } else {
      var src = st.bcl === "cong" || st.bcl === "sanluong" ? null : kqKy(nam, thang);
      if (src) info(src.chot ? "🔒 Số liệu kỳ <b>" + thang + "/" + nam + "</b> lấy từ bảng lương <b>đã chốt</b>." : "⚠ Kỳ <b>" + thang + "/" + nam + "</b> <b>chưa chốt</b> — số liệu tính tạm từ dữ liệu hiện tại, có thể thay đổi.", src.chot ? "locked" : "warn");
    }
    if (st.bcl === "phongban") { var r1 = FX(bcPhongBan(src.kq)); card.appendChild(simpleTable(r1)); sheets.push({ name: "TheoPhongBan", rows: r1 }); }
    else if (st.bcl === "cong") { var r2 = FX(bcCong(nam, thang)); info("Tổng hợp từ bảng chấm công kỳ " + thang + "/" + nam + ". Ngày có nhãn: VD QC×7 = 7 ngày công tác QC."); card.appendChild(simpleTable(r2)); sheets.push({ name: "TongHopCong", rows: r2 }); }
    else if (st.bcl === "sanluong") {
      st.bclLoai = st.bclLoai || "sanluong";
      var ls = h("select"); [["sanluong", "Sản lượng gỗ (tấn)"], ["bandam", "Bơm dăm (số xe)"]].forEach(function (o) { ls.appendChild(h("option", { value: o[0], text: o[1] })); });
      ls.value = st.bclLoai; ls.addEventListener("change", function () { st.bclLoai = ls.value; render(); }); tools.appendChild(ls);
      var r3 = bcSanLuong(nam, thang, st.bclLoai); r3.pb = FX(r3.pb); r3.nv = FX(r3.nv); r3.audit = FX(r3.audit);
      tools.appendChild(btn("⬇ Xuất Excel (mẫu công cụ phân bổ)", "pri", function () { exportPBKL(nam, thang); }, "File nhiều sheet như công cụ Phân bổ khối lượng: tổng hợp tổ, theo ngày, chi tiết công nhân, đối soát phiếu, lương & bù lương"));
      info("Phiếu ghi <b>Mã phòng ban</b> (tổ) → chia đều cho người của tổ đang làm việc ngày cân, trừ người trong <b>NV vắng</b> (như công cụ phân bổ khối lượng). Phiếu ghi <b>Mã NV</b> → giao trực tiếp. Cách bù lương đang chọn ở Tính lương: <b>" + esc(buLabel(st.bu)) + "</b>.");
      if (r3.warnings.length) card.appendChild(h("div", { class: "warn", html: "<b>⚠ Cần kiểm tra (" + r3.warnings.length + "):</b><br>" + r3.warnings.map(esc).join("<br>") }));
      card.appendChild(h("div", { class: "fh", text: "Theo phòng ban (tổ)" })); card.appendChild(simpleTable(r3.pb));
      card.appendChild(h("div", { class: "fh", text: "Theo công nhân" })); card.appendChild(simpleTable(r3.nv));
      card.appendChild(h("div", { class: "fh", text: "Đối soát từng phiếu" })); card.appendChild(simpleTable(r3.audit));
      if (r3.chuaGan.length) { card.appendChild(h("div", { class: "warn", html: "<b>⚠ " + r3.chuaGan.length + " phiếu cân chưa có Mã NV hoặc Mã phòng ban</b> — chưa được tính lương cho ai:" })); card.appendChild(simpleTable(r3.chuaGan)); }
      sheets.push({ name: "TheoPhongBan", rows: r3.pb }, { name: "TheoCongNhan", rows: r3.nv }, { name: "DoiSoatPhieu", rows: r3.audit }, { name: "ChuaGanNguoi", rows: r3.chuaGan });
    }
    else if (st.bcl === "hachtoan") {
      var ht = bcHachToan(src.kq, nam, thang);
      info("Hạch toán tổng hợp theo TT200. TK chi phí lấy theo cột 'Tài khoản chi phí' của Phòng ban (mặc định khối Sản xuất → 622, còn lại → 642). Sửa ở Danh mục → Phòng ban.");
      card.appendChild(simpleTable(addTotal(ht.rows)));
      if (Math.abs(ht.lech) >= 1) info("Chênh lệch TK 334 (Có − Nợ) = <b>" + fmt(ht.lech) + "</b> — do thực lĩnh được làm tròn đến 1.000đ hoặc thực lĩnh âm được để 0.", "warn");
      sheets.push({ name: "HachToan", rows: ht.rows });
    }
    else if (st.bcl === "baohiem") {
      // α18: chỉ cộng / so sánh bảng BHXH engine đã tính của kỳ (không tính lại) — báo cáo nội bộ, không thay mẫu D02-LT / C12-TS
      var pn = thang === 1 ? nam - 1 : nam, pt = thang === 1 ? 12 : thang - 1, prv = kqKy(pn, pt);
      var th = BHR.tongHop(src.kq), bd = BHR.bienDong(src.kq, prv.kq), pbB = BHR.theoPhongBan(src.kq), ctB = BHR.chiTiet(src.kq); bd = FX(bd); pbB = FX(pbB); ctB = FX(ctB);
      info("Số người đóng BH: <b>" + th.soNguoi + "</b>" + (th.chuaDuNguong ? " · <b>" + th.chuaDuNguong + "</b> người chưa đủ ngưỡng công (không trừ BH NLĐ, truy thu " + fmt(th.truyThu) + ")" : "") + ". Báo cáo nội bộ để đối chiếu trước khi kê khai / nộp — <b>không thay mẫu chính thức</b> của cơ quan BHXH (D02-LT, C12-TS…).");
      card.appendChild(h("div", { class: "fh", text: "Tổng hợp theo khoản" })); card.appendChild(simpleTable(th.rows));
      if (Math.abs(th.lechNLD) >= 1) info("Chênh lệch làm tròn giữa 'Cộng BH NLĐ đóng' và tổng từng khoản: " + fmt(th.lechNLD) + "đ.", "warn");
      card.appendChild(h("div", { class: "fh", text: "Tăng / giảm / điều chỉnh so với tháng " + pt + "/" + pn + (prv.chot ? " (đã chốt)" : " (chưa chốt — tính tạm)") }));
      card.appendChild(bd.length ? simpleTable(bd) : h("div", { class: "hint", text: "Không có biến động so với kỳ trước." }));
      card.appendChild(h("div", { class: "fh", text: "Theo phòng ban" })); card.appendChild(simpleTable(pbB));
      card.appendChild(h("div", { class: "fh", text: "Chi tiết từng người" })); card.appendChild(simpleTable(ctB));
      sheets.push({ name: "TongHop", rows: th.rows }, { name: "TangGiam", rows: bd }, { name: "TheoPhongBan", rows: pbB }, { name: "ChiTiet", rows: ctB });
    }
    else if (st.bcl === "phieuchi") { var r5 = FX(bcPhieuChi(src.kq, nam, thang)); card.appendChild(simpleTable(r5)); sheets.push({ name: "PhieuChi", rows: r5 }); }
    else if (st.bcl === "sosanh") { var ss = bcSoSanh(nam, thang); ss.rows = FX(ss.rows); info("So sánh <b>" + ss.prev + "</b> → <b>" + ss.cur + "</b>, sắp theo mức chênh lớn nhất."); card.appendChild(simpleTable(ss.rows)); sheets.push({ name: "SoSanh", rows: ss.rows }); }
    else if (st.bcl === "thang") { var r7 = bc12Thang(nam); card.appendChild(simpleTable(r7)); sheets.push({ name: "Luong12Thang", rows: r7 }); }
    else if (st.bcl === "nvnam") {
      st.bclF = st.bclF || "Thực lĩnh";
      var fs = h("select"); ["Thực lĩnh", "Tổng thu nhập", "Thuế TNCN", "BH trừ NLĐ", "KPCĐ trừ NLĐ", "Tổng công", "Tạm ứng"].forEach(function (f) { fs.appendChild(h("option", { value: f, text: f })); });
      fs.value = st.bclF; fs.addEventListener("change", function () { st.bclF = fs.value; render(); }); tools.appendChild(h("label", { text: "Chỉ tiêu " })); tools.appendChild(fs);
      var r8 = FX(bcNVNam(nam, st.bclF)); card.appendChild(simpleTable(r8)); sheets.push({ name: slug(st.bclF) + "_" + nam, rows: r8 });
    }
    else if (st.bcl === "thuenam") {
      var r9 = FX(bcThueNam(nam));
      info("Số liệu hỗ trợ quyết toán thuế TNCN năm " + nam + " — cộng từ các kỳ đã chốt. Kế toán đối chiếu thêm với tờ khai 05/KK đã nộp.");
      card.appendChild(simpleTable(r9)); sheets.push({ name: "ThueTNCN_" + nam, rows: r9 });
    }
    tools.appendChild(h("span", { class: "sp" }));
    if (!RF.isEmpty(st.rf)) rfHint.textContent = "Đang lọc: " + RF.describe(st.rf).join(" · ") + " — áp cho bảng nào có cột tương ứng; Excel và PDF xuất ra theo đúng bộ lọc này." + (Object.keys(rfSkip).length ? " Không áp được (báo cáo này không có cột): " + Object.keys(rfSkip).join(", ") + "." : "");
    tools.appendChild(btn("⬇ Xuất PDF", "", function () {
      exportSheetsPdf({ title: title, ky: BCL_NAM[st.bcl] ? "Năm " + nam : "Kỳ " + thang + "/" + nam, trangThai: src && !BCL_NAM[st.bcl] ? (src.chot ? "Đã chốt" : "Chưa chốt — tính tạm") : "", loc: RF.describe(st.rf), sheets: sheets }, "BaoCao_" + slug(title) + "_" + (BCL_NAM[st.bcl] ? nam : kyKey(nam, thang)) + ".pdf");
    }, "PDF theo đúng bộ lọc đang chọn"));
    tools.appendChild(btn("⬇ Xuất Excel", "pri", function () {
      var sh = sheets.filter(function (x) { return x.rows.length; }).map(function (x) { return { name: x.name, cols: Object.keys(x.rows[0]), rows: x.rows }; });
      if (!sh.length) { toast("Không có dữ liệu"); return; }
      saveXlsx("BaoCao_" + slug(title) + "_" + (BCL_NAM[st.bcl] ? nam : kyKey(nam, thang)) + ".xlsx", sh);
    }));
    w.appendChild(card); return w;
  }

  /**
   * Đối chiếu lương Power Query (Master Prompt V3 mục XVII): nhập 1 bảng lương Excel đã xác nhận
   * đúng (công cụ cũ / Power Query) → so với kết quả app, theo TỪNG nhân viên, TỪNG chỉ tiêu — không
   * chỉ so tổng công ty. Chỉ ĐỌC, không sửa/tính lại dữ liệu.
   */
  function tabDoiChieu() {
    var w = h("div"), src = kqKy(st.nam, st.thang);
    var card = h("div", { class: "card" });
    card.appendChild(h("div", { class: "hint", html: "Nhập bảng lương Excel <b>đã xác nhận đúng</b> (vd file công cụ cũ, Power Query) để so với kết quả app — theo từng nhân viên, từng chỉ tiêu, không chỉ so tổng. App tự nhận cột theo tiêu đề (không phân biệt hoa/thường/dấu); cột lạ sẽ báo rõ để biết đã bỏ qua, không âm thầm bỏ sót." }));
    if (!RC) { card.appendChild(h("div", { class: "warn", text: "Thiếu module đối chiếu (core/reconcile.js)." })); w.appendChild(card); return w; }
    if (!src.kq || !src.kq.bangluong.length) { card.appendChild(h("div", { class: "empty", text: "Chưa có bảng lương kỳ " + st.thang + "/" + st.nam + " — vào Tính lương trước." })); w.appendChild(card); return w; }
    card.appendChild(h("div", { class: src.chot ? "locked" : "warn", text: src.chot ? "🔒 Đang đối chiếu với bảng lương ĐÃ CHỐT " + kyLabel(kyKey(st.nam, st.thang)) + "." : "⚠ Kỳ " + st.thang + "/" + st.nam + " chưa chốt — đang đối chiếu với số tính tạm, có thể thay đổi." }));
    var bar = h("div", { class: "bar" });
    bar.appendChild(btn("⬆ Chọn file Excel đối chiếu", "pri", function () {
      readWorkbook(function (wb, fileName) {
        st.dcFile = fileName; st.dcWb = wb;
        st.dcSheet = wb.SheetNames.map(function (n) { return { n: n, len: (XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }) || []).length }; }).sort(function (a, b) { return b.len - a.len; })[0].n;
        render();
      });
    }));
    if (st.dcWb) {
      if (st.dcWb.SheetNames.length > 1) {
        var selS = h("select");
        st.dcWb.SheetNames.forEach(function (n) { selS.appendChild(h("option", { value: n, text: n })); });
        selS.value = st.dcSheet; selS.addEventListener("change", function () { st.dcSheet = selS.value; render(); });
        bar.appendChild(h("label", { text: "Sheet " })); bar.appendChild(selS);
      }
      bar.appendChild(h("span", { class: "hint", text: st.dcFile }));
    }
    card.appendChild(bar);
    if (st.dcWb) {
      var arr = XLSX.utils.sheet_to_json(st.dcWb.Sheets[st.dcSheet], { header: 1 });
      var parsed = RC.parseSheet(arr);
      if (parsed.headerRow < 0) {
        card.appendChild(h("div", { class: "warn", text: "Không nhận ra dòng tiêu đề (cần có cột 'Mã NV' hoặc 'Họ và tên') trong sheet '" + st.dcSheet + "'. Thử chọn sheet khác." }));
      } else {
        card.appendChild(h("div", { class: "hint", html: "Đã đọc <b>" + parsed.rows.length + "</b> dòng, nhận ra <b>" + parsed.matched.length + "</b> chỉ tiêu: " + esc(parsed.matched.join(", ") || "(không có)") + (parsed.unmatched.length ? ". Cột KHÔNG nhận ra (bỏ qua): " + esc(parsed.unmatched.slice(0, 15).join(", ")) + (parsed.unmatched.length > 15 ? "…" : "") : "") }));
        var cmp = RC.compare(src.kq.bangluong, parsed.rows);
        var lech = cmp.rows.filter(function (r) { return r["Chênh lệch"] !== 0; });
        card.appendChild(h("div", { class: lech.length ? "warn" : "ok", text: lech.length ? lech.length + " dòng chênh lệch, trên " + cmp.rows.length + " dòng đã đối chiếu (" + parsed.rows.length + " người trong file Excel)." : cmp.rows.length ? "Khớp hoàn toàn trên " + cmp.rows.length + " dòng đã đối chiếu." : "Không có chỉ tiêu nào đối chiếu được — kiểm tra lại cột trong file." }));
        if (cmp.khongKhop.length) card.appendChild(h("div", { class: "warn", html: "<b>⚠ " + cmp.khongKhop.length + " người trong file Excel KHÔNG khớp được với app</b> (không có Mã NV khớp, hoặc trùng họ tên nhiều người — không tự đoán):<br>" + cmp.khongKhop.slice(0, 20).map(function (x) { return esc(x.hoTen || x.ma); }).join(", ") + (cmp.khongKhop.length > 20 ? "…" : "") }));
        if (lech.length) {
          var onlyLech = h("input", { type: "checkbox" }); onlyLech.checked = st.dcOnlyLech !== false;
          onlyLech.addEventListener("change", function () { st.dcOnlyLech = onlyLech.checked; render(); });
          card.appendChild(h("label", { class: "chk" }, [onlyLech, " Chỉ hiện dòng lệch"]));
        }
        var showRows = (st.dcOnlyLech !== false) ? lech : cmp.rows;
        card.appendChild(simpleTable(showRows));
        if (cmp.rows.length) card.appendChild(btn("⬇ Xuất Excel đối chiếu", "", function () {
          var sheets = [{ name: "DoiChieu", cols: Object.keys(cmp.rows[0]), rows: cmp.rows }];
          if (cmp.khongKhop.length) sheets.push({ name: "KhongKhopNguoi", cols: ["ma", "hoTen"], rows: cmp.khongKhop });
          saveXlsx("DoiChieu_" + kyKey(st.nam, st.thang) + ".xlsx", sheets);
          audit("Xuất Excel đối chiếu lương", kyLabel(kyKey(st.nam, st.thang)) + " · file nguồn: " + st.dcFile);
        }));
        // Riêng tăng ca: đối chiếu chi tiết hơn nếu file có đủ cột (mục XVII)
        var parsedTC = RC.parseSheet(arr, RC.CHI_TIEU_TANGCA);
        if (parsedTC.matched.length) {
          var cmpTC = RC.compare(src.kq.bangluong, parsedTC.rows, RC.CHI_TIEU_TANGCA);
          var lechTC = cmpTC.rows.filter(function (r) { return r["Chênh lệch"] !== 0; });
          card.appendChild(h("div", { class: "fh", text: "Đối chiếu chi tiết tăng ca" }));
          card.appendChild(h("div", { class: lechTC.length ? "warn" : "ok", text: lechTC.length ? lechTC.length + " dòng chênh lệch tăng ca." : "Khớp hoàn toàn." }));
          card.appendChild(simpleTable(lechTC.length ? lechTC : cmpTC.rows));
        }
      }
    }
    card.appendChild(h("div", { class: "hint", style: "margin-top:10px", text: "Chưa hỗ trợ đối chiếu Đại Hiệp theo từng ngày ở màn hình này — dùng sheet \"Bu luong theo ngay - DH\" trong file Excel Phân bổ khối lượng (Báo cáo lương → Sản lượng) để so sánh thủ công theo ngày." }));
    w.appendChild(card); return w;
  }
  function tabLuong() {
    var box = h("div"), chot = kyChot(kyStr());
    var card = h("div", { class: "card" }), bar = h("div", { class: "bar" });
    if (chot) {
      st.kq = Object.assign({ ky: chot.ky }, chot.kq);
      box.appendChild(h("div", { class: "locked", html: "🔒 <b>" + kyLabel(chot.ky) + " đã chốt</b> lúc " + esc(fmtTime(chot.ngayChot)) + (chot.ghiChu ? " — " + esc(chot.ghiChu) : "") +
        "<br><span>Quy chế: " + esc(qcLabel(chot.quyChe || "")) + ".</span><br><span>Đây là bảng lương đã lưu, không tính lại. Dữ liệu chấm công/sản lượng/thưởng/tạm ứng của kỳ này đang bị khóa.</span>" }, [
        h("div", { class: "bar", style: "margin:8px 0 0" }, [btn("⬇ Xuất trọn bộ Excel", "pri", function () { exportAll(chot.kq, chot.ky); }), btn("🔍 Đối chiếu với dữ liệu hiện tại", "", function () { doiChieu(chot); }), btn("🔓 Mở chốt để sửa", "red", function () { moChot(chot.ky); })])]));
      card.appendChild(bar);
      return renderKq(box, card, bar);
    }
    var sel = h("select", { "aria-label": "Cách bù lương sản lượng" }); BU_OPTS.forEach(function (o) { sel.appendChild(h("option", { value: o[0], text: o[1] })); });
    sel.value = String(st.bu); sel.addEventListener("change", function () { st.bu = sel.value === "true" ? true : sel.value === "false" ? false : sel.value; st.kqStale = true; saveUi(); });
    bar.appendChild(btn("▶ Tính lương tháng " + st.thang + "/" + st.nam, "pri big", function () {
      if (!need("payroll.calc")) return;
      if (!db.nhanvien.length) { alert("Chưa có nhân viên. Hãy nhập ở mục Nhân sự trước."); return; }
      st.kq = tinhLuong(); render(); toast("Đã tính xong " + st.kq.bangluong.length + " nhân viên");
    }));
    bar.appendChild(sel);
    var qs = h("select", { "aria-label": "Quy chế tính lương", title: "Áp dụng cho mọi kỳ chưa chốt của dữ liệu này (kỳ đã chốt giữ nguyên số)" }); QC_OPTS.forEach(function (o) { qs.appendChild(h("option", { value: o[0], text: o[1] })); });
    qs.value = quyChe();
    qs.addEventListener("change", function () {
      if (!need("dm.edit", "đổi quy chế tính lương")) { qs.value = quyChe(); return; }
      var cu = quyChe(); db.congty = [Object.assign({}, congTy(), { "Quy chế tính lương": qs.value })]; save();
      audit("Đổi quy chế tính lương", qcLabel(cu) + " → " + qcLabel(qs.value)); st.kq = null; render(); toast("Đã đổi: " + qcLabel(qs.value) + " — bấm Tính lương lại");
    });
    bar.appendChild(qs); card.appendChild(bar);
    // Mục VIII: lựa chọn "Cách bù lương sản lượng" ở trên chỉ để XEM THỬ/so sánh — khi Chốt kỳ, app
    // tự dùng đúng bản "Hiệu lực" trong Danh mục → Quy chế bù sản lượng (nếu có), không theo lựa chọn này.
    // Chỉ hiện khi công ty này có dùng lương sản phẩm (mã hình thức lương chứa SP) — không làm phiền
    // công ty không bù sản lượng.
    if (db.dm_luong.some(function (l) { return /SP/.test(l["Mã hình thức lương"] || ""); })) {
      var qcBu = E.quyCheBuChinhThuc(db.dm_quychebu, st.nam, st.thang);
      if (qcBu) {
        var dungPP = String(qcBu["Cách bù"]) === String(st.bu);
        card.appendChild(h("div", { class: dungPP ? "hint" : "warn", text: (dungPP ? "✓ " : "⚠ ") + "Quy chế bù sản lượng CHÍNH THỨC kỳ " + st.thang + "/" + st.nam + ": " + buLabel(qcBu["Cách bù"]) + (dungPP ? " — đang xem đúng phương pháp này." : " — đang XEM THỬ phương pháp khác (" + buLabel(st.bu) + ") để so sánh; khi Chốt kỳ, app sẽ tự tính lại theo đúng quy chế chính thức.") }));
      } else card.appendChild(h("div", { class: "warn", text: "⚠ Chưa có Quy chế bù sản lượng CHÍNH THỨC (Danh mục → Quy chế bù sản lượng, Trạng thái = Hiệu lực) cho kỳ " + st.thang + "/" + st.nam + " — lựa chọn ở trên chỉ để xem thử/so sánh. Nếu kỳ này có sản lượng cần bù, sẽ KHÔNG chốt được cho đến khi khai báo quy chế." }));
    }
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
  // ---------- Bộ lọc báo cáo dùng chung + xuất PDF (Master V5) ----------
  /** Thanh lọc dùng chung: cùng một st.rf cho Tính lương, Bảng tính lương nội bộ, Excel và PDF. */
  function reportFilterBar(allRows, opt) {
    opt = opt || {}; var op = RF.options(allRows), spec = RF.normalize(st.rf), bar = h("div", { class: "bar", "data-rf": "1" });
    var sel = function (label, key, list) {
      var s = h("select", { "data-rf-key": key }); s.appendChild(h("option", { value: "", text: "— " + label + ": tất cả —" }));
      list.forEach(function (x) { s.appendChild(h("option", { value: x, text: x })); });
      s.value = spec[key][0] || ""; s.addEventListener("change", function () { st.rf = Object.assign({}, RF.normalize(st.rf)); st.rf[key] = s.value ? [s.value] : []; render(); });
      return s;
    };
    bar.appendChild(sel("Phòng ban", "phongBan", op.phongBan)); if (!opt.compact) { bar.appendChild(sel("Mã lương", "maLuong", op.maLuong)); bar.appendChild(sel("Thanh toán", "httt", op.httt)); }
    var q = h("input", { class: "i", placeholder: "Tìm mã / tên…", value: spec.tuKhoa, "data-rf-key": "tuKhoa" });
    q.addEventListener("change", function () { st.rf = Object.assign({}, RF.normalize(st.rf), { tuKhoa: q.value }); render(); });
    var cb = h("input", { type: "checkbox" }); cb.checked = spec.chiCoThuNhap; cb.addEventListener("change", function () { st.rf = Object.assign({}, RF.normalize(st.rf), { chiCoThuNhap: cb.checked }); render(); });
    bar.appendChild(q); if (!opt.compact) bar.appendChild(h("label", {}, [cb, document.createTextNode(" chỉ người có thu nhập")]));
    if (!RF.isEmpty(spec)) bar.appendChild(btn("✕ Xóa lọc", "", function () { st.rf = {}; render(); }));
    return bar;
  }
  function pdfFallbackPrint(html) {
    var f = document.createElement("iframe"); f.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px"; document.body.appendChild(f);
    f.srcdoc = html; f.onload = function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast("Không mở được hộp thoại in"); } setTimeout(function () { f.remove(); }, 60000); };
  }
  /** Xuất PDF: bản cài (.exe) → file PDF thật trong thư mục xuất; chạy bằng trình duyệt → hộp thoại In (chọn "Lưu thành PDF"). */
  function exportPdf(vm, fileName, opt) {
    if (!need("export", "xuất PDF")) return;
    var html = RH.table(vm, opt);
    if (!window.hakReport) { pdfFallbackPrint(html); toast("Bản chạy bằng trình duyệt: chọn “Lưu thành PDF” trong hộp thoại In"); return; }
    toast("Đang tạo PDF…");
    window.hakReport.pdf({ html: html, name: fileName, landscape: true, footer: (vm.congTy ? vm.congTy + " · " : "") + vm.title + " · " + vm.ky }).then(function (r) {
      if (r && r.ok) { audit("Xuất PDF", vm.title + " · " + vm.ky + " · " + r.name); toast("Đã lưu PDF: " + r.name + " (" + r.pages + " trang)"); }
      else alert("Không xuất được PDF: " + (r && r.error || "lỗi không rõ"));
    }, function (e) { alert("Không xuất được PDF: " + (e && e.message || e)); });
  }
  /** PDF cho báo cáo dạng nhiều bảng (mảng đối tượng): dùng chung đường xuất với exportPdf. */
  function exportSheetsPdf(vm, fileName, opt) {
    if (!need("export", "xuất PDF")) return;
    vm = Object.assign({ congTy: congTy()["Tên công ty"] || "" }, vm);
    if (!vm.sheets.some(function (x) { return x.rows && x.rows.length; })) { toast("Không có dữ liệu để xuất PDF"); return; }
    var html = RH.sheets(vm, opt || {});
    if (!window.hakReport) { pdfFallbackPrint(html); toast("Bản chạy bằng trình duyệt: chọn “Lưu thành PDF” trong hộp thoại In"); return; }
    toast("Đang tạo PDF…");
    window.hakReport.pdf({ html: html, name: fileName, landscape: true, footer: (vm.congTy ? vm.congTy + " · " : "") + vm.title + " · " + (vm.ky || "") }).then(function (r) {
      if (r && r.ok) { audit("Xuất PDF", vm.title + " · " + (vm.ky || "") + " · " + r.name); toast("Đã lưu PDF: " + r.name + " (" + r.pages + " trang)"); }
      else alert("Không xuất được PDF: " + (r && r.error || "lỗi không rõ"));
    }, function (e) { alert("Không xuất được PDF: " + (e && e.message || e)); });
  }
  function tabBangTinhNoiBo() {
    var w = h("div"), card = h("div", { class: "card" }), src = kqKy(st.nam, st.thang);
    card.appendChild(h("div", { class: "hint", html: (src.chot ? "🔒 Kỳ <b>đã chốt</b>" : "⚠ Kỳ <b>chưa chốt</b> — tính tạm") + " · Chỉ các khoản <b>tính ra thu nhập</b> (không BH, thuế, tạm ứng, thực lĩnh). Cùng một bộ lọc với Tính lương, Excel và PDF." }));
    card.appendChild(reportFilterBar(src.kq.bangluong));
    var vm = IPAY.build(src.kq, { nam: st.nam, thang: st.thang, filter: st.rf, tenCongTy: congTy()["Tên công ty"] || "", chot: src.chot, cheDoBu: src.kq.cheDoBu });
    var tools = h("div", { class: "bar" });
    tools.appendChild(btn("⬇ Xuất PDF", "pri", function () { exportPdf(vm, "BangTinhLuongNoiBo_" + kyStr() + ".pdf", { chuKy: ["Người lập", "Kế toán trưởng", "Giám đốc"] }); }));
    tools.appendChild(btn("⬇ Xuất Excel", "", function () { saveXlsx("BangTinhLuongNoiBo_" + kyStr() + ".xlsx", [{ name: "BangTinhLuongNoiBo", cols: vm.cols.map(function (c) { return c.label; }), rows: IPAY.toRows(vm) }]); }));
    card.appendChild(tools);
    if (vm.kiemTra.lech.length) card.appendChild(h("div", { class: "warn", html: "<b>⚠ " + vm.kiemTra.lech.length + " dòng có tổng các khoản ≠ Tổng thu nhập engine:</b> " + vm.kiemTra.lech.slice(0, 8).map(function (x) { return esc(x.maNV); }).join(", ") }));
    card.appendChild(h("div", { class: "kpis" }, [h("div", { class: "kpi", html: "<small>Số người" + (vm.loc.length ? " (đang lọc)" : "") + "</small><b>" + vm.soDong + (vm.loc.length ? "/" + vm.soDongGoc : "") + "</b>" }), h("div", { class: "kpi main", html: "<small>Tổng thu nhập</small><b>" + fmt(vm.tong["Tổng thu nhập"] || 0) + "</b>" })]));
    var t = h("table", { "data-bangtinh": "1" }), hr = h("tr");
    vm.cols.forEach(function (c, i) { hr.appendChild(h("th", { class: (c.kind === "text" ? "" : "r") + (i === 0 ? " stk" : ""), text: c.label })); });
    t.appendChild(h("thead", {}, [hr])); var tb = h("tbody");
    vm.groups.forEach(function (g) {
      tb.appendChild(h("tr", {}, [h("td", { colspan: vm.cols.length, style: "font-weight:700;background:#eef3ef", text: g.ten + " (" + g.rows.length + " người)" })]));
      g.rows.forEach(function (r) { tb.appendChild(h("tr", {}, vm.cols.map(function (c, i) { var v = r[c.key]; return h("td", { class: (c.kind === "text" ? "t" : "r") + (i === 0 ? " stk" : ""), style: c.strong ? "font-weight:700" : "", text: c.kind === "text" ? (v == null ? "" : v) : (!v ? "–" : fmt(v)) }); }))); });
      tb.appendChild(h("tr", { style: "font-weight:700;background:#f4f4f4" }, vm.cols.map(function (c, i) { return h("td", { class: i < 3 ? "t" : "r", text: i === 1 ? "Cộng " + g.ten : (g.tong[c.key] != null ? fmt(g.tong[c.key]) : "") }); })));
    });
    t.appendChild(tb);
    t.appendChild(h("tfoot", {}, [h("tr", {}, vm.cols.map(function (c, i) { return h("td", { class: i < 3 ? "t" : "r", text: i === 0 ? "TỔNG" : (vm.tong[c.key] != null ? fmt(vm.tong[c.key]) : "") }); }))]));
    if (!vm.soDong) card.appendChild(h("div", { class: "empty", text: "Không có dòng nào khớp bộ lọc." }));
    card.appendChild(h("div", { class: "tw" }, [t])); w.appendChild(card); return w;
  }

  function renderKq(box, card, bar) {
    var rAll = st.kq, rf = RF.apply(rAll.bangluong, st.rf), r = Object.assign({}, rAll, { bangluong: rf.rows }), sum = function (c) { return r.bangluong.reduce(function (a, x) { return a + (+x[c] || 0); }, 0); };
    box.appendChild(h("div", { class: "kpis" }, [
      h("div", { class: "kpi", html: "<small>Số nhân viên</small><b>" + r.bangluong.length + "</b>" }),
      h("div", { class: "kpi", html: "<small>Tổng thu nhập</small><b>" + fmt(sum("Tổng thu nhập")) + "</b>" }),
      h("div", { class: "kpi", html: "<small>Khấu trừ (BH + KPCĐ + thuế)</small><b>" + fmt(sum("BH trừ NLĐ") + sum("KPCĐ trừ NLĐ") + sum("Thuế TNCN") + sum("Truy thu BH")) + "</b>" }),
      h("div", { class: "kpi main", html: "<small>Tổng thực lĩnh</small><b>" + fmt(sum("Thực lĩnh")) + "</b>" })]));
    card.appendChild(reportFilterBar(rAll.bangluong));
    if (!RF.isEmpty(st.rf)) card.appendChild(h("div", { class: "hint", text: "Đang lọc: " + RF.describe(st.rf).join(" · ") + " — " + rf.kept + "/" + rf.total + " dòng (Excel xuất ra cũng theo bộ lọc này)." }));
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
    bar.appendChild(btn("⬇ Xuất PDF…", "", function () {
      var pick = excelSheets(r, r.ky || kyStr()), ds = [["Bảng lương", "bl"], ["BHXH", "bh"], ["Thuế TNCN", "tn"], ["Danh sách chuyển khoản", "ck"]];
      var which = st.pdfPick || "bl"; var o = ds.filter(function (x) { return x[1] === which; })[0] || ds[0], m = pick[o[1]];
      exportSheetsPdf({ title: o[0] + " lương", ky: "Kỳ " + (r.ky || kyStr()), trangThai: (kqKy(st.nam, st.thang).chot ? "Đã chốt" : "Chưa chốt — tính tạm"), loc: RF.describe(st.rf), sheets: [{ name: o[0], cols: o[1] === "bl" ? (st.compact ? COLS_COMPACT : COLS_FULL) : m.cols, rows: m ? m.rows : [] }] }, m.name + "_" + (r.ky || kyStr()) + ".pdf");
    }, "PDF của bảng lương đang xem (theo bộ lọc)"));
    var pm = h("select", { "aria-label": "Loại PDF", style: "min-width:140px" });
    [["Bảng lương", "bl"], ["BHXH", "bh"], ["Thuế TNCN", "tn"], ["Danh sách chuyển khoản", "ck"]].forEach(function (o) { pm.appendChild(h("option", { value: o[1], text: o[0] })); });
    pm.value = st.pdfPick || "bl"; pm.addEventListener("change", function () { st.pdfPick = pm.value; }); bar.appendChild(pm);
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

  var SLIP_LINES = [["Lương thời gian", "Lương thời gian"], ["Lương phụ", "Lương phụ"], ["Lương sản lượng", "Lương sản lượng"], ["Lương bù SL", "Lương bù sản lượng"], ["Lương bơm dăm", "Lương bơm dăm"], ["Tiền tăng ca", "Tiền tăng ca"], ["Phụ cấp", "Phụ cấp"], ["Phụ cấp công tác", "Phụ cấp công tác"], ["Lương hỗ trợ", "Lương hỗ trợ"], ["Tiền cơm", "Tiền cơm"], ["Thưởng", "Thưởng"], ["Thu nhập khác", "Thu nhập khác"], ["Tổng thu nhập", "TỔNG THU NHẬP", 1], ["BH trừ NLĐ", "− BHXH/BHYT/BHTN"], ["KPCĐ trừ NLĐ", "− KPCĐ"], ["Truy thu BH", "− Truy thu bảo hiểm"], ["Thuế TNCN", "− Thuế TNCN"], ["Trừ khác", "− Trừ khác"], ["Tạm ứng", "− Tạm ứng"], ["Thực lĩnh", "THỰC LĨNH", 1]];
  function slipEl(b) {
    var s = h("div", { class: "slip" });
    if (congTy()["Tên công ty"]) s.appendChild(h("div", { text: congTy()["Tên công ty"], style: "font-weight:700;text-transform:uppercase;font-size:13px" }));
    s.appendChild(h("h3", { text: "PHIẾU LƯƠNG THÁNG " + st.thang + "/" + st.nam, style: "text-align:center;margin:4px 0 10px" }));
    s.appendChild(h("div", { class: "head", html: "<b>" + esc(b["Họ và tên"]) + "</b> · Mã NV: " + esc(b["Mã NV"]) + (b["Phòng ban"] ? " · " + esc(b["Phòng ban"]) : "") + "<br><span style='color:#6c7a74'>Tổng công: " + b["Tổng công"] + " / Công chuẩn: " + b["Công chuẩn"] + (b["Sản lượng (tấn)"] ? " · Sản lượng: " + b["Sản lượng (tấn)"] + " tấn" : "") + "</span>" }));
    var t = h("table");
    SLIP_LINES.forEach(function (l) { if (b[l[0]] || l[2]) t.appendChild(h("tr", { class: l[2] ? "tot" : "", html: "<td>" + l[1] + "</td><td>" + fmt(b[l[0]]) + "</td>" })); });
    s.appendChild(t); return s;
  }
  /**
   * Master Prompt V3 mục 16.3 ("Xem chi tiết cách tính"): từng chỉ tiêu hiện công thức + giá trị đã
   * thế vào. Đọc từ b["_ct"] (biến trung gian engine.js đã chụp lại khi tính lương) + các cột tiền đã
   * có sẵn trên b — KHÔNG tính lại, chỉ diễn giải.
   */
  var PP_THUE = { VL: "Khấu trừ vãng lai (10% tổng thu nhập, hoặc mức riêng trong danh mục)", LT: "Lũy tiến theo biểu thuế hiệu lực", MIEN: "Miễn / tạm không trừ thuế" };
  function ctRow(tc, congThuc, giaTri, ketQua, bold) {
    return h("tr", { style: bold ? "font-weight:700" : "" }, [
      h("td", { text: tc }), h("td", { style: "color:#6c7a74;font-size:12px", text: congThuc || "" }),
      h("td", { style: "color:#6c7a74", text: giaTri == null ? "" : String(giaTri) }), h("td", { class: "r", text: ketQua == null ? "" : fmt(ketQua) })
    ]);
  }
  function ctSection(ten) { return h("tr", {}, [h("td", { colspan: 4, text: ten, style: "font-weight:700;padding-top:10px;border-bottom:1px solid #d3dcc7" })]); }
  function cachTinhEl(b) {
    var c = b["_ct"] || {}, box = h("div", { class: "slip" }), t = h("table");
    t.appendChild(h("tr", {}, [h("th", { text: "Chỉ tiêu" }), h("th", { text: "Công thức" }), h("th", { text: "Giá trị đã thế" }), h("th", { class: "r", text: "Kết quả" })]));
    t.appendChild(ctSection("1. Lương thời gian"));
    t.appendChild(ctRow("Mã lương", "", c.maLuong + (c.hinhThucLuong ? " (" + c.hinhThucLuong + ")" : "")));
    t.appendChild(ctRow("Công chuẩn", "theo \"Cách tính\" của mã lương trong danh mục", c.congChuan + " công", c.congChuan));
    t.appendChild(ctRow("Công BT", "tổng công hình thức BT trong chấm công kỳ này", c.congBT + " công", c.congBT));
    var ctTG = c.maLuong === "CĐ" ? "= Lương thỏa thuận (cố định)" : (c.maLuong === "CN1" || c.maLuong === "CN2" || c.maLuong === "SP") ? "Lương thỏa thuận × Công tính TG" : "Đơn giá TG × Công tính TG";
    if (c.maLuong !== "CĐ") t.appendChild(ctRow("Đơn giá TG", "Lương thỏa thuận ÷ Công chuẩn", fmt(b["Lương thỏa thuận"]) + " ÷ " + c.congChuan, c.donGiaTG));
    t.appendChild(ctRow("Công tính TG", c.maLuong === "SP" ? "(xem Danh mục lương, cột \"Loại công thức\" — lễ+phép hoặc lễ+tăng ca)" : "công đi làm trong kỳ, đã trừ phần tính riêng (nếu có)", c.congTinhTG + " công", c.congTinhTG));
    t.appendChild(ctRow("Lương thời gian", ctTG, "", b["Lương thời gian"], true));
    if (c.maTangCa) {
      t.appendChild(ctSection("2. Tăng ca"));
      t.appendChild(ctRow("Mã tăng ca", "", c.maTangCa + (c.loaiCongThucTangCa && c.loaiCongThucTangCa !== c.maTangCa ? " (dùng công thức " + c.loaiCongThucTangCa + ")" : "")));
      t.appendChild(ctRow("Hệ số tăng ca", "theo Danh mục tăng ca", Math.round(c.heSoTangCa * 1000) / 10 + "%"));
      if (c.congChuan2) t.appendChild(ctRow("Công chuẩn 2", "chấm công có nhãn \"DQ\" → dùng thay Công chuẩn khi tính vượt chuẩn", c.congChuan2 + " công", c.congChuan2));
      t.appendChild(ctRow("Công tăng ca (thô)", "tổng công hình thức TC trong chấm công", b["Công tăng ca"] + " công", b["Công tăng ca"]));
      t.appendChild(ctRow("Công tăng ca quy đổi", "đã qua công thức " + (c.loaiCongThucTangCa || c.maTangCa) + " + hệ số " + Math.round(c.heSoTangCa * 1000) / 10 + "%", c.congTangCaQuyDoi + " công", c.congTangCaQuyDoi));
      t.appendChild(ctRow("Tiền tăng ca", "Đơn giá (TG hoặc Lương thỏa thuận) × Công tăng ca quy đổi", "", b["Tiền tăng ca"], true));
    }
    if (c.laSanLuong) {
      t.appendChild(ctSection("3. Sản lượng & bù lương"));
      t.appendChild(ctRow("Sản lượng", "tổng khối lượng đã phân bổ cho người này trong kỳ", b["Sản lượng (tấn)"] + " tấn", b["Sản lượng (tấn)"]));
      t.appendChild(ctRow("Đơn giá khoán", "theo Danh mục lương (\"Số tiền khoán\")", fmt(c.donGiaKhoan) + " đ/tấn", c.donGiaKhoan));
      t.appendChild(ctRow("Lương sản lượng", "Sản lượng × Đơn giá khoán", b["Sản lượng (tấn)"] + " × " + fmt(c.donGiaKhoan), b["Lương sản lượng"], true));
      if (c.phuongPhapBu) {
        var ppbTen = c.phuongPhapBu === "daihiep" ? "theo ngày bậc thang (Đại Hiệp)" : c.phuongPhapBu === "to" ? "bình quân tổ (HAK)" : c.phuongPhapBu === "ngay" ? "theo ngày (liên tục)" : "theo tháng";
        t.appendChild(ctRow("Phương pháp bù", "", ppbTen));
        t.appendChild(ctRow("Mức bù (DM_LUONG)", "\"Đơn giá bù lương\" trong Danh mục lương", fmt(c.mucBuDmLuong) + " đ", c.mucBuDmLuong));
        if (c.binhQuanTo != null) t.appendChild(ctRow("Bình quân tổ", "tổng tiền sản lượng cả tổ ÷ số ngày tháng ÷ số người tổ", fmt(c.binhQuanTo) + " đ/người/ngày", c.binhQuanTo));
        if (c.phuongPhapBu === "daihiep") t.appendChild(ctRow("SL tham chiếu", "theo bậc thang công BT TỪNG NGÀY — xem sheet \"Bu luong theo ngay - DH\" trong file Excel Phân bổ khối lượng để xem chi tiết từng ngày", "", null));
        t.appendChild(ctRow("Tiền bù", "", "", b["Lương bù SL"], true));
      }
    }
    if (c.maPhuCap) {
      t.appendChild(ctSection("4. Phụ cấp"));
      t.appendChild(ctRow("Mã phụ cấp", "theo Danh mục phụ cấp, cột \"Loại công thức\"", c.maPhuCap + " (" + c.loaiCongThucPhuCap + ")"));
      t.appendChild(ctRow("Phụ cấp", "", "", b["Phụ cấp"], true));
    }
    t.appendChild(ctSection("5. Thuế & bảo hiểm"));
    if (c.maThueTNCN) {
      t.appendChild(ctRow("Mã thuế TNCN", "", c.maThueTNCN + " — " + (PP_THUE[c.phuongPhapThue] || c.phuongPhapThue)));
      t.appendChild(ctRow("Thu nhập tính thuế", "Tổng thu nhập − BH NLĐ − KPCĐ NLĐ − Tiền cơm − giảm trừ bản thân/người phụ thuộc (nếu lũy tiến)", fmt(c.thuNhapTinhThue) + " đ", c.thuNhapTinhThue));
    }
    t.appendChild(ctRow("Thuế TNCN", "", "", b["Thuế TNCN"], true));
    t.appendChild(ctRow("BH trừ NLĐ", "theo Danh mục bảo hiểm, tỷ lệ NLĐ đóng", "", b["BH trừ NLĐ"], true));
    t.appendChild(ctSection("6. Thực lĩnh"));
    t.appendChild(ctRow("Tổng thu nhập", "cộng mọi khoản thu nhập (lương TG + tăng ca + SL + bù + phụ cấp + hỗ trợ + cơm + thưởng + khác)", "", b["Tổng thu nhập"]));
    var giamTru = (b["BH trừ NLĐ"] || 0) + (b["KPCĐ trừ NLĐ"] || 0) + (b["Thuế TNCN"] || 0) + (b["Trừ khác"] || 0) + (b["Tạm ứng"] || 0);
    t.appendChild(ctRow("Tổng giảm trừ", "BH + KPCĐ + Thuế TNCN + Trừ khác + Tạm ứng", "", giamTru));
    t.appendChild(ctRow("Thực lĩnh", "Tổng thu nhập − Tổng giảm trừ, làm tròn 1.000đ", "", b["Thực lĩnh"], true));
    box.appendChild(t);
    box.appendChild(h("div", { class: "hint", style: "margin-top:8px", text: "Số liệu lấy đúng từ bảng lương đã tính của kỳ này — không tính lại. Đối chiếu công thức gốc: menu Hướng dẫn & Quy chế lương." }));
    return box;
  }
  function slipDialog(b) {
    var xemCT = false;
    var render2 = function () {
      return modal((xemCT ? "Chi tiết cách tính — " : "Chi tiết lương — ") + b["Họ và tên"], xemCT ? cachTinhEl(b) : slipEl(b), function (close) {
        return [btn("Đóng", "", close), btn(xemCT ? "🧾 Xem phiếu lương" : "📐 Xem cách tính", "", function () { xemCT = !xemCT; render2(); }),
          btn("🖨 In phiếu này", "pri", function () { var one = st.kq; st.kq = { bangluong: [b], ky: one.ky, bhxh: [], tncn: [], canhbao: [] }; st.tab = "slips"; st.kqFull = one; close(); render(); })];
      });
    };
    render2();
  }
  /**
   * Phiếu lương (α18): màn hình riêng trong menu. Kỳ đã chốt → lấy đúng bảng lương đã chốt; chưa chốt → tính tạm (báo rõ).
   * Lọc phòng ban / tìm người, in (mỗi phiếu 1 trang hoặc in gọn nhiều phiếu / trang), xuất Excel. Mở từ Tính lương (1 phiếu) vẫn như cũ.
   */
  function tabSlips() {
    var w = h("div"), bar = h("div", { class: "bar" });
    var single = !!st.kqFull, fresh = st.kq && st.kq.ky === kyStr() && !st.kqStale && !kyChot(kyStr());
    var src = single ? { kq: st.kq, chot: !!kyChot(kyStr()) } : fresh ? { kq: st.kq, chot: false } : kqKy(st.nam, st.thang); // vừa tính ở Tính lương → dùng đúng kết quả đó
    var all = (src.kq && src.kq.bangluong) || [];
    if (single) bar.appendChild(btn("← Quay lại bảng lương", "", function () { st.kq = st.kqFull; st.kqFull = null; st.tab = "luong"; render(); }));
    var pbs = []; all.forEach(function (b) { if (b["Phòng ban"] && pbs.indexOf(b["Phòng ban"]) < 0) pbs.push(b["Phòng ban"]); });
    var selPB = h("select", { "aria-label": "Phòng ban" }); selPB.appendChild(h("option", { value: "", text: "Tất cả phòng ban" }));
    pbs.sort().forEach(function (p) { selPB.appendChild(h("option", { value: p, text: p })); });
    selPB.value = st.slipPB || ""; selPB.addEventListener("change", function () { st.slipPB = selPB.value; render(); });
    var q = h("input", { class: "i", type: "search", placeholder: "Tìm mã / tên nhân viên…", value: st.slipQ || "", style: "width:220px" });
    q.addEventListener("change", function () { st.slipQ = q.value; render(); });
    var gon = h("input", { type: "checkbox" }); gon.checked = !!st.slipGon; gon.addEventListener("change", function () { st.slipGon = gon.checked; render(); });
    var qq = fold(st.slipQ || "").trim();
    var list = all.filter(function (b) { return (single || !st.slipPB || b["Phòng ban"] === st.slipPB) && (single || !qq || fold(b["Mã NV"] + " " + b["Họ và tên"]).indexOf(qq) >= 0); });
    if (!single) { bar.appendChild(selPB); bar.appendChild(q); }
    bar.appendChild(h("label", { class: "chk", title: "Bỏ ngắt trang sau mỗi phiếu — in nhiều phiếu trên 1 tờ A4 rồi cắt" }, [gon, " In gọn (nhiều phiếu / trang)"]));
    bar.appendChild(h("span", { class: "sp" }));
    bar.appendChild(btn("⬇ Xuất Excel", "", function () {
      if (!list.length) { toast("Không có phiếu nào"); return; }
      var cols = ["Mã NV", "Họ và tên", "Phòng ban", "Tổng công", "Công chuẩn"].concat(SLIP_LINES.map(function (l) { return l[0]; }));
      saveXlsx("PhieuLuong_" + kyStr() + (st.slipPB && !single ? "_" + slug(st.slipPB) : "") + ".xlsx", [{ name: "PhieuLuong_" + kyStr(), cols: cols, rows: list.map(function (b) { var o = {}; cols.forEach(function (c) { o[c] = b[c] == null ? "" : b[c]; }); return o; }) }]);
      audit("Xuất phiếu lương Excel", kyLabel(kyStr()) + " · " + list.length + " phiếu");
    }));
    bar.appendChild(btn("⬇ PDF", "", function () {
      if (!list.length) { toast("Không có phiếu nào"); return; }
      var colsP = ["Mã NV", "Họ và tên", "Phòng ban", "Tổng công", "Công chuẩn"].concat(SLIP_LINES.map(function (l) { return l[0]; }));
      exportSheetsPdf({ title: "Phiếu lương", ky: "Kỳ " + st.thang + "/" + st.nam, trangThai: src.chot ? "Đã chốt" : "Chưa chốt — tính tạm", loc: st.slipPB ? ["Phòng ban: " + st.slipPB] : [], sheets: [{ name: "PhieuLuong", rows: list.map(function (b) { var o = {}; colsP.forEach(function (c) { o[c] = b[c] == null ? "" : b[c]; }); return o; }) }] }, "PhieuLuong_" + kyStr() + (st.slipPB && !single ? "_" + slug(st.slipPB) : "") + ".pdf");
    }, "PDF danh sách phiếu theo đúng bộ lọc đang chọn"));
    bar.appendChild(btn("🖨 In " + list.length + " phiếu", "pri", function () { if (!list.length) { toast("Không có phiếu nào"); return; } audit("In phiếu lương", kyLabel(kyStr()) + " · " + list.length + " phiếu"); window.print(); }));
    w.appendChild(bar);
    if (!single) w.appendChild(h("div", { class: src.chot ? "locked noprint" : "warn noprint", html: src.chot ? "🔒 Phiếu lương <b>tháng " + st.thang + "/" + st.nam + "</b> lấy từ bảng lương <b>đã chốt</b>." : "⚠ Tháng " + st.thang + "/" + st.nam + " <b>chưa chốt</b> — phiếu tính tạm từ dữ liệu hiện tại, có thể thay đổi. Nên chốt kỳ trước khi gửi phiếu cho người lao động." }));
    if (!all.length) { w.appendChild(h("div", { class: "card" }, [h("div", { class: "empty", text: "Chưa có bảng lương tháng " + st.thang + "/" + st.nam + " (chưa có nhân viên / chấm công)." })])); return w; }
    var box = h("div", { class: "slips" + (st.slipGon ? " gon" : ""), "data-slips": String(list.length) });
    if (!list.length) box.appendChild(h("div", { class: "card" }, [h("div", { class: "empty", text: "Không có phiếu nào khớp bộ lọc." })]));
    list.forEach(function (b) { var c = h("div", { class: "card" }); c.appendChild(slipEl(b)); box.appendChild(c); });
    w.appendChild(box);
    return w;
  }

  // ---------- Đọc ảnh bảng chấm công / chấm cơm (OCR offline, 2.0-α20) ----------
  // Ảnh / PDF → tìm ô (core/table-grid) → Tesseract ở tiến trình chính (window.hakOcr) → bảng xem trước SỬA ĐƯỢC
  // → Xuất Excel, hoặc đưa vào Chấm công / Suất cơm qua màn hình xem trước nhập Excel (khóa kỳ chốt, quyền, sao lưu như nhập Excel).
  var OCRS = { pages: [], more: [], sel: 0, busy: false, reading: false, stop: false, mode: "so" }; // reading: đang chạy hàng đợi đọc; stop: người dùng bấm Dừng đọc
  // Cách đọc ô ngày (α22, chủ sở hữu duyệt): số công viết tay · dấu x = 1 công (xx = 2, xxx = 3), ô ghi giờ = giờ / 8 · lịch ca: 1 ca = 1 công, "1+2" = 2 công
  var OCR_MODES = [["so", "Số công (1, 0,5…)"], ["mark", "Dấu x (x = 1 công) · giờ / 8"], ["ca", "Số ca (1 ca = 1 công, 1+2 = 2)"]];
  var OCR_KIND = [["Công", "Chấm công — BT"], ["Tăng ca", "Chấm công — TC"], ["Cơm", "Suất cơm"], ["", "(bỏ qua dòng)"]];
  function loadScript(src) { return new Promise(function (ok, bad) { if (document.querySelector('script[src="' + src + '"]')) return ok(); var sc = document.createElement("script"); sc.src = src; sc.onload = ok; sc.onerror = function () { bad(new Error("Không nạp được " + src)); }; document.head.appendChild(sc); }); }
  function canvasOf(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  var OCR_CHUNK = 30; // số trang PDF dựng ảnh mỗi lượt (giữ bộ nhớ ổn định); phần còn lại đọc tiếp bằng nút "Đọc tiếp" — KHÔNG bỏ trang nào
  function renderPdfPages(src) {
    var pdf = src.pdf, end = Math.min(pdf.numPages, src.next + OCR_CHUNK - 1), out = [], chainP = Promise.resolve();
    for (var i = src.next; i <= end; i++) (function (i) {
      chainP = chainP.then(function () { return OCRS.stop ? null : pdf.getPage(i); }).then(function (pg) {
        if (!pg) return; // đã bấm Dừng đọc
        var v0 = pg.getViewport({ scale: 1 }), sc = Math.min(4, 2400 / Math.max(v0.width, v0.height)), vp = pg.getViewport({ scale: sc }), cv = canvasOf(Math.round(vp.width), Math.round(vp.height));
        var cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
        return pg.render({ canvasContext: cx, viewport: vp }).promise.then(function () {
          // lớp chữ của PDF (nếu có): đổi sang toạ độ ảnh trang để dựng bảng không cần OCR
          return (pg.getTextContent ? pg.getTextContent().then(function (tc) { return tc.items.filter(function (it) { return it.str && it.transform; }).map(function (it) { return C.pdfText.toRect(it, vp.transform); }); }, function () { return null; }) : Promise.resolve(null)).then(function (ti) {
            out.push({ name: src.file.name + " — trang " + i, canvas: cv, docId: src.docId || "", trang: i, textItems: ti, pdfScale: sc }); src.next = i + 1;
          });
        });
      });
    })(i);
    return chainP.then(function () {
      if (src.next <= pdf.numPages && !OCRS.stop) OCRS.more.push(src); // còn trang chưa dựng → chờ "Đọc tiếp"
      return out;
    });
  }
  function fileToPages(file, docId) {
    var name = file.name;
    if (/\.pdf$/i.test(name) || file.type === "application/pdf") {
      return loadScript("vendor/pdfjs/pdf.min.js").then(function () {
        var lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.js";
        return file.arrayBuffer().then(function (buf) { return lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true }).promise; });
      }).then(function (pdf) { return renderPdfPages({ file: file, pdf: pdf, next: 1, docId: docId }); });
    }
    return window.createImageBitmap(file).then(function (bm) { var cv = canvasOf(bm.width, bm.height); cv.getContext("2d").drawImage(bm, 0, 0); return [{ name: name, canvas: cv, docId: docId || "", trang: 1 }]; });
  }
  /** Lưu NGUYÊN BẢN file vào kho chứng từ (SHA-256, không xóa) và ghi siêu dữ liệu vào db.chungtu. Lỗi lưu → báo, KHÔNG chặn đọc OCR. */
  function archiveOriginal(file) {
    if (!window.hakDocs) return Promise.resolve("");
    return file.arrayBuffer().then(function (buf) { return window.hakDocs.add(new Uint8Array(buf), { name: file.name, user: currentUser(), note: "OCR chấm công kỳ " + kyStr(), ky: kyStr(), company: congTy()["Mã công ty"] || "HAK", docType: "BANGCONG", dept: "ALL" }); }).then(function (r) {
      if (!r || !r.ok) { toast("Chưa lưu được bản gốc " + file.name + ": " + ((r && r.error) || "lỗi không rõ")); return ""; }
      if (!db.chungtu.some(function (c) { return c.id === r.id; })) {
        db.chungtu.push({ id: r.id, sha256: r.sha256, name: file.name, size: r.size, addedAt: new Date().toISOString(), addedBy: currentUser(), nguon: "OCR", ky: kyStr() });
        audit("Lưu chứng từ gốc", r.id + " · " + file.name + " · SHA-256 " + r.sha256.slice(0, 12) + "…"); save();
      } else if (r.duplicate) toast("File " + file.name + " đã có trong kho chứng từ (" + r.id + ") — dùng lại bản đã lưu");
      return r.id;
    }, function (e) { toast("Chưa lưu được bản gốc: " + e.message); return ""; });
  }
  function grayOf(cv) { var d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height); return { g: C.grid.toGray(d.data, cv.width, cv.height), w: cv.width, h: cv.height }; }
  function grayCanvas(g, w, h) { var cv = canvasOf(w, h), cx = cv.getContext("2d"), im = cx.createImageData(w, h); for (var i = 0, j = 0; i < g.length; i++, j += 4) { im.data[j] = im.data[j + 1] = im.data[j + 2] = g[i]; im.data[j + 3] = 255; } cx.putImageData(im, 0, 0); return cv; }
  function nvChoices() { return db.nhanvien.filter(function (n) { return n["Trạng thái"] !== "Đã nghỉ việc"; }).concat(db.nhanvien.filter(function (n) { return n["Trạng thái"] === "Đã nghỉ việc"; })).map(function (n) { return { ma: n["Mã NV"], ten: n["Họ và tên"] || "" }; }); }
  function titleName(title) { var t = (title || []).filter(function (x) { return /lịch|lich/i.test(C.tsparse.fold(x)); })[0] || ""; return t.replace(/^.*?(lịch làm|lich lam)\s*/i, "").trim(); }
  // Tự học từ chỉnh sửa (V7): mỗi ô OCR người dùng sửa tự ghi 1 mẫu "chờ duyệt"; duyệt khi ghi bảng vào Chấm công
  var OCRL = null;
  function ocrLearn() { if (!OCRL && window.hakOcrLib && C.ocrLearn) OCRL = C.ocrLearn.createService({ api: window.hakOcrLib, user: function () { return session ? session.tenDangNhap : currentUser(); }, cfg: function () { return { saveConfirmed: !!congTy()["OCR lưu mẫu xác nhận"] }; }, ocrVersion: "tsocr-v7" }); return OCRL; }
  /** Tra cứu thư viện mẫu cho các ô số: AUTO_ACCEPT → dùng nhãn thư viện (ghi rõ nguồn); SUGGESTED → đánh dấu "không chắc" + gợi ý; còn lại giữ nguyên kết quả OCR. */
  function libEnrich(lr, res, pg) {
    if (pg.mode && pg.mode !== "so") return Promise.resolve();
    var items = [], refs = {};
    ((res.table && res.table.lines) || []).forEach(function (l, li) { Object.keys(l.cells || {}).forEach(function (d) { if (!/^\d+$/.test(d)) return; var c = l.cells[d]; if (c && c.ink && c.bb) { var k = li + "|" + d; items.push({ cell: c, key: k }); refs[k] = { l: l, d: d, c: c }; } }); });
    return lr.lookupCells(res, items, "so").then(function (m) {
      Object.keys(m).forEach(function (k) {
        var r = m[k], x = refs[k]; if (!r || !x) return;
        if (r.status === "AUTO_ACCEPT") { var n = parseFloat(String(r.label).replace(",", ".")); if (isFinite(n)) { if (x.l.values[x.d] !== n) x.c.libFrom = x.l.values[x.d]; x.l.values[x.d] = n; x.c.valSrc = "thư viện mẫu"; x.c.libStatus = "AUTO"; x.c.libScore = r.score; x.c.unsure = false; } }
        else if (r.status === "SUGGESTED") { x.c.libStatus = "SUG"; x.c.libLabel = r.label; x.c.libScore = r.score; if (String(x.l.values[x.d]) !== String(r.label).replace(",", ".")) x.c.unsure = true; }
      });
    });
  }
  /** So khớp bố cục bảng với thư viện bố cục: MISMATCH → không tự nhận ô bằng thư viện và không học từ trang này (trừ khi người dùng xác nhận bố cục mới) */
  function layoutCheck(res, pg) {
    pg.layoutSig = C.ocrLayout && window.hakOcrLib && window.hakOcrLib.layoutMatch ? C.ocrLayout.signature(res) : null; pg.layoutStatus = ""; pg.layoutInfo = "";
    if (!pg.layoutSig) return Promise.resolve();
    return window.hakOcrLib.layoutMatch(pg.layoutSig).then(function (r) { if (r && r.ok && r.match) { pg.layoutStatus = r.match.status; pg.layoutId = r.match.id; pg.layoutInfo = r.match.reason || (r.match.status === "MATCH" ? "khớp bố cục \"" + r.match.name + "\" (" + Math.round(r.match.score * 100) + "%)" : ""); } }, function () {});
  }
  function analyzePage(pg, rot) {
    pg.status = "Đang đọc…"; pg.err = ""; pg.stopped = false; OCRS.busy = true; render();
    var t0 = Date.now();
    var onErr = function (e) { if (e === OCR_STOP) { markStopped(pg); return; } pg.status = "Lỗi"; pg.err = String(e && e.message || e); }, onDone = function () { OCRS.busy = false; render(); };
    var gimg = grayOf(pg.canvas), tx = pg.textItems && !pg.noText && C.pdfText ? C.pdfText.analyze(pg.textItems, { w: gimg.w, h: gimg.h }) : null;
    pg.srcKind = tx && tx.usable ? "pdf-text" : "ocr"; pg.srcNote = tx && !tx.usable && pg.textItems && pg.textItems.length ? tx.reason : "";
    if (tx && tx.usable) { // chữ lấy thẳng từ PDF: chính xác tuyệt đối, bỏ qua OCR ảnh
      var resT = { rot: 0, scale: pg.pdfScale || 1, g: gimg.g, clean: gimg.g, w: gimg.w, h: gimg.h, cells: tx.cells, table: tx.table, title: tx.title, period: tx.period || (tx.table && tx.table.period) || "", box: tx.box, cellMode: pg.mode || "so", textLayer: true };
      return Promise.resolve(resT).then(function (res) { return layoutCheck(res, pg).then(function () { return res; }); }).then(function (res) { return finishPage(pg, res, t0); }).then(null, onErr).then(onDone);
    }
    return C.tsocr.analyze(gimg, { ocr: function (items) { return OCRS.stop ? Promise.reject(OCR_STOP) : window.hakOcr.batch(items); } }, { rotate: rot, cellMode: pg.mode || "so", onProgress: function (m) { pg.status = m; var el = $("#ocr-status"); if (el) el.textContent = m; } }).then(function (res) { return layoutCheck(res, pg).then(function () { return res; }); }).then(function (res) { var lr = ocrLearn(); return lr && pg.layoutStatus !== "MISMATCH" ? libEnrich(lr, res, pg).then(function () { return res; }, function () { return res; }) : res; }).then(function (res) { return finishPage(pg, res, t0); }, onErr).then(onDone);
  }
  function finishPage(pg, res, t0) {
      pg.res = res; pg.rot = res.rot; pg.view = grayCanvas(res.g, res.w, res.h); pg.ms = Date.now() - t0; pg.runId = "RUN-" + t0.toString(36); pg.page = pg.trang || 1; pg.layoutSuspect = !res.table || !res.table.layout;
      var T = res.table, list = nvChoices(), nm0 = T.layout === "B" ? titleName(res.title) : "";
      pg.lines = (T.lines || []).map(function (l) {
        var nm = l.name || nm0, sug = C.tsparse.matchName(nm, list);
        // bảng dọc: tiêu đề cột viết tay không đọc được nhưng cột có ≥ 5 ô có số (cách đọc dấu x / số ca) → coi là cột chấm công của 1 người
        var nNum = Object.keys(l.values).filter(function (d) { return typeof l.values[d] === "number" && l.values[d] > 0; }).length;
        var kind = T.layout === "B" ? l.kind || (!l.skip && pg.mode && pg.mode !== "so" && nNum >= 5 ? "Công" : "") : (l.kind || "Công");
        var vals = {}; T.days.forEach(function (d) { var v = l.values[d]; vals[d] = v == null ? "" : (typeof v === "number" && isFinite(v) ? String(v).replace(".", ",") : "?"); });
        return { src: l, name: nm, ma: sug[0] && sug[0].score >= 0.6 ? sug[0].ma : "", sug: sug.slice(0, 5), kind: kind, vals: vals, orig: Object.assign({}, vals) };
      });
      pg.days = T.days.slice(); pg.ky = pg.ky || res.period || kyStr();
      pg.status = T.layout ? "Đã đọc " + pg.lines.length + " dòng · " + Math.round(pg.ms / 1000) + " giây" : "Không dựng được bảng";
      if (window.console && res.table.warnings && res.table.warnings.length) console.info("OCR:", res.table.warnings.join(" | "));
  }
  var OCR_STOP = { stop: true };
  function markStopped(pg) { pg.stopped = true; pg.status = "Đã dừng — bấm Đọc lại để đọc trang này"; }
  /** Đọc lần lượt các trang chưa đọc; bấm Dừng đọc → trang đang đọc dừng sau lô ô hiện tại, các trang sau không đọc */
  function readQueue(single) {
    OCRS.stop = false; OCRS.reading = true; render();
    var todo = single ? [single.pg] : OCRS.pages.filter(function (p) { return !p.res && !p.err && !p.stopped; });
    return todo.reduce(function (p, pg) { return p.then(function () { if (OCRS.stop) { markStopped(pg); return; } return analyzePage(pg, single ? single.rot : undefined); }); }, Promise.resolve())
      // ⚠ "st" ĐÃ ĐỔI TÊN (trước là "var st = OCRS.stop;") — "st" là biến trạng thái
      // render TOÀN CỤC của module (khai báo đầu file: "var st = { tab: ... }").
      // Tên trùng che khuất biến toàn cục trong scope này — chưa gây lỗi vì không
      // ai đọc "st" (toàn cục) ở đây, nhưng là cái bẫy cho người sửa code sau.
      .then(function () { var wasStop = OCRS.stop; OCRS.reading = false; OCRS.stop = false; render(); if (wasStop) toast("Đã dừng đọc — trang đã đọc xong vẫn giữ nguyên"); });
  }
  function ocrNum(v) { var s0 = String(v == null ? "" : v).trim(); if (!s0) return null; var n = +s0.replace(",", "."); return isFinite(n) ? n : NaN; }
  function lineSum(L, days) { var s0 = 0, bad = 0; days.forEach(function (d) { var n = ocrNum(L.vals[d]); if (n == null) return; if (isNaN(n)) bad++; else s0 += n; }); return { sum: Math.round(s0 * 100) / 100, bad: bad }; }
  /** Dòng dữ liệu sẵn sàng ghi: { chamcong: [...], tiencom: [...], skip: [...] } */
  function ocrRows(pages) {
    var cc = [], tc = [], skip = [];
    pages.forEach(function (pg) {
      (pg.lines || []).forEach(function (L) {
        if (!L.kind) return;
        if (!L.ma) { skip.push(pg.name + ": " + (L.name || "(không tên)") + " — chưa chọn nhân viên"); return; }
        var bad = pg.days.filter(function (d) { var n = ocrNum(L.vals[d]); return n !== null && (isNaN(n) || n < 0); });
        if (bad.length) { skip.push(pg.name + ": " + (L.name || L.ma) + " — ô ngày " + bad.join(", ") + " chưa sửa (dấu ?)"); return; }
        var ky = pg.ky || kyStr();
        if (L.kind === "Cơm") pg.days.forEach(function (d) { var n = ocrNum(L.vals[d]); if (n) tc.push({ "Ngày": ky + "-" + ("0" + d).slice(-2), "Mã NV": L.ma, "Số suất cơm": n, "Ghi chú": "OCR: " + pg.name }); });
        else {
          var row = { "Kỳ": ky, "Mã NV": L.ma, "Hình thức công": L.kind === "Tăng ca" ? "TC" : "BT" }, any = false;
          pg.days.forEach(function (d) { var n = ocrNum(L.vals[d]); if (n != null) { row[("0" + d).slice(-2)] = String(n).replace(".", ","); any = true; } });
          if (any) cc.push(row);
        }
      });
    });
    return { chamcong: cc, tiencom: tc, skip: skip };
  }
  function ocrApply(pages) {
    if (!need("input.edit", "ghi chấm công / suất cơm")) return;
    var rr = ocrRows(pages);
    if (!rr.chamcong.length && !rr.tiencom.length) { alert("Chưa có dòng nào ghi được." + (rr.skip.length ? "\n\n" + rr.skip.join("\n") : "")); return; }
    if (rr.skip.length && !confirm("Các dòng sau CHƯA ghi được (sửa xong bấm lại):\n" + rr.skip.join("\n") + "\n\nVẫn ghi các dòng còn lại?")) return;
    importPreview(function (mode) {
      var pl = [];
      if (rr.chamcong.length) { var p1 = IMP.plan(db, "chamcong", ALL.chamcong.cols, rr.chamcong, { lockedPeriods: lockedMap(), defaultKy: kyStr(), mode: mode }); p1.sheet = "Ảnh chấm công"; pl.push(p1); }
      if (rr.tiencom.length) { var p2 = IMP.plan(db, "tiencom", ALL.tiencom.cols, rr.tiencom, { lockedPeriods: lockedMap(), defaultKy: kyStr(), mode: mode }); p2.sheet = "Ảnh chấm cơm"; pl.push(p2); }
      return pl;
    }, "OCR " + pages.map(function (p) { return p.name + (p.docId ? " [" + p.docId + "]" : ""); }).join(", "), function (ok) { if (ok && window.hakOcrLib && window.hakOcrLib.layoutSave) pages.forEach(function (p) { if (p.layoutSig && p.layoutStatus !== "MISMATCH" && !p.layoutSuspect) window.hakOcrLib.layoutSave(p.layoutSig, "", session ? session.tenDangNhap : ""); }); var lr = ok && ocrLearn(); if (lr) lr.approvePages(pages.map(function (p) { return { docId: p.docId, page: p.trang || 1 }; })).then(function (r) { if (r && r.verified) toast("Thư viện mẫu OCR: " + r.verified + " mẫu đã được xác nhận" + (r.conflict ? " · " + r.conflict + " mẫu xung đột cần xem" : "")); }); render(); });
  }
  function ocrExport(pages) {
    var sheets = pages.filter(function (p) { return p.lines && p.lines.length; }).map(function (pg, i) {
      var nm = {}; db.nhanvien.forEach(function (n) { nm[n["Mã NV"]] = n["Họ và tên"]; });
      var rows = pg.lines.map(function (L) {
        var o = { "Tên trên giấy": L.name, "Mã NV": L.ma, "Họ tên (app)": nm[L.ma] || "", "Loại": L.kind || "(bỏ qua)" }, ls = lineSum(L, pg.days);
        pg.days.forEach(function (d) { o[String(d)] = ocrNum(L.vals[d]) == null ? "" : (isNaN(ocrNum(L.vals[d])) ? "?" : ocrNum(L.vals[d])); });
        o["Tổng tính"] = ls.sum; Object.keys(L.src.totals || {}).forEach(function (k) { o["Tổng trên giấy (" + k + ")"] = L.src.totals[k] == null || isNaN(L.src.totals[k]) ? "" : L.src.totals[k]; });
        o["Ô chưa đọc được"] = ls.bad; return o;
      });
      var cols = []; rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
      return { name: ("T" + (i + 1) + " " + pg.name).replace(/[\\/?*[\]:]/g, " ").slice(0, 31), cols: cols, rows: rows };
    });
    if (!sheets.length) { toast("Chưa có trang nào đọc xong"); return; }
    saveXlsx("OCR_ChamCong_" + kyStr() + ".xlsx", sheets);
  }
  function modeSel(v, label, onCh) {
    var s0 = h("select", { "aria-label": label, title: "Số công: ô ghi 1 / 0,5 · Dấu x: x = 1 công, xx = 2, xxx = 3, ô ghi giờ (7h→15h) = giờ / 8 · Số ca: 1 ca = 1 công, \"1+2\" = 2 công, X = nghỉ" });
    OCR_MODES.forEach(function (o) { s0.appendChild(h("option", { value: o[0], text: o[1] })); }); s0.value = v;
    s0.addEventListener("change", function () { onCh(s0.value); }); return s0;
  }
  // ---------- Thư viện mẫu OCR (V7): xem / duyệt / từ chối / đổi nhãn / khôi phục — KHÔNG có thao tác xóa mẫu ----------
  var OLS = { tab: "so", loaded: false, loading: false, samples: [], edits: [], stats: null, confusions: [], page: 0, q: "", err: "", urls: {} };
  var OL_TABS = [["so", "Số"], ["kyhieu", "Ký hiệu"], ["chu", "Chữ viết tay"], ["bocuc", "Bố cục"], ["cho", "Chờ xác nhận"], ["nham", "Dễ nhầm"], ["lichsu", "Lịch sử sửa"], ["thongke", "Thống kê"]];
  var OL_ST = { PENDING_APPROVAL: "Chờ xác nhận", VERIFIED: "Đã xác nhận", SUPERSEDED: "Đã bị thay thế", REJECTED: "Bị từ chối", CONFLICT: "Xung đột" };
  function olLoad(force) {
    if (!window.hakOcrLib || OLS.loading || (OLS.loaded && !force)) return;
    OLS.loading = true;
    Promise.all([window.hakOcrLib.list({}), window.hakOcrLib.edits(), window.hakOcrLib.layouts ? window.hakOcrLib.layouts() : Promise.resolve({ ok: true, layouts: [] })]).then(function (r) {
      OLS.loading = false; OLS.loaded = true; OLS.err = r[0] && r[0].ok ? "" : (r[0] && r[0].error || "không đọc được thư viện");
      if (r[0] && r[0].ok) { OLS.samples = r[0].samples; OLS.stats = r[0].stats; OLS.confusions = r[0].confusions; }
      if (r[1] && r[1].ok) OLS.edits = r[1].edits; OLS.layouts = r[2] && r[2].ok ? r[2].layouts : [];
      if (st.tab === "ocrlib") render();
    }, function (e) { OLS.loading = false; OLS.err = String(e && e.message || e); if (st.tab === "ocrlib") render(); });
  }
  function olThumb(sha) {
    var im = h("img", { class: "olthumb", alt: "ảnh ô mẫu", style: "height:44px;max-width:90px;image-rendering:pixelated;background:#fff;border:1px solid var(--bd,#ccc)" });
    if (OLS.urls[sha]) { im.src = OLS.urls[sha]; return im; }
    window.hakOcrLib.image(sha).then(function (r) { if (r && r.ok && r.data) { OLS.urls[sha] = URL.createObjectURL(new Blob([r.data], { type: "image/png" })); im.src = OLS.urls[sha]; } });
    return im;
  }
  function olAct(fn, msg) { return function () { if (!need("ocr.library", "quản lý thư viện mẫu OCR")) return; fn().then(function (r) { if (r && r.ok) { audit("Thư viện mẫu OCR", msg); OLS.loaded = false; olLoad(true); } else toast("⚠ " + ((r && r.error) || "không thực hiện được")); }); }; }
  function tabOcrLib() {
    var w = h("div");
    if (!window.hakOcrLib) { w.appendChild(h("div", { class: "card" }, [h("div", { class: "warn", text: "Thư viện mẫu OCR chỉ có trong bản cài (.exe) — dữ liệu lưu offline trên máy." })])); return w; }
    olLoad();
    var tabs = h("div", { class: "subtabs" });
    OL_TABS.forEach(function (t) { tabs.appendChild(h("button", { class: OLS.tab === t[0] ? "on" : "", "data-oltab": t[0], on: { click: function () { OLS.tab = t[0]; OLS.page = 0; render(); } } }, [document.createTextNode(t[1])])); });
    w.appendChild(tabs);
    var c = h("div", { class: "card" }); w.appendChild(c);
    if (OLS.err) c.appendChild(h("div", { class: "warn", text: "⚠ " + OLS.err }));
    if (!OLS.loaded) { c.appendChild(h("div", { class: "hint", text: "Đang đọc thư viện mẫu…" })); return w; }
    var S0 = OLS.stats || { total: 0, byStatus: {} };
    if (OLS.tab === "thongke") {
      var by = S0.byStatus || {}, rows = [["Tổng số mẫu", S0.total], ["Chờ xác nhận", by.PENDING_APPROVAL || 0], ["Đã xác nhận (dùng để nhận dạng)", by.VERIFIED || 0], ["Bị thay thế (lịch sử)", by.SUPERSEDED || 0], ["Bị từ chối", by.REJECTED || 0], ["Xung đột cần xử lý", by.CONFLICT || 0], ["Số nhãn khác nhau", S0.labels || 0], ["Lần sửa đã ghi", S0.edits || 0], ["Lần mẫu được dùng để nhận dạng", S0.refs || 0], ["Cặp dễ nhầm", S0.confusions || 0], ["Bố cục đã lưu", (OLS.layouts || []).length]];
      var t = h("table", { class: "t" }); rows.forEach(function (r) { t.appendChild(h("tr", {}, [h("td", { text: r[0] }), h("td", { class: "r", text: String(r[1]) })])); });
      c.appendChild(h("h3", { text: "Hiệu quả OCR & Thư viện mẫu" })); c.appendChild(t);
      c.appendChild(h("div", { class: "hint", text: "Độ chính xác thực tế chỉ đo được khi có chứng từ viết tay thật đã xác nhận; số liệu này là số lượng mẫu, không phải tỷ lệ đúng." }));
      var cb = h("input", { type: "checkbox", "aria-label": "Lưu cả ô OCR đọc đúng đã xem" }); cb.checked = !!congTy()["OCR lưu mẫu xác nhận"];
      cb.addEventListener("change", function () { if (!need("ocr.library", "đổi cấu hình thư viện mẫu OCR")) { cb.checked = !cb.checked; return; } db.congty = [Object.assign({}, congTy(), { "OCR lưu mẫu xác nhận": cb.checked })]; audit("Cấu hình thư viện mẫu OCR", "lưu mẫu xác nhận = " + cb.checked); save(); toast(cb.checked ? "Bật: ô OCR đọc đúng mà bạn đã xem sẽ được lưu thành mẫu 'Đã xác nhận đúng'" : "Tắt: chỉ lưu mẫu từ ô bạn sửa"); });
      c.appendChild(h("label", { class: "hint", style: "display:block;margin:8px 0" }, [cb, document.createTextNode(" Lưu cả ô OCR đọc ĐÚNG mà người dùng đã mở xem (mẫu \"đã xác nhận đúng\"). Mặc định tắt — chỉ ô bạn sửa mới thành mẫu.")]));
      c.appendChild(btn("Kiểm tra toàn vẹn thư viện", "ghost", function () { window.hakOcrLib.verify().then(function (r) { var rp = r && r.report; toast(rp ? (rp.ok ? "✓ Thư viện toàn vẹn: " + rp.samples + " mẫu" : "⚠ Lỗi: " + rp.bad.length + " ảnh, " + rp.corruptLines + " dòng nhật ký") : "Không kiểm tra được"); }); }));
      return w;
    }
    if (OLS.tab === "nham") {
      c.appendChild(h("h3", { text: "Cặp dễ nhầm (OCR đọc A, người dùng sửa thành B)" }));
      if (!OLS.confusions.length) c.appendChild(h("div", { class: "hint", text: "Chưa có cặp nhầm lẫn nào." }));
      else { var tc = h("table", { class: "t" }); tc.appendChild(h("tr", {}, ["OCR đọc", "Sửa thành", "Số lần"].map(function (x) { return h("th", { text: x }); }))); OLS.confusions.forEach(function (x) { tc.appendChild(h("tr", {}, [h("td", { text: x.ocr || "(trống)" }), h("td", { text: x.corrected }), h("td", { class: "r", text: String(x.count) })])); }); c.appendChild(tc); }
      return w;
    }
    if (OLS.tab === "lichsu") {
      c.appendChild(h("h3", { text: "Lịch sử sửa ô (mới nhất trước)" }));
      var ed = OLS.edits.slice().reverse().slice(OLS.page * 50, OLS.page * 50 + 50), te = h("table", { class: "t" });
      te.appendChild(h("tr", {}, ["Lúc", "Người sửa", "Chứng từ / trang", "Mã NV", "OCR đọc", "Từ", "Thành", "Ghi chú"].map(function (x) { return h("th", { text: x }); })));
      ed.forEach(function (e) { te.appendChild(h("tr", {}, [fmtTime(e.at), e.by, (e.docId || "-") + " / " + (e.page || ""), e.employeeId, e.ocr, e.from, e.to, e.note].map(function (x) { return h("td", { text: String(x == null ? "" : x) }); }))); });
      c.appendChild(te); olPager(c, OLS.edits.length); return w;
    }
    if (OLS.tab === "bocuc") {
      c.appendChild(h("h3", { text: "Bố cục đã lưu (khung bảng, số cột/dòng, vị trí ô)" }));
      var ls = OLS.layouts || [];
      if (!ls.length) c.appendChild(h("div", { class: "hint", text: "Chưa có bố cục. Bố cục được lưu khi bảng OCR được duyệt; trang có bố cục lệch sẽ không được dùng để học mẫu." }));
      else { var tl = h("table", { class: "t" }); tl.appendChild(h("tr", {}, ["Tên", "Cột", "Dòng", "Số lần dùng", "Lần cuối"].map(function (x) { return h("th", { text: x }); }))); ls.forEach(function (l) { tl.appendChild(h("tr", {}, [l.name, l.cols, l.rows, l.uses, fmtTime(l.lastUsed)].map(function (x) { return h("td", { text: String(x == null ? "" : x) }); }))); }); c.appendChild(tl); }
      return w;
    }
    var f = OLS.samples.filter(function (x) {
      if (OLS.tab === "so") return x.cellType === "digit" && x.status !== "PENDING_APPROVAL" && x.status !== "CONFLICT";
      if (OLS.tab === "kyhieu") return x.cellType === "mark" || x.labelKind === "SYMBOL" && x.cellType !== "digit";
      if (OLS.tab === "chu") return x.cellType === "text";
      if (OLS.tab === "cho") return x.status === "PENDING_APPROVAL" || x.status === "CONFLICT";
      return true;
    });
    if (OLS.q) f = f.filter(function (x) { return String(x.label).indexOf(OLS.q) >= 0 || String(x.employeeId).toLowerCase().indexOf(OLS.q.toLowerCase()) >= 0; });
    var qi = h("input", { class: "i", placeholder: "Lọc theo nhãn / mã NV", value: OLS.q, "aria-label": "Lọc mẫu" }); qi.addEventListener("change", function () { OLS.q = qi.value.trim(); OLS.page = 0; render(); });
    c.appendChild(h("div", { class: "bar" }, [qi, h("span", { class: "hint", text: f.length + " mẫu" })]));
    if (!f.length) { c.appendChild(h("div", { class: "hint", text: OLS.tab === "cho" ? "Không có mẫu nào chờ xác nhận." : "Chưa có mẫu trong mục này. Mẫu tự được ghi khi bạn sửa một ô trong màn hình Đọc ảnh chấm công." })); return w; }
    var tb = h("table", { class: "t", "data-olsamples": "1" }); tb.appendChild(h("tr", {}, ["Ảnh ô", "Nhãn", "Loại nhãn", "Trạng thái", "Nguồn", "OCR đọc", "Chứng từ / trang", "Mã NV", "Kỳ", "Dùng", "Thao tác"].map(function (x) { return h("th", { text: x }); })));
    f.slice().reverse().slice(OLS.page * 50, OLS.page * 50 + 50).forEach(function (x) {
      var lab = h("input", { class: "i", value: x.label, style: "width:56px", "aria-label": "Nhãn mẫu" }), ops = h("td", {});
      var user = function () { return session ? session.tenDangNhap : ""; };
      if (x.status === "PENDING_APPROVAL" || x.status === "CONFLICT") ops.appendChild(btn("Duyệt", "pri", olAct(function () { return window.hakOcrLib.setStatus(x.id, "VERIFIED", user(), "duyệt thủ công"); }, "duyệt mẫu " + x.id)));
      if (x.status !== "REJECTED") ops.appendChild(btn("Từ chối", "ghost", olAct(function () { return window.hakOcrLib.setStatus(x.id, "REJECTED", user(), "từ chối thủ công"); }, "từ chối mẫu " + x.id)));
      if (x.status === "REJECTED" || x.status === "SUPERSEDED") ops.appendChild(btn("Khôi phục", "ghost", olAct(function () { return window.hakOcrLib.setStatus(x.id, "PENDING_APPROVAL", user(), "khôi phục"); }, "khôi phục mẫu " + x.id)));
      ops.appendChild(btn("Lưu nhãn", "ghost", olAct(function () { return window.hakOcrLib.relabel(x.id, lab.value, x.labelKind === "UNKNOWN" ? "SYMBOL" : x.labelKind, user(), "đổi nhãn thủ công"); }, "đổi nhãn mẫu " + x.id)));
      tb.appendChild(h("tr", { "data-olid": x.id }, [h("td", {}, [olThumb(x.pngSha)]), h("td", {}, [lab]), h("td", { text: x.labelKind === "UNKNOWN" ? "chưa rõ (ký hiệu hay giá trị công)" : "ký hiệu / số" }), h("td", { text: OL_ST[x.status] || x.status }), h("td", { text: x.source === "CONFIRMED" ? "Đã xác nhận đúng" : "Do sửa tay" }), h("td", { text: x.ocrValue || "" }), h("td", { text: (x.docId || "-") + " / " + (x.page || "") }), h("td", { text: x.employeeId || "" }), h("td", { text: x.ky || "" }), h("td", { class: "r", text: String(x.uses || 0) }), ops]));
    });
    c.appendChild(h("div", { class: "tw" }, [tb])); olPager(c, f.length);
    return w;
  }
  function olPager(c, n) { if (n <= 50) return; c.appendChild(h("div", { class: "bar" }, [btn("‹ Trước", "ghost", function () { if (OLS.page > 0) { OLS.page--; render(); } }), h("span", { class: "hint", text: "Trang " + (OLS.page + 1) + "/" + Math.ceil(n / 50) }), btn("Sau ›", "ghost", function () { if ((OLS.page + 1) * 50 < n) { OLS.page++; render(); } })])); }

  function tabOCR() {
    var w = h("div");
    if (!window.hakOcr) { w.appendChild(h("div", { class: "card" }, [h("div", { class: "warn", text: "Chỉ có trong bản cài (.exe) — OCR chạy offline trên máy." })])); return w; }
    var card = h("div", { class: "card" }), bar = h("div", { class: "bar" });
    // ⚠ LỖI THẬT ĐÃ PHÁT HIỆN VÀ SỬA: nút này trước đây KHÔNG BAO GIỜ bị khoá khi
    // đang xử lý (OCRS.busy — đọc file thành trang ảnh; OCRS.reading — đang OCR
    // từng trang) — bấm lại trong lúc đó mở thêm 1 luồng đọc file độc lập, rồi gọi
    // readQueue() lần 2 chạy SONG SONG với luồng đầu trên CÙNG các trang (điều
    // kiện lọc "chưa đọc" của readQueue() không phân biệt được 2 luồng), kết quả
    // cuối phụ thuộc luồng nào ghi đè pg.res sau cùng. Khoá nút trong lúc đang xử
    // lý — mở lại ngay khi cả 2 cờ về false (render() đã gọi ở mọi nơi đổi cờ).
    var pickBtn = btn("📂 Chọn ảnh / PDF…", "pri", function () {
      var f = h("input", { type: "file", accept: "image/*,.pdf,application/pdf", multiple: "multiple" });
      f.addEventListener("change", function () {
        var files = Array.prototype.slice.call(f.files || []); if (!files.length) return;
        var big = files.filter(function (x) { return x.size > 40 * 1048576; }); if (big.length) { alert("File quá lớn (> 40 MB): " + big.map(function (x) { return x.name; }).join(", ")); return; }
        OCRS.busy = true; OCRS.stop = false; OCRS.reading = true; render();
        files.reduce(function (p, file) { return p.then(function () { if (OCRS.stop) return; return archiveOriginal(file).then(function (docId) { return fileToPages(file, docId); }).then(function (pgs) { pgs.forEach(function (x) { x.mode = OCRS.mode; OCRS.pages.push(x); }); }); }); }, Promise.resolve())
          .then(function () {
            OCRS.busy = false;
            if (OCRS.stop) { OCRS.pages.forEach(function (x) { if (!x.res && !x.err) x.stopped = true; }); OCRS.reading = false; OCRS.stop = false; render(); toast("Đã dừng — chưa mở hết các file đã chọn; trang chưa đọc bấm Đọc lại khi cần"); return; }
            return readQueue(); // đọc lần lượt các trang mới
          }, function (e) { OCRS.busy = false; OCRS.reading = false; alert("Không mở được file: " + e.message); render(); });
      });
      f.click();
    }, "Ảnh chụp (JPG, PNG) hoặc PDF quét — nhiều file cùng lúc");
    pickBtn.disabled = OCRS.busy || OCRS.reading;
    bar.appendChild(pickBtn);
    bar.appendChild(h("label", { text: "Cách đọc ô " })); bar.appendChild(modeSel(OCRS.mode, "Cách đọc ô cho file mới", function (v) { OCRS.mode = v; }));
    if (OCRS.reading) bar.appendChild(btn(OCRS.stop ? "Đang dừng…" : "■ Dừng đọc", "red", function () { OCRS.stop = true; render(); }, "Dừng sau lô ô đang đọc; các trang đã đọc xong giữ nguyên, trang chưa đọc bấm Đọc lại sau"));
    if (OCRS.more.length && !OCRS.reading) {
      var left = OCRS.more.reduce(function (n, m) { return n + (m.pdf.numPages - m.next + 1); }, 0);
      bar.appendChild(btn("▶ Đọc tiếp " + Math.min(left, OCR_CHUNK) + " trang (còn " + left + ")", "pri", function () {
        var src = OCRS.more.shift(); OCRS.busy = true; OCRS.stop = false; OCRS.reading = true; render();
        renderPdfPages(src).then(function (pgs) { pgs.forEach(function (x) { x.mode = OCRS.mode; OCRS.pages.push(x); }); OCRS.busy = false; if (OCRS.stop) { OCRS.reading = false; OCRS.stop = false; OCRS.more.unshift(src); render(); return; } return readQueue(); }, function (e) { OCRS.busy = false; OCRS.reading = false; alert("Không dựng được trang: " + e.message); render(); });
      }, "PDF nhiều trang được mở từng lượt " + OCR_CHUNK + " trang để không đầy bộ nhớ — không trang nào bị bỏ"));
    }
    if (OCRS.pages.length) {
      bar.appendChild(btn("⬇ Xuất Excel", "", function () { ocrExport(OCRS.pages); }, "Mỗi trang 1 sheet: tên, nhân viên, ngày 1…31, tổng"));
      bar.appendChild(btn("✔ Đưa vào Chấm công / Suất cơm…", "pri", function () { ocrApply(OCRS.pages); }, "Qua màn hình xem trước như nhập Excel"));
      if (!OCRS.reading) bar.appendChild(btn("Xóa danh sách", "ghost", function () { if (confirm("Xóa các trang đã đọc khỏi màn hình này? (Dữ liệu đã ghi vào Chấm công không bị ảnh hưởng)")) { OCRS.pages = []; OCRS.more = []; OCRS.sel = 0; render(); } }));
    }
    bar.appendChild(h("span", { class: "sp" }));
    bar.appendChild(btn("Kiểm tra OCR", "ghost", function () { window.hakOcr.selfTest().then(function (r) { alert(r.ok ? "OCR hoạt động — đọc thử được \"" + r.text + "\" trong " + r.ms + " ms" : "OCR lỗi: " + r.error); }); }));
    card.appendChild(bar);
    card.appendChild(h("div", { class: "hint", text: "Đọc được: bảng chấm công / chấm cơm có KẺ Ô — dòng = người, cột = ngày 1…31 (có thể có Tổng công, Tổng cơm, Công / Tăng ca), hoặc dòng = ngày, cột = Công / Cơm (Lịch làm) hay mỗi cột 1 người (bảng tay của tổ, có thể 2 khối ngày 1–15 và 16–31). Chọn Cách đọc ô: số công, dấu x (x = 1 công, xx = 2, xxx = 3; ô ghi giờ = giờ / 8) hoặc số ca (1 ca = 1 công, 1+2 = 2 công). Chữ in đọc tốt; chữ viết tay và ảnh chụp nhỏ / nghiêng đọc kém hơn — ô nghi ngờ tô vàng, ô không đọc được có dấu ?, dòng lệch tổng tô đỏ. Luôn xem lại trước khi ghi. Ảnh nên chụp thẳng, đủ sáng, bảng chiếm gần hết khung (hoặc quét PDF ≥ 200 dpi)." }));
    if (OCRS.busy) card.appendChild(h("div", { class: "ok", id: "ocr-status", text: (OCRS.pages[OCRS.sel] && OCRS.pages[OCRS.sel].status) || "Đang xử lý…" }));
    w.appendChild(card);
    if (!OCRS.pages.length) return w;
    var tabs = h("div", { class: "subtabs" });
    OCRS.pages.forEach(function (pg, i) {
      var cls = pg.err ? " bad" : !pg.res ? " wait" : "";
      tabs.appendChild(h("button", { class: (OCRS.sel === i ? "on" : "") + cls, on: { click: function () { OCRS.sel = i; render(); } } }, [document.createTextNode((i + 1) + ". " + pg.name), h("span", { class: "n", text: pg.res ? String((pg.lines || []).length) : pg.err ? "!" : pg.stopped ? "■" : "…" })]));
    });
    w.appendChild(tabs);
    var pg = OCRS.pages[Math.min(OCRS.sel, OCRS.pages.length - 1)], pc = h("div", { class: "card ocrpage", "data-ocr-page": String(OCRS.sel) });
    w.appendChild(pc);
    var tb = h("div", { class: "bar" });
    tb.appendChild(h("b", { text: pg.name }));
    tb.appendChild(h("span", { class: "hint", style: "margin:0", text: pg.status || "" }));
    tb.appendChild(h("span", { class: "sp" }));
    if ((pg.res || pg.err || pg.stopped) && !OCRS.reading) {
      tb.appendChild(btn("↺ Xoay trái", "ghost", function () { readQueue({ pg: pg, rot: ((pg.rot || 0) + 3) % 4 }); }, "Đọc lại sau khi xoay ảnh 90° ngược chiều kim đồng hồ"));
      tb.appendChild(btn("↻ Xoay phải", "ghost", function () { readQueue({ pg: pg, rot: ((pg.rot || 0) + 1) % 4 }); }));
      tb.appendChild(modeSel(pg.mode || "so", "Cách đọc ô của trang", function (v) { pg.mode = v; readQueue({ pg: pg, rot: pg.res ? pg.rot || 0 : undefined }); }));
      tb.appendChild(btn("↶ Hoàn tác ô đã sửa", "ghost", function () {
        var u = (pg.undo || []).pop(); if (!u) { toast("Chưa có ô nào để hoàn tác"); return; }
        var lr = ocrLearn(); u.L.vals[u.d] = u.prev; u.inp.value = u.prev;
        if (lr && window.hakOcrLib) window.hakOcrLib.undo(C.ocrLearn.cellKey(pg.docId, pg.trang || 1, u.cell, pg.rot || 0), session ? session.tenDangNhap : "").then(function () { toast("Đã hoàn tác ô và mẫu học của lần sửa đó"); });
        render();
      }, "Trả ô về giá trị trước khi sửa; mẫu học của lần sửa gần nhất chuyển sang 'Bị từ chối' (vẫn giữ lịch sử)"));
      var lrq = ocrLearn(); if (lrq && lrq.pending()) tb.appendChild(btn("⚠ " + lrq.pending() + " mẫu học chưa ghi được — Thử lại", "ghost", function () { lrq.flush().then(function (r) { toast(r.left ? "Vẫn còn " + r.left + " mẫu chưa ghi được: " + lrq.lastError() : "Đã ghi " + r.sent + " mẫu"); render(); }); }));
      if (pg.srcKind === "pdf-text") tb.appendChild(btn("Đọc lại bằng OCR ảnh", "ghost", function () { pg.noText = true; readQueue({ pg: pg, rot: pg.rot || 0 }); }, "Trang này lấy chữ trực tiếp từ lớp chữ của PDF; bấm để bỏ qua lớp chữ và nhận dạng ảnh"));
      tb.appendChild(btn("Đọc lại", "ghost", function () { readQueue({ pg: pg, rot: pg.stopped && !pg.res ? undefined : pg.rot || 0 }); }));
    }
    pc.appendChild(tb);
    if (pg.err) { pc.appendChild(h("div", { class: "warn", text: "Lỗi khi đọc: " + pg.err })); return w; }
    if (!pg.res) { pc.appendChild(h("div", { class: "hint", text: pg.stopped ? "Trang này chưa đọc (đã bấm Dừng đọc). Bấm Đọc lại khi cần." : "Đang chờ đọc…" })); return w; }
    var T = pg.res.table;
    (T.warnings || []).forEach(function (x) { pc.appendChild(h("div", { class: "warn", text: "⚠ " + x })); });
    if (!T.layout) { pc.appendChild(h("div", { class: "hint", text: "Thử xoay ảnh (↺ / ↻) nếu ảnh nằm ngang, hoặc chụp lại rõ hơn. Trang không phải bảng chấm công (giấy tăng ca, xác nhận vân tay, sổ xe…) app không đọc tự động — nhập tay." })); }
    var meta = h("div", { class: "bar" }), kyI = h("input", { class: "i", type: "month", value: pg.ky || kyStr(), "aria-label": "Kỳ của trang", style: "width:170px" });
    kyI.addEventListener("change", function () { pg.ky = kyI.value; });
    meta.appendChild(h("label", { text: "Kỳ " })); meta.appendChild(kyI);
    if (pg.srcKind === "pdf-text") meta.appendChild(h("span", { class: "hint", "data-src-kind": "pdf-text", style: "margin:0", text: "Nguồn: lớp chữ của PDF (không OCR ảnh)" }));
    else if (pg.srcNote) meta.appendChild(h("span", { class: "hint", style: "margin:0", text: "Lớp chữ PDF không dùng được: " + pg.srcNote }));
    if (pg.res.title && pg.res.title.length) meta.appendChild(h("span", { class: "hint", style: "margin:0", text: "Tiêu đề đọc được: " + pg.res.title.join(" · ") }));
    pc.appendChild(meta);
    if (!pg.lines || !pg.lines.length) return w;
    // ảnh gốc (đã xoay) + ô đang chọn
    var prevBox = h("div", { class: "ocrprev" }), zoom = canvasOf(10, 10), zcap = h("div", { class: "hint", text: "Bấm vào 1 ô để xem ảnh gốc của ô đó" });
    prevBox.appendChild(zoom); prevBox.appendChild(zcap);
    var showCell = function (cell, label) {
      if (!cell || !pg.view) { zcap.textContent = label + " — không có ảnh ô"; return; }
      var pad = 6, x0 = Math.max(0, cell.x0 - pad), y0 = Math.max(0, cell.y0 - pad), cw = Math.min(pg.view.width, cell.x1 + pad) - x0, ch = Math.min(pg.view.height, cell.y1 + pad) - y0, sc0 = Math.min(6, 120 / Math.max(1, ch));
      zoom.width = Math.round(cw * sc0); zoom.height = Math.round(ch * sc0);
      var zx = zoom.getContext("2d"); zx.imageSmoothingEnabled = true; zx.drawImage(pg.view, x0, y0, cw, ch, 0, 0, zoom.width, zoom.height);
      zcap.textContent = label + " · OCR: \"" + (cell.text || "") + "\" · tin cậy " + (cell.conf || 0) + (cell.src === "nét" ? " · nhận theo nét (số 1 viết tay)" : "") + (cell.valSrc ? " · tính: " + cell.valSrc : "") + (cell.libStatus === "AUTO" ? " · thư viện mẫu tự nhận (" + Math.round(cell.libScore * 100) + "%)" + (cell.libFrom != null ? ", OCR đọc: " + cell.libFrom : "") : cell.libStatus === "SUG" ? " · thư viện gợi ý: " + cell.libLabel + " (" + Math.round(cell.libScore * 100) + "%)" : "") + (cell.unsure ? " · không chắc — xem lại" : "");
    };
    var tw = h("div", { class: "tw ocrgrid" }), t = h("table"), hr = h("tr");
    ["Tên trên giấy", "Nhân viên", "Loại"].concat(pg.days.map(String), ["Tổng tính", "Tổng giấy"]).forEach(function (x) { hr.appendChild(h("th", { text: x })); });
    t.appendChild(h("thead", {}, [hr]));
    var tbody = h("tbody"), list = nvChoices();
    pg.lines.forEach(function (L, li) {
      var tr = h("tr"), sel = h("select", { "aria-label": "Nhân viên dòng " + (li + 1) });
      sel.appendChild(h("option", { value: "", text: "— chọn —" }));
      var seen = {};
      L.sug.forEach(function (s0) { seen[s0.ma] = 1; sel.appendChild(h("option", { value: s0.ma, text: "≈ " + s0.ma + " · " + s0.ten + " (" + Math.round(s0.score * 100) + "%)" })); });
      list.forEach(function (n) { if (!seen[n.ma]) sel.appendChild(h("option", { value: n.ma, text: n.ma + " · " + n.ten })); });
      sel.value = L.ma; sel.addEventListener("change", function () { L.ma = sel.value; tr.classList.toggle("nomatch", !L.ma); });
      var ks = h("select", { "aria-label": "Loại dòng " + (li + 1) }); OCR_KIND.forEach(function (o) { ks.appendChild(h("option", { value: o[0], text: o[1] })); }); ks.value = L.kind; ks.addEventListener("change", function () { L.kind = ks.value; });
      var nmI = h("input", { class: "i", value: L.name, style: "width:150px" }); nmI.addEventListener("change", function () { L.name = nmI.value; });
      nmI.addEventListener("focus", function () { showCell(L.src.nameCell, "Tên"); });
      tr.appendChild(h("td", {}, [nmI])); tr.appendChild(h("td", {}, [sel])); tr.appendChild(h("td", {}, [ks]));
      var sumTd = h("td", { class: "r" }), totTd = h("td", { class: "r" });
      var upd = function () {
        var ls = lineSum(L, pg.days), tk = Object.keys(L.src.totals || {}).filter(function (k) { var f = C.tsparse.fold(k); return L.kind === "Cơm" ? /com/.test(f) : !/com/.test(f) || /cong/.test(f); })[0];
        var tv = tk != null ? L.src.totals[tk] : null;
        sumTd.textContent = String(ls.sum).replace(".", ",") + (ls.bad ? " (+" + ls.bad + " ?)" : "");
        totTd.textContent = tv == null || isNaN(tv) ? "" : String(tv).replace(".", ",");
        tr.classList.toggle("mismatch", tv != null && !isNaN(tv) && Math.abs(tv - ls.sum) > 0.01);
      };
      pg.days.forEach(function (d) {
        var cell = L.src.cells ? L.src.cells[d] : null, inp = h("input", { class: "i oc", value: L.vals[d], "data-day": String(d) });
        if (String(L.vals[d]).trim() && ((cell && (cell.conf < 60 || cell.src === "nét" || cell.unsure)) || ocrNum(L.vals[d]) > 3)) inp.classList.add("low"); // > 3 công / suất 1 ngày: hay là "0.5" mất dấu chấm
        if (L.vals[d] === "?") inp.classList.add("bad");
        inp.addEventListener("focus", function () { inp._viewed = true; inp._changed = false; showCell(cell, (L.name || "Dòng " + (li + 1)) + " · ngày " + d); });
        inp.addEventListener("blur", function () { var lr = ocrLearn(); if (lr && cell && inp._viewed && !inp._changed && String(L.vals[d]).trim() && String(L.vals[d]) === String(L.orig ? L.orig[d] : "")) lr.onViewedUnchanged({ res: pg.res, cell: cell, pg: pg, ma: L.ma, value: L.vals[d] }); inp._viewed = false; });
        inp.addEventListener("change", function () { var prevV = L.vals[d]; inp._changed = true; if (cell && prevV !== inp.value.trim()) { (pg.undo = pg.undo || []).push({ L: L, d: d, prev: prevV, cell: cell, inp: inp }); } L.vals[d] = inp.value.trim(); var lr = ocrLearn(); if (lr && cell) lr.onEdit({ res: pg.res, cell: cell, pg: pg, ma: L.ma, before: prevV, after: L.vals[d], ocrValue: L.orig ? L.orig[d] : prevV }).then(function (r) { if (r && r.ok === false) toast("⚠ Chưa lưu được mẫu học từ ô vừa sửa — sẽ thử lại (" + (r.error || "") + ")"); }); inp.classList.remove("low"); inp.classList.toggle("bad", isNaN(ocrNum(L.vals[d])) && ocrNum(L.vals[d]) !== null); upd(); });
        tr.appendChild(h("td", { class: "oc" }, [inp]));
      });
      tr.appendChild(sumTd); tr.appendChild(totTd); upd();
      if (!L.ma) tr.classList.add("nomatch");
      tbody.appendChild(tr);
    });
    t.appendChild(tbody); tw.appendChild(t);
    if (C.ocrRules) { // kiểm tra nghiệp vụ (V7): kỳ, ngày trong tháng, mã NV, trùng dòng, ô không phải số — lỗi cấu trúc thì KHÔNG học mẫu từ trang này
      var maSet = {}; list.forEach(function (n) { maSet[n.ma] = 1; });
      var chk = C.ocrRules.check({ ky: pg.ky, mode: pg.mode, days: pg.days, lines: pg.lines.map(function (L) { return { name: L.name, ma: L.ma, kind: L.kind, vals: L.vals, src: L.src }; }) }, { maSet: maSet, sumOf: function (L) { return lineSum(L, pg.days).sum; } });
      pg.layoutSuspect = !!(chk.layoutSuspect || pg.layoutStatus === "MISMATCH" || (pg.res && pg.res.table && !pg.res.table.layout));
      if (pg.layoutStatus === "MISMATCH") pc.appendChild(h("div", { class: "warn", "data-ocr-layout": "1" }, [document.createTextNode("Bố cục bảng " + pg.layoutInfo + " — thư viện mẫu không tự nhận ô và KHÔNG học từ trang này. "), btn("Đây là bố cục mới — lưu", "ghost", function () { window.hakOcrLib.layoutSave(pg.layoutSig, "", session ? session.tenDangNhap : "").then(function (r) { if (r && r.ok) { pg.layoutStatus = "MATCH"; pg.layoutId = r.id; pg.layoutSuspect = false; toast("Đã lưu bố cục mới"); OLS.loaded = false; render(); } }); })]));
      if (chk.issues.length) pc.appendChild(h("div", { class: chk.errors ? "warn" : "hint", "data-ocr-rules": "1", html: "<b>Kiểm tra nghiệp vụ:</b> " + chk.errors + " lỗi, " + chk.warns + " cảnh báo" + (chk.layoutSuspect ? " — <b>nghi lỗi bố cục: trang này không được dùng để học mẫu</b>" : "") + "<br>" + chk.issues.slice(0, 8).map(function (i) { return esc(i.msg); }).join("<br>") + (chk.issues.length > 8 ? "<br>… và " + (chk.issues.length - 8) + " mục nữa" : "") }));
    }
    pc.appendChild(h("div", { class: "legend", html: "<span><i class='low'>1</i>OCR không chắc / nhận theo nét</span><span><i class='bad'>?</i>không đọc được — nhập lại</span><span><i class='mm'>&nbsp;</i>dòng lệch tổng trên giấy</span><span><i class='nm'>&nbsp;</i>chưa chọn nhân viên</span>" }));
    pc.appendChild(tw);
    pc.appendChild(prevBox);
    return w;
  }

  // ---------- Trang chủ ----------
  function tabHome() {
    var w = h("div"), go = function (tab, extra) { return function () { st.tab = tab; if (extra) extra(); saveUi(); render(); }; };
    var chot = kyChot(kyStr()), ky = "tháng " + st.thang + "/" + st.nam;
    var sp = tabAllowed("luong") ? HRM.staffForPayroll(db, st.nam, st.thang) : null;
    var iss = INT.check(db).filter(function (i) { return i.level === "Critical" || i.level === "High"; });
    var het = tabAllowed("baocao") || can("hr.view") ? HRM.reports(db).hethan(30) : [];
    // Banner
    var kqNow = chot ? null : (st.kq && st.kq.ky === kyStr() && !st.kqStale ? st.kq : null);
    var tl = chot ? chot.totals && chot.totals.thucLinh : kqNow ? kqNow.bangluong.reduce(function (t, x) { return t + (+x["Thực lĩnh"] || 0); }, 0) : null;
    var hb = [];
    if (tabAllowed("luong")) hb.push(btn(chot ? "🔒 Xem bảng lương đã chốt" : "▶ Tính lương " + ky, "", go("luong")));
    else if (tabAllowed("nhansu")) hb.push(btn("👥 Mở Nhân sự", "", go("nhansu")));
    if (tabAllowed("chamcong")) hb.push(btn("🗓 Mở chấm công", "ghost", go("chamcong")));
    var dl = h("dl", {}, [
      h("div", {}, [h("dt", { text: "Người tính lương" }), h("dd", { text: sp ? String(sp.list.length) : "—" })]),
      h("div", {}, [h("dt", { text: "Cần xử lý" }), h("dd", { text: String(iss.length + het.length + (sp ? sp.warn.length : 0)) })]),
      h("div", { class: "w" }, [h("dt", { text: chot ? "Tổng thực lĩnh (đã chốt)" : "Tổng thực lĩnh (lần tính gần nhất)" }), h("dd", { text: !canSeePay() ? HRM.PAY_HIDDEN : tl == null ? "Chưa tính" : fmt(tl) })])
    ]);
    w.appendChild(h("section", { class: "hero" }, [
      h("div", { class: "htxt" }, [h("div", { class: "ey", text: "Kỳ lương " + ky + " · " + (chot ? "Đã chốt" : "Chưa chốt") }),
        h("h1", { text: "Tính lương từ hồ sơ & chấm công" }),
        h("p", { text: "Nhập chấm công, sản lượng, thưởng / trừ, tạm ứng của tháng rồi bấm Tính lương. Lương, BHXH, thuế TNCN và thực lĩnh được tính tự động theo hồ sơ và danh mục — chạy hoàn toàn offline trên máy này." }),
        h("div", { class: "hbtns" }, hb)]),
      dl]));
    // Các bước
    var steps = [
      ["backup", "Nạp danh mục chuẩn HAK", "Phòng ban, chức vụ, mã lương, phụ cấp, BH, thuế", countOf("dm_baohiem") > 0],
      ["dm", "Kiểm tra Danh mục", "Đơn giá, phụ cấp, ngưỡng BH theo đơn vị", countOf("dm_luong") > 0],
      ["nhansu", "Hồ sơ & hợp đồng", countOf("nhanvien") + " nhân viên — lương lấy từ phụ lục đang hiệu lực", countOf("nhanvien") > 0 && countOf("chitiethd") > 0],
      ["chamcong", "Chấm công tháng " + st.thang, "Dán từ Excel hoặc nhập tay", db.chamcong.some(function (r) { return r["Kỳ"] === kyStr(); })],
      ["sanluong", "Sản lượng · Thưởng · Tạm ứng", "Nếu có phát sinh trong tháng", db.sanluong.length + db.bandam.length + db.psluong.length + db.ungluong.length > 0],
      ["luong", "Tính → kiểm tra → Chốt kỳ", "Chốt để lưu bảng lương, xem lại về sau", !!chot]
    ].filter(function (s) { return tabAllowed(s[0]); });
    var ol = h("ol", { class: "flow", "aria-label": "Các bước kỳ lương" });
    steps.forEach(function (s, i) { ol.appendChild(h("li", { class: s[3] ? "done" : "", tabindex: "0", role: "button", on: { click: go(s[0]), keydown: function (e) { if (e.key === "Enter") go(s[0])(); } } }, [h("span", { class: "n", text: s[3] ? "✓" : String(i + 1) }), h("div", {}, [h("b", { text: s[1] }), h("small", { text: s[2] })])])); });
    w.appendChild(ol);
    // Mở nhanh
    var Q = [["chamcong", "g1", "🗓", "Chấm công", "Bảng công theo ngày, dán từ Excel."], ["luong", "g2", "📄", "Bảng lương", "Tính, kiểm tra cảnh báo, xuất Excel, chốt kỳ."],
      ["kyluong", "g4", "🔒", "Kỳ lương đã chốt", "Xem lại, so sánh phiên bản, xuất Excel."], ["baocaoluong", "g6", "📈", "Báo cáo lương", "Theo phòng ban, BHXH, thuế, hạch toán."],
      ["nhansu", "g5", "👥", "Hồ sơ nhân sự", "Hợp đồng, phụ lục lương, nhân thân, nghỉ phép."], ["baocao", "g7", "📋", "Báo cáo nhân sự", "Biến động, sổ quản lý lao động, hết hạn HĐ."],
      ["dm", "g8", "📚", "Danh mục", "Mã lương, phụ cấp, BH, thuế, phòng ban."], ["backup", "g3", "🛡", "Sao lưu & hệ thống", "Sao lưu, khôi phục, người dùng, kiểm tra dữ liệu."]]
      .filter(function (q) { return tabAllowed(q[0]); });
    if (Q.length) {
      w.appendChild(h("div", { class: "sec-title", text: "Mở nhanh" }));
      var qg = h("div", { class: "qcards" });
      Q.forEach(function (q) { qg.appendChild(h("button", { type: "button", class: "qcard", on: { click: go(q[0]) } }, [h("span", { class: "qi " + q[1], text: q[2] }), h("b", { text: q[3] }), h("small", { text: q[4] })])); });
      w.appendChild(qg);
    }
    // Cần xử lý + An toàn dữ liệu
    var todo = h("ul", { class: "todo" }), nTodo = 0;
    var addTodo = function (hi, title, sub, label, fn) { nTodo++; todo.appendChild(h("li", {}, [h("span", { class: "dot" + (hi ? " hi" : "") }), h("div", { class: "tx" }, [h("b", { text: title }), h("small", { text: sub })]), btn(label, "ghost", fn)])); };
    if (iss.length) addTodo(true, iss.length + " vấn đề dữ liệu mức Critical / High", iss.slice(0, 2).map(function (i) { return i.msg; }).join(" · "), "Kiểm tra dữ liệu", go("backup"));
    if (het.length) addTodo(true, het.length + " hợp đồng sắp hết hạn / đã quá hạn trong 30 ngày", het.slice(0, 3).map(function (r) { return r["Mã NV"]; }).join(", "), "Xem báo cáo", go("baocao", function () { st.bc = "hethan"; }));
    if (sp && sp.warn.length) addTodo(false, sp.warn.length + " cảnh báo hồ sơ khi tính lương " + ky, sp.warn[0], "Mở Tính lương", go("luong"));
    var left = h("section", { class: "card" }, [h("h3", {}, ["Cần xử lý trước khi chốt", nTodo ? h("span", { class: "cnt", text: String(nTodo) }) : null])]);
    left.appendChild(nTodo ? todo : h("div", { class: "hint", text: "Không có việc nào đang chờ — dữ liệu kỳ này sẵn sàng." }));
    var safe = h("section", { class: "card" }, [h("h3", { text: "An toàn dữ liệu" })]);
    safe.appendChild(h("div", { class: "hint", text: store ? "App tự lưu và tự giữ bản sao lưu mỗi ngày trên máy này (có file kiểm tra SHA-256)." : "Dữ liệu nằm trong trình duyệt của máy này — hãy sao lưu ra file cuối mỗi kỳ." }));
    var bst = store && store.backupStatus && (can("backup.restore") || can("system.admin")) ? store.backupStatus() : null;
    if (bst && (bst.daysSinceExternal == null || bst.daysSinceExternal > 7 || bst.lastMirrorError)) safe.appendChild(h("div", { class: "locked", html: "⚠ <b>" +
      (bst.lastMirrorError ? "Không chép được sang thư mục sao lưu thứ hai" : bst.daysSinceExternal == null ? "Chưa có bản sao lưu nào ra ngoài máy" : "Đã " + bst.daysSinceExternal + " ngày chưa sao lưu ra ngoài máy") +
      "</b> — hỏng ổ cứng / mất máy / mã độc sẽ mất cả dữ liệu lẫn bản sao lưu trên máy. Vào <b>Sao lưu &amp; hệ thống</b>: chọn <b>thư mục sao lưu thứ hai</b> (USB, ổ mạng, Google Drive) hoặc bấm <b>Sao lưu ra file</b>." +
      (bst.lastMirrorError ? "<br><span>" + esc(bst.lastMirrorError) + "</span>" : "") }));
    else if (bst) safe.appendChild(h("div", { class: "ok", text: "✓ Đã sao lưu ra ngoài máy " + bst.daysSinceExternal + " ngày trước" + (bst.mirrorDir ? " · thư mục thứ hai: " + bst.mirrorDir : "") }));
    if (tabAllowed("backup")) safe.appendChild(h("div", { class: "bar", style: "margin:10px 0 0" }, [btn("🛡 Mở Sao lưu", "", go("backup"))]));
    if (can("import")) safe.appendChild(h("div", { class: "bar", style: "margin:8px 0 0" }, [btn("📄 Tải file mẫu Excel", "", downloadAllTemplates), btn("⬆ Nhập từ file Excel tổng", "", importAllFile)]));
    w.appendChild(h("div", { class: "cols2" }, [left, safe]));
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
    bar.appendChild(btn("⬇ Sao lưu ra file", "pri", function () { if (!need("backup.restore", "sao lưu toàn bộ dữ liệu ra file")) return; download("LuongHAK_backup_" + new Date().toISOString().slice(0, 10) + ".json", "application/json", JSON.stringify(db)); audit("Sao lưu ra file", ""); if (store && store.noteExternal) store.noteExternal(); }));
    bar.appendChild(btn("⬆ Khôi phục từ file", "", function () {
      if (!need("backup.restore")) return;
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
    bar.appendChild(btn("🗑 Xóa toàn bộ dữ liệu", "red", function () { if (!need("system.admin")) return; if (confirm("XÓA TOÀN BỘ dữ liệu? Không thể hoàn tác!\n(Tài khoản người dùng được giữ lại.)") && confirm("Chắc chắn chứ?")) { if (!backupOrBlock("truoc-xoa-toan-bo", "xóa toàn bộ dữ liệu")) return; db = { nguoidung: db.nguoidung, baomat: db.baomat, auditlog: db.auditlog }; ensureTables(); audit("Xóa toàn bộ dữ liệu", "đã sao lưu trước khi xóa"); saveNow(); st.kq = null; render(); } }));
    c.appendChild(bar);
    c.appendChild(h("div", { class: "hint", text: "Hiện có — " + Object.keys(ALL).map(function (k) { return ALL[k].ten + ": " + countOf(k); }).join(" · ") }));
    var w = h("div"); w.appendChild(cardCongTy()); if (can("system.admin")) w.appendChild(cardUsers()); w.appendChild(c); w.appendChild(cardSchedule()); w.appendChild(cardStorage()); w.appendChild(cardFull()); w.appendChild(cardOffsite()); w.appendChild(cardBackups()); w.appendChild(cardIntegrity()); w.appendChild(cardAudit());
    return w;
  }
  // ---------- Khôi phục / sao lưu / kiểm tra dữ liệu ----------
  function summarize(o) { return "Nhân viên: " + ((o.nhanvien || []).length) + " · Chấm công: " + ((o.chamcong || []).length) + " dòng · Kỳ đã chốt: " + ((o.kyluong || []).length); }
  function chotSummary(o) { var m = {}; (o.kyluong || []).forEach(function (k) { if (k && k.ky) m[k.ky] = "v" + (k.version || 1) + " · " + fmt((k.totals && k.totals.thucLinh) || 0); }); return m; }
  // opts.quarantine: cất file dữ liệu hỏng hiện tại (chỉ làm SAU khi người dùng đã xác nhận khôi phục)
  function restoreFromText(text, label, opts) {
    opts = opts || {};
    if (session && !need("backup.restore")) return; // màn hình khôi phục khi file hỏng: chưa đăng nhập được (xem RISK-05)
    var o;
    try { o = JSON.parse(text); } catch (e) { alert("File không phải dữ liệu hợp lệ (JSON lỗi)."); return; }
    if (!o || typeof o !== "object" || Array.isArray(o)) { alert("File không đúng cấu trúc dữ liệu của app."); return; }
    var known = Object.keys(ALL).concat(["kyluong", "nhansu", "congty"]).filter(function (k) { return Array.isArray(o[k]); });
    if (!known.length) { alert("File không chứa bảng dữ liệu nào của app — không khôi phục."); return; }
    var rep = SCH.validate(o, { tables: Object.keys(ALL), hrTables: Object.keys(HRT) });
    if (rep.fatal.length) { alert("KHÔNG khôi phục được — cấu trúc file không an toàn:\n- " + rep.fatal.join("\n- ")); return; }
    // So sánh các kỳ lương đã chốt: khôi phục bản cũ có thể làm MẤT bản chốt mới hơn
    var cur = loadError ? {} : chotSummary(db), nxt = chotSummary(o), diff = [];
    Object.keys(cur).forEach(function (k) { if (!nxt[k]) diff.push("MẤT bản chốt " + kyLabel(k) + " (" + cur[k] + ")"); else if (nxt[k] !== cur[k]) diff.push(kyLabel(k) + ": " + cur[k] + " → " + nxt[k]); });
    Object.keys(nxt).forEach(function (k) { if (!cur[k]) diff.push("Thêm bản chốt " + kyLabel(k) + " (" + nxt[k] + ")"); });
    if (!confirm("KHÔI PHỤC từ " + label + "\n\nFile này: " + summarize(o) + "\nHiện tại: " + (loadError ? "(không đọc được)" : summarize(db)) +
      (diff.length ? "\n\n⚠ KỲ LƯƠNG ĐÃ CHỐT thay đổi:\n- " + diff.join("\n- ") : "\n\nKỳ lương đã chốt: không thay đổi.") +
      (rep.errors.length ? "\n\n⚠ File có " + rep.errors.length + " vấn đề dữ liệu (xem Kiểm tra dữ liệu sau khi khôi phục)." : "") +
      "\n\nToàn bộ dữ liệu hiện tại sẽ được THAY THẾ. App sẽ tự sao lưu dữ liệu hiện tại trước khi khôi phục. Tiếp tục?")) return;
    // P1: hộp thoại trên hứa "App sẽ tự sao lưu dữ liệu hiện tại trước khi khôi phục" — khác với nhập
    // Excel/mở chốt/gộp chấm công (có "before" + hoàn tác riêng), một khi đã ghi đè `db` và saveNow()
    // thành công thì KHÔNG còn đường nào lấy lại dữ liệu hiện tại ngoài chính bản sao lưu này — nên
    // CHẶN CỨNG nếu không tạo được, đúng với lời hứa đã đưa ra.
    if (opts.quarantine && store && store.quarantine) store.quarantine();
    else if (!readOnly && !backupOrBlock("truoc-khoi-phuc", "khôi phục dữ liệu")) return;
    var prev = db, prevRO = readOnly, prevErr = loadError;
    try { db = o; var mm = HRM.migrate(db).concat(INT.normalizeDataset(db).messages); readOnly = false; loadError = null; ensureTables(); }
    catch (e) { db = prev; readOnly = prevRO; loadError = prevErr; alert("Không khôi phục được: " + e.message); render(); return; }
    // Tài khoản lấy theo dữ liệu vừa khôi phục: người đang đăng nhập phải có trong đó, nếu không phải đăng nhập lại
    var me = session && PERM.findUser(db, session.tenDangNhap);
    session = me && !me.khoa ? me : null;
    audit("Khôi phục dữ liệu", label + (diff.length ? " — kỳ chốt thay đổi: " + diff.join("; ") : ""));
    if (!saveNow()) { alert("Đã nạp dữ liệu nhưng CHƯA lưu được xuống đĩa!"); }
    st.kq = null; st.tab = "home"; render(); toast("Đã khôi phục từ " + label); if (mm.length) alert(mm.join("\n"));
    if (opts.after) opts.after();
  }
  /** Lịch sao lưu tự động (α17) — cấu hình theo máy; chỉ Admin đổi được */
  function cardSchedule() {
    var c = h("div", { class: "card", "data-schedule": "1" });
    c.appendChild(h("h3", { text: "🕘 Lịch sao lưu tự động" }));
    if (!store || !store.scheduleGet) { c.appendChild(h("div", { class: "hint", text: "Chỉ có trong bản cài (.exe). Bản chạy trình duyệt: dùng 'Sao lưu ra file'." })); return c; }
    var sc = store.scheduleGet() || {}, admin = can("system.admin");
    c.appendChild(h("div", { class: "hint", text: "Luôn có: sao lưu mỗi lần mở app, đầu mỗi ngày, trước thao tác lớn, sau chốt kỳ. Thêm dưới đây (chỉ khi dữ liệu ĐÃ THAY ĐỔI so với bản sao lưu gần nhất, không tạo bản trùng). App chạy offline nên chỉ sao lưu được khi app đang mở. Có thư mục thứ hai thì bản mới cũng tự chép sang." }));
    var set = function (o, msg) { var r = store.scheduleSet(o); if (r && r.ok) { audit("Đổi lịch sao lưu", msg); toast("Đã lưu lịch sao lưu: " + msg); } else alert("⚠ " + ((r && r.error) || "Không lưu được")); render(); };
    var sel = function (vals, cur, lab, on) { var s0 = h("select", { class: "i" }); vals.forEach(function (v) { var o = h("option", { value: String(v), text: lab(v) }); if (v === cur) o.selected = true; s0.appendChild(o); }); s0.disabled = !admin; s0.addEventListener("change", function () { on(+s0.value); }); return s0; };
    var hLab = function (v) { return v ? "Mỗi " + v + " giờ" : "Tắt"; }, dLab = function (v) { return v + " ngày"; };
    var every = sel([0, 1, 2, 4, 8], sc.everyHours, hLab, function (v) { set({ everyHours: v }, "định kỳ " + hLab(v).toLowerCase()); });
    var keep = sel([30, 60, 90, 180, 365], sc.keepDaily, dLab, function (v) { set({ keepDaily: v }, "giữ bản đầu ngày " + dLab(v)); });
    var cb = h("input", { type: "checkbox" }); cb.checked = !!sc.onClose; cb.disabled = !admin;
    cb.addEventListener("change", function () { set({ onClose: cb.checked }, cb.checked ? "sao lưu khi đóng app" : "không sao lưu khi đóng app"); });
    var g = h("div", { class: "schedg" }, [
      h("div", { class: "fld" }, [h("label", { text: "Sao lưu định kỳ khi app đang mở" }), every]),
      h("div", { class: "fld" }, [h("label", { text: "Giữ bản sao lưu đầu ngày" }), keep]),
      h("div", { class: "fld" }, [h("label", { text: "Khi đóng app" }), h("label", { class: "schk" }, [cb, h("span", { text: "Sao lưu khi đóng app" })])])]);
    c.appendChild(g);
    c.appendChild(h("div", { class: "hint", text: "Lần kiểm tra định kỳ gần nhất: " + (sc.lastAuto ? fmtTime(sc.lastAuto) : "chưa có") + " · Bản định kỳ giữ 48 bản, bản khi đóng app giữ 10 bản gần nhất." + (admin ? "" : " Chỉ Admin đổi được lịch.") }));
    return c;
  }
  function cardOffsite() {
    var c = h("div", { class: "card" });
    c.appendChild(h("h3", { text: "🛡 Sao lưu ra ngoài máy (thư mục thứ hai)" }));
    if (!store || !store.backupStatus) { c.appendChild(h("div", { class: "hint", text: "Chỉ có trong bản cài (.exe). Bản chạy trình duyệt: dùng 'Sao lưu ra file'." })); return c; }
    var bs = store.backupStatus() || {};
    c.appendChild(h("div", { class: "hint", text: "Chọn 1 thư mục KHÁC ổ đĩa của máy này: USB, ổ cứng ngoài, ổ mạng (NAS) hoặc thư mục Google Drive đã đồng bộ. Mỗi bản sao lưu (đầu ngày, trước thao tác lớn, sau chốt kỳ…) sẽ tự chép sang thư mục con 'TinhLuongHAK-SaoLuu' và được kiểm tra SHA-256. Bản sau chốt kỳ được giữ vĩnh viễn." }));
    var rows = [
      ["Thư mục thứ hai", bs.mirrorDir || "— chưa chọn —"],
      ["Lần chép tốt gần nhất", bs.lastMirrorOk ? fmtTime(bs.lastMirrorOk) : "—"],
      ["Lần sao lưu ra ngoài gần nhất", bs.lastExternal ? fmtTime(bs.lastExternal) + (bs.daysSinceExternal != null ? " (" + bs.daysSinceExternal + " ngày trước)" : "") : "chưa có"],
      ["Bản sao lưu sau chốt kỳ (giữ vĩnh viễn)", String(bs.permanent || 0)]];
    var t = h("table"), tb = h("tbody"); rows.forEach(function (r) { tb.appendChild(h("tr", {}, [h("td", { class: "t", text: r[0] }), h("td", { class: "t", text: r[1] })])); }); t.appendChild(tb); c.appendChild(t);
    if (bs.lastMirrorError) c.appendChild(h("div", { class: "warn", text: "⚠ Lần chép gần nhất bị lỗi: " + bs.lastMirrorError }));
    var bar = h("div", { class: "bar" });
    if (can("system.admin")) bar.appendChild(btn(bs.mirrorDir ? "📁 Đổi thư mục…" : "📁 Chọn thư mục sao lưu thứ hai…", "pri", function () {
      var r = store.mirrorChoose(); if (r && r.cancelled) return;
      if (r && r.ok) { audit("Đặt thư mục sao lưu thứ hai", (store.backupStatus() || {}).mirrorDir || ""); toast("Đã chọn thư mục và chép " + (r.copied || 0) + " bản sao lưu"); } else alert("⚠ " + ((r && r.error) || "Không đặt được thư mục"));
      render();
    }));
    if (bs.mirrorDir && can("backup.restore")) bar.appendChild(btn("⇪ Chép sang thư mục thứ hai ngay", "", function () {
      var r = store.mirrorSync(); if (r && r.ok) toast("Đã chép " + (r.copied || 0) + " bản sao lưu"); else alert("⚠ " + ((r && r.error) || "Không chép được")); render();
    }));
    if (bs.mirrorDir && can("system.admin")) bar.appendChild(btn("Bỏ thư mục thứ hai", "ghost", function () { if (!confirm("Bỏ thư mục sao lưu thứ hai? (Các bản đã chép ở đó vẫn giữ nguyên)")) return; store.mirrorClear(); audit("Bỏ thư mục sao lưu thứ hai", bs.mirrorDir); render(); }));
    c.appendChild(bar);
    return c;
  }
  /** Full Backup (GĐ5): 1 gói ZIP gồm dữ liệu + chứng từ gốc + manifest SHA-256. Khôi phục qua bước kiểm tra, chứng từ chỉ thêm không ghi đè. */
  var STG = { data: null, busy: false, msg: null };
  /** Cài đặt "Lưu trữ & Sao lưu": 4 thư mục. Đổi = chép + kiểm SHA-256 rồi mới chuyển; không xóa dữ liệu cũ. */
  function cardStorage() {
    var c = h("div", { class: "card", "data-card": "storage" });
    c.appendChild(h("h3", { text: "🗂 Lưu trữ & Sao lưu — vị trí dữ liệu" }));
    if (!window.hakPaths) { c.appendChild(h("div", { class: "hint", text: "Chỉ có trong bản cài (.exe)." })); return c; }
    if (!STG.data) { window.hakPaths.get().then(function (r) { if (r && r.ok) { STG.data = r; if (st.tab === "backup") render(); } }); c.appendChild(h("div", { class: "hint", text: "Đang đọc cấu hình…" })); return c; }
    c.appendChild(h("div", { class: "hint", text: "Bấm \"Đổi…\" để chọn thư mục mới. App chép toàn bộ dữ liệu sang thư mục mới, kiểm tra SHA-256 từng file, chỉ khi đạt mới chuyển; dữ liệu cũ KHÔNG bị xóa. Chỉ Admin / người có quyền khôi phục thao tác được." }));
    var t = h("table", { class: "t" });
    ["docs", "ocrLib", "backup"].forEach(function (k) {
      var row = h("tr", { "data-stg": k }, [h("td", { text: STG.data.labels[k] }), h("td", { text: STG.data.paths[k], style: "word-break:break-all" }), h("td", {}, [btn("Đổi…", "ghost", function () {
        if (!need("backup.restore", "đổi thư mục lưu trữ") || STG.busy) return;
        window.hakPaths.pick(k).then(function (p) {
          if (!p || !p.ok) return;
          if (!confirm("Chuyển \"" + STG.data.labels[k] + "\" sang:\n" + p.dir + "\n\nDữ liệu sẽ được CHÉP và kiểm tra SHA-256; dữ liệu cũ vẫn giữ nguyên. Tiếp tục?")) return;
          STG.busy = true; toast("Đang chép và kiểm tra dữ liệu…");
          window.hakPaths.move(k, p.dir).then(function (r) {
            STG.busy = false; STG.data = null;
            STG.msg = r && r.ok ? { bad: false, text: "✓ Đã chuyển " + r.files + " file sang " + r.to + " (đã kiểm SHA-256). " + r.note } : { bad: true, text: "⚠ " + ((r && r.error) || "không chuyển được") + " — giữ nguyên thư mục cũ" };
            audit("Đổi thư mục lưu trữ", k + " → " + p.dir + " · " + (r && r.ok ? "đạt" : "không đạt")); render();
          });
        });
      })])]);
      t.appendChild(row);
    });
    t.appendChild(h("tr", { "data-stg": "mirror" }, [h("td", { text: "Sao lưu dự phòng" }), h("td", { text: STG.data.paths.mirror || "(chưa chọn)", style: "word-break:break-all" }), h("td", { class: "hint", text: "đặt ở mục \"Sao lưu ra ngoài máy (thư mục thứ hai)\" bên dưới" })]));
    c.appendChild(t);
    if (STG.msg) c.appendChild(h("div", { class: STG.msg.bad ? "warn" : "ok", "data-stg-msg": "1", text: STG.msg.text }));
    return c;
  }
  function cardFull() {
    var c = h("div", { class: "card", "data-fullbackup": "1" });
    c.appendChild(h("h3", { text: "📦 Full Backup (dữ liệu + chứng từ gốc)" }));
    if (!window.hakFull) { c.appendChild(h("div", { class: "hint", text: "Chỉ có trong bản cài (.exe)." })); return c; }
    c.appendChild(h("div", { class: "hint", text: "Một file .zip chứa toàn bộ dữ liệu lương, mọi chứng từ gốc (ảnh/PDF) và bảng kê SHA-256. Dùng khi đổi máy / cài lại Windows. Gói được kiểm tra lại ngay sau khi tạo; khi khôi phục, gói bị hỏng hoặc bị sửa sẽ bị từ chối trước khi ghi bất cứ thứ gì." }));
    if (st.fbMsg) c.appendChild(h("div", { class: st.fbMsg.bad ? "warn" : "ok", "data-fb-msg": "1", text: st.fbMsg.text }));
    c.appendChild(h("div", { class: "bar" }, [
      btn("📦 Tạo Full Backup", "pri", function () {
        if (!need("backup.restore", "tạo Full Backup")) return;
        if (!saveNow()) { alert("Chưa lưu được dữ liệu hiện tại xuống đĩa — không tạo Full Backup."); return; }
        st.fbMsg = { text: "Đang đóng gói…" }; render();
        window.hakFull.create({ user: currentUser() }).then(function (r) {
          if (!r || !r.ok) { st.fbMsg = { bad: true, text: "⚠ Không tạo được Full Backup: " + ((r && r.error) || "lỗi không rõ") }; }
          else { audit("Tạo Full Backup", r.name + " · " + r.docs + " chứng từ · SHA-256 " + r.sha256.slice(0, 12) + "…"); save(); st.fbMsg = { text: "✓ Đã tạo " + r.name + " (" + Math.round(r.size / 1024) + " KB, " + r.docs + " chứng từ) trong thư mục xuất file" + (r.mirrored ? " và chép sang " + r.mirrored : "") + (r.warnings.length ? " — ⚠ " + r.warnings.join("; ") : "") + ". SHA-256: " + r.sha256 }; }
          render();
        }, function (e) { st.fbMsg = { bad: true, text: "⚠ " + e.message }; render(); });
      }, "Tạo file .zip trong thư mục xuất file (và chép sang thư mục sao lưu thứ hai nếu đã chọn)"),
      btn("📥 Khôi phục từ gói Full Backup…", "", function () {
        if (!need("backup.restore")) return;
        window.hakFull.inspect().then(function (r) {
          if (r && r.cancelled) return;
          if (!r || !r.ok) { st.fbMsg = { bad: true, text: "⚠ Gói KHÔNG đạt kiểm tra — chưa ghi gì: " + (((r && r.problems) || ["lỗi không rõ"]).join("; ")) }; render(); return; }
          var cnt = { new: 0, same: 0, conflict: 0 }; (r.docs || []).forEach(function (d) { cnt[d.state] = (cnt[d.state] || 0) + 1; });
          var info = "Gói " + r.label + " — tạo " + fmtTime(r.manifest.createdAt) + (r.manifest.createdBy ? " bởi " + r.manifest.createdBy : "") + ". Đã kiểm tra SHA-256 mọi file: ĐẠT.\nChứng từ: " + cnt.new + " mới sẽ được thêm, " + cnt.same + " đã có sẵn, " + cnt.conflict + " trùng mã nhưng khác nội dung (giữ bản đang có, không ghi đè).";
          if (!confirm(info + "\n\nTiếp tục sang bước khôi phục dữ liệu?")) return;
          restoreFromText(r.text, "Full Backup " + r.label, { after: function () {
            window.hakFull.importDocs().then(function (d) {
              var linked = (db.chungtu || []).length;
              st.fbMsg = { bad: !d.ok || (d.conflict || []).length > 0 || (d.failed || []).length > 0, text: d.ok ? "✓ Khôi phục xong. Chứng từ: thêm " + d.added + ", đã có " + d.same + (d.conflict.length ? ", TRÙNG MÃ KHÁC NỘI DUNG (giữ bản cũ): " + d.conflict.join(", ") : "") + (d.ocr ? ". Thư viện mẫu OCR: thêm " + d.ocr.addedSamples + " mẫu, " + d.ocr.addedEdits + " lần sửa" : "") + (d.failed.length ? ", LỖI: " + d.failed.join("; ") : "") + ". Hồ sơ chứng từ trong dữ liệu: " + linked : "⚠ Khôi phục dữ liệu xong nhưng nhập chứng từ lỗi: " + d.error };
              audit("Khôi phục chứng từ từ Full Backup", st.fbMsg.text); save(); render(); if (st.fbMsg.bad) alert(st.fbMsg.text); else toast(st.fbMsg.text);
            });
          } });
        });
      }, "Chọn file .zip Full Backup: kiểm tra toàn vẹn → xác nhận → khôi phục dữ liệu (tự sao lưu bản hiện tại trước) → thêm chứng từ còn thiếu")
    ]));
    return c;
  }
  function cardBackups() {
    var c = h("div", { class: "card" });
    c.appendChild(h("h3", { text: "🗂 Các bản sao lưu tự động trên máy" }));
    if (!store || !store.listBackups) { c.appendChild(h("div", { class: "hint", text: "Chỉ có trong bản cài (.exe). Bản chạy trình duyệt: dùng 'Sao lưu ra file'." })); return c; }
    c.appendChild(h("div", { class: "hint", text: "daily = đầu mỗi ngày (giữ theo Lịch sao lưu) · startup = mỗi lần mở app (giữ 10) · dinh-ky = định kỳ (giữ 48) · khi-dong = khi đóng app (giữ 10) · truoc-… = tự sao lưu trước thao tác lớn (nhập Excel, mở chốt, khôi phục, xóa) · sau-chot-… = ngay sau khi chốt kỳ (giữ VĨNH VIỄN)." }));
    var STATUS = { ok: "✓ Nguyên vẹn (SHA-256)", unverified: "Bản cũ — chưa có mã kiểm tra", mismatch: "✕ HỎNG / bị sửa", invalid: "✕ Không đọc được" };
    c.appendChild(h("div", { class: "bar" }, [btn("💾 Tạo bản sao lưu ngay", "pri", function () {
      if (!need("backup.restore", "tạo bản sao lưu")) return;
      var n = backupNow("thu-cong");
      // P1: backupNow() trả null cho cả "chưa có file dữ liệu" và "ghi thất bại" — phân biệt rõ bằng
      // store.hasDataFile(), tránh báo nhầm "chưa có dữ liệu" khi thực ra là lỗi đĩa/quyền ghi.
      toast(n ? "Đã tạo " + n : ((store && store.hasDataFile && store.hasDataFile()) ? "⚠ KHÔNG tạo được bản sao lưu — kiểm tra dung lượng đĩa / quyền ghi" : "Chưa có dữ liệu để sao lưu"));
      render();
    }),
      store.verifyBackups ? btn("🩺 Kiểm tra tất cả bản sao lưu", "", function () { st.bkVerify = true; render(); }) : null]));
    var list = (st.bkVerify && store.verifyBackups ? store.verifyBackups() : store.listBackups()).slice(0, 40);
    if (st.bkVerify) { var nb = list.filter(function (b) { return b.status === "mismatch" || b.status === "invalid"; }).length; c.appendChild(h("div", { class: nb ? "warn" : "ok", text: nb ? "⚠ " + nb + " bản sao lưu bị hỏng — không dùng để khôi phục." : "Đã kiểm tra " + list.length + " bản sao lưu gần nhất: đọc được, đủ điều kiện khôi phục." })); }
    if (!list.length) { c.appendChild(h("div", { class: "empty", text: "Chưa có bản sao lưu." })); return c; }
    var t = h("table"), tr = h("tr"); ["Tên file", "Loại", "Thời điểm", "Dung lượng", "Tình trạng", ""].forEach(function (x) { tr.appendChild(h("th", { text: x })); }); t.appendChild(h("thead", {}, [tr]));
    var tb = h("tbody");
    list.forEach(function (b) {
      var x = h("tr");
      [b.name, b.tag, fmtTime(b.created || b.mtime), Math.round(b.size / 1024) + " KB", b.status ? STATUS[b.status] || b.status : "—"].forEach(function (v) { x.appendChild(h("td", { class: "t", text: v })); });
      x.appendChild(h("td", { style: "text-align:right" }, [btn("Khôi phục", "", function () { if (!need("backup.restore")) return; var r = store.readBackup(b.name); if (!r.ok) { alert(r.error); return; } restoreFromText(r.text, b.name); })]));
      tb.appendChild(x);
    });
    t.appendChild(tb); c.appendChild(h("div", { class: "tw", style: "max-height:320px" }, [t]));
    return c;
  }
  function cardIntegrity() {
    var c = h("div", { class: "card" }), issues = INT.check(db);
    var sch = SCH.validate(db, { tables: Object.keys(ALL), hrTables: Object.keys(HRT) });
    sch.errors.forEach(function (e) { issues.push({ level: "High", area: (ALL[e.table] ? ALL[e.table].ten : e.table) + " (cấu trúc)", msg: e.msg }); });
    sch.info.forEach(function (m) { issues.push({ level: "Low", area: "Cấu trúc", msg: m }); });
    var ord = { Critical: 0, High: 1, Medium: 2, Low: 3 }; issues.sort(function (a, b) { return ord[a.level] - ord[b.level]; });
    c.appendChild(h("h3", { text: "🩺 Kiểm tra dữ liệu" }));
    c.appendChild(h("div", { class: "hint", text: "Kiểm tra cấu trúc (phiên bản, bảng, kiểu ngày/tiền/kỳ, Mã NV, quan hệ hợp đồng–phụ lục, toàn vẹn kỳ đã chốt) và nghiệp vụ (trùng mã, trùng chấm công, lương nghi lỗi…). App KHÔNG tự xóa dữ liệu lỗi — bạn tự sửa theo danh sách." }));
    var dupCC = issues.some(function (i) { return i.area === "chamcong" && /nên gộp|Gộp dòng chấm công trùng/.test(i.msg); });
    if (dupCC) c.appendChild(h("div", { class: "bar" }, [btn("🔀 Gộp dòng chấm công trùng (không trùng ngày)", "pri", function () {
      if (!need("input.edit")) return;
      if (!confirm("Gộp các dòng chấm công cùng Kỳ + Mã NV + Hình thức công thành 1 dòng?\n• Ngày nhập trùng (cùng số công) → tính 1 lần (hiện đang bị cộng 2 lần).\n• Cùng ngày nhưng KHÁC số công, hoặc thuộc kỳ đã chốt → giữ nguyên để bạn tự xử lý.\nApp sao lưu trước khi gộp.")) return;
      // P1: có "before" + hoàn tác riêng khi saveNow() thất bại — chỉ cảnh báo, không chặn.
      var bkOk = !!backupNow("truoc-gop-cham-cong");
      var before = JSON.stringify(db.chamcong), r = INT.mergeChamCong(db, lockedMap());
      audit("Gộp dòng chấm công trùng", r.groups + " nhóm, bỏ " + r.removed + " dòng thừa" + (r.dupDays ? ", " + r.dupDays + " ngày nhập trùng tính 1 lần" : "") + (r.skipped.length ? ", giữ nguyên " + r.skipped.length + " nhóm" : ""));
      if (!saveNow()) { db.chamcong = JSON.parse(before); db.auditlog.pop(); alert("Không lưu được — đã hủy thao tác gộp."); render(); return; }
      render(); alert("Đã gộp " + r.groups + " nhóm (bỏ " + r.removed + " dòng thừa" + (r.dupDays ? "; " + r.dupDays + " ngày nhập trùng nay tính 1 lần" : "") + ")." + (r.skipped.length ? "\nGiữ nguyên " + r.skipped.length + " nhóm: " + r.skipped.slice(0, 8).map(function (x) { return x.key.replace(/\|/g, " ") + " — " + x.reason; }).join("; ") : "") + (bkOk ? "" : "\n⚠ KHÔNG tạo được bản sao lưu trước khi gộp — kiểm tra dung lượng đĩa"));
    })]));
    if (!issues.length) { c.appendChild(h("div", { class: "ok", text: "Không phát hiện vấn đề về cấu trúc và toàn vẹn dữ liệu." })); return c; }
    c.appendChild(h("div", { class: "hint", text: issues.length + " vấn đề cần xem xét. Critical/High có thể làm sai tiền lương." }));
    c.appendChild(simpleTable(issues.map(function (i) { return { "Mức độ": i.level, "Khu vực": i.area, "Nội dung": i.msg }; })));
    return c;
  }
  // ---------- Màn hình đăng nhập / khởi tạo Admin ----------
  function authCard(title, hint, fields, okText, onOk, extra) {
    var w = h("div", { style: "max-width:440px;margin:40px auto" }), c = h("div", { class: "card" });
    c.appendChild(h("h3", { text: title }));
    if (hint) c.appendChild(h("div", { class: "hint", text: hint }));
    var inputs = {}, msg = h("div", { class: "warn", style: "display:none" });
    fields.forEach(function (f) {
      var inp = h("input", { class: "i", style: "width:100%", type: f.type || "text", autocomplete: f.ac || "off", "data-f": f.k });
      inputs[f.k] = inp;
      c.appendChild(h("div", { class: "fld", style: "margin:8px 0" }, [h("label", { text: f.label }), inp]));
    });
    var busy = false, okBtn = btn(okText, "pri big", function () {
      if (busy) return; var v = {}; Object.keys(inputs).forEach(function (k) { v[k] = inputs[k].value; });
      busy = true; okBtn.disabled = true; msg.style.display = "none";
      Promise.resolve().then(function () { return onOk(v); }).catch(function (e) { msg.textContent = "⚠ " + (e && e.message || e); msg.style.display = ""; })
        .then(function () { busy = false; okBtn.disabled = false; });
    });
    c.appendChild(msg); c.appendChild(h("div", { class: "bar", style: "margin-top:12px" }, [okBtn].concat(extra || [])));
    c.addEventListener("keydown", function (e) { if (e.key === "Enter") okBtn.click(); });
    w.appendChild(c);
    setTimeout(function () { var f0 = c.querySelector("input"); if (f0) f0.focus(); }, 0);
    return w;
  }
  function showRecoveryCode(code, then) {
    var body = h("div");
    body.appendChild(h("div", { class: "warn", html: "Ghi lại <b>mã khôi phục</b> này và cất ở nơi an toàn (két, sổ tay của giám đốc).<br>Khi quên mật khẩu Admin, đây là cách DUY NHẤT để vào lại app. Mã chỉ hiện 1 lần." }));
    body.appendChild(h("div", { style: "font-size:26px;font-weight:700;letter-spacing:2px;text-align:center;margin:16px 0", text: code, "data-recovery": "1" }));
    modal("Mã khôi phục quản trị", body, function (close) { return [btn("Tôi đã ghi lại mã", "pri", function () { close(); (then || render)(); })]; });
  }
  function setRecovery(code) {
    return AUTH.make(code.replace(/-/g, "")).then(function (k) { db.baomat = [{ khoiPhuc: k, taoLuc: new Date().toISOString() }]; });
  }
  function setupAdminScreen() {
    return authCard("Thiết lập tài khoản Quản trị (Admin)", "Từ bản 2.0 app có đăng nhập & phân quyền. Tạo tài khoản Admin đầu tiên — Admin tạo tài khoản cho người khác ở Công ty & Sao lưu → Người dùng.",
      [{ k: "u", label: "Tên đăng nhập" }, { k: "n", label: "Họ tên" }, { k: "p", label: "Mật khẩu (≥ 8 ký tự, có chữ và số)", type: "password", ac: "new-password" }, { k: "p2", label: "Nhập lại mật khẩu", type: "password", ac: "new-password" }],
      "Tạo tài khoản Admin", function (v) {
        if (!/^[a-z0-9._-]{3,30}$/i.test(v.u.trim())) throw new Error("Tên đăng nhập 3–30 ký tự: chữ không dấu, số, . _ -");
        if (!v.n.trim()) throw new Error("Cần nhập họ tên");
        var bad = PERM.validatePassword(v.p); if (bad) throw new Error(bad);
        if (v.p !== v.p2) throw new Error("Hai lần nhập mật khẩu không khớp");
        if ((db.nguoidung || []).length) throw new Error("Đã có tài khoản — hãy đăng nhập");
        var code = randomCode();
        return AUTH.make(v.p).then(function (k) {
          var u = Object.assign({ id: HRM.uid(), tenDangNhap: v.u.trim(), hoTen: v.n.trim(), vaiTro: "admin", khoa: false, taoLuc: new Date().toISOString() }, k);
          db.nguoidung.push(u);
          return setRecovery(code).then(function () {
            session = u; audit("Khởi tạo tài khoản Admin", u.tenDangNhap);
            if (!saveNow()) { db.nguoidung = []; db.baomat = []; session = null; throw new Error("Không lưu được xuống đĩa — chưa tạo tài khoản"); }
            showRecoveryCode(code);
          });
        });
      });
  }
  function loginScreen() {
    return authCard("Đăng nhập", congTy()["Tên công ty"] || "", [{ k: "u", label: "Tên đăng nhập", ac: "username" }, { k: "p", label: "Mật khẩu", type: "password", ac: "current-password" }], "Đăng nhập", function (v) {
      var wait = PERM.lockedFor(v.u); if (wait) throw new Error("Sai mật khẩu quá 5 lần — chờ " + Math.ceil(wait / 1000) + " giây");
      var u = PERM.findUser(db, v.u);
      return (u ? AUTH.verify(v.p, u) : AUTH.hash(v.p, "00".repeat(16), PERM.ITER).then(function () { return false; })).then(function (ok) {
        if (!ok) { PERM.noteFail(v.u); throw new Error("Sai tên đăng nhập hoặc mật khẩu"); }
        if (u.khoa) throw new Error("Tài khoản đã bị khóa — liên hệ Admin");
        PERM.noteOk(v.u); session = u; lastActive = Date.now(); u.dangNhapLuc = new Date().toISOString();
        audit("Đăng nhập", u.tenDangNhap); saveNow();
        if (u.phaiDoiMK) { render(); changePassword(true); return; }
        render();
      });
    }, [btn("Quên mật khẩu Admin…", "ghost", function () { st.authView = "recover"; render(); })]);
  }
  function recoverAdminScreen() {
    return authCard("Khôi phục quyền Admin", "Nhập mã khôi phục được cấp khi tạo Admin đầu tiên. App đặt lại mật khẩu cho tài khoản Admin bạn chọn và cấp MÃ KHÔI PHỤC MỚI.",
      [{ k: "c", label: "Mã khôi phục (XXXX-XXXX-XXXX-XXXX)" }, { k: "u", label: "Tên đăng nhập Admin cần đặt lại" }, { k: "p", label: "Mật khẩu mới", type: "password", ac: "new-password" }, { k: "p2", label: "Nhập lại", type: "password", ac: "new-password" }],
      "Đặt lại mật khẩu", function (v) {
        var wait = PERM.lockedFor("#recovery"); if (wait) throw new Error("Nhập sai quá 5 lần — chờ " + Math.ceil(wait / 1000) + " giây");
        var rec = (db.baomat || [])[0], u = PERM.findUser(db, v.u);
        if (!rec || !rec.khoiPhuc) throw new Error("Dữ liệu này không có mã khôi phục");
        var bad = PERM.validatePassword(v.p); if (bad) throw new Error(bad);
        if (v.p !== v.p2) throw new Error("Hai lần nhập mật khẩu không khớp");
        return AUTH.verify(v.c.trim().toUpperCase().replace(/-/g, ""), rec.khoiPhuc).then(function (ok) {
          if (!ok) { PERM.noteFail("#recovery"); throw new Error("Mã khôi phục không đúng"); }
          if (!u || u.vaiTro !== "admin") throw new Error("Không có tài khoản Admin tên này");
          PERM.noteOk("#recovery");
          var code = randomCode();
          return AUTH.make(v.p).then(function (k) {
            Object.assign(u, k, { khoa: false, phaiDoiMK: false, doiMKLuc: new Date().toISOString() });
            return setRecovery(code).then(function () {
              session = u; audit("Khôi phục quyền Admin bằng mã khôi phục", u.tenDangNhap + " — đã cấp mã khôi phục mới");
              if (!saveNow()) throw new Error("Không lưu được xuống đĩa");
              st.authView = ""; showRecoveryCode(code);
            });
          });
        });
      }, [btn("← Quay lại đăng nhập", "ghost", function () { st.authView = ""; render(); })]);
  }
  function changePassword(forced) {
    var body = h("div"), f = {};
    if (forced) body.appendChild(h("div", { class: "warn", text: "Admin yêu cầu bạn đổi mật khẩu trước khi làm việc." }));
    [["o", "Mật khẩu hiện tại"], ["p", "Mật khẩu mới (≥ 8 ký tự, có chữ và số)"], ["p2", "Nhập lại mật khẩu mới"]].forEach(function (x) { f[x[0]] = h("input", { class: "i", type: "password", style: "width:100%" }); body.appendChild(h("div", { class: "fld", style: "margin:8px 0" }, [h("label", { text: x[1] }), f[x[0]]])); });
    modal("Đổi mật khẩu — " + session.tenDangNhap, body, function (close) {
      return [forced ? btn("Đăng xuất", "", function () { close(); logout("không đổi mật khẩu bắt buộc"); }) : btn("Hủy", "", close), btn("Đổi mật khẩu", "pri", function () {
        var bad = PERM.validatePassword(f.p.value); if (bad) { alert(bad); return; }
        if (f.p.value !== f.p2.value) { alert("Hai lần nhập không khớp"); return; }
        AUTH.verify(f.o.value, session).then(function (ok) {
          if (!ok) { alert("Mật khẩu hiện tại không đúng"); return; }
          return AUTH.make(f.p.value).then(function (k) { Object.assign(session, k, { phaiDoiMK: false, doiMKLuc: new Date().toISOString() }); audit("Đổi mật khẩu", session.tenDangNhap); saveNow(); close(); toast("Đã đổi mật khẩu"); render(); });
        });
      })];
    });
  }
  // ---------- Quản trị người dùng (Admin) ----------
  function userForm(u) {
    var isNew = !u, body = h("div"), g = h("div", { class: "fgrid" }); body.appendChild(g);
    var f = { u: h("input", { class: "i", style: "width:100%", value: u ? u.tenDangNhap : "" }), n: h("input", { class: "i", style: "width:100%", value: u ? u.hoTen : "" }),
      r: h("select", { style: "width:100%" }, Object.keys(PERM.ROLES).map(function (k) { return h("option", { value: k, text: PERM.ROLES[k].ten }); })),
      k: h("select", { style: "width:100%" }, [h("option", { value: "", text: "Đang hoạt động" }), h("option", { value: "1", text: "Khóa tài khoản" })]),
      p: h("input", { class: "i", type: "password", style: "width:100%", placeholder: isNew ? "" : "Để trống = giữ mật khẩu" }) };
    f.r.value = u ? u.vaiTro : "ketoanluong"; f.k.value = u && u.khoa ? "1" : ""; if (u) f.u.disabled = true;
    [["Tên đăng nhập", f.u], ["Họ tên", f.n], ["Vai trò", f.r], ["Trạng thái", f.k], [isNew ? "Mật khẩu tạm (người dùng phải đổi khi đăng nhập)" : "Đặt lại mật khẩu tạm", f.p]].forEach(function (x) { g.appendChild(h("div", { class: "fld" }, [h("label", { text: x[0] }), x[1]])); });
    var perm = h("div", { class: "hint" }), showPerm = function () { perm.textContent = "Quyền: " + PERM.ROLES[f.r.value].perms.map(function (p) { return PERM.PERMS[p]; }).join(" · "); };
    f.r.addEventListener("change", showPerm); showPerm(); body.appendChild(perm);
    modal(isNew ? "Thêm người dùng" : "Sửa người dùng — " + u.tenDangNhap, body, function (close) {
      return [btn("Hủy", "", close), btn("💾 Lưu", "pri", function () {
        if (!need("system.admin")) return;
        var name = f.u.value.trim(), next = { vaiTro: f.r.value, khoa: f.k.value === "1" };
        if (isNew && !/^[a-z0-9._-]{3,30}$/i.test(name)) { alert("Tên đăng nhập 3–30 ký tự: chữ không dấu, số, . _ -"); return; }
        if (isNew && PERM.findUser(db, name)) { alert("Tên đăng nhập đã tồn tại"); return; }
        if (!f.n.value.trim()) { alert("Cần nhập họ tên"); return; }
        if ((isNew || f.p.value) && PERM.validatePassword(f.p.value)) { alert(PERM.validatePassword(f.p.value)); return; }
        if (u && PERM.wouldRemoveLastAdmin(db, u, next)) { alert("Không thể: đây là Admin đang hoạt động cuối cùng."); return; }
        var done = function (k) {
          var before = u ? { "Vai trò": u.vaiTro, "Khóa": u.khoa ? "Có" : "Không", "Họ tên": u.hoTen } : null;
          if (isNew) { u = Object.assign({ id: HRM.uid(), tenDangNhap: name, taoLuc: new Date().toISOString(), phaiDoiMK: true }, k); db.nguoidung.push(u); }
          else if (k) Object.assign(u, k, { phaiDoiMK: true });
          Object.assign(u, { hoTen: f.n.value.trim() }, next);
          audit(isNew ? "Thêm người dùng" : "Sửa người dùng", u.tenDangNhap + " · " + GRD.changedFields(before, { "Vai trò": u.vaiTro, "Khóa": u.khoa ? "Có" : "Không", "Họ tên": u.hoTen }).join("; ") + (k ? " · đặt mật khẩu tạm" : ""));
          if (!saveNow()) { alert("Không lưu được xuống đĩa!"); }
          close(); render(); toast("Đã lưu người dùng");
        };
        if (isNew || f.p.value) AUTH.make(f.p.value).then(done); else done(null);
      })];
    });
  }
  function cardUsers() {
    var c = h("div", { class: "card" });
    c.appendChild(h("h3", { text: "👥 Người dùng & phân quyền" }));
    c.appendChild(h("div", { class: "hint", text: "Chỉ Admin quản lý. Quyền được kiểm tra ở mọi thao tác ghi/xuất dữ liệu. Chỉ Admin được sửa dữ liệu hồi tố vào kỳ đã chốt, khôi phục dữ liệu, quản trị hệ thống." }));
    c.appendChild(h("div", { class: "bar" }, [btn("＋ Thêm người dùng", "pri", function () { userForm(null); })]));
    var rows = (db.nguoidung || []).map(function (u) { return { u: u, o: { "Tên đăng nhập": u.tenDangNhap, "Họ tên": u.hoTen, "Vai trò": (PERM.ROLES[u.vaiTro] || {}).ten || u.vaiTro, "Trạng thái": u.khoa ? "Khóa" : "Hoạt động", "Đăng nhập gần nhất": fmtTime(u.dangNhapLuc) } }; });
    var t = h("table"), tr = h("tr"); Object.keys(rows[0].o).concat([""]).forEach(function (x) { tr.appendChild(h("th", { text: x })); }); t.appendChild(h("thead", {}, [tr]));
    var tb = h("tbody"); rows.forEach(function (x) { var r = h("tr", { class: "click", on: { click: function () { userForm(x.u); } } }); Object.keys(x.o).forEach(function (k) { r.appendChild(h("td", { class: "t", text: x.o[k] })); }); r.appendChild(h("td", { class: "t", text: "Sửa ›" })); tb.appendChild(r); });
    t.appendChild(tb); c.appendChild(h("div", { class: "tw", style: "max-height:300px" }, [t]));
    c.appendChild(h("div", { class: "bar", style: "margin-top:10px" }, [btn("🔑 Cấp lại mã khôi phục Admin", "", function () {
      if (!need("system.admin")) return;
      if (!confirm("Cấp mã khôi phục MỚI? Mã cũ sẽ hết hiệu lực.")) return;
      var code = randomCode(); setRecovery(code).then(function () { audit("Cấp lại mã khôi phục Admin", ""); saveNow(); showRecoveryCode(code); });
    })]));
    return c;
  }
  function recoveryScreen() {
    var w = h("div"), c = h("div", { class: "card" });
    c.appendChild(h("h3", { text: "⚠ Không mở được file dữ liệu" }));
    c.appendChild(h("div", { class: "warn", html: esc(loadError.error) + "<br>App <b>chưa ghi đè</b> file này. Hãy khôi phục từ một bản sao lưu bên dưới, hoặc từ file sao lưu bạn đã cất (USB/Drive)." }));
    var bar = h("div", { class: "bar" });
    bar.appendChild(btn("⬆ Khôi phục từ file…", "pri", function () { var f = h("input", { type: "file", accept: ".json" }); f.addEventListener("change", function () { var fr = new FileReader(); fr.onload = function () { restoreFromText(fr.result, f.files[0].name, { quarantine: true }); }; fr.readAsText(f.files[0]); }); f.click(); }));
    if (store) bar.appendChild(btn("📂 Mở thư mục dữ liệu", "", function () { store.openFolder(); }));
    bar.appendChild(btn("Bắt đầu với dữ liệu trống", "red", function () {
      if (!confirm("Cất file hỏng sang tên khác (KHÔNG xóa) và bắt đầu với dữ liệu trống?")) return;
      var q = store && store.quarantine && store.quarantine(); db = {}; readOnly = false; loadError = null; ensureTables(); saveNow(); render(); alert("File hỏng đã được giữ lại với tên: " + (q || "(không có)"));
    }));
    c.appendChild(bar);
    var list = (loadError.backups || []).slice(0, 30);
    if (list.length) {
      var t = h("table"), tr = h("tr"); ["Bản sao lưu", "Thời điểm", "Dung lượng", ""].forEach(function (x) { tr.appendChild(h("th", { text: x })); }); t.appendChild(h("thead", {}, [tr]));
      var tb = h("tbody");
      list.forEach(function (b) {
        var x = h("tr"); [b.name, fmtTime(b.mtime), Math.round(b.size / 1024) + " KB"].forEach(function (v) { x.appendChild(h("td", { class: "t", text: v })); });
        x.appendChild(h("td", {}, [btn("Khôi phục bản này", "pri", function () { var r = store.readBackup(b.name); if (!r.ok) { alert(r.error); return; } restoreFromText(r.text, b.name, { quarantine: true }); })]));
        tb.appendChild(x);
      });
      t.appendChild(tb); c.appendChild(h("div", { class: "tw" }, [t]));
    } else c.appendChild(h("div", { class: "empty", text: "Không tìm thấy bản sao lưu tự động." }));
    w.appendChild(c); return w;
  }
  function napMau() {
    if (!need("dm.edit", "nạp danh mục")) return;
    var sd = HRM.seedDanhMuc(), done = [], skip = [];
    Object.keys(sd).forEach(function (k) { if (!db[k].length) { db[k] = sd[k]; done.push(DM[k].ten); } else skip.push(DM[k].ten); });
    if (done.length) audit("Nạp danh mục chuẩn", done.join(", "));
    saveNow(); render();
    alert((done.length ? "Đã nạp: " + done.join(", ") + "\n" : "") + (skip.length ? "Giữ nguyên (đã có dữ liệu): " + skip.join(", ") + "\n" : "") + "\nSố liệu lấy theo danh mục thật của HAK (QL_NHANSU). Kế toán kiểm tra lại đơn giá, tỷ lệ BH, biểu thuế theo quy định hiện hành.");
  }

  // ---------- Khung & điều hướng ----------
  var NAV = [
    ["grp", "Bắt đầu"], ["home", "🏠", "Tổng quan"],
    ["grp", "Kỳ lương"], ["luong", "▶", "Tính lương"], ["bangtinh", "📋", "Bảng tính lương nội bộ"], ["kyluong", "🔒", "Kỳ lương đã chốt"], ["baocaoluong", "📈", "Báo cáo lương"], ["slips", "🧾", "Phiếu lương"], ["doichieu", "↔", "Đối chiếu Excel"],
    ["grp", "Nhập liệu hằng tháng"],
    ["chamcong", "🗓", "Chấm công"], ["sanluong", "⚖", "Sản lượng"], ["bandam", "🚛", "Bơm dăm"], ["psluong", "🎁", "Thưởng / Trừ"], ["ungluong", "💵", "Tạm ứng"], ["tiencom", "🍚", "Suất cơm"], ["ocr", "📷", "Đọc ảnh chấm công"], ["ocrlib", "🗂", "Thư viện mẫu OCR"],
    ["grp", "Dữ liệu gốc"],
    ["nhansu", "👥", "Nhân sự"], ["baocao", "📊", "Báo cáo nhân sự"], ["dm", "📚", "Danh mục"],
    ["grp", "Hệ thống"],
    ["backup", "⚙", "Công ty & Sao lưu"], ["huongdan", "📖", "Hướng dẫn & Quy chế"]
  ];
  // Tab nào cần quyền xem nào (kiểm tra cả khi mở bằng trạng thái đã lưu, không chỉ ẩn menu)
  var TAB_PERM = { ocr: "input.edit", ocrlib: "input.view", luong: "payroll.view", bangtinh: "payroll.view", slips: "payroll.view", kyluong: "payroll.view", baocaoluong: "payroll.view", doichieu: "payroll.view", nhansu: "hr.view", nv: "hr.view", baocao: "report.view" };
  function tabAllowed(t) {
    if (t === "home") return true;
    if (t === "backup") return can("system.admin") || can("backup.restore");
    if (t === "dm") return can("dm.edit") || can("payroll.view") || can("hr.view");
    if (S[t]) return can("input.view");
    return TAB_PERM[t] ? can(TAB_PERM[t]) : true;
  }
  var TITLES = { ocr: "Đọc ảnh bảng chấm công / chấm cơm (OCR)", ocrlib: "OCR & Chứng từ — Thư viện mẫu", home: "Tổng quan", luong: "Tính lương", bangtinh: "Bảng tính lương nội bộ", slips: "Phiếu lương", dm: "Danh mục", backup: "Công ty & Sao lưu", nhansu: "Nhân sự", nv: "Hồ sơ nhân viên", baocao: "Báo cáo nhân sự", kyluong: "Kỳ lương đã chốt", baocaoluong: "Báo cáo lương", doichieu: "Đối chiếu lương Power Query", huongdan: "Hướng dẫn & Quy chế lương" };
  function updateNav() { document.querySelectorAll("#nav button[data-k]").forEach(function (b) { var k = b.getAttribute("data-k"), n = $(".n", b); if (n && ALL[k]) n.textContent = countOf(k); }); }
  function periodBox() {
    var m = h("select"), y = h("input", { class: "i", type: "number", style: "width:80px", value: st.nam });
    for (var i = 1; i <= 12; i++) m.appendChild(h("option", { value: i, text: "Tháng " + i }));
    m.value = st.thang;
    var ch = function () { st.thang = +m.value; st.nam = +y.value || st.nam; st.kq = null; st.pg = {}; saveUi(); render(); };
    m.addEventListener("change", ch); y.addEventListener("change", ch);
    return h("div", { class: "period" }, [h("label", { text: "Kỳ lương" }), m, y]);
  }
  function sideFoot(ver) {
    var f = $("#sidefoot"); f.innerHTML = "";
    f.appendChild(h("button", { class: "themebtn", type: "button", on: { click: toggleTheme } }, [curTheme() === "dark" ? "🏖 Giao diện sáng" : "🌙 Giao diện tối"]));
    f.appendChild(h("div", { class: "ver", text: ver }));
  }
  function fold(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }
  /** Tìm nhanh (Ctrl+K): màn hình, nhân viên, báo cáo — gõ không dấu cũng được, Enter để mở. */
  function quickSearch() {
    if (!session || loadError) return;
    var items = [];
    NAV.forEach(function (n) { if (n[0] !== "grp" && tabAllowed(n[0])) items.push({ ic: n[1], t: n[2], s: "Màn hình", go: function () { st.tab = n[0]; } }); });
    if (tabAllowed("baocao")) BC.forEach(function (b) { items.push({ ic: "📊", t: b[1].replace(/^\S+\s/, ""), s: "Báo cáo nhân sự", go: function () { st.tab = "baocao"; st.bc = b[0]; } }); });
    if (tabAllowed("nv")) db.nhanvien.forEach(function (nv) { items.push({ ic: "👤", t: (nv["Mã NV"] || "") + " · " + (nv["Họ và tên"] || ""), s: nv["Trạng thái"] || "Nhân viên", go: function () { st.tab = "nv"; st.nv = nv["Mã NV"]; st.nvTab = "canhan"; } }); });
    items.push({ ic: "🌙", t: "Đổi giao diện sáng / tối", s: "Giao diện", go: null, act: toggleTheme });
    if (FILES) items.push({ ic: "📂", t: "File đã tải (Excel, báo cáo, phiếu lương)", s: "Mở file / thư mục", go: null, act: filesDrawer });
    items.forEach(function (it) { it.k = fold(it.t + " " + it.s); });
    var body = h("div", { class: "cmdk" }), inp = h("input", { type: "search", placeholder: "Gõ tên màn hình, mã / tên nhân viên, báo cáo… (không dấu cũng được)", "aria-label": "Tìm nhanh" }), ul = h("ul", { role: "listbox" });
    body.appendChild(inp); body.appendChild(ul);
    var close = modal("Tìm nhanh", body), shown = [], sel = 0;
    var open = function (it) { close(); if (it.act) { it.act(); return; } it.go(); saveUi(); render(); };
    var draw = function () {
      var q = fold(inp.value).trim().split(/\s+/).filter(Boolean);
      shown = items.filter(function (it) { return q.every(function (w) { return it.k.indexOf(w) >= 0; }); }).slice(0, 40);
      if (sel >= shown.length) sel = 0;
      ul.innerHTML = "";
      if (!shown.length) ul.appendChild(h("li", { class: "empty", text: "Không tìm thấy" }));
      shown.forEach(function (it, i) { ul.appendChild(h("li", {}, [h("button", { type: "button", class: i === sel ? "on" : "", on: { click: function () { open(it); } } }, [it.ic + " " + it.t, h("small", { text: it.s })])])); });
    };
    inp.addEventListener("input", function () { sel = 0; draw(); });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); draw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); draw(); }
      else if (e.key === "Enter" && shown[sel]) { e.preventDefault(); open(shown[sel]); }
      else if (e.key === "Escape") close();
    });
    draw(); setTimeout(function () { inp.focus(); }, 30);
  }
  // ---------- File đã tải (2.0-α16): Excel / báo cáo / phiếu lương lưu vào 1 thư mục, mở file hoặc mở thư mục ngay trong app ----------
  var FILES = window.hakFiles || null; // chỉ có ở bản cài (.exe); trình duyệt thì tải file theo cách của trình duyệt
  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function fileGone() { toast("Không còn file này trong thư mục lưu (đã bị xóa / đổi tên / chuyển đi)"); }
  function openFile(name) { if (!FILES.open(name)) fileGone(); }
  function showFile(name) { if (!FILES.show(name)) fileGone(); }
  /** Thẻ báo sau mỗi lần tải: tên file + nơi lưu + [Mở file] [Mở thư mục] */
  function downloadCard(info) {
    var old = $("#dlcard"); if (old) old.remove();
    var c = h("div", { id: "dlcard", class: info.ok ? "" : "bad", role: "status" });
    var close = function () { c.remove(); };
    if (info.ok) {
      c.appendChild(h("div", { class: "t" }, ["✓ Đã lưu file", btn("✕", "ghost", close)]));
      c.appendChild(h("div", { class: "nm", text: info.name, title: info.name }));
      c.appendChild(h("div", { class: "hint", text: "Tại: " + info.dir + (info.opened ? " — đã mở thư mục, chọn sẵn file" : "") }));
      c.appendChild(h("div", { class: "bar" }, [btn("📄 Mở file", "pri", function () { openFile(info.name); close(); }), btn("📂 Mở thư mục", "", function () { showFile(info.name); close(); }), btn("Xem file đã tải", "ghost", function () { close(); filesDrawer(); })]));
    } else {
      c.appendChild(h("div", { class: "t" }, ["⚠ Không lưu được file", btn("✕", "ghost", close)]));
      c.appendChild(h("div", { class: "hint", text: (info.name || "") + " — " + (info.state === "cancelled" ? "đã hủy" : "lỗi khi ghi file (thư mục lưu có thể không ghi được; đổi thư mục trong “File đã tải”)") }));
    }
    ($("#app") || document.body).appendChild(c); // trong #app: icon SVG tự đổi như các nút khác
    clearTimeout(downloadCard.t); downloadCard.t = setTimeout(close, 12000);
  }
  if (FILES) FILES.onDone(downloadCard);
  /** Ngăn "File đã tải": danh sách file trong thư mục lưu, mở / mở thư mục, đổi thư mục lưu */
  function filesDrawer() {
    if (!FILES) return;
    var body = h("div", { class: "files" }), closeFn = null;
    var draw = function () {
      var inf = FILES.info(); body.innerHTML = "";
      if (!inf || !inf.ok) { body.appendChild(h("div", { class: "warn", text: "Không đọc được thư mục lưu: " + ((inf && inf.error) || "") })); return; }
      body.appendChild(h("div", { class: "fdir" }, [h("span", { class: "hint", text: "Thư mục lưu" }), h("b", { text: inf.dir, title: inf.dir })]));
      var cb = h("input", { type: "checkbox" }); cb.checked = inf.openAfterDownload;
      cb.addEventListener("change", function () { FILES.setOpenAfter(cb.checked); toast(cb.checked ? "Tải xong sẽ tự mở thư mục" : "Tải xong chỉ báo trong app, không tự mở thư mục"); });
      body.appendChild(h("label", { class: "chk" }, [cb, " Tự mở thư mục (chọn sẵn file) sau mỗi lần tải"]));
      if (!inf.files.length) { body.appendChild(h("div", { class: "empty", text: "Chưa có file nào. Bấm xuất Excel / báo cáo / phiếu lương — file sẽ lưu vào thư mục trên." })); return; }
      var ul = h("ul", { class: "flist" });
      inf.files.forEach(function (f) {
        var ext = (f.name.split(".").pop() || "").toLowerCase();
        ul.appendChild(h("li", {}, [h("span", { class: "fx x-" + ext, text: ext.toUpperCase() }),
          h("div", { class: "fm" }, [h("b", { text: f.name, title: f.name }), h("small", { text: fmtTime(f.mtime) + " · " + fmtSize(f.size) })]),
          btn("Mở", "", function () { openFile(f.name); }, "Mở bằng Excel / ứng dụng mặc định"), btn("📂", "ghost", function () { showFile(f.name); }, "Mở thư mục, chọn sẵn file này")]));
      });
      body.appendChild(ul);
    };
    draw();
    closeFn = modal("📂 File đã tải", body, function (close) {
      return [btn("📂 Mở thư mục", "pri", function () { if (!FILES.openDir()) toast("Không mở được thư mục"); }),
        btn("Đổi thư mục lưu…", "", function () { var r = FILES.chooseDir(); if (r && r.ok) { toast("Từ giờ file lưu vào: " + r.dir); audit("Đổi thư mục lưu file xuất", ""); draw(); } else if (r && r.error) toast(r.error); }),
        btn("Dùng thư mục mặc định", "ghost", function () { var r = FILES.resetDir(); if (r && r.ok) { toast("Dùng thư mục mặc định: " + r.dir); draw(); } }),
        btn("Đóng", "", close)];
    }, { drawer: true });
    return closeFn;
  }
  /** Báo quyền hiện tại cho tiến trình chính (GĐ6) — chỉ gửi khi đổi; đăng xuất/khóa tài khoản → danh sách rỗng. */
  var sessSig = null;
  function syncSession() {
    if (!store || !store.session) return;
    var r = session && !session.khoa ? PERM.roleOf(session) : null, list = r ? r.perms.slice().sort() : [], sig = list.join(",");
    if (sig === sessSig) return;
    try { var ok = store.session(list); if (ok && ok.ok) sessSig = sig; } catch (e) { /* thử lại lần vẽ sau */ }
  }
  function render() {
    syncSession();
    try { renderInner(); }
    catch (e) {
      var m = $("#main"); if (!m) return;
      m.innerHTML = "";
      m.appendChild(h("div", { class: "card" }, [h("h3", { text: "⚠ Có lỗi khi hiển thị màn hình này" }),
        h("div", { class: "warn", text: String(e && e.message || e) }),
        h("div", { class: "hint", text: "Dữ liệu KHÔNG bị mất. Hãy quay về Trang chủ; nếu lỗi lặp lại, bấm Sao lưu ra file và gửi file + ảnh màn hình cho người hỗ trợ." }),
        h("div", { class: "bar" }, [btn("🏠 Về Trang chủ", "pri", function () { st.tab = "home"; render(); }), btn("⬇ Sao lưu ra file", "", function () { if (!need("backup.restore", "sao lưu toàn bộ dữ liệu ra file")) return; download("LuongHAK_backup_" + new Date().toISOString().slice(0, 10) + ".json", "application/json", JSON.stringify(db)); if (store && store.noteExternal) store.noteExternal(); })])]));
      if (window.console) console.error(e);
    }
  }
  function renderInner() {
    applyTheme(curTheme());
    if (loadError) { $("#nav").innerHTML = ""; $("#top").innerHTML = "<h2>Khôi phục dữ liệu</h2>"; var mm = $("#main"); mm.innerHTML = ""; mm.appendChild(recoveryScreen()); return; }
    if (!session) {
      // Chưa đăng nhập: không hiện menu, không hiện dữ liệu nào
      $("#nav").innerHTML = ""; var t0 = $("#top"); t0.innerHTML = ""; t0.appendChild(h("h2", { text: !(db.nguoidung || []).length ? "Thiết lập ban đầu" : "Đăng nhập" }));
      var m0 = $("#main"); m0.innerHTML = "";
      m0.appendChild(!(db.nguoidung || []).length ? setupAdminScreen() : st.authView === "recover" ? recoverAdminScreen() : loginScreen());
      sideFoot("v2.0.0-alpha.22"); return;
    }
    if (!tabAllowed(st.tab)) st.tab = "home";
    var nav = $("#nav"); nav.innerHTML = "";
    var activeNav = st.tab === "slips" && st.kqFull ? "luong" : (st.tab === "nv" ? "nhansu" : st.tab);
    NAV.forEach(function (n, i) {
      if (n[0] === "grp") {
        // Nhóm không còn mục nào người này được xem thì không hiện tiêu đề nhóm
        for (var j = i + 1; j < NAV.length && NAV[j][0] !== "grp"; j++) if (tabAllowed(NAV[j][0])) { nav.appendChild(h("div", { class: "grp", text: n[1] })); break; }
        return;
      }
      if (!tabAllowed(n[0])) return;
      var b = h("button", { class: activeNav === n[0] ? "on" : "", "data-k": n[0], on: { click: function () { if (st.kqFull) { st.kq = st.kqFull; st.kqFull = null; } st.tab = n[0]; saveUi(); render(); } } }, [h("span", { class: "ic", text: n[1] }), h("span", { text: n[2] })]);
      if (S[n[0]]) b.appendChild(h("span", { class: "n", text: countOf(n[0]) }));
      if (n[0] === "kyluong") b.appendChild(h("span", { class: "n", text: db.kyluong.length }));
      if (n[0] === "nhansu") b.appendChild(h("span", { class: "n", text: db.nhanvien.filter(function (r) { return r["Trạng thái"] !== "Đã nghỉ việc"; }).length }));
      nav.appendChild(b);
    });
    sideFoot("v2.0.0-alpha.22 · " + (store ? "Tự lưu ra file trên máy" : "Dữ liệu lưu trong trình duyệt"));
    var bb = $(".brand small"); if (bb) bb.textContent = congTy()["Tên công ty"] || "Chạy offline";
    var top = $("#top"); top.innerHTML = "";
    var title = TITLES[st.tab] || (S[st.tab] && S[st.tab].ten) || "";
    top.appendChild(h("h2", { text: title }));
    top.appendChild(h("button", { class: "topbtn srch", type: "button", "aria-label": "Tìm kiếm", title: "Tìm nhanh màn hình, nhân viên, báo cáo (Ctrl+K)", on: { click: quickSearch } }, ["🔍 Tìm kiếm", h("kbd", { text: "Ctrl K" })]));
    if (["nhansu", "nv", "dm", "backup", "kyluong"].indexOf(st.tab) < 0) top.appendChild(periodBox());
    if (FILES) top.appendChild(h("button", { class: "topbtn", type: "button", "data-files": "1", title: "Xem / mở các file Excel, báo cáo đã tải", on: { click: filesDrawer } }, ["📂 File đã tải"]));
    var roleName = (PERM.ROLES[session.vaiTro] || {}).ten || "vai trò không hợp lệ — liên hệ Admin";
    top.appendChild(h("span", { class: "who", text: roleName, title: session.hoTen + " · " + roleName, "data-user": session.tenDangNhap }));
    top.appendChild(h("button", { class: "topbtn icon", type: "button", title: "Đổi mật khẩu của " + session.hoTen, "aria-label": "Đổi mật khẩu", on: { click: function () { changePassword(false); } } }, ["🔑"]));
    top.appendChild(h("button", { class: "topbtn", type: "button", on: { click: function () { logout(); } } }, ["Đăng xuất"]));
    top.appendChild(h("button", { class: "topbtn icon", type: "button", title: "Đổi giao diện sáng / tối", "aria-label": "Đổi giao diện sáng / tối", on: { click: toggleTheme } }, [curTheme() === "dark" ? "🏖" : "🌙"]));
    var m = $("#main"); m.innerHTML = ""; refreshNVList();
    if (st.tab === "home") m.appendChild(tabHome());
    else if (st.tab === "luong") m.appendChild(tabLuong());
    else if (st.tab === "bangtinh") m.appendChild(tabBangTinhNoiBo());
    else if (st.tab === "slips") m.appendChild(tabSlips());
    else if (st.tab === "ocr") m.appendChild(tabOCR());
    else if (st.tab === "ocrlib") m.appendChild(tabOcrLib());
    else if (st.tab === "backup") m.appendChild(tabSaoLuu());
    else if (st.tab === "dm") m.appendChild(tabDanhMuc());
    else if (st.tab === "nhansu") m.appendChild(tabNhanSu());
    else if (st.tab === "nv") m.appendChild(tabNhanVien());
    else if (st.tab === "baocao") m.appendChild(tabBaoCao());
    else if (st.tab === "kyluong") m.appendChild(tabKyLuong());
    else if (st.tab === "baocaoluong") m.appendChild(tabBaoCaoLuong());
    else if (st.tab === "doichieu") m.appendChild(tabDoiChieu());
    else if (st.tab === "huongdan") m.appendChild(tabHuongDan());
    else if (S[st.tab]) m.appendChild(grid(st.tab, S[st.tab]));
    else { st.tab = "home"; render(); }
  }
  if (window.HAKIcons) { window.HAKIcons.watch($("#app")); window.HAKIcons.watch($("#modal")); }
  render();
  if (migMsg.length) setTimeout(function () { alert("Đã nâng cấp dữ liệu:\n- " + migMsg.join("\n- ")); }, 300);
})();
