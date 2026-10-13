// Xuất PDF từ HTML do app dựng (core/reporting/report-html.js) bằng printToPDF của Electron.
// Cửa sổ ẩn bị khóa: không script, không Node, không điều hướng, không tải tài nguyên ngoài — HTML chỉ là dữ liệu để in.
"use strict";
const MAX_HTML = 20 * 1024 * 1024;

/** Số trang ước lượng từ nội dung PDF (đếm đối tượng /Type /Page, không tính /Pages). */
function countPages(buf) { const m = buf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g); return m ? m.length : 0; }

function validate(payload) {
  if (!payload || typeof payload !== "object") return "Thiếu dữ liệu in";
  if (typeof payload.html !== "string" || !payload.html.trim()) return "Không có nội dung để in";
  if (payload.html.length > MAX_HTML) return "Nội dung quá lớn để xuất PDF";
  if (/<script/i.test(payload.html)) return "Nội dung in không được chứa script";
  return "";
}

/** @param electron { BrowserWindow }  @param payload { html, landscape, footer } @returns Promise<Buffer> */
async function renderPdf(electron, payload) {
  const err = validate(payload); if (err) throw new Error(err);
  const win = new electron.BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
  try {
    win.webContents.on("will-navigate", (e) => e.preventDefault());
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.session.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !/^data:/i.test(d.url) }));
    await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(payload.html));
    const footer = String(payload.footer || "").replace(/[<>&]/g, "");
    return await win.webContents.printToPDF({
      pageSize: "A4", landscape: payload.landscape !== false, printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: "<div style=\"font-size:7px;width:100%;padding:0 10mm;display:flex;justify-content:space-between\"><span>" + footer + "</span><span>Trang <span class=\"pageNumber\"></span>/<span class=\"totalPages\"></span></span></div>"
    });
  } finally { if (!win.isDestroyed()) win.destroy(); }
}

module.exports = { renderPdf, validate, countPages, MAX_HTML };
