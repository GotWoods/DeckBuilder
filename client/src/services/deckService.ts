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
}

export default new DeckService();