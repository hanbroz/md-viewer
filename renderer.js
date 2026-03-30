import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';

// mermaid is loaded as a global via script tag (pre-built browser bundle)
const mermaid = window.mermaid;
mermaid.initialize({ startOnLoad: false, theme: 'default' });

const renderer = new marked.Renderer();
const originalCode = renderer.code.bind(renderer);

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

window.electronAPI.onLoadFolder((files, folderPath, lastFilePath) => {
    const fileList = document.getElementById('file-list');
    
    sidebar.style.display = 'flex';
    resizer.style.display = 'block';
    document.getElementById('sidebar-header').innerText = folderPath;
    
    fileList.innerHTML = '';
    fileItems = [];
    currentFocusedIndex = -1;
    currentActiveLi = null;
    
    let activeIndexToSet = 0;
    
    files.forEach((file, index) => {
        const li = document.createElement('li');
        li.innerText = file.name;
        li.title = file.name;
        
        if (lastFilePath && lastFilePath === file.path) {
            activeIndexToSet = index;
            li.classList.add('active');
            currentActiveLi = li;
        }
        
        li.addEventListener('click', () => {
            if (currentActiveLi) {
                currentActiveLi.classList.remove('active');
            }
            li.classList.add('active');
            currentActiveLi = li;
            setFocusedIndex(index);
            
            // Request markdown content
            window.electronAPI.requestFile(file.path);
        });
        
        fileList.appendChild(li);
        fileItems.push(li);
    });
    
    if (fileItems.length > 0) {
        setFocusedIndex(activeIndexToSet);
        // Automatically request the file if not already loaded (e.g opening folder directly)
        if (!lastFilePath) {
            fileItems[activeIndexToSet].click();
        } else {
            // just scroll into view if it was matched
            fileItems[activeIndexToSet].scrollIntoView({ block: 'nearest' });
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
