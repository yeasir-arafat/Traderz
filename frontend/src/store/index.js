import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Helper to check if user has required admin scope
export const hasAdminScope = (user, ...scopes) => {
  if (!user) return false;
  // Super admin bypasses all scopes
  if (user.roles?.includes('super_admin')) return true;
  // Regular admin needs explicit scope
  if (!user.roles?.includes('admin')) return false;
  const userScopes = user.admin_permissions || [];
  return scopes.some(scope => userScopes.includes(scope));
};

// Auth Store
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      needsProfileCompletion: false,
      needsTermsAcceptance: false,
      firebaseData: null,
      
      setAuth: (user, token) => set({
        user,
        token,
        isAuthenticated: !!token && !!user,
        needsProfileCompletion: false,
        needsTermsAcceptance: false,
      }),
      
      setNeedsCompletion: (needsProfile, needsTerms, firebaseData = null) => set({
        needsProfileCompletion: needsProfile,
        needsTermsAcceptance: needsTerms,
        firebaseData,
      }),
      
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
      
      // Check if current user has a specific admin scope
      hasScope: (...scopes) => {
        const user = get().user;
        return hasAdminScope(user, ...scopes);
      },
      
      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
        needsProfileCompletion: false,
        needsTermsAcceptance: false,
        firebaseData: null,
      }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Currency Store
export const useCurrencyStore = create(
  persist(
    (set) => ({
      currency: 'USD',
      usdToBdtRate: 110,
      
      setCurrency: (currency) => set({ currency }),
      setRate: (rate) => set({ usdToBdtRate: rate }),
      
      formatAmount: (amountUsd) => {
        const state = useCurrencyStore.getState();
        if (state.currency === 'BDT') {
          const bdt = amountUsd * state.usdToBdtRate;
          return `৳${bdt.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }
        return `$${amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
    }),
    {
      name: 'currency-storage',
      partialize: (state) => ({ currency: state.currency }),
    }
  )
);

// UI Store
export const useUIStore = create((set) => ({
  isMobileMenuOpen: false,
  isLoading: false,
  
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  setLoading: (loading) => set({ isLoading: loading }),
}));

// Notification Store
export const useNotificationStore = create((set) => ({
  notifications: [],
  unreadCount: 0,
  
  setNotifications: (notifications, unreadCount) => set({ notifications, unreadCount }),
  decrementUnread: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
  clearUnread: () => set({ unreadCount: 0 }),
}));

// Chat Notification Store
export const useChatNotificationStore = create((set, get) => ({
  unreadChatCount: 0,
  hasNewMessage: false,
  lastMessageTime: null,
  
  setUnreadCount: (count) => set({ unreadChatCount: count }),
  incrementUnread: () => set((state) => ({ 
    unreadChatCount: state.unreadChatCount + 1,
    hasNewMessage: true,
    lastMessageTime: Date.now()
  })),
  clearNewMessageFlag: () => set({ hasNewMessage: false }),
  resetUnread: () => set({ unreadChatCount: 0, hasNewMessage: false }),
  
  // Play notification sound
  playNotificationSound: () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQ0RUJThnnRYTGexrXeScVRcqsSWeE5CvNuZfGdASdWudXQJCJOXZH9/e28tCFWp3LtQESppyrZmR0JsvZ1wgR0DfLyIXWhNQ5/FtYRvMExZtcGUgGhES46agHp9djUCJXq0vYxQHhGBwqhtWGZ2pZN5dWdWVI6edHRyABZ0xsKVUCEBiMOrdmVZjaGNcXaGABF7uJtybmVpd5qReX1xaDJKk6WLb2lhVoKZgoR+cT8/bZqYgXRsZ2yLjoWDbUxFcJqVgXVwbHeLjod3Yk9KdZqTgXVvbnKNjIt8ZFdQe5eUgXRubnOPjI1+aFpUf5WTgnJtbXSOjI2AaldPfJSTgXNubXSPjI2CZlpQfZWTgnNtbXSPjI2AalVMepKQfnBtbnSPjI2CaFdPfZWTgnNtbXSOi4qAaFhQfZaUg3FsbHONi4uBZ1dPfZaSgnJubXOOi4t/Z1hPfJWRgnJsbHGMiomAaFpSfpaTgnJsbXKMioqAaVpRfZSSgnJtbXKMioqAaFhPfZSSg3JubXOMiomAaFlQfZSSgnJtbXONioqAZ1hQfpSTgnJubXONiouAZlhQfpSTgnJubXONiouAZ1hQfpSTgnJubXONiouAZ1hQfpSTgnJubXONiouAZ1hQfpSTgnJubXONiouAZ1hQfpSTgnJubXONiouAZ1hQfpSTgnJubXONiouA');
    audio.volume = 0.5;
    audio.play().catch(() => {}); // Ignore errors if user hasn't interacted
  }
}));
