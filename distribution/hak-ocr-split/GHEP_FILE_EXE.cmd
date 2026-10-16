@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo       HAK SMART OCR AI - GHEP BO CAI EXE
echo ================================================
echo Chep TAT CA cac file HAK-OCR-Setup-Part-xxx.zip
echo vao cung thu muc voi file CMD nay, sau do chay lai.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0GHEP_SETUP.ps1" -InputDirectory "%~dp0" -ManifestPath "%~dp0manifest.json" -OutputDirectory "%~dp0"
if errorlevel 1 (
    echo.
    echo LOI! Khong duoc chay file neu kiem tra SHA256 that bai.
    pause
    exit /b 1
)
echo.
echo Da ghep thanh cong. Tim file HAKSmartOCRAI-Setup-*.exe.
pause
