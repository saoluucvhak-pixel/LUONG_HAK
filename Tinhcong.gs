// ================= XỬ LÝ CHẤM CÔNG (NL_CHAMCONG) =================
// Bảng chấm công lưu dạng ma trận: 1 dòng / nhân viên / hình thức công / tháng,
// các cột "01".."31" là số công của từng ngày trong tháng (0 / 0.5 / 1 / 1.5 / 2 / 3...).
//
// "Hình thức công" — ĐÃ XÁC NHẬN với người dùng đúng 5 mã dùng thật (HAK_DN):
//   BT = Công bình thường (công chính)     CL = Công lễ
//   PN = Phép năm                          CC = Công tính cơm
//   TC = Công tăng ca (TC/TC1..TC6)
// (Mã "DC"/"TRCH" trong DM_CC gốc — Công di chuyển/Công trung chuyển — KHÔNG nằm
// trong 5 mã đã xác nhận; webapp vẫn giữ chỗ tính (mặc định 0 nếu không có dòng
// tương ứng) để không vỡ công thức tăng ca TC1/TC2 nếu đơn vị khác có dùng).

/**
 * Tách số công ra khỏi giá trị 1 ô chấm công — ô có thể là số thuần (1, 0.5) hoặc
 * số kèm NHÃN chữ ở cuối (vd "1QC" = 1 công, đi công tác QC; "0.5CL" = 0.5 công
 * ngày lễ...). ⚠ PHÁT HIỆN QUA DỮ LIỆU THẬT: dùng thẳng Number(giaTri) sẽ trả về
 * NaN cho các ô có nhãn chữ, làm MẤT TOÀN BỘ số công của ngày đó khi cộng dồn
 * (NaN || 0 = 0) — đã xác nhận qua dữ liệu thật HAK_DN T10/2025, 1 nhân viên bị
 * mất đúng 7 công (7 ngày ghi "1QC") nếu dùng Number() thẳng.
 * @return {{ soCong: number, nhan: string }} soCong = phần số ở đầu ô (0 nếu ô
 *   rỗng/không đọc được số), nhan = phần chữ phía sau (rỗng nếu không có)
 */
function tachSoCongVaNhan_(giaTri) {
  if (giaTri === "" || giaTri === null || giaTri === undefined) return { soCong: 0, nhan: "" };
  if (typeof giaTri === "number") return { soCong: giaTri, nhan: "" };
  const chuoi = String(giaTri).trim();
  const m = chuoi.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return { soCong: 0, nhan: chuoi }; // ô toàn chữ, không có số ở đầu
  return { soCong: parseFloat(m[1].replace(",", ".")) || 0, nhan: m[2].trim() };
}

/**
 * Tổng hợp chấm công theo Mã NV cho 1 tháng, trả về Map:
 *   MaNV -> { tongCong, congChuNhat, congTangCa, congLe, congPhep, congCom,
 *             congDiChuyen, congTrungChuyen, congTheoHinhThuc: {BT: x, ...},
 *             nhanTheoNgay: { "01": "QC", ... } }
 * @param {string} nam
 * @param {number} thang (1-12)
 */
function tongHopChamCong_(nam, thang, danhSachChoSan) {
  const header = headerChamCongDayDu_();
  const list = danhSachChoSan || docSheetThanhObject_(SHEET_CHAMCONG, header);
  const ketQua = {};

  const rong_ = function () {
    return {
      tongCong: 0, congChuNhat: 0, congTangCa: 0,
      congLe: 0, congPhep: 0, congCom: 0, congDiChuyen: 0, congTrungChuyen: 0,
      congTheoHinhThuc: {}, nhanTheoNgay: {}
    };
  };

  list.forEach(row => {
    const maNV = row["Mã NV"];
    if (!maNV) return;
    const ngayTinhCong = row["Ngày tính công"];
    if (!(ngayTinhCong instanceof Date)) return;
    if (ngayTinhCong.getFullYear() != nam || (ngayTinhCong.getMonth() + 1) != thang) return;

    if (!ketQua[maNV]) ketQua[maNV] = rong_();
    const hinhThuc = String(row["Hình thức công"] || "BT").trim().toUpperCase();
    // "CC" (Công tính cơm) KHÔNG tính vào tổng công đi làm (không phải công thực
    // tế), chỉ dùng để suy ra "Ngày cơm" — xem TinhLuong.gs (kết hợp thêm dữ liệu
    // từ DL_TIENCOM nếu có).
    const laCong = hinhThuc !== "CC";
    const laTangCa = /TC/i.test(hinhThuc);
    let tongDongNay = 0;

    for (let ngay = 1; ngay <= 31; ngay++) {
      const ten = ("0" + ngay).slice(-2);
      const { soCong, nhan } = tachSoCongVaNhan_(row[ten]);
      if (soCong === 0 && !nhan) continue;
      tongDongNay += soCong;
      if (nhan) ketQua[maNV].nhanTheoNgay[ten] = nhan; // lưu lại nhãn (vd "QC") để tham khảo/audit sau

      // Công Chủ nhật: chỉ tính từ dòng công CHÍNH (không phải dòng tăng ca/cơm riêng),
      // tránh đếm trùng nếu 1 người có nhiều dòng hình thức trong cùng ngày Chủ nhật.
      if (!laTangCa && laCong) {
        const ngayThuc = new Date(nam, thang - 1, ngay);
        if (ngayThuc.getMonth() === thang - 1 && ngayThuc.getDay() === 0) {
          ketQua[maNV].congChuNhat += soCong;
        }
      }
    }

    if (laCong) ketQua[maNV].tongCong += tongDongNay;
    if (laTangCa) ketQua[maNV].congTangCa += tongDongNay;
    if (hinhThuc === "CL") ketQua[maNV].congLe += tongDongNay;
    if (hinhThuc === "PN") ketQua[maNV].congPhep += tongDongNay;
    if (hinhThuc === "CC") ketQua[maNV].congCom += tongDongNay;
    if (hinhThuc === "DC") ketQua[maNV].congDiChuyen += tongDongNay;
    if (hinhThuc === "TRCH") ketQua[maNV].congTrungChuyen += tongDongNay;
    ketQua[maNV].congTheoHinhThuc[hinhThuc] = (ketQua[maNV].congTheoHinhThuc[hinhThuc] || 0) + tongDongNay;
  });

  return ketQua;
}

