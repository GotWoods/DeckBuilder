import { IPricingResult } from './IPricingResult';

// Prices in cents, across all listings including out of stock
export interface IPricingStats {
  min: number;
  max: number;
  avg: number;
  count: number;
}

export interface IPricing {
  results: IPricingResult[];
  stats?: IPricingStats | null;
  processedAt: Date;
}
