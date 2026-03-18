// search.js — Recipe Explorer page

window.addEventListener("DOMContentLoaded", async () => {
    await loadGameData();

    const input     = document.getElementById("recipeSearch");
    const resultsUl = document.getElementById("searchResults");
    const watchUl   = document.getElementById("explorerWatchlist");
    const clearBtn  = document.getElementById("clearWatchlistBtn");

    if (!input || !resultsUl || !watchUl) {
        console.error("Explorer: missing DOM elements");
        return;
    }

    const rerender = () => {
        renderWatchlist(watchUl, {}, null, null, null, null);
        // Re-render search results so "✔ Added" states reflect cleared list
        renderSearchResults(input.value.trim().toLowerCase(), resultsUl, watchUl);
    };

    // Initial watchlist render (no craftable info — materials not loaded here)
    renderWatchlist(watchUl);

    if (clearBtn) {
        clearBtn.addEventListener("click", () => clearWatchlist(rerender));
    }

    input.addEventListener("input", () => {
        renderSearchResults(input.value.trim().toLowerCase(), resultsUl, watchUl);
    });
});

function renderSearchResults(query, resultsUl, watchUl) {
    resultsUl.innerHTML = "";

    if (!query) return;

    const matches = CraftMander.recipes.filter(recipe => {
        const name = CraftMander.itemMap[recipe.output_item_id]?.name || "";
        return name.toLowerCase().includes(query);
    });

    if (matches.length === 0) {
        const li = document.createElement("li");
        li.className = "empty-state";
        li.textContent = "No recipes found.";
        resultsUl.appendChild(li);
        return;
    }

    for (const recipe of matches) {
        const itemId   = recipe.output_item_id;
        const itemName = CraftMander.itemMap[itemId]?.name || `Item #${itemId}`;
        const onList   = CraftMander.watchlist.includes(recipe.id);

        const li = document.createElement("li");

        const nameSpan = document.createElement("span");
        nameSpan.className = "item-name";
        nameSpan.textContent = itemName;
        const rarity = CraftMander.itemMap[itemId]?.rarity;
        if (rarity) nameSpan.classList.add("rarity-" + rarity.toLowerCase());
        li.appendChild(nameSpan);

        const addBtn = document.createElement("button");
        addBtn.textContent = onList ? "✔ Added" : "+ Watch";
        addBtn.disabled = onList;
        addBtn.addEventListener("click", () => {
            addToWatchlist(recipe.id);
            addBtn.textContent = "✔ Added";
            addBtn.disabled = true;
            renderWatchlist(watchUl);
        });

        li.appendChild(addBtn);
        resultsUl.appendChild(li);
    }
}
