import { prisma } from '../config/database';
import { cache, cacheKeys } from '../config/redis';
import { AppError } from '../middleware/error';
import { logger } from '../utils/logger';
import { WAIVER_WIRE_CONFIG, CACHE_DURATIONS } from '@shared/constants';
import { WaiverQueryInput } from '@shared/schemas';
import { Position, InjuryStatus } from '@shared/types';

export interface WaiverPlayer {
  id: string;
  name: string;
  team: string;
  position: Position;
  photoUrl: string | null;
  injuryStatus: InjuryStatus;
}

export interface WaiverRecommendation {
  rank: number;
  player: WaiverPlayer;
  opponent: string;
  recommendationScore: number;
  projectedFantasyPoints: number;
  hotFactor: number;
  minutesTrend: number;
  matchupFavorability: number;
  reasoning: string;
}

export interface DailyRecommendationsResult {
  recommendations: WaiverRecommendation[];
  date: string;
  gamesCount: number;
  message?: string;
}

export interface TrendingPlayer {
  playerId: string;
  name: string;
  pickupRate: number;
  trend: 'rising' | 'falling' | 'stable';
}

export interface WaiverTrendsResult {
  trending: TrendingPlayer[];
}

export interface AvailablePlayer {
  playerId: string;
  name: string;
  team: string;
  opponent: string;
  projectedPoints: number;
  ownership: number;
}

export interface AvailablePlayersResult {
  players: AvailablePlayer[];
  total: number;
}

export interface MatchupAnalysis {
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
}

