// ================= BỘ MÁY TÍNH LƯƠNG CHÍNH =================
// Đây là hàm trung tâm — gọi từ WebApp.gs khi người dùng bấm nút "Tính lương".
// Đọc toàn bộ dữ liệu vào (NL_*, DL_*, DM_*), tính ra 3 sheet đầu ra:
// RP_BANGLUONG (bảng lương đầy đủ), RP_BHXH (khoản trích theo lương),
// RP_THUETNCN (chi tiết thuế TNCN).

/**
 * Parse 1 giá trị số có thể ở dạng số thuần (0.5) HOẶC chuỗi phần trăm ("50%").
 * ⚠ PHÁT HIỆN QUA DỮ LIỆU THẬT: cột "Hệ số tăng ca" trong DM_TANGCA của HAK_DN
 * lưu dạng chuỗi "50%" (không phải số 0.5) — dùng thẳng Number("50%") sẽ ra NaN,
 * làm tiền tăng ca luôn tính ra 0đ. Hàm này xử lý cả 2 dạng.
 */
function soTuChuoiPhanTram_(giaTri) {
  if (giaTri === "" || giaTri === null || giaTri === undefined) return 0;
  if (typeof giaTri === "number") return giaTri;
  const chuoi = String(giaTri).trim();
  if (chuoi.endsWith("%")) {
    const so = parseFloat(chuoi.slice(0, -1).replace(",", "."));
    return isNaN(so) ? 0 : so / 100;
  }
  const so = parseFloat(chuoi.replace(",", "."));
  return isNaN(so) ? 0 : so;
}

/**
 * @param {string} nam vd "2026"
 * @param {number} thang vd 6
 * @param {string} phuongPhapBu "NGAY" (đối chiếu ngưỡng bù sản lượng theo TỪNG
 *   NGÀY — đúng như công thức Power Query thật của Đại Hiệp, xem
 *   references/kien_truc_powerquery_powerpivot.md Mục 3.1) hoặc "THANG" (bình
 *   quân cả tháng — đơn giản hơn, mặc định nếu không truyền)
 * @return {{ soNguoi: number, tongThucLinh: number }} tóm tắt để hiển thị trên UI
 */
