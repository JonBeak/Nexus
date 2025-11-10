@echo off
REM Nexus Folder Opener - Windows Protocol Installer (C# Version)
REM Registers the nexus:// protocol in Windows Registry
REM MUST be run as Administrator

REM Change to the directory where this batch file is located
cd /d "%~dp0"

echo ================================================
echo   Nexus Folder Opener - Protocol Installer
echo ================================================
echo.

REM Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires Administrator privileges!
    echo.
    echo Please:
    echo 1. Right-click this file
    echo 2. Select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo Running with Administrator privileges... OK
echo.

REM Check if exe exists
IF NOT EXIST "nexus-folder-opener.exe" (
    echo ERROR: nexus-folder-opener.exe not found!
    echo.
    echo Please run build.bat first to compile the application.
    echo.
    pause
    exit /b 1
)

REM Installation directory
SET INSTALL_DIR=C:\Program Files\Nexus
SET EXE_PATH=%INSTALL_DIR%\nexus-folder-opener.exe

echo Installation directory: %INSTALL_DIR%
echo.

REM Create directory
echo Creating installation directory...
IF NOT EXIST "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
    echo   Created: %INSTALL_DIR%
) ELSE (
    echo   Already exists: %INSTALL_DIR%
)
echo.

REM Copy executable
echo Copying executable...
copy /Y "nexus-folder-opener.exe" "%EXE_PATH%" >nul
IF ERRORLEVEL 1 (
    echo   ERROR: Failed to copy executable
    pause
    exit /b 1
)
echo   Copied to: %EXE_PATH%
echo.

REM Register protocol in registry
echo Registering nexus:// protocol...

REM Create registry entries
reg add "HKEY_CLASSES_ROOT\nexus" /ve /d "URL:Nexus Protocol" /f >nul
reg add "HKEY_CLASSES_ROOT\nexus" /v "URL Protocol" /d "" /f >nul
reg add "HKEY_CLASSES_ROOT\nexus\DefaultIcon" /ve /d "\"%EXE_PATH%\",1" /f >nul
reg add "HKEY_CLASSES_ROOT\nexus\shell" /f >nul
reg add "HKEY_CLASSES_ROOT\nexus\shell\open" /f >nul
reg add "HKEY_CLASSES_ROOT\nexus\shell\open\command" /ve /d "\"%EXE_PATH%\" \"%%1\"" /f >nul

IF ERRORLEVEL 1 (
    echo   ERROR: Failed to register protocol
    pause
    exit /b 1
)

echo   Protocol registered successfully
echo.

REM Success message
echo ================================================
echo   INSTALLATION COMPLETE!
echo ================================================
echo.
echo The nexus:// protocol is now registered.
echo You can now use "Open Folder" buttons in the Nexus web app!
echo.
echo Test it by running:
echo   start nexus://open?path=C:\Windows
echo.
echo OR just click an "Open Folder" button in the web app!
echo.
pause
