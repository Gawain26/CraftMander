// theme-panel.js — Site-wide floating theme picker panel
// Manages theme selection, localStorage persistence, and data-theme application.

(function () {

	const THEMES = [
		{
			id:    'commander',
			label: 'Commander',
			cls:   'theme-pill-commander',
		},
		{
			id:    'dark',
			label: 'Dark',
			cls:   'theme-pill-dark',
		},
		{
			id:    'ascended',
			label: 'Ascended',
			cls:   'theme-pill-ascended',
		},
		{
			id:    'legendary',
			label: 'Legendary',
			cls:   'theme-pill-legendary',
		},
		{
			id:    'exotic',
			label: 'Exotic',
			cls:   'theme-pill-exotic',
		},
		{
			id:    'parchment',
			label: 'Parchment',
			cls:   'theme-pill-parchment',
		},
		{
			id:    'highcontrast',
			label: 'High Contrast',
			cls:   'theme-pill-highcontrast',
		},
	];

	// ── Panel HTML ──────────────────────────────────────────────────────────
	const PANEL_HTML = `
<div id="themePanel" class="theme-panel collapsed" role="complementary" aria-label="Theme Picker Panel">

	<!-- Collapsed tab -->
	<button class="theme-panel-tab" id="themePanelTab" aria-expanded="false" aria-controls="themePanelBody" title="Choose Theme">
		<span class="theme-panel-tab-icon">🎨</span>
		<span class="theme-panel-tab-label">Theme</span>
	</button>

	<!-- Expanded body -->
	<div class="theme-panel-body" id="themePanelBody" hidden>

		<div class="theme-panel-header">
			<span class="theme-panel-title">Choose Theme</span>
			<button class="theme-panel-close" id="themePanelClose" title="Collapse panel" aria-label="Collapse">✕</button>
		</div>

		<div class="theme-pills" id="themePills"></div>

	</div>
</div>`;

	// ── Apply a theme ───────────────────────────────────────────────────────
	// 'commander' is the default — remove the attribute entirely so :root
	// variables apply without any override block needing to repeat them.
	function applyTheme(themeId) {
		if (themeId === 'commander' || !themeId) {
			document.documentElement.removeAttribute('data-theme');
		} else {
			document.documentElement.setAttribute('data-theme', themeId);
		}
	}

	function saveTheme(themeId) {
		try {
			localStorage.setItem('CraftManderTheme', themeId);
		} catch {
			// localStorage unavailable — theme applies for session only
		}
	}

	function loadTheme() {
		try {
			return localStorage.getItem('CraftManderTheme') || 'commander';
		} catch {
			return 'commander';
		}
	}

	// ── Open / close ────────────────────────────────────────────────────────
	function openPanel() {
		const panel = document.getElementById('themePanel');
		const body  = document.getElementById('themePanelBody');
		const tab   = document.getElementById('themePanelTab');
		if (!panel) return;
		panel.classList.remove('collapsed');
		body.hidden = false;
		tab.setAttribute('aria-expanded', 'true');
		try { sessionStorage.setItem('CraftManderThemePanelOpen', '1'); } catch {}
	}

	function closePanel() {
		const panel = document.getElementById('themePanel');
		const body  = document.getElementById('themePanelBody');
		const tab   = document.getElementById('themePanelTab');
		if (!panel) return;
		panel.classList.add('collapsed');
		body.hidden = true;
		tab.setAttribute('aria-expanded', 'false');
		try { sessionStorage.removeItem('CraftManderThemePanelOpen'); } catch {}
	}

	// ── Render pills ─────────────────────────────────────────────────────────
	function renderPills(activeId) {
		const container = document.getElementById('themePills');
		if (!container) return;
		container.innerHTML = '';

		for (const theme of THEMES) {
			const btn = document.createElement('button');
			btn.className   = 'theme-pill ' + theme.cls + (theme.id === activeId ? ' active' : '');
			btn.textContent = theme.label;
			btn.title       = 'Switch to ' + theme.label + ' theme';
			btn.setAttribute('aria-pressed', theme.id === activeId ? 'true' : 'false');

			btn.addEventListener('click', () => {
				applyTheme(theme.id);
				saveTheme(theme.id);
				renderPills(theme.id);
			});

			container.appendChild(btn);
		}
	}

	// ── Inject markup & boot ────────────────────────────────────────────────
	function injectPanel() {
		const wrapper = document.createElement('div');
		wrapper.innerHTML = PANEL_HTML.trim();
		document.body.appendChild(wrapper.firstElementChild);
		bindEvents();
		initPanel();
	}

	function initPanel() {
		const activeTheme = loadTheme();
		applyTheme(activeTheme);
		renderPills(activeTheme);

		// Restore open/close state across page navigations
		try {
			if (sessionStorage.getItem('CraftManderThemePanelOpen') === '1') openPanel();
		} catch {}
	}

	function bindEvents() {
		document.getElementById('themePanelTab')?.addEventListener('click', () => {
			const panel = document.getElementById('themePanel');
			if (panel.classList.contains('collapsed')) openPanel();
			else closePanel();
		});

		document.getElementById('themePanelClose')?.addEventListener('click', closePanel);
	}

	// ── Boot ─────────────────────────────────────────────────────────────────
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', injectPanel);
	} else {
		injectPanel();
	}

})();
