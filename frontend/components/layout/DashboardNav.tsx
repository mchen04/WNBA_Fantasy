'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { 
  Menu, 
  X, 
  User, 
  LogOut, 
  Settings,
  CreditCard,
  Bell 
} from 'lucide-react';
import { useAppStore } from '@/lib/store/app';
import { useUserStore } from '@/lib/store/user';
import Image from 'next/image';

export function DashboardNav() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const setMobileMenuOpen = useAppStore((state) => state.setMobileMenuOpen);
  const mobileMenuOpen = useAppStore((state) => state.mobileMenuOpen);
  const user = useUserStore((state) => state.user);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/');
  };

  const getTierBadgeClass = () => {
    switch (user?.subscriptionTier) {
      case 'PRO':
        return 'badge-pro';
      case 'PRO_PLUS':
        return 'badge-pro-plus';
      default:
        return 'badge-free';
    }
  };

  const getTierLabel = () => {
    switch (user?.subscriptionTier) {
      case 'PRO':
        return 'Pro';
      case 'PRO_PLUS':
        return 'Pro+';
      default:
        return 'Free';
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b border-wnba-gray-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-wnba-gray-600 hover:text-wnba-gray-900 hover:bg-wnba-gray-100"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
            
            <div className="flex items-center ml-4 lg:ml-0">
              <div className="flex-shrink-0 flex items-center">
                <div className="w-10 h-10 bg-gradient-wnba rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">WFA</span>
                </div>
                <span className="ml-3 text-xl font-bold text-wnba-gray-900">
                  WNBA Fantasy Analytics
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-wnba-gray-600 hover:text-wnba-gray-900 relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-status-error rounded-full"></span>
            </button>

            <div className={`badge ${getTierBadgeClass()}`}>
              {getTierLabel()}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-wnba-gray-100 transition-colors"
              >
                {session?.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-wnba-gray-300 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-wnba-gray-600" />
                  </div>
                )}
                <span className="text-sm font-medium text-wnba-gray-700 hidden sm:block">
                  {session?.user?.name || session?.user?.email}
                </span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                  <button
                    onClick={() => {
                      router.push('/settings');
                      setShowUserMenu(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-wnba-gray-700 hover:bg-wnba-gray-100 w-full text-left"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                  <button
                    onClick={() => {
                      router.push('/pricing');
                      setShowUserMenu(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-wnba-gray-700 hover:bg-wnba-gray-100 w-full text-left"
                  >
                    <CreditCard className="h-4 w-4" />
                    Subscription
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-wnba-gray-700 hover:bg-wnba-gray-100 w-full text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}