'use client';

import { TrendingUp } from 'lucide-react';

const topPerformers = [
  {
    id: 1,
    name: 'A\'ja Wilson',
    team: 'Las Vegas Aces',
    position: 'F',
    fantasyPoints: 52.4,
    trend: 'up',
    lastGame: 48,
  },
  {
    id: 2,
    name: 'Breanna Stewart',
    team: 'New York Liberty',
    position: 'F',
    fantasyPoints: 48.7,
    trend: 'up',
    lastGame: 51,
  },
  {
    id: 3,
    name: 'Alyssa Thomas',
    team: 'Connecticut Sun',
    position: 'F',
    fantasyPoints: 45.2,
    trend: 'down',
    lastGame: 42,
  },
  {
    id: 4,
    name: 'Napheesa Collier',
    team: 'Minnesota Lynx',
    position: 'F',
    fantasyPoints: 43.8,
    trend: 'up',
    lastGame: 45,
  },
  {
    id: 5,
    name: 'Sabrina Ionescu',
    team: 'New York Liberty',
    position: 'G',
    fantasyPoints: 41.3,
    trend: 'stable',
    lastGame: 41,
  },
];

export function TopPerformers() {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-wnba-gray-900">Top Performers</h2>
        <span className="text-sm text-wnba-gray-500">Last 7 days</span>
      </div>
      
      <div className="space-y-3">
        {topPerformers.map((player, index) => (
          <div key={player.id} className="flex items-center justify-between p-3 hover:bg-wnba-gray-50 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-wnba-gray-400 w-6">
                {index + 1}
              </span>
              <div>
                <p className="font-medium text-wnba-gray-900">{player.name}</p>
                <p className="text-sm text-wnba-gray-600">
                  {player.team} • {player.position}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="font-semibold text-wnba-gray-900">{player.fantasyPoints}</p>
              <div className="flex items-center gap-1 justify-end">
                <span className="text-sm text-wnba-gray-600">Last: {player.lastGame}</span>
                {player.trend === 'up' && (
                  <TrendingUp className="h-3 w-3 text-status-success" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-center">
        <a href="/rankings" className="text-sm text-wnba-orange hover:text-wnba-darkOrange font-medium">
          View All Rankings →
        </a>
      </div>
    </div>
  );
}