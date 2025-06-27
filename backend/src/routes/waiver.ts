import { Router } from 'express';
import { prisma } from '../config/database';
import { requireProPlus } from '../middleware/auth';
import { validateQuery } from '../middleware/validation';
import { trackUsage } from '../middleware/rateLimit';
import { waiverQuerySchema } from '@shared/schemas';
import { WAIVER_WIRE_CONFIG, CACHE_DURATIONS } from '@shared/constants';
import { cache, cacheKeys } from '../config/redis';
import { waiverService } from '../services/waiverService';

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
      
      // Use the enhanced matchup analysis from waiverService
      const matchupAnalysis = await waiverService.getMatchupAnalysis(playerId, date as string);
      
      res.json({
        success: true,
        data: matchupAnalysis,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get team defensive metrics (Pro+ feature)
router.get(
  '/team-defense/:teamName',
  requireProPlus,
  async (req, res, next) => {
    try {
      const { teamName } = req.params;
      const { days = 30 } = req.query;
      
      const metrics = await waiverService.getTeamDefensiveMetrics(teamName, Number(days));
      
      res.json({
        success: true,
        data: {
          team: teamName,
          period: `Last ${days} days`,
          metrics,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get advanced player recommendations with custom weights (Pro+ feature)
router.post(
  '/advanced-recommendations',
  requireProPlus,
  async (req, res, next) => {
    try {
      await trackUsage(req, res, 'advanced_recommendations');
      
      const {
        date = new Date().toISOString().split('T')[0],
        excludeTopN = 50,
        customWeights = {
          projectedPoints: 0.4,
          hotFactor: 0.3,
          minutesTrend: 0.2,
          matchupFavorability: 0.1,
        },
        positions = [],
        teams = [],
        minProjectedPoints = 0,
        maxOwnership = 30,
      } = req.body;
      
      // Generate base recommendations
      const baseRecommendations = await waiverService.generateRecommendations(date, excludeTopN);
      
      // Apply custom filters and weights
      let filteredRecommendations = baseRecommendations;
      
      // Filter by positions if specified
      if (positions.length > 0) {
        filteredRecommendations = filteredRecommendations.filter(rec => 
          positions.includes(rec.player.position)
        );
      }
      
      // Filter by teams if specified
      if (teams.length > 0) {
        filteredRecommendations = filteredRecommendations.filter(rec => 
          teams.includes(rec.player.team)
        );
      }
      
      // Filter by minimum projected points
      if (minProjectedPoints > 0) {
        filteredRecommendations = filteredRecommendations.filter(rec => 
          rec.projectedFantasyPoints >= minProjectedPoints
        );
      }
      
      // Recalculate scores with custom weights
      const enhancedRecommendations = filteredRecommendations.map(rec => {
        const customScore = 
          (rec.projectedFantasyPoints * customWeights.projectedPoints) +
          (rec.hotFactor * customWeights.hotFactor) +
          (rec.minutesTrend * customWeights.minutesTrend) +
          (rec.matchupFavorability * customWeights.matchupFavorability);
        
        return {
          ...rec,
          customRecommendationScore: customScore,
          originalScore: rec.recommendationScore,
        };
      });
      
      // Re-sort by custom score
      enhancedRecommendations.sort((a, b) => b.customRecommendationScore - a.customRecommendationScore);
      
      // Re-rank
      enhancedRecommendations.forEach((rec, index) => {
        rec.rank = index + 1;
      });
      
      res.json({
        success: true,
        data: {
          recommendations: enhancedRecommendations.slice(0, 10),
          filters: {
            date,
            excludeTopN,
            positions,
            teams,
            minProjectedPoints,
            maxOwnership,
          },
          customWeights,
          totalFiltered: enhancedRecommendations.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get waiver wire insights and analytics (Pro+ feature)
router.get(
  '/insights',
  requireProPlus,
  async (req, res, next) => {
    try {
      const { days = 7 } = req.query;
      
      // Check cache
      const cacheKey = `waiver:insights:${days}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached });
      }
      
      // Get multiple data points for insights
      const [trends, todayPlayers, recentRecommendations] = await Promise.all([
        waiverService.getWaiverTrends(Number(days), 10),
        waiverService.getAvailablePlayers(
          new Date().toISOString().split('T')[0],
          50,
          false
        ),
        prisma.waiverRecommendation.findMany({
          where: {
            date: {
              gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000),
            },
          },
          include: {
            player: true,
          },
        }),
      ]);
      
      // Calculate position breakdown
      const positionBreakdown = recentRecommendations.reduce((acc, rec) => {
        const pos = rec.player.position;
        acc[pos] = (acc[pos] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Calculate team breakdown
      const teamBreakdown = recentRecommendations.reduce((acc, rec) => {
        const team = rec.player.team;
        acc[team] = (acc[team] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Calculate average scores
      const avgRecommendationScore = recentRecommendations.length > 0
        ? recentRecommendations.reduce((sum, rec) => sum + rec.recommendationScore, 0) / recentRecommendations.length
        : 0;
      
      const avgProjectedPoints = recentRecommendations.length > 0
        ? recentRecommendations.reduce((sum, rec) => sum + rec.projectedFantasyPoints, 0) / recentRecommendations.length
        : 0;
      
      const insights = {
        summary: {
          trendingUp: trends.trending.filter(p => p.trend === 'rising').length,
          trendingDown: trends.trending.filter(p => p.trend === 'falling').length,
          playersPlayingToday: todayPlayers.total,
          totalRecommendations: recentRecommendations.length,
        },
        analytics: {
          positionBreakdown,
          teamBreakdown,
          averageRecommendationScore: avgRecommendationScore,
          averageProjectedPoints: avgProjectedPoints,
        },
        topPickups: trends.trending.slice(0, 5),
        hotStreaks: recentRecommendations
          .filter(rec => rec.hotFactor > 0.15)
          .sort((a, b) => b.hotFactor - a.hotFactor)
          .slice(0, 5)
          .map(rec => ({
            playerId: rec.player.id,
            name: rec.player.name,
            team: rec.player.team,
            hotFactor: rec.hotFactor,
          })),
        minutesRising: recentRecommendations
          .filter(rec => rec.minutesTrend > 0.1)
          .sort((a, b) => b.minutesTrend - a.minutesTrend)
          .slice(0, 5)
          .map(rec => ({
            playerId: rec.player.id,
            name: rec.player.name,
            team: rec.player.team,
            minutesTrend: rec.minutesTrend,
          })),
        period: `Last ${days} days`,
      };
      
      // Cache for 30 minutes
      await cache.set(cacheKey, insights, 30 * 60);
      
      res.json({
        success: true,
        data: insights,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Generate recommendations on-demand (Pro+ feature, rate limited)
router.post(
  '/generate/:date',
  requireProPlus,
  async (req, res, next) => {
    try {
      await trackUsage(req, res, 'generate_recommendations');
      
      const { date } = req.params;
      const { excludeTopN = 50 } = req.body;
      
      // Rate limit this expensive operation
      const rateLimitKey = `generate_recs:${req.user?.id}:${date}`;
      const existing = await cache.get(rateLimitKey);
      if (existing) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Recommendations already generated for this date. Please wait before generating again.',
          },
        });
      }
      
      const recommendations = await waiverService.generateRecommendations(date, excludeTopN);
      
      // Set rate limit (5 minutes)
      await cache.set(rateLimitKey, true, 5 * 60);
      
      res.json({
        success: true,
        data: {
          date,
          recommendations,
          generated: new Date().toISOString(),
          excludeTopN,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get injury report for waiver wire context (Pro+ feature)
router.get(
  '/injury-report',
  requireProPlus,
  async (req, res, next) => {
    try {
      const injuryReport = await waiverService.getInjuryReport();
      
      res.json({
        success: true,
        data: injuryReport,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;