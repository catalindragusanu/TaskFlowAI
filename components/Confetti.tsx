import React, { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  velocity: { x: number; y: number };
  rotation: number;
  rotationSpeed: number;
}

export const Confetti: React.FC = () => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // Colors from your palette
    const colors = ['#660708', '#a4161a', '#e5383b', '#f5f3f4', '#b1a7a6'];
    const particleCount = 50;
    const newParticles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        velocity: {
          x: (Math.random() - 0.5) * 20,
          y: (Math.random() - 0.5) * 20,
        },
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }

    setParticles(newParticles);
  }, []);

  useEffect(() => {
    // FIX: Removed the early return "if (particles.length === 0) return;" 
    // This allows the interval to start immediately so it catches the state update.
    
    const interval = setInterval(() => {
      setParticles((prevParticles) => {
        if (prevParticles.length === 0) return prevParticles;
        
        return prevParticles
          .map((p) => ({
            ...p,
            x: p.x + p.velocity.x,
            y: p.y + p.velocity.y,
            velocity: {
              x: p.velocity.x * 0.95, // friction
              y: p.velocity.y * 0.95 + 0.5, // gravity
            },
            rotation: p.rotation + p.rotationSpeed,
          }))
          .filter((p) => p.y < window.innerHeight && p.x > 0 && p.x < window.innerWidth);
      });
    }, 16);

    return () => clearInterval(interval);
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
};