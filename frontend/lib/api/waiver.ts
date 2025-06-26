import { apiClient } from './client';
import type { WaiverRecommendation, WaiverQueryInput } from '@shared/types';

export const waiverApi = {
  // Get daily waiver wire recommendations (Pro+ tier)
  async getDailyRecommendations(
    params?: WaiverQueryInput
  ): Promise<{
    recommendations: WaiverRecommendation[];
    date: string;
    gamesCount: number;
  }> {
    return apiClient.get('/api/waiver/daily-recommendations', params);
  },

  // Get waiver wire trends
  async getWaiverTrends(params?: {
    days?: number;
    limit?: number;
  }): Promise<{
    trending: Array<{
      playerId: string;
      name: string;
      pickupRate: number;
      trend: 'rising' | 'falling' | 'stable';
    }>;
  }> {
    return apiClient.get('/api/waiver/trends', params);
  },

  // Get available players for a specific date
  async getAvailablePlayers(params?: {
    date?: string;
    excludeTopN?: number;
    includeInjured?: boolean;
  }): Promise<{
    players: Array<{
      playerId: string;
      name: string;
      team: string;
      opponent: string;
      projectedPoints: number;
      ownership: number;
    }>;
    total: number;
  }> {
    return apiClient.get('/api/waiver/available', params);
  },

  // Get matchup analysis for a player
  async getMatchupAnalysis(
    playerId: string,
    date?: string
  ): Promise<{
    playerId: string;
    opponent: string;
    matchupFavorability: number;
    opponentDefensiveRating: number;
    leagueAverageDefensiveRating: number;
    historicalPerformance: {
      gamesPlayed: number;
      averagePoints: number;
      averageFantasyPoints: number;
    };
  }> {
    return apiClient.get(`/api/waiver/matchup/${playerId}`, { date });
  },
};