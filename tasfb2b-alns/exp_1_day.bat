@echo off
REM ============================================================
REM   EXPERIMENTO 1 DIA - ALNS (10 iteraciones, nMax=1500)
REM   Log se guarda en: exp_1_day_log.txt
REM ============================================================

REM Forzar directorio de trabajo al directorio del script
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo [%date% %time%] === INICIO EXPERIMENTO 1 DIA === > exp_1_day_log.txt
echo [%date% %time%] Directorio actual: %CD% >> exp_1_day_log.txt

echo ============================================================
echo   EXPERIMENTO 1 DIA - ALNS (10 iteraciones, nMax=1500)
echo ============================================================
echo.
echo Directorio actual: %CD%
echo Log file: exp_1_day_log.txt
echo.

REM Verificar que Node.js esta disponible
echo [%date% %time%] Verificando Node.js... >> exp_1_day_log.txt
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js no encontrado en PATH >> exp_1_day_log.txt
    echo ERROR: Node.js no encontrado en PATH. Instala Node.js primero.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do (
    echo [%date% %time%] Node.js version: %%v >> exp_1_day_log.txt
    echo Node.js: %%v
)

REM Verificar que Java esta disponible
echo [%date% %time%] Verificando Java... >> exp_1_day_log.txt
where java >nul 2>&1
if errorlevel 1 (
    echo ERROR: Java no encontrado en PATH >> exp_1_day_log.txt
    echo ERROR: Java no encontrado en PATH.
    pause
    exit /b 1
)
echo [%date% %time%] Java encontrado OK >> exp_1_day_log.txt
echo Java: OK

REM Verificar que Maven existe
echo [%date% %time%] Verificando Maven... >> exp_1_day_log.txt
if not exist "tasf-b2b-backend\.maven\apache-maven-3.9.6\bin\mvn.cmd" (
    echo ERROR: Maven no encontrado en tasf-b2b-backend\.maven\ >> exp_1_day_log.txt
    echo ERROR: Maven no encontrado. Ejecuta run_backend.bat primero para descargarlo.
    pause
    exit /b 1
)
echo [%date% %time%] Maven encontrado OK >> exp_1_day_log.txt
echo Maven: OK

REM Verificar archivos de datos
echo [%date% %time%] Verificando archivos de datos... >> exp_1_day_log.txt
if not exist "docs\sample_data\day1\aeropuertos.csv" (
    echo ERROR: No se encontro docs\sample_data\day1\aeropuertos.csv >> exp_1_day_log.txt
    echo ERROR: Archivo aeropuertos.csv no encontrado
    pause
    exit /b 1
)
if not exist "docs\sample_data\day1\vuelos.csv" (
    echo ERROR: No se encontro docs\sample_data\day1\vuelos.csv >> exp_1_day_log.txt
    echo ERROR: Archivo vuelos.csv no encontrado
    pause
    exit /b 1
)
if not exist "docs\sample_data\day1\envios.csv" (
    echo ERROR: No se encontro docs\sample_data\day1\envios.csv >> exp_1_day_log.txt
    echo ERROR: Archivo envios.csv no encontrado
    pause
    exit /b 1
)
if not exist "docs\sample_data\exp_1_day\parametros.csv" (
    echo ERROR: No se encontro docs\sample_data\exp_1_day\parametros.csv >> exp_1_day_log.txt
    echo ERROR: Archivo parametros.csv no encontrado
    pause
    exit /b 1
)
if not exist "run_experiment.js" (
    echo ERROR: No se encontro run_experiment.js >> exp_1_day_log.txt
    echo ERROR: run_experiment.js no encontrado
    pause
    exit /b 1
)
echo [%date% %time%] Archivos de datos verificados OK >> exp_1_day_log.txt
echo Archivos de datos: OK
echo.

REM Liberar puerto 8080 si esta ocupado (usando PowerShell para evitar problemas con for/f pipes)
echo [%date% %time%] Verificando puerto 8080... >> exp_1_day_log.txt
echo Verificando puerto 8080...
powershell -Command "Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ('Liberando puerto 8080 PID: ' + $_.OwningProcess); Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo [%date% %time%] Puerto 8080 verificado >> exp_1_day_log.txt

REM Iniciar backend en segundo plano
echo [%date% %time%] Iniciando backend... >> exp_1_day_log.txt
echo Iniciando backend (ventana minimizada)...
start "ALNS Backend" /MIN cmd /c "cd /d %SCRIPT_DIR%tasf-b2b-backend && .maven\apache-maven-3.9.6\bin\mvn.cmd spring-boot:run"

REM Esperar a que el backend este listo
echo [%date% %time%] Esperando backend... >> exp_1_day_log.txt
echo Esperando a que el backend inicie en localhost:8080...
set ATTEMPTS=0
:wait_backend
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 60 (
    echo [%date% %time%] TIMEOUT: Backend no inicio en 3 minutos >> exp_1_day_log.txt
    echo ERROR: Backend no inicio en 3 minutos. Revisa la ventana del backend.
    pause
    exit /b 1
)
echo   Intento %ATTEMPTS%/60...
timeout /t 3 /nobreak >nul
powershell -Command "try { Invoke-WebRequest -Uri 'http://localhost:8080/api/planner/status/test' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; exit 0 } catch [System.Net.WebException] { if ($_.Exception.Response) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 goto wait_backend
echo [%date% %time%] Backend listo! >> exp_1_day_log.txt
echo.
echo *** Backend listo! ***
echo.

echo Presiona cualquier tecla para iniciar el experimento...
pause >nul
echo.
echo [%date% %time%] Ejecutando experimento... >> exp_1_day_log.txt
echo Iniciando experimento...
echo.
node run_experiment.js --data-dir docs/sample_data/day1 --parametros docs/sample_data/exp_1_day/parametros.csv --iterations 10 --output exp_1_day_results.csv
echo.
echo [%date% %time%] Experimento finalizado con codigo: %errorlevel% >> exp_1_day_log.txt
echo ============================================================
echo   EXPERIMENTO 1 DIA FINALIZADO
echo   Resultados en: exp_1_day_results.csv
echo   Log en: exp_1_day_log.txt
echo ============================================================
pause
