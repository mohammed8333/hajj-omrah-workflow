@echo off
title WhatsApp Bridge Local Server
cd /d "%~dp0"

echo ========================================================
echo        Starting WhatsApp Bridge Server...
echo ========================================================

if not exist node_modules (
    echo [1/2] Installing dependencies...
    call npm install
)

echo [2/2] Running server on http://localhost:5055 ...
echo ========================================================
echo Opening WhatsApp Server Dashboard: http://localhost:5055
echo ========================================================

start http://localhost:5055
node server.js
pause
