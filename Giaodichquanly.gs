// ================= NHẬP/SỬA/XOÁ THỦ CÔNG — ỨNG LƯƠNG & BƠM DĂM =================
// Khác với "Nhập liệu" (tải nguyên file lên qua bảng nháp), đây là cách nhập TỪNG
// DÒNG MỘT trực tiếp qua form trên webapp — dùng khi chỉ có vài giao dịch lẻ (1
// phiếu tạm ứng, 1 chuyến bơm dăm...) không đáng phải chuẩn bị hẳn 1 file Excel.
// Ứng lương và Bơm dăm KHÔNG có "mã" duy nhất tự nhiên như danh mục — dùng luôn
// SỐ THỨ TỰ DÒNG THẬT trong sheet (tính từ dòng 2, sau tiêu đề) làm định danh khi
// sửa/xoá.

const GIAO_DICH_CAU_HINH = {
  UNGLUONG: { sheet: SHEET_UNGLUONG, header: HEADER_UNGLUONG, ngayCot: "Ngày hạch toán" },
  BANDAM: { sheet: SHEET_BANDAM, header: HEADER_SANLUONG, ngayCot: "Ngày cân" },
  SANLUONG: { sheet: SHEET_SANLUONG, header: HEADER_SANLUONG, ngayCot: "Ngày cân" },
  PSLUONG: { sheet: SHEET_PSLUONG, header: HEADER_PSLUONG, ngayCot: "Ngày hạch toán" }
};

/**
 * Xem danh sách giao dịch (Ứng lương/Bơm dăm), có thể lọc theo tháng/năm.
 * Mỗi dòng trả về kèm "_soDong" (số dòng thật trong sheet) để dùng khi Sửa/Xoá.
 * @param {string} loai "UNGLUONG" hoặc "BANDAM"
 * @param {string|number} nam để trống ("") = lấy tất cả các kỳ
 * @param {string|number} thang để trống ("") = lấy tất cả các kỳ
 */
function layGiaoDich(loai, nam, thang) {
  const cauHinh = GIAO_DICH_CAU_HINH[loai];
  if (!cauHinh) throw new Error("Loại giao dịch không hợp lệ: " + loai);
  const sh = layHoacTaoSheet_(cauHinh.sheet, cauHinh.header);
  if (sh.getLastRow() < 2) return [];
  const soHang = sh.getLastRow() - 1;
  const values = sh.getRange(2, 1, soHang, cauHinh.header.length).getValues();
  const ketQua = [];
  values.forEach(function (row, i) {
    if (row.every(function (v) { return v === "" || v === null; })) return; // bỏ dòng trống
    const obj = { _soDong: i + 2 };
    cauHinh.header.forEach(function (ten, c) { obj[ten] = row[c]; });
    if (nam !== "" && nam !== undefined && nam !== null) {
      const ngay = obj[cauHinh.ngayCot];
      if (!(ngay instanceof Date)) return;
      if (ngay.getFullYear() != nam) return;
      if (thang !== "" && thang !== undefined && thang !== null && (ngay.getMonth() + 1) != Number(thang)) return;
    }
    ketQua.push(obj);
  });
  // Mới nhất lên trước cho dễ nhìn
  ketQua.sort(function (a, b) {
    const da = a[cauHinh.ngayCot] instanceof Date ? a[cauHinh.ngayCot].getTime() : 0;
    const db = b[cauHinh.ngayCot] instanceof Date ? b[cauHinh.ngayCot].getTime() : 0;
    return db - da;
  });
  return ketQua;
}

/** Chuyển các trường ngày dạng chuỗi "YYYY-MM-DD" (từ form web) sang Date trước khi ghi. */
function chuanHoaNgayGiaoDich_(loai, data) {
  const cot = GIAO_DICH_CAU_HINH[loai].ngayCot;
  const banSao = Object.assign({}, data);
  if (banSao[cot]) banSao[cot] = chuoiThanhNgay_(banSao[cot]);
  return banSao;
}

