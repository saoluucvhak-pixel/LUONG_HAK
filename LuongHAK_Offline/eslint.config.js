// Lint tối thiểu, tập trung bắt lỗi thật (biến chưa khai báo, khóa trùng, mã không chạy tới...)
const browserGlobals = { window: "readonly", document: "readonly", localStorage: "readonly", console: "readonly", setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", crypto: "readonly", TextEncoder: "readonly", self: "readonly", MutationObserver: "readonly", alert: "readonly", confirm: "readonly", FileReader: "readonly", Blob: "readonly", URL: "readonly", XLSX: "readonly", HRM: "readonly", module: "readonly", require: "readonly" };
const nodeGlobals = { require: "readonly", module: "writable", process: "readonly", __dirname: "readonly", console: "readonly", setTimeout: "readonly" };
const rules = { "no-undef": "error", "no-dupe-keys": "error", "no-unreachable": "error", "no-redeclare": "error", "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }], "no-self-assign": "error", "no-dupe-else-if": "error", "no-cond-assign": ["error", "except-parens"] };
module.exports = [
  { ignores: ["xlsx.full.min.js", "dist/**", "node_modules/**", "tests/regression/baseline_v1.3.0/**", "tests/regression/baseline_2.0.0-alpha.4/**"] },
  { files: ["app.js", "engine.js", "hr.js", "core/**/*.js", "ui/**/*.js"], languageOptions: { ecmaVersion: 2018, sourceType: "script", globals: browserGlobals }, rules },
  { files: ["main.js", "preload.js", "main/**/*.js", "tests/**/*.js", "eslint.config.js"], languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: nodeGlobals }, rules },
  // các hàm truyền vào page.evaluate chạy trong cửa sổ app
  { files: ["tests/e2e/**/*.js"], languageOptions: { globals: Object.assign({}, nodeGlobals, { window: "readonly", localStorage: "readonly" }) } }
];
