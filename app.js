// Global variables
let recipes = []
let items = []
let itemMap = {}

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

// Hardcoded tracked recipes (replace with real IDs later)
let trackedRecipes = [1, 2, 3]

// Check if a recipe can be crafted
function canCraft(recipe) {
    for (const ing of recipe.ingredients) {
        const owned = materials[ing.item_id] || 0;
        if (owned < ing.count) return false;
    }
    return true;
}

// Render craftable recipes to the page
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

// Check tracked recipes and render craftable ones
function checkTrackedRecipes() {
    const craftable = [];
    for (const recipeId of trackedRecipes) {
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe) continue;
        if (canCraft(recipe)) craftable.push(recipe);
    }
    console.log("Craftable:", craftable);
    renderCraftable(craftable);
}

// Load datasets
async function loadData() {
    setStatus("⏳ Loading datasets...", "loading");
    try {
        const recipeRes = await fetch("data/recipes.json");
        recipes = await recipeRes.json();

        const itemRes = await fetch("data/items_pruned.json");
        items = await itemRes.json();

        buildItemMap();

        console.log("Recipes:", recipes.length);
        console.log("Items:", items.length);

        setStatus(`✅ Loaded ${recipes.length} recipes and ${items.length} items`, "ok");

        checkTrackedRecipes(); // Render craftable recipes

    } catch (err) {
        console.error(err);
        setStatus("❌ Error loading data", "error");
    }
}

// Start everything
loadData();
materials = {}
trackedRecipes = []

function loadAccount() {
  const key = document.getElementById("apikey").value
  console.log("API key entered:", key)
}

function searchRecipes() {
  const term = document.getElementById("searchBox").value
  console.log("Searching for:", term)
}

recipes = []
items = []

function setStatus(message, type) {

    const el = document.getElementById("statusIndicator")

    el.textContent = message

    el.className = ""

    if (type === "loading") el.classList.add("status-loading")
    if (type === "ok") el.classList.add("status-ok")
    if (type === "error") el.classList.add("status-error")
}

async function loadData() {

    setStatus("⏳ Loading datasets...", "loading")

    try {

        const recipeRes = await fetch("data/recipes.json")
        recipes = await recipeRes.json()

        const itemRes = await fetch("data/items.json")
        items = await itemRes.json()

        buildItemMap()

        console.log("Recipes:", recipes.length)
        console.log("Items:", items.length)

        setStatus("✅ CraftMander data loaded!", "ok")

    } catch (err) {

        console.error(err)

        setStatus("❌ Error loading data", "error")
    }
}

loadData()
