export interface GameState {
  score: number;
  isGameOver: boolean;
  isStarted: boolean;
  highScore: number;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
}

export interface Obstacle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  lane: number;
  type: 'static' | 'moving' | 'powerup';
  vx?: number;
  hue: number;
  powerUpType?: 'shield' | 'slowmo' | 'multiplier';
  points?: { x: number, y: number }[];
  speed?: number;
  hasNearMissed?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}
