import { apiClient } from './client';
import type {
  Player,
  PlayerStats,
  PlayerFantasyScore,
  ConsistencyMetric,
  TrendingAnalysis,
  PlayerFilterInput,
  PaginationInput,
  ApiResponse,
} from '@shared/types';

export const playersApi = {
  // Get all players with optional filters
  async getPlayers(params?: PlayerFilterInput & PaginationInput): Promise<ApiResponse> {
    return apiClient.get('/api/players', params);
  },

  // Get a single player by ID
  async getPlayer(playerId: string): Promise<Player> {
    return apiClient.get(`/api/players/${playerId}`);
  },

  // Get player statistics
  async getPlayerStats(
    playerId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      aggregation?: 'game' | 'daily' | 'weekly' | 'monthly' | 'season';
    }
  ): Promise<PlayerStats[]> {
    return apiClient.get(`/api/players/${playerId}/stats`, params);
  },

  // Get player fantasy scores
  async getPlayerFantasyScores(
    playerId: string,
    scoringConfigId?: string
  ): Promise<PlayerFantasyScore[]> {
    return apiClient.get(`/api/players/${playerId}/fantasy-scores`, {
      scoringConfigId,
    });
  },

  // Get player consistency metrics
  async getPlayerConsistency(
    playerId: string,
    days: '7' | '14' | '30' = '14'
  ): Promise<ConsistencyMetric> {
    return apiClient.get(`/api/players/${playerId}/consistency`, { days });
  },

  // Get player trending analysis
  async getPlayerTrends(playerId: string): Promise<TrendingAnalysis> {
    return apiClient.get(`/api/players/${playerId}/trends`);
  },

  // Get fantasy rankings
  async getFantasyRankings(params?: {
    scoringConfigId?: string;
    position?: string;
    limit?: number;
  }): Promise<ApiResponse> {
    return apiClient.get('/api/players/rankings', params);
  },

  // Get hot players (Pro tier)
  async getHotPlayers(params?: {
    days?: '5' | '7' | '10' | '14';
    minImprovement?: number;
    limit?: number;
  }): Promise<ApiResponse> {
    return apiClient.get('/api/players/hot', params);
  },

  // Get consistency rankings (Pro tier)
  async getConsistencyRankings(params?: {
    days?: '7' | '14' | '30';
    minGamesPlayed?: number;
    limit?: number;
  }): Promise<ApiResponse> {
    return apiClient.get('/api/players/consistency-rankings', params);
  },

  // Search players
  async searchPlayers(query: string): Promise<Player[]> {
    return apiClient.get('/api/players/search', { q: query });
  },
};