import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, SubscriptionTier, ScoringConfiguration } from '@shared/types';

interface UserState {
  user: User | null;
  isLoading: boolean;
  defaultScoringConfig: ScoringConfiguration | null;
  scoringConfigs: ScoringConfiguration[];
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  updateSubscriptionTier: (tier: SubscriptionTier) => void;
  setScoringConfigs: (configs: ScoringConfiguration[]) => void;
  setDefaultScoringConfig: (config: ScoringConfiguration) => void;
  addScoringConfig: (config: ScoringConfiguration) => void;
  updateScoringConfig: (configId: string, updates: Partial<ScoringConfiguration>) => void;
  deleteScoringConfig: (configId: string) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      defaultScoringConfig: null,
      scoringConfigs: [],

      setUser: (user) => set({ user }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      updateSubscriptionTier: (tier) =>
        set((state) => ({
          user: state.user ? { ...state.user, subscriptionTier: tier } : null,
        })),
      
      setScoringConfigs: (configs) => set({ scoringConfigs: configs }),
      
      setDefaultScoringConfig: (config) => set({ defaultScoringConfig: config }),
      
      addScoringConfig: (config) =>
        set((state) => ({
          scoringConfigs: [...state.scoringConfigs, config],
        })),
      
      updateScoringConfig: (configId, updates) =>
        set((state) => ({
          scoringConfigs: state.scoringConfigs.map((config) =>
            config.id === configId ? { ...config, ...updates } : config
          ),
          defaultScoringConfig:
            state.defaultScoringConfig?.id === configId
              ? { ...state.defaultScoringConfig, ...updates }
              : state.defaultScoringConfig,
        })),
      
      deleteScoringConfig: (configId) =>
        set((state) => ({
          scoringConfigs: state.scoringConfigs.filter((config) => config.id !== configId),
          defaultScoringConfig:
            state.defaultScoringConfig?.id === configId ? null : state.defaultScoringConfig,
        })),
      
      reset: () =>
        set({
          user: null,
          isLoading: true,
          defaultScoringConfig: null,
          scoringConfigs: [],
        }),
    }),
    {
      name: 'user-store',
      partialize: (state) => ({
        user: state.user,
        defaultScoringConfig: state.defaultScoringConfig,
      }),
    }
  )
);