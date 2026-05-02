@echo off
REM ============================================================
REM   EXPERIMENTOS ACO SCALING (2k, 4k, 6k, 8k, 10k, total)
REM ============================================================

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%AlgoritmoDP1"

echo Compilando codigo ACO...
if not exist "bin" mkdir "bin"
dir /s /B src\*.java > sources.txt
javac -d bin @sources.txt
del sources.txt

if %ERRORLEVEL% neq 0 (
    echo ERROR: Fallo al compilar el codigo ACO.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo *** ACO compilado correctamente! Ejecutando limites... ***

for %%L in (2000 4000 6000 8000 10000) do (
    echo.
    echo == Ejecutando ACO para %%L bolsas - fecha 2027-01-08 ==
    java -cp bin Main experiment --days 1 --startDate 2027-01-08 --maxBags %%L --iterations 1 --output exp_aco_%%L.csv
)

echo.
echo == Ejecutando ACO para TODAS las bolsas - fecha 2027-01-08 ==
java -cp bin Main experiment --days 1 --startDate 2027-01-08 --iterations 1 --output exp_aco_total.csv

echo.
echo ============================================================
echo   EXPERIMENTOS ACO FINALIZADOS
echo ============================================================
