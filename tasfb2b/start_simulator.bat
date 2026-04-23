@echo off
echo Iniciando Simulador Tasf.B2B...

REM Liberar puerto 8080 si esta ocupado
echo Verificando puerto 8080...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    echo Liberando puerto 8080 (PID: %%a)...
    taskkill /PID %%a /F >nul 2>&1
)

start "Tasf.B2B Backend" cmd /k "cd tasf-b2b-backend && run_backend.bat"
start "Tasf.B2B Frontend" cmd /k "cd tasf-b2b-frontend && run_frontend.bat"
echo.
echo Servidores inicializandose en nuevas ventanas.
echo Backend:  http://localhost:8080
echo Frontend: http://localhost:5173