function tinhBangLuong(nam, thang, phuongPhapBu) {
  const namSo = Number(nam);
  const buTheoNgay = (phuongPhapBu === "NGAY");

  // ⚠ Đồng bộ Danh mục/Nhân sự từ nguồn ngoài KHÔNG còn tự động chạy ở đây —
  // đã tách thành bước RIÊNG ở tab "Kỳ tính lương" (người dùng chủ động bấm
  // "Tải dữ liệu kỳ này" trước). Hàm này chỉ ĐỌC dữ liệu NL_NHANSU/DM_* đang
  // có sẵn — nếu chưa tải kỳ nào, kết quả sẽ rỗng/thiếu (xem cảnh báo tương
  // ứng ở tab Kiểm tra bảng lương).

  // 1) Dữ liệu nền
  const nhanSuList = docSheetThanhObject_(SHEET_NHANSU, HEADER_NHANSU);
  const chiTietNSList = docSheetThanhObject_(SHEET_CHITIETNS, HEADER_CHITIETNS);
  const chiTietNSMap = {};
  chiTietNSList.forEach(r => { chiTietNSMap[r["Mã nhân viên"]] = r; });

  const dmLuong = docDanhMucLuong_(namSo, thang);
  const dmPhuCap = docDanhMucPhuCap_(namSo, thang);
  const dmTangCa = docDanhMucTangCa_(namSo, thang);
  const dmHoTro = docDanhMucHoTro_(namSo, thang);
  const dmBaoHiem = docDanhMucBaoHiem_(namSo, thang);
  const dmPhongBan = docDanhMucPhongBan_();
  const dmChucVu = docDanhMucChucVu_();
  const bieuThue = docBieuThueTNCN_(namSo, thang);
  const dmGiamTru = docDanhMucGiamTruTNCN_(namSo, thang);

  // 2) Dữ liệu phát sinh trong kỳ
  const chamCongMap = tongHopChamCong_(namSo, thang);
  const sanLuongMap = tongHopSanLuong_(SHEET_SANLUONG, namSo, thang);
  const banDamMap = tongHopSanLuong_(SHEET_BANDAM, namSo, thang);
  // Chỉ cần dữ liệu theo-từng-ngày khi chọn phương án "Bù theo ngày" — tránh đọc
  // dư dữ liệu không cần thiết khi dùng phương án "Bù theo tháng" (mặc định).
  const congTheoNgayMap = buTheoNgay ? layCongChinhTheoNgay_(namSo, thang) : null;
  const sanLuongTheoNgayMap = buTheoNgay ? tongHopSanLuongTheoNgay_(SHEET_SANLUONG, namSo, thang) : null;
  const psLuongMap = tongHopTheoManv_(SHEET_PSLUONG, HEADER_PSLUONG, "Ngày hạch toán", namSo, thang,
    ["Thưởng", "Thu nhập khác", "Trừ khác"]);
  const ungLuongMap = tongHopTheoManv_(SHEET_UNGLUONG, HEADER_UNGLUONG, "Ngày hạch toán", namSo, thang,
    ["Tạm ứng"]);
  const tienComTheoNgayMap = tongHopNgayComTheoNV_(namSo, thang);

  const ketQuaBangLuong = [];
  const ketQuaBHXH = [];
  const ketQuaTNCN = [];
  let tongThucLinh = 0;

  nhanSuList.forEach(ns => {
    const maNV = ns["Mã nhân viên"];
    if (!maNV) return;
    // Bỏ qua nhân viên đã nghỉ trước kỳ đang tính (nếu có ngày nghỉ)
    const ngayNghi = ns["Ngày nghỉ/thay đổi"];
    const kyTinhLuong = new Date(namSo, thang - 1, 1);
    if (ngayNghi instanceof Date && ngayNghi < kyTinhLuong) return;

    const congInfo = chamCongMap[maNV] || { tongCong: 0, congChuNhat: 0, congTangCa: 0, congCom: 0, congTheoHinhThuc: {}, nhanTheoNgay: {} };
    const congChuan = layCongChuan_(ns, thang, namSo, dmLuong, congInfo.tongCong); // xem hàm bên dưới — tuỳ mã lương/hình thức HĐ
    const luongThoaThuan = Number(ns["Lương thỏa thuận"]) || 0;

    // ----- Xác định hình thức lương TRƯỚC (để tính đúng công thức theo mã) -----
    const dmLuongInfo = dmLuong[ns["Mã tiền lương 1"]] || dmLuong[ns["Mã tiền lương 2"]] || null;
    const maTL1 = ns["Mã tiền lương 1"] || "";
    // ⚠ PHÁT HIỆN QUA DỮ LIỆU THẬT: giá trị thật của "Mã hình thức lương" cho lương
    // sản phẩm là "LSP" (không phải "SP" trơn như suy đoán ban đầu — "SP" là "Mã
    // lương", "LSP" mới là "Mã hình thức lương") — dùng so khớp === "SP" trước đây
    // SẼ KHÔNG BAO GIỜ đúng với dữ liệu thật, khiến toàn bộ nhánh lương sản lượng
    // không kích hoạt. Đã sửa dùng regex khớp cả "SP" và "LSP".
    const laLuongSanLuong = !!(dmLuongInfo && /SP/i.test(dmLuongInfo["Mã hình thức lương"] || ""));

    // ----- Lương thời gian -----
    // ⚠ ĐÃ SỬA LẦN 2 sau khi đọc được nguyên văn công thức thật (Power Query thuần,
    // không qua DAX, từ Bang_luong_DN_09_2025 — hàm QR_LUONGTG."Lương thời gian"):
    //   - Mã "CĐ" (cố định)        → Lương thời gian = Lương thỏa thuận (KHÔNG theo công)
    //   - Mã "CN1"/"CN2"/"SP"      → Lương thời gian = Lương thỏa thuận × Công tính TG
    //     (ở đây "Lương thỏa thuận" là ĐƠN GIÁ MỖI CÔNG, không phải lương tháng — nhân
    //     trực tiếp, không chia cho công chuẩn)
    //   - Các mã còn lại (TG1-4...) → Lương thời gian = (Lương thỏa thuận / Công chuẩn) × Công tính TG
    // Bản trước đây (lượt sửa trước) đã TẮT HẲN lương thời gian cho mã "SP" vì tưởng
    // sẽ tính trùng với lương sản lượng — ĐÂY LÀ SUY LUẬN SAI: công ty vẫn cộng cả 2
    // khoản song song cho công nhân sản lượng (Lương thời gian theo đơn giá/công LẪN
    // Lương sản lượng theo đơn giá/tấn), đã sửa lại đúng theo công thức thật.
    const donGiaLTG = congChuan > 0 ? luongThoaThuan / congChuan : 0; // vẫn cần cho tăng ca ở dưới
    const congTinhLTG = Math.min(congInfo.tongCong, congChuan) || congInfo.tongCong;
    let luongThoiGian = 0;
    if (maTL1 === "CĐ") {
      luongThoiGian = luongThoaThuan;
    } else if (maTL1 === "CN1" || maTL1 === "CN2" || maTL1 === "SP") {
      luongThoiGian = Math.round(luongThoaThuan * congTinhLTG);
    } else {
      luongThoiGian = Math.round(donGiaLTG * congTinhLTG);
    }

    // Lương phụ: khoản cộng thêm cố định khai báo trong DM_LUONG (khác lương thời gian,
    // áp dụng song song với lương sản lượng nếu đơn vị có quy định — để 0 nếu không khai báo)
    const luongPhu = dmLuongInfo ? (Number(dmLuongInfo["Lương phụ"]) || 0) : 0;

    // ----- Lương sản lượng -----
    const sanLuongTan = (sanLuongMap[maNV] || 0);
    const donGiaSL = dmLuongInfo ? (Number(dmLuongInfo["Số tiền khoán"]) || 0) : 0;
    let luongSanLuong = 0;
    let luongBuSL = 0;
    if (laLuongSanLuong) {
      luongSanLuong = Math.round(sanLuongTan * donGiaSL);
      const nguongCong = Number(dmLuongInfo["ĐK_Bù lương (công tối thiểu)"]) || 0;
      const donGiaBu = Number(dmLuongInfo["Đơn giá bù lương"]) || 0;

      if (buTheoNgay) {
        // ⚠ PHƯƠNG ÁN "BÙ THEO NGÀY" — khớp đúng công thức Power Query thật của
        // Đại Hiệp (QR_BCCSL/RP_CTBUSL, xem kien_truc_powerquery_powerpivot.md
        // Mục 3.1): đối chiếu ngưỡng RIÊNG CHO TỪNG NGÀY (sản lượng ngày đó ÷
        // công ngày đó), cộng dồn phần bù của từng ngày lại thành tổng bù tháng —
        // chính xác hơn phương án bình quân tháng khi sản lượng không đều nhau
        // giữa các ngày trong tháng.
        if (nguongCong > 0 && donGiaBu > 0) {
          const congNgay = (congTheoNgayMap && congTheoNgayMap[maNV]) || {};
          const slNgay = (sanLuongTheoNgayMap && sanLuongTheoNgayMap[maNV]) || {};
          for (let ngay = 1; ngay <= 31; ngay++) {
            const ten = ("0" + ngay).slice(-2);
            const congCuaNgay = congNgay[ten] || 0;
            if (congCuaNgay <= 0) continue;
            const slCuaNgay = slNgay[ten] || 0;
            if ((slCuaNgay / congCuaNgay) < nguongCong) {
              const buNgay = Math.round(donGiaBu * congCuaNgay) - Math.round(slCuaNgay * donGiaSL);
              if (buNgay > 0) luongBuSL += buNgay;
            }
          }
        }
      } else {
        // Phương án "BÙ THEO THÁNG" (mặc định) — bình quân cả tháng: nếu sản lượng
        // quy đổi ra công thấp hơn ngưỡng, bù theo đơn giá cố định/công thay vì
        // theo sản lượng thực tế. ĐƠN GIẢN HƠN nhưng có thể lệch so với công thức
        // thật nếu sản lượng không đều giữa các ngày trong tháng — xem Mục 3.1
        // trong references/kien_truc_powerquery_powerpivot.md để biết vì sao.
        if (nguongCong > 0 && congInfo.tongCong > 0) {
          const slBinhQuanMoiCong = sanLuongTan / congInfo.tongCong;
          if (slBinhQuanMoiCong < nguongCong) {
            luongBuSL = Math.round(donGiaBu * congInfo.tongCong) - luongSanLuong;
            if (luongBuSL < 0) luongBuSL = 0;
          }
        }
      }
    }

    // ----- Lương bơm dăm -----
    // ⚠ CẤU TRÚC DỮ LIỆU MỚI: "BD" (bơm dăm) giờ là 1 MÃ LƯƠNG ĐỘC LẬP (có
    // "Số tiền khoán" riêng, vd 10.000đ/xe) — KHÔNG CÒN là field phụ "Đơn giá
    // bơm dăm" gắn trong dòng "SP" như thiết kế cũ. Người vừa trả lương sản
    // lượng vừa bơm dăm sẽ có "Mã tiền lương 2" = "BD" (đồng bộ tách từ chuỗi
    // nhiều mã, xem DongBoNgoai.gs). ƯU TIÊN dùng "Số tiền khoán" của Mã tiền
    // lương 2 (nếu có, và đúng loại lương sản phẩm) — FALLBACK về field "Đơn
    // giá bơm dăm" cũ (tương thích ngược với "Khởi tạo Quy chế lương hiện
    // hành"/dữ liệu nhập tay kiểu cũ).
    const soXeBanDam = banDamMap[maNV] || 0;
    const dmLuong2Info = dmLuong[ns["Mã tiền lương 2"]] || null;
    const laLuong2SanPham = !!(dmLuong2Info && /SP/i.test(dmLuong2Info["Mã hình thức lương"] || ""));
    const donGiaBanDam = laLuong2SanPham
      ? (Number(dmLuong2Info["Số tiền khoán"]) || 0)
      : (dmLuongInfo ? (Number(dmLuongInfo["Đơn giá bơm dăm"]) || 0) : 0);
    const luongBanDam = Math.round(soXeBanDam * donGiaBanDam);

    // ----- Tăng ca -----
    // ⚠ ĐÃ SỬA LẦN 2 theo đúng nguyên văn công thức thật (QR_LUONGTG."Lương tăng ca",
    // xem references/cong_thuc_that_pure_powerquery.md Mục 2) — có 3 NHÁNH:
    //   - Mã tiền lương 1 ∈ {"CN1","CN2"}: Tiền tăng ca = Lương thỏa thuận × Công tính tăng ca
    //     (đơn giá ngày, nhân trực tiếp — không chia công chuẩn)
    //   - Mã tăng ca = "TC5" (ca làm thêm vị trí khác — lương khoán, KHÔNG theo hệ số):
    //     Tiền tăng ca = (Tiền tăng ca cố định trong DM_TANGCA / Công chuẩn) × Công tăng ca
    //   - Còn lại: Tiền tăng ca = Đơn giá lương TG × "Công tính tăng ca" (đã tính đủ hệ số,
    //     đã trừ Công lễ/Ngày phép/Công di chuyển/Công trung chuyển — xem TinhCong.gs)
    // Bản trước dùng chung 1 công thức cho mọi trường hợp, KHÔNG phân biệt CN1/CN2/TC5,
    // và thiếu hẳn Ngày phép/Công di chuyển/Công trung chuyển trong công thức TC1/TC2.
    const dmTangCaInfo = dmTangCa[ns["Mã tăng ca"]] || null;
    let tienTangCa = 0;
    if (congChuan > 0) {
      if (maTL1 === "CN1" || maTL1 === "CN2") {
        tienTangCa = Math.round(luongThoaThuan * congInfo.congTangCa);
      } else if (ns["Mã tăng ca"] === "TC5" && dmTangCaInfo) {
        const tienCoDinh = Number(dmTangCaInfo["Tiền tăng ca (nếu tính cố định)"]) || 0;
        tienTangCa = Math.round((tienCoDinh / congChuan) * congInfo.congTangCa);
      } else if (dmTangCaInfo) {
        const heSo = soTuChuoiPhanTram_(dmTangCaInfo["Hệ số tăng ca"]);
        const congTinhTangCa = tinhHeSoTangCa_(
          ns["Mã tăng ca"], congInfo.tongCong, congInfo.congTrungChuyen, congInfo.congLe,
          congChuan, congInfo.congChuNhat, congInfo.congTangCa, heSo, congInfo.congPhep, congInfo.congDiChuyen
        );
        tienTangCa = Math.round(donGiaLTG * congTinhTangCa);
      }
    }

    // ----- Phụ cấp trách nhiệm (TN) — CÓ THỂ theo tỷ lệ công, CÓ THỂ cố định -----
    // ⚠ PHÁT HIỆN MỚI: một số mã phụ cấp (vd "TN.01"/"TN.02") tính THEO TỶ LỆ CÔNG
    // ("Tổng công ≥ ngưỡng thì tính đủ, nhỏ hơn thì Số tiền/Công chuẩn×Tổng công"),
    // KHÔNG PHẢI luôn là số tiền cố định như bản trước giả định. Nhận diện qua chữ
    // "cố định" trong cột "Cách tính" — nếu KHÔNG có chữ này thì áp dụng công thức tỷ
    // lệ; cột "Tham chiếu" (0 nếu trống) là số công được TRỪ khỏi công chuẩn để ra
    // ngưỡng đủ 100% (vd Tham chiếu=5 → ngưỡng = Công chuẩn − 5).
    const phuCapInfo = dmPhuCap[ns["Mã phụ cấp"]];
    let tienPhuCap = 0;
    if (phuCapInfo) {
      const soTienPC = Number(phuCapInfo["Số tiền"]) || 0;
      const laCoDinh = /cố định/i.test(String(phuCapInfo["Cách tính"] || "")) || !phuCapInfo["Cách tính"];
      if (laCoDinh) {
        tienPhuCap = soTienPC || Math.round(luongThoaThuan * soTuChuoiPhanTram_(phuCapInfo["Tỷ lệ"]));
      } else if (congChuan > 0) {
        const thamChieu = Number(phuCapInfo["Tham chiếu"]) || 0;
        const nguongDu = congChuan - thamChieu;
        tienPhuCap = congInfo.tongCong >= nguongDu ? soTienPC : Math.round((soTienPC / congChuan) * congInfo.tongCong);
      }
    }

    // ----- Lương hỗ trợ (dùng "Mã hỗ trợ 2") — bù khi công thiếu so công chuẩn -----
    // ⚠ PHÁT HIỆN MỚI: đây là khoản TÁCH BIỆT với "Tiền cơm" bên dưới, dùng SLOT MÃ
    // KHÁC ("Mã hỗ trợ 2", không phải "Mã hỗ trợ"). Công thức thật (vd mã "HT.02" —
    // "Hỗ trợ lương cơ giới"): nếu công thực tế < công chuẩn, bù phần thiếu theo đơn
    // giá cố định/công. Bản trước GỘP NHẦM khái niệm này với tiền cơm thành 1 cột
    // "Hỗ trợ" duy nhất — đã tách lại đúng 2 khái niệm, 2 mã, 2 cột riêng.
    const hoTro2Info = dmHoTro[ns["Mã hỗ trợ 2"]];
    let luongHoTro = 0;
    if (hoTro2Info && congChuan > 0) {
      const donGiaHT2 = Number(hoTro2Info["Số tiền"]) || 0;
      if (congInfo.tongCong - congChuan <= 0) {
        luongHoTro = Math.round((congChuan - congInfo.tongCong) * donGiaHT2);
      }
    }

    // ----- Tiền cơm (dùng "Mã hỗ trợ", đơn giá × Ngày cơm) -----
    // ⚠ "Ngày cơm" lấy từ 2 NGUỒN CỘNG LẠI (đơn vị chỉ cần dùng 1 trong 2, cộng
    // chung để không sót nếu lỡ dùng cả 2 nguồn cho các tháng khác nhau):
    //   1. Hình thức công "CC" (Công tính cơm) ngay trong NL_CHAMCONG — ĐÃ XÁC NHẬN
    //      với người dùng đây là 1 trong 5 hình thức công chính thức dùng thật.
    //   2. Sheet DL_TIENCOM (nhập tay riêng, dùng khi không muốn thêm dòng "CC"
    //      vào bảng chấm công).
    const hoTro1Info = dmHoTro[ns["Mã hỗ trợ"]];
    const ngayCom = (congInfo.congCom || 0) + (tienComTheoNgayMap[maNV] || 0);
    const tienCom = hoTro1Info ? Math.round(ngayCom * (Number(hoTro1Info["Số tiền"]) || 0)) : 0;

    // ----- Phụ cấp công tác theo NHÃN chấm công (PHÁT HIỆN MỚI từ dữ liệu thật) -----
    // ⚠ Khi 1 ô chấm công ghi "1QC" (1 công + nhãn "QC"), hệ thống thật tự cộng thêm
    // phụ cấp công tác: đếm số ngày có nhãn X trong tháng, nhân với "Số tiền" của
    // đúng mã X đó trong DM_PHUCAP (nhãn "QC" khớp thẳng với mã phụ cấp "QC" — ĐÃ
    // XÁC MINH khớp chính xác qua dữ liệu thật HAK_DN T10/2025: 7 ngày nhãn "QC" ×
    // 100.000đ = 700.000đ, đúng bằng cột "Phụ cấp CT" trong RP_THBL thật). Trước đây
    // webapp HOÀN TOÀN CHƯA CÓ cơ chế này — phụ cấp chỉ gán cố định theo "Mã phụ cấp"
    // của từng người, bỏ sót toàn bộ phụ cấp phát sinh theo ngày công tác thực tế.
    let tienPhuCapCongTac = 0;
    const nhanTheoNgay = congInfo.nhanTheoNgay || {};
    const demNhan = {};
    Object.keys(nhanTheoNgay).forEach(function (ten) {
      const nhan = nhanTheoNgay[ten];
      if (nhan) demNhan[nhan] = (demNhan[nhan] || 0) + 1;
    });
    Object.keys(demNhan).forEach(function (nhan) {
      const pc = dmPhuCap[nhan]; // nhãn chấm công trùng thẳng với Mã phụ cấp
      if (pc) tienPhuCapCongTac += demNhan[nhan] * (Number(pc["Số tiền"]) || 0);
    });

    // ----- Thưởng / thu nhập khác / trừ khác / tạm ứng -----
    const ps = psLuongMap[maNV] || { "Thưởng": 0, "Thu nhập khác": 0, "Trừ khác": 0 };
    const ung = ungLuongMap[maNV] || { "Tạm ứng": 0 };

    // ----- Tổng thu nhập trước trừ -----
    const tongThuNhap = luongThoiGian + luongPhu + luongSanLuong + luongBuSL + luongBanDam + tienTangCa +
      tienPhuCap + tienPhuCapCongTac + luongHoTro + tienCom + (Number(ps["Thưởng"]) || 0) + (Number(ps["Thu nhập khác"]) || 0);

    // ----- BHXH/BHYT/BHTN -----
    const bhInfo = dmBaoHiem[ns["Mã BHXH"]];
    const luongDongBH = Number(ns["Lương cơ bản"]) || luongThoaThuan;
    let bhTruNLD = 0;
    let truyThuBaoHiem = 0;
    if (bhInfo) {
      const tyLeNLD = (Number(bhInfo["NLD.BHXH"]) || 0) + (Number(bhInfo["NLD.BHYT"]) || 0) + (Number(bhInfo["NLD.BHTN"]) || 0);
      // Chỉ trừ BH nếu đạt ngưỡng công đóng BH quy định trong DM_LUONG — nếu không có
      // ngưỡng khai báo, mặc định coi như đủ điều kiện để KHÔNG bỏ sót (an toàn hơn).
      const nguongBH = dmLuongInfo ? Number(dmLuongInfo["Ngưỡng truy thu BH (công)"]) : null;
      const duNguong = !nguongBH || congInfo.tongCong >= nguongBH;
      const congTyDong = Math.round(luongDongBH * ((Number(bhInfo["DN.BHXH"]) || 0) + (Number(bhInfo["DN.BHYT"]) || 0) + (Number(bhInfo["DN.BHTN"]) || 0) + (Number(bhInfo["DN.KPCD"]) || 0)));
      if (duNguong) {
        bhTruNLD = Math.round(luongDongBH * tyLeNLD);
      } else {
        // ⚠ PHÁT HIỆN MỚI, TRƯỚC ĐÂY CHƯA LẬP TRÌNH: nếu KHÔNG đủ ngưỡng công, công ty
        // TRUY THU LẠI toàn bộ phần đã đóng thay người lao động (= "Cộng BH công ty
        // đóng" đã tạm ứng đóng trước đó) — khoản này bị TRỪ VÀO THỰC LĨNH của người
        // lao động (xem references/cong_thuc_that_pure_powerquery.md Mục 5). Bản
        // trước đây khi thiếu ngưỡng chỉ đơn giản KHÔNG trừ gì cả (bỏ sót hoàn toàn
        // khoản truy thu này), khiến thực lĩnh bị tính CAO HƠN thực tế.
        truyThuBaoHiem = congTyDong;
      }
      ketQuaBHXH.push({
        "Mã NV": maNV, "Họ và tên": ns["Họ và tên"],
        "Phòng ban": tenPhongBan_(ns["Mã PB"], dmPhongBan),
        "Lương đóng BHXH": luongDongBH,
        "CTY.BHXH": Math.round(luongDongBH * (Number(bhInfo["DN.BHXH"]) || 0)),
        "CTY.BHYT": Math.round(luongDongBH * (Number(bhInfo["DN.BHYT"]) || 0)),
        "CTY.BHTN": Math.round(luongDongBH * (Number(bhInfo["DN.BHTN"]) || 0)),
        "CTY.KPCĐ": Math.round(luongDongBH * (Number(bhInfo["DN.KPCD"]) || 0)),
        "Cộng BH công ty đóng": congTyDong,
        "NLĐ.BHXH": Math.round(luongDongBH * (Number(bhInfo["NLD.BHXH"]) || 0)),
        "NLĐ.BHYT": Math.round(luongDongBH * (Number(bhInfo["NLD.BHYT"]) || 0)),
        "NLĐ.BHTN": Math.round(luongDongBH * (Number(bhInfo["NLD.BHTN"]) || 0)),
        "Cộng BH NLĐ đóng": bhTruNLD,
        "Truy thu bảo hiểm": truyThuBaoHiem,
        "Ghi chú ngưỡng công": duNguong ? "Đủ ngưỡng" : ("Chưa đủ ngưỡng (" + congInfo.tongCong + "/" + nguongBH + " công) — truy thu " + truyThuBaoHiem.toLocaleString("vi-VN") + "đ")
      });
    }

    // ----- Thuế TNCN -----
    // ⚠ PHÁT HIỆN MỚI: nhân viên có "Mã TNCN" riêng (từ dữ liệu thật HAK_DN) quyết
    // định CÁCH TÍNH THUẾ khác nhau — bản trước webapp CHỈ tính luỹ tiến cho MỌI
    // người, bỏ sót 2 trường hợp thật:
    //   - "TNCN1" = khấu trừ CỐ ĐỊNH 10% trên TỔNG THU NHẬP GỘP, KHÔNG trừ BHXH/
    //     giảm trừ gia cảnh trước khi tính (đúng luật thuế TNCN VN cho hợp đồng
    //     dưới 3 tháng/không có hợp đồng lao động, khấu trừ 10% tại nguồn).
    //   - "TNCN0" (hoặc để trống) = MIỄN THUẾ hoàn toàn.
    //   - Mã khác (vd "TNCN2") hoặc không khai báo = tính LUỸ TIẾN như cũ.
    const chiTietNS = chiTietNSMap[maNV] || {};
    const maTNCN = ns["Mã TNCN"] || "";
    const soNguoiPhuThuoc = Number(chiTietNS["Người phụ thuộc"]) || 0;
    const gtBanThan = dmGiamTru[chiTietNS["Mã GT_TNCN_BT"]];
    const gtNPT = dmGiamTru[chiTietNS["Mã GT_TNCN_PT"]];
    const soTienGiamTruBanThan = gtBanThan ? (Number(gtBanThan["Số tiền"]) || 0) : 0;
    const soTienGiamTruMoiNguoiPT = gtNPT ? (Number(gtNPT["Số tiền"]) || 0) : 0;
    const tongGiamTruNPT = soNguoiPhuThuoc * soTienGiamTruMoiNguoiPT;

    let thuNhapChiuThue = 0, thuNhapTinhThue = 0, thueTNCN = 0;
    if (maTNCN === "TNCN1") {
      thuNhapChiuThue = tongThuNhap;
      thuNhapTinhThue = tongThuNhap; // không trừ BHXH/giảm trừ — đúng quy định khấu trừ 10% tại nguồn
      thueTNCN = Math.round(tongThuNhap * 0.10);
    } else if (maTNCN === "TNCN0" || !maTNCN) {
      // Miễn thuế — để 0, KHÔNG tính luỹ tiến (bản trước mặc định luỹ tiến cho mọi
      // người kể cả khi chưa khai Mã TNCN, có thể tính dư thuế cho người thật ra
      // được miễn — đổi mặc định thành "miễn thuế nếu chưa rõ mã" cho AN TOÀN hơn,
      // nhưng CẦN xác nhận lại với kế toán nếu không đúng ý muốn).
      thuNhapChiuThue = tongThuNhap - bhTruNLD;
      thuNhapTinhThue = 0;
      thueTNCN = 0;
    } else {
      // ⚠ Công thức thật (TNCN2) trừ CẢ "Tiền cơm" khỏi thu nhập chịu thuế, không chỉ
      // BHXH — đã bổ sung (bản trước chỉ trừ BHXH).
      thuNhapChiuThue = tongThuNhap - bhTruNLD - tienCom;
      thuNhapTinhThue = Math.max(0, thuNhapChiuThue - soTienGiamTruBanThan - tongGiamTruNPT);
      thueTNCN = tinhThueTNCNLuyTien_(thuNhapTinhThue, bieuThue);
    }
    if (thueTNCN > 0) {
      ketQuaTNCN.push({
        "Mã NV": maNV, "Họ và tên": ns["Họ và tên"],
        "Thu nhập chịu thuế": thuNhapChiuThue,
        "Giảm trừ bản thân": maTNCN === "TNCN1" ? 0 : soTienGiamTruBanThan,
        "Số người phụ thuộc": soNguoiPhuThuoc,
        "Giảm trừ người phụ thuộc": maTNCN === "TNCN1" ? 0 : tongGiamTruNPT,
        "Thu nhập tính thuế": thuNhapTinhThue,
        "Thuế TNCN phải nộp": thueTNCN
      });
    }

    // ----- Thực lĩnh -----
    const truKhac = Number(ps["Trừ khác"]) || 0;
    const tamUng = Number(ung["Tạm ứng"]) || 0;
    // ⚠ PHÁT HIỆN MỚI: công thức thật làm tròn "Tiền lương còn nhận" về HÀNG NGHÌN
    // (Power Query: Number.Round(chênhLệch, -3)) — nếu âm thì để 0 (không âm lương).
    // Trước đây webapp không làm tròn, có thể lệch vài trăm đồng so với số thật.
    // Đã bổ sung trừ "Truy thu bảo hiểm" (xem phần BHXH ở trên) — trước đây bị bỏ sót.
    const chenhLech = tongThuNhap - bhTruNLD - truyThuBaoHiem - thueTNCN - truKhac - tamUng;
    const thucLinh = chenhLech >= 0 ? Math.round(chenhLech / 1000) * 1000 : 0;
    tongThucLinh += thucLinh;

    ketQuaBangLuong.push({
      "Mã NV": maNV, "Họ và tên": ns["Họ và tên"],
      "Phòng ban": tenPhongBan_(ns["Mã PB"], dmPhongBan),
      "Chức vụ": tenChucVu_(ns["Mã CV"], dmChucVu),
      "Lương thỏa thuận": luongThoaThuan, "Công chuẩn": congChuan,
      "Đơn giá lương TG": Math.round(donGiaLTG), "Công tính LTG": congTinhLTG,
      "Lương thời gian": luongThoiGian, "Lương phụ": luongPhu,
      "Sản lượng (tấn)": sanLuongTan, "Đơn giá SL": donGiaSL, "Lương sản lượng": luongSanLuong,
      "Lương bù SL (nếu dưới ngưỡng)": luongBuSL,
      "Phương pháp bù SL": laLuongSanLuong ? (buTheoNgay ? "Theo ngày" : "Theo tháng") : "",
      "Số xe bơm dăm": soXeBanDam, "Lương bơm dăm": luongBanDam,
      "Tổng công": congInfo.tongCong, "Công Chủ nhật": congInfo.congChuNhat,
      "Công tăng ca": congInfo.congTangCa, "Tiền tăng ca": tienTangCa,
      "Phụ cấp": tienPhuCap, "Phụ cấp công tác": tienPhuCapCongTac,
      "Lương hỗ trợ": luongHoTro, "Ngày cơm": ngayCom, "Tiền cơm": tienCom,
      "Thưởng": Number(ps["Thưởng"]) || 0, "Thu nhập khác": Number(ps["Thu nhập khác"]) || 0,
      "Tổng thu nhập (trước trừ)": tongThuNhap,
      "BHXH/BHYT/BHTN trừ NLĐ": bhTruNLD, "Truy thu bảo hiểm": truyThuBaoHiem, "Thuế TNCN": thueTNCN,
      "Trừ khác": truKhac, "Tạm ứng": tamUng,
      "Thực lĩnh": thucLinh
    });
  });

  ghiDeSheet_(SHEET_BANGLUONG, HEADER_BANGLUONG, ketQuaBangLuong);
  ghiDeSheet_(SHEET_BHXH, HEADER_BHXH, ketQuaBHXH);
  ghiDeSheet_(SHEET_TNCN, HEADER_TNCN, ketQuaTNCN);
  PropertiesService.getScriptProperties().setProperty("KY_GAN_NHAT", thang + "/" + namSo);

  return { soNguoi: ketQuaBangLuong.length, tongThucLinh: tongThucLinh };
}

