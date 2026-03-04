import React, { useEffect, useRef, useState } from 'react';
import { Obstacle, Particle } from '../types';

interface GameProps {
  isStarted: boolean;
  isGameOver: boolean;
  isPaused: boolean;
  playerPos: { x: number, y: number, vx: number, vy: number };
  onGameOver: (score: number) => void;
  onScoreUpdate: (score: number) => void;
}

const LANES = 3;
const INITIAL_SPEED = 7;
const SPEED_INCREMENT = 0.002;

export const Game: React.FC<GameProps> = ({ isStarted, isGameOver, isPaused, playerPos, onGameOver, onScoreUpdate }) => {
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
  const powerUpActiveRef = useRef<{ type: string, end: number } | null>(null);
  const floatingTextsRef = useRef<{ x: number, y: number, text: string, life: number, color: string }[]>([]);

  useEffect(() => {
    playerPosRef.current = playerPos;
  }, [playerPos]);

  useEffect(() => {
    if (!isStarted || isGameOver || isPaused) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let currentLaneWidth = 100;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Ensure lanes are always visible even on very small screens
      currentLaneWidth = Math.max(60, Math.min(140, canvas.width / (LANES + 1)));
      setLaneWidth(currentLaneWidth);
    };

    window.addEventListener('resize', resize);
    resize();

    // Reset state
    scoreRef.current = 0;
    speedRef.current = INITIAL_SPEED;
    obstaclesRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    comboRef.current = 0;
    multiplierRef.current = 1;
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
        const xTop = width / 2 + i * (currentLaneWidth * 0.4);
        const xBottom = width / 2 + i * (currentLaneWidth * 5);
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
        const lineWidth = currentLaneWidth * 10 * progress;
        
        ctx.globalAlpha = (0.05 + (progress * 0.3)) * (pulse * 2);
        ctx.beginPath();
        ctx.moveTo(width / 2 - lineWidth / 2, yPos);
        ctx.lineTo(width / 2 + lineWidth / 2, yPos);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawShip = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.save();
      ctx.translate(x, y);
      
      const shipScale = currentLaneWidth / 100;
      const shipWidth = 25 * shipScale;
      const shipHeight = 30 * shipScale;

      // Shield Effect
      if (powerUpActiveRef.current?.type === 'shield') {
        ctx.beginPath();
        ctx.arc(0, 0, 40 * shipScale, 0, Math.PI * 2);
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // Minimalist Player Geometry (Triangle of Light)
      ctx.shadowBlur = 25;
      const themeColor = powerUpActiveRef.current?.type === 'multiplier' ? '#fff01f' : '#00f3ff';
      ctx.shadowColor = themeColor;
      ctx.fillStyle = '#000';
      ctx.strokeStyle = themeColor;
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(0, -shipHeight); // Tip
      ctx.lineTo(-shipWidth, shipHeight * 0.66); // Bottom Left
      ctx.lineTo(shipWidth, shipHeight * 0.66);  // Bottom Right
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner Light Core
      ctx.shadowBlur = 10;
      ctx.fillStyle = themeColor;
      ctx.beginPath();
      ctx.moveTo(0, -shipHeight * 0.5);
      ctx.lineTo(-shipWidth * 0.4, shipHeight * 0.33);
      ctx.lineTo(shipWidth * 0.4, shipHeight * 0.33);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    const update = (time: number) => {
      if (!isStarted || isGameOver) return;

      // Handle Power-up Expiry
      if (powerUpActiveRef.current && time > powerUpActiveRef.current.end) {
        powerUpActiveRef.current = null;
        multiplierRef.current = 1;
      }

      // Speed Adjustment for Slow-mo
      const effectiveSpeed = powerUpActiveRef.current?.type === 'slowmo' ? speedRef.current * 0.4 : speedRef.current;

      // Screen Shake
      let shakeX = 0;
      let shakeY = 0;
      if (shakeRef.current > 0) {
        shakeX = (Math.random() - 0.5) * shakeRef.current;
        shakeY = (Math.random() - 0.5) * shakeRef.current;
        shakeRef.current *= 0.9;
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

      drawShip(ctx, playerX, playerY);

      // Floating Texts
      floatingTextsRef.current = floatingTextsRef.current.filter(ft => {
        ft.y -= 2;
        ft.life -= 0.02;
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

      // Obstacles & Power-ups
      obstaclesRef.current = obstaclesRef.current.filter(obs => {
        const obsSpeed = obs.speed || effectiveSpeed;
        obs.y += obsSpeed;
        
        if (obs.type === 'moving' && obs.vx) {
          obs.x += obs.vx;
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
          ctx.shadowColor = '#fff01f';
          ctx.fillStyle = '#fff01f';
          
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

        // Collision
        const dx = playerX - (obs.x + obs.width / 2);
        const dy = playerY - (obs.y + obs.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 45) {
          if (obs.type === 'powerup') {
            const pType = obs.powerUpType || 'multiplier';
            powerUpActiveRef.current = { type: pType, end: time + 5000 };
            if (pType === 'multiplier') multiplierRef.current = 5;
            
            floatingTextsRef.current.push({
              x: playerX, y: playerY - 50,
              text: pType.toUpperCase() + '!',
              life: 1, color: '#fff01f'
            });
            return false;
          } else {
            if (powerUpActiveRef.current?.type === 'shield') {
              powerUpActiveRef.current = null;
              shakeRef.current = 10;
              floatingTextsRef.current.push({
                x: playerX, y: playerY - 50,
                text: 'SHIELD BROKEN',
                life: 1, color: '#ff00ff'
              });
              return false;
            }
            shakeRef.current = 30;
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
            const points = 10 * multiplierRef.current;
            scoreRef.current += points;
            onScoreUpdate(scoreRef.current);
          }
          return false;
        }
        return true;
      });

      // Spawning
      const spawnRate = 1000 / (speedRef.current / 5);
      if (time - lastObstacleTime.current > spawnRate) {
        const roll = Math.random();
        const lane = Math.floor(Math.random() * LANES);
        
        if (roll > 0.96) { // Power-up spawn
          const pTypes: ('shield' | 'slowmo' | 'multiplier')[] = ['shield', 'slowmo', 'multiplier'];
          const pSize = currentLaneWidth * 0.5;
          obstaclesRef.current.push({
            id: Math.random(), lane, type: 'powerup',
            powerUpType: pTypes[Math.floor(Math.random() * pTypes.length)],
            x: Math.random() * (canvas.width - pSize),
            y: -100, width: pSize, height: pSize, hue: 60
          });
        } else {
          // More variety in obstacles
          const isMoving = roll > 0.75;
          const isFast = roll < 0.15;
          const isLarge = roll > 0.4 && roll < 0.5;
          
          const baseSize = currentLaneWidth * (isLarge ? 0.8 : 0.4);
          const size = baseSize + Math.random() * (currentLaneWidth * 0.3);
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
            const clusterSize = currentLaneWidth * (0.2 + Math.random() * 0.2);
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
      if (Math.random() > 0.3) {
        particlesRef.current.push({
          x: playerX + (Math.random() - 0.5) * 20,
          y: playerY + 30,
          vx: (Math.random() - 0.5) * 5,
          vy: Math.random() * 5 + 5,
          life: 1,
          color: powerUpActiveRef.current ? '#fff01f' : '#00f3ff'
        });
      }

      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        return p.life > 0;
      });

      speedRef.current += SPEED_INCREMENT;
      frameRef.current = requestAnimationFrame(update);
    };

    frameRef.current = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isStarted, isGameOver, isPaused, onGameOver, onScoreUpdate]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full touch-none"
      id="game-canvas"
    />
  );
};
