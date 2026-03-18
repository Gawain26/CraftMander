// dashboard.js — Craftability Dashboard page

let currentCraftableMap = {};
let serialMode     = false;
let serialExcluded = new Set(); // recipe IDs opted out of serial run

window.addEventListener("DOMContentLoaded", async () => {
    await loadGameData();

    const watchUl    = document.getElementById("craftableWatchlist");
    const keyInput   = document.getElementById("apiKeyInput");
    const loadBtn    = document.getElementById("loadMaterialsBtn");
    const statusEl   = document.getElementById("apiStatus");
    const serialBtn  = document.getElementById("serialModeToggle");
    const clearBtn   = document.getElementById("clearWatchlistBtn");

    if (!watchUl || !keyInput || !loadBtn || !statusEl || !serialBtn || !clearBtn) {
        console.error("Dashboard: missing DOM elements");
        return;
    }

    const savedKey = localStorage.getItem("CraftManderAPIKey");
    if (savedKey) keyInput.value = savedKey;

    renderDashboardWatchlist(watchUl);

    // Auto-load if we have a saved key
    if (savedKey) {
        await doLoad(savedKey, watchUl, loadBtn, statusEl);
    }

    // Serial mode toggle
    serialBtn.addEventListener("click", () => {
        serialMode = !serialMode;
        serialExcluded.clear();
        serialBtn.classList.toggle("active", serialMode);
        serialBtn.title = serialMode ? "Exit serial mode" : "Enter serial mode";
        renderDashboardWatchlist(watchUl);
        renderSerialSummary();
    });

    // Clear watchlist
    clearBtn.addEventListener("click", () => {
        clearWatchlist(() => {
            serialExcluded.clear();
            if (serialMode) {
                serialMode = false;
                serialBtn.classList.remove("active");
                serialBtn.title = "Enter serial mode";
            }
            currentCraftableMap = {};
            renderDashboardWatchlist(watchUl);
            renderSerialSummary();
        });
    });

    loadBtn.addEventListener("click", async () => {
        const key = keyInput.value.trim();
        if (!key) {
            setStatus(statusEl, "error", "Please enter an API key.");
            return;
        }
        await doLoad(key, watchUl, loadBtn, statusEl);
    });

    window.addEventListener("storage", (e) => {
        if (e.key === "CraftManderWatchlist") {
            CraftMander.watchlist = e.newValue ? JSON.parse(e.newValue) : [];
            serialExcluded.clear();
            currentCraftableMap = computeCraftables();
            renderDashboardWatchlist(watchUl);
            renderSerialSummary();
        }
    });
});

function setStatus(el, type, message) {
    el.textContent = message;
    el.className = "api-status " + type;
}

async function doLoad(key, watchUl, loadBtn, statusEl) {
    setStatus(statusEl, "loading", "Fetching materials from GW2…");
    loadBtn.disabled = true;

    try {
        const [_, accountName] = await Promise.all([
            loadMaterials(key),
            loadAccountName(key),
        ]);

        setStatus(statusEl, "success", `Materials loaded — ${Object.keys(CraftMander.materials).length} stacks.`);

        const nameEl = document.getElementById("accountName");
        if (nameEl) {
            nameEl.textContent = accountName || "";
            nameEl.title = accountName ? `Logged in as ${accountName}` : "";
        }

        currentCraftableMap = computeCraftables();
        renderDashboardWatchlist(watchUl);
        renderSerialSummary();
    } catch (err) {
        console.error(err);
        setStatus(statusEl, "error", `Error: ${err.message}`);
    } finally {
        loadBtn.disabled = false;
    }
}

/**
 * Wrapper around renderWatchlist that injects serial mode item toggles
 * when serial mode is active, and marks items that don't make it through
 * the shared-inventory serial run.
 */
function renderDashboardWatchlist(watchUl) {
    let serialItemIds = null; // Set of output_item_ids that succeeded in the serial run

    if (serialMode) {
        const activeWatchlist = CraftMander.watchlist.filter(id => !serialExcluded.has(id));
        const { itemIds } = computeSerialCraftables(activeWatchlist);
        serialItemIds = new Set(itemIds);
    }

    const itemActions = serialMode ? (li, recipeId) => {
        const isExcluded = serialExcluded.has(recipeId);

        const recipe = CraftMander.recipes.find(r => r.id === recipeId);
        const itemId = recipe?.output_item_id;

        // null = excluded (don't show status), true/false = in serial run result
        const madeTheCut = isExcluded ? null : serialItemIds.has(itemId);

        if (isExcluded) {
            li.classList.add("serial-excluded");
        } else if (!madeTheCut) {
            li.classList.add("serial-insufficient");
        }

        const toggleBtn = document.createElement("button");
        toggleBtn.className = "serial-item-toggle " + (
            isExcluded ? "excluded" : madeTheCut ? "included" : "insufficient"
        );
        toggleBtn.title = isExcluded
            ? "Excluded — click to include"
            : madeTheCut
                ? "Craftable in series — click to exclude"
                : "Materials exhausted by earlier crafts — click to exclude";
        toggleBtn.textContent = isExcluded ? "–" : madeTheCut ? "✓" : "✗";

        toggleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (serialExcluded.has(recipeId)) {
                serialExcluded.delete(recipeId);
            } else {
                serialExcluded.add(recipeId);
            }
            renderDashboardWatchlist(watchUl);
            renderSerialSummary();
        });

        // Insert before the remove button: name | badges | serial-toggle | remove
        li.insertBefore(toggleBtn, li.lastChild);
    } : null;

    renderWatchlist(watchUl, currentCraftableMap, null, showDetail, itemActions);
}

// ── Serial craft summary ──────────────────────────────────────────────────────

