import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';

// mermaid is loaded as a global via script tag (pre-built browser bundle)
const mermaid = window.mermaid;
mermaid.initialize({ startOnLoad: false, theme: 'default' });

const renderer = new marked.Renderer();
const originalCode = renderer.code.bind(renderer);

// --- JSON Collapsible Tree ---
function htmlEsc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function jsonNodeHtml(val, depth) {
    if (val === null) return '<span class="jt-null">null</span>';
    switch (typeof val) {
        case 'boolean': return `<span class="jt-bool">${val}</span>`;
        case 'number': return `<span class="jt-num">${val}</span>`;
        case 'string': return `<span class="jt-str">${htmlEsc(JSON.stringify(val))}</span>`;
    }
    const pad = '  '.repeat(depth);
    const inner = '  '.repeat(depth + 1);
    if (Array.isArray(val)) {
        if (!val.length) return '<span class="jt-bracket">[]</span>';
        let h = '<span class="jt-toggle">▼</span><span class="jt-bracket">[</span>';
        h += `<span class="jt-dots"> …${val.length} </span>`;
        h += '<span class="jt-block">\n';
        val.forEach((item, i) => {
            h += inner + jsonNodeHtml(item, depth + 1);
            if (i < val.length - 1) h += ',';
            h += '\n';
        });
        h += pad + '</span><span class="jt-bracket">]</span>';
        return h;
    }
    const keys = Object.keys(val);
    if (!keys.length) return '<span class="jt-brace">{}</span>';
    let h = '<span class="jt-toggle">▼</span><span class="jt-brace">{</span>';
    h += `<span class="jt-dots"> …${keys.length} </span>`;
    h += '<span class="jt-block">\n';
    keys.forEach((key, i) => {
        h += inner + `<span class="jt-key">${htmlEsc(JSON.stringify(key))}</span>: `;
        h += jsonNodeHtml(val[key], depth + 1);
        if (i < keys.length - 1) h += ',';
        h += '\n';
    });
    h += pad + '</span><span class="jt-brace">}</span>';
    return h;
}

function renderJsonTree(parsed) {
    const tree = jsonNodeHtml(parsed, 0);
    return '<div class="json-viewer">'
        + '<div class="json-toolbar">'
        + '<button class="json-expand-all" title="모두 펴기">⊞ 모두 펴기</button>'
        + '<button class="json-collapse-all" title="모두 접기">⊟ 모두 접기</button>'
        + '</div>'
        + `<pre class="json-tree">${tree}</pre></div>`;
}

renderer.code = function(codeInfo) {
    let text, lang, isEscaped;
    if (typeof codeInfo === 'object') {
        text = codeInfo.text;
        lang = codeInfo.lang;
        isEscaped = codeInfo.escaped;
    } else {
        text = arguments[0];
        lang = arguments[1];
        isEscaped = arguments[2];
    }
    
    if (lang === 'mermaid') {
        return `<div class="mermaid">${text}</div>`;
    }

    if (lang === 'json') {
        try {
            const parsed = JSON.parse(text);
            if (parsed !== null && typeof parsed === 'object') {
                return renderJsonTree(parsed);
            }
        } catch(e) { /* invalid JSON, fall through to normal highlighting */ }
    }

    if (typeof codeInfo === 'object') {
        return originalCode(codeInfo);
    } else {
        return originalCode(text, lang, isEscaped);
    }
};

marked.setOptions({ renderer });

const sidebar = document.getElementById('sidebar');
const resizer = document.getElementById('resizer');

window.electronAPI.onInitConfig((savedSidebarWidth) => {
    if (savedSidebarWidth && savedSidebarWidth >= 150) {
        sidebar.style.width = savedSidebarWidth + 'px';
    }
});

window.electronAPI.onLoadMarkdown((markdownText) => {
    // Clear search highlights before replacing content
    searchMatches = [];
    currentMatchIndex = -1;
    lastSearchText = '';

    let html = '';
    try {
        html = marked.parse(markdownText);
    } catch(e) {
        console.error("Marked error: ", e);
        html = "<p>Error parsing markdown</p>";
    }

    document.getElementById('content-wrapper').scrollTop = 0;
    document.getElementById('content').innerHTML = html;

    // Apply syntax highlighting to all code blocks
    document.querySelectorAll('#content pre code').forEach((el) => {
        hljs.highlightElement(el);
    });

    document.getElementById('content-wrapper').focus();

    try {
        setTimeout(async () => {
            await mermaid.run({
                querySelector: '.mermaid'
            });
        }, 100);
    } catch (e) {
        console.error("Mermaid error:", e);
    }
});

