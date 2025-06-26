'use client';

import { useUserStore } from '@/lib/store/user';
import { CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

const tiers = {
  FREE: {
    name: 'Free',
    price: '$0',
    features: [
      { name: 'Player Statistics', available: true },
      { name: 'Custom Scoring', available: true },
      { name: 'Basic Rankings', available: true },
      { name: 'Trade Calculator', available: false },
      { name: 'Hot Players', available: false },
      { name: 'Daily Picks', available: false },
    ],
  },
  PRO: {
    name: 'Pro',
    price: '$14.99',
    features: [
      { name: 'Everything in Free', available: true },
      { name: 'Trade Calculator', available: true },
      { name: 'Hot Players', available: true },
      { name: 'Consistency Scores', available: true },
      { name: 'Advanced Analytics', available: true },
      { name: 'Daily Picks', available: false },
    ],
  },
  PRO_PLUS: {
    name: 'Pro+',
    price: '$24.99',
    features: [
      { name: 'Everything in Pro', available: true },
      { name: 'Daily Waiver Picks', available: true },
      { name: 'Matchup Analysis', available: true },
      { name: 'Advanced Algorithms', available: true },
      { name: 'Priority Support', available: true },
      { name: 'Unlimited Usage', available: true },
    ],
  },
};

export function SubscriptionCard() {
  const user = useUserStore((state) => state.user);
  const currentTier = user?.subscriptionTier || 'FREE';
  const tierInfo = tiers[currentTier];

  return (
    <div className="card">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-wnba-gray-900">Your Plan</h3>
        <div className="mt-2">
          <span className={`badge ${
            currentTier === 'PRO_PLUS' ? 'badge-pro-plus' : 
            currentTier === 'PRO' ? 'badge-pro' : 
            'badge-free'
          } text-lg px-4 py-2`}>
            {tierInfo.name}
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold text-wnba-gray-900">
          {tierInfo.price}
          <span className="text-sm font-normal text-wnba-gray-600">/month</span>
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {tierInfo.features.map((feature, index) => (
          <div key={index} className="flex items-center gap-2">
            {feature.available ? (
              <CheckCircle className="h-5 w-5 text-status-success flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-wnba-gray-300 flex-shrink-0" />
            )}
            <span className={`text-sm ${
              feature.available ? 'text-wnba-gray-900' : 'text-wnba-gray-400'
            }`}>
              {feature.name}
            </span>
          </div>
        ))}
      </div>

      {currentTier !== 'PRO_PLUS' && (
        <Link
          href="/pricing"
          className="block w-full text-center px-4 py-2 bg-wnba-orange text-white rounded-md hover:bg-wnba-darkOrange transition-colors"
        >
          Upgrade Plan
        </Link>
      )}

      {currentTier !== 'FREE' && (
        <Link
          href="/settings"
          className="block w-full text-center mt-2 px-4 py-2 text-wnba-gray-700 hover:text-wnba-gray-900"
        >
          Manage Subscription
        </Link>
      )}
    </div>
  );
}