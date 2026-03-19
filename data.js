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

// ── Material cache (sessionStorage) ──────────────────────────────────────────
// Materials and wallet are cached for the lifetime of the browser tab.
// They are only re-fetched when the user explicitly clicks "Load Materials".
// Cache is keyed by API key so switching accounts always fetches fresh data.

const CACHE_KEY_MATERIALS = "CraftManderMaterials";
const CACHE_KEY_WALLET    = "CraftManderWallet";
const CACHE_KEY_ACCOUNT   = "CraftManderAccountName";
const CACHE_KEY_API_KEY   = "CraftManderCachedKey"; // which key the cache belongs to

/**
 * Restore materials/wallet from sessionStorage into CraftMander globals.
 * Returns the cached account name if available, or null if no cache exists
 * (or if the cache belongs to a different API key).
 */
function restoreMaterialCache(apiKey) {
    try {
        const cachedKey = sessionStorage.getItem(CACHE_KEY_API_KEY);
        if (cachedKey !== apiKey) return null; // stale or different account

        const rawMaterials = sessionStorage.getItem(CACHE_KEY_MATERIALS);
        const rawWallet    = sessionStorage.getItem(CACHE_KEY_WALLET);
        if (!rawMaterials) return null;

        CraftMander.materials = JSON.parse(rawMaterials);
        CraftMander.wallet    = rawWallet ? JSON.parse(rawWallet) : {};

        return sessionStorage.getItem(CACHE_KEY_ACCOUNT) || null;
    } catch {
        return null;
    }
}

/**
 * Save materials/wallet to sessionStorage after a successful fetch.
 */
function saveMaterialCache(apiKey, accountName) {
    try {
        sessionStorage.setItem(CACHE_KEY_API_KEY,   apiKey);
        sessionStorage.setItem(CACHE_KEY_MATERIALS, JSON.stringify(CraftMander.materials));
        sessionStorage.setItem(CACHE_KEY_WALLET,    JSON.stringify(CraftMander.wallet));
        sessionStorage.setItem(CACHE_KEY_ACCOUNT,   accountName || "");
    } catch {
        // sessionStorage quota exceeded or unavailable — silently ignore
    }
}

/**
 * Clear the material cache (e.g. on explicit refresh or account change).
 */
function clearMaterialCache() {
    sessionStorage.removeItem(CACHE_KEY_MATERIALS);
    sessionStorage.removeItem(CACHE_KEY_WALLET);
    sessionStorage.removeItem(CACHE_KEY_ACCOUNT);
    sessionStorage.removeItem(CACHE_KEY_API_KEY);
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
 *
 * After a successful fetch, results are cached in sessionStorage so that
 * navigating between pages doesn't trigger additional API calls.
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