let currentActiveLi = null;
let currentFocusedIndex = -1;
let fileItems = [];

// Build a nested tree structure from flat file paths
function buildTree(files) {
    const root = { children: {}, files: [] };
    files.forEach(file => {
        const parts = file.name.replace(/\\/g, '/').split('/');
        let node = root;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!node.children[parts[i]]) {
                node.children[parts[i]] = { children: {}, files: [] };
            }
            node = node.children[parts[i]];
        }
        node.files.push({ fileName: parts[parts.length - 1], path: file.path });
    });
    return root;
}

// Render tree recursively into a <ul>
function renderTree(node, container, depth, lastFilePath) {
    // Sort: folders first, then files
    const folderNames = Object.keys(node.children).sort((a, b) => a.localeCompare(b));
    const sortedFiles = node.files.sort((a, b) => a.fileName.localeCompare(b.fileName));

    folderNames.forEach(name => {
        const child = node.children[name];
        const li = document.createElement('li');

        const folderRow = document.createElement('div');
        folderRow.className = 'tree-folder';
        folderRow.style.paddingLeft = (8 + depth * 16) + 'px';
        folderRow.innerHTML = '<span class="tree-icon">▶</span><span class="folder-name">' + name + '</span>';

        const childUl = document.createElement('ul');
        childUl.className = 'tree-children';

        folderRow.addEventListener('click', () => {
            const isOpen = childUl.classList.toggle('open');
            folderRow.querySelector('.tree-icon').textContent = isOpen ? '▼' : '▶';
        });

        li.appendChild(folderRow);
        li.appendChild(childUl);
        container.appendChild(li);

        const hadActive = renderTree(child, childUl, depth + 1, lastFilePath);
        // Auto-expand if the active file is inside this folder
        if (hadActive) {
            childUl.classList.add('open');
            folderRow.querySelector('.tree-icon').textContent = '▼';
        }
    });

    let hasActive = false;
    sortedFiles.forEach(file => {
        const li = document.createElement('li');
        li.className = 'tree-file';
        li.style.paddingLeft = (8 + depth * 16) + 'px';
        li.innerText = file.fileName;
        li.title = file.path;

        const idx = fileItems.length;

        if (lastFilePath && lastFilePath === file.path) {
            li.classList.add('active');
            currentActiveLi = li;
            currentFocusedIndex = idx;
            hasActive = true;
        }

        li.addEventListener('click', () => {
            if (currentActiveLi) currentActiveLi.classList.remove('active');
            li.classList.add('active');
            currentActiveLi = li;
            setFocusedIndex(idx);
            window.electronAPI.requestFile(file.path);
        });

        container.appendChild(li);
        fileItems.push(li);
    });

    return hasActive || folderNames.some(name => {
        // check if any child subtree had active (already expanded above)
        return container.querySelector('.tree-children.open') !== null;
    });
}

window.electronAPI.onLoadFolder((files, folderPath, lastFilePath) => {
    const fileList = document.getElementById('file-list');

    sidebar.style.display = 'flex';
    resizer.style.display = 'block';
    document.getElementById('sidebar-header').innerText = folderPath;

    fileList.innerHTML = '';
    fileItems = [];
    currentFocusedIndex = -1;
    currentActiveLi = null;

    const tree = buildTree(files);
    renderTree(tree, fileList, 0, lastFilePath);

    if (fileItems.length > 0) {
        if (currentFocusedIndex < 0) currentFocusedIndex = 0;
        setFocusedIndex(currentFocusedIndex);
        if (!lastFilePath) {
            fileItems[0].click();
        } else if (currentActiveLi) {
            currentActiveLi.scrollIntoView({ block: 'nearest' });
        }
    }
    sidebar.focus();
});

function setFocusedIndex(index) {
    if (currentFocusedIndex >= 0 && currentFocusedIndex < fileItems.length) {
        fileItems[currentFocusedIndex].classList.remove('focused');
    }
    currentFocusedIndex = index;
    if (currentFocusedIndex >= 0 && currentFocusedIndex < fileItems.length) {
        fileItems[currentFocusedIndex].classList.add('focused');
        fileItems[currentFocusedIndex].scrollIntoView({ block: 'nearest' });
    }
}

