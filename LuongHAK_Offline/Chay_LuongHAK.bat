@echo off
chcp 65001 >nul
rem Mo app tinh luong HAK (offline) bang Microsoft Edge/Chrome o che do cua so rieng
set "APP=%~dp0index.html"
set "URL=file:///%APP:\=/%"
set "URL=%URL: =%20%"
where msedge >nul 2>nul && (start "" msedge --app="%URL%" & exit /b)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%URL%" & exit /b)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%URL%" & exit /b)
start "" "%APP%"