/**
 * Công chuẩn — phân tích văn bản cột "Cách tính" trong DM_LUONG để suy ra công thức,
 * thay vì mặc định cứng 26 như bản trước (ĐÃ XÁC MINH SAI qua dữ liệu thật HAK_DN
 * T10/2025: công chuẩn thật = 27 cho hầu hết mã lương, KHÔNG PHẢI 26).
 *
 * ⚠ Độ tin cậy khác nhau theo từng mẫu câu, dựa trên đối chiếu với RP_THBL thật:
 * - "...tất cả ngày CN" / "...chủ nhật" → số ngày trong tháng trừ số Chủ nhật
 *   (ĐÃ XÁC MINH khớp chính xác: 31 ngày − 4 CN = 27, đúng dữ liệu thật T10/2025).
 * - "...- N" (có số trừ ở cuối câu, vd "- 4", "- 2") → lấy công thức CN ở trên rồi
 *   trừ thêm N (CHƯA CÓ dữ liệu thật để xác minh, chỉ suy luận từ cú pháp câu).
 * - "Thực tế ngày công" → công chuẩn LUÔN BẰNG công thực tế của người đó (tức lương
 *   thời gian sẽ luôn bằng đúng lương thỏa thuận, không phạt/thưởng theo công) —
 *   xử lý ở TinhLuong.gs bằng cách trả về congThucTe khi phát hiện mẫu này.
 * - Không khớp mẫu nào (vd "Cố định", ô trống) → mặc định dùng công thức "ngày
 *   tháng trừ Chủ nhật" (ĐÃ XÁC MINH đúng cho mã "CĐ" — công chuẩn thật của mã này
 *   cũng ra 27, giống hệt mã TG1, dù câu chữ "Cách tính" khác nhau).
 *
 * @param {number} congThucTe công thực tế đã chấm của người đó trong kỳ — dùng khi
 *   "Cách tính" là "Thực tế ngày công"
 * @return {number}
 */
