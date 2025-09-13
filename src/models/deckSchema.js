const mongoose = require('mongoose');
const cardSchema = require('./cardSchema');

const deckSchema = new mongoose.Schema({
  Cards: [cardSchema],
  Importing: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

deckSchema.methods.import = function(importData) {
  this.Importing = true;
  let lines = importData.split('\n');
  
  lines.forEach(element => {
    if (element.trim()) {
      var parts = element.split(" ");
      if (parts.length < 2)
        return;
      this.Cards.push({
        Quantity: parseInt(parts[0]),
        Name: parts.slice(1).join(' ')
      });
    }
  });
};

module.exports = mongoose.model('Deck', deckSchema);