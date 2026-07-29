// ================= NẠP DỮ LIỆU TỪ FILE TẢI LÊN =================
// Cho phép tải thẳng file Excel/CSV Bảng chấm công hoặc Phiếu cân sản lượng lên,
// thay vì phải gõ tay từng dòng vào Google Sheet. Chấp nhận .xlsx/.xls/.csv, tiêu
// đề cột linh hoạt (không cần đúng 100% tên cột, xem anhXaCotChamCong_/
// anhXaCotSanLuong_ bên dưới) — khớp gần đúng với cấu trúc sheet DL_Chamcong/
// DL_Sanluong/DL_Bandam thật của HAK Group nên thường tải thẳng lên là dùng được.
//
// ⚠️ ĐỌC FILE .xlsx/.xls CẦN BẬT "Drive API" (Advanced Google Services):
// Trong Apps Script Editor → Services (dấu +) → chọn "Drive API" → Add.
// Không cần bước này nếu chỉ tải file .csv.

/** Đọc 1 file (blob) thành mảng 2 chiều [ [tiêu đề...], [dòng 1...], ... ]. */
function docBangTuBlob_(blob, tenFile) {
  const ten = (tenFile || "").toLowerCase();
  if (ten.endsWith(".csv")) {
    return Utilities.parseCsv(blob.getDataAsString("UTF-8"));
  }
  // .xlsx/.xls — chuyển tạm thành Google Sheet để đọc, sau đó xoá file tạm
  const resource = { name: "tmp_import_" + new Date().getTime(), mimeType: MimeType.GOOGLE_SHEETS };
  const file = Drive.Files.create(resource, blob);
  try {
    const ss = SpreadsheetApp.openById(file.id);
    const sh = ss.getSheets()[0];
    return sh.getDataRange().getValues();
  } finally {
    Drive.Files.remove(file.id);
  }
}

function chuanHoaTieuDe_(s) {
  return String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Ánh xạ tiêu đề cột của file Bảng chấm công người dùng tải lên → tên cột chuẩn. */
function anhXaCotChamCong_(hangTieuDe) {
  const dongNghia = {
    "tt": "TT",
    "ngày tính công": "Ngày tính công",
    "mã pb": "Mã PB",
    "mã cv": "Mã CV",
    "mã nv": "Mã NV",
    "họ và tên": "Họ và tên",
    "hình thức công": "Hình thức công", "hinh thức công": "Hình thức công"
  };
  return hangTieuDe.map(function (tieuDe) {
    const chuan = chuanHoaTieuDe_(tieuDe);
    if (dongNghia[chuan]) return dongNghia[chuan];
    // cột ngày 1..31 (chấp nhận "1", "01", " 5 "...)
    if (/^\d{1,2}$/.test(chuan)) {
      const soNgay = parseInt(chuan, 10);
      if (soNgay >= 1 && soNgay <= 31) return ("0" + soNgay).slice(-2);
    }
    return null; // cột không nhận diện được — bỏ qua, không nạp vào sheet
  });
}

/** Ánh xạ tiêu đề cột của file Phiếu cân sản lượng người dùng tải lên → tên cột chuẩn. */
function anhXaCotSanLuong_(hangTieuDe) {
  const dongNghia = {
    "phiếu cân": "Phiếu cân",
    "ngày cân": "Ngày cân", "ngày cân 1": "Ngày cân",
    "giờ cân": "Giờ cân", "giờ cân 1": "Giờ cân",
    "biển số": "Biển số", "biển số 1": "Biển số",
    "cân lần 1": "Cân lần 1",
    "cân lần 2": "Cân lần 2",
    "kl hàng (tấn)": "KL hàng (Tấn)", "khối lượng (tấn)": "KL hàng (Tấn)", "kl hàng": "KL hàng (Tấn)",
    "mã phòng ban": "Mã phòng ban",
    "mã nv": "Mã NV"
    // Cột "Ngày cân 2"/"Giờ cân 2"/"NV vắng" của file gốc HAK Group không dùng ở
    // đây (mô hình đơn giản hoá không tách lần cân đi/về) — sẽ tự bị bỏ qua.
  };
  return hangTieuDe.map(function (tieuDe) {
    return dongNghia[chuanHoaTieuDe_(tieuDe)] || null;
  });
}

/**
 * Chuyển bảng thô (rows[0] = tiêu đề, rows[1..] = dữ liệu) thành danh sách object
 * theo tên cột CHUẨN, dùng hàm anhXaCot để map — bỏ qua cột lạ, bỏ qua dòng trống.
 */
function chuyenBangThanhDanhSachObject_(rows, anhXaCot) {
  if (!rows || rows.length < 2) return { list: [], cotBiBoQua: [] };
  const header = rows[0];
  const map = anhXaCot(header);
  const cotBiBoQua = [];
  header.forEach(function (tieuDe, i) { if (!map[i] && String(tieuDe).trim() !== "") cotBiBoQua.push(tieuDe); });

  const list = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every(function (v) { return v === "" || v === null || v === undefined; })) continue;
    const obj = {};
    for (let c = 0; c < header.length; c++) {
      if (map[c]) obj[map[c]] = row[c];
    }
    list.push(obj);
  }
  return { list: list, cotBiBoQua: cotBiBoQua };
}