function layCongChuan_(nhanSu, thang, nam, dmLuong, congThucTe) {
  const dmLuongInfo = dmLuong[nhanSu["Mã tiền lương 1"]];
  const cachTinh = dmLuongInfo ? String(dmLuongInfo["Cách tính"] || "") : "";
  const textThuong = cachTinh.toLowerCase();

  if (/thực tế/.test(textThuong)) {
    return (congThucTe && congThucTe > 0) ? congThucTe : 26;
  }

  const soNgayThang = new Date(nam, thang, 0).getDate();

  // Câu KHÔNG nhắc gì tới "chủ nhật"/"CN" và có ghi rõ "của tháng" mà không trừ gì
  // thêm (vd "Số ngày của tháng ") → công chuẩn = trọn số ngày trong tháng, kể cả CN.
  const coNoiVeCN = /ngày cn\b|chủ nhật/.test(textThuong);
  const chiGhiSoNgayThang = /^\s*số ngày của tháng\s*$/.test(textThuong);
  if (chiGhiSoNgayThang) return soNgayThang;

  let ketQua = soNgayThang;
  if (coNoiVeCN || !cachTinh || /cố định/.test(textThuong)) {
    // Mặc định (áp dụng cả khi "Cách tính" không khai rõ, vd mã "Cố định") — ĐÃ XÁC
    // MINH đúng qua dữ liệu thật: số ngày trong tháng trừ số Chủ nhật.
    let soCN = 0;
    for (let d = 1; d <= soNgayThang; d++) {
      if (new Date(nam, thang - 1, d).getDay() === 0) soCN++;
    }
    ketQua = soNgayThang - soCN;
  }

  const mTru = textThuong.match(/-\s*(\d+)\s*$/);
  if (mTru) ketQua -= parseInt(mTru[1], 10);

  return ketQua > 0 ? ketQua : 26;
}

