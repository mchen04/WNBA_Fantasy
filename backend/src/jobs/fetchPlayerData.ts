import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { Position, GameStatus, InjuryStatus } from '@prisma/client';
import { espnService } from '../services/espnService';
import { SEASON_CONFIG } from '@wnba-fantasy/shared';

// ESPN API response interfaces
interface EspnPlayerResponse {
  athletes?: Array<{
    id: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
    position?: {
      abbreviation: string;
    };
    jersey?: string;
    height?: number;
    weight?: number;
    dateOfBirth?: string;
    experience?: {
      years: number;
    };
    college?: {
      name: string;
    };
    team?: {
      abbreviation: string;
    };
    headshot?: {
      href: string;
    };
    active?: boolean;
    injuries?: Array<{
      status: string;
      description?: string;
      date?: string;
    }>;
  }>;
}

interface EspnGameResponse {
  events?: Array<{
    id: string;
    date: string;
    competitions: Array<{
      competitors: Array<{
        team: {
          abbreviation: string;
        };
        homeAway: string;
        score?: string;
      }>;
      status: {
        type: {
          name: string;
        };
      };
      venue?: {
        fullName: string;
      };
      attendance?: number;
    }>;
    season: {
      year: number;
    };
  }>;
}

interface EspnStatsResponse {
  events?: Array<{
    id: string;
    date: string;
    competitions: Array<{
      competitors: Array<{
        statistics?: Array<{
          athletes: Array<{
            athlete: {
              id: string;
            };
            stats: string[];
          }>;
        }>;
      }>;
    }>;
  }>;
}

// Helper function to map ESPN position to our Position enum
const mapPosition = (espnPosition?: string): Position => {
  if (!espnPosition) return Position.G;
  
  switch (espnPosition.toUpperCase()) {
    case 'PG':
    case 'SG':
    case 'G':
      return Position.G;
    case 'SF':
    case 'PF':
    case 'F':
      return Position.F;
    case 'C':
      return Position.C;
    case 'G-F':
      return Position.G_F;
    case 'F-C':
      return Position.F_C;
    default:
      return Position.G;
  }
};

// Helper function to map ESPN injury status to our InjuryStatus enum
const mapInjuryStatus = (espnStatus?: string): InjuryStatus => {
  if (!espnStatus) return InjuryStatus.HEALTHY;
  
  switch (espnStatus.toLowerCase()) {
    case 'questionable':
      return InjuryStatus.QUESTIONABLE;
    case 'doubtful':
      return InjuryStatus.DOUBTFUL;
    case 'out':
      return InjuryStatus.OUT;
    case 'day-to-day':
      return InjuryStatus.DAY_TO_DAY;
    default:
      return InjuryStatus.HEALTHY;
  }
};

// Helper function to map ESPN game status to our GameStatus enum
const mapGameStatus = (espnStatus?: string): GameStatus => {
  if (!espnStatus) return GameStatus.SCHEDULED;
  
  switch (espnStatus.toLowerCase()) {
    case 'final':
      return GameStatus.FINAL;
    case 'in progress':
    case 'live':
      return GameStatus.IN_PROGRESS;
    case 'postponed':
      return GameStatus.POSTPONED;
    case 'canceled':
    case 'cancelled':
      return GameStatus.CANCELED;
    default:
      return GameStatus.SCHEDULED;
  }
};

// Mock data generator for development/fallback
const generateMockData = () => {
  const mockPlayers = [
    {
      espnId: 'mock-1',
      name: 'A\'ja Wilson',
      firstName: 'A\'ja',
      lastName: 'Wilson',
      team: 'LV',
      position: Position.F,
      jerseyNumber: 22,
      height: '6\'4"',
      weight: 195,
      college: 'South Carolina',
      yearsExperience: 6,
      activeStatus: true,
    },
    {
      espnId: 'mock-2',
      name: 'Breanna Stewart',
      firstName: 'Breanna',
      lastName: 'Stewart',
      team: 'NY',
      position: Position.F,
      jerseyNumber: 30,
      height: '6\'4"',
      weight: 170,
      college: 'Connecticut',
      yearsExperience: 8,
      activeStatus: true,
    },
    {
      espnId: 'mock-3',
      name: 'Diana Taurasi',
      firstName: 'Diana',
      lastName: 'Taurasi',
      team: 'PHX',
      position: Position.G,
      jerseyNumber: 3,
      height: '6\'0"',
      weight: 163,
      college: 'Connecticut',
      yearsExperience: 20,
      activeStatus: true,
    },
  ];

  const mockGames = [
    {
      espnGameId: 'mock-game-1',
      date: new Date(),
      homeTeam: 'LV',
      awayTeam: 'NY',
      status: GameStatus.SCHEDULED,
      season: 2024,
      venue: 'Michelob ULTRA Arena',
    },
  ];

  return { players: mockPlayers, games: mockGames };
};