/**
 * Đối chiếu 1 danh sách chấm công NHÁP với NL_NHANSU/DM_PHONGBAN — gắn thêm cột
 * "✔ Kiểm tra" = "OK" hoặc "Lỗi: <lý do>" vào từng dòng.
 * @return {{ list: Array<Object>, soLoi: number }}
 */
function doiChieuNhapChamCong_(list) {
  const nhanSuSet = {};
  docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU).forEach(function (ns) { nhanSuSet[ns["Mã nhân viên"]] = true; });
  const phongBanSet = {};
  docSheetThanhObject_(SHEET_DM_PHONGBAN, HEADER_DM_PHONGBAN).forEach(function (pb) { phongBanSet[pb["Mã phòng ban"]] = true; });

  let soLoi = 0;
  const ketQua = list.map(function (row) {
    const loi = [];
    if (!row["Mã NV"]) loi.push("thiếu Mã NV");
    else if (!nhanSuSet[row["Mã NV"]]) loi.push("Mã NV \"" + row["Mã NV"] + "\" không có trong NL_NHANSU");
    if (row["Mã PB"] && !phongBanSet[row["Mã PB"]]) loi.push("Mã PB \"" + row["Mã PB"] + "\" không có trong DM_PHONGBAN");
    if (!(row["Ngày tính công"] instanceof Date)) loi.push("Ngày tính công không hợp lệ");
    if (loi.length) soLoi++;
    row["✔ Kiểm tra"] = loi.length ? ("Lỗi: " + loi.join("; ")) : "OK";
    return row;
  });
  return { list: ketQua, soLoi: soLoi };
}

/**
 * Đối chiếu 1 danh sách phiếu cân NHÁP với NL_NHANSU/DM_PHONGBAN — gắn thêm cột
 * "✔ Kiểm tra". Mã NV không bắt buộc phải có (phiếu chưa gán người vẫn hợp lệ,
 * chỉ cảnh báo ở bước Kiểm tra bảng lương sau này) nhưng NẾU CÓ thì phải đúng.
 */
function doiChieuNhapSanLuong_(list) {
  const nhanSuSet = {};
  docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU).forEach(function (ns) { nhanSuSet[ns["Mã nhân viên"]] = true; });
  const phongBanSet = {};
  docSheetThanhObject_(SHEET_DM_PHONGBAN, HEADER_DM_PHONGBAN).forEach(function (pb) { phongBanSet[pb["Mã phòng ban"]] = true; });

  let soLoi = 0;
  const ketQua = list.map(function (row) {
    const loi = [];
    if (!(row["Ngày cân"] instanceof Date)) loi.push("Ngày cân không hợp lệ");
    if (!row["Mã phòng ban"]) loi.push("thiếu Mã phòng ban");
    else if (!phongBanSet[row["Mã phòng ban"]]) loi.push("Mã phòng ban \"" + row["Mã phòng ban"] + "\" không có trong DM_PHONGBAN");
    if (row["Mã NV"] && !nhanSuSet[row["Mã NV"]]) loi.push("Mã NV \"" + row["Mã NV"] + "\" không có trong NL_NHANSU");
    const kl = Number(row["KL hàng (Tấn)"]);
    if (!kl || kl <= 0) loi.push("KL hàng (Tấn) phải là số dương");
    if (loi.length) soLoi++;
    row["✔ Kiểm tra"] = loi.length ? ("Lỗi: " + loi.join("; ")) : "OK";
    return row;
  });
  return { list: ketQua, soLoi: soLoi };
}

/**
 * BƯỚC 1/3 — Đọc file, ĐỐI CHIẾU, rồi ghi vào BẢNG NHÁP (sheet NHAP_CHAMCONG) —
 * KHÔNG đụng gì tới NL_CHAMCONG (bảng chính) ở bước này. Luôn XOÁ SẠCH nháp cũ
 * trước khi ghi nháp mới (dọn dẹp nếu phiên trước bị huỷ đột ngột/bỏ dở mà chưa
 * kịp dọn) — đảm bảo nháp luôn phản ánh đúng lần tải gần nhất.
 * Người dùng có thể mở thẳng sheet NHAP_CHAMCONG trong Google Sheet để SỬA TAY
 * (thêm/sửa/xoá dòng) trước khi bấm "Đối chiếu lại" rồi "Xác nhận nạp".
 */
