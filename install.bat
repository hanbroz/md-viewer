@echo off
set "DIR=%~dp0"
set "EXE_PATH=%DIR%release-builds\MarkdownViewer-win32-x64\MarkdownViewer.exe"

echo Installing Markdown Viewer (.exe version)...

:: Add to registry for current user
reg add "HKCU\Software\Classes\.md\shell\OpenWithMarkdownViewer" /ve /d "Open with Markdown Viewer" /f
reg add "HKCU\Software\Classes\.md\shell\OpenWithMarkdownViewer\command" /ve /d "\"%EXE_PATH%\" \"%%1\"" /f

echo.
echo ==============================================
echo Installation Complete!
echo You can now Right-Click any .md file and
echo select "Open with Markdown Viewer"
echo The real .exe is located in:
echo %EXE_PATH%
echo ==============================================
echo.
pause
