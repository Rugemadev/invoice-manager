@echo off
title Invoice App - Expo Go
cd /d "c:\Users\user\Desktop\APP PROJECT\invoiceapp"
echo.
echo  =========================================
echo   Invoice App - Starting Expo Dev Server
echo  =========================================
echo.
echo  1. Wait for the QR code to appear below
echo  2. Open Expo Go on your phone
echo  3. Scan the QR code
echo.
echo  - Android: scan directly in Expo Go
echo  - iPhone:  scan with Camera app, tap link
echo.
echo  Press Ctrl+C to stop the server
echo.
npx expo start --clear
pause
