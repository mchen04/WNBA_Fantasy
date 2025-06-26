import { apiClient } from './client';
import type { SubscriptionTier, SubscriptionStatus } from '@shared/types';

export const subscriptionApi = {
  // Get current subscription status
  async getSubscription(): Promise<{
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
  }> {
    return apiClient.get('/api/subscription/current');
  },

  // Create a new subscription
  async createSubscription(tier: SubscriptionTier): Promise<{
    sessionUrl: string;
  }> {
    return apiClient.post('/api/subscription/create', { tier });
  },

  // Update subscription tier
  async updateSubscription(tier: SubscriptionTier): Promise<{
    subscription: {
      id: string;
      status: SubscriptionStatus;
      currentPeriodEnd: string;
    };
  }> {
    return apiClient.post('/api/subscription/update', { tier });
  },

  // Cancel subscription
  async cancelSubscription(): Promise<{
    subscription: {
      id: string;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: string;
    };
  }> {
    return apiClient.post('/api/subscription/cancel');
  },

  // Reactivate canceled subscription
  async reactivateSubscription(): Promise<{
    subscription: {
      id: string;
      status: SubscriptionStatus;
      currentPeriodEnd: string;
    };
  }> {
    return apiClient.post('/api/subscription/reactivate');
  },

  // Get subscription usage
  async getUsage(): Promise<{
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
  }> {
    return apiClient.get('/api/subscription/usage');
  },

  // Get billing history
  async getBillingHistory(): Promise<{
    invoices: Array<{
      id: string;
      date: string;
      amount: number;
      status: 'paid' | 'pending' | 'failed';
      downloadUrl: string;
    }>;
  }> {
    return apiClient.get('/api/subscription/billing-history');
  },

  // Create customer portal session
  async createPortalSession(): Promise<{
    url: string;
  }> {
    return apiClient.post('/api/subscription/portal');
  },
};