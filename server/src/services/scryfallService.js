import axios from 'axios';
import logger from '../config/logger';

/**
 * Service for interacting with Scryfall API to analyze cards and find alternatives
 */
class ScryfallService {
  constructor() {
    this.baseUrl = 'https://api.scryfall.com';
    this.logger = logger.child({ service: 'ScryfallService' });

    // Rate limiting: Scryfall allows ~100 requests per second
    this.lastRequestTime = 0;
    this.minRequestInterval = 50; // 50ms between requests
  }

  /**
   * Add delay to respect rate limits
   */
  async respectRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Search for a card by name to get its full data
   * @param {string} cardName - Name of the card to search for
   * @returns {Promise<Object|null>} Card data or null if not found
   */
  async getCardData(cardName) {
    try {
      await this.respectRateLimit();

      const response = await axios.get(`${this.baseUrl}/cards/named`, {
        params: {
          exact: cardName
        },
        timeout: 10000
      });

      this.logger.info(`Found card data for: ${cardName}`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        this.logger.warn(`Card not found: ${cardName}`);
        return null;
      }
      this.logger.error(`Error fetching card data for ${cardName}:`, error.message);
      throw error;
    }
  }

  /**
   * Analyze a card to extract searchable properties
   * @param {string} cardName - Name of the card to analyze
   * @returns {Promise<Object>} Analyzed card properties
   */
  async analyzeCard(cardName) {
    const cardData = await this.getCardData(cardName);
    if (!cardData) {
      throw new Error(`Card not found: ${cardName}`);
    }

    const analysis = {
      name: cardData.name,
      manaCost: cardData.mana_cost || '',
      cmc: cardData.cmc || 0,
      colorIdentity: cardData.color_identity || [],
      colors: cardData.colors || [],
      type: cardData.type_line || '',
      types: this.extractTypes(cardData.type_line || ''),
      power: cardData.power || null,
      toughness: cardData.toughness || null,
      keywords: this.extractKeywords(cardData.keywords || []),
      oracleText: cardData.oracle_text || '',
      abilities: this.extractAbilities(cardData.oracle_text || ''),
      rarity: cardData.rarity || '',
      setName: cardData.set_name || '',
      setCode: cardData.set || ''
    };

    this.logger.info(`Analyzed card: ${cardName}`, { analysis });
    return analysis;
  }

  /**
   * Extract card types from type line
   * @param {string} typeLine - Full type line (e.g., "Legendary Creature — Human Warrior")
   * @returns {Object} Extracted types
   */
  extractTypes(typeLine) {
    const parts = typeLine.split('—');
    const mainTypes = parts[0].trim().split(' ');
    const subtypes = parts.length > 1 ? parts[1].trim().split(' ') : [];

    const cardTypes = [];
    const supertypes = [];

    // Common supertypes
    const knownSupertypes = ['legendary', 'basic', 'snow', 'world'];
    // Common card types
    const knownCardTypes = ['artifact', 'creature', 'enchantment', 'instant', 'land', 'planeswalker', 'sorcery', 'tribal'];

    mainTypes.forEach(type => {
      const lowerType = type.toLowerCase();
      if (knownSupertypes.includes(lowerType)) {
        supertypes.push(lowerType);
      } else if (knownCardTypes.includes(lowerType)) {
        cardTypes.push(lowerType);
      }
    });

    return {
      supertypes,
      cardTypes,
      subtypes: subtypes.map(s => s.toLowerCase())
    };
  }

  /**
   * Extract keywords from card data
   * @param {Array} keywords - Array of keyword abilities
   * @returns {Array} Normalized keyword list
   */
  extractKeywords(keywords) {
    return keywords.map(keyword => keyword.toLowerCase());
  }

