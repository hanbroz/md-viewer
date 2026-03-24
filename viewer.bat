@echo off
set "DIR=%~dp0"
pushd "%DIR%"

:: If no args, run simply. If args, quote them properly
if "%~1"=="" (
    npx electron .
) else (
    npx electron . "%~dpnx1"
)

popd
