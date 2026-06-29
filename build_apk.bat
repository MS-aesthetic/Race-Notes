@echo off
set JAVA_HOME=C:\PROGRA~1\Android\ANDROI~1\jbr
set PATH=%JAVA_HOME%\bin;%PATH%
cd /d C:\Users\maxx\antigravity\Race-Notes\android
call gradlew.bat assembleDebug > C:\Users\maxx\antigravity\Race-Notes\gradle_build.log 2>&1
