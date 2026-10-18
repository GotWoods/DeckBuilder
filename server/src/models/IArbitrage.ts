export type ArbitrageScanStatus = 'queued' | 'running' | 'done' | 'failed';

export interface IArbitrageScan {
  _id?: string;
  status: ArbitrageScanStatus;
  minBuyPriceCents: number;
  maxCards?: number | null;
  startedAt?: Date | string;
  finishedAt?: Date | string;
  progress: { processed: number; total: number };
  counts: { buylistEntries: number; cardNames: number; opportunities: number };
  error?: string;
  userId?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IArbitrageOpportunity {
  _id?: string;
  scanId: string;
  name: string;
  set: string;
  collectorNumber?: string | null;
  foil: boolean;
  finish?: string | null;
  treatment?: string | null;
  buyVendor: string;
  buyCashCents: number;
  buyCreditCents?: number | null;
  buyUrl?: string | null;
  sellVendor: string;
  sellPriceCents: number;
  sellSet?: string;
  sellCondition?: string;
  sellUrl?: string | null;
  marginCents: number;
  marginPct: number;
  exactMatch: boolean;
  needsReview: boolean;
}
