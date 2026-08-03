// ================= QUẢN LÝ DANH MỤC (DM_*) — CÓ HIỆU LỰC THEO KỲ =================
// (1) CRUD chung cho tab "Danh mục" trên webapp — sửa/xoá theo SỐ DÒNG THẬT
// trong sheet (không theo mã nữa, vì 1 mã có thể có NHIỀU dòng theo thời gian).
// (2) Nút "Khởi tạo dữ liệu mẫu"/"Khởi tạo Quy chế lương hiện hành" để có ngay
// dữ liệu dùng thử — LUÔN kiểm tra lại số liệu mẫu so với quy định thật.
//
// ⚠ VERSIONING: 7/9 loại danh mục (trừ PHONGBAN/CHUCVU — thông tin tổ chức,
// không phải mức lương) có "Hiệu lực từ"/"Hiệu lực đến". Thêm 1 dòng mới cho
// MÃ ĐÃ CÓ SẴN = tạo 1 PHIÊN BẢN MỚI (không còn bị chặn "trùng mã" như trước) —
// hệ thống TỰ ĐỘNG đóng phiên bản đang mở trước đó (set "Hiệu lực đến" = ngày
// trước "Hiệu lực từ" của bản mới 1 ngày).
//
// ⚠ QUY TẮC "ĐÃ DÙNG THÌ KHÔNG CHO XOÁ": trước khi xoá 1 mã, kiểm tra mã đó đã
// được gán cho nhân viên nào trong NL_NHANSU/NL_CHITIET_NS chưa — nếu có, CHẶN
// xoá (báo rõ lý do) để không làm "gãy" dữ liệu lịch sử đã tính lương dựa trên
// mã đó. Muốn ngừng dùng 1 mã, nên đóng hiệu lực (set "Hiệu lực đến") thay vì xoá.

const DANH_MUC_CAU_HINH = {
  PHONGBAN: { sheet: SHEET_DM_PHONGBAN, header: HEADER_DM_PHONGBAN, khoa: "Mã phòng ban", coHieuLuc: false },
  CHUCVU: { sheet: SHEET_DM_CHUCVU, header: HEADER_DM_CHUCVU, khoa: "Mã chức vụ", coHieuLuc: false },
  PHUCAP: { sheet: SHEET_DM_PHUCAP, header: HEADER_DM_PHUCAP, khoa: "Mã phụ cấp", coHieuLuc: true },
  HOTRO: { sheet: SHEET_DM_HOTRO, header: HEADER_DM_HOTRO, khoa: "Mã hỗ trợ", coHieuLuc: true },
  TANGCA: { sheet: SHEET_DM_TANGCA, header: HEADER_DM_TANGCA, khoa: "Mã tăng ca", coHieuLuc: true },
  BAOHIEM: { sheet: SHEET_DM_BAOHIEM, header: HEADER_DM_BAOHIEM, khoa: "Mã bảo hiểm", coHieuLuc: true },
  LUONG: { sheet: SHEET_DM_LUONG, header: HEADER_DM_LUONG, khoa: "Mã lương", coHieuLuc: true },
  GTTNCN: { sheet: SHEET_DM_GTTNCN, header: HEADER_DM_GTTNCN, khoa: "Mã giảm trừ", coHieuLuc: true },
  TNCN: { sheet: SHEET_DM_TNCN, header: HEADER_DM_TNCN, khoa: "Bậc", coHieuLuc: true },
  // ⚠ "CHIPHI" (Tài khoản chi phí theo phòng ban) KHÔNG có trong
  // DANH_MUC_SHEET_NGOAI_ (DongBoNgoai.gs) — nghĩa là KHÔNG đồng bộ từ nguồn
  // ngoài, luôn cho nhập/sửa/xoá tay trên webapp (đúng ý: tài khoản chi phí
  // có thể khác mỗi kỳ, và DM_PHONGBAN ở nguồn ngoài không có trường này nên
  // không thể "mượn" theo — phải quản lý độc lập, có hiệu lực theo ngày).
  CHIPHI: { sheet: SHEET_DM_CHIPHI, header: HEADER_DM_CHIPHI, khoa: "Mã phòng ban", coHieuLuc: true }
};

/**
 * Xem TOÀN BỘ các dòng (mọi phiên bản theo thời gian) của 1 loại danh mục —
 * dùng cho tab "Danh mục" trên webapp (người quản lý cần thấy hết lịch sử để
 * biết đang sửa/xoá đúng phiên bản nào). Mỗi dòng kèm "_soDong" (số dòng thật
 * trong sheet) để dùng khi Sửa/Xoá.
 */
/**
 * ⚠ SỬA LỖI TƯƠNG TỰ ĐÃ GẶP Ở `docSheetNgoai_()` (DongBoNgoai.gs): TRƯỚC ĐÂY
 * tin mù quáng vào `sh.getLastRow()` để tính số dòng cần đọc — nhưng nếu
 * sheet nội bộ này TỪNG bị ghi dữ liệu thừa (từ các lần đồng bộ CŨ, trước khi
 * `ghiDeSheet_`/`docSheetNgoai_` được sửa để tránh đọc "vùng dữ liệu" bị thổi
 * phồng ở nguồn ngoài), "used range" của sheet NỘI BỘ có thể VẪN CÒN CAO dù
 * nội dung đã bị xoá (Google Sheets không luôn tự giảm used range khi xoá nội
 * dung) — khiến MỖI LẦN xem Danh mục phải đọc dư thừa hàng trăm/nghìn dòng
 * trống, có thể gây lỗi/chậm bất thường khi trả kết quả qua `google.script.run`.
 * Giờ tìm ĐÚNG dòng cuối có dữ liệu thật (dựa vào cột đầu tiên "Ngày cập
 * nhật", luôn có giá trị ở mọi dòng thật) trước khi đọc toàn bộ cột.
 */
