import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

// Note: marked v17 removed the highlight callback.
// Syntax highlighting is applied after rendering via hljs.highlightElement().

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
