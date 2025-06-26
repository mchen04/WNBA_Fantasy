import { SubscriptionTier, SubscriptionPlan } from '../types';

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  [SubscriptionTier.FREE]: {
    tier: SubscriptionTier.FREE,
    name: 'Free',
    price: 0,
    features: [
      'Current season player statistics',
      'Basic sorting and filtering',
      'Default fantasy scoring system',
      'Custom fantasy scoring configuration',
      'Team and player rankings',
      'Season totals and per-game averages'
    ],
    limits: {
      customScoringConfigs: 3,
      tradeCalculations: 0,
      apiCalls: 1000
    }
  },
  [SubscriptionTier.PRO]: {
    tier: SubscriptionTier.PRO,
    name: 'Pro',
    price: 1499, // $14.99 in cents
    features: [
      'All Free tier features',
      'Consistency scores with standard deviation analysis',
      'Hot player detection',
      'Trending minutes analysis', 
      'Trade calculator with multi-player analysis',
      'Value assessment and trade projections',
      'Advanced filtering and analytics'
    ],
    limits: {
      customScoringConfigs: 10,
      tradeCalculations: 100,
      apiCalls: 10000
    }
  },
  [SubscriptionTier.PRO_PLUS]: {
    tier: SubscriptionTier.PRO_PLUS,
    name: 'Pro+',
    price: 2499, // $24.99 in cents
    features: [
      'All Pro tier features',
      'Daily waiver wire recommendations',
      'Top 10 available players for game day',
      'Injury status filtering',
      'Hot streak analysis in recommendations',
      'Matchup difficulty analysis',
      'Advanced recommendation algorithms'
    ],
    limits: {
      customScoringConfigs: -1, // Unlimited
      tradeCalculations: -1, // Unlimited
      apiCalls: -1 // Unlimited
    }
  }
};

export const DEFAULT_SCORING_CONFIG = {
  pointsMultiplier: 1,
  reboundsMultiplier: 1,
  assistsMultiplier: 1,
  blocksMultiplier: 2,
  stealsMultiplier: 2,
  threePointersMultiplier: 1,
  turnoversMultiplier: -1
};

export const CACHE_DURATIONS = {
  PLAYER_STATS: 15 * 60, // 15 minutes in seconds
  FANTASY_RANKINGS: 5 * 60, // 5 minutes
  CONSISTENCY_SCORES: 60 * 60, // 1 hour
  DAILY_RECOMMENDATIONS: 60 * 60, // 1 hour
  PLAYER_INFO: 24 * 60 * 60, // 24 hours
  GAME_SCHEDULE: 60 * 60 // 1 hour
};

export const ESPN_API_CONFIG = {
  BASE_URL: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba',
  ENDPOINTS: {
    SCOREBOARD: '/scoreboard',
    TEAMS: '/teams',
    ROSTER: '/teams/:teamId/roster',
    PLAYER: '/athletes/:playerId',
    STANDINGS: '/standings'
  },
  RATE_LIMIT: {
    MAX_REQUESTS_PER_MINUTE: 60,
    MAX_REQUESTS_PER_HOUR: 1000
  }
};

export const CONSISTENCY_GRADE_THRESHOLDS = {
  'A+': { maxCV: 0.1 },
  'A': { maxCV: 0.15 },
  'A-': { maxCV: 0.2 },
  'B+': { maxCV: 0.25 },
  'B': { maxCV: 0.3 },
  'B-': { maxCV: 0.35 },
  'C+': { maxCV: 0.4 },
  'C': { maxCV: 0.45 },
  'C-': { maxCV: 0.5 },
  'D': { maxCV: 0.6 },
  'F': { maxCV: Infinity }
};

export const HOT_PLAYER_THRESHOLD = 0.15; // 15% above season average

export const WAIVER_WIRE_CONFIG = {
  DEFAULT_EXCLUDE_TOP_N: 50,
  MAX_RECOMMENDATIONS: 10,
  SCORING_WEIGHTS: {
    projectedPoints: 0.4,
    hotFactor: 0.3,
    minutesTrend: 0.2,
    matchupFavorability: 0.1
  }
};

export const TRADE_VALUE_WEIGHTS = {
  fantasyPoints: 0.5,
  consistency: 0.2,
  trend: 0.2,
  health: 0.1
};

export const WNBA_TEAMS = [
  'Atlanta Dream',
  'Chicago Sky',
  'Connecticut Sun',
  'Dallas Wings',
  'Indiana Fever',
  'Las Vegas Aces',
  'Los Angeles Sparks',
  'Minnesota Lynx',
  'New York Liberty',
  'Phoenix Mercury',
  'Seattle Storm',
  'Washington Mystics'
];

export const SEASON_CONFIG = {
  CURRENT_SEASON: 2024,
  SEASON_START_MONTH: 5, // May
  SEASON_END_MONTH: 9, // September
  GAMES_PER_TEAM: 40
};

export const ERROR_MESSAGES = {
  AUTHENTICATION_REQUIRED: 'Authentication required',
  SUBSCRIPTION_REQUIRED: 'This feature requires a subscription',
  INVALID_TIER: 'Invalid subscription tier',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  PLAYER_NOT_FOUND: 'Player not found',
  INVALID_SCORING_CONFIG: 'Invalid scoring configuration',
  DATABASE_ERROR: 'Database error occurred',
  ESPN_API_ERROR: 'ESPN API error occurred',
  STRIPE_ERROR: 'Payment processing error'
};

export const SUCCESS_MESSAGES = {
  SUBSCRIPTION_CREATED: 'Subscription created successfully',
  SUBSCRIPTION_UPDATED: 'Subscription updated successfully',
  SUBSCRIPTION_CANCELED: 'Subscription canceled successfully',
  SCORING_CONFIG_SAVED: 'Scoring configuration saved',
  TRADE_ANALYZED: 'Trade analysis complete'
};