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
                type="text"
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
                <span class="api-light" data-state="unknown"></span>
                <span class="api-light-label">
                    Prices fetched
                    <span class="api-light-ts" id="lightPricesTs"></span>
                </span>
            </div>
        </div>

        <!-- Refresh button -->
        <button class="api-refresh-btn" id="apiRefreshBtn" disabled>
            <span class="api-refresh-icon" id="apiRefreshIcon">↻</span>
            Refresh Materials &amp; Prices
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
    // Stored as a Set of recipe IDs so reordering never triggers stale.
    let watchlistSnapshotSet = null;

    function snapshotWatchlist() {
        watchlistSnapshotSet = new Set(window.CraftMander?.watchlist ?? []);
    }

    function currentWatchlistSet() {
        return new Set(window.CraftMander?.watchlist ?? []);
    }

    function updateMaterialsLight() {
        if (watchlistSnapshotSet === null) return;

        const current  = currentWatchlistSet();
        const addedIds = [...current].filter(id => !watchlistSnapshotSet.has(id));
        const anyAdded = addedIds.length > 0;

        const matRow = $("lightMaterials");
        if (matRow) {
            const cur = matRow.querySelector(".api-light").dataset.state;
            if (cur === "on" || cur === "stale") {
                setLight("lightMaterials", anyAdded ? "stale" : "on");
            }
        }

        const pricesRow = $("lightPrices");
        if (pricesRow) {
            const pricesCur = pricesRow.querySelector(".api-light").dataset.state;
            if (pricesCur === "on" || pricesCur === "stale") {
                let pricesStale    = false;
                let cachedItemIdSet = null;

                try {
                    const raw = sessionStorage.getItem("CraftManderPriceIDs");
                    if (raw) cachedItemIdSet = new Set(raw.split(",").map(Number));
                } catch {}

                if (!cachedItemIdSet) {
                    cachedItemIdSet = new Set(
                        Object.keys(window.CraftMander?.prices ?? {}).map(Number)
                    );
                }

                if (anyAdded) {
                    const recipes = window.CraftMander?.recipes ?? [];
                    for (const recipeId of addedIds) {
                        const recipe = recipes.find(r => r.id === recipeId);
                        if (recipe && !cachedItemIdSet.has(recipe.output_item_id)) {
                            pricesStale = true;
                            break;
                        }
                    }
                }

                setLight("lightPrices", pricesStale ? "stale" : "on");
            }
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
        try { sessionStorage.setItem("CraftManderPanelOpen", "1"); } catch {}
    }

    function closePanel() {
        const panel = $("apiPanel");
        const body  = $("apiPanelBody");
        const tab   = $("apiPanelTab");
        if (!panel) return;
        panel.classList.add("collapsed");
        body.hidden = true;
        tab.setAttribute("aria-expanded", "false");
        try { sessionStorage.removeItem("CraftManderPanelOpen"); } catch {}
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

    // ── Load materials then prices ──────────────────────────────────────────
    // force=false  → use sessionStorage cache if available (page navigation)
    // force=true   → always hit the network (explicit Refresh or new key)
    async function doFetch(key, force = false) {
        const refreshBtn  = $("apiRefreshBtn");
        const refreshIcon = $("apiRefreshIcon");

        if (refreshBtn) refreshBtn.disabled = true;
        if (refreshIcon) refreshIcon.classList.add("spinning");

        const willFetchMaterials = force || !hasMaterialCacheForKey(key);
        const willFetchPrices    = force || !hasPriceCache();

        if (willFetchMaterials) setStatus("Fetching materials from GW2…", "loading");

        try {
            // ── Materials ───────────────────────────────────────────────────
            const cached = await window.loadMaterials(key, { force });

            let accountName, materialsFetchedAt;

            if (cached !== null) {
                accountName        = cached.accountName;
                materialsFetchedAt = cached.fetchedAt;
            } else {
                accountName        = await window.loadAccountName(key);
                materialsFetchedAt = new Date();
                window.saveMaterialCache(key, accountName || "");
            }

            const matCount = Object.keys(window.CraftMander?.materials ?? {}).length;
            const walCount = Object.keys(window.CraftMander?.wallet   ?? {}).length;

            setLight("lightInventories", matCount > 0 ? "on" : "warn");
            setLight("lightWallet",      walCount > 0 ? "on" : "warn");
            setLight("lightMaterials",   "on");

            const mtsEl = $("lightMaterialsTs");
            if (mtsEl) {
                try {
                    const raw = sessionStorage.getItem("CraftManderFetchedAt");
                    mtsEl.textContent = raw ? formatTime(new Date(raw)) : "";
                } catch {
                    mtsEl.textContent = "";
                }
            }

            // Account name row
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

            setKeyDisplay(true);

            // Snapshot before dispatching materials-loaded — same rationale as
            // the prices-loaded snapshot below: any synchronous listener that
            // calls updateMaterialsLight must see a current snapshot.
            snapshotWatchlist();

            // Notify dashboard.js (and any other listener) that materials are ready
            document.dispatchEvent(new CustomEvent("craftmander:materials-loaded", {
                detail: { accountName }
            }));

            // ── Prices ──────────────────────────────────────────────────────
            // Fetch prices for watchlist output items — no API key needed.
            // Skip if watchlist is empty (loadPrices handles that gracefully).
            if (willFetchMaterials) setStatus("Fetching TP prices…", "loading");

            try {
                const priceResult = await window.loadPrices({ force });
                const priceCount  = Object.keys(window.CraftMander?.prices ?? {}).length;

// Only set the light if we actually have prices — if the watchlist is
                // empty or all items lack TP listings, leave it at "unknown" rather
                // than going amber, which would imply a problem that doesn't exist.
                if (priceCount > 0) setLight("lightPrices", "on");

                const ptsEl = $("lightPricesTs");
                if (ptsEl) {
                    try {
                        const raw = sessionStorage.getItem("CraftManderPriceFetchedAt");
                        ptsEl.textContent = raw ? formatTime(new Date(raw)) : "";
                    } catch {
                        ptsEl.textContent = "";
                    }
                }

                // Snapshot before dispatching — ensures updateMaterialsLight
                // sees a current snapshot if anything in the event handler
                // triggers it before we get to the end of doFetch.
                snapshotWatchlist();

                // Notify revenue.js (and any other listener) that prices are ready
                document.dispatchEvent(new CustomEvent("craftmander:prices-loaded", {
                    detail: { count: priceCount, fromCache: priceResult.fromCache }
                }));
            } catch (priceErr) {
                console.warn("[api-panel] price fetch failed:", priceErr);
                setLight("lightPrices", "off");
                // Non-fatal — materials loaded fine; just note the partial failure
                setStatus("Materials loaded. Price fetch failed: " + priceErr.message, "error");
                if (refreshBtn) refreshBtn.disabled = false;
                if (refreshIcon) refreshIcon.classList.remove("spinning");
                return;
            }

            if (willFetchMaterials || willFetchPrices) {
                const matCount2 = Object.keys(window.CraftMander?.materials ?? {}).length;
                setStatus(`${matCount2} material stacks loaded.`, "success");
                setTimeout(() => setStatus("", ""), 3500);
            }

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

    // Quick checks: does sessionStorage already hold a valid cache?
    function hasMaterialCacheForKey(key) {
        try {
            return sessionStorage.getItem("CraftManderCachedKey") === key &&
                   sessionStorage.getItem("CraftManderMaterials") !== null;
        } catch {
            return false;
        }
    }

    function hasPriceCache() {
        try {
            return sessionStorage.getItem("CraftManderPrices") !== null;
        } catch {
            return false;
        }
    }

    // ── Init ─────────────────────────────────────────────────────────────────
    async function initPanel() {
        const storedKey = localStorage.getItem("CraftManderAPIKey");
        setKeyDisplay(!!storedKey);

        // Snapshot the watchlist immediately — before any await — so that
        // storage events fired during page load don't see a null snapshot
        // and incorrectly leave lights in their default unknown/stale state.
        snapshotWatchlist();

        // Restore open/close state across page navigations (tab-scoped).
        // This runs before the early return so a no-key user who opened the
        // panel on one page still sees it open when they navigate elsewhere.
        try {
            if (sessionStorage.getItem("CraftManderPanelOpen") === "1") openPanel();
        } catch {}

        if (!storedKey) {
            openPanel(); // always open to invite key entry
            return;
        }

        await waitForGameData();
        await doFetch(storedKey, false);
    }

    function waitForGameData(maxMs = 8000) {
        // Wait for both loadMaterials to exist (data.js parsed) AND for
        // CraftMander.recipes to be populated (loadGameData() completed).
        // The original check only covered the former, so loadPrices would be
        // called before recipes were loaded, producing an empty itemIds array
        // and a cache miss even when sessionStorage held valid data.
        function ready() {
            return typeof window.loadMaterials === "function" &&
                   (window.CraftMander?.recipes?.length ?? 0) > 0;
        }
        return new Promise((resolve, reject) => {
            if (ready()) { resolve(); return; }
            const t0 = Date.now();
            const iv = setInterval(() => {
                if (ready()) {
                    clearInterval(iv);
                    resolve();
                } else if (Date.now() - t0 > maxMs) {
                    clearInterval(iv);
                    reject(new Error("Game data not available within timeout"));
                }
            }, 50);
        });
    }

    // ── Event binding ────────────────────────────────────────────────────────
    function bindEvents() {
        $("apiPanelTab")?.addEventListener("click", () => {
            const panel = $("apiPanel");
            if (panel.classList.contains("collapsed")) openPanel();
            else closePanel();
        });

        $("apiPanelClose")?.addEventListener("click", closePanel);

        $("apiKeyEditBtn")?.addEventListener("click", () => {
            const row = $("apiKeyInputRow");
            if (row.classList.contains("hidden")) showKeyInput();
            else hideKeyInput();
        });

        async function saveKey() {
            const input = $("apiKeyInputPanel");
            const key = input?.value.trim();
            if (!key) return;
            localStorage.setItem("CraftManderAPIKey", key);
            setKeyDisplay(true);
            hideKeyInput();
            await waitForGameData();
            await doFetch(key, true);
        }

        $("apiKeySaveBtn")?.addEventListener("click", saveKey);
        $("apiKeyInputPanel")?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") saveKey();
            if (e.key === "Escape") hideKeyInput();
        });

        $("apiRefreshBtn")?.addEventListener("click", async () => {
            const key = localStorage.getItem("CraftManderAPIKey");
            if (!key) { openPanel(); showKeyInput(); return; }
            await doFetch(key, true);
        });

        window.addEventListener("storage", (e) => {
            if (e.key === "CraftManderWatchlist") updateMaterialsLight();
        });

        window.__apiPanelOnSave = updateMaterialsLight;
    }

    // ── Boot ─────────────────────────────────────────────────────────────────
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectPanel);
    } else {
        injectPanel();
    }

    window.__apiPanelRefreshUI = function () {
        const matCount   = Object.keys(window.CraftMander?.materials ?? {}).length;
        const walCount   = Object.keys(window.CraftMander?.wallet    ?? {}).length;
        const priceCount = Object.keys(window.CraftMander?.prices    ?? {}).length;
        setLight("lightInventories", matCount   > 0 ? "on" : "warn");
        setLight("lightWallet",      walCount   > 0 ? "on" : "warn");
        setLight("lightMaterials",   "on");
        if (priceCount > 0) setLight("lightPrices", "on");

        // Read the timestamps that were stored at fetch time rather than
        // using the current clock — avoids the indicator showing "live time"
        // when called from revenue.js after a manual price refresh.
        const mtsEl = $("lightMaterialsTs");
        const ptsEl = $("lightPricesTs");
        try {
            const rawMat   = sessionStorage.getItem("CraftManderFetchedAt");
            const rawPrice = sessionStorage.getItem("CraftManderPriceFetchedAt");
            if (mtsEl) mtsEl.textContent = rawMat   ? formatTime(new Date(rawMat))   : "";
            if (ptsEl) ptsEl.textContent = rawPrice ? formatTime(new Date(rawPrice)) : "";
        } catch {
            // sessionStorage unavailable — leave timestamps blank
            if (mtsEl) mtsEl.textContent = "";
            if (ptsEl) ptsEl.textContent = "";
        }

        snapshotWatchlist();
        setKeyDisplay(!!localStorage.getItem("CraftManderAPIKey"));
    };
})();
