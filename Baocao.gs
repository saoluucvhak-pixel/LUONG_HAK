// ================= BÁO CÁO =================
// 4 báo cáo tổng hợp dùng cho tab "Báo cáo" trên webapp. Báo cáo Tiền lương/
// Bảo hiểm/Thuế TNCN đọc trực tiếp từ RP_BANGLUONG/RP_BHXH/RP_THUETNCN — tức là
// LUÔN ứng với LẦN CHẠY "Tính lương" GẦN NHẤT (các sheet này bị ghi đè mỗi lần
// tính), không phải dữ liệu của mọi kỳ cộng dồn. layKyGanNhat_() cho biết kỳ đó
// là tháng/năm nào để hiển thị trên báo cáo.

function layKyGanNhat_() {
  return PropertiesService.getScriptProperties().getProperty("KY_GAN_NHAT") || "(chưa tính lương lần nào — vào tab Bảng lương để tính trước)";
}

/** Báo cáo tiền lương: tổng hợp toàn công ty + theo phòng ban, từ RP_BANGLUONG. */
function baoCaoTienLuong() {
  const list = docSheetThanhObject_(SHEET_BANGLUONG, HEADER_BANGLUONG);
  const theoPhongBanMap = {};
  let tongThuNhap = 0, tongThucLinh = 0, tongBH = 0, tongThue = 0, tongTamUng = 0;

  list.forEach(function (r) {
    const pb = r["Phòng ban"] || "(chưa xác định)";
    if (!theoPhongBanMap[pb]) {
      theoPhongBanMap[pb] = { "Phòng ban": pb, "Số người": 0, "Tổng thu nhập": 0, "Tổng thực lĩnh": 0 };
    }
    theoPhongBanMap[pb]["Số người"]++;
    theoPhongBanMap[pb]["Tổng thu nhập"] += Number(r["Tổng thu nhập (trước trừ)"]) || 0;
    theoPhongBanMap[pb]["Tổng thực lĩnh"] += Number(r["Thực lĩnh"]) || 0;

    tongThuNhap += Number(r["Tổng thu nhập (trước trừ)"]) || 0;
    tongThucLinh += Number(r["Thực lĩnh"]) || 0;
    tongBH += Number(r["BHXH/BHYT/BHTN trừ NLĐ"]) || 0;
    tongThue += Number(r["Thuế TNCN"]) || 0;
    tongTamUng += Number(r["Tạm ứng"]) || 0;
  });

  return {
    ky: layKyGanNhat_(),
    tongHop: { soNguoi: list.length, tongThuNhap: tongThuNhap, tongThucLinh: tongThucLinh, tongBH: tongBH, tongThue: tongThue, tongTamUng: tongTamUng },
    theoPhongBan: Object.values(theoPhongBanMap),
    chiTiet: list
  };
}

/** Báo cáo nhân sự: tổng hợp theo phòng ban/chức vụ + trạng thái, từ NL_NHANSU. */
function baoCaoNhanSu(baoGomDaNghi) {
  const list = layDanhSachNhanSu(!!baoGomDaNghi);
  const theoPhongBanMap = {}, theoChucVuMap = {};
  let dangLam = 0, daNghi = 0;

  list.forEach(function (nv) {
    const pb = nv["Tên phòng ban"] || "(chưa xác định)";
    const cv = nv["Tên chức vụ"] || "(chưa xác định)";
    theoPhongBanMap[pb] = (theoPhongBanMap[pb] || 0) + 1;
    theoChucVuMap[cv] = (theoChucVuMap[cv] || 0) + 1;
    if (nv["Trạng thái"] === "Đang làm") dangLam++; else daNghi++;
  });

  return {
    tongHop: { tongSo: list.length, dangLam: dangLam, daNghi: daNghi },
    theoPhongBan: Object.keys(theoPhongBanMap).map(function (k) { return { "Phòng ban": k, "Số người": theoPhongBanMap[k] }; }),
    theoChucVu: Object.keys(theoChucVuMap).map(function (k) { return { "Chức vụ": k, "Số người": theoChucVuMap[k] }; }),
    chiTiet: list
  };
}

/** Báo cáo các khoản trích theo lương (BHXH/BHYT/BHTN/KPCĐ), từ RP_BHXH. */
function baoCaoBHXH() {
  const list = docSheetThanhObject_(SHEET_BHXH, HEADER_BHXH);
  let tongCty = 0, tongNLD = 0;
  list.forEach(function (r) {
    tongCty += Number(r["Cộng BH công ty đóng"]) || 0;
    tongNLD += Number(r["Cộng BH NLĐ đóng"]) || 0;
  });
  return {
    ky: layKyGanNhat_(),
    tongHop: { soNguoi: list.length, tongCty: tongCty, tongNLD: tongNLD, tongCong: tongCty + tongNLD },
    chiTiet: list
  };
}

/** Báo cáo thuế TNCN, từ RP_THUETNCN. */
function baoCaoTNCN() {
  const list = docSheetThanhObject_(SHEET_TNCN, HEADER_TNCN);
  let tongThue = 0, tongThuNhapTinhThue = 0;
  list.forEach(function (r) {
    tongThue += Number(r["Thuế TNCN phải nộp"]) || 0;
    tongThuNhapTinhThue += Number(r["Thu nhập tính thuế"]) || 0;
  });
  return {
    ky: layKyGanNhat_(),
    tongHop: { soNguoiNopThue: list.length, tongThuNhapTinhThue: tongThuNhapTinhThue, tongThue: tongThue },
    chiTiet: list
  };
}
