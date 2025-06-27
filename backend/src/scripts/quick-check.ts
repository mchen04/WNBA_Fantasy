#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

dotenv.config();

async function quickCheck() {
  try {
    await prisma.$connect();
    
    const stats = {
      players: await prisma.player.count(),
      games: await prisma.game.count(),
      playerStats: await prisma.playerStats.count(),
      fantasyScores: await prisma.playerFantasyScore.count(),
    };

    logger.info('📊 Current Database Stats:');
    Object.entries(stats).forEach(([key, value]) => {
      logger.info(`   ${key}: ${value}`);
    });

    // Check for recent player stats
    const recentStats = await prisma.playerStats.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      include: { player: true }
    });

    if (recentStats.length > 0) {
      logger.info('🎯 Recent player stats:');
      recentStats.forEach(stat => {
        logger.info(`   ${stat.player.name}: ${stat.points}pts, ${stat.rebounds}reb, ${stat.assists}ast (${stat.date.toDateString()})`);
      });
    }
    
  } catch (error: any) {
    logger.error('Check failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

quickCheck().catch(logger.error);