import { config } from '../config/env';
import { logger } from '../utils/logger';
import { scheduledJobManager } from './scheduledJobs';

export const initializeJobs = async () => {
  logger.info('🚀 Initializing comprehensive background job system...');

  try {
    // Initialize the new scheduled job manager
    await scheduledJobManager.initialize();
    
    // Start jobs if enabled in config
    if (config.jobs.enabled) {
      scheduledJobManager.startAllJobs();
    }
    
    logger.info('✅ Background job system initialized successfully');
    
  } catch (error) {
    logger.error('❌ Failed to initialize background jobs:', error);
    throw error;
  }
};

// Export the job manager for external access
export { scheduledJobManager };