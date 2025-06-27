import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { Position, InjuryStatus } from '@prisma/client';
import { ESPN_API_CONFIG } from '@wnba-fantasy/shared';
import { getRedis } from '../config/redis';
import { config } from '../config/env';

// ESPN API Response Types
interface EspnTeam {
  id: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  logo: string;
}

interface EspnAthlete {
  id: string;
  uid: string;
  guid: string;
  displayName: string;
  fullName?: string;
  shortName?: string;
  firstName?: string;
  lastName?: string;
  jersey?: string;
  position?: {
    id: string;
    name: string;
    displayName: string;
    abbreviation: string;
  };
  team?: {
    id: string;
    abbreviation: string;
  };
  age?: number;
  height?: string;
  weight?: string;
  birthPlace?: {
    city?: string;
    state?: string;
    country?: string;
  };
  dateOfBirth?: string;
  college?: {
    id: string;
    name: string;
    mascot?: string;
  };
  experience?: {
    years: number;
  };
  active?: boolean;
  status?: string;
  injuries?: Array<{
    id: string;
    status: string;
    date: string;
    type: string;
    details?: {
      detail?: string;
      side?: string;
      returnDate?: string;
    };
  }>;
  headshot?: {
    href: string;
    alt?: string;
  };
  statistics?: {
    splits?: {
      categories?: Array<{
        name: string;
        stats: Array<{
          name: string;
          value: number;
          displayValue: string;
        }>;
      }>;
    };
  };
}

interface EspnRosterResponse {
  team?: {
    id: string;
    abbreviation: string;
  };
  athletes?: EspnAthlete[];
}

interface EspnPlayerStatsResponse {
  athlete?: {
    id: string;
    displayName: string;
  };
  splits?: {
    categories?: Array<{
      name: string;
      displayName: string;
      type?: string;
      stats: Array<{
        name: string;
        displayName: string;
        shortDisplayName?: string;
        description?: string;
        abbreviation: string;
        value: number;
        displayValue: string;
      }>;
    }>;
  };
  statistics?: {
    season?: {
      year: number;
      displayName: string;
    };
  };
}

interface EspnGame {
  id: string;
  uid: string;
  date: string;
  season: {
    year: number;
    type: number;
  };
  competitions: Array<{
    id: string;
    date: string;
    attendance?: number;
    venue?: {
      id: string;
      fullName: string;
    };
    competitors: Array<{
      id: string;
      uid: string;
      type: string;
      homeAway: string;
      team: {
        id: string;
        uid: string;
        abbreviation: string;
        displayName: string;
      };
      score?: string;
      record?: Array<{
        name: string;
        abbreviation: string;
        type: string;
        summary: string;
      }>;
    }>;
    status: {
      clock: number;
      displayClock: string;
      period: number;
      type: {
        id: string;
        name: string;
        state: string;
        completed: boolean;
        description: string;
        detail: string;
        shortDetail: string;
      };
    };
  }>;
}

interface EspnGameResponse {
  events: EspnGame[];
}

interface EspnBoxScore {
  gameId: string;
  players: Array<{
    team: {
      id: string;
      abbreviation: string;
    };
    statistics: Array<{
      names: string[];
      keys: string[];
      labels: string[];
      descriptions: string[];
      athletes: Array<{
        athlete: {
          id: string;
          displayName: string;
        };
        stats: string[];
      }>;
    }>;
  }>;
}

class EspnService {
  private api: AxiosInstance;
  private requestCount: number = 0;
  private lastRequestTime: number = Date.now();
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue: boolean = false;

  constructor() {
    this.api = axios.create({
      baseURL: ESPN_API_CONFIG.BASE_URL,
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'WNBA-Fantasy-Analytics/1.0',
      },
    });

