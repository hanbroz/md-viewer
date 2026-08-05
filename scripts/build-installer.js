const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'installer', 'MDViewer.iss');
const PACKAGED = path.join(ROOT, 'release', 'MD Viewer-win32-x64');

// Guard: packaged app folder must exist (run `npm run build` first).
if (!fs.existsSync(PACKAGED)) {
    console.error(`\n[ERROR] Packaged app not found at:\n  ${PACKAGED}\n`);
    console.error('Run `npm run build` first to generate the electron-packager output.\n');
    process.exit(1);
}

// Locate Inno Setup compiler. Default path works for standard installs.
// Override via INNO_COMPILER env var if installed elsewhere.
const candidates = [
    process.env.INNO_COMPILER,
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
].filter(Boolean);

const iscc = candidates.find(p => fs.existsSync(p));

if (!iscc) {
    console.error('\n[ERROR] Inno Setup compiler (ISCC.exe) not found.\n');
    console.error('Install Inno Setup 6 from: https://jrsoftware.org/isdl.php');
    console.error('Or set INNO_COMPILER env var to the ISCC.exe path.\n');
    process.exit(1);
}

console.log(`[build-installer] ISCC: ${iscc}`);
console.log(`[build-installer] Version: ${pkg.version}`);
console.log(`[build-installer] Script: ${SCRIPT}\n`);

const result = spawnSync(iscc, [`/DMyAppVersion=${pkg.version}`, SCRIPT], {
    stdio: 'inherit',
    cwd: ROOT,
});

process.exit(result.status ?? 1);
