// ===== DYNAMIC PAYROLL FORMULA ENGINE — điểm vào chung (Master Prompt mục III) =====
// Gộp parser + validator + evaluator + registry + thư viện biến/hàm thành 1 API duy nhất, để nơi
// khác (engine.js khi migrate DM_TANGCA/PHUCAP/HOTRO, UI "Công thức tiền lương") chỉ cần require 1
// module này. Mỗi module con (formula-*.js) vẫn dùng được riêng lẻ nếu cần (VD UI Formula Builder
// chỉ cần formula-variables.js để liệt kê biến).
(function (root) {
  "use strict";
  var isNode = typeof module !== "undefined" && module.exports;
  var P = isNode ? require("./formula-parser.js") : root.HAKCore.formulaParser;
  var VALIDATOR = isNode ? require("./formula-validator.js") : root.HAKCore.formulaValidator;
  var EVAL = isNode ? require("./formula-evaluator.js") : root.HAKCore.formulaEvaluator;
  var REGISTRY = isNode ? require("./formula-registry.js") : root.HAKCore.formulaRegistry;
  var VARLIB = isNode ? require("./formula-variables.js") : root.HAKCore.formulaVariables;
  var DEF = isNode ? require("./formula-defaults.js") : root.HAKCore.formulaDefaults;
  var FN = isNode ? require("./formula-functions.js") : root.HAKCore.formulaFunctions;

  var api = {
    parse: P.parse,
    validate: VALIDATOR.validate,
    evaluate: EVAL.evaluate,
    resolve: REGISTRY.resolve,
    resolveEx: REGISTRY.resolveEx,
    versionsOf: REGISTRY.versionsOf,
    defaults: DEF,
    variables: VARLIB,
    functions: FN,
    FormulaError: P.FormulaError
  };
  if (isNode) module.exports = api;
  else { root.HAKCore = root.HAKCore || {}; root.HAKCore.formula = api; }
})(typeof window !== "undefined" ? window : this);
