import Stripe from 'stripe';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { AppError } from '../middleware/error';
import { logger } from '../utils/logger';
import { SUBSCRIPTION_PLANS } from '@shared/constants';
import { SubscriptionTier, SubscriptionStatus } from '@shared/types';

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-04-10',
});

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export interface UsageInfo {
  tier: SubscriptionTier;
  usage: {
    customScoringConfigs: {
      used: number;
      limit: number;
    };
    tradeCalculations: {
      used: number;
      limit: number;
    };
    apiCalls: {
      used: number;
      limit: number;
    };
  };
  resetDate: string;
}

export interface BillingHistory {
  invoices: Array<{
    id: string;
    date: string;
    amount: number;
    status: string;
    downloadUrl: string;
  }>;
}

export class SubscriptionService {
  /**
   * Get current subscription info
   */
  async getCurrentSubscription(userId: string): Promise<SubscriptionInfo> {
    try {
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          subscriptionTier: true,
          subscriptionStatus: true,
          currentPeriodEnd: true,
          stripeSubscriptionId: true,
        },
      });

      if (!userData) {
        throw new AppError('User not found', 404);
      }

      let cancelAtPeriodEnd = false;

      if (userData.stripeSubscriptionId) {
        try {
          const subscription = await stripe.subscriptions.retrieve(userData.stripeSubscriptionId);
          cancelAtPeriodEnd = subscription.cancel_at_period_end;
        } catch (error) {
          logger.warn(`Failed to retrieve Stripe subscription: ${error}`);
          // Continue without cancellation info
        }
      }

      return {
        tier: userData.subscriptionTier,
        status: userData.subscriptionStatus,
        currentPeriodEnd: userData.currentPeriodEnd,
        cancelAtPeriodEnd,
      };
    } catch (error) {
      logger.error('Get current subscription failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to retrieve subscription info', 500);
    }
  }

  /**
   * Create Stripe checkout session for subscription
   */
  async createSubscriptionCheckout(
    userId: string,
    userEmail: string,
    tier: 'pro' | 'pro_plus'
  ): Promise<{ sessionUrl: string }> {
    try {
      // Get or create Stripe customer
      let customerId = (await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      }))?.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            userId,
          },
        });

        customerId = customer.id;

        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customerId },
        });
      }

      // Get price ID based on tier
      const priceId = tier === 'pro' 
        ? config.stripe.proPriceId 
        : config.stripe.proPlusPriceId;

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${config.cors.frontendUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.cors.frontendUrl}/pricing`,
        metadata: {
          userId,
          tier,
        },
      });

      if (!session.url) {
        throw new AppError('Failed to create checkout session', 500);
      }

      logger.info(`Created checkout session for user ${userId}, tier: ${tier}`);

      return {
        sessionUrl: session.url,
      };
    } catch (error) {
      logger.error('Create subscription checkout failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to create subscription checkout', 500);
    }
  }

  /**
   * Update subscription tier
   */
  async updateSubscriptionTier(
    userId: string,
    newTier: 'pro' | 'pro_plus'
  ): Promise<{ subscription: { id: string; status: string; currentPeriodEnd: string } }> {
    try {
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeSubscriptionId: true, subscriptionTier: true },
      });

      if (!userData?.stripeSubscriptionId) {
        throw new AppError('No active subscription found', 400);
      }

      const currentTier = userData.subscriptionTier.toLowerCase().replace('_', '_');
      if (
        (currentTier === 'pro' && newTier === 'pro') ||
        (currentTier === 'pro_plus' && newTier === 'pro_plus')
      ) {
        throw new AppError('Already subscribed to this tier', 400);
      }

      // Get new price ID
      const newPriceId = newTier === 'pro' 
        ? config.stripe.proPriceId 
        : config.stripe.proPlusPriceId;

      // Update subscription in Stripe
      const subscription = await stripe.subscriptions.retrieve(userData.stripeSubscriptionId);
      const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: 'create_prorations',
      });

      // Update database
      await prisma.user.update({
        where: { id: userId },
        data: {
          subscriptionTier: newTier === 'pro' ? SubscriptionTier.PRO : SubscriptionTier.PRO_PLUS,
        },
      });

      logger.info(`Updated subscription for user ${userId} to ${newTier}`);

      return {
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        },
      };
    } catch (error) {
      logger.error('Update subscription tier failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to update subscription', 500);
    }
  }

  /**
   * Cancel subscription at period end
   */
  async cancelSubscription(userId: string): Promise<{ 
    subscription: { 
      id: string; 
      cancelAtPeriodEnd: boolean; 
      currentPeriodEnd: string 
    } 
  }> {
    try {
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeSubscriptionId: true },
      });

      if (!userData?.stripeSubscriptionId) {
        throw new AppError('No active subscription found', 400);
      }

      // Cancel at period end in Stripe
      const subscription = await stripe.subscriptions.update(
        userData.stripeSubscriptionId,
        { cancel_at_period_end: true }
      );

      logger.info(`Cancelled subscription for user ${userId} at period end`);

      return {
        subscription: {
          id: subscription.id,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        },
      };
    } catch (error) {
      logger.error('Cancel subscription failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to cancel subscription', 500);
    }
  }

  /**
   * Reactivate subscription
   */
  async reactivateSubscription(userId: string): Promise<{ 
    subscription: { 
      id: string; 
      status: string; 
      currentPeriodEnd: string 
    } 
  }> {
    try {
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeSubscriptionId: true },
      });

      if (!userData?.stripeSubscriptionId) {
        throw new AppError('No subscription found', 400);
      }

      // Reactivate subscription in Stripe
      const subscription = await stripe.subscriptions.update(
        userData.stripeSubscriptionId,
        { cancel_at_period_end: false }
      );

      logger.info(`Reactivated subscription for user ${userId}`);

      return {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        },
      };
    } catch (error) {
      logger.error('Reactivate subscription failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to reactivate subscription', 500);
    }
  }

  /**
   * Get usage information
   */
  async getUsageInfo(userId: string, userTier: SubscriptionTier): Promise<UsageInfo> {
    try {
      const now = new Date();
      const period = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get usage for current period
      const usageData = await prisma.usageTracking.findMany({
        where: {
          userId,
          period,
        },
      });

      const usage = {
        customScoringConfigs: {
          used: await prisma.scoringConfiguration.count({
            where: { userId },
          }),
          limit: SUBSCRIPTION_PLANS[userTier].limits.customScoringConfigs || 1,
        },
        tradeCalculations: {
          used: usageData.find(u => u.feature === 'trade_calculator')?.count || 0,
          limit: SUBSCRIPTION_PLANS[userTier].limits.tradeCalculations || 5,
        },
        apiCalls: {
          used: usageData.reduce((sum, u) => sum + u.count, 0),
          limit: SUBSCRIPTION_PLANS[userTier].limits.apiCalls || 100,
        },
      };

      return {
        tier: userTier,
        usage,
        resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      };
    } catch (error) {
      logger.error('Get usage info failed:', error);
      throw new AppError('Failed to retrieve usage information', 500);
    }
  }

  /**
   * Get billing history
   */
  async getBillingHistory(userId: string): Promise<BillingHistory> {
    try {
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      });

      if (!userData?.stripeCustomerId) {
        return { invoices: [] };
      }

      const invoices = await stripe.invoices.list({
        customer: userData.stripeCustomerId,
        limit: 10,
      });

      const formattedInvoices = invoices.data.map(invoice => ({
        id: invoice.id,
        date: new Date(invoice.created * 1000).toISOString(),
        amount: invoice.total / 100,
        status: invoice.status || 'pending',
        downloadUrl: invoice.invoice_pdf || '',
      }));

      return {
        invoices: formattedInvoices,
      };
    } catch (error) {
      logger.error('Get billing history failed:', error);
      throw new AppError('Failed to retrieve billing history', 500);
    }
  }

  /**
   * Create customer portal session
   */
  async createCustomerPortalSession(userId: string): Promise<{ url: string }> {
    try {
      const userData = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      });

      if (!userData?.stripeCustomerId) {
        throw new AppError('No customer record found', 400);
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: userData.stripeCustomerId,
        return_url: `${config.cors.frontendUrl}/settings`,
      });

      return {
        url: session.url,
      };
    } catch (error) {
      logger.error('Create customer portal session failed:', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError('Failed to create customer portal session', 500);
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
        default:
          logger.info(`Unhandled Stripe webhook event: ${event.type}`);
      }
    } catch (error) {
      logger.error('Handle Stripe webhook failed:', error);
      throw new AppError('Failed to process webhook', 500);
    }
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      logger.warn(`User not found for Stripe customer: ${customerId}`);
      return;
    }

    // Determine tier from price ID
    const priceId = subscription.items.data[0]?.price.id;
    let tier: SubscriptionTier = SubscriptionTier.FREE;
    
    if (priceId === config.stripe.proPriceId) {
      tier = SubscriptionTier.PRO;
    } else if (priceId === config.stripe.proPlusPriceId) {
      tier = SubscriptionTier.PRO_PLUS;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: tier,
        subscriptionStatus: subscription.status.toUpperCase() as SubscriptionStatus,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    logger.info(`Updated subscription for user ${user.id}: ${tier}, status: ${subscription.status}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      logger.warn(`User not found for Stripe customer: ${customerId}`);
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: 'FREE',
        subscriptionStatus: 'CANCELED',
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
      },
    });

    logger.info(`Subscription deleted for user ${user.id}, downgraded to FREE`);
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    logger.info(`Payment succeeded for invoice: ${invoice.id}`);
    // Additional logic for successful payments if needed
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = invoice.customer as string;
    
    const user = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      logger.warn(`User not found for Stripe customer: ${customerId}`);
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'PAST_DUE',
      },
    });

    logger.warn(`Payment failed for user ${user.id}, marked as PAST_DUE`);
  }
}

export const subscriptionService = new SubscriptionService();