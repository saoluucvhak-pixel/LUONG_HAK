# HAK Smart OCR AI - tai EXE thanh nhieu phan va ghep lai

1. Mo trang GitHub Actions cua workflow 'HAK Smart OCR AI - Split Windows Setup EXE'.
2. Tai artifact **HAK-OCR-00-GHEP-FILE** va **tat ca** cac artifact **HAK-OCR-Setup-Part-001**, **002**, ... theo so luong ghi trong manifest.json.
3. Giai nen RIENG artifact **HAK-OCR-00-GHEP-FILE.zip** vao thu muc moi.
4. Chep tat ca artifact ZIP Part (giua nguyen dinh dang ZIP; KHONG CAN giai nen) vao cung thu muc do.
5. Nhan dup **GHEP_FILE_EXE.cmd**. Chuong trinh kiem tra SHA-256 tung phan va EXE sau khi ghep; neu dung se tao HAKSmartOCRAI-Setup-1.2.0-alpha.exe.
6. Chi chay file EXE khi man hinh in 'SUCCESS' (khong duoc bo qua canh bao).

Moi Part ZIP doc lap nho hon 45 MiB, nham tranh loi tai mot ZIP qua lon.
Chung minh build ban dau: https://github.com/saoluucvhak-pixel/LUONG_HAK/actions/runs/38835954804
Du an phat trien: https://github.com/saoluucvhak-pixel/LUONG_HAK/tree/feature/hak-smart-ocr-ai-windows
Luu y: ban Alpha, OCR Tesseract co offline; khong bao gom models PaddleOCR/Docling/TrOCR.
