import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { subscriptionService } from '../services/subscriptionService';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validation';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    subscriptionTier: string;
  };
}

export class SubscriptionController {
  /**
   * Get current subscription info
   */
  async getCurrentSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const subscription = await subscriptionService.getCurrentSubscription(userId);

      res.json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create subscription checkout session
   */
  async createSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const userEmail = req.user!.email;
      const { tier } = req.body;

      const result = await subscriptionService.createSubscriptionCheckout(userId, userEmail, tier);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update subscription tier
   */
  async updateSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { tier } = req.body;

      const result = await subscriptionService.updateSubscriptionTier(userId, tier);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const result = await subscriptionService.cancelSubscription(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const result = await subscriptionService.reactivateSubscription(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get usage information
   */
  async getUsage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const userTier = req.user!.subscriptionTier as any;

      const usage = await subscriptionService.getUsageInfo(userId, userTier);

      res.json({
        success: true,
        data: usage,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get billing history
   */
  async getBillingHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const billingHistory = await subscriptionService.getBillingHistory(userId);

      res.json({
        success: true,
        data: billingHistory,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create customer portal session
   */
  async createPortalSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const result = await subscriptionService.createCustomerPortalSession(userId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Stripe webhooks
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const body = req.body;

      // Stripe webhook verification would be done in middleware
      // For now, we'll assume the event is already validated
      const event = body;

      await subscriptionService.handleStripeWebhook(event);

      res.json({
        success: true,
        message: 'Webhook processed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const subscriptionController = new SubscriptionController();

// Route handlers with validation middleware
export const subscriptionRoutes = {
  getCurrentSubscription: [
    authenticate,
    subscriptionController.getCurrentSubscription.bind(subscriptionController),
  ],

  createSubscription: [
    authenticate,
    validateBody(z.object({ tier: z.enum(['pro', 'pro_plus']) })),
    subscriptionController.createSubscription.bind(subscriptionController),
  ],

  updateSubscription: [
    authenticate,
    validateBody(z.object({ tier: z.enum(['pro', 'pro_plus']) })),
    subscriptionController.updateSubscription.bind(subscriptionController),
  ],

  cancelSubscription: [
    authenticate,
    subscriptionController.cancelSubscription.bind(subscriptionController),
  ],

  reactivateSubscription: [
    authenticate,
    subscriptionController.reactivateSubscription.bind(subscriptionController),
  ],

  getUsage: [
    authenticate,
    subscriptionController.getUsage.bind(subscriptionController),
  ],

  getBillingHistory: [
    authenticate,
    subscriptionController.getBillingHistory.bind(subscriptionController),
  ],

  createPortalSession: [
    authenticate,
    subscriptionController.createPortalSession.bind(subscriptionController),
  ],

  handleWebhook: [
    // Note: Webhook handling should NOT use authentication middleware
    // and should include Stripe signature verification
    subscriptionController.handleWebhook.bind(subscriptionController),
  ],
};