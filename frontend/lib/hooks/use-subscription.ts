import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '@/lib/api';
import { useUserStore } from '@/lib/store/user';
import { useRouter } from 'next/navigation';
import type { SubscriptionTier } from '@shared/types';
import toast from 'react-hot-toast';

// Query keys factory
export const subscriptionKeys = {
  all: ['subscription'] as const,
  current: () => [...subscriptionKeys.all, 'current'] as const,
  usage: () => [...subscriptionKeys.all, 'usage'] as const,
  billingHistory: () => [...subscriptionKeys.all, 'billing-history'] as const,
};

// Get current subscription
export function useSubscription() {
  const updateSubscriptionTier = useUserStore((state) => state.updateSubscriptionTier);

  return useQuery({
    queryKey: subscriptionKeys.current(),
    queryFn: async () => {
      const subscription = await subscriptionApi.getSubscription();
      updateSubscriptionTier(subscription.tier);
      return subscription;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

// Create subscription checkout session
export function useCreateSubscription() {
  const router = useRouter();

  return useMutation({
    mutationFn: (tier: SubscriptionTier) => subscriptionApi.createSubscription(tier),
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      window.location.href = data.sessionUrl;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create subscription');
    },
  });
}

// Update subscription tier
export function useUpdateSubscription() {
  const queryClient = useQueryClient();
  const updateSubscriptionTier = useUserStore((state) => state.updateSubscriptionTier);

  return useMutation({
    mutationFn: (tier: SubscriptionTier) => subscriptionApi.updateSubscription(tier),
    onSuccess: (data, tier) => {
      updateSubscriptionTier(tier);
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage() });
      toast.success('Subscription updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update subscription');
    },
  });
}

// Cancel subscription
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => subscriptionApi.cancelSubscription(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      toast.success(`Subscription will be canceled at the end of the current period`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to cancel subscription');
    },
  });
}

// Reactivate subscription
export function useReactivateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => subscriptionApi.reactivateSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      toast.success('Subscription reactivated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to reactivate subscription');
    },
  });
}

// Get subscription usage
export function useSubscriptionUsage() {
  const user = useUserStore((state) => state.user);
  const hasSubscription = user?.subscriptionTier !== 'free';

  return useQuery({
    queryKey: subscriptionKeys.usage(),
    queryFn: () => subscriptionApi.getUsage(),
    enabled: hasSubscription,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

// Get billing history
export function useBillingHistory() {
  const user = useUserStore((state) => state.user);
  const hasSubscription = user?.subscriptionTier !== 'free';

  return useQuery({
    queryKey: subscriptionKeys.billingHistory(),
    queryFn: () => subscriptionApi.getBillingHistory(),
    enabled: hasSubscription,
    staleTime: 10 * 60 * 1000,
  });
}

// Create customer portal session
export function useCreatePortalSession() {
  return useMutation({
    mutationFn: () => subscriptionApi.createPortalSession(),
    onSuccess: (data) => {
      // Redirect to Stripe customer portal
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create portal session');
    },
  });
}