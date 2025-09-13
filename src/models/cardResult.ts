export interface CardResultOptions {
  name?: string;
  quantity?: number;
  price?: number | null;
  set?: string | null;
  condition?: string | null;
  inStock?: boolean;
  source?: string;
  url?: string | null;
  found?: boolean;
}

/**
 * Standard card result structure returned by all processors
 */
export class CardResult {
  public readonly name: string;
  public readonly quantity: number;
  public readonly price: number | null;
  public readonly set: string | null;
  public readonly condition: string | null;
  public readonly inStock: boolean;
  public readonly source: string;
  public readonly url: string | null;
  public readonly found: boolean;

  constructor(options: CardResultOptions = {}) {
    this.name = options.name || '';
    this.quantity = options.quantity || 0;
    this.price = options.hasOwnProperty('price') ? options.price! : null;
    this.set = options.set || null;
    this.condition = options.condition || null;
    this.inStock = options.inStock || false;
    this.source = options.source || 'unknown';
    this.url = options.url || null;
    this.found = options.hasOwnProperty('price') && options.price !== null && options.price !== undefined;
  }

  /**
   * Get price in dollars (formatted)
   */
  getPriceFormatted(): string | null {
    if (this.price === null || this.price === undefined) return null;
    return `$${(this.price / 100).toFixed(2)}`;
  }

  /**
   * Create a CardResult for a card that was not found
   */
  static notFound(name: string, quantity: number, source: string): CardResult {
    return new CardResult({
      name,
      quantity,
      source,
      inStock: false,
      found: false
    });
  }

  /**
   * Validate required properties
   */
  isValid(): boolean {
    return !!this.name && 
           typeof this.quantity === 'number' && 
           this.quantity > 0 &&
           !!this.source &&
           this.source !== 'unknown';
  }
}