// watchlist.js — add/remove/save/render

// Hydrate from localStorage on script load (runs before DOMContentLoaded).
(function initWatchlist() {
    if (!CraftMander.watchlist || CraftMander.watchlist.length === 0) {
        const stored = localStorage.getItem("CraftManderWatchlist");
        CraftMander.watchlist = stored ? JSON.parse(stored) : [];
    }
})();

function addToWatchlist(recipeId) {
    if (!CraftMander.watchlist.includes(recipeId)) {
        CraftMander.watchlist.push(recipeId);
        saveWatchlist();
    }
}

function removeFromWatchlist(recipeId) {
    const idx = CraftMander.watchlist.indexOf(recipeId);
    if (idx !== -1) {
        CraftMander.watchlist.splice(idx, 1);
        saveWatchlist();
    }
}

function saveWatchlist() {
    localStorage.setItem("CraftManderWatchlist", JSON.stringify(CraftMander.watchlist));
    // Notify the API panel so it can update the stale-light state.
    if (typeof window.__apiPanelOnSave === "function") {
        window.__apiPanelOnSave();
    }
}

/**
 * Prompt to confirm, then wipe the entire watchlist.
 * @param {Function} onCleared  called after the list is cleared (use to re-render)
 * @returns {boolean}  true if cleared, false if cancelled
 */
function clearWatchlist(onCleared = null) {
    const count = CraftMander.watchlist.length;
    if (count === 0) return false;
    const confirmed = confirm(
        `Clear your entire watchlist?\n\n${count} item${count !== 1 ? "s" : ""} will be removed. This cannot be undone.`
    );
    if (!confirmed) return false;
    CraftMander.watchlist = [];
    saveWatchlist();
    if (onCleared) onCleared();
    return true;
}

/**
 * Create a standardised 🗑 clear-watchlist button.
 * Attach it to a panel header; pass a callback that re-renders the watchlist.
 */
function makeClearBtn(onCleared) {
    const btn = document.createElement("button");
    btn.className = "clear-watchlist-btn";
    btn.title = "Clear entire watchlist";
    btn.textContent = "🗑";
    btn.addEventListener("click", () => clearWatchlist(onCleared));
    return btn;
}

/**
 * Render the watchlist into a <ul> element.
 * @param {HTMLElement} ulElement
 * @param {Object}      craftableMap  { [item_id]: boolean } — optional
 * @param {Function}    onRemove      optional callback after removal
 * @param {Function}    onSelect      optional callback(recipeId) when item is clicked
 * @param {Function}    itemActions   optional callback(li, recipeId) to attach extra controls per item
 * @param {Function}    onReorder     optional callback() after a drag-to-reorder completes
 */
function renderWatchlist(ulElement, craftableMap = {}, onRemove = null, onSelect = null, itemActions = null, onReorder = null) {
    if (!ulElement) return;
    ulElement.innerHTML = "";

    if (CraftMander.watchlist.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "No recipes on watchlist yet.";
        ulElement.appendChild(empty);
        return;
    }

    // ── Drag state ────────────────────────────────────────────────────────────
    let dragSrc = null; // the li being dragged
    let dragId  = null; // its recipeId

    for (const recipeId of CraftMander.watchlist) {
        const recipe = CraftMander.recipes.find(r => r.id === recipeId);
        if (!recipe) continue;

        const itemId    = recipe.output_item_id;
        const itemName  = CraftMander.itemMap[itemId]?.name || `Item #${itemId}`;
        const craftable = craftableMap[itemId];

        const li = document.createElement("li");
        li.draggable = true;
        li.dataset.recipeId = recipeId;

        // ── Drag handle ───────────────────────────────────────────────────────
        const handle = document.createElement("span");
        handle.className = "drag-handle";
        handle.title = "Drag to reorder";
        handle.textContent = "⠿";
        handle.setAttribute("aria-hidden", "true");
        li.appendChild(handle);

        // ── Item name ─────────────────────────────────────────────────────────
        const nameSpan = document.createElement("span");
        nameSpan.className = "item-name";
        nameSpan.textContent = itemName;
        const rarity = CraftMander.itemMap[itemId]?.rarity;
        if (rarity) nameSpan.classList.add("rarity-" + rarity.toLowerCase());

        if (craftable !== undefined) {
            const badge = document.createElement("span");
            badge.className = craftable ? "badge craftable" : "badge not-craftable";
            badge.textContent = craftable ? "✓ Ready" : "✗ Missing";
            li.appendChild(nameSpan);
            li.appendChild(badge);
        } else {
            li.appendChild(nameSpan);
        }

        // ── Remove button ─────────────────────────────────────────────────────
        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-btn";
        removeBtn.title = "Remove from watchlist";
        removeBtn.textContent = "✖";
        removeBtn.addEventListener("click", () => {
            removeFromWatchlist(recipeId);
            renderWatchlist(ulElement, craftableMap, onRemove, onSelect, itemActions, onReorder);
            if (onRemove) onRemove();
        });
        li.appendChild(removeBtn);

        // ── Extra per-item actions (serial mode toggles, etc.) ────────────────
        if (itemActions) itemActions(li, recipeId);

        // ── Click-to-select ───────────────────────────────────────────────────
        if (onSelect) {
            li.classList.add("selectable");
            li.addEventListener("click", (e) => {
                if (e.target === removeBtn || e.target === handle) return;
                ulElement.querySelectorAll("li").forEach(el => el.classList.remove("selected"));
                li.classList.add("selected");
                onSelect(recipeId);
            });
        }

        // ── Drag events ───────────────────────────────────────────────────────
        li.addEventListener("dragstart", (e) => {
            dragSrc = li;
            dragId  = recipeId;
            e.dataTransfer.effectAllowed = "move";
            requestAnimationFrame(() => li.classList.add("dragging"));
        });

        li.addEventListener("dragend", () => {
            li.classList.remove("dragging");
            ulElement.querySelectorAll("li").forEach(el => el.classList.remove("drag-over"));
            dragSrc = null;
            dragId  = null;
        });

        li.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            if (li === dragSrc) return;
            ulElement.querySelectorAll("li").forEach(el => el.classList.remove("drag-over"));
            li.classList.add("drag-over");
        });

        li.addEventListener("dragleave", () => {
            li.classList.remove("drag-over");
        });

        li.addEventListener("drop", (e) => {
            e.preventDefault();
            li.classList.remove("drag-over");
            if (!dragSrc || dragSrc === li) return;

            const fromIdx = CraftMander.watchlist.indexOf(dragId);
            const toIdx   = CraftMander.watchlist.indexOf(recipeId);
            if (fromIdx === -1 || toIdx === -1) return;

            CraftMander.watchlist.splice(fromIdx, 1);
            CraftMander.watchlist.splice(toIdx, 0, dragId);
            saveWatchlist();

            renderWatchlist(ulElement, craftableMap, onRemove, onSelect, itemActions, onReorder);
            if (onReorder) onReorder();
        });

        ulElement.appendChild(li);
    }
}
