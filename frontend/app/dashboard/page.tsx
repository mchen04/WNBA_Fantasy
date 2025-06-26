'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useUserStore } from '@/lib/store/user';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { RecentGames } from '@/components/dashboard/RecentGames';
import { TopPerformers } from '@/components/dashboard/TopPerformers';
import { SubscriptionCard } from '@/components/dashboard/SubscriptionCard';

export default function DashboardPage() {
  const { data: session } = useSession();
  const setUser = useUserStore((state) => state.setUser);

  useEffect(() => {
    if (session?.user) {
      // Set user in store - in real app, would fetch full user data from API
      setUser({
        id: session.user.id,
        email: session.user.email!,
        googleId: '', // Would come from API
        name: session.user.name,
        subscriptionTier: 'FREE', // Would come from API
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }, [session, setUser]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-wnba-gray-900">Dashboard</h1>
        <p className="mt-2 text-wnba-gray-600">
          Welcome back, {session?.user?.name || session?.user?.email}! Here's your fantasy analytics overview.
        </p>
      </div>

      <DashboardStats />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TopPerformers />
          <RecentGames />
        </div>
        <div>
          <SubscriptionCard />
        </div>
      </div>
    </div>
  );
}