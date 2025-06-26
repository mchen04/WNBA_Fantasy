import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tradeApi } from '@/lib/api';
import { useUserStore } from '@/lib/store/user';
import type { TradeAnalysis, TradeAnalysisInput } from '@shared/types';
import toast from 'react-hot-toast';

// Query keys factory
export const tradeKeys = {
  all: ['trade'] as const,
  analyses: () => [...tradeKeys.all, 'analyses'] as const,
  analysis: (id: string) => [...tradeKeys.analyses(), id] as const,
  history: () => [...tradeKeys.all, 'history'] as const,
  waiverValue: (excludeTopN: number) => [...tradeKeys.all, 'waiver-value', excludeTopN] as const,
};

// Analyze trade (Pro tier)
export function useAnalyzeTrade() {
  const user = useUserStore((state) => state.user);
  const isPro = user?.subscriptionTier !== 'free';

  return useMutation({
    mutationFn: (data: TradeAnalysisInput) => tradeApi.analyzeTrade(data),
    onSuccess: (analysis) => {
      toast.success(`Trade ${analysis.recommendation}: Net value ${analysis.netValue.toFixed(1)}`);
    },
    onError: (error: any) => {
      if (!isPro) {
        toast.error('Trade calculator is a Pro feature');
      } else {
        toast.error(error.response?.data?.error?.message || 'Failed to analyze trade');
      }
    },
  });
}

// Get trade history
export function useTradeHistory(params?: { limit?: number; offset?: number }) {
  const user = useUserStore((state) => state.user);
  const isPro = user?.subscriptionTier !== 'free';

  return useQuery({
    queryKey: [...tradeKeys.history(), params],
    queryFn: () => tradeApi.getTradeHistory(params),
    enabled: isPro,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Save trade analysis
export function useSaveTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (analysis: TradeAnalysis) => tradeApi.saveTrade(analysis),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tradeKeys.history() });
      toast.success('Trade saved to history');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to save trade');
    },
  });
}

// Get waiver wire value
export function useWaiverWireValue(excludeTopN: number = 50) {
  const user = useUserStore((state) => state.user);
  const isPro = user?.subscriptionTier !== 'free';

  return useQuery({
    queryKey: tradeKeys.waiverValue(excludeTopN),
    queryFn: () => tradeApi.getWaiverWireValue(excludeTopN),
    enabled: isPro,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}