  /**
   * Extract abilities from oracle text
   * @param {string} oracleText - Full oracle text
   * @returns {Object} Extracted abilities
   */
  extractAbilities(oracleText) {
    const abilities = {
      tapAbilities: [],
      triggeredAbilities: [],
      staticAbilities: [],
      activatedAbilities: [],
      damageAmount: null,
      targetTypes: []
    };

    // Extract damage amounts
    const damageMatch = oracleText.match(/(?:deal|deals)\s+(\d+)\s+damage/i);
    if (damageMatch) {
      abilities.damageAmount = parseInt(damageMatch[1]);
    }

    // Extract target types
    if (oracleText.includes('any target')) {
      abilities.targetTypes.push('any');
    } else {
      if (oracleText.includes('target creature')) abilities.targetTypes.push('creature');
      if (oracleText.includes('target player')) abilities.targetTypes.push('player');
      if (oracleText.includes('target planeswalker')) abilities.targetTypes.push('planeswalker');
    }

    // Extract tap abilities
    const tapMatches = oracleText.match(/{T}[^:]*:/g);
    if (tapMatches) {
      abilities.tapAbilities = tapMatches.map(match => match.replace(/{T}\s*:?\s*/, '').trim());
    }

    // Extract triggered abilities (when, whenever, at)
    const triggeredMatches = oracleText.match(/(when|whenever|at\s+the\s+beginning)[^.!?]*[.!?]/gi);
    if (triggeredMatches) {
      abilities.triggeredAbilities = triggeredMatches;
    }

    return abilities;
  }

  /**
   * Build Scryfall search query from criteria
   * @param {Object} criteria - Search criteria
   * @returns {string} Scryfall search query
   */
  buildSearchQuery(criteria) {
    const queryParts = [];

    // Color identity
    if (criteria.colorIdentity && criteria.colorIdentity.length > 0) {
      if (criteria.exactColors) {
        queryParts.push(`id:${criteria.colorIdentity.join('')}`);
      } else {
        queryParts.push(`c:${criteria.colorIdentity.join('')}`);
      }
    }

    // Card types
    if (criteria.cardTypes && criteria.cardTypes.length > 0) {
      queryParts.push(`type:${criteria.cardTypes.join(' ')}`);
    }

    // Power/Toughness
    if (criteria.powerMin !== undefined || criteria.powerMax !== undefined) {
      if (criteria.powerMin !== undefined) queryParts.push(`pow>=${criteria.powerMin}`);
      if (criteria.powerMax !== undefined) queryParts.push(`pow<=${criteria.powerMax}`);
    }
    if (criteria.toughnessMin !== undefined || criteria.toughnessMax !== undefined) {
      if (criteria.toughnessMin !== undefined) queryParts.push(`tou>=${criteria.toughnessMin}`);
      if (criteria.toughnessMax !== undefined) queryParts.push(`tou<=${criteria.toughnessMax}`);
    }

    // Keywords
    if (criteria.requiredKeywords && criteria.requiredKeywords.length > 0) {
      criteria.requiredKeywords.forEach(keyword => {
        queryParts.push(`o:${keyword}`);
      });
    }

    // Oracle text contains
    if (criteria.oracleTextContains && criteria.oracleTextContains.length > 0) {
      criteria.oracleTextContains.forEach(text => {
        queryParts.push(`o:"${text}"`);
      });
    }

    // Damage amount
    if (criteria.damageAmount !== undefined) {
      queryParts.push(`o:"${criteria.damageAmount} damage"`);
    }

    return queryParts.join(' ');
  }

  /**
   * Search for cards matching criteria
   * @param {Object} criteria - Search criteria
   * @param {number} page - Page number (1-based)
   * @returns {Promise<Object>} Search results
   */
  async searchCards(criteria, page = 1) {
    try {
      await this.respectRateLimit();

      const query = this.buildSearchQuery(criteria);
      this.logger.info(`Searching cards with query: ${query}`);

      const response = await axios.get(`${this.baseUrl}/cards/search`, {
        params: {
          q: query,
          page: page,
          format: 'json'
        },
        timeout: 15000
      });

      const results = {
        data: response.data.data || [],
        hasMore: response.data.has_more || false,
        totalCards: response.data.total_cards || 0,
        page: page,
        query: query
      };

      this.logger.info(`Found ${results.data.length} cards (page ${page})`);
      return results;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        this.logger.info('No cards found for search criteria');
        return { data: [], hasMore: false, totalCards: 0, page: 1, query: '' };
      }
      this.logger.error('Error searching cards:', error.message);
      throw error;
    }
  }
}

export default new ScryfallService();