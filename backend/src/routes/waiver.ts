import { Router } from 'express';
import { prisma } from '../config/database';
import { requireProPlus } from '../middleware/auth';
import { validateQuery } from '../middleware/validation';
import { trackUsage } from '../middleware/rateLimit';
import { waiverQuerySchema } from '@shared/schemas';
import { WAIVER_WIRE_CONFIG, CACHE_DURATIONS } from '@shared/constants';
import { cache, cacheKeys } from '../config/redis';

const router = Router();

// Get daily waiver recommendations (Pro+ tier)
router.get(
  '/daily-recommendations',
  requireProPlus,
  validateQuery(waiverQuerySchema),
  async (req, res, next) => {
    try {
      await trackUsage(req, res, 'daily_recommendations');
      
      const { 
        excludeTopN = WAIVER_WIRE_CONFIG.DEFAULT_EXCLUDE_TOP_N,
        date = new Date().toISOString().split('T')[0]
      } = req.query as any;
      
      // Check cache
      const cacheKey = cacheKeys.dailyRecommendations(date, excludeTopN);
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached });
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
        // Generate recommendations on-demand if not available
        // This would normally be done by the daily job
        return res.json({
          success: true,
          data: {
            recommendations: [],
            date,
            gamesCount: 0,
            message: 'No recommendations available for this date. Check back later.',
          },
        });
      }
      
      // Get games count for the date
      const gamesCount = await prisma.game.count({
        where: {
          date: {
            gte: new Date(date),
            lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });
      
      const formattedRecommendations = recommendations.map(rec => ({
        rank: rec.rank,
        player: {
          id: rec.player.id,
          name: rec.player.name,
          team: rec.player.team,
          position: rec.player.position,
          photoUrl: rec.player.photoUrl,
          injuryStatus: rec.player.injuries[0]?.status || 'HEALTHY',
        },
        opponent: rec.opponentTeam,
        recommendationScore: rec.recommendationScore,
        projectedFantasyPoints: rec.projectedFantasyPoints,
        hotFactor: rec.hotFactor,
        minutesTrend: rec.minutesTrend,
        matchupFavorability: rec.matchupFavorability,
        reasoning: rec.reasoning,
      }));
      
      const result = {
        recommendations: formattedRecommendations,
        date,
        gamesCount,
      };
      
      // Cache for 1 hour
      await cache.set(cacheKey, result, CACHE_DURATIONS.DAILY_RECOMMENDATIONS);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get waiver wire trends
router.get(
  '/trends',
  requireProPlus,
  async (req, res, next) => {
    try {
      const { days = 7, limit = 20 } = req.query;
      
      // Check cache
      const cacheKey = cacheKeys.waiverTrends(Number(days));
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached });
      }
      
      // Get recent waiver recommendations
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Number(days));
      
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
      const playerAppearances = new Map<string, { count: number; avgRank: number; scores: number[] }>();
      
      recommendations.forEach(rec => {
        const current = playerAppearances.get(rec.playerId) || { count: 0, avgRank: 0, scores: [] };
        current.count++;
        current.scores.push(rec.recommendationScore);
        playerAppearances.set(rec.playerId, current);
      });
      
      // Calculate averages and trends
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
              pickupRate: (data.count / Number(days)) * 100,
              trend,
            };
          })
      );
      
      // Sort by pickup rate
      trends.sort((a, b) => b.pickupRate - a.pickupRate);
      
      const result = {
        trending: trends.slice(0, Number(limit)),
      };
      
      // Cache for 30 minutes
      await cache.set(cacheKey, result, 30 * 60);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get available players for a date
router.get(
  '/available',
  requireProPlus,
  async (req, res, next) => {
    try {
      const { 
        date = new Date().toISOString().split('T')[0],
        excludeTopN = 50,
        includeInjured = false,
      } = req.query;
      
      // Get games for the date
      const games = await prisma.game.findMany({
        where: {
          date: {
            gte: new Date(date as string),
            lt: new Date(new Date(date as string).getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });
      
      const teamsPlaying = new Set<string>();
      games.forEach(game => {
        teamsPlaying.add(game.homeTeam);
        teamsPlaying.add(game.awayTeam);
      });
      
      // Get fantasy rankings to exclude top players
      const topPlayerIds = await prisma.playerFantasyScore.findMany({
        where: {
          scoringConfig: { isDefault: true },
        },
        orderBy: { seasonAverage: 'desc' },
        take: Number(excludeTopN),
        select: { playerId: true },
      });
      
      const excludeIds = topPlayerIds.map(p => p.playerId);
      
      // Get available players
      const where: any = {
        team: { in: Array.from(teamsPlaying) },
        id: { notIn: excludeIds },
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
      
      // Calculate projected points and ownership
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
          ownership: Math.random() * 30, // Mock ownership percentage
        };
      });
      
      // Sort by projected points
      playersWithProjections.sort((a, b) => b.projectedPoints - a.projectedPoints);
      
      res.json({
        success: true,
        data: {
          players: playersWithProjections,
          total: playersWithProjections.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get matchup analysis
router.get(
  '/matchup/:playerId',
  requireProPlus,
  async (req, res, next) => {
    try {
      const { playerId } = req.params;
      const { date = new Date().toISOString().split('T')[0] } = req.query;
      
      // Get player
      const player = await prisma.player.findUnique({
        where: { id: playerId },
      });
      
      if (!player) {
        return res.status(404).json({
          success: false,
          error: { code: 404, message: 'Player not found' },
        });
      }
      
      // Get game for the date
      const game = await prisma.game.findFirst({
        where: {
          date: {
            gte: new Date(date as string),
            lt: new Date(new Date(date as string).getTime() + 24 * 60 * 60 * 1000),
          },
          OR: [
            { homeTeam: player.team },
            { awayTeam: player.team },
          ],
        },
      });
      
      if (!game) {
        return res.json({
          success: true,
          data: {
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
          },
        });
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
      
      res.json({
        success: true,
        data: {
          playerId,
          opponent,
          matchupFavorability,
          opponentDefensiveRating,
          leagueAverageDefensiveRating,
          historicalPerformance,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;