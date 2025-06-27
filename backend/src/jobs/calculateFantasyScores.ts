import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { DEFAULT_SCORING_CONFIG } from '@wnba-fantasy/shared';

interface ScoringConfig {
  id: string;
  pointsMultiplier: number;
  reboundsMultiplier: number;
  assistsMultiplier: number;
  stealsMultiplier: number;
  blocksMultiplier: number;
  threePointersMultiplier: number;
  turnoversMultiplier: number;
}

export const calculateFantasyScores = async () => {
  logger.info('Starting fantasy score calculations...');
  
  try {
    // Get all scoring configurations
    const scoringConfigs = await prisma.scoringConfiguration.findMany();
    
    if (scoringConfigs.length === 0) {
      logger.warn('No scoring configurations found');
      return;
    }

    // Get all players with stats
    const players = await prisma.player.findMany({
      where: { activeStatus: true },
      include: {
        stats: {
          orderBy: { date: 'desc' }
        }
      }
    });

    logger.info(`Processing fantasy scores for ${players.length} players with ${scoringConfigs.length} scoring configs`);

    for (const config of scoringConfigs) {
      logger.info(`Processing scoring config: ${config.name}`);
      
      for (const player of players) {
        if (player.stats.length === 0) continue;

        // Calculate fantasy scores for each game
        for (const stat of player.stats) {
          const fantasyPoints = calculateGameFantasyPoints(stat, config);
          
          // Upsert the fantasy score
          await prisma.playerFantasyScore.upsert({
            where: {
              playerId_date_scoringConfigId: {
                playerId: player.id,
                date: stat.date,
                scoringConfigId: config.id
              }
            },
            update: {
              fantasyPoints,
              updatedAt: new Date()
            },
            create: {
              playerId: player.id,
              date: stat.date,
              scoringConfigId: config.id,
              fantasyPoints
            }
          });
        }

        // Calculate rolling averages
        await calculatePlayerAverages(player.id, config.id);
      }
    }

    logger.info('Fantasy score calculations completed successfully');
    
  } catch (error) {
    logger.error('Failed to calculate fantasy scores:', error);
    throw error;
  }
};

function calculateGameFantasyPoints(stat: any, config: ScoringConfig): number {
  return (
    stat.points * config.pointsMultiplier +
    stat.rebounds * config.reboundsMultiplier +
    stat.assists * config.assistsMultiplier +
    stat.steals * config.stealsMultiplier +
    stat.blocks * config.blocksMultiplier +
    stat.threePointersMade * config.threePointersMultiplier +
    stat.turnovers * config.turnoversMultiplier
  );
}

async function calculatePlayerAverages(playerId: string, scoringConfigId: string) {
  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last14Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get fantasy scores for different periods
  const [allScores, last7Scores, last14Scores, last30Scores] = await Promise.all([
    prisma.playerFantasyScore.findMany({
      where: { playerId, scoringConfigId },
      orderBy: { date: 'desc' }
    }),
    prisma.playerFantasyScore.findMany({
      where: { 
        playerId, 
        scoringConfigId,
        date: { gte: last7Days }
      }
    }),
    prisma.playerFantasyScore.findMany({
      where: { 
        playerId, 
        scoringConfigId,
        date: { gte: last14Days }
      }
    }),
    prisma.playerFantasyScore.findMany({
      where: { 
        playerId, 
        scoringConfigId,
        date: { gte: last30Days }
      }
    })
  ]);

  // Calculate averages
  const seasonAverage = allScores.length > 0 
    ? allScores.reduce((sum, score) => sum + score.fantasyPoints, 0) / allScores.length 
    : 0;
    
  const last7DaysAverage = last7Scores.length > 0
    ? last7Scores.reduce((sum, score) => sum + score.fantasyPoints, 0) / last7Scores.length
    : null;
    
  const last14DaysAverage = last14Scores.length > 0
    ? last14Scores.reduce((sum, score) => sum + score.fantasyPoints, 0) / last14Scores.length
    : null;
    
  const last30DaysAverage = last30Scores.length > 0
    ? last30Scores.reduce((sum, score) => sum + score.fantasyPoints, 0) / last30Scores.length
    : null;

  // Update the most recent fantasy score with averages
  if (allScores.length > 0) {
    const latestScore = allScores[0];
    await prisma.playerFantasyScore.update({
      where: { id: latestScore.id },
      data: {
        seasonAverage,
        last7DaysAverage,
        last14DaysAverage,
        last30DaysAverage,
        updatedAt: new Date()
      }
    });
  }
}

