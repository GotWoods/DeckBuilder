import apiService from './apiService';
import { Deck, ApiResponse } from '../types/deck';

export class DeckService {
  async getAllDecks(): Promise<Deck[]> {
    const response = await apiService.get<ApiResponse<Deck[]>>('/api/deck');
    if (!response.success) {
      throw new Error('API returned error');
    }
    return response.data;
  }

  async getDeckById(id: string): Promise<Deck> {
    const response = await apiService.get<ApiResponse<Deck>>(`/api/deck/${id}`);
    if (!response.success) {
      throw new Error('API returned error');
    }
    return response.data;
  }

  async refreshDeckPricing(id: string) {
    const response = await apiService.post<ApiResponse<null>>(`/api/deck/${id}/refresh`, {});
    if (!response.success) {
      throw new Error('API returned error');
    }
  }
}

export default new DeckService();