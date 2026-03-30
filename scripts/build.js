const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Clean and create dist/
if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true });
}
fs.mkdirSync(DIST, { recursive: true });

// 1. Copy CSS files
const cssFiles = [
    { src: 'node_modules/github-markdown-css/github-markdown.css', dest: 'github-markdown.css' },
    { src: 'node_modules/highlight.js/styles/github.css', dest: 'hljs-github.css' },
];
for (const { src, dest } of cssFiles) {
    fs.copyFileSync(path.join(ROOT, src), path.join(DIST, dest));
    console.log(`Copied: ${src} -> dist/${dest}`);
}

// 2. Copy mermaid browser bundle (too large to re-bundle, already browser-ready)
fs.copyFileSync(
    path.join(ROOT, 'node_modules/mermaid/dist/mermaid.min.js'),
    path.join(DIST, 'mermaid.min.js')
);
console.log('Copied: mermaid.min.js -> dist/mermaid.min.js');

// 3. Bundle renderer.js with marked + highlight.js using esbuild
console.log('Bundling renderer.js...');
execSync(
    'npx esbuild renderer.js --bundle --outfile=dist/renderer.bundle.js --format=esm --platform=browser --minify --external:mermaid',
    { cwd: ROOT, stdio: 'inherit' }
);

console.log('\nBuild complete! Files in dist/:');
fs.readdirSync(DIST).forEach(f => {
    const size = (fs.statSync(path.join(DIST, f)).size / 1024).toFixed(1);
    console.log(`  ${f} (${size} KB)`);
});
