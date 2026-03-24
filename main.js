const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// --- Config Management ---
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'viewer-config.json');

function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
    } catch (e) { console.error('Error loading config', e); }
    return {};
}

function saveConfig(config) {
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch (e) { console.error('Error saving config', e); }
}

let appConfig = loadConfig();

function updateConfig(key, value) {
    appConfig[key] = value;
    saveConfig(appConfig);
}
// -------------------------

function openFile() {
    dialog.showOpenDialog(mainWindow, {
        title: 'Open Markdown File',
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    }).then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
            loadFileAndItsFolder(result.filePaths[0]);
        }
    });
}

function openFolder() {
    dialog.showOpenDialog(mainWindow, {
        title: 'Open Folder',
        properties: ['openDirectory']
    }).then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
            loadFolder(result.filePaths[0]);
            updateConfig('lastFile', null); // clear last file since a full folder changed
        }
    });
}

function loadFileAndItsFolder(filePath) {
    if (!fs.existsSync(filePath)) return;
    
    updateConfig('lastFile', filePath);
    
    const content = fs.readFileSync(filePath, 'utf8');
    mainWindow.webContents.send('load-markdown', content);
    
    // Also load its folder
    const folderPath = path.dirname(filePath);
    loadFolder(folderPath);
}

function loadFolder(folderPath) {
    if (!fs.existsSync(folderPath)) return;
    
    updateConfig('lastFolder', folderPath);
    
    fs.readdir(folderPath, (err, files) => {
        if (err) return;
        
        // Filter markdown files
        const mdFiles = files.filter(f => f.endsWith('.md') || f.endsWith('.markdown')).map(f => {
            return {
                name: f,
                path: path.join(folderPath, f)
            };
        });
        
        mainWindow.webContents.send('load-folder', mdFiles, folderPath, appConfig.lastFile);
    });
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open File...',
                    accelerator: 'CmdOrCtrl+O',
                    click: openFile
                },
                {
                    label: 'Open Folder...',
                    accelerator: 'CmdOrCtrl+Shift+O',
                    click: openFolder
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function createWindow() {
    let bounds = appConfig.windowBounds || { width: 1200, height: 800 };

    mainWindow = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    createMenu();

    mainWindow.loadFile('index.html');
    
    // Save window size on exit
    mainWindow.on('close', () => {
        updateConfig('windowBounds', mainWindow.getBounds());
    });

    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('init-config', appConfig.sidebarWidth || 250);

        let mdPath = null;
        for (const arg of process.argv.slice(1)) {
            if ((arg.endsWith('.md') || arg.endsWith('.markdown')) && fs.existsSync(arg)) {
                mdPath = arg;
                break;
            }
        }
        
        if (mdPath) {
            loadFileAndItsFolder(mdPath);
        } else if (appConfig.lastFile && fs.existsSync(appConfig.lastFile)) {
            loadFileAndItsFolder(appConfig.lastFile);
        } else if (appConfig.lastFolder && fs.existsSync(appConfig.lastFolder)) {
            loadFolder(appConfig.lastFolder);
            const initialContent = '# Welcome to the Markdown Viewer!\n\nNo file selected. Please choose a file from the sidebar.';
            mainWindow.webContents.send('load-markdown', initialContent);
        } else {
            const initialContent = '# Welcome to the Markdown Viewer!\n\nNo .md file was given as an argument.\n\nYou can use **File > Open File...** or **File > Open Folder...** to begin.';
            mainWindow.webContents.send('load-markdown', initialContent);
        }
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Communications
ipcMain.on('save-sidebar-width', (event, width) => {
    updateConfig('sidebarWidth', width);
});

ipcMain.on('request-file', (event, filePath) => {
    if (fs.existsSync(filePath)) {
        updateConfig('lastFile', filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        event.sender.send('load-markdown', content);
    }
});

ipcMain.on('print-to-pdf', async (event) => {
    try {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save PDF',
            defaultPath: appConfig.lastFile ? path.basename(appConfig.lastFile, path.extname(appConfig.lastFile)) + '.pdf' : 'export.pdf',
            filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
        });
        
        if (filePath) {
            const data = await mainWindow.webContents.printToPDF({
                printBackground: true,
                pageSize: 'A4'
            });
            fs.writeFileSync(filePath, data);
            event.sender.send('export-status', `Saved PDF to ${filePath}`);
        }
    } catch (e) {
        console.error(e);
        event.sender.send('export-status', `Error saving PDF: ${e.message}`);
    }
});

ipcMain.on('print-document', (event) => {
    mainWindow.webContents.print({ printBackground: true }, (success, failureReason) => {
        if (!success && failureReason !== 'cancelled') {
            console.error('Print failed:', failureReason);
        }
    });
});

ipcMain.on('save-to-html', async (event, htmlContent) => {
    try {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save HTML',
            defaultPath: appConfig.lastFile ? path.basename(appConfig.lastFile, path.extname(appConfig.lastFile)) + '.html' : 'export.html',
            filters: [{ name: 'HTML Files', extensions: ['html'] }]
        });
        
        if (filePath) {
            const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Exported Markdown</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css">
    <style>body { padding: 40px; } .markdown-body { max-width: 900px; margin: 0 auto; }</style>
</head>
<body class="markdown-body">
<div id="content">${htmlContent}</div>
<script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true });
    setTimeout(() => {
        mermaid.run({ querySelector: '.mermaid' });
    }, 100);
</script>
</body>
</html>`;
            fs.writeFileSync(filePath, fullHtml);
            event.sender.send('export-status', `Saved HTML to ${filePath}`);
        }
    } catch (e) {
        console.error(e);
        event.sender.send('export-status', `Error saving HTML: ${e.message}`);
    }
});
