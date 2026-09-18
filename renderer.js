const goBtn = document.getElementById('go-btn');
const urlInput = document.getElementById('url-input');
const engineSelect = document.getElementById('search-engine-select');
const tabBar = document.getElementById('tab-bar');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');

const settingsModal = document.getElementById('settings-modal');
const btnSettings = document.getElementById('btn-settings');
const closeSettings = document.getElementById('close-settings');
const saveSettings = document.getElementById('save-settings-btn');
const settingEngine = document.getElementById('setting-engine');
const settingTheme = document.getElementById('setting-theme');

function getDefaultEngineUrl() {
	const engine = engineSelect ? engineSelect.value : 'duckduckgo';
	if (engine === 'bing') return 'https://www.bing.com';
	if (engine === 'google') return 'https://www.google.com';
	return 'https://duckduckgo.com';
}

function getSearchUrl(query, engine) {
	const encodedQuery = encodeURIComponent(query);

	if (engine === 'bing') {
		return `https://www.bing.com/search?q=${encodedQuery}`;
	}
	else if (engine === 'google') {
		return `https://www.google.com/search?q=${encodedQuery}`;
	} else {
		return `https://duckduckgo.com/?q=${encodedQuery}`;
	}
}

function navigate() {
	let input = urlInput.value.trim();
	if (!input) return;

	const isUrl = input.includes('.') && !input.includes(' ');
	let targetUrl = '';

	if (isUrl) {
		if (!input.startsWith('http://') && !input.startsWith('https://')) {
			input = 'https://' + input;
		}
		targetUrl = input;
	} else {
		const selectedEngine = engineSelect.value;
		targetUrl = getSearchUrl(input, selectedEngine);
	}

	window.electronAPI.navigateTo(targetUrl);
}

if (backBtn) backBtn.addEventListener('click', () => window.electronAPI.goBack());
if (forwardBtn) forwardBtn.addEventListener('click', () => window.electronAPI.goForward());
if (reloadBtn) reloadBtn.addEventListener('click', () => window.electronAPI.reloadPage());

if (goBtn) goBtn.addEventListener('click', navigate);

if (urlInput) {
	urlInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') {
			navigate();
		}
	});
}

function closeModal() {
	if (settingsModal) {
		settingsModal.classList.add('hidden');
		window.electronAPI.hideSettingsModal();
	}
}

if (btnSettings && settingsModal) {
	btnSettings.addEventListener('click', () => {
		settingsModal.classList.remove('hidden');
		window.electronAPI.showSettingsModal();
	});
}

if (closeSettings) {
	closeSettings.addEventListener('click', closeModal);
}

if (saveSettings) {
	saveSettings.addEventListener('click', () => {
		if (settingEngine && engineSelect) {
			engineSelect.value = settingEngine.value;
		}
		if (settingTheme) {
			const wantDark = (settingTheme.value === 'dark');
			window.electronAPI.setDarkMode(wantDark);
		}
		closeModal();
	});
}

window.addEventListener('click', (e) => {
	if (e.target === settingsModal) {
		closeModal();
	}
});

window.electronAPI.onUpdateUrl((url) => {
	if (urlInput) urlInput.value = url;
});

window.electronAPI.onUpdateTabs((tabs, activeId) => {
	tabBar.innerHTML = '';

	tabs.forEach(tab => {
		const tabEl = document.createElement('div');
		tabEl.className = `tab ${tab.id === activeId ? 'active' : ''}`;

		const titleSpan = document.createElement('span');
		titleSpan.innerText = tab.title || 'Yeni Sekme';

		const closeBtn = document.createElement('span');
		closeBtn.innerText = ' x';
		closeBtn.style.marginLeft = '8px';

		closeBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			window.electronAPI.closeTab(tab.id);			
		});

		tabEl.appendChild(titleSpan);
		tabEl.appendChild(closeBtn);

		tabEl.addEventListener('click', () => {
			if (tab.id !== activeId) {
				window.electronAPI.switchTab(tab.id);
			}
		});

		tabBar.appendChild(tabEl);
	});

	const newTabBtn = document.createElement('div');
	newTabBtn.className = 'new-tab-btn';
	newTabBtn.innerText = '+';
	newTabBtn.addEventListener('click', () => {
		window.electronAPI.createNewTab(getDefaultEngineUrl());
	});
	tabBar.appendChild(newTabBtn);
});

window.electronAPI.createNewTab(getDefaultEngineUrl());

if (settingTheme) {

	settingTheme.value = 'dark';
}
