import mongoose, { Schema } from 'mongoose';

// All prices are in cents
const arbitrageOpportunitySchema = new Schema({
  scanId: {
    type: Schema.Types.ObjectId,
    ref: 'ArbitrageScan',
    required: true,
    index: true
  },
  name: { type: String, required: true },
  set: String,
  collectorNumber: String,
  foil: { type: Boolean, default: false },
  finish: String,
  treatment: String,
  buyVendor: { type: String, required: true },
  buyCashCents: { type: Number, required: true },
  buyCreditCents: Number,
  buyUrl: String,
  sellVendor: { type: String, required: true },
  sellPriceCents: { type: Number, required: true },
  sellSet: String,
  sellCondition: String,
  sellUrl: String,
  marginCents: { type: Number, required: true },
  marginPct: Number,
  exactMatch: { type: Boolean, default: false },
  needsReview: { type: Boolean, default: false }
});

const ArbitrageOpportunityModel = mongoose.model('ArbitrageOpportunity', arbitrageOpportunitySchema);

export default ArbitrageOpportunityModel;
module.exports = ArbitrageOpportunityModel;
