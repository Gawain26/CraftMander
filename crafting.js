// crafting.js — craftability checks
// craft.js is deleted; this is the single source of truth.

/**
 * Check whether itemId can be obtained — either from inventory or by crafting.
 *
 * @param {number}  itemId
 * @param {Object}  inv   - mutable inventory clone; consumed as ingredients are used
 * @param {Object}  wallet - mutable wallet clone; consumed as currency ingredients are used
 * @param {Object}  memo  - keyed by itemId only (not inventory snapshot — inventory
 *                          mutation is the source of truth, memo just short-circuits
 *                          items we already know are fully unreachable with no recipe)
 * @returns {boolean}
 */
function canCraftItem(itemId, inv, wallet, memo = {}) {
    // Already have one in inventory — consume it and succeed.
    if ((inv[itemId] || 0) > 0) {
        inv[itemId] -= 1;
        return true;
    }

    // No recipe exists — permanently false for this item.
    if (memo[itemId] === false) return false;

    const recipes = CraftMander.recipeLookup[itemId];
    if (!recipes || recipes.length === 0) {
        memo[itemId] = false;
        return false;
    }

    // Try each recipe; use the first one whose ingredients are all satisfiable.
    for (const recipe of recipes) {
        const invSnapshot    = { ...inv };
        const walletSnapshot = { ...wallet };
        let ok = true;

        for (const ing of recipe.ingredients) {
            if ("currency_id" in ing) {
                // Currency ingredient — check wallet balance directly.
                // Currency is consumed in bulk (not one-at-a-time like items),
                // so we deduct the full count in one go.
                const have = wallet[ing.currency_id] || 0;
                if (have < ing.count) {
                    ok = false;
                    break;
                }
                wallet[ing.currency_id] = have - ing.count;
            } else {
                // Standard item ingredient — recurse as before.
                for (let i = 0; i < ing.count; i++) {
                    if (!canCraftItem(ing.item_id, inv, wallet, memo)) {
                        ok = false;
                        break;
                    }
                }
                if (!ok) break;
            }
        }

        if (ok) {
            // inv and wallet were mutated in-place as ingredients were consumed — done.
            return true;
        }

        // This recipe path failed — restore both snapshots and try the next recipe.
        Object.assign(inv, invSnapshot);
        Object.assign(wallet, walletSnapshot);
        for (const key of Object.keys(inv)) {
            if (!(key in invSnapshot)) delete inv[key];
        }
        for (const key of Object.keys(wallet)) {
            if (!(key in walletSnapshot)) delete wallet[key];
        }
    }

    return false;
}

/**
 * For every recipe on the watchlist, determine craftability against current materials.
 * Each item is checked independently against a fresh inventory + wallet snapshot.
 * Returns a map of { [output_item_id]: boolean }
 */
function computeCraftables() {
    const results = {};

    for (const recipeId of CraftMander.watchlist) {
        const recipe = CraftMander.recipes.find(r => r.id === recipeId);
        if (!recipe) continue;

        const itemId = recipe.output_item_id;
        results[itemId] = canCraftItem(
            itemId,
            { ...CraftMander.materials },
            { ...CraftMander.wallet },
            {}
        );
    }

    return results;
}

/**
 * Run watchlist items against a single shared inventory + wallet clone in order.
 * @param {number[]} watchlist  optional subset — defaults to CraftMander.watchlist
 * Returns { count, itemIds }
 */
function computeSerialCraftables(watchlist = CraftMander.watchlist) {
    const inv    = { ...CraftMander.materials };
    const wallet = { ...CraftMander.wallet };
    const itemIds = [];

    for (const recipeId of watchlist) {
        const recipe = CraftMander.recipes.find(r => r.id === recipeId);
        if (!recipe) continue;

        const itemId = recipe.output_item_id;
        // inv and wallet are mutated in place — successful crafts consume their ingredients
        if (canCraftItem(itemId, inv, wallet, {})) {
            itemIds.push(itemId);
        }
    }

    return { count: itemIds.length, itemIds };
}
