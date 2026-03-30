const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    onInitConfig: (callback) => ipcRenderer.on('init-config', (event, width) => callback(width)),
    onLoadMarkdown: (callback) => ipcRenderer.on('load-markdown', (event, content) => callback(content)),
    onLoadFolder: (callback) => ipcRenderer.on('load-folder', (event, files, folderPath, lastFile) => callback(files, folderPath, lastFile)),
    onExportStatus: (callback) => ipcRenderer.on('export-status', (event, status) => callback(status)),
    requestFile: (filePath) => ipcRenderer.send('request-file', filePath),
    saveSidebarWidth: (width) => ipcRenderer.send('save-sidebar-width', width),
    printToPdf: () => ipcRenderer.send('print-to-pdf'),
    printDocument: () => ipcRenderer.send('print-document'),
    saveToHtml: (htmlContent) => ipcRenderer.send('save-to-html', htmlContent),
    findInPage: (text, options) => ipcRenderer.send('find-in-page', text, options),
    stopFindInPage: () => ipcRenderer.send('stop-find-in-page'),
    onFindResult: (callback) => ipcRenderer.on('find-result', (event, result) => callback(result)),
    onToggleSearch: (callback) => ipcRenderer.on('toggle-search', () => callback())
});
