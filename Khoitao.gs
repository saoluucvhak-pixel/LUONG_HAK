// ================= KHỞI TẠO CẤU TRÚC GOOGLE SHEET (5 FILE) =================
// Chạy 1 LẦN DUY NHẤT khi bắt đầu dùng webapp cho 1 đơn vị mới (hoặc bất cứ lúc
// nào muốn tạo lại các sheet còn thiếu) — tự tạo ĐỦ toàn bộ sheet theo đúng cấu
// trúc, RẢI ĐÚNG VÀO 5 FILE (Danh mục/Draft/Data/Xử lý/Lưu trữ — xem
// LienKetFile.gs), đúng thứ tự trong từng file, có định dạng tiêu đề (đậm, nền
// màu, đóng băng dòng 1) — thay vì để mỗi sheet tự được tạo rời rạc khi lần đầu
// được truy cập.
//
// ⚠️ ĐIỀU KIỆN TIÊN QUYẾT: phải cấu hình đủ ID của cả 5 file TRƯỚC khi chạy hàm
// này (tab "Hướng dẫn sử dụng" → "Cài đặt liên kết file" trên webapp, hoặc sửa
// trực tiếp 5 hằng số SPREADSHEET_ID_* trong Code.gs) — nếu thiếu file nào,
// hàm sẽ báo lỗi rõ tên file đó thay vì tạo nhầm vào sai chỗ.
//
// Cách chạy: mở Apps Script Editor (gắn vào FILE XỬ LÝ — xem Mục 1
// HUONG_DAN_WEBAPP.md) → chọn hàm `khoiTaoTatCaSheet` → bấm Run (▶) — hoặc mở
// File Xử lý trên Google Sheet, vào menu tuỳ chỉnh "⚙️ HAK Group" (tự hiện sau
// khi mở lại Sheet nhờ onOpen()) → "Khởi tạo cấu trúc bảng".

/** Danh sách đầy đủ mọi sheet cần có, ĐÚNG THỨ TỰ mong muốn hiển thị trong từng file. */
function danhSachSheetCanTao_() {
  return [
    // ---- File DATA: dữ liệu vào ----
    { ten: SHEET_THAMSO, header: HEADER_THAMSO, mau: "#d9ead3" },
    { ten: SHEET_NHANSU, header: HEADER_NHANSU, mau: "#d9ead3" },
    { ten: SHEET_CHITIETNS, header: HEADER_CHITIETNS, mau: "#d9ead3" },
    { ten: SHEET_CHAMCONG, header: headerChamCongDayDu_(), mau: "#d9ead3" },
    { ten: SHEET_PSLUONG, header: HEADER_PSLUONG, mau: "#d9ead3" },
    { ten: SHEET_UNGLUONG, header: HEADER_UNGLUONG, mau: "#d9ead3" },
    { ten: SHEET_SANLUONG, header: HEADER_SANLUONG, mau: "#d9ead3" },
    { ten: SHEET_BANDAM, header: HEADER_BANDAM, mau: "#d9ead3" },
    { ten: SHEET_TIENCOM, header: HEADER_TIENCOM, mau: "#d9ead3" },
    // ---- File DANH MỤC ----
    { ten: SHEET_DM_PHONGBAN, header: HEADER_DM_PHONGBAN, mau: "#fce5cd" },
    { ten: SHEET_DM_CHUCVU, header: HEADER_DM_CHUCVU, mau: "#fce5cd" },
    { ten: SHEET_DM_LUONG, header: HEADER_DM_LUONG, mau: "#fce5cd" },
    { ten: SHEET_DM_PHUCAP, header: HEADER_DM_PHUCAP, mau: "#fce5cd" },
    { ten: SHEET_DM_TANGCA, header: HEADER_DM_TANGCA, mau: "#fce5cd" },
    { ten: SHEET_DM_HOTRO, header: HEADER_DM_HOTRO, mau: "#fce5cd" },
    { ten: SHEET_DM_BAOHIEM, header: HEADER_DM_BAOHIEM, mau: "#fce5cd" },
    { ten: SHEET_DM_TNCN, header: HEADER_DM_TNCN, mau: "#fce5cd" },
    { ten: SHEET_DM_GTTNCN, header: HEADER_DM_GTTNCN, mau: "#fce5cd" },
    // ---- File XỬ LÝ: đầu ra (webapp tự ghi, để trống lúc khởi tạo) ----
    { ten: SHEET_BANGLUONG, header: HEADER_BANGLUONG, mau: "#cfe2f3" },
    { ten: SHEET_BHXH, header: HEADER_BHXH, mau: "#cfe2f3" },
    { ten: SHEET_TNCN, header: HEADER_TNCN, mau: "#cfe2f3" },
    { ten: SHEET_BC_CHAMCONG, header: HEADER_BC_CHAMCONG, mau: "#cfe2f3" },
    { ten: SHEET_BC_PHANBOSL, header: HEADER_BC_PHANBOSL, mau: "#cfe2f3" },
    { ten: SHEET_HACHTOAN, header: HEADER_HACHTOAN, mau: "#cfe2f3" },
    { ten: SHEET_PHIEUCHI, header: HEADER_PHIEUCHI, mau: "#cfe2f3" },
    { ten: SHEET_KIEMTRA_LOG, header: HEADER_KIEMTRA_LOG, mau: "#cfe2f3" }
    // (File DRAFT không cần khởi tạo sẵn — 3 sheet NHAP_* tự tạo khi Nhập liệu
    // lần đầu, và bị xoá ngay sau khi Xác nhận nạp/Hủy — xem NhapLieu.gs)
  ];
}

