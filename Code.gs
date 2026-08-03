// ================= CẤU HÌNH THÔNG SỐ HỆ THỐNG =================
// ⚠️ KIẾN TRÚC 5 FILE GOOGLE SHEET RIÊNG BIỆT (không còn dùng 1 Sheet duy nhất):
//   1. File DANH MỤC — DM_* (mức lương/phụ cấp/tăng ca/hỗ trợ/BHXH/thuế... có
//      hiệu lực theo NGÀY, ít thay đổi, đọc nhiều — xem Mục "Danh mục có hiệu lực")
//   2. File DRAFT — bảng nháp NHAP_* (tạm thời, xoá sau khi Xác nhận nạp/Hủy)
//   3. File DATA — dữ liệu đã xác nhận nạp: NL_NHANSU, NL_CHAMCONG, DL_SANLUONG...
//   4. File XỬ LÝ — báo cáo/chứng từ của KỲ ĐANG LÀM: RP_BANGLUONG, RP_BHXH,
//      RP_THUETNCN, báo cáo chấm công, phân bổ sản lượng, phiếu hạch toán...
//      → bấm "Lưu trữ" ở cuối kỳ để copy sang File LƯU TRỮ rồi xoá sạch làm kỳ mới
//   5. File LƯU TRỮ — nơi giữ lại lịch sử tất cả các kỳ đã "chốt"
//
// Cách cấu hình: dán URL hoặc ID của mỗi file vào 5 hằng số dưới đây (lấy ID
// trong URL: docs.google.com/spreadsheets/d/<ID_NÀY>/edit) — HOẶC cấu hình
// ngay trên webapp (tab "Hướng dẫn sử dụng" → "Cài đặt liên kết file", không
// cần sửa code) — nếu cấu hình qua webapp thì giá trị đó ĐƯỢC ƯU TIÊN hơn các
// hằng số dưới đây. Xem chi tiết ánh xạ sheet↔file ở `LienKetFile.gs`.
const SPREADSHEET_ID_DANHMUC = "DÁN_ID_FILE_DANH_MỤC_VÀO_ĐÂY";
const SPREADSHEET_ID_DRAFT = "DÁN_ID_FILE_DRAFT_VÀO_ĐÂY";
const SPREADSHEET_ID_DATA = "DÁN_ID_FILE_DATA_VÀO_ĐÂY";
const SPREADSHEET_ID_XULY = "DÁN_ID_FILE_XỬ_LÝ_VÀO_ĐÂY";
const SPREADSHEET_ID_LUUTRU = "DÁN_ID_FILE_LƯU_TRỮ_VÀO_ĐÂY";

// Mỗi ĐƠN VỊ x KỲ LƯƠNG nên dùng 1 bộ 5 file riêng (đúng như 2 file Excel
// "DL_LUONG_<đơn vị>_<kỳ>" + "Luong<kỳ>_<đơn vị>" hiện tại của HAK Group) —
// webapp này gộp cả 2 vai trò (dữ liệu vào + tính toán + kiểm tra) vào 5 Sheet.

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
const SHEET_DM_CHIPHI = "DM_CHIPHI";
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
const SHEET_NHAP_UNGLUONG = "NHAP_UNGLUONG";
const SHEET_NHAP_PSLUONG = "NHAP_PSLUONG";

// Nhóm E — báo cáo/chứng từ MỚI thuộc File Xử lý (ngoài RP_BANGLUONG/RP_BHXH/
// RP_THUETNCN/KIEMTRA_LOG đã có) — đều là bản "CHỐT" (snapshot) của 1 kỳ, khác
// với các báo cáo cũ (Phân bổ sản lượng, Bù sản lượng ở BaoCao.gs) vốn tính
// "live" mỗi lần bấm xem, không lưu lại.
const SHEET_BC_CHAMCONG = "RP_CHAMCONG"; // báo cáo chấm công đã chốt của 1 kỳ
const SHEET_BC_PHANBOSL = "RP_PHANBOSL"; // phân bổ sản lượng đã chốt của 1 kỳ
const SHEET_HACHTOAN = "RP_HACHTOAN"; // bảng hạch toán chi phí lương theo TK kế toán
const SHEET_PHIEUCHI = "RP_PHIEUCHI"; // phiếu chi lương/tạm ứng

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
  "Mã hỗ trợ", "Mã hỗ trợ 2", "Mã BHXH", "Mã TNCN",
  "Hiệu lực từ", "Hiệu lực đến", "Kỳ tính lương"
];

