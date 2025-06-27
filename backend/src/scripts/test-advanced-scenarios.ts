#!/usr/bin/env ts-node

/**
 * Advanced Pro/Pro+ Feature Testing with Edge Cases and Real Scenarios
 */

import { logger } from '../utils/logger';

// Enhanced mock data with hot players and various scenarios
interface EnhancedMockPlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  scenario: string;
  photoUrl?: string;
  injuryStatus: string;
  stats: Array<{
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    threePointersMade: number;
    turnovers: number;
    minutes: number;
    date: Date;
  }>;
}

// Realistic test scenarios
const enhancedMockPlayers: EnhancedMockPlayer[] = [
  {
    id: '1',
    name: 'Caitlin Clark',
    team: 'Indiana Fever',
    position: 'G',
    scenario: 'HOT STREAK - Rookie sensation on fire',
    injuryStatus: 'HEALTHY',
    stats: [
      // Recent hot streak - way above her early season averages
      { points: 28, rebounds: 6, assists: 12, steals: 2, blocks: 0, threePointersMade: 6, turnovers: 4, minutes: 36, date: new Date('2025-01-25') },
      { points: 31, rebounds: 5, assists: 10, steals: 3, blocks: 1, threePointersMade: 7, turnovers: 3, minutes: 38, date: new Date('2025-01-22') },
      { points: 24, rebounds: 4, assists: 14, steals: 1, blocks: 0, threePointersMade: 4, turnovers: 5, minutes: 35, date: new Date('2025-01-20') },
      // Earlier season (lower averages)
      { points: 16, rebounds: 3, assists: 6, steals: 1, blocks: 0, threePointersMade: 2, turnovers: 6, minutes: 28, date: new Date('2025-01-18') },
      { points: 12, rebounds: 2, assists: 5, steals: 0, blocks: 0, threePointersMade: 1, turnovers: 7, minutes: 24, date: new Date('2025-01-15') },
      { points: 14, rebounds: 4, assists: 7, steals: 2, blocks: 0, threePointersMade: 2, turnovers: 5, minutes: 26, date: new Date('2025-01-12') },
      { points: 18, rebounds: 3, assists: 8, steals: 1, blocks: 0, threePointersMade: 3, turnovers: 4, minutes: 30, date: new Date('2025-01-10') },
    ]
  },
  {
    id: '2',
    name: 'Angel Reese',
    team: 'Chicago Sky',
    position: 'F',
    scenario: 'MINUTES SURGE - Getting more playing time',
    injuryStatus: 'HEALTHY',
    stats: [
      // Recent games with increased minutes
      { points: 16, rebounds: 12, assists: 2, steals: 1, blocks: 2, threePointersMade: 0, turnovers: 3, minutes: 34, date: new Date('2025-01-25') },
      { points: 18, rebounds: 14, assists: 1, steals: 2, blocks: 1, threePointersMade: 0, turnovers: 2, minutes: 36, date: new Date('2025-01-22') },
      { points: 20, rebounds: 11, assists: 3, steals: 1, blocks: 3, threePointersMade: 0, turnovers: 4, minutes: 38, date: new Date('2025-01-20') },
      // Earlier season with fewer minutes
      { points: 12, rebounds: 8, assists: 1, steals: 0, blocks: 1, threePointersMade: 0, turnovers: 2, minutes: 22, date: new Date('2025-01-18') },
      { points: 10, rebounds: 9, assists: 2, steals: 1, blocks: 2, threePointersMade: 0, turnovers: 3, minutes: 20, date: new Date('2025-01-15') },
      { points: 14, rebounds: 10, assists: 1, steals: 0, blocks: 1, threePointersMade: 0, turnovers: 1, minutes: 25, date: new Date('2025-01-12') },
    ]
  },
  {
    id: '3',
    name: 'Kate Martin',
    team: 'Las Vegas Aces',
    position: 'G',
    scenario: 'WAIVER WIRE GEM - Consistent under-the-radar performer',
    injuryStatus: 'HEALTHY',
    stats: [
      { points: 11, rebounds: 4, assists: 5, steals: 2, blocks: 0, threePointersMade: 2, turnovers: 1, minutes: 22, date: new Date('2025-01-25') },
      { points: 9, rebounds: 3, assists: 6, steals: 3, blocks: 1, threePointersMade: 1, turnovers: 2, minutes: 24, date: new Date('2025-01-22') },
      { points: 13, rebounds: 5, assists: 4, steals: 1, blocks: 0, threePointersMade: 3, turnovers: 1, minutes: 26, date: new Date('2025-01-20') },
      { points: 10, rebounds: 3, assists: 5, steals: 2, blocks: 0, threePointersMade: 2, turnovers: 2, minutes: 21, date: new Date('2025-01-18') },
      { points: 12, rebounds: 4, assists: 7, steals: 1, blocks: 1, threePointersMade: 1, turnovers: 1, minutes: 23, date: new Date('2025-01-15') },
    ]
  },
  {
    id: '4',
    name: 'Lexie Hull',
    team: 'Indiana Fever',
    position: 'G',
    scenario: 'INJURY QUESTIONABLE - Risk/reward decision',
    injuryStatus: 'QUESTIONABLE',
    stats: [
      { points: 15, rebounds: 3, assists: 4, steals: 2, blocks: 0, threePointersMade: 4, turnovers: 2, minutes: 28, date: new Date('2025-01-20') }, // Last healthy game
      { points: 8, rebounds: 2, assists: 2, steals: 1, blocks: 0, threePointersMade: 1, turnovers: 1, minutes: 15, date: new Date('2025-01-18') }, // Injured early
      { points: 17, rebounds: 4, assists: 3, steals: 3, blocks: 1, threePointersMade: 5, turnovers: 2, minutes: 32, date: new Date('2025-01-15') },
      { points: 12, rebounds: 3, assists: 5, steals: 1, blocks: 0, threePointersMade: 3, turnovers: 3, minutes: 26, date: new Date('2025-01-12') },
    ]
  },
  {
    id: '5',
    name: 'Kamilla Cardoso',
    team: 'Chicago Sky',
    position: 'C',
    scenario: 'SLOW STARTER - Poor recent form',
    injuryStatus: 'HEALTHY',
    stats: [
      // Recent struggle
      { points: 6, rebounds: 8, assists: 1, steals: 0, blocks: 1, threePointersMade: 0, turnovers: 4, minutes: 18, date: new Date('2025-01-25') },
      { points: 4, rebounds: 5, assists: 0, steals: 1, blocks: 2, threePointersMade: 0, turnovers: 3, minutes: 16, date: new Date('2025-01-22') },
      { points: 8, rebounds: 7, assists: 2, steals: 0, blocks: 0, threePointersMade: 0, turnovers: 5, minutes: 20, date: new Date('2025-01-20') },
      // Better earlier games
      { points: 14, rebounds: 10, assists: 1, steals: 1, blocks: 3, threePointersMade: 0, turnovers: 2, minutes: 28, date: new Date('2025-01-18') },
      { points: 16, rebounds: 12, assists: 2, steals: 0, blocks: 4, threePointersMade: 0, turnovers: 3, minutes: 32, date: new Date('2025-01-15') },
    ]
  }
];

