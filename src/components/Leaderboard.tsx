import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { LeaderboardEntry } from '../types';
import { Trophy, WifiOff } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { cacheLeaderboard, getCachedLeaderboard } from '../services/scoreService';

export const Leaderboard: React.FC = () => {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<{ rank: number, entry: LeaderboardEntry } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      setIsCached(false);
      const supabase = getSupabase();
      const currentUsername = localStorage.getItem('neon-dash-username');
      
      if (!supabase || isOffline) {
        const cachedData = getCachedLeaderboard();
        if (cachedData.length > 0) {
          setScores(cachedData.slice(0, 20));
          setIsCached(true);
          if (currentUsername) {
            const index = cachedData.findIndex(s => s.username === currentUsername);
            if (index !== -1) {
              setUserRank({ rank: index + 1, entry: cachedData[index] as any });
            }
          }
          setLoading(false);
          return;
        }
        
        if (isOffline) {
          setError('OFFLINE: Sem conexão com o servidor. Leaderboard indisponível.');
        } else {
          setError('DATABASE OFFLINE: Supabase environment variables are not configured.');
        }
        setLoading(false);
        return;
      }

      try {
        // Fetch top 100 to find user rank even if not in top 20
        const { data, error: fetchError } = await supabase
          .from('leaderboard')
          .select('*')
          .order('score', { ascending: false })
          .limit(100);

        if (fetchError) throw fetchError;
        
        const allScores = data || [];
        setScores(allScores.slice(0, 20)); // Show only top 20 in the main list
        cacheLeaderboard(allScores); // Cache for offline use

        if (currentUsername) {
          const index = allScores.findIndex(s => s.username === currentUsername);
          if (index !== -1) {
            setUserRank({ rank: index + 1, entry: allScores[index] });
          } else {
            setUserRank(null);
          }
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to fetch leaderboard', err);
        
        // Fallback to cache on error
        const cachedData = getCachedLeaderboard();
        if (cachedData.length > 0) {
          setScores(cachedData.slice(0, 20));
          setLoading(false);
          return;
        }

        setError(err.message || 'Failed to connect to leaderboard database.');
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [tick, isOffline]);

  if (loading) return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-neon-cyan animate-pulse font-mono text-xs uppercase tracking-widest">Accessing Database...</div>
      <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-full h-full bg-neon-cyan shadow-[0_0_10px_#00f3ff]"
        />
      </div>
    </div>
  );

  if (error) return (
    <div className="w-full max-w-lg bg-black/80 border border-neon-magenta/30 p-6 rounded-2xl backdrop-blur-md">
      <div className="text-neon-magenta font-mono text-xs uppercase tracking-widest mb-2 flex justify-between items-center">
        <span>System Alert</span>
        <button 
          onClick={() => setTick(t => t + 1)}
          className="text-[8px] border border-neon-magenta/50 px-2 py-1 rounded hover:bg-neon-magenta/20 transition-colors"
        >
          Retry Connection
        </button>
      </div>
      <div className="text-white/60 font-mono text-[10px] leading-relaxed mb-4">{error}</div>
      <div className="text-[8px] text-white/20 uppercase tracking-tighter space-y-1">
        <p>1. Ensure VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY are set in hosting provider.</p>
        <p>2. Ensure 'leaderboard' table exists with public RLS policies.</p>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-lg bg-black/80 border border-neon-cyan/30 p-4 sm:p-8 rounded-2xl backdrop-blur-md shadow-[0_0_30px_rgba(0,243,255,0.1)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trophy className="text-neon-yellow w-6 h-6 sm:w-8 sm:h-8" />
          <h2 className="text-xl sm:text-2xl font-bold text-neon-cyan uppercase tracking-widest">Top Dashers</h2>
          {isOffline && <WifiOff size={16} className="text-neon-magenta animate-pulse" />}
          {isCached && <span className="text-[8px] text-neon-magenta uppercase font-mono tracking-widest ml-1">(Cached)</span>}
        </div>
        <button 
          onClick={() => setTick(t => t + 1)}
          className="text-[10px] text-white/40 hover:text-neon-cyan transition-colors uppercase tracking-widest font-mono border border-white/10 px-3 py-1 rounded-full"
        >
          Refresh
        </button>
      </div>
      
      <div className="space-y-1 sm:space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar mb-6">
        {scores.map((entry, index) => (
          <div 
            key={index}
            className={`flex justify-between items-center py-3 px-2 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded-lg ${
              userRank?.entry.username === entry.username ? 'bg-neon-cyan/10 border-neon-cyan/30' : ''
            }`}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <span className={`text-sm sm:text-lg font-mono w-8 ${index < 3 ? 'text-neon-yellow font-bold' : 'text-gray-500'}`}>
                {index + 1}.
              </span>
              <span className={`font-medium text-sm sm:text-base truncate max-w-[120px] sm:max-w-none ${
                userRank?.entry.username === entry.username ? 'text-neon-cyan' : ''
              }`}>
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

      {userRank && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="text-[10px] text-white/40 uppercase tracking-widest mb-2 font-mono">Your Current Standing</div>
          <div className="flex justify-between items-center py-3 px-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-xl">
            <div className="flex items-center gap-4">
              <span className="text-neon-cyan font-mono font-bold">#{userRank.rank}</span>
              <span className="font-bold text-white uppercase tracking-tighter">{userRank.entry.username}</span>
            </div>
            <span className="text-neon-lime font-mono font-bold">{userRank.entry.score.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};
