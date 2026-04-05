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

echo [Network] Generating Public Share URL via Cloudflare Tunnel...
echo Please copy the .trycloudflare.com URL from the output below to share with your friends!
start "Share Network" cmd /k "npx.cmd --yes cloudflared tunnel --url http://localhost:3000 --http-host-header localhost:3000"

echo [System] Cleaning up previous sessions...
call npx.cmd --yes kill-port 3000

echo [System] Building application for optimal performance and stability...
call npm.cmd run build

start http://localhost:3000
call npm.cmd run start
pause