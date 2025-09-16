export interface Card {
  _id?: string;
  Quantity: number;
  Name: string;
  Prices?: any[];
}

export interface Deck {
  _id: string;
  Cards: Card[];
  Importing: boolean;
  createdAt: string;
  __v?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  count: number;
  data: T;
}