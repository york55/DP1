@echo off
REM ============================================================
REM   ACO Backend - Compilar proyecto Java
REM   Log se guarda en: build_aco_log.txt
REM ============================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%AlgoritmoDP1"

echo [%date% %time%] === COMPILACION ACO === > "%SCRIPT_DIR%build_aco_log.txt"
echo [%date% %time%] Directorio: %CD% >> "%SCRIPT_DIR%build_aco_log.txt"

echo ============================================================
echo   ACO Backend - Compilacion
echo ============================================================
echo.
echo Directorio: %CD%
echo.

REM Verificar Java
echo [%date% %time%] Verificando Java... >> "%SCRIPT_DIR%build_aco_log.txt"
where javac >nul 2>&1
if errorlevel 1 (
    echo ERROR: javac no encontrado en PATH >> "%SCRIPT_DIR%build_aco_log.txt"
    echo ERROR: javac no encontrado. Asegurate de tener JDK instalado y en PATH.
    echo.
    echo Intentando usar JDK de JAVA_HOME...
    if exist "%JAVA_HOME%\bin\javac.exe" (
        set "PATH=%JAVA_HOME%\bin;%PATH%"
        echo Usando JAVA_HOME: %JAVA_HOME%
    ) else (
        echo ERROR: No se encontro javac en ninguna ubicacion.
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%v in ('javac -version 2^>^&1') do (
    echo [%date% %time%] javac: %%v >> "%SCRIPT_DIR%build_aco_log.txt"
    echo javac: %%v
)

REM Verificar archivos fuente
echo [%date% %time%] Verificando archivos fuente... >> "%SCRIPT_DIR%build_aco_log.txt"
if not exist "src\Main.java" (
    echo ERROR: src\Main.java no encontrado >> "%SCRIPT_DIR%build_aco_log.txt"
    echo ERROR: src\Main.java no encontrado
    pause
    exit /b 1
)
if not exist "src\datos\aeropuertos.txt" (
    echo ERROR: src\datos\aeropuertos.txt no encontrado >> "%SCRIPT_DIR%build_aco_log.txt"
    echo ERROR: Datos no encontrados
    pause
    exit /b 1
)
echo Archivos fuente: OK
echo.

REM Crear directorio de salida
if not exist "out\production\AlgoritmoDP1" mkdir "out\production\AlgoritmoDP1"

REM Compilar
echo [%date% %time%] Compilando... >> "%SCRIPT_DIR%build_aco_log.txt"
echo Compilando proyecto ACO...
javac -d out\production\AlgoritmoDP1 src\*.java 2>&1
if errorlevel 1 (
    echo [%date% %time%] ERROR de compilacion >> "%SCRIPT_DIR%build_aco_log.txt"
    echo.
    echo ERROR: Fallo la compilacion. Revisa los errores arriba.
    pause
    exit /b 1
)

echo [%date% %time%] Compilacion exitosa >> "%SCRIPT_DIR%build_aco_log.txt"
echo.
echo ============================================================
echo   Compilacion exitosa!
echo   Classes en: out\production\AlgoritmoDP1\
echo ============================================================
echo.
echo Para ejecutar normalmente:
echo   java -cp out\production\AlgoritmoDP1 Main
echo.
echo Para modo experimento:
echo   java -cp out\production\AlgoritmoDP1 Main experiment --days 3 --iterations 10 --output exp_results.csv
echo.
pause
