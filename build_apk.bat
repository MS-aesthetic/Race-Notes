cd /d "C:\Users\maxx\antigravity\Race-Notes\android"
set JAVA_HOME=C:\PROGRA~1\Android\ANDROI~1\jbr
set PATH=%JAVA_HOME%\bin;%PATH%
call gradlew.bat assembleDebug > ..\gradle_build.log 2>&1
echo BUILD_DONE=%ERRORLEVEL% >> ..\gradle_build.log
