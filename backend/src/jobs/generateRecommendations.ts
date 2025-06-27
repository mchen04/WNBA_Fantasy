import { logger } from '../utils/logger';
import { waiverService } from '../services/waiverService';
import { WAIVER_WIRE_CONFIG } from '@shared/constants';

export const generateDailyRecommendations = async (date?: string) => {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    logger.info(`Generating daily waiver recommendations for ${targetDate}...`);

    // Generate recommendations for the target date
    const recommendations = await waiverService.generateRecommendations(
      targetDate,
      WAIVER_WIRE_CONFIG.DEFAULT_EXCLUDE_TOP_N
    );

    logger.info(`Successfully generated ${recommendations.length} waiver recommendations for ${targetDate}`);
    
    return {
      date: targetDate,
      recommendationsCount: recommendations.length,
      success: true,
    };
  } catch (error) {
    logger.error('Failed to generate daily recommendations:', error);
    throw error;
  }
};

// Generate recommendations for the next N days (useful for batch processing)
export const generateRecommendationsForPeriod = async (days: number = 7) => {
  try {
    logger.info(`Generating waiver recommendations for the next ${days} days...`);
    
    const results = [];
    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateString = targetDate.toISOString().split('T')[0];
      
      try {
        const result = await generateDailyRecommendations(dateString);
        results.push(result);
        
        // Small delay between generations to avoid overwhelming the database
        if (i < days - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logger.error(`Failed to generate recommendations for ${dateString}:`, error);
        results.push({
          date: dateString,
          recommendationsCount: 0,
          success: false,
          error: error.message,
        });
      }
    }
    
    const successfulGenerations = results.filter(r => r.success).length;
    logger.info(`Generated recommendations for ${successfulGenerations}/${days} days`);
    
    return results;
  } catch (error) {
    logger.error('Failed to generate recommendations for period:', error);
    throw error;
  }
};