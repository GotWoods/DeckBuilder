import mongoose, { Document, Schema } from 'mongoose';
import { cardSchema, ICard } from './cardSchema';

export interface IDeck extends Document {
  Cards: ICard[];
  Importing: boolean;
  createdAt: Date;
  import(importData: string): void;
}

const deckSchema = new Schema({
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

deckSchema.methods.import = function(this: IDeck, importData: string): void {
  this.Importing = true;
  const lines = importData.split('\n');
  
  lines.forEach(element => {
    if (element.trim()) {
      const parts = element.split(" ");
      if (parts.length < 2)
        return;
      this.Cards.push({
        Quantity: parseInt(parts[0]),
        Name: parts.slice(1).join(' ')
      } as ICard);
    }
  });
};

const DeckModel = mongoose.model<IDeck>('Deck', deckSchema);

export default DeckModel;
module.exports = DeckModel;