function xemTruocChamCongTuFile(base64, tenFile, mimeType) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType || "application/octet-stream", tenFile);
  const rows = docBangTuBlob_(blob, tenFile);
  const { list, cotBiBoQua } = chuyenBangThanhDanhSachObject_(rows, anhXaCotChamCong_);
  if (list.length === 0) {
    return { ok: false, loi: "Không đọc được dòng dữ liệu nào. Kiểm tra lại tiêu đề cột — cần có ít nhất: Ngày tính công, Mã NV, Họ và tên, Hình thức công, và các cột ngày 01..31." };
  }
  const header = headerNhapChamCong_();
  const { list: daDoiChieu, soLoi } = doiChieuNhapChamCong_(list);
  ghiDeSheet_(SHEET_NHAP_CHAMCONG, header, daDoiChieu); // ghi đè = tự dọn nháp cũ
  return { ok: true, list: daDoiChieu, soDong: daDoiChieu.length, soLoi: soLoi, cotBiBoQua: cotBiBoQua };
}

/**
 * BƯỚC 2/3 (tuỳ chọn) — Đọc LẠI dữ liệu HIỆN TẠI trong sheet NHAP_CHAMCONG (có
 * thể người dùng vừa sửa tay trực tiếp trong Google Sheet) rồi đối chiếu lại,
 * ghi lại cột "✔ Kiểm tra" cho đúng tình trạng mới nhất.
 */
function doiChieuLaiNhapChamCong() {
  const header = headerNhapChamCong_();
  const list = docSheetThanhObject_(SHEET_NHAP_CHAMCONG, header);
  if (list.length === 0) return { ok: false, loi: "Sheet nháp NHAP_CHAMCONG đang trống — chưa có gì để đối chiếu." };
  const { list: daDoiChieu, soLoi } = doiChieuNhapChamCong_(list);
  ghiDeSheet_(SHEET_NHAP_CHAMCONG, header, daDoiChieu);
  return { ok: true, list: daDoiChieu, soDong: daDoiChieu.length, soLoi: soLoi };
}

/**
 * BƯỚC 3/3 — XÁC NHẬN: đọc lại nháp lần cuối, đối chiếu lại (an toàn — phòng khi
 * người dùng sửa tay trong Sheet nhưng quên bấm "Đối chiếu lại"), CHẶN nếu còn
 * dòng lỗi, nếu sạch lỗi thì ghi vào NL_CHAMCONG (bảng chính) và XOÁ sheet nháp.
 */
function xacNhanNapChamCongTuNhap(cheDoGhi) {
  const headerNhap = headerNhapChamCong_();
  const list = docSheetThanhObject_(SHEET_NHAP_CHAMCONG, headerNhap);
  if (list.length === 0) return { ok: false, loi: "Sheet nháp NHAP_CHAMCONG đang trống — không có gì để nạp." };
  const { list: daDoiChieu, soLoi } = doiChieuNhapChamCong_(list);
  if (soLoi > 0) {
    ghiDeSheet_(SHEET_NHAP_CHAMCONG, headerNhap, daDoiChieu); // lưu lại tình trạng lỗi mới nhất để người dùng xem
    return { ok: false, loi: "Còn " + soLoi + " dòng LỖI trong bảng nháp — sửa hết lỗi (trực tiếp trong sheet NHAP_CHAMCONG hoặc tải lại file khác) rồi mới Xác nhận nạp được.", conLoi: true };
  }
  const headerChinh = headerChamCongDayDu_();
  if (cheDoGhi === "GHIDE") {
    ghiDeSheet_(SHEET_CHAMCONG, headerChinh, daDoiChieu);
  } else {
    appendVaoSheet_(SHEET_CHAMCONG, headerChinh, daDoiChieu);
  }
  xoaSheetNhap_(SHEET_NHAP_CHAMCONG);
  return { ok: true, soDong: daDoiChieu.length };
}

/** HỦY — xoá sạch sheet nháp chấm công, không ghi gì vào bảng chính. */
function huyNhapChamCong() {
  xoaSheetNhap_(SHEET_NHAP_CHAMCONG);
  return { ok: true };
}

