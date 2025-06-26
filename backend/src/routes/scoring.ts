import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { validateBody, validateParams } from '../middleware/validation';
import { AppError } from '../middleware/error';
import { scoringConfigSchema } from '@shared/schemas';
import { SUBSCRIPTION_PLANS } from '@shared/constants';

const router = Router();

// Get user's scoring configurations
router.get('/', async (req, res, next) => {
  try {
    const user = (req as any).user;
    
    const configurations = await prisma.scoringConfiguration.findMany({
      where: { userId: user.id },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });
    
    res.json({
      success: true,
      data: configurations,
    });
  } catch (error) {
    next(error);
  }
});

// Get default scoring configuration
router.get('/default', async (req, res, next) => {
  try {
    const user = (req as any).user;
    
    const defaultConfig = await prisma.scoringConfiguration.findFirst({
      where: {
        userId: user.id,
        isDefault: true,
      },
    });
    
    if (!defaultConfig) {
      // Create default configuration
      const newDefault = await prisma.scoringConfiguration.create({
        data: {
          userId: user.id,
          name: 'Default Configuration',
          isDefault: true,
          pointsMultiplier: 1,
          reboundsMultiplier: 1,
          assistsMultiplier: 1,
          stealsMultiplier: 2,
          blocksMultiplier: 2,
          threePointersMultiplier: 1,
          turnoversMultiplier: -1,
        },
      });
      
      return res.json({
        success: true,
        data: newDefault,
      });
    }
    
    res.json({
      success: true,
      data: defaultConfig,
    });
  } catch (error) {
    next(error);
  }
});

// Create new scoring configuration
router.post(
  '/',
  validateBody(scoringConfigSchema),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const data = req.body;
      
      // Check configuration limit
      const configCount = await prisma.scoringConfiguration.count({
        where: { userId: user.id },
      });
      
      const limit = SUBSCRIPTION_PLANS[user.subscriptionTier].limits.customScoringConfigs;
      if (limit !== -1 && configCount >= limit) {
        throw new AppError(
          `You have reached the limit of ${limit} custom scoring configurations for your subscription tier`,
          403
        );
      }
      
      // If this is the first config, make it default
      const isFirstConfig = configCount === 0;
      
      const configuration = await prisma.scoringConfiguration.create({
        data: {
          ...data,
          userId: user.id,
          isDefault: isFirstConfig,
        },
      });
      
      res.status(201).json({
        success: true,
        data: configuration,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update scoring configuration
router.put(
  '/:configId',
  validateParams(z.object({ configId: z.string() })),
  validateBody(scoringConfigSchema.partial()),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { configId } = req.params;
      const data = req.body;
      
      // Verify ownership
      const config = await prisma.scoringConfiguration.findFirst({
        where: {
          id: configId,
          userId: user.id,
        },
      });
      
      if (!config) {
        throw new AppError('Scoring configuration not found', 404);
      }
      
      const updated = await prisma.scoringConfiguration.update({
        where: { id: configId },
        data,
      });
      
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete scoring configuration
router.delete(
  '/:configId',
  validateParams(z.object({ configId: z.string() })),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { configId } = req.params;
      
      // Verify ownership
      const config = await prisma.scoringConfiguration.findFirst({
        where: {
          id: configId,
          userId: user.id,
        },
      });
      
      if (!config) {
        throw new AppError('Scoring configuration not found', 404);
      }
      
      if (config.isDefault) {
        throw new AppError('Cannot delete default configuration', 400);
      }
      
      await prisma.scoringConfiguration.delete({
        where: { id: configId },
      });
      
      res.json({
        success: true,
        message: 'Scoring configuration deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Set default configuration
router.post(
  '/:configId/set-default',
  validateParams(z.object({ configId: z.string() })),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { configId } = req.params;
      
      // Verify ownership
      const config = await prisma.scoringConfiguration.findFirst({
        where: {
          id: configId,
          userId: user.id,
        },
      });
      
      if (!config) {
        throw new AppError('Scoring configuration not found', 404);
      }
      
      // Update all configs to not be default
      await prisma.scoringConfiguration.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
      
      // Set this one as default
      const updated = await prisma.scoringConfiguration.update({
        where: { id: configId },
        data: { isDefault: true },
      });
      
      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;