import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { waiverService } from '../services/waiverService';
import { requireProPlus, authenticate, AuthRequest } from '../middleware/auth';
import { validateQuery, validateParams, validateBody } from '../middleware/validation';
import { trackUsage } from '../middleware/rateLimit';
import { waiverQuerySchema } from '@shared/schemas';
import { Position } from '@shared/types';

export class WaiverController {
  /**
   * Get daily waiver recommendations
   */
  async getDailyRecommendations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await trackUsage(req, res, 'daily_recommendations');

      const userId = req.user!.id;
      const query = req.query as any;

      const recommendations = await waiverService.getDailyRecommendations(query, userId);

      res.json({
        success: true,
        data: recommendations,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get waiver wire trends
   */
  async getWaiverTrends(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { days = 7, limit = 20 } = req.query;

      const trends = await waiverService.getWaiverTrends(Number(days), Number(limit));

      res.json({
        success: true,
        data: trends,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get available players for a date
   */
  async getAvailablePlayers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { 
        date = new Date().toISOString().split('T')[0],
        excludeTopN = 50,
        includeInjured = false,
      } = req.query;

      const availablePlayers = await waiverService.getAvailablePlayers(
        date as string,
        Number(excludeTopN),
        Boolean(includeInjured)
      );

      res.json({
        success: true,
        data: availablePlayers,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get matchup analysis for a player
   */
  async getMatchupAnalysis(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { playerId } = req.params;
      const { date = new Date().toISOString().split('T')[0] } = req.query;

      const analysis = await waiverService.getMatchupAnalysis(playerId, date as string);

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search available players
   */
  async searchAvailablePlayers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { 
        searchTerm,
        position,
        team,
        excludeTopN = 50,
        minProjectedPoints = 0 
      } = req.query;

      if (!searchTerm || typeof searchTerm !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Search term is required',
          },
        });
        return;
      }

      const players = await waiverService.searchAvailablePlayers(searchTerm, {
        position: position as Position,
        team: team as string,
        excludeTopN: Number(excludeTopN),
        minProjectedPoints: Number(minProjectedPoints),
      });

      res.json({
        success: true,
        data: {
          players,
          searchTerm,
          total: players.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get player performance trend
   */
  async getPlayerPerformanceTrend(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { playerId } = req.params;
      const { days = 7 } = req.query;

      const trend = await waiverService.getPlayerPerformanceTrend(playerId, Number(days));

      res.json({
        success: true,
        data: trend,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate recommendations for a specific date (admin/system use)
   */
  async generateRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { date } = req.body;

      if (!date) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Date is required',
          },
        });
        return;
      }

      const recommendations = await waiverService.generateRecommendations(date);

      res.json({
        success: true,
        data: {
          recommendations,
          date,
          generated: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get waiver wire insights
   */
  async getWaiverInsights(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { days = 7 } = req.query;

      // Get multiple data points for insights
      const [trends, todayPlayers] = await Promise.all([
        waiverService.getWaiverTrends(Number(days), 10),
        waiverService.getAvailablePlayers(
          new Date().toISOString().split('T')[0],
          50,
          false
        ),
      ]);

      const insights = {
        trendingUp: trends.trending.filter(p => p.trend === 'rising').length,
        trendingDown: trends.trending.filter(p => p.trend === 'falling').length,
        playersPlaying: todayPlayers.total,
        topPickups: trends.trending.slice(0, 5),
        period: `Last ${days} days`,
      };

      res.json({
        success: true,
        data: insights,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get personalized waiver suggestions based on user's team
   */
  async getPersonalizedSuggestions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { 
        teamPlayerIds,
        needsPositions,
        riskTolerance = 'medium'
      } = req.body;

      // This would be a more complex implementation that analyzes
      // the user's current team and suggests complementary players
      
      // For now, return a placeholder response
      res.json({
        success: true,
        data: {
          suggestions: [],
          message: 'Personalized suggestions feature coming soon',
          analysis: {
            teamStrengths: [],
            teamWeaknesses: [],
            suggestedPositions: needsPositions || [],
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const waiverController = new WaiverController();

// Route handlers with validation middleware
export const waiverRoutes = {
  getDailyRecommendations: [
    authenticate,
    requireProPlus,
    validateQuery(waiverQuerySchema),
    waiverController.getDailyRecommendations.bind(waiverController),
  ],

  getWaiverTrends: [
    authenticate,
    requireProPlus,
    validateQuery(z.object({
      days: z.number().int().min(1).max(30).default(7),
      limit: z.number().int().min(1).max(50).default(20),
    })),
    waiverController.getWaiverTrends.bind(waiverController),
  ],

  getAvailablePlayers: [
    authenticate,
    requireProPlus,
    validateQuery(z.object({
      date: z.string().optional(),
      excludeTopN: z.number().int().min(0).max(200).default(50),
      includeInjured: z.boolean().default(false),
    })),
    waiverController.getAvailablePlayers.bind(waiverController),
  ],

  getMatchupAnalysis: [
    authenticate,
    requireProPlus,
    validateParams(z.object({ playerId: z.string() })),
    validateQuery(z.object({
      date: z.string().optional(),
    })),
    waiverController.getMatchupAnalysis.bind(waiverController),
  ],

  searchAvailablePlayers: [
    authenticate,
    requireProPlus,
    validateQuery(z.object({
      searchTerm: z.string().min(1),
      position: z.string().optional(),
      team: z.string().optional(),
      excludeTopN: z.number().int().min(0).max(200).default(50),
      minProjectedPoints: z.number().min(0).default(0),
    })),
    waiverController.searchAvailablePlayers.bind(waiverController),
  ],

  getPlayerPerformanceTrend: [
    authenticate,
    requireProPlus,
    validateParams(z.object({ playerId: z.string() })),
    validateQuery(z.object({
      days: z.number().int().min(1).max(30).default(7),
    })),
    waiverController.getPlayerPerformanceTrend.bind(waiverController),
  ],

  generateRecommendations: [
    // Note: This would typically require admin authentication
    validateBody(z.object({
      date: z.string(),
    })),
    waiverController.generateRecommendations.bind(waiverController),
  ],

  getWaiverInsights: [
    authenticate,
    requireProPlus,
    validateQuery(z.object({
      days: z.number().int().min(1).max(30).default(7),
    })),
    waiverController.getWaiverInsights.bind(waiverController),
  ],

  getPersonalizedSuggestions: [
    authenticate,
    requireProPlus,
    validateBody(z.object({
      teamPlayerIds: z.array(z.string()),
      needsPositions: z.array(z.string()).optional(),
      riskTolerance: z.enum(['low', 'medium', 'high']).default('medium'),
    })),
    waiverController.getPersonalizedSuggestions.bind(waiverController),
  ],
};