// ================= ĐỒNG BỘ DANH MỤC & NHÂN SỰ TỪ 2 GOOGLE SHEET NGOÀI =================
// Thay vì nhập/sửa Danh mục và Nhân sự trực tiếp trên webapp, dữ liệu GỐC nằm ở
// 2 Google Sheet ngoài do công ty tự quản lý (HR/kế toán tổng), MỖI LẦN bấm
// "Tính lương" webapp sẽ TỰ TẢI VỀ bản mới nhất, LỌC THEO ĐÚNG PHẠM VI HIỆU LỰC
// của kỳ đang tính, rồi mới chạy tính lương như bình thường:
//   - File "DM_CONGTY_HAK" → toàn bộ danh mục (DM_LUONG, DM_PHUCAP, DM_TANGCA,
//     DM_HOTRO, DM_BAOHIEM, DM_TNCN, DM_GT_TNCN, DM_PHONGBAN, DM_CHUCVU)
//   - File "THONGTINNHANSU_HAK" → toàn bộ nhân sự (DM_NHANVIEN + các bảng chi
//     tiết hợp đồng/cá nhân/nhân thân/ngân hàng liên kết qua _id/_parentId)
// Sau khi đồng bộ, tab "Nhân sự" và "Danh mục" trên webapp CHỈ XEM (không còn
// Thêm/Sửa/Xoá tay) — đúng bản chất: đây là BẢN SAO đã lọc theo kỳ, không phải
// nơi nhập liệu gốc. Mỗi dòng có thêm 2 cột "Kỳ tính lương" (vd "6/2026") và
// vẫn giữ "Hiệu lực từ"/"Hiệu lực đến" gốc để biết dữ liệu áp dụng khi nào.
//
// ⚠️ QUAN TRỌNG — CẤU TRÚC CỘT: hàm này đọc dữ liệu THEO ĐÚNG TÊN CỘT (tiêu đề
// dòng 1 của mỗi sheet ngoài) — đây là cách làm chuẩn/an toàn. Khi rà lại file
// mẫu được cung cấp, phát hiện MỘT SỐ sheet (các sheet có cột "NgayCapNhat" ở
// vị trí thứ 2) có dấu hiệu DỮ LIỆU BỊ LỆCH CỘT so với tiêu đề (ví dụ mã "PB01"
// lại nằm dưới cột "NgayCapNhat" thay vì "MaPB"). Nếu Google Sheet THẬT (theo
// 2 link đã cấu hình) cũng bị lệch tương tự, hàm này sẽ đọc SAI dữ liệu — cần
// kiểm tra lại thứ tự cột trên Sheet thật khớp đúng tiêu đề trước khi dùng.

/** ID mặc định của 2 file ngoài (đã cấu hình sẵn theo link người dùng cung cấp). */
const ID_NGOAI_DANHMUC_MACDINH_ = "1FbSQDTSrFHietczdzFxGs0HUYxE4pT-8ia_EBTVo39E";
const ID_NGOAI_NHANSU_MACDINH_ = "13RnobxTcJ8tdXUutNUx_aiZXX8PBASiYt9ONrp7Yp6E";

/** Lấy ID file ngoài — ưu tiên cấu hình qua webapp (PropertiesService), sau đó mới tới mặc định. */
function layIdNgoai_(loai) {
  const tuThuocTinh = PropertiesService.getScriptProperties().getProperty("ID_NGOAI_" + loai);
  if (tuThuocTinh) return tuThuocTinh;
  return loai === "DANHMUC" ? ID_NGOAI_DANHMUC_MACDINH_ : ID_NGOAI_NHANSU_MACDINH_;
}

/** Lưu ID (hoặc URL — tự tách) cho 1 trong 2 nguồn ngoài, có xác thực mở thử trước khi lưu. */
function datIdNgoai_(loai, urlHoacId) {
  const id = trichIdTuUrl_(urlHoacId);
  if (!id) throw new Error("URL/ID trống — không lưu được.");
  try {
    SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error("Không mở được Google Sheet với ID/URL này — kiểm tra lại đã đúng chưa, và tài khoản chạy Apps Script có quyền truy cập file đó không.");
  }
  PropertiesService.getScriptProperties().setProperty("ID_NGOAI_" + loai, id);
  return id;
}

