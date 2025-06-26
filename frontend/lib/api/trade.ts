import { apiClient } from './client';
import type { TradeAnalysis, TradeAnalysisInput } from '@shared/types';

export const tradeApi = {
  // Analyze a trade (Pro tier)
  async analyzeTrade(data: TradeAnalysisInput): Promise<TradeAnalysis> {
    return apiClient.post('/api/trade/analyze', data);
  },

  // Get trade history
  async getTradeHistory(params?: {
    limit?: number;
    offset?: number;
  }): Promise<{
    trades: TradeAnalysis[];
    total: number;
  }> {
    return apiClient.get('/api/trade/history', params);
  },

  // Save trade analysis
  async saveTrade(analysis: TradeAnalysis): Promise<void> {
    return apiClient.post('/api/trade/save', analysis);
  },

  // Get waiver wire value (for trade calculations)
  async getWaiverWireValue(excludeTopN: number = 50): Promise<{
    averageValue: number;
    topPlayers: Array<{
      playerId: string;
      name: string;
      fantasyPointsAvg: number;
    }>;
  }> {
    return apiClient.get('/api/trade/waiver-value', { excludeTopN });
  },
};