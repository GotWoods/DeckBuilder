import { IPricingResult } from './IPricingResult';

export interface IPricing {
  results: IPricingResult[];
  processedAt: Date;
}