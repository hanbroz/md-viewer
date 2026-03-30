@echo off
set "DIR=%~dp0"
pushd "%DIR%"

:: Auto-build if dist/ is missing
if not exist "dist\renderer.bundle.js" (
    echo Building renderer...
    npm run build:renderer
)

:: If no args, run simply. If args, quote them properly
if "%~1"=="" (
    npx electron .
) else (
    npx electron . "%~dpnx1"
)

popd
