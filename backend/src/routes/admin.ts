import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticate, requireSubscription } from '../middleware/auth';
import { logger } from '../utils/logger';
import { fetchPlayerData } from '../jobs/fetchPlayerData';
import { calculateFantasyScores, calculateConsistencyMetrics, calculateTrendingAnalysis } from '../jobs/calculateFantasyScores';
import { processNewGameData } from '../scripts/setup-database';
import { prisma } from '../config/database';

const router = Router();

// Admin route to manually refresh all data
router.post('/refresh-all-data', authenticate, async (req, res, next) => {
  try {
    logger.info('Manual data refresh initiated');
    
    // Fetch latest data from ESPN
    const fetchResult = await fetchPlayerData();
    
    if (!fetchResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch data from ESPN',
        details: fetchResult.error
      });
    }

    // Recalculate all metrics
    await calculateFantasyScores();
    await calculateConsistencyMetrics();
    await calculateTrendingAnalysis();

    // Get final stats
    const stats = {
      players: await prisma.player.count(),
      games: await prisma.game.count(),
      playerStats: await prisma.playerStats.count(),
      fantasyScores: await prisma.playerFantasyScore.count(),
      lastUpdated: new Date()
    };

    logger.info('Manual data refresh completed successfully');

    res.json({
      success: true,
      message: 'All data refreshed successfully',
      stats,
      fetchResult
    });
    
  } catch (error) {
    logger.error('Manual data refresh failed:', error);
    next(error);
  }
});

// Admin route to process new game data (lighter weight update)
router.post('/process-new-games', authenticate, async (req, res, next) => {
  try {
    logger.info('Processing new game data');
    
    await processNewGameData();

    const stats = {
      games: await prisma.game.count(),
      playerStats: await prisma.playerStats.count(),
      fantasyScores: await prisma.playerFantasyScore.count(),
      lastUpdated: new Date()
    };

    res.json({
      success: true,
      message: 'New game data processed successfully',
      stats
    });
    
  } catch (error) {
    logger.error('Failed to process new game data:', error);
    next(error);
  }
});

// Get database statistics
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const stats = {
      players: await prisma.player.count(),
      activeInjuries: await prisma.playerInjury.count({ where: { active: true } }),
      games: await prisma.game.count(),
      completedGames: await prisma.game.count({ where: { status: 'FINAL' } }),
      playerStats: await prisma.playerStats.count(),
      fantasyScores: await prisma.playerFantasyScore.count(),
      consistencyMetrics: await prisma.consistencyMetric.count(),
      trendingAnalyses: await prisma.trendingAnalysis.count(),
      scoringConfigurations: await prisma.scoringConfiguration.count()
    };

    // Get sample data quality
    const samplePlayer = await prisma.player.findFirst({
      include: {
        stats: { take: 5, orderBy: { date: 'desc' } },
        fantasyScores: { 
          take: 3, 
          orderBy: { date: 'desc' },
          include: { scoringConfig: true }
        }
      }
    });

    res.json({
      success: true,
      stats,
      samplePlayer: samplePlayer ? {
        name: samplePlayer.name,
        team: samplePlayer.team,
        recentGames: samplePlayer.stats.length,
        fantasyScores: samplePlayer.fantasyScores.length,
        latestGame: samplePlayer.stats[0] ? {
          date: samplePlayer.stats[0].date,
          points: samplePlayer.stats[0].points,
          rebounds: samplePlayer.stats[0].rebounds,
          assists: samplePlayer.stats[0].assists
        } : null
      } : null
    });
    
  } catch (error) {
    logger.error('Failed to get database stats:', error);
    next(error);
  }
});

// Recalculate fantasy scores only
router.post('/recalculate-scores', authenticate, async (req, res, next) => {
  try {
    logger.info('Recalculating fantasy scores');
    
    await calculateFantasyScores();
    
    const fantasyScoreCount = await prisma.playerFantasyScore.count();
    
    res.json({
      success: true,
      message: 'Fantasy scores recalculated successfully',
      fantasyScores: fantasyScoreCount
    });
    
  } catch (error) {
    logger.error('Failed to recalculate fantasy scores:', error);
    next(error);
  }
});

// Recalculate consistency metrics only
router.post('/recalculate-consistency', authenticate, async (req, res, next) => {
  try {
    logger.info('Recalculating consistency metrics');
    
    await calculateConsistencyMetrics();
    
    const consistencyCount = await prisma.consistencyMetric.count();
    
    res.json({
      success: true,
      message: 'Consistency metrics recalculated successfully',
      consistencyMetrics: consistencyCount
    });
    
  } catch (error) {
    logger.error('Failed to recalculate consistency metrics:', error);
    next(error);
  }
});

// Recalculate trending analysis only
router.post('/recalculate-trending', authenticate, async (req, res, next) => {
  try {
    logger.info('Recalculating trending analysis');
    
    await calculateTrendingAnalysis();
    
    const trendingCount = await prisma.trendingAnalysis.count();
    
    res.json({
      success: true,
      message: 'Trending analysis recalculated successfully',
      trendingAnalyses: trendingCount
    });
    
  } catch (error) {
    logger.error('Failed to recalculate trending analysis:', error);
    next(error);
  }
});

export { router as adminRoutes };