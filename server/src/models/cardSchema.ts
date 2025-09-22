import { Schema } from 'mongoose';

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
  purchased: {
    type: Boolean,
    default: false
  },
  colorIdentity: {
    type: [String],
    default: []
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
      quantity: Number, // Quantity requested
      selected: Boolean // Whether this pricing option is selected by user
    }],
    processedAt: Date
  }
});