/**
 * Summarize every listing from all processors for a card.
 * Stats cover all priced listings (in and out of stock); the stored results are reduced to
 * the cheapest in-stock listing per vendor + set + condition, plus the cheapest
 * out-of-stock listing per vendor + set when that set has nothing in stock.
 * This keeps the deck document bounded while preserving the full price range.
 */
function summarizePricing(listings) {
  const priced = listings.filter(listing => listing.found && listing.price > 0);
  const notFound = listings.filter(listing => !listing.found);

  const stats = priced.length > 0
    ? {
        min: Math.min(...priced.map(listing => listing.price)),
        max: Math.max(...priced.map(listing => listing.price)),
        avg: Math.round(priced.reduce((sum, listing) => sum + listing.price, 0) / priced.length),
        count: priced.length
      }
    : null;

  const cheapestBy = (items, keyOf) => {
    const best = new Map();
    for (const item of items) {
      const key = keyOf(item);
      if (!best.has(key) || item.price < best.get(key).price) best.set(key, item);
    }
    return best;
  };

  const inStock = cheapestBy(priced.filter(l => l.inStock), l => `${l.source}|${l.set}|${l.condition}`);
  const setsInStock = new Set([...inStock.values()].map(l => `${l.source}|${l.set}`));
  const outOfStock = cheapestBy(
    priced.filter(l => !l.inStock && !setsInStock.has(`${l.source}|${l.set}`)),
    l => `${l.source}|${l.set}`
  );

  return {
    results: [...inStock.values(), ...outOfStock.values(), ...notFound],
    stats
  };
}

module.exports = { summarizePricing };