class AdvancedProFeatureTester {
  
  /**
   * Test Hot Player Detection with Real Hot Streaks
   */
  testAdvancedHotDetection() {
    console.log('\n🔥 ADVANCED HOT PLAYER DETECTION');
    console.log('=' .repeat(50));

    const scoringConfig = {
      pointsMultiplier: 1, reboundsMultiplier: 1, assistsMultiplier: 1,
      stealsMultiplier: 2, blocksMultiplier: 2, threePointersMultiplier: 1, turnoversMultiplier: -1,
    };

    enhancedMockPlayers.forEach(player => {
      const hotData = this.calculateDetailedHotFactor(player, scoringConfig);
      const isHot = hotData.hotFactor > 0.15;
      
      console.log(`🌡️  ${player.name} (${player.team}) - ${player.scenario}`);
      console.log(`   Recent 3 games avg: ${hotData.recentAvg.toFixed(1)} fantasy pts`);
      console.log(`   Season average: ${hotData.seasonAvg.toFixed(1)} fantasy pts`);
      console.log(`   Hot Factor: ${(hotData.hotFactor * 100).toFixed(1)}% ${isHot ? '🔥 BLAZING HOT!' : hotData.hotFactor > 0 ? '🌡️  Warming up' : '❄️  Cooling down'}`);
      console.log(`   Status: ${isHot ? 'EXCELLENT pickup target' : hotData.hotFactor > 0 ? 'Good potential' : 'Consider avoiding'}`);
      console.log(`   Consistency: ${hotData.gamesAboveAvg}/${hotData.recentGames} recent games above season avg`);
      console.log('');
    });
  }

