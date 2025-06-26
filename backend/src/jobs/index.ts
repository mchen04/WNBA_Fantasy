import cron from 'node-cron';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { fetchPlayerData } from './fetchPlayerData';
import { calculateDailyMetrics } from './calculateMetrics';
import { generateDailyRecommendations } from './generateRecommendations';

export const initializeJobs = async () => {
  logger.info('Initializing background jobs...');

  // Data fetch job - runs every 30 minutes during WNBA season
  if (config.jobs.dataFetchCron) {
    cron.schedule(config.jobs.dataFetchCron, async () => {
      logger.info('Running data fetch job...');
      try {
        await fetchPlayerData();
        logger.info('Data fetch job completed successfully');
      } catch (error) {
        logger.error('Data fetch job failed:', error);
      }
    });
    logger.info(`Data fetch job scheduled: ${config.jobs.dataFetchCron}`);
  }

  // Daily metrics calculation - runs at 5 AM every day
  cron.schedule('0 5 * * *', async () => {
    logger.info('Running daily metrics calculation...');
    try {
      await calculateDailyMetrics();
      logger.info('Daily metrics calculation completed successfully');
    } catch (error) {
      logger.error('Daily metrics calculation failed:', error);
    }
  });

  // Daily recommendations generation - runs at 6 AM every day
  if (config.jobs.dailyRecommendationsCron) {
    cron.schedule(config.jobs.dailyRecommendationsCron, async () => {
      logger.info('Running daily recommendations generation...');
      try {
        await generateDailyRecommendations();
        logger.info('Daily recommendations generation completed successfully');
      } catch (error) {
        logger.error('Daily recommendations generation failed:', error);
      }
    });
    logger.info(`Daily recommendations job scheduled: ${config.jobs.dailyRecommendationsCron}`);
  }

  // Cache cleanup - runs every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Running cache cleanup...');
    try {
      // Clean up expired cache entries
      // This is handled automatically by Redis TTL, but we can add custom logic here
      logger.info('Cache cleanup completed');
    } catch (error) {
      logger.error('Cache cleanup failed:', error);
    }
  });

  logger.info('All background jobs initialized');
};