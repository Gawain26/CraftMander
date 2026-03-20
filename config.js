// config.js — global state
window.CraftMander = {
    recipes:      [],
    items:        [],
    itemMap:      {},
    recipeLookup: {},
    currencies:   {},  // currency ID → name, from data/currencies.json
    materials:    {},  // item ID → count, from account/materials
    wallet:       {},  // currency ID → balance, from account/wallet
    prices:       {},  // item ID → { buys: { unit_price }, sells: { unit_price } }, from commerce/prices
    watchlist:    []
};
