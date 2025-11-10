@echo off
REM Build script for Nexus Folder Opener (C# version)
REM Compiles to a Windows GUI application - no console window

echo ================================================
echo   Building Nexus Folder Opener (C# Version)
echo ================================================
echo.

REM Find the C# compiler (csc.exe)
REM It's included with .NET Framework (built into Windows)

SET CSC_PATH=
FOR /D %%G IN ("%SystemRoot%\Microsoft.NET\Framework\v4*") DO SET CSC_PATH=%%G\csc.exe

IF NOT EXIST "%CSC_PATH%" (
    echo ERROR: C# compiler not found!
    echo.
    echo The .NET Framework should be installed by default on Windows.
    echo If it's missing, download it from:
    echo https://dotnet.microsoft.com/download/dotnet-framework
    echo.
    pause
    exit /b 1
)

echo Found C# compiler: %CSC_PATH%
echo.

REM Compile the application
REM /target:winexe = Windows GUI application (no console)
REM /out: = Output file name
REM /reference: = Required assemblies

echo Compiling...
"%CSC_PATH%" /target:winexe ^
    /out:nexus-folder-opener.exe ^
    /reference:System.dll ^
    /reference:System.Web.dll ^
    /reference:System.Windows.Forms.dll ^
    NexusFolderOpener.cs

IF ERRORLEVEL 1 (
    echo.
    echo ================================================
    echo   BUILD FAILED!
    echo ================================================
    pause
    exit /b 1
)

echo.
echo ================================================
echo   BUILD SUCCESSFUL!
echo ================================================
echo.
echo Output: nexus-folder-opener.exe

REM Show file size
FOR %%A IN (nexus-folder-opener.exe) DO (
    SET SIZE=%%~zA
)
echo Size: %SIZE% bytes
echo.

REM Check if file exists and show next steps
IF EXIST nexus-folder-opener.exe (
    echo Next steps:
    echo 1. Run: install-csharp.bat ^(as Administrator^)
    echo 2. Test in your web app
    echo.
) ELSE (
    echo WARNING: Output file not found!
)

pause
