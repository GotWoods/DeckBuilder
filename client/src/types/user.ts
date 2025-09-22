export interface User {
  id: string;
  email: string;
  name: string;
  provider: 'google';
  avatar?: string;
}

export interface AuthContextType {
  user: User | null;
  login: (provider: 'google') => void;
  logout: () => void;
  loading: boolean;
}