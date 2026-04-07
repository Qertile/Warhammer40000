@echo off
chcp 65001
set PATH=%PATH%;C:\Program Files\nodejs\
cd /d "%~dp0epic-era"

echo ===================================================
echo [System] Starting Ebook Local Server...
echo ===================================================

if not exist node_modules (
    echo [System] First time launch detected, installing required packages...
    call npm.cmd install
)

echo [System] Cleaning up previous sessions...
call npx.cmd --yes kill-port 3000

echo [System] Building application for optimal performance and stability...
call npm.cmd run build

echo [Network] Starting local server on port 3000...
start "Warhammer40K Server" cmd /k "npm.cmd run start"

echo [System] Waiting for server to start up (5 seconds)...
timeout /t 5 /nobreak >nul

echo [Network] Generating Public Share URL via Cloudflare Tunnel...
echo Please copy the .trycloudflare.com URL from the output below to share with your friends!
start "Share Network" cmd /k "npx.cmd --yes cloudflared tunnel --url http://localhost:3000 --http-host-header localhost:3000"

start http://localhost:3000
pause