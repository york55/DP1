@echo off
echo ============================================================
echo   Iniciando Simulador Tasf.B2B...
echo ============================================================
echo.

REM Forzar directorio de trabajo al directorio del script
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"
echo Directorio de trabajo: %CD%
echo.

REM Liberar puerto 8080 si esta ocupado (PowerShell para evitar crash de for/f)
echo Verificando puerto 8080...
powershell -Command "Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ('Liberando puerto 8080 PID: ' + $_.OwningProcess); Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo Puerto 8080 OK
echo.

echo Iniciando Backend...
start "Tasf.B2B Backend" cmd /k "cd /d %SCRIPT_DIR%tasf-b2b-backend && echo Directorio: %%CD%% && echo. && echo Ejecutando Maven... && .maven\apache-maven-3.9.6\bin\mvn.cmd spring-boot:run"

echo Iniciando Frontend...
start "Tasf.B2B Frontend" cmd /k "cd /d %SCRIPT_DIR%tasf-b2b-frontend && run_frontend.bat"

echo.
echo Servidores inicializandose en nuevas ventanas.
echo Backend:  http://localhost:8080
echo Frontend: http://localhost:5173
echo.
pause