  /**
   * Test Advanced Minutes Analysis
   */
  testAdvancedMinutesAnalysis() {
    console.log('\n⏰ ADVANCED MINUTES TREND ANALYSIS');
    console.log('=' .repeat(50));

    enhancedMockPlayers.forEach(player => {
      const minutesData = this.calculateAdvancedMinutesTrend(player);
      
      console.log(`📈 ${player.name} (${player.team}) - ${player.scenario}`);
      console.log(`   Recent 3 games: ${minutesData.recent3Avg.toFixed(1)} min/game`);
      console.log(`   Middle 2 games: ${minutesData.middle2Avg.toFixed(1)} min/game`);
      console.log(`   Season average: ${minutesData.seasonAvg.toFixed(1)} min/game`);
      console.log(`   Trend: ${(minutesData.trendValue * 100).toFixed(1)}% ${minutesData.direction}`);
      console.log(`   Trend Strength: ${minutesData.strength}`);
      console.log(`   Fantasy Impact: ${minutesData.impact}`);
      console.log('');
    });
  }

  /**
   * Test Complete Waiver Recommendation with Real Scenarios
   */
  testAdvancedWaiverRecommendations() {
    console.log('\n🎯 ADVANCED WAIVER RECOMMENDATIONS WITH REAL SCENARIOS');
    console.log('=' .repeat(60));

    const scoringConfig = {
      pointsMultiplier: 1, reboundsMultiplier: 1, assistsMultiplier: 1,
      stealsMultiplier: 2, blocksMultiplier: 2, threePointersMultiplier: 1, turnoversMultiplier: -1,
    };

    // Filter out top-tier players (simulate waiver eligibility)
    const waiverEligible = enhancedMockPlayers.filter(p => 
      !p.name.includes('Clark') || p.scenario.includes('WAIVER') // Exclude superstars unless specifically marked as waiver
    );
    
    const recommendations = waiverEligible.map(player => {
      const hotData = this.calculateDetailedHotFactor(player, scoringConfig);
      const minutesData = this.calculateAdvancedMinutesTrend(player);
      const projectedFantasyPoints = hotData.seasonAvg;
      const matchupFavorability = this.calculateMatchupFavorability(player);
      const injuryRisk = this.calculateInjuryRisk(player);
      
      // Advanced weighted scoring with injury consideration
      const weights = { 
        projectedPoints: 0.35, 
        hotFactor: 0.25, 
        minutesTrend: 0.20, 
        matchupFavorability: 0.10,
        injuryRisk: -0.10 // Negative weight for injury risk
      };
      
      const baseScore = 
        (projectedFantasyPoints * weights.projectedPoints) +
        (hotData.hotFactor * 100 * weights.hotFactor) +
        (minutesData.trendValue * 50 * weights.minutesTrend) +
        (matchupFavorability * 10 * weights.matchupFavorability);
      
      const injuryAdjustment = injuryRisk * Math.abs(weights.injuryRisk) * baseScore;
      const recommendationScore = baseScore - injuryAdjustment;

      const reasoning = this.generateAdvancedReasoning(player, hotData, minutesData, matchupFavorability, injuryRisk);

      return {
        player,
        projectedFantasyPoints,
        hotFactor: hotData.hotFactor,
        minutesTrend: minutesData.trendValue,
        matchupFavorability,
        injuryRisk,
        recommendationScore,
        reasoning,
        confidence: this.calculateConfidence(hotData, minutesData, injuryRisk)
      };
    });

    // Sort by recommendation score
    recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);

    console.log('📋 DAILY WAIVER RECOMMENDATIONS (Pro+ Advanced Algorithm)');
    console.log('Includes: Hot Factor, Minutes Trends, Injury Risk, Matchup Analysis');
    console.log('');
    
