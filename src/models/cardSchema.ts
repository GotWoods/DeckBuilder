import { Schema, Document } from 'mongoose';

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

export interface IPricing {
  results: IPricingResult[];
  processedAt: Date;
}

export interface ICard extends Document {
  Quantity: number;
  Name: string;
  pricing?: IPricing;
}

export const cardSchema = new Schema({
  Quantity: {
    type: Number,
    required: true,
    default: 1
  },
  Name: {
    type: String,
    required: true
  },
  pricing: {
    results: [{
      found: Boolean,
      price: Number, // in cents
      set: String,
      condition: String,
      inStock: Boolean,
      url: String,
      source: String,
      name: String, // Card name as found by processor
      quantity: Number // Quantity requested
    }],
    processedAt: Date
  }
});