@echo off
REM ============================================================
REM   EXPERIMENTO ACO 5 DIAS (10 iteraciones)
REM   Log se guarda en: exp_aco_5_day_log.txt
REM ============================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%AlgoritmoDP1"

echo [%date% %time%] === INICIO EXPERIMENTO ACO 5 DIAS === > "%SCRIPT_DIR%exp_aco_5_day_log.txt"
echo [%date% %time%] Directorio: %CD% >> "%SCRIPT_DIR%exp_aco_5_day_log.txt"

echo ============================================================
echo   EXPERIMENTO ACO 5 DIAS (10 iteraciones)
echo ============================================================
echo.
echo Directorio: %CD%
echo Log: exp_aco_5_day_log.txt
echo.

REM Verificar javac y java
echo [%date% %time%] Verificando Java... >> "%SCRIPT_DIR%exp_aco_5_day_log.txt"
where javac >nul 2>&1
if errorlevel 1 (
    if exist "%JAVA_HOME%\bin\javac.exe" (
        set "PATH=%JAVA_HOME%\bin;%PATH%"
        echo Usando JAVA_HOME: %JAVA_HOME%
    ) else (
        echo ERROR: javac no encontrado. Instala JDK.
        echo ERROR: javac no encontrado >> "%SCRIPT_DIR%exp_aco_5_day_log.txt"
        pause
        exit /b 1
    )
)
echo Java: OK

REM Verificar datos
echo [%date% %time%] Verificando datos... >> "%SCRIPT_DIR%exp_aco_5_day_log.txt"
if not exist "src\datos\aeropuertos.txt" ( echo ERROR: aeropuertos.txt no encontrado & pause & exit /b 1 )
if not exist "src\datos\vuelos.txt" ( echo ERROR: vuelos.txt no encontrado & pause & exit /b 1 )
if not exist "src\datos\envios_por_origen" ( echo ERROR: envios_por_origen no encontrado & pause & exit /b 1 )
echo [%date% %time%] Datos verificados OK >> "%SCRIPT_DIR%exp_aco_5_day_log.txt"
echo Datos: OK
echo.

REM Compilar
echo [%date% %time%] Compilando... >> "%SCRIPT_DIR%exp_aco_5_day_log.txt"
echo Compilando proyecto ACO...
if not exist "out\production\AlgoritmoDP1" mkdir "out\production\AlgoritmoDP1"
javac -d out\production\AlgoritmoDP1 src\*.java 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERROR de compilacion >> "%SCRIPT_DIR%exp_aco_5_day_log.txt"
    echo ERROR: Fallo la compilacion.
    pause
    exit /b 1
)
echo [%date% %time%] Compilacion OK >> "%SCRIPT_DIR%exp_aco_5_day_log.txt"
echo Compilacion: OK
echo.

echo Presiona cualquier tecla para iniciar el experimento...
pause >nul
echo.

REM Ejecutar experimento
echo [%date% %time%] Ejecutando experimento... >> "%SCRIPT_DIR%exp_aco_5_day_log.txt"
echo Iniciando experimento ACO (5 dias, 10 iteraciones)...
echo.
java -cp out\production\AlgoritmoDP1 Main experiment --days 5 --iterations 10 --output "%SCRIPT_DIR%exp_aco_5_day_results.csv"
echo.
echo [%date% %time%] Experimento finalizado >> "%SCRIPT_DIR%exp_aco_5_day_log.txt"
echo ============================================================
echo   EXPERIMENTO ACO 5 DIAS FINALIZADO
echo   Resultados en: exp_aco_5_day_results.csv
echo   Log en: exp_aco_5_day_log.txt
echo ============================================================
pause
