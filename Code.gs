// ================= CẤU HÌNH THÔNG SỐ HỆ THỐNG =================
// ⚠️ Thay ID Google Sheet của bạn vào đây trước khi dùng.
// Lấy ID trong URL của Sheet: docs.google.com/spreadsheets/d/<ID_NÀY>/edit
const SPREADSHEET_ID = "1AsilXeDTZ-Q2psgNitrrCceKF__M0_14eXMHqL2oB-4";   

// Mỗi ĐƠN VỊ x KỲ LƯƠNG nên dùng 1 Google Sheet riêng (đúng như 2 file Excel
// "DL_LUONG_<đơn vị>_<kỳ>" + "Luong<kỳ>_<đơn vị>" hiện tại của HAK Group) —
// webapp này gộp cả 2 vai trò (dữ liệu vào + tính toán + kiểm tra) vào 1 Sheet.

// ---------- TÊN CÁC SHEET (TAB) ----------
// Nhóm A — DỮ LIỆU VÀO (người dùng tự nhập tay hoặc import từ file Excel cũ)
const SHEET_THAMSO = "NL_THAMSO";
const SHEET_NHANSU = "NL_NHANSU";
const SHEET_CHITIETNS = "NL_CHITIET_NS";
const SHEET_CHAMCONG = "NL_CHAMCONG";
const SHEET_PSLUONG = "NL_PSLUONG";
const SHEET_UNGLUONG = "NL_UNGLUONG";
const SHEET_SANLUONG = "DL_SANLUONG";
const SHEET_BANDAM = "DL_BANDAM";
const SHEET_TIENCOM = "DL_TIENCOM";

// Nhóm B — DANH MỤC (quy định tính lương, sửa khi công ty đổi chính sách)
const SHEET_DM_LUONG = "DM_LUONG";
const SHEET_DM_PHUCAP = "DM_PHUCAP";
const SHEET_DM_TANGCA = "DM_TANGCA";
const SHEET_DM_HOTRO = "DM_HOTRO";
const SHEET_DM_BAOHIEM = "DM_BAOHIEM";
const SHEET_DM_TNCN = "DM_TNCN";
const SHEET_DM_GTTNCN = "DM_GT_TNCN";
const SHEET_DM_PHONGBAN = "DM_PHONGBAN";
const SHEET_DM_CHUCVU = "DM_CHUCVU";

// Nhóm C — ĐẦU RA (webapp tự tạo/ghi đè mỗi lần chạy)
const SHEET_BANGLUONG = "RP_BANGLUONG";
const SHEET_BHXH = "RP_BHXH";
const SHEET_TNCN = "RP_THUETNCN";
const SHEET_KIEMTRA_LOG = "KIEMTRA_LOG";

// Nhóm D — BẢNG NHÁP (tạm thời, xoá sau khi Xác nhận nạp hoặc Hủy — xem NhapLieu.gs)
const SHEET_NHAP_CHAMCONG = "NHAP_CHAMCONG";
const SHEET_NHAP_SANLUONG = "NHAP_SANLUONG";

// ---------- TIÊU ĐỀ CỘT (HEADER) — dùng để tự tạo sheet nếu chưa có ----------

const HEADER_THAMSO = [
  "Đơn vị", "Năm", "Tháng", "Ngày tính lương", "Kỳ tính lương",
  "Số ngày trong tháng", "Số CN trong tháng"
];

const HEADER_NHANSU = [
  "Ngày cập nhật", "Mã nhân viên", "Họ và tên", "Mã PB", "Mã CV",
  "Ngày vào làm", "Ngày hết hạn HĐ", "Ngày nghỉ/thay đổi",
  "Lương cơ bản", "Lương thỏa thuận", "Hình thức hợp đồng",
  "Mã tiền lương 1", "Mã tiền lương 2", "Mã tăng ca", "Mã phụ cấp",
  "Mã hỗ trợ", "Mã hỗ trợ 2", "Mã BHXH", "Mã TNCN"
];

const HEADER_CHITIETNS = [
  "Ngày cập nhật", "Mã nhân viên", "Họ và tên", "Ngày sinh", "Thường trú",
  "Ngày cấp CCCD", "Nơi cấp", "Mã BHXH", "Số điện thoại", "Số HĐLĐ",
  "Mã GT_TNCN_BT", "Mã GT_TNCN_PT", "Người phụ thuộc",
  "Số tài khoản", "Tên Ngân hàng"
];

// 01..31 = số công thực tế của từng ngày trong tháng (0/0.5/1/2/3 tuỳ đơn vị quy định)
const HEADER_CHAMCONG_CO_DINH = [
  "TT", "Ngày tính công", "Mã PB", "Mã CV", "Mã NV", "Họ và tên", "Hình thức công"
];
function headerChamCongDayDu_() {
  const cols = [];
  for (let i = 1; i <= 31; i++) cols.push(("0" + i).slice(-2));
  return HEADER_CHAMCONG_CO_DINH.concat(cols);
}

