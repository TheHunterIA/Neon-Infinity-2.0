import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { LeaderboardEntry } from '../types';
import { Trophy } from 'lucide-react';
import { getSupabase } from '../lib/supabase';

export const Leaderboard: React.FC = () => {
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);
      const supabase = getSupabase();
      
      if (!supabase) {
        setError('DATABASE OFFLINE: Supabase environment variables are not configured.');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('leaderboard')
          .select('*')
          .order('score', { ascending: false })
          .limit(10);

        if (fetchError) throw fetchError;
        
        setScores(data || []);
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to fetch leaderboard', err);
        setError(err.message || 'Failed to connect to leaderboard database.');
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [tick]); // Use a tick to allow manual refresh

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
