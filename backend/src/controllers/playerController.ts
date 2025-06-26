import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { playerService } from '../services/playerService';
import { optionalAuth, authenticate, requirePro, AuthRequest } from '../middleware/auth';
import { validateQuery, validateParams } from '../middleware/validation';
import { trackUsage } from '../middleware/rateLimit';
import { 
  playerFilterSchema, 
  paginationSchema, 
  statsQuerySchema,
  consistencyQuerySchema,
  hotPlayerQuerySchema 
} from '@shared/schemas';
import { Position } from '@shared/types';


export class PlayerController {
  /**
   * Get all players with filters and pagination
   */
  async getPlayers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = req.query as any;
      const userId = req.user?.id;

      const result = await playerService.getPlayers(filters, userId);

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single player details
   */
  async getPlayerById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { playerId } = req.params;

      const player = await playerService.getPlayerById(playerId);

      res.json({
        success: true,
        data: player,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get player stats
   */
  async getPlayerStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { playerId } = req.params;
      const query = req.query as any;

      const stats = await playerService.getPlayerStats(playerId, query);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get fantasy rankings
   */
  async getFantasyRankings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { scoringConfigId, position, limit = 50 } = req.query as any;
      const userId = req.user?.id;

      const rankings = await playerService.getFantasyRankings(
        scoringConfigId,
        position as Position,
        Number(limit),
        userId
      );

      res.json({
        success: true,
        data: rankings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get hot players (Pro tier required)
   */
  async getHotPlayers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await trackUsage(req, res, 'hot_players');

      const query = req.query as any;
      const hotPlayers = await playerService.getHotPlayers(query);

      res.json({
        success: true,
        data: hotPlayers,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get consistency rankings (Pro tier required)
   */
  async getConsistencyRankings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await trackUsage(req, res, 'consistency_rankings');

      const query = req.query as any;
      const rankings = await playerService.getConsistencyRankings(query);

      res.json({
        success: true,
        data: rankings,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const playerController = new PlayerController();

// Route handlers with validation middleware
export const playerRoutes = {
  getPlayers: [
    optionalAuth,
    validateQuery(playerFilterSchema.merge(paginationSchema)),
    playerController.getPlayers.bind(playerController),
  ],

  getPlayerById: [
    optionalAuth,
    validateParams(z.object({ playerId: z.string() })),
    playerController.getPlayerById.bind(playerController),
  ],

  getPlayerStats: [
    optionalAuth,
    validateParams(z.object({ playerId: z.string() })),
    validateQuery(statsQuerySchema),
    playerController.getPlayerStats.bind(playerController),
  ],

  getFantasyRankings: [
    optionalAuth,
    validateQuery(z.object({
      scoringConfigId: z.string().optional(),
      position: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    })),
    playerController.getFantasyRankings.bind(playerController),
  ],

  getHotPlayers: [
    authenticate,
    requirePro,
    validateQuery(hotPlayerQuerySchema),
    playerController.getHotPlayers.bind(playerController),
  ],

  getConsistencyRankings: [
    authenticate,
    requirePro,
    validateQuery(consistencyQuerySchema),
    playerController.getConsistencyRankings.bind(playerController),
  ],
};