// Test TÍCH HỢP luồng "tải file lên qua bảng nháp" (Nhaplieu.gs) và kiểm tra
// dữ liệu ngoài kỳ (Kiemtra.gs) — chạy THẬT các hàm xemTruoc.../doiChieuLai.../
// xacNhanNap...TuNhap()/kiemTraDuLieuNgoaiKy_() với file .csv giả lập, xuyên
// suốt qua sheet nháp rồi nạp vào bảng chính. Chạy: node tests/test-nhap-lieu.js
'use strict';
const assert = require('assert');
const { napCodeGs, taoBoTest, ganStubGAS } = require('./_lib');

ganStubGAS();
const SHEETS = {}; // tenSheet -> mảng object hiện có (mô phỏng nội dung sheet thật)
global.SHEETS = SHEETS;

napCodeGs(
  ['Code.gs', 'Nhaplieu.gs', 'Kiemtra.gs'],
  `
  function docSheetThanhObject_(tenSheet, header) { return (SHEETS[tenSheet] || []).map(function (r) { return Object.assign({}, r); }); }
  function layHoacTaoSheet_() { throw new Error('layHoacTaoSheet_ khong duoc goi truc tiep trong test nay'); }
  function ghiDeSheet_(tenSheet, header, danhSach) { SHEETS[tenSheet] = danhSach.map(function (r) { return Object.assign({}, r); }); }
  function appendVaoSheet_(tenSheet, header, danhSach) { SHEETS[tenSheet] = (SHEETS[tenSheet] || []).concat(danhSach.map(function (r) { return Object.assign({}, r); })); }
  function moSheetChoBang_(tenSheet) {
    return {
      getSheetByName: function (ten) { return SHEETS[ten] !== undefined ? { _ten: ten } : null; },
      deleteSheet: function (sh) { delete SHEETS[sh._ten]; },
      getUrl: function () { return 'https://fake'; }
    };
  }
  `
);

const { test, tongKet } = taoBoTest('NHAP LIEU (CSV + kiem tra ngoai ky)');

SHEETS[SHEET_NHANSU] = [{ 'Mã nhân viên': 'NV001' }, { 'Mã nhân viên': 'NV002' }];

console.log('--- Luồng Ứng lương: tải CSV -> nháp -> xác nhận nạp ---');
{
  const csv = [
    'Ngày hạch toán,Số phiếu chi,Mã NV,Người nhận,Diễn giải,Tài khoản,TK đối ứng,Tạm ứng,Thanh toán TM',
    '01/06/2026,PC001,NV001,Nguyễn Văn A,Tạm ứng lương tháng 6,1111,334,2000000,2000000',
    '02/06/2026,PC002,NV999,Người lạ,Tạm ứng sai mã,1111,334,500000,500000'
  ].join('\n');
  const base64 = Buffer.from(csv, 'utf8').toString('base64');

  const r1 = xemTruocUngLuongTuFile(base64, 'mau_ung_luong.csv', 'text/csv');
  test('Buoc 1 (xem truoc): ok=true, doc dung 2 dong, phat hien 1 loi (NV999 sai)', () => {
    assert.strictEqual(r1.ok, true);
    assert.strictEqual(r1.soDong, 2);
    assert.strictEqual(r1.soLoi, 1);
  });

  const rBiChan = xacNhanNapUngLuongTuNhap('APPEND');
  test('Xac nhan khi CON LOI -> bi CHAN, khong nap ban vao NL_UNGLUONG', () => {
    assert.strictEqual(rBiChan.ok, false);
    assert.strictEqual((SHEETS[SHEET_UNGLUONG] || []).length, 0);
  });

  SHEETS[SHEET_NHAP_UNGLUONG][1]['Mã NV'] = 'NV002'; // sửa tay trong sheet nháp
  const r2 = doiChieuLaiNhapUngLuong();
  test('Doi chieu lai: het loi sau khi sua', () => assert.strictEqual(r2.soLoi, 0));

  const r3 = xacNhanNapUngLuongTuNhap('APPEND');
  test('Xac nhan nap: nap dung 2 dong, dung du lieu, xoa sach sheet nhap', () => {
    assert.strictEqual(r3.ok, true);
    assert.strictEqual(r3.soDong, 2);
    assert.strictEqual(SHEETS[SHEET_UNGLUONG].length, 2);
    assert.strictEqual(SHEETS[SHEET_UNGLUONG][0]['Mã NV'], 'NV001');
    assert.strictEqual(SHEETS[SHEET_UNGLUONG][0]['Tạm ứng'], '2000000');
    assert.strictEqual(SHEETS[SHEET_NHAP_UNGLUONG], undefined);
  });
}