// Keyboard Navigation for Sidebar
document.getElementById('sidebar').addEventListener('keydown', (e) => {
    if (fileItems.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentFocusedIndex < fileItems.length - 1) {
            setFocusedIndex(currentFocusedIndex + 1);
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentFocusedIndex > 0) {
            setFocusedIndex(currentFocusedIndex - 1);
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentFocusedIndex >= 0) {
            fileItems[currentFocusedIndex].click();
        }
    }
});

document.getElementById('sidebar').addEventListener('click', () => {
    document.getElementById('sidebar').focus();
});

// Resizer Logic
let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    if (newWidth > 150 && newWidth < 800) {
        sidebar.style.width = newWidth + 'px';
    }
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        
        // Save the new width
        const finalWidth = parseInt(sidebar.style.width, 10);
        if (!isNaN(finalWidth)) {
            window.electronAPI.saveSidebarWidth(finalWidth);
        }
    }
});

window.electronAPI.onExportStatus((statusMsg) => {
    document.getElementById('status').innerText = statusMsg;
    setTimeout(() => {
        document.getElementById('status').innerText = 'Ready';
    }, 5000);
});

document.getElementById('btn-print').addEventListener('click', () => {
    window.electronAPI.printDocument();
});

document.getElementById('btn-pdf').addEventListener('click', () => {
    document.getElementById('status').innerText = 'Generating PDF...';
    window.electronAPI.printToPdf();
});

document.getElementById('btn-html').addEventListener('click', () => {
    document.getElementById('status').innerText = 'Generating HTML...';
    const content = document.getElementById('content').innerHTML;
    window.electronAPI.saveToHtml(content);
});

// --- Search functionality (DOM-based) ---
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
const searchCount = document.getElementById('search-count');
const contentWrapper = document.getElementById('content-wrapper');
let searchActive = false;
let lastSearchText = '';
let searchMatches = [];
let currentMatchIndex = -1;

function clearHighlights() {
    const content = document.getElementById('content');
    content.querySelectorAll('mark.search-highlight').forEach(mark => {
        const parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
    });
    searchMatches = [];
    currentMatchIndex = -1;
}

function performSearch(text) {
    clearHighlights();
    if (!text) { updateSearchCount(); return; }

    const content = document.getElementById('content');
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    const lowerText = text.toLowerCase();

    textNodes.forEach(node => {
        const nodeText = node.textContent;
        const lowerNodeText = nodeText.toLowerCase();
        const fragments = [];
        let lastEnd = 0;
        let index = lowerNodeText.indexOf(lowerText, 0);

        while (index !== -1) {
            if (index > lastEnd) {
                fragments.push(document.createTextNode(nodeText.substring(lastEnd, index)));
            }
            const mark = document.createElement('mark');
            mark.className = 'search-highlight';
            mark.textContent = nodeText.substring(index, index + text.length);
            fragments.push(mark);
            searchMatches.push(mark);
            lastEnd = index + text.length;
            index = lowerNodeText.indexOf(lowerText, lastEnd);
        }

        if (fragments.length > 0) {
            if (lastEnd < nodeText.length) {
                fragments.push(document.createTextNode(nodeText.substring(lastEnd)));
            }
            const parent = node.parentNode;
            fragments.forEach(frag => parent.insertBefore(frag, node));
            parent.removeChild(node);
        }
    });

    if (searchMatches.length > 0) {
        currentMatchIndex = 0;
        activateCurrentMatch();
    }
    updateSearchCount();
}

function activateCurrentMatch() {
    searchMatches.forEach(m => m.classList.remove('search-active'));
    if (currentMatchIndex >= 0 && currentMatchIndex < searchMatches.length) {
        const current = searchMatches[currentMatchIndex];
        current.classList.add('search-active');
        current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function updateSearchCount() {
    if (searchMatches.length > 0) {
        searchCount.textContent = `${currentMatchIndex + 1} / ${searchMatches.length}`;
    } else {
        searchCount.textContent = searchInput.value.length > 0 ? '결과 없음' : '';
    }
}

function nextMatch() {
    if (searchMatches.length === 0) return;
    currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
    activateCurrentMatch();
    updateSearchCount();
}

function prevMatch() {
    if (searchMatches.length === 0) return;
    currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    activateCurrentMatch();
    updateSearchCount();
}

function openSearch() {
    searchBar.classList.add('visible');
    searchInput.focus();
    searchInput.select();
    searchActive = true;
}

function closeSearch() {
    searchBar.classList.remove('visible');
    searchInput.value = '';
    searchCount.textContent = '';
    lastSearchText = '';
    searchActive = false;
    clearHighlights();
    contentWrapper.focus();
}

// Ctrl+F shortcut (also triggered by menu)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        openSearch();
    }
    if (e.key === 'Escape' && searchActive) {
        e.preventDefault();
        closeSearch();
    }
});

