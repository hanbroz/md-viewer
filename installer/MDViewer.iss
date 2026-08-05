; ============================================================
; MD Viewer - Inno Setup Installer Script
; ============================================================
; Build via Node wrapper:
;   npm run build:installer
; Or directly (from project root):
;   "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\MDViewer.iss
; ============================================================

#define MyAppName "MD Viewer"
#define MyAppPublisher "Developer"
#define MyAppExeName "MD Viewer.exe"
#define MyAppSourceDir "..\release\MD Viewer-win32-x64"

; Version is injected by scripts/build-installer.js at build time.
; Fallback value here is used only when ISCC is invoked directly.
#ifndef MyAppVersion
  #define MyAppVersion "2026.04.02.181946"
#endif

[Setup]
; AppId uniquely identifies this application across versions.
; NEVER change this value — doing so would make future installers
; fail to recognize previous installs (no clean upgrade path).
AppId={{A7F3D2E1-5C8B-4A9E-B6F2-3D1C7E8F9B4A}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\release
OutputBaseFilename=MD-Viewer-Setup-{#MyAppVersion}
SetupIconFile=..\mv_icon_minimal.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra
SolidCompression=yes
WizardStyle=modern

; Run per-user by default (no UAC), but let user pick "all users" if they want.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; 64-bit only — Electron x64 build won't run on x86 anyway.
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
; Desktop shortcut: default unchecked (Windows convention — user opts in)
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
; File association: default checked — this IS a markdown viewer after all
Name: "associate"; Description: ".md, .markdown 파일을 MD Viewer로 열기"; GroupDescription: "파일 연결:"

[Files]
; Recursively copy the entire electron-packager output.
; All runtime dependencies (Chromium, Node, node_modules) are already inside.
Source: "{#MyAppSourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Registry]
; Register .md and .markdown extensions with a ProgID.
; {autoclasses} resolves to HKLM or HKCU depending on install scope.
Root: {autoclasses}; Subkey: "MDViewer.markdown"; ValueType: string; ValueName: ""; ValueData: "Markdown Document"; Flags: uninsdeletekey; Tasks: associate
Root: {autoclasses}; Subkey: "MDViewer.markdown\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#MyAppExeName},0"; Tasks: associate
Root: {autoclasses}; Subkey: "MDViewer.markdown\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""; Tasks: associate
Root: {autoclasses}; Subkey: ".md\OpenWithProgids"; ValueType: string; ValueName: "MDViewer.markdown"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associate
Root: {autoclasses}; Subkey: ".markdown\OpenWithProgids"; ValueType: string; ValueName: "MDViewer.markdown"; ValueData: ""; Flags: uninsdeletevalue; Tasks: associate

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
