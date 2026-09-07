// Thư viện dùng chung cho các file test trong thư mục này. Vì đây là dự án
// Google Apps Script (không chạy được trực tiếp bằng Node/npm), các test nạp
// NGUYÊN VĂN nội dung từng file .gs, stub các API của Google Apps Script
// (SpreadsheetApp/Utilities/Session/PropertiesService/Drive) bằng bản giả lập
// trong bộ nhớ, rồi nạp vào SCOPE TOÀN CỤC của chính process Node đang chạy —
// không dùng module "vm" (context riêng) vì "vm" tạo ra 1 "realm" JS khác,
// khiến Date/Object của sandbox khác với Date/Object của bài test dù cùng giá
// trị (mọi "instanceof Date"/assert.deepStrictEqual xuyên realm đều sai) — đã
// từng gặp lỗi này khi thử dùng vm.createContext(), nay đổi cách nạp code để
// tránh hẳn lớp lỗi này.
// ⚠ HỆ QUẢ: mỗi file test PHẢI chạy trong 1 PROCESS NODE RIÊNG (không require
// nhiều file test cùng lúc vào 1 process) — xem run-all.js (spawn subprocess).
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function docFileGs(...tenFile) {
  return tenFile.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
}

/**
 * Nạp code từ các file .gs cho trước + code stub bổ sung vào SCOPE TOÀN CỤC
 * (global) của process Node hiện tại, dùng indirect eval (`(0, eval)(...)`)
 * — theo đúng ngữ nghĩa JS, indirect eval luôn chạy ở global scope, nên mọi
 * `var`/`function` khai báo trong code .gs sẽ trở thành thuộc tính của
 * `global`, gọi thẳng được như identifier thường (vd `tinhBangLuong(...)`)
 * ngay sau khi hàm này chạy xong.
 * ⚠ `const`/`let` KHÔNG "leak" ra global dù bằng cách này — đổi hết thành
 * `var` trước khi nạp (an toàn vì các hằng số HEADER_.../SHEET_... trong code
 * .gs không bao giờ bị gán lại).
 */
function napCodeGs(tenFileList, stubBoSung) {
  let code = docFileGs(...tenFileList);
  if (stubBoSung) code += '\n' + stubBoSung;
  code = code.replace(/^const /gm, 'var ').replace(/^let /gm, 'var ');
  // eslint-disable-next-line no-eval
  (0, eval)(code);
}

/** Bộ đếm pass/fail dùng chung, in kết quả từng test ngay khi chạy. */
function taoBoTest(tenNhom) {
  let passed = 0, failed = 0;
  const loiChiTiet = [];
  function test(ten, fn) {
    try { fn(); console.log('  OK   ' + ten); passed++; }
    catch (e) { console.log('  FAIL ' + ten + ' -> ' + e.message); failed++; loiChiTiet.push(ten + ': ' + e.message); }
  }
  function tongKet() {
    console.log('=== ' + tenNhom + ': ' + passed + ' passed, ' + failed + ' failed ===\n');
    if (failed > 0) process.exitCode = 1;
    return { passed, failed, loiChiTiet };
  }
  return { test, tongKet };
}

/** Gắn bộ Google Apps Script API giả lập tối thiểu vào `global`, đủ dùng cho các hàm thuần tính lương/kiểm tra. */
function ganStubGAS() {
  const PROPS = {};
  global.PropertiesService = {
    getScriptProperties: () => ({
      setProperty: (k, v) => { PROPS[k] = v; },
      getProperty: (k) => PROPS[k],
      deleteProperty: (k) => { delete PROPS[k]; }
    })
  };
  global.Session = { getScriptTimeZone: () => 'Asia/Ho_Chi_Minh' };
  global.Utilities = {
    formatDate: (d) => d.toISOString().slice(0, 10),
    base64Decode: (s) => Buffer.from(s, 'base64'),
    parseCsv: (s) => s.trim().split('\n').map((line) => line.split(',')),
    newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') })
  };
  return PROPS;
}

module.exports = { ROOT, docFileGs, napCodeGs, taoBoTest, ganStubGAS };
