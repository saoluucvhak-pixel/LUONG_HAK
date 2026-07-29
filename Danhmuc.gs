function myFunction() {
  // ================= DANH MỤC (DM_*) — tra cứu theo mã =================
// Mỗi hàm trả về 1 Map: Mã -> record đầy đủ của dòng đó trong sheet danh mục.
// Dùng chung cho cả TinhLuong.gs và KiemTra.gs.

function docDanhMucLuong_() {
  const list = docSheetThanhObject_(SHEET_DM_LUONG, HEADER_DM_LUONG);
  const map = {};
  list.forEach(r => { map[r["Mã lương"]] = r; });
  return map;
}

function docDanhMucPhuCap_() {
  const list = docSheetThanhObject_(SHEET_DM_PHUCAP, HEADER_DM_PHUCAP);
  const map = {};
  list.forEach(r => { map[r["Mã phụ cấp"]] = r; });
  return map;
}

function docDanhMucTangCa_() {
  const list = docSheetThanhObject_(SHEET_DM_TANGCA, HEADER_DM_TANGCA);
  const map = {};
  list.forEach(r => { map[r["Mã tăng ca"]] = r; });
  return map;
}

function docDanhMucHoTro_() {
  const list = docSheetThanhObject_(SHEET_DM_HOTRO, HEADER_DM_HOTRO);
  const map = {};
  list.forEach(r => { map[r["Mã hỗ trợ"]] = r; });
  return map;
}

function docDanhMucBaoHiem_() {
  const list = docSheetThanhObject_(SHEET_DM_BAOHIEM, HEADER_DM_BAOHIEM);
  const map = {};
  list.forEach(r => { map[r["Mã bảo hiểm"]] = r; });
  return map;
}

/** Trả về mảng các bậc thuế TNCN, đã sort tăng dần theo "Thu nhập tháng (Min)". */
function docBieuThueTNCN_() {
  const list = docSheetThanhObject_(SHEET_DM_TNCN, HEADER_DM_TNCN);
  list.sort((a, b) => (a["Thu nhập tháng (Min)"] || 0) - (b["Thu nhập tháng (Min)"] || 0));
  return list;
}

function docDanhMucGiamTruTNCN_() {
  const list = docSheetThanhObject_(SHEET_DM_GTTNCN, HEADER_DM_GTTNCN);
  const map = {};
  list.forEach(r => { map[r["Mã giảm trừ"]] = r; });
  return map;
}

function docDanhMucPhongBan_() {
  const list = docSheetThanhObject_(SHEET_DM_PHONGBAN, HEADER_DM_PHONGBAN);
  const map = {};
  list.forEach(r => { map[r["Mã phòng ban"]] = r; });
  return map;
}

function docDanhMucChucVu_() {
  const list = docSheetThanhObject_(SHEET_DM_CHUCVU, HEADER_DM_CHUCVU);
  const map = {};
  list.forEach(r => { map[r["Mã chức vụ"]] = r; });
  return map;
}

/**
 * Tính thuế TNCN luỹ tiến từng phần theo biểu bậc thang chuẩn (Luật thuế TNCN VN).
 * @param {number} thuNhapTinhThue thu nhập đã trừ giảm trừ gia cảnh + bảo hiểm bắt buộc
 * @param {Array} bieuThue mảng bậc thuế từ docBieuThueTNCN_() — mỗi phần tử có
 *   "Thu nhập tháng (Min)", "Thu nhập tháng (Max)", "Tỷ lệ đóng thuế"
 * @return {number} số thuế phải nộp trong tháng
 */
function tinhThueTNCNLuyTien_(thuNhapTinhThue, bieuThue) {
  if (!thuNhapTinhThue || thuNhapTinhThue <= 0) return 0;
  let thue = 0;
  for (const bac of bieuThue) {
    const min = bac["Thu nhập tháng (Min)"] || 0;
    const max = bac["Thu nhập tháng (Max)"]; // có thể để trống = không giới hạn (bậc cao nhất)
    const tyLe = bac["Tỷ lệ đóng thuế"] || 0;
    if (thuNhapTinhThue <= min) continue;
    const tranTren = (max === "" || max === null || max === undefined) ? thuNhapTinhThue : Math.min(thuNhapTinhThue, max);
    const phanChiuThueOBacNay = tranTren - min;
    if (phanChiuThueOBacNay > 0) {
      thue += phanChiuThueOBacNay * tyLe;
    }
  }
  return Math.round(thue);
}
}
