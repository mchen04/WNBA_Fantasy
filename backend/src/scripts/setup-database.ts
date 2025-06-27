#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { getRedis } from '../config/redis';
import { fetchPlayerData } from '../jobs/fetchPlayerData';
import { calculateFantasyScores, calculateConsistencyMetrics, calculateTrendingAnalysis } from '../jobs/calculateFantasyScores';

// Load environment variables
dotenv.config();

async function setupDatabase() {
  logger.info('🚀 Starting complete database setup...');
  
  try {
    // Test connections
    await prisma.$connect();
    logger.info('✅ Database connected');
    
    const redis = await getRedis();
    await redis.ping();
    logger.info('✅ Redis connected');

    // Step 1: Create correct ESPN default scoring configuration
    logger.info('📊 Setting up correct ESPN scoring system...');
    await setupCorrectScoringSystem();

    // Step 2: Clear and fetch all data
    logger.info('🧹 Clearing existing data and fetching fresh from ESPN...');
    await clearAndFetchAllData();

    // Step 3: Calculate all derived metrics
    logger.info('📈 Calculating fantasy scores and analytics...');
    await calculateAllMetrics();

    // Step 4: Verify data integrity
    logger.info('🔍 Verifying data integrity...');
    await verifyDataIntegrity();

    logger.info('🎉 Database setup completed successfully!');
    
  } catch (error) {
    logger.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    const redis = await getRedis();
    await redis.quit();
  }
}

async function setupCorrectScoringSystem() {
  // Delete existing configs
  await prisma.scoringConfiguration.deleteMany();
  
  // Create or get a system user for configs
  const systemUser = await prisma.user.upsert({
    where: { email: 'system@wnba-fantasy.com' },
    update: {},
    create: {
      email: 'system@wnba-fantasy.com',
      googleId: 'system',
      name: 'System',
      subscriptionTier: 'FREE'
    }
  });
  
  // Create the correct ESPN default scoring
  await prisma.scoringConfiguration.create({
    data: {
      userId: systemUser.id,
      name: 'ESPN Default',
      isDefault: true,
      pointsMultiplier: 1,
      reboundsMultiplier: 1,
      assistsMultiplier: 1,
      stealsMultiplier: 2,
      blocksMultiplier: 2,
      threePointersMultiplier: 1,
      turnoversMultiplier: 0 // User specified 0, not -1
    }
  });

  // Create additional scoring systems for variety
  await prisma.scoringConfiguration.create({
    data: {
      userId: systemUser.id,
      name: 'Traditional Fantasy',
      isDefault: false,
      pointsMultiplier: 1,
      reboundsMultiplier: 1,
      assistsMultiplier: 1,
      stealsMultiplier: 2,
      blocksMultiplier: 2,
      threePointersMultiplier: 1,
      turnoversMultiplier: -1
    }
  });

  await prisma.scoringConfiguration.create({
    data: {
      userId: systemUser.id,
      name: 'Premium Analytics',
      isDefault: false,
      pointsMultiplier: 1,
      reboundsMultiplier: 1.2,
      assistsMultiplier: 1.5,
      stealsMultiplier: 3,
      blocksMultiplier: 3,
      threePointersMultiplier: 0.5,
      turnoversMultiplier: -2
    }
  });

  logger.info('✅ Scoring configurations created');
}

async function clearAndFetchAllData() {
  // Clear existing stats and derived data
  logger.info('Clearing existing player stats and derived data...');
  await prisma.waiverRecommendation.deleteMany();
  await prisma.tradeAnalysis.deleteMany();
  await prisma.trendingAnalysis.deleteMany();
  await prisma.consistencyMetric.deleteMany();
  await prisma.playerFantasyScore.deleteMany();
  await prisma.playerStats.deleteMany();
  await prisma.game.deleteMany();

  // Keep players and injuries, just refresh their stats
  logger.info('Fetching all player and game data from ESPN...');
  
  // Run the comprehensive data fetch
  const result = await fetchPlayerData();
  
  if (!result.success) {
    throw new Error(`Data fetch failed: ${result.error}`);
  }

  logger.info(`✅ Data fetched successfully:`);
  logger.info(`   - Players: ${result.playersProcessed}`);
  logger.info(`   - Games: ${result.gamesProcessed}`);
  logger.info(`   - Player Stats: ${result.playerStatsProcessed || 0}`);
}

async function calculateAllMetrics() {
  logger.info('Calculating fantasy scores for all scoring systems...');
  await calculateFantasyScores();
  
  logger.info('Calculating consistency metrics...');
  await calculateConsistencyMetrics();
  
  logger.info('Calculating trending analysis...');
  await calculateTrendingAnalysis();
  
  logger.info('✅ All metrics calculated');
}

async function verifyDataIntegrity() {
  const stats = {
    players: await prisma.player.count(),
    games: await prisma.game.count(),
    playerStats: await prisma.playerStats.count(),
    fantasyScores: await prisma.playerFantasyScore.count(),
    consistencyMetrics: await prisma.consistencyMetric.count(),
    trendingAnalysis: await prisma.trendingAnalysis.count(),
    scoringConfigs: await prisma.scoringConfiguration.count()
  };

  logger.info('📊 Final Database Stats:');
  Object.entries(stats).forEach(([key, value]) => {
    logger.info(`   ${key}: ${value}`);
  });

  // Verify we have reasonable data
  if (stats.players < 100) {
    logger.warn('⚠️  Low player count - might be missing data');
  }
  
  if (stats.games < 50) {
    logger.warn('⚠️  Low game count - might be missing games');
  }
  
  if (stats.playerStats === 0) {
    logger.error('❌ No player stats found - this is a problem!');
    throw new Error('No player stats were fetched');
  }

  if (stats.fantasyScores === 0) {
    logger.error('❌ No fantasy scores calculated - this is a problem!');
    throw new Error('No fantasy scores were calculated');
  }

  // Sample some data to verify quality
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

  if (samplePlayer) {
    logger.info(`📋 Sample Player: ${samplePlayer.name} (${samplePlayer.team})`);
    logger.info(`   Recent Games: ${samplePlayer.stats.length}`);
    logger.info(`   Fantasy Scores: ${samplePlayer.fantasyScores.length}`);
    
    if (samplePlayer.stats.length > 0) {
      const latestGame = samplePlayer.stats[0];
      logger.info(`   Latest Game: ${latestGame.points}pts, ${latestGame.rebounds}reb, ${latestGame.assists}ast`);
    }
    
    if (samplePlayer.fantasyScores.length > 0) {
      const latestScore = samplePlayer.fantasyScores[0];
      logger.info(`   Latest Fantasy: ${latestScore.fantasyPoints.toFixed(1)} pts (${latestScore.scoringConfig.name})`);
    }
  }

  logger.info('✅ Data integrity verification completed');
}

// Function to update everything when new games are added
export async function processNewGameData() {
  logger.info('🔄 Processing new game data...');
  
  try {
    // Fetch any new games and stats
    await fetchPlayerData();
    
    // Recalculate all derived metrics
    await calculateFantasyScores();
    await calculateConsistencyMetrics();
    await calculateTrendingAnalysis();
    
    logger.info('✅ New game data processed successfully');
    
  } catch (error) {
    logger.error('❌ Failed to process new game data:', error);
    throw error;
  }
}

// Run the setup
setupDatabase()
  .then(() => {
    logger.info('🎯 Database setup script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('💥 Database setup script failed:', error);
    process.exit(1);
  });