import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Game } from './components/Game';
import { Leaderboard } from './components/Leaderboard';
import { AdMob } from '@capacitor-community/admob';
import { Play, RotateCcw, Trophy, Share2, Github, Zap, Pause, Loader2, Settings, Copy, Check, Key } from 'lucide-react';
import { getSupabase } from './lib/supabase';
import { exibirVideoRecompensa } from './services/adMobService';
import { syncPendingScores, saveScoreLocally } from './services/scoreService';
import { InstallBanner } from './components/InstallBanner';
import { WifiOff } from 'lucide-react';

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isInvincible, setIsInvincible] = useState(false);
  const [hasRevived, setHasRevived] = useState(false);
  const [health, setHealth] = useState(100);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const [score, setScore] = useState(0);
  const [lastFinalScore, setLastFinalScore] = useState(0);
  const [gameOverMessage, setGameOverMessage] = useState('');
  const [nextCompetitor, setNextCompetitor] = useState<{ username: string, score: number } | null>(null);
  const [playerPos, setPlayerPos] = useState({ x: 0.5, y: 0.8, vx: 0, vy: 0 }); // Normalized coordinates + velocity
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('neon-dash-highscore');
    return saved ? parseInt(saved) : 0;
  });
  const [username, setUsername] = useState(() => localStorage.getItem('neon-dash-username') || '');
  const [playerId, setPlayerId] = useState(() => {
    let id = localStorage.getItem('neon-dash-player-id');
    if (!id) {
      id = crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('neon-dash-player-id', id);
    }
    return id;
  });
  const [tempUsername, setTempUsername] = useState(username);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [importId, setImportId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [activePowerUp, setActivePowerUp] = useState<{ type: string, end: number } | null>(null);
  const [tick, setTick] = useState(0);
  const [gameId, setGameId] = useState(0);

  const autoRebootTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerOfflineBanner = () => {
    if (!navigator.onLine) {
      setShowOfflineBanner(true);
      setTimeout(() => setShowOfflineBanner(false), 6000);
    }
  };

  useEffect(() => {
    // Show offline message at initial reboot
    triggerOfflineBanner();
    
    const handleOnline = () => {
      setIsOffline(false);
      setShowOfflineBanner(false);
      syncPendingScores();
    };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check
    if (navigator.onLine) {
      syncPendingScores();
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Stable refs for values used in callbacks to prevent game loop restarts
  const usernameRef = useRef(username);
  const highScoreRef = useRef(highScore);

  useEffect(() => { usernameRef.current = username; }, [username]);
  useEffect(() => { highScoreRef.current = highScore; }, [highScore]);

  useEffect(() => {
    if (activePowerUp) {
      const interval = setInterval(() => setTick(t => t + 1), 100);
      return () => clearInterval(interval);
    }
  }, [activePowerUp]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('neon-dash-highscore', score.toString());
    }
  }, [score]); // Removed highScore from dependency to prevent constant handleGameOver recreation

  const isGameOverRef = useRef(false);

  const handleGameOver = React.useCallback(async (finalScore: number) => {
    if (isGameOverRef.current) return;
    isGameOverRef.current = true;
    
    const currentUsername = usernameRef.current;
    const currentPlayerId = localStorage.getItem('neon-dash-player-id') || '';
    const currentHighScore = highScoreRef.current;

    setIsGameOver(true);
    setLastFinalScore(finalScore);
    
    // Personality Messages
    const messages = [
      "CRITICAL ERROR", "CONNECTION LOST", "SYSTEM FAILURE", 
      "PILOT TERMINATED", "DASH INTERRUPTED", "VOID REACHED",
      "SIGNAL DEGRADED", "HULL BREACHED", "CORE MELTDOWN",
      "NAVIGATION OFFLINE", "KINETIC IMPACT"
    ];
    const funMessages = [
      "Nice try, rookie.", "Is that all?", "The void is hungry.",
      "Rebooting systems...", "Try using your eyes next time.",
      "Almost had it. Almost.", "My grandma drives faster than this.",
      "Was that a dash or a crawl?", "Você bateu naquele asteroide de propósito, né?",
      "Talvez seja melhor jogar paciência?", "Erro 404: Habilidade não encontrada.",
      "A nave está bem, o piloto... nem tanto.", "Você está jogando com os pés?",
      "Foi doloroso de assistir.", "Você piscou? Porque perdeu tudo.",
      "Uma batata teria desviado disso.", "Seu giroscópio quebrou ou foram suas mãos?",
      "Você está fazendo os asteroides parecerem bons.", "Não peça demissão do seu emprego, piloto.",
      "Essa é uma forma de encerrar a carreira.", "Ai. Essa deve ter doído.",
      "A tela está ligada?", "Você é um talento natural... para bater.",
      "Asteroide 1 - Piloto 0.", "Tente virar o aparelho para o outro lado.",
      "Isso foi um speedrun de como perder?", "Impressionante... de tão ruim.",
      "Você é o motivo de termos seguro.", "Os asteroides estão rindo de você.",
      "Zero estrelas. Não recomendo este piloto.", "Você chama isso de pilotar?",
      "O vazio esperava mais. Muito mais.", "Até a IA está com vergonha de você."
    ];
    const highMessages = [
      "LEGENDARY RUN!", "NEW PROTOCOL ESTABLISHED", "GODLIKE PRECISION",
      "THE VOID IS IMPRESSED", "BEYOND THE HORIZON", "UNSTOPPABLE FORCE",
      "CHAMPION OF THE NEON", "DATA STREAM OPTIMIZED"
    ];

    if (finalScore > currentHighScore) {
      setGameOverMessage(highMessages[Math.floor(Math.random() * highMessages.length)]);
    } else if (finalScore < 500) {
      setGameOverMessage(funMessages[Math.floor(Math.random() * funMessages.length)]);
    } else {
      if (Math.random() < 0.3) {
        setGameOverMessage(funMessages[Math.floor(Math.random() * funMessages.length)]);
      } else {
        setGameOverMessage(messages[Math.floor(Math.random() * messages.length)]);
      }
    }

    // Auto-reboot logic
    if (autoRebootTimeoutRef.current) clearTimeout(autoRebootTimeoutRef.current);

    const startAutoReboot = () => {
      autoRebootTimeoutRef.current = setTimeout(() => {
        isGameOverRef.current = false;
        setIsStarted(true);
        setIsGameOver(false);
        setScore(0);
        setNextCompetitor(null);
        setPlayerPos({ x: 0.5, y: 0.8, vx: 0, vy: 0 });
        setHasRevived(false); // Reset revive for new run
        setHealth(100);
        setGameId(prev => prev + 1); // Force Game component to reset everything
        triggerOfflineBanner(); // Show banner on auto-reboot if offline
      }, 2500);
    };

    if (hasRevived) {
      startAutoReboot();
    } else {
      // If can revive, we wait a bit longer or wait for user action
      // For now, let's give 5 seconds to decide before auto-rebooting
      autoRebootTimeoutRef.current = setTimeout(startAutoReboot, 5000);
    }

    // Score saving logic
    if (currentUsername && finalScore >= 0) {
      console.log(`[Leaderboard] Processing score for ${currentUsername}: ${finalScore}`);
      
      // Always save locally first
      saveScoreLocally(finalScore, currentUsername, currentPlayerId);

      const supabase = getSupabase();
      
      if (!supabase || !navigator.onLine) {
        console.warn('[Leaderboard] Offline or Supabase not configured. Score saved locally for later sync.');
        return;
      }

      try {
        // Sync pending scores immediately if online
        await syncPendingScores();

        // 1. Fetch current best score from DB
        const { data: currentEntry, error: fetchError } = await supabase
          .from('leaderboard')
          .select('score, player_id')
          .eq('username', currentUsername)
          .maybeSingle();

        if (fetchError) {
          console.error('[Leaderboard] Error fetching existing score:', fetchError.message);
        }

        // If name is taken by someone else, we shouldn't update it
        // But startGame should have prevented this. This is a double check.
        if (currentEntry && currentEntry.player_id && currentEntry.player_id !== currentPlayerId) {
          console.error('[Leaderboard] Name taken by another player. Score not updated.');
          return;
        }

        const existingScore = currentEntry?.score || 0;

        // 2. Update if it's a new personal best
        if (finalScore > existingScore) {
          console.log(`[Leaderboard] New Personal Best! ${finalScore} > ${existingScore}. Updating database...`);
          const { error: upsertError } = await supabase
            .from('leaderboard')
            .upsert(
              { username: currentUsername, score: finalScore, player_id: currentPlayerId },
              { onConflict: 'username' }
            );
          
          if (upsertError) {
            console.error('[Leaderboard] Update failed:', upsertError.message);
            // If it fails with "onConflict" issues, it might be missing a unique constraint
            if (upsertError.message.includes('unique constraint')) {
              console.warn('[Leaderboard] Tip: Ensure "username" column has a UNIQUE constraint in Supabase.');
            }
          } else {
            console.log('[Leaderboard] Database updated successfully.');
          }
        } else {
          console.log(`[Leaderboard] Score ${finalScore} did not beat personal best of ${existingScore}.`);
        }
        
        // 3. Fetch full leaderboard to determine rank and next competitor
        const { data: lbData, error: lbError } = await supabase
          .from('leaderboard')
          .select('username, score')
          .order('score', { ascending: false })
          .limit(100);

        if (lbError) {
          console.error('[Leaderboard] Failed to fetch ranking data:', lbError.message);
          return;
        }

        if (lbData) {
          // Find the user's position in the global leaderboard (based on their BEST score)
          const myBestScore = Math.max(finalScore, existingScore);
          const myRankIndex = lbData.findIndex((s: any) => s.username === currentUsername);
          
          if (myRankIndex > 0) {
            // There is someone above us
            setNextCompetitor(lbData[myRankIndex - 1]);
            console.log(`[Leaderboard] Current Rank: ${myRankIndex + 1}. Next target: ${lbData[myRankIndex - 1].username} (${lbData[myRankIndex - 1].score})`);
          } else if (myRankIndex === 0) {
            // We are #1!
            setNextCompetitor(null);
            console.log('[Leaderboard] You are currently #1 in the Top 100!');
          } else {
            // Not in top 100
            setNextCompetitor(null);
            console.log('[Leaderboard] Score not yet in Top 100.');
          }
        }
      } catch (err) {
        console.error('[Leaderboard] Critical failure in update logic:', err);
      }
    }
  }, []); // Empty dependency array thanks to Refs

  const handleScoreUpdate = React.useCallback((newScore: number) => {
    setScore(newScore);
  }, []);

  const handleImportId = async () => {
    if (!importId.trim()) return;
    
    setIsImporting(true);
    const supabase = getSupabase();
    if (supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('leaderboard')
          .select('username, score')
          .eq('player_id', importId.trim())
          .maybeSingle();
        
        if (error) {
          alert('Erro ao verificar ID. Tente novamente.');
        } else if (data) {
          setPlayerId(importId.trim());
          localStorage.setItem('neon-dash-player-id', importId.trim());
          setUsername(data.username);
          localStorage.setItem('neon-dash-username', data.username);
          setHighScore(data.score);
          localStorage.setItem('neon-dash-highscore', data.score.toString());
          setTempUsername(data.username);
          alert(`Piloto ${data.username} importado com sucesso!`);
          setShowSettings(false);
          setImportId('');
        } else {
          alert('ID não encontrado no banco de dados.');
        }
      } catch (err) {
        console.error('Import failed:', err);
        alert('Falha na conexão.');
      }
    } else {
      alert('Conecte-se à internet para importar um perfil.');
    }
    setIsImporting(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(playerId);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const startGame = async () => {
    setNameError(null);
    if (!tempUsername.trim()) {
      setNameError('Please enter a pilot name');
      return;
    }
    
    const finalName = tempUsername.trim();
    
    // Individualization: Check if name is taken
    setIsCheckingName(true);
    const supabase = getSupabase();
    if (supabase && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('leaderboard')
          .select('player_id, score')
          .eq('username', finalName)
          .maybeSingle();
        
        if (error) {
          console.error('Error checking name availability:', error);
        } else if (data && data.player_id && data.player_id !== playerId) {
          setNameError('Este nome já está sendo usado por outro piloto.');
          setIsCheckingName(false);
          return;
        } else {
          // Claim the name immediately if it's new or belongs to us
          const { error: claimError } = await supabase
            .from('leaderboard')
            .upsert(
              { username: finalName, player_id: playerId, score: data?.score || 0 },
              { onConflict: 'username' }
            );
          
          if (claimError) {
            console.error('Error claiming name:', claimError);
          }
        }
      } catch (err) {
        console.error('Failed to verify name:', err);
      }
    }
    setIsCheckingName(false);

    setUsername(finalName);
    localStorage.setItem('neon-dash-username', finalName);
    
    if (autoRebootTimeoutRef.current) clearTimeout(autoRebootTimeoutRef.current);

    setIsStarted(true);
    setIsGameOver(false);
    isGameOverRef.current = false;
    setIsPaused(false);
    setIsInvincible(false);
    setHasRevived(false);
    setHealth(100);
    setScore(0);
    setShowLeaderboard(false);
    setPlayerPos({ x: 0.5, y: 0.8, vx: 0, vy: 0 });
    setGameId(prev => prev + 1);
    triggerOfflineBanner(); // Show banner on manual start if offline
  };

  const handleRevive = async () => {
    if (hasRevived || isAdLoading) return;
    
    if (isOffline) {
      alert('Vídeo indisponível offline. Conecte-se para reviver.');
      return;
    }

    if (autoRebootTimeoutRef.current) clearTimeout(autoRebootTimeoutRef.current);
    
    setIsAdLoading(true);

    try {
      const result = await exibirVideoRecompensa();
      
      setIsAdLoading(false);

      if (result) {
        setHasRevived(true);
        setHealth(100);
        setIsGameOver(false);
        isGameOverRef.current = false;
        setIsInvincible(true);
        
        // 3 segundos de invincibilidade
        setTimeout(() => {
          setIsInvincible(false);
        }, 3000);
      } else {
        // O usuário não assistiu até o final ou houve erro
        console.log('Revive cancelado ou falhou');
      }
    } catch (error) {
      setIsAdLoading(false);
      console.error('Erro no revive:', error);
      alert('Falha ao processar anúncio. Tente novamente.');
    }
  };

  const togglePause = React.useCallback(() => {
    if (isStarted && !isGameOver) {
      setIsPaused(prev => !prev);
    }
  }, [isStarted, isGameOver]);

  // Handle Input
  useEffect(() => {
    const keys = new Set<string>();
    let lastTouchPos: { x: number, y: number } | null = null;
    let lastTime = performance.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause();
        return;
      }
      keys.add(e.key);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key);
    };

    const handleBlur = () => {
      keys.clear();
      lastTouchPos = null;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (!isStarted || isGameOver || isPaused) return;
      const touch = e.touches[0];
      lastTouchPos = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isStarted || isGameOver || isPaused || !lastTouchPos) return;
      const touch = e.touches[0];
      
      const dx = (touch.clientX - lastTouchPos.x) / window.innerWidth;
      const dy = (touch.clientY - lastTouchPos.y) / window.innerHeight;
      
      setPlayerPos(prev => {
        let nx = prev.x + dx * 1.5; // Sensitivity multiplier
        let ny = prev.y + dy * 1.5;
        
        // Boundaries
        nx = Math.max(0.05, Math.min(0.95, nx));
        ny = Math.max(0.1, Math.min(0.95, ny));
        
        return { ...prev, x: nx, y: ny, vx: dx, vy: dy };
      });

      lastTouchPos = { x: touch.clientX, y: touch.clientY };
      
      // Prevent scrolling while playing
      if (e.cancelable) e.preventDefault();
    };

    const handleTouchEnd = () => {
      lastTouchPos = null;
    };

    let animationFrameId: number;
    const moveLoop = (time: number) => {
      const dt = Math.min(32, time - lastTime) / 16.67; 
      lastTime = time;

      if (isStarted && !isGameOver && !isPaused) {
        setPlayerPos(prev => {
          if (isNaN(dt)) return prev;

          const accel = 0.0015 * dt;
          const tiltAccel = 0.0045 * dt; // Increased acceleration (was 0.0025)
          const friction = Math.pow(0.9, dt);
          const maxVel = 0.025;
          let nvx = prev.vx;
          let nvy = prev.vy;
          let nx = prev.x;
          let ny = prev.y;

          // Keyboard Input (only if not touching)
          if (!lastTouchPos) {
            if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) nvx -= accel;
            if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) nvx += accel;
            if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) nvy -= accel;
            if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) nvy += accel;

            nvx *= friction;
            nvy *= friction;

            nvx = Math.max(-maxVel, Math.min(maxVel, nvx));
            nvy = Math.max(-maxVel, Math.min(maxVel, nvy));
            
            nx = prev.x + nvx;
            ny = prev.y + nvy;
          }

          // Boundary constraints
          if (nx < 0.05) { nx = 0.05; nvx = 0; }
          if (nx > 0.95) { nx = 0.95; nvx = 0; }
          if (ny < 0.1) { ny = 0.1; nvy = 0; }
          if (ny > 0.95) { ny = 0.95; nvy = 0; }

          if (isNaN(nx) || isNaN(ny)) return prev;
          return { x: nx, y: ny, vx: nvx, vy: nvy };
        });
      }
      animationFrameId = requestAnimationFrame(moveLoop);
    };

    animationFrameId = requestAnimationFrame(moveLoop);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isStarted, isGameOver, isPaused, togglePause]);

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-neon-cyan selection:text-black overflow-hidden">
      <div className="fixed inset-0 pointer-events-auto">
        <Game 
          key={gameId}
          isStarted={isStarted} 
          isGameOver={isGameOver} 
          isPaused={isPaused}
          isInvincible={isInvincible}
          playerPos={playerPos}
          onGameOver={handleGameOver}
          onScoreUpdate={handleScoreUpdate}
          onPowerUpChange={setActivePowerUp}
        />
      </div>

      {/* Offline Indicator */}
      <AnimatePresence>
        {showOfflineBanner && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 bg-neon-magenta/20 border border-neon-magenta/40 px-4 py-2 rounded-full backdrop-blur-md"
          >
            <WifiOff size={14} className="text-neon-magenta animate-pulse" />
            <span className="text-[10px] font-mono text-white uppercase tracking-widest">
              Modo Offline: Pontuação será sincronizada ao conectar
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD */}
      <AnimatePresence>
        {isStarted && !isGameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-10 p-8 flex flex-col justify-start"
          >
            <div className="flex justify-between items-start">
              <div className="flex flex-col opacity-40 hover:opacity-100 transition-opacity">
                <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.4em] text-white/60 font-mono">Protocol</span>
                <span className="text-lg sm:text-2xl font-black font-mono text-white tracking-tighter">DASH_INF</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="flex flex-col items-center mb-4">
                  <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.8em] text-neon-cyan/30 font-mono mb-1 sm:mb-2">Current Yield</span>
                  <span className="text-2xl sm:text-4xl font-black font-mono text-white/40 tracking-tighter">{score}</span>
                </div>

                {activePowerUp && (
                  <motion.div 
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex flex-col items-center bg-white/5 border border-white/10 px-4 py-2 rounded-2xl backdrop-blur-md"
                  >
                    <span className="text-[8px] uppercase tracking-widest text-neon-cyan font-bold">Active Protocol</span>
                    <span className="text-sm font-black font-mono text-white uppercase tracking-tighter">
                      {activePowerUp.type} ({Math.max(0, Math.ceil((activePowerUp.end - performance.now()) / 1000))}s)
                    </span>
                  </motion.div>
                )}
              </div>
              
              <div className="flex flex-col items-end gap-4 pointer-events-auto">
                <button 
                  onClick={togglePause}
                  className="p-2 sm:p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-neon-cyan transition-all group"
                >
                  <Pause size={18} className="text-white/40 group-hover:text-neon-cyan" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Menu */}
      <AnimatePresence>
        {!isStarted && !showLeaderboard && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 flex flex-col items-center justify-center z-20 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="mb-8 sm:mb-12 text-center px-4"
            >
              <h1 className="text-6xl sm:text-7xl md:text-9xl font-bold italic tracking-tighter uppercase leading-none">
                NEON<br/>
                <span className="text-neon-cyan neon-glow">DASH</span>
              </h1>
              <p className="mt-4 text-neon-magenta font-mono tracking-widest uppercase text-[10px] sm:text-sm">Infinity Protocol v1.0</p>
            </motion.div>

            <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-[280px] sm:max-w-xs px-4">
              {username ? (
                <div className="flex flex-col items-center gap-2 mb-2">
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] uppercase tracking-widest text-white/40 font-mono">Active Pilot</span>
                    <span className="text-lg font-black font-mono text-neon-cyan tracking-tighter uppercase">{username}</span>
                  </div>
                  <button 
                    onClick={() => {
                      setUsername('');
                      setTempUsername(username);
                    }}
                    className="text-[10px] text-white/40 hover:text-neon-magenta transition-colors uppercase tracking-widest border-b border-transparent hover:border-neon-magenta/30 pb-0.5"
                  >
                    Change Pilot
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="PILOT NAME"
                    value={tempUsername}
                    onChange={(e) => {
                      setTempUsername(e.target.value);
                      setNameError(null);
                    }}
                    className={`bg-white/5 border ${nameError ? 'border-neon-magenta' : 'border-white/20'} rounded-full py-3 px-6 text-center focus:outline-none focus:border-neon-cyan transition-colors uppercase tracking-widest font-mono text-sm`}
                    maxLength={15}
                    autoFocus
                  />
                  {nameError && (
                    <div className="flex flex-col items-center gap-1">
                      <motion.p 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-[10px] text-neon-magenta uppercase tracking-widest text-center font-bold"
                      >
                        {nameError}
                      </motion.p>
                      {nameError.includes('em uso') && (
                        <button 
                          onClick={() => setShowSettings(true)}
                          className="text-[9px] text-white/40 hover:text-neon-cyan transition-colors uppercase tracking-widest border-b border-white/10"
                        >
                          Já é você? Use sua Chave de Acesso
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <button 
                onClick={startGame}
                disabled={isCheckingName}
                className="group relative flex items-center justify-center gap-3 bg-neon-cyan text-black font-bold py-4 px-8 rounded-full hover:bg-white transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-wait"
              >
                {isCheckingName ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <Play fill="currentColor" size={24} />
                )}
                <span className="text-xl uppercase tracking-tighter">
                  {isCheckingName ? 'Verifying...' : 'Initiate Dash'}
                </span>
                <div className="absolute -inset-1 bg-neon-cyan opacity-30 blur-lg group-hover:opacity-60 transition-opacity" />
              </button>

              <p className="text-[8px] text-white/20 uppercase tracking-widest text-center mt-2">
                * Pilot names are unique and linked to your device
              </p>

              <button 
                onClick={() => setShowLeaderboard(true)}
                className="flex items-center justify-center gap-3 bg-transparent border border-white/20 hover:border-neon-yellow text-white font-medium py-3 px-8 rounded-full transition-all"
              >
                <Trophy size={20} className="text-neon-yellow" />
                <span className="uppercase tracking-widest text-xs">Leaderboard</span>
              </button>

              <button 
                onClick={() => setShowSettings(true)}
                className="flex items-center justify-center gap-3 bg-transparent border border-white/20 hover:border-neon-cyan text-white font-medium py-3 px-8 rounded-full transition-all"
              >
                <Settings size={20} className="text-neon-cyan" />
                <span className="uppercase tracking-widest text-xs">Pilot Profile</span>
              </button>
            </div>

            <div className="mt-16 flex gap-6 text-white/40">
              <Zap size={20} className="hover:text-neon-lime cursor-help transition-colors" />
              <Share2 size={20} className="hover:text-neon-cyan cursor-pointer transition-colors" />
              <Github size={20} className="hover:text-white cursor-pointer transition-colors" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Overlay (Minimalist & Glitchy) */}
      <AnimatePresence>
        {isGameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 1,
              x: [0, -10, 10, -5, 5, 0],
              filter: ["hue-rotate(0deg)", "hue-rotate(90deg)", "hue-rotate(0deg)"]
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 flex flex-col items-center justify-center z-50 bg-black/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center px-6"
            >
              <h2 className="text-4xl sm:text-7xl font-black text-white mb-2 italic uppercase tracking-tighter leading-tight">
                {gameOverMessage}
              </h2>
              <div className="text-4xl sm:text-5xl font-mono text-neon-cyan mb-6 neon-glow">{lastFinalScore}</div>
              
              <div className="flex flex-col items-center gap-4 mb-8">
                {!hasRevived && (
                  <button
                    onClick={handleRevive}
                    disabled={isOffline}
                    className={`group relative flex items-center justify-center gap-3 py-3 px-8 rounded-full border-2 transition-all transform hover:scale-105 active:scale-95 ${
                      isOffline
                        ? 'border-white/10 text-white/20 cursor-not-allowed'
                        : 'border-neon-magenta text-white hover:bg-neon-magenta/20 shadow-[0_0_15px_rgba(255,0,255,0.3)]'
                    }`}
                  >
                    <Play fill="currentColor" size={18} className={isOffline ? 'text-white/10' : 'text-neon-magenta'} />
                    <span className="uppercase tracking-widest font-bold text-sm">
                      {isOffline ? 'Vídeo indisponível offline' : 'REVIVER (VÍDEO)'}
                    </span>
                    {!isOffline && <div className="absolute -inset-1 bg-neon-magenta opacity-20 blur-md group-hover:opacity-40 transition-opacity" />}
                  </button>
                )}

                <div className="text-[10px] text-white/30 uppercase tracking-[0.5em] animate-pulse">
                  Auto-Rebooting Protocol...
                </div>
              </div>

              {nextCompetitor && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white/5 border border-white/10 px-4 sm:px-6 py-2 sm:py-3 rounded-full mb-4 inline-flex items-center"
                >
                  <span className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-widest">Next Rank: </span>
                  <span className="text-neon-magenta font-bold ml-2 text-xs sm:text-base">{nextCompetitor.username}</span>
                  <span className="text-white/40 mx-2">|</span>
                  <span className="text-neon-yellow font-mono text-xs sm:text-base">{nextCompetitor.score}</span>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ad Loading Modal */}
      <AnimatePresence>
        {isAdLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col items-center justify-center z-[100] bg-black/95 backdrop-blur-md"
          >
            <div className="relative">
              <Loader2 size={64} className="text-neon-cyan animate-spin mb-6" />
              <div className="absolute inset-0 bg-neon-cyan/20 blur-xl animate-pulse" />
            </div>
            <h3 className="text-2xl font-black text-white uppercase tracking-[0.2em] italic mb-2">
              Carregando Vídeo...
            </h3>
            <p className="text-neon-cyan/60 font-mono text-[10px] uppercase tracking-widest">
              Sincronizando com a rede neural
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings / Profile Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[110] bg-black/90 backdrop-blur-xl p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-neon-cyan uppercase tracking-tighter italic">Pilot Profile</h2>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-white/40 hover:text-white transition-colors uppercase text-[10px] tracking-widest"
                >
                  Close
                </button>
              </div>

              <div className="space-y-8">
                {/* Export Section */}
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3 font-mono">Your Access Key</label>
                  <div className="relative group">
                    <div className="bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-[10px] sm:text-xs text-neon-cyan break-all pr-12">
                      {playerId}
                    </div>
                    <button 
                      onClick={copyToClipboard}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-neon-cyan transition-colors"
                      title="Copy to clipboard"
                    >
                      {copySuccess ? <Check size={18} className="text-neon-lime" /> : <Copy size={18} />}
                    </button>
                  </div>
                  <p className="mt-3 text-[9px] text-white/30 leading-relaxed uppercase tracking-wider">
                    Use this key to access your profile and scores on other devices. Keep it secret!
                  </p>
                </div>

                <div className="h-px bg-white/10" />

                {/* Import Section */}
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.3em] text-white/40 mb-3 font-mono">Import Profile</label>
                  <div className="flex flex-col gap-3">
                    <div className="relative">
                      <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                      <input 
                        type="text"
                        placeholder="PASTE ACCESS KEY HERE"
                        value={importId}
                        onChange={(e) => setImportId(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-xs font-mono text-white focus:outline-none focus:border-neon-magenta transition-colors uppercase"
                      />
                    </div>
                    <button 
                      onClick={handleImportId}
                      disabled={isImporting || !importId.trim()}
                      className="w-full bg-neon-magenta text-white font-bold py-3 rounded-xl hover:bg-white hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isImporting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                      <span className="uppercase tracking-widest text-xs">Sync Profile</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause Menu */}
      <AnimatePresence>
        {isPaused && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col items-center justify-center z-40 bg-black/90 backdrop-blur-xl p-6"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-neon-cyan mb-8 sm:mb-12 uppercase italic text-center">System Paused</h2>
            
            <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-[280px] sm:max-w-xs">
              <button 
                onClick={togglePause}
                className="flex items-center justify-center gap-3 bg-neon-cyan text-black font-bold py-3 sm:py-4 px-8 rounded-full hover:bg-white transition-all transform hover:scale-105"
              >
                <Play fill="currentColor" size={20} className="sm:w-6 sm:h-6" />
                <span className="text-lg sm:text-xl uppercase tracking-tighter">Resume Dash</span>
              </button>

              <button 
                onClick={() => setShowLeaderboard(true)}
                className="flex items-center justify-center gap-3 bg-transparent border border-white/20 hover:border-neon-yellow text-white font-medium py-3 px-8 rounded-full transition-all"
              >
                <Trophy size={20} className="text-neon-yellow" />
                <span className="uppercase tracking-widest text-xs">Leaderboard</span>
              </button>

              <button 
                onClick={() => { setIsStarted(false); setIsPaused(false); }}
                className="flex items-center justify-center gap-3 bg-transparent border border-white/20 hover:border-neon-magenta text-white font-medium py-3 px-8 rounded-full transition-all"
              >
                <RotateCcw size={20} className="text-neon-magenta" />
                <span className="uppercase tracking-widest text-xs">Main Menu</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leaderboard Overlay */}
      <AnimatePresence>
        {showLeaderboard && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 flex flex-col items-center justify-center z-40 bg-black/95 p-4"
          >
            <Leaderboard />
            <button 
              onClick={() => setShowLeaderboard(false)}
              className="mt-8 text-neon-cyan hover:text-white transition-colors uppercase tracking-widest text-sm border-b border-neon-cyan/30 pb-1"
            >
              Close Database
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Controls Hint */}
      {!isStarted && (
        <div className="fixed bottom-8 left-0 right-0 text-center text-white/20 text-[10px] uppercase tracking-[0.3em] pointer-events-none px-4">
          Deslize para mover • WASD/Setas para Teclado
        </div>
      )}

      <InstallBanner />
    </div>
  );
}
