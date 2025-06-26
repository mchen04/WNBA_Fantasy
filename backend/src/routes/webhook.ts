import express, { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { webhookRateLimiter } from '../middleware/rateLimit';

const router = Router();
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2024-04-10',
});

// Stripe webhook endpoint
router.post(
  '/stripe',
  webhookRateLimiter,
  express.raw({ type: 'application/json' }),
  async (req, res, next) => {
    const sig = req.headers['stripe-signature'] as string;

    if (!sig) {
      return res.status(400).json({
        success: false,
        error: { code: 400, message: 'Missing stripe signature' },
      });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret
      );
    } catch (err) {
      logger.error('Webhook signature verification failed:', err);
      return res.status(400).json({
        success: false,
        error: { code: 400, message: 'Invalid signature' },
      });
    }

    logger.info(`Received Stripe webhook: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const { userId, tier } = session.metadata!;

          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          // Update user subscription
          await prisma.user.update({
            where: { id: userId },
            data: {
              subscriptionTier: tier === 'pro' ? 'PRO' : 'PRO_PLUS',
              subscriptionStatus: 'ACTIVE',
              stripeSubscriptionId: subscription.id,
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            },
          });

          logger.info(`Subscription created for user ${userId}: ${tier}`);
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          // Find user by customer ID
          const user = await prisma.user.findUnique({
            where: { stripeCustomerId: customerId },
          });

          if (user) {
            // Determine tier from price ID
            let tier: 'FREE' | 'PRO' | 'PRO_PLUS' = 'FREE';
            const priceId = subscription.items.data[0]?.price.id;

            if (priceId === config.stripe.proPriceId) {
              tier = 'PRO';
            } else if (priceId === config.stripe.proPlusPriceId) {
              tier = 'PRO_PLUS';
            }

            // Update subscription details
            await prisma.user.update({
              where: { id: user.id },
              data: {
                subscriptionTier: tier,
                subscriptionStatus: mapStripeStatus(subscription.status),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              },
            });

            logger.info(`Subscription updated for user ${user.id}: ${tier}`);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          // Find user by customer ID
          const user = await prisma.user.findUnique({
            where: { stripeCustomerId: customerId },
          });

          if (user) {
            // Downgrade to free tier
            await prisma.user.update({
              where: { id: user.id },
              data: {
                subscriptionTier: 'FREE',
                subscriptionStatus: 'CANCELED',
                stripeSubscriptionId: null,
                currentPeriodEnd: null,
              },
            });

            logger.info(`Subscription canceled for user ${user.id}`);
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;

          // Find user by customer ID
          const user = await prisma.user.findUnique({
            where: { stripeCustomerId: customerId },
          });

          if (user && invoice.subscription) {
            // Update subscription status
            await prisma.user.update({
              where: { id: user.id },
              data: {
                subscriptionStatus: 'ACTIVE',
              },
            });

            logger.info(`Payment succeeded for user ${user.id}`);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string;

          // Find user by customer ID
          const user = await prisma.user.findUnique({
            where: { stripeCustomerId: customerId },
          });

          if (user) {
            // Update subscription status
            await prisma.user.update({
              where: { id: user.id },
              data: {
                subscriptionStatus: 'PAST_DUE',
              },
            });

            logger.warn(`Payment failed for user ${user.id}`);
          }
          break;
        }

        default:
          logger.info(`Unhandled webhook event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      logger.error('Webhook processing error:', error);
      res.status(500).json({
        success: false,
        error: { code: 500, message: 'Webhook processing failed' },
      });
    }
  }
);

// Helper function to map Stripe status to our enum
function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): 
  'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'INCOMPLETE' | 'TRIALING' {
  switch (stripeStatus) {
    case 'active':
      return 'ACTIVE';
    case 'canceled':
      return 'CANCELED';
    case 'past_due':
      return 'PAST_DUE';
    case 'incomplete':
    case 'incomplete_expired':
      return 'INCOMPLETE';
    case 'trialing':
      return 'TRIALING';
    default:
      return 'ACTIVE';
  }
}

export default router;