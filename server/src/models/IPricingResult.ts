export interface IPricingResult {
  found: boolean;
  price: number; // in cents
  set: string;
  condition: string;
  inStock: boolean;
  url: string;
  source: string;
  name: string; // Card name as found by processor
  quantity: number; // Quantity requested
}