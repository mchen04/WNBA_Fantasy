import { prisma } from '../config/database';
import { AppError } from '../middleware/error';
import { logger } from '../utils/logger';
import { SUBSCRIPTION_PLANS } from '@shared/constants';
import { ScoringConfigInput } from '@shared/schemas';
import { SubscriptionTier } from '@shared/types';

export interface ScoringConfiguration {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  pointsMultiplier: number;
  reboundsMultiplier: number;
  assistsMultiplier: number;
  stealsMultiplier: number;
  blocksMultiplier: number;
  threePointersMultiplier: number;
  turnoversMultiplier: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScoringConfigData extends ScoringConfigInput {
  userId: string;
}

export interface UpdateScoringConfigData extends Partial<ScoringConfigInput> {}

export class ScoringService {
  /**
   * Get all scoring configurations for a user
   */
  async getUserScoringConfigurations(userId: string): Promise<ScoringConfiguration[]> {
    try {
      const configurations = await prisma.scoringConfiguration.findMany({
        where: { userId },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
      });

      return configurations;
    } catch (error) {
      logger.error('Get user scoring configurations failed:', error);
      throw new AppError('Failed to retrieve scoring configurations', 500);
    }
  }

  /**
   * Get default scoring configuration for a user
   */
  async getDefaultScoringConfiguration(userId: string): Promise<ScoringConfiguration> {
    try {
      let defaultConfig = await prisma.scoringConfiguration.findFirst({
        where: {
          userId,
          isDefault: true,
        },
      });

      if (!defaultConfig) {
        // Create default configuration if none exists
        defaultConfig = await prisma.scoringConfiguration.create({
          data: {
            userId,
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

        logger.info(`Created default scoring configuration for user: ${userId}`);
      }

      return defaultConfig;
    } catch (error) {
      logger.error('Get default scoring configuration failed:', error);
      throw new AppError('Failed to retrieve default scoring configuration', 500);
    }
  }

  /**
   * Create a new scoring configuration
   */
  async createScoringConfiguration(
    data: CreateScoringConfigData,
    userSubscriptionTier: SubscriptionTier
  ): Promise<ScoringConfiguration> {
    try {
      const { userId, ...configData } = data;

      // Check configuration limit based on subscription tier
      const configCount = await prisma.scoringConfiguration.count({
        where: { userId },
      });

      const limit = SUBSCRIPTION_PLANS[userSubscriptionTier].limits.customScoringConfigs;
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
          ...configData,
          userId,
          isDefault: isFirstConfig,
        },
      });

      logger.info(`Created scoring configuration for user ${userId}: ${configuration.name}`);

      return configuration;
    } catch (error) {
      logger.error('Create scoring configuration failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to create scoring configuration', 500);
    }
  }

  /**
   * Update a scoring configuration
   */
  async updateScoringConfiguration(
    configId: string,
    userId: string,
    data: UpdateScoringConfigData
  ): Promise<ScoringConfiguration> {
    try {
      // Verify ownership
      const config = await prisma.scoringConfiguration.findFirst({
        where: {
          id: configId,
          userId,
        },
      });

      if (!config) {
        throw new AppError('Scoring configuration not found', 404);
      }

      const updated = await prisma.scoringConfiguration.update({
        where: { id: configId },
        data,
      });

      logger.info(`Updated scoring configuration ${configId} for user ${userId}`);

      return updated;
    } catch (error) {
      logger.error('Update scoring configuration failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to update scoring configuration', 500);
    }
  }

  /**
   * Delete a scoring configuration
   */
  async deleteScoringConfiguration(configId: string, userId: string): Promise<void> {
    try {
      // Verify ownership
      const config = await prisma.scoringConfiguration.findFirst({
        where: {
          id: configId,
          userId,
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

      logger.info(`Deleted scoring configuration ${configId} for user ${userId}`);
    } catch (error) {
      logger.error('Delete scoring configuration failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to delete scoring configuration', 500);
    }
  }

  /**
   * Set a configuration as default
   */
  async setDefaultConfiguration(configId: string, userId: string): Promise<ScoringConfiguration> {
    try {
      // Verify ownership
      const config = await prisma.scoringConfiguration.findFirst({
        where: {
          id: configId,
          userId,
        },
      });

      if (!config) {
        throw new AppError('Scoring configuration not found', 404);
      }

      // Update all configs to not be default
      await prisma.scoringConfiguration.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      // Set this one as default
      const updated = await prisma.scoringConfiguration.update({
        where: { id: configId },
        data: { isDefault: true },
      });

      logger.info(`Set scoring configuration ${configId} as default for user ${userId}`);

      return updated;
    } catch (error) {
      logger.error('Set default configuration failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to set default configuration', 500);
    }
  }

  /**
   * Get a specific scoring configuration
   */
  async getScoringConfigurationById(configId: string, userId: string): Promise<ScoringConfiguration> {
    try {
      const config = await prisma.scoringConfiguration.findFirst({
        where: {
          id: configId,
          userId,
        },
      });

      if (!config) {
        throw new AppError('Scoring configuration not found', 404);
      }

      return config;
    } catch (error) {
      logger.error('Get scoring configuration by ID failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to retrieve scoring configuration', 500);
    }
  }

  /**
   * Calculate fantasy points for given stats and scoring configuration
   */
  calculateFantasyPoints(
    stats: {
      points: number;
      rebounds: number;
      assists: number;
      steals: number;
      blocks: number;
      threePointersMade: number;
      turnovers: number;
    },
    config: ScoringConfiguration
  ): number {
    try {
      const fantasyPoints = 
        (stats.points * config.pointsMultiplier) +
        (stats.rebounds * config.reboundsMultiplier) +
        (stats.assists * config.assistsMultiplier) +
        (stats.steals * config.stealsMultiplier) +
        (stats.blocks * config.blocksMultiplier) +
        (stats.threePointersMade * config.threePointersMultiplier) +
        (stats.turnovers * config.turnoversMultiplier);

      return Math.round(fantasyPoints * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      logger.error('Calculate fantasy points failed:', error);
      throw new AppError('Failed to calculate fantasy points', 500);
    }
  }

  /**
   * Validate scoring configuration data
   */
  validateScoringConfig(data: ScoringConfigInput): void {
    const { 
      pointsMultiplier,
      reboundsMultiplier,
      assistsMultiplier,
      stealsMultiplier,
      blocksMultiplier,
      threePointersMultiplier,
      turnoversMultiplier
    } = data;

    // Check for reasonable multiplier ranges
    const multipliers = [
      pointsMultiplier,
      reboundsMultiplier,
      assistsMultiplier,
      stealsMultiplier,
      blocksMultiplier,
      threePointersMultiplier
    ];

    if (multipliers.some(m => m < 0 || m > 10)) {
      throw new AppError('Positive stat multipliers must be between 0 and 10', 400);
    }

    if (turnoversMultiplier > 0 || turnoversMultiplier < -10) {
      throw new AppError('Turnover multiplier must be between -10 and 0', 400);
    }
  }
}

export const scoringService = new ScoringService();