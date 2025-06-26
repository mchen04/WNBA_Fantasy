import { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { validateBody } from '../middleware/validation';
import { AppError } from '../middleware/error';
import { SUBSCRIPTION_PLANS } from '@shared/constants';

const router = Router();
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-04-10',
});

// Get current subscription
router.get('/current', async (req, res, next) => {
  try {
    const user = (req as any).user;
    
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        stripeSubscriptionId: true,
      },
    });
    
    let cancelAtPeriodEnd = false;
    
    if (userData?.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(userData.stripeSubscriptionId);
        cancelAtPeriodEnd = subscription.cancel_at_period_end;
      } catch (error) {
        // Ignore Stripe errors
      }
    }
    
    res.json({
      success: true,
      data: {
        tier: userData?.subscriptionTier || 'FREE',
        status: userData?.subscriptionStatus || 'ACTIVE',
        currentPeriodEnd: userData?.currentPeriodEnd,
        cancelAtPeriodEnd,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create subscription checkout session
router.post(
  '/create',
  validateBody(z.object({ tier: z.enum(['pro', 'pro_plus']) })),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { tier } = req.body;
      
      // Get or create Stripe customer
      let customerId = (await prisma.user.findUnique({
        where: { id: user.id },
        select: { stripeCustomerId: true },
      }))?.stripeCustomerId;
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id,
          },
        });
        
        customerId = customer.id;
        
        await prisma.user.update({
          where: { id: user.id },
          data: { stripeCustomerId: customerId },
        });
      }
      
      // Create checkout session
      const priceId = tier === 'pro' 
        ? config.stripe.proPriceId 
        : config.stripe.proPlusPriceId;
      
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
          userId: user.id,
          tier,
        },
      });
      
      res.json({
        success: true,
        data: {
          sessionUrl: session.url,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update subscription tier
router.post(
  '/update',
  validateBody(z.object({ tier: z.enum(['pro', 'pro_plus']) })),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { tier } = req.body;
      
      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: { stripeSubscriptionId: true, subscriptionTier: true },
      });
      
      if (!userData?.stripeSubscriptionId) {
        throw new AppError('No active subscription found', 400);
      }
      
      if (
        (userData.subscriptionTier === 'PRO' && tier === 'pro') ||
        (userData.subscriptionTier === 'PRO_PLUS' && tier === 'pro_plus')
      ) {
        throw new AppError('Already subscribed to this tier', 400);
      }
      
      // Get new price ID
      const newPriceId = tier === 'pro' 
        ? config.stripe.proPriceId 
        : config.stripe.proPlusPriceId;
      
      // Update subscription
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
        where: { id: user.id },
        data: {
          subscriptionTier: tier === 'pro' ? 'PRO' : 'PRO_PLUS',
        },
      });
      
      res.json({
        success: true,
        data: {
          subscription: {
            id: updatedSubscription.id,
            status: updatedSubscription.status,
            currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Cancel subscription
router.post('/cancel', async (req, res, next) => {
  try {
    const user = (req as any).user;
    
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeSubscriptionId: true },
    });
    
    if (!userData?.stripeSubscriptionId) {
      throw new AppError('No active subscription found', 400);
    }
    
    // Cancel at period end
    const subscription = await stripe.subscriptions.update(
      userData.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );
    
    res.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Reactivate subscription
router.post('/reactivate', async (req, res, next) => {
  try {
    const user = (req as any).user;
    
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeSubscriptionId: true },
    });
    
    if (!userData?.stripeSubscriptionId) {
      throw new AppError('No subscription found', 400);
    }
    
    // Reactivate subscription
    const subscription = await stripe.subscriptions.update(
      userData.stripeSubscriptionId,
      { cancel_at_period_end: false }
    );
    
    res.json({
      success: true,
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get usage
router.get('/usage', async (req, res, next) => {
  try {
    const user = (req as any).user;
    const now = new Date();
    const period = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Get usage for current period
    const usageData = await prisma.usageTracking.findMany({
      where: {
        userId: user.id,
        period,
      },
    });
    
    const usage = {
      customScoringConfigs: {
        used: await prisma.scoringConfiguration.count({
          where: { userId: user.id },
        }),
        limit: SUBSCRIPTION_PLANS[user.subscriptionTier].limits.customScoringConfigs,
      },
      tradeCalculations: {
        used: usageData.find(u => u.feature === 'trade_calculator')?.count || 0,
        limit: SUBSCRIPTION_PLANS[user.subscriptionTier].limits.tradeCalculations,
      },
      apiCalls: {
        used: usageData.reduce((sum, u) => sum + u.count, 0),
        limit: SUBSCRIPTION_PLANS[user.subscriptionTier].limits.apiCalls,
      },
    };
    
    res.json({
      success: true,
      data: {
        tier: user.subscriptionTier,
        usage,
        resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get billing history
router.get('/billing-history', async (req, res, next) => {
  try {
    const user = (req as any).user;
    
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true },
    });
    
    if (!userData?.stripeCustomerId) {
      return res.json({
        success: true,
        data: { invoices: [] },
      });
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
    
    res.json({
      success: true,
      data: {
        invoices: formattedInvoices,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create customer portal session
router.post('/portal', async (req, res, next) => {
  try {
    const user = (req as any).user;
    
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true },
    });
    
    if (!userData?.stripeCustomerId) {
      throw new AppError('No customer record found', 400);
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: userData.stripeCustomerId,
      return_url: `${config.cors.frontendUrl}/settings`,
    });
    
    res.json({
      success: true,
      data: {
        url: session.url,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;