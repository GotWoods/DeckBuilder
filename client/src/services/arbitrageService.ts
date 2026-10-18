import apiService from './apiService';
import { ApiResponse } from '../types/deck';
import { ArbitrageScan, ArbitrageOpportunity, ScanOptions } from '../types/arbitrage';

export class ArbitrageService {
  async startScan(options: ScanOptions): Promise<ArbitrageScan> {
    const response = await apiService.post<ApiResponse<ArbitrageScan>>('/api/arbitrage/scan', options);
    if (!response.success) {
      throw new Error('API returned error');
    }
    return response.data;
  }

  async getLatestScan(): Promise<ArbitrageScan | null> {
    const response = await apiService.get<ApiResponse<ArbitrageScan | null>>('/api/arbitrage/scan/latest');
    if (!response.success) {
      throw new Error('API returned error');
    }
    return response.data;
  }

  async getOpportunities(): Promise<ArbitrageOpportunity[]> {
    const response = await apiService.get<ApiResponse<ArbitrageOpportunity[]>>('/api/arbitrage/opportunities');
    if (!response.success) {
      throw new Error('API returned error');
    }
    return response.data;
  }
}

export default new ArbitrageService();
