const fs = require('fs');
const path = require('path');

const PKG_PATH = path.join(__dirname, '..', 'package.json');

function formatTimestamp(date = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    const ymd = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('.');
    const hms = [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('');
    return `${ymd}.${hms}`;
}

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
const oldVersion = pkg.version;
const newVersion = formatTimestamp();

if (oldVersion === newVersion) {
    // Rare: stamping within the same second as the previous stamp. Skip to avoid redundant Git noise.
    console.log(`[stamp-version] already current (${newVersion}) — no change`);
    process.exit(0);
}

pkg.version = newVersion;
// Preserve 2-space indentation and trailing newline to avoid spurious diffs.
fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');

console.log(`[stamp-version] ${oldVersion} -> ${newVersion}`);
