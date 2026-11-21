@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "NODE_EXE="
if exist "runtime\node.exe" set "NODE_EXE=runtime\node.exe"
if defined NODE_EXE goto run

for %%I in (node.exe) do if not "%%~$PATH:I"=="" set "NODE_EXE=%%~$PATH:I"
if defined NODE_EXE goto run

set "DSH_NODE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
if exist "%DSH_NODE%" set "NODE_EXE=%DSH_NODE%"
if defined NODE_EXE goto run

echo.
echo   Node runtime not found.
echo   Please make sure runtime\node.exe exists in this folder.
echo.
pause
exit /b 1

:run
"%NODE_EXE%" server.mjs
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo   The server exited with an error. Press any key to close.
pause
exit /b 1
