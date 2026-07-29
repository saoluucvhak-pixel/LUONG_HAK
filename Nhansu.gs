// ================= DANH MỤC NHÂN SỰ (xem / thêm / sửa / nghỉ việc) =================
// Gộp 2 sheet NL_NHANSU (hồ sơ lương) + NL_CHITIET_NS (hồ sơ cá nhân, thuế TNCN)
// thành 1 danh sách nhân sự duy nhất cho tab "Nhân sự" trên webapp.
//
// ⚠️ Mô hình đơn giản hoá: MỖI NHÂN VIÊN CHỈ CÓ 1 DÒNG ĐANG HOẠT ĐỘNG trong mỗi
// sheet (không lưu lịch sử nhiều dòng theo "Ngày cập nhật" như hệ thống Power
// Query thật — xem kien_truc_powerquery_powerpivot.md). Khi SỬA thông tin, dòng
// cũ bị GHI ĐÈ chứ không giữ lại bản trước đó. Nếu cần giữ lịch sử thay đổi lương
// qua từng thời kỳ, phải mở rộng thêm (xem ghi chú cuối file).

/**
 * Trả về danh sách nhân sự đầy đủ (gộp NL_NHANSU + NL_CHITIET_NS + tên phòng
 * ban/chức vụ) để hiển thị trên tab "Nhân sự".
 * @param {boolean} baoGomDaNghi true = lấy cả người đã nghỉ việc, false = chỉ người đang làm
 */
function layDanhSachNhanSu(baoGomDaNghi) {
  const nhanSuList = docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU);
  const chiTietList = docSheetThanhObject_(SHEET_CHITIETNS, HEADER_CHITIETNS);
  const chiTietMap = {};
  chiTietList.forEach(r => { chiTietMap[r["Mã nhân viên"]] = r; });

  const dmPhongBan = docDanhMucPhongBan_();
  const dmChucVu = docDanhMucChucVu_();
  const homNay = new Date();

  const ketQua = nhanSuList
    .map(ns => {
      const ct = chiTietMap[ns["Mã nhân viên"]] || {};
      const ngayNghi = ns["Ngày nghỉ/thay đổi"];
      const daNghi = (ngayNghi instanceof Date) && ngayNghi <= homNay;
      return {
        "Mã nhân viên": ns["Mã nhân viên"],
        "Họ và tên": ns["Họ và tên"],
        "Mã PB": ns["Mã PB"], "Tên phòng ban": tenPhongBan_(ns["Mã PB"], dmPhongBan),
        "Mã CV": ns["Mã CV"], "Tên chức vụ": tenChucVu_(ns["Mã CV"], dmChucVu),
        "Ngày vào làm": dinhDangNgay_(ns["Ngày vào làm"]),
        "Ngày hết hạn HĐ": dinhDangNgay_(ns["Ngày hết hạn HĐ"]),
        "Ngày nghỉ/thay đổi": dinhDangNgay_(ns["Ngày nghỉ/thay đổi"]),
        "Lương cơ bản": ns["Lương cơ bản"], "Lương thỏa thuận": ns["Lương thỏa thuận"],
        "Hình thức hợp đồng": ns["Hình thức hợp đồng"],
        "Mã tiền lương 1": ns["Mã tiền lương 1"], "Mã tiền lương 2": ns["Mã tiền lương 2"],
        "Mã tăng ca": ns["Mã tăng ca"], "Mã phụ cấp": ns["Mã phụ cấp"],
        "Mã hỗ trợ": ns["Mã hỗ trợ"], "Mã hỗ trợ 2": ns["Mã hỗ trợ 2"], "Mã BHXH": ns["Mã BHXH"], "Mã TNCN": ns["Mã TNCN"],
        "Ngày sinh": dinhDangNgay_(ct["Ngày sinh"]), "Thường trú": ct["Thường trú"],
        "Số HĐLĐ": ct["Số HĐLĐ"], "Mã GT_TNCN_BT": ct["Mã GT_TNCN_BT"],
        "Mã GT_TNCN_PT": ct["Mã GT_TNCN_PT"], "Người phụ thuộc": ct["Người phụ thuộc"] || 0,
        "Số tài khoản": ct["Số tài khoản"], "Tên Ngân hàng": ct["Tên Ngân hàng"],
        "Trạng thái": daNghi ? "Đã nghỉ" : "Đang làm"
      };
    })
    .filter(r => baoGomDaNghi || r["Trạng thái"] === "Đang làm");

  ketQua.sort((a, b) => String(a["Họ và tên"]).localeCompare(String(b["Họ và tên"]), "vi"));
  return ketQua;
}

/** Dữ liệu danh mục dùng để đổ vào các ô <select> trên form Thêm/Sửa nhân sự. */
function layDuLieuFormNhanSu() {
  return {
    phongBan: Object.values(docDanhMucPhongBan_()),
    chucVu: Object.values(docDanhMucChucVu_()),
    hinhThucLuong: Object.values(docDanhMucLuong_()),
    tangCa: Object.values(docDanhMucTangCa_()),
    phuCap: Object.values(docDanhMucPhuCap_()),
    hoTro: Object.values(docDanhMucHoTro_()),
    baoHiem: Object.values(docDanhMucBaoHiem_()),
    giamTruTNCN: Object.values(docDanhMucGiamTruTNCN_())
  };
}

