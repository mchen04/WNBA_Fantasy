import { ConsistencyGrade, TrendDirection } from '../types';
import { CONSISTENCY_GRADE_THRESHOLDS, HOT_PLAYER_THRESHOLD } from '../constants';

export const calculateFantasyScore = (
  stats: {
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    threePointersMade: number;
    turnovers: number;
  },
  config: {
    pointsMultiplier: number;
    reboundsMultiplier: number;
    assistsMultiplier: number;
    stealsMultiplier: number;
    blocksMultiplier: number;
    threePointersMultiplier: number;
    turnoversMultiplier: number;
  }
): number => {
  return (
    stats.points * config.pointsMultiplier +
    stats.rebounds * config.reboundsMultiplier +
    stats.assists * config.assistsMultiplier +
    stats.steals * config.stealsMultiplier +
    stats.blocks * config.blocksMultiplier +
    stats.threePointersMade * config.threePointersMultiplier +
    stats.turnovers * config.turnoversMultiplier
  );
};

export const calculateStandardDeviation = (values: number[]): number => {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(variance);
};

export const calculateCoefficientOfVariation = (values: number[]): number => {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  if (mean === 0) return 0;
  
  const stdDev = calculateStandardDeviation(values);
  return stdDev / mean;
};

export const gradeConsistency = (coefficientOfVariation: number): ConsistencyGrade => {
  for (const [grade, threshold] of Object.entries(CONSISTENCY_GRADE_THRESHOLDS)) {
    if (coefficientOfVariation <= threshold.maxCV) {
      return grade as ConsistencyGrade;
    }
  }
  return ConsistencyGrade.F;
};

export const calculateTrend = (recentValues: number[], historicalValues: number[]): {
  direction: TrendDirection;
  value: number;
} => {
  if (recentValues.length === 0 || historicalValues.length === 0) {
    return { direction: TrendDirection.STABLE, value: 0 };
  }
  
  const recentAvg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
  const historicalAvg = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;
  
  if (historicalAvg === 0) {
    return { direction: TrendDirection.STABLE, value: 0 };
  }
  
  const percentageChange = (recentAvg - historicalAvg) / historicalAvg;
  
  let direction: TrendDirection;
  if (percentageChange > 0.05) {
    direction = TrendDirection.UP;
  } else if (percentageChange < -0.05) {
    direction = TrendDirection.DOWN;
  } else {
    direction = TrendDirection.STABLE;
  }
  
  return { direction, value: percentageChange };
};

export const isHotPlayer = (recentAverage: number, seasonAverage: number): boolean => {
  if (seasonAverage === 0) return false;
  
  const improvement = (recentAverage - seasonAverage) / seasonAverage;
  return improvement > HOT_PLAYER_THRESHOLD;
};

export const calculateHotFactor = (recentAverage: number, seasonAverage: number): number => {
  if (seasonAverage === 0) return 0;
  
  return (recentAverage - seasonAverage) / seasonAverage;
};

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
};

export const getDateRange = (days: number): { startDate: Date; endDate: Date } => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return { startDate, endDate };
};

export const calculateMatchupFavorability = (
  opponentDefensiveRating: number,
  leagueAverageDefensiveRating: number
): number => {
  // Lower defensive rating means better defense
  // So higher opponent rating is more favorable for the player
  if (leagueAverageDefensiveRating === 0) return 0.5;
  
  const favorability = opponentDefensiveRating / leagueAverageDefensiveRating;
  // Normalize to 0-1 range
  return Math.max(0, Math.min(1, favorability));
};

export const calculateCompositePlayerValue = (
  fantasyPointsAvg: number,
  consistency: number,
  trend: number,
  healthScore: number
): number => {
  // Weights from constants
  const weights = {
    fantasyPoints: 0.5,
    consistency: 0.2,
    trend: 0.2,
    health: 0.1
  };
  
  // Normalize consistency (inverse of CV, capped at 1)
  const normalizedConsistency = Math.min(1, 1 / (1 + consistency));
  
  // Normalize trend to 0-1 range
  const normalizedTrend = (trend + 1) / 2;
  
  return (
    fantasyPointsAvg * weights.fantasyPoints +
    normalizedConsistency * 100 * weights.consistency +
    normalizedTrend * 100 * weights.trend +
    healthScore * 100 * weights.health
  );
};

export const calculateWaiverWireValue = (
  availablePlayers: Array<{ fantasyPointsAvg: number }>
): number => {
  if (availablePlayers.length === 0) return 0;
  
  // Calculate the average fantasy points of top 10 available players
  const topPlayers = availablePlayers
    .sort((a, b) => b.fantasyPointsAvg - a.fantasyPointsAvg)
    .slice(0, 10);
  
  return topPlayers.reduce((sum, player) => sum + player.fantasyPointsAvg, 0) / topPlayers.length;
};

export const parseESPNDate = (espnDateString: string): Date => {
  // ESPN dates come in ISO format
  return new Date(espnDateString);
};

export const getInjuryHealthScore = (injuryStatus?: string): number => {
  switch (injuryStatus?.toLowerCase()) {
    case 'healthy':
    case undefined:
      return 1.0;
    case 'questionable':
      return 0.75;
    case 'doubtful':
      return 0.25;
    case 'out':
      return 0;
    case 'day-to-day':
      return 0.85;
    default:
      return 0.5;
  }
};

export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

export const roundToDecimal = (num: number, decimals: number = 2): number => {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
};