const HEADER_CHITIETNS = [
  "Ngày cập nhật", "Mã nhân viên", "Họ và tên", "Số CCCD", "Ngày sinh", "Thường trú",
  "Ngày cấp CCCD", "Nơi cấp", "Mã BHXH", "Số điện thoại", "Số HĐLĐ",
  "Mã GT_TNCN_BT", "Mã GT_TNCN_PT", "Người phụ thuộc",
  "Số tài khoản", "Tên Ngân hàng", "Kỳ tính lương"
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
  "Ngày cập nhật", "Hiệu lực từ", "Hiệu lực đến", "Mã lương", "Mã hình thức lương", "Hình thức lương",
  "Số tiền khoán", "Lương phụ", "Ngưỡng truy thu BH (công)",
  "ĐK_Bù lương (công tối thiểu)", "Đơn giá bù lương", "Đơn giá bơm dăm", "Cách tính"
, "Kỳ tính lương"];

const HEADER_DM_PHUCAP = [
  "Ngày cập nhật", "Hiệu lực từ", "Hiệu lực đến", "Mã phụ cấp", "Tên phụ cấp", "Số tiền", "Tỷ lệ",
  "Tham chiếu", "Cách tính"
, "Kỳ tính lương"];

// Hệ số/cách tính tăng ca theo mã — xem TinhCong.gs hàm tinhHeSoTangCa_()
// Cách tính hỗ trợ: "TC1".."TC6" — copy nguyên logic đã dò được từ hệ thống
// Power Query thật của HAK Group (xem references/kien_truc_powerquery_powerpivot.md
// trong skill hak-group-tinh-luong để biết đầy đủ ý nghĩa từng mã).
const HEADER_DM_TANGCA = [
  "Ngày cập nhật", "Hiệu lực từ", "Hiệu lực đến", "Mã tăng ca", "Nội dung tăng ca", "Hệ số tăng ca",
  "Tiền tăng ca (nếu tính cố định)", "Cách tính"
, "Kỳ tính lương"];

const HEADER_DM_HOTRO = [
  "Ngày cập nhật", "Hiệu lực từ", "Hiệu lực đến", "Mã hỗ trợ", "Tên hỗ trợ", "Số tiền", "Cách tính"
, "Kỳ tính lương"];

const HEADER_DM_BAOHIEM = [
  "Ngày cập nhật", "Hiệu lực từ", "Hiệu lực đến", "Mã bảo hiểm", "Nội dung",
  "DN.BHXH", "DN.BHYT", "DN.BHTN", "DN.KPCD",
  "NLD.BHXH", "NLD.BHYT", "NLD.BHTN", "NLD.KPCD"
, "Kỳ tính lương"];

const HEADER_DM_TNCN = [
  "Ngày cập nhật", "Hiệu lực từ", "Hiệu lực đến", "Bậc", "Nội dung khấu trừ", "Tỷ lệ đóng thuế",
  "Thu nhập tháng (Min)", "Thu nhập tháng (Max)"
, "Kỳ tính lương"];

const HEADER_DM_GTTNCN = [
  "Ngày cập nhật", "Hiệu lực từ", "Hiệu lực đến", "Mã giảm trừ", "Số người", "Số tiền"
, "Kỳ tính lương"];

const HEADER_DM_PHONGBAN = ["Ngày cập nhật", "Mã phòng ban", "Tên phòng ban", "Kỳ tính lương"];
const HEADER_DM_CHUCVU = ["Ngày cập nhật", "Mã chức vụ", "Tên chức vụ", "Kỳ tính lương"];
// "Tài khoản chi phí" TÁCH RIÊNG thành danh mục "DM_CHIPHI" (không đồng bộ từ
// nguồn ngoài — DM_PHONGBAN ở nguồn ngoài không có trường này, và bị GHI ĐÈ
// TOÀN BỘ mỗi lần "Tải dữ liệu kỳ này" nên không thể lưu ở đó được) — quản lý
// TRỰC TIẾP trong webapp, CÓ HIỆU LỰC THEO NGÀY (tài khoản chi phí có thể đổi
// theo từng kỳ, vd đổi hệ thống tài khoản kế toán).
const HEADER_DM_CHIPHI = [
  "Ngày cập nhật", "Hiệu lực từ", "Hiệu lực đến", "Mã phòng ban", "Tài khoản chi phí", "Ghi chú"
];

const HEADER_BANGLUONG = [
  "Mã NV", "Họ và tên", "Phòng ban", "Chức vụ",
  "Lương thỏa thuận", "Công chuẩn", "Đơn giá lương TG", "Công tính LTG", "Lương thời gian", "Lương phụ",
  "Sản lượng (tấn)", "Đơn giá SL", "Lương sản lượng", "Lương bù SL (nếu dưới ngưỡng)", "Phương pháp bù SL",
  "Số xe bơm dăm", "Lương bơm dăm",
  "Tổng công", "Công Chủ nhật", "Công tăng ca", "Tiền tăng ca",
  "Phụ cấp", "Phụ cấp công tác", "Lương hỗ trợ", "Ngày cơm", "Tiền cơm", "Thưởng", "Thu nhập khác",
  "Tổng thu nhập (trước trừ)",
  "BHXH/BHYT/BHTN trừ NLĐ", "Truy thu bảo hiểm", "Thuế TNCN", "Trừ khác", "Tạm ứng",
  "Thực lĩnh"
];

