@echo off
REM Jalankan WhatsApp Auto-Reply Dashboard

echo Starting WhatsApp Auto-Reply...
node src/index.js

REM Tunggu sebentar agar server siap sebelum buka browser
timeout /t 3 /nobreak >nul

REM Buka browser ke dashboard
start http://localhost:3000

echo.
echo Selesai. Tekan tombol apa saja untuk keluar.
pause >nul