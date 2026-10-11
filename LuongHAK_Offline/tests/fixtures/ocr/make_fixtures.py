# Sinh ảnh / PDF MẪU GIẢ LẬP cho kiểm thử OCR chấm công (tên giả, số liệu giả — không dùng dữ liệu thật).
# Chạy: python3 tests/fixtures/ocr/make_fixtures.py   (cần Pillow + font DejaVu)
import os, random
from PIL import Image, ImageDraw, ImageFont
OUT = os.path.dirname(os.path.abspath(__file__))
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
f = ImageFont.truetype(FONT, 22); fb = ImageFont.truetype(BOLD, 30); fs = ImageFont.truetype(FONT, 20)

# 1) Bảng chấm công in: người × ngày (tháng 09/2026, 30 ngày), cột Tổng công
PEOPLE = [("E2E Nhân Viên", [1] * 26 + [0.5, 1, 1, 0]), ("Phạm Minh Khoa", [1, 1, 0] * 10), ("Đỗ Thu Hằng", [1] * 15 + [0] * 15)]
def table_img():
    days = 30; x0, y0 = 40, 160; nameW, dayW, totW, rowH = 300, 46, 110, 60
    W = x0 * 2 + nameW + days * dayW + totW; H = y0 + rowH * (len(PEOPLE) + 1) + 120
    im = Image.new("L", (W, H), 255); d = ImageDraw.Draw(im)
    d.text((W // 2 - 300, 40), "BẢNG CHẤM CÔNG THÁNG 09/2026", font=fb, fill=0)
    cols = [x0, x0 + nameW] + [x0 + nameW + dayW * (i + 1) for i in range(days)] + [x0 + nameW + days * dayW + totW]
    rows = [y0 + rowH * i for i in range(len(PEOPLE) + 2)]
    for x in cols: d.line([(x, rows[0]), (x, rows[-1])], fill=0, width=2)
    for y in rows: d.line([(cols[0], y), (cols[-1], y)], fill=0, width=2)
    def put(c, r, t, font=f):
        bx = d.textbbox((0, 0), t, font=font); tw, th = bx[2] - bx[0], bx[3] - bx[1]
        d.text(((cols[c] + cols[c + 1] - tw) / 2, (rows[r] + rows[r + 1] - th) / 2 - bx[1]), t, font=font, fill=0)
    put(0, 0, "Họ và tên")
    for i in range(days): put(i + 1, 0, str(i + 1), fs)
    put(days + 1, 0, "Tổng công", fs)
    for r, (name, vals) in enumerate(PEOPLE):
        d.text((cols[0] + 10, rows[r + 1] + 16), name, font=f, fill=0)
        for i, v in enumerate(vals):
            if v: put(i + 1, r + 1, "0.5" if v == 0.5 else "1", fs)
        put(days + 1, r + 1, ("%g" % sum(vals)), fs)
    return im

# 2) Lịch làm dọc (ngày theo hàng), cột Công / Cơm viết tay mô phỏng bằng nét "1" đứng
def vertical_img():
    random.seed(7); days = 30; x0, y0 = 60, 150; cw = [130, 150, 150]; rowH = 44
    W = x0 * 2 + sum(cw); H = y0 + rowH * (days + 2) + 60
    im = Image.new("L", (W, H), 255); d = ImageDraw.Draw(im)
    d.text((x0, 30), "Lịch làm Võ Văn Tâm", font=fb, fill=0); d.text((x0, 80), "Tháng 09/2026", font=f, fill=0)
    xs = [x0, x0 + cw[0], x0 + cw[0] + cw[1], x0 + sum(cw)]; ys = [y0 + rowH * i for i in range(days + 3)]
    for x in xs: d.line([(x, ys[0]), (x, ys[-1])], fill=0, width=2)
    for y in ys: d.line([(xs[0], y), (xs[-1], y)], fill=0, width=2)
    def put(c, r, t):
        bx = d.textbbox((0, 0), t, font=f); d.text(((xs[c] + xs[c + 1] - (bx[2] - bx[0])) / 2, (ys[r] + ys[r + 1] - (bx[3] - bx[1])) / 2 - bx[1]), t, font=f, fill=0)
    put(0, 0, "Ngày"); put(1, 0, "Công"); put(2, 0, "Cơm")
    com = [1] * days; com[9] = 0; com[20] = 0
    for i in range(days):
        put(0, i + 1, str(i + 1))
        for c, on in ((1, 1), (2, com[i])):
            if on:
                cx = (xs[c] + xs[c + 1]) / 2 + random.randint(-6, 6); top = ys[i + 1] + 8; bot = ys[i + 2] - 8
                d.line([(cx + random.randint(-3, 3), top), (cx, bot)], fill=0, width=4)
    put(0, days + 1, "TC"); put(1, days + 1, str(days)); put(2, days + 1, str(sum(com)))
    return im

a = table_img(); a.save(os.path.join(OUT, "bang-cham-cong-mau.png"), optimize=True)
b = vertical_img(); b.save(os.path.join(OUT, "lich-lam-doc-mau.png"), optimize=True)
a.convert("RGB").save(os.path.join(OUT, "bang-cham-cong-mau.pdf"), "PDF", resolution=150)
# bang-cham-cong-mau-pdfjs.png = trang PDF trên do app vẽ bằng pdf.js (lấy từ canvas trong app, chuyển xám) — dùng cho I-OCR-04
print("ok", a.size, b.size)