// Main data fetching function
export const fetchPlayerData = async () => {
  logger.info('Starting ESPN API data fetch...');
  
  try {
    let playersData: any[] = [];
    let gamesData: any[] = [];
    
    // Check if we have ESPN API configuration
    if (!config.espn.baseUrl) {
      logger.warn('ESPN API base URL not configured, using mock data');
      const mockData = generateMockData();
      playersData = mockData.players;
      gamesData = mockData.games;
    } else {
      try {
        // Attempt to fetch real data from ESPN API
        const [players, games] = await Promise.all([
          fetchPlayersFromEspn(),
          fetchGamesFromEspn(),
        ]);
        
        playersData = players;
        gamesData = games;
        
        logger.info(`Fetched ${playersData.length} players and ${gamesData.length} games from ESPN API`);
      } catch (apiError) {
        logger.error('Failed to fetch from ESPN API, falling back to mock data:', apiError);
        const mockData = generateMockData();
        playersData = mockData.players;
        gamesData = mockData.games;
      }
    }

    // Process and store players
    if (playersData.length > 0) {
      await processPlayers(playersData);
    }

    // Process and store games
    if (gamesData.length > 0) {
      await processGames(gamesData);
    }

    // Fetch and process individual game stats
    await fetchAndProcessGameStats();

    logger.info('ESPN API data fetch completed successfully');
    
    // Get final stats count
    const totalPlayerStats = await prisma.playerStats.count();
    
    return {
      success: true,
      playersProcessed: playersData.length,
      gamesProcessed: gamesData.length,
      playerStatsProcessed: totalPlayerStats,
      timestamp: new Date(),
    };

  } catch (error) {
    logger.error('Failed to fetch player data:', error);
    
    // Return a safe response even on failure
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date(),
    };
  }
};

// Fetch players from ESPN API
const fetchPlayersFromEspn = async (): Promise<any[]> => {
  try {
    logger.info('Fetching all players from ESPN API...');
    const players = await espnService.fetchAllPlayers();
    logger.info(`Successfully fetched ${players.length} players from ESPN`);
    return players;
  } catch (error) {
    logger.error('Failed to fetch players from ESPN:', error);
    throw error;
  }
};

// Fetch games from ESPN API with comprehensive stats
const fetchGamesFromEspn = async (): Promise<any[]> => {
  try {
    logger.info('Fetching all completed games with player stats from ESPN API...');
    const gamesWithStats = await espnService.fetchAllCompletedGamesWithStats(SEASON_CONFIG.CURRENT_SEASON);
    
    const games = gamesWithStats.map(({ game }) => espnService.mapEspnGameToInternal(game));
    logger.info(`Successfully fetched ${games.length} games with stats from ESPN`);
    return games;
  } catch (error) {
    logger.error('Failed to fetch games from ESPN:', error);
    throw error;
  }
};