/** Đọc 1 sheet trong file ngoài thành danh sách object theo ĐÚNG TÊN CỘT ở dòng tiêu đề. */
/**
 * Đọc 1 sheet trong file ngoài thành danh sách object theo ĐÚNG TÊN CỘT ở dòng
 * tiêu đề.
 * ⚠ TỐI ƯU HIỆU SUẤT: dùng LẠI `moSheetTheoIdCache_()` (đã xây ở LienKetFile.gs
 * cho 5 file nội bộ) thay vì gọi thẳng `SpreadsheetApp.openById()` — 1 lượt
 * "Tải dữ liệu kỳ này" gọi hàm này ~11 lần (9 danh mục + 8 lượt tra bản đồ mã
 * cho nhân sự) nhưng thực chất chỉ có ĐÚNG 2 file ngoài khác nhau (Danh mục,
 * Nhân sự) — cache giúp giảm còn đúng 2 lần mở file thật/lượt chạy.
 * ⚠ PHÁT HIỆN QUA MÔ PHỎNG THẬT trên dữ liệu mẫu: ở các sheet có cột thứ 2 tên
 * "NgayCapNhat", CÓ LẪN CÁC DÒNG DỮ LIỆU CŨ/HỎNG (thiếu giá trị "NgayCapNhat"
 * khiến toàn bộ giá trị phía sau bị dồn lệch trái 1 cột — vd mã "PB01" lại nằm
 * dưới cột "NgayCapNhat" thay vì "MaPB"). Các dòng THẬT/hiện hành luôn có
 * "NgayCapNhat" là 1 giá trị Ngày hợp lệ — nên tự động LOẠI BỎ mọi dòng có
 * "NgayCapNhat" KHÔNG PHẢI ngày hợp lệ (coi là dữ liệu cũ/hỏng, không dùng).
 */
