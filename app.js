// Global variables
let recipes = [];
let items = [];
let itemMap = {};
let watchlist = [];  // Stored as recipe IDs

// Globally accessible status function
window.setStatus = function(message, type) {
    const el = document.getElementById("statusIndicator");
    requestAnimationFrame(() => {
        el.textContent = message;
        el.className = "";
        if (type === "loading") el.classList.add("status-loading");
        if (type === "ok") el.classList.add("status-ok");
        if (type === "error") el.classList.add("status-error");
    });
}

// Build quick lookup table for items
function buildItemMap() {
    for (const item of items) {
        itemMap[item.id] = item;
    }
    console.log("Item map ready");
}

// Minimal test inventory
let materials = {
    19721: 50,
    19720: 100
}

// Search recipes by name
function searchRecipeByName(query) {
    query = query.toLowerCase();
    return recipes.filter(r => {
        const item = itemMap[r.output_item_id];
        if (!item) return false;
        return item.name.toLowerCase().includes(query);
    });
}

// Add recipe to watchlist
function addRecipeToWatchlist(recipeId) {
    if (!watchlist.includes(recipeId)) {
        watchlist.push(recipeId);
        saveWatchlist();
        renderWatchlist();
        checkTrackedRecipes();
    }
}

// Save watchlist to localStorage
function saveWatchlist() {
    localStorage.setItem("craftManderWatchlist", JSON.stringify(watchlist));
}

// Load watchlist from localStorage
function loadWatchlist() {
    const stored = localStorage.getItem("craftManderWatchlist");
    if (stored) {
        try {
            watchlist = JSON.parse(stored);
        } catch {
            watchlist = [];
        }
    }
}

// Render watchlist
function renderWatchlist() {
    const ul = document.getElementById("watchlist");
    ul.innerHTML = "";
    for (const recipeId of watchlist) {
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe) continue;
        const item = itemMap[recipe.output_item_id];
        const li = document.createElement("li");
        li.textContent = item ? item.name : `Item ID ${recipe.output_item_id}`;
        ul.appendChild(li);
    }
}

// Check if a recipe can be crafted
function canCraft(recipe) {
    for (const ing of recipe.ingredients) {
        const owned = materials[ing.item_id] || 0;
        if (owned < ing.count) return false;
    }
    return true;
}

// Render craftable recipes
function renderCraftable(list) {
    const ul = document.getElementById("craftList");
    ul.innerHTML = "";
    for (const recipe of list) {
        const item = itemMap[recipe.output_item_id];
        const li = document.createElement("li");
        li.textContent = item ? item.name : `Item ID ${recipe.output_item_id}`;
        ul.appendChild(li);
    }
}

// Check tracked recipes for craftability
function checkTrackedRecipes() {
    const craftable = [];
    for (const recipeId of watchlist) {
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe) continue;
        if (canCraft(recipe)) craftable.push(recipe);
    }
    renderCraftable(craftable);
}

// Render search results dropdown
function renderSearchResults(results) {
    const ul = document.getElementById("searchResults");
    ul.innerHTML = "";
    results.slice(0, 10).forEach(recipe => { // limit to 10 results
        const item = itemMap[recipe.output_item_id];
        const li = document.createElement("li");
        li.textContent = item ? item.name : `Item ID ${recipe.output_item_id}`;
        li.addEventListener("click", () => {
            addRecipeToWatchlist(recipe.id);
            ul.innerHTML = ""; // clear results after selection
            document.getElementById("recipeSearch").value = "";
        });
        ul.appendChild(li);
    });
}

// Hook up search UI
function setupSearchUI() {
    const searchInput = document.getElementById("recipeSearch");

    searchInput.addEventListener("input", () => {
        const query = searchInput.value.trim();
        if (!query) {
            document.getElementById("searchResults").innerHTML = "";
            return;
        }
        const results = searchRecipeByName(query);
        renderSearchResults(results);
    });
}

// Load datasets
async function loadData() {
    setStatus("⏳ Loading datasets...", "loading");
    try {
        const recipeRes = await fetch("data/recipes.json");
        recipes = await recipeRes.json();

        const itemRes = await fetch("data/items.json"); // updated name
        items = await itemRes.json();

        buildItemMap();

        console.log("Recipes:", recipes.length);
        console.log("Items:", items.length);

        setStatus(`✅ Loaded ${recipes.length} recipes and ${items.length} items`, "ok");

        loadWatchlist();
        renderWatchlist();
        checkTrackedRecipes();

    } catch (err) {
        console.error(err);
        setStatus("❌ Error loading data", "error");
    }
}

// Initialize app
loadData();
setupSearchUI();
