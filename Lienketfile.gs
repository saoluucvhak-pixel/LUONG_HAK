// ================= LIÊN KẾT 5 FILE GOOGLE SHEET =================
// Toàn bộ hệ thống giờ trải trên 5 Google Sheet riêng biệt thay vì 1 file duy
// nhất — xem giải thích đầy đủ ở đầu Code.gs. File này chịu trách nhiệm:
//   1. Biết ID thật của mỗi trong 5 file (đọc từ PropertiesService — cấu hình
//      qua webapp — hoặc từ 5 hằng số SPREADSHEET_ID_* trong Code.gs nếu chưa
//      cấu hình qua webapp).
//   2. Biết 1 sheet (vd "NL_NHANSU") thuộc file nào trong 5 file đó.
//   3. Mở đúng file đó khi bất kỳ hàm nào cần đọc/ghi sheet.

const LOAI_FILE_DANHMUC = "DANHMUC";
const LOAI_FILE_DRAFT = "DRAFT";
const LOAI_FILE_DATA = "DATA";
const LOAI_FILE_XULY = "XULY";
const LOAI_FILE_LUUTRU = "LUUTRU";

const TEN_HIEN_THI_LOAI_FILE_ = {
  DANHMUC: "Danh mục", DRAFT: "Draft", DATA: "Data", XULY: "Xử lý", LUUTRU: "Lưu trữ"
};

/** Bản đồ: tên sheet (hằng số SHEET_*) → loại file (1 trong 5 loại ở trên) chứa nó. */
const FILE_CUA_SHEET_ = (function () {
  const map = {};
  const ganNhom = function (danhSachSheet, loai) {
    danhSachSheet.forEach(function (ten) { map[ten] = loai; });
  };
  ganNhom([
    SHEET_DM_PHONGBAN, SHEET_DM_CHUCVU, SHEET_DM_LUONG, SHEET_DM_PHUCAP, SHEET_DM_CHIPHI,
    SHEET_DM_TANGCA, SHEET_DM_HOTRO, SHEET_DM_BAOHIEM, SHEET_DM_TNCN, SHEET_DM_GTTNCN
  ], LOAI_FILE_DANHMUC);
  ganNhom([SHEET_NHAP_CHAMCONG, SHEET_NHAP_SANLUONG, SHEET_NHAP_UNGLUONG, SHEET_NHAP_PSLUONG], LOAI_FILE_DRAFT);
  ganNhom([
    SHEET_THAMSO, SHEET_NHANSU, SHEET_CHITIETNS, SHEET_CHAMCONG,
    SHEET_PSLUONG, SHEET_UNGLUONG, SHEET_SANLUONG, SHEET_BANDAM, SHEET_TIENCOM
  ], LOAI_FILE_DATA);
  ganNhom([
    SHEET_BANGLUONG, SHEET_BHXH, SHEET_TNCN, SHEET_KIEMTRA_LOG,
    SHEET_BC_CHAMCONG, SHEET_BC_PHANBOSL, SHEET_HACHTOAN, SHEET_PHIEUCHI
  ], LOAI_FILE_XULY);
  return map;
})();

/** ID mặc định (từ Code.gs) theo từng loại file — dùng khi chưa cấu hình qua webapp. */
function idMacDinhTheoLoai_(loai) {
  const banDo = {
    DANHMUC: SPREADSHEET_ID_DANHMUC, DRAFT: SPREADSHEET_ID_DRAFT, DATA: SPREADSHEET_ID_DATA,
    XULY: SPREADSHEET_ID_XULY, LUUTRU: SPREADSHEET_ID_LUUTRU
  };
  return banDo[loai];
}

/** Tách ID Google Sheet ra khỏi URL đầy đủ (hoặc trả về nguyên văn nếu đã là ID). */
function trichIdTuUrl_(urlHoacId) {
  const s = String(urlHoacId || "").trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s;
}

/**
 * Lấy ID thật của 1 loại file — ƯU TIÊN giá trị đã cấu hình qua webapp
 * (PropertiesService), nếu chưa có thì dùng hằng số mặc định trong Code.gs.
 * Báo lỗi rõ ràng nếu CẢ HAI đều chưa cấu hình.
 */
function layIdFile_(loai) {
  const tuThuocTinh = PropertiesService.getScriptProperties().getProperty("ID_FILE_" + loai);
  if (tuThuocTinh) return tuThuocTinh;
  const macDinh = idMacDinhTheoLoai_(loai);
  if (!macDinh || macDinh.indexOf("DÁN_ID") === 0) {
    throw new Error(
      "Chưa cấu hình ID cho File " + (TEN_HIEN_THI_LOAI_FILE_[loai] || loai) +
      " — vào tab \"Hướng dẫn sử dụng\" → \"Cài đặt liên kết file\" trên webapp để dán URL/ID, " +
      "hoặc sửa trực tiếp hằng số SPREADSHEET_ID_" + loai + " trong Code.gs."
    );
  }
  return macDinh;
}