function renderSerialSummary() {
    const summaryEl = document.getElementById("serialSummary");
    const countEl   = document.getElementById("serialCount");
    const btn       = document.getElementById("serialGW2EBtn");

    if (!summaryEl || !countEl || !btn) return;

    if (!serialMode) {
        summaryEl.classList.add("hidden");
        return;
    }

    // Only pass recipe IDs that haven't been excluded
    const activeWatchlist = CraftMander.watchlist.filter(id => !serialExcluded.has(id));
    const { count, itemIds } = computeSerialCraftables(activeWatchlist);
    const total = activeWatchlist.length;

    if (total === 0) {
        summaryEl.classList.add("hidden");
        return;
    }

    countEl.textContent = count === 0
        ? "None craftable in series"
        : `${count} of ${total} craftable in series`;
    countEl.className = "serial-count " + (count === 0 ? "none" : count === total ? "all" : "some");

    if (count > 0) {
        const idSegments = itemIds.map(id => `1-${id}`).join(";");
        btn.href = `https://gw2efficiency.com/crafting/calculator/a~0!b~1!c~0!d~${idSegments}`;
        btn.style.display = "";
    } else {
        btn.style.display = "none";
    }

    summaryEl.classList.remove("hidden");
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function showDetail(recipeId) {
    const recipe = CraftMander.recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const itemId   = recipe.output_item_id;
    const item     = CraftMander.itemMap[itemId];
    const itemName = item?.name || `Item #${itemId}`;
    const rarity   = item?.rarity || "";

    const titleEl   = document.getElementById("detailTitle");
    const contentEl = document.getElementById("detailContent");

    titleEl.textContent = "";
    const titleSpan = document.createElement("span");
    titleSpan.textContent = itemName;
    if (rarity) titleSpan.classList.add("rarity-" + rarity.toLowerCase());
    titleEl.appendChild(titleSpan);

    contentEl.innerHTML = "";

    // External links
    const linksDiv = document.createElement("div");
    linksDiv.className = "detail-links";

    const wikiUrl = "https://wiki.guildwars2.com/wiki/" + encodeURIComponent(itemName.replace(/ /g, "_"));
    const effUrl  = `https://gw2efficiency.com/crafting/calculator/a~0!b~1!c~0!d~1-${itemId}`;

    linksDiv.innerHTML = `
        <a href="${wikiUrl}" target="_blank" rel="noopener" class="detail-link wiki-link">
            📖 GW2 Wiki
        </a>
        <a href="${effUrl}" target="_blank" rel="noopener" class="detail-link eff-link">
            ⚙ GW2Efficiency
        </a>
    `;
    contentEl.appendChild(linksDiv);

    // Crafting tree
    const treeDiv = document.createElement("div");
    treeDiv.className = "craft-tree";

    const treeTitle = document.createElement("h3");
    treeTitle.className = "tree-heading";
    treeTitle.textContent = "Crafting Tree";
    treeDiv.appendChild(treeTitle);

    const treeUl = buildTreeNode(recipe, 0);
    treeDiv.appendChild(treeUl);
    contentEl.appendChild(treeDiv);
}

function buildTreeNode(recipe, depth) {
    const ul = document.createElement("ul");
    ul.className = "tree-list";

    for (const ing of recipe.ingredients) {
        const isCurrency = "currency_id" in ing;

        let ingName, ingRarity, owned, needed, hasEnough;

        if (isCurrency) {
            ingName   = CraftMander.currencies[ing.currency_id] || `Currency #${ing.currency_id}`;
            ingRarity = "";
            owned     = CraftMander.wallet[ing.currency_id] || 0;
            needed    = ing.count;
            hasEnough = owned >= needed;
        } else {
            const ingItem = CraftMander.itemMap[ing.item_id];
            ingName   = ingItem?.name || `Item #${ing.item_id}`;
            ingRarity = ingItem?.rarity || "";
            owned     = CraftMander.materials[ing.item_id] || 0;
            needed    = ing.count;
            hasEnough = owned >= needed;
        }

        const li = document.createElement("li");
        li.className = "tree-item";

        const nameSpan = document.createElement("span");
        nameSpan.className = "tree-item-name";
        if (ingRarity) nameSpan.classList.add("rarity-" + ingRarity.toLowerCase());
        if (isCurrency) nameSpan.classList.add("currency-ingredient");
        nameSpan.textContent = `${needed}× ${ingName}`;

        const countSpan = document.createElement("span");
        countSpan.className = "tree-count " + (hasEnough ? "have" : "missing");
        countSpan.textContent = `${owned}/${needed}`;

        li.appendChild(nameSpan);
        li.appendChild(countSpan);

        // Currency ingredients can't be sub-crafted — no toggle
        const subRecipes = !isCurrency && CraftMander.recipeLookup[ing.item_id];
        if (subRecipes && subRecipes.length > 0 && depth < 4) {
            const toggle = document.createElement("button");
            toggle.className = "tree-toggle";
            toggle.textContent = "▶";
            toggle.title = "Show sub-recipe";

            let expanded = false;
            let subUl = null;

            toggle.addEventListener("click", (e) => {
                e.stopPropagation();
                expanded = !expanded;
                toggle.textContent = expanded ? "▼" : "▶";
                if (expanded) {
                    subUl = buildTreeNode(subRecipes[0], depth + 1);
                    li.appendChild(subUl);
                } else if (subUl) {
                    li.removeChild(subUl);
                    subUl = null;
                }
            });

            li.insertBefore(toggle, nameSpan);
        } else {
            const spacer = document.createElement("span");
            spacer.className = "tree-toggle-spacer";
            li.insertBefore(spacer, nameSpan);
        }

        ul.appendChild(li);
    }

    return ul;
}
