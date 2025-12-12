@echo off
REM Start development environment for Windows

echo.
echo Starting SAK WhatsApp API Development Environment
echo.

REM Start backend in new window
start "SAK API - Backend" cmd /k "npm run dev"

REM Wait a bit
timeout /t 2 /nobreak >nul

REM Start frontend in new window
start "SAK API - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ================================================
echo Development servers started!
echo ================================================
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:5000
echo.
echo Press any key to stop all servers...
pause >nul

REM Kill Node processes
taskkill /F /IM node.exe /T >nul 2>&1

echo.
echo Servers stopped.
pause
