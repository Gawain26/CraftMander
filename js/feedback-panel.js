// feedback-panel.js — Site-wide floating feedback panel
// Collects a free-text message + current page, verifies with Turnstile,
// and posts to the craftmander-feedback Cloudflare Worker.

(function () {

	const FEEDBACK_URL    = 'https://craftmander-feedback.strikingwolf26.workers.dev';
	const TURNSTILE_SITEKEY = '0x4AAAAAACvA41PeJ9-PO1OU'; // replace with your site key
	const MAX_CHARS       = 2000;

	// ── Derive the current page identifier ──────────────────────────────────
	function currentPage() {
		const name = location.pathname.split('/').pop().replace('.html', '') || 'index';
		const valid = new Set(['index', 'explorer', 'dashboard', 'revenue', 'libraries', 'help']);
		return valid.has(name) ? name : 'other';
	}

	// ── Panel HTML ───────────────────────────────────────────────────────────
	const PANEL_HTML = `
<div id="feedbackPanel" class="feedback-panel collapsed" role="complementary" aria-label="Feedback Panel">

	<!-- Collapsed tab -->
	<button class="feedback-panel-tab" id="feedbackPanelTab" aria-expanded="false" aria-controls="feedbackPanelBody" title="Send Feedback">
		<span class="feedback-panel-tab-icon">💬</span>
		<span class="feedback-panel-tab-label">Feedback</span>
	</button>

	<!-- Expanded body -->
	<div class="feedback-panel-body" id="feedbackPanelBody" hidden>

		<div class="feedback-panel-header">
			<span class="feedback-panel-title">Send Feedback</span>
			<button class="feedback-panel-close" id="feedbackPanelClose" title="Collapse panel" aria-label="Collapse">✕</button>
		</div>

		<p class="feedback-panel-hint">Bug, suggestion, or general thought — all welcome.</p>

		<textarea
			id="feedbackMessage"
			class="feedback-textarea"
			placeholder="Type your feedback…"
			maxlength="${MAX_CHARS}"
			rows="5"
			spellcheck="true"
			aria-label="Feedback message"
		></textarea>

		<!-- Turnstile widget injected here -->
		<div id="feedbackTurnstile" class="feedback-turnstile-wrap"></div>

		<button class="feedback-submit-btn" id="feedbackSubmitBtn" disabled>Send</button>

		<div class="feedback-status" id="feedbackStatus" aria-live="polite"></div>

	</div>
</div>`;

	// ── CSS — fixed neutral dark slate, never inherits theme variables ───────
	const PANEL_CSS = `
.feedback-panel {
	position: fixed;
	right: 0;
	top: 75%;
	transform: translateY(-50%);
	z-index: 200;
	display: flex;
	flex-direction: row;
	align-items: stretch;
}

.feedback-panel-tab {
	writing-mode: vertical-rl;
	text-orientation: mixed;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
	padding: 14px 8px;
	background: #1a1f2e;
	border: 1px solid #2e3a4a;
	border-right: none;
	border-radius: 6px 0 0 6px;
	color: #8899aa;
	font-family: 'Cinzel', serif;
	cursor: pointer;
	transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
	box-shadow: -2px 0 12px rgba(0,0,0,0.25);
	transform: none;
	font-size: 0.85rem;
}

.feedback-panel-tab:hover {
	background: #232a3a;
	color: #aabbcc;
	border-color: #3a5068;
	transform: none;
}

.feedback-panel-tab-icon {
	font-size: 1rem;
	line-height: 1;
	writing-mode: horizontal-tb;
}

.feedback-panel-tab-label {
	font-size: 0.65rem;
	letter-spacing: 0.12em;
	font-family: 'Cinzel', serif;
}

.feedback-panel-body {
	width: 248px;
	background: #1a1f2e;
	border: 1px solid #2e3a4a;
	border-right: none;
	border-radius: 10px 0 0 10px;
	box-shadow: -4px 0 24px rgba(0,0,0,0.35);
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 10px;
	animation: feedbackPanelSlideIn 0.2s ease forwards;
}

@keyframes feedbackPanelSlideIn {
	from { opacity: 0; transform: translateX(20px); }
	to   { opacity: 1; transform: translateX(0); }
}

.feedback-panel-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-bottom: 10px;
	border-bottom: 1px solid #2e3a4a;
}

.feedback-panel-title {
	font-family: 'Cinzel', serif;
	font-size: 0.72rem;
	text-transform: uppercase;
	letter-spacing: 0.1em;
	color: #8899aa;
}

.feedback-panel-close {
	background: transparent;
	color: #8899aa;
	font-size: 0.75rem;
	padding: 2px 6px;
	border: 1px solid transparent;
	border-radius: 4px;
	cursor: pointer;
	transition: color 0.18s ease, background 0.18s ease;
	transform: none;
	font-family: 'Cinzel', serif;
}

.feedback-panel-close:hover {
	color: #aabbcc;
	background: #232a3a;
	transform: none;
}

.feedback-panel-hint {
	font-size: 0.78rem;
	color: #8899aa;
	line-height: 1.45;
	margin: 0;
}

.feedback-textarea {
	width: 100%;
	min-height: 100px;
	padding: 9px 10px;
	background: #232a3a;
	border: 1px solid #2e3a4a;
	border-radius: 6px;
	color: #d0dde8;
	font-family: 'Rubik', sans-serif;
	font-size: 0.85rem;
	line-height: 1.5;
	resize: vertical;
	outline: none;
	transition: border-color 0.18s ease, box-shadow 0.18s ease;
	box-sizing: border-box;
}

.feedback-textarea:focus {
	border-color: #5e8fba;
	box-shadow: 0 0 0 2px rgba(94,143,186,0.18);
}

.feedback-textarea::placeholder {
	color: #4a5a6a;
}

.feedback-turnstile-wrap {
	min-height: 0;
}

/* Shrink the Turnstile widget to fit the narrow panel */
.feedback-turnstile-wrap iframe {
	transform: scale(0.88);
	transform-origin: left top;
}

.feedback-submit-btn {
	width: 100%;
	padding: 8px;
	background: #3a5a7a;
	color: #d0dde8;
	border: 1px solid #4a6a8a;
	border-radius: 6px;
	font-family: 'Cinzel', serif;
	font-size: 0.82rem;
	font-weight: 600;
	letter-spacing: 0.06em;
	cursor: pointer;
	transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
	transform: none;
}

.feedback-submit-btn:hover:not(:disabled) {
	background: #4a6e96;
	border-color: #6a9ec6;
	transform: none;
}

.feedback-submit-btn:disabled {
	opacity: 0.4;
	cursor: default;
}

.feedback-status {
	font-size: 0.78rem;
	min-height: 18px;
	border-radius: 4px;
	padding: 0 2px;
	line-height: 1.4;
}

.feedback-status.success {
	color: #8dba74;
}

.feedback-status.error {
	color: #c05560;
}

.feedback-status.loading {
	color: #66b8d8;
}

.feedback-panel.collapsed .feedback-panel-body {
	display: none;
}

@media (max-width: 600px) {
	.feedback-panel {
		top: auto;
		bottom: 96px;
		right: 16px;
		transform: none;
		flex-direction: column-reverse;
		align-items: flex-end;
	}

	.feedback-panel-tab {
		writing-mode: horizontal-tb;
		border-radius: 6px 6px 0 0;
		border-right: 1px solid #2e3a4a;
		border-bottom: none;
		flex-direction: row;
		padding: 8px 14px;
		gap: 8px;
	}

	.feedback-panel-body {
		border-radius: 10px 10px 0 0;
		border-right: 1px solid #2e3a4a;
		border-bottom: none;
		max-height: 70vh;
		overflow-y: auto;
	}
}`;

	// ── Inject CSS ───────────────────────────────────────────────────────────
	function injectStyles() {
		const style = document.createElement('style');
		style.textContent = PANEL_CSS;
		document.head.appendChild(style);
	}

	// ── Inject Turnstile script (once, idempotent) ───────────────────────────
	function loadTurnstileScript() {
		if (document.getElementById('cf-turnstile-script')) return;
		const s = document.createElement('script');
		s.id  = 'cf-turnstile-script';
		s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
		s.async = true;
		s.defer = true;
		document.head.appendChild(s);
	}

	// ── Render the Turnstile widget into the panel ───────────────────────────
	// Called once when the panel first opens so the widget isn't loaded on
	// pages where the user never opens feedback.
	let turnstileRendered = false;
	let turnstileWidgetId = null;
	let currentToken      = null;

	function renderTurnstile() {
		if (turnstileRendered) return;
		turnstileRendered = true;

		const container = document.getElementById('feedbackTurnstile');
		if (!container) return;

		// Wait for the Turnstile API to be available (script may still be loading)
		function tryRender() {
			if (typeof window.turnstile === 'undefined') {
				setTimeout(tryRender, 100);
				return;
			}
			turnstileWidgetId = window.turnstile.render(container, {
				sitekey:  TURNSTILE_SITEKEY,
				theme:    'dark',
				size:     'normal',
				callback: (token) => {
					currentToken = token;
					updateSubmitBtn();
				},
				'expired-callback': () => {
					currentToken = null;
					updateSubmitBtn();
				},
				'error-callback': () => {
					currentToken = null;
					updateSubmitBtn();
				},
			});
		}

		tryRender();
	}

	// ── Submit button state ──────────────────────────────────────────────────
	function updateSubmitBtn() {
		const btn = document.getElementById('feedbackSubmitBtn');
		const msg = (document.getElementById('feedbackMessage')?.value || '').trim();
		if (btn) btn.disabled = !currentToken || !msg;
	}

	// ── Status display ───────────────────────────────────────────────────────
	function setStatus(msg, type) {
		const el = document.getElementById('feedbackStatus');
		if (!el) return;
		el.textContent = msg;
		el.className   = 'feedback-status' + (type ? ' ' + type : '');
	}

	// ── Open / close ─────────────────────────────────────────────────────────
	function openPanel() {
		const panel = document.getElementById('feedbackPanel');
		const body  = document.getElementById('feedbackPanelBody');
		const tab   = document.getElementById('feedbackPanelTab');
		if (!panel) return;
		panel.classList.remove('collapsed');
		body.hidden = false;
		tab.setAttribute('aria-expanded', 'true');
		// Lazy-load Turnstile on first open
		loadTurnstileScript();
		renderTurnstile();
		document.getElementById('feedbackMessage')?.focus();
		try { sessionStorage.setItem('CraftManderFeedbackPanelOpen', '1'); } catch {}
	}

	function closePanel() {
		const panel = document.getElementById('feedbackPanel');
		const body  = document.getElementById('feedbackPanelBody');
		const tab   = document.getElementById('feedbackPanelTab');
		if (!panel) return;
		panel.classList.add('collapsed');
		body.hidden = true;
		tab.setAttribute('aria-expanded', 'false');
		try { sessionStorage.removeItem('CraftManderFeedbackPanelOpen'); } catch {}
	}

	// ── Reset panel to pristine state after successful submission ────────────
	function resetPanel() {
		const textarea = document.getElementById('feedbackMessage');
		if (textarea) textarea.value = '';
		currentToken = null;
		updateSubmitBtn();
		// Reset the Turnstile widget so the user can submit again later
		if (turnstileWidgetId !== null && typeof window.turnstile !== 'undefined') {
			window.turnstile.reset(turnstileWidgetId);
		}
	}

	// ── Submit ────────────────────────────────────────────────────────────────
	async function submitFeedback() {
		const message = (document.getElementById('feedbackMessage')?.value || '').trim();

		if (!message) {
			setStatus('Please write something before submitting.', 'error');
			return;
		}

		if (!currentToken) {
			setStatus('Please complete the security check.', 'error');
			return;
		}

		const btn = document.getElementById('feedbackSubmitBtn');
		if (btn) btn.disabled = true;
		setStatus('Sending…', 'loading');

		try {
			const res = await fetch(FEEDBACK_URL, {
				method:  'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					turnstile_token: currentToken,
					message,
					page: currentPage(),
				}),
			});

			const data = await res.json().catch(() => ({}));

			if (res.ok && data.ok) {
				setStatus('Thanks — feedback received!', 'success');
				resetPanel();
				// Auto-close after 2.5 s so the user can get back to what they were doing
				setTimeout(closePanel, 2500);
			} else {
				setStatus(data.error || `Error ${res.status} — please try again.`, 'error');
				if (btn) btn.disabled = false;
			}
		} catch (err) {
			setStatus('Network error — please try again.', 'error');
			if (btn) btn.disabled = false;
		}
	}

	// ── Event binding ─────────────────────────────────────────────────────────
	function bindEvents() {
		document.getElementById('feedbackPanelTab')?.addEventListener('click', () => {
			const panel = document.getElementById('feedbackPanel');
			if (panel.classList.contains('collapsed')) openPanel();
			else closePanel();
		});

		document.getElementById('feedbackPanelClose')?.addEventListener('click', closePanel);

		document.getElementById('feedbackMessage')?.addEventListener('input', updateSubmitBtn);

		document.getElementById('feedbackSubmitBtn')?.addEventListener('click', submitFeedback);

		// Allow Ctrl+Enter / Cmd+Enter to submit from the textarea
		document.getElementById('feedbackMessage')?.addEventListener('keydown', (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitFeedback();
		});
	}

	// ── Inject markup & boot ──────────────────────────────────────────────────
	function injectPanel() {
		injectStyles();
		const wrapper = document.createElement('div');
		wrapper.innerHTML = PANEL_HTML.trim();
		document.body.appendChild(wrapper.firstElementChild);
		bindEvents();

		// Restore open state across page navigations
		try {
			if (sessionStorage.getItem('CraftManderFeedbackPanelOpen') === '1') openPanel();
		} catch {}
	}

	// ── Boot ──────────────────────────────────────────────────────────────────
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', injectPanel);
	} else {
		injectPanel();
	}

})();
