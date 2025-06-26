import { useQuery } from '@tanstack/react-query';
import { waiverApi } from '@/lib/api';
import { useUserStore } from '@/lib/store/user';
import { useAppStore } from '@/lib/store/app';
import type { WaiverQueryInput } from '@shared/types';

// Query keys factory
export const waiverKeys = {
  all: ['waiver'] as const,
  recommendations: () => [...waiverKeys.all, 'recommendations'] as const,
  dailyRecommendations: (params?: WaiverQueryInput) => 
    [...waiverKeys.recommendations(), 'daily', params] as const,
  trends: (days?: number) => [...waiverKeys.all, 'trends', days] as const,
  available: (params?: any) => [...waiverKeys.all, 'available', params] as const,
  matchup: (playerId: string, date?: string) => 
    [...waiverKeys.all, 'matchup', playerId, date] as const,
};

// Get daily waiver recommendations (Pro+ tier)
export function useDailyRecommendations(params?: WaiverQueryInput) {
  const user = useUserStore((state) => state.user);
  const excludeTopN = useAppStore((state) => state.excludeTopNPlayers);
  const isProPlus = user?.subscriptionTier === 'pro_plus';

  const queryParams = {
    excludeTopN: params?.excludeTopN ?? excludeTopN,
    date: params?.date,
  };

  return useQuery({
    queryKey: waiverKeys.dailyRecommendations(queryParams),
    queryFn: () => waiverApi.getDailyRecommendations(queryParams),
    enabled: isProPlus,
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchOnMount: 'always',
  });
}

// Get waiver wire trends
export function useWaiverTrends(days: number = 7, limit: number = 20) {
  const user = useUserStore((state) => state.user);
  const isProPlus = user?.subscriptionTier === 'pro_plus';

  return useQuery({
    queryKey: waiverKeys.trends(days),
    queryFn: () => waiverApi.getWaiverTrends({ days, limit }),
    enabled: isProPlus,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Get available players
export function useAvailablePlayers(params?: {
  date?: string;
  excludeTopN?: number;
  includeInjured?: boolean;
}) {
  const user = useUserStore((state) => state.user);
  const excludeTopN = useAppStore((state) => state.excludeTopNPlayers);
  const isProPlus = user?.subscriptionTier === 'pro_plus';

  const queryParams = {
    date: params?.date,
    excludeTopN: params?.excludeTopN ?? excludeTopN,
    includeInjured: params?.includeInjured ?? false,
  };

  return useQuery({
    queryKey: waiverKeys.available(queryParams),
    queryFn: () => waiverApi.getAvailablePlayers(queryParams),
    enabled: isProPlus,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
}

// Get matchup analysis
export function useMatchupAnalysis(playerId: string, date?: string) {
  const user = useUserStore((state) => state.user);
  const isProPlus = user?.subscriptionTier === 'pro_plus';

  return useQuery({
    queryKey: waiverKeys.matchup(playerId, date),
    queryFn: () => waiverApi.getMatchupAnalysis(playerId, date),
    enabled: isProPlus && !!playerId,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}