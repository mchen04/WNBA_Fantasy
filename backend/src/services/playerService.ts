import { prisma } from '../config/database';
import { cache, cacheKeys } from '../config/redis';
import { AppError } from '../middleware/error';
import { logger } from '../utils/logger';
import { CACHE_DURATIONS, WAIVER_WIRE_CONFIG } from '@shared/constants';
import { PlayerFilterInput, PaginationInput, StatsQueryInput, ConsistencyQueryInput, HotPlayerQueryInput } from '@shared/schemas';
import { Position, InjuryStatus } from '@shared/types';

export interface PlayerStats {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  minutes: number;
}

export interface PlayerSummary {
  id: string;
  name: string;
  team: string;
  position: Position;
  jerseyNumber: number | null;
  photoUrl: string | null;
  injuryStatus: InjuryStatus;
  gamesPlayed: number;
  averages: PlayerStats;
  averageFantasyPoints: number;
  lastGameFantasyPoints: number;
}

export interface PlayerDetails {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  team: string;
  position: Position;
  jerseyNumber: number | null;
  height: string | null;
  weight: number | null;
  birthDate: Date | null;
  yearsExperience: number | null;
  college: string | null;
  photoUrl: string | null;
  activeStatus: boolean;
  injuries: Array<{
    status: InjuryStatus;
    description: string | null;
    reportedDate: Date;
    active: boolean;
  }>;
  stats: Array<{
    date: Date;
    minutes: number;
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    game: {
      homeTeam: string;
      awayTeam: string;
      homeScore: number | null;
      awayScore: number | null;
    };
  }>;
}

export interface HotPlayer {
  player: {
    id: string;
    name: string;
    team: string;
    position: Position;
    photoUrl: string | null;
    injuryStatus: InjuryStatus;
  };
  hotFactor: number;
  recentAverage: number;
  seasonAverage: number;
  improvement: string;
  performanceTrend: string;
  minutesTrend: string;
}

export interface ConsistencyRanking {
  rank: number;
  player: {
    id: string;
    name: string;
    team: string;
    position: Position;
    photoUrl: string | null;
    injuryStatus: InjuryStatus;
  };
  consistencyGrade: string;
  coefficientOfVariation: number;
  gamesPlayed: number;
}

export interface FantasyRanking {
  rank: number;
  player: {
    id: string;
    name: string;
    team: string;
    position: Position;
    photoUrl: string | null;
    injuryStatus: InjuryStatus;
  };
  seasonAverage: number;
  last7DaysAverage: number;
  last14DaysAverage: number;
  last30DaysAverage: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class PlayerService {
  /**
   * Get players with filters and pagination
   */
  async getPlayers(
    filters: PlayerFilterInput & PaginationInput,
    userId?: string
  ): Promise<PaginatedResult<PlayerSummary>> {
    try {
      const {
        team,
        position,
        minGamesPlayed,
        injuryStatus,
        search,
        page = 1,
        limit = 20,
        sortBy = 'fantasyPoints',
        sortOrder = 'desc'
      } = filters;

      // Build where clause
      const where: any = {
        activeStatus: true,
      };

      if (team) where.team = team;
      if (position) where.position = position;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (injuryStatus && injuryStatus.length > 0) {
        where.injuries = {
          some: {
            active: true,
            status: { in: injuryStatus },
          },
        };
      }

      // Get total count
      const total = await prisma.player.count({ where });

      // Get players with related data
      const players = await prisma.player.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          injuries: {
            where: { active: true },
            orderBy: { reportedDate: 'desc' },
            take: 1,
          },
          stats: {
            orderBy: { date: 'desc' },
            take: minGamesPlayed || 5,
          },
          fantasyScores: {
            where: {
              scoringConfig: {
                isDefault: true,
              },
            },
            orderBy: { date: 'desc' },
            take: 1,
          },
        },
        orderBy: sortBy === 'name' 
          ? { name: sortOrder as any }
          : undefined,
      });

