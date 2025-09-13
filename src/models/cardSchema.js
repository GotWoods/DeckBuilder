const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
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

module.exports = cardSchema;