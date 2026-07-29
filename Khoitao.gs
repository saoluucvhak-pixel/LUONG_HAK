// ================= KHỞI TẠO CẤU TRÚC GOOGLE SHEET =================
// Chạy 1 LẦN DUY NHẤT khi bắt đầu dùng webapp cho 1 đơn vị mới (hoặc bất cứ lúc
// nào muốn tạo lại các sheet còn thiếu) — tự tạo ĐỦ toàn bộ sheet theo đúng cấu
// trúc (Nhóm A: dữ liệu vào, Nhóm B: danh mục, Nhóm C: đầu ra), đúng thứ tự, có
// định dạng tiêu đề (đậm, nền màu, đóng băng dòng 1, độ rộng cột hợp lý) — thay vì
// để mỗi sheet tự được tạo rời rạc (không định dạng) khi lần đầu được truy cập.
//
// Cách chạy: mở Apps Script Editor → chọn hàm `khoiTaoTatCaSheet` → bấm Run (▶) —
// hoặc mở Google Sheet, vào menu tuỳ chỉnh "⚙️ HAK Group" (tự hiện sau khi mở lại
// Sheet nhờ onOpen()) → "Khởi tạo cấu trúc bảng".

/** Danh sách đầy đủ mọi sheet cần có, ĐÚNG THỨ TỰ mong muốn hiển thị trên Google Sheet. */
function danhSachSheetCanTao_() {
  return [
    // ---- Nhóm A: Dữ liệu vào ----
    { ten: SHEET_THAMSO, header: HEADER_THAMSO, nhom: "A" },
    { ten: SHEET_NHANSU, header: HEADER_NHANSU, nhom: "A" },
    { ten: SHEET_CHITIETNS, header: HEADER_CHITIETNS, nhom: "A" },
    { ten: SHEET_CHAMCONG, header: headerChamCongDayDu_(), nhom: "A" },
    { ten: SHEET_PSLUONG, header: HEADER_PSLUONG, nhom: "A" },
    { ten: SHEET_UNGLUONG, header: HEADER_UNGLUONG, nhom: "A" },
    { ten: SHEET_SANLUONG, header: HEADER_SANLUONG, nhom: "A" },
    { ten: SHEET_BANDAM, header: HEADER_BANDAM, nhom: "A" },
    { ten: SHEET_TIENCOM, header: HEADER_TIENCOM, nhom: "A" },
    // ---- Nhóm B: Danh mục ----
    { ten: SHEET_DM_PHONGBAN, header: HEADER_DM_PHONGBAN, nhom: "B" },
    { ten: SHEET_DM_CHUCVU, header: HEADER_DM_CHUCVU, nhom: "B" },
    { ten: SHEET_DM_LUONG, header: HEADER_DM_LUONG, nhom: "B" },
    { ten: SHEET_DM_PHUCAP, header: HEADER_DM_PHUCAP, nhom: "B" },
    { ten: SHEET_DM_TANGCA, header: HEADER_DM_TANGCA, nhom: "B" },
    { ten: SHEET_DM_HOTRO, header: HEADER_DM_HOTRO, nhom: "B" },
    { ten: SHEET_DM_BAOHIEM, header: HEADER_DM_BAOHIEM, nhom: "B" },
    { ten: SHEET_DM_TNCN, header: HEADER_DM_TNCN, nhom: "B" },
    { ten: SHEET_DM_GTTNCN, header: HEADER_DM_GTTNCN, nhom: "B" },
    // ---- Nhóm C: Đầu ra (webapp tự ghi, để trống lúc khởi tạo) ----
    { ten: SHEET_BANGLUONG, header: HEADER_BANGLUONG, nhom: "C" },
    { ten: SHEET_BHXH, header: HEADER_BHXH, nhom: "C" },
    { ten: SHEET_TNCN, header: HEADER_TNCN, nhom: "C" },
    { ten: SHEET_KIEMTRA_LOG, header: HEADER_KIEMTRA_LOG, nhom: "C" }
  ];
}

const MAU_NEN_THEO_NHOM_ = { A: "#d9ead3", B: "#fce5cd", C: "#cfe2f3" }; // xanh lá / cam nhạt / xanh dương nhạt

/**
 * Khởi tạo TOÀN BỘ sheet còn thiếu, định dạng tiêu đề, sắp đúng thứ tự.
 * An toàn khi chạy nhiều lần — sheet đã có dữ liệu sẽ KHÔNG bị đụng tới (chỉ tạo
 * mới sheet nào chưa tồn tại; sheet đã tồn tại chỉ được chỉnh lại định dạng tiêu
 * đề, không xoá/ghi đè dữ liệu bên trong).
 * @return {{ daTao: string[], daCoSan: string[] }}
 */
function khoiTaoTatCaSheet() {
  const ss = moSheet_();
  const danhSach = danhSachSheetCanTao_();
  const daTao = [];
  const daCoSan = [];

  danhSach.forEach(function (muc, idx) {
    const daTonTai = !!ss.getSheetByName(muc.ten);
    const sh = layHoacTaoSheet_(muc.ten, muc.header);
    dinhDangTieuDe_(sh, muc.header.length, MAU_NEN_THEO_NHOM_[muc.nhom]);
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(idx + 1); // sắp xếp đúng thứ tự trong danhSachSheetCanTao_()
    if (daTonTai) daCoSan.push(muc.ten); else daTao.push(muc.ten);
  });

  xoaSheetMacDinhRong_(ss);
  ss.setActiveSheet(ss.getSheetByName(SHEET_THAMSO));

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
 * không cần mở Apps Script Editor. Apps Script tự gọi hàm này (không cần cấu hình
 * trigger thủ công), miễn là file `.gs` này có mặt trong project.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("⚙️ HAK Group")
    .addItem("Khởi tạo cấu trúc bảng", "menuKhoiTaoTatCaSheet_")
    .addItem("Khởi tạo dữ liệu danh mục mẫu", "menuKhoiTaoDanhMucMau_")
    .addToUi();
}

function menuKhoiTaoTatCaSheet_() {
  const kq = khoiTaoTatCaSheet();
  SpreadsheetApp.getUi().alert(
    "Đã tạo mới " + kq.daTao.length + " sheet: " + (kq.daTao.join(", ") || "(không có, đã có sẵn hết)") +
    "\nĐã có sẵn (giữ nguyên): " + kq.daCoSan.length + " sheet."
  );
}

function menuKhoiTaoDanhMucMau_() {
  const kq = khoiTaoDanhMucMau(false);
  SpreadsheetApp.getUi().alert(
    "Đã khởi tạo dữ liệu mẫu cho: " + (kq.daKhoiTao.join(", ") || "(không có)") +
    "\nBỏ qua (đã có dữ liệu sẵn): " + (kq.daBoQua.join(", ") || "(không có)")
  );
}
