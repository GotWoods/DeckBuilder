// Import server types
import { IPricingResult, IPricing, ICard, IDeck } from '../../../server/src/models';

export interface ProcessedPricing extends IPricing {
  groupedByVendor?: Record<string, IPricingResult[]>;
}

export interface Card extends Omit<ICard, 'pricing'> {
  _id?: string;
  pricing?: ProcessedPricing;
}

export interface Deck extends Omit<IDeck, '_id' | 'Cards'> {
  _id: string;
  Cards: Card[];
}

export interface ApiResponse<T> {
  success: boolean;
  count: number;
  data: T;
}