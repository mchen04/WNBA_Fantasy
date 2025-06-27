import cron from 'node-cron';
import { logger } from '../utils/logger';
import { fetchPlayerData } from './fetchPlayerData';
import { calculateFantasyScores, calculateConsistencyMetrics, calculateTrendingAnalysis } from './calculateFantasyScores';
import { processNewGameData } from '../scripts/setup-database';
import { prisma } from '../config/database';
import { generateDailyRecommendations } from './generateRecommendations';

class ScheduledJobManager {
  private isInitialized = false;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  async initialize() {
    if (this.isInitialized) {
      logger.warn('Scheduled jobs already initialized');
      return;
    }

    logger.info('🕐 Initializing scheduled jobs...');

    try {
      // Job 1: Check for new games every 2 hours during season
      const newGamesJob = cron.schedule('0 */2 * * *', async () => {
        await this.safeExecute('check-new-games', this.checkForNewGames.bind(this));
      }, {
        scheduled: false,
        name: 'check-new-games'
      });

      // Job 2: Recalculate all metrics daily at 3 AM
      const dailyMetricsJob = cron.schedule('0 3 * * *', async () => {
        await this.safeExecute('daily-metrics', this.recalculateAllMetrics.bind(this));
      }, {
        scheduled: false,
        name: 'daily-metrics'
      });

      // Job 3: Update fantasy scores every 30 minutes during game days
      const fantasyScoresJob = cron.schedule('*/30 * * * *', async () => {
        await this.safeExecute('fantasy-scores', this.updateFantasyScores.bind(this));
      }, {
        scheduled: false,
        name: 'fantasy-scores'
      });

      // Job 4: Weekly comprehensive refresh (Sundays at 4 AM)
      const weeklyRefreshJob = cron.schedule('0 4 * * 0', async () => {
        await this.safeExecute('weekly-refresh', this.weeklyComprehensiveRefresh.bind(this));
      }, {
        scheduled: false,
        name: 'weekly-refresh'
      });

      // Job 5: Generate daily waiver recommendations (6 AM daily for Pro+ users)
      const dailyRecommendationsJob = cron.schedule('0 6 * * *', async () => {
        await this.safeExecute('daily-recommendations', this.generateDailyRecommendations.bind(this));
      }, {
        scheduled: false,
        name: 'daily-recommendations'
      });

      this.jobs.set('check-new-games', newGamesJob);
      this.jobs.set('daily-metrics', dailyMetricsJob);
      this.jobs.set('fantasy-scores', fantasyScoresJob);
      this.jobs.set('weekly-refresh', weeklyRefreshJob);
      this.jobs.set('daily-recommendations', dailyRecommendationsJob);

      this.isInitialized = true;
      logger.info('✅ Scheduled jobs initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize scheduled jobs:', error);
      throw error;
    }
  }

