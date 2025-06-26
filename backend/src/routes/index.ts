import { Express } from 'express';
import authRoutes from './auth';
import playersRoutes from './players';
import scoringRoutes from './scoring';
import tradeRoutes from './trade';
import waiverRoutes from './waiver';
import subscriptionRoutes from './subscription';
import statsRoutes from './stats';
import { authenticate } from '../middleware/auth';

export const setupRoutes = (app: Express) => {
  // Public routes
  app.use('/api/auth', authRoutes);
  
  // Protected routes
  app.use('/api/players', playersRoutes);
  app.use('/api/scoring', authenticate, scoringRoutes);
  app.use('/api/trade', authenticate, tradeRoutes);
  app.use('/api/waiver', authenticate, waiverRoutes);
  app.use('/api/subscription', authenticate, subscriptionRoutes);
  app.use('/api/stats', authenticate, statsRoutes);
  
  // Stripe webhook (special case - no auth but signature verification)
  app.use('/api/webhook', require('./webhook').default);
  
  // 404 handler
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 404,
        message: 'Endpoint not found',
      },
    });
  });
};