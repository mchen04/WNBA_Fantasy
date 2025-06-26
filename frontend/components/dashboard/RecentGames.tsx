'use client';

const recentGames = [
  {
    id: 1,
    date: '2024-06-25',
    homeTeam: 'Las Vegas Aces',
    awayTeam: 'New York Liberty',
    homeScore: 88,
    awayScore: 84,
    topPlayer: 'A\'ja Wilson',
    topPlayerPoints: 52.4,
  },
  {
    id: 2,
    date: '2024-06-25',
    homeTeam: 'Connecticut Sun',
    awayTeam: 'Minnesota Lynx',
    homeScore: 78,
    awayScore: 82,
    topPlayer: 'Napheesa Collier',
    topPlayerPoints: 48.2,
  },
  {
    id: 3,
    date: '2024-06-24',
    homeTeam: 'Seattle Storm',
    awayTeam: 'Phoenix Mercury',
    homeScore: 95,
    awayScore: 89,
    topPlayer: 'Jewell Loyd',
    topPlayerPoints: 44.8,
  },
];

export function RecentGames() {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-wnba-gray-900">Recent Games</h2>
        <a href="/games" className="text-sm text-wnba-orange hover:text-wnba-darkOrange">
          View All
        </a>
      </div>
      
      <div className="space-y-4">
        {recentGames.map((game) => (
          <div key={game.id} className="border border-wnba-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm text-wnba-gray-600">
                {new Date(game.date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
              <div className="text-xs bg-wnba-gray-100 text-wnba-gray-700 px-2 py-1 rounded">
                Final
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className={`font-medium ${game.homeScore > game.awayScore ? 'text-wnba-gray-900' : 'text-wnba-gray-600'}`}>
                  {game.homeTeam}
                </span>
                <span className={`font-bold ${game.homeScore > game.awayScore ? 'text-wnba-gray-900' : 'text-wnba-gray-600'}`}>
                  {game.homeScore}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`font-medium ${game.awayScore > game.homeScore ? 'text-wnba-gray-900' : 'text-wnba-gray-600'}`}>
                  {game.awayTeam}
                </span>
                <span className={`font-bold ${game.awayScore > game.homeScore ? 'text-wnba-gray-900' : 'text-wnba-gray-600'}`}>
                  {game.awayScore}
                </span>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-wnba-gray-100">
              <p className="text-xs text-wnba-gray-600">
                Top Fantasy: <span className="font-medium text-wnba-gray-900">{game.topPlayer}</span> ({game.topPlayerPoints} pts)
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}