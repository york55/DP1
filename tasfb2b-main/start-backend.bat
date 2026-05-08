@echo off
REM ============================================================
REM  TASF.B2B — Backend Only
REM  Builds and starts Spring Boot on port 8080 (H2 embedded DB)
REM ============================================================

setlocal EnableDelayedExpansion

set JAVA_HOME=C:\Program Files\Java\jdk-21

set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%backend
set LOGS_DIR=%ROOT_DIR%logs

if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set DATESTAMP=%%c-%%b-%%a
for /f "tokens=1-2 delims=:." %%a in ("%time: =0%") do set TIMESTAMP=%%a%%b
set BUILD_LOG=%LOGS_DIR%\backend-build_%DATESTAMP%_%TIMESTAMP%.log
set BACKEND_LOG=%LOGS_DIR%\backend_%DATESTAMP%_%TIMESTAMP%.log

echo.
echo ============================================================
echo   TASF.B2B — Backend Dev Server
echo ============================================================
echo.

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

echo [1/2] Building backend (mvnw clean package -DskipTests)...
echo       Build log: %BUILD_LOG%
echo.

pushd "%BACKEND_DIR%"
call mvnw.cmd clean package -DskipTests > "%BUILD_LOG%" 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Backend build failed! Check the log:
    echo        %BUILD_LOG%
    echo.
    echo --- Last 30 lines ---
    powershell -Command "Get-Content '%BUILD_LOG%' -Tail 30"
    echo ---------------------
    popd
    pause
    exit /b 1
)
popd

echo       Build: OK
echo.
echo [2/2] Starting backend on port 8080 (H2 embedded DB)...
echo       Backend log: %BACKEND_LOG%
echo.
echo ============================================================
echo   Backend  : http://localhost:8080
echo   Health   : http://localhost:8080/actuator/health
echo   H2 DB    : http://localhost:8080/h2-console
echo   Press Ctrl+C to stop.
echo ============================================================
echo.

pushd "%BACKEND_DIR%"
powershell -NoProfile -Command "& { $ErrorActionPreference='Continue'; & '%JAVA_HOME%\bin\java.exe' -jar target\tasfb2b.jar --spring.profiles.active=dev 2>&1 | Tee-Object -FilePath '%BACKEND_LOG%' }"
popd

echo.
echo Backend stopped. Log saved at: %BACKEND_LOG%
echo.
pause
endlocal
