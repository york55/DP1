@echo off
REM ============================================================
REM  TASF.B2B - Full Test Launcher
REM  1. Kill running Java (backend)
REM  2. Rebuild backend (skip tests)
REM  3. Start backend with H2 dev profile (new window)
REM  4. Start frontend (this window)
REM ============================================================

setlocal EnableDelayedExpansion

set JAVA_HOME=C:\Program Files\Java\jdk-21
set PATH=%JAVA_HOME%\bin;%PATH%

set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%backend
set FRONTEND_DIR=%ROOT_DIR%frontend
set LOGS_DIR=%ROOT_DIR%logs

if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set DATESTAMP=%%c-%%b-%%a
for /f "tokens=1-2 delims=:." %%a in ("%time: =0%") do set TIMESTAMP=%%a%%b
set LOG_SUFFIX=%DATESTAMP%_%TIMESTAMP%

set BUILD_LOG=%LOGS_DIR%\build_%LOG_SUFFIX%.log
set BACKEND_LOG=%LOGS_DIR%\backend_%LOG_SUFFIX%.log

echo.
echo ============================================================
echo   TASF.B2B Full Test Launcher
echo ============================================================
echo.

REM ---- [1/4] Kill running Java ----
echo [1/4] Killing any running Java processes...
taskkill /F /IM java.exe >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo       Killed existing Java process. Waiting 3s...
    timeout /t 3 /nobreak >nul
) else (
    echo       No Java process found.
)
echo.

REM ---- [2/4] Build backend ----
echo [2/4] Building backend (mvnw clean package -DskipTests)...
echo       Build log: %BUILD_LOG%
echo.

pushd "%BACKEND_DIR%"
call mvnw.cmd clean package -DskipTests > "%BUILD_LOG%" 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Backend build failed!
    echo.
    echo --- Last 30 lines of build log ---
    powershell -Command "Get-Content '%BUILD_LOG%' -Tail 30"
    echo -----------------------------------
    popd
    pause
    exit /b 1
)
popd

echo       Backend build: OK
echo.

REM ---- [3/4] Start backend (H2 dev profile) ----
echo [3/4] Starting backend on port 8080 (H2 embedded DB)...
echo       Backend log: %BACKEND_LOG%

start "TASF.B2B Backend [dev]" cmd /k "%ROOT_DIR%start-backend.bat"

echo       Waiting 20s for backend startup...
timeout /t 20 /nobreak >nul

powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:8080/actuator/health' -UseBasicParsing -TimeoutSec 5; if ($r.StatusCode -eq 200) { Write-Host '      Backend health: OK' } else { Write-Host '      Backend health: unexpected status' $r.StatusCode } } catch { Write-Host '      WARNING: Backend not responding yet. Check the backend window.' }"

echo.

REM ---- [4/4] Start frontend ----
echo [4/4] Starting frontend...
echo.
echo ============================================================
echo   Backend  : http://localhost:8080
echo   Frontend : http://localhost:5173  (or next free port)
echo   Health   : http://localhost:8080/actuator/health
echo   H2 DB    : http://localhost:8080/h2-console
echo ============================================================
echo.
echo   Press Ctrl+C to stop the frontend.
echo   Close the "TASF.B2B Backend" window to stop the backend.
echo ============================================================
echo.

pushd "%FRONTEND_DIR%"
call npm install --silent
call npm run dev
popd

endlocal