    // Add response interceptor for logging
    this.api.interceptors.response.use(
      (response) => {
        logger.debug(`ESPN API Response: ${response.config.url} - Status: ${response.status}`);
        return response;
      },
      (error) => {
        if (error.response?.status !== 404) {
          logger.error(`ESPN API Error: ${error.config?.url} - ${error.message}`);
        }
        return Promise.reject(error);
      }
    );
  }

  // Rate limiting implementation
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // ESPN rate limit: 60 requests per minute
    const minTimeBetweenRequests = 1000; // 1 second between requests to be safe
    
    if (timeSinceLastRequest < minTimeBetweenRequests) {
      const waitTime = minTimeBetweenRequests - timeSinceLastRequest;
      logger.debug(`Rate limiting: waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  // Queue a request with rate limiting
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          await this.enforceRateLimit();
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  // Process the request queue
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
      }
    }
    
    this.isProcessingQueue = false;
  }

  // Fetch all WNBA teams
  async fetchAllTeams(): Promise<EspnTeam[]> {
    logger.info('Fetching all WNBA teams from ESPN API...');
    
    const cacheKey = 'espn:teams:all';
    const redis = await getRedis();
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached teams data');
      return JSON.parse(cached);
    }
    
    try {
      const response = await this.queueRequest(() => 
        this.api.get('/teams', {
          params: {
            limit: 20, // All WNBA teams
          },
        })
      );
      
      const teams = response.data?.sports?.[0]?.leagues?.[0]?.teams || [];
      const teamsData = teams.map((t: any) => ({
        id: t.team.id,
        abbreviation: t.team.abbreviation,
        displayName: t.team.displayName,
        shortDisplayName: t.team.shortDisplayName,
        logo: t.team.logos?.[0]?.href || '',
      }));
      
      // Cache for 24 hours
      await redis.setEx(cacheKey, 86400, JSON.stringify(teamsData));
      
      logger.info(`Fetched ${teamsData.length} teams`);
      return teamsData;
    } catch (error) {
      logger.error('Failed to fetch teams:', error);
      throw error;
    }
  }

  // Fetch roster for a specific team
  async fetchTeamRoster(teamId: string): Promise<EspnAthlete[]> {
    logger.info(`Fetching roster for team ${teamId}...`);
    
    const cacheKey = `espn:roster:${teamId}`;
    const redis = await getRedis();
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug(`Returning cached roster for team ${teamId}`);
      return JSON.parse(cached);
    }
    
    try {
      const response = await this.queueRequest(() =>
        this.api.get(`/teams/${teamId}/roster`)
      );
      
      // ESPN roster endpoint may return data in different formats
      let athletes: EspnAthlete[] = [];
      
      if (response.data?.athletes) {
        // Standard format
        athletes = response.data.athletes;
      } else if (response.data?.roster) {
        // Alternative format
        athletes = response.data.roster;
      } else if (Array.isArray(response.data)) {
        // Direct array
        athletes = response.data;
      } else {
        logger.warn(`Unexpected roster format for team ${teamId}`);
      }
      
      // Ensure each athlete has required fields
      athletes = athletes.map((athlete: any) => {
        // Handle different athlete data structures
        if (athlete.athlete) {
          // Nested athlete object
          return {
            ...athlete.athlete,
            position: athlete.position || athlete.athlete.position,
            jersey: athlete.jersey || athlete.athlete.jersey,
          };
        }
        return athlete;
      });
      
      // Cache for 12 hours
      await redis.setEx(cacheKey, 43200, JSON.stringify(athletes));
      
      logger.info(`Fetched ${athletes.length} players for team ${teamId}`);
      return athletes;
    } catch (error: any) {
      logger.error(`Failed to fetch roster for team ${teamId}: ${error.message}`);
      return [];
    }
  }

  // Fetch detailed player information
  async fetchPlayerDetails(playerId: string): Promise<EspnAthlete | null> {
    logger.debug(`Fetching details for player ${playerId}...`);
    
    const cacheKey = `espn:player:${playerId}`;
    const redis = await getRedis();
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    try {
      const response = await this.queueRequest(() =>
        this.api.get(`/athletes/${playerId}`)
      );
      
      const athlete = response.data?.athlete;
      if (!athlete) return null;
      
      // Cache for 6 hours
      await redis.setEx(cacheKey, 21600, JSON.stringify(athlete));
      
      return athlete;
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Player ${playerId} not found in ESPN API`);
      } else {
        logger.error(`Failed to fetch player ${playerId}: ${error.message}`);
      }
      return null;
    }
  }

  // Fetch player statistics
  async fetchPlayerStats(playerId: string, season: number = 2025): Promise<EspnPlayerStatsResponse | null> {
    logger.debug(`Fetching stats for player ${playerId} in season ${season}...`);
    
    const cacheKey = `espn:playerstats:${playerId}:${season}`;
    const redis = await getRedis();
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    try {
      const response = await this.queueRequest(() =>
        this.api.get(`/athletes/${playerId}/statistics`, {
          params: {
            season,
          },
        })
      );
      
      const statsData = response.data;
      
      // Cache for 3 hours during season
      await redis.setEx(cacheKey, 10800, JSON.stringify(statsData));
      
      return statsData;
    } catch (error) {
      logger.error(`Failed to fetch stats for player ${playerId}:`, error);
      return null;
    }
  }

  // Fetch all current WNBA players
  async fetchAllPlayers(): Promise<any[]> {
    logger.info('Fetching all WNBA players...');
    
    const teams = await this.fetchAllTeams();
    const allPlayers: any[] = [];
    
    // Fetch roster for each team
    for (const team of teams) {
      logger.info(`Fetching roster for ${team.displayName} (${team.abbreviation})...`);
      
      try {
        const roster = await this.fetchTeamRoster(team.id);
        
        for (const athlete of roster) {
          // The roster endpoint already returns full player data
          if (athlete.id && (athlete.fullName || athlete.displayName)) {
            const playerData = this.mapEspnPlayerToInternal(athlete, team, null);
            if (playerData.name && playerData.espnId) {
              allPlayers.push(playerData);
              logger.debug(`Processed player: ${playerData.name} (${team.abbreviation})`);
            }
          }
        }
      } catch (error: any) {
        logger.error(`Failed to process team ${team.abbreviation}: ${error.message}`);
      }
    }
    
    logger.info(`Successfully fetched ${allPlayers.length} players`);
    return allPlayers;
  }

  // Fetch games schedule for a season - comprehensive approach
  async fetchGamesSchedule(season: number = 2025): Promise<EspnGame[]> {
    logger.info(`Fetching comprehensive games schedule for ${season} season...`);
    
    const cacheKey = `espn:schedule:${season}`;
    const redis = await getRedis();
    
    // Check cache (shorter cache for current season)
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug(`Returning cached schedule for ${season}`);
      return JSON.parse(cached);
    }
    
    try {
      let allGames: EspnGame[] = [];
      
      // WNBA season typically runs May through September
      const seasonStart = new Date(season, 4, 1); // May 1st
      const seasonEnd = new Date(season, 8, 30);   // September 30th
      const now = new Date();
      
      // Determine the actual end date (current date if season is ongoing)
      const endDate = seasonEnd > now ? now : seasonEnd;
      
      logger.info(`Fetching games from ${seasonStart.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      
      // Try multiple approaches to get all games
      
      // Approach 1: Try to get all games for the season
      try {
        const response = await this.queueRequest(() =>
          this.api.get('/scoreboard', {
            params: {
              dates: season,
              limit: 500,
            },
          })
        );
        
        if (response.data?.events && response.data.events.length > 0) {
          allGames = response.data.events;
          logger.info(`Approach 1: Fetched ${allGames.length} games directly`);
        }
      } catch (error) {
        logger.debug('Approach 1 failed, trying date range approach');
      }
      
      // Approach 2: If approach 1 didn't work, try monthly chunks
      if (allGames.length === 0) {
        logger.info('Fetching games by monthly chunks...');
        
        const currentDate = new Date(seasonStart);
        
        while (currentDate <= endDate) {
          const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          
          try {
            const dateStr = `${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            
            const response = await this.queueRequest(() =>
              this.api.get('/scoreboard', {
                params: {
                  dates: dateStr,
                  limit: 100,
                },
              })
            );
            
            if (response.data?.events) {
              allGames.push(...response.data.events);
              logger.debug(`Added ${response.data.events.length} games for ${dateStr}`);
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            logger.warn(`Failed to fetch games for month ${currentDate.getMonth() + 1}/${currentDate.getFullYear()}:`, error);
          }
          
          // Move to next month
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
        
        logger.info(`Approach 2: Fetched ${allGames.length} games via monthly chunks`);
      }
      
      // Approach 3: If still no games, try getting recent games
      if (allGames.length === 0) {
        logger.warn('No games found via date approaches, trying recent games...');
        
        try {
          const response = await this.queueRequest(() =>
            this.api.get('/scoreboard')
          );
          
          if (response.data?.events) {
            allGames = response.data.events;
            logger.info(`Approach 3: Fetched ${allGames.length} recent games`);
          }
        } catch (error) {
          logger.error('All approaches failed to fetch games:', error);
        }
      }
      
      // Remove duplicates based on game ID
      const uniqueGames = allGames.filter((game, index, self) => 
        index === self.findIndex(g => g.id === game.id)
      );
      
      // Sort by date
      uniqueGames.sort((a, b) => 
        new Date(a.competitions[0]?.date || a.date).getTime() - 
        new Date(b.competitions[0]?.date || b.date).getTime()
      );
      
      logger.info(`Final result: ${uniqueGames.length} unique games for ${season} season`);
      
      // Cache for shorter time during active season
      const cacheTime = season === new Date().getFullYear() ? 3600 : 86400; // 1 hour vs 24 hours
      await redis.setEx(cacheKey, cacheTime, JSON.stringify(uniqueGames));
      
      return uniqueGames;
      
    } catch (error) {
      logger.error(`Failed to fetch games schedule for ${season}:`, error);
      return [];
    }
  }

  // Fetch box score for a specific game
  async fetchGameBoxScore(gameId: string): Promise<EspnBoxScore | null> {
    logger.debug(`Fetching box score for game ${gameId}...`);
    
    const cacheKey = `espn:boxscore:${gameId}`;
    const redis = await getRedis();
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    
    try {
      // Try multiple ESPN endpoints for box score data
      let boxScore: EspnBoxScore | null = null;
      
      // Approach 1: Try the dedicated boxscore endpoint
      try {
        const boxscoreResponse = await this.queueRequest(() =>
          this.api.get(`/events/${gameId}/boxscore`)
        );
        boxScore = this.parseBoxScoreFromResponse(boxscoreResponse.data, gameId);
        if (boxScore && boxScore.players.some(team => 
          team.statistics.some(stat => stat.athletes && stat.athletes.length > 0)
        )) {
          logger.debug(`✅ Got box score from /events/${gameId}/boxscore`);
        } else {
          boxScore = null;
        }
      } catch (error) {
        logger.debug(`❌ /events/${gameId}/boxscore failed:`, error.message);
      }
      
      // Approach 2: Try the summary endpoint (original approach)
      if (!boxScore) {
        try {
          const summaryResponse = await this.queueRequest(() =>
            this.api.get(`/summary?event=${gameId}`)
          );
          boxScore = this.parseBoxScoreFromSummary(summaryResponse.data, gameId);
          if (boxScore && boxScore.players.some(team => 
            team.statistics.some(stat => stat.athletes && stat.athletes.length > 0)
          )) {
            logger.debug(`✅ Got box score from /summary?event=${gameId}`);
          } else {
            boxScore = null;
          }
        } catch (error) {
          logger.debug(`❌ /summary?event=${gameId} failed:`, error.message);
        }
      }
      
      // Approach 3: Try alternate boxscore endpoint
      if (!boxScore) {
        try {
          const altResponse = await this.queueRequest(() =>
            this.api.get(`/boxscore?event=${gameId}`)
          );
          boxScore = this.parseBoxScoreFromResponse(altResponse.data, gameId);
          if (boxScore && boxScore.players.some(team => 
            team.statistics.some(stat => stat.athletes && stat.athletes.length > 0)
          )) {
            logger.debug(`✅ Got box score from /boxscore?event=${gameId}`);
          } else {
            boxScore = null;
          }
        } catch (error) {
          logger.debug(`❌ /boxscore?event=${gameId} failed:`, error.message);
        }
      }
      
      // Approach 4: Try game recap endpoint
      if (!boxScore) {
        try {
          const recapResponse = await this.queueRequest(() =>
            this.api.get(`/recap?event=${gameId}`)
          );
          boxScore = this.parseBoxScoreFromResponse(recapResponse.data, gameId);
          if (boxScore && boxScore.players.some(team => 
            team.statistics.some(stat => stat.athletes && stat.athletes.length > 0)
          )) {
            logger.debug(`✅ Got box score from /recap?event=${gameId}`);
          }
        } catch (error) {
          logger.debug(`❌ /recap?event=${gameId} failed:`, error.message);
        }
      }
      
      if (boxScore) {
        // Cache completed games for 24 hours, live games for 5 minutes
        const cacheTime = 86400; // 24 hours for any found data
        await redis.setEx(cacheKey, cacheTime, JSON.stringify(boxScore));
        return boxScore;
      } else {
        logger.warn(`❌ No valid box score found for game ${gameId} from any endpoint`);
        return null;
      }
      
    } catch (error) {
      logger.error(`Failed to fetch box score for game ${gameId}:`, error);
      return null;
    }
  }
  
  // Parse box score from different response types
  private parseBoxScoreFromResponse(data: any, gameId: string): EspnBoxScore | null {
    // This handles the direct boxscore endpoint responses
    try {
      const players: EspnBoxScore['players'] = [];
      
      // PRIORITY 1: Try the players structure (this is where the actual player stats are!)
      if (data?.players) {
        logger.debug(`Found data.players with ${data.players.length} teams`);
        
        for (const teamData of data.players) {
          logger.debug(`Processing team ${teamData.team?.abbreviation || 'unknown'} with ${teamData.statistics?.length || 0} stat groups`);
          
          if (teamData.statistics && teamData.statistics.length > 0) {
            // Check if this stat group actually has player data
            const hasPlayerData = teamData.statistics.some(group => 
              group.athletes && group.athletes.length > 0
            );
            
            logger.debug(`  Has player data: ${hasPlayerData}`);
            
            if (hasPlayerData) {
              players.push({
                team: {
                  id: teamData.team?.id || 'unknown',
                  abbreviation: teamData.team?.abbreviation || 'UNK',
                },
                statistics: teamData.statistics,
              });
              
              logger.debug(`✅ Found player data for team ${teamData.team?.abbreviation}: ${teamData.statistics[0]?.athletes?.length || 0} players`);
            }
          }
        }
      }
      
      // FALLBACK: Try team statistics (usually empty but just in case)
      if (players.length === 0 && data?.teams) {
        logger.debug(`No players found, trying data.teams with ${data.teams.length} teams`);
        
        for (const team of data.teams) {
          if (team.statistics && team.statistics.length > 0) {
            // Check if this stat group actually has player data
            const hasPlayerData = team.statistics.some(group => 
              group.athletes && group.athletes.length > 0
            );
            
            if (hasPlayerData) {
              players.push({
                team: {
                  id: team.team?.id || team.id,
                  abbreviation: team.team?.abbreviation || team.abbreviation,
                },
                statistics: team.statistics,
              });
            }
          }
        }
      }
      
      if (players.length > 0) {
        logger.debug(`✅ Parsed box score for game ${gameId}: ${players.length} teams`);
        return { gameId, players };
      }
      
      return null;
    } catch (error) {
      logger.error(`Error parsing box score response for game ${gameId}:`, error);
      return null;
    }
  }

  // Fetch all completed games with box scores for current season
  async fetchAllCompletedGamesWithStats(season: number = 2025): Promise<Array<{game: EspnGame, boxScore: EspnBoxScore}>> {
    logger.info(`Fetching all completed games with stats for ${season}...`);
    
    const games = await this.fetchGamesSchedule(season);
    const completedGames = games.filter(game => 
      game.competitions[0]?.status?.type?.completed === true
    );
    
    logger.info(`Found ${completedGames.length} completed games`);
    
    const gamesWithStats: Array<{game: EspnGame, boxScore: EspnBoxScore}> = [];
    
    // Process games in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < completedGames.length; i += batchSize) {
      const batch = completedGames.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (game) => {
        const boxScore = await this.fetchGameBoxScore(game.id);
        if (boxScore) {
          return { game, boxScore };
        }
        return null;
      });
      
      const batchResults = await Promise.all(batchPromises);
      gamesWithStats.push(...batchResults.filter(result => result !== null) as Array<{game: EspnGame, boxScore: EspnBoxScore}>);
      
      // Small delay between batches
      if (i + batchSize < completedGames.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    logger.info(`Successfully fetched stats for ${gamesWithStats.length} games`);
    return gamesWithStats;
  }

  // Parse box score data from ESPN summary response
  private parseBoxScoreFromSummary(data: any, gameId: string): EspnBoxScore | null {
    try {
      // ESPN can have different response structures, try multiple paths
      let boxscore = data?.boxscore;
      
      // Alternative paths for ESPN responses
      if (!boxscore) {
        boxscore = data?.boxScore;
      }
      if (!boxscore) {
        boxscore = data?.gamepackage?.boxscore;
      }
      if (!boxscore) {
        boxscore = data?.content?.boxscore;
      }
      
      if (!boxscore || (!boxscore.teams && !boxscore.players)) return null;
      
      const players: EspnBoxScore['players'] = [];
      
      // PRIORITY 1: Try the players structure (this is where the actual player stats are!)
      if (boxscore.players) {
        logger.debug(`Found boxscore.players with ${boxscore.players.length} teams`);
        
        for (const teamData of boxscore.players) {
          logger.debug(`Processing team ${teamData.team?.abbreviation || 'unknown'} with ${teamData.statistics?.length || 0} stat groups`);
          
          if (teamData.statistics && teamData.statistics.length > 0) {
            // Check if this stat group actually has player data
            const hasPlayerData = teamData.statistics.some(group => 
              group.athletes && group.athletes.length > 0
            );
            
            logger.debug(`  Has player data: ${hasPlayerData}`);
            
            if (hasPlayerData) {
              players.push({
                team: {
                  id: teamData.team?.id || 'unknown',
                  abbreviation: teamData.team?.abbreviation || 'UNK',
                },
                statistics: teamData.statistics,
              });
              
              logger.debug(`✅ Found player data for team ${teamData.team?.abbreviation}: ${teamData.statistics[0]?.athletes?.length || 0} players`);
            } else {
              // Debug why no player data was found
              logger.debug(`  No player data found for ${teamData.team?.abbreviation}:`);
              teamData.statistics.forEach((group, idx) => {
                logger.debug(`    Group ${idx}: ${group.athletes?.length || 0} athletes`);
              });
            }
          }
        }
      } else {
        logger.debug('No boxscore.players found');
      }
      
      // FALLBACK: Try team statistics (usually empty but just in case)
      if (players.length === 0 && boxscore.teams) {
        for (const team of boxscore.teams) {
          if (team.statistics && team.statistics.length > 0) {
            // Check if this stat group actually has player data
            const hasPlayerData = team.statistics.some(group => 
              group.athletes && group.athletes.length > 0
            );
            
            if (hasPlayerData) {
              players.push({
                team: {
                  id: team.team?.id || team.id,
                  abbreviation: team.team?.abbreviation || team.abbreviation,
                },
                statistics: team.statistics,
              });
            }
          }
        }
      }
      
      if (players.length > 0) {
        const totalPlayers = players.reduce((sum, team) => 
          sum + (team.statistics[0]?.athletes?.length || 0), 0
        );
        logger.debug(`✅ Parsed box score for game ${gameId}: ${players.length} teams, ${totalPlayers} total players`);
      } else {
        logger.warn(`❌ No player data found in box score for game ${gameId}`);
      }
      
      return {
        gameId,
        players,
      };
    } catch (error) {
      logger.error(`Error parsing box score for game ${gameId}:`, error);
      return null;
    }
  }

  // Check if a game is completed
  private isGameCompleted(gameData: any): boolean {
    return gameData?.header?.competitions?.[0]?.status?.type?.completed === true ||
           gameData?.competitions?.[0]?.status?.type?.completed === true;
  }

  // Convert ESPN game data to internal game format
  mapEspnGameToInternal(espnGame: EspnGame): any {
    const competition = espnGame.competitions[0];
    const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
    const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
    
    return {
      espnGameId: espnGame.id,
      date: new Date(competition.date),
      homeTeam: homeTeam?.team.abbreviation || '',
      awayTeam: awayTeam?.team.abbreviation || '',
      homeScore: homeTeam?.score ? parseInt(homeTeam.score) : null,
      awayScore: awayTeam?.score ? parseInt(awayTeam.score) : null,
      status: this.mapGameStatus(competition.status.type.name),
      season: espnGame.season.year,
      attendance: competition.attendance || null,
      venue: competition.venue?.fullName || null,
    };
  }

  // Map ESPN game status to our GameStatus enum
  private mapGameStatus(espnStatus: string): any {
    const status = espnStatus.toLowerCase();
    
    if (status.includes('final')) return 'FINAL';
    if (status.includes('progress') || status.includes('live')) return 'IN_PROGRESS';
    if (status.includes('postponed')) return 'POSTPONED';
    if (status.includes('canceled') || status.includes('cancelled')) return 'CANCELED';
    
    return 'SCHEDULED';
  }

  // Extract player stats from ESPN box score
  extractPlayerStatsFromBoxScore(boxScore: EspnBoxScore, gameDate: Date): Array<{
    playerId: string;
    playerName: string;
    team: string;
    stats: any;
  }> {
    const playerStats: Array<{
      playerId: string;
      playerName: string;
      team: string;
      stats: any;
    }> = [];
    
    logger.debug(`Extracting stats from ${boxScore.players.length} teams`);
    
    for (const teamData of boxScore.players) {
      logger.debug(`Processing team ${teamData.team.abbreviation} with ${teamData.statistics.length} stat groups`);
      
      // Look for stat groups that contain player data
      for (let i = 0; i < teamData.statistics.length; i++) {
        const statGroup = teamData.statistics[i];
        
        // Check if this stat group has athletes/players
        if (!statGroup.athletes || statGroup.athletes.length === 0) {
          continue;
        }
        
        logger.debug(`  Stat group ${i}: ${statGroup.athletes.length} athletes`);
        
        // Look for the comprehensive stats group (usually has most columns)
        const hasGoodStats = statGroup.athletes.some(athlete => 
          athlete.stats && athlete.stats.length > 5 // Should have multiple stats
        );
        
        if (!hasGoodStats) {
          logger.debug(`  Skipping stat group ${i}: insufficient stats`);
          continue;
        }
        
        // Process each athlete in this stat group
        for (const athleteData of statGroup.athletes) {
          if (!athleteData.athlete || !athleteData.stats) {
            logger.debug(`    Skipping athlete: missing data`);
            continue;
          }
          
          // Try different key arrays for parsing
          let keys = statGroup.keys;
          if (!keys || keys.length === 0) {
            keys = statGroup.names;
          }
          if (!keys || keys.length === 0) {
            keys = statGroup.labels;
          }
          
          logger.debug(`    Processing ${athleteData.athlete.displayName}:`);
          logger.debug(`      Keys: [${keys?.slice(0, 5).join(', ') || 'none'}]`);
          logger.debug(`      Stats: [${athleteData.stats?.slice(0, 5).join(', ') || 'none'}]`);
          
          const stats = this.parsePlayerStatsFromEspnArray(keys, athleteData.stats);
          
          if (stats) {
            logger.debug(`      Parsed: ${stats.points}pts, ${stats.rebounds}reb, ${stats.assists}ast, ${stats.minutes}min`);
            
            // Include all players who have any stats (not just those who played)
            playerStats.push({
              playerId: athleteData.athlete.id,
              playerName: athleteData.athlete.displayName,
              team: teamData.team.abbreviation,
              stats: {
                ...stats,
                date: gameDate,
              },
            });
            
            logger.debug(`    ✅ Added: ${athleteData.athlete.displayName} - ${stats.points}pts, ${stats.minutes}min`);
          } else {
            logger.debug(`    ❌ Failed to parse stats for ${athleteData.athlete.displayName}`);
          }
        }
        
        // If we found good player stats in this group, we're probably done for this team
        if (playerStats.filter(p => p.team === teamData.team.abbreviation).length > 0) {
          logger.debug(`  Found valid stats for team ${teamData.team.abbreviation}, moving to next team`);
          break;
        }
      }
    }
    
    logger.debug(`Total extracted stats: ${playerStats.length} players`);
    return playerStats;
  }

  // Parse individual player stats from ESPN stats array
  private parsePlayerStatsFromEspnArray(keys: string[], values: string[]): any | null {
    if (!keys || !values || keys.length !== values.length) {
      logger.debug(`❌ Keys/values mismatch: ${keys?.length || 0} keys, ${values?.length || 0} values`);
      return null;
    }
    
    const stats: any = {
      minutes: 0,
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      threePointersMade: 0,
      threePointersAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      plusMinus: 0,
    };
    
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]?.toLowerCase() || '';
      const value = values[i];
      
      if (!value || value === '--' || value === '') continue;
      
      try {
        // Parse based on ESPN's actual key formats
        if (key === 'minutes') {
          // ESPN gives minutes as integer
          stats.minutes = parseInt(value) || 0;
        }
        else if (key === 'fieldgoalsmade-fieldgoalsattempted') {
          // Format: "5-8"
          const [made, attempted] = value.split('-').map(Number);
          stats.fieldGoalsMade = made || 0;
          stats.fieldGoalsAttempted = attempted || 0;
        }
        else if (key === 'threepointfieldgoalsmade-threepointfieldgoalsattempted') {
          // Format: "0-1"
          const [made, attempted] = value.split('-').map(Number);
          stats.threePointersMade = made || 0;
          stats.threePointersAttempted = attempted || 0;
        }
        else if (key === 'freethrowsmade-freethrowsattempted') {
          // Format: "4-8"
          const [made, attempted] = value.split('-').map(Number);
          stats.freeThrowsMade = made || 0;
          stats.freeThrowsAttempted = attempted || 0;
        }
        else if (key === 'points') {
          stats.points = parseInt(value) || 0;
        }
        else if (key === 'rebounds') {
          stats.rebounds = parseInt(value) || 0;
        }
        else if (key === 'assists') {
          stats.assists = parseInt(value) || 0;
        }
        else if (key === 'steals') {
          stats.steals = parseInt(value) || 0;
        }
        else if (key === 'blocks') {
          stats.blocks = parseInt(value) || 0;
        }
        else if (key === 'turnovers') {
          stats.turnovers = parseInt(value) || 0;
        }
        else if (key === 'fouls') {
          stats.fouls = parseInt(value) || 0;
        }
        else if (key === 'plusminus') {
          // Format: "+10" or "-6"
          stats.plusMinus = parseInt(value) || 0;
        }
        // Handle alternative key formats
        else if (key.includes('fieldgoals') && key.includes('made') && key.includes('attempted')) {
          const [made, attempted] = value.split('-').map(Number);
          stats.fieldGoalsMade = made || 0;
          stats.fieldGoalsAttempted = attempted || 0;
        }
        else if (key.includes('threepoint') && key.includes('made') && key.includes('attempted')) {
          const [made, attempted] = value.split('-').map(Number);
          stats.threePointersMade = made || 0;
          stats.threePointersAttempted = attempted || 0;
        }
        else if (key.includes('freethrow') && key.includes('made') && key.includes('attempted')) {
          const [made, attempted] = value.split('-').map(Number);
          stats.freeThrowsMade = made || 0;
          stats.freeThrowsAttempted = attempted || 0;
        }
        // Legacy parsing for different formats
        else if (key.includes('min')) {
          if (value.includes(':')) {
            // Format: "29:30"
            const [mins, secs] = value.split(':').map(Number);
            stats.minutes = mins + (secs / 60);
          } else {
            // Format: "29"
            stats.minutes = parseInt(value) || 0;
          }
        }
        else if (key.includes('fg') && !key.includes('3') && !key.includes('ft')) {
          const [made, attempted] = value.split('-').map(Number);
          stats.fieldGoalsMade = made || 0;
          stats.fieldGoalsAttempted = attempted || 0;
        }
        else if (key.includes('3') && (key.includes('pt') || key.includes('p'))) {
          const [made, attempted] = value.split('-').map(Number);
          stats.threePointersMade = made || 0;
          stats.threePointersAttempted = attempted || 0;
        }
        else if (key.includes('ft')) {
          const [made, attempted] = value.split('-').map(Number);
          stats.freeThrowsMade = made || 0;
          stats.freeThrowsAttempted = attempted || 0;
        }
        else if (key.includes('pts') || key.includes('point')) {
          stats.points = parseInt(value) || 0;
        }
        else if (key.includes('reb')) {
          stats.rebounds = parseInt(value) || 0;
        }
        else if (key.includes('ast')) {
          stats.assists = parseInt(value) || 0;
        }
        else if (key.includes('stl')) {
          stats.steals = parseInt(value) || 0;
        }
        else if (key.includes('blk')) {
          stats.blocks = parseInt(value) || 0;
        }
        else if (key.includes('to') || key.includes('tov') || key.includes('turnover')) {
          stats.turnovers = parseInt(value) || 0;
        }
        else if (key.includes('pf') || key.includes('foul')) {
          stats.fouls = parseInt(value) || 0;
        }
        else if (key.includes('+') || key.includes('plus') || key.includes('minus')) {
          stats.plusMinus = parseInt(value) || 0;
        }
        
      } catch (error) {
        logger.debug(`⚠️  Error parsing ${key}: ${value} - ${error.message}`);
      }
    }
    
    logger.debug(`✅ Parsed stats: ${stats.points}pts, ${stats.rebounds}reb, ${stats.assists}ast, ${stats.minutes}min`);
    return stats;
  }

  // Map ESPN data to our internal format
  private mapEspnPlayerToInternal(
    athlete: EspnAthlete, 
    team: EspnTeam,
    stats: EspnPlayerStatsResponse | null
  ): any {
    // Handle both detailed and basic athlete data
    const athleteData = athlete as any;
    
    // Parse height from displayHeight (e.g., "5' 11\"")
    let height = null;
    if (athleteData.displayHeight) {
      height = athleteData.displayHeight.replace(/\s+/g, '');
    } else if (athleteData.height) {
      // If only numeric height, convert to feet/inches
      const totalInches = athleteData.height;
      const feet = Math.floor(totalInches / 12);
      const inches = totalInches % 12;
      height = `${feet}'${inches}"`;
    }
    
    // Weight is already a number in the roster response
    const weight = athleteData.weight || null;
    
    // Map position
    const position = this.mapPosition(athleteData.position?.abbreviation);
    
    // Parse date of birth
    const birthDate = athleteData.dateOfBirth ? 
      new Date(athleteData.dateOfBirth) : null;
    
    // Get season averages from stats
    const seasonAverages = this.extractSeasonAverages(stats);
    
    // Check injury status
    const currentInjury = athleteData.injuries && athleteData.injuries.length > 0 ? 
      athleteData.injuries[0] : null;
    
    return {
      espnId: athleteData.id,
      name: athleteData.fullName || athleteData.displayName,
      firstName: athleteData.firstName || athleteData.fullName?.split(' ')[0],
      lastName: athleteData.lastName || athleteData.fullName?.split(' ').slice(1).join(' '),
      team: team.abbreviation,
      position,
      jerseyNumber: athleteData.jersey ? parseInt(athleteData.jersey) : null,
      height,
      weight,
      birthDate,
      yearsExperience: athleteData.experience?.years || 0,
      college: athleteData.college?.name || null,
      activeStatus: athleteData.status?.type === 'active' || athleteData.active !== false,
      photoUrl: athleteData.headshot?.href || null,
      // Include injury info if available
      injuryStatus: currentInjury ? 
        this.mapInjuryStatus(currentInjury.status || currentInjury.type) : 
        InjuryStatus.HEALTHY,
      injuryDescription: currentInjury?.details?.detail || 
        currentInjury?.description || null,
      // Include season stats
      seasonAverages,
    };
  }

  // Extract season averages from ESPN stats response
  private extractSeasonAverages(stats: EspnPlayerStatsResponse | null): any {
    if (!stats?.splits?.categories) return null;
    
    const averages: any = {};
    
    for (const category of stats.splits.categories) {
      if (category.name === 'avgStats' || category.type === 'perGame') {
        for (const stat of category.stats) {
          switch (stat.abbreviation) {
            case 'PPG':
              averages.points = stat.value;
              break;
            case 'RPG':
              averages.rebounds = stat.value;
              break;
            case 'APG':
              averages.assists = stat.value;
              break;
            case 'SPG':
              averages.steals = stat.value;
              break;
            case 'BPG':
              averages.blocks = stat.value;
              break;
            case 'TPG':
              averages.turnovers = stat.value;
              break;
            case 'MPG':
              averages.minutes = stat.value;
              break;
            case 'FG%':
              averages.fieldGoalPercentage = stat.value;
              break;
            case '3P%':
              averages.threePointPercentage = stat.value;
              break;
            case 'FT%':
              averages.freeThrowPercentage = stat.value;
              break;
          }
        }
      }
    }
    
    return Object.keys(averages).length > 0 ? averages : null;
  }

  // Map ESPN position to our Position enum
  private mapPosition(espnPosition?: string): Position {
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
      case 'G/F':
        return Position.G_F;
      case 'F-C':
      case 'F/C':
        return Position.F_C;
      default:
        return Position.G;
    }
  }

  // Map ESPN injury status to our InjuryStatus enum
  private mapInjuryStatus(espnStatus?: string): InjuryStatus {
    if (!espnStatus) return InjuryStatus.HEALTHY;
    
    const status = espnStatus.toLowerCase();
    
    if (status.includes('questionable')) return InjuryStatus.QUESTIONABLE;
    if (status.includes('doubtful')) return InjuryStatus.DOUBTFUL;
    if (status.includes('out')) return InjuryStatus.OUT;
    if (status.includes('day-to-day') || status.includes('dtd')) return InjuryStatus.DAY_TO_DAY;
    
    return InjuryStatus.HEALTHY;
  }
}

// Export singleton instance
export const espnService = new EspnService();