export const calculateConsistencyMetrics = async () => {
  logger.info('Starting consistency metrics calculations...');
  
  try {
    const players = await prisma.player.findMany({
      where: { activeStatus: true },
      include: {
        fantasyScores: {
          where: {
            scoringConfig: { isDefault: true }
          },
          orderBy: { date: 'desc' },
          take: 30 // Last 30 games max
        }
      }
    });

    for (const player of players) {
      if (player.fantasyScores.length < 5) continue; // Need at least 5 games

      const scores = player.fantasyScores.map(fs => fs.fantasyPoints);
      const now = new Date();
      
      // Calculate for different periods
      const last7Scores = scores.slice(0, Math.min(7, scores.length));
      const last14Scores = scores.slice(0, Math.min(14, scores.length));
      const last30Scores = scores.slice(0, Math.min(30, scores.length));

      const metrics = {
        standardDeviation7Days: calculateStandardDeviation(last7Scores),
        standardDeviation14Days: calculateStandardDeviation(last14Scores),
        standardDeviation30Days: calculateStandardDeviation(last30Scores),
        coefficientOfVariation7Days: calculateCoefficientOfVariation(last7Scores),
        coefficientOfVariation14Days: calculateCoefficientOfVariation(last14Scores),
        coefficientOfVariation30Days: calculateCoefficientOfVariation(last30Scores),
        consistencyGrade: getConsistencyGrade(calculateCoefficientOfVariation(last14Scores)),
        gamesPlayed7Days: last7Scores.length,
        gamesPlayed14Days: last14Scores.length,
        gamesPlayed30Days: last30Scores.length
      };

      await prisma.consistencyMetric.upsert({
        where: {
          playerId_date: {
            playerId: player.id,
            date: now
          }
        },
        update: metrics,
        create: {
          playerId: player.id,
          date: now,
          ...metrics
        }
      });
    }

    logger.info('Consistency metrics calculations completed');
    
  } catch (error) {
    logger.error('Failed to calculate consistency metrics:', error);
    throw error;
  }
};

function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(avgSquaredDiff);
}

function calculateCoefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  if (mean === 0) return 0;
  
  const stdDev = calculateStandardDeviation(values);
  return stdDev / mean;
}

function getConsistencyGrade(cv: number): string {
  if (cv <= 0.1) return 'A_PLUS';
  if (cv <= 0.15) return 'A';
  if (cv <= 0.2) return 'A_MINUS';
  if (cv <= 0.25) return 'B_PLUS';
  if (cv <= 0.3) return 'B';
  if (cv <= 0.35) return 'B_MINUS';
  if (cv <= 0.4) return 'C_PLUS';
  if (cv <= 0.45) return 'C';
  if (cv <= 0.5) return 'C_MINUS';
  if (cv <= 0.6) return 'D';
  return 'F';
}

export const calculateTrendingAnalysis = async () => {
  logger.info('Starting trending analysis calculations...');
  
  try {
    const players = await prisma.player.findMany({
      where: { activeStatus: true },
      include: {
        stats: {
          orderBy: { date: 'desc' },
          take: 20 // Last 20 games
        },
        fantasyScores: {
          where: {
            scoringConfig: { isDefault: true }
          },
          orderBy: { date: 'desc' },
          take: 20
        }
      }
    });

    for (const player of players) {
      if (player.stats.length < 5 || player.fantasyScores.length < 5) continue;

      const recentStats = player.stats.slice(0, 7); // Last 7 games
      const seasonStats = player.stats;
      const recentFantasy = player.fantasyScores.slice(0, 7);
      const seasonFantasy = player.fantasyScores;

      // Calculate averages
      const recentMinutes = recentStats.reduce((sum, s) => sum + s.minutes, 0) / recentStats.length;
      const seasonMinutes = seasonStats.reduce((sum, s) => sum + s.minutes, 0) / seasonStats.length;
      const recentFantasyAvg = recentFantasy.reduce((sum, f) => sum + f.fantasyPoints, 0) / recentFantasy.length;
      const seasonFantasyAvg = seasonFantasy.reduce((sum, f) => sum + f.fantasyPoints, 0) / seasonFantasy.length;

      // Calculate trends
      const minutesTrendValue = seasonMinutes > 0 ? (recentMinutes - seasonMinutes) / seasonMinutes : 0;
      const performanceTrendValue = seasonFantasyAvg > 0 ? (recentFantasyAvg - seasonFantasyAvg) / seasonFantasyAvg : 0;
      const hotFactor = Math.max(performanceTrendValue, 0);

      const trendAnalysis = {
        minutesTrend: getTrendDirection(minutesTrendValue),
        minutesTrendValue,
        performanceTrend: getTrendDirection(performanceTrendValue),
        performanceTrendValue,
        hotFactor,
        isHot: hotFactor > 0.15, // 15% improvement threshold
        recentAverage: recentFantasyAvg,
        seasonAverage: seasonFantasyAvg
      };

      await prisma.trendingAnalysis.upsert({
        where: {
          playerId_date: {
            playerId: player.id,
            date: new Date()
          }
        },
        update: trendAnalysis,
        create: {
          playerId: player.id,
          date: new Date(),
          ...trendAnalysis
        }
      });
    }

    logger.info('Trending analysis calculations completed');
    
  } catch (error) {
    logger.error('Failed to calculate trending analysis:', error);
    throw error;
  }
};

function getTrendDirection(value: number): string {
  if (value > 0.05) return 'UP';
  if (value < -0.05) return 'DOWN';
  return 'STABLE';
}