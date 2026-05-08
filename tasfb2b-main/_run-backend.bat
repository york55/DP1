@echo off
REM ============================================================
REM  Backend runner helper — logs all output to file AND console
REM  Usage: _run-backend.bat <backend_dir> <log_file>
REM ============================================================

set JAVA_HOME=C:\Program Files\Java\jdk-21
set BACKEND_DIR=%~1
set LOG_FILE=%~2

echo ============================================================
echo   TASF.B2B Backend
echo   Log: %LOG_FILE%
echo   Press Ctrl+C to stop.
echo ============================================================
echo.

cd /d "%BACKEND_DIR%"

REM Run Java and redirect all output to the log file
REM We use powershell Tee-Object so output shows in console AND writes to file
powershell -NoProfile -Command "& { $ErrorActionPreference='Continue'; & '%JAVA_HOME%\bin\java.exe' -jar target\tasfb2b.jar --spring.profiles.active=dev 2>&1 | Tee-Object -FilePath '%LOG_FILE%' }"

echo.
echo ============================================================
echo   Backend process exited.
echo   Full log saved at: %LOG_FILE%
echo ============================================================
echo.
echo   Last 50 lines of log:
echo   ---
powershell -NoProfile -Command "Get-Content '%LOG_FILE%' -Tail 50"
echo   ---
echo.
pause
