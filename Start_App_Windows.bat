@echo off
setlocal
cd /d "%~dp0"

echo --------------------------------------------------
echo 🚀 Starter PDF Merger WebApp...
echo --------------------------------------------------

:: Start serveren og åbn browseren automatisk
npm run dev -- --open

echo --------------------------------------------------
echo Tryk på en tast for at lukke dette vindue...
pause
