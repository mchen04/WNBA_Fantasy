import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { tradeService } from '../services/tradeService';
import { requirePro, authenticate, AuthRequest } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validation';
import { trackUsage } from '../middleware/rateLimit';
import { tradeAnalysisSchema } from '@shared/schemas';


export class TradeController {
  /**
   * Analyze trade proposal
   */
  async analyzeTrade(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await trackUsage(req, res, 'trade_calculator');
      
      const userId = req.user!.id;
      const userSubscriptionTier = req.user!.subscriptionTier as any;
      const tradeData = req.body;

      const analysis = await tradeService.analyzeTrade(tradeData, userId, userSubscriptionTier);

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get trade history
   */
  async getTradeHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { limit = 20, offset = 0 } = req.query;

      const result = await tradeService.getTradeHistory(
        userId,
        Number(limit),
        Number(offset)
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Save trade analysis
   */
  async saveTradeAnalysis(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const analysisData = req.body;

      const saved = await tradeService.saveTradeAnalysis({
        ...analysisData,
        userId,
      });

      res.json({
        success: true,
        data: saved,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete trade analysis
   */
  async deleteTradeAnalysis(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { tradeId } = req.params;

      await tradeService.deleteTradeAnalysis(tradeId, userId);

      res.json({
        success: true,
        message: 'Trade analysis deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get waiver wire value
   */
  async getWaiverWireValue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { excludeTopN = 50, scoringConfigId } = req.query;

      const waiverValue = await tradeService.getWaiverWireValue(
        scoringConfigId as string,
        Number(excludeTopN)
      );

      res.json({
        success: true,
        data: waiverValue,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Compare multiple players
   */
  async comparePlayers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { playerIds, scoringConfigId } = req.body;

      if (!playerIds || !Array.isArray(playerIds) || playerIds.length < 2) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'At least 2 player IDs are required for comparison',
          },
        });
        return;
      }

      // Use the trade service to get detailed player data
      const analysis = await tradeService.analyzeTrade(
        {
          playerIdsIn: playerIds.slice(0, Math.ceil(playerIds.length / 2)),
          playerIdsOut: playerIds.slice(Math.ceil(playerIds.length / 2)),
          scoringConfigId,
        },
        req.user!.id,
        req.user!.subscriptionTier as any
      );

      // Extract and format player comparison data
      const allPlayers = [...analysis.playersIn, ...analysis.playersOut];
      
      const comparison = allPlayers.map(player => ({
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        photoUrl: player.photoUrl,
        injuryStatus: player.injuryStatus,
        fantasyScore: player.fantasyScore,
        consistency: player.consistency,
        trending: player.trending,
        healthScore: player.healthScore,
        calculatedValue: player.calculatedValue,
      }));

      // Sort by calculated value
      comparison.sort((a, b) => b.calculatedValue - a.calculatedValue);

      res.json({
        success: true,
        data: {
          players: comparison,
          comparisonDate: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get trade recommendations based on team roster
   */
  async getTradeRecommendations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { teamPlayerIds, targetPositions, excludePlayerIds } = req.body;

      // This would be a more complex implementation
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          recommendations: [],
          message: 'Trade recommendations feature coming soon',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const tradeController = new TradeController();

// Route handlers with validation middleware
export const tradeRoutes = {
  analyzeTrade: [
    authenticate,
    requirePro,
    validateBody(tradeAnalysisSchema),
    tradeController.analyzeTrade.bind(tradeController),
  ],

  getTradeHistory: [
    authenticate,
    requirePro,
    validateQuery(z.object({
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    })),
    tradeController.getTradeHistory.bind(tradeController),
  ],

  saveTradeAnalysis: [
    authenticate,
    requirePro,
    validateBody(z.object({
      playerIdsIn: z.array(z.string()),
      playerIdsOut: z.array(z.string()),
      netValue: z.number(),
      recommendation: z.enum(['ACCEPT', 'DECLINE', 'NEUTRAL']),
      confidence: z.number().min(0).max(1),
      valueIn: z.number(),
      valueOut: z.number(),
      slotValue: z.number(),
      slotDifference: z.number(),
      notes: z.string().optional(),
    })),
    tradeController.saveTradeAnalysis.bind(tradeController),
  ],

  deleteTradeAnalysis: [
    authenticate,
    requirePro,
    tradeController.deleteTradeAnalysis.bind(tradeController),
  ],

  getWaiverWireValue: [
    authenticate,
    requirePro,
    validateQuery(z.object({
      excludeTopN: z.number().int().min(0).max(200).default(50),
      scoringConfigId: z.string().optional(),
    })),
    tradeController.getWaiverWireValue.bind(tradeController),
  ],

  comparePlayers: [
    authenticate,
    requirePro,
    validateBody(z.object({
      playerIds: z.array(z.string()).min(2).max(10),
      scoringConfigId: z.string().optional(),
    })),
    tradeController.comparePlayers.bind(tradeController),
  ],

  getTradeRecommendations: [
    authenticate,
    requirePro,
    validateBody(z.object({
      teamPlayerIds: z.array(z.string()),
      targetPositions: z.array(z.string()).optional(),
      excludePlayerIds: z.array(z.string()).optional(),
    })),
    tradeController.getTradeRecommendations.bind(tradeController),
  ],
};