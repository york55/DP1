@echo off
REM ============================================================
REM  TASF.B2B — Dev Startup Script
REM  Launches backend (Spring Boot) + frontend (Vite) together
REM ============================================================

setlocal

set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%backend
set FRONTEND_DIR=%ROOT_DIR%frontend

REM ---- Colors / Header ----
echo.
echo ============================================================
echo   TASF.B2B Dev Environment Launcher
echo ============================================================
echo.

REM ---- Step 1: Verify prerequisites ----
echo [1/4] Checking prerequisites...

where java >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Java not found. Please install Java 21.
    pause
    exit /b 1
)

where mvn >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Maven not found. Please install Apache Maven 3.9+.
    pause
    exit /b 1
)

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js not found. Please install Node.js 18+.
    pause
    exit /b 1
)

echo       Java  : OK
echo       Maven : OK
echo       Node  : OK
echo.

REM ---- Step 2: Build backend ----
echo [2/4] Building backend (mvn clean package -DskipTests)...
echo.

pushd "%BACKEND_DIR%"
call mvn clean package -DskipTests
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Backend build failed. Fix compilation errors and retry.
    popd
    pause
    exit /b 1
)
popd

echo.
echo       Backend build: OK
echo.

REM ---- Step 3: Launch backend in a new window ----
echo [3/4] Starting backend on port 8080...
start "TASF.B2B Backend" cmd /k "cd /d "%BACKEND_DIR%" && java -jar target\tasfb2b.jar --spring.profiles.active=dev"

REM Give the backend a moment to start binding the port
echo       Waiting 8 seconds for backend startup...
timeout /t 8 /nobreak >nul

echo       Backend launched in a separate window.
echo.

REM ---- Step 4: Launch frontend ----
echo [4/4] Starting frontend on port 5173...
echo.

pushd "%FRONTEND_DIR%"

REM Install dependencies if node_modules is missing
if not exist "node_modules\" (
    echo       Installing npm dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo ERROR: npm install failed.
        popd
        pause
        exit /b 1
    )
)

echo ============================================================
echo   Backend  : http://localhost:8080
echo   Frontend : http://localhost:5173
echo   Health   : http://localhost:8080/actuator/health
echo ============================================================
echo.
echo   Press Ctrl+C here to stop the frontend.
echo   Close the "TASF.B2B Backend" window to stop the backend.
echo ============================================================
echo.

call npm run dev
popd

endlocal