const HEADER_BHXH = [
  "Mã NV", "Họ và tên", "Phòng ban", "Lương đóng BHXH",
  "CTY.BHXH", "CTY.BHYT", "CTY.BHTN", "CTY.KPCĐ", "Cộng BH công ty đóng",
  "NLĐ.BHXH", "NLĐ.BHYT", "NLĐ.BHTN", "Cộng BH NLĐ đóng",
  "Truy thu bảo hiểm", "Ghi chú ngưỡng công"
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
const HEADER_NHAP_UNGLUONG = HEADER_UNGLUONG.concat(["✔ Kiểm tra"]);
const HEADER_NHAP_PSLUONG = HEADER_PSLUONG.concat(["✔ Kiểm tra"]);

// ---------- Header cho Nhóm E (báo cáo/chứng từ mới) ----------
const HEADER_BC_CHAMCONG = [
  "Kỳ", "Mã NV", "Họ và tên", "Mã phòng ban", "Tên phòng ban",
  "Tổng công", "Công Chủ nhật", "Công tăng ca", "Công lễ", "Công phép", "Công cơm"
];
const HEADER_BC_PHANBOSL = [
  "Kỳ", "Loại", "Mã NV", "Họ và tên", "Mã phòng ban", "Tên phòng ban",
  "Tổng sản lượng (tấn)", "Số phiếu cân"
];
// "Tài khoản Nợ"/"Tài khoản Có" lấy theo đúng "Tài khoản chi phí" đã khai trong
// DM_PHONGBAN (Nợ) đối ứng các tài khoản phải trả chuẩn (Có) — xem BaoCaoHachToan.gs
const HEADER_HACHTOAN = [
  "Kỳ", "Tài khoản Nợ", "Tên tài khoản Nợ", "Tài khoản Có", "Tên tài khoản Có",
  "Diễn giải", "Số tiền"
];
const HEADER_PHIEUCHI = [
  "Kỳ", "Số phiếu", "Ngày chi", "Mã NV", "Họ và tên", "Loại chi", "Số tiền",
  "Hình thức TT", "Người nhận", "Ghi chú"
];

/**
 * Lấy 1 sheet theo tên; tự tạo + ghi header nếu chưa tồn tại. Tự mở ĐÚNG file
 * trong số 5 file (Danh mục/Draft/Data/Xử lý/Lưu trữ) chứa sheet đó — xem
 * `moSheetChoBang_()` ở LienKetFile.gs.
 * @param {string} tenSheet
 * @param {string[]} header
 */
/**
 * Lấy 1 sheet theo tên; tự tạo + ghi header nếu chưa tồn tại.
 * ⚠ LỖI THẬT ĐÃ PHÁT HIỆN VÀ SỬA: nếu sheet ĐÃ TỒN TẠI nhưng header trong code
 * đã thay đổi (thêm/bớt/đổi tên cột — vd tách "Tài khoản chi phí" ra khỏi
 * DM_PHONGBAN), hàm TRƯỚC ĐÂY không bao giờ cập nhật lại dòng tiêu đề (dòng 1)
 * — khiến dòng 1 vẫn hiện tên cột CŨ trong khi dữ liệu bên dưới đã ghi theo ý
 * nghĩa MỚI (lệch nội dung cột — vd cột ghi "Tài khoản chi phí" nhưng chứa
 * giá trị "Kỳ tính lương"). Giờ TỰ ĐỘNG SO SÁNH và ghi đè lại dòng 1 nếu khác.
 */
/**
 * ⚠ CHỈ DÙNG CHO ĐỌC (view) — KHÔNG BAO GIỜ ghi/sửa gì lên sheet, kể cả khi
 * header lệch so với code (khác với `layHoacTaoSheet_()` — vốn tự sửa lại
 * header nếu lệch, ĐÚNG cho thao tác GHI nhưng SAI về nguyên tắc cho thao tác
 * ĐỌC: 1 lệnh "xem dữ liệu" không nên có tác dụng phụ ghi/sửa gì cả). Nếu
 * sheet CHƯA TỪNG tồn tại, vẫn tạo mới + ghi header (hợp lý, vì sheet trống
 * hoàn toàn không có gì để "xem"). Dùng cho `docSheetThanhObject_`,
 * `layDanhMuc`, `layGiaoDich`, và mọi hàm chỉ đọc khác.
 */
function moSheetChiDoc_(tenSheet, header) {
  const ss = moSheetChoBang_(tenSheet);
  let sh = ss.getSheetByName(tenSheet);
  if (!sh) {
    sh = ss.insertSheet(tenSheet);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Lấy 1 sheet theo tên; tự tạo + ghi header nếu chưa tồn tại.
 * ⚠ CHỈ DÙNG CHO GHI (thêm/sửa/xoá dòng, tạo báo cáo...) — hàm này CÓ TÁC
 * DỤNG PHỤ: tự động sửa lại dòng tiêu đề (dòng 1) nếu phát hiện lệch so với
 * code hiện tại (vd sau khi đổi cấu trúc cột). Việc ĐỌC/XEM dữ liệu phải dùng
 * `moSheetChiDoc_()` ở trên (không có tác dụng phụ này).
 */
function layHoacTaoSheet_(tenSheet, header) {
  const ss = moSheetChoBang_(tenSheet);
  let sh = ss.getSheetByName(tenSheet);
  if (!sh) {
    sh = ss.insertSheet(tenSheet);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.setFrozenRows(1);
    return sh;
  }
  const headerHienTai = sh.getLastColumn() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  const khopDung = headerHienTai.length === header.length && header.every(function (h, i) { return headerHienTai[i] === h; });
  if (!khopDung) {
    // Xoá sạch dòng tiêu đề cũ (kể cả cột thừa nếu header mới NGẮN hơn header
    // cũ) rồi ghi lại đúng header mới nhất từ code.
    if (headerHienTai.length > 0) sh.getRange(1, 1, 1, headerHienTai.length).clearContent();
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }
  return sh;
}

/** Đọc toàn bộ dữ liệu 1 sheet (trừ dòng header) thành mảng object {TênCột: giá trị}. */
/**
 * ⚠ LỖI NGHIÊM TRỌNG ĐÃ PHÁT HIỆN VÀ SỬA (ảnh hưởng TOÀN HỆ THỐNG — hàm này
 * dùng chung cho hầu hết sheet nội bộ: Nhân sự, Chấm công, Sản lượng, Ứng
 * lương, các báo cáo RP_*...): trước đây tin mù quáng vào `sh.getLastRow()`
 * để tính số dòng cần đọc — nhưng nếu 1 sheet TỪNG bị ghi/dán dữ liệu vượt
 * quá phạm vi thật (vd dán từ Excel có định dạng kéo dài, hoặc dữ liệu cũ từ
 * trước khi sửa các lỗi đồng bộ khác), "vùng dữ liệu" (used range) của sheet
 * có thể bị THỔI PHỒNG rất lớn so với dữ liệu thật (đã xác nhận thực tế: 1
 * sheet chỉ có ~16 dòng/4 cột dữ liệu thật nhưng used range tới cột Z, dòng
 * 962!) — khiến MỌI request đọc sheet đó phải xử lý dư thừa hàng trăm/nghìn
 * dòng trống, có thể gây lỗi/treo khi trả kết quả qua `google.script.run`.
 * Giờ tìm ĐÚNG dòng cuối có dữ liệu thật (dựa vào CỘT ĐẦU TIÊN của header,
 * thường luôn có giá trị ở mọi dòng thật) trước khi đọc toàn bộ các cột.
 */
function docSheetThanhObject_(tenSheet, header) {
  const ss = moSheetChoBang_(tenSheet);
  const sh = ss.getSheetByName(tenSheet);
  if (!sh) return [];
  const soHangToiDa = sh.getLastRow();
  if (soHangToiDa < 2) return [];

  const cotDau = sh.getRange(2, 1, soHangToiDa - 1, 1).getValues();
  let soHang = 0;
  for (let i = cotDau.length - 1; i >= 0; i--) {
    if (cotDau[i][0] !== "" && cotDau[i][0] !== null) { soHang = i + 1; break; }
  }
  if (soHang === 0) return [];

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
/** Ghi đè toàn bộ dữ liệu (mảng object) vào 1 sheet, giữ nguyên header đã cho. */
function ghiDeSheet_(tenSheet, header, danhSachObject) {
  const sh = layHoacTaoSheet_(tenSheet, header);
  const soHangCu = sh.getMaxRows();
  // ⚠ Xoá theo SỐ CỘT LỚN HƠN giữa header mới và số cột THỰC TẾ đang có trên
  // sheet — nếu chỉ xoá đúng header.length (số cột MỚI, có thể ít hơn số cột
  // CŨ do header bị thu hẹp), cột thừa phía sau sẽ bị BỎ SÓT, giữ nguyên dữ
  // liệu rác từ cấu trúc cũ mãi mãi (lỗi thật đã gặp — xem `layHoacTaoSheet_`).
  const soCotXoa = Math.max(header.length, sh.getMaxColumns());
  if (soHangCu > 1) {
    sh.getRange(2, 1, soHangCu - 1, soCotXoa).clearContent();
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
  const sh = moSheetChoBang_(tenSheet).getSheetByName(tenSheet);
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