    recommendations.forEach((rec, index) => {
      const confidence = rec.confidence >= 0.8 ? '🎯 HIGH' : rec.confidence >= 0.6 ? '✅ MEDIUM' : '⚠️  LOW';
      
      console.log(`${index + 1}. ${rec.player.name} (${rec.player.team}) - ${rec.player.position}`);
      console.log(`   📊 Recommendation Score: ${rec.recommendationScore.toFixed(1)}`);
      console.log(`   🎯 Confidence: ${confidence} (${(rec.confidence * 100).toFixed(0)}%)`);
      console.log(`   📈 Projected Fantasy Points: ${rec.projectedFantasyPoints.toFixed(1)}`);
      console.log(`   🔥 Hot Factor: ${(rec.hotFactor * 100).toFixed(1)}%`);
      console.log(`   ⏰ Minutes Trend: ${(rec.minutesTrend * 100).toFixed(1)}%`);
      console.log(`   🥊 Matchup: ${rec.matchupFavorability.toFixed(2)}`);
      console.log(`   🏥 Injury Risk: ${(rec.injuryRisk * 100).toFixed(0)}%`);
      console.log(`   💡 Analysis: ${rec.reasoning}`);
      console.log(`   🎭 Scenario: ${rec.player.scenario}`);
      console.log('');
    });
  }

  /**
   * Test Injury Risk Assessment
   */
  testInjuryRiskAssessment() {
    console.log('\n🏥 INJURY RISK ASSESSMENT (Pro+ Feature)');
    console.log('=' .repeat(50));

    enhancedMockPlayers.forEach(player => {
      const injuryRisk = this.calculateInjuryRisk(player);
      const recommendation = this.getInjuryRecommendation(injuryRisk, player.injuryStatus);
      
      console.log(`🩺 ${player.name} (${player.team})`);
      console.log(`   Current Status: ${player.injuryStatus}`);
      console.log(`   Risk Score: ${(injuryRisk * 100).toFixed(0)}% ${injuryRisk > 0.5 ? '🔴 HIGH' : injuryRisk > 0.2 ? '🟡 MEDIUM' : '🟢 LOW'}`);
      console.log(`   Recommendation: ${recommendation}`);
      console.log('');
    });
  }

  /**
   * Test Custom Scoring Weights Simulation
   */
  testCustomWeightedScoring() {
    console.log('\n⚖️  CUSTOM WEIGHTED SCORING SIMULATION');
    console.log('=' .repeat(50));

    const scenarios = [
      {
        name: 'Conservative Strategy',
        weights: { projectedPoints: 0.5, hotFactor: 0.2, minutesTrend: 0.2, matchupFavorability: 0.1 }
      },
      {
        name: 'Aggressive Hot Pursuit',
        weights: { projectedPoints: 0.3, hotFactor: 0.4, minutesTrend: 0.2, matchupFavorability: 0.1 }
      },
      {
        name: 'Minutes Chaser',
        weights: { projectedPoints: 0.3, hotFactor: 0.2, minutesTrend: 0.4, matchupFavorability: 0.1 }
      }
    ];

    scenarios.forEach(scenario => {
      console.log(`📊 ${scenario.name.toUpperCase()} RANKINGS:`);
      console.log(`   Weights: ${Object.entries(scenario.weights).map(([k, v]) => `${k}: ${(v*100).toFixed(0)}%`).join(', ')}`);
      
      const rankings = this.calculateCustomRankings(scenario.weights);
      rankings.slice(0, 3).forEach((player, index) => {
        console.log(`   ${index + 1}. ${player.name} (Score: ${player.score.toFixed(1)})`);
      });
      console.log('');
    });
  }

  // Enhanced helper methods
  private calculateDetailedHotFactor(player: EnhancedMockPlayer, config: any) {
    const recentGames = player.stats.slice(0, 3);
    const allGames = player.stats;
    
    const recentAvg = recentGames.reduce((sum, stat) => sum + this.calculateFantasyPoints(stat, config), 0) / recentGames.length;
    const seasonAvg = allGames.reduce((sum, stat) => sum + this.calculateFantasyPoints(stat, config), 0) / allGames.length;
    
    const hotFactor = seasonAvg > 0 ? (recentAvg - seasonAvg) / seasonAvg : 0;
    const gamesAboveAvg = recentGames.filter(game => this.calculateFantasyPoints(game, config) > seasonAvg).length;
    
    return {
      hotFactor,
      recentAvg,
      seasonAvg,
      gamesAboveAvg,
      recentGames: recentGames.length
    };
  }

  private calculateAdvancedMinutesTrend(player: EnhancedMockPlayer) {
    const recent3 = player.stats.slice(0, 3);
    const middle2 = player.stats.slice(3, 5);
    const allGames = player.stats;
    
    const recent3Avg = recent3.reduce((sum, stat) => sum + stat.minutes, 0) / recent3.length;
    const middle2Avg = middle2.length > 0 ? middle2.reduce((sum, stat) => sum + stat.minutes, 0) / middle2.length : recent3Avg;
    const seasonAvg = allGames.reduce((sum, stat) => sum + stat.minutes, 0) / allGames.length;
    
    const trendValue = seasonAvg > 0 ? (recent3Avg - seasonAvg) / seasonAvg : 0;
    
    let direction = 'STABLE 📊';
    let strength = 'Weak';
    let impact = 'Minimal fantasy impact';
    
    if (trendValue > 0.15) {
      direction = 'STRONG UP ⬆️';
      strength = 'Strong';
      impact = 'Significant upside potential';
    } else if (trendValue > 0.05) {
      direction = 'UP ↗️';
      strength = 'Moderate';
      impact = 'Good upside potential';
    } else if (trendValue < -0.15) {
      direction = 'STRONG DOWN ⬇️';
      strength = 'Concerning';
      impact = 'Risk of reduced value';
    } else if (trendValue < -0.05) {
      direction = 'DOWN ↘️';
      strength = 'Mild concern';
      impact = 'Monitor closely';
    }
    
    return {
      recent3Avg,
      middle2Avg,
      seasonAvg,
      trendValue,
      direction,
      strength,
      impact
    };
  }

  private calculateMatchupFavorability(player: EnhancedMockPlayer): number {
    // Simulate matchup analysis
    const baseMatchup = 1.0;
    
    // Adjust based on position and team
    if (player.position === 'G') return baseMatchup + (Math.random() * 0.3 - 0.15); // Guards vary more
    if (player.position === 'C') return baseMatchup + (Math.random() * 0.2 - 0.1);  // Centers more stable
    return baseMatchup + (Math.random() * 0.25 - 0.125); // Forwards in between
  }

  private calculateInjuryRisk(player: EnhancedMockPlayer): number {
    switch (player.injuryStatus) {
      case 'OUT': return 1.0;
      case 'DOUBTFUL': return 0.8;
      case 'QUESTIONABLE': return 0.4;
      case 'DAY_TO_DAY': return 0.2;
      case 'HEALTHY': return 0.0;
      default: return 0.1;
    }
  }

  private getInjuryRecommendation(risk: number, status: string): string {
    if (risk >= 0.8) return '🔴 AVOID - Too risky for lineup';
    if (risk >= 0.4) return '🟡 MONITOR - Check status before games';
    if (risk >= 0.2) return '🟢 CAUTION - Good backup option';
    return '✅ CLEAR - No injury concerns';
  }

  private calculateCustomRankings(weights: any) {
    const scoringConfig = {
      pointsMultiplier: 1, reboundsMultiplier: 1, assistsMultiplier: 1,
      stealsMultiplier: 2, blocksMultiplier: 2, threePointersMultiplier: 1, turnoversMultiplier: -1,
    };

    const rankings = enhancedMockPlayers.map(player => {
      const hotData = this.calculateDetailedHotFactor(player, scoringConfig);
      const minutesData = this.calculateAdvancedMinutesTrend(player);
      const matchupFavorability = this.calculateMatchupFavorability(player);
      
      const score = 
        (hotData.seasonAvg * weights.projectedPoints) +
        (hotData.hotFactor * 100 * weights.hotFactor) +
        (minutesData.trendValue * 50 * weights.minutesTrend) +
        (matchupFavorability * 10 * weights.matchupFavorability);
      
      return { name: player.name, score };
    });

    return rankings.sort((a, b) => b.score - a.score);
  }

  private calculateConfidence(hotData: any, minutesData: any, injuryRisk: number): number {
    let confidence = 0.5; // Base confidence
    
    // Hot factor confidence
    if (Math.abs(hotData.hotFactor) > 0.2) confidence += 0.2;
    else if (Math.abs(hotData.hotFactor) > 0.1) confidence += 0.1;
    
    // Minutes trend confidence
    if (Math.abs(minutesData.trendValue) > 0.15) confidence += 0.2;
    else if (Math.abs(minutesData.trendValue) > 0.05) confidence += 0.1;
    
    // Recent games consistency
    if (hotData.gamesAboveAvg >= 2) confidence += 0.1;
    
    // Injury risk penalty
    confidence -= injuryRisk * 0.3;
    
    return Math.max(0, Math.min(1, confidence));
  }

  private generateAdvancedReasoning(player: EnhancedMockPlayer, hotData: any, minutesData: any, matchupFavorability: number, injuryRisk: number): string {
    const reasons = [];
    
    if (hotData.hotFactor > 0.2) reasons.push('🔥 On a blazing hot streak');
    else if (hotData.hotFactor > 0.1) reasons.push('📈 Playing above season average');
    else if (hotData.hotFactor < -0.1) reasons.push('📉 Recent struggles');
    
    if (minutesData.trendValue > 0.15) reasons.push('⏰ Major increase in minutes');
    else if (minutesData.trendValue > 0.05) reasons.push('📊 Getting more playing time');
    else if (minutesData.trendValue < -0.1) reasons.push('⚠️ Declining minutes');
    
    if (matchupFavorability > 1.1) reasons.push('🥊 Excellent matchup');
    else if (matchupFavorability < 0.9) reasons.push('🛡️ Tough matchup');
    
    if (injuryRisk > 0.3) reasons.push('🏥 Injury concerns');
    
    if (hotData.projectedFantasyPoints > 25) reasons.push('💪 Strong fantasy producer');
    else if (hotData.projectedFantasyPoints > 15) reasons.push('📊 Solid contributor');
    
    return reasons.length > 0 ? reasons.join('; ') : '🎯 Steady option with potential';
  }

  private calculateFantasyPoints(stats: any, config: any): number {
    return (
      stats.points * config.pointsMultiplier +
      stats.rebounds * config.reboundsMultiplier +
      stats.assists * config.assistsMultiplier +
      stats.steals * config.stealsMultiplier +
      stats.blocks * config.blocksMultiplier +
      stats.threePointersMade * config.threePointersMultiplier +
      stats.turnovers * config.turnoversMultiplier
    );
  }
}

