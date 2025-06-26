'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Users, 
  Calculator, 
  TrendingUp,
  Trophy,
  Settings,
  BarChart3,
  Star,
  ArrowLeftRight
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAppStore } from '@/lib/store/app';
import { useUserStore } from '@/lib/store/user';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Players', href: '/players', icon: Users },
  { name: 'Rankings', href: '/rankings', icon: Trophy },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, tier: 'pro' },
  { name: 'Trade Calculator', href: '/trade', icon: ArrowLeftRight, tier: 'pro' },
  { name: 'Hot Players', href: '/hot-players', icon: TrendingUp, tier: 'pro' },
  { name: 'Daily Picks', href: '/daily-picks', icon: Star, tier: 'pro_plus' },
  { name: 'Scoring Config', href: '/scoring', icon: Calculator },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const mobileMenuOpen = useAppStore((state) => state.mobileMenuOpen);
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const user = useUserStore((state) => state.user);

  const isAccessible = (tier?: string) => {
    if (!tier) return true;
    
    const tierHierarchy = {
      free: 0,
      pro: 1,
      pro_plus: 2,
    };

    const userTierLevel = tierHierarchy[user?.subscriptionTier?.toLowerCase() || 'free'];
    const requiredTierLevel = tierHierarchy[tier];
    
    return userTierLevel >= requiredTierLevel;
  };

  const getTierBadge = (tier?: string) => {
    if (!tier || isAccessible(tier)) return null;
    
    switch (tier) {
      case 'pro':
        return <span className="badge badge-pro text-xs ml-auto">Pro</span>;
      case 'pro_plus':
        return <span className="badge badge-pro-plus text-xs ml-auto">Pro+</span>;
      default:
        return null;
    }
  };

  return (
    <aside
      className={cn(
        'fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-wnba-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:block',
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        !sidebarOpen && 'lg:w-16'
      )}
    >
      <nav className="h-full flex flex-col py-4">
        <div className="flex-1 px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const accessible = isAccessible(item.tier);
            
            return (
              <Link
                key={item.name}
                href={accessible ? item.href : '/pricing'}
                className={cn(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-wnba-orange text-white'
                    : accessible
                    ? 'text-wnba-gray-700 hover:bg-wnba-gray-100 hover:text-wnba-gray-900'
                    : 'text-wnba-gray-400 hover:bg-wnba-gray-50'
                )}
              >
                <item.icon
                  className={cn(
                    'flex-shrink-0 h-5 w-5',
                    isActive ? 'text-white' : accessible ? 'text-wnba-gray-500' : 'text-wnba-gray-400',
                    sidebarOpen ? 'mr-3' : 'mx-auto'
                  )}
                />
                {sidebarOpen && (
                  <>
                    <span className="flex-1">{item.name}</span>
                    {getTierBadge(item.tier)}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}