function layDanhMuc(loai) {
  const cauHinh = DANH_MUC_CAU_HINH[loai];
  if (!cauHinh) throw new Error("Loại danh mục không hợp lệ: " + loai);
  const sh = moSheetChiDoc_(cauHinh.sheet, cauHinh.header);
  const soHangToiDa = sh.getLastRow();
  if (soHangToiDa < 2) return [];

  const cotDau = sh.getRange(2, 1, soHangToiDa - 1, 1).getValues();
  let soHang = 0;
  for (let i = cotDau.length - 1; i >= 0; i--) {
    if (cotDau[i][0] !== "" && cotDau[i][0] !== null) { soHang = i + 1; break; }
  }
  if (soHang === 0) return [];

  const values = sh.getRange(2, 1, soHang, cauHinh.header.length).getValues();
  const ketQua = [];
  values.forEach(function (row, i) {
    if (row.every(function (v) { return v === "" || v === null; })) return;
    const obj = { _soDong: i + 2 };
    cauHinh.header.forEach(function (ten, c) { obj[ten] = row[c]; });
    ketQua.push(obj);
  });
  // Mới nhất lên trước (theo "Hiệu lực từ" nếu có, không thì theo thứ tự dòng)
  // ⚠ Sắp xếp TRƯỚC khi chuyển Date→String bên dưới, vì cần so sánh theo giá
  // trị Date gốc (getTime()), không phải chuỗi text.
  if (cauHinh.coHieuLuc) {
    ketQua.sort(function (a, b) {
      const ta = a["Hiệu lực từ"] instanceof Date ? a["Hiệu lực từ"].getTime() : 0;
      const tb = b["Hiệu lực từ"] instanceof Date ? b["Hiệu lực từ"].getTime() : 0;
      if (tb !== ta) return tb - ta;
      return String(a[cauHinh.khoa]).localeCompare(String(b[cauHinh.khoa]));
    });
  }
  // ⚠ THỬ NGHIỆM QUAN TRỌNG: chuyển MỌI Date object thành CHUỖI TEXT ở BƯỚC
  // CUỐI CÙNG này (sau khi đã sort xong) — khác với `layDanhSachNhanSu()`
  // (đã luôn làm việc này qua `dinhDangNgay_()` từ trước) — nghi ngờ đây
  // chính là nguyên nhân khiến `google.script.run` trả về `null` cho riêng
  // luồng Danh mục, dù logic JS không có gì sai và chạy đúng khi Test trực
  // tiếp trong Apps Script Editor.
  ketQua.forEach(function (obj) {
    Object.keys(obj).forEach(function (ten) {
      if (obj[ten] instanceof Date) {
        obj[ten] = Utilities.formatDate(obj[ten], Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
    });
  });
  return ketQua;
}

/**
 * Thêm 1 dòng mới vào danh mục.
 * - Loại KHÔNG có hiệu lực (PHONGBAN/CHUCVU): chặn trùng mã như trước.
 * - Loại CÓ hiệu lực: cho phép thêm PHIÊN BẢN MỚI cho mã đã tồn tại — bắt buộc
 *   phải điền "Hiệu lực từ", tự động đóng phiên bản đang mở (nếu có).
 */
function themDongDanhMuc(loai, dataObj) {
  const cauHinh = DANH_MUC_CAU_HINH[loai];
  if (!cauHinh) return { ok: false, loi: "Loại danh mục không hợp lệ: " + loai };
  const ma = dataObj[cauHinh.khoa];
  if (!ma) return { ok: false, loi: "Thiếu " + cauHinh.khoa };

  if (!cauHinh.coHieuLuc) {
    if (timHangTheoMa_(cauHinh.sheet, cauHinh.header, cauHinh.khoa, ma) > 0) {
      return { ok: false, loi: "Mã \"" + ma + "\" đã tồn tại trong danh mục này" };
    }
    const dataDayDu = Object.assign({ "Ngày cập nhật": new Date() }, dataObj);
    themHangMoi_(cauHinh.sheet, cauHinh.header, dataDayDu);
    return { ok: true };
  }

  // ---- Loại CÓ hiệu lực ----
  const hieuLucTuMoi = dataObj["Hiệu lực từ"] ? chuoiThanhNgay_(dataObj["Hiệu lực từ"]) : "";
  if (!hieuLucTuMoi) return { ok: false, loi: "Danh mục này CÓ hiệu lực theo thời gian — bắt buộc phải điền \"Hiệu lực từ\"." };

  const ketQuaDong = tuDongDongPhienBanCu_(cauHinh, ma, hieuLucTuMoi);
  if (ketQuaDong && ketQuaDong.loi) return ketQuaDong;

  const dataDayDu = Object.assign({ "Ngày cập nhật": new Date() }, dataObj);
  dataDayDu["Hiệu lực từ"] = hieuLucTuMoi;
  if (dataObj["Hiệu lực đến"]) dataDayDu["Hiệu lực đến"] = chuoiThanhNgay_(dataObj["Hiệu lực đến"]);
  themHangMoi_(cauHinh.sheet, cauHinh.header, dataDayDu);
  return { ok: true, daDongPhienBanCu: !!(ketQuaDong && ketQuaDong.daDong) };
}

/**
 * Tìm phiên bản ĐANG MỞ (Hiệu lực đến rỗng) của 1 mã có "Hiệu lực từ" SỚM HƠN
 * hieuLucTuMoi — nếu có, tự động set "Hiệu lực đến" = hieuLucTuMoi trừ 1 ngày.
 */
function tuDongDongPhienBanCu_(cauHinh, ma, hieuLucTuMoi) {
  const sh = layHoacTaoSheet_(cauHinh.sheet, cauHinh.header);
  if (sh.getLastRow() < 2) return { daDong: false };
  const soHang = sh.getLastRow() - 1;
  const values = sh.getRange(2, 1, soHang, cauHinh.header.length).getValues();
  const idxMa = cauHinh.header.indexOf(cauHinh.khoa);
  const idxTu = cauHinh.header.indexOf("Hiệu lực từ");
  const idxDen = cauHinh.header.indexOf("Hiệu lực đến");

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (String(row[idxMa]) !== String(ma)) continue;
    const hlDen = row[idxDen];
    const daMo = !(hlDen instanceof Date); // chưa có Hiệu lực đến = đang mở
    if (!daMo) continue;
    const hlTu = row[idxTu];
    if (hlTu instanceof Date && hlTu >= hieuLucTuMoi) continue; // bản cũ không "cũ hơn" bản mới, bỏ qua
    const ngayDong = new Date(hieuLucTuMoi.getTime() - 24 * 60 * 60 * 1000);
    sh.getRange(i + 2, idxDen + 1).setValue(ngayDong);
    return { daDong: true };
  }
  return { daDong: false };
}

/** Sửa 1 dòng danh mục đã có, xác định theo SỐ DÒNG THẬT ("_soDong" trả về từ layDanhMuc). */
function suaDongDanhMuc(loai, soDong, dataObj) {
  const cauHinh = DANH_MUC_CAU_HINH[loai];
  if (!cauHinh) return { ok: false, loi: "Loại danh mục không hợp lệ: " + loai };
  if (!soDong || soDong < 2) return { ok: false, loi: "Thiếu vị trí dòng cần sửa." };
  const dataDayDu = Object.assign({ "Ngày cập nhật": new Date() }, dataObj);
  if (cauHinh.coHieuLuc) {
    if (dataObj["Hiệu lực từ"]) dataDayDu["Hiệu lực từ"] = chuoiThanhNgay_(dataObj["Hiệu lực từ"]);
    if (dataObj["Hiệu lực đến"]) dataDayDu["Hiệu lực đến"] = chuoiThanhNgay_(dataObj["Hiệu lực đến"]);
  }
  ghiHang_(cauHinh.sheet, cauHinh.header, soDong, dataDayDu);
  return { ok: true };
}

/**
 * Xoá 1 dòng danh mục theo SỐ DÒNG — CHẶN xoá nếu mã đó đang được gán cho bất
 * kỳ nhân viên nào (xem `maDangDuocDung_`). Muốn ngừng dùng 1 mã, đóng hiệu lực
 * (sửa "Hiệu lực đến") thay vì xoá hẳn.
 */
function xoaDongDanhMuc(loai, soDong) {
  const cauHinh = DANH_MUC_CAU_HINH[loai];
  if (!cauHinh) return { ok: false, loi: "Loại danh mục không hợp lệ: " + loai };
  if (!soDong || soDong < 2) return { ok: false, loi: "Thiếu vị trí dòng cần xoá." };

  const sh = layHoacTaoSheet_(cauHinh.sheet, cauHinh.header);
  const idxMa = cauHinh.header.indexOf(cauHinh.khoa);
  const ma = sh.getRange(soDong, idxMa + 1).getValue();

  const lyDoDangDung = maDangDuocDung_(loai, ma);
  if (lyDoDangDung) {
    return { ok: false, loi: "Không thể xoá mã \"" + ma + "\" — " + lyDoDangDung + ". Nếu muốn ngừng dùng, sửa \"Hiệu lực đến\" thay vì xoá." };
  }

  sh.deleteRow(soDong);
  return { ok: true };
}

/**
 * Kiểm tra 1 mã danh mục đã được gán cho nhân viên nào trong NL_NHANSU/
 * NL_CHITIET_NS chưa. Trả về null nếu CHƯA dùng (an toàn để xoá), hoặc chuỗi
 * mô tả lý do nếu ĐÃ dùng (chặn xoá).
 */
function maDangDuocDung_(loai, ma) {
  if (!ma) return null;
  const CAC_TRUONG_KIEM_TRA = {
    LUONG: { sheet: SHEET_NHANSU, header: HEADER_NHANSU, cot: ["Mã tiền lương 1", "Mã tiền lương 2"] },
    TANGCA: { sheet: SHEET_NHANSU, header: HEADER_NHANSU, cot: ["Mã tăng ca"] },
    PHUCAP: { sheet: SHEET_NHANSU, header: HEADER_NHANSU, cot: ["Mã phụ cấp"] },
    HOTRO: { sheet: SHEET_NHANSU, header: HEADER_NHANSU, cot: ["Mã hỗ trợ", "Mã hỗ trợ 2"] },
    BAOHIEM: { sheet: SHEET_NHANSU, header: HEADER_NHANSU, cot: ["Mã BHXH"] },
    PHONGBAN: { sheet: SHEET_NHANSU, header: HEADER_NHANSU, cot: ["Mã PB"] },
    CHUCVU: { sheet: SHEET_NHANSU, header: HEADER_NHANSU, cot: ["Mã CV"] },
    GTTNCN: { sheet: SHEET_CHITIETNS, header: HEADER_CHITIETNS, cot: ["Mã GT_TNCN_BT", "Mã GT_TNCN_PT"] }
    // TNCN (biểu thuế 7 bậc) không gán trực tiếp ở hồ sơ nhân viên — không cần kiểm tra.
  };
  const cauHinhKT = CAC_TRUONG_KIEM_TRA[loai];
  if (!cauHinhKT) return null;

  const list = docSheetThanhObject_(cauHinhKT.sheet, cauHinhKT.header);
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    for (let c = 0; c < cauHinhKT.cot.length; c++) {
      if (String(r[cauHinhKT.cot[c]]) === String(ma)) {
        const tenNV = r["Họ và tên"] || r["Mã nhân viên"] || "";
        return "đang được gán cho nhân viên \"" + tenNV + "\" (cột \"" + cauHinhKT.cot[c] + "\")";
      }
    }
  }
  return null;
}