/** Thêm 1 dòng giao dịch mới (Ứng lương hoặc Bơm dăm). */
function themGiaoDich(loai, data) {
  const cauHinh = GIAO_DICH_CAU_HINH[loai];
  if (!cauHinh) return { ok: false, loi: "Loại giao dịch không hợp lệ: " + loai };
  const duLieu = chuanHoaNgayGiaoDich_(loai, data);
  const loiKiemTra = kiemTraGiaoDich_(loai, duLieu);
  if (loiKiemTra) return { ok: false, loi: loiKiemTra };
  themHangMoi_(cauHinh.sheet, cauHinh.header, duLieu);
  return { ok: true };
}

/** Sửa 1 dòng giao dịch đã có, xác định theo "_soDong" (số dòng thật trong sheet). */
function suaGiaoDich(loai, soDong, data) {
  const cauHinh = GIAO_DICH_CAU_HINH[loai];
  if (!cauHinh) return { ok: false, loi: "Loại giao dịch không hợp lệ: " + loai };
  if (!soDong || soDong < 2) return { ok: false, loi: "Thiếu vị trí dòng cần sửa." };
  const duLieu = chuanHoaNgayGiaoDich_(loai, data);
  const loiKiemTra = kiemTraGiaoDich_(loai, duLieu);
  if (loiKiemTra) return { ok: false, loi: loiKiemTra };
  ghiHang_(cauHinh.sheet, cauHinh.header, soDong, duLieu);
  return { ok: true };
}

/** Xoá hẳn 1 dòng giao dịch, xác định theo "_soDong". */
function xoaGiaoDich(loai, soDong) {
  const cauHinh = GIAO_DICH_CAU_HINH[loai];
  if (!cauHinh) return { ok: false, loi: "Loại giao dịch không hợp lệ: " + loai };
  if (!soDong || soDong < 2) return { ok: false, loi: "Thiếu vị trí dòng cần xoá." };
  layHoacTaoSheet_(cauHinh.sheet, cauHinh.header).deleteRow(soDong);
  return { ok: true };
}

/** Kiểm tra hợp lệ trước khi Thêm/Sửa — đối chiếu Mã NV, ngày, số tiền. */
function kiemTraGiaoDich_(loai, data) {
  const nhanSuSet = {};
  docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU).forEach(function (ns) { nhanSuSet[ns["Mã nhân viên"]] = true; });

  if (loai === "UNGLUONG") {
    if (!data["Mã NV"] || !nhanSuSet[data["Mã NV"]]) return "Mã NV \"" + (data["Mã NV"] || "") + "\" không có trong NL_NHANSU";
    if (!data["Ngày hạch toán"]) return "Thiếu Ngày hạch toán";
    const tamUng = Number(data["Tạm ứng"]);
    if (isNaN(tamUng) || tamUng < 0) return "\"Tạm ứng\" phải là số không âm";
  } else if (loai === "PSLUONG") {
    if (!data["Mã NV"] || !nhanSuSet[data["Mã NV"]]) return "Mã NV \"" + (data["Mã NV"] || "") + "\" không có trong NL_NHANSU";
    if (!data["Ngày hạch toán"]) return "Thiếu Ngày hạch toán";
  } else if (loai === "BANDAM" || loai === "SANLUONG") {
    if (!data["Ngày cân"]) return "Thiếu Ngày cân";
    if (!data["Mã phòng ban"]) return "Thiếu Mã phòng ban";
    else {
      const phongBanSet = {};
      docSheetThanhObject_(SHEET_DM_PHONGBAN, HEADER_DM_PHONGBAN).forEach(function (pb) { phongBanSet[pb["Mã phòng ban"]] = true; });
      if (!phongBanSet[data["Mã phòng ban"]]) return "Mã phòng ban \"" + data["Mã phòng ban"] + "\" không có trong DM_PHONGBAN";
    }
    if (data["Mã NV"] && !nhanSuSet[data["Mã NV"]]) return "Mã NV \"" + data["Mã NV"] + "\" không có trong NL_NHANSU";
    const kl = Number(data["KL hàng (Tấn)"]);
    if (!kl || kl <= 0) return "\"KL hàng (Tấn)\" phải là số dương";
  }
  return null; // không có lỗi
}
