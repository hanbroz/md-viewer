const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const ROOT = path.join(__dirname, '..');
const RELEASE = path.join(ROOT, 'release');
const SOURCE = path.join(RELEASE, 'MD Viewer-win32-x64');
// Temporarily rename to a cleaner name so recipients see "MD Viewer/" after extraction.
const CLEAN_NAME = path.join(RELEASE, 'MD Viewer');
const OUTPUT = path.join(RELEASE, `MD-Viewer-Portable-${pkg.version}.zip`);

// Recovery: if a previous run crashed mid-rename, restore the canonical folder name.
if (fs.existsSync(CLEAN_NAME) && !fs.existsSync(SOURCE)) {
    console.log('[build-portable-zip] Recovering from interrupted previous run...');
    fs.renameSync(CLEAN_NAME, SOURCE);
}

if (!fs.existsSync(SOURCE)) {
    console.error(`\n[ERROR] Packaged app not found at:\n  ${SOURCE}\n`);
    console.error('Run `npm run build` first to generate the electron-packager output.\n');
    process.exit(1);
}

if (fs.existsSync(OUTPUT)) {
    fs.unlinkSync(OUTPUT);
    console.log(`[build-portable-zip] Removed existing: ${path.basename(OUTPUT)}`);
}

// If the clean-name target already exists (leftover), remove it before renaming.
if (fs.existsSync(CLEAN_NAME)) {
    fs.rmSync(CLEAN_NAME, { recursive: true, force: true });
}

let renamed = false;
try {
    fs.renameSync(SOURCE, CLEAN_NAME);
    renamed = true;

    console.log(`[build-portable-zip] Source: ${CLEAN_NAME}`);
    console.log(`[build-portable-zip] Output: ${OUTPUT}`);
    console.log(`[build-portable-zip] Compressing (30-90s expected)...`);

    const start = Date.now();
    const result = spawnSync('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        `Compress-Archive -Path '${CLEAN_NAME}' -DestinationPath '${OUTPUT}' -CompressionLevel Optimal`
    ], { stdio: 'inherit' });

    if (result.status !== 0) {
        throw new Error(`Compress-Archive exited with status ${result.status}`);
    }

    const sizeMB = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n[build-portable-zip] Done in ${elapsed}s — ${sizeMB} MB`);
    console.log(`\n=== Distribute this file ===`);
    console.log(`  ${OUTPUT}`);
    console.log(`\nRecipients: unzip -> double-click "MD Viewer.exe" inside the extracted folder.`);
} finally {
    // Always restore the canonical folder name so subsequent electron-packager runs work.
    if (renamed && fs.existsSync(CLEAN_NAME)) {
        fs.renameSync(CLEAN_NAME, SOURCE);
    }
}
