@echo off
REM ============================================================
REM  TASF.B2B - Full Build (Backend + Frontend)
REM  Compiles backend JAR and frontend dist/ bundle.
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

set BACKEND_BUILD_LOG=%LOGS_DIR%\build_backend_%LOG_SUFFIX%.log
set FRONTEND_BUILD_LOG=%LOGS_DIR%\build_frontend_%LOG_SUFFIX%.log

echo.
echo ============================================================
echo   TASF.B2B - Full Build
echo ============================================================
echo.

REM ---- Kill any running backend process ----
echo [0/4] Stopping any running backend...
taskkill /F /IM java.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo       Done.
echo.

REM ---- Check prerequisites ----
echo [1/4] Checking prerequisites...

where java >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo ERROR: Java not found. Please install Java 21.
    goto :fail
)

if not exist "%BACKEND_DIR%\mvnw.cmd" (
    echo ERROR: mvnw.cmd not found in backend folder.
    goto :fail
)

where node >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo ERROR: Node.js not found. Please install Node.js 18+.
    goto :fail
)

echo       Java  : OK
echo       Maven : OK (via wrapper)
echo       Node  : OK
echo.

REM ---- Build backend ----
echo [2/4] Building backend (mvnw clean package -DskipTests)...
echo       Log: %BACKEND_BUILD_LOG%

pushd "%BACKEND_DIR%"
call mvnw.cmd clean package -DskipTests > "%BACKEND_BUILD_LOG%" 2>&1
if !ERRORLEVEL! neq 0 (
    echo.
    echo ERROR: Backend build failed!
    echo.
    echo --- Last 30 lines ---
    powershell -NoProfile -Command "Get-Content '%BACKEND_BUILD_LOG%' -Tail 30"
    echo ---------------------
    popd
    goto :fail
)
popd

echo       Backend JAR: OK
echo.

REM ---- Install frontend dependencies ----
echo [3/4] Installing frontend dependencies (npm install)...

pushd "%FRONTEND_DIR%"
call npm install > "%FRONTEND_BUILD_LOG%" 2>&1
if !ERRORLEVEL! neq 0 (
    echo ERROR: npm install failed!
    echo.
    echo --- Last 30 lines ---
    powershell -NoProfile -Command "Get-Content '%FRONTEND_BUILD_LOG%' -Tail 30"
    echo ---------------------
    popd
    goto :fail
)

echo       npm install: OK
echo.

REM ---- Build frontend ----
echo [4/4] Building frontend production bundle (npm run build)...

call npm run build >> "%FRONTEND_BUILD_LOG%" 2>&1
if !ERRORLEVEL! neq 0 (
    echo ERROR: Frontend build failed!
    echo.
    echo --- Last 30 lines ---
    powershell -NoProfile -Command "Get-Content '%FRONTEND_BUILD_LOG%' -Tail 30"
    echo ---------------------
    popd
    goto :fail
)
popd

echo       Frontend dist/: OK
echo.

echo ============================================================
echo   BUILD COMPLETE
echo ============================================================
echo.
echo   Backend JAR : %BACKEND_DIR%\target\tasfb2b.jar
echo   Frontend    : %FRONTEND_DIR%\dist\
echo.
echo   Logs:
echo     Backend  : %BACKEND_BUILD_LOG%
echo     Frontend : %FRONTEND_BUILD_LOG%
echo.
echo   You can now run: start-local-prod.bat
echo ============================================================
echo.
pause
endlocal
exit /b 0

:fail
echo.
echo ============================================================
echo   BUILD FAILED - See errors above.
echo ============================================================
echo.
pause
endlocal
exit /b 1