function docSheetNgoai_(spreadsheetId, tenSheet) {
  const ss = moSheetTheoIdCache_(spreadsheetId);
  const sh = ss.getSheetByName(tenSheet);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const header = values[0];
  const coCotNgayCapNhat = header[1] === "NgayCapNhat";
  return values.slice(1)
    .filter(function (row) { return row.some(function (v) { return v !== "" && v !== null; }); })
    .filter(function (row) { return !coCotNgayCapNhat || row[1] instanceof Date; })
    .map(function (row) {
      const obj = {};
      header.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
}

/**
 * Định dạng lại 1 giá trị MÃ có thể bị Excel/Sheets tự chuyển thành số (vd
 * "1.01" → số 1.01, "9" → số 9) — trả về CHUỖI đúng định dạng gốc: số nguyên
 * → không thập phân ("9"), số thập phân → làm tròn đúng 2 chữ số ("1.01",
 * "1.10") để không mất số 0 ở cuối do Excel/JS tự rút gọn số thực.
 */
function dinhDangMa_(v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v !== "number") return String(v);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/** Kiểm tra 1 dòng có hiệu lực tại ngayMoc không (theo 2 cột hiệu lực chỉ định). */
function conHieuLuc_(row, ngayMoc, cotTu, cotDen) {
  const tu = row[cotTu];
  const den = row[cotDen];
  const tuOk = !(tu instanceof Date) || tu <= ngayMoc;
  // "Hiệu lực đến" = 0, rỗng, hoặc không phải Date → coi là CÒN HIỆU LỰC (chưa kết thúc)
  const denOk = !(den instanceof Date) || den >= ngayMoc;
  return tuOk && denOk;
}

/** Trong 1 danh sách, với mỗi mã (cotMa), chọn ĐÚNG 1 dòng đang hiệu lực tại ngayMoc (ưu tiên "Hiệu lực từ" gần nhất). */
function locHieuLucTheoMa_(list, cotMa, ngayMoc, cotTu, cotDen) {
  const theoMa = {};
  list.forEach(function (r) {
    const ma = r[cotMa];
    if (!ma) return;
    if (!conHieuLuc_(r, ngayMoc, cotTu, cotDen)) return;
    const hienTai = theoMa[ma];
    if (!hienTai) { theoMa[ma] = r; return; }
    const tuHienTai = hienTai[cotTu] instanceof Date ? hienTai[cotTu] : new Date(0);
    const tuMoi = r[cotTu] instanceof Date ? r[cotTu] : new Date(0);
    if (tuMoi >= tuHienTai) theoMa[ma] = r;
  });
  return theoMa;
}

/** Ngày dạng Date hoặc chuỗi ISO → Date, hoặc null nếu không hợp lệ/để trống (0 = chưa kết thúc). */
function ngayNgoaiThanhDate_(v) {
  if (v instanceof Date) return v;
  if (!v || v === 0) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** Bản đồ: loại danh mục (dùng ở tab Danh mục) → tên sheet tương ứng ở nguồn ngoài "DM_CONGTY_HAK". */
const DANH_MUC_SHEET_NGOAI_ = {
  PHONGBAN: "DM_PHONGBAN", CHUCVU: "DM_CHUCVU", LUONG: "DM_LUONG", PHUCAP: "DM_PHUCAP",
  TANGCA: "DM_TANGCA", HOTRO: "DM_HOTRO", BAOHIEM: "DM_BAOHIEM", GTTNCN: "DM_GT_TNCN", TNCN: "DM_TNCN"
};

/**
 * Kiểm tra 1 loại danh mục có dữ liệu ở nguồn ngoài không (dùng để quyết định
 * tab Danh mục hiện nút Thêm/Sửa/Xoá hay không cho loại đó — "chỉ xem" nếu có
 * nguồn ngoài, "nhập tay bình thường" nếu KHÔNG có). Không throw lỗi — nếu
 * chưa cấu hình nguồn ngoài hoặc lỗi kết nối, coi như "không có" (an toàn hơn:
 * cho nhập tay thay vì chặn người dùng khi hệ thống ngoài có sự cố).
 */
function danhMucCoNguonNgoaiKhong_(loai) {
  const sheetNgoai = DANH_MUC_SHEET_NGOAI_[loai];
  if (!sheetNgoai) return false;
  try {
    const idNgoai = layIdNgoai_("DANHMUC");
    return docSheetNgoai_(idNgoai, sheetNgoai).length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Trả về danh sách TOÀN BỘ loại danh mục kèm cờ "coNguonNgoai" — dùng cho tab
 * Danh mục trên webapp để tự động hiện/ẩn đúng nút Thêm/Sửa/Xoá theo từng loại.
 */
function layTrangThaiDongBoDanhMuc() {
  const ketQua = {};
  Object.keys(DANH_MUC_SHEET_NGOAI_).forEach(function (loai) {
    ketQua[loai] = danhMucCoNguonNgoaiKhong_(loai);
  });
  return ketQua;
}

/**
 * Đồng bộ TOÀN BỘ danh mục từ file ngoài "DM_CONGTY_HAK" về File Danh mục của
 * webapp — chỉ lấy phiên bản ĐANG HIỆU LỰC tại kỳ (nam, thang), ghi đè hoàn
 * toàn (vì đây là bản sao chỉ xem, không phải nơi nhập liệu gốc), gắn thêm cột
 * "Kỳ tính lương".
 */
function dongBoDanhMucTuNgoai(nam, thang) {
  const idNgoai = layIdNgoai_("DANHMUC");
  const ngayMoc = new Date(Number(nam), Number(thang) - 1, 1);
  const ky = thang + "/" + nam;
  const ketQua = [];

  // Bản đồ ngược: tên sheet ngoài -> loại danh mục (dùng gắn trường "loai" vào
  // kết quả trả về, để CLIENT TỰ CACHE trạng thái "có nguồn ngoài hay không"
  // ngay từ lúc "Tải dữ liệu kỳ này" — không cần hỏi lại server mỗi lần mở tab
  // Danh mục nữa, xem taiKyTinhLuong()/taiDanhMuc() ở index.html).
  const loaiTheoSheetNgoai = {};
  Object.keys(DANH_MUC_SHEET_NGOAI_).forEach(function (loai) { loaiTheoSheetNgoai[DANH_MUC_SHEET_NGOAI_[loai]] = loai; });

  // ⚠ Nếu 1 sheet danh mục KHÔNG có (hoặc rỗng) ở nguồn ngoài, GIỮ NGUYÊN dữ
  // liệu đang có tại webapp — KHÔNG ghi đè/xoá — để danh mục đó vẫn tiếp tục
  // nhập/sửa/xoá tay bình thường qua tab Danh mục (xem `maDanhMucConThuCong_`
  // dùng để hiển thị đúng nút Thêm/Sửa/Xoá trên giao diện).
  function dong(sheetNgoai, cotMa, cotTu, cotDen, sheetTrong, headerTrong, anhXa) {
    const loai = loaiTheoSheetNgoai[sheetNgoai] || "";
    const listNgoai = docSheetNgoai_(idNgoai, sheetNgoai);
    if (listNgoai.length === 0) {
      ketQua.push({
        sheet: sheetTrong, loai: loai, soDong: 0, boQua: true,
        ghiChu: "Không có sheet \"" + sheetNgoai + "\" (hoặc đang rỗng) ở nguồn ngoài — GIỮ NGUYÊN dữ liệu hiện có tại webapp, vẫn nhập/sửa/xoá tay bình thường được."
      });
      return;
    }
    const theoMa = locHieuLucTheoMa_(listNgoai, cotMa, ngayMoc, cotTu, cotDen);
    const danhSach = Object.values(theoMa).map(function (r) {
      const obj = anhXa(r);
      obj["Ngày cập nhật"] = new Date();
      obj["Hiệu lực từ"] = ngayNgoaiThanhDate_(r[cotTu]) || "";
      obj["Hiệu lực đến"] = ngayNgoaiThanhDate_(r[cotDen]) || "";
      obj["Kỳ tính lương"] = ky;
      return obj;
    });
    ghiDeSheet_(sheetTrong, headerTrong, danhSach);
    ketQua.push({ sheet: sheetTrong, loai: loai, soDong: danhSach.length, boQua: false, ghiChu: "" });
  }

  dong("DM_PHONGBAN", "MaPB", "HieuLucTuNgay", "HieuLucDenNgay", SHEET_DM_PHONGBAN, HEADER_DM_PHONGBAN, function (r) {
    return {
      "Mã phòng ban": dinhDangMa_(r["MaPB"]),
      "Tên phòng ban": (r["TenKhoi"] ? r["TenKhoi"] + " > " : "") + (r["TenPB"] || ""),
      "Tài khoản chi phí": r["TaiKhoanChiPhi"] || ""
    };
  });

  dong("DM_CHUCVU", "MaCV", "HieuLucTuNgay", "HieuLucDenNgay", SHEET_DM_CHUCVU, HEADER_DM_CHUCVU, function (r) {
    return { "Mã chức vụ": dinhDangMa_(r["MaCV"]), "Tên chức vụ": r["TenCV"] };
  });

  // ⚠ QUAN TRỌNG: nguồn ngoài (DM_LUONG) KHÔNG CÓ cột số riêng cho "Lương phụ",
  // "Ngưỡng truy thu BH (công)", "ĐK_Bù lương (công tối thiểu)", "Đơn giá bù
  // lương", "Đơn giá bơm dăm" — cũng KHÔNG CÓ text mô tả công thức ở "CachTinh"
  // (luôn rỗng trong dữ liệu mẫu). ĐÃ TỪNG map nhầm field "NgayGiamTru" (không
  // rõ ý nghĩa thật — khả năng là "công trung chuyển" dùng cho công thức tăng
  // ca TC1/TC2, KHÔNG PHẢI ngưỡng bù sản lượng, vì mã SP luôn = 0 trong khi
  // TG3/TG4/CN2 mới có giá trị 2-4) vào "ĐK_Bù lương" — ĐÃ BỎ, để TRỐNG các
  // field này (không tự bịa dữ liệu). ⚠ CẦN: bổ sung thêm cột số riêng ở
  // nguồn ngoài cho các giá trị này (ít nhất cho mã "SP"/"BD" — ngưỡng bù,
  // đơn giá bù, đơn giá bơm dăm), NẾU KHÔNG cơ chế "Bù sản lượng" và "Truy thu
  // bảo hiểm" sẽ không kích hoạt được cho ai (xem cảnh báo Mục 10/11 ở
  // KiemTra.gs — đã có sẵn để phát hiện đúng tình huống này).
  dong("DM_LUONG", "MaLuong", "HieuLucTuNgay", "HieuLucDenNgay", SHEET_DM_LUONG, HEADER_DM_LUONG, function (r) {
    return {
      "Mã lương": r["MaLuong"], "Mã hình thức lương": r["MaHinhThucLuong"], "Hình thức lương": r["HinhThucLuong"],
      "Số tiền khoán": r["SoTienKhoan"] || 0,
      "Lương phụ": "", "Ngưỡng truy thu BH (công)": "", "ĐK_Bù lương (công tối thiểu)": "",
      "Đơn giá bù lương": "", "Đơn giá bơm dăm": "",
      "Cách tính": r["CachTinh"] || ""
    };
  });

  dong("DM_PHUCAP", "MaPhuCap", "HieuLucTuNgay", "HieuLucDenNgay", SHEET_DM_PHUCAP, HEADER_DM_PHUCAP, function (r) {
    return {
      "Mã phụ cấp": r["MaPhuCap"], "Tên phụ cấp": r["TenPhuCap"], "Số tiền": r["SoTien"] || 0,
      "Tỷ lệ": r["TyLe"] || "", "Tham chiếu": r["ThamChieu"] || 0, "Cách tính": r["CachTinh"] || ""
    };
  });

  dong("DM_TANGCA", "MaTangCa", "HieuLucTuNgay", "HieuLucDenNgay", SHEET_DM_TANGCA, HEADER_DM_TANGCA, function (r) {
    return {
      "Mã tăng ca": r["MaTangCa"], "Nội dung tăng ca": r["NoiDungTangCa"], "Hệ số tăng ca": r["HeSoTangCa"] || "",
      "Tiền tăng ca (nếu tính cố định)": r["TienTangCaCoDinh"] || "", "Cách tính": r["CachTinh"] || ""
    };
  });

  dong("DM_HOTRO", "MaHoTro", "HieuLucTuNgay", "HieuLucDenNgay", SHEET_DM_HOTRO, HEADER_DM_HOTRO, function (r) {
    return { "Mã hỗ trợ": r["MaHoTro"], "Tên hỗ trợ": r["TenHoTro"], "Số tiền": r["SoTien"] || 0, "Cách tính": r["CachTinh"] || "" };
  });

  dong("DM_BAOHIEM", "MaBaoHiem", "HieuLucTuNgay", "HieuLucDenNgay", SHEET_DM_BAOHIEM, HEADER_DM_BAOHIEM, function (r) {
    return {
      "Mã bảo hiểm": r["MaBaoHiem"], "Nội dung": r["NoiDung"],
      "DN.BHXH": r["DN_BHXH"] || 0, "DN.BHYT": r["DN_BHYT"] || 0, "DN.BHTN": r["DN_BHTN"] || 0, "DN.KPCD": r["DN_KPCD"] || 0,
      "NLD.BHXH": r["NLD_BHXH"] || 0, "NLD.BHYT": r["NLD_BHYT"] || 0, "NLD.BHTN": r["NLD_BHTN"] || 0, "NLD.KPCD": r["NLD_KPCD"] || 0
    };
  });

  dong("DM_GT_TNCN", "MaGiamTru", "HieuLucTuNgay", "HieuLucDenNgay", SHEET_DM_GTTNCN, HEADER_DM_GTTNCN, function (r) {
    return { "Mã giảm trừ": r["MaGiamTru"], "Số người": r["SoNguoi"] || 1, "Số tiền": r["SoTien"] || 0 };
  });

  // ----- DM_TNCN + CT_BACTHUE_TNCN (biểu luỹ tiến, bảng con theo _parentId) -----
  // Webapp dùng chung 1 bảng "DM_TNCN" với 7 dòng = 7 bậc luỹ tiến (không tách
  // riêng "loại thuế" và "bậc thuế" như nguồn ngoài) — với mã KHÔNG PHẢI "LT01"
  // (luỹ tiến), webapp coi là loại thuế cố định/miễn (xem TinhLuong.gs, "Mã
  // TNCN" của từng người quyết định dùng nhánh nào) nên CHỈ đồng bộ các bậc của
  // loại "luỹ tiến" (dò theo NoiDung chứa "luỹ tiến"/"lũy tiến") vào DM_TNCN.
  (function () {
    const listTNCN = docSheetNgoai_(idNgoai, "DM_TNCN");
    const listBac = docSheetNgoai_(idNgoai, "CT_BACTHUE_TNCN");
    if (listTNCN.length === 0 || listBac.length === 0) {
      ketQua.push({ sheet: SHEET_DM_TNCN, loai: "TNCN", soDong: 0, boQua: true, ghiChu: "Không có DM_TNCN/CT_BACTHUE_TNCN ở nguồn ngoài — GIỮ NGUYÊN dữ liệu hiện có tại webapp, vẫn nhập/sửa/xoá tay bình thường được." });
      return;
    }
    const theoLoaiThue = locHieuLucTheoMa_(listTNCN, "MaThueTNCN", ngayMoc, "HieuLucTuNgay", "HieuLucDenNgay");
    // Tìm loại thuế "luỹ tiến" (dò theo nội dung, không hard-code đúng 1 mã cụ thể)
    const idLuyTien = Object.keys(theoLoaiThue)
      .map(function (ma) { return theoLoaiThue[ma]; })
      .find(function (r) { return /(luỹ tiến|lũy tiến)/i.test(r["NoiDung"] || ""); });
    if (!idLuyTien) {
      ketQua.push({ sheet: SHEET_DM_TNCN, loai: "TNCN", soDong: 0, boQua: true, ghiChu: "Không tìm thấy loại thuế \"luỹ tiến\" trong DM_TNCN ngoài — GIỮ NGUYÊN dữ liệu hiện có tại webapp." });
      return;
    }
    const bacCuaLoaiNay = listBac.filter(function (b) { return b["_parentId"] === idLuyTien["_id"]; });
    const danhSachBac = bacCuaLoaiNay.map(function (b) {
      return {
        "Ngày cập nhật": new Date(), "Bậc": b["Bac"], "Nội dung khấu trừ": "Luỹ tiến bậc " + b["Bac"],
        "Tỷ lệ đóng thuế": b["TyLeDong"] || 0,
        "Thu nhập tháng (Min)": b["ThuNhapTu"] || 0, "Thu nhập tháng (Max)": b["ThuNhapDen"] || 999999999999,
        "Hiệu lực từ": ngayNgoaiThanhDate_(idLuyTien["HieuLucTuNgay"]) || "", "Hiệu lực đến": ngayNgoaiThanhDate_(idLuyTien["HieuLucDenNgay"]) || "",
        "Kỳ tính lương": ky
      };
    });
    ghiDeSheet_(SHEET_DM_TNCN, HEADER_DM_TNCN, danhSachBac);
    ketQua.push({ sheet: SHEET_DM_TNCN, loai: "TNCN", soDong: danhSachBac.length, boQua: false, ghiChu: "" });
  })();

  return { ok: true, ky: ky, ketQua: ketQua };
}

/**
 * Đồng bộ Nhân sự từ file ngoài "THONGTINNHANSU_HAK" về File Data của webapp.
 * Nguồn ngoài là dạng quan hệ nhiều bảng, nối qua "_id"/"_parentId" (kiểu
 * database no-code): DM_NHANVIEN (gốc) → CT_QUATRINHLAMVIEC (hợp đồng, 1 nhân
 * viên có thể nhiều hợp đồng theo thời gian) → CT_CHITIETHOPDONG (phụ lục hợp
 * đồng — nơi thật sự chứa mức lương/mã tính lương, 1 hợp đồng có thể nhiều phụ
 * lục theo thời gian) — CHỈ lấy ĐÚNG 1 hợp đồng + 1 phụ lục đang hiệu lực tại
 * kỳ (nam, thang) cho mỗi nhân viên. Các bảng phụ (CT_THONGTINCANHAN,
 * CT_NHANTHAN, CT_THONGTINTHANHTOAN) nối qua "_parentId" = DM_NHANVIEN._id.
 *
 * Các trường trong phụ lục hợp đồng (MaPhongBan, MaCV, MaHinhThucLuong,
 * MaBHXH, MaTNCN, MaPhuCap, MaHoTro, MaHoTro2, MaTangCa) là GUID trỏ tới dòng
 * tương ứng trong danh mục ngoài — cần TRA NGƯỢC qua bản đồ _id→Mã trước khi
 * ghi vào NL_NHANSU (webapp dùng MÃ CHỮ, không dùng GUID nội bộ).
 *
 * ⚠️ "Mã GT_TNCN_BT"/"Mã GT_TNCN_PT" (giảm trừ gia cảnh): nguồn ngoài KHÔNG có
 * trường nào gán rõ nhân viên dùng đúng mã giảm trừ nào — tạm mặc định
 * "GTBT.01"/"GTNPT.01" (đúng 2 mã chuẩn nhìn thấy trong DM_GT_TNCN mẫu) cho
 * MỌI người. Nếu công ty có nhiều mức giảm trừ khác nhau, cần bổ sung 1 trường
 * ở nguồn ngoài để đồng bộ đúng.
 */
/**
 * ⚠ QUAN TRỌNG — TRÁNH NHẦM LẪN GIỮA 2 KHÁI NIỆM "DM_TNCN":
 *   - Ở FILE NGOÀI, "DM_TNCN" là bảng LOẠI THUẾ (vd "VL01"=vãng lai khấu trừ
 *     10%, "LT01"=luỹ tiến...), còn "CT_BACTHUE_TNCN" (bảng con, nối qua
 *     _parentId) mới thật sự là 7 BẬC LUỸ TIẾN — tương ứng ĐÚNG với
 *     `SHEET_DM_TNCN` ở webapp này (xem `dongBoDanhMucTuNgoai` — đã đọc đúng
 *     CT_BACTHUE_TNCN để đồng bộ biểu thuế, KHÔNG đọc nhầm DM_TNCN ngoài).
 *   - Ở NHÂN VIÊN (`NL_NHANSU."Mã TNCN"`), webapp dùng quy ước RIÊNG, CỐ ĐỊNH,
 *     KHÔNG liên quan tới mã "VL01"/"LT01" của nguồn ngoài:
 *       "TNCN1" = khấu trừ cố định 10% trên tổng thu nhập gộp
 *       "TNCN0"/để trống = miễn thuế
 *       "TNCN2"/khác = tính luỹ tiến theo SHEET_DM_TNCN
 *     (xem TinhLuong.gs, đoạn "Thuế TNCN"). Hàm này DỊCH mã loại thuế ngoài
 *     (dựa theo NỘI DUNG, không hard-code đúng 1 mã cụ thể) sang ĐÚNG 1 trong
 *     3 giá trị trên — TRƯỚC ĐÂY đồng bộ nhân sự gán THẲNG mã ngoài (vd
 *     "VL01") vào "Mã TNCN", khiến TinhLuong.gs KHÔNG nhận diện được (rơi vào
 *     nhánh "khác" = tính luỹ tiến cho TẤT CẢ mọi người, kể cả người đáng lẽ
 *     phải khấu trừ 10% cố định hoặc miễn thuế) — ĐÃ SỬA.
 * @return {Object} bản đồ _id (của dòng DM_TNCN ngoài) -> "TNCN0"/"TNCN1"/"TNCN2"
 */
function xayBanDoLoaiThueTNCN_(idDanhMucNgoai) {
  const list = docSheetNgoai_(idDanhMucNgoai, "DM_TNCN");
  const map = {};
  list.forEach(function (r) {
    if (!r["_id"]) return;
    const noiDung = String(r["NoiDung"] || "");
    let ma = "";
    if (/(luỹ tiến|lũy tiến)/i.test(noiDung)) ma = "TNCN2";
    else if (/(vãng lai|vang lai|cố định|co dinh|10%)/i.test(noiDung)) ma = "TNCN1";
    else if (/miễn|mien/i.test(noiDung)) ma = "TNCN0";
    map[r["_id"]] = ma;
  });
  return map;
}

function dongBoNhanSuTuNgoai(nam, thang) {
  const idNgoai = layIdNgoai_("NHANSU");
  const idDanhMucNgoai = layIdNgoai_("DANHMUC");
  const ngayMoc = new Date(Number(nam), Number(thang) - 1, 1);
  const ky = thang + "/" + nam;

  function xayBanDoMa_(sheetNgoai, cotMa) {
    const list = docSheetNgoai_(idDanhMucNgoai, sheetNgoai);
    const map = {};
    list.forEach(function (r) { if (r["_id"]) map[r["_id"]] = dinhDangMa_(r[cotMa]); });
    return map;
  }
  const mapPhongBan = xayBanDoMa_("DM_PHONGBAN", "MaPB");
  const mapChucVu = xayBanDoMa_("DM_CHUCVU", "MaCV");
  const mapLuong = xayBanDoMa_("DM_LUONG", "MaLuong");
  const mapBaoHiem = xayBanDoMa_("DM_BAOHIEM", "MaBaoHiem");
  const mapTNCN = xayBanDoLoaiThueTNCN_(idDanhMucNgoai);
  const mapPhuCap = xayBanDoMa_("DM_PHUCAP", "MaPhuCap");
  const mapHoTro = xayBanDoMa_("DM_HOTRO", "MaHoTro");
  const mapTangCa = xayBanDoMa_("DM_TANGCA", "MaTangCa");

  const dsNhanVien = docSheetNgoai_(idNgoai, "DM_NHANVIEN");
  const dsQuaTrinhLamViec = docSheetNgoai_(idNgoai, "CT_QUATRINHLAMVIEC");
  const dsChiTietHopDong = docSheetNgoai_(idNgoai, "CT_CHITIETHOPDONG");
  const dsThongTinCaNhan = docSheetNgoai_(idNgoai, "CT_THONGTINCANHAN");
  const dsNhanThan = docSheetNgoai_(idNgoai, "CT_NHANTHAN");
  const dsThanhToan = docSheetNgoai_(idNgoai, "CT_THONGTINTHANHTOAN");

  if (dsNhanVien.length === 0) {
    return { ok: false, loi: "Không đọc được sheet \"DM_NHANVIEN\" từ file ngoài (kiểm tra tên sheet/quyền truy cập)." };
  }

  const nhanVienTheoId = {};
  dsNhanVien.forEach(function (nv) { if (nv["_id"] && nv["MaNV"]) nhanVienTheoId[nv["_id"]] = nv; });

  const hopDongTheoNhanVien = {};
  dsQuaTrinhLamViec.forEach(function (hd) {
    const pid = hd["_parentId"];
    if (!pid) return;
    (hopDongTheoNhanVien[pid] = hopDongTheoNhanVien[pid] || []).push(hd);
  });

  const phuLucTheoHopDong = {};
  dsChiTietHopDong.forEach(function (pl) {
    const pid = pl["_parentId"];
    if (!pid) return;
    (phuLucTheoHopDong[pid] = phuLucTheoHopDong[pid] || []).push(pl);
  });

  function chonMoiNhatTheoParent_(list, cotTu) {
    const theoParent = {};
    list.forEach(function (r) {
      const pid = r["_parentId"];
      if (!pid) return;
      const hienTai = theoParent[pid];
      const tuMoi = r[cotTu] instanceof Date ? r[cotTu] : new Date(0);
      const tuHienTai = hienTai && hienTai[cotTu] instanceof Date ? hienTai[cotTu] : new Date(-1);
      if (!hienTai || tuMoi >= tuHienTai) theoParent[pid] = r;
    });
    return theoParent;
  }
  const caNhanTheoNV = chonMoiNhatTheoParent_(dsThongTinCaNhan, "HieuLucTuNgay");
  const thanhToanTheoNV = chonMoiNhatTheoParent_(dsThanhToan, "HieuLucTuNgay");

  const soNguoiPhuThuocTheoNV = {};
  dsNhanThan.forEach(function (r) {
    const pid = r["_parentId"];
    if (!pid || !r["DangKyPhuThuoc"]) return;
    soNguoiPhuThuocTheoNV[pid] = (soNguoiPhuThuocTheoNV[pid] || 0) + 1;
  });

  const dsNhanSuMoi = [];
  const dsChiTietMoi = [];
  let soBiBoQua = 0;

  Object.keys(nhanVienTheoId).forEach(function (idNV) {
    const nv = nhanVienTheoId[idNV];

    // ⚠ LỌC THEO "TrangThai" (DM_NHANVIEN) — TRƯỚC ĐÂY BỊ BỎ SÓT: nhân viên đã
    // nghỉ việc (TrangThai chứa "nghỉ") vẫn có thể lọt vào bảng lương nếu hợp
    // đồng/phụ lục "hiệu lực theo ngày" chưa kịp cập nhật ngày kết thúc — chặn
    // ngay tại đây, không phụ thuộc hoàn toàn vào ngày hiệu lực hợp đồng.
    if (/nghỉ|nghi/i.test(String(nv["TrangThai"] || ""))) { soBiBoQua++; return; }

    // Chọn hợp đồng đang hiệu lực tại kỳ (NgayVaoLam <= mốc, NgayChamDutHDLD trống hoặc >= mốc), mới nhất nếu nhiều
    let hopDongChon = null, tuHopDongChon = null;
    (hopDongTheoNhanVien[idNV] || []).forEach(function (hd) {
      const tu = ngayNgoaiThanhDate_(hd["NgayVaoLam"]);
      const den = ngayNgoaiThanhDate_(hd["NgayChamDutHDLD"]);
      if (tu && tu > ngayMoc) return;
      if (den && den < ngayMoc) return;
      if (!hopDongChon || (tu && (!tuHopDongChon || tu >= tuHopDongChon))) { hopDongChon = hd; tuHopDongChon = tu; }
    });
    if (!hopDongChon) { soBiBoQua++; return; }

    // Chọn phụ lục đang hiệu lực trong hợp đồng đó tại kỳ, mới nhất nếu nhiều
    let phuLucChon = null, tuPhuLucChon = null;
    (phuLucTheoHopDong[hopDongChon["_id"]] || []).forEach(function (pl) {
      const tu = ngayNgoaiThanhDate_(pl["HieuLucTuNgay"]) || ngayNgoaiThanhDate_(pl["TuNgay"]);
      const den = ngayNgoaiThanhDate_(pl["DenNgay"]);
      if (tu && tu > ngayMoc) return;
      if (den && den < ngayMoc) return;
      if (!phuLucChon || (tu && (!tuPhuLucChon || tu >= tuPhuLucChon))) { phuLucChon = pl; tuPhuLucChon = tu; }
    });
    if (!phuLucChon) { soBiBoQua++; return; }

    const caNhan = caNhanTheoNV[idNV] || {};
    const thanhToan = thanhToanTheoNV[idNV] || {};

    dsNhanSuMoi.push({
      "Ngày cập nhật": new Date(),
      "Mã nhân viên": nv["MaNV"], "Họ và tên": nv["TenNhanVien"],
      "Mã PB": mapPhongBan[phuLucChon["MaPhongBan"]] || "",
      "Mã CV": mapChucVu[phuLucChon["MaCV"]] || "",
      "Ngày vào làm": ngayNgoaiThanhDate_(hopDongChon["NgayVaoLam"]) || "",
      "Ngày hết hạn HĐ": ngayNgoaiThanhDate_(hopDongChon["NgayChamDutHDLD"]) || "",
      "Ngày nghỉ/thay đổi": "",
      "Lương cơ bản": phuLucChon["LuongCoBan"] || 0,
      "Lương thỏa thuận": phuLucChon["LuongThoaThuan"] || 0,
      "Hình thức hợp đồng": hopDongChon["HinhThucHDLD"] || "",
      "Mã tiền lương 1": mapLuong[phuLucChon["MaCongTac"]] || "",
      "Mã tiền lương 2": mapLuong[phuLucChon["MaLuongPhu"]] || "",
      "Mã tăng ca": mapTangCa[phuLucChon["MaTangCa"]] || "",
      "Mã phụ cấp": mapPhuCap[phuLucChon["MaPhuCap"]] || "",
      "Mã hỗ trợ": mapHoTro[phuLucChon["MaHoTro"]] || "",
      "Mã hỗ trợ 2": mapHoTro[phuLucChon["MaHoTro2"]] || "",
      "Mã BHXH": mapBaoHiem[phuLucChon["MaBHXH"]] || "",
      "Mã TNCN": mapTNCN[phuLucChon["MaTNCN"]] || "",
      "Hiệu lực từ": tuPhuLucChon || "", "Hiệu lực đến": ngayNgoaiThanhDate_(phuLucChon["DenNgay"]) || "",
      "Kỳ tính lương": ky
    });

    dsChiTietMoi.push({
      "Ngày cập nhật": new Date(),
      "Mã nhân viên": nv["MaNV"], "Họ và tên": nv["TenNhanVien"],
      "Số CCCD": caNhan["SoCCCD"] || nv["SoCCCD"] || "",
      "Ngày sinh": ngayNgoaiThanhDate_(caNhan["NgaySinh"]) || "",
      "Thường trú": caNhan["ThuongTru"] || "",
      "Ngày cấp CCCD": ngayNgoaiThanhDate_(caNhan["NgayCap"]) || "",
      "Nơi cấp": caNhan["NoiCap"] || "",
      "Mã BHXH": mapBaoHiem[phuLucChon["MaBHXH"]] || "",
      "Số điện thoại": caNhan["SoDienThoai"] || "",
      "Số HĐLĐ": hopDongChon["SoHDLD"] || "",
      "Mã GT_TNCN_BT": "GTBT.01", "Mã GT_TNCN_PT": "GTNPT.01",
      "Người phụ thuộc": soNguoiPhuThuocTheoNV[idNV] || 0,
      "Số tài khoản": thanhToan["SoTaiKhoan"] || "", "Tên Ngân hàng": thanhToan["TenNganHang"] || "",
      "Kỳ tính lương": ky
    });
  });

  ghiDeSheet_(SHEET_NHANSU, HEADER_NHANSU, dsNhanSuMoi);
  ghiDeSheet_(SHEET_CHITIETNS, HEADER_CHITIETNS, dsChiTietMoi);

  return {
    ok: true, ky: ky, soNhanVien: dsNhanSuMoi.length,
    soTongCong: dsNhanVien.length, soBiBoQua: soBiBoQua
  };
}

/**
 * Đồng bộ CẢ 2 nguồn ngoài (Danh mục rồi tới Nhân sự — ĐÚNG THỨ TỰ này vì Nhân
 * sự cần tra danh mục vừa đồng bộ để giải mã GUID). Đây là hàm được gọi TỰ
 * ĐỘNG mỗi khi bấm "Tính lương" trên webapp (xem TinhLuong.gs).
 */
function dongBoTatCaTuNgoai(nam, thang) {
  const ketQuaDanhMuc = dongBoDanhMucTuNgoai(nam, thang);
  const ketQuaNhanSu = dongBoNhanSuTuNgoai(nam, thang);
  return { ok: ketQuaDanhMuc.ok && ketQuaNhanSu.ok, danhMuc: ketQuaDanhMuc, nhanSu: ketQuaNhanSu };
}
