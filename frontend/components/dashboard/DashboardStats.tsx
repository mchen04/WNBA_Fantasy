'use client';

import { Users, Trophy, TrendingUp, Calculator } from 'lucide-react';

const stats = [
  {
    name: 'Total Players',
    value: '144',
    icon: Users,
    change: '+12',
    changeType: 'positive',
  },
  {
    name: 'Games This Week',
    value: '24',
    icon: Trophy,
    change: '6 today',
    changeType: 'neutral',
  },
  {
    name: 'Hot Players',
    value: '18',
    icon: TrendingUp,
    change: '+5',
    changeType: 'positive',
  },
  {
    name: 'Scoring Configs',
    value: '3',
    icon: Calculator,
    change: '3 max',
    changeType: 'neutral',
  },
];

export function DashboardStats() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.name} className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">{stat.name}</p>
              <p className="stat-value">{stat.value}</p>
              <p className={`stat-change ${
                stat.changeType === 'positive' ? 'stat-change-positive' : 
                stat.changeType === 'negative' ? 'stat-change-negative' : 
                'text-wnba-gray-600'
              }`}>
                {stat.change}
              </p>
            </div>
            <div className="p-3 bg-wnba-orange/10 rounded-full">
              <stat.icon className="h-6 w-6 text-wnba-orange" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}