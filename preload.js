const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	createNewTab: (url) => ipcRenderer.send('create-tab', url),
	navigateTo: (url) => ipcRenderer.send('navigate-active-tab', url),
	onUpdateTabs: (callback) => ipcRenderer.on('update-tabs', (e, tabs, activeId) => callback(tabs, activeId)),
	switchTab: (id) => ipcRenderer.send('switch-tab', id),
	closeTab: (id) => ipcRenderer.send('close-tab', id),
	goBack: () => ipcRenderer.send('go-back'),
	goForward: () => ipcRenderer.send('go-forward'),
	reloadPage: () => ipcRenderer.send('reload-page'),
	onUpdateUrl: (callback) => ipcRenderer.on('update-url', (e, url) => callback(url)),
	setDarkMode: (enableDark) => ipcRenderer.send('set-dark-mode', enableDark),
	showSettingsModal: () => ipcRenderer.send('settings-opened'),
	hideSettingsModal: () => ipcRenderer.send('settings-closed'),
	onApplyDarkMode: (callback) => ipcRenderer.on('apply-dark-mode', (e, enableDark) => callback(enableDark))
});