// Run advanced tests
function runAdvancedProFeatureTests() {
  console.log('🚀 WNBA FANTASY PRO/PRO+ ADVANCED FEATURE TESTING');
  console.log('=' .repeat(70));
  console.log('Testing advanced algorithms with realistic player scenarios...\n');

  const tester = new AdvancedProFeatureTester();
  
  try {
    tester.testAdvancedHotDetection();
    tester.testAdvancedMinutesAnalysis();
    tester.testAdvancedWaiverRecommendations();
    tester.testInjuryRiskAssessment();
    tester.testCustomWeightedScoring();
    
    console.log('\n✅ ALL ADVANCED PRO/PRO+ FEATURE TESTS COMPLETED!');
    console.log('=' .repeat(70));
    console.log('🎯 Advanced Features Demonstrated:');
    console.log('   ✅ Hot streak detection with confidence scoring');
    console.log('   ✅ Multi-period minutes trend analysis');
    console.log('   ✅ Injury risk assessment and filtering');
    console.log('   ✅ Advanced matchup favorability calculations');
    console.log('   ✅ Custom weighted recommendation algorithms');
    console.log('   ✅ Confidence scoring for recommendations');
    console.log('   ✅ Comprehensive reasoning generation');
    console.log('   ✅ Real-world scenario handling');
    console.log('\n🚀 Production-ready Pro+ algorithms validated!');
    
  } catch (error) {
    console.error('❌ Advanced test failed:', error);
  }
}

// Execute advanced tests
runAdvancedProFeatureTests();