// libraries.js — Library Manager page

window.addEventListener("DOMContentLoaded", async () => {
    await loadGameData();

    const libraryListUl = document.getElementById("libraryList");
    const previewTitle  = document.getElementById("libraryTitle");
    const previewUl     = document.getElementById("libraryRecipes");
    const actionsDiv    = document.getElementById("libraryActions");
    const watchUl       = document.getElementById("explorerWatchlist");
    const clearBtn      = document.getElementById("clearWatchlistBtn");

    if (!libraryListUl || !previewTitle || !previewUl || !actionsDiv || !watchUl) {
        console.error("Libraries: missing DOM elements");
        return;
    }

    // Load libraries.json
    let raw = {};
    try {
        const res = await fetch("data/libraries.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        raw = await res.json();
    } catch (err) {
        console.error("Failed to load libraries.json:", err);
        libraryListUl.innerHTML = "<li class='empty-state'>Could not load libraries.</li>";
        return;
    }

    const libraries = {};

    for (const [libName, libValue] of Object.entries(raw)) {
        if (libName.startsWith("_")) continue;
        if (typeof libValue !== "object" || Array.isArray(libValue)) continue;

        const recipeIds = [];
        for (const [entryKey, entryValue] of Object.entries(libValue)) {
            if (entryKey.startsWith("_")) continue;
            if (typeof entryValue !== "object") continue;
            const id = entryValue.recipe_id;
            if (typeof id !== "number") continue;
            recipeIds.push(id);
        }

        if (recipeIds.length > 0) {
            libraries[libName] = recipeIds;
        }
    }

    if (Object.keys(libraries).length === 0) {
        libraryListUl.innerHTML = "<li class='empty-state'>No libraries with confirmed recipes yet.</li>";
        return;
    }

    // Populate library sidebar
    for (const libName of Object.keys(libraries)) {
        const li = document.createElement("li");
        li.textContent = libName;
        li.addEventListener("click", () => {
            libraryListUl.querySelectorAll("li").forEach(el => el.classList.remove("active"));
            li.classList.add("active");
            activeLibName   = libName;
            activeRecipeIds = libraries[libName];
            selectLibrary(libName, libraries[libName]);
        });
        libraryListUl.appendChild(li);
    }

    // Initial watchlist render
    renderWatchlist(watchUl);

    let activeLibName    = null;
    let activeRecipeIds  = null;

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            clearWatchlist(() => {
                renderWatchlist(watchUl);
                if (activeLibName) selectLibrary(activeLibName, activeRecipeIds);
            });
        });
    }

    function selectLibrary(libName, recipeIds) {
        previewTitle.textContent = libName;
        previewUl.innerHTML = "";
        actionsDiv.innerHTML = "";

        // craftableMap values are now counts (number | undefined)
        const craftableMap = computeCraftables();

        for (const recipeId of recipeIds) {
            const recipe = CraftMander.recipes.find(r => r.id === recipeId);
            if (!recipe) continue;

            const itemId      = recipe.output_item_id;
            const item        = CraftMander.itemMap[itemId];
            const itemName    = item?.name || `Item #${itemId}`;
            const rarity      = item?.rarity || "";
            const craftCount  = craftableMap[itemId]; // number | undefined
            const onList      = CraftMander.watchlist.includes(recipeId);

            const li = document.createElement("li");

            const nameSpan = document.createElement("span");
            nameSpan.className = "item-name";
            nameSpan.textContent = itemName;
            if (rarity) nameSpan.classList.add("rarity-" + rarity.toLowerCase());
            li.appendChild(nameSpan);

            if (craftCount !== undefined) {
                const badge = document.createElement("span");
                if (craftCount > 0) {
                    badge.className = "badge craftable";
                    badge.textContent = craftCount > 1 ? `✓ ×${craftCount}` : "✓";
                    badge.title = `Can craft ${craftCount} time${craftCount !== 1 ? "s" : ""}`;
                } else {
                    badge.className = "badge not-craftable";
                    badge.textContent = "✗";
                }
                li.appendChild(badge);
            }

            if (onList) {
                const tag = document.createElement("span");
                tag.className = "badge on-list";
                tag.textContent = "Watching";
                li.appendChild(tag);
            }

            previewUl.appendChild(li);
        }

        // Add / Remove All buttons
        const addBtn = document.createElement("button");
        addBtn.textContent = "＋ Add All to Watchlist";
        addBtn.addEventListener("click", () => {
            for (const recipeId of recipeIds) addToWatchlist(recipeId);
            renderWatchlist(watchUl);
            selectLibrary(libName, recipeIds);
        });

        const removeBtn = document.createElement("button");
        removeBtn.className = "danger";
        removeBtn.textContent = "✖ Remove All from Watchlist";
        removeBtn.addEventListener("click", () => {
            for (const recipeId of recipeIds) removeFromWatchlist(recipeId);
            renderWatchlist(watchUl);
            selectLibrary(libName, recipeIds);
        });

        actionsDiv.appendChild(addBtn);
        actionsDiv.appendChild(removeBtn);
    }
});