const HEADER_PSLUONG = [
  "Ngày hạch toán", "Mã NV", "Người nhận", "Diễn giải",
  "Tài khoản", "TK đối ứng", "Thưởng", "Thu nhập khác", "Trừ khác"
];

const HEADER_UNGLUONG = [
  "Ngày hạch toán", "Số phiếu chi", "Mã NV", "Người nhận", "Diễn giải",
  "Tài khoản", "TK đối ứng", "Tạm ứng", "Thanh toán TM"
];

const HEADER_SANLUONG = [
  "Phiếu cân", "Ngày cân", "Giờ cân", "Biển số", "Cân lần 1", "Cân lần 2",
  "KL hàng (Tấn)", "Mã phòng ban", "Mã NV" // "Mã NV": để trống nếu 1 phiếu cân
  // cần chia cho nhiều người — khi đó nhập nhiều dòng cùng Phiếu cân, khác Mã NV,
  // và tự chia KL hàng theo tỷ lệ ở bước tính (xem TinhLuong.gs).
];

const HEADER_BANDAM = HEADER_SANLUONG; // cùng cấu trúc, dùng cho hoạt động bơm dăm

const HEADER_TIENCOM = ["Ngày", "Mã NV", "Số suất cơm", "Ghi chú"];

const HEADER_DM_LUONG = [
  "Ngày cập nhật", "Mã lương", "Mã hình thức lương", "Hình thức lương",
  "Số tiền khoán", "Lương phụ", "Ngưỡng truy thu BH (công)",
  "ĐK_Bù lương (công tối thiểu)", "Đơn giá bù lương", "Đơn giá bơm dăm", "Cách tính"
];

const HEADER_DM_PHUCAP = [
  "Ngày cập nhật", "Mã phụ cấp", "Tên phụ cấp", "Số tiền", "Tỷ lệ",
  "Tham chiếu", "Cách tính"
];

// Hệ số/cách tính tăng ca theo mã — xem TinhCong.gs hàm tinhHeSoTangCa_()
// Cách tính hỗ trợ: "TC1".."TC6" — copy nguyên logic đã dò được từ hệ thống
// Power Query thật của HAK Group (xem references/kien_truc_powerquery_powerpivot.md
// trong skill hak-group-tinh-luong để biết đầy đủ ý nghĩa từng mã).
const HEADER_DM_TANGCA = [
  "Ngày cập nhật", "Mã tăng ca", "Nội dung tăng ca", "Hệ số tăng ca",
  "Tiền tăng ca (nếu tính cố định)", "Cách tính"
];

const HEADER_DM_HOTRO = [
  "Ngày cập nhật", "Mã hỗ trợ", "Tên hỗ trợ", "Số tiền", "Cách tính"
];

const HEADER_DM_BAOHIEM = [
  "Ngày cập nhật", "Mã bảo hiểm", "Nội dung",
  "DN.BHXH", "DN.BHYT", "DN.BHTN", "DN.KPCD",
  "NLD.BHXH", "NLD.BHYT", "NLD.BHTN", "NLD.KPCD"
];

const HEADER_DM_TNCN = [
  "Ngày cập nhật", "Bậc", "Nội dung khấu trừ", "Tỷ lệ đóng thuế",
  "Thu nhập tháng (Min)", "Thu nhập tháng (Max)"
];

const HEADER_DM_GTTNCN = [
  "Ngày cập nhật", "Mã giảm trừ", "Số người", "Số tiền"
];

const HEADER_DM_PHONGBAN = ["Ngày cập nhật", "Mã phòng ban", "Tên phòng ban", "Tài khoản chi phí"];
const HEADER_DM_CHUCVU = ["Ngày cập nhật", "Mã chức vụ", "Tên chức vụ"];

const HEADER_BANGLUONG = [
  "Mã NV", "Họ và tên", "Phòng ban", "Chức vụ",
  "Lương thỏa thuận", "Công chuẩn", "Đơn giá lương TG", "Công tính LTG", "Lương thời gian", "Lương phụ",
  "Sản lượng (tấn)", "Đơn giá SL", "Lương sản lượng", "Lương bù SL (nếu dưới ngưỡng)", "Phương pháp bù SL",
  "Số xe bơm dăm", "Lương bơm dăm",
  "Tổng công", "Công Chủ nhật", "Công tăng ca", "Tiền tăng ca",
  "Phụ cấp", "Phụ cấp công tác", "Lương hỗ trợ", "Ngày cơm", "Tiền cơm", "Thưởng", "Thu nhập khác",
  "Tổng thu nhập (trước trừ)",
  "BHXH/BHYT/BHTN trừ NLĐ", "Thuế TNCN", "Trừ khác", "Tạm ứng",
  "Thực lĩnh"
];

