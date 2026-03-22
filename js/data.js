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
// They are only re-fetched when the user explicitly clicks "Refresh Materials".
// Cache is keyed by API key so switching accounts always fetches fresh data.

const CACHE_KEY_MATERIALS = "CraftManderMaterials";
const CACHE_KEY_WALLET    = "CraftManderWallet";
const CACHE_KEY_ACCOUNT   = "CraftManderAccountName";
const CACHE_KEY_API_KEY   = "CraftManderCachedKey"; // which key the cache belongs to
const CACHE_KEY_TIMESTAMP = "CraftManderFetchedAt"; // ISO string of when data was fetched

/**
 * Restore materials/wallet from sessionStorage into CraftMander globals.
 * Returns { accountName, fetchedAt } on a cache hit, or null on a miss /
 * key mismatch. fetchedAt is a Date of when the data was originally fetched.
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

        const accountName = sessionStorage.getItem(CACHE_KEY_ACCOUNT) || null;
        const fetchedAt   = new Date(sessionStorage.getItem(CACHE_KEY_TIMESTAMP) || Date.now());
        return { accountName, fetchedAt };
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
        sessionStorage.setItem(CACHE_KEY_TIMESTAMP, new Date().toISOString());
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

// ── Price cache (sessionStorage) ──────────────────────────────────────────────
// Prices are cached separately from materials — they don't require an API key
// and are keyed by a sorted, comma-joined string of the requested item IDs.
// If the watchlist changes, the ID string won't match and a fresh fetch occurs.

const CACHE_KEY_PRICES    = "CraftManderPrices";
const CACHE_KEY_PRICE_IDS = "CraftManderPriceIDs";   // the ID set the cache covers
const CACHE_KEY_PRICE_TS  = "CraftManderPriceFetchedAt";

const GW2_PRICES_URL = "https://api.guildwars2.com/v2/commerce/prices";
const PRICE_BATCH    = 200;

/**
 * Stable string key representing a set of item IDs — used to detect watchlist changes.
 */
function priceIdKey(itemIds) {
    return [...itemIds].sort((a, b) => a - b).join(",");
}

/**
 * Restore prices from sessionStorage into CraftMander.prices.
 *
 * A cache hit is declared when the cached ID set is a superset of the
 * requested IDs — i.e. every price we need is already stored, even if the
 * watchlist has shrunk since the last fetch. This means removing items from
 * the watchlist never invalidates the price cache.
 *
 * Returns { fetchedAt } on a cache hit, else null.
 */
function restorePriceCache(itemIds) {
    try {
        const cachedIdKey = sessionStorage.getItem(CACHE_KEY_PRICE_IDS);
        if (!cachedIdKey) return null;

        const raw = sessionStorage.getItem(CACHE_KEY_PRICES);
        if (!raw) return null;

        // Build a set from the cached ID string for O(1) membership checks.
        const cachedIdSet = new Set(cachedIdKey.split(",").map(Number));

        // Every requested ID must be present in the cache.
        for (const id of itemIds) {
            if (!cachedIdSet.has(id)) return null;
        }

        CraftMander.prices = JSON.parse(raw);
        const fetchedAt    = new Date(sessionStorage.getItem(CACHE_KEY_PRICE_TS) || Date.now());
        return { fetchedAt };
    } catch {
        return null;
    }
}

/**
 * Persist the current CraftMander.prices to sessionStorage.
 */
function savePriceCache(itemIds) {
    try {
        sessionStorage.setItem(CACHE_KEY_PRICE_IDS, priceIdKey(itemIds));
        sessionStorage.setItem(CACHE_KEY_PRICES,    JSON.stringify(CraftMander.prices));
        sessionStorage.setItem(CACHE_KEY_PRICE_TS,  new Date().toISOString());
    } catch {
        // quota exceeded — silently skip
    }
}

/**
 * Clear the price cache.
 */
function clearPriceCache() {
    sessionStorage.removeItem(CACHE_KEY_PRICES);
    sessionStorage.removeItem(CACHE_KEY_PRICE_IDS);
    sessionStorage.removeItem(CACHE_KEY_PRICE_TS);
}

/**
 * Fetch TP prices for the output items of every recipe on the watchlist.
 *
 * If `force` is false (default), a cached result for the same set of IDs is
 * returned without hitting the network. Pass `force: true` when the user
 * explicitly refreshes.
 *
 * Populates CraftMander.prices  →  { [itemId]: { buys, sells } }
 * Returns { fetchedAt, fromCache } on success; throws on network error.
 */
async function loadPrices({ force = false } = {}) {
    // Collect output item IDs from the current watchlist
    const itemIds = [];
    for (const recipeId of CraftMander.watchlist) {
        const recipe = CraftMander.recipes.find(r => r.id === recipeId);
        if (recipe) itemIds.push(recipe.output_item_id);
    }

if (itemIds.length === 0) {
        CraftMander.prices = {};
        return { fetchedAt: new Date(), fromCache: false };
    }

    // ── Cache hit ─────────────────────────────────────────────────────────
    if (!force) {
        const cached = restorePriceCache(itemIds);
        if (cached !== null) {
            console.log(`Restored prices for ${Object.keys(CraftMander.prices).length} items from cache.`);
            return { fetchedAt: cached.fetchedAt, fromCache: true };
        }
    } else {
        clearPriceCache();
    }

    // ── Cache miss — fetch from GW2 API in batches ────────────────────────
    CraftMander.prices = {};

    for (let i = 0; i < itemIds.length; i += PRICE_BATCH) {
        const batch = itemIds.slice(i, i + PRICE_BATCH);
        const res   = await fetch(`${GW2_PRICES_URL}?ids=${batch.join(",")}`);
        if (!res.ok) throw new Error(`GW2 prices API returned ${res.status}`);
        const data  = await res.json();
        for (const entry of data) {
            CraftMander.prices[entry.id] = entry;
        }
    }

    savePriceCache(itemIds);
    const fetchedAt = new Date();
    console.log(`Fetched prices for ${Object.keys(CraftMander.prices).length} of ${itemIds.length} watchlist items.`);
    return { fetchedAt, fromCache: false };
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
 * If `force` is false (the default), a valid sessionStorage cache for this API
 * key is used instead of making network requests — no proxy hit at all.
 * Pass `force: true` when the user explicitly clicks "Refresh Materials".
 */
async function loadMaterials(apiKey, { force = false } = {}) {
    if (!apiKey) {
        apiKey = localStorage.getItem("CraftManderAPIKey");
    }
    if (!apiKey) throw new Error("No API key provided");

    // ── Cache hit ─────────────────────────────────────────────────────────
    if (!force) {
        const cached = restoreMaterialCache(apiKey);
        if (cached !== null) {
            console.log(
                `Restored ${Object.keys(CraftMander.materials).length} material stacks ` +
                `and ${Object.keys(CraftMander.wallet).length} wallet currencies from cache.`
            );
            return cached; // { accountName, fetchedAt }
        }
    } else {
        clearMaterialCache();
    }

    // ── Cache miss — fetch from proxy ─────────────────────────────────────
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

    // Return null here; the caller (api-panel) will fetch the account name
    // separately and pass it to saveMaterialCache.
    return null;
}
