// data.js — load recipes/items from local data files, materials from GW2 API

async function loadGameData() {
    const [recipesRes, itemsRes, currenciesRes] = await Promise.all([
        fetch("data/recipes.json"),
        fetch("data/items.json"),
        fetch("data/currencies.json"),
    ]);

    CraftMander.recipes    = await recipesRes.json();
    CraftMander.items      = await itemsRes.json();
    CraftMander.currencies = await currenciesRes.json(); // { id: name }

    buildItemMap();
    buildRecipeLookup();

    console.log(`Loaded ${CraftMander.recipes.length} recipes, ${CraftMander.items.length} items, ${Object.keys(CraftMander.currencies).length} currencies`);
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

/**
 * Fetch account/materials and account/wallet in parallel, populating
 * CraftMander.materials (item stacks) and CraftMander.wallet (currency balances).
 * Both are keyed by their respective IDs for O(1) lookup in crafting.js.
 */
async function loadMaterials(apiKey) {
    if (!apiKey) {
        apiKey = localStorage.getItem("CraftManderAPIKey");
    }
    if (!apiKey) throw new Error("No API key provided");

    const [materialsRes, walletRes] = await Promise.all([
        fetch(PROXY_URL, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ api_key: apiKey, endpoint: "materials" }),
        }),
        fetch(PROXY_URL, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ api_key: apiKey, endpoint: "wallet" }),
        }),
    ]);

    if (!materialsRes.ok) {
        const body = await materialsRes.json().catch(() => ({}));
        throw new Error(body.error || body.text || `Proxy error ${materialsRes.status}`);
    }

    // Wallet failing (e.g. missing permission) is non-fatal — we just log it and
    // continue with an empty wallet. Currency-ingredient recipes will show as
    // uncraftable rather than crashing the whole load.
    const materialsData = await materialsRes.json();
    let walletData = [];
    if (walletRes.ok) {
        walletData = await walletRes.json();
    } else {
        console.warn("Wallet fetch failed — currency ingredients won't be checked. Add the 'wallet' permission to your API key.");
    }

    CraftMander.materials = {};
    for (const entry of materialsData) {
        if (entry.count > 0) {
            CraftMander.materials[entry.id] = entry.count;
        }
    }

    CraftMander.wallet = {};
    for (const entry of walletData) {
        if (entry.value > 0) {
            CraftMander.wallet[entry.id] = entry.value;
        }
    }

    localStorage.setItem("CraftManderAPIKey", apiKey);
    console.log(`Loaded ${Object.keys(CraftMander.materials).length} material stacks, ${Object.keys(CraftMander.wallet).length} wallet currencies`);
}
