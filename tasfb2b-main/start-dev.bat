@echo off
REM ============================================================
REM  TASF.B2B — Full Dev Environment (backend + frontend)
REM  Backend launches in a separate window; frontend runs here.
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

set BUILD_LOG=%LOGS_DIR%\backend-build_%LOG_SUFFIX%.log
set BACKEND_LOG=%LOGS_DIR%\backend_%LOG_SUFFIX%.log
set FRONTEND_LOG=%LOGS_DIR%\frontend_%LOG_SUFFIX%.log

echo.
echo ============================================================
echo   TASF.B2B Dev Environment Launcher
echo ============================================================
echo.
echo   Logs folder: %LOGS_DIR%
echo.

REM ---- Check prerequisites ----
echo [1/4] Checking prerequisites...

where java >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Java not found. Please install Java 21.
    pause
    exit /b 1
)

if not exist "%BACKEND_DIR%\mvnw.cmd" (
    echo ERROR: mvnw.cmd not found in backend folder.
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
echo       Maven : OK (via wrapper)
echo       Node  : OK
echo.

REM ---- Build backend ----
echo [2/4] Building backend (mvnw clean package -DskipTests)...
echo       Build log: %BUILD_LOG%
echo.

pushd "%BACKEND_DIR%"
call mvnw.cmd clean package -DskipTests > "%BUILD_LOG%" 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Backend build failed! Check the log:
    echo        %BUILD_LOG%
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

REM ---- Launch backend in a new window ----
echo [3/4] Starting backend on port 8080 (H2 embedded DB)...
echo       Backend log: %BACKEND_LOG%

start "TASF.B2B Backend" cmd /k ""%ROOT_DIR%_run-backend.bat" "%BACKEND_DIR%" "%BACKEND_LOG%""

echo       Waiting 10 seconds for backend startup...
timeout /t 10 /nobreak >nul

if exist "%BACKEND_LOG%" (
    for %%A in ("%BACKEND_LOG%") do (
        if %%~zA GTR 0 (
            findstr /C:"APPLICATION FAILED TO START" "%BACKEND_LOG%" >nul 2>&1
            if !ERRORLEVEL! equ 0 (
                echo.
                echo  WARNING: Backend may have failed to start!
                echo           Check log: %BACKEND_LOG%
                echo.
                echo --- Last 40 lines of backend log ---
                powershell -Command "Get-Content '%BACKEND_LOG%' -Tail 40"
                echo -----------------------------------
                echo.
                echo  Press any key to continue starting frontend anyway, or Ctrl+C to abort.
                pause >nul
            ) else (
                echo       Backend appears healthy.
            )
        )
    )
)

echo.

REM ---- Launch frontend ----
echo [4/4] Starting frontend on port 5173...
echo       Frontend log: %FRONTEND_LOG%
echo.

pushd "%FRONTEND_DIR%"

echo       Syncing npm dependencies...
call npm install >> "%FRONTEND_LOG%" 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: npm install failed. Check: %FRONTEND_LOG%
    popd
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Backend  : http://localhost:8080
echo   Frontend : http://localhost:5173
echo   Health   : http://localhost:8080/actuator/health
echo   H2 DB    : http://localhost:8080/h2-console
echo ============================================================
echo.
echo   LOG FILES:
echo     Build    : %BUILD_LOG%
echo     Backend  : %BACKEND_LOG%
echo     Frontend : %FRONTEND_LOG%
echo.
echo   Press Ctrl+C here to stop the frontend.
echo   Close the "TASF.B2B Backend" window to stop the backend.
echo ============================================================
echo.

call npm run dev 2>&1

popd
endlocal
