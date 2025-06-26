import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playersApi } from '@/lib/api';
import type { 
  Player, 
  PlayerStats, 
  PlayerFilterInput, 
  PaginationInput,
  ConsistencyMetric,
  TrendingAnalysis 
} from '@shared/types';
import { useUserStore } from '@/lib/store/user';

// Query keys factory
export const playerKeys = {
  all: ['players'] as const,
  lists: () => [...playerKeys.all, 'list'] as const,
  list: (filters?: PlayerFilterInput & PaginationInput) => 
    [...playerKeys.lists(), filters] as const,
  details: () => [...playerKeys.all, 'detail'] as const,
  detail: (id: string) => [...playerKeys.details(), id] as const,
  stats: (id: string) => [...playerKeys.detail(id), 'stats'] as const,
  fantasyScores: (id: string, configId?: string) => 
    [...playerKeys.detail(id), 'fantasy-scores', configId] as const,
  consistency: (id: string, days: string) => 
    [...playerKeys.detail(id), 'consistency', days] as const,
  trends: (id: string) => [...playerKeys.detail(id), 'trends'] as const,
  rankings: (configId?: string) => [...playerKeys.all, 'rankings', configId] as const,
  hot: (days?: string) => [...playerKeys.all, 'hot', days] as const,
  consistencyRankings: (days?: string) => 
    [...playerKeys.all, 'consistency-rankings', days] as const,
};

// Get players list
export function usePlayers(params?: PlayerFilterInput & PaginationInput) {
  return useQuery({
    queryKey: playerKeys.list(params),
    queryFn: () => playersApi.getPlayers(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get single player
export function usePlayer(playerId: string) {
  return useQuery({
    queryKey: playerKeys.detail(playerId),
    queryFn: () => playersApi.getPlayer(playerId),
    enabled: !!playerId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Get player stats
export function usePlayerStats(
  playerId: string,
  params?: {
    startDate?: string;
    endDate?: string;
    aggregation?: 'game' | 'daily' | 'weekly' | 'monthly' | 'season';
  }
) {
  return useQuery({
    queryKey: [...playerKeys.stats(playerId), params],
    queryFn: () => playersApi.getPlayerStats(playerId, params),
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  });
}

// Get player fantasy scores
export function usePlayerFantasyScores(playerId: string, scoringConfigId?: string) {
  const defaultConfig = useUserStore((state) => state.defaultScoringConfig);
  const configId = scoringConfigId || defaultConfig?.id;

  return useQuery({
    queryKey: playerKeys.fantasyScores(playerId, configId),
    queryFn: () => playersApi.getPlayerFantasyScores(playerId, configId),
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
  });
}

// Get player consistency
export function usePlayerConsistency(
  playerId: string,
  days: '7' | '14' | '30' = '14'
) {
  return useQuery({
    queryKey: playerKeys.consistency(playerId, days),
    queryFn: () => playersApi.getPlayerConsistency(playerId, days),
    enabled: !!playerId,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

// Get player trends
export function usePlayerTrends(playerId: string) {
  return useQuery({
    queryKey: playerKeys.trends(playerId),
    queryFn: () => playersApi.getPlayerTrends(playerId),
    enabled: !!playerId,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Get fantasy rankings
export function useFantasyRankings(params?: {
  scoringConfigId?: string;
  position?: string;
  limit?: number;
}) {
  const defaultConfig = useUserStore((state) => state.defaultScoringConfig);
  const configId = params?.scoringConfigId || defaultConfig?.id;

  return useQuery({
    queryKey: playerKeys.rankings(configId),
    queryFn: () => playersApi.getFantasyRankings({ ...params, scoringConfigId: configId }),
    staleTime: 5 * 60 * 1000,
  });
}

// Get hot players (Pro tier)
export function useHotPlayers(params?: {
  days?: '5' | '7' | '10' | '14';
  minImprovement?: number;
  limit?: number;
}) {
  const user = useUserStore((state) => state.user);
  const isPro = user?.subscriptionTier !== 'free';

  return useQuery({
    queryKey: playerKeys.hot(params?.days),
    queryFn: () => playersApi.getHotPlayers(params),
    enabled: isPro,
    staleTime: 30 * 60 * 1000,
  });
}

// Get consistency rankings (Pro tier)
export function useConsistencyRankings(params?: {
  days?: '7' | '14' | '30';
  minGamesPlayed?: number;
  limit?: number;
}) {
  const user = useUserStore((state) => state.user);
  const isPro = user?.subscriptionTier !== 'free';

  return useQuery({
    queryKey: playerKeys.consistencyRankings(params?.days),
    queryFn: () => playersApi.getConsistencyRankings(params),
    enabled: isPro,
    staleTime: 60 * 60 * 1000,
  });
}

// Search players
export function usePlayerSearch(query: string) {
  return useQuery({
    queryKey: [...playerKeys.all, 'search', query],
    queryFn: () => playersApi.searchPlayers(query),
    enabled: query.length > 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}