      // Calculate aggregated stats
      const playersWithStats = players.map(player => {
        const recentStats = player.stats;
        const gamesPlayed = recentStats.length;

        if (gamesPlayed === 0) {
          return {
            id: player.id,
            name: player.name,
            team: player.team,
            position: player.position,
            jerseyNumber: player.jerseyNumber,
            photoUrl: player.photoUrl,
            injuryStatus: (player.injuries[0]?.status || 'HEALTHY') as InjuryStatus,
            gamesPlayed: 0,
            averages: {
              points: 0,
              rebounds: 0,
              assists: 0,
              steals: 0,
              blocks: 0,
              minutes: 0,
            },
            averageFantasyPoints: 0,
            lastGameFantasyPoints: 0,
          };
        }

        // Calculate averages
        const totals = recentStats.reduce((acc, stat) => ({
          points: acc.points + stat.points,
          rebounds: acc.rebounds + stat.rebounds,
          assists: acc.assists + stat.assists,
          steals: acc.steals + stat.steals,
          blocks: acc.blocks + stat.blocks,
          minutes: acc.minutes + stat.minutes,
        }), {
          points: 0,
          rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          minutes: 0,
        });

        const averages = {
          points: totals.points / gamesPlayed,
          rebounds: totals.rebounds / gamesPlayed,
          assists: totals.assists / gamesPlayed,
          steals: totals.steals / gamesPlayed,
          blocks: totals.blocks / gamesPlayed,
          minutes: totals.minutes / gamesPlayed,
        };

        const latestFantasyScore = player.fantasyScores[0];

        return {
          id: player.id,
          name: player.name,
          team: player.team,
          position: player.position,
          jerseyNumber: player.jerseyNumber,
          photoUrl: player.photoUrl,
          injuryStatus: (player.injuries[0]?.status || 'HEALTHY') as InjuryStatus,
          gamesPlayed,
          averages,
          averageFantasyPoints: latestFantasyScore?.seasonAverage || 0,
          lastGameFantasyPoints: latestFantasyScore?.fantasyPoints || 0,
        };
      });

      // Sort by fantasy points if requested
      if (sortBy === 'fantasyPoints') {
        playersWithStats.sort((a, b) => {
          const aVal = a.averageFantasyPoints;
          const bVal = b.averageFantasyPoints;
          return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
        });
      }

