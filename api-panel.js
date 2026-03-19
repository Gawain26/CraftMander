// api-panel.js — Site-wide floating API connection panel
// Manages key entry, materials fetch, permission indicators, and stale state.

(function () {
    // ── Panel HTML ──────────────────────────────────────────────────────────
    const PANEL_HTML = `
<div id="apiPanel" class="api-panel collapsed" role="complementary" aria-label="API Connection Panel">

    <!-- Collapsed tab -->
    <button class="api-panel-tab" id="apiPanelTab" aria-expanded="false" aria-controls="apiPanelBody" title="API Connection">
        <span class="api-panel-tab-icon">⚡</span>
        <span class="api-panel-tab-label">API</span>
        <span class="api-panel-tab-dot" id="apiTabDot"></span>
    </button>

    <!-- Expanded body -->
    <div class="api-panel-body" id="apiPanelBody" hidden>

        <div class="api-panel-header">
            <span class="api-panel-title">Connection</span>
            <button class="api-panel-close" id="apiPanelClose" title="Collapse panel" aria-label="Collapse">✕</button>
        </div>

        <!-- Key row -->
        <div class="api-panel-key-row" id="apiKeyRow">
            <div class="api-key-status" id="apiKeyStatus">
                <span class="api-key-dot" id="apiKeyDot"></span>
                <span class="api-key-label" id="apiKeyLabel">No key stored</span>
            </div>
            <button class="api-key-edit-btn" id="apiKeyEditBtn" title="Enter or replace API key" aria-label="Edit API key">✏</button>
        </div>

        <!-- Key input (hidden until pencil clicked) -->
        <div class="api-key-input-row hidden" id="apiKeyInputRow">
            <input
                type="password"
                id="apiKeyInputPanel"
                class="api-key-input"
                placeholder="Paste your API key…"
                autocomplete="off"
                spellcheck="false"
            >
            <button class="api-key-save-btn" id="apiKeySaveBtn">Save</button>
        </div>

        <!-- Account name -->
        <div class="api-account-row hidden" id="apiAccountRow">
            <span class="api-account-icon">👤</span>
            <span class="api-account-name" id="apiAccountName"></span>
        </div>

        <!-- State lights -->
        <div class="api-lights">
            <div class="api-light-row" id="lightInventories">
                <span class="api-light" data-state="unknown"></span>
                <span class="api-light-label">Inventories permission</span>
            </div>
            <div class="api-light-row" id="lightWallet">
                <span class="api-light" data-state="unknown"></span>
                <span class="api-light-label">Wallet permission</span>
            </div>
            <div class="api-light-row" id="lightMaterials">
                <span class="api-light" data-state="unknown"></span>
                <span class="api-light-label">
                    Materials fetched
                    <span class="api-light-ts" id="lightMaterialsTs"></span>
                </span>
            </div>
            <div class="api-light-row" id="lightPrices">
                <span class="api-light" data-state="off"></span>
                <span class="api-light-label api-light-label--dim">Prices fetched <span class="api-badge-soon">soon</span></span>
            </div>
        </div>

        <!-- Refresh button -->
        <button class="api-refresh-btn" id="apiRefreshBtn" disabled>
            <span class="api-refresh-icon" id="apiRefreshIcon">↻</span>
            Refresh Materials
        </button>

        <div class="api-panel-status" id="apiPanelStatus"></div>

    </div>
</div>`;

    // ── Inject markup ───────────────────────────────────────────────────────
    function injectPanel() {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = PANEL_HTML.trim();
        document.body.appendChild(wrapper.firstElementChild);
        bindEvents();
        initPanel();
    }

    // ── DOM helpers ─────────────────────────────────────────────────────────
    const $ = (id) => document.getElementById(id);

    function setLight(rowId, state /* 'on'|'off'|'warn'|'unknown'|'stale' */) {
        const row = $(rowId);
        if (!row) return;
        row.querySelector(".api-light").dataset.state = state;
    }

    function setStatus(msg, type /* 'loading'|'success'|'error'|'' */) {
        const el = $("apiPanelStatus");
        if (!el) return;
        el.textContent = msg;
        el.className = "api-panel-status" + (type ? " " + type : "");
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    // ── Watchlist snapshot for stale detection ──────────────────────────────
    let watchlistSnapshot = null;

    function snapshotWatchlist() {
        watchlistSnapshot = JSON.stringify(window.CraftMander?.watchlist ?? []);
    }

    function isWatchlistStale() {
        if (watchlistSnapshot === null) return false;
        return watchlistSnapshot !== JSON.stringify(window.CraftMander?.watchlist ?? []);
    }

    function updateMaterialsLight() {
        const stale = isWatchlistStale();
        const ts = $("lightMaterialsTs");
        if (!ts) return;
        // if the light is currently 'on' or 'stale', re-evaluate
        const row = $("lightMaterials");
        if (!row) return;
        const cur = row.querySelector(".api-light").dataset.state;
        if (cur === "on" || cur === "stale") {
            setLight("lightMaterials", stale ? "stale" : "on");
        }
    }

    // ── Open/close ──────────────────────────────────────────────────────────
    function openPanel() {
        const panel = $("apiPanel");
        const body  = $("apiPanelBody");
        const tab   = $("apiPanelTab");
        if (!panel) return;
        panel.classList.remove("collapsed");
        body.hidden = false;
        tab.setAttribute("aria-expanded", "true");
    }

    function closePanel() {
        const panel = $("apiPanel");
        const body  = $("apiPanelBody");
        const tab   = $("apiPanelTab");
        if (!panel) return;
        panel.classList.add("collapsed");
        body.hidden = true;
        tab.setAttribute("aria-expanded", "false");
    }

    // ── Key input ────────────────────────────────────────────────────────────
    function showKeyInput() {
        $("apiKeyInputRow").classList.remove("hidden");
        $("apiKeyInputPanel").focus();
    }

    function hideKeyInput() {
        $("apiKeyInputRow").classList.add("hidden");
        $("apiKeyInputPanel").value = "";
    }

    function setKeyDisplay(hasKey) {
        const dot   = $("apiKeyDot");
        const label = $("apiKeyLabel");
        if (!dot || !label) return;
        if (hasKey) {
            dot.dataset.state = "on";
            label.textContent = "Key stored";
        } else {
            dot.dataset.state = "off";
            label.textContent = "No key stored";
        }
        // Mirror to tab dot
        const tabDot = $("apiTabDot");
        if (tabDot) tabDot.dataset.state = hasKey ? "on" : "off";
    }

    // ── Load materials (the real work) ─────────────────────────────────────
    async function doFetch(key) {
        const refreshBtn  = $("apiRefreshBtn");
        const refreshIcon = $("apiRefreshIcon");

        if (refreshBtn) refreshBtn.disabled = true;
        if (refreshIcon) refreshIcon.classList.add("spinning");
        setStatus("Fetching from GW2…", "loading");

        try {
            // loadMaterials and loadAccountName come from data.js (loaded before this script)
            const [_, accountName] = await Promise.all([
                window.loadMaterials(key),
                window.loadAccountName(key),
            ]);

            // Infer permissions from non-empty results
            const matCount = Object.keys(window.CraftMander?.materials ?? {}).length;
            const walCount = Object.keys(window.CraftMander?.wallet ?? {}).length;

            setLight("lightInventories", matCount > 0 ? "on" : "warn");
            setLight("lightWallet",      walCount > 0 ? "on" : "warn");
            setLight("lightMaterials",   "on");

            const tsEl = $("lightMaterialsTs");
            if (tsEl) tsEl.textContent = formatTime(new Date());

            // Account name
            const nameEl  = $("apiAccountName");
            const nameRow = $("apiAccountRow");
            if (nameEl && nameRow) {
                if (accountName) {
                    nameEl.textContent = accountName;
                    nameRow.classList.remove("hidden");
                } else {
                    nameRow.classList.add("hidden");
                }
            }

            // Snapshot watchlist now that we have fresh data
            snapshotWatchlist();

            setStatus(`${matCount} material stacks loaded.`, "success");
            setKeyDisplay(true);

            // Notify dashboard.js if it exists on this page
            document.dispatchEvent(new CustomEvent("craftmander:materials-loaded", {
                detail: { accountName }
            }));

            // Hide status after a moment
            setTimeout(() => setStatus("", ""), 3500);

        } catch (err) {
            console.error("[api-panel] fetch error:", err);
            setLight("lightInventories", "off");
            setLight("lightWallet",      "off");
            setLight("lightMaterials",   "off");
            setStatus("Error: " + err.message, "error");
        } finally {
            if (refreshBtn) refreshBtn.disabled = false;
            if (refreshIcon) refreshIcon.classList.remove("spinning");
        }
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    async function initPanel() {
        const storedKey = localStorage.getItem("CraftManderAPIKey");
        setKeyDisplay(!!storedKey);

        if (!storedKey) {
            // Gently invite the user to enter a key
            openPanel();
            return;
        }

        // Auto-fetch on page load
        // Wait for loadMaterials etc. to be available (they come from data.js / loadGameData)
        // data.js must be loaded before api-panel.js in every HTML file.
        await waitForGameData();
        await doFetch(storedKey);
    }

    // data.js exposes loadMaterials globally; game data is loaded by loadGameData() in each page.
    // We just need loadMaterials to exist before fetching.
    function waitForGameData(maxMs = 8000) {
        return new Promise((resolve, reject) => {
            if (typeof window.loadMaterials === "function") { resolve(); return; }
            const t0 = Date.now();
            const iv = setInterval(() => {
                if (typeof window.loadMaterials === "function") {
                    clearInterval(iv);
                    resolve();
                } else if (Date.now() - t0 > maxMs) {
                    clearInterval(iv);
                    reject(new Error("loadMaterials not available"));
                }
            }, 50);
        });
    }

    // ── Event binding ────────────────────────────────────────────────────────
    function bindEvents() {
        // Tab toggle
        $("apiPanelTab")?.addEventListener("click", () => {
            const panel = $("apiPanel");
            if (panel.classList.contains("collapsed")) openPanel();
            else closePanel();
        });

        $("apiPanelClose")?.addEventListener("click", closePanel);

        // Pencil — show/hide input
        $("apiKeyEditBtn")?.addEventListener("click", () => {
            const row = $("apiKeyInputRow");
            if (row.classList.contains("hidden")) showKeyInput();
            else hideKeyInput();
        });

        // Save key
        async function saveKey() {
            const input = $("apiKeyInputPanel");
            const key = input?.value.trim();
            if (!key) return;
            localStorage.setItem("CraftManderAPIKey", key);
            setKeyDisplay(true);
            hideKeyInput();
            await waitForGameData();
            await doFetch(key);
        }

        $("apiKeySaveBtn")?.addEventListener("click", saveKey);
        $("apiKeyInputPanel")?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") saveKey();
            if (e.key === "Escape") hideKeyInput();
        });

        // Refresh
        $("apiRefreshBtn")?.addEventListener("click", async () => {
            const key = localStorage.getItem("CraftManderAPIKey");
            if (!key) { openPanel(); showKeyInput(); return; }
            await doFetch(key);
        });

        // Watch for watchlist changes from any page (localStorage events or direct mutations)
        window.addEventListener("storage", (e) => {
            if (e.key === "CraftManderWatchlist") updateMaterialsLight();
        });

        // Also patch saveWatchlist if available to catch same-tab changes
        const _origSave = window.saveWatchlist;
        if (typeof _origSave === "function") {
            window.saveWatchlist = function (...args) {
                _origSave.apply(this, args);
                updateMaterialsLight();
            };
        } else {
            // saveWatchlist may not exist yet — patch after DOM ready
            document.addEventListener("craftmander:watchlist-patched", updateMaterialsLight);
        }

        // Expose a hook for watchlist.js to call after it defines saveWatchlist
        window.__apiPanelOnSave = updateMaterialsLight;
    }

    // ── Boot ─────────────────────────────────────────────────────────────────
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectPanel);
    } else {
        injectPanel();
    }

    // Expose refresh for other scripts to call after a manual materials load
    window.__apiPanelRefreshUI = function () {
        const matCount = Object.keys(window.CraftMander?.materials ?? {}).length;
        const walCount = Object.keys(window.CraftMander?.wallet ?? {}).length;
        setLight("lightInventories", matCount > 0 ? "on" : "warn");
        setLight("lightWallet",      walCount > 0 ? "on" : "warn");
        setLight("lightMaterials",   "on");
        const tsEl = $("lightMaterialsTs");
        if (tsEl) tsEl.textContent = formatTime(new Date());
        snapshotWatchlist();
        setKeyDisplay(!!localStorage.getItem("CraftManderAPIKey"));
    };
})();
