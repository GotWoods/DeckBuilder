import { IPricing } from './IPricing';

export interface ICard {
  Quantity: number;
  Name: string;
  purchased?: boolean;
  pricing?: IPricing;
  colorIdentity?: string[];
}