/**
 * Tổng hợp CÔNG CHÍNH (không gồm dòng tăng ca) theo TỪNG NGÀY trong tháng —
 * dùng cho phương án "Bù sản lượng theo ngày" (xem TinhLuong.gs), tái tạo đúng
 * cách QR_BCCSL/RP_CTBUSL của Đại Hiệp đối chiếu sản lượng/công CỦA TỪNG NGÀY
 * (xem references/kien_truc_powerquery_powerpivot.md Mục 3.1).
 * @return {Object} Map: MaNV -> { "01": congNgay01, "02": congNgay02, ... }
 */
function layCongChinhTheoNgay_(nam, thang) {
  const header = headerChamCongDayDu_();
  const list = docSheetThanhObject_(SHEET_CHAMCONG, header);
  const ketQua = {};

  list.forEach(row => {
    const maNV = row["Mã NV"];
    if (!maNV) return;
    const ngayTinhCong = row["Ngày tính công"];
    if (!(ngayTinhCong instanceof Date)) return;
    if (ngayTinhCong.getFullYear() != nam || (ngayTinhCong.getMonth() + 1) != thang) return;

    const hinhThuc = String(row["Hình thức công"] || "BT").trim();
    if (/TC/i.test(hinhThuc)) return; // chỉ lấy công chính, bỏ dòng tăng ca riêng

    if (!ketQua[maNV]) ketQua[maNV] = {};
    for (let ngay = 1; ngay <= 31; ngay++) {
      const ten = ("0" + ngay).slice(-2);
      const { soCong } = tachSoCongVaNhan_(row[ten]);
      if (soCong === 0) continue;
      ketQua[maNV][ten] = (ketQua[maNV][ten] || 0) + soCong;
    }
  });

  return ketQua;
}

/**
 * Tính "Công tính tăng ca" theo mã (TC1/TC2/TC3/TC4/TC6) — tái tạo ĐÚNG NGUYÊN VĂN
 * công thức Power Query thật đọc được từ `Bang_luong_DN_09_2025` (xem
 * references/cong_thuc_that_pure_powerquery.md Mục 2) — bản trước chỉ suy đoán 1
 * phần công thức (thiếu "Ngày phép", "Công di chuyển", "Công trung chuyển"), đã
 * bổ sung đầy đủ.
 *
 * ⚠ Mã "TC5" KHÔNG dùng hàm này — TC5 có công thức hoàn toàn khác (lương làm ca
 * khác, dùng "Tiền tăng ca" cố định chia công chuẩn) — xử lý riêng ở TinhLuong.gs.
 *
 * @param {string} ma Mã tăng ca (TC1, TC2, TC3, TC4, TC6, hoặc mã khác tự đặt)
 * @param {number} congTinhLuong Tổng công dùng để tính lương trong kỳ ("Công tính lương")
 * @param {number} congTrungChuyen Công trung chuyển hàng trong kỳ
 * @param {number} congLe Công ngày lễ trong kỳ
 * @param {number} congChuan Công chuẩn của kỳ
 * @param {number} congChuNhat Công làm vào Chủ nhật
 * @param {number} congTangCa Công tăng ca ngoài giờ (dòng hình thức chứa "TC")
 * @param {number} heSo Hệ số tăng ca (vd 1.5 = 150%)
 * @param {number} congPhep Công/ngày phép trong kỳ
 * @param {number} congDiChuyen Công di chuyển trong kỳ (chỉ dùng cho mã TC2)
 * @return {number} "Công tính tăng ca" — đã gồm hệ số, nhân thẳng với đơn giá/công
 *   ở TinhLuong.gs (KHÔNG nhân hệ số thêm lần nữa)
 */
function tinhHeSoTangCa_(ma, congTinhLuong, congTrungChuyen, congLe, congChuan, congChuNhat, congTangCa, heSo, congPhep, congDiChuyen) {
  const cCTL = congTinhLuong || 0;
  const cTrungChuyen = congTrungChuyen || 0;
  const cLe = congLe || 0;
  const cChuan = congChuan || 0;
  const cCN = congChuNhat || 0;
  const cTang = congTangCa || 0;
  const cHeSo = heSo || 0;
  const cPhep = congPhep || 0;
  const cDiChuyen = congDiChuyen || 0;

  switch (ma) {
    case "TC1": {
      const du = cCTL - cLe - cTrungChuyen - cPhep - cTang - cChuan;
      return (du > 0 ? du * cHeSo : 0) + (cTang * cHeSo);
    }
    case "TC2": {
      const du = cCTL - cLe - cTrungChuyen - cPhep - cTang - cDiChuyen - cChuan;
      return (du > 0 ? du * cHeSo : 0) + (cTang * cHeSo);
    }
    case "TC6": {
      const du = cCTL - cTrungChuyen - cLe - cChuan;
      return du > 0 ? du : 0; // không nhân hệ số
    }
    case "TC3":
      return (cTang + cCN) * cHeSo;
    case "TC4":
      return cTang * cHeSo;
    default:
      return cTang * cHeSo;
  }
}
