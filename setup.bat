@echo off
REM SAK WhatsApp API - Quick Setup Script for Windows

echo.
echo ===================================
echo SAK WhatsApp API - Quick Setup
echo ===================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18+ first.
    echo Visit: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js detected: 
node -v

REM Check PostgreSQL
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] PostgreSQL not found. Please install PostgreSQL 15+
    echo Visit: https://www.postgresql.org/download/windows/
    pause
)

echo [OK] PostgreSQL detected

REM Install backend dependencies
echo.
echo Installing backend dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)

REM Install frontend dependencies
echo.
echo Installing frontend dependencies...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install frontend dependencies
    pause
    exit /b 1
)
cd ..

REM Setup environment file
if not exist .env (
    echo.
    echo Creating .env file...
    copy .env.example .env
    echo [OK] .env file created
    echo.
    echo [IMPORTANT] Please edit .env and update:
    echo    - DB_PASSWORD (your PostgreSQL password^)
    echo    - JWT_SECRET (generate a secure random string^)
    echo    - ADMIN_EMAIL (your admin email^)
    echo.
) else (
    echo [OK] .env file already exists
)

REM Create necessary directories
echo.
echo Creating necessary directories...
if not exist whatsapp_sessions mkdir whatsapp_sessions
if not exist logs mkdir logs
echo [OK] Directories created

REM Build projects
echo.
set /p BUILD="Build projects now? (y/n): "
if /i "%BUILD%"=="y" (
    echo Building backend...
    call npm run build
    
    echo Building frontend...
    cd frontend
    call npm run build
    cd ..
    
    echo [OK] Build complete
)

REM Summary
echo.
echo ==============================================
echo Setup Complete!
echo ==============================================
echo.
echo Next Steps:
echo.
echo 1. Edit .env file with your configuration
echo.
echo 2. Setup PostgreSQL database:
echo    psql -U postgres
echo    CREATE DATABASE sak_whatsapp_api;
echo    \q
echo.
echo 3. Run database migrations:
echo    npx knex migrate:latest
echo.
echo 4. Start development servers:
echo    Terminal 1: npm run dev
echo    Terminal 2: cd frontend ^&^& npm run dev
echo.
echo 5. Access the dashboard:
echo    http://localhost:3000
echo.
echo 6. API endpoint:
echo    http://localhost:5000/api/v1
echo.
echo Documentation:
echo    - README.md - General overview
echo    - DEPLOYMENT.md - Production deployment
echo    - API_REFERENCE.md - Complete API docs
echo.
echo Happy coding!
echo.
pause
