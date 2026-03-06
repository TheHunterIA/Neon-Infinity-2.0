import React, { useEffect, useRef, useState } from 'react';
import { Obstacle, Particle } from '../types';

interface GameProps {
  isStarted: boolean;
  isGameOver: boolean;
  isPaused: boolean;
  isInvincible: boolean;
  playerPos: { x: number, y: number, vx: number, vy: number };
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
  onPowerUpChange: (powerUp: { type: string, end: number } | null) => void;
}

const LANES = 3;
const INITIAL_SPEED = 7;
const SPEED_INCREMENT = 0.002;

export const Game: React.FC<GameProps> = ({ isStarted, isGameOver, isPaused, isInvincible, playerPos, onGameOver, onScoreUpdate, onPowerUpChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerPosRef = useRef(playerPos);
  const [laneWidth, setLaneWidth] = useState(100);
  const scoreRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);
  const lastObstacleTime = useRef<number>(0);
  const shakeRef = useRef(0);
  const offsetRef = useRef(0);
  const starsRef = useRef<{ x: number, y: number, size: number, speed: number, opacity: number }[]>([]);
  
  // New Addictive Mechanics
  const comboRef = useRef(0);
  const multiplierRef = useRef(1);
  const lastLevelRef = useRef(0);
  const powerUpActiveRef = useRef<{ type: string, end: number } | null>(null);
  const floatingTextsRef = useRef<{ x: number, y: number, text: string, life: number, color: string }[]>([]);
  const blastWaveRef = useRef<{ x: number, y: number, radius: number, life: number } | null>(null);

  const isInitializedRef = useRef(false);

  useEffect(() => {
    playerPosRef.current = playerPos;
  }, [playerPos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const currentLaneWidth = Math.max(60, Math.min(140, canvas.width / (LANES + 1)));
      setLaneWidth(currentLaneWidth);
    };

    window.addEventListener('resize', resize);
    resize();

    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!isStarted || isGameOver || isPaused) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      // Only reset initialization if the game is stopped (not just Game Over, which might be revived)
      // We'll reset it in App.tsx when a fresh game starts
      if (!isStarted) {
        isInitializedRef.current = false;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Reset state ONLY on fresh start
    if (!isInitializedRef.current) {
      scoreRef.current = 0;
      speedRef.current = INITIAL_SPEED;
      obstaclesRef.current = [];
      particlesRef.current = [];
      floatingTextsRef.current = [];
      comboRef.current = 0;
      multiplierRef.current = 1;
      lastLevelRef.current = 0;
      powerUpActiveRef.current = null;
      lastObstacleTime.current = performance.now();
      shakeRef.current = 0;
      offsetRef.current = 0;

      // Initialize Stars
      const numStars = 150;
      starsRef.current = Array.from({ length: numStars }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2,
        speed: Math.random() * 0.5 + 0.1,
        opacity: Math.random() * 0.5 + 0.3
      }));
      
      isInitializedRef.current = true;
    }

    const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, offset: number) => {
      ctx.save();
      
      // Pulse grid to "beat"
      const pulse = Math.sin(Date.now() * 0.01) * 0.1 + 0.2;
      ctx.strokeStyle = powerUpActiveRef.current ? '#ff00ff' : '#00f3ff';
      ctx.lineWidth = 1;
      ctx.globalAlpha = pulse;

      const horizon = height * 0.4;
      
      // Vertical Perspective Lines
      for (let i = -3; i <= 3; i++) {
        const xTop = width / 2 + i * (laneWidth * 0.4);
        const xBottom = width / 2 + i * (laneWidth * 5);
        ctx.beginPath();
        ctx.moveTo(xTop, horizon);
        ctx.lineTo(xBottom, height);
        ctx.stroke();
      }

      // Horizontal Scrolling Lines
      const lineSpacing = 60;
      const numLines = 25;
      for (let i = 0; i < numLines; i++) {
        const yPos = horizon + ((i * lineSpacing + offset) % (height - horizon));
        const progress = (yPos - horizon) / (height - horizon);
        const gridLineWidth = laneWidth * 10 * progress;
        
        ctx.globalAlpha = (0.05 + (progress * 0.3)) * (pulse * 2);
        ctx.beginPath();
        ctx.moveTo(width / 2 - gridLineWidth / 2, yPos);
        ctx.lineTo(width / 2 + gridLineWidth / 2, yPos);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawShip = (ctx: CanvasRenderingContext2D, x: number, y: number, themeColor: string, time: number, score: number) => {
      ctx.save();
      ctx.translate(x, y);
      
      const level = Math.min(5, Math.floor(score / 1000));
      let shipScale = (laneWidth / 100) * (1 + level * 0.05);
      if (powerUpActiveRef.current?.type === 'shrink') shipScale *= 0.5;
      
      const shipWidth = 25 * shipScale;
      const shipHeight = 30 * shipScale;

      // --- Power-up Aura Effects ---
      if (powerUpActiveRef.current?.type === 'shield') {
        ctx.beginPath();
        ctx.arc(0, 0, (45 + level * 5) * shipScale, 0, Math.PI * 2);
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 15]);
        ctx.lineDashOffset = -time * 0.2;
        ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.01) * 0.2;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (powerUpActiveRef.current?.type === 'magnet') {
        ctx.beginPath();
        ctx.arc(0, 0, 60 * shipScale, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.01) * 0.2;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (powerUpActiveRef.current?.type === 'ghost' || isInvincible) {
        ctx.globalAlpha = 0.4 + Math.sin(Date.now() * 0.02) * 0.2;
      }

      // --- Ship Design Evolution ---
      ctx.shadowBlur = 15 + level * 5;
      ctx.shadowColor = themeColor;
      ctx.lineWidth = 1.5 + level * 0.3;
      ctx.lineJoin = 'round';

      const drawEngineGlow = (ex: number, ey: number, ew: number, eh: number, color: string) => {
        ctx.save();
        const flicker = Math.random() * 0.3 + 0.7;
        const gradient = ctx.createLinearGradient(ex, ey, ex, ey + eh * 2);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.6 * flicker;
        ctx.fillRect(ex - ew / 2, ey, ew, eh * 2);
        ctx.restore();
      };

      const drawCockpit = (cx: number, cy: number, cw: number, ch: number) => {
        ctx.fillStyle = '#001a1a';
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Reflection
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.ellipse(cx - cw * 0.3, cy - ch * 0.3, cw * 0.2, ch * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      };

      ctx.fillStyle = '#050505';
      ctx.strokeStyle = themeColor;

      if (level === 0) {
        // Level 0: Sleek Scout
        ctx.beginPath();
        ctx.moveTo(0, -shipHeight);
        ctx.lineTo(-shipWidth * 0.7, shipHeight * 0.5);
        ctx.lineTo(-shipWidth * 0.3, shipHeight * 0.5);
        ctx.lineTo(-shipWidth * 0.3, shipHeight * 0.7);
        ctx.lineTo(shipWidth * 0.3, shipHeight * 0.7);
        ctx.lineTo(shipWidth * 0.3, shipHeight * 0.5);
        ctx.lineTo(shipWidth * 0.7, shipHeight * 0.5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        drawCockpit(0, -shipHeight * 0.2, shipWidth * 0.2, shipHeight * 0.3);
        drawEngineGlow(0, shipHeight * 0.7, shipWidth * 0.4, shipHeight * 0.5, themeColor);
      } else if (level === 1) {
        // Level 1: Winged Fighter
        ctx.beginPath();
        ctx.moveTo(0, -shipHeight * 1.1);
        ctx.lineTo(-shipWidth * 0.4, -shipHeight * 0.2);
        ctx.lineTo(-shipWidth * 1.2, shipHeight * 0.4);
        ctx.lineTo(-shipWidth * 0.5, shipHeight * 0.4);
        ctx.lineTo(-shipWidth * 0.5, shipHeight * 0.8);
        ctx.lineTo(shipWidth * 0.5, shipHeight * 0.8);
        ctx.lineTo(shipWidth * 0.5, shipHeight * 0.4);
        ctx.lineTo(shipWidth * 1.2, shipHeight * 0.4);
        ctx.lineTo(shipWidth * 0.4, -shipHeight * 0.2);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        drawCockpit(0, -shipHeight * 0.3, shipWidth * 0.25, shipHeight * 0.35);
        drawEngineGlow(-shipWidth * 0.3, shipHeight * 0.8, shipWidth * 0.3, shipHeight * 0.6, themeColor);
        drawEngineGlow(shipWidth * 0.3, shipHeight * 0.8, shipWidth * 0.3, shipHeight * 0.6, themeColor);
      } else if (level === 2) {
        // Level 2: Twin-Hull Interceptor
        // Left Hull
        ctx.beginPath();
        ctx.moveTo(-shipWidth * 0.4, -shipHeight * 1.2);
        ctx.lineTo(-shipWidth * 0.8, shipHeight * 0.6);
        ctx.lineTo(-shipWidth * 0.2, shipHeight * 0.6);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Right Hull
        ctx.beginPath();
        ctx.moveTo(shipWidth * 0.4, -shipHeight * 1.2);
        ctx.lineTo(shipWidth * 0.8, shipHeight * 0.6);
        ctx.lineTo(shipWidth * 0.2, shipHeight * 0.6);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Bridge
        ctx.fillRect(-shipWidth * 0.4, -shipHeight * 0.2, shipWidth * 0.8, shipHeight * 0.4);
        ctx.strokeRect(-shipWidth * 0.4, -shipHeight * 0.2, shipWidth * 0.8, shipHeight * 0.4);
        drawCockpit(0, -shipHeight * 0.1, shipWidth * 0.3, shipHeight * 0.2);
        drawEngineGlow(-shipWidth * 0.5, shipHeight * 0.6, shipWidth * 0.4, shipHeight * 0.7, themeColor);
        drawEngineGlow(shipWidth * 0.5, shipHeight * 0.6, shipWidth * 0.4, shipHeight * 0.7, themeColor);
        drawEngineGlow(0, shipHeight * 0.2, shipWidth * 0.2, shipHeight * 0.4, themeColor);
      } else if (level === 3) {
        // Level 3: Heavy Destroyer
        ctx.beginPath();
        ctx.moveTo(0, -shipHeight * 1.3);
        ctx.lineTo(-shipWidth * 0.6, -shipHeight * 0.5);
        ctx.lineTo(-shipWidth * 1.6, shipHeight * 0.2);
        ctx.lineTo(-shipWidth * 1.6, shipHeight * 0.8);
        ctx.lineTo(-shipWidth * 0.8, shipHeight * 0.8);
        ctx.lineTo(-shipWidth * 0.8, shipHeight * 1.0);
        ctx.lineTo(shipWidth * 0.8, shipHeight * 1.0);
        ctx.lineTo(shipWidth * 0.8, shipHeight * 0.8);
        ctx.lineTo(shipWidth * 1.6, shipHeight * 0.8);
        ctx.lineTo(shipWidth * 1.6, shipHeight * 0.2);
        ctx.lineTo(shipWidth * 0.6, -shipHeight * 0.5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Tech details
        ctx.strokeRect(-shipWidth * 0.4, -shipHeight * 0.8, shipWidth * 0.8, shipHeight * 1.2);
        drawCockpit(0, -shipHeight * 0.6, shipWidth * 0.3, shipHeight * 0.4);
        drawEngineGlow(-shipWidth * 1.2, shipHeight * 0.8, shipWidth * 0.4, shipHeight * 0.8, themeColor);
        drawEngineGlow(shipWidth * 1.2, shipHeight * 0.8, shipWidth * 0.4, shipHeight * 0.8, themeColor);
        drawEngineGlow(-shipWidth * 0.4, shipHeight * 1.0, shipWidth * 0.4, shipHeight * 0.8, themeColor);
        drawEngineGlow(shipWidth * 0.4, shipHeight * 1.0, shipWidth * 0.4, shipHeight * 0.8, themeColor);
      } else if (level === 4) {
        // Level 4: Elite Vanguard
        ctx.beginPath();
        ctx.moveTo(0, -shipHeight * 1.5);
        ctx.lineTo(-shipWidth * 0.5, -shipHeight * 0.7);
        ctx.lineTo(-shipWidth * 2.0, -shipHeight * 0.2);
        ctx.lineTo(-shipWidth * 1.5, shipHeight * 0.8);
        ctx.lineTo(-shipWidth * 0.5, shipHeight * 0.5);
        ctx.lineTo(-shipWidth * 0.5, shipHeight * 1.2);
        ctx.lineTo(shipWidth * 0.5, shipHeight * 1.2);
        ctx.lineTo(shipWidth * 0.5, shipHeight * 0.5);
        ctx.lineTo(shipWidth * 1.5, shipHeight * 0.8);
        ctx.lineTo(shipWidth * 2.0, -shipHeight * 0.2);
        ctx.lineTo(shipWidth * 0.5, -shipHeight * 0.7);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Glowing conduits
        ctx.beginPath();
        ctx.moveTo(-shipWidth * 0.3, -shipHeight); ctx.lineTo(-shipWidth * 0.3, shipHeight);
        ctx.moveTo(shipWidth * 0.3, -shipHeight); ctx.lineTo(shipWidth * 0.3, shipHeight);
        ctx.stroke();
        drawCockpit(0, -shipHeight * 0.8, shipWidth * 0.35, shipHeight * 0.5);
        drawEngineGlow(-shipWidth * 1.0, shipHeight * 0.8, shipWidth * 0.5, shipHeight * 1.0, themeColor);
        drawEngineGlow(shipWidth * 1.0, shipHeight * 0.8, shipWidth * 0.5, shipHeight * 1.0, themeColor);
        drawEngineGlow(0, shipHeight * 1.2, shipWidth * 0.6, shipHeight * 1.2, themeColor);
      } else {
        // Level 5: Neon God
        const pulse = Math.sin(time * 0.01) * 10;
        // Central Core
        ctx.beginPath();
        ctx.arc(0, 0, shipWidth * 0.8, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Floating Wings
        const wingOffset = 10 + Math.sin(time * 0.005) * 5;
        ctx.beginPath();
        ctx.moveTo(-shipWidth * 0.8 - wingOffset, -shipHeight * 1.5);
        ctx.lineTo(-shipWidth * 2.5 - wingOffset, shipHeight * 0.5);
        ctx.lineTo(-shipWidth * 1.2 - wingOffset, shipHeight * 1.2);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(shipWidth * 0.8 + wingOffset, -shipHeight * 1.5);
        ctx.lineTo(shipWidth * 2.5 + wingOffset, shipHeight * 0.5);
        ctx.lineTo(shipWidth * 1.2 + wingOffset, shipHeight * 1.2);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Energy Core
        ctx.shadowBlur = 30 + pulse;
        ctx.fillStyle = themeColor;
        ctx.beginPath();
        ctx.arc(0, 0, shipWidth * 0.4, 0, Math.PI * 2);
        ctx.fill();
        drawCockpit(0, -shipHeight * 0.4, shipWidth * 0.2, shipHeight * 0.3);
        drawEngineGlow(0, shipHeight * 0.8, shipWidth * 1.2, shipHeight * 2.0, themeColor);
        // Aura
        ctx.save();
        ctx.globalAlpha = 0.2 + Math.sin(time * 0.005) * 0.1;
        ctx.beginPath();
        ctx.arc(0, 0, 80 * shipScale, 0, Math.PI * 2);
        ctx.fillStyle = themeColor;
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    };

    let lastTime = performance.now();
    const update = (time: number) => {
      if (!isStarted || isGameOver) return;

      const dt = Math.min(32, time - lastTime) / 16.67; // Normalize to ~60fps
      lastTime = time;

      // Handle Power-up Expiry
      if (powerUpActiveRef.current && time > powerUpActiveRef.current.end) {
        powerUpActiveRef.current = null;
        multiplierRef.current = 1;
        onPowerUpChange(null);
      }

      // Speed Adjustment for Slow-mo and Turbo
      let speedMod = 1;
      if (powerUpActiveRef.current?.type === 'slowmo') speedMod = 0.4;
      if (powerUpActiveRef.current?.type === 'turbo') speedMod = 2.5;
      
      const effectiveSpeed = speedRef.current * speedMod * dt;

      // Screen Shake
      let shakeX = 0;
      let shakeY = 0;
      if (shakeRef.current > 0) {
        shakeX = (Math.random() - 0.5) * shakeRef.current;
        shakeY = (Math.random() - 0.5) * shakeRef.current;
        shakeRef.current *= Math.pow(0.9, dt);
      }

      // Background - Absolute Black
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Stars
      ctx.save();
      starsRef.current.forEach(star => {
        star.y += star.speed * (effectiveSpeed / 5);
        if (star.y > canvas.height) {
          star.y = 0;
          star.x = Math.random() * canvas.width;
        }
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = star.opacity;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      offsetRef.current = (offsetRef.current + effectiveSpeed) % 60;
      drawGrid(ctx, canvas.width, canvas.height, offsetRef.current);

      const playerX = (playerPosRef.current.x * canvas.width) + shakeX;
      const playerY = (playerPosRef.current.y * canvas.height) + shakeY;

      // Ship Evolution Check
      const currentLevel = Math.min(5, Math.floor(scoreRef.current / 1000));
      if (currentLevel > lastLevelRef.current) {
        lastLevelRef.current = currentLevel;
        const levelBonus = currentLevel * 500;
        scoreRef.current += levelBonus;
        onScoreUpdate(scoreRef.current);
        
        floatingTextsRef.current.push({
          x: playerX, y: playerY - 80,
          text: `EVOLVED! +${levelBonus}`,
          life: 2, color: '#00f3ff'
        });
        shakeRef.current = 20;
      }

      let themeColor = '#00f3ff';
      if (powerUpActiveRef.current?.type === 'multiplier') themeColor = '#fff01f';
      if (powerUpActiveRef.current?.type === 'ghost') themeColor = '#bf00ff';
      if (powerUpActiveRef.current?.type === 'slowmo') themeColor = '#0070ff';
      if (powerUpActiveRef.current?.type === 'magnet') themeColor = '#00ff88';
      if (powerUpActiveRef.current?.type === 'shrink') themeColor = '#00ffcc';
      if (powerUpActiveRef.current?.type === 'turbo') themeColor = '#ff8800';

      drawShip(ctx, playerX, playerY, themeColor, time, scoreRef.current);

      // Slow-mo Scanlines
      if (powerUpActiveRef.current?.type === 'slowmo') {
        ctx.save();
        ctx.strokeStyle = '#0070ff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.1;
        for (let i = 0; i < canvas.height; i += 4) {
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(canvas.width, i);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Blast Wave Effect
      if (blastWaveRef.current) {
        const bw = blastWaveRef.current;
        bw.radius += 20 * dt;
        bw.life -= 0.02 * dt;
        ctx.save();
        ctx.beginPath();
        ctx.arc(bw.x, bw.y, bw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff3131';
        ctx.lineWidth = 5;
        ctx.globalAlpha = bw.life;
        ctx.stroke();
        ctx.restore();
        if (bw.life <= 0) blastWaveRef.current = null;
      }

      // Floating Texts
      floatingTextsRef.current = floatingTextsRef.current.filter(ft => {
        ft.y -= 2 * dt;
        ft.life -= 0.02 * dt;
        ctx.save();
        ctx.globalAlpha = ft.life;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 20px "Space Grotesk"';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        ctx.shadowColor = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
        return ft.life > 0;
      });

      let blastTriggered = false;

      // Obstacles & Power-ups
      obstaclesRef.current = obstaclesRef.current.filter(obs => {
        const obsSpeed = (obs.speed || (powerUpActiveRef.current?.type === 'slowmo' ? speedRef.current * 0.4 : speedRef.current)) * dt;
        obs.y += obsSpeed;
        
        // Magnet Effect: Pull power-ups towards player
        if (obs.type === 'powerup' && powerUpActiveRef.current?.type === 'magnet') {
          const dx = playerX - (obs.x + obs.width / 2);
          const dy = playerY - (obs.y + obs.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 400) {
            obs.x += (dx / dist) * 15 * dt;
            obs.y += (dy / dist) * 15 * dt;
          }
        }

        if (obs.type === 'moving' && obs.vx) {
          obs.x += obs.vx * dt;
          if (obs.x < 0 || obs.x > canvas.width - obs.width) {
            obs.vx *= -1;
          }
        }

        // Draw
        ctx.save();
        if (obs.type === 'powerup') {
          const bounce = Math.sin(time * 0.01) * 5;
          ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2 + bounce);
          ctx.rotate(time * 0.005);
          ctx.shadowBlur = 25;
          
          let pColor = '#fff01f'; // Default multiplier
          if (obs.powerUpType === 'shield') pColor = '#00f3ff';
          if (obs.powerUpType === 'slowmo') pColor = '#0070ff';
          if (obs.powerUpType === 'ghost') pColor = '#bf00ff';
          if (obs.powerUpType === 'blast') pColor = '#ff3131';
          if (obs.powerUpType === 'magnet') pColor = '#00ff88';
          if (obs.powerUpType === 'shrink') pColor = '#00ffcc';
          if (obs.powerUpType === 'turbo') pColor = '#ff8800';

          ctx.shadowColor = pColor;
          ctx.fillStyle = pColor;
          
          // Draw Star
          const spikes = 5;
          const outerRadius = 18;
          const innerRadius = 8;
          let rot = Math.PI / 2 * 3;
          let x_pos = 0;
          let y_pos = 0;
          let step = Math.PI / spikes;

          ctx.beginPath();
          ctx.moveTo(0, -outerRadius);
          for (let i = 0; i < spikes; i++) {
            x_pos = Math.cos(rot) * outerRadius;
            y_pos = Math.sin(rot) * outerRadius;
            ctx.lineTo(x_pos, y_pos);
            rot += step;

            x_pos = Math.cos(rot) * innerRadius;
            y_pos = Math.sin(rot) * innerRadius;
            ctx.lineTo(x_pos, y_pos);
            rot += step;
          }
          ctx.lineTo(0, -outerRadius);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          // Asteroid Obstacle
          ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
          const color = `hsl(${obs.hue}, 100%, 50%)`;
          ctx.shadowBlur = 20;
          ctx.shadowColor = color;
          ctx.rotate(time * 0.002);
          
          // Draw irregular body
          ctx.fillStyle = '#111';
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (obs.points && obs.points.length > 0) {
            ctx.moveTo(obs.points[0].x, obs.points[0].y);
            for (let i = 1; i < obs.points.length; i++) {
              ctx.lineTo(obs.points[i].x, obs.points[i].y);
            }
          } else {
            ctx.arc(0, 0, obs.width / 2, 0, Math.PI * 2);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Add Craters for texture
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          if (obs.points && obs.points.length > 0) {
            for (let i = 0; i < 3; i++) {
              const p = obs.points[i * 2 % obs.points.length];
              ctx.beginPath();
              ctx.arc(p.x * 0.5, p.y * 0.5, obs.width * 0.1, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
        }
        ctx.restore();

        // Collision & Near Miss Logic
        const dx = playerX - (obs.x + obs.width / 2);
        const dy = playerY - (obs.y + obs.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        let shipScale = laneWidth / 100;
        if (powerUpActiveRef.current?.type === 'shrink') shipScale *= 0.5;
        
        const collisionRadius = 38 * shipScale; 
        const nearMissRadius = 65 * shipScale; 
        
        // Even more generous collision for power-ups
        const powerUpRadius = 50 * (laneWidth / 100);
        
        // Near Miss Detection
        if (obs.type !== 'powerup' && !obs.hasNearMissed && dist < nearMissRadius && dist > collisionRadius) {
          obs.hasNearMissed = true;
          const nearMissPoints = 50 * multiplierRef.current;
          scoreRef.current += nearMissPoints;
          onScoreUpdate(scoreRef.current);
          comboRef.current += 1;
          
          floatingTextsRef.current.push({
            x: playerX, y: playerY - 40,
            text: multiplierRef.current > 1 ? `NEAR MISS x${multiplierRef.current}!` : 'NEAR MISS!',
            life: 0.8, color: '#ffffff'
          });

          // Sparkle effect for near miss
          for (let i = 0; i < 5; i++) {
            particlesRef.current.push({
              x: playerX + (Math.random() - 0.5) * 40,
              y: playerY + (Math.random() - 0.5) * 40,
              vx: (Math.random() - 0.5) * 10,
              vy: (Math.random() - 0.5) * 10,
              life: 0.5,
              color: '#ffffff'
            });
          }
        }

        const isColliding = obs.type === 'powerup' ? dist < powerUpRadius : dist < collisionRadius;

        if (isColliding) {
          if (obs.type === 'powerup') {
            const pType = obs.powerUpType || 'multiplier';
            
            if (pType === 'blast') {
              blastTriggered = true;
              shakeRef.current = 30;
              blastWaveRef.current = { x: playerX, y: playerY, radius: 0, life: 1 };
              // Add blast particles
              for (let i = 0; i < 50; i++) {
                particlesRef.current.push({
                  x: canvas.width / 2, y: canvas.height / 2,
                  vx: (Math.random() - 0.5) * 40,
                  vy: (Math.random() - 0.5) * 40,
                  life: 1.5, color: '#ff3131'
                });
              }
            } else {
              const newPowerUp = { type: pType, end: time + 5000 };
              powerUpActiveRef.current = newPowerUp;
              onPowerUpChange(newPowerUp);
              if (pType === 'multiplier') multiplierRef.current = Math.max(multiplierRef.current, 5);
              if (pType === 'turbo') multiplierRef.current = Math.max(multiplierRef.current, 10);
            }
            
            floatingTextsRef.current.push({
              x: playerX, y: playerY - 50,
              text: pType.toUpperCase() + '!',
              life: 1, color: pType === 'blast' ? '#ff3131' : '#fff01f'
            });
            return false;
          } else {
            // Ghost power-up or Invincibility bypasses obstacles
            if (powerUpActiveRef.current?.type === 'ghost' || isInvincible) {
              return true;
            }

            // Collision Particles
            for (let i = 0; i < 20; i++) {
              particlesRef.current.push({
                x: playerX,
                y: playerY,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                life: 1,
                color: '#ff0000'
              });
            }

            if (powerUpActiveRef.current?.type === 'shield') {
              powerUpActiveRef.current = null;
              onPowerUpChange(null);
              shakeRef.current = 15;
              floatingTextsRef.current.push({
                x: playerX, y: playerY - 50,
                text: 'SHIELD BROKEN',
                life: 1, color: '#ff00ff'
              });
              return false;
            }
            shakeRef.current = 40;
            onGameOver(scoreRef.current);
            return false;
          }
        }

        if (obs.y > canvas.height) {
          // Dodge Success
          if (obs.type !== 'powerup') {
            comboRef.current++;
            if (comboRef.current % 5 === 0) {
              floatingTextsRef.current.push({
                x: playerX, y: playerY - 50,
                text: `COMBO x${comboRef.current}`,
                life: 1, color: '#39ff14'
              });
            }
            // Combo adds to base points: 10 + 1 for every 5 combo
            const basePoints = 10 + Math.floor(comboRef.current / 5);
            const points = basePoints * multiplierRef.current;
            scoreRef.current += points;
            onScoreUpdate(scoreRef.current);
          }
          return false;
        }
        return true;
      });

      if (blastTriggered) {
        const destroyedCount = obstaclesRef.current.filter(o => o.type !== 'powerup').length;
        if (destroyedCount > 0) {
          const blastBonus = destroyedCount * 100 * multiplierRef.current;
          scoreRef.current += blastBonus;
          onScoreUpdate(scoreRef.current);
          floatingTextsRef.current.push({
            x: playerX, y: playerY - 100,
            text: `BLAST BONUS: +${blastBonus}`,
            life: 1.5, color: '#ff3131'
          });
        }
        obstaclesRef.current = obstaclesRef.current.filter(o => o.type === 'powerup');
      }

      // Spawning
      const spawnRate = 1000 / (speedRef.current / 5);
      if (time - lastObstacleTime.current > spawnRate) {
        const roll = Math.random();
        const lane = Math.floor(Math.random() * LANES);
        
        if (roll > 0.96) { // Power-up spawn
          const pTypes: ('shield' | 'slowmo' | 'multiplier' | 'ghost' | 'blast' | 'magnet' | 'shrink' | 'turbo')[] = 
            ['shield', 'slowmo', 'multiplier', 'ghost', 'blast', 'magnet', 'shrink', 'turbo'];
          const pSize = laneWidth * 0.5;
          const pType = pTypes[Math.floor(Math.random() * pTypes.length)];
          
          obstaclesRef.current.push({
            id: Math.random(), lane, type: 'powerup',
            powerUpType: pType,
            x: Math.random() * (canvas.width - pSize),
            y: -100, width: pSize, height: pSize, hue: 60
          });
        } else {
          // More variety in obstacles
          const isMoving = roll > 0.75;
          const isFast = roll < 0.15;
          const isLarge = roll > 0.4 && roll < 0.5;
          
          const baseSize = laneWidth * (isLarge ? 0.8 : 0.4);
          const size = baseSize + Math.random() * (laneWidth * 0.3);
          const points = [];
          const numPoints = 8 + Math.floor(Math.random() * 5);
          for (let i = 0; i < numPoints; i++) {
            const angle = (i * Math.PI * 2) / numPoints;
            const r = (size / 2) * (0.8 + Math.random() * 0.4);
            points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
          }

          const obsSpeed = isFast ? speedRef.current * 1.5 : speedRef.current;

          obstaclesRef.current.push({
            id: Math.random(), lane, type: isMoving ? 'moving' : 'static',
            vx: isMoving ? (Math.random() > 0.5 ? 4 : -4) : 0,
            x: Math.random() * (canvas.width - size),
            y: -100, width: size, height: size, hue: isFast ? 180 : (isMoving ? 280 : 330),
            points,
            speed: obsSpeed // Store individual speed
          });

          // Occasional cluster spawn
          if (roll > 0.9) {
            const clusterSize = laneWidth * (0.2 + Math.random() * 0.2);
            const clusterPoints = [];
            const clusterNumPoints = 6 + Math.floor(Math.random() * 4);
            for (let i = 0; i < clusterNumPoints; i++) {
              const angle = (i * Math.PI * 2) / clusterNumPoints;
              const r = (clusterSize / 2) * (0.8 + Math.random() * 0.4);
              clusterPoints.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
            }
            
            obstaclesRef.current.push({
              id: Math.random(), lane, type: 'static',
              vx: 0,
              x: Math.random() * (canvas.width - clusterSize),
              y: -150, width: clusterSize, height: clusterSize, hue: 200,
              points: clusterPoints
            });
          }
        }
        lastObstacleTime.current = time;
      }

      // Particles
      const particleChance = powerUpActiveRef.current?.type === 'turbo' ? 0.8 : 0.3;
      if (Math.random() < particleChance) {
        particlesRef.current.push({
          x: playerX + (Math.random() - 0.5) * 20,
          y: playerY + 30,
          vx: (Math.random() - 0.5) * 5,
          vy: Math.random() * 5 + (powerUpActiveRef.current?.type === 'turbo' ? 15 : 5),
          life: 1,
          color: powerUpActiveRef.current ? themeColor : '#00f3ff'
        });
      }

      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 0.02 * dt;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        return p.life > 0;
      });

      speedRef.current += SPEED_INCREMENT * dt;
      frameRef.current = requestAnimationFrame(update);
    };

    frameRef.current = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(frameRef.current);
    };
  }, [isStarted, isGameOver, isPaused, isInvincible, onGameOver, onScoreUpdate, laneWidth]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full touch-none"
      id="game-canvas"
    />
  );
};