console.log('--- Luồng Phát sinh lương: tải CSV -> nháp -> xác nhận nạp ---');
{
  const csv = [
    'Ngày hạch toán,Mã NV,Người nhận,Diễn giải,Tài khoản,TK đối ứng,Thưởng,Thu nhập khác,Trừ khác',
    '15/06/2026,NV002,Trần Thị B,Thưởng KPI tháng 6,334,6421,1000000,0,0'
  ].join('\n');
  const base64 = Buffer.from(csv, 'utf8').toString('base64');
  const r1 = xemTruocPSLuongTuFile(base64, 'ps.csv', 'text/csv');
  test('Xem truoc PSLuong: ok=true, 0 loi', () => { assert.strictEqual(r1.ok, true); assert.strictEqual(r1.soLoi, 0); });
  const r2 = xacNhanNapPSLuongTuNhap('GHIDE');
  test('Xac nhan nap PSLuong (GHIDE): nap dung 1 dong, Thuong=1000000', () => {
    assert.strictEqual(r2.ok, true);
    assert.strictEqual(SHEETS[SHEET_PSLUONG].length, 1);
    assert.strictEqual(SHEETS[SHEET_PSLUONG][0]['Thưởng'], '1000000');
  });
}

console.log('--- CSV cột ngày dd/MM/yyyy phải được nhận diện là Date thật (lỗi đã sửa ở chuanHoaNgayTrongBangCSV_) ---');
{
  const header = ['TT', 'Ngày tính công', 'Mã PB', 'Mã CV', 'Mã NV', 'Họ và tên', 'Hình thức công', '01', '02'];
  const row = ['1', '01/08/2026', 'PB01', 'CV01', 'NV001', 'Nguyễn Văn A', 'BT', '1', '1'];
  const csv = [header.join(','), row.join(',')].join('\n');
  const base64 = Buffer.from(csv, 'utf8').toString('base64');
  SHEETS[SHEET_DM_PHONGBAN] = [{ 'Mã phòng ban': 'PB01' }];
  const r = xemTruocChamCongTuFile(base64, 'cham_cong.csv', 'text/csv');
  test('CSV Cham cong: khong con loi "Ngay tinh cong khong hop le"', () => {
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.soLoi, 0);
  });
}

console.log('--- kiemTraDuLieuNgoaiKy_: phát hiện dữ liệu ngoài kỳ ---');
{
  SHEETS[SHEET_CHAMCONG] = [{ 'Mã NV': 'NV001', 'Ngày tính công': new Date(2026, 4, 15) }]; // thang 5, kiem tra cho thang 6
  const kq = kiemTraDuLieuNgoaiKy_('2026', 6);
  test('Phat hien dung 1 dong ngoai ky trong NL_CHAMCONG', () => {
    const muc = kq.chiTiet.find((m) => m.sheet === SHEET_CHAMCONG);
    assert.strictEqual(muc.soDong, 1);
  });
  test('Du lieu DUNG ky (15/06 khi kiem tra ky 6) khong bi tinh nham la ngoai ky', () => {
    const muc = kq.chiTiet.find((m) => m.sheet === SHEET_PSLUONG);
    assert.strictEqual(muc.soDong, 0);
  });
}

const kq = tongKet();
if (require.main === module) process.exit(kq.failed > 0 ? 1 : 0);
module.exports = kq;
