import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { cache, cacheKeys } from '../config/redis';
import { authenticate, optionalAuth, requirePro, requireProPlus } from '../middleware/auth';
import { validateQuery, validateParams } from '../middleware/validation';
import { trackUsage } from '../middleware/rateLimit';
import { AppError } from '../middleware/error';
import { 
  playerFilterSchema, 
  paginationSchema, 
  statsQuerySchema,
  consistencyQuerySchema,
  hotPlayerQuerySchema 
} from '@shared/schemas';
import { CACHE_DURATIONS } from '@shared/constants';
import { calculateFantasyScore, calculateStandardDeviation, gradeConsistency } from '@shared/utils';

const router = Router();

// Get all players with filters
router.get(
  '/',
  optionalAuth,
  validateQuery(playerFilterSchema.merge(paginationSchema)),
  async (req, res, next) => {
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
      } = req.query as any;
      
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
      
      // Get players with latest stats
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
      const playersWithStats = players.map((player: any) => {
        const recentStats = player.stats;
        const gamesPlayed = recentStats.length;
        
        if (gamesPlayed === 0) {
          return {
            ...player,
            stats: undefined,
            gamesPlayed: 0,
            averageFantasyPoints: 0,
          };
        }
        
        // Calculate averages
        const totals = recentStats.reduce((acc: any, stat: any) => ({
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
          injuryStatus: player.injuries[0]?.status || 'HEALTHY',
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
      
      res.json({
        success: true,
        data: playersWithStats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get single player details
router.get(
  '/:playerId',
  optionalAuth,
  validateParams(z.object({ playerId: z.string() })),
  async (req, res, next) => {
    try {
      const { playerId } = req.params;
      
      // Check cache
      const cacheKey = cacheKeys.player(playerId);
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached });
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
          },
        },
      });
      
      if (!player) {
        throw new AppError('Player not found', 404);
      }
      
      // Cache result
      await cache.set(cacheKey, player, CACHE_DURATIONS.PLAYER_INFO);
      
      res.json({
        success: true,
        data: player,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get player stats
router.get(
  '/:playerId/stats',
  optionalAuth,
  validateParams(z.object({ playerId: z.string() })),
  validateQuery(statsQuerySchema),
  async (req, res, next) => {
    try {
      const { playerId } = req.params;
      const { dateRange, aggregation = 'game' } = req.query as any;
      
      // Build where clause
      const where: any = { playerId };
      if (dateRange) {
        where.date = {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
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
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get fantasy rankings
router.get(
  '/rankings',
  optionalAuth,
  validateQuery(z.object({
    scoringConfigId: z.string().optional(),
    position: z.string().optional(),
    limit: z.number().int().min(1).max(200).default(50),
  })),
  async (req, res, next) => {
    try {
      const { scoringConfigId, position, limit } = req.query as any;
      const user = (req as any).user;
      
      // Get default scoring config if not specified
      let configId = scoringConfigId;
      if (!configId && user) {
        const defaultConfig = await prisma.scoringConfiguration.findFirst({
          where: {
            userId: user.id,
            isDefault: true,
          },
        });
        configId = defaultConfig?.id;
      }
      
      // Check cache
      const cacheKey = cacheKeys.fantasyRankings(configId || 'default', position);
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached });
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
          injuryStatus: item.player.injuries[0]?.status || 'HEALTHY',
        },
        seasonAverage: item.seasonAverage,
        last7DaysAverage: item.last7DaysAverage,
        last14DaysAverage: item.last14DaysAverage,
        last30DaysAverage: item.last30DaysAverage,
      }));
      
      // Cache result
      await cache.set(cacheKey, formattedRankings, CACHE_DURATIONS.FANTASY_RANKINGS);
      
      res.json({
        success: true,
        data: formattedRankings,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get hot players (Pro tier)
router.get(
  '/hot',
  authenticate,
  requirePro,
  validateQuery(hotPlayerQuerySchema),
  async (req, res, next) => {
    try {
      await trackUsage(req, res, 'hot_players');
      
      const { days = '7', minImprovement = 0.15, limit = 20 } = req.query as any;
      
      // Check cache
      const cacheKey = cacheKeys.hotPlayers(days);
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached });
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
          injuryStatus: item.player.injuries[0]?.status || 'HEALTHY',
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
      
      res.json({
        success: true,
        data: formattedHotPlayers,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get consistency rankings (Pro tier)
router.get(
  '/consistency-rankings',
  authenticate,
  requirePro,
  validateQuery(consistencyQuerySchema),
  async (req, res, next) => {
    try {
      await trackUsage(req, res, 'consistency_rankings');
      
      const { days = '14', minGamesPlayed = 5, limit = 50 } = req.query as any;
      
      // Check cache
      const cacheKey = cacheKeys.consistencyRankings(days);
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached });
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
          injuryStatus: item.player.injuries[0]?.status || 'HEALTHY',
        },
        consistencyGrade: item.consistencyGrade,
        coefficientOfVariation: item[columnMap[days as keyof typeof columnMap] as keyof typeof item],
        gamesPlayed: item[gamesPlayedColumn[days as keyof typeof gamesPlayedColumn] as keyof typeof item],
      }));
      
      // Cache result
      await cache.set(cacheKey, formattedRankings, CACHE_DURATIONS.CONSISTENCY_SCORES);
      
      res.json({
        success: true,
        data: formattedRankings,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;