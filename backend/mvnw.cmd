@REM ----------------------------------------------------------------------------
@REM Licensed to the Apache Software Foundation (ASF) under one
@REM or more contributor license agreements.  See the NOTICE file
@REM distributed with this work for additional information
@REM regarding copyright ownership.  The ASF licenses this file
@REM to you under the Apache License, Version 2.0 (the
@REM "License"); you may not use this file except in compliance
@REM with the License.  You may obtain a copy of the License at
@REM
@REM    http://www.apache.org/licenses/LICENSE-2.0
@REM
@REM Unless required by applicable law or agreed to in writing,
@REM software distributed under the License is distributed on an
@REM "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
@REM KIND, either express or implied.  See the License for the
@REM specific language governing permissions and limitations
@REM under the License.
@REM ----------------------------------------------------------------------------

@REM Begin all REM://!sym'm/sym'm at top of batch script
@REM Maven Wrapper script for Windows
@REM
@REM Required ENV vars:
@REM   JAVA_HOME - location of a JDK home dir

@echo off
setlocal

set MAVEN_PROJECTBASEDIR=%~dp0
set WRAPPER_JAR="%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.jar"
set WRAPPER_PROPERTIES="%MAVEN_PROJECTBASEDIR%.mvn\wrapper\maven-wrapper.properties"

@REM Find java.exe
if defined JAVA_HOME goto findJavaFromJavaHome

set JAVA_EXE=java.exe
%JAVA_EXE% -version >NUL 2>&1
if "%ERRORLEVEL%" == "0" goto findMavenVersion
echo ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH. >&2
echo. >&2
echo Please set the JAVA_HOME variable in your environment to match the >&2
echo location of your Java installation. >&2
exit /B 1

:findJavaFromJavaHome
set JAVA_HOME=%JAVA_HOME:"=%
set JAVA_EXE=%JAVA_HOME%\bin\java.exe
if exist "%JAVA_EXE%" goto findMavenVersion
echo ERROR: JAVA_HOME is set to an invalid directory: %JAVA_HOME% >&2
echo. >&2
echo Please set the JAVA_HOME variable in your environment to match the >&2
echo location of your Java installation. >&2
exit /B 1

:findMavenVersion
@REM Determine Maven version from wrapper properties
for /f "usebackq tokens=1,2 delims==" %%A in (%WRAPPER_PROPERTIES%) do (
    if "%%A"=="distributionUrl" set WRAPPER_URL=%%B
)

@REM Extract version from URL for cache directory naming
set MAVEN_VERSION=3.9.9

@REM Set Maven home in user's local cache
set MAVEN_HOME=%USERPROFILE%\.m2\wrapper\dists\apache-maven-%MAVEN_VERSION%
set MVN_CMD=%MAVEN_HOME%\bin\mvn.cmd

@REM Download and extract Maven if not already present
if exist "%MVN_CMD%" goto runMaven

echo Downloading Apache Maven %MAVEN_VERSION%...
echo   from: %WRAPPER_URL%

@REM Create target directory
if not exist "%MAVEN_HOME%" mkdir "%MAVEN_HOME%"

set DOWNLOAD_DIR=%TEMP%\maven-wrapper-download
if not exist "%DOWNLOAD_DIR%" mkdir "%DOWNLOAD_DIR%"
set DOWNLOAD_FILE=%DOWNLOAD_DIR%\apache-maven-%MAVEN_VERSION%-bin.zip

@REM Use PowerShell to download
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%WRAPPER_URL%' -OutFile '%DOWNLOAD_FILE%'" 2>NUL
if %ERRORLEVEL% neq 0 (
    @REM Fallback to curl
    curl -fsSL -o "%DOWNLOAD_FILE%" "%WRAPPER_URL%" 2>NUL
    if %ERRORLEVEL% neq 0 (
        echo ERROR: Failed to download Maven. Check your internet connection.
        exit /B 1
    )
)

echo Extracting Maven...
powershell -Command "Expand-Archive -Path '%DOWNLOAD_FILE%' -DestinationPath '%MAVEN_HOME%\..' -Force" 2>NUL
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to extract Maven archive.
    exit /B 1
)

@REM Clean up download
del /q "%DOWNLOAD_FILE%" 2>NUL

@REM Verify extraction
if not exist "%MVN_CMD%" (
    @REM Maven extracts into a subdirectory, move contents up
    for /d %%D in ("%MAVEN_HOME%\..\apache-maven-%MAVEN_VERSION%*") do (
        if not "%%D"=="%MAVEN_HOME%" (
            xcopy /E /Y /Q "%%D\*" "%MAVEN_HOME%\" >NUL
            rmdir /S /Q "%%D" 2>NUL
        )
    )
)

if not exist "%MVN_CMD%" (
    echo ERROR: Maven installation failed. mvn.cmd not found at %MVN_CMD%
    exit /B 1
)

echo Maven %MAVEN_VERSION% installed successfully.
echo.

:runMaven
@REM Run Maven with all arguments passed to this script
"%MVN_CMD%" %*
set EXIT_CODE=%ERRORLEVEL%

exit /B %EXIT_CODE%
