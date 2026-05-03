@echo off
REM ============================================================
REM   EXPERIMENTO ALNS INDIVIDUAL (10k)
REM ============================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo Verificando puerto 8080...
powershell -Command "Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ('Liberando puerto 8080 PID: ' + $_.OwningProcess); Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo Iniciando backend (ventana minimizada)...
start "ALNS Backend" /MIN cmd /c "cd /d %SCRIPT_DIR%tasf-b2b-backend && .maven\apache-maven-3.9.6\bin\mvn.cmd spring-boot:run"

echo Esperando a que el backend inicie en localhost:8080...
set ATTEMPTS=0
:wait_backend
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 60 (
    echo ERROR: Backend no inicio en 3 minutos.
    exit /b 1
)
timeout /t 3 /nobreak >nul
powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:8080/api/planner/status/test' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; exit 0 } catch [System.Net.WebException] { if ($_.Exception.Response) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto wait_backend

echo *** Backend listo! Ejecutando limites... ***

echo.
echo == Ejecutando ALNS para 10000 bolsas ==
node run_experiment.js --data-dir docs/sample_data/day1 --parametros docs/sample_data/exp_1_day/parametros.csv --maxBags 10000 --iterations 1 --output exp_alns_10000_retry.csv

echo.
echo ============================================================
echo   EXPERIMENTO ALNS FINALIZADO
echo ============================================================
