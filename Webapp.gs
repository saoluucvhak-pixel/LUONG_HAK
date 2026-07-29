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
  return moSheet_().getUrl();
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

function guiUrlSheetNhap(tenSheet) {
  try {
    return { ok: true, url: guiUrlSheetNhap_(tenSheet) };
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

function guiSuaDongDanhMuc(loai, d) {
  try {
    return suaDongDanhMuc(loai, d);
  } catch (e) {
    return { ok: false, loi: e.message };
  }
}

function guiXoaDongDanhMuc(loai, ma) {
  try {
    return xoaDongDanhMuc(loai, ma);
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

// ---------- Cầu nối cho tab "Báo cáo" ----------

function guiBaoCaoTienLuong() {
  try {
    return { ok: true, data: baoCaoTienLuong() };
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