const HEADER_BHXH = [
  "Mã NV", "Họ và tên", "Phòng ban", "Lương đóng BHXH",
  "CTY.BHXH", "CTY.BHYT", "CTY.BHTN", "CTY.KPCĐ", "Cộng BH công ty đóng",
  "NLĐ.BHXH", "NLĐ.BHYT", "NLĐ.BHTN", "Cộng BH NLĐ đóng", "Ghi chú ngưỡng công"
];

const HEADER_TNCN = [
  "Mã NV", "Họ và tên", "Thu nhập chịu thuế", "Giảm trừ bản thân",
  "Số người phụ thuộc", "Giảm trừ người phụ thuộc", "Thu nhập tính thuế",
  "Thuế TNCN phải nộp"
];

const HEADER_KIEMTRA_LOG = [
  "Thời gian chạy", "Mức độ", "Loại kiểm tra", "Mã NV", "Họ và tên",
  "Nội dung phát hiện", "Giá trị 1", "Giá trị 2", "Chênh lệch"
];

// Header bảng NHÁP = header gốc của bảng chính + 1 cột "✔ Kiểm tra" ở cuối để
// người dùng thấy ngay dòng nào lỗi/ổn khi mở trực tiếp Google Sheet.
function headerNhapChamCong_() {
  return headerChamCongDayDu_().concat(["✔ Kiểm tra"]);
}
const HEADER_NHAP_SANLUONG = HEADER_SANLUONG.concat(["✔ Kiểm tra"]);

/** Mở spreadsheet cấu hình — dùng chung cho mọi file .gs khác. */
function moSheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Lấy 1 sheet theo tên; tự tạo + ghi header nếu chưa tồn tại.
 * @param {string} tenSheet
 * @param {string[]} header
 */
function layHoacTaoSheet_(tenSheet, header) {
  const ss = moSheet_();
  let sh = ss.getSheetByName(tenSheet);
  if (!sh) {
    sh = ss.insertSheet(tenSheet);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Đọc toàn bộ dữ liệu 1 sheet (trừ dòng header) thành mảng object {TênCột: giá trị}. */
function docSheetThanhObject_(tenSheet, header) {
  const ss = moSheet_();
  const sh = ss.getSheetByName(tenSheet);
  if (!sh || sh.getLastRow() < 2) return [];
  const soHang = sh.getLastRow() - 1;
  const soCot = header.length;
  const values = sh.getRange(2, 1, soHang, soCot).getValues();
  return values
    .filter(row => row.some(v => v !== "" && v !== null))
    .map(row => {
      const obj = {};
      header.forEach((ten, i) => { obj[ten] = row[i]; });
      return obj;
    });
}

/** Ghi đè toàn bộ dữ liệu (mảng object) vào 1 sheet, giữ nguyên header đã cho. */
function ghiDeSheet_(tenSheet, header, danhSachObject) {
  const sh = layHoacTaoSheet_(tenSheet, header);
  const soHangCu = sh.getMaxRows();
  if (soHangCu > 1) {
    sh.getRange(2, 1, soHangCu - 1, header.length).clearContent();
  }
  if (danhSachObject.length === 0) return;
  const rows = danhSachObject.map(obj => header.map(ten => (obj[ten] !== undefined ? obj[ten] : "")));
  sh.getRange(2, 1, rows.length, header.length).setValues(rows);
}

/**
 * Tìm số dòng thật trong sheet (1-based, tính cả header) có giá trị = giaTriMa
 * ở cột tenCotMa. Trả về -1 nếu không tìm thấy.
 */
function timHangTheoMa_(tenSheet, header, tenCotMa, giaTriMa) {
  const sh = moSheet_().getSheetByName(tenSheet);
  if (!sh || sh.getLastRow() < 2) return -1;
  const idxCot = header.indexOf(tenCotMa) + 1;
  const soHang = sh.getLastRow() - 1;
  const values = sh.getRange(2, idxCot, soHang, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(giaTriMa)) return i + 2;
  }
  return -1;
}

/** Ghi đè 1 dòng đã biết số thứ tự (dùng khi SỬA). */
function ghiHang_(tenSheet, header, soHang, dataObj) {
  const sh = layHoacTaoSheet_(tenSheet, header);
  const row = header.map(ten => (dataObj[ten] !== undefined ? dataObj[ten] : ""));
  sh.getRange(soHang, 1, 1, header.length).setValues([row]);
}

/** Thêm 1 dòng mới vào cuối sheet (dùng khi THÊM MỚI). */
function themHangMoi_(tenSheet, header, dataObj) {
  const sh = layHoacTaoSheet_(tenSheet, header);
  const row = header.map(ten => (dataObj[ten] !== undefined ? dataObj[ten] : ""));
  sh.getRange(sh.getLastRow() + 1, 1, 1, header.length).setValues([row]);
}

/** Chuyển chuỗi "YYYY-MM-DD" (từ <input type="date">) thành Date, hoặc "" nếu rỗng. */
function chuoiThanhNgay_(chuoi) {
  if (!chuoi) return "";
  const d = new Date(chuoi);
  return isNaN(d.getTime()) ? "" : d;
}