/**
 * Khởi tạo Quy chế lương hiện hành — số liệu chính thức đang áp dụng (mức
 * lương, hệ số, công thức) cho toàn bộ danh mục DM_*. Quy chế này được cập
 * nhật theo từng thời điểm ban hành — khi công ty điều chỉnh mức lương/phụ
 * cấp/tăng ca, sửa trực tiếp các dòng tương ứng trong tab Danh mục (không cần
 * chạy lại hàm này, chỉ cần khi khởi tạo Google Sheet lần đầu hoặc khi muốn
 * nạp lại từ đầu).
 * @param {boolean} ghiDeCaKhiCoDuLieu true = xoá hết & ghi đè dù đã có dữ liệu
 */
function khoiTaoQuyCheLuongHienHanh(ghiDeCaKhiCoDuLieu) {
  const ngay = new Date();
  const mau = {
    PHONGBAN: [
      { "Mã phòng ban": "01.01", "Tên phòng ban": "01.Văn phòng > Văn phòng" },
      { "Mã phòng ban": "01.02", "Tên phòng ban": "01.Văn phòng > Trạm cân" },
      { "Mã phòng ban": "01.03", "Tên phòng ban": "01.Văn phòng > Quản đốc" },
      { "Mã phòng ban": "01.04", "Tên phòng ban": "01.Văn phòng > Tạp vụ" },
      { "Mã phòng ban": "01.05", "Tên phòng ban": "01.Văn phòng > Bảo vệ" },
      { "Mã phòng ban": "01.06", "Tên phòng ban": "01.Văn phòng > Kinh doanh" },
      { "Mã phòng ban": "01.07", "Tên phòng ban": "01.Văn phòng > KCS" },
      { "Mã phòng ban": "01.08", "Tên phòng ban": "01.Văn phòng > Cơ khí" },
      { "Mã phòng ban": "01.09", "Tên phòng ban": "01.Văn phòng > Cơ giới" },
      { "Mã phòng ban": "01.10", "Tên phòng ban": "01.Văn phòng > Thủ kho" },
      { "Mã phòng ban": "01.11", "Tên phòng ban": "01.Văn phòng > Ben hàng" },
      { "Mã phòng ban": "02.01", "Tên phòng ban": "03.Sản xuất > Tổ 1 - Công nhân sản xuất" },
      { "Mã phòng ban": "02.02", "Tên phòng ban": "03.Sản xuất > Tổ 2 - Công nhân sản xuất" },
      { "Mã phòng ban": "02.03", "Tên phòng ban": "03.Sản xuất > Tổ 1 - Công nhân công nhật" },
      { "Mã phòng ban": "02.04", "Tên phòng ban": "03.Sản xuất > Tổ 2 - Công nhân công nhật" },
      { "Mã phòng ban": "04.06", "Tên phòng ban": "02.Vận tải > Vận tải" }
    ],
    // "Tài khoản chi phí" TÁCH RIÊNG khỏi DM_PHONGBAN — quản lý ở DM_CHIPHI
    // (không bị đồng bộ ngoài ghi đè mất, có hiệu lực theo ngày).
    CHIPHI: [
      { "Mã phòng ban": "01.01", "Tài khoản chi phí": "6421" },
      { "Mã phòng ban": "01.02", "Tài khoản chi phí": "6411" },
      { "Mã phòng ban": "01.03", "Tài khoản chi phí": "6271" },
      { "Mã phòng ban": "01.04", "Tài khoản chi phí": "6421" },
      { "Mã phòng ban": "01.05", "Tài khoản chi phí": "6421" },
      { "Mã phòng ban": "01.06", "Tài khoản chi phí": "6411" },
      { "Mã phòng ban": "01.07", "Tài khoản chi phí": "622" },
      { "Mã phòng ban": "01.08", "Tài khoản chi phí": "6271" },
      { "Mã phòng ban": "01.09", "Tài khoản chi phí": "6271" },
      { "Mã phòng ban": "01.10", "Tài khoản chi phí": "6271" },
      { "Mã phòng ban": "01.11", "Tài khoản chi phí": "6271" },
      { "Mã phòng ban": "02.01", "Tài khoản chi phí": "622" },
      { "Mã phòng ban": "02.02", "Tài khoản chi phí": "622" },
      { "Mã phòng ban": "02.03", "Tài khoản chi phí": "622" },
      { "Mã phòng ban": "02.04", "Tài khoản chi phí": "622" },
      { "Mã phòng ban": "04.06", "Tài khoản chi phí": "6411" }
    ],
    CHUCVU: [
      { "Mã chức vụ": "01", "Tên chức vụ": "Giám đốc" },
      { "Mã chức vụ": "02", "Tên chức vụ": "Phó giám đốc" },
      { "Mã chức vụ": "03", "Tên chức vụ": "Quản đốc PX" },
      { "Mã chức vụ": "04", "Tên chức vụ": "Trưởng bộ phận" },
      { "Mã chức vụ": "05", "Tên chức vụ": "Tổ trưởng" },
      { "Mã chức vụ": "06", "Tên chức vụ": "Nhân viên bậc 1" },
      { "Mã chức vụ": "07", "Tên chức vụ": "Nhân viên bậc 2" },
      { "Mã chức vụ": "08", "Tên chức vụ": "Công nhân bậc 1" },
      { "Mã chức vụ": "09", "Tên chức vụ": "Công nhân bậc 2" }
    ],
    // "Mã hình thức lương" dùng "LTG" (lương thời gian) / "LSP" (lương sản phẩm).
    // Webapp nhận diện lương sản lượng qua regex /SP/i nên "LSP" vẫn khớp đúng.
    LUONG: [
      { "Mã lương": "CĐ", "Mã hình thức lương": "LTG", "Hình thức lương": "Lương cố định", "Cách tính": "Cố định" },
      { "Mã lương": "TG1", "Mã hình thức lương": "LTG", "Hình thức lương": "Lương thời gian 1", "Ngưỡng truy thu BH (công)": 20, "Cách tính": "Số ngày của tháng - tất cả ngày CN" },
      { "Mã lương": "TG2", "Mã hình thức lương": "LTG", "Hình thức lương": "Lương thời gian 2", "Ngưỡng truy thu BH (công)": 20, "Cách tính": "Số ngày của tháng " },
      { "Mã lương": "TG3", "Mã hình thức lương": "LTG", "Hình thức lương": "Lương thời gian 3", "Ngưỡng truy thu BH (công)": 20, "Cách tính": "Số ngày của tháng - 4" },
      { "Mã lương": "TG4", "Mã hình thức lương": "LTG", "Hình thức lương": "Lương thời gian 4", "Ngưỡng truy thu BH (công)": 20, "Cách tính": "Số ngày của tháng - 2" },
      { "Mã lương": "CN1", "Mã hình thức lương": "LTG", "Hình thức lương": "Lương công nhật", "Ngưỡng truy thu BH (công)": 15, "Cách tính": "Thực tế ngày công" },
      { "Mã lương": "CN2", "Mã hình thức lương": "LTG", "Hình thức lương": "Lương công nhật 2", "Ngưỡng truy thu BH (công)": 15, "Cách tính": "Thực tế ngày công" },
      { "Mã lương": "SP", "Mã hình thức lương": "LSP", "Hình thức lương": "Lương sản phẩm", "Số tiền khoán": 6000, "Đơn giá bơm dăm": 10000, "Ngưỡng truy thu BH (công)": 15, "ĐK_Bù lương (công tối thiểu)": 15, "Đơn giá bù lương": 200000, "Cách tính": "Nhân với sản lượng, bù nếu dưới ngưỡng công tối thiểu" }
    ],
    PHUCAP: [
      { "Mã phụ cấp": "TN.01", "Tên phụ cấp": "Phụ cấp trách nhiệm BP Cơ khí", "Số tiền": 300000, "Tham chiếu": 0, "Cách tính": "Tổng công >= công chuẩn tính đủ 300k, nhỏ hơn = 300k/công chuẩn×tổng công" },
      { "Mã phụ cấp": "TN.02", "Tên phụ cấp": "Phụ cấp trách nhiệm BP SX", "Số tiền": 200000, "Tham chiếu": 5, "Cách tính": "Tổng công >= (công chuẩn-5) tính đủ 200k, nhỏ hơn = 200k/công chuẩn×tổng công" },
      { "Mã phụ cấp": "TN.03", "Tên phụ cấp": "Phụ cấp trách nhiệm Quản lý", "Số tiền": 1000000, "Cách tính": "Cố định hàng tháng" },
      { "Mã phụ cấp": "TN.04", "Tên phụ cấp": "Phụ cấp trách nhiệm BP Kinh doanh", "Số tiền": 570000, "Cách tính": "Cố định hàng tháng" },
      { "Mã phụ cấp": "QC", "Tên phụ cấp": "Phụ cấp công tác HAKQN", "Số tiền": 100000, "Cách tính": "Theo ngày có nhãn công tác (xem Phụ cấp công tác)" },
      { "Mã phụ cấp": "QS", "Tên phụ cấp": "Phụ cấp công tác CNHAK", "Số tiền": 120000, "Cách tính": "Theo ngày có nhãn công tác" },
      { "Mã phụ cấp": "ĐH", "Tên phụ cấp": "Phụ cấp công tác Đại Hiệp", "Số tiền": 30000, "Cách tính": "Theo ngày có nhãn công tác" },
      { "Mã phụ cấp": "ĐN", "Tên phụ cấp": "Phụ cấp công tác Đà Nẵng", "Số tiền": 120000, "Cách tính": "Theo ngày có nhãn công tác" },
      { "Mã phụ cấp": "DQ1", "Tên phụ cấp": "Phụ cấp công tác DQ", "Số tiền": 500000, "Cách tính": "Phụ cấp công tác" },
      { "Mã phụ cấp": "SX", "Tên phụ cấp": "Phụ cấp sửa xe", "Số tiền": 200000, "Cách tính": "Phụ cấp sửa xe" }
    ],
    TANGCA: [
      { "Mã tăng ca": "TC1", "Nội dung tăng ca": "Tăng ca tính theo tháng loại 1", "Hệ số tăng ca": "50%", "Cách tính": "(Công tính lương-Công lễ-công trung chuyển-ngày phép-công tăng ca-công chuẩn)×hệ số + công tăng ca×hệ số" },
      { "Mã tăng ca": "TC2", "Nội dung tăng ca": "Tăng ca tính theo tháng loại 2", "Hệ số tăng ca": "50%", "Cách tính": "(Công tính lương-Công lễ-công trung chuyển-ngày phép-công tăng ca-công di chuyển-công chuẩn)×hệ số + công tăng ca×hệ số" },
      { "Mã tăng ca": "TC3", "Nội dung tăng ca": "Tăng ca tính theo công và chủ nhật", "Hệ số tăng ca": "50%", "Cách tính": "(Công tăng ca + Công chủ nhật)×hệ số" },
      { "Mã tăng ca": "TC4", "Nội dung tăng ca": "Tăng ca tính theo công", "Hệ số tăng ca": "50%", "Cách tính": "Công tăng ca×hệ số" },
      { "Mã tăng ca": "TC5", "Nội dung tăng ca": "Ca làm thêm vị trí khác", "Hệ số tăng ca": "100%", "Tiền tăng ca (nếu tính cố định)": 6000000, "Cách tính": "Lương làm ca khác (khoán, chia công chuẩn)" }
    ],
    HOTRO: [
      { "Mã hỗ trợ": "HT.01", "Tên hỗ trợ": "Tiền cơm", "Số tiền": 20000, "Cách tính": "Số tiền × Số ngày công" },
      { "Mã hỗ trợ": "HT.02", "Tên hỗ trợ": "Hỗ trợ lương cơ giới", "Số tiền": 150000, "Cách tính": "Nếu công thực tế < công chuẩn = (công chuẩn − công thực tế) × 150.000" }
    ],
    BAOHIEM: [
      { "Mã bảo hiểm": "BH_KPCD.01", "Nội dung": "Khoản trích theo lương — đầy đủ", "DN.BHXH": 0.175, "DN.BHYT": 0.03, "DN.BHTN": 0.01, "DN.KPCD": 0.02, "NLD.BHXH": 0.08, "NLD.BHYT": 0.015, "NLD.BHTN": 0.01, "NLD.KPCD": 0.005 },
      { "Mã bảo hiểm": "BH_KPCD.02", "Nội dung": "Khoản trích theo lương — chỉ BHYT", "DN.BHXH": 0, "DN.BHYT": 0.03, "DN.BHTN": 0, "DN.KPCD": 0, "NLD.BHXH": 0, "NLD.BHYT": 0.015, "NLD.BHTN": 0, "NLD.KPCD": 0 },
      { "Mã bảo hiểm": "BH_KPCD.03", "Nội dung": "Khoản trích theo lương — không KPCĐ", "DN.BHXH": 0.175, "DN.BHYT": 0.03, "DN.BHTN": 0.01, "DN.KPCD": 0, "NLD.BHXH": 0.08, "NLD.BHYT": 0.015, "NLD.BHTN": 0.01, "NLD.KPCD": 0 }
    ],
    GTTNCN: [
      { "Mã giảm trừ": "GTBT.01", "Số người": 1, "Số tiền": 11000000 },
      { "Mã giảm trừ": "GTNPT.01", "Số người": 1, "Số tiền": 4400000 }
    ],
    // "TNCN1"/"TNCN0" dùng cho MÃ THUẾ (gán ở NL_NHANSU."Mã TNCN"), khác với biểu
    // luỹ tiến 7 bậc (áp dụng khi Mã TNCN không phải TNCN1/TNCN0). Ghi đủ 7 bậc
    // luỹ tiến vào ĐÂY (webapp dùng chung 1 bảng biểu thuế cho mọi trường hợp còn lại).
    TNCN: [
      { "Bậc": 1, "Nội dung khấu trừ": "Luỹ tiến bậc 1", "Tỷ lệ đóng thuế": 0.05, "Thu nhập tháng (Min)": 0, "Thu nhập tháng (Max)": 5000000 },
      { "Bậc": 2, "Nội dung khấu trừ": "Luỹ tiến bậc 2", "Tỷ lệ đóng thuế": 0.10, "Thu nhập tháng (Min)": 5000000, "Thu nhập tháng (Max)": 10000000 },
      { "Bậc": 3, "Nội dung khấu trừ": "Luỹ tiến bậc 3", "Tỷ lệ đóng thuế": 0.15, "Thu nhập tháng (Min)": 10000000, "Thu nhập tháng (Max)": 18000000 },
      { "Bậc": 4, "Nội dung khấu trừ": "Luỹ tiến bậc 4", "Tỷ lệ đóng thuế": 0.20, "Thu nhập tháng (Min)": 18000000, "Thu nhập tháng (Max)": 32000000 },
      { "Bậc": 5, "Nội dung khấu trừ": "Luỹ tiến bậc 5", "Tỷ lệ đóng thuế": 0.25, "Thu nhập tháng (Min)": 32000000, "Thu nhập tháng (Max)": 52000000 },
      { "Bậc": 6, "Nội dung khấu trừ": "Luỹ tiến bậc 6", "Tỷ lệ đóng thuế": 0.30, "Thu nhập tháng (Min)": 52000000, "Thu nhập tháng (Max)": 80000000 },
      { "Bậc": 7, "Nội dung khấu trừ": "Luỹ tiến bậc 7", "Tỷ lệ đóng thuế": 0.35, "Thu nhập tháng (Min)": 80000000, "Thu nhập tháng (Max)": 1000000000 }
    ]
  };

  const daKhoiTao = [], daBoQua = [];
  Object.keys(mau).forEach(function (loai) {
    const cauHinh = DANH_MUC_CAU_HINH[loai];
    const hienCo = docSheetThanhObject_(cauHinh.sheet, cauHinh.header);
    if (hienCo.length > 0 && !ghiDeCaKhiCoDuLieu) {
      daBoQua.push(loai);
      return;
    }
    const danhSach = mau[loai].map(function (r) { return Object.assign({ "Ngày cập nhật": ngay }, r); });
    ghiDeSheet_(cauHinh.sheet, cauHinh.header, danhSach);
    daKhoiTao.push(loai);
  });

  return { ok: true, daKhoiTao: daKhoiTao, daBoQua: daBoQua };
}