window.electronAPI.onToggleSearch(() => {
    if (searchActive) {
        searchInput.focus();
        searchInput.select();
    } else {
        openSearch();
    }
});

// Enter = search or next, Shift+Enter = previous
searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const text = searchInput.value;
        if (text.length === 0) return;

        if (text !== lastSearchText) {
            lastSearchText = text;
            performSearch(text);
        } else {
            if (e.shiftKey) prevMatch(); else nextMatch();
        }
    }
});

document.getElementById('search-next').addEventListener('click', () => {
    const text = searchInput.value;
    if (text.length === 0) return;
    if (text !== lastSearchText) {
        lastSearchText = text;
        performSearch(text);
    } else {
        nextMatch();
    }
});

document.getElementById('search-prev').addEventListener('click', () => {
    const text = searchInput.value;
    if (text.length === 0) return;
    if (text !== lastSearchText) {
        lastSearchText = text;
        performSearch(text);
    } else {
        prevMatch();
    }
});

document.getElementById('search-close').addEventListener('click', closeSearch);

// --- JSON tree fold/unfold ---
function jtFindParts(toggle) {
    let el = toggle.nextElementSibling, dots = null, block = null;
    while (el) {
        if (el.classList.contains('jt-dots')) dots = el;
        if (el.classList.contains('jt-block')) { block = el; break; }
        el = el.nextElementSibling;
    }
    return { dots, block };
}

document.getElementById('content').addEventListener('click', (e) => {
    const t = e.target;
    if (t.classList.contains('jt-toggle')) {
        const { dots, block } = jtFindParts(t);
        if (!block) return;
        const show = block.style.display === 'none';
        block.style.display = show ? '' : 'none';
        if (dots) dots.style.display = show ? 'none' : '';
        t.textContent = show ? '▼' : '▶';
    } else if (t.classList.contains('json-collapse-all')) {
        t.closest('.json-viewer').querySelectorAll('.jt-toggle').forEach(tog => {
            const { dots, block } = jtFindParts(tog);
            if (!block) return;
            block.style.display = 'none';
            if (dots) dots.style.display = '';
            tog.textContent = '▶';
        });
    } else if (t.classList.contains('json-expand-all')) {
        t.closest('.json-viewer').querySelectorAll('.jt-toggle').forEach(tog => {
            const { dots, block } = jtFindParts(tog);
            if (!block) return;
            block.style.display = '';
            if (dots) dots.style.display = 'none';
            tog.textContent = '▼';
        });
    }
});

// --- Mermaid fullscreen viewer ---
const overlay = document.getElementById('mermaid-overlay');
const viewport = document.getElementById('mermaid-viewport');
const zoomInfo = document.getElementById('mermaid-zoom-info');
let mZoom = 1, mPanX = 0, mPanY = 0;
let mDragging = false, mDidDrag = false, mDragStartX = 0, mDragStartY = 0, mPanStartX = 0, mPanStartY = 0;

function mApplyTransform() {
    viewport.style.transform = `translate(${mPanX}px, ${mPanY}px) scale(${mZoom})`;
    zoomInfo.textContent = `${Math.round(mZoom * 100)}%  ·  Scroll: zoom  |  Drag: pan  |  +−0F: controls  |  Esc: close`;
}

function mPrepareSvg(svg) {
    // Force SVG to render at its viewBox size so we can scale it properly
    const vb = svg.getAttribute('viewBox');
    if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            svg.setAttribute('width', parts[2]);
            svg.setAttribute('height', parts[3]);
        }
    }
    // Remove all CSS size constraints from Mermaid
    svg.style.maxWidth = 'none';
    svg.style.maxHeight = 'none';
    svg.style.width = '';
    svg.style.height = '';
    svg.removeAttribute('style');
}