/**
 * Khởi tạo TOÀN BỘ sheet còn thiếu TRÊN CẢ 5 FILE, định dạng tiêu đề, sắp đúng
 * thứ tự TRONG TỪNG FILE. An toàn khi chạy nhiều lần — sheet đã có dữ liệu sẽ
 * KHÔNG bị đụng tới (chỉ tạo mới sheet nào chưa tồn tại; sheet đã tồn tại chỉ
 * được chỉnh lại định dạng tiêu đề, không xoá/ghi đè dữ liệu bên trong).
 * @return {{ daTao: string[], daCoSan: string[] }}
 */
function khoiTaoTatCaSheet() {
  const danhSach = danhSachSheetCanTao_();
  const daTao = [];
  const daCoSan = [];

  // Nhóm theo file để mở đúng 1 lần/file (không mở lại nhiều lần cho mỗi sheet)
  const theoFile = {};
  danhSach.forEach(function (muc) {
    const loai = FILE_CUA_SHEET_[muc.ten];
    if (!theoFile[loai]) theoFile[loai] = [];
    theoFile[loai].push(muc);
  });

  Object.keys(theoFile).forEach(function (loai) {
    const ss = moFileTheoLoai_(loai);
    // ⚠ QUAN TRỌNG: tạo/lấy sheet TRỰC TIẾP qua CHÍNH đối tượng `ss` này (KHÔNG
    // gọi layHoacTaoSheet_ ở đây) — nếu tạo/lấy qua 1 đường tra cứu file khác,
    // dù trỏ đúng cùng 1 file thật, `setActiveSheet()` vẫn có thể báo lỗi
    // "Specified sheet must be part of the spreadsheet" do không cùng 1 instance
    // Spreadsheet trong bộ nhớ (đã gặp lỗi này thật — sửa bằng cách dùng chung
    // đúng 1 `ss` xuyên suốt từ lúc tạo sheet tới lúc setActiveSheet).
    theoFile[loai].forEach(function (muc, idx) {
      let sh = ss.getSheetByName(muc.ten);
      const daTonTai = !!sh;
      if (!sh) {
        sh = ss.insertSheet(muc.ten);
        sh.getRange(1, 1, 1, muc.header.length).setValues([muc.header]);
        sh.setFrozenRows(1);
      }
      dinhDangTieuDe_(sh, muc.header.length, muc.mau);
      try {
        ss.setActiveSheet(sh);
        ss.moveActiveSheet(idx + 1);
      } catch (e) {
        // Sắp xếp vị trí chỉ là "cho đẹp" — nếu lỗi (vd quyền hạn chế, hoặc
        // đang mở file bằng người khác), KHÔNG dừng cả quá trình khởi tạo, sheet
        // vẫn được tạo/định dạng đúng, chỉ là thứ tự tab có thể chưa như ý.
      }
      if (daTonTai) daCoSan.push(muc.ten); else daTao.push(muc.ten);
    });
    xoaSheetMacDinhRong_(ss);
  });

  return { daTao: daTao, daCoSan: daCoSan };
}

