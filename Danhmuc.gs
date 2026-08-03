// ================= DANH MỤC (DM_*) — tra cứu theo mã, CÓ HIỆU LỰC THEO KỲ =================
// Mỗi hàm trả về 1 Map: Mã -> record đầy đủ của dòng ĐANG CÓ HIỆU LỰC của mã đó.
// Dùng chung cho cả TinhLuong.gs, KiemTra.gs, BaoCao.gs.
//
// ⚠️ VERSIONING: từ khi tách 5 file, mỗi mã danh mục (vd "TG1", "TN.01"...) có
// thể có NHIỀU DÒNG theo thời gian (mỗi lần đổi mức lương/phụ cấp = 1 dòng mới,
// dòng cũ tự động bị "đóng" — set "Hiệu lực đến" = trước ngày dòng mới 1 ngày —
// xem DanhMucQuanLy.gs). Khi tính lương cho kỳ nào, PHẢI lấy đúng phiên bản có
// hiệu lực tại kỳ đó, không phải luôn lấy dòng mới nhất/dòng cuối cùng.
//
// Cách gọi:
//   docDanhMucLuong_()            → lấy phiên bản có hiệu lực HÔM NAY (dùng cho
//                                    form Nhân sự — chọn mã hiện hành)
//   docDanhMucLuong_(nam, thang)  → lấy phiên bản có hiệu lực NGÀY MÙNG 1 của kỳ
//                                    đó (dùng khi Tính lương/Kiểm tra cho đúng
//                                    kỳ quá khứ — không bị đổi kết quả nếu sau
//                                    này công ty đổi mức lương mới)

/**
 * Với 1 danh sách dòng danh mục (có "Hiệu lực từ"/"Hiệu lực đến"), lọc ra ĐÚNG
 * 1 dòng đang hiệu lực cho mỗi mã, tại thời điểm ngayMoc.
 * Dòng không điền "Hiệu lực từ" được coi là có hiệu lực từ xưa đến nay (tương
 * thích ngược với dữ liệu cũ/nhập nhanh chưa quan tâm ngày hiệu lực).
 */
function locTheoHieuLuc_(list, tenCotMa, nam, thang) {
  const ngayMoc = (nam && thang) ? new Date(Number(nam), Number(thang) - 1, 1) : new Date();
  const theoMa = {};
  list.forEach(function (r) {
    const ma = r[tenCotMa];
    if (!ma) return;
    const hlTu = r["Hiệu lực từ"];
    const hlDen = r["Hiệu lực đến"];
    const tuOk = !(hlTu instanceof Date) || hlTu <= ngayMoc;
    const denOk = !(hlDen instanceof Date) || hlDen >= ngayMoc;
    if (!tuOk || !denOk) return;
    const hienTai = theoMa[ma];
    if (!hienTai) { theoMa[ma] = r; return; }
    const tuHienTai = hienTai["Hiệu lực từ"] instanceof Date ? hienTai["Hiệu lực từ"] : new Date(0);
    const tuMoi = hlTu instanceof Date ? hlTu : new Date(0);
    if (tuMoi >= tuHienTai) theoMa[ma] = r; // ưu tiên bản có "Hiệu lực từ" gần ngày mốc nhất
  });
  return theoMa;
}

function docDanhMucLuong_(nam, thang) {
  const list = docSheetThanhObject_(SHEET_DM_LUONG, HEADER_DM_LUONG);
  return locTheoHieuLuc_(list, "Mã lương", nam, thang);
}

function docDanhMucPhuCap_(nam, thang) {
  const list = docSheetThanhObject_(SHEET_DM_PHUCAP, HEADER_DM_PHUCAP);
  return locTheoHieuLuc_(list, "Mã phụ cấp", nam, thang);
}

function docDanhMucTangCa_(nam, thang) {
  const list = docSheetThanhObject_(SHEET_DM_TANGCA, HEADER_DM_TANGCA);
  return locTheoHieuLuc_(list, "Mã tăng ca", nam, thang);
}

function docDanhMucHoTro_(nam, thang) {
  const list = docSheetThanhObject_(SHEET_DM_HOTRO, HEADER_DM_HOTRO);
  return locTheoHieuLuc_(list, "Mã hỗ trợ", nam, thang);
}

function docDanhMucBaoHiem_(nam, thang) {
  const list = docSheetThanhObject_(SHEET_DM_BAOHIEM, HEADER_DM_BAOHIEM);
  return locTheoHieuLuc_(list, "Mã bảo hiểm", nam, thang);
}

/** Trả về mảng các bậc thuế TNCN ĐANG HIỆU LỰC (theo kỳ nếu truyền), đã sort tăng dần theo "Thu nhập tháng (Min)". */
function docBieuThueTNCN_(nam, thang) {
  const list = docSheetThanhObject_(SHEET_DM_TNCN, HEADER_DM_TNCN);
  const theoBac = locTheoHieuLuc_(list, "Bậc", nam, thang);
  const ketQua = Object.values(theoBac);
  ketQua.sort((a, b) => (a["Thu nhập tháng (Min)"] || 0) - (b["Thu nhập tháng (Min)"] || 0));
  return ketQua;
}

function docDanhMucGiamTruTNCN_(nam, thang) {
  const list = docSheetThanhObject_(SHEET_DM_GTTNCN, HEADER_DM_GTTNCN);
  return locTheoHieuLuc_(list, "Mã giảm trừ", nam, thang);
}

// PHONGBAN/CHUCVU KHÔNG có hiệu lực theo thời gian (thông tin tổ chức, không
// phải mức lương/phụ cấp) — vẫn giữ tra cứu đơn giản theo mã như trước.
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
 * Tra "Tài khoản chi phí" theo Mã phòng ban — CÓ HIỆU LỰC THEO KỲ (khác
 * PHONGBAN/CHUCVU — vì tài khoản chi phí có thể đổi theo thời gian, vd đổi hệ
 * thống tài khoản kế toán). Không đồng bộ từ nguồn ngoài, quản lý trực tiếp ở
 * tab Danh mục ("Tài khoản chi phí").
 */
function docDanhMucChiPhi_(nam, thang) {
  const list = docSheetThanhObject_(SHEET_DM_CHIPHI, HEADER_DM_CHIPHI);
  return locTheoHieuLuc_(list, "Mã phòng ban", nam, thang);
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
