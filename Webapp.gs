// ================= WEB APP =================

function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("HAK Group — Tính lương & Kiểm soát bảng lương")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/** Gọi từ nút "Tính lương" trên giao diện. */
function guiTinhBangLuong(nam, thang, phuongPhapBu) {
  try {
    const kq = tinhBangLuong(nam, Number(thang), phuongPhapBu);
    return { ok: true, soNguoi: kq.soNguoi, tongThucLinh: kq.tongThucLinh };
  } catch (e) {
    return { ok: false, loi: e.message + "\n" + e.stack };
  }
}

/** Gọi từ nút "Chạy kiểm tra" trên giao diện. */
function guiKiemTraBangLuong(nam, thang) {
  try {
    const kq = kiemTraBangLuong(nam, Number(thang));
    return { ok: true, soLoi: kq.soLoi, soCanhBao: kq.soCanhBao, tongDong: kq.tongDong };
  } catch (e) {
    return { ok: false, loi: e.message + "\n" + e.stack };
  }
}

// ---------- Cầu nối cho việc khởi tạo cấu trúc bảng ----------

function guiKhoiTaoTatCaSheet() {
  try {
    return { ok: true, data: khoiTaoTatCaSheet() };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

// ---------- Cầu nối cho "Nhập dữ liệu ban đầu" (khởi tạo 1 lần) ----------

function guiNhapDuLieuBanDau(base64, tenFile, mimeType, cheDoGhi) {
  try {
    return nhapDuLieuBanDauTuFile(base64, tenFile, mimeType, cheDoGhi);
  } catch (e) {
    return { ok: false, loi: e.message + (e.message.indexOf("Drive") >= 0 ? " — kiểm tra đã bật Advanced Service \"Drive API\" chưa (xem HUONG_DAN_WEBAPP.md)." : "") };
  }
}

/** Lấy N dòng log kiểm tra gần nhất để hiển thị ngay trên giao diện (không cần mở Sheet). */
function guiDanhSachLogGanNhat(soDongToiDa) {
  const sh = layHoacTaoSheet_(SHEET_KIEMTRA_LOG, HEADER_KIEMTRA_LOG);
  const tongDong = sh.getLastRow() - 1;
  if (tongDong <= 0) return [];
  const soLay = Math.min(soDongToiDa || 50, tongDong);
  const values = sh.getRange(tongDong - soLay + 2, 1, soLay, HEADER_KIEMTRA_LOG.length).getValues();
  return values.reverse().map(row => {
    const obj = {};
    HEADER_KIEMTRA_LOG.forEach((ten, i) => {
      obj[ten] = (row[i] instanceof Date) ? Utilities.formatDate(row[i], Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm") : row[i];
    });
    return obj;
  });
}

/** Trả về link mở trực tiếp Google Sheet đang cấu hình (để người dùng xem chi tiết). */
function guiLinkSheet() {
  // ⚠ Giữ HÀM CŨ để không vỡ code gọi cũ (trả về link File Data — nơi có nhiều
  // sheet người dùng hay cần mở tay nhất) — dùng guiDanhSachLinkFile() nếu cần
  // đủ cả 5 link.
  try {
    return moFileTheoLoai_(LOAI_FILE_DATA).getUrl();
  } catch (e) {
    return "";
  }
}

function guiDanhSachLinkFile() {
  try {
    return { ok: true, data: xemCauHinhLienKetFile() };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiDatIdFile(loai, urlHoacId) {
  try {
    datIdFile_(loai, urlHoacId);
    return { ok: true };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

// ---------- Cầu nối cho đồng bộ Danh mục & Nhân sự từ 2 nguồn ngoài ----------

function guiDongBoTatCaTuNgoai(nam, thang) {
  try {
    return dongBoTatCaTuNgoai(nam, thang);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiCauHinhNguonNgoai() {
  try {
    return {
      ok: true,
      danhMuc: PropertiesService.getScriptProperties().getProperty("ID_NGOAI_DANHMUC") || ID_NGOAI_DANHMUC_MACDINH_,
      nhanSu: PropertiesService.getScriptProperties().getProperty("ID_NGOAI_NHANSU") || ID_NGOAI_NHANSU_MACDINH_
    };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiDatIdNguonNgoai(loai, urlHoacId) {
  try {
    datIdNgoai_(loai, urlHoacId);
    return { ok: true };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiTrangThaiDongBoDanhMuc() {
  try {
    return { ok: true, data: layTrangThaiDongBoDanhMuc() };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

/**
 * ⚠ TỐI ƯU HIỆU SUẤT: kiểm tra ĐÚNG 1 loại danh mục (thay vì cả 9 loại như
 * `guiTrangThaiDongBoDanhMuc()`) — dùng cho tab Danh mục, vì mỗi lần chỉ xem
 * đúng 1 loại đang chọn ở dropdown, không cần biết trạng thái 8 loại còn lại.
 */
function guiDanhMucCoNguonNgoaiKhong(loai) {
  try {
    return { ok: true, coNguonNgoai: danhMucCoNguonNgoaiKhong_(loai) };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiKiemTraDuLieuNgoaiKy(nam, thang) {
  try {
    return Object.assign({ ok: true }, kiemTraDuLieuNgoaiKy_(nam, thang));
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

// ---------- Cầu nối cho tab "Nhân sự" ----------

function guiDanhSachNhanSu(baoGomDaNghi) {
  try {
    return { ok: true, data: layDanhSachNhanSu(!!baoGomDaNghi) };
  } catch (e) {
    return { ok: false, loi: e.message + "\n" + e.stack };
  }
}

function guiDuLieuFormNhanSu() {
  try {
    return { ok: true, data: layDuLieuFormNhanSu() };
  } catch (e) {
    return { ok: false, loi: e.message + "\n" + e.stack };
  }
}

function guiThemNhanVien(d) {
  try {
    return themNhanVien(d);
  } catch (e) {
    return { ok: false, loi: e.message + "\n" + e.stack };
  }
}

function guiSuaNhanVien(d) {
  try {
    return suaNhanVien(d);
  } catch (e) {
    return { ok: false, loi: e.message + "\n" + e.stack };
  }
}

function guiChoNghiViec(maNV, ngayNghi) {
  try {
    return choNghiViec(maNV, ngayNghi);
  } catch (e) {
    return { ok: false, loi: e.message + "\n" + e.stack };
  }
}

function guiHuyNghiViec(maNV) {
  try {
    return huyNghiViec(maNV);
  } catch (e) {
    return { ok: false, loi: e.message + "\n" + e.stack };
  }
}

// ---------- Cầu nối cho tab "Nhập liệu" (bảng NHÁP dạng sheet thật) ----------

function guiXemTruocChamCong(base64, tenFile, mimeType) {
  try {
    return xemTruocChamCongTuFile(base64, tenFile, mimeType);
  } catch (e) {
    return { ok: false, loi: e.message + (e.message.indexOf("Drive") >= 0 ? " — kiểm tra đã bật Advanced Service \"Drive API\" chưa (xem HUONG_DAN_WEBAPP.md)." : "") };
  }
}

function guiDoiChieuLaiNhapChamCong() {
  try {
    return doiChieuLaiNhapChamCong();
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiXacNhanNapChamCongTuNhap(cheDoGhi) {
  try {
    return xacNhanNapChamCongTuNhap(cheDoGhi);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiHuyNhapChamCong() {
  try {
    return huyNhapChamCong();
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiXemTruocSanLuong(base64, tenFile, mimeType) {
  try {
    return xemTruocSanLuongTuFile(base64, tenFile, mimeType);
  } catch (e) {
    return { ok: false, loi: e.message + (e.message.indexOf("Drive") >= 0 ? " — kiểm tra đã bật Advanced Service \"Drive API\" chưa (xem HUONG_DAN_WEBAPP.md)." : "") };
  }
}

function guiDoiChieuLaiNhapSanLuong() {
  try {
    return doiChieuLaiNhapSanLuong();
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiXacNhanNapSanLuongTuNhap(loaiSanLuong, cheDoGhi) {
  try {
    return xacNhanNapSanLuongTuNhap(loaiSanLuong, cheDoGhi);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiHuyNhapSanLuong() {
  try {
    return huyNhapSanLuong();
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiXemTruocUngLuong(base64, tenFile, mimeType) {
  try {
    return xemTruocUngLuongTuFile(base64, tenFile, mimeType);
  } catch (e) {
    return { ok: false, loi: e.message + (e.message.indexOf("Drive") >= 0 ? " — kiểm tra đã bật Advanced Service \"Drive API\" chưa (xem HUONG_DAN_WEBAPP.md)." : "") };
  }
}

function guiDoiChieuLaiNhapUngLuong() {
  try {
    return doiChieuLaiNhapUngLuong();
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiXacNhanNapUngLuongTuNhap(cheDoGhi) {
  try {
    return xacNhanNapUngLuongTuNhap(cheDoGhi);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiHuyNhapUngLuong() {
  try {
    return huyNhapUngLuong();
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiUrlSheetNhap(tenSheet) {
  try {
    return { ok: true, url: guiUrlSheetNhap_(tenSheet) };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

// ---------- Cầu nối cho việc nhập/sửa/xoá thủ công Ứng lương & Bơm dăm ----------

function guiLayGiaoDich(loai, nam, thang) {
  try {
    return { ok: true, data: layGiaoDich(loai, nam, thang) };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiThemGiaoDich(loai, d) {
  try {
    return themGiaoDich(loai, d);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiSuaGiaoDich(loai, soDong, d) {
  try {
    return suaGiaoDich(loai, soDong, d);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiXoaGiaoDich(loai, soDong) {
  try {
    return xoaGiaoDich(loai, soDong);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

// ---------- Cầu nối cho tab "Danh mục" ----------

function guiLayDanhMuc(loai) {
  try {
    return { ok: true, data: layDanhMuc(loai) };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiThemDongDanhMuc(loai, d) {
  try {
    return themDongDanhMuc(loai, d);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiSuaDongDanhMuc(loai, soDong, d) {
  try {
    return suaDongDanhMuc(loai, soDong, d);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiXoaDongDanhMuc(loai, soDong) {
  try {
    return xoaDongDanhMuc(loai, soDong);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiKhoiTaoDanhMucMau(ghiDeCaKhiCoDuLieu) {
  try {
    return khoiTaoDanhMucMau(!!ghiDeCaKhiCoDuLieu);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiKhoiTaoQuyCheLuongHienHanh(ghiDeCaKhiCoDuLieu) {
  try {
    return khoiTaoQuyCheLuongHienHanh(!!ghiDeCaKhiCoDuLieu);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

// ---------- Cầu nối cho tab "Báo cáo" ----------

function guiBaoCaoTienLuong() {
  try {
    return { ok: true, data: baoCaoTienLuong() };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiBaoCaoTongHopCong(nam, thang) {
  try {
    return { ok: true, data: baoCaoTongHopCong(nam, thang) };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

/** Đọc toàn bộ NL_CHAMCONG (không lọc kỳ) — dùng cho tab "Xem lại chấm công" (lọc phía client). */
/**
 * Đọc NL_CHAMCONG (lọc theo NĂM nếu có truyền — giảm dữ liệu truyền qua mạng
 * khi lịch sử tích luỹ nhiều năm) — dùng cho tab "Xem lại chấm công" (lọc
 * tháng/phòng ban/tên/hình thức còn lại thực hiện phía client cho phản hồi
 * nhanh khi đổi bộ lọc).
 */
function guiXemChamCongDayDu(nam) {
  try {
    const header = headerChamCongDayDu_();
    let list = docSheetThanhObject_(SHEET_CHAMCONG, header);
    if (nam) {
      const namSo = Number(nam);
      list = list.filter(function (r) { return r["Ngày tính công"] instanceof Date && r["Ngày tính công"].getFullYear() === namSo; });
    }
    return { ok: true, data: list };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

// ---------- Cầu nối cho luồng nháp Phát sinh lương ----------

function guiXemTruocPSLuong(base64, tenFile, mimeType) {
  try {
    return xemTruocPSLuongTuFile(base64, tenFile, mimeType);
  } catch (e) {
    return { ok: false, loi: e.message + (e.message.indexOf("Drive") >= 0 ? " — kiểm tra đã bật Advanced Service \"Drive API\" chưa (xem HUONG_DAN_WEBAPP.md)." : "") };
  }
}

function guiDoiChieuLaiNhapPSLuong() {
  try {
    return doiChieuLaiNhapPSLuong();
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiXacNhanNapPSLuongTuNhap(cheDoGhi) {
  try {
    return xacNhanNapPSLuongTuNhap(cheDoGhi);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiHuyNhapPSLuong() {
  try {
    return huyNhapPSLuong();
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiBaoCaoNhanSu(baoGomDaNghi) {
  try {
    return { ok: true, data: baoCaoNhanSu(!!baoGomDaNghi) };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiBaoCaoBHXH() {
  try {
    return { ok: true, data: baoCaoBHXH() };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiBaoCaoTNCN() {
  try {
    return { ok: true, data: baoCaoTNCN() };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiBaoCaoPhanBoSanLuong(nam, thang, loai) {
  try {
    return { ok: true, data: baoCaoPhanBoSanLuong(nam, thang, loai) };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiBaoCaoBuSanLuong(nam, thang, phuongPhapBu) {
  try {
    return { ok: true, data: baoCaoBuSanLuong(nam, thang, phuongPhapBu) };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

// ---------- Cầu nối cho báo cáo "chốt", phiếu hạch toán, Lưu trữ ----------

function guiChotBaoCaoChamCong(nam, thang) {
  try {
    return chotBaoCaoChamCong(nam, thang);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiChotBaoCaoPhanBoSanLuong(nam, thang) {
  try {
    return chotBaoCaoPhanBoSanLuong(nam, thang);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiTaoBangHachToan(nam, thang) {
  try {
    return taoBangHachToan(nam, thang);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiTaoPhieuChi(nam, thang, loaiChi) {
  try {
    return taoPhieuChi(nam, thang, loaiChi);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiLayBangHachToan() {
  try {
    return { ok: true, data: docSheetThanhObject_(SHEET_HACHTOAN, HEADER_HACHTOAN) };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiLayPhieuChi() {
  try {
    return { ok: true, data: docSheetThanhObject_(SHEET_PHIEUCHI, HEADER_PHIEUCHI) };
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiLuuTruKy(nam, thang) {
  try {
    return luuTruKy(nam, thang);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}
