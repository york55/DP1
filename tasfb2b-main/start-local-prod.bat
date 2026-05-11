@echo off
REM ============================================================
REM  TASF.B2B - Local Production Simulation (Proxy-Less)
REM  Builds everything first, then launches backend + static frontend.
REM ============================================================

setlocal EnableDelayedExpansion

set JAVA_HOME=C:\Program Files\Java\jdk-21
set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%backend
set FRONTEND_DIR=%ROOT_DIR%frontend
set LOGS_DIR=%ROOT_DIR%logs

if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set DATESTAMP=%%c-%%b-%%a
for /f "tokens=1-2 delims=:." %%a in ("%time: =0%") do set TIMESTAMP=%%a%%b
set LOG_SUFFIX=%DATESTAMP%_%TIMESTAMP%

set BACKEND_LOG=%LOGS_DIR%\prod_backend_%LOG_SUFFIX%.log

echo.
echo ============================================================
echo   TASF.B2B - Local Production Simulation Launcher
echo ============================================================
echo.

REM ---- Build everything first ----
echo [0/2] Running full build...
echo.

call "%ROOT_DIR%build.bat"
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Build failed. Fix the errors above before retrying.
    pause
    exit /b 1
)

echo.

REM ---- Delete old H2 data for clean start (optional) ----
REM Uncomment the next line if you want a fresh DB every launch:
REM del /q "%BACKEND_DIR%\data\*.db" 2>nul

REM ---- Launch backend in a new window ----
echo [1/2] Starting Spring Boot backend on port 8080...
echo       Backend log: %BACKEND_LOG%

start "TASF.B2B Backend (PROD)" cmd /k ""%ROOT_DIR%_run-backend.bat" "%BACKEND_DIR%" "%BACKEND_LOG%""

echo       Waiting 15 seconds for backend startup...
timeout /t 15 /nobreak >nul

echo.

REM ---- Launch static frontend ----
echo [2/2] Starting Static Frontend Server on port 3000...
echo       (Serving production build from dist/)
echo.

pushd "%FRONTEND_DIR%"

echo ============================================================
echo   Backend API : http://localhost:8080/api
echo   Frontend    : http://localhost:3000
echo   H2 Console  : http://localhost:8080/h2-console
echo   WebSocket   : http://localhost:8080/ws
echo ============================================================
echo.
echo   Press Ctrl+C here to stop the frontend server.
echo   Close the "TASF.B2B Backend (PROD)" window to stop the backend.
echo ============================================================
echo.

REM Uses npx to run "serve" on the dist folder
set FRONTEND_SERVER_LOG=%LOGS_DIR%\frontend_server_%LOG_SUFFIX%.log
echo       Frontend server log: %FRONTEND_SERVER_LOG%
call npx serve -s dist -p 3000 > "%FRONTEND_SERVER_LOG%" 2>&1

popd
endlocal
