// Import server types
import { IArbitrageScan, IArbitrageOpportunity } from '../../../server/src/models';

export type ArbitrageScan = IArbitrageScan;
export type ArbitrageOpportunity = IArbitrageOpportunity;

export interface ScanOptions {
  minBuyPrice: number;
  maxCards?: number;
}