      return {
        data: playersWithStats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Get players failed:', error);
      throw new AppError('Failed to retrieve players', 500);
    }
  }

  /**
   * Get single player details
   */
  async getPlayerById(playerId: string): Promise<PlayerDetails> {
    try {
      // Check cache first
      const cacheKey = cacheKeys.player(playerId);
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached as PlayerDetails;
      }

      const player = await prisma.player.findUnique({
        where: { id: playerId },
        include: {
          injuries: {
            where: { active: true },
            orderBy: { reportedDate: 'desc' },
          },
          stats: {
            orderBy: { date: 'desc' },
            take: 10,
            include: {
              game: {
                select: {
                  homeTeam: true,
                  awayTeam: true,
                  homeScore: true,
                  awayScore: true,
                },
              },
            },
          },
        },
      });

      if (!player) {
        throw new AppError('Player not found', 404);
      }

      const result: PlayerDetails = {
        id: player.id,
        name: player.name,
        firstName: player.firstName,
        lastName: player.lastName,
        team: player.team,
        position: player.position,
        jerseyNumber: player.jerseyNumber,
        height: player.height,
        weight: player.weight,
        birthDate: player.birthDate,
        yearsExperience: player.yearsExperience,
        college: player.college,
        photoUrl: player.photoUrl,
        activeStatus: player.activeStatus,
        injuries: player.injuries.map(injury => ({
          status: injury.status,
          description: injury.description,
          reportedDate: injury.reportedDate,
          active: injury.active,
        })),
        stats: player.stats.map(stat => ({
          date: stat.date,
          minutes: stat.minutes,
          points: stat.points,
          rebounds: stat.rebounds,
          assists: stat.assists,
          steals: stat.steals,
          blocks: stat.blocks,
          turnovers: stat.turnovers,
          game: stat.game,
        })),
      };

      // Cache the result
      await cache.set(cacheKey, result, CACHE_DURATIONS.PLAYER_INFO);

      return result;
    } catch (error) {
      logger.error('Get player by ID failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to retrieve player details', 500);
    }
  }

  /**
   * Get last N games for a player
   */
  async getPlayerLastNGames(playerId: string, n: number = 5): Promise<Array<{
    date: Date;
    opponent: string;
    result: 'W' | 'L' | null;
    minutes: number;
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    fouls: number;
    threePointersMade: number;
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    threePointersAttempted: number;
    freeThrowsMade: number;
    freeThrowsAttempted: number;
    plusMinus: number;
    game: {
      homeTeam: string;
      awayTeam: string;
      homeScore: number | null;
      awayScore: number | null;
      venue: string | null;
    };
  }>> {
    try {
      // Check cache first
      const cacheKey = `player:${playerId}:last${n}games`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached as any[];
      }

      // Get player to find their team
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: { team: true, name: true }
      });

      if (!player) {
        throw new AppError('Player not found', 404);
      }

      // Get the last N games with stats
      const stats = await prisma.playerStats.findMany({
        where: { playerId },
        include: {
          game: {
            select: {
              homeTeam: true,
              awayTeam: true,
              homeScore: true,
              awayScore: true,
              venue: true,
              date: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        take: n,
      });

      const formattedStats = stats.map(stat => {
        const isHome = stat.game.homeTeam === player.team;
        const opponent = isHome ? stat.game.awayTeam : stat.game.homeTeam;
        
        // Determine result (W/L)
        let result: 'W' | 'L' | null = null;
        if (stat.game.homeScore !== null && stat.game.awayScore !== null) {
          if (isHome) {
            result = stat.game.homeScore > stat.game.awayScore ? 'W' : 'L';
          } else {
            result = stat.game.awayScore > stat.game.homeScore ? 'W' : 'L';
          }
        }

        return {
          date: stat.date,
          opponent,
          result,
          minutes: stat.minutes,
          points: stat.points,
          rebounds: stat.rebounds,
          assists: stat.assists,
          steals: stat.steals,
          blocks: stat.blocks,
          turnovers: stat.turnovers,
          fouls: stat.fouls,
          threePointersMade: stat.threePointersMade,
          fieldGoalsMade: stat.fieldGoalsMade,
          fieldGoalsAttempted: stat.fieldGoalsAttempted,
          threePointersAttempted: stat.threePointersAttempted,
          freeThrowsMade: stat.freeThrowsMade,
          freeThrowsAttempted: stat.freeThrowsAttempted,
          plusMinus: stat.plusMinus,
          game: stat.game,
        };
      });

      // Cache the result for 15 minutes
      await cache.set(cacheKey, formattedStats, CACHE_DURATIONS.PLAYER_STATS);

      return formattedStats;
    } catch (error) {
      logger.error('Get player last N games failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to retrieve player games', 500);
    }
  }

  /**
   * Get player recent averages (last N games)
   */
  async getPlayerRecentAverages(playerId: string, games: number = 5): Promise<{
    gamesPlayed: number;
    averages: {
      minutes: number;
      points: number;
      rebounds: number;
      assists: number;
      steals: number;
      blocks: number;
      turnovers: number;
      threePointersMade: number;
      fieldGoalPercentage: number;
      threePointPercentage: number;
      freeThrowPercentage: number;
    };
  }> {
    try {
      const recentGames = await this.getPlayerLastNGames(playerId, games);
      
      if (recentGames.length === 0) {
        return {
          gamesPlayed: 0,
          averages: {
            minutes: 0,
            points: 0,
            rebounds: 0,
            assists: 0,
            steals: 0,
            blocks: 0,
            turnovers: 0,
            threePointersMade: 0,
            fieldGoalPercentage: 0,
            threePointPercentage: 0,
            freeThrowPercentage: 0,
          },
        };
      }

      const totals = recentGames.reduce((acc, game) => ({
        minutes: acc.minutes + game.minutes,
        points: acc.points + game.points,
        rebounds: acc.rebounds + game.rebounds,
        assists: acc.assists + game.assists,
        steals: acc.steals + game.steals,
        blocks: acc.blocks + game.blocks,
        turnovers: acc.turnovers + game.turnovers,
        threePointersMade: acc.threePointersMade + game.threePointersMade,
        fieldGoalsMade: acc.fieldGoalsMade + game.fieldGoalsMade,
        fieldGoalsAttempted: acc.fieldGoalsAttempted + game.fieldGoalsAttempted,
        threePointersAttempted: acc.threePointersAttempted + game.threePointersAttempted,
        freeThrowsMade: acc.freeThrowsMade + game.freeThrowsMade,
        freeThrowsAttempted: acc.freeThrowsAttempted + game.freeThrowsAttempted,
      }), {
        minutes: 0,
        points: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
        blocks: 0,
        turnovers: 0,
        threePointersMade: 0,
        fieldGoalsMade: 0,
        fieldGoalsAttempted: 0,
        threePointersAttempted: 0,
        freeThrowsMade: 0,
        freeThrowsAttempted: 0,
      });

      const gamesPlayed = recentGames.length;

      return {
        gamesPlayed,
        averages: {
          minutes: totals.minutes / gamesPlayed,
          points: totals.points / gamesPlayed,
          rebounds: totals.rebounds / gamesPlayed,
          assists: totals.assists / gamesPlayed,
          steals: totals.steals / gamesPlayed,
          blocks: totals.blocks / gamesPlayed,
          turnovers: totals.turnovers / gamesPlayed,
          threePointersMade: totals.threePointersMade / gamesPlayed,
          fieldGoalPercentage: totals.fieldGoalsAttempted > 0 ? 
            (totals.fieldGoalsMade / totals.fieldGoalsAttempted) * 100 : 0,
          threePointPercentage: totals.threePointersAttempted > 0 ? 
            (totals.threePointersMade / totals.threePointersAttempted) * 100 : 0,
          freeThrowPercentage: totals.freeThrowsAttempted > 0 ? 
            (totals.freeThrowsMade / totals.freeThrowsAttempted) * 100 : 0,
        },
      };
    } catch (error) {
      logger.error('Get player recent averages failed:', error);
      throw new AppError('Failed to retrieve player recent averages', 500);
    }
  }

  /**
   * Get player stats with filtering
   */
  async getPlayerStats(playerId: string, query: StatsQueryInput): Promise<any[]> {
    try {
      const { dateRange, aggregation = 'game' } = query;

      // Build where clause
      const where: any = { playerId };
      if (dateRange) {
        where.date = {
          gte: new Date(dateRange.startDate),
          lte: new Date(dateRange.endDate),
        };
      }

      const stats = await prisma.playerStats.findMany({
        where,
        include: {
          game: {
            select: {
              homeTeam: true,
              awayTeam: true,
              homeScore: true,
              awayScore: true,
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      return stats;
    } catch (error) {
      logger.error('Get player stats failed:', error);
      throw new AppError('Failed to retrieve player stats', 500);
    }
  }

  /**
   * Get fantasy rankings
   */
  async getFantasyRankings(
    scoringConfigId?: string,
    position?: Position,
    limit: number = 50,
    userId?: string
  ): Promise<FantasyRanking[]> {
    try {
      // Get default scoring config if not specified and user provided
      let configId = scoringConfigId;
      if (!configId && userId) {
        const defaultConfig = await prisma.scoringConfiguration.findFirst({
          where: {
            userId,
            isDefault: true,
          },
        });
        configId = defaultConfig?.id;
      }

      // Check cache
      const cacheKey = cacheKeys.fantasyRankings(configId || 'default', position);
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached as FantasyRanking[];
      }

      // Get rankings
      const rankings = await prisma.playerFantasyScore.findMany({
        where: {
          scoringConfigId: configId || undefined,
          player: position ? { position } : undefined,
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
        orderBy: { seasonAverage: 'desc' },
        take: limit,
      });

      const formattedRankings = rankings.map((item, index) => ({
        rank: index + 1,
        player: {
          id: item.player.id,
          name: item.player.name,
          team: item.player.team,
          position: item.player.position,
          photoUrl: item.player.photoUrl,
          injuryStatus: (item.player.injuries[0]?.status || 'HEALTHY') as InjuryStatus,
        },
        seasonAverage: item.seasonAverage || 0,
        last7DaysAverage: item.last7DaysAverage || 0,
        last14DaysAverage: item.last14DaysAverage || 0,
        last30DaysAverage: item.last30DaysAverage || 0,
      }));

      // Cache result
      await cache.set(cacheKey, formattedRankings, CACHE_DURATIONS.FANTASY_RANKINGS);

      return formattedRankings;
    } catch (error) {
      logger.error('Get fantasy rankings failed:', error);
      throw new AppError('Failed to retrieve fantasy rankings', 500);
    }
  }

  /**
   * Get hot players (trending up)
   */
  async getHotPlayers(query: HotPlayerQueryInput): Promise<HotPlayer[]> {
    try {
      const { days = '7', minImprovement = 0.15 } = query;
      const limit = 20;

      // Check cache
      const cacheKey = cacheKeys.hotPlayers(days);
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached as HotPlayer[];
      }

      const hotPlayers = await prisma.trendingAnalysis.findMany({
        where: {
          isHot: true,
          hotFactor: { gte: minImprovement },
          date: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
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
        orderBy: { hotFactor: 'desc' },
        take: limit,
      });

      const formattedHotPlayers = hotPlayers.map(item => ({
        player: {
          id: item.player.id,
          name: item.player.name,
          team: item.player.team,
          position: item.player.position,
          photoUrl: item.player.photoUrl,
          injuryStatus: (item.player.injuries[0]?.status || 'HEALTHY') as InjuryStatus,
        },
        hotFactor: item.hotFactor,
        recentAverage: item.recentAverage,
        seasonAverage: item.seasonAverage,
        improvement: `${Math.round(item.hotFactor * 100)}%`,
        performanceTrend: item.performanceTrend,
        minutesTrend: item.minutesTrend,
      }));

      // Cache result
      await cache.set(cacheKey, formattedHotPlayers, CACHE_DURATIONS.CONSISTENCY_SCORES);

      return formattedHotPlayers;
    } catch (error) {
      logger.error('Get hot players failed:', error);
      throw new AppError('Failed to retrieve hot players', 500);
    }
  }

  /**
   * Get consistency rankings
   */
  async getConsistencyRankings(query: ConsistencyQueryInput): Promise<ConsistencyRanking[]> {
    try {
      const { days = '14', minGamesPlayed = 5 } = query;
      const limit = 50;

      // Check cache
      const cacheKey = cacheKeys.consistencyRankings(days);
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached as ConsistencyRanking[];
      }

      const columnMap = {
        '7': 'coefficientOfVariation7Days',
        '14': 'coefficientOfVariation14Days',
        '30': 'coefficientOfVariation30Days',
      };

      const gamesPlayedColumn = {
        '7': 'gamesPlayed7Days',
        '14': 'gamesPlayed14Days',
        '30': 'gamesPlayed30Days',
      };

      const consistencyMetrics = await prisma.consistencyMetric.findMany({
        where: {
          [gamesPlayedColumn[days as keyof typeof gamesPlayedColumn]]: {
            gte: minGamesPlayed,
          },
          date: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
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
        orderBy: { [columnMap[days as keyof typeof columnMap]]: 'asc' },
        take: limit,
      });

      const formattedRankings = consistencyMetrics.map((item, index) => ({
        rank: index + 1,
        player: {
          id: item.player.id,
          name: item.player.name,
          team: item.player.team,
          position: item.player.position,
          photoUrl: item.player.photoUrl,
          injuryStatus: (item.player.injuries[0]?.status || 'HEALTHY') as InjuryStatus,
        },
        consistencyGrade: item.consistencyGrade,
        coefficientOfVariation: item[columnMap[days as keyof typeof columnMap] as keyof typeof item] as number,
        gamesPlayed: item[gamesPlayedColumn[days as keyof typeof gamesPlayedColumn] as keyof typeof item] as number,
      }));

      // Cache result
      await cache.set(cacheKey, formattedRankings, CACHE_DURATIONS.CONSISTENCY_SCORES);

      return formattedRankings;
    } catch (error) {
      logger.error('Get consistency rankings failed:', error);
      throw new AppError('Failed to retrieve consistency rankings', 500);
    }
  }
}

export const playerService = new PlayerService();