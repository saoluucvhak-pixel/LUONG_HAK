// ===== DYNAMIC PAYROLL FORMULA ENGINE — bộ tính giá trị (Master Prompt mục III.3) =====
// Walk AST (đã parse() + validate() trước khi lưu) và tính ra 1 số, dùng giá trị biến truyền vào
// qua "context". KHÔNG dùng eval()/new Function() — chỉ các node/hàm formula-parser.js,
// formula-functions.js dựng ra mới được thực thi. An toàn để chạy với công thức do người dùng nhập.
(function (root) {
  "use strict";
  var isNode = typeof module !== "undefined" && module.exports;
  var P = isNode ? require("./formula-parser.js") : root.HAKCore.formulaParser;
  var VARLIB = isNode ? require("./formula-variables.js") : root.HAKCore.formulaVariables;
  var FN = isNode ? require("./formula-functions.js") : root.HAKCore.formulaFunctions;
  var FormulaError = P.FormulaError;

  var DEFAULT_MAX_STEPS = 50000;
  function toBool(n) { return !!n && !isNaN(n); }
  function b(x) { return x ? 1 : 0; }

  /**
   * @param astOrSrc AST (từ formula-parser.parse) hoặc chuỗi công thức (sẽ parse() lại — nên parse
   *                 sẵn 1 lần rồi tái dùng AST nếu tính cho nhiều nhân viên cùng công thức, mục XII.3)
   * @param context  { TEN_BIEN: giá trị } — xem formula-variables.js cho danh sách biến hợp lệ
   * @param opts     { maxSteps }
   * @returns number
   * @throws FormulaError — DIV_ZERO | MISSING_VAR | UNKNOWN_VAR | UNKNOWN_FN | TOO_MANY_STEPS | SYNTAX | BAD_VALUE | NON_FINITE
   */
  // Bộ nhớ đệm AST theo NỘI DUNG biểu thức (ExpressionHash = chính chuỗi): sửa công thức → khóa mới → không bao giờ dùng AST cũ.
  // Chỉ lưu parse THÀNH CÔNG (lỗi cú pháp luôn được báo lại mỗi lần); AST không bị evaluator sửa. Giới hạn kích thước để không phình bộ nhớ.
  var CACHE = new Map(), CACHE_MAX = 2000, stats = { hit: 0, miss: 0 };
  function parseCached(src) {
    var a = CACHE.get(src);
    if (a) { stats.hit++; return a; }
    stats.miss++; a = P.parse(src);
    if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
    CACHE.set(src, a); return a;
  }
  function evaluate(astOrSrc, context, opts) {
    opts = opts || {}; context = context || {};
    var maxSteps = opts.maxSteps || DEFAULT_MAX_STEPS, steps = 0;
    var ast = typeof astOrSrc === "string" ? parseCached(astOrSrc) : astOrSrc;

    function readVar(name) {
      if (Object.prototype.hasOwnProperty.call(context, name) && context[name] != null) {
        var v = context[name] === "" ? 0 : +context[name];
        // Giá trị biến không phải số hữu hạn (NaN/Infinity) KHÔNG được âm thầm coi là 0 — sai dữ liệu đầu vào phải lộ ra (Master V5 mục V.3/V.4)
        if (!isFinite(v)) throw new FormulaError("BAD_VALUE", "Biến \"" + name + "\" có giá trị không phải số hợp lệ (" + String(context[name]) + ")");
        return v;
      }
      var def = VARLIB.get(name);
      if (!def) throw new FormulaError("UNKNOWN_VAR", "Biến \"" + name + "\" không tồn tại");
      if (def.missing === "error") throw new FormulaError("MISSING_VAR", "Biến \"" + name + "\" (" + def.label + ") chưa được cung cấp cho công thức này");
      return 0; // missing === "zero"
    }
    function ev(n) {
      if (++steps > maxSteps) throw new FormulaError("TOO_MANY_STEPS", "Công thức vượt quá " + maxSteps + " bước tính — kiểm tra lại độ phức tạp");
      switch (n.type) {
        case "num": return n.value;
        case "var": return readVar(n.name);
        case "unary":
          if (n.op === "-") return -ev(n.arg);
          if (n.op === "NOT") return b(!toBool(ev(n.arg)));
          throw new FormulaError("SYNTAX", "Toán tử một ngôi không hợp lệ: " + n.op);
        case "binary": return evBinary(n);
        case "call": return evCall(n);
        default: throw new FormulaError("SYNTAX", "Nút AST không hợp lệ: " + n.type);
      }
    }
    function evBinary(n) {
      // AND/OR: không lazy (không có hiệu ứng phụ nào để tiết kiệm bằng short-circuit), nhưng vẫn
      // tính cả 2 phía — đơn giản, dễ kiểm chứng hành vi.
      if (n.op === "AND") return b(toBool(ev(n.left)) && toBool(ev(n.right)));
      if (n.op === "OR") return b(toBool(ev(n.left)) || toBool(ev(n.right)));
      var l = ev(n.left), r = ev(n.right);
      switch (n.op) {
        case "+": return l + r;
        case "-": return l - r;
        case "*": return l * r;
        case "/": if (r === 0) throw new FormulaError("DIV_ZERO", "Chia cho 0 (" + l + " / " + r + ")"); return l / r;
        case ">": return b(l > r);
        case "<": return b(l < r);
        case ">=": return b(l >= r);
        case "<=": return b(l <= r);
        case "=": return b(l === r);
        case "!=": return b(l !== r);
        default: throw new FormulaError("SYNTAX", "Toán tử không hợp lệ: " + n.op);
      }
    }
    function evCall(n) {
      if (n.name === "IF") {
        if (n.args.length !== 3) throw new FormulaError("ARITY", "IF() cần đúng 3 đối số");
        return toBool(ev(n.args[0])) ? ev(n.args[1]) : ev(n.args[2]); // lazy: chỉ tính nhánh được chọn
      }
      if (!FN.isKnown(n.name)) throw new FormulaError("UNKNOWN_FN", "Hàm \"" + n.name + "\" không tồn tại");
      var args = n.args.map(ev);
      try { return FN.call(n.name, args); }
      catch (e) { throw new FormulaError("FN_ERROR", e.message || String(e)); }
    }
    var result = ev(ast);
    if (!isFinite(result)) throw new FormulaError("NON_FINITE", "Kết quả công thức không phải số hữu hạn — kiểm tra lại biểu thức");
    return result;
  }

  var api = { evaluate: evaluate, DEFAULT_MAX_STEPS: DEFAULT_MAX_STEPS, cacheStats: function () { return { hit: stats.hit, miss: stats.miss, size: CACHE.size }; }, clearCache: function () { CACHE.clear(); stats.hit = 0; stats.miss = 0; } };
  if (isNode) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.formulaEvaluator = api; }
})(typeof window !== "undefined" ? window : this);