  startAllJobs() {
    if (!this.isInitialized) {
      throw new Error('Jobs must be initialized before starting');
    }

    logger.info('🚀 Starting all scheduled jobs...');
    
    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`✅ Started job: ${name}`);
    });

    logger.info('🎯 All scheduled jobs are now running');
  }

  stopAllJobs() {
    logger.info('🛑 Stopping all scheduled jobs...');
    
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`⏹️  Stopped job: ${name}`);
    });

    logger.info('✅ All scheduled jobs stopped');
  }

  startJob(name: string) {
    const job = this.jobs.get(name);
    if (job) {
      job.start();
      logger.info(`✅ Started job: ${name}`);
    } else {
      logger.error(`❌ Job not found: ${name}`);
    }
  }

  stopJob(name: string) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      logger.info(`⏹️  Stopped job: ${name}`);
    } else {
      logger.error(`❌ Job not found: ${name}`);
    }
  }

  getJobStatus() {
    const status: Record<string, boolean> = {};
    
    this.jobs.forEach((job, name) => {
      status[name] = job.running || false;
    });

    return status;
  }

  private async safeExecute(jobName: string, jobFunction: () => Promise<void>) {
    const startTime = Date.now();
    logger.info(`🔄 Starting scheduled job: ${jobName}`);

    try {
      await jobFunction();
      const duration = Date.now() - startTime;
      logger.info(`✅ Completed scheduled job: ${jobName} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Failed scheduled job: ${jobName} (${duration}ms)`, error);
    }
  }

  // Job implementations
  private async checkForNewGames() {
    logger.info('Checking for new games and updating data...');
    
    const initialGameCount = await prisma.game.count();
    
    // Process new game data (lighter weight update)
    await processNewGameData();
    
    const finalGameCount = await prisma.game.count();
    const newGames = finalGameCount - initialGameCount;
    
    if (newGames > 0) {
      logger.info(`🎮 Found ${newGames} new games, data updated successfully`);
    } else {
      logger.info('📊 No new games found, but data refreshed');
    }
  }

  private async recalculateAllMetrics() {
    logger.info('Recalculating all metrics (daily job)...');
    
    await calculateFantasyScores();
    await calculateConsistencyMetrics();
    await calculateTrendingAnalysis();
    
    const stats = {
      fantasyScores: await prisma.playerFantasyScore.count(),
      consistencyMetrics: await prisma.consistencyMetric.count(),
      trendingAnalyses: await prisma.trendingAnalysis.count()
    };
    
    logger.info('📊 Daily metrics recalculation completed:', stats);
  }

  private async updateFantasyScores() {
    logger.info('Updating fantasy scores...');
    
    await calculateFantasyScores();
    
    const fantasyScoreCount = await prisma.playerFantasyScore.count();
    logger.info(`📈 Fantasy scores updated: ${fantasyScoreCount} total scores`);
  }

  private async weeklyComprehensiveRefresh() {
    logger.info('Performing weekly comprehensive refresh...');
    
    // Full data refresh from ESPN
    const fetchResult = await fetchPlayerData();
    
    if (fetchResult.success) {
      // Recalculate all metrics
      await this.recalculateAllMetrics();
      
      logger.info('🔄 Weekly comprehensive refresh completed successfully');
    } else {
      logger.error('❌ Weekly refresh failed during data fetch:', fetchResult.error);
    }
  }

  private async generateDailyRecommendations() {
    logger.info('Generating daily waiver recommendations for Pro+ users...');
    
    try {
      // Generate recommendations for today and tomorrow
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const [todayResult, tomorrowResult] = await Promise.all([
        generateDailyRecommendations(today),
        generateDailyRecommendations(tomorrow),
      ]);
      
      logger.info(`📊 Daily recommendations generated:
        - Today (${today}): ${todayResult.recommendationsCount} recommendations
        - Tomorrow (${tomorrow}): ${tomorrowResult.recommendationsCount} recommendations`);
      
    } catch (error) {
      logger.error('❌ Failed to generate daily recommendations:', error);
      throw error;
    }
  }

  // Manual trigger methods (for API endpoints)
  async triggerNewGameCheck() {
    await this.safeExecute('manual-new-games', this.checkForNewGames.bind(this));
  }

  async triggerMetricsRecalculation() {
    await this.safeExecute('manual-metrics', this.recalculateAllMetrics.bind(this));
  }

  async triggerFantasyScoresUpdate() {
    await this.safeExecute('manual-fantasy', this.updateFantasyScores.bind(this));
  }

  async triggerWeeklyRefresh() {
    await this.safeExecute('manual-weekly', this.weeklyComprehensiveRefresh.bind(this));
  }

  async triggerDailyRecommendations() {
    await this.safeExecute('manual-recommendations', this.generateDailyRecommendations.bind(this));
  }
}

// Export singleton instance
export const scheduledJobManager = new ScheduledJobManager();

// Auto-initialize and start jobs if in production
if (process.env.NODE_ENV === 'production') {
  scheduledJobManager.initialize().then(() => {
    scheduledJobManager.startAllJobs();
  }).catch(error => {
    logger.error('Failed to auto-initialize scheduled jobs:', error);
  });
}