import { Router } from 'express';
import { prisma } from '../config/database';
import { requirePro } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { trackUsage } from '../middleware/rateLimit';
import { AppError } from '../middleware/error';
import { tradeAnalysisSchema } from '@shared/schemas';
import { SUBSCRIPTION_PLANS, TRADE_VALUE_WEIGHTS } from '@shared/constants';
import { calculateCompositePlayerValue, calculateWaiverWireValue } from '@shared/utils';
import { cache, cacheKeys } from '../config/redis';

const router = Router();

// Analyze trade (Pro tier)
router.post(
  '/analyze',
  requirePro,
  validateBody(tradeAnalysisSchema),
  async (req, res, next) => {
    try {
      await trackUsage(req, res, 'trade_calculator');
      const user = (req as any).user;
      const { playerIdsIn, playerIdsOut, scoringConfigId } = req.body;
      
      // Check usage limits
      const usage = await prisma.usageTracking.findFirst({
        where: {
          userId: user.id,
          feature: 'trade_calculator',
          period: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      });
      
      const limit = SUBSCRIPTION_PLANS[user.subscriptionTier].limits.tradeCalculations;
      if (limit !== -1 && usage && usage.count >= limit) {
        throw new AppError(
          `You have reached your monthly limit of ${limit} trade calculations`,
          403
        );
      }
      
      // Get players
      const playersIn = await prisma.player.findMany({
        where: { id: { in: playerIdsIn } },
        include: {
          fantasyScores: {
            where: scoringConfigId ? { scoringConfigId } : { scoringConfig: { isDefault: true } },
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
      
      const playersOut = await prisma.player.findMany({
        where: { id: { in: playerIdsOut } },
        include: {
          fantasyScores: {
            where: scoringConfigId ? { scoringConfigId } : { scoringConfig: { isDefault: true } },
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
      
      // Calculate values
      const calculatePlayerValue = (player: any) => {
        const fantasyScore = player.fantasyScores[0];
        const consistency = player.consistencyMetrics[0];
        const trend = player.trendingAnalyses[0];
        const injury = player.injuries[0];
        
        const healthScore = injury?.status === 'OUT' ? 0 : 
                          injury?.status === 'DOUBTFUL' ? 0.25 :
                          injury?.status === 'QUESTIONABLE' ? 0.75 : 1;
        
        return calculateCompositePlayerValue(
          fantasyScore?.seasonAverage || 0,
          consistency?.coefficientOfVariation14Days || 0.5,
          trend?.performanceTrendValue || 0,
          healthScore
        );
      };
      
      const valueIn = playersIn.reduce((sum, p) => sum + calculatePlayerValue(p), 0);
      const valueOut = playersOut.reduce((sum, p) => sum + calculatePlayerValue(p), 0);
      
      // Calculate roster slot value
      const slotDifference = playerIdsOut.length - playerIdsIn.length;
      let slotValue = 0;
      
      if (slotDifference !== 0) {
        // Get waiver wire value
        const waiverPlayers = await prisma.playerFantasyScore.findMany({
          where: {
            scoringConfig: scoringConfigId ? { id: scoringConfigId } : { isDefault: true },
          },
          orderBy: { seasonAverage: 'desc' },
          skip: 50, // Exclude top 50
          take: 10,
          select: { seasonAverage: true },
        });
        
        const avgWaiverValue = calculateWaiverWireValue(
          waiverPlayers.map(p => ({ fantasyPointsAvg: p.seasonAverage || 0 }))
        );
        
        slotValue = avgWaiverValue * slotDifference * TRADE_VALUE_WEIGHTS.fantasyPoints;
      }
      
      const netValue = valueIn - valueOut + slotValue;
      const confidence = Math.min(0.95, Math.abs(netValue) / 100);
      
      const analysis = {
        playersIn,
        playersOut,
        netValue,
        recommendation: netValue > 5 ? 'ACCEPT' : netValue < -5 ? 'DECLINE' : 'NEUTRAL',
        confidence,
        details: {
          valueIn,
          valueOut,
          slotValue,
          slotDifference,
        },
      };
      
      // Save analysis
      await prisma.tradeAnalysis.create({
        data: {
          userId: user.id,
          playerIdsIn,
          playerIdsOut,
          netValue,
          recommendation: analysis.recommendation,
          confidence,
          valueIn,
          valueOut,
          slotValue,
          slotDifference,
        },
      });
      
      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get trade history
router.get(
  '/history',
  requirePro,
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { limit = 20, offset = 0 } = req.query;
      
      const [trades, total] = await Promise.all([
        prisma.tradeAnalysis.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: Number(limit),
          skip: Number(offset),
        }),
        prisma.tradeAnalysis.count({
          where: { userId: user.id },
        }),
      ]);
      
      res.json({
        success: true,
        data: {
          trades,
          total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Save trade
router.post(
  '/save',
  requirePro,
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const analysis = req.body;
      
      const saved = await prisma.tradeAnalysis.create({
        data: {
          userId: user.id,
          ...analysis,
          saved: true,
        },
      });
      
      res.json({
        success: true,
        data: saved,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get waiver wire value
router.get(
  '/waiver-value',
  requirePro,
  async (req, res, next) => {
    try {
      const { excludeTopN = 50 } = req.query;
      
      // Check cache
      const cacheKey = `waiver-value:${excludeTopN}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached });
      }
      
      const topWaiverPlayers = await prisma.playerFantasyScore.findMany({
        where: {
          scoringConfig: { isDefault: true },
        },
        orderBy: { seasonAverage: 'desc' },
        skip: Number(excludeTopN),
        take: 10,
        include: {
          player: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      
      const averageValue = calculateWaiverWireValue(
        topWaiverPlayers.map(p => ({ fantasyPointsAvg: p.seasonAverage || 0 }))
      );
      
      const result = {
        averageValue,
        topPlayers: topWaiverPlayers.map(p => ({
          playerId: p.player.id,
          name: p.player.name,
          fantasyPointsAvg: p.seasonAverage || 0,
        })),
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

export default router;