/**
 * Thêm nhân viên mới. Ghi vào cả NL_NHANSU và NL_CHITIET_NS.
 * @param {Object} d dữ liệu form gửi lên từ index.html (xem tên field trong index.html)
 * @return {{ok: boolean, loi: string}}
 */
function themNhanVien(d) {
  const maNV = String(d.maNhanVien || "").trim();
  if (!maNV) return { ok: false, loi: "Thiếu Mã nhân viên" };
  if (timHangTheoMa_(SHEET_NHANSU, HEADER_NHANSU, "Mã nhân viên", maNV) > 0) {
    return { ok: false, loi: "Mã nhân viên \"" + maNV + "\" đã tồn tại — dùng chức năng Sửa thay vì Thêm mới" };
  }

  const homNay = new Date();
  themHangMoi_(SHEET_NHANSU, HEADER_NHANSU, {
    "Ngày cập nhật": homNay, "Mã nhân viên": maNV, "Họ và tên": d.hoTen,
    "Mã PB": d.maPB, "Mã CV": d.maCV,
    "Ngày vào làm": chuoiThanhNgay_(d.ngayVaoLam), "Ngày hết hạn HĐ": chuoiThanhNgay_(d.ngayHetHanHD),
    "Ngày nghỉ/thay đổi": "",
    "Lương cơ bản": Number(d.luongCoBan) || 0, "Lương thỏa thuận": Number(d.luongThoaThuan) || 0,
    "Hình thức hợp đồng": d.hinhThucHopDong,
    "Mã tiền lương 1": d.maTienLuong1, "Mã tiền lương 2": d.maTienLuong2 || "",
    "Mã tăng ca": d.maTangCa || "", "Mã phụ cấp": d.maPhuCap || "",
    "Mã hỗ trợ": d.maHoTro || "", "Mã hỗ trợ 2": d.maHoTro2 || "", "Mã BHXH": d.maBaoHiem || "", "Mã TNCN": d.maTNCN || ""
  });

  themHangMoi_(SHEET_CHITIETNS, HEADER_CHITIETNS, {
    "Ngày cập nhật": homNay, "Mã nhân viên": maNV, "Họ và tên": d.hoTen,
    "Ngày sinh": chuoiThanhNgay_(d.ngaySinh), "Thường trú": d.thuongTru,
    "Ngày cấp CCCD": chuoiThanhNgay_(d.ngayCapCCCD), "Nơi cấp": d.noiCap,
    "Mã BHXH": d.soBHXH || "", "Số điện thoại": d.soDienThoai, "Số HĐLĐ": d.soHDLD,
    "Mã GT_TNCN_BT": d.maGTTNCNBanThan || "GTBT.01", "Mã GT_TNCN_PT": d.maGTTNCNPhuThuoc || "",
    "Người phụ thuộc": Number(d.nguoiPhuThuoc) || 0,
    "Số tài khoản": d.soTaiKhoan, "Tên Ngân hàng": d.tenNganHang
  });

  return { ok: true, loi: "" };
}

/**
 * Sửa thông tin nhân viên đã có (ghi đè đúng dòng theo Mã nhân viên).
 * @param {Object} d giống themNhanVien(), bắt buộc có d.maNhanVien
 */