/**
 * Khởi tạo dữ liệu mẫu cho TẤT CẢ danh mục còn trống — KHÔNG đụng tới danh mục
 * nào đã có sẵn dữ liệu thật (an toàn khi bấm nhiều lần / bấm nhầm).
 * @param {boolean} ghiDeCaKhiCoDuLieu true = xoá hết & ghi mẫu dù đã có dữ liệu (cẩn thận!)
 */
function khoiTaoDanhMucMau(ghiDeCaKhiCoDuLieu) {
  const mau = {
    PHONGBAN: [
      { "Mã phòng ban": "PB01", "Tên phòng ban": "Văn phòng" },
      { "Mã phòng ban": "PB02", "Tên phòng ban": "Sản xuất" },
      { "Mã phòng ban": "PB03", "Tên phòng ban": "Cơ giới" },
      { "Mã phòng ban": "PB04", "Tên phòng ban": "Bảo vệ" }
    ],
    CHIPHI: [
      { "Mã phòng ban": "PB01", "Tài khoản chi phí": "6421" },
      { "Mã phòng ban": "PB02", "Tài khoản chi phí": "6271" },
      { "Mã phòng ban": "PB03", "Tài khoản chi phí": "6272" },
      { "Mã phòng ban": "PB04", "Tài khoản chi phí": "6273" }
    ],
    CHUCVU: [
      { "Mã chức vụ": "CV01", "Tên chức vụ": "Giám đốc" },
      { "Mã chức vụ": "CV02", "Tên chức vụ": "Quản đốc" },
      { "Mã chức vụ": "CV03", "Tên chức vụ": "Kế toán" },
      { "Mã chức vụ": "CV04", "Tên chức vụ": "Công nhân" },
      { "Mã chức vụ": "CV05", "Tên chức vụ": "Tài xế" },
      { "Mã chức vụ": "CV06", "Tên chức vụ": "Bảo vệ" },
      { "Mã chức vụ": "CV07", "Tên chức vụ": "Tạp vụ" }
    ],
    PHUCAP: [
      { "Mã phụ cấp": "PC01", "Tên phụ cấp": "Phụ cấp trách nhiệm", "Số tiền": 300000, "Cách tính": "Cộng cố định/tháng" },
      { "Mã phụ cấp": "PC02", "Tên phụ cấp": "Phụ cấp tổ trưởng", "Số tiền": 200000, "Cách tính": "Cộng cố định/tháng" }
    ],
    HOTRO: [
      { "Mã hỗ trợ": "HT01", "Tên hỗ trợ": "Hỗ trợ xuất hàng", "Số tiền": 300000, "Cách tính": "Cộng cố định/tháng khi có đợt xuất hàng" },
      { "Mã hỗ trợ": "HT02", "Tên hỗ trợ": "Hỗ trợ cơm ca đêm", "Số tiền": 75000, "Cách tính": "Cộng cố định/tháng" }
    ],
    // Ý nghĩa từng mã tăng ca — xem TinhCong.gs hàm tinhHeSoTangCa_() để biết công thức
    TANGCA: [
      { "Mã tăng ca": "TC1", "Nội dung tăng ca": "Dư công so công chuẩn (trừ công chuyển/lễ)", "Hệ số tăng ca": 1.5 },
      { "Mã tăng ca": "TC2", "Nội dung tăng ca": "Dư công so công chuẩn (trừ công lễ)", "Hệ số tăng ca": 1.5 },
      { "Mã tăng ca": "TC3", "Nội dung tăng ca": "Công Chủ nhật + công tăng ca ngoài giờ", "Hệ số tăng ca": 2 },
      { "Mã tăng ca": "TC4", "Nội dung tăng ca": "Công tăng ca ngày thường", "Hệ số tăng ca": 1.5 },
      { "Mã tăng ca": "TC5", "Nội dung tăng ca": "Công tăng ca ngày lễ", "Hệ số tăng ca": 3 },
      { "Mã tăng ca": "TC6", "Nội dung tăng ca": "Dư công quy đổi thẳng (không nhân hệ số)", "Hệ số tăng ca": 1 }
    ],
    // ⚠ Tỷ lệ BHXH/BHYT/BHTN/KPCĐ dưới đây là mức phổ biến theo quy định chung —
    // LUÔN kiểm tra lại đúng tỷ lệ hiện hành tại thời điểm dùng thật.
    BAOHIEM: [
      { "Mã bảo hiểm": "BH01", "Nội dung": "Đóng đầy đủ BHXH/BHYT/BHTN/KPCĐ",
        "DN.BHXH": 0.175, "DN.BHYT": 0.03, "DN.BHTN": 0.01, "DN.KPCD": 0.02,
        "NLD.BHXH": 0.08, "NLD.BHYT": 0.015, "NLD.BHTN": 0.01, "NLD.KPCD": 0 },
      { "Mã bảo hiểm": "BH00", "Nội dung": "Không tham gia BHXH (thử việc/thời vụ ngắn)",
        "DN.BHXH": 0, "DN.BHYT": 0, "DN.BHTN": 0, "DN.KPCD": 0,
        "NLD.BHXH": 0, "NLD.BHYT": 0, "NLD.BHTN": 0, "NLD.KPCD": 0 }
    ],
    // ⚠ Chỉ nêu 2 mã ví dụ (thời gian TG và sản lượng SP) — mỗi đơn vị/bộ phận cần
    // thêm mã riêng theo đúng mức lương thật (xem quy_dinh_tinh_luong_4_don_vi.md).
    LUONG: [
      { "Mã lương": "L01", "Mã hình thức lương": "TG", "Hình thức lương": "Lương thời gian — chia 26 công", "Cách tính": "Chia 26 công" },
      { "Mã lương": "L02", "Mã hình thức lương": "TG", "Hình thức lương": "Lương thời gian — chia 30/31 công (làm ca)", "Cách tính": "Chia 30/31 công" },
      { "Mã lương": "L03", "Mã hình thức lương": "SP", "Hình thức lương": "Lương sản lượng CN nam",
        "Số tiền khoán": 6000, "Ngưỡng truy thu BH (công)": 15, "ĐK_Bù lương (công tối thiểu)": 33.33,
        "Đơn giá bù lương": 200000, "Đơn giá bơm dăm": 10000,
        "Cách tính": "6.000đ/tấn; nếu SL/công < 33,33 tấn thì bù 200.000đ/công; bơm dăm 10.000đ/xe" }
    ],
    // ⚠ Mức giảm trừ gia cảnh theo Luật Thuế TNCN — PHẢI kiểm tra lại mức hiện hành
    // tại thời điểm tính lương thật (mức có thể đã thay đổi theo nghị quyết mới).
    GTTNCN: [
      { "Mã giảm trừ": "GTBT.01", "Số người": 1, "Số tiền": 11000000 },
      { "Mã giảm trừ": "GTNPT.01", "Số người": 1, "Số tiền": 4400000 }
    ],
    // Biểu thuế TNCN luỹ tiến từng phần 7 bậc theo Luật Thuế TNCN hiện hành —
    // PHẢI đối chiếu lại mốc "Thu nhập tháng" nếu luật thay đổi.
    TNCN: [
      { "Bậc": 1, "Nội dung khấu trừ": "Bậc 1", "Tỷ lệ đóng thuế": 0.05, "Thu nhập tháng (Min)": 0, "Thu nhập tháng (Max)": 5000000 },
      { "Bậc": 2, "Nội dung khấu trừ": "Bậc 2", "Tỷ lệ đóng thuế": 0.10, "Thu nhập tháng (Min)": 5000000, "Thu nhập tháng (Max)": 10000000 },
      { "Bậc": 3, "Nội dung khấu trừ": "Bậc 3", "Tỷ lệ đóng thuế": 0.15, "Thu nhập tháng (Min)": 10000000, "Thu nhập tháng (Max)": 18000000 },
      { "Bậc": 4, "Nội dung khấu trừ": "Bậc 4", "Tỷ lệ đóng thuế": 0.20, "Thu nhập tháng (Min)": 18000000, "Thu nhập tháng (Max)": 32000000 },
      { "Bậc": 5, "Nội dung khấu trừ": "Bậc 5", "Tỷ lệ đóng thuế": 0.25, "Thu nhập tháng (Min)": 32000000, "Thu nhập tháng (Max)": 52000000 },
      { "Bậc": 6, "Nội dung khấu trừ": "Bậc 6", "Tỷ lệ đóng thuế": 0.30, "Thu nhập tháng (Min)": 52000000, "Thu nhập tháng (Max)": 80000000 },
      { "Bậc": 7, "Nội dung khấu trừ": "Bậc 7", "Tỷ lệ đóng thuế": 0.35, "Thu nhập tháng (Min)": 80000000, "Thu nhập tháng (Max)": "" }
    ]
  };

  const daKhoiTao = [], daBoQua = [];
  Object.keys(mau).forEach(function (loai) {
    const cauHinh = DANH_MUC_CAU_HINH[loai];
    const hienCo = docSheetThanhObject_(cauHinh.sheet, cauHinh.header);
    if (hienCo.length > 0 && !ghiDeCaKhiCoDuLieu) {
      daBoQua.push(loai);
      return;
    }
    const danhSach = mau[loai].map(function (r) { return Object.assign({ "Ngày cập nhật": new Date() }, r); });
    ghiDeSheet_(cauHinh.sheet, cauHinh.header, danhSach);
    daKhoiTao.push(loai);
  });

  return { ok: true, daKhoiTao: daKhoiTao, daBoQua: daBoQua };
}
