@echo off
REM ============================================================
REM  TASF.B2B - Frontend Only
REM  Starts the Vite dev server on port 5173
REM ============================================================

setlocal EnableDelayedExpansion

set ROOT_DIR=%~dp0
set FRONTEND_DIR=%ROOT_DIR%frontend
set LOGS_DIR=%ROOT_DIR%logs

if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set DATESTAMP=%%c-%%b-%%a
for /f "tokens=1-2 delims=:." %%a in ("%time: =0%") do set TIMESTAMP=%%a%%b
set FRONTEND_LOG=%LOGS_DIR%\frontend_%DATESTAMP%_%TIMESTAMP%.log

echo.
echo ============================================================
echo   TASF.B2B - Frontend Dev Server
echo ============================================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js not found. Please install Node.js 18+.
    pause
    exit /b 1
)

pushd "%FRONTEND_DIR%"

echo [1/2] Syncing npm dependencies...
call npm install >> "%FRONTEND_LOG%" 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: npm install failed. Check: %FRONTEND_LOG%
    popd
    pause
    exit /b 1
)

echo [2/2] Starting frontend on port 5173...
echo       Log: %FRONTEND_LOG%
echo.
echo ============================================================
echo   Frontend : http://localhost:5173
echo   Press Ctrl+C to stop.
echo ============================================================
echo.

call npm run dev 2>&1

popd
endlocal
