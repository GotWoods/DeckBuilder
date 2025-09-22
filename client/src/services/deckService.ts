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

  async toggleCardPurchased(deckId: string, cardIndex: number): Promise<{ purchased: boolean }> {
    const response = await apiService.post<ApiResponse<{ purchased: boolean }>>(`/api/deck/${deckId}/card/${cardIndex}/purchase`, {});
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

  async updateSelectedPricing(deckId: string, cardIndex: number, vendor: string, resultIndex: number) {
    const response = await apiService.post<ApiResponse<null>>(`/api/deck/${deckId}/card/${cardIndex}/select-pricing`, {
      vendor,
      resultIndex
    });
    if (!response.success) {
      throw new Error('API returned error');
    }
  }

  async deleteDeck(id: string) {
    const response = await apiService.delete<ApiResponse<null>>(`/api/deck/${id}`);
    if (!response.success) {
      throw new Error('API returned error');
    }
  }

  async analyzeCard(cardName: string) {
    const response = await apiService.get<ApiResponse<any>>(`/api/cards/${encodeURIComponent(cardName)}/analyze`);
    if (!response.success) {
      throw new Error('API returned error');
    }
    return response.data;
  }

  async searchAlternatives(criteria: any) {
    const response = await apiService.post<ApiResponse<any>>(`/api/cards/search-alternatives`, criteria);
    if (!response.success) {
      throw new Error('API returned error');
    }
    return response.data;
  }

  async substituteCard(deckId: string, cardIndex: number, selectedCard: any) {
    const response = await apiService.post<ApiResponse<any>>(`/api/deck/${deckId}/card/${cardIndex}/substitute`, {
      selectedCard
    });
    if (!response.success) {
      throw new Error('API returned error');
    }
    return response.data;
  }
}

export default new DeckService();