import React, { useEffect, useState } from 'react';
import { LeaderboardEntry } from '../types';
import { Trophy } from 'lucide-react';

export const Leaderboard: React.FC = () => {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => {
        if (!res.ok) throw new Error('Leaderboard API Unavailable');
        return res.json();
      })
      .then(data => {
        if (!Array.isArray(data)) throw new Error('Invalid data format');
        setScores(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch leaderboard', err);
        setError('DATABASE OFFLINE: Please ensure Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY) are configured in your dashboard.');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-neon-cyan animate-pulse font-mono text-xs uppercase tracking-widest">Accessing Database...</div>;
  if (error) return (
    <div className="w-full max-w-lg bg-black/80 border border-neon-magenta/30 p-6 rounded-2xl backdrop-blur-md">
      <div className="text-neon-magenta font-mono text-xs uppercase tracking-widest mb-2">System Alert</div>
      <div className="text-white/60 font-mono text-[10px] leading-relaxed">{error}</div>
      <div className="mt-4 text-[8px] text-white/20 uppercase tracking-tighter">
        Note: For Vercel deployment, use Supabase for persistent leaderboard data.
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-lg bg-black/80 border border-neon-cyan/30 p-4 sm:p-8 rounded-2xl backdrop-blur-md shadow-[0_0_30px_rgba(0,243,255,0.1)]">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="text-neon-yellow w-6 h-6 sm:w-8 sm:h-8" />
        <h2 className="text-xl sm:text-2xl font-bold text-neon-cyan uppercase tracking-widest">Top Dashers</h2>
      </div>
      
      <div className="space-y-1 sm:space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        {scores.map((entry, index) => (
          <div 
            key={index}
            className="flex justify-between items-center py-3 px-2 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <span className={`text-sm sm:text-lg font-mono w-8 ${index < 3 ? 'text-neon-yellow font-bold' : 'text-gray-500'}`}>
                {index + 1}.
              </span>
              <span className="font-medium text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">
                {entry.username}
              </span>
            </div>
            <span className="text-neon-lime font-mono font-bold text-sm sm:text-lg">{entry.score.toLocaleString()}</span>
          </div>
        ))}
        {scores.length === 0 && (
          <div className="text-center text-gray-500 py-8 italic">No scores yet. Be the first!</div>
        )}
      </div>
    </div>
  );
};
