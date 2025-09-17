import { IPricing } from './IPricing';

export interface ICard {
  Quantity: number;
  Name: string;
  pricing?: IPricing;
}