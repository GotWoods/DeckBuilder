import mongoose, { Document, Schema } from 'mongoose';
import { cardSchema } from './cardSchema';
import { ICard } from './ICard';

export interface IDeck extends Document {
  Cards: ICard[];
  Importing: boolean;
  userId?: string;
  createdAt: Date;
  import(importData: string): void;
}

const deckSchema = new Schema({
  Cards: [cardSchema],
  Importing: {
    type: Boolean,
    default: false
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

deckSchema.methods.import = function(this: IDeck, importData: string): void {
  this.Importing = true;
  const lines = importData.split('\n');

  lines.forEach(element => {
    if (element.trim()) {
      const parts = element.split(" ");
      if (parts.length < 2)
        return;

      // Join the name parts and clean up collection codes
      let cardName = parts.slice(1).join(' ');

      // Remove collection code and number at the end
      // Matches patterns like "(SLD) 433", "(BRO) 123", etc.
      cardName = cardName.replace(/\s*\([A-Z0-9]{2,5}\)\s*\d+\s*$/, '');

      // Also handle cases where there might just be a number at the end
      cardName = cardName.replace(/\s+\d+\s*$/, '');

      // Trim any extra whitespace
      cardName = cardName.trim();

      if (cardName) {
        this.Cards.push({
          Quantity: parseInt(parts[0]),
          Name: cardName
        } as ICard);
      }
    }
  });
};

const DeckModel = mongoose.model<IDeck>('Deck', deckSchema);

export default DeckModel;
module.exports = DeckModel;