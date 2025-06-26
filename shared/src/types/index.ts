export interface User {
  id: string;
  email: string;
  googleId: string;
  name?: string;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus?: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum SubscriptionTier {
  FREE = 'FREE',
  PRO = 'PRO',
  PRO_PLUS = 'PRO_PLUS'
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  CANCELED = 'CANCELED',
  PAST_DUE = 'PAST_DUE',
  INCOMPLETE = 'INCOMPLETE',
  TRIALING = 'TRIALING'
}

export interface Player {
  id: string;
  espnId: string;
  name: string;
  team: string;
  position: Position;
  jerseyNumber?: number;
  height?: string;
  weight?: number;
  birthDate?: Date;
  yearsExperience?: number;
  college?: string;
  activeStatus: boolean;
  injuryStatus?: InjuryStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum Position {
  G = 'G',
  F = 'F',
  C = 'C',
  G_F = 'G_F',
  F_C = 'F_C'
}

export enum InjuryStatus {
  HEALTHY = 'HEALTHY',
  QUESTIONABLE = 'QUESTIONABLE',
  DOUBTFUL = 'DOUBTFUL',
  OUT = 'OUT',
  DAY_TO_DAY = 'DAY_TO_DAY'
}

export interface Game {
  id: string;
  date: Date;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: GameStatus;
  season: number;
  espnGameId: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum GameStatus {
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  FINAL = 'FINAL',
  POSTPONED = 'POSTPONED',
  CANCELED = 'CANCELED'
}

export interface PlayerStats {
  id: string;
  playerId: string;
  gameId: string;
  date: Date;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  plusMinus?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScoringConfiguration {
  id: string;
  userId: string;
  name: string;
  isDefault: boolean;
  pointsMultiplier: number;
  reboundsMultiplier: number;
  assistsMultiplier: number;
  stealsMultiplier: number;
  blocksMultiplier: number;
  threePointersMultiplier: number;
  turnoversMultiplier: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerFantasyScore {
  id: string;
  playerId: string;
  date: Date;
  scoringConfigId: string;
  fantasyPoints: number;
  seasonAverage?: number;
  last7DaysAverage?: number;
  last14DaysAverage?: number;
  last30DaysAverage?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConsistencyMetric {
  id: string;
  playerId: string;
  date: Date;
  standardDeviation7Days: number;
  standardDeviation14Days: number;
  standardDeviation30Days: number;
  coefficientOfVariation7Days: number;
  coefficientOfVariation14Days: number;
  coefficientOfVariation30Days: number;
  consistencyGrade: ConsistencyGrade;
  createdAt: Date;
  updatedAt: Date;
}

export enum ConsistencyGrade {
  A_PLUS = 'A_PLUS',
  A = 'A',
  A_MINUS = 'A_MINUS',
  B_PLUS = 'B_PLUS',
  B = 'B',
  B_MINUS = 'B_MINUS',
  C_PLUS = 'C_PLUS',
  C = 'C',
  C_MINUS = 'C_MINUS',
  D = 'D',
  F = 'F'
}

export interface TrendingAnalysis {
  id: string;
  playerId: string;
  date: Date;
  minutesTrend: TrendDirection;
  minutesTrendValue: number;
  performanceTrend: TrendDirection;
  performanceTrendValue: number;
  hotFactor: number;
  isHot: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum TrendDirection {
  UP = 'UP',
  DOWN = 'DOWN',
  STABLE = 'STABLE'
}

export interface TradeAnalysis {
  playersIn: Player[];
  playersOut: Player[];
  netValue: number;
  recommendation: TradeRecommendation;
  confidence: number;
  details: {
    valueIn: number;
    valueOut: number;
    slotValue: number;
    slotDifference: number;
  };
}

export enum TradeRecommendation {
  ACCEPT = 'ACCEPT',
  DECLINE = 'DECLINE',
  NEUTRAL = 'NEUTRAL'
}

export interface WaiverRecommendation {
  id: string;
  date: Date;
  playerId: string;
  player: Player;
  recommendationScore: number;
  projectedFantasyPoints: number;
  hotFactor: number;
  minutesTrend: number;
  matchupFavorability: number;
  rank: number;
  reasoning: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  price: number;
  priceId?: string;
  features: string[];
  limits: {
    customScoringConfigs?: number;
    tradeCalculations?: number;
    apiCalls?: number;
  };
}