/** Bôi đậm + tô màu + đóng băng dòng tiêu đề, canh độ rộng cột vừa phải. */
function dinhDangTieuDe_(sh, soCot, mauNen) {
  const rangeTieuDe = sh.getRange(1, 1, 1, soCot);
  rangeTieuDe.setFontWeight("bold");
  if (mauNen) rangeTieuDe.setBackground(mauNen);
  sh.setFrozenRows(1);
  // Độ rộng cột vừa phải cho dễ đọc (không set quá to để khỏi phải cuộn ngang nhiều)
  try { sh.autoResizeColumns(1, Math.min(soCot, 40)); } catch (e) { /* bỏ qua nếu sheet quá nhiều cột (vd chấm công 38 cột) */ }
}

/** Xoá "Sheet1"/"Trang tính1" mặc định của Google Sheet nếu nó đang trống hoàn toàn. */
function xoaSheetMacDinhRong_(ss) {
  ["Sheet1", "Trang tính1"].forEach(function (ten) {
    const sh = ss.getSheetByName(ten);
    if (sh && sh.getLastRow() === 0 && sh.getLastColumn() === 0 && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  });
}

/**
 * Tự thêm menu tuỳ chỉnh vào Google Sheet mỗi khi mở file — tiện chạy khởi tạo mà
 * không cần mở Apps Script Editor. CHỈ hiện khi mở FILE ĐANG GẮN Apps Script
 * project này (khuyến nghị gắn vào File Xử lý — xem Mục 1 HUONG_DAN_WEBAPP.md).
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("⚙️ HAK Group")
    .addItem("Khởi tạo cấu trúc bảng (cả 5 file)", "menuKhoiTaoTatCaSheet_")
    .addItem("Khởi tạo Quy chế lương hiện hành", "menuKhoiTaoQuyCheLuongHienHanh_")
    .addItem("Khởi tạo dữ liệu danh mục mẫu", "menuKhoiTaoDanhMucMau_")
    .addToUi();
}

function menuKhoiTaoTatCaSheet_() {
  try {
    const kq = khoiTaoTatCaSheet();
    SpreadsheetApp.getUi().alert(
      "Đã tạo mới " + kq.daTao.length + " sheet: " + (kq.daTao.join(", ") || "(không có, đã có sẵn hết)") +
      "\nĐã có sẵn (giữ nguyên): " + kq.daCoSan.length + " sheet."
    );
  } catch (e) {
    SpreadsheetApp.getUi().alert("Lỗi: " + e.message);
  }
}

function menuKhoiTaoQuyCheLuongHienHanh_() {
  const kq = khoiTaoQuyCheLuongHienHanh(false);
  SpreadsheetApp.getUi().alert(
    "Đã khởi tạo Quy chế lương hiện hành cho: " + (kq.daKhoiTao.join(", ") || "(không có)") +
    "\nBỏ qua (đã có dữ liệu sẵn): " + (kq.daBoQua.join(", ") || "(không có)")
  );
}

function menuKhoiTaoDanhMucMau_() {
  const kq = khoiTaoDanhMucMau(false);
  SpreadsheetApp.getUi().alert(
    "Đã khởi tạo dữ liệu mẫu cho: " + (kq.daKhoiTao.join(", ") || "(không có)") +
    "\nBỏ qua (đã có dữ liệu sẵn): " + (kq.daBoQua.join(", ") || "(không có)")
  );
}
