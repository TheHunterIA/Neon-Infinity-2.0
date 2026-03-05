import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';

interface SphereControllerProps {
  onMove: (vector: { x: number; y: number }) => void;
  onEnd: () => void;
}

export const SphereController: React.FC<SphereControllerProps> = ({ onMove, onEnd }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const radius = 60; // Controller radius

  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    updatePosition(clientX, clientY);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    updatePosition(clientX, clientY);
  };

  const updatePosition = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = clientX - centerX;
    let dy = clientY - centerY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > radius) {
      dx = (dx / distance) * radius;
      dy = (dy / distance) * radius;
    }

    setPosition({ x: dx, y: dy });
    
    // Normalize vector to -1 to 1
    onMove({ x: dx / radius, y: dy / radius });
  };

  const handleEnd = () => {
    setIsDragging(false);
    setPosition({ x: 0, y: 0 });
    onEnd();
  };

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleGlobalTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX, e.touches[0].clientY);
    const handleGlobalEnd = () => handleEnd();

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('mouseup', handleGlobalEnd);
      window.addEventListener('touchmove', handleGlobalTouchMove);
      window.addEventListener('touchend', handleGlobalEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('mouseup', handleGlobalEnd);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [isDragging]);

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4 pointer-events-auto">
      <div 
        ref={containerRef}
        className="relative w-32 h-32 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
        onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      >
        {/* Decorative Inner Rings */}
        <div className="absolute inset-2 rounded-full border border-white/5 animate-[pulse_4s_infinite]" />
        <div className="absolute inset-4 rounded-full border border-white/5 animate-[pulse_3s_infinite]" />
        
        {/* The Sphere (Joystick Handle) */}
        <motion.div
          animate={{ 
            x: position.x, 
            y: position.y,
            rotateX: -position.y * 0.5,
            rotateY: position.x * 0.5
          }}
          transition={isDragging ? { type: 'spring', stiffness: 1000, damping: 50 } : { type: 'spring', stiffness: 300, damping: 20 }}
          className="relative w-16 h-16 rounded-full cursor-grab active:cursor-grabbing group"
          style={{ perspective: '1000px' }}
        >
          {/* Main Sphere Body */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/40 to-white/5 border border-white/20 shadow-[inset_0_2px_10px_rgba(255,255,255,0.3),0_10px_20px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* Glossy Highlight */}
            <div className="absolute top-1 left-1 w-1/2 h-1/2 bg-gradient-to-br from-white/40 to-transparent rounded-full blur-[2px]" />
            
            {/* Texture/Grid to show rotation */}
            <div className="absolute inset-0 opacity-20 pointer-events-none"
                 style={{ 
                   backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)',
                   backgroundSize: '10px 10px'
                 }} 
            />

            {/* Dynamic Glow based on direction */}
            <div 
              className="absolute inset-0 opacity-40 transition-opacity group-active:opacity-80"
              style={{
                background: `radial-gradient(circle at ${50 + (position.x / radius) * 50}% ${50 + (position.y / radius) * 50}%, #00f3ff, transparent 70%)`
              }}
            />
          </div>

          {/* Orbiting Ring (Visual Feedback) */}
          <div 
            className="absolute -inset-2 rounded-full border border-neon-cyan/20 opacity-0 group-active:opacity-100 transition-opacity"
            style={{
              transform: `rotateX(${position.y * 0.5}deg) rotateY(${position.x * 0.5}deg)`
            }}
          />
        </motion.div>

        {/* Directional Hints */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-widest text-white/20 font-mono">Forward</div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-widest text-white/20 font-mono">Reverse</div>
        <div className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] uppercase tracking-widest text-white/20 font-mono">Port</div>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-[8px] uppercase tracking-widest text-white/20 font-mono">Starboard</div>
      </div>
      
      <div className="text-[10px] uppercase tracking-[0.3em] text-white/30 font-mono">
        Sphere Controller Active
      </div>
    </div>
  );
};
