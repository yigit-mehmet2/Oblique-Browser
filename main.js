const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');

const darkReaderPath = require.resolve('darkreader/darkreader.js');
const darkReaderCode = fs.readFileSync(darkReaderPath, 'utf8');

let win = null;
let tabs = [];
let activeTabId = null;
let isDarkMode = true;

const TOP_BAR_HEIGHT = 85;

function sendTabsToRenderer() {
    if (!win || win.isDestroyed()) return;
    const tabList = tabs.map(t => ({ id: t.id, title: t.title }));
    win.webContents.send('update-tabs', tabList, activeTabId);
}

function updateActiveViewBounds() {
    if (!win || win.isDestroyed()) return;
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.view && !activeTab.view.webContents.isDestroyed()) {
        const [width, height] = win.getContentSize();
        activeTab.view.setBounds({
            x: 0,
            y: TOP_BAR_HEIGHT,
            width: width,
            height: Math.max(0, height - TOP_BAR_HEIGHT)
        });
    }
}

function applyDarkReaderToView(view, enable) {
    if (!view || view.webContents.isDestroyed()) return;

    const script = `
        (function() {
            function toggleDarkReader() {
                if (typeof DarkReader !== 'undefined') {
                    if (${enable}) {
                        DarkReader.setFetchMethod(window.fetch);
                        DarkReader.enable({
                            brightness: 100,
                            contrast: 100,
                            sepia: 0
                        });
                    } else {
                        DarkReader.disable();
                    }
                }
            }

            if (typeof DarkReader === 'undefined') {
                ${darkReaderCode}
            }
            toggleDarkReader();
        })();
    `;

    view.webContents.executeJavaScript(script)
        .catch(err => console.error('DarkReader enjeksiyon hatası:', err));
}

function createWindow() {
    win = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('index.html');

    win.on('resize', () => {
        updateActiveViewBounds();
    });

    win.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && (input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r'))) {
            const activeTab = tabs.find(t => t.id === activeTabId);
            if (activeTab && activeTab.view && !activeTab.view.webContents.isDestroyed()) {
                activeTab.view.webContents.reload();
            }
            event.preventDefault();
        }
    });
}

ipcMain.on('set-dark-mode', (event, enableDark) => {
    isDarkMode = enableDark;

    tabs.forEach(tab => {
        if (tab.view && !tab.view.webContents.isDestroyed()) {
            applyDarkReaderToView(tab.view, isDarkMode);
        }
    });
});

ipcMain.on('navigate-active-tab', (event, url) => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.view && !activeTab.view.webContents.isDestroyed()) {
        activeTab.view.webContents.loadURL(url);
    }
});

ipcMain.on('create-tab', (event, url) => {
    if (!win) return;

    const view = new BrowserView({
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            backgroundThrottling: true,
            spellcheck: false
        }
    });

    view.setBackgroundColor('#1e1e1e');

    const tabId = Date.now().toString();
    const tabObj = { id: tabId, view: view, title: 'Yeni Sekme' };
    tabs.push(tabObj);

    activeTabId = tabId;
    win.setBrowserView(view);

    view.setAutoResize({ width: true, height: true });
    updateActiveViewBounds();

    if (url) {
        view.webContents.loadURL(url);
    }

    view.webContents.on('dom-ready', () => {
        if (isDarkMode) {
            applyDarkReaderToView(view, true);
        }
    });

    view.webContents.on('page-title-updated', (e, title) => {
        tabObj.title = title || 'Yeni Sekme';
        sendTabsToRenderer();
    });

    const updateUrlHandler = (e, newUrl) => {
        if (tabObj.id === activeTabId && win && !win.isDestroyed()) {
            win.webContents.send('update-url', newUrl);
        }
    };

    view.webContents.on('did-navigate', updateUrlHandler);
    view.webContents.on('did-navigate-in-page', updateUrlHandler);

    view.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && (input.key === 'F5' || ((input.control || input.meta) && input.key.toLowerCase() === 'r'))) {
            view.webContents.reload();
            event.preventDefault();
        }
    });

    sendTabsToRenderer();
});

ipcMain.on('switch-tab', (event, id) => {
    const targetTab = tabs.find(t => t.id === id);
    if (!targetTab || !win) return;

    activeTabId = id;
    win.setBrowserView(targetTab.view);
    updateActiveViewBounds();

    win.webContents.send('update-url', targetTab.view.webContents.getURL());
    sendTabsToRenderer();
});

ipcMain.on('close-tab', (event, id) => {
    const index = tabs.findIndex(t => t.id === id);
    if (index === -1) return;

    const [removedTab] = tabs.splice(index, 1);

    if (win && win.getBrowserView() === removedTab.view) {
        win.setBrowserView(null);
    }

    if (removedTab.view && !removedTab.view.webContents.isDestroyed()) {
        removedTab.view.webContents.destroy();
        removedTab.view = null;
    }

    if (tabs.length > 0) {
        if (activeTabId === id) {
            const newIndex = Math.max(0, index - 1);
            const newActiveTab = tabs[newIndex];
            activeTabId = newActiveTab.id;
            if (win) {
                win.setBrowserView(newActiveTab.view);
                updateActiveViewBounds();
                win.webContents.send('update-url', newActiveTab.view.webContents.getURL());
            }
        }
    } else {
        activeTabId = null;
        if (win && !win.isDestroyed()) {
            win.webContents.send('update-url', '');
        }
    }

    sendTabsToRenderer();
});

ipcMain.on('go-back', () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.view && !activeTab.view.webContents.isDestroyed()) {
        if (activeTab.view.webContents.navigationHistory?.canGoBack()) {
            activeTab.view.webContents.navigationHistory.goBack();
        } else if (activeTab.view.webContents.canGoBack()) {
            activeTab.view.webContents.canGoBack() && activeTab.view.webContents.goBack();
        }
    }
});

ipcMain.on('go-forward', () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.view && !activeTab.view.webContents.isDestroyed()) {
        if (activeTab.view.webContents.navigationHistory?.canGoForward()) {
            activeTab.view.webContents.navigationHistory.goForward();
        } else if (activeTab.view.webContents.canGoForward()) {
            activeTab.view.webContents.canGoForward() && activeTab.view.webContents.goForward();
        }
    }
});

ipcMain.on('reload-page', () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.view && !activeTab.view.webContents.isDestroyed()) {
        activeTab.view.webContents.reload();
    }
});

ipcMain.on('settings-opened', () => {
    if (win && !win.isDestroyed()) {
        win.setBrowserView(null);
    }
});

ipcMain.on('settings-closed', () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (win && !win.isDestroyed() && activeTab && activeTab.view) {
        win.setBrowserView(activeTab.view);
        updateActiveViewBounds();
    }
});

app.whenReady().then(createWindow);

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});