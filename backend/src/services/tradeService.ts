import { prisma } from '../config/database';
import { cache, cacheKeys } from '../config/redis';
import { AppError } from '../middleware/error';
import { logger } from '../utils/logger';
import { SUBSCRIPTION_PLANS, TRADE_VALUE_WEIGHTS } from '@shared/constants';
import { TradeAnalysisInput } from '@shared/schemas';
import { SubscriptionTier, TradeRecommendation, Position, InjuryStatus } from '@shared/types';
import { Position as PrismaPosition, InjuryStatus as PrismaInjuryStatus, TradeRecommendation as PrismaTradeRecommendation } from '@prisma/client';
import { calculateCompositePlayerValue, calculateWaiverWireValue } from '@shared/utils';

export interface PlayerTradeInfo {
  id: string;
  name: string;
  team: string;
  position: Position;
  photoUrl: string | null;
  injuryStatus: InjuryStatus;
  fantasyScore?: {
    seasonAverage: number;
    last7DaysAverage: number;
    last14DaysAverage: number;
    last30DaysAverage: number;
  };
  consistency?: {
    coefficientOfVariation14Days: number;
    consistencyGrade: string;
  };
  trending?: {
    performanceTrendValue: number;
    hotFactor: number;
    isHot: boolean;
  };
  healthScore: number;
  calculatedValue: number;
}

export interface TradeAnalysisResult {
  playersIn: PlayerTradeInfo[];
  playersOut: PlayerTradeInfo[];
  netValue: number;
  recommendation: TradeRecommendation;
  confidence: number;
  details: {
    valueIn: number;
    valueOut: number;
    slotValue: number;
    slotDifference: number;
  };
  reasoning: string[];
}

export interface SavedTradeAnalysis {
  id: string;
  userId: string;
  playerIdsIn: string[];
  playerIdsOut: string[];
  netValue: number;
  recommendation: TradeRecommendation;
  confidence: number;
  valueIn: number;
  valueOut: number;
  slotValue: number;
  slotDifference: number;
  notes: string | null;
  saved: boolean;
  createdAt: Date;
}

export interface WaiverWireInfo {
  averageValue: number;
  topPlayers: Array<{
    playerId: string;
    name: string;
    fantasyPointsAvg: number;
  }>;
}

export interface TradeHistoryResult {
  trades: SavedTradeAnalysis[];
  total: number;
}

export class TradeService {
  /**
   * Analyze a trade proposal
   */
  async analyzeTrade(
    data: TradeAnalysisInput,
    userId: string,
    userSubscriptionTier: SubscriptionTier
  ): Promise<TradeAnalysisResult> {
    try {
      const { playerIdsIn, playerIdsOut, scoringConfigId } = data;

      // Check usage limits
      await this.checkTradeCalculationLimit(userId, userSubscriptionTier);

      // Get players with all necessary data
      const [playersIn, playersOut] = await Promise.all([
        this.getPlayersWithTradeData(playerIdsIn, scoringConfigId),
        this.getPlayersWithTradeData(playerIdsOut, scoringConfigId),
      ]);

      // Calculate individual player values
      const playersInWithValues = playersIn.map(player => ({
        ...player,
        calculatedValue: this.calculatePlayerValue(player),
      }));

      const playersOutWithValues = playersOut.map(player => ({
        ...player,
        calculatedValue: this.calculatePlayerValue(player),
      }));

      // Calculate total values
      const valueIn = playersInWithValues.reduce((sum, p) => sum + p.calculatedValue, 0);
      const valueOut = playersOutWithValues.reduce((sum, p) => sum + p.calculatedValue, 0);

      // Calculate roster slot value adjustment
      const slotDifference = playerIdsOut.length - playerIdsIn.length;
      let slotValue = 0;

      if (slotDifference !== 0) {
        const waiverValue = await this.getWaiverWireValue(scoringConfigId);
        slotValue = waiverValue.averageValue * slotDifference * TRADE_VALUE_WEIGHTS.fantasyPoints;
      }

      // Calculate net value and recommendation
      const netValue = valueIn - valueOut + slotValue;
      const recommendation = this.determineRecommendation(netValue);
      const confidence = Math.min(0.95, Math.abs(netValue) / 100);

      // Generate reasoning
      const reasoning = this.generateTradeReasoning({
        netValue,
        valueIn,
        valueOut,
        slotValue,
        slotDifference,
        playersIn: playersInWithValues,
        playersOut: playersOutWithValues,
      });

      // Save analysis to database
      await this.saveTradeAnalysis({
        userId,
        playerIdsIn,
        playerIdsOut,
        netValue,
        recommendation,
        confidence,
        valueIn,
        valueOut,
        slotValue,
        slotDifference,
      });

      return {
        playersIn: playersInWithValues,
        playersOut: playersOutWithValues,
        netValue,
        recommendation,
        confidence,
        details: {
          valueIn,
          valueOut,
          slotValue,
          slotDifference,
        },
        reasoning,
      };
    } catch (error) {
      logger.error('Analyze trade failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to analyze trade', 500);
    }
  }

