// Bộ icon nét mảnh (SVG, stroke = currentColor) thay cho emoji trên giao diện.
// Mã nguồn vẫn viết emoji đứng đầu nhãn ("🔒 Chốt kỳ lương"); iconize() đổi emoji đó
// thành icon khi hiển thị, nên không phải sửa từng nhãn và không ảnh hưởng dữ liệu/xuất Excel.
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HAKIcons = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M7 12h.01M17 12h.01"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.8-1.2"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z"/>',
    truck: '<path d="M3 17V7h11v10M14 10h4l3 3v4h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3 8 4.5 9.5 8 12 8zM12 8s1.5-5 4-3.5S14.5 8 12 8z"/>',
    card: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20M6 15h4"/>',
    bowl: '<path d="M3 12h18a9 9 0 0 1-18 0zM8 8c0-2 2-2 2-4M14 8c0-2 2-2 2-4"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    pie: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    db: '<path d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z"/><path d="M4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    down: '<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>',
    up: '<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    save: '<path d="M5 3h11l3 3v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alarm: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M19 3l3 3"/>',
    warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>',
    book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/>',
    swap: '<path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    leaf: '<path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15"/><path d="M5 19 13 11"/>',
    cake: '<path d="M4 21h16v-8H4zM4 16c2 1 4 1 6 0s4-1 6 0 4 1 4 0M12 13V9M12 6.5V6"/>',
    steth: '<path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v3a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="12" r="2"/>',
    heart: '<path d="M12 20s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.5-8 11-8 11z"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16a3 3 0 0 1 6 0M14 10h4M14 14h3"/>',
    cap: '<path d="M2 9 12 4l10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v5"/>',
    family: '<circle cx="8" cy="6" r="2.5"/><circle cx="16" cy="6" r="2.5"/><circle cx="12" cy="13" r="2"/><path d="M3 20a5 5 0 0 1 8-4M21 20a5 5 0 0 0-8-4M9 21a3 3 0 0 1 6 0"/>',
    bank: '<path d="M3 10 12 4l9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>',
    case: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
    shuffle: '<path d="M3 7h4l10 10h4M17 3l4 4-4 4M3 17h4l3-3M14 10l3-3h4"/>',
    files: '<path d="M8 3h8l4 4v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M4 7v13a1 1 0 0 0 1 1h10"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    thermo: '<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14 -1.5 7 5-3 5 3-1.5-7"/>',
    clip: '<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    left: '<path d="M19 12H5M11 6l-6 6 6 6"/>'
  };
  // Emoji/ký hiệu đứng đầu nhãn → icon
  var MAP = {
    "🏠": "home", "▶": "play", "🔒": "lock", "🔓": "unlock", "📈": "chart", "🗓": "calendar", "📅": "calendar", "⚖": "scale",
    "🚛": "truck", "🎁": "gift", "💵": "card", "🍚": "bowl", "👥": "users", "👤": "user", "📊": "pie", "📚": "grid", "⚙": "db",
    "⬇": "down", "⬆": "up", "📄": "file", "📑": "files", "💾": "save", "🔍": "search", "✎": "edit", "🕘": "clock", "⏰": "alarm",
    "⚠": "warn", "✔": "check", "✓": "check", "🖨": "printer", "📂": "folder", "🗂": "folder", "🗑": "trash", "🏢": "building",
    "📋": "clipboard", "📒": "book", "↔": "swap", "🧾": "receipt", "🌴": "leaf", "🏖": "sun", "🤒": "thermo", "🎂": "cake",
    "🩺": "steth", "❤": "heart", "📞": "phone", "🪪": "id", "🎓": "cap", "👪": "family", "🏦": "bank", "💼": "case", "🔀": "shuffle",
    "🏆": "award", "📎": "clip", "＋": "plus", "✕": "close", "←": "left"
  };
  var LEAD = /^\s*([←-⯿＋]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])️?\s*/;
  var NS = "http://www.w3.org/2000/svg";

  function svg(name) {
    var s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "icn"); s.setAttribute("aria-hidden", "true");
    s.innerHTML = P[name];
    return s;
  }
  /** Tách emoji đầu chuỗi: trả về { icon, rest } hoặc null nếu không có icon tương ứng. */
  function split(text) {
    var m = LEAD.exec(text || "");
    if (!m || !MAP[m[1]]) return null;
    return { icon: MAP[m[1]], rest: text.slice(m[0].length) };
  }
  var SEL = "button, h3, .ic, .warn, .warn b, .ok, .locked, .fh, .step b, .dlg header h3";
  /** Đổi emoji đầu nhãn trong `rootEl` thành icon SVG. Gọi lại an toàn (đã đổi thì bỏ qua). */
  function iconize(rootEl) {
    if (!rootEl || !rootEl.querySelectorAll) return;
    var list = rootEl.querySelectorAll(SEL);
    for (var i = 0; i < list.length; i++) {
      var t = list[i].firstChild;
      if (!t || t.nodeType !== 3) continue;
      var sp = split(t.nodeValue);
      if (!sp) continue;
      t.nodeValue = sp.rest;
      t.parentNode.insertBefore(svg(sp.icon), t);
    }
  }
  /** Tự đổi icon cho mọi phần tử được thêm vào sau này (màn hình, hộp thoại, bảng lọc lại…). */
  function watch(rootEl) {
    if (!rootEl || typeof MutationObserver === "undefined") return;
    iconize(rootEl);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType === 3) { var pe = n.parentNode; if (pe && pe.matches && pe.matches(SEL) && pe.parentNode) iconize(pe.parentNode); continue; }
          if (n.nodeType !== 1) continue;
          if (n.matches && n.matches(SEL)) iconize(n.parentNode); else iconize(n);
        }
      }
    }).observe(rootEl, { childList: true, subtree: true });
  }
  return { iconize: iconize, watch: watch, split: split, names: Object.keys(P), MAP: MAP };
});
