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
echo If QR code appears, scan it from WhatsApp on your phone.
echo ========================================================
node server.js
pause
