// revenue.js — Revenue Calculator page
// Prices are fetched and cached by api-panel.js via data.js → loadPrices().
// This page only reads CraftMander.prices and renders the table.

// TP fee: 5% listing + 10% tax = 15% total deducted from proceeds
const TP_FEE = 0.15;

// Current table data and sort state
let tableRows = [];   // { itemId, itemName, rarity, qty, instantNet, listNet }
let sortCol   = "list";
let sortDesc  = true;

window.addEventListener("DOMContentLoaded", async () => {
    await loadGameData();

    const fetchBtn    = document.getElementById("revFetchBtn");
    const fetchIcon   = document.getElementById("revFetchIcon");
    const fetchStatus = document.getElementById("revFetchStatus");

    if (!fetchBtn) return;

    // ── Render immediately if prices are available ───────────────────────
    // CraftMander.prices starts empty on every page load (config.js), even
    // when sessionStorage holds a warm cache. Call loadPrices with force=false
    // to attempt a cache restore before api-panel's async doFetch completes.
    // The superset check in restorePriceCache means this succeeds even if items
    // were removed from the watchlist since the last network fetch.
    try {
        await loadPrices({ force: false });
    } catch {
        // Non-fatal — if the cache is cold we wait for craftmander:prices-loaded.
    }

    if (Object.keys(CraftMander.prices).length > 0 &&
        Object.keys(CraftMander.materials).length > 0) {
        // Both prices and materials are in memory — render straight away.
        buildAndRender(fetchStatus);
    } else {
        updateIdleStatus(fetchStatus);
    }

    // ── React to prices loaded / refreshed by api-panel ───────────────────
    document.addEventListener("craftmander:prices-loaded", () => {
        buildAndRender(fetchStatus);
    });

    // ── Manual refresh — delegates to loadPrices directly ─────────────────
    fetchBtn.addEventListener("click", async () => {
        if (Object.keys(CraftMander.materials).length === 0) {
            setStatus(fetchStatus, "Load your materials via the ⚡ API panel first.", "error");
            return;
        }

        fetchBtn.disabled = true;
        fetchIcon.textContent = "↻";

        setStatus(fetchStatus, "Refreshing prices…", "loading");

        try {
            const result = await loadPrices({ force: true });
            const count  = Object.keys(CraftMander.prices).length;

            // Also update the panel lights if available
            if (typeof window.__apiPanelRefreshUI === "function") {
                window.__apiPanelRefreshUI();
            }

            buildAndRender(fetchStatus);

            // Keep other listeners in sync
            document.dispatchEvent(new CustomEvent("craftmander:prices-loaded", {
                detail: { count, fromCache: result.fromCache }
            }));
        } catch (err) {
            setStatus(fetchStatus, "Price fetch failed: " + err.message, "error");
        } finally {
            fetchBtn.disabled = false;
        }
    });

    // ── Column header sort clicks ──────────────────────────────────────────
    for (const th of document.querySelectorAll(".rev-table thead th.sortable")) {
        th.addEventListener("click", () => {
            const col = th.dataset.col;
            if (sortCol === col) {
                sortDesc = !sortDesc;
            } else {
                sortCol  = col;
                sortDesc = true;
            }
            renderTable();
        });
    }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function updateIdleStatus(statusEl) {
    const matCount = Object.keys(CraftMander.materials).length;
    if (matCount > 0) {
        setStatus(statusEl,
            `${matCount} material stacks loaded. Prices will load automatically, or click to refresh.`, "");
    } else {
        setStatus(statusEl,
            "Load your materials via the ⚡ API panel — prices are fetched automatically alongside them.", "");
    }
}

function setStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className   = "rev-fetch-status" + (type ? " " + type : "");
}

/**
 * Recompute tableRows from CraftMander.prices + computeCraftables(),
 * then re-render.
 */
function buildAndRender(statusEl) {
    const craftableMap = computeCraftables(); // { itemId: count }

    tableRows = [];

    for (const [itemIdStr, qty] of Object.entries(craftableMap)) {
        if (qty <= 0) continue;

        const itemId   = Number(itemIdStr);
        const item     = CraftMander.itemMap[itemId];
        const itemName = item?.name   || `Item #${itemId}`;
        const rarity   = item?.rarity || "";

        const price     = CraftMander.prices[itemId];
        const buyPrice  = price?.buys?.unit_price  || 0;  // highest buy order → instant sell
        const sellPrice = price?.sells?.unit_price || 0;  // lowest sell listing → list & wait

        const instantNet = buyPrice  > 0 ? Math.floor(buyPrice  * (1 - TP_FEE)) * qty : null;
        const listNet    = sellPrice > 0 ? Math.floor(sellPrice * (1 - TP_FEE)) * qty : null;

        tableRows.push({ itemId, itemName, rarity, qty, instantNet, listNet });
    }

    if (tableRows.length === 0) {
        setStatus(statusEl,
            "No craftable items found — check that your materials are loaded.", "");
    } else {
        setStatus(statusEl, "", "");
    }

    renderTable();
}

/**
 * Format a copper coin total into a GW2-style gold/silver/copper display.
 * Returns an HTML string.
 */
function formatCoins(copper) {
    if (copper === null || copper === undefined) {
        return `<span class="rev-no-price">—</span>`;
    }
    if (copper <= 0) {
        return `<span class="coin-zero">0c</span>`;
    }

    const g = Math.floor(copper / 10000);
    const s = Math.floor((copper % 10000) / 100);
    const c = copper % 100;

    const parts = [];
    if (g > 0) parts.push(
        `<span class="coin-g">${g.toLocaleString()}<span class="coin-icon g"></span></span>`
    );
    if (s > 0 || g > 0) parts.push(
        `<span class="coin-s">${String(s).padStart(g > 0 ? 2 : 1, "0")}<span class="coin-icon s"></span></span>`
    );
    parts.push(
        `<span class="coin-c">${String(c).padStart((g > 0 || s > 0) ? 2 : 1, "0")}<span class="coin-icon c"></span></span>`
    );

    return `<span class="coin">${parts.join(" ")}</span>`;
}

/**
 * Sort tableRows by the current sortCol / sortDesc and re-render the tbody.
 */
function renderTable() {
    const tbody = document.getElementById("revTableBody");
    if (!tbody) return;

    // Update sort arrows and active column highlight
    for (const th of document.querySelectorAll(".rev-table thead th.sortable")) {
        const col    = th.dataset.col;
        const arrow  = th.querySelector(".sort-arrow");
        const active = col === sortCol;
        th.classList.toggle("sort-active", active);
        if (arrow) arrow.textContent = active ? (sortDesc ? "▼" : "▲") : "";
    }

    if (tableRows.length === 0) {
        tbody.innerHTML = `<tr class="rev-state-row"><td colspan="5">No craftable items with TP prices found.</td></tr>`;
        return;
    }

    const sorted = [...tableRows].sort((a, b) => {
        let av, bv;
        if (sortCol === "qty") {
            av = a.qty;
            bv = b.qty;
        } else if (sortCol === "instant") {
            av = a.instantNet ?? -1;
            bv = b.instantNet ?? -1;
        } else { // list
            av = a.listNet ?? -1;
            bv = b.listNet ?? -1;
        }
        return sortDesc ? bv - av : av - bv;
    });

    tbody.innerHTML = "";

    for (const row of sorted) {
        const tr = document.createElement("tr");

        // Name
        const nameTd   = document.createElement("td");
        const nameSpan = document.createElement("span");
        nameSpan.className = "rev-item-name" +
            (row.rarity ? " rarity-" + row.rarity.toLowerCase() : "");
        nameSpan.textContent = row.itemName;
        nameSpan.title       = row.itemName;
        nameTd.appendChild(nameSpan);
        tr.appendChild(nameTd);

        // GW2Efficiency link
        const effTd = document.createElement("td");
        effTd.className = "rev-col-eff";
        const effA  = document.createElement("a");
        effA.href        = `https://gw2efficiency.com/crafting/calculator/a~0!b~1!c~0!d~1-${row.itemId}`;
        effA.target      = "_blank";
        effA.rel         = "noopener";
        effA.className   = "detail-link eff-link rev-eff-link";
        effA.textContent = "⚙";
        effA.title       = "Open in GW2Efficiency";
        effTd.appendChild(effA);
        tr.appendChild(effTd);

        // Qty craftable
        const qtyTd = document.createElement("td");
        qtyTd.className   = "rev-qty";
        qtyTd.textContent = row.qty.toLocaleString();
        tr.appendChild(qtyTd);

        // Instant sell (highest buy order, net of fees)
        const instantTd = document.createElement("td");
        instantTd.className = "rev-col-instant";
        instantTd.innerHTML = formatCoins(row.instantNet);
        tr.appendChild(instantTd);

        // List & wait (lowest sell listing, net of fees)
        const listTd = document.createElement("td");
        listTd.className = "rev-col-list";
        listTd.innerHTML = formatCoins(row.listNet);
        tr.appendChild(listTd);

        tbody.appendChild(tr);
    }
}
