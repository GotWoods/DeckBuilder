import mongoose, { Schema } from 'mongoose';

const arbitrageScanSchema = new Schema({
  status: {
    type: String,
    enum: ['queued', 'running', 'done', 'failed'],
    default: 'queued'
  },
  minBuyPriceCents: { type: Number, required: true },
  maxCards: { type: Number, default: null },
  startedAt: Date,
  finishedAt: Date,
  progress: {
    processed: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  counts: {
    buylistEntries: { type: Number, default: 0 },
    cardNames: { type: Number, default: 0 },
    opportunities: { type: Number, default: 0 }
  },
  error: String,
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, { timestamps: true });

const ArbitrageScanModel = mongoose.model('ArbitrageScan', arbitrageScanSchema);

export default ArbitrageScanModel;
module.exports = ArbitrageScanModel;
