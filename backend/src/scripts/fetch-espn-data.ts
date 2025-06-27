#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { getRedis } from '../config/redis';
import { fetchPlayerData } from '../jobs/fetchPlayerData';

// Load environment variables
dotenv.config();

async function main() {
  logger.info('Starting manual ESPN data fetch...');
  
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected');
    
    // Test Redis connection
    const redis = await getRedis();
    await redis.ping();
    logger.info('Redis connected');
    
    // Clear existing sample data if needed
    const existingPlayers = await prisma.player.count();
    logger.info(`Found ${existingPlayers} existing players in database`);
    
    if (existingPlayers > 0) {
      const answer = process.argv.includes('--force') || process.argv.includes('-f');
      if (!answer && existingPlayers < 10) {
        logger.info('Clearing existing sample data...');
        // Only clear if we have sample data (less than 10 players)
        await prisma.playerFantasyScore.deleteMany();
        await prisma.playerStats.deleteMany();
        await prisma.playerInjury.deleteMany();
        await prisma.player.deleteMany();
        logger.info('Sample data cleared');
      } else if (answer) {
        logger.info('Force flag detected, clearing all existing data...');
        await prisma.playerFantasyScore.deleteMany();
        await prisma.playerStats.deleteMany();
        await prisma.playerInjury.deleteMany();
        await prisma.player.deleteMany();
        logger.info('All player data cleared');
      } else {
        logger.info('Keeping existing data and updating with latest from ESPN');
      }
    }
    
    // Run the data fetch
    logger.info('Fetching data from ESPN API...');
    const result = await fetchPlayerData();
    
    if (result.success) {
      logger.info(`✅ Successfully fetched and processed ESPN data!`);
      logger.info(`   - Players processed: ${result.playersProcessed}`);
      logger.info(`   - Games processed: ${result.gamesProcessed}`);
      logger.info(`   - Timestamp: ${result.timestamp}`);
      
      // Show some stats
      const totalPlayers = await prisma.player.count();
      const activeInjuries = await prisma.playerInjury.count({ where: { active: true } });
      const playersWithStats = await prisma.playerStats.groupBy({
        by: ['playerId'],
        _count: true,
      });
      
      logger.info('\n📊 Database Statistics:');
      logger.info(`   - Total players: ${totalPlayers}`);
      logger.info(`   - Active injuries: ${activeInjuries}`);
      logger.info(`   - Players with stats: ${playersWithStats.length}`);
    } else {
      logger.error('❌ Data fetch failed:', result.error);
    }
    
  } catch (error) {
    logger.error('Fatal error during data fetch:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await prisma.$disconnect();
    const redis = await getRedis();
    await redis.quit();
    logger.info('Connections closed');
  }
}

// Run the script
main()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });