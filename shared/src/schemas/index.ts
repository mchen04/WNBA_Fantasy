import { z } from 'zod';
import { SubscriptionTier, Position, InjuryStatus, GameStatus, ConsistencyGrade, TrendDirection, TradeRecommendation } from '../types';

// User schemas
export const createUserSchema = z.object({
  email: z.string().email(),
  googleId: z.string(),
  name: z.string().optional(),
  subscriptionTier: z.nativeEnum(SubscriptionTier).default(SubscriptionTier.FREE)
});

export const updateUserSchema = z.object({
  name: z.string().optional(),
  subscriptionTier: z.nativeEnum(SubscriptionTier).optional()
});

// Scoring configuration schemas
export const scoringConfigSchema = z.object({
  name: z.string().min(1).max(50),
  pointsMultiplier: z.number().min(0).max(10),
  reboundsMultiplier: z.number().min(0).max(10),
  assistsMultiplier: z.number().min(0).max(10),
  stealsMultiplier: z.number().min(0).max(10),
  blocksMultiplier: z.number().min(0).max(10),
  threePointersMultiplier: z.number().min(0).max(10),
  turnoversMultiplier: z.number().min(-10).max(0)
});

// Player filter schemas
export const playerFilterSchema = z.object({
  team: z.string().optional(),
  position: z.nativeEnum(Position).optional(),
  minGamesPlayed: z.number().min(0).optional(),
  injuryStatus: z.array(z.nativeEnum(InjuryStatus)).optional(),
  search: z.string().optional()
});

// Trade analysis schemas
export const tradeAnalysisSchema = z.object({
  playerIdsIn: z.array(z.string()).min(1).max(5),
  playerIdsOut: z.array(z.string()).min(1).max(5),
  scoringConfigId: z.string().optional()
});

// Date range schemas
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().or(z.date()),
  endDate: z.string().datetime().or(z.date())
});

// Pagination schemas
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// Stats query schemas
export const statsQuerySchema = z.object({
  playerId: z.string().optional(),
  gameId: z.string().optional(),
  dateRange: dateRangeSchema.optional(),
  aggregation: z.enum(['game', 'daily', 'weekly', 'monthly', 'season']).default('game')
});

// Consistency query schemas
export const consistencyQuerySchema = z.object({
  days: z.enum(['7', '14', '30']).default('14'),
  minGamesPlayed: z.number().int().min(1).default(5)
});

// Hot player query schemas
export const hotPlayerQuerySchema = z.object({
  days: z.enum(['5', '7', '10', '14']).default('7'),
  minImprovement: z.number().min(0).max(1).default(0.15)
});

// Waiver recommendation query schemas
export const waiverQuerySchema = z.object({
  excludeTopN: z.number().int().min(0).max(200).default(50),
  date: z.string().datetime().or(z.date()).optional()
});

// Authentication schemas
export const googleAuthSchema = z.object({
  googleId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  picture: z.string().url().optional()
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string()
});

// Stripe webhook schemas
export const stripeWebhookSchema = z.object({
  type: z.string(),
  data: z.object({
    object: z.record(z.any())
  })
});

// API response schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }).optional(),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number()
  }).optional()
});

// ESPN API response schemas
export const espnPlayerSchema = z.object({
  id: z.string(),
  uid: z.string(),
  guid: z.string(),
  displayName: z.string(),
  fullName: z.string(),
  jersey: z.string().optional(),
  position: z.object({
    abbreviation: z.string()
  }),
  team: z.object({
    id: z.string(),
    displayName: z.string(),
    abbreviation: z.string()
  }),
  injuries: z.array(z.object({
    status: z.string(),
    details: z.string().optional()
  })).optional()
});

export const espnGameSchema = z.object({
  id: z.string(),
  uid: z.string(),
  date: z.string(),
  status: z.object({
    type: z.object({
      name: z.string(),
      state: z.string()
    })
  }),
  competitions: z.array(z.object({
    competitors: z.array(z.object({
      id: z.string(),
      team: z.object({
        id: z.string(),
        displayName: z.string()
      }),
      score: z.string().optional(),
      homeAway: z.enum(['home', 'away'])
    }))
  }))
});

// Validation helpers
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ScoringConfigInput = z.infer<typeof scoringConfigSchema>;
export type PlayerFilterInput = z.infer<typeof playerFilterSchema>;
export type TradeAnalysisInput = z.infer<typeof tradeAnalysisSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type StatsQueryInput = z.infer<typeof statsQuerySchema>;
export type ConsistencyQueryInput = z.infer<typeof consistencyQuerySchema>;
export type HotPlayerQueryInput = z.infer<typeof hotPlayerQuerySchema>;
export type WaiverQueryInput = z.infer<typeof waiverQuerySchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type StripeWebhookInput = z.infer<typeof stripeWebhookSchema>;
export type ApiResponse = z.infer<typeof apiResponseSchema>;