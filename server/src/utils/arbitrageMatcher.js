const {
  normalizeName,
  normalizeSet,
  normalizeNumber,
  normalizeFinish,
  normalizeTreatment,
  isNearMint
} = require('./cardIdentity');

const sameCode = (a, b) => !!a && !!b && String(a).toLowerCase() === String(b).toLowerCase();

/**
 * Decide whether a sell listing is the printing a buylist entry wants.
 * Returns null for no match, otherwise { exact } where exact means set + collector number agreed.
 */
const matchListing = (entry, listing) => {
  if (listing.source === entry.vendor) return null;
  if (!listing.inStock || !listing.priceCents) return null;
  if (!isNearMint(listing.condition)) return null;
  if (normalizeName(entry.name) !== normalizeName(listing.name)) return null;
  if (!!entry.foil !== !!listing.foil) return null;

  const sameSet = normalizeSet(entry.set) === normalizeSet(listing.set);
  const entryNumber = normalizeNumber(entry.collectorNumber);
  const listingNumber = normalizeNumber(listing.collectorNumber);

  if (entryNumber && listingNumber) {
    if (entryNumber !== listingNumber) return null;
    if (!sameSet && !sameCode(entry.setCode, listing.setCode)) return null;
    return { exact: true };
  }

  if (!sameSet) return null;

  // Without collector numbers the treatment is the only way to tell printings apart
  if (normalizeTreatment(entry.treatment) !== normalizeTreatment(listing.treatment)) return null;

  return { exact: false };
};

const printingKey = (entry) =>
  `${entry.vendor}|${normalizeName(entry.name)}|${normalizeSet(entry.set)}|${!!entry.foil}`;

/**
 * Pair buylist entries with sell listings priced below the cash buy price.
 * Keeps the cheapest listing per buylist entry + selling vendor, best margin first.
 */
const findOpportunities = (entries, listings) => {
  const printingCounts = {};
  entries.forEach(entry => {
    const key = printingKey(entry);
    printingCounts[key] = (printingCounts[key] || 0) + 1;
  });

  const best = new Map();

  entries.forEach((entry, entryIndex) => {
    listings.forEach(listing => {
      const match = matchListing(entry, listing);
      if (!match) return;

      const marginCents = entry.buyCashCents - listing.priceCents;
      if (marginCents <= 0) return;

      const key = `${entryIndex}|${listing.source}`;
      const existing = best.get(key);
      if (existing && existing.sellPriceCents <= listing.priceCents) return;

      const finishDiffers = normalizeFinish(entry.finish) !== normalizeFinish(listing.finish);
      const ambiguous = !match.exact && (printingCounts[printingKey(entry)] > 1 || !!entry.treatment);

      best.set(key, {
        name: entry.name,
        set: entry.set,
        collectorNumber: entry.collectorNumber || null,
        foil: !!entry.foil,
        finish: entry.finish || null,
        treatment: entry.treatment || null,
        buyVendor: entry.vendor,
        buyCashCents: entry.buyCashCents,
        buyCreditCents: entry.buyCreditCents || null,
        buyUrl: entry.url || null,
        sellVendor: listing.source,
        sellPriceCents: listing.priceCents,
        sellSet: listing.set,
        sellCondition: listing.condition,
        sellUrl: listing.url || null,
        marginCents,
        marginPct: Math.round((marginCents / listing.priceCents) * 1000) / 10,
        exactMatch: match.exact,
        needsReview: finishDiffers || ambiguous
      });
    });
  });

  return [...best.values()].sort((a, b) => b.marginCents - a.marginCents);
};

module.exports = {
  matchListing,
  findOpportunities
};