function mFitToScreen() {
    const svg = viewport.querySelector('svg');
    if (!svg) return;
    // Reset transform first
    mZoom = 1; mPanX = 0; mPanY = 0;
    viewport.style.transform = 'none';

    // Get the actual rendered size of the SVG
    const rect = svg.getBoundingClientRect();
    const sw = rect.width;
    const sh = rect.height;
    if (sw === 0 || sh === 0) return;

    const vw = window.innerWidth * 0.9;
    const vh = window.innerHeight * 0.85;
    mZoom = Math.min(vw / sw, vh / sh, 5);
    mPanX = (window.innerWidth - sw * mZoom) / 2;
    mPanY = (window.innerHeight - sh * mZoom) / 2;
    mApplyTransform();
}

function mOpenOverlay(mermaidEl) {
    viewport.innerHTML = mermaidEl.innerHTML;
    const svg = viewport.querySelector('svg');
    if (svg) mPrepareSvg(svg);
    mZoom = 1; mPanX = 0; mPanY = 0;
    overlay.classList.add('active');
    // Wait for layout to complete before fitting
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            mFitToScreen();
        });
    });
}

function mCloseOverlay() {
    overlay.classList.remove('active');
    overlay.classList.remove('grabbing');
    viewport.innerHTML = '';
    mDragging = false;
}

// Open on mermaid click
document.getElementById('content').addEventListener('click', (e) => {
    const mermaidEl = e.target.closest('.mermaid');
    if (mermaidEl && mermaidEl.querySelector('svg')) {
        mOpenOverlay(mermaidEl);
    }
});

// Close (only via close button or Esc key)
document.getElementById('mermaid-close').addEventListener('click', mCloseOverlay);

// Zoom buttons
document.getElementById('mermaid-zoom-in').addEventListener('click', () => {
    mZoom = Math.min(mZoom * 1.25, 10);
    mApplyTransform();
});
document.getElementById('mermaid-zoom-out').addEventListener('click', () => {
    mZoom = Math.max(mZoom / 1.25, 0.1);
    mApplyTransform();
});
document.getElementById('mermaid-zoom-reset').addEventListener('click', () => {
    const svg = viewport.querySelector('svg');
    if (!svg) return;
    // Get natural size by temporarily resetting transform
    viewport.style.transform = 'none';
    const rect = svg.getBoundingClientRect();
    mZoom = 1;
    mPanX = (window.innerWidth - rect.width) / 2;
    mPanY = (window.innerHeight - rect.height) / 2;
    mApplyTransform();
});
document.getElementById('mermaid-zoom-fit').addEventListener('click', mFitToScreen);

// Wheel zoom (centered on cursor)
overlay.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(0.1, Math.min(mZoom * factor, 10));
    const rect = overlay.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    mPanX = cx - (cx - mPanX) * (newZoom / mZoom);
    mPanY = cy - (cy - mPanY) * (newZoom / mZoom);
    mZoom = newZoom;
    mApplyTransform();
}, { passive: false });

// Pan with mouse drag
overlay.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    mDragging = true;
    mDidDrag = false;
    mDragStartX = e.clientX;
    mDragStartY = e.clientY;
    mPanStartX = mPanX;
    mPanStartY = mPanY;
    overlay.classList.add('grabbing');
});
document.addEventListener('mousemove', (e) => {
    if (!mDragging) return;
    const dx = e.clientX - mDragStartX;
    const dy = e.clientY - mDragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) mDidDrag = true;
    mPanX = mPanStartX + dx;
    mPanY = mPanStartY + dy;
    mApplyTransform();
});
document.addEventListener('mouseup', () => {
    if (mDragging) {
        mDragging = false;
        overlay.classList.remove('grabbing');
    }
});

// Keyboard shortcuts in overlay
document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('active')) return;
    if (e.key === 'Escape') { mCloseOverlay(); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') { mZoom = Math.min(mZoom * 1.25, 10); mApplyTransform(); }
    else if (e.key === '-') { mZoom = Math.max(mZoom / 1.25, 0.1); mApplyTransform(); }
    else if (e.key === '0') { document.getElementById('mermaid-zoom-reset').click(); }
    else if (e.key === 'f' || e.key === 'F') { mFitToScreen(); }
});