function tenPhongBan_(maPB, dmPhongBan) {
  const r = dmPhongBan[maPB];
  return r ? r["Tên phòng ban"] : maPB;
}
function tenChucVu_(maCV, dmChucVu) {
  const r = dmChucVu[maCV];
  return r ? r["Tên chức vụ"] : maCV;
}

/**
 * Tổng hợp "Ngày cơm" (số suất cơm) theo Mã NV cho 1 tháng, từ sheet DL_TIENCOM.
 * ⚠ Đây là dữ liệu NHẬP TAY RIÊNG (kế toán tự đếm/nhập số suất ăn mỗi kỳ) — KHÔNG
 * PHẢI lúc nào cũng bằng tổng công chấm công của người đó (xem
 * references/cong_thuc_that_pure_powerquery.md Mục 3).
 */
function tongHopNgayComTheoNV_(nam, thang) {
  const list = docSheetThanhObject_(SHEET_TIENCOM, HEADER_TIENCOM);
  const map = {};
  list.forEach(r => {
    const ngay = r["Ngày"];
    if (!(ngay instanceof Date)) return;
    if (ngay.getFullYear() != nam || (ngay.getMonth() + 1) != thang) return;
    const maNV = r["Mã NV"];
    if (!maNV) return;
    map[maNV] = (map[maNV] || 0) + (Number(r["Số suất cơm"]) || 0);
  });
  return map;
}

