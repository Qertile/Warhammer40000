@echo off
chcp 65001
set PATH=%PATH%;C:\Program Files\nodejs\
cd /d "D:\Warhammer40000\epic-era"

echo ===================================================
echo [System] Starting Ebook Local Server...
echo ===================================================
start http://localhost:3000

echo [Network] Generating Public Share URL via LocalTunnel...
echo Please copy the green URL to share with your friends!
echo Note: If your friends see a warning page, they just need to click 'Click to Continue'
start "Share Network" cmd /k "npx.cmd localtunnel --port 3000"

call npm.cmd run dev
pause