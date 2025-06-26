import { Router } from 'express';
import { prisma } from '../config/database';
import { cache, cacheKeys } from '../config/redis';
import { CACHE_DURATIONS, SUBSCRIPTION_PLANS } from '@shared/constants';

const router = Router();

// Get dashboard stats
router.get('/dashboard', async (req, res, next) => {
  try {
    const user = (req as any).user;
    
    // Check cache
    const cacheKey = `stats:dashboard:${user.id}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }
    
    // Get various stats
    const [
      totalPlayers,
      totalGames,
      recentGames,
      topPerformers,
      userConfigs,
    ] = await Promise.all([
      prisma.player.count({ where: { activeStatus: true } }),
      
      prisma.game.count({
        where: {
          season: new Date().getFullYear(),
          status: 'FINAL',
        },
      }),
      
      prisma.game.findMany({
        where: { status: 'FINAL' },
        orderBy: { date: 'desc' },
        take: 5,
        select: {
          id: true,
          date: true,
          homeTeam: true,
          awayTeam: true,
          homeScore: true,
          awayScore: true,
        },
      }),
      
      prisma.playerFantasyScore.findMany({
        where: {
          scoringConfig: { isDefault: true },
          date: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { fantasyPoints: 'desc' },
        take: 5,
        include: {
          player: {
            select: {
              id: true,
              name: true,
              team: true,
              position: true,
              photoUrl: true,
            },
          },
        },
      }),
      
      prisma.scoringConfiguration.count({
        where: { userId: user.id },
      }),
    ]);
    
    const stats = {
      overview: {
        totalPlayers,
        totalGames,
        activeSeason: new Date().getFullYear(),
        userScoringConfigs: userConfigs,
      },
      recentGames,
      topPerformers: topPerformers.map(p => ({
        player: p.player,
        fantasyPoints: p.fantasyPoints,
        date: p.date,
      })),
      subscriptionInfo: {
        tier: user.subscriptionTier,
        features: SUBSCRIPTION_PLANS[user.subscriptionTier].features,
      },
    };
    
    // Cache for 5 minutes
    await cache.set(cacheKey, stats, 5 * 60);
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

// Get league leaders
router.get('/leaders', async (req, res, next) => {
  try {
    const { category = 'fantasyPoints', limit = 10 } = req.query;
    
    // Check cache
    const cacheKey = `stats:leaders:${category}:${limit}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }
    
    let leaders;
    
    switch (category) {
      case 'fantasyPoints':
        leaders = await prisma.playerFantasyScore.findMany({
          where: {
            scoringConfig: { isDefault: true },
          },
          orderBy: { seasonAverage: 'desc' },
          take: Number(limit),
          include: {
            player: {
              select: {
                id: true,
                name: true,
                team: true,
                position: true,
                photoUrl: true,
              },
            },
          },
        });
        break;
        
      case 'points':
      case 'rebounds':
      case 'assists':
      case 'steals':
      case 'blocks':
        const stats = await prisma.playerStats.groupBy({
          by: ['playerId'],
          _avg: {
            [category]: true,
          },
          orderBy: {
            _avg: {
              [category]: 'desc',
            },
          },
          take: Number(limit),
        });
        
        leaders = await Promise.all(
          stats.map(async (stat) => {
            const player = await prisma.player.findUnique({
              where: { id: stat.playerId },
              select: {
                id: true,
                name: true,
                team: true,
                position: true,
                photoUrl: true,
              },
            });
            
            return {
              player,
              value: stat._avg[category as keyof typeof stat._avg],
            };
          })
        );
        break;
        
      default:
        throw new Error('Invalid category');
    }
    
    // Cache for 1 hour
    await cache.set(cacheKey, leaders, CACHE_DURATIONS.CONSISTENCY_SCORES);
    
    res.json({
      success: true,
      data: leaders,
    });
  } catch (error) {
    next(error);
  }
});

// Get team stats
router.get('/teams', async (req, res, next) => {
  try {
    // Check cache
    const cacheKey = 'stats:teams';
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }
    
    // Get all teams
    const teams = await prisma.player.findMany({
      where: { activeStatus: true },
      select: { team: true },
      distinct: ['team'],
    });
    
    const teamStats = await Promise.all(
      teams.map(async ({ team }) => {
        const players = await prisma.player.findMany({
          where: { team, activeStatus: true },
          include: {
            fantasyScores: {
              where: { scoringConfig: { isDefault: true } },
              orderBy: { date: 'desc' },
              take: 1,
            },
          },
        });
        
        const avgFantasyPoints = players.reduce((sum, p) => 
          sum + (p.fantasyScores[0]?.seasonAverage || 0), 0
        ) / players.length;
        
        const games = await prisma.game.findMany({
          where: {
            OR: [{ homeTeam: team }, { awayTeam: team }],
            status: 'FINAL',
            season: new Date().getFullYear(),
          },
        });
        
        const wins = games.filter(g => 
          (g.homeTeam === team && g.homeScore! > g.awayScore!) ||
          (g.awayTeam === team && g.awayScore! > g.homeScore!)
        ).length;
        
        const losses = games.length - wins;
        
        return {
          team,
          playerCount: players.length,
          avgFantasyPoints,
          record: { wins, losses },
          winPercentage: games.length > 0 ? wins / games.length : 0,
        };
      })
    );
    
    // Sort by average fantasy points
    teamStats.sort((a, b) => b.avgFantasyPoints - a.avgFantasyPoints);
    
    // Cache for 1 hour
    await cache.set(cacheKey, teamStats, CACHE_DURATIONS.CONSISTENCY_SCORES);
    
    res.json({
      success: true,
      data: teamStats,
    });
  } catch (error) {
    next(error);
  }
});

export default router;