/** Tổng hợp KL hàng (Tấn) theo Mã NV cho 1 tháng, từ sheet DL_SANLUONG/DL_BANDAM. */
function tongHopSanLuong_(tenSheet, nam, thang) {
  const list = docSheetThanhObject_(tenSheet, HEADER_SANLUONG);
  const map = {};
  list.forEach(r => {
    const ngay = r["Ngày cân"];
    if (!(ngay instanceof Date)) return;
    if (ngay.getFullYear() != nam || (ngay.getMonth() + 1) != thang) return;
    const maNV = r["Mã NV"];
    if (!maNV) return; // dòng chưa gán người — cần bổ sung trước khi tính, xem KiemTra.gs
    map[maNV] = (map[maNV] || 0) + (Number(r["KL hàng (Tấn)"]) || 0);
  });
  return map;
}

/**
 * Tổng hợp KL hàng (Tấn) theo Mã NV VÀ TỪNG NGÀY trong tháng — dùng cho phương
 * án "Bù sản lượng theo ngày" (xem tinhBangLuong()).
 * @return {Object} Map: MaNV -> { "01": tanNgay01, "02": tanNgay02, ... }
 */
function tongHopSanLuongTheoNgay_(tenSheet, nam, thang) {
  const list = docSheetThanhObject_(tenSheet, HEADER_SANLUONG);
  const map = {};
  list.forEach(r => {
    const ngay = r["Ngày cân"];
    if (!(ngay instanceof Date)) return;
    if (ngay.getFullYear() != nam || (ngay.getMonth() + 1) != thang) return;
    const maNV = r["Mã NV"];
    if (!maNV) return;
    const ten = ("0" + ngay.getDate()).slice(-2);
    if (!map[maNV]) map[maNV] = {};
    map[maNV][ten] = (map[maNV][ten] || 0) + (Number(r["KL hàng (Tấn)"]) || 0);
  });
  return map;
}

/** Tổng hợp các cột số theo Mã NV cho 1 tháng, từ sheet có cột ngày hạch toán. */
function tongHopTheoManv_(tenSheet, header, tenCotNgay, nam, thang, cacCotCanCong) {
  const list = docSheetThanhObject_(tenSheet, header);
  const map = {};
  list.forEach(r => {
    const ngay = r[tenCotNgay];
    if (!(ngay instanceof Date)) return;
    if (ngay.getFullYear() != nam || (ngay.getMonth() + 1) != thang) return;
    const maNV = r["Mã NV"] || r["Mã NV2"];
    if (!maNV) return;
    if (!map[maNV]) {
      map[maNV] = {};
      cacCotCanCong.forEach(c => { map[maNV][c] = 0; });
    }
    cacCotCanCong.forEach(c => { map[maNV][c] += Number(r[c]) || 0; });
  });
  return map;
}