// Process and upsert players to database
const processPlayers = async (players: any[]) => {
  logger.info(`Processing ${players.length} players...`);
  
  for (const playerData of players) {
    try {
      // Upsert player
      const player = await prisma.player.upsert({
        where: { espnId: playerData.espnId },
        update: {
          name: playerData.name,
          firstName: playerData.firstName,
          lastName: playerData.lastName,
          team: playerData.team,
          position: playerData.position,
          jerseyNumber: playerData.jerseyNumber,
          height: playerData.height,
          weight: playerData.weight,
          yearsExperience: playerData.yearsExperience,
          college: playerData.college,
          activeStatus: playerData.activeStatus ?? true,
          photoUrl: playerData.photoUrl,
          updatedAt: new Date(),
        },
        create: {
          espnId: playerData.espnId,
          name: playerData.name,
          firstName: playerData.firstName,
          lastName: playerData.lastName,
          team: playerData.team,
          position: playerData.position,
          jerseyNumber: playerData.jerseyNumber,
          height: playerData.height,
          weight: playerData.weight,
          birthDate: playerData.birthDate,
          yearsExperience: playerData.yearsExperience,
          college: playerData.college,
          activeStatus: playerData.activeStatus ?? true,
          photoUrl: playerData.photoUrl,
        },
      });

      // Handle injury status if present
      if (playerData.injuryStatus && playerData.injuryStatus !== InjuryStatus.HEALTHY) {
        const existingInjury = await prisma.playerInjury.findFirst({
          where: {
            playerId: player.id,
            active: true,
          },
        });

        if (existingInjury) {
          await prisma.playerInjury.update({
            where: { id: existingInjury.id },
            data: {
              status: playerData.injuryStatus,
              description: playerData.injuryDescription || 'No details available',
              reportedDate: new Date(),
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.playerInjury.create({
            data: {
              playerId: player.id,
              status: playerData.injuryStatus,
              description: playerData.injuryDescription || 'No details available',
              reportedDate: new Date(),
              active: true,
            },
          });
        }
      } else {
        // Mark any existing injuries as inactive if player is healthy
        await prisma.playerInjury.updateMany({
          where: {
            playerId: player.id,
            active: true,
          },
          data: {
            active: false,
            updatedAt: new Date(),
          },
        });
      }

      // Create current season stats if available
      if (playerData.seasonAverages) {
        const currentDate = new Date();
        const seasonYear = currentDate.getFullYear();
        
        await prisma.playerStats.create({
          data: {
            playerId: player.id,
            gameId: `${seasonYear}-season-avg`, // Special ID for season averages
            date: currentDate,
            minutes: playerData.seasonAverages.minutes || 0,
            points: playerData.seasonAverages.points || 0,
            rebounds: playerData.seasonAverages.rebounds || 0,
            assists: playerData.seasonAverages.assists || 0,
            steals: playerData.seasonAverages.steals || 0,
            blocks: playerData.seasonAverages.blocks || 0,
            turnovers: playerData.seasonAverages.turnovers || 0,
            fouls: 0, // Not typically in season averages
            fieldGoalsMade: 0,
            fieldGoalsAttempted: 0,
            threePointersMade: 0,
            threePointersAttempted: 0,
            freeThrowsMade: 0,
            freeThrowsAttempted: 0,
            plusMinus: 0,
          },
        });
      }

      logger.debug(`Processed player: ${playerData.name} (${playerData.team})`);
    } catch (error) {
      logger.error(`Failed to process player ${playerData.name}:`, error);
    }
  }
  
  logger.info('Player processing completed');
};

// Process and upsert games to database
const processGames = async (games: any[]) => {
  logger.info(`Processing ${games.length} games...`);
  
  for (const gameData of games) {
    try {
      await prisma.game.upsert({
        where: { espnGameId: gameData.espnGameId },
        update: {
          date: gameData.date,
          homeTeam: gameData.homeTeam,
          awayTeam: gameData.awayTeam,
          homeScore: gameData.homeScore,
          awayScore: gameData.awayScore,
          status: gameData.status,
          season: gameData.season,
          attendance: gameData.attendance,
          venue: gameData.venue,
          updatedAt: new Date(),
        },
        create: {
          espnGameId: gameData.espnGameId,
          date: gameData.date,
          homeTeam: gameData.homeTeam,
          awayTeam: gameData.awayTeam,
          homeScore: gameData.homeScore,
          awayScore: gameData.awayScore,
          status: gameData.status,
          season: gameData.season,
          attendance: gameData.attendance,
          venue: gameData.venue,
        },
      });
    } catch (error) {
      logger.error(`Failed to process game ${gameData.espnGameId}:`, error);
    }
  }
  
  logger.info('Game processing completed');
};

// Fetch and process individual game stats for all completed games
const fetchAndProcessGameStats = async () => {
  logger.info('Fetching and processing individual game stats...');
  
  try {
    // Get all completed games with stats from ESPN
    const gamesWithStats = await espnService.fetchAllCompletedGamesWithStats(SEASON_CONFIG.CURRENT_SEASON);
    
    let totalStatsProcessed = 0;
    
    for (const { game, boxScore } of gamesWithStats) {
      try {
        // First ensure the game exists in our database
        const gameData = espnService.mapEspnGameToInternal(game);
        const dbGame = await prisma.game.upsert({
          where: { espnGameId: gameData.espnGameId },
          update: gameData,
          create: gameData
        });
        
        // Extract player stats from the box score
        const playerStats = espnService.extractPlayerStatsFromBoxScore(boxScore, new Date(game.competitions[0].date));
        
        // Process each player's stats
        for (const playerStat of playerStats) {
          try {
            // Find the player in our database by ESPN ID
            const player = await prisma.player.findUnique({
              where: { espnId: playerStat.playerId }
            });
            
            if (!player) {
              logger.warn(`Player not found for ESPN ID: ${playerStat.playerId} (${playerStat.playerName})`);
              continue;
            }
            
            // Upsert the player stats for this game
            await prisma.playerStats.upsert({
              where: {
                playerId_gameId: {
                  playerId: player.id,
                  gameId: dbGame.id
                }
              },
              update: {
                date: playerStat.stats.date,
                minutes: Math.round(playerStat.stats.minutes || 0),
                points: playerStat.stats.points || 0,
                rebounds: playerStat.stats.rebounds || 0,
                assists: playerStat.stats.assists || 0,
                steals: playerStat.stats.steals || 0,
                blocks: playerStat.stats.blocks || 0,
                turnovers: playerStat.stats.turnovers || 0,
                fouls: playerStat.stats.fouls || 0,
                fieldGoalsMade: playerStat.stats.fieldGoalsMade || 0,
                fieldGoalsAttempted: playerStat.stats.fieldGoalsAttempted || 0,
                threePointersMade: playerStat.stats.threePointersMade || 0,
                threePointersAttempted: playerStat.stats.threePointersAttempted || 0,
                freeThrowsMade: playerStat.stats.freeThrowsMade || 0,
                freeThrowsAttempted: playerStat.stats.freeThrowsAttempted || 0,
                plusMinus: playerStat.stats.plusMinus || 0,
                updatedAt: new Date()
              },
              create: {
                playerId: player.id,
                gameId: dbGame.id,
                date: playerStat.stats.date,
                minutes: Math.round(playerStat.stats.minutes || 0),
                points: playerStat.stats.points || 0,
                rebounds: playerStat.stats.rebounds || 0,
                assists: playerStat.stats.assists || 0,
                steals: playerStat.stats.steals || 0,
                blocks: playerStat.stats.blocks || 0,
                turnovers: playerStat.stats.turnovers || 0,
                fouls: playerStat.stats.fouls || 0,
                fieldGoalsMade: playerStat.stats.fieldGoalsMade || 0,
                fieldGoalsAttempted: playerStat.stats.fieldGoalsAttempted || 0,
                threePointersMade: playerStat.stats.threePointersMade || 0,
                threePointersAttempted: playerStat.stats.threePointersAttempted || 0,
                freeThrowsMade: playerStat.stats.freeThrowsMade || 0,
                freeThrowsAttempted: playerStat.stats.freeThrowsAttempted || 0,
                plusMinus: playerStat.stats.plusMinus || 0
              }
            });
            
            totalStatsProcessed++;
            
          } catch (statError) {
            logger.error(`Failed to process stats for player ${playerStat.playerName}:`, statError);
          }
        }
        
        logger.debug(`Processed stats for game ${game.id} (${playerStats.length} player stat entries)`);
        
      } catch (gameError) {
        logger.error(`Failed to process game ${game.id}:`, gameError);
      }
    }
    
    logger.info(`Successfully processed ${totalStatsProcessed} individual player game stats from ${gamesWithStats.length} games`);
    
  } catch (error) {
    logger.error('Failed to fetch and process game stats:', error);
    throw error;
  }
};