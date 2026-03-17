// data.js — load recipes/items from local data files, materials from GW2 API

async function loadGameData() {
    const [recipesRes, itemsRes] = await Promise.all([
        fetch("data/recipes.json"),
        fetch("data/items.json")
    ]);

    CraftMander.recipes = await recipesRes.json();
    CraftMander.items   = await itemsRes.json();

    buildItemMap();
    buildRecipeLookup();

    console.log(`Loaded ${CraftMander.recipes.length} recipes and ${CraftMander.items.length} items`);
}

function buildItemMap() {
    CraftMander.itemMap = {};
    for (const item of CraftMander.items) {
        CraftMander.itemMap[item.id] = item;
    }
}

function buildRecipeLookup() {
    CraftMander.recipeLookup = {};
    for (const recipe of CraftMander.recipes) {
        const id = recipe.output_item_id;
        if (!CraftMander.recipeLookup[id]) CraftMander.recipeLookup[id] = [];
        CraftMander.recipeLookup[id].push(recipe);
    }
}

// Point this at your deployed Cloudflare Worker URL.
// For local development with `wrangler dev`, use: "http://localhost:8787"
const PROXY_URL = "https://gw2-proxy.strikingwolf26.workers.dev";

/**
 * Fetch the account name for the given API key.
 * Returns the name string, e.g. "Username.1234"
 */
async function loadAccountName(apiKey) {
    const res = await fetch(PROXY_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ api_key: apiKey, endpoint: "account" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.name || null;
}
async function loadMaterials(apiKey) {
    if (!apiKey) {
        apiKey = localStorage.getItem("CraftManderAPIKey");
    }
    if (!apiKey) throw new Error("No API key provided");

    const res = await fetch(PROXY_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ api_key: apiKey }),
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.text || `Proxy error ${res.status}`);
    }

    const data = await res.json();

    CraftMander.materials = {};
    for (const entry of data) {
        if (entry.count > 0) {
            CraftMander.materials[entry.id] = entry.count;
        }
    }

    localStorage.setItem("CraftManderAPIKey", apiKey);
    console.log(`Loaded ${Object.keys(CraftMander.materials).length} material stacks`);
}