/** Lưu ID (hoặc URL — tự tách ID) cho 1 loại file, qua PropertiesService. */
function datIdFile_(loai, urlHoacId) {
  const id = trichIdTuUrl_(urlHoacId);
  if (!id) throw new Error("URL/ID trống — không lưu được.");
  // Thử mở thật để xác nhận ID hợp lệ TRƯỚC khi lưu — tránh lưu nhầm ID sai
  // khiến các thao tác sau đó lỗi khó hiểu.
  try {
    SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error("Không mở được Google Sheet với ID/URL này — kiểm tra lại đã đúng chưa, và tài khoản chạy Apps Script có quyền truy cập file đó không.");
  }
  PropertiesService.getScriptProperties().setProperty("ID_FILE_" + loai, id);
  return id;
}

/** Xem toàn bộ cấu hình liên kết hiện tại (ID + đã cấu hình qua webapp hay đang dùng mặc định). */
function xemCauHinhLienKetFile() {
  return Object.keys(TEN_HIEN_THI_LOAI_FILE_).map(function (loai) {
    const tuThuocTinh = PropertiesService.getScriptProperties().getProperty("ID_FILE_" + loai);
    const macDinh = idMacDinhTheoLoai_(loai);
    const idDangDung = tuThuocTinh || (macDinh && macDinh.indexOf("DÁN_ID") !== 0 ? macDinh : "");
    return {
      loai: loai, tenHienThi: TEN_HIEN_THI_LOAI_FILE_[loai],
      idDangDung: idDangDung,
      nguon: tuThuocTinh ? "webapp" : (idDangDung ? "code" : "chưa cấu hình"),
      url: idDangDung ? ("https://docs.google.com/spreadsheets/d/" + idDangDung + "/edit") : ""
    };
  });
}

/**
 * ⚠ TỐI ƯU HIỆU SUẤT — CACHE trong bộ nhớ: `SpreadsheetApp.openById()` là thao
 * tác MẠNG (chậm, mỗi lần gọi tốn khoảng vài trăm ms) — nếu không cache, 1 lần
 * "Tính lương" sẽ gọi openById() cho File Danh mục ~9 lần, File Data ~8 lần
 * (mỗi hàm docDanhMuc*_()/tongHop*_() đọc 1 sheet lại tự mở file 1 lần) — tổng
 * cộng ~20 lần mở file dù thực chất chỉ có 3 file khác nhau được dùng. Biến
 * `_cacheFile_` là biến top-level, tồn tại suốt 1 LẦN THỰC THI (1 request) của
 * Apps Script rồi mất đi khi request kết thúc — nên cache AN TOÀN (không lo dữ
 * liệu cache "cũ" giữa các lần bấm nút khác nhau của người dùng), chỉ tránh mở
 * lại file nhiều lần THỪA THÃI trong cùng 1 request.
 */
const _cacheFile_ = {};
function moSheetTheoIdCache_(id) {
  if (!_cacheFile_[id]) {
    _cacheFile_[id] = SpreadsheetApp.openById(id);
  }
  return _cacheFile_[id];
}

/**
 * Mở ĐÚNG Google Sheet (Spreadsheet object) chứa 1 tên sheet cho trước — dùng
 * bởi mọi hàm đọc/ghi (layHoacTaoSheet_, docSheetThanhObject_, timHangTheoMa_
 * ở Code.gs). Đây là hàm TRUNG TÂM của toàn bộ kiến trúc 5 file.
 */
function moSheetChoBang_(tenSheet) {
  const loai = FILE_CUA_SHEET_[tenSheet];
  if (!loai) {
    throw new Error("Không xác định được sheet \"" + tenSheet + "\" thuộc file nào trong 5 file — kiểm tra lại bản đồ FILE_CUA_SHEET_ trong LienKetFile.gs (có thể là sheet mới thêm nhưng quên khai báo).");
  }
  return moSheetTheoIdCache_(layIdFile_(loai));
}

/** Mở thẳng 1 trong 5 file theo LOẠI (không cần biết tên sheet cụ thể) — dùng cho thao tác toàn-file như Lưu trữ. */
function moFileTheoLoai_(loai) {
  return moSheetTheoIdCache_(layIdFile_(loai));
}
