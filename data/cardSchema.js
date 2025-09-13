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
  }
});

module.exports = cardSchema;