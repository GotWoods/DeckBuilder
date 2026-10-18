const { isNearMint, isFoilFinish, toCents } = require('./cardIdentity');

/**
 * Pure parsers turning vendor buylist pages into buylist entries:
 * { vendor, name, set, setCode, collectorNumber, foil, finish, treatment,
 *   buyCashCents, buyCreditCents, retailCents, url }
 * Each returns { entries, topBuyCents } where topBuyCents is the lowest product-level
 * buy price on the page, used to stop a high-to-low crawl.
 */

const tagValue = (tags, prefix) => {
  const tag = (tags || []).find(t => typeof t === 'string' && t.startsWith(`${prefix}_`));
  return tag ? tag.slice(prefix.length + 1) : null;
};

const parseTapsProduct = (product) => {
  const displayName = product.display_name || '';
  const name = displayName.split(/\s+[(\[]/)[0].trim();
  if (!name) return null;

  const codeMatch = displayName.match(/\(([A-Z0-9]{2,6})-([^)]*)\)/);
  const groups = [...displayName.matchAll(/\(([^)]+)\)/g)].map(match => match[1]);
  const finishGroup = groups.find(group => /foil/i.test(group));
  const treatment = groups
    .filter(group => group !== finishGroup && !(codeMatch && group === `${codeMatch[1]}-${codeMatch[2]}`))
    .join(' ');

  const nearMint = (product.store_pass_variant_info || []).find(variant => isNearMint(variant.title));
  const buyCashCents = toCents(nearMint ? nearMint.offer_price : product.offer_price);
  if (!buyCashCents) return null;

  const retail = (product.variant_info || []).find(variant => isNearMint(variant.title));

  return {
    vendor: 'taps',
    name,
    set: tagValue(product.tags, 'Set') || product.product_data?.set_name || (displayName.match(/\[([^\]]+)\]/) || [])[1] || 'Unknown Set',
    setCode: tagValue(product.tags, 'Set Code') || (codeMatch ? codeMatch[1] : null),
    collectorNumber: tagValue(product.tags, 'Number') || (codeMatch && codeMatch[2] ? codeMatch[2] : null),
    foil: product.selectedFinish ? product.selectedFinish !== 'nonfoil' : /foil\s*$/i.test(displayName),
    finish: finishGroup || (product.selectedFinish === 'nonfoil' ? 'Non-Foil' : 'Foil'),
    treatment,
    buyCashCents,
    buyCreditCents: toCents(nearMint ? nearMint.offer_price_credit : product.offer_price_credit),
    retailCents: toCents(retail ? retail.price : product.price),
    url: `https://buylist.tapsgames.com/retailer/buylist?product_line=${encodeURIComponent('Magic: the Gathering')}&q=${encodeURIComponent(name)}`
  };
};

const parseTapsPage = (data) => {
  const products = data?.products || [];
  const entries = products.map(parseTapsProduct).filter(Boolean);
  const productPrices = products.map(product => toCents(product.offer_price) || 0);

  return {
    entries,
    rawCount: products.length,
    topBuyCents: productPrices.length ? Math.min(...productPrices) : 0
  };
};

const variantCondition = (variant) =>
  variant.selectedOptions?.find(option => option.name === 'Condition')?.value || '';

const parseFaceToFaceHit = (hit) => {
  const source = hit?._source;
  if (!source) return null;

  const language = source.Language || source.General_Card_Language;
  if (language && language !== 'English') return null;

  const nearMint = (source.variants || []).find(variant => isNearMint(variantCondition(variant)));
  const buyCashCents = toCents(nearMint?.sellPrice);
  if (!buyCashCents) return null;

  // Some products index the name as an array
  const name = String([].concat(source['Card Name'] || source.General_Card_Name || [])[0] || (source.title || '').split(' [')[0]).trim();
  if (!name) return null;

  const finish = source.Finish || source.MTG_Foil_Option || 'Non-Foil';
  const qualifiers = [].concat(source.General_Alternate_Art_Qualifier || [])
    .filter(qualifier => qualifier && qualifier !== 'Default Art');
  // Serialized cards share a name and set with the regular printing
  if (/serial/i.test(source.title || '')) qualifiers.push('Serialized');
  const skuMatch = (nearMint.sku || '').match(/^SIN-MTG-([A-Z0-9]+)-/i);
  const number = source['Collector Number'] ?? source.MTG_Collector_Number;

  return {
    vendor: 'facetoface',
    name,
    set: [].concat(source.Set || source.MTG_Set_Name || 'Unknown Set')[0],
    setCode: skuMatch ? skuMatch[1] : null,
    collectorNumber: number !== undefined && number !== null ? String(number) : null,
    foil: isFoilFinish(finish),
    finish,
    treatment: qualifiers.join(' '),
    buyCashCents,
    buyCreditCents: null,
    retailCents: toCents(nearMint.price),
    url: source.handle ? `https://facetofacegames.com/products/${source.handle}` : null
  };
};

const parseFaceToFacePage = (data) => {
  const hits = data?.hits?.hits || [];
  const entries = hits.map(parseFaceToFaceHit).filter(Boolean);

  // Results are ordered by each product's highest variant buy price
  const productPrices = hits.map(hit => Math.max(
    0,
    ...(hit._source?.variants || []).map(variant => toCents(variant.sellPrice) || 0)
  ));

  return {
    entries,
    rawCount: hits.length,
    topBuyCents: productPrices.length ? Math.min(...productPrices) : 0
  };
};

module.exports = {
  parseTapsProduct,
  parseTapsPage,
  parseFaceToFaceHit,
  parseFaceToFacePage
};
