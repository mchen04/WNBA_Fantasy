import { prisma } from '../config/database';
import { cache, cacheKeys } from '../config/redis';
import { AppError } from '../middleware/error';
import { logger } from '../utils/logger';
import { WAIVER_WIRE_CONFIG, CACHE_DURATIONS } from '@shared/constants';
import { WaiverQueryInput } from '@shared/schemas';
import { Position, InjuryStatus } from '@shared/types';
import { Position as PrismaPosition, InjuryStatus as PrismaInjuryStatus } from '@prisma/client';

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
          position: rec.player.position as Position,
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

      // Calculate historical fantasy performance
      const calculateFantasyPoints = (stat: any) => 
        stat.points + stat.rebounds + stat.assists + (stat.steals * 2) + (stat.blocks * 2) + stat.threePointersMade - stat.turnovers;

      const historicalPerformance = {
        gamesPlayed: historicalGames.length,
        averagePoints: historicalGames.length > 0
          ? historicalGames.reduce((sum, g) => sum + g.points, 0) / historicalGames.length
          : 0,
        averageFantasyPoints: historicalGames.length > 0
          ? historicalGames.reduce((sum, g) => sum + calculateFantasyPoints(g), 0) / historicalGames.length
          : 0,
      };

      // Calculate real defensive ratings
      const { opponentDefensiveRating, leagueAverageDefensiveRating, matchupFavorability } = 
        await this.calculateDetailedMatchupAnalysis(player, opponent);

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
  async generateRecommendations(
    date: string,
    excludeTopN: number = WAIVER_WIRE_CONFIG.DEFAULT_EXCLUDE_TOP_N
  ): Promise<WaiverRecommendation[]> {
    try {
      logger.info(`Generating waiver recommendations for ${date}, excluding top ${excludeTopN} players`);
      
      const targetDate = new Date(date);
      
      // Step 1: Get games for the date
      const games = await prisma.game.findMany({
        where: {
          date: {
            gte: targetDate,
            lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
          },
          status: { not: 'CANCELED' },
        },
      });

      if (games.length === 0) {
        logger.info(`No games scheduled for ${date}`);
        return [];
      }

      // Step 2: Get teams playing today
      const teamsPlaying = new Set<string>();
      const teamMatchups = new Map<string, string>(); // team -> opponent
      
      games.forEach(game => {
        teamsPlaying.add(game.homeTeam);
        teamsPlaying.add(game.awayTeam);
        teamMatchups.set(game.homeTeam, game.awayTeam);
        teamMatchups.set(game.awayTeam, game.homeTeam);
      });

      // Step 3: Get top players to exclude
      const topPlayerIds = await this.getTopPlayerIds(excludeTopN);

      // Step 4: Get eligible players (playing today, not in top tier, not severely injured)
      const eligiblePlayers = await prisma.player.findMany({
        where: {
          team: { in: Array.from(teamsPlaying) },
          id: { notIn: topPlayerIds },
          activeStatus: true,
          NOT: {
            injuries: {
              some: {
                active: true,
                status: 'OUT',
              },
            },
          },
        },
        include: {
          fantasyScores: {
            where: { scoringConfig: { isDefault: true } },
            orderBy: { date: 'desc' },
            take: 1,
          },
          consistencyMetrics: {
            orderBy: { date: 'desc' },
            take: 1,
          },
          trendingAnalyses: {
            orderBy: { date: 'desc' },
            take: 1,
          },
          injuries: {
            where: { active: true },
            take: 1,
          },
        },
      });

      // Step 5: Calculate recommendation scores for each player
      const playerRecommendations = await Promise.all(
        eligiblePlayers.map(async (player) => {
          const opponent = teamMatchups.get(player.team) || 'Unknown';
          
          // Get projected fantasy points (use season average as baseline)
          const projectedFantasyPoints = player.fantasyScores[0]?.seasonAverage || 0;
          
          // Calculate hot factor (recent vs season performance)
          const hotFactor = await this.calculateHotFactor(player);
          
          // Calculate minutes trend
          const minutesTrend = await this.calculateMinutesTrend(player);
          
          // Calculate matchup favorability
          const matchupFavorability = await this.calculateMatchupFavorability(player, opponent);
          
          // Calculate composite recommendation score
          const weights = WAIVER_WIRE_CONFIG.SCORING_WEIGHTS;
          const recommendationScore = 
            (projectedFantasyPoints * weights.projectedPoints) +
            (hotFactor * weights.hotFactor) +
            (minutesTrend * weights.minutesTrend) +
            (matchupFavorability * weights.matchupFavorability);

          // Generate reasoning
          const reasoning = this.generateRecommendationReasoning({
            player,
            projectedFantasyPoints,
            hotFactor,
            minutesTrend,
            matchupFavorability,
            opponent,
          });

          return {
            playerId: player.id,
            projectedFantasyPoints,
            hotFactor,
            minutesTrend,
            matchupFavorability,
            recommendationScore,
            opponent,
            reasoning,
          };
        })
      );

      // Step 6: Sort by recommendation score and take top recommendations
      playerRecommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);
      const topRecommendations = playerRecommendations.slice(0, WAIVER_WIRE_CONFIG.MAX_RECOMMENDATIONS);

      // Step 7: Save recommendations to database
      await prisma.waiverRecommendation.deleteMany({
        where: { date: targetDate },
      });

      const savedRecommendations = await Promise.all(
        topRecommendations.map(async (rec, index) => {
          return await prisma.waiverRecommendation.create({
            data: {
              date: targetDate,
              playerId: rec.playerId,
              recommendationScore: rec.recommendationScore,
              projectedFantasyPoints: rec.projectedFantasyPoints,
              hotFactor: rec.hotFactor,
              minutesTrend: rec.minutesTrend,
              matchupFavorability: rec.matchupFavorability,
              opponentTeam: rec.opponent,
              rank: index + 1,
              reasoning: rec.reasoning,
            },
          });
        })
      );

      // Step 8: Convert to return format
      const recommendations: WaiverRecommendation[] = await Promise.all(
        savedRecommendations.map(async (rec) => {
          const player = await prisma.player.findUnique({
            where: { id: rec.playerId },
            include: {
              injuries: {
                where: { active: true },
                take: 1,
              },
            },
          });

          return {
            rank: rec.rank,
            player: {
              id: player!.id,
              name: player!.name,
              team: player!.team,
              position: player!.position as Position,
              photoUrl: player!.photoUrl,
              injuryStatus: (player!.injuries[0]?.status || 'HEALTHY') as InjuryStatus,
            },
            opponent: rec.opponentTeam,
            recommendationScore: rec.recommendationScore,
            projectedFantasyPoints: rec.projectedFantasyPoints,
            hotFactor: rec.hotFactor,
            minutesTrend: rec.minutesTrend,
            matchupFavorability: rec.matchupFavorability,
            reasoning: rec.reasoning,
          };
        })
      );

      logger.info(`Generated ${recommendations.length} waiver recommendations for ${date}`);
      return recommendations;
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

  /**
   * Calculate hot factor for a player - key algorithm for waiver recommendations
   */
  private async calculateHotFactor(player: any): Promise<number> {
    try {
      // Use existing trending analysis if available
      if (player.trendingAnalyses && player.trendingAnalyses.length > 0) {
        return player.trendingAnalyses[0].hotFactor;
      }

      // Fallback calculation based on recent vs season performance
      const recentStats = await prisma.playerStats.findMany({
        where: {
          playerId: player.id,
          date: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      });

      const seasonStats = await prisma.playerStats.findMany({
        where: { playerId: player.id },
      });

      if (recentStats.length === 0 || seasonStats.length === 0) {
        return 0;
      }

      // Calculate fantasy points using default scoring
      const calculateFantasyPoints = (stat: any) => 
        stat.points + stat.rebounds + stat.assists + (stat.steals * 2) + (stat.blocks * 2) + stat.threePointersMade - stat.turnovers;

      const recentAvg = recentStats.reduce((sum, stat) => sum + calculateFantasyPoints(stat), 0) / recentStats.length;
      const seasonAvg = seasonStats.reduce((sum, stat) => sum + calculateFantasyPoints(stat), 0) / seasonStats.length;

      if (seasonAvg === 0) return 0;

      const hotFactor = (recentAvg - seasonAvg) / seasonAvg;
      return Math.max(0, Math.min(1, hotFactor)); // Normalize to 0-1 range
    } catch (error) {
      logger.error('Calculate hot factor failed:', error);
      return 0;
    }
  }

  /**
   * Calculate minutes trend for a player
   */
  private async calculateMinutesTrend(player: any): Promise<number> {
    try {
      // Use existing trending analysis if available
      if (player.trendingAnalyses && player.trendingAnalyses.length > 0) {
        return player.trendingAnalyses[0].minutesTrendValue;
      }

      // Fallback calculation
      const recentStats = await prisma.playerStats.findMany({
        where: {
          playerId: player.id,
          date: {
            gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // Last 14 days
          },
        },
        orderBy: { date: 'desc' },
      });

      if (recentStats.length < 3) {
        return 0;
      }

      // Calculate linear trend in minutes
      const recentMinutes = recentStats.slice(0, 7).reduce((sum, stat) => sum + stat.minutes, 0) / Math.min(7, recentStats.length);
      const olderMinutes = recentStats.slice(7, 14).reduce((sum, stat) => sum + stat.minutes, 0) / Math.min(7, recentStats.slice(7).length);

      if (olderMinutes === 0) return 0;

      const minutesTrend = (recentMinutes - olderMinutes) / olderMinutes;
      return Math.max(-1, Math.min(1, minutesTrend)); // Normalize to -1 to 1 range
    } catch (error) {
      logger.error('Calculate minutes trend failed:', error);
      return 0;
    }
  }

  /**
   * Calculate matchup favorability - Pro+ feature algorithm
   */
  private async calculateMatchupFavorability(player: any, opponent: string): Promise<number> {
    try {
      if (opponent === 'Unknown') {
        return 0.5; // Neutral if no opponent info
      }

      // Get historical performance against this opponent
      const historicalGames = await prisma.playerStats.findMany({
        where: {
          playerId: player.id,
          game: {
            OR: [
              { homeTeam: opponent, awayTeam: player.team },
              { homeTeam: player.team, awayTeam: opponent },
            ],
          },
        },
        include: { game: true },
      });

      // Get opponent's defensive stats (simplified - would use advanced metrics)
      const opponentDefensiveStats = await prisma.playerStats.findMany({
        where: {
          game: {
            OR: [
              { homeTeam: opponent },
              { awayTeam: opponent },
            ],
          },
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      });

      // Calculate opponent's points allowed per game (simplified defensive rating)
      const opponentPointsAllowed = opponentDefensiveStats.length > 0 
        ? opponentDefensiveStats.reduce((sum, stat) => sum + stat.points, 0) / opponentDefensiveStats.length
        : 75; // League average approximation

      // League average points per game
      const leagueAverage = 75;

      // Higher points allowed = better matchup for offensive players
      let matchupFavorability = opponentPointsAllowed / leagueAverage;

      // Boost based on historical performance
      if (historicalGames.length > 0) {
        const calculateFantasyPoints = (stat: any) => 
          stat.points + stat.rebounds + stat.assists + (stat.steals * 2) + (stat.blocks * 2) + stat.threePointersMade - stat.turnovers;

        const historicalAvg = historicalGames.reduce((sum, stat) => sum + calculateFantasyPoints(stat), 0) / historicalGames.length;
        const playerSeasonAvg = player.fantasyScores[0]?.seasonAverage || 0;

        if (playerSeasonAvg > 0) {
          const historicalBoost = historicalAvg / playerSeasonAvg;
          matchupFavorability = (matchupFavorability + historicalBoost) / 2;
        }
      }

      return Math.max(0, Math.min(2, matchupFavorability)); // 0-2 range where 1 is neutral
    } catch (error) {
      logger.error('Calculate matchup favorability failed:', error);
      return 0.5; // Neutral default
    }
  }

  /**
   * Generate human-readable reasoning for recommendation
   */
  private generateRecommendationReasoning(params: {
    player: any;
    projectedFantasyPoints: number;
    hotFactor: number;
    minutesTrend: number;
    matchupFavorability: number;
    opponent: string;
  }): string {
    const { player, projectedFantasyPoints, hotFactor, minutesTrend, matchupFavorability, opponent } = params;
    
    const reasons: string[] = [];

    // Fantasy points reasoning
    if (projectedFantasyPoints > 20) {
      reasons.push('High scoring potential');
    } else if (projectedFantasyPoints > 15) {
      reasons.push('Solid fantasy production');
    } else if (projectedFantasyPoints > 10) {
      reasons.push('Decent fantasy floor');
    }

    // Hot streak reasoning
    if (hotFactor > 0.2) {
      reasons.push('Currently on a hot streak');
    } else if (hotFactor > 0.1) {
      reasons.push('Playing above season average');
    } else if (hotFactor < -0.1) {
      reasons.push('Recent performance below average');
    }

    // Minutes trend reasoning
    if (minutesTrend > 0.15) {
      reasons.push('Minutes trending upward');
    } else if (minutesTrend > 0.05) {
      reasons.push('Slight increase in playing time');
    } else if (minutesTrend < -0.15) {
      reasons.push('Minutes trending downward');
    }

    // Matchup reasoning
    if (matchupFavorability > 1.2) {
      reasons.push(`Excellent matchup vs ${opponent}`);
    } else if (matchupFavorability > 1.05) {
      reasons.push(`Good matchup vs ${opponent}`);
    } else if (matchupFavorability < 0.9) {
      reasons.push(`Challenging matchup vs ${opponent}`);
    } else {
      reasons.push(`Neutral matchup vs ${opponent}`);
    }

    // Injury status
    if (player.injuries && player.injuries.length > 0) {
      const injury = player.injuries[0];
      if (injury.status === 'QUESTIONABLE') {
        reasons.push('Questionable injury status - monitor closely');
      } else if (injury.status === 'DOUBTFUL') {
        reasons.push('Doubtful injury status - risky play');
      }
    }

    return reasons.join('; ');
  }

  /**
   * Calculate detailed matchup analysis with real defensive ratings
   */
  private async calculateDetailedMatchupAnalysis(player: any, opponent: string): Promise<{
    opponentDefensiveRating: number;
    leagueAverageDefensiveRating: number;
    matchupFavorability: number;
  }> {
    try {
      // Get last 15 games for opponent's defensive rating
      const recentOpponentGames = await prisma.game.findMany({
        where: {
          OR: [
            { homeTeam: opponent },
            { awayTeam: opponent },
          ],
          status: 'FINAL',
        },
        include: {
          playerStats: {
            include: {
              player: {
                select: {
                  team: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        take: 15,
      });

      // Calculate opponent's defensive rating (points allowed per game)
      let opponentPointsAllowed = 0;
      let gameCount = 0;

      recentOpponentGames.forEach(game => {
        const opponentStats = game.playerStats.filter(stat => 
          (game.homeTeam === opponent && stat.player.team === game.awayTeam) ||
          (game.awayTeam === opponent && stat.player.team === game.homeTeam)
        );
        
        const totalPoints = opponentStats.reduce((sum, stat) => sum + stat.points, 0);
        opponentPointsAllowed += totalPoints;
        gameCount++;
      });

      const opponentDefensiveRating = gameCount > 0 ? opponentPointsAllowed / gameCount : 75;

      // Calculate league average defensive rating
      const recentLeagueGames = await prisma.game.findMany({
        where: {
          status: 'FINAL',
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        include: {
          playerStats: {
            include: {
              player: {
                select: {
                  team: true,
                },
              },
            },
          },
        },
        take: 100, // Sample of recent games
      });

      let leaguePointsTotal = 0;
      let leagueGameCount = 0;

      recentLeagueGames.forEach(game => {
        const homeTeamPoints = game.playerStats
          .filter(stat => stat.player.team === game.homeTeam)
          .reduce((sum, stat) => sum + stat.points, 0);
        
        const awayTeamPoints = game.playerStats
          .filter(stat => stat.player.team === game.awayTeam)
          .reduce((sum, stat) => sum + stat.points, 0);

        leaguePointsTotal += homeTeamPoints + awayTeamPoints;
        leagueGameCount += 2; // Two teams per game
      });

      const leagueAverageDefensiveRating = leagueGameCount > 0 ? leaguePointsTotal / leagueGameCount : 75;

      // Calculate matchup favorability (higher = better for offensive players)
      const matchupFavorability = opponentDefensiveRating / leagueAverageDefensiveRating;

      return {
        opponentDefensiveRating,
        leagueAverageDefensiveRating,
        matchupFavorability,
      };
    } catch (error) {
      logger.error('Calculate detailed matchup analysis failed:', error);
      
      // Fallback to neutral ratings
      return {
        opponentDefensiveRating: 75,
        leagueAverageDefensiveRating: 75,
        matchupFavorability: 1.0,
      };
    }
  }

  /**
   * Enhanced injury status filtering for recommendations
   */
  async getPlayersWithInjuryFilter(
    playerIds: string[],
    includeQuestionable: boolean = true,
    includeDoubtful: boolean = false
  ): Promise<string[]> {
    try {
      const excludeStatuses: PrismaInjuryStatus[] = [PrismaInjuryStatus.OUT];
      
      if (!includeQuestionable) {
        excludeStatuses.push(PrismaInjuryStatus.QUESTIONABLE);
      }
      
      if (!includeDoubtful) {
        excludeStatuses.push(PrismaInjuryStatus.DOUBTFUL);
      }
      
      const injuredPlayers = await prisma.playerInjury.findMany({
        where: {
          playerId: { in: playerIds },
          active: true,
          status: { in: excludeStatuses },
        },
        select: { playerId: true },
      });
      
      const injuredPlayerIds = new Set(injuredPlayers.map(i => i.playerId));
      return playerIds.filter(id => !injuredPlayerIds.has(id));
    } catch (error) {
      logger.error('Enhanced injury filtering failed:', error);
      return playerIds; // Return all players if filtering fails
    }
  }

  /**
   * Get injury report summary for waiver wire
   */
  async getInjuryReport(): Promise<{
    totalInjuries: number;
    byStatus: Record<string, number>;
    recentInjuries: Array<{
      playerId: string;
      playerName: string;
      team: string;
      status: string;
      description: string;
      reportedDate: Date;
    }>;
  }> {
    try {
      const cacheKey = 'waiver:injury_report';
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached as any;
      }
      
      const activeInjuries = await prisma.playerInjury.findMany({
        where: { active: true },
        include: {
          player: {
            select: {
              name: true,
              team: true,
            },
          },
        },
        orderBy: { reportedDate: 'desc' },
      });
      
      const byStatus = activeInjuries.reduce((acc, injury) => {
        acc[injury.status] = (acc[injury.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const recentInjuries = activeInjuries.slice(0, 10).map(injury => ({
        playerId: injury.playerId,
        playerName: injury.player.name,
        team: injury.player.team,
        status: injury.status,
        description: injury.description || '',
        reportedDate: injury.reportedDate,
      }));
      
      const report = {
        totalInjuries: activeInjuries.length,
        byStatus,
        recentInjuries,
      };
      
      // Cache for 1 hour
      await cache.set(cacheKey, report, 60 * 60);
      
      return report;
    } catch (error) {
      logger.error('Get injury report failed:', error);
      throw new AppError('Failed to retrieve injury report', 500);
    }
  }

  /**
   * Get defensive efficiency metrics for a team
   */
  async getTeamDefensiveMetrics(teamName: string, days: number = 30): Promise<{
    pointsAllowedPerGame: number;
    fieldGoalPercentageAllowed: number;
    threePointPercentageAllowed: number;
    reboundsAllowedPerGame: number;
    turnoversForced: number;
    defensiveEfficiency: number;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const games = await prisma.game.findMany({
        where: {
          OR: [
            { homeTeam: teamName },
            { awayTeam: teamName },
          ],
          status: 'FINAL',
          date: { gte: startDate },
        },
        include: {
          playerStats: {
            include: {
              player: {
                select: {
                  team: true,
                },
              },
            },
          },
        },
      });

      if (games.length === 0) {
        return {
          pointsAllowedPerGame: 75,
          fieldGoalPercentageAllowed: 0.45,
          threePointPercentageAllowed: 0.35,
          reboundsAllowedPerGame: 35,
          turnoversForced: 15,
          defensiveEfficiency: 100,
        };
      }

      let totalPointsAllowed = 0;
      let totalFGM = 0;
      let totalFGA = 0;
      let total3PM = 0;
      let total3PA = 0;
      let totalReboundsAllowed = 0;
      let totalTurnoversForced = 0;

      games.forEach(game => {
        const opponentStats = game.playerStats.filter(stat => 
          (game.homeTeam === teamName && stat.player.team === game.awayTeam) ||
          (game.awayTeam === teamName && stat.player.team === game.homeTeam)
        );

        totalPointsAllowed += opponentStats.reduce((sum, stat) => sum + stat.points, 0);
        totalFGM += opponentStats.reduce((sum, stat) => sum + stat.fieldGoalsMade, 0);
        totalFGA += opponentStats.reduce((sum, stat) => sum + stat.fieldGoalsAttempted, 0);
        total3PM += opponentStats.reduce((sum, stat) => sum + stat.threePointersMade, 0);
        total3PA += opponentStats.reduce((sum, stat) => sum + stat.threePointersAttempted, 0);
        totalReboundsAllowed += opponentStats.reduce((sum, stat) => sum + stat.rebounds, 0);
        totalTurnoversForced += opponentStats.reduce((sum, stat) => sum + stat.turnovers, 0);
      });

      const pointsAllowedPerGame = totalPointsAllowed / games.length;
      const fieldGoalPercentageAllowed = totalFGA > 0 ? totalFGM / totalFGA : 0.45;
      const threePointPercentageAllowed = total3PA > 0 ? total3PM / total3PA : 0.35;
      const reboundsAllowedPerGame = totalReboundsAllowed / games.length;
      const turnoversForced = totalTurnoversForced / games.length;

      // Calculate a composite defensive efficiency score (lower is better)
      const defensiveEfficiency = 
        (pointsAllowedPerGame * 0.4) +
        (fieldGoalPercentageAllowed * 100 * 0.3) +
        (reboundsAllowedPerGame * 0.2) +
        ((20 - turnoversForced) * 0.1); // Penalty for not forcing turnovers

      return {
        pointsAllowedPerGame,
        fieldGoalPercentageAllowed,
        threePointPercentageAllowed,
        reboundsAllowedPerGame,
        turnoversForced,
        defensiveEfficiency,
      };
    } catch (error) {
      logger.error('Get team defensive metrics failed:', error);
      
      // Return league average defaults
      return {
        pointsAllowedPerGame: 75,
        fieldGoalPercentageAllowed: 0.45,
        threePointPercentageAllowed: 0.35,
        reboundsAllowedPerGame: 35,
        turnoversForced: 15,
        defensiveEfficiency: 100,
      };
    }
  }
}

export const waiverService = new WaiverService();