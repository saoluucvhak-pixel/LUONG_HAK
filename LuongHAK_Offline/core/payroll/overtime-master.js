// V10.2 — giữ tên module cũ cho Tăng ca; từ V10.3 toàn bộ logic nằm ở formula-master.js (dùng chung Tăng ca · Phụ cấp · Hỗ trợ).
(function (root) {
  "use strict";
  var isNode = typeof module !== "undefined" && module.exports;
  var FM = isNode ? require("./formula-master.js") : root.HAKCore.formulaMaster;
  var api = FM.forType("OVERTIME");
  if (isNode) module.exports = api; else { root.HAKCore = root.HAKCore || {}; root.HAKCore.overtimeMaster = api; }
})(typeof window !== "undefined" ? window : this);
