// config.js — global state
window.CraftMander = {
    recipes:      [],
    items:        [],
    itemMap:      {},
    recipeLookup: {},
    currencies:   {},  // currency ID → name, from data/currencies.json
    materials:    {},  // item ID → count, from account/materials
    wallet:       {},  // currency ID → balance, from account/wallet
    watchlist:    []
};