  /**
   * Get trade history for a user
   */
  async getTradeHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<TradeHistoryResult> {
    try {
      const [trades, total] = await Promise.all([
        prisma.tradeAnalysis.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.tradeAnalysis.count({
          where: { userId },
        }),
      ]);

      return {
        trades,
        total,
      };
    } catch (error) {
      logger.error('Get trade history failed:', error);
      throw new AppError('Failed to retrieve trade history', 500);
    }
  }

  /**
   * Save a trade analysis
   */
  async saveTradeAnalysis(data: any): Promise<SavedTradeAnalysis> {
    try {
      const saved = await prisma.tradeAnalysis.create({
        data: {
          ...data,
          saved: true,
        },
      });

      return saved;
    } catch (error) {
      logger.error('Save trade analysis failed:', error);
      throw new AppError('Failed to save trade analysis', 500);
    }
  }

  /**
   * Get waiver wire value information
   */
  async getWaiverWireValue(
    scoringConfigId?: string,
    excludeTopN: number = 50
  ): Promise<WaiverWireInfo> {
    try {
      // Check cache
      const cacheKey = `waiver-value:${excludeTopN}:${scoringConfigId || 'default'}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return cached as WaiverWireInfo;
      }

      const topWaiverPlayers = await prisma.playerFantasyScore.findMany({
        where: {
          scoringConfigId: scoringConfigId || undefined,
          scoringConfig: scoringConfigId ? undefined : { isDefault: true },
        },
        orderBy: { seasonAverage: 'desc' },
        skip: excludeTopN,
        take: 10,
        include: {
          player: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const averageValue = calculateWaiverWireValue(
        topWaiverPlayers.map(p => ({ fantasyPointsAvg: p.seasonAverage || 0 }))
      );

      const result: WaiverWireInfo = {
        averageValue,
        topPlayers: topWaiverPlayers.map(p => ({
          playerId: p.player.id,
          name: p.player.name,
          fantasyPointsAvg: p.seasonAverage || 0,
        })),
      };

      // Cache for 30 minutes
      await cache.set(cacheKey, result, 30 * 60);

      return result;
    } catch (error) {
      logger.error('Get waiver wire value failed:', error);
      throw new AppError('Failed to retrieve waiver wire value', 500);
    }
  }

  /**
   * Delete a saved trade analysis
   */
  async deleteTradeAnalysis(tradeId: string, userId: string): Promise<void> {
    try {
      const trade = await prisma.tradeAnalysis.findFirst({
        where: {
          id: tradeId,
          userId,
        },
      });

      if (!trade) {
        throw new AppError('Trade analysis not found', 404);
      }

      await prisma.tradeAnalysis.delete({
        where: { id: tradeId },
      });

      logger.info(`Deleted trade analysis ${tradeId} for user ${userId}`);
    } catch (error) {
      logger.error('Delete trade analysis failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to delete trade analysis', 500);
    }
  }

  /**
   * Get players with all trade-relevant data
   */
  private async getPlayersWithTradeData(
    playerIds: string[],
    scoringConfigId?: string
  ): Promise<PlayerTradeInfo[]> {
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      include: {
        fantasyScores: {
          where: scoringConfigId ? { scoringConfigId } : { scoringConfig: { isDefault: true } },
          orderBy: { date: 'desc' },
          take: 1,
        },
        consistencyMetrics: {
          orderBy: { date: 'desc' },
          take: 1,
        },
        trendingAnalyses: {
          orderBy: { date: 'desc' },
          take: 1,
        },
        injuries: {
          where: { active: true },
          take: 1,
        },
      },
    });

    return players.map(player => {
      const fantasyScore = player.fantasyScores[0];
      const consistency = player.consistencyMetrics[0];
      const trending = player.trendingAnalyses[0];
      const injury = player.injuries[0];

      const healthScore = this.calculateHealthScore(injury?.status as InjuryStatus);

      return {
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position as Position,
        photoUrl: player.photoUrl,
        injuryStatus: (injury?.status || 'HEALTHY') as InjuryStatus,
        fantasyScore: fantasyScore ? {
          seasonAverage: fantasyScore.seasonAverage || 0,
          last7DaysAverage: fantasyScore.last7DaysAverage || 0,
          last14DaysAverage: fantasyScore.last14DaysAverage || 0,
          last30DaysAverage: fantasyScore.last30DaysAverage || 0,
        } : undefined,
        consistency: consistency ? {
          coefficientOfVariation14Days: consistency.coefficientOfVariation14Days,
          consistencyGrade: consistency.consistencyGrade,
        } : undefined,
        trending: trending ? {
          performanceTrendValue: trending.performanceTrendValue,
          hotFactor: trending.hotFactor,
          isHot: trending.isHot,
        } : undefined,
        healthScore,
        calculatedValue: 0, // Will be calculated later
      };
    });
  }

  /**
   * Calculate health score based on injury status
   */
  private calculateHealthScore(injuryStatus?: InjuryStatus): number {
    switch (injuryStatus) {
      case 'OUT':
        return 0;
      case 'DOUBTFUL':
        return 0.25;
      case 'QUESTIONABLE':
        return 0.75;
      case 'DAY_TO_DAY':
        return 0.9;
      case 'HEALTHY':
      default:
        return 1;
    }
  }

  /**
   * Calculate overall player value for trade analysis
   */
  private calculatePlayerValue(player: PlayerTradeInfo): number {
    const fantasyPoints = player.fantasyScore?.seasonAverage || 0;
    const consistency = player.consistency?.coefficientOfVariation14Days || 0.5;
    const trendValue = player.trending?.performanceTrendValue || 0;
    const healthScore = player.healthScore;

    return calculateCompositePlayerValue(
      fantasyPoints,
      consistency,
      trendValue,
      healthScore
    );
  }

  /**
   * Determine trade recommendation based on net value
   */
  private determineRecommendation(netValue: number): TradeRecommendation {
    if (netValue > 5) return TradeRecommendation.ACCEPT;
    if (netValue < -5) return TradeRecommendation.DECLINE;
    return TradeRecommendation.NEUTRAL;
  }

  /**
   * Generate reasoning for trade analysis
   */
  private generateTradeReasoning(analysis: {
    netValue: number;
    valueIn: number;
    valueOut: number;
    slotValue: number;
    slotDifference: number;
    playersIn: PlayerTradeInfo[];
    playersOut: PlayerTradeInfo[];
  }): string[] {
    const reasoning: string[] = [];

    const { netValue, valueIn, valueOut, slotValue, slotDifference, playersIn, playersOut } = analysis;

    // Overall recommendation
    if (netValue > 5) {
      reasoning.push(`This trade appears favorable with a net value of +${netValue.toFixed(1)} points.`);
    } else if (netValue < -5) {
      reasoning.push(`This trade appears unfavorable with a net value of ${netValue.toFixed(1)} points.`);
    } else {
      reasoning.push(`This trade is relatively neutral with a net value of ${netValue.toFixed(1)} points.`);
    }

    // Player value comparison
    reasoning.push(`Players received have a combined value of ${valueIn.toFixed(1)} points.`);
    reasoning.push(`Players traded away have a combined value of ${valueOut.toFixed(1)} points.`);

    // Roster slot analysis
    if (slotDifference !== 0) {
      if (slotDifference > 0) {
        reasoning.push(`Trade creates ${slotDifference} additional roster slot(s), valued at ${slotValue.toFixed(1)} points.`);
      } else {
        reasoning.push(`Trade costs ${Math.abs(slotDifference)} roster slot(s), valued at ${slotValue.toFixed(1)} points.`);
      }
    }

    // Individual player insights
    const hotPlayersIn = playersIn.filter(p => p.trending?.isHot);
    const hotPlayersOut = playersOut.filter(p => p.trending?.isHot);

    if (hotPlayersIn.length > 0) {
      reasoning.push(`Acquiring trending players: ${hotPlayersIn.map(p => p.name).join(', ')}.`);
    }

    if (hotPlayersOut.length > 0) {
      reasoning.push(`Trading away trending players: ${hotPlayersOut.map(p => p.name).join(', ')}.`);
    }

    // Injury concerns
    const injuredPlayersIn = playersIn.filter(p => p.injuryStatus !== 'HEALTHY');
    const injuredPlayersOut = playersOut.filter(p => p.injuryStatus !== 'HEALTHY');

    if (injuredPlayersIn.length > 0) {
      reasoning.push(`Health concern: Acquiring injured players ${injuredPlayersIn.map(p => `${p.name} (${p.injuryStatus})`).join(', ')}.`);
    }

    if (injuredPlayersOut.length > 0) {
      reasoning.push(`Health benefit: Trading away injured players ${injuredPlayersOut.map(p => `${p.name} (${p.injuryStatus})`).join(', ')}.`);
    }

    return reasoning;
  }

  /**
   * Check if user has reached trade calculation limit
   */
  private async checkTradeCalculationLimit(userId: string, subscriptionTier: SubscriptionTier): Promise<void> {
    const now = new Date();
    const period = new Date(now.getFullYear(), now.getMonth(), 1);

    const usage = await prisma.usageTracking.findFirst({
      where: {
        userId,
        feature: 'trade_calculator',
        period,
      },
    });

    const limit = SUBSCRIPTION_PLANS[subscriptionTier].limits.tradeCalculations;
    if (limit !== -1 && usage && usage.count >= limit) {
      throw new AppError(
        `You have reached your monthly limit of ${limit} trade calculations`,
        403
      );
    }
  }
}

export const tradeService = new TradeService();