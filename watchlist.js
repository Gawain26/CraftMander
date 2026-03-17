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
}

/**
 * Render the watchlist into a <ul> element.
 * @param {HTMLElement} ulElement
 * @param {Object}      craftableMap  { [item_id]: boolean } — optional
 * @param {Function}    onRemove      optional callback after removal
 * @param {Function}    onSelect      optional callback(recipeId) when item is clicked
 * @param {Function}    itemActions   optional callback(li, recipeId) to attach extra controls per item
 */
function renderWatchlist(ulElement, craftableMap = {}, onRemove = null, onSelect = null, itemActions = null) {
    if (!ulElement) return;
    ulElement.innerHTML = "";

    if (CraftMander.watchlist.length === 0) {
        const empty = document.createElement("li");
        empty.className = "empty-state";
        empty.textContent = "No recipes on watchlist yet.";
        ulElement.appendChild(empty);
        return;
    }

    for (const recipeId of CraftMander.watchlist) {
        const recipe = CraftMander.recipes.find(r => r.id === recipeId);
        if (!recipe) continue;

        const itemId   = recipe.output_item_id;
        const itemName = CraftMander.itemMap[itemId]?.name || `Item #${itemId}`;
        const craftable = craftableMap[itemId];

        const li = document.createElement("li");

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

        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-btn";
        removeBtn.title = "Remove from watchlist";
        removeBtn.textContent = "✖";
        removeBtn.addEventListener("click", () => {
            removeFromWatchlist(recipeId);
            renderWatchlist(ulElement, craftableMap, onRemove);
            if (onRemove) onRemove();
        });

        li.appendChild(removeBtn);

        if (itemActions) itemActions(li, recipeId);

        if (onSelect) {
            li.classList.add("selectable");
            li.addEventListener("click", (e) => {
                if (e.target === removeBtn) return;
                ulElement.querySelectorAll("li").forEach(el => el.classList.remove("selected"));
                li.classList.add("selected");
                onSelect(recipeId);
            });
        }

        ulElement.appendChild(li);
    }
}