export class WaiverService {
  /**
   * Get daily waiver recommendations
   */
  async getDailyRecommendations(
    query: WaiverQueryInput,
    userId: string
  ): Promise<DailyRecommendationsResult> {
    try {
      const {
        excludeTopN = WAIVER_WIRE_CONFIG.DEFAULT_EXCLUDE_TOP_N,
        date: queryDate = new Date().toISOString().split('T')[0]
      } = query;
      
      const date = typeof queryDate === 'string' ? queryDate : queryDate.toISOString().split('T')[0];

      // Check cache
      const cacheKey = cacheKeys.dailyRecommendations(date, excludeTopN);
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached as DailyRecommendationsResult;
      }

      // Get recommendations for the date
      const recommendations = await prisma.waiverRecommendation.findMany({
        where: {
          date: new Date(date),
        },
        include: {
          player: {
            include: {
              injuries: {
                where: { active: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { rank: 'asc' },
        take: WAIVER_WIRE_CONFIG.MAX_RECOMMENDATIONS,
      });

      if (recommendations.length === 0) {
        // No recommendations available - could trigger generation
        return {
          recommendations: [],
          date,
          gamesCount: 0,
          message: 'No recommendations available for this date. Check back later.',
        };
      }

      // Get games count for context
      const gamesCount = await this.getGamesCount(date);

      const formattedRecommendations = recommendations.map(rec => ({
        rank: rec.rank,
        player: {
          id: rec.player.id,
          name: rec.player.name,
          team: rec.player.team,
          position: rec.player.position,
          photoUrl: rec.player.photoUrl,
          injuryStatus: (rec.player.injuries[0]?.status || 'HEALTHY') as InjuryStatus,
        },
        opponent: rec.opponentTeam,
        recommendationScore: rec.recommendationScore,
        projectedFantasyPoints: rec.projectedFantasyPoints,
        hotFactor: rec.hotFactor,
        minutesTrend: rec.minutesTrend,
        matchupFavorability: rec.matchupFavorability,
        reasoning: rec.reasoning,
      }));

      const result: DailyRecommendationsResult = {
        recommendations: formattedRecommendations,
        date,
        gamesCount,
      };

      // Cache for 1 hour
      await cache.set(cacheKey, result, CACHE_DURATIONS.DAILY_RECOMMENDATIONS);

      return result;
    } catch (error) {
      logger.error('Get daily recommendations failed:', error);
      throw new AppError('Failed to retrieve daily recommendations', 500);
    }
  }

  /**
   * Get waiver wire trends
   */
  async getWaiverTrends(days: number = 7, limit: number = 20): Promise<WaiverTrendsResult> {
    try {
      // Check cache
      const cacheKey = cacheKeys.waiverTrends(days);
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached as WaiverTrendsResult;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const recommendations = await prisma.waiverRecommendation.findMany({
        where: {
          date: { gte: startDate },
        },
        select: {
          playerId: true,
          rank: true,
          recommendationScore: true,
        },
      });

      // Calculate trending players
      const playerAppearances = new Map<string, { count: number; scores: number[] }>();

      recommendations.forEach(rec => {
        const current = playerAppearances.get(rec.playerId) || { count: 0, scores: [] };
        current.count++;
        current.scores.push(rec.recommendationScore);
        playerAppearances.set(rec.playerId, current);
      });

      // Calculate trends and get player info
      const trends = await Promise.all(
        Array.from(playerAppearances.entries())
          .filter(([_, data]) => data.count >= 2) // At least 2 appearances
          .map(async ([playerId, data]) => {
            const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
            const recentScore = data.scores[data.scores.length - 1];
            const trend = recentScore > avgScore ? 'rising' : 
                         recentScore < avgScore ? 'falling' : 'stable';

            const player = await prisma.player.findUnique({
              where: { id: playerId },
              select: { name: true },
            });

            return {
              playerId,
              name: player?.name || 'Unknown',
              pickupRate: (data.count / days) * 100,
              trend: trend as 'rising' | 'falling' | 'stable',
            };
          })
      );

      // Sort by pickup rate
      trends.sort((a, b) => b.pickupRate - a.pickupRate);

      const result: WaiverTrendsResult = {
        trending: trends.slice(0, limit),
      };

      // Cache for 30 minutes
      await cache.set(cacheKey, result, 30 * 60);

      return result;
    } catch (error) {
      logger.error('Get waiver trends failed:', error);
      throw new AppError('Failed to retrieve waiver trends', 500);
    }
  }

  /**
   * Get available players for a specific date
   */
  async getAvailablePlayers(
    date: string = new Date().toISOString().split('T')[0],
    excludeTopN: number = 50,
    includeInjured: boolean = false
  ): Promise<AvailablePlayersResult> {
    try {
      // Get games for the date
      const games = await prisma.game.findMany({
        where: {
          date: {
            gte: new Date(date),
            lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });

      const teamsPlaying = new Set<string>();
      games.forEach(game => {
        teamsPlaying.add(game.homeTeam);
        teamsPlaying.add(game.awayTeam);
      });

      // Get top players to exclude
      const topPlayerIds = await this.getTopPlayerIds(excludeTopN);

      // Build where clause for available players
      const where: any = {
        team: { in: Array.from(teamsPlaying) },
        id: { notIn: topPlayerIds },
        activeStatus: true,
      };

      if (!includeInjured) {
        where.NOT = {
          injuries: {
            some: {
              active: true,
              status: { in: ['OUT', 'DOUBTFUL'] },
            },
          },
        };
      }

      const players = await prisma.player.findMany({
        where,
        include: {
          fantasyScores: {
            where: { scoringConfig: { isDefault: true } },
            orderBy: { date: 'desc' },
            take: 1,
          },
        },
      });

      // Calculate projections and ownership
      const playersWithProjections = players.map(player => {
        const opponent = games.find(g => 
          g.homeTeam === player.team || g.awayTeam === player.team
        );
        const opponentTeam = opponent?.homeTeam === player.team 
          ? opponent.awayTeam 
          : opponent?.homeTeam;

        return {
          playerId: player.id,
          name: player.name,
          team: player.team,
          opponent: opponentTeam || 'Unknown',
          projectedPoints: player.fantasyScores[0]?.seasonAverage || 0,
          ownership: this.calculateMockOwnership(), // Mock ownership percentage
        };
      });

      // Sort by projected points
      playersWithProjections.sort((a, b) => b.projectedPoints - a.projectedPoints);

      return {
        players: playersWithProjections,
        total: playersWithProjections.length,
      };
    } catch (error) {
      logger.error('Get available players failed:', error);
      throw new AppError('Failed to retrieve available players', 500);
    }
  }

  /**
   * Get matchup analysis for a specific player
   */
  async getMatchupAnalysis(
    playerId: string,
    date: string = new Date().toISOString().split('T')[0]
  ): Promise<MatchupAnalysis> {
    try {
      // Get player
      const player = await prisma.player.findUnique({
        where: { id: playerId },
      });

      if (!player) {
        throw new AppError('Player not found', 404);
      }

      // Get game for the date
      const game = await prisma.game.findFirst({
        where: {
          date: {
            gte: new Date(date),
            lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
          },
          OR: [
            { homeTeam: player.team },
            { awayTeam: player.team },
          ],
        },
      });

      if (!game) {
        return {
          playerId,
          opponent: 'No game scheduled',
          matchupFavorability: 0.5,
          opponentDefensiveRating: 0,
          leagueAverageDefensiveRating: 0,
          historicalPerformance: {
            gamesPlayed: 0,
            averagePoints: 0,
            averageFantasyPoints: 0,
          },
        };
      }

      const opponent = game.homeTeam === player.team ? game.awayTeam : game.homeTeam;

      // Get historical performance against opponent
      const historicalGames = await prisma.playerStats.findMany({
        where: {
          playerId,
          game: {
            OR: [
              { homeTeam: opponent, awayTeam: player.team },
              { homeTeam: player.team, awayTeam: opponent },
            ],
          },
        },
      });

      const historicalPerformance = {
        gamesPlayed: historicalGames.length,
        averagePoints: historicalGames.length > 0
          ? historicalGames.reduce((sum, g) => sum + g.points, 0) / historicalGames.length
          : 0,
        averageFantasyPoints: 0, // Would calculate based on scoring config
      };

      // Mock defensive ratings (would be calculated from actual data)
      const opponentDefensiveRating = 100 + Math.random() * 20 - 10;
      const leagueAverageDefensiveRating = 100;
      const matchupFavorability = opponentDefensiveRating / leagueAverageDefensiveRating;

      return {
        playerId,
        opponent,
        matchupFavorability,
        opponentDefensiveRating,
        leagueAverageDefensiveRating,
        historicalPerformance,
      };
    } catch (error) {
      logger.error('Get matchup analysis failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to retrieve matchup analysis', 500);
    }
  }

  /**
   * Generate waiver recommendations for a specific date
   */
  async generateRecommendations(date: string): Promise<WaiverRecommendation[]> {
    try {
      // This would be a complex algorithm that considers:
      // 1. Players not in top tiers
      // 2. Upcoming games/matchups
      // 3. Recent performance trends
      // 4. Minutes and usage trends
      // 5. Injury statuses
      
      // For now, return a placeholder
      logger.info(`Generating waiver recommendations for ${date}`);
      
      // This would be implemented with the actual recommendation algorithm
      return [];
    } catch (error) {
      logger.error('Generate recommendations failed:', error);
      throw new AppError('Failed to generate recommendations', 500);
    }
  }

  /**
   * Search available players with filters
   */
  async searchAvailablePlayers(
    searchTerm: string,
    filters: {
      position?: Position;
      team?: string;
      excludeTopN?: number;
      minProjectedPoints?: number;
    } = {}
  ): Promise<AvailablePlayer[]> {
    try {
      const {
        position,
        team,
        excludeTopN = 50,
        minProjectedPoints = 0
      } = filters;

      // Get top players to exclude
      const topPlayerIds = await this.getTopPlayerIds(excludeTopN);

      // Build search query
      const where: any = {
        id: { notIn: topPlayerIds },
        activeStatus: true,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
        ],
      };

      if (position) where.position = position;
      if (team) where.team = team;

      const players = await prisma.player.findMany({
        where,
        include: {
          fantasyScores: {
            where: { scoringConfig: { isDefault: true } },
            orderBy: { date: 'desc' },
            take: 1,
          },
        },
        take: 20, // Limit search results
      });

      const results = players
        .map(player => ({
          playerId: player.id,
          name: player.name,
          team: player.team,
          opponent: 'TBD', // Would be calculated based on schedule
          projectedPoints: player.fantasyScores[0]?.seasonAverage || 0,
          ownership: this.calculateMockOwnership(),
        }))
        .filter(player => player.projectedPoints >= minProjectedPoints)
        .sort((a, b) => b.projectedPoints - a.projectedPoints);

      return results;
    } catch (error) {
      logger.error('Search available players failed:', error);
      throw new AppError('Failed to search available players', 500);
    }
  }

  /**
   * Get games count for a specific date
   */
  private async getGamesCount(date: string): Promise<number> {
    return await prisma.game.count({
      where: {
        date: {
          gte: new Date(date),
          lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });
  }

  /**
   * Get top player IDs to exclude from waiver recommendations
   */
  private async getTopPlayerIds(excludeTopN: number): Promise<string[]> {
    const topPlayers = await prisma.playerFantasyScore.findMany({
      where: {
        scoringConfig: { isDefault: true },
      },
      orderBy: { seasonAverage: 'desc' },
      take: excludeTopN,
      select: { playerId: true },
    });

    return topPlayers.map(p => p.playerId);
  }

  /**
   * Calculate mock ownership percentage
   */
  private calculateMockOwnership(): number {
    // Mock ownership between 0-30% for waiver players
    return Math.random() * 30;
  }

  /**
   * Get player's recent performance trend
   */
  async getPlayerPerformanceTrend(playerId: string, days: number = 7): Promise<{
    trend: 'up' | 'down' | 'stable';
    recentAverage: number;
    seasonAverage: number;
    trendValue: number;
  }> {
    try {
      const recentStats = await prisma.playerStats.findMany({
        where: {
          playerId,
          date: {
            gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { date: 'desc' },
      });

      const seasonStats = await prisma.playerStats.findMany({
        where: { playerId },
        orderBy: { date: 'desc' },
      });

      if (recentStats.length === 0 || seasonStats.length === 0) {
        return {
          trend: 'stable',
          recentAverage: 0,
          seasonAverage: 0,
          trendValue: 0,
        };
      }

      // Calculate averages (simplified - would use fantasy scoring)
      const recentAverage = recentStats.reduce((sum, stat) => 
        sum + stat.points + stat.rebounds + stat.assists, 0) / recentStats.length;
      
      const seasonAverage = seasonStats.reduce((sum, stat) => 
        sum + stat.points + stat.rebounds + stat.assists, 0) / seasonStats.length;

      const trendValue = (recentAverage - seasonAverage) / seasonAverage;
      
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (trendValue > 0.1) trend = 'up';
      else if (trendValue < -0.1) trend = 'down';

      return {
        trend,
        recentAverage,
        seasonAverage,
        trendValue,
      };
    } catch (error) {
      logger.error('Get player performance trend failed:', error);
      throw new AppError('Failed to get player performance trend', 500);
    }
  }
}

export const waiverService = new WaiverService();