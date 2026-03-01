@echo off
title HotelClaw Dashboard
color 0A
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   🛎️  HotelClaw — Panel de Admin         ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  Instalando dependencias...
cd /d "%~dp0dashboard"
call npm install --silent
echo.
echo  Iniciando el panel...
echo  Abre tu navegador en: http://localhost:3000
echo.
node server.js
pause
