import { getSupabase } from '../lib/supabase';

const PENDING_SCORES_KEY = 'neon_dash_pending_scores';
const LEADERBOARD_CACHE_KEY = 'neon_dash_leaderboard_cache';

export interface ScoreEntry {
  username: string;
  score: number;
  player_id: string;
  created_at?: string;
}

export const saveScoreLocally = (score: number, username: string, player_id: string) => {
  const pendingScores = getPendingScores();
  pendingScores.push({ username, score, player_id, created_at: new Date().toISOString() });
  localStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(pendingScores));
};

export const getPendingScores = (): ScoreEntry[] => {
  const stored = localStorage.getItem(PENDING_SCORES_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const clearPendingScores = () => {
  localStorage.removeItem(PENDING_SCORES_KEY);
};

export const syncPendingScores = async () => {
  const pendingScores = getPendingScores();
  if (pendingScores.length === 0) return;

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('leaderboard')
      .upsert(
        pendingScores.map(s => ({ 
          username: s.username, 
          score: s.score, 
          player_id: s.player_id 
        })),
        { onConflict: 'username' }
      );

    if (!error) {
      clearPendingScores();
      console.log('Scores synced successfully');
    } else {
      console.error('Error syncing scores:', error);
    }
  } catch (err) {
    console.error('Sync failed:', err);
  }
};

export const cacheLeaderboard = (data: ScoreEntry[]) => {
  localStorage.setItem(LEADERBOARD_CACHE_KEY, JSON.stringify(data));
};

export const getCachedLeaderboard = (): ScoreEntry[] => {
  const stored = localStorage.getItem(LEADERBOARD_CACHE_KEY);
  return stored ? JSON.parse(stored) : [];
};
