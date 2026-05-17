@echo off
cd /d "%~dp0invoiceapp"
echo Starting Invoice App...
echo.
echo Scan the QR code with Expo Go on your phone.
echo Make sure your phone and PC are on the same Wi-Fi network.
echo.
npx expo start --clear
pause
