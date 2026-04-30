@echo off
REM ============================================================
REM   EXPERIMENTO 3 DIAS - ALNS (10 iteraciones, nMax=1500)
REM   Log se guarda en: exp_3_day_log.txt
REM ============================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo [%date% %time%] === INICIO EXPERIMENTO 3 DIAS === > exp_3_day_log.txt
echo [%date% %time%] Directorio actual: %CD% >> exp_3_day_log.txt

echo ============================================================
echo   EXPERIMENTO 3 DIAS - ALNS (10 iteraciones, nMax=1500)
echo ============================================================
echo.
echo Directorio actual: %CD%
echo Log file: exp_3_day_log.txt
echo.

REM Verificar Node.js
echo [%date% %time%] Verificando Node.js... >> exp_3_day_log.txt
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js no encontrado en PATH >> exp_3_day_log.txt
    echo ERROR: Node.js no encontrado en PATH.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do (
    echo [%date% %time%] Node.js version: %%v >> exp_3_day_log.txt
    echo Node.js: %%v
)

REM Verificar Java
echo [%date% %time%] Verificando Java... >> exp_3_day_log.txt
where java >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java no encontrado >> exp_3_day_log.txt
    echo ERROR: Java no encontrado en PATH.
    pause
    exit /b 1
)
echo [%date% %time%] Java encontrado OK >> exp_3_day_log.txt
echo Java: OK

REM Verificar Maven
echo [%date% %time%] Verificando Maven... >> exp_3_day_log.txt
if not exist "tasf-b2b-backend\.maven\apache-maven-3.9.6\bin\mvn.cmd" (
    echo ERROR: Maven no encontrado >> exp_3_day_log.txt
    echo ERROR: Maven no encontrado.
    pause
    exit /b 1
)
echo [%date% %time%] Maven encontrado OK >> exp_3_day_log.txt
echo Maven: OK

REM Verificar archivos
echo [%date% %time%] Verificando archivos... >> exp_3_day_log.txt
if not exist "docs\sample_data\day1\aeropuertos.csv" ( echo ERROR: aeropuertos.csv no encontrado & pause & exit /b 1 )
if not exist "docs\sample_data\day1\vuelos.csv" ( echo ERROR: vuelos.csv no encontrado & pause & exit /b 1 )
if not exist "docs\sample_data\day1\envios.csv" ( echo ERROR: envios.csv no encontrado & pause & exit /b 1 )
if not exist "docs\sample_data\day1\parametros.csv" ( echo ERROR: parametros.csv no encontrado & pause & exit /b 1 )
if not exist "run_experiment.js" ( echo ERROR: run_experiment.js no encontrado & pause & exit /b 1 )
echo [%date% %time%] Archivos verificados OK >> exp_3_day_log.txt
echo Archivos de datos: OK
echo.

REM Liberar puerto 8080 (PowerShell seguro)
echo [%date% %time%] Verificando puerto 8080... >> exp_3_day_log.txt
echo Verificando puerto 8080...
powershell -Command "Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ('Liberando puerto 8080 PID: ' + $_.OwningProcess); Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo [%date% %time%] Puerto 8080 verificado >> exp_3_day_log.txt

REM Iniciar backend
echo [%date% %time%] Iniciando backend... >> exp_3_day_log.txt
echo Iniciando backend (ventana minimizada)...
start "ALNS Backend" /MIN cmd /c "cd /d %SCRIPT_DIR%tasf-b2b-backend && .maven\apache-maven-3.9.6\bin\mvn.cmd spring-boot:run"

REM Esperar backend
echo [%date% %time%] Esperando backend... >> exp_3_day_log.txt
echo Esperando a que el backend inicie en localhost:8080...
set ATTEMPTS=0
:wait_backend
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 60 (
    echo [%date% %time%] TIMEOUT >> exp_3_day_log.txt
    echo ERROR: Backend no inicio en 3 minutos.
    pause
    exit /b 1
)
echo   Intento %ATTEMPTS%/60...
timeout /t 3 /nobreak >nul
powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:8080/api/planner/status/test' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; exit 0 } catch [System.Net.WebException] { if ($_.Exception.Response) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto wait_backend
echo [%date% %time%] Backend listo! >> exp_3_day_log.txt
echo.
echo *** Backend listo! ***
echo.

echo Presiona cualquier tecla para iniciar el experimento...
pause >nul
echo.
echo [%date% %time%] Ejecutando experimento... >> exp_3_day_log.txt
echo Iniciando experimento...
echo.
node run_experiment.js --data-dir docs/sample_data/day1 --iterations 10 --output exp_3_day_results.csv
echo.
echo [%date% %time%] Experimento finalizado con codigo: %errorlevel% >> exp_3_day_log.txt
echo ============================================================
echo   EXPERIMENTO 3 DIAS FINALIZADO
echo   Resultados en: exp_3_day_results.csv
echo   Log en: exp_3_day_log.txt
echo ============================================================
pause
