const { isFoilFinish, toCents } = require('./cardIdentity');

/**
 * Pure converters from each platform's raw searchCard listing to a sell listing:
 * { source, name, set, setCode, collectorNumber, foil, finish, treatment,
 *   condition, priceCents, inStock, url }
 */

const parenGroups = (text) => [...String(text).matchAll(/\(([^)]+)\)/g)].map(match => match[1]);

const faceToFaceListings = (raw, source) => {
  const skuMatch = (raw.sku || '').match(/^SIN-MTG-([A-Z0-9]+)-/i);
  const finish = raw.finish || (raw.foil ? 'Foil' : 'Non-Foil');

  return [{
    source,
    name: String([].concat(raw.cardName || [])[0] || String(raw.name || '').split(' [')[0]).trim(),
    set: raw.set,
    setCode: skuMatch ? skuMatch[1] : null,
    collectorNumber: raw.collectorNumber !== undefined && raw.collectorNumber !== null ? String(raw.collectorNumber) : null,
    foil: isFoilFinish(finish),
    finish,
    treatment: [].concat(raw.artQualifier || []).filter(q => q && q !== 'Default Art').join(' '),
    condition: raw.condition,
    priceCents: toCents(raw.price),
    inStock: !!raw.inStock,
    url: raw.productHandle ? `https://facetofacegames.com/products/${raw.productHandle}` : null
  }];
};

// Storepass lists one product per printing with a variant per condition
const tapsListings = (raw, source) => {
  const displayName = raw.displayName || raw.name || '';
  const codeMatch = displayName.match(/\(([A-Z0-9]{2,6})-([^)]*)\)/);
  const groups = parenGroups(displayName);
  const finishGroup = groups.find(group => /foil/i.test(group));
  const tag = (prefix) => {
    const found = (raw.tags || []).find(t => typeof t === 'string' && t.startsWith(`${prefix}_`));
    return found ? found.slice(prefix.length + 1) : null;
  };
  const foil = raw.selectedFinish ? raw.selectedFinish !== 'nonfoil' : /foil\s*$/i.test(displayName);

  const base = {
    source,
    name: displayName.split(/\s+[(\[]/)[0].trim(),
    set: tag('Set') || (displayName.match(/\[([^\]]+)\]/) || [])[1] || 'Unknown Set',
    setCode: tag('Set Code') || (codeMatch ? codeMatch[1] : null),
    collectorNumber: tag('Number') || (codeMatch && codeMatch[2] ? codeMatch[2] : null),
    foil,
    finish: finishGroup || (foil ? 'Foil' : 'Non-Foil'),
    treatment: groups
      .filter(group => group !== finishGroup && !(codeMatch && group === `${codeMatch[1]}-${codeMatch[2]}`))
      .join(' '),
    url: raw.url || null
  };

  const variants = raw.variants || [];
  if (variants.length === 0) {
    return [{ ...base, condition: 'Unknown', priceCents: toCents(raw.price), inStock: raw.stock > 0 }];
  }

  return variants.map(variant => ({
    ...base,
    condition: variant.title || variant.condition || 'Unknown',
    priceCents: toCents(variant.price),
    inStock: variant.inventory_quantity > 0
  }));
};

// Conduct Commerce names look like "Sol Ring - Foil Extended Art"
const conductCommerceListings = (raw, source) => {
  const [name, ...suffixParts] = String(raw.name || '').split(/\s+-\s+/);
  const suffix = suffixParts.join(' ');
  const finishMatch = suffix.match(/\b(?:[a-z]+ )?foil(?: etched)?\b/i);
  const foil = raw.finish ? isFoilFinish(raw.finish) : /foil/i.test(suffix);

  return [{
    source,
    name: name.trim(),
    set: raw.set,
    setCode: null,
    collectorNumber: null,
    foil,
    finish: finishMatch ? finishMatch[0] : (foil ? 'Foil' : 'Non-Foil'),
    treatment: suffix.replace(/\b(?:[a-z]+ )?foil(?: etched)?\b/i, '').replace(/\s+/g, ' ').trim(),
    condition: raw.condition,
    priceCents: toCents(raw.price),
    inStock: raw.stock > 0,
    url: raw.url || null
  }];
};

// Shopify "Norm" theme puts the finish in the variant label: "Near Mint Foil"
const shopifyStoreListings = (raw, source) => {
  const title = String(raw.name || '');
  const foil = /foil/i.test(raw.condition || '') && !/non-?foil/i.test(raw.condition || '');

  return [{
    source,
    name: title.split(/\s+\(/)[0].trim(),
    set: raw.set,
    setCode: null,
    collectorNumber: null,
    foil,
    finish: foil ? 'Foil' : 'Non-Foil',
    treatment: parenGroups(title).join(' '),
    condition: raw.condition,
    priceCents: toCents(raw.price),
    inStock: !!raw.inStock,
    url: raw.url || null
  }];
};

module.exports = {
  faceToFaceListings,
  tapsListings,
  conductCommerceListings,
  shopifyStoreListings
};
