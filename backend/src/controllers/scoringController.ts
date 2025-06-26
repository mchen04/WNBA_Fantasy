import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { scoringService } from '../services/scoringService';
import { authenticate } from '../middleware/auth';
import { validateBody, validateParams } from '../middleware/validation';
import { scoringConfigSchema } from '@shared/schemas';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    subscriptionTier: string;
  };
}

export class ScoringController {
  /**
   * Get user's scoring configurations
   */
  async getUserScoringConfigurations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const configurations = await scoringService.getUserScoringConfigurations(userId);

      res.json({
        success: true,
        data: configurations,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get default scoring configuration
   */
  async getDefaultScoringConfiguration(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const defaultConfig = await scoringService.getDefaultScoringConfiguration(userId);

      res.json({
        success: true,
        data: defaultConfig,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new scoring configuration
   */
  async createScoringConfiguration(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const userSubscriptionTier = req.user!.subscriptionTier as any;
      const data = req.body;

      // Validate the scoring configuration
      scoringService.validateScoringConfig(data);

      const configuration = await scoringService.createScoringConfiguration(
        { ...data, userId },
        userSubscriptionTier
      );

      res.status(201).json({
        success: true,
        data: configuration,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update scoring configuration
   */
  async updateScoringConfiguration(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { configId } = req.params;
      const data = req.body;

      // Validate the scoring configuration if provided
      if (Object.keys(data).length > 0) {
        // Create a temporary full config for validation by merging with existing
        const existingConfig = await scoringService.getScoringConfigurationById(configId, userId);
        const fullConfig = { ...existingConfig, ...data };
        scoringService.validateScoringConfig(fullConfig);
      }

      const updated = await scoringService.updateScoringConfiguration(configId, userId, data);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete scoring configuration
   */
  async deleteScoringConfiguration(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { configId } = req.params;

      await scoringService.deleteScoringConfiguration(configId, userId);

      res.json({
        success: true,
        message: 'Scoring configuration deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Set default configuration
   */
  async setDefaultConfiguration(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { configId } = req.params;

      const updated = await scoringService.setDefaultConfiguration(configId, userId);

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a specific scoring configuration
   */
  async getScoringConfigurationById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { configId } = req.params;

      const config = await scoringService.getScoringConfigurationById(configId, userId);

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculate fantasy points for given stats
   */
  async calculateFantasyPoints(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { configId, stats } = req.body;

      // Get the scoring configuration
      const config = configId 
        ? await scoringService.getScoringConfigurationById(configId, userId)
        : await scoringService.getDefaultScoringConfiguration(userId);

      const fantasyPoints = scoringService.calculateFantasyPoints(stats, config);

      res.json({
        success: true,
        data: {
          fantasyPoints,
          config: {
            id: config.id,
            name: config.name,
          },
          stats,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const scoringController = new ScoringController();

// Route handlers with validation middleware
export const scoringRoutes = {
  getUserScoringConfigurations: [
    authenticate,
    scoringController.getUserScoringConfigurations.bind(scoringController),
  ],

  getDefaultScoringConfiguration: [
    authenticate,
    scoringController.getDefaultScoringConfiguration.bind(scoringController),
  ],

  createScoringConfiguration: [
    authenticate,
    validateBody(scoringConfigSchema),
    scoringController.createScoringConfiguration.bind(scoringController),
  ],

  updateScoringConfiguration: [
    authenticate,
    validateParams(z.object({ configId: z.string() })),
    validateBody(scoringConfigSchema.partial()),
    scoringController.updateScoringConfiguration.bind(scoringController),
  ],

  deleteScoringConfiguration: [
    authenticate,
    validateParams(z.object({ configId: z.string() })),
    scoringController.deleteScoringConfiguration.bind(scoringController),
  ],

  setDefaultConfiguration: [
    authenticate,
    validateParams(z.object({ configId: z.string() })),
    scoringController.setDefaultConfiguration.bind(scoringController),
  ],

  getScoringConfigurationById: [
    authenticate,
    validateParams(z.object({ configId: z.string() })),
    scoringController.getScoringConfigurationById.bind(scoringController),
  ],

  calculateFantasyPoints: [
    authenticate,
    validateBody(z.object({
      configId: z.string().optional(),
      stats: z.object({
        points: z.number().min(0),
        rebounds: z.number().min(0),
        assists: z.number().min(0),
        steals: z.number().min(0),
        blocks: z.number().min(0),
        threePointersMade: z.number().min(0),
        turnovers: z.number().min(0),
      }),
    })),
    scoringController.calculateFantasyPoints.bind(scoringController),
  ],
};