/** Tương tự xemTruocChamCongTuFile() nhưng cho Phiếu cân sản lượng. */
function xemTruocSanLuongTuFile(base64, tenFile, mimeType) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType || "application/octet-stream", tenFile);
  const rows = docBangTuBlob_(blob, tenFile);
  const { list, cotBiBoQua } = chuyenBangThanhDanhSachObject_(rows, anhXaCotSanLuong_);
  if (list.length === 0) {
    return { ok: false, loi: "Không đọc được dòng dữ liệu nào. Kiểm tra lại tiêu đề cột — cần có ít nhất: Ngày cân, KL hàng (Tấn), Mã phòng ban." };
  }
  const { list: daDoiChieu, soLoi } = doiChieuNhapSanLuong_(list);
  ghiDeSheet_(SHEET_NHAP_SANLUONG, HEADER_NHAP_SANLUONG, daDoiChieu);
  const soChuaGanNguoi = daDoiChieu.filter(function (r) { return !r["Mã NV"]; }).length;
  return { ok: true, list: daDoiChieu, soDong: daDoiChieu.length, soLoi: soLoi, cotBiBoQua: cotBiBoQua, soChuaGanNguoi: soChuaGanNguoi };
}

/** Tương tự doiChieuLaiNhapChamCong() nhưng cho Phiếu cân sản lượng. */
function doiChieuLaiNhapSanLuong() {
  const list = docSheetThanhObject_(SHEET_NHAP_SANLUONG, HEADER_NHAP_SANLUONG);
  if (list.length === 0) return { ok: false, loi: "Sheet nháp NHAP_SANLUONG đang trống — chưa có gì để đối chiếu." };
  const { list: daDoiChieu, soLoi } = doiChieuNhapSanLuong_(list);
  ghiDeSheet_(SHEET_NHAP_SANLUONG, HEADER_NHAP_SANLUONG, daDoiChieu);
  const soChuaGanNguoi = daDoiChieu.filter(function (r) { return !r["Mã NV"]; }).length;
  return { ok: true, list: daDoiChieu, soDong: daDoiChieu.length, soLoi: soLoi, soChuaGanNguoi: soChuaGanNguoi };
}

/**
 * XÁC NHẬN nạp Phiếu cân sản lượng từ bảng nháp vào DL_SANLUONG/DL_BANDAM.
 * @param {string} loaiSanLuong "SANLUONG" (mặc định) hoặc "BANDAM" — chọn LẠI ở
 *   bước xác nhận (không cần nhớ từ bước xem trước) vì người dùng có thể đổi ý.
 */
function xacNhanNapSanLuongTuNhap(loaiSanLuong, cheDoGhi) {
  const list = docSheetThanhObject_(SHEET_NHAP_SANLUONG, HEADER_NHAP_SANLUONG);
  if (list.length === 0) return { ok: false, loi: "Sheet nháp NHAP_SANLUONG đang trống — không có gì để nạp." };
  const { list: daDoiChieu, soLoi } = doiChieuNhapSanLuong_(list);
  if (soLoi > 0) {
    ghiDeSheet_(SHEET_NHAP_SANLUONG, HEADER_NHAP_SANLUONG, daDoiChieu);
    return { ok: false, loi: "Còn " + soLoi + " dòng LỖI trong bảng nháp — sửa hết lỗi (trực tiếp trong sheet NHAP_SANLUONG hoặc tải lại file khác) rồi mới Xác nhận nạp được.", conLoi: true };
  }
  const tenSheet = (loaiSanLuong === "BANDAM") ? SHEET_BANDAM : SHEET_SANLUONG;
  if (cheDoGhi === "GHIDE") {
    ghiDeSheet_(tenSheet, HEADER_SANLUONG, daDoiChieu);
  } else {
    appendVaoSheet_(tenSheet, HEADER_SANLUONG, daDoiChieu);
  }
  xoaSheetNhap_(SHEET_NHAP_SANLUONG);
  return { ok: true, soDong: daDoiChieu.length, sheet: tenSheet };
}

/** HỦY — xoá sạch sheet nháp sản lượng, không ghi gì vào bảng chính. */
function huyNhapSanLuong() {
  xoaSheetNhap_(SHEET_NHAP_SANLUONG);
  return { ok: true };
}

/** Xoá hẳn 1 sheet nháp nếu nó tồn tại (dùng khi Hủy hoặc sau khi Xác nhận nạp thành công). */
function xoaSheetNhap_(tenSheet) {
  const ss = moSheet_();
  const sh = ss.getSheetByName(tenSheet);
  if (sh) ss.deleteSheet(sh);
}

/** Trả về URL mở thẳng tới 1 sheet cụ thể (kèm #gid=...) để người dùng bấm mở tab mới sửa tay. */
function guiUrlSheetNhap_(tenSheet) {
  const ss = moSheet_();
  const sh = ss.getSheetByName(tenSheet);
  if (!sh) return null;
  return ss.getUrl() + "#gid=" + sh.getSheetId();
}
