@echo off
"%JAVA_HOME%\bin\java.exe" -jar "%BACKEND_DIR%\target\tasfb2b.war" --spring.profiles.active=dev >> "%BACKEND_LOG%" 2>&1
