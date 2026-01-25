import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
