export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'google' | 'facebook';
  avatar?: string;
}

export interface AuthContextType {
  user: User | null;
  login: (provider: 'google' | 'facebook') => void;
  logout: () => void;
  loading: boolean;
}