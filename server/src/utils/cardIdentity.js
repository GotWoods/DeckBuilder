/**
 * Helpers for comparing the same printing across vendors that describe it differently
 */

// Vendors write two-faced names as "Dusk // Dawn" or "Dusk / Dawn"
const FACE_SEPARATOR = /\s+\/\/?\s+/;

const frontFace = (name = '') => String(name).split(FACE_SEPARATOR)[0];

const cleanName = (name) => String(name)
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/["“”'‘’]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

// Front face only, since vendors disagree on listing both faces
const normalizeName = (name = '') => cleanName(frontFace(name));

// Both faces kept, with the separator unified to " // "
const normalizeFullName = (name = '') => cleanName(String(name).split(FACE_SEPARATOR).join(' // '));

// True when a vendor listing title is for the searched card ("Dusk // Dawn - Foil" matches "Dusk / Dawn")
const titleMatchesCardName = (title, cardName) =>
  normalizeFullName(title).startsWith(normalizeFullName(cardName));

// "Strixhaven: Mystical Archives" and "Strixhaven Mystical Archive" should compare equal
const normalizeSet = (set = '') => String(set)
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/['‘’]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ')
  .split(/\s+/)
  .filter(word => word && word !== 'the')
  .map(word => (word.length > 3 ? word.replace(/s$/, '') : word))
  .join(' ');

const normalizeNumber = (number) => {
  if (number === null || number === undefined) return null;
  const cleaned = String(number).trim().toLowerCase().replace(/^0+(?=.)/, '');
  return cleaned || null;
};

// Returns 'nonfoil', 'foil', or the special finish with words sorted ("etched foil")
const normalizeFinish = (finish) => {
  const cleaned = String(finish || '').toLowerCase().replace(/[^a-z ]/g, ' ').trim();
  if (!cleaned || /^(non ?foil|regular|normal)$/.test(cleaned)) return 'nonfoil';
  return cleaned.split(/\s+/).sort().join(' ');
};

// Order-independent key so "Borderless Anime" equals "Anime Borderless"
const normalizeTreatment = (treatment) => {
  const words = String(treatment || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(word => word && !['foil', 'art', 'frame', 'the'].includes(word));
  return [...new Set(words)].sort().join(' ');
};

const isFoilFinish =(finish) => normalizeFinish(finish) !== 'nonfoil';

const isNearMint = (condition = '') => /^(nm|near mint)\b/i.test(String(condition).trim());

const toCents = (dollars) => {
  const value = parseFloat(dollars);
  return value > 0 ? Math.round(value * 100) : null;
};

module.exports = {
  frontFace,
  normalizeName,
  normalizeFullName,
  titleMatchesCardName,
  normalizeSet,
  normalizeNumber,
  normalizeFinish,
  normalizeTreatment,
  isFoilFinish,
  isNearMint,
  toCents
};
