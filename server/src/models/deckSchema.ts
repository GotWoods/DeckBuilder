import mongoose, { Document, Schema } from 'mongoose';
import { cardSchema } from './cardSchema';
import { ICard } from './ICard';

export interface IDeck extends Document {
  name: string;
  Cards: ICard[];
  Importing: boolean;
  userId?: string;
  createdAt: Date;
  colorIdentity: string[];
  import(importData: string): void;
}

const deckSchema = new Schema({
  name: {
    type: String,
    required: true
  },
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
  },
  colorIdentity: {
    type: [String],
    default: []
  }
});

// Strips export decorations from a deck line's name, e.g. "Last Breath (2X2) 15 *F*" -> "Last Breath"
export const cleanCardName = (raw: string): string => {
  let cardName = raw;

  // Remove trailing finish markers like "*F*" (foil) or "*E*" (etched)
  cardName = cardName.replace(/(\s*\*[A-Z]+\*)+\s*$/i, '');

  // Remove collection code and number at the end
  // Matches patterns like "(SLD) 433", "(BRO) 123", "(PLST) MH1-188", "(PLST) WOE-267", etc.
  cardName = cardName.replace(/\s*\([A-Z0-9]{2,5}\)\s*[A-Z0-9][A-Z0-9-]*\s*$/, '');

  // Also handle cases where there might just be a number at the end
  cardName = cardName.replace(/\s+\d+\s*$/, '');

  return cardName.trim();
};

// Parses "<qty> <name>" lines into cards, skipping blank or malformed lines
export const parseDeckLines = (importData: string): ICard[] => {
  const cards: ICard[] = [];

  importData.split('\n').forEach(element => {
    const parts = element.trim().split(/\s+/);
    if (parts.length < 2)
      return;

    const quantity = parseInt(parts[0]);
    const cardName = cleanCardName(parts.slice(1).join(' '));

    if (quantity > 0 && cardName) {
      cards.push({
        Quantity: quantity,
        Name: cardName
      } as ICard);
    }
  });

  return cards;
};

deckSchema.methods.import = function(this: IDeck, importData: string): void {
  this.Importing = true;
  parseDeckLines(importData).forEach(card => this.Cards.push(card));
};

const DeckModel = mongoose.model<IDeck>('Deck', deckSchema);

export default DeckModel;
module.exports = DeckModel;
module.exports.cleanCardName = cleanCardName;
module.exports.parseDeckLines = parseDeckLines;