function suaNhanVien(d) {
  const maNV = String(d.maNhanVien || "").trim();
  if (!maNV) return { ok: false, loi: "Thiếu Mã nhân viên" };

  const hangNS = timHangTheoMa_(SHEET_NHANSU, HEADER_NHANSU, "Mã nhân viên", maNV);
  if (hangNS < 0) return { ok: false, loi: "Không tìm thấy nhân viên có mã \"" + maNV + "\" trong NL_NHANSU" };

  const shNS = layHoacTaoSheet_(SHEET_NHANSU, HEADER_NHANSU);
  const dongCu = shNS.getRange(hangNS, 1, 1, HEADER_NHANSU.length).getValues()[0];
  const nsCu = {};
  HEADER_NHANSU.forEach((ten, i) => { nsCu[ten] = dongCu[i]; });

  ghiHang_(SHEET_NHANSU, HEADER_NHANSU, hangNS, {
    "Ngày cập nhật": new Date(), "Mã nhân viên": maNV, "Họ và tên": d.hoTen,
    "Mã PB": d.maPB, "Mã CV": d.maCV,
    "Ngày vào làm": chuoiThanhNgay_(d.ngayVaoLam) || nsCu["Ngày vào làm"],
    "Ngày hết hạn HĐ": chuoiThanhNgay_(d.ngayHetHanHD),
    "Ngày nghỉ/thay đổi": nsCu["Ngày nghỉ/thay đổi"], // KHÔNG đổi ở đây — dùng choNghiViec() riêng
    "Lương cơ bản": Number(d.luongCoBan) || 0, "Lương thỏa thuận": Number(d.luongThoaThuan) || 0,
    "Hình thức hợp đồng": d.hinhThucHopDong,
    "Mã tiền lương 1": d.maTienLuong1, "Mã tiền lương 2": d.maTienLuong2 || "",
    "Mã tăng ca": d.maTangCa || "", "Mã phụ cấp": d.maPhuCap || "",
    "Mã hỗ trợ": d.maHoTro || "", "Mã hỗ trợ 2": d.maHoTro2 || "", "Mã BHXH": d.maBaoHiem || "", "Mã TNCN": d.maTNCN || ""
  });

  const hangCT = timHangTheoMa_(SHEET_CHITIETNS, HEADER_CHITIETNS, "Mã nhân viên", maNV);
  const duLieuCT = {
    "Ngày cập nhật": new Date(), "Mã nhân viên": maNV, "Họ và tên": d.hoTen,
    "Ngày sinh": chuoiThanhNgay_(d.ngaySinh), "Thường trú": d.thuongTru,
    "Ngày cấp CCCD": chuoiThanhNgay_(d.ngayCapCCCD), "Nơi cấp": d.noiCap,
    "Mã BHXH": d.soBHXH || "", "Số điện thoại": d.soDienThoai, "Số HĐLĐ": d.soHDLD,
    "Mã GT_TNCN_BT": d.maGTTNCNBanThan || "GTBT.01", "Mã GT_TNCN_PT": d.maGTTNCNPhuThuoc || "",
    "Người phụ thuộc": Number(d.nguoiPhuThuoc) || 0,
    "Số tài khoản": d.soTaiKhoan, "Tên Ngân hàng": d.tenNganHang
  };
  if (hangCT > 0) {
    ghiHang_(SHEET_CHITIETNS, HEADER_CHITIETNS, hangCT, duLieuCT);
  } else {
    themHangMoi_(SHEET_CHITIETNS, HEADER_CHITIETNS, duLieuCT); // chưa có hồ sơ chi tiết trước đó
  }

  return { ok: true, loi: "" };
}

/**
 * Cho nhân viên nghỉ việc — chỉ cập nhật "Ngày nghỉ/thay đổi" trong NL_NHANSU,
 * KHÔNG xoá dữ liệu (để vẫn tính lương đúng cho những kỳ trước khi nghỉ).
 * @param {string} maNV
 * @param {string} ngayNghi chuỗi "YYYY-MM-DD" từ <input type="date">
 */
function choNghiViec(maNV, ngayNghi) {
  const hang = timHangTheoMa_(SHEET_NHANSU, HEADER_NHANSU, "Mã nhân viên", maNV);
  if (hang < 0) return { ok: false, loi: "Không tìm thấy nhân viên có mã \"" + maNV + "\"" };
  const sh = layHoacTaoSheet_(SHEET_NHANSU, HEADER_NHANSU);
  const cotNgayNghi = HEADER_NHANSU.indexOf("Ngày nghỉ/thay đổi") + 1;
  sh.getRange(hang, cotNgayNghi).setValue(chuoiThanhNgay_(ngayNghi) || new Date());
  return { ok: true, loi: "" };
}

/** Phục hồi nhân viên đã lỡ cho nghỉ (xoá "Ngày nghỉ/thay đổi"). */
function huyNghiViec(maNV) {
  const hang = timHangTheoMa_(SHEET_NHANSU, HEADER_NHANSU, "Mã nhân viên", maNV);
  if (hang < 0) return { ok: false, loi: "Không tìm thấy nhân viên có mã \"" + maNV + "\"" };
  const sh = layHoacTaoSheet_(SHEET_NHANSU, HEADER_NHANSU);
  const cotNgayNghi = HEADER_NHANSU.indexOf("Ngày nghỉ/thay đổi") + 1;
  sh.getRange(hang, cotNgayNghi).setValue("");
  return { ok: true, loi: "" };
}

function dinhDangNgay_(gt) {
  if (gt instanceof Date) return Utilities.formatDate(gt, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return gt || "";
}

// ================= GHI CHÚ MỞ RỘNG (nếu sau này cần) =================
// Nếu công ty cần GIỮ LỊCH SỬ thay đổi lương/chức vụ qua từng thời điểm (đúng như
// hệ thống Power Query thật — mỗi lần đổi lương thêm 1 dòng mới với "Ngày cập nhật"
// mới, và khi tính lương luôn lấy dòng có "Ngày cập nhật" gần nhất TRƯỚC kỳ đang
// tính), cần đổi: (1) suaNhanVien() → themHangMoi_() thay vì ghiHang_() (luôn thêm
// dòng mới thay vì ghi đè), và (2) tinhBangLuong() trong TinhLuong.gs → lọc đúng
// dòng theo "Ngày cập nhật" mới nhất trước kỳ tính lương thay vì đọc thẳng
// docSheetThanhObject_() (vốn trả về TẤT CẢ các dòng, kể cả dòng lịch sử cũ).
