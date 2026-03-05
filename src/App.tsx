import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Game } from './components/Game';
import { Leaderboard } from './components/Leaderboard';
import { Play, RotateCcw, Trophy, Share2, Github, Zap, Pause } from 'lucide-react';

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
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
  const [tempUsername, setTempUsername] = useState(username);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [activePowerUp, setActivePowerUp] = useState<{ type: string, end: number } | null>(null);
  const [tick, setTick] = useState(0);

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
  }, [score, highScore]);

  const handleGameOver = React.useCallback(async (finalScore: number) => {
    setIsGameOver(true);
    setLastFinalScore(finalScore);
    
    // Personality Messages
    const messages = [
      "CRITICAL ERROR", "CONNECTION LOST", "SYSTEM FAILURE", 
      "PILOT TERMINATED", "DASH INTERRUPTED", "VOID REACHED"
    ];
    const funMessages = [
      "Nice try, rookie.", "Is that all?", "The void is hungry.",
      "Rebooting systems...", "Try using your eyes next time.",
      "Almost had it. Almost."
    ];
    const highMessages = [
      "LEGENDARY RUN!", "NEW PROTOCOL ESTABLISHED", "GODLIKE PRECISION",
      "THE VOID IS IMPRESSED"
    ];

    if (finalScore > highScore) {
      setGameOverMessage(highMessages[Math.floor(Math.random() * highMessages.length)]);
    } else if (finalScore < 100) {
      setGameOverMessage(funMessages[Math.floor(Math.random() * funMessages.length)]);
    } else {
      setGameOverMessage(messages[Math.floor(Math.random() * messages.length)]);
    }

    if (username && finalScore > 0) {
      console.log(`Attempting to save score: ${finalScore} for ${username}`);
      try {
        const response = await fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, score: finalScore }),
        });
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        
        console.log('Score saved successfully');
        
        // Fetch leaderboard to find next competitor
        const lbResponse = await fetch('/api/leaderboard');
        const lbData = await lbResponse.json();
        const myRankIndex = lbData.findIndex((s: any) => s.username === username && s.score === finalScore);
        if (myRankIndex > 0) {
          setNextCompetitor(lbData[myRankIndex - 1]);
        } else {
          setNextCompetitor(null);
        }
      } catch (err) {
        console.error('Failed to save score', err);
      }
    }

    // Instant-ish restart after 800ms
    setTimeout(() => {
      setIsStarted(true);
      setIsGameOver(false);
      setScore(0);
      setNextCompetitor(null);
      setPlayerPos({ x: 0.5, y: 0.8, vx: 0, vy: 0 });
    }, 800);
  }, [username, highScore]);

  const handleScoreUpdate = React.useCallback((newScore: number) => {
    setScore(newScore);
  }, []);

  const startGame = () => {
    if (!tempUsername.trim()) {
      alert('Please enter a pilot name');
      return;
    }
    
    const finalName = tempUsername.trim();
    setUsername(finalName);
    localStorage.setItem('neon-dash-username', finalName);
    
    setIsStarted(true);
    setIsGameOver(false);
    setIsPaused(false);
    setScore(0);
    setShowLeaderboard(false);
    setPlayerPos({ x: 0.5, y: 0.8, vx: 0, vy: 0 });
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
      {/* Background Grid Effect */}
      <div className="fixed inset-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #00f3ff 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <Game 
        isStarted={isStarted} 
        isGameOver={isGameOver} 
        isPaused={isPaused}
        playerPos={playerPos}
        onGameOver={handleGameOver}
        onScoreUpdate={handleScoreUpdate}
        onPowerUpChange={setActivePowerUp}
      />

      {/* HUD */}
      <AnimatePresence>
        {isStarted && !isGameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-10 p-8 flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <div className="flex flex-col opacity-40 hover:opacity-100 transition-opacity">
                <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.4em] text-white/60 font-mono">Protocol</span>
                <span className="text-lg sm:text-2xl font-black font-mono text-white tracking-tighter">DASH_INF</span>
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
              
              <div className="flex flex-col items-end gap-4 pointer-events-auto">
                <button 
                  onClick={togglePause}
                  className="p-2 sm:p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-neon-cyan transition-all group"
                >
                  <Pause size={18} className="text-white/40 group-hover:text-neon-cyan" />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center mb-8 sm:mb-12">
              <span className="text-[8px] sm:text-[10px] uppercase tracking-[0.8em] text-neon-cyan/30 font-mono mb-1 sm:mb-2">Current Yield</span>
              <span className="text-4xl sm:text-6xl font-black font-mono text-white/20 tracking-tighter">{score}</span>
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
              {!username && (
                <input
                  type="text"
                  placeholder="PILOT NAME"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  className="bg-white/5 border border-white/20 rounded-full py-3 px-6 text-center focus:outline-none focus:border-neon-cyan transition-colors uppercase tracking-widest font-mono text-sm"
                  maxLength={15}
                />
              )}
              
              <button 
                onClick={startGame}
                className="group relative flex items-center justify-center gap-3 bg-neon-cyan text-black font-bold py-4 px-8 rounded-full hover:bg-white transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                <Play fill="currentColor" size={24} />
                <span className="text-xl uppercase tracking-tighter">Initiate Dash</span>
                <div className="absolute -inset-1 bg-neon-cyan opacity-30 blur-lg group-hover:opacity-60 transition-opacity" />
              </button>

              <button 
                onClick={() => setShowLeaderboard(true)}
                className="flex items-center justify-center gap-3 bg-transparent border border-white/20 hover:border-neon-magenta text-white font-medium py-3 px-8 rounded-full transition-all"
              >
                <Trophy size={20} className="text-neon-yellow" />
                <span className="uppercase tracking-widest text-xs">Leaderboard</span>
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

              <div className="text-[10px] text-white/30 uppercase tracking-[0.5em] animate-pulse">
                Auto-Rebooting Protocol...
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
        <div className="fixed bottom-8 left-0 right-0 text-center text-white/20 text-[10px] uppercase tracking-[0.3em] pointer-events-none">
          Slide anywhere to move • WASD/Arrows for Keyboard
        </div>
      )}
    </div>
  );
}
