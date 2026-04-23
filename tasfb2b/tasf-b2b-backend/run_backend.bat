@echo off
if not exist ".maven" (
    echo Descargando Maven para compilar el backend...
    powershell -Command "Invoke-WebRequest -Uri 'https://archive.apache.org/dist/maven/maven-3/3.9.6/binaries/apache-maven-3.9.6-bin.zip' -OutFile 'maven.zip'"
    echo Extrayendo Maven...
    powershell -Command "Expand-Archive -Path 'maven.zip' -DestinationPath '.maven'"
    del maven.zip
)
if not exist "logs" mkdir logs
echo Iniciando Spring Boot Backend en http://localhost:8080...
echo Los logs se guardan en: tasf-b2b-backend\logs\
.maven\apache-maven-3.9.6\bin\mvn.cmd spring-boot:run
