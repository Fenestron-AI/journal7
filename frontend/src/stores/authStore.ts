import { create } from 'zustand';
import { authApi, AuthResponse, UserResponse } from '../api/endpoints';

interface AuthState {
  user: UserResponse | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await authApi.login({ username, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      const { data: user } = await authApi.me();
      set({ user, loading: false });
    } catch (e: any) {
      set({ error: e.response?.data?.message || 'Login failed', loading: false });
      throw e;
    }
  },

  logout: () => {
    localStorage.clear();
    set({ user: null });
  },

  fetchUser: async () => {
    try {
      const { data } = await authApi.me();
      set({ user: data });
    } catch {
      localStorage.clear();
      set({ user: null });
    }
  },
}));
