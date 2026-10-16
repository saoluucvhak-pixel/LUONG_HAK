@echo off
setlocal EnableExtensions
set "OCR_DIR=%~dp0"
cd /d "%OCR_DIR%" || (echo KHONG THE MO THU MUC SCRIPT & pause & exit /b 1)
echo =====================================================
echo HAK SMART OCR AI - GHEP BO CAI WINDOWS (BAN SUA LOI)
echo =====================================================
echo.
if not exist "%OCR_DIR%GHEP_SETUP.ps1" (
  echo LOI: Thieu GHEP_SETUP.ps1.
  pause
  exit /b 1
)
if not exist "%OCR_DIR%manifest.json" (
  echo LOI: Thieu manifest.json.
  pause
  exit /b 1
)
echo Tai day du HAK-OCR-Setup-Part-001.zip den Part-004.zip
echo va de cung thu muc voi file CMD nay.
echo.
rem KHONG truyen thu muc ket thuc bang dau backslash voi dau ngoac kep
rem vao powershell -File: truoc day gay Illegal characters in path.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%OCR_DIR%GHEP_SETUP.ps1"
set "OCR_EXIT=%ERRORLEVEL%"
if not "%OCR_EXIT%"=="0" (
  echo.
  echo LOI GHEP EXE - MA LOI %OCR_EXIT%.
  echo Khong mo file EXE neu chua kiem tra SHA256 thanh cong.
  pause
  exit /b %OCR_EXIT%
)
echo.
echo THANH CONG. Da ghep va kiem tra SHA256.
echo File HAKSmartOCRAI-Setup-1.2.0-alpha.exe